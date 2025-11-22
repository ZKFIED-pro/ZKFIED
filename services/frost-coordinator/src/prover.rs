use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use zcash_proofs::prover::LocalTxProver;

/// ZK Proof Parameters Manager
///
/// Manages downloading and caching of Zcash proving parameters:
/// - sapling-spend.params (~50MB) - Groth16 spend proofs
/// - sapling-output.params (~50MB) - Groth16 output proofs
/// - orchard-proving-key.bin (~800MB) - Halo2 Orchard proofs
pub struct ProverParams {
    params_dir: PathBuf,
    prover: Option<LocalTxProver>,
}

impl ProverParams {
    /// Default params directory in user's home
    pub fn default_params_dir() -> Result<PathBuf> {
        let home = std::env::var("HOME")
            .context("HOME environment variable not set")?;
        Ok(PathBuf::from(home).join(".zcash-params"))
    }

    /// Create new prover params manager
    pub fn new(params_dir: Option<PathBuf>) -> Result<Self> {
        let params_dir = params_dir.unwrap_or_else(|| {
            Self::default_params_dir().unwrap_or_else(|_| PathBuf::from(".zcash-params"))
        });

        // Create directory if it doesn't exist
        if !params_dir.exists() {
            std::fs::create_dir_all(&params_dir)
                .context("Failed to create params directory")?;
        }

        Ok(ProverParams {
            params_dir,
            prover: None,
        })
    }

    /// Check if all required parameter files exist
    pub fn params_exist(&self) -> bool {
        let sapling_spend = self.params_dir.join("sapling-spend.params");
        let sapling_output = self.params_dir.join("sapling-output.params");

        sapling_spend.exists() && sapling_output.exists()
    }

    /// Get URLs for downloading parameter files
    pub fn param_urls() -> Vec<(&'static str, &'static str)> {
        vec![
            (
                "sapling-spend.params",
                "https://download.z.cash/downloads/sapling-spend.params"
            ),
            (
                "sapling-output.params",
                "https://download.z.cash/downloads/sapling-output.params"
            ),
        ]
    }

    /// Download proving parameters from Zcash foundation
    pub async fn download_params(&self) -> Result<()> {
        use reqwest::Client;
        use std::io::Write;

        let client = Client::new();

        for (filename, url) in Self::param_urls() {
            let filepath = self.params_dir.join(filename);

            if filepath.exists() {
                tracing::info!("{} already exists, skipping download", filename);
                continue;
            }

            tracing::info!("Downloading {} from {}...", filename, url);

            let response = client.get(url)
                .send()
                .await
                .context(format!("Failed to download {}", filename))?;

            if !response.status().is_success() {
                anyhow::bail!("Download failed with status: {}", response.status());
            }

            let bytes = response.bytes()
                .await
                .context("Failed to read response bytes")?;

            let mut file = std::fs::File::create(&filepath)
                .context(format!("Failed to create file {}", filename))?;

            file.write_all(&bytes)
                .context(format!("Failed to write {}", filename))?;

            tracing::info!("Downloaded {} ({} bytes)", filename, bytes.len());
        }

        Ok(())
    }

    /// Load the prover from parameter files
    pub fn load_prover(&mut self) -> Result<&LocalTxProver> {
        if self.prover.is_some() {
            return Ok(self.prover.as_ref().unwrap());
        }

        if !self.params_exist() {
            anyhow::bail!(
                "Proving parameters not found in {:?}. Run download_params() first.",
                self.params_dir
            );
        }

        tracing::info!("Loading prover from {:?}", self.params_dir);

        let spend_path = self.params_dir.join("sapling-spend.params");
        let output_path = self.params_dir.join("sapling-output.params");

        let prover = LocalTxProver::new(&spend_path, &output_path);

        self.prover = Some(prover);
        Ok(self.prover.as_ref().unwrap())
    }

    /// Get reference to loaded prover
    pub fn prover(&self) -> Result<&LocalTxProver> {
        self.prover.as_ref()
            .ok_or_else(|| anyhow::anyhow!("Prover not loaded. Call load_prover() first."))
    }
}

/// Initialize proving parameters (download if needed, then load)
pub async fn init_prover(params_dir: Option<PathBuf>) -> Result<ProverParams> {
    let mut params = ProverParams::new(params_dir)?;

    // Download if needed
    if !params.params_exist() {
        tracing::warn!("Proving parameters not found, downloading (~100MB)...");
        params.download_params().await?;
    }

    // Load prover
    params.load_prover()?;

    tracing::info!("Prover initialized successfully");
    Ok(params)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_params_dir() {
        let dir = ProverParams::default_params_dir();
        assert!(dir.is_ok());
    }

    #[test]
    fn test_param_urls() {
        let urls = ProverParams::param_urls();
        assert_eq!(urls.len(), 2);
        assert!(urls[0].0.contains("sapling-spend"));
        assert!(urls[1].0.contains("sapling-output"));
    }

    #[tokio::test]
    #[ignore] // Only run manually - downloads 100MB+
    async fn test_download_params() {
        let temp_dir = std::env::temp_dir().join("zkfied-test-params");
        let params = ProverParams::new(Some(temp_dir.clone())).unwrap();

        let result = params.download_params().await;
        assert!(result.is_ok());

        assert!(params.params_exist());

        // Cleanup
        std::fs::remove_dir_all(temp_dir).ok();
    }
}
