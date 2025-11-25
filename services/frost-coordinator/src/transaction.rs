use anyhow::{Context, Result};
use zcash_primitives::{
    consensus::{BlockHeight, Network},
    memo::MemoBytes,
};
use zcash_keys::address::UnifiedAddress;
use zcash_proofs::prover::LocalTxProver;
use std::path::Path;
use crate::rpc_client::ZcashRpcClient;
use crate::memo::{EvidenceMemo, Board, EvidenceType};

pub struct TransactionBuilder {
    network: Network,
    prover: LocalTxProver,
}

impl TransactionBuilder {
    pub fn new(network: Network, params_dir: &Path) -> Result<Self> {
        let spend_path = params_dir.join("sapling-spend.params");
        let output_path = params_dir.join("sapling-output.params");

        let spend_bytes = std::fs::read(&spend_path)
            .context("Failed to read sapling-spend.params")?;
        let output_bytes = std::fs::read(&output_path)
            .context("Failed to read sapling-output.params")?;

        let prover = LocalTxProver::from_bytes(&spend_bytes, &output_bytes);

        Ok(Self { network, prover })
    }

    pub async fn download_params(params_dir: &Path) -> Result<()> {
        std::fs::create_dir_all(params_dir)
            .context("Failed to create params directory")?;

        let spend_url = "https://download.z.cash/downloads/sapling-spend.params";
        let output_url = "https://download.z.cash/downloads/sapling-output.params";

        let spend_path = params_dir.join("sapling-spend.params");
        let output_path = params_dir.join("sapling-output.params");

        if !spend_path.exists() {
            tracing::info!("Downloading sapling-spend.params (~50MB)...");
            let response = reqwest::get(spend_url).await?;
            let bytes = response.bytes().await?;
            std::fs::write(&spend_path, bytes)?;
            tracing::info!("Downloaded sapling-spend.params");
        }

        if !output_path.exists() {
            tracing::info!("Downloading sapling-output.params (~3MB)...");
            let response = reqwest::get(output_url).await?;
            let bytes = response.bytes().await?;
            std::fs::write(&output_path, bytes)?;
            tracing::info!("Downloaded sapling-output.params");
        }

        Ok(())
    }

    pub async fn build_evidence_transaction(
        &self,
        recipient: UnifiedAddress,
        evidence_memo: EvidenceMemo,
        current_height: BlockHeight,
        rpc: &ZcashRpcClient,
    ) -> Result<Vec<u8>> {
        use zcash_primitives::transaction::builder::{Builder, BuildConfig};
        use zcash_primitives::transaction::fees::zip317::FeeRule as Zip317FeeRule;

        // Fetch REAL Sapling anchor from the chain
        tracing::info!("Fetching real Sapling anchor from testnet...");
        let anchor_hex = rpc.get_sapling_anchor().await?;

        // The anchor might be an empty tree ("000000" for Zebra), which is valid
        // for transactions with outputs only (no spends)
        let anchor_bytes = hex::decode(&anchor_hex)
            .context("Failed to decode Sapling anchor hex")?;

        // Convert bytes to jubjub::Base (field element) and then to Anchor
        // Pad to 32 bytes if needed (for empty tree "000000")
        let mut bytes_array = [0u8; 32];
        let copy_len = anchor_bytes.len().min(32);
        bytes_array[..copy_len].copy_from_slice(&anchor_bytes[..copy_len]);

        let field_element = jubjub::Base::from_bytes(&bytes_array)
            .into_option()
            .context("Invalid Sapling anchor bytes")?;
        let anchor = sapling_crypto::Anchor::from(field_element);

        tracing::info!("Using real Sapling anchor from testnet: {} (empty tree: {})",
            anchor_hex,
            anchor_hex == "000000"
        );

        let memo_array = evidence_memo.encode()?;
        let memo_bytes = MemoBytes::from_bytes(&memo_array)?;

        let build_config = BuildConfig::TxV5 {
            sapling_anchor: Some(anchor),
            orchard_anchor: None,
        };

        let mut builder = Builder::new(
            self.network.clone(),
            current_height,
            build_config,
        );

        let amount = zcash_primitives::transaction::components::amount::NonNegativeAmount::const_from_u64(1);

        builder.add_sapling_output::<std::convert::Infallible>(
            None,
            recipient.sapling().ok_or_else(|| anyhow::anyhow!("No Sapling address"))?.clone(),
            amount,
            memo_bytes,
        )?;

        let fee_rule = Zip317FeeRule::standard();

        let mut rng = rand::thread_rng();

        let build_result = builder.build(
            &zcash_primitives::transaction::components::transparent::builder::TransparentSigningSet::new(),
            &[],
            &[],
            &mut rng,
            &self.prover,
            &self.prover,
            &fee_rule,
        )?;

        let tx = build_result.transaction();
        let mut tx_bytes = vec![];
        tx.write(&mut tx_bytes)?;

        tracing::info!(
            "Built evidence transaction to {} ({} bytes)",
            recipient.encode(&self.network),
            tx_bytes.len()
        );

        Ok(tx_bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[tokio::test]
    #[ignore]
    async fn test_download_params() {
        let temp_dir = env::temp_dir().join("zkfied_test_params");
        TransactionBuilder::download_params(&temp_dir).await.unwrap();

        assert!(temp_dir.join("sapling-spend.params").exists());
        assert!(temp_dir.join("sapling-output.params").exists());

        std::fs::remove_dir_all(temp_dir).ok();
    }
}
