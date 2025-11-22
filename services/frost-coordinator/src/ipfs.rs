use anyhow::{Context, Result};
use ipfs_api_backend_hyper::{IpfsApi, IpfsClient as IpfsApiClient, TryFromUri};
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};
use std::io::Cursor;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceFile {
    pub filename: String,
    pub mime_type: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceMetadata {
    pub evidence_id: String,
    pub board_category: String,
    pub title: String,
    pub description: String,
    pub files: Vec<FileMetadata>,
    pub timestamp: u64,
    pub commitment_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub filename: String,
    pub mime_type: String,
    pub size: u64,
    pub ipfs_hash: String,
}

pub struct IpfsService {
    client: IpfsApiClient,
}

impl IpfsService {
    pub fn new(ipfs_api_url: &str) -> Result<Self> {
        let client = IpfsApiClient::from_str(ipfs_api_url)
            .context("Failed to create IPFS client")?;

        Ok(Self { client })
    }

    pub fn default() -> Result<Self> {
        Self::new("http:
    }

    pub async fn upload_file(&self, data: Vec<u8>) -> Result<String> {
        let cursor = Cursor::new(data);

        let response = self.client
            .add(cursor)
            .await
            .context("Failed to upload file to IPFS")?;

        Ok(response.hash)
    }

    pub async fn upload_json<T: Serialize>(&self, data: &T) -> Result<String> {
        let json = serde_json::to_vec(data)
            .context("Failed to serialize to JSON")?;

        self.upload_file(json).await
    }

    pub async fn download_file(&self, cid: &str) -> Result<Vec<u8>> {
        let bytes = self.client
            .cat(cid)
            .map_ok(|chunk| chunk.to_vec())
            .try_concat()
            .await
            .context("Failed to download file from IPFS")?;

        Ok(bytes)
    }

    pub async fn download_json<T: for<'de> Deserialize<'de>>(&self, cid: &str) -> Result<T> {
        let bytes = self.download_file(cid).await?;

        let data: T = serde_json::from_slice(&bytes)
            .context("Failed to deserialize JSON from IPFS")?;

        Ok(data)
    }

    pub async fn pin(&self, cid: &str) -> Result<()> {
        self.client
            .pin_add(cid, false)
            .await
            .context("Failed to pin IPFS content")?;

        Ok(())
    }

    pub async fn unpin(&self, cid: &str) -> Result<()> {
        self.client
            .pin_rm(cid, false)
            .await
            .context("Failed to unpin IPFS content")?;

        Ok(())
    }

    pub async fn upload_evidence(
        &self,
        evidence_id: &str,
        board_category: &str,
        title: &str,
        description: &str,
        files: Vec<EvidenceFile>,
        commitment_hash: &str,
    ) -> Result<(String, Vec<FileMetadata>)> {
        let mut file_metadata = Vec::new();

        for file in files {
            let cid = self.upload_file(file.data.clone()).await?;

            self.pin(&cid).await?;

            file_metadata.push(FileMetadata {
                filename: file.filename,
                mime_type: file.mime_type,
                size: file.data.len() as u64,
                ipfs_hash: cid,
            });
        }

        let metadata = EvidenceMetadata {
            evidence_id: evidence_id.to_string(),
            board_category: board_category.to_string(),
            title: title.to_string(),
            description: description.to_string(),
            files: file_metadata.clone(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            commitment_hash: commitment_hash.to_string(),
        };

        let metadata_cid = self.upload_json(&metadata).await?;

        self.pin(&metadata_cid).await?;

        Ok((metadata_cid, file_metadata))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_ipfs_upload_download() {
        let ipfs = IpfsService::default().unwrap();

        let test_data = b"Hello, IPFS!".to_vec();
        let cid = ipfs.upload_file(test_data.clone()).await.unwrap();

        let downloaded = ipfs.download_file(&cid).await.unwrap();
        assert_eq!(test_data, downloaded);
    }

    #[tokio::test]
    #[ignore]
    async fn test_ipfs_json() {
        let ipfs = IpfsService::default().unwrap();

        #[derive(Serialize, Deserialize, PartialEq, Debug)]
        struct TestData {
            message: String,
        }

        let data = TestData {
            message: "Test message".to_string(),
        };

        let cid = ipfs.upload_json(&data).await.unwrap();
        let downloaded: TestData = ipfs.download_json(&cid).await.unwrap();

        assert_eq!(data, downloaded);
    }
}
