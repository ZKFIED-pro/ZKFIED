use anyhow::{Result, Context, bail};
use serde::{Deserialize, Serialize};
use near_crypto::{SecretKey, Signer, InMemorySigner, PublicKey};
use near_primitives::{
    transaction::{Transaction, TransactionV0, Action, FunctionCallAction, SignedTransaction},
    types::{AccountId, BlockReference, Finality, Nonce},
    hash::CryptoHash,
};
use near_jsonrpc_client::{JsonRpcClient, methods};
use near_jsonrpc_primitives::types::query::QueryResponseKind;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::db::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrostSignature {
    pub participant_id: u16,
    pub signature: Vec<u8>,
    pub public_key: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceRecord {
    pub evidence_id: String,
    pub ipfs_cid: String,
    pub board_id: String,
    pub commitment_hash: Vec<u8>,
    pub zcash_txid: String,
    pub zcash_block_height: u64,
    pub frost_signatures: Vec<FrostSignature>,
    pub registered_by: String,
    pub registered_at: u64,
    pub status: String,
}

#[derive(Clone)]
pub struct NearAccount {
    pub account_id: AccountId,
    pub signer: Arc<Signer>,
}

impl NearAccount {
    pub fn from_secret_key(account_id: AccountId, secret_key: SecretKey) -> Self {
        let signer = InMemorySigner::from_secret_key(account_id.clone(), secret_key);
        Self {
            account_id,
            signer: Arc::new(signer),
        }
    }

    pub fn from_seed_phrase(account_id: AccountId, seed_phrase: &str) -> Result<Self> {
        let secret_key = SecretKey::from_seed(
            near_crypto::KeyType::ED25519,
            seed_phrase,
        );
        Ok(Self::from_secret_key(account_id, secret_key))
    }

    pub fn public_key(&self) -> PublicKey {
        self.signer.public_key()
    }
}

pub struct NearTransactionManager {
    client: JsonRpcClient,
    contract_account_id: AccountId,
    account: Arc<RwLock<Option<NearAccount>>>,
    db: Arc<Database>,
    network: NearNetwork,
}

#[derive(Debug, Clone)]
pub enum NearNetwork {
    Testnet,
    Mainnet,
}

impl NearNetwork {
    pub fn rpc_url(&self) -> &str {
        match self {
            NearNetwork::Testnet => "https://rpc.testnet.near.org",
            NearNetwork::Mainnet => "https://rpc.mainnet.near.org",
        }
    }
}

impl NearTransactionManager {
    pub fn new(
        contract_account_id: AccountId,
        network: NearNetwork,
        db: Arc<Database>,
    ) -> Self {
        let client = JsonRpcClient::connect(network.rpc_url());
        Self {
            client,
            contract_account_id,
            account: Arc::new(RwLock::new(None)),
            db,
            network,
        }
    }

    pub async fn initialize_account(&self, account: NearAccount) -> Result<()> {
        let mut guard = self.account.write().await;
        *guard = Some(account);
        tracing::info!("NEAR account initialized");
        Ok(())
    }

    pub async fn ensure_account(&self) -> Result<NearAccount> {
        let guard = self.account.read().await;
        guard.clone().ok_or_else(|| anyhow::anyhow!("NEAR account not initialized"))
    }

    async fn get_access_key_nonce(&self, account_id: &AccountId, public_key: &PublicKey) -> Result<u64> {
        let request = methods::query::RpcQueryRequest {
            block_reference: BlockReference::Finality(Finality::Final),
            request: near_primitives::views::QueryRequest::ViewAccessKey {
                account_id: account_id.clone(),
                public_key: public_key.clone(),
            },
        };

        let response = self.client.call(request).await
            .context("Failed to query access key")?;

        match response.kind {
            QueryResponseKind::AccessKey(access_key) => Ok(access_key.nonce),
            _ => bail!("Unexpected response kind"),
        }
    }

    async fn get_latest_block_hash(&self) -> Result<CryptoHash> {
        let request = methods::block::RpcBlockRequest {
            block_reference: BlockReference::Finality(Finality::Final),
        };

        let response = self.client.call(request).await
            .context("Failed to get latest block")?;

        Ok(response.header.hash)
    }

    pub async fn register_evidence(
        &self,
        evidence_id: String,
        ipfs_cid: String,
        board_id: String,
        commitment_hash: Vec<u8>,
        zcash_txid: String,
        zcash_block_height: u64,
        frost_signatures: Vec<FrostSignature>,
    ) -> Result<String> {
        let account = self.ensure_account().await?;

        tracing::info!("Registering evidence {} on NEAR contract", evidence_id);

        let args = serde_json::json!({
            "evidence_id": evidence_id,
            "ipfs_cid": ipfs_cid,
            "board_id": board_id,
            "commitment_hash": commitment_hash,
            "zcash_txid": zcash_txid,
            "zcash_block_height": zcash_block_height,
            "frost_signatures": frost_signatures,
        });

        let args_json = serde_json::to_vec(&args)?;

        let nonce = self.get_access_key_nonce(&account.account_id, &account.public_key()).await?;
        let block_hash = self.get_latest_block_hash().await?;

        let transaction = Transaction::V0(TransactionV0 {
            signer_id: account.account_id.clone(),
            public_key: account.public_key(),
            nonce: nonce + 1,
            receiver_id: self.contract_account_id.clone(),
            block_hash,
            actions: vec![Action::FunctionCall(Box::new(FunctionCallAction {
                method_name: "register_evidence".to_string(),
                args: args_json,
                gas: 100_000_000_000_000,
                deposit: 1_000_000_000_000_000_000_000_000,
            }))],
        });

        let signature = account.signer.sign(transaction.get_hash_and_size().0.as_ref());
        let signed_tx = SignedTransaction::new(signature, transaction);

        let request = methods::broadcast_tx_async::RpcBroadcastTxAsyncRequest {
            signed_transaction: signed_tx,
        };

        let tx_hash = self.client.call(request).await
            .context("Failed to broadcast NEAR transaction")?;

        let tx_hash_str = tx_hash.to_string();

        self.db.record_near_post(
            &evidence_id,
            &tx_hash_str,
            self.contract_account_id.as_str(),
            "register_evidence",
        ).await?;

        tracing::info!("Evidence registered on NEAR: tx_hash={}", tx_hash_str);

        Ok(tx_hash_str)
    }

    pub async fn get_evidence(&self, evidence_id: String) -> Result<Option<EvidenceRecord>> {
        let args = serde_json::json!({
            "evidence_id": evidence_id
        });

        let args_json = serde_json::to_vec(&args)?;

        let request = methods::query::RpcQueryRequest {
            block_reference: BlockReference::Finality(Finality::Final),
            request: near_primitives::views::QueryRequest::CallFunction {
                account_id: self.contract_account_id.clone(),
                method_name: "get_evidence".to_string(),
                args: args_json.into(),
            },
        };

        let response = self.client.call(request).await
            .context("Failed to query NEAR contract")?;

        match response.kind {
            QueryResponseKind::CallResult(result) => {
                if result.result.is_empty() {
                    return Ok(None);
                }
                let evidence: Option<EvidenceRecord> = serde_json::from_slice(&result.result)
                    .context("Failed to parse evidence record")?;
                Ok(evidence)
            }
            _ => bail!("Unexpected response kind"),
        }
    }

    pub async fn get_evidences_by_board(
        &self,
        board_id: String,
        from_index: u64,
        limit: u64,
    ) -> Result<Vec<EvidenceRecord>> {
        let args = serde_json::json!({
            "board_id": board_id,
            "from_index": from_index,
            "limit": limit
        });

        let args_json = serde_json::to_vec(&args)?;

        let request = methods::query::RpcQueryRequest {
            block_reference: BlockReference::Finality(Finality::Final),
            request: near_primitives::views::QueryRequest::CallFunction {
                account_id: self.contract_account_id.clone(),
                method_name: "get_evidences_by_board".to_string(),
                args: args_json.into(),
            },
        };

        let response = self.client.call(request).await
            .context("Failed to query NEAR contract")?;

        match response.kind {
            QueryResponseKind::CallResult(result) => {
                let evidences: Vec<EvidenceRecord> = serde_json::from_slice(&result.result)
                    .context("Failed to parse evidence records")?;
                Ok(evidences)
            }
            _ => bail!("Unexpected response kind"),
        }
    }

    pub async fn verify_commitment(
        &self,
        evidence_id: String,
        expected_hash: Vec<u8>,
    ) -> Result<bool> {
        let args = serde_json::json!({
            "evidence_id": evidence_id,
            "expected_hash": expected_hash
        });

        let args_json = serde_json::to_vec(&args)?;

        let request = methods::query::RpcQueryRequest {
            block_reference: BlockReference::Finality(Finality::Final),
            request: near_primitives::views::QueryRequest::CallFunction {
                account_id: self.contract_account_id.clone(),
                method_name: "verify_evidence_commitment".to_string(),
                args: args_json.into(),
            },
        };

        let response = self.client.call(request).await
            .context("Failed to query NEAR contract")?;

        match response.kind {
            QueryResponseKind::CallResult(result) => {
                let verified: bool = serde_json::from_slice(&result.result)
                    .context("Failed to parse verification result")?;
                Ok(verified)
            }
            _ => bail!("Unexpected response kind"),
        }
    }

    pub async fn search_by_zcash_txid(&self, zcash_txid: String) -> Result<Option<EvidenceRecord>> {
        let args = serde_json::json!({
            "zcash_txid": zcash_txid
        });

        let args_json = serde_json::to_vec(&args)?;

        let request = methods::query::RpcQueryRequest {
            block_reference: BlockReference::Finality(Finality::Final),
            request: near_primitives::views::QueryRequest::CallFunction {
                account_id: self.contract_account_id.clone(),
                method_name: "search_by_zcash_txid".to_string(),
                args: args_json.into(),
            },
        };

        let response = self.client.call(request).await
            .context("Failed to query NEAR contract")?;

        match response.kind {
            QueryResponseKind::CallResult(result) => {
                let evidence: Option<EvidenceRecord> = serde_json::from_slice(&result.result)
                    .context("Failed to parse evidence record")?;
                Ok(evidence)
            }
            _ => bail!("Unexpected response kind"),
        }
    }

    pub async fn confirm_transaction(&self, tx_hash: &str) -> Result<()> {
        let tx_hash_decoded = tx_hash.parse::<CryptoHash>()
            .map_err(|e| anyhow::anyhow!("Invalid transaction hash: {}", e))?;

        let account = self.ensure_account().await?;

        let request = methods::tx::RpcTransactionStatusRequest {
            transaction_info: methods::tx::TransactionInfo::TransactionId {
                tx_hash: tx_hash_decoded,
                sender_account_id: account.account_id.clone(),
            },
            wait_until: near_primitives::views::TxExecutionStatus::Final,
        };

        let _response = self.client.call(request).await
            .context("Failed to get transaction status")?;

        self.db.confirm_near_post(tx_hash, 0).await?;

        tracing::info!("NEAR transaction confirmed: {}", tx_hash);

        Ok(())
    }
}
