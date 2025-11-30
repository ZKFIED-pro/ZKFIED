use anyhow::{Result, Context};
use std::path::{Path, PathBuf};
use reqwest::Client;
use tokio::fs;
use tokio::io::AsyncWriteExt;

const SAPLING_SPEND_URL: &str = "https://download.z.cash/downloads/sapling-spend.params";
const SAPLING_OUTPUT_URL: &str = "https://download.z.cash/downloads/sapling-output.params";

const SAPLING_SPEND_HASH: &str = "8e48ffd23abb3a5fd9c5589204f32d9c31285a04b78096ba40a79b75677efc13";
const SAPLING_OUTPUT_HASH: &str = "2f0ebbcbb9bb0bcffe95a397e7eba89c29eb4dde6191c339db88570e3f3fb0e4";

pub struct ParamsDownloader {
    params_dir: PathBuf,
    client: Client,
}

impl ParamsDownloader {
    pub fn new(params_dir: PathBuf) -> Self {
        Self {
            params_dir,
            client: Client::new(),
        }
    }

    pub async fn ensure_params(&self) -> Result<()> {
        tracing::info!("Checking for Zcash Sapling parameters in: {}", self.params_dir.display());

        fs::create_dir_all(&self.params_dir).await
            .context("Failed to create params directory")?;

        let spend_path = self.params_dir.join("sapling-spend.params");
        let output_path = self.params_dir.join("sapling-output.params");

        if !spend_path.exists() {
            tracing::warn!("sapling-spend.params not found, downloading...");
            self.download_file(SAPLING_SPEND_URL, &spend_path, SAPLING_SPEND_HASH).await?;
        } else {
            tracing::info!("sapling-spend.params already exists");
        }

        if !output_path.exists() {
            tracing::warn!("sapling-output.params not found, downloading...");
            self.download_file(SAPLING_OUTPUT_URL, &output_path, SAPLING_OUTPUT_HASH).await?;
        } else {
            tracing::info!("sapling-output.params already exists");
        }

        tracing::info!("All Sapling parameters are present");
        Ok(())
    }

    async fn download_file(&self, url: &str, dest: &Path, expected_hash: &str) -> Result<()> {
        tracing::info!("Downloading: {} -> {}", url, dest.display());

        let response = self.client.get(url)
            .send()
            .await
            .context("Failed to download file")?;

        if !response.status().is_success() {
            anyhow::bail!("Download failed with status: {}", response.status());
        }

        let total_size = response.content_length().unwrap_or(0);
        tracing::info!("Download size: {} MB", total_size / 1_000_000);

        let mut file = fs::File::create(dest).await
            .context("Failed to create file")?;

        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();

        use tokio_stream::StreamExt;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.context("Error reading chunk")?;
            file.write_all(&chunk).await.context("Error writing to file")?;

            downloaded += chunk.len() as u64;
            if total_size > 0 && downloaded % 10_000_000 == 0 {
                let progress = (downloaded as f64 / total_size as f64 * 100.0) as u32;
                tracing::info!("Download progress: {}%", progress);
            }
        }

        file.flush().await.context("Failed to flush file")?;
        drop(file);

        tracing::info!("Download complete, verifying hash...");
        self.verify_hash(dest, expected_hash).await?;

        tracing::info!("File verified successfully: {}", dest.display());
        Ok(())
    }

    async fn verify_hash(&self, path: &Path, expected_hash: &str) -> Result<()> {
        use sha2::{Sha256, Digest};

        let contents = fs::read(path).await
            .context("Failed to read file for verification")?;

        let mut hasher = Sha256::new();
        hasher.update(&contents);
        let hash = format!("{:x}", hasher.finalize());

        if hash != expected_hash {
            anyhow::bail!(
                "Hash mismatch!\nExpected: {}\nGot:      {}",
                expected_hash,
                hash
            );
        }

        Ok(())
    }
}
