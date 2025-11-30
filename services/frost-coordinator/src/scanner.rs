use anyhow::{Result, Context};
use zcash_client_backend::scanning;
use zcash_primitives::consensus::{BlockHeight, Network};
use zcash_keys::keys::UnifiedFullViewingKey;
use zcash_primitives::sapling::{
    note_encryption::try_sapling_compact_note_decryption,
    PaymentAddress,
};
use zcash_primitives::memo::MemoBytes;
use zcash_note_encryption::Domain;
use crate::rpc_client::ZcashRpcClient;
use crate::lightclient::LightClient;

/// Lightweight blockchain scanner for detecting received notes
pub struct BlockchainScanner {
    network: Network,
    rpc: ZcashRpcClient,
    lightclient: Option<LightClient>,
}

impl BlockchainScanner {
    pub fn new(network: Network, rpc: ZcashRpcClient) -> Self {
        Self {
            network,
            rpc,
            lightclient: None,
        }
    }

    pub async fn new_with_lightclient(
        network: Network,
        rpc: ZcashRpcClient,
        lightwalletd_url: String
    ) -> Result<Self> {
        let lightclient = LightClient::new(lightwalletd_url).await?;
        Ok(Self {
            network,
            rpc,
            lightclient: Some(lightclient),
        })
    }

    pub async fn scan_for_notes(
        &mut self,
        ufvk: &UnifiedFullViewingKey,
        from_height: BlockHeight,
        to_height: BlockHeight,
    ) -> Result<Vec<ReceivedNote>> {
        tracing::info!(
            "Scanning blockchain from height {} to {} for received notes",
            u32::from(from_height),
            u32::from(to_height)
        );

        let mut received_notes = Vec::new();

        if let Some(ref mut lc) = self.lightclient {
            let blocks = lc.get_block_range(from_height, to_height).await?;

            let sapling_ivk = ufvk.sapling()
                .map(|k| k.ivk())
                .context("No Sapling IVK in viewing key")?;

            for block in blocks {
                if block.height % 100 == 0 {
                    tracing::debug!("Scanning block {}...", block.height);
                }

                for ctx in &block.vtx {
                    let txid = hex::encode(&ctx.hash);

                    for (output_index, output) in ctx.outputs.iter().enumerate() {
                        let epk_bytes: [u8; 32] = output.epk[..].try_into()
                            .map_err(|_| anyhow::anyhow!("Invalid epk length"))?;

                        let cmu_bytes: [u8; 32] = output.cmu[..].try_into()
                            .map_err(|_| anyhow::anyhow!("Invalid cmu length"))?;

                        let domain = zcash_primitives::sapling::note_encryption::SaplingDomain::new(block.height as u32);

                        match try_sapling_compact_note_decryption(
                            &domain,
                            sapling_ivk,
                            &zcash_primitives::sapling::note_encryption::CompactOutputDescription {
                                ephemeral_key: zcash_note_encryption::EphemeralKeyBytes(epk_bytes),
                                cmu: zcash_primitives::sapling::note::ExtractedNoteCommitment::from_bytes(&cmu_bytes)
                                    .ok_or_else(|| anyhow::anyhow!("Invalid note commitment"))?,
                                enc_ciphertext: output.ciphertext[..52].try_into()
                                    .map_err(|_| anyhow::anyhow!("Invalid ciphertext length"))?,
                            },
                        ) {
                            Some((note, _)) => {
                                received_notes.push(ReceivedNote {
                                    txid: txid.clone(),
                                    output_index: output_index as u32,
                                    note_value: note.value().inner(),
                                    memo: vec![],
                                });

                                tracing::info!(
                                    "Found note in tx {} output {} value {}",
                                    txid,
                                    output_index,
                                    note.value().inner()
                                );
                            }
                            None => {}
                        }
                    }
                }
            }
        } else {
            for height in u32::from(from_height)..=u32::from(to_height) {
                if height % 100 == 0 {
                    tracing::debug!("Scanning block {}...", height);
                }

                let block_hash = self.get_block_hash(height).await?;
                let _block_data = self.get_block(block_hash).await?;
            }
        }

        tracing::info!("Scan complete. Found {} notes", received_notes.len());

        Ok(received_notes)
    }

    async fn get_block_hash(&self, height: u32) -> Result<String> {
        let params = serde_json::json!([height]);
        let response: serde_json::Value = self.rpc.call_method("getblockhash", params).await?;

        response.as_str()
            .map(|s| s.to_string())
            .context("Block hash not a string")
    }

    async fn get_block(&self, hash: String) -> Result<Vec<u8>> {
        let params = serde_json::json!([hash, 0]); // 0 = return raw hex
        let response: serde_json::Value = self.rpc.call_method("getblock", params).await?;

        let hex_str = response.as_str()
            .context("Block data not a string")?;

        hex::decode(hex_str)
            .context("Failed to decode block hex")
    }
}

#[derive(Debug, Clone)]
pub struct ReceivedNote {
    pub txid: String,
    pub output_index: u32,
    pub note_value: u64,
    pub memo: Vec<u8>,
}
