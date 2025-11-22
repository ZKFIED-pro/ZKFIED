use anyhow::{Result, Context};
use std::process::Command;
use tokio::fs;
use uuid::Uuid;

pub struct MetadataStripper;

impl MetadataStripper {
    pub async fn strip_metadata(data: Vec<u8>, original_filename: &str) -> Result<Vec<u8>> {
        let temp_id = Uuid::new_v4();
        let extension = std::path::Path::new(original_filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        let temp_input = format!("/tmp/zkfied_input_{}_{}.{}", temp_id, original_filename, extension);
        let temp_output = format!("/tmp/zkfied_output_{}_{}.{}", temp_id, original_filename, extension);

        fs::write(&temp_input, &data).await
            .context("Failed to write temporary input file")?;

        let output = Command::new("exiftool")
            .arg("-all=")
            .arg("-overwrite_original")
            .arg(&temp_input)
            .output()
            .context("Failed to execute exiftool")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            tracing::warn!("exiftool warning: {}", stderr);
        }

        let cleaned_data = fs::read(&temp_input).await
            .context("Failed to read cleaned file")?;

        let _ = fs::remove_file(&temp_input).await;
        let _ = fs::remove_file(&temp_output).await;

        tracing::info!("Stripped metadata from '{}' ({} -> {} bytes)",
            original_filename, data.len(), cleaned_data.len());

        Ok(cleaned_data)
    }

    pub async fn strip_metadata_batch(files: Vec<(String, Vec<u8>)>) -> Result<Vec<(String, Vec<u8>)>> {
        let mut cleaned_files = Vec::new();

        for (filename, data) in files {
            let cleaned_data = Self::strip_metadata(data, &filename).await?;
            cleaned_files.push((filename, cleaned_data));
        }

        Ok(cleaned_files)
    }
}
