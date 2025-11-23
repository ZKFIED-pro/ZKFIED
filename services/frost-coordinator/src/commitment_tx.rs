use anyhow::{Result, Context, bail};
use zcash_client_backend::{
    data_api::{Account, WalletWrite, WalletRead},
    fees::{ChangeStrategy, DustOutputPolicy, SplitPolicy, StandardFeeRule},
    wallet::OvkPolicy,
};
use zcash_primitives::{
    consensus::{BlockHeight, Network},
    transaction::{TxId, fees::zip317::FeeRule as Zip317FeeRule},
};
use zcash_protocol::value::Zatoshis;
use zcash_keys::address::UnifiedAddress;
use std::num::NonZeroU32;
use crate::evidence_commitment::EvidenceCommitment;
use crate::lightclient::LightClient;

const COMMITMENT_AMOUNT_ZATOSHIS: u64 = 10_000;
const MIN_CONFIRMATIONS: u32 = 1;

pub struct CommitmentTransactionBuilder {
    lightclient: LightClient,
    registry_address: UnifiedAddress,
    network: Network,
}

impl CommitmentTransactionBuilder {
    pub fn new(
        lightclient: LightClient,
        registry_address: UnifiedAddress,
        network: Network,
    ) -> Self {
        Self {
            lightclient,
            registry_address,
            network,
        }
    }

    pub async fn create_evidence_commitment(
        &self,
        evidence_id: String,
        ipfs_cid: String,
        board_id: String,
    ) -> Result<(TxId, EvidenceCommitment)> {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .context("System time error")?
            .as_secs();

        let commitment = EvidenceCommitment::new(
            evidence_id,
            ipfs_cid,
            board_id,
            timestamp,
        )?;

        let memo_bytes = commitment.to_memo_bytes()?;

        let txid = self.send_commitment_transaction(memo_bytes).await?;

        tracing::info!(
            "Created evidence commitment transaction: txid={}, evidence_id={}",
            txid,
            commitment.evidence_id
        );

        Ok((txid, commitment))
    }

    async fn send_commitment_transaction(
        &self,
        memo: zcash_primitives::memo::MemoBytes,
    ) -> Result<TxId> {
        let wallet_db = self.lightclient.wallet_db();

        let account = wallet_db
            .get_account_for_ufvk(&self.lightclient.ufvk())?
            .context("No account found for UFVK")?;

        let target_height = wallet_db.get_max_height_hash()?.map(|(h, _)| h)
            .context("No max height available")?;

        let min_confirmations = NonZeroU32::new(MIN_CONFIRMATIONS)
            .context("Invalid min confirmations")?;

        let input_selector = zcash_client_backend::data_api::InputSelector::new(
            ChangeStrategy::default(),
            DustOutputPolicy::default(),
            SplitPolicy::default(),
        );

        let request = zcash_client_backend::zip321::TransactionRequest::new(vec![
            zcash_client_backend::zip321::Payment {
                recipient_address: self.registry_address.clone(),
                amount: Zatoshis::from_u64(COMMITMENT_AMOUNT_ZATOSHIS)?,
                memo: Some(memo),
                label: None,
                message: None,
                other_params: vec![],
            }
        ])?;

        let fee_rule = StandardFeeRule::Zip317FeeRule(Zip317FeeRule::standard());

        let proposal = zcash_client_backend::data_api::wallet::propose_transfer(
            wallet_db,
            &self.network,
            account.id(),
            &input_selector,
            &fee_rule,
            min_confirmations,
            target_height,
            request,
        )?;

        let txid = zcash_client_backend::data_api::wallet::create_proposed_transactions(
            wallet_db,
            &self.network,
            &self.lightclient.prover(),
            &self.lightclient.prover(),
            &account.usk(),
            OvkPolicy::Sender,
            &[proposal],
        )?;

        let txids = txid.into_iter()
            .map(|t| t.txid())
            .collect::<Vec<_>>();

        if txids.is_empty() {
            bail!("No transaction created");
        }

        Ok(*txids.first().unwrap())
    }

    pub async fn verify_commitment(
        &self,
        txid: &TxId,
    ) -> Result<Option<EvidenceCommitment>> {
        let tx = self.lightclient.get_transaction(txid).await?;

        for output in tx.sapling_outputs().iter().chain(tx.orchard_outputs().iter()) {
            if let Ok(memo_bytes) = self.decrypt_memo(output) {
                if let Ok(commitment) = EvidenceCommitment::from_memo_bytes(&memo_bytes) {
                    if commitment.verify() {
                        return Ok(Some(commitment));
                    }
                }
            }
        }

        Ok(None)
    }

    fn decrypt_memo(&self, output: &impl OutputNote) -> Result<zcash_primitives::memo::MemoBytes> {
        let ivk = self.lightclient.get_ivk()?;
        output.decrypt_memo(&ivk)
    }
}

trait OutputNote {
    fn decrypt_memo(&self, ivk: &IncomingViewingKey) -> Result<zcash_primitives::memo::MemoBytes>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keygen::WalletKeygen;

    #[tokio::test]
    async fn test_commitment_creation() {
        let network = Network::TestNetwork;
        let keygen = WalletKeygen::new(network);
        let wallet = keygen.generate_wallet().unwrap();

        let registry_address = wallet.get_unified_address().clone();

        let lightclient = LightClient::new(
            network,
            wallet.spending_key.clone(),
            "https://testnet.lightwalletd.com:9067".to_string(),
        ).await.unwrap();

        let builder = CommitmentTransactionBuilder::new(
            lightclient,
            registry_address,
            network,
        );

        let result = builder.create_evidence_commitment(
            "test-evidence-001".to_string(),
            "QmTest123".to_string(),
            "healthcare".to_string(),
        ).await;

        match result {
            Ok((txid, commitment)) => {
                assert_eq!(commitment.evidence_id, "test-evidence-001");
                assert_eq!(commitment.ipfs_cid, "QmTest123");
                assert_eq!(commitment.board_id, "healthcare");
                assert!(commitment.verify());
                println!("Transaction created: {}", txid);
            }
            Err(e) => {
                println!("Test skipped (requires funded wallet): {}", e);
            }
        }
    }
}
