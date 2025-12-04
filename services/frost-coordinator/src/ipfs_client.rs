use reqwest::{Client, multipart};
use serde::{Deserialize, Serialize};
use anyhow::{Result, Context};
use crate::metadata_stripper::MetadataStripper;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EvidenceMetadata {
    pub evidence_id: String,
    pub board_category: String,
    pub title: String,
    pub description: String,
    pub files: Vec<FileMetadata>,
    pub timestamp: u64,
    pub zcash_txid: Option<String>,
    pub commitment_hash: String,
    pub viewing_keys: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileMetadata {
    pub filename: String,
    pub mime_type: String,
    pub size: u64,
    pub ipfs_hash: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AddResponse {
    #[serde(rename = "Hash")]
    hash: String,
    #[serde(rename = "Size")]
    size: String,
}

#[derive(Debug, Deserialize)]
struct PinAddResponse {
    #[serde(rename = "Pins")]
    pins: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct VersionResponse {
    #[serde(rename = "Version")]
    version: String,
}

pub struct IpfsClient {
    base_url: String,
    client: Client,
    pinata_jwt: Option<String>,
}

impl IpfsClient {
    pub fn new() -> Result<Self> {
        let base_url = "http://127.0.0.1:5001".to_string();
        let client = Client::new();
        let pinata_jwt = std::env::var("PINATA_JWT").ok();

        if pinata_jwt.is_some() {
            tracing::info!("IPFS client initialized with Pinata");
        } else {
            tracing::info!("IPFS client initialized ({})", base_url);
        }

        Ok(Self { base_url, client, pinata_jwt })
    }

    pub fn with_uri(uri: &str) -> Result<Self> {
        let base_url = uri.trim_end_matches('/').to_string();
        let client = Client::new();
        let pinata_jwt = std::env::var("PINATA_JWT").ok();

        if pinata_jwt.is_some() {
            tracing::info!("IPFS client initialized with Pinata");
        } else {
            tracing::info!("IPFS client initialized ({})", base_url);
        }

        Ok(Self { base_url, client, pinata_jwt })
    }

    pub async fn upload_evidence(
        &self,
        metadata: &EvidenceMetadata,
        files: Vec<(String, Vec<u8>)>,
    ) -> Result<String> {
        let metadata_json = serde_json::to_vec_pretty(metadata)
            .context("Failed to serialize evidence metadata")?;

        let metadata_cid = self.upload_file("metadata.json", metadata_json).await?;

        let cleaned_files = MetadataStripper::strip_metadata_batch(files).await?;

        for (filename, data) in cleaned_files {
            let file_cid = self.upload_file(&filename, data).await?;
            tracing::info!("Uploaded file '{}' to IPFS: {}", filename, file_cid);
        }

        Ok(metadata_cid)
    }

    pub async fn download_evidence(&self, metadata_cid: &str) -> Result<EvidenceMetadata> {
        let metadata_bytes = self.download_file(metadata_cid).await?;

        let metadata: EvidenceMetadata = serde_json::from_slice(&metadata_bytes)
            .context("Failed to deserialize evidence metadata")?;

        Ok(metadata)
    }

    pub async fn upload_file(
        &self,
        filename: &str,
        data: Vec<u8>,
    ) -> Result<String> {
        if let Some(jwt) = &self.pinata_jwt {
            return self.upload_to_pinata(filename, data, jwt).await;
        }

        let size = data.len();

        tracing::debug!("Uploading file '{}' ({} bytes) to IPFS", filename, size);

        let part = multipart::Part::bytes(data)
            .file_name(filename.to_string())
            .mime_str("application/octet-stream")?;

        let form = multipart::Form::new()
            .part("file", part);

        let response: AddResponse = self.client
            .post(format!("{}/api/v0/add", self.base_url))
            .query(&[("pin", "true")])
            .multipart(form)
            .send()
            .await
            .context("Failed to send IPFS add request")?
            .json()
            .await
            .context("Failed to parse IPFS add response")?;

        let cid = response.hash;

        tracing::info!("File '{}' uploaded to IPFS: {}", filename, cid);

        Ok(cid)
    }

    async fn upload_to_pinata(&self, filename: &str, data: Vec<u8>, jwt: &str) -> Result<String> {
        tracing::info!("Uploading '{}' to Pinata", filename);

        let part = multipart::Part::bytes(data)
            .file_name(filename.to_string());

        let form = multipart::Form::new()
            .part("file", part);

        let response = self.client
            .post("https://api.pinata.cloud/pinning/pinFileToIPFS")
            .header("Authorization", format!("Bearer {}", jwt))
            .multipart(form)
            .send()
            .await
            .context("Failed to upload to Pinata")?;

        let json: serde_json::Value = response.json().await
            .context("Failed to parse Pinata response")?;

        let cid = json["IpfsHash"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Missing IpfsHash in Pinata response"))?
            .to_string();

        tracing::info!("File '{}' uploaded to Pinata: {}", filename, cid);

        Ok(cid)
    }

    pub async fn download_file(&self, cid: &str) -> Result<Vec<u8>> {
        tracing::debug!("Downloading file from IPFS: {}", cid);

        // Try Pinata gateway first (faster and more reliable)
        match self.download_from_pinata(cid).await {
            Ok(bytes) => {
                tracing::info!("Downloaded {} bytes from Pinata gateway CID: {}", bytes.len(), cid);
                return Ok(bytes);
            }
            Err(e) => {
                tracing::warn!("Failed to download from Pinata gateway: {}, trying local IPFS node", e);
            }
        }

        // Fallback to local IPFS node
        let bytes = self.client
            .post(format!("{}/api/v0/cat", self.base_url))
            .query(&[("arg", cid)])
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
            .context(format!("Failed to download file CID: {}", cid))?
            .bytes()
            .await
            .context("Failed to read response bytes")?
            .to_vec();

        tracing::info!("Downloaded {} bytes from local IPFS CID: {}", bytes.len(), cid);

        Ok(bytes)
    }

    async fn download_from_pinata(&self, cid: &str) -> Result<Vec<u8>> {
        let mut request = self.client
            .get(format!("https://gateway.pinata.cloud/ipfs/{}", cid))
            .timeout(std::time::Duration::from_secs(10));

        // Add authentication if JWT is available
        if let Some(jwt) = &self.pinata_jwt {
            request = request.header("Authorization", format!("Bearer {}", jwt));
        }

        let bytes = request
            .send()
            .await
            .context("Failed to download from Pinata gateway")?
            .bytes()
            .await
            .context("Failed to read Pinata response")?
            .to_vec();

        Ok(bytes)
    }

    async fn pin_add(&self, cid: &str, recursive: bool) -> Result<()> {
        let _response: PinAddResponse = self.client
            .post(format!("{}/api/v0/pin/add", self.base_url))
            .query(&[("arg", cid), ("recursive", if recursive { "true" } else { "false" })])
            .send()
            .await
            .context(format!("Failed to pin CID: {}", cid))?
            .json()
            .await
            .context("Failed to parse pin add response")?;

        tracing::debug!("Pinned {} to local IPFS node (recursive: {})", cid, recursive);

        Ok(())
    }

    pub async fn pin_remove(&self, cid: &str, recursive: bool) -> Result<()> {
        self.client
            .post(format!("{}/api/v0/pin/rm", self.base_url))
            .query(&[("arg", cid), ("recursive", if recursive { "true" } else { "false" })])
            .send()
            .await
            .context(format!("Failed to unpin CID: {}", cid))?;

        tracing::debug!("Unpinned {} from local IPFS node", cid);

        Ok(())
    }

    pub async fn verify_accessible(&self, cid: &str) -> bool {
        match self.client
            .post(format!("{}/api/v0/object/stat", self.base_url))
            .query(&[("arg", cid)])
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }

    pub async fn list_pins(&self) -> Result<Vec<String>> {
        #[derive(Deserialize)]
        struct PinLsResponse {
            #[serde(rename = "Keys")]
            keys: std::collections::HashMap<String, serde_json::Value>,
        }

        let response: PinLsResponse = self.client
            .post(format!("{}/api/v0/pin/ls", self.base_url))
            .send()
            .await
            .context("Failed to list pins")?
            .json()
            .await
            .context("Failed to parse pin ls response")?;

        Ok(response.keys.keys().cloned().collect())
    }

    pub async fn get_size(&self, cid: &str) -> Result<u64> {
        #[derive(Deserialize)]
        struct ObjectStatResponse {
            #[serde(rename = "CumulativeSize")]
            cumulative_size: u64,
        }

        let response: ObjectStatResponse = self.client
            .post(format!("{}/api/v0/object/stat", self.base_url))
            .query(&[("arg", cid)])
            .send()
            .await
            .context(format!("Failed to stat CID: {}", cid))?
            .json()
            .await
            .context("Failed to parse object stat response")?;

        Ok(response.cumulative_size)
    }

    pub async fn version(&self) -> Result<String> {
        let response: VersionResponse = self.client
            .post(format!("{}/api/v0/version", self.base_url))
            .send()
            .await
            .context("Failed to get IPFS version")?
            .json()
            .await
            .context("Failed to parse version response")?;

        Ok(response.version)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ipfs_client_creation() {
        let client = IpfsClient::new();
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_ipfs_client_with_custom_uri() {
        let client = IpfsClient::with_uri("http://localhost:5001");
        assert!(client.is_ok());
    }
}
