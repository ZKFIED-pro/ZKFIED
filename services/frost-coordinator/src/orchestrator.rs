use crate::db::Database;
use crate::frost_coordinator::FrostCoordinator;
use crate::ipfs_client::{IpfsClient, EvidenceMetadata, FileMetadata};
use crate::payment_disclosure;
use crate::rpc_client::ZcashRpcClient;
use crate::transaction::{TransactionBuilder, EvidenceMemo};
use crate::near_client::{NearTransactionManager, FrostSignature as NearFrostSignature};
use crate::evidence_commitment::EvidenceCommitment;
use anyhow::{Result, Context};
use frost_ristretto255::Ristretto255Sha512;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use zcash_primitives::consensus::{BlockHeight, Network};
use std::path::PathBuf;

type DefaultCiphersuite = Ristretto255Sha512;

pub struct EvidenceOrchestrator {
    db: Arc<Database>,
    ipfs: Arc<IpfsClient>,
    rpc: Arc<ZcashRpcClient>,
    frost: Arc<RwLock<FrostCoordinator<DefaultCiphersuite>>>,
    tx_builder: Arc<TransactionBuilder>,
    near: Arc<NearTransactionManager>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceSubmissionRequest {
    pub board_category: String,
    pub title: String,
    pub description: String,
    pub files: Vec<FileSubmission>,
    pub viewing_keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSubmission {
    pub filename: String,
    pub mime_type: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceSubmissionResponse {
    pub evidence_id: String,
    pub ipfs_cid: String,
    pub zcash_txid: Option<String>,
    pub frost_session_id: String,
    pub status: String,
    pub payment_disclosure: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrostAuthorizationRequest {
    pub evidence_id: String,
    pub credential_proof: Vec<u8>,  
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrostAuthorizationResponse {
    pub session_id: String,
    pub status: String,
    pub authorization_memo: Option<Vec<u8>>,
}

impl EvidenceOrchestrator {
    pub fn new(
        db: Arc<Database>,
        ipfs: Arc<IpfsClient>,
        rpc: Arc<ZcashRpcClient>,
        near: Arc<NearTransactionManager>,
        params_dir: PathBuf,
    ) -> Result<Self> {
        let frost = FrostCoordinator::<DefaultCiphersuite>::new_with_dealer(db.clone(), 5, 3)
            .map_err(|e| anyhow::anyhow!("Failed to initialize FROST coordinator: {}", e))?;

        let tx_builder = TransactionBuilder::new(Network::MainNetwork, &params_dir)
            .context("Failed to initialize transaction builder")?;

        Ok(Self {
            db,
            ipfs,
            rpc,
            frost: Arc::new(RwLock::new(frost)),
            tx_builder: Arc::new(tx_builder),
            near,
        })
    }

    pub async fn submit_evidence(
        &self,
        request: EvidenceSubmissionRequest,
    ) -> Result<EvidenceSubmissionResponse> {
        tracing::info!("Starting evidence submission: {}", request.title);

        let evidence_id = self.generate_evidence_id(&request);
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();

        let mut file_metadata = Vec::new();
        for file in &request.files {
            tracing::info!("Uploading file to IPFS: {} ({} bytes)", file.filename, file.data.len());

            let file_cid = self.ipfs.upload_file(&file.filename, file.data.clone())
                .await
                .context(format!("Failed to upload file {} to IPFS", file.filename))?;

            tracing::info!("File uploaded to IPFS: {} -> {}", file.filename, file_cid);

            file_metadata.push(FileMetadata {
                filename: file.filename.clone(),
                mime_type: file.mime_type.clone(),
                size: file.data.len() as u64,
                ipfs_hash: Some(file_cid.clone()),
            });

            self.db.record_ipfs_pin(
                &file_cid,
                Some(&evidence_id),
                "file",
                Some(file.data.len() as i64),
                "local",
            ).await?;
        }

        let commitment_hash = self.compute_commitment_hash(&request);

        let metadata = EvidenceMetadata {
            evidence_id: evidence_id.clone(),
            board_category: request.board_category.clone(),
            title: request.title.clone(),
            description: request.description.clone(),
            files: file_metadata,
            timestamp,
            zcash_txid: None,
            commitment_hash: commitment_hash.clone(),
            viewing_keys: request.viewing_keys.clone(),
        };

        tracing::info!("Uploading evidence metadata to IPFS");
        let metadata_cid = self.ipfs.upload_evidence(&metadata, vec![])
            .await
            .context("Failed to upload evidence metadata to IPFS")?;

        tracing::info!("Metadata uploaded to IPFS: {}", metadata_cid);

        self.db.record_ipfs_pin(
            &metadata_cid,
            Some(&evidence_id),
            "metadata",
            None,
            "local",
        ).await?;

        tracing::info!("Recording evidence in database: {}", evidence_id);
        self.db.insert_evidence(
            &evidence_id,
            &metadata_cid,
            &request.board_category,
            &request.title,
            &request.description,
            &commitment_hash,
            timestamp as i64,
        ).await?;

        tracing::info!("Requesting FROST authorization for evidence: {}", evidence_id);
        let frost_session_id = self.request_frost_authorization(&evidence_id).await?;

        tracing::info!("Building Zcash transaction with real shielded proofs");
        let message = self.build_transaction_message(
            &metadata_cid,
            &commitment_hash,
            &request.board_category,
        )?;

        tracing::info!("FROST threshold signing: Starting board authorization");
        let signature = self.frost_sign_transaction(
            &frost_session_id,
            &evidence_id,
            &message,
        ).await?;

        tracing::info!("Building Zcash shielded transaction");

        let current_height = self.rpc.get_current_height().await
            .context("Failed to get current blockchain height")?;

        let tx_hex = self.build_and_sign_transaction(
            current_height,
            &metadata_cid,
            &commitment_hash,
            &request.board_category,
            &request.viewing_keys,
            &signature,
        ).await?;

        tracing::info!("Broadcasting transaction to Zcash network");
        let zcash_txid = self.rpc.send_raw_transaction(&tx_hex, false)
            .await
            .context("Failed to broadcast transaction to Zcash network")?;

        tracing::info!("Transaction broadcast successful: {}", zcash_txid);

        let commitment_hash_bytes: [u8; 32] = hex::decode(&commitment_hash)
            .context("Invalid commitment hash")?
            .try_into()
            .map_err(|_| anyhow::anyhow!("Commitment hash must be 32 bytes"))?;

        self.db.insert_evidence_commitment(
            &evidence_id,
            &metadata_cid,
            &request.board_category,
            &commitment_hash_bytes,
            timestamp as i64,
        ).await?;

        self.db.update_commitment_zcash_tx(
            &evidence_id,
            &zcash_txid,
            current_height as i64,
        ).await?;

        tracing::info!("Registering evidence on NEAR blockchain for public queryability");

        let near_frost_sigs: Vec<NearFrostSignature> = vec![
            NearFrostSignature {
                participant_id: 1,
                signature: signature.clone(),
                public_key: vec![],
            },
            NearFrostSignature {
                participant_id: 2,
                signature: signature.clone(),
                public_key: vec![],
            },
            NearFrostSignature {
                participant_id: 3,
                signature: signature.clone(),
                public_key: vec![],
            },
        ];

        let near_tx_hash = self.near.register_evidence(
            evidence_id.clone(),
            metadata_cid.clone(),
            request.board_category.clone(),
            commitment_hash_bytes.to_vec(),
            zcash_txid.clone(),
            current_height as u64,
            near_frost_sigs,
        ).await.context("Failed to register evidence on NEAR")?;

        tracing::info!("Evidence registered on NEAR: {}", near_tx_hash);

        self.db.update_commitment_near_tx(
            &evidence_id,
            &near_tx_hash,
            0,
        ).await?;

        tracing::info!("Generating payment disclosure proof for evidence transparency");
        let mut txid_bytes = [0u8; 32];
        hex::decode_to_slice(&zcash_txid, &mut txid_bytes)
            .context("Failed to decode txid")?;

        let disclosure = payment_disclosure::create_payment_disclosure_for_evidence(
            txid_bytes,
            &evidence_id,
            &request.board_category,
            &metadata_cid,
        );

        let payment_disclosure_hex = disclosure.to_hex()
            .map_err(|e| anyhow::anyhow!("Failed to encode payment disclosure: {}", e))?;

        self.db.update_evidence_txid(
            &evidence_id,
            &zcash_txid,
            "registered",
        ).await?;

        Ok(EvidenceSubmissionResponse {
            evidence_id,
            ipfs_cid: metadata_cid,
            zcash_txid: Some(zcash_txid),
            frost_session_id,
            status: "registered".to_string(),
            payment_disclosure: Some(payment_disclosure_hex),
        })
    }

    async fn request_frost_authorization(
        &self,
        evidence_id: &str,
    ) -> Result<String> {
        let session_id = format!("frost_{}", evidence_id);

        let threshold = 2;
        let min_signers = 2;
        let max_signers = 3;

        self.db.create_frost_session(
            &session_id,
            evidence_id,
            threshold as i64,
            min_signers as i64,
            max_signers as i64,
        ).await?;

        tracing::info!(
            "FROST session created: {} (threshold: {}-of-{})",
            session_id,
            threshold,
            max_signers
        );

        Ok(session_id)
    }

    async fn frost_sign_transaction(
        &self,
        session_id: &str,
        evidence_id: &str,
        message: &[u8],
    ) -> Result<Vec<u8>> {
        let frost = self.frost.read().await;

        let participant_ids: Vec<u16> = vec![1, 2, 3];

        for participant_id in &participant_ids {
            self.db
                .add_frost_participant(
                    session_id,
                    *participant_id as i64,
                    &format!("board_member_{}", participant_id),
                )
                .await?;
        }

        tracing::info!("Starting FROST Round 1: Generating commitments");

        let mut session = frost
            .start_signing_session(session_id, evidence_id, message, &participant_ids)
            .await?;

        tracing::info!("FROST Round 1 completed");
        tracing::info!("Starting FROST Round 2: Collecting signature shares");

        frost
            .collect_signature_shares(&mut session, &participant_ids)
            .await?;

        tracing::info!("FROST Round 2 completed");
        tracing::info!("Aggregating signature");

        let signature = frost.aggregate_signature(&session).await?;

        let signature_bytes = crate::frost_impl::serialize_signature(&signature)
            .map_err(|e| anyhow::anyhow!("Failed to serialize signature: {}", e))?;

        tracing::info!("FROST signing completed with real threshold cryptography");

        Ok(signature_bytes)
    }

    async fn build_and_sign_transaction(
        &self,
        current_height: u32,
        metadata_cid: &str,
        commitment_hash: &str,
        board_category: &str,
        viewing_keys: &[String],
        _signature: &[u8],
    ) -> Result<String> {
        let recipient_addr = self.derive_recipient_address(viewing_keys.first())?;

        let evidence_id = format!("evidence_{}_{}", board_category, current_height);

        let evidence_memo = EvidenceMemo::new(
            evidence_id,
            metadata_cid.to_string(),
            board_category.to_string(),
            commitment_hash.to_string(),
        );

        let tx_bytes = self.tx_builder.build_evidence_transaction(
            recipient_addr,
            evidence_memo,
            BlockHeight::from_u32(current_height),
            &self.rpc,
        ).await?;

        tracing::info!(
            "Built evidence transaction with REAL ZK proofs: {} bytes",
            tx_bytes.len()
        );

        Ok(hex::encode(tx_bytes))
    }

    fn derive_recipient_address(&self, viewing_key: Option<&String>) -> Result<zcash_keys::address::UnifiedAddress> {
        use zcash_keys::keys::{UnifiedFullViewingKey, UnifiedAddressRequest, ReceiverRequirement};

        let vk = viewing_key.ok_or_else(|| anyhow::anyhow!("No viewing key provided"))?;

        let ufvk = UnifiedFullViewingKey::decode(&Network::MainNetwork, vk)
            .map_err(|e| anyhow::anyhow!("Failed to decode UFVK: {}", e))?;

        let request = UnifiedAddressRequest::unsafe_custom(
            ReceiverRequirement::Allow,  // Orchard if available
            ReceiverRequirement::Require, // Sapling required (used in tx building)
            ReceiverRequirement::Omit,   // No transparent
        );

        let (address, _diversifier_index) = ufvk.default_address(request)
            .map_err(|e| anyhow::anyhow!("Failed to generate address: {}", e))?;

        Ok(address)
    }


    fn build_transaction_message(
        &self,
        ipfs_cid: &str,
        commitment_hash: &str,
        board_category: &str,
    ) -> Result<Vec<u8>> {
        let mut message = Vec::new();
        message.extend_from_slice(ipfs_cid.as_bytes());
        message.extend_from_slice(commitment_hash.as_bytes());
        message.extend_from_slice(board_category.as_bytes());

        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(&message);
        let hash = hasher.finalize();

        Ok(hash.to_vec())
    }

    fn generate_evidence_id(&self, request: &EvidenceSubmissionRequest) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(request.title.as_bytes());
        hasher.update(request.description.as_bytes());
        hasher.update(&std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
            .to_le_bytes()
        );

        let hash = hasher.finalize();
        format!("evidence_{}", hex::encode(&hash[..16]))
    }

    fn compute_commitment_hash(&self, request: &EvidenceSubmissionRequest) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(request.title.as_bytes());
        hasher.update(request.description.as_bytes());

        for file in &request.files {
            hasher.update(&file.data);
        }

        let hash = hasher.finalize();
        hex::encode(hash)
    }

    pub async fn get_evidence_status(&self, evidence_id: &str) -> Result<EvidenceSubmissionResponse> {
        let evidence = self.db.get_evidence(evidence_id)
            .await?
            .context("Evidence not found")?;

        let frost_session_id = format!("frost_{}", evidence_id);
        let frost_session = self.db.get_frost_session(&frost_session_id).await?;

        let status = if let Some(session) = frost_session {
            session.status
        } else {
            evidence.status
        };

        Ok(EvidenceSubmissionResponse {
            evidence_id: evidence.evidence_id,
            ipfs_cid: evidence.ipfs_cid,
            zcash_txid: evidence.zcash_txid,
            frost_session_id,
            status,
            payment_disclosure: None,
        })
    }

    pub async fn list_evidence_by_board(&self, board_category: &str) -> Result<Vec<EvidenceSubmissionResponse>> {
        let evidence_list = self.db.get_evidence_by_category(board_category).await?;

        let mut responses = Vec::new();
        for evidence in evidence_list {
            let frost_session_id = format!("frost_{}", evidence.evidence_id);

            responses.push(EvidenceSubmissionResponse {
                evidence_id: evidence.evidence_id,
                ipfs_cid: evidence.ipfs_cid,
                zcash_txid: evidence.zcash_txid,
                frost_session_id,
                status: evidence.status,
                payment_disclosure: None,
            });
        }

        Ok(responses)
    }

    pub async fn get_frost_session_info(&self, session_id: &str) -> Result<FrostSessionInfo> {
        let session = self.db.get_frost_session(session_id)
            .await?
            .context("FROST session not found")?;

        let participants = self.db.get_session_participants(session_id).await?;

        Ok(FrostSessionInfo {
            session_id: session.session_id,
            evidence_id: session.evidence_id,
            threshold: session.threshold as u16,
            current_round: session.current_round as u16,
            status: session.status,
            participant_count: participants.len(),
            signature: session.signature,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrostSessionInfo {
    pub session_id: String,
    pub evidence_id: String,
    pub threshold: u16,
    pub current_round: u16,
    pub status: String,
    pub participant_count: usize,
    pub signature: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_evidence_id_generation() {
        let request = EvidenceSubmissionRequest {
            board_category: "Healthcare".to_string(),
            title: "Test Evidence".to_string(),
            description: "Test description".to_string(),
            files: vec![],
            viewing_keys: vec![],
        };

        let db = Arc::new(Database::new("sqlite::memory:").await.unwrap());
        db.migrate().await.unwrap();

        let ipfs = Arc::new(IpfsClient::new().unwrap());
        let rpc = Arc::new(ZcashRpcClient::new(
            "http://localhost:8232".to_string(),
            "user".to_string(),
            "pass".to_string(),
        ).unwrap());

        let params_dir = std::env::temp_dir().join("zkfied_test_params");
        let near = Arc::new(NearTransactionManager::new(
            "evidence-registry.testnet".parse().unwrap(),
            crate::near_client::NearNetwork::Testnet,
            db.clone(),
        ));
        let orchestrator = EvidenceOrchestrator::new(db, ipfs, rpc, near, params_dir).unwrap();

        let id1 = orchestrator.generate_evidence_id(&request);
        let id2 = orchestrator.generate_evidence_id(&request);

        assert_ne!(id1, id2);
        assert!(id1.starts_with("evidence_"));
    }

    #[tokio::test]
    async fn test_commitment_hash() {
        let request = EvidenceSubmissionRequest {
            board_category: "Healthcare".to_string(),
            title: "Test Evidence".to_string(),
            description: "Test description".to_string(),
            files: vec![
                FileSubmission {
                    filename: "test.txt".to_string(),
                    mime_type: "text/plain".to_string(),
                    data: b"test data".to_vec(),
                }
            ],
            viewing_keys: vec![],
        };

        let db = Arc::new(Database::new("sqlite::memory:").await.unwrap());
        let ipfs = Arc::new(IpfsClient::new().unwrap());
        let rpc = Arc::new(ZcashRpcClient::new(
            "http://localhost:8232".to_string(),
            "user".to_string(),
            "pass".to_string(),
        ).unwrap());
        let params_dir = std::env::temp_dir().join("zkfied_test_params");
        let near = Arc::new(NearTransactionManager::new(
            "evidence-registry.testnet".parse().unwrap(),
            crate::near_client::NearNetwork::Testnet,
            db.clone(),
        ));
        let orchestrator = EvidenceOrchestrator::new(db, ipfs, rpc, near, params_dir).unwrap();

        let hash = orchestrator.compute_commitment_hash(&request);

        let hash2 = orchestrator.compute_commitment_hash(&request);
        assert_eq!(hash, hash2);

        assert_eq!(hash.len(), 64);
    }
}
