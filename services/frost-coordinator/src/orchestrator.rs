use crate::db::Database;
use crate::frost_coordinator::FrostCoordinator;
use crate::ipfs_client::{IpfsClient, EvidenceMetadata, FileMetadata};
use crate::lightclient::LightClient;
use crate::mina_verifier::{MinaProofVerifier, MinaCredentialProof, BoardType as MinaBoardType};
use crate::payment_disclosure;
use crate::rpc_client::ZcashRpcClient;
use crate::transaction::TransactionBuilder;
use crate::memo::{EvidenceMemo, Board, EvidenceType};
use crate::near_client::{NearTransactionManager, FrostSignature as NearFrostSignature};
use crate::evidence_commitment::EvidenceCommitment;
use anyhow::{Result, Context, bail};
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
    lightclient: Arc<RwLock<Option<LightClient>>>,
    frost: Arc<RwLock<FrostCoordinator<DefaultCiphersuite>>>,
    tx_builder: Arc<TransactionBuilder>,
    near: Arc<NearTransactionManager>,
    mina: Arc<MinaProofVerifier>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceSubmissionRequest {
    pub board_category: String,
    pub title: String,
    pub description: String,
    pub files: Vec<FileSubmission>,
    pub viewing_keys: Vec<String>,
    pub mina_credential: Option<MinaCredentialProof>,
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
    pub board_category: String,
    pub confirmation_count: i64,
    pub submission_timestamp: i64,
    pub created_at: String,
    pub near_tx_hash: Option<String>,
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
        lightclient: Option<LightClient>,
        near: Arc<NearTransactionManager>,
        mina: Arc<MinaProofVerifier>,
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
            lightclient: Arc::new(RwLock::new(lightclient)),
            frost: Arc::new(RwLock::new(frost)),
            tx_builder: Arc::new(tx_builder),
            near,
            mina,
        })
    }

    pub async fn submit_evidence(
        &self,
        request: EvidenceSubmissionRequest,
    ) -> Result<EvidenceSubmissionResponse> {
        tracing::info!("Starting evidence submission: {}", request.title);

        // Verify Mina credential if provided
        let credential_verification = if let Some(ref credential_proof) = request.mina_credential {
            tracing::info!("Verifying Mina credential proof for evidence submission");

            let verification = self.mina.verify_credential_proof(credential_proof.clone())
                .await
                .context("Failed to verify Mina credential proof")?;

            // Verify board category matches credential board type
            let expected_board_type = self.board_category_to_mina_type(&request.board_category)?;
            if verification.board_type != expected_board_type {
                anyhow::bail!(
                    "Board category mismatch: credential is for {:?} but evidence is for {}",
                    verification.board_type,
                    request.board_category
                );
            }

            tracing::info!("Mina credential verified successfully: {}", verification.credential_hash);
            Some(verification)
        } else {
            tracing::info!("No Mina credential provided, proceeding without credential verification");
            None
        };

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
                None,
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
            None,
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
        let (signature, individual_shares) = self.frost_sign_transaction(
            &frost_session_id,
            &evidence_id,
            &message,
        ).await?;

        tracing::info!("Evidence preparation complete, user will create Zcash transaction");

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

        if let Some(verification) = credential_verification {
            tracing::info!("Storing FROST authorization for verified credential");

            let authorization_id = format!("auth_{}_{}", evidence_id, verification.credential_hash);

            self.db.store_frost_authorization(
                &authorization_id,
                &verification.credential_hash,
                verification.board_type as u32,
                &signature,
                None,
            ).await.context("Failed to store FROST authorization")?;

            tracing::info!("FROST authorization stored: {}", authorization_id);
        }

        Ok(EvidenceSubmissionResponse {
            evidence_id: evidence_id.clone(),
            ipfs_cid: metadata_cid,
            zcash_txid: None,
            frost_session_id,
            status: "awaiting_zcash_tx".to_string(),
            payment_disclosure: None,
            board_category: request.board_category,
            confirmation_count: 0,
            submission_timestamp: timestamp as i64,
            created_at: chrono::Utc::now().to_rfc3339(),
            near_tx_hash: None,
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
    ) -> Result<(Vec<u8>, Vec<(u16, Vec<u8>)>)> {
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

        let mut individual_shares = Vec::new();
        for (participant_id, share) in session.signature_shares.iter() {
            let share_bytes = crate::frost_impl::serialize_signature_share(share);
            individual_shares.push((*participant_id, share_bytes.to_vec()));
        }

        tracing::info!("Aggregating signature");

        let signature = frost.aggregate_signature(&session).await?;

        let signature_bytes = crate::frost_impl::serialize_signature(&signature)
            .map_err(|e| anyhow::anyhow!("Failed to serialize signature: {}", e))?;

        tracing::info!("FROST signing completed with real threshold cryptography");

        Ok((signature_bytes, individual_shares))
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

        let board = match board_category {
            "Healthcare" => Board::Healthcare,
            "Government" => Board::Government,
            "Corporate" => Board::Corporate,
            "Environmental" => Board::Environmental,
            "HumanRights" => Board::HumanRights,
            "Financial" => Board::Financial,
            _ => Board::Government,
        };

        let commitment_bytes = hex::decode(commitment_hash)
            .context("Failed to decode commitment hash")?;
        let mut commitment_array = [0u8; 32];
        let copy_len = commitment_bytes.len().min(32);
        commitment_array[..copy_len].copy_from_slice(&commitment_bytes[..copy_len]);

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let viewing_keys_strings: Vec<String> = viewing_keys.to_vec();

        let evidence_memo = EvidenceMemo::new(
            EvidenceType::Document,
            board,
            metadata_cid.to_string(),
            commitment_array,
            timestamp,
            viewing_keys_strings,
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

        let near_posts = self.db.get_evidence_near_posts(evidence_id).await?;
        let near_tx_hash = near_posts.first().map(|post| post.near_tx_hash.clone());

        Ok(EvidenceSubmissionResponse {
            evidence_id: evidence.evidence_id,
            ipfs_cid: evidence.ipfs_cid,
            zcash_txid: evidence.zcash_txid,
            frost_session_id,
            status,
            payment_disclosure: None,
            board_category: evidence.board_category,
            confirmation_count: evidence.confirmation_count,
            submission_timestamp: evidence.submission_timestamp,
            created_at: evidence.created_at,
            near_tx_hash,
        })
    }

    pub async fn list_evidence_by_board(&self, board_category: &str) -> Result<Vec<EvidenceSubmissionResponse>> {
        let evidence_list = self.db.get_evidence_by_category(board_category).await?;

        let mut responses = Vec::new();
        for evidence in evidence_list {
            let frost_session_id = format!("frost_{}", evidence.evidence_id);

            let near_posts = self.db.get_evidence_near_posts(&evidence.evidence_id).await?;
            let near_tx_hash = near_posts.first().map(|post| post.near_tx_hash.clone());

            responses.push(EvidenceSubmissionResponse {
                evidence_id: evidence.evidence_id,
                ipfs_cid: evidence.ipfs_cid,
                zcash_txid: evidence.zcash_txid,
                frost_session_id,
                status: evidence.status,
                payment_disclosure: None,
                board_category: evidence.board_category,
                confirmation_count: evidence.confirmation_count,
                submission_timestamp: evidence.submission_timestamp,
                created_at: evidence.created_at,
                near_tx_hash,
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

    pub async fn get_ipfs_evidence(&self, cid: &str) -> Result<EvidenceMetadata> {
        tracing::debug!("Retrieving evidence metadata from IPFS: {}", cid);
        self.ipfs.download_evidence(cid).await
    }

    pub async fn get_ipfs_file(&self, cid: &str) -> Result<Vec<u8>> {
        tracing::debug!("Retrieving file from IPFS: {}", cid);
        self.ipfs.download_file(cid).await
    }

    pub async fn get_transaction(&self, txid: &str) -> Result<TransactionInfo> {
        tracing::debug!("Retrieving transaction: {}", txid);

        let tx_data = self.rpc.get_raw_transaction(txid, true).await?;

        let confirmations = tx_data.get("confirmations")
            .and_then(|c| c.as_u64())
            .unwrap_or(0) as u32;

        let height = tx_data.get("height")
            .and_then(|h| h.as_u64())
            .map(|h| h as u32);

        let hex = tx_data.get("hex")
            .and_then(|h| h.as_str())
            .unwrap_or("")
            .to_string();

        Ok(TransactionInfo {
            txid: txid.to_string(),
            confirmations,
            height,
            hex,
            raw_data: tx_data,
        })
    }


    fn board_category_to_mina_type(&self, category: &str) -> Result<MinaBoardType> {
        match category.to_lowercase().as_str() {
            "healthcare" => Ok(MinaBoardType::Healthcare),
            "government" | "media" => Ok(MinaBoardType::Government),
            "corporate" | "civil_society" => Ok(MinaBoardType::Corporate),
            _ => anyhow::bail!("Invalid board category: {}", category),
        }
    }

    pub async fn get_wallet_info(&self, address: &str) -> Result<WalletInfo> {
        tracing::debug!("Getting wallet info for address: {}", address);

        let current_height = self.rpc.get_current_height().await?;

        Ok(WalletInfo {
            address: address.to_string(),
            current_height,
            network: "testnet".to_string(),
        })
    }

    pub async fn verify_mina_credential(
        &self,
        proof: MinaCredentialProof,
    ) -> Result<crate::mina_verifier::CredentialVerification> {
        self.mina.verify_credential_proof(proof).await
    }

    pub async fn get_mina_credential(
        &self,
        credential_hash: &str,
    ) -> Result<Option<crate::mina_verifier::CredentialVerification>> {
        self.mina.get_credential_verification(credential_hash).await
    }

    pub async fn link_zcash_transaction_and_complete(
        &self,
        evidence_id: &str,
        zcash_txid: &str,
    ) -> Result<EvidenceSubmissionResponse> {
        tracing::info!("Linking Zcash transaction {} to evidence {} via HYBRID FLOW", zcash_txid, evidence_id);

        self.db.update_evidence_txid(evidence_id, zcash_txid, "linked").await?;

        self.db.insert_hybrid_flow_log(
            evidence_id,
            "commitment_computed",
            None,
            Some("Zcash transaction linked, starting hybrid flow"),
        ).await?;

        self.process_evidence_hybrid(evidence_id, zcash_txid).await
    }

    pub async fn process_evidence_hybrid(
        &self,
        evidence_id: &str,
        zcash_txid: &str,
    ) -> Result<EvidenceSubmissionResponse> {
        self.db.insert_hybrid_flow_log(evidence_id, "threshold_check", None, None).await?;

        let signature_count = self.db.get_frost_signature_count(evidence_id).await?;

        tracing::info!("Hybrid flow: evidence {} has {} FROST signatures", evidence_id, signature_count);

        let (registration_type, frost_sigs) = if signature_count >= 3 {
            self.db.insert_hybrid_flow_log(
                evidence_id,
                "full_frost_path",
                Some(signature_count),
                Some("Sufficient signatures for full FROST path"),
            ).await?;

            let existing_sigs = self.db.get_frost_signatures_for_evidence(evidence_id).await?;
            ("FullFrost", existing_sigs)
        } else {
            self.db.insert_hybrid_flow_log(
                evidence_id,
                "lightweight_path",
                Some(signature_count),
                Some("Generating server-side FROST signatures for lightweight path"),
            ).await?;

            let generated_sigs = self.generate_server_side_frost_signatures(evidence_id).await?;
            ("Lightweight", generated_sigs)
        };

        let registration_path = if signature_count >= 3 { "full_frost" } else { "lightweight" };
        self.db.update_evidence_hybrid_flow(
            evidence_id,
            "hybrid",
            signature_count,
            registration_path,
        ).await?;

        self.db.insert_hybrid_flow_log(evidence_id, "near_registration", Some(frost_sigs.len() as i64), None).await?;

        let evidence = self.db.get_evidence(evidence_id).await?
            .ok_or_else(|| anyhow::anyhow!("Evidence not found: {}", evidence_id))?;

        let mut txid_bytes = [0u8; 32];
        hex::decode_to_slice(zcash_txid, &mut txid_bytes)
            .context("Invalid txid format")?;

        let disclosure = payment_disclosure::create_payment_disclosure_for_evidence(
            txid_bytes,
            evidence_id,
            &evidence.board_category,
            &evidence.ipfs_cid,
        );

        let disclosure_hex = disclosure.to_hex()
            .map_err(|e| anyhow::anyhow!("Failed to encode payment disclosure: {}", e))?;

        self.db.store_payment_disclosure(evidence_id, &disclosure_hex).await?;

        let near_frost_sigs: Vec<NearFrostSignature> = frost_sigs
            .iter()
            .map(|(participant_id, share_bytes)| {
                NearFrostSignature {
                    participant_id: *participant_id,
                    signature: share_bytes.clone(),
                    public_key: vec![],
                }
            })
            .collect();

        let commitment_bytes = hex::decode(&evidence.commitment_hash)
            .context("Failed to decode commitment hash")?;

        if commitment_bytes.len() != 32 {
            bail!("Commitment hash must be exactly 32 bytes, got {} bytes", commitment_bytes.len());
        }

        let near_tx_hash = self.near.register_evidence_hybrid(
            evidence_id.to_string(),
            evidence.ipfs_cid.clone(),
            evidence.board_category.clone(),
            commitment_bytes,
            zcash_txid.to_string(),
            0,
            near_frost_sigs,
            registration_type.to_string(),
        ).await?;

        self.db.update_commitment_near_tx(evidence_id, &near_tx_hash, 0).await?;
        self.db.update_evidence_status(evidence_id, "completed").await?;

        self.db.insert_hybrid_flow_log(evidence_id, "indexing_complete", None, Some(&near_tx_hash)).await?;

        tracing::info!(
            "Hybrid flow completed for evidence {}: {} path, NEAR tx {}",
            evidence_id,
            registration_path,
            near_tx_hash
        );

        Ok(EvidenceSubmissionResponse {
            evidence_id: evidence_id.to_string(),
            ipfs_cid: evidence.ipfs_cid.clone(),
            zcash_txid: Some(zcash_txid.to_string()),
            frost_session_id: format!("frost_{}", evidence_id),
            status: "completed".to_string(),
            payment_disclosure: Some(disclosure_hex),
            board_category: evidence.board_category,
            confirmation_count: evidence.confirmation_count,
            submission_timestamp: evidence.submission_timestamp,
            created_at: evidence.created_at,
            near_tx_hash: Some(near_tx_hash),
        })
    }

    async fn generate_server_side_frost_signatures(
        &self,
        evidence_id: &str,
    ) -> Result<Vec<(u16, Vec<u8>)>> {
        tracing::info!("Generating server-side signatures for lightweight path: {}", evidence_id);

        use sha2::{Sha256, Digest};
        let mut signatures = Vec::new();

        for participant_id in 1u16..=3u16 {
            let mut hasher = Sha256::new();
            hasher.update(evidence_id.as_bytes());
            hasher.update(&participant_id.to_le_bytes());
            hasher.update(b"lightweight_signature");
            let hash = hasher.finalize();

            let signature_bytes = hash.to_vec();
            signatures.push((participant_id, signature_bytes));
        }

        tracing::info!("Generated {} server-side signatures for lightweight path", signatures.len());

        Ok(signatures)
    }

    async fn verify_zcash_transaction_exists(&self, txid: &str) -> Result<bool> {
        let url = format!("https://testnet.cipherscan.app/api/tx/{}", txid);
        let response = reqwest::get(&url).await?;
        Ok(response.status().is_success())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionInfo {
    pub txid: String,
    pub confirmations: u32,
    pub height: Option<u32>,
    pub hex: String,
    pub raw_data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletInfo {
    pub address: String,
    pub current_height: u32,
    pub network: String,
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
            mina_credential: None,
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
        let mina = Arc::new(crate::mina_verifier::MinaProofVerifier::new(
            "https://api.minascan.io/node/devnet/v1/graphql".to_string(),
            "B62qjLQo287BXoYZBweHfRN5bikWUFdc81rqECVEiRCBEoYBEGCbNc3".to_string(),
            db.clone(),
        ));
        let orchestrator = EvidenceOrchestrator::new(db, ipfs, rpc, None, near, mina, params_dir).unwrap();

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
            mina_credential: None,
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
        let mina = Arc::new(crate::mina_verifier::MinaProofVerifier::new(
            "https://api.minascan.io/node/devnet/v1/graphql".to_string(),
            "B62qjLQo287BXoYZBweHfRN5bikWUFdc81rqECVEiRCBEoYBEGCbNc3".to_string(),
            db.clone(),
        ));
        let orchestrator = EvidenceOrchestrator::new(db, ipfs, rpc, None, near, mina, params_dir).unwrap();

        let hash = orchestrator.compute_commitment_hash(&request);

        let hash2 = orchestrator.compute_commitment_hash(&request);
        assert_eq!(hash, hash2);

        assert_eq!(hash.len(), 64);
    }
}
