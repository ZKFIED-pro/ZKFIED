use anyhow::{Result, Context, bail};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::db::Database;
use crate::encryption::EvidenceEncryption;

// Helper functions for serializing u128 as strings (JSON can't handle u128)
fn serialize_u128_as_string<S>(value: &u128, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&value.to_string())
}

fn deserialize_u128_from_string<'de, D>(deserializer: D) -> Result<u128, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    s.parse().map_err(serde::de::Error::custom)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessRequest {
    pub request_id: String,
    pub evidence_id: String,
    pub requester_id: String,
    #[serde(serialize_with = "serialize_u128_as_string")]
    #[serde(deserialize_with = "deserialize_u128_from_string")]
    pub bid_amount: u128,
    pub purpose: AccessPurpose,
    pub zk_credentials: Option<Vec<u8>>,
    pub deadline: i64,
    pub status: RequestStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AccessPurpose {
    JournalistVerification,
    NGOValidation,
    ForensicAnalysis,
    LegalCompliance,
    FOIARequest,
    AuditAccess,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RequestStatus {
    Pending,
    Bidding,
    Accepted,
    Fulfilled,
    Rejected,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationRequest {
    pub request_id: String,
    pub evidence_id: String,
    pub verification_type: VerificationType,
    #[serde(serialize_with = "serialize_u128_as_string")]
    #[serde(deserialize_with = "deserialize_u128_from_string")]
    pub reward_amount: u128,
    pub deadline: i64,
    pub requirements: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VerificationType {
    TimestampProximity,
    LocationMetadata,
    OriginalCapture,
    DeepfakeDetection,
    IntegrityCheck,
    CrossChainSignature,
    ForensicAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverBid {
    pub bid_id: String,
    pub request_id: String,
    pub solver_id: String,
    #[serde(serialize_with = "serialize_u128_as_string")]
    #[serde(deserialize_with = "deserialize_u128_from_string")]
    pub bid_amount: u128,
    pub estimated_completion: i64,
    pub credentials: Vec<u8>,
    pub proof_of_capability: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WrappedKey {
    pub evidence_id: String,
    pub recipient_public_key: Vec<u8>,
    pub encrypted_key: Vec<u8>,
    pub nonce: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NearIntent {
    pub standard: String,
    pub payload: IntentPayload,
    pub public_key: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentPayload {
    pub message: String,
    pub nonce: String,
    pub recipient: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentMessage {
    pub signer_id: String,
    pub deadline: String,
    pub intents: Vec<Intent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "intent")]
pub enum Intent {
    #[serde(rename = "access_evidence")]
    AccessEvidence {
        evidence_id: String,
        payment: String,
        purpose: String,
    },
    #[serde(rename = "verify_evidence")]
    VerifyEvidence {
        evidence_id: String,
        verification_type: String,
        reward: String,
    },
    #[serde(rename = "transfer")]
    Transfer {
        receiver_id: String,
        tokens: std::collections::HashMap<String, String>,
    },
}

pub struct EvidenceMarketplace {
    db: Arc<Database>,
    near_client: Option<Arc<crate::near_client::NearMarketplaceClient>>,
}

impl EvidenceMarketplace {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            near_client: None,
        }
    }

    pub fn with_near_client(db: Arc<Database>, near_client: Arc<crate::near_client::NearMarketplaceClient>) -> Self {
        Self {
            db,
            near_client: Some(near_client),
        }
    }

    pub async fn create_access_request(
        &self,
        evidence_id: String,
        requester_id: String,
        bid_amount: u128,
        purpose: AccessPurpose,
        zk_credentials: Option<Vec<u8>>,
        deadline: i64,
    ) -> Result<AccessRequest> {
        let request_id = format!("access_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));

        let request = AccessRequest {
            request_id: request_id.clone(),
            evidence_id,
            requester_id,
            bid_amount,
            purpose,
            zk_credentials,
            deadline,
            status: RequestStatus::Pending,
        };

        self.db.insert_access_request(&request).await?;

        Ok(request)
    }

    pub async fn create_verification_request(
        &self,
        evidence_id: String,
        verification_type: VerificationType,
        reward_amount: u128,
        deadline: i64,
        requirements: Vec<String>,
    ) -> Result<VerificationRequest> {
        let request_id = format!("verify_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));

        let request = VerificationRequest {
            request_id: request_id.clone(),
            evidence_id: evidence_id.clone(),
            verification_type: verification_type.clone(),
            reward_amount,
            deadline,
            requirements,
        };

        self.db.insert_verification_request(&request).await?;

        if let Some(near_client) = &self.near_client {
            let verification_type_str = format!("{:?}", verification_type);
            match near_client.create_verification_request(
                evidence_id,
                verification_type_str,
                reward_amount,
            ).await {
                Ok(chain_request_id) => {
                    tracing::info!("Verification request created on NEAR: {}", chain_request_id);
                }
                Err(e) => {
                    tracing::warn!("Failed to create on-chain request (continuing with local): {}", e);
                }
            }
        }

        Ok(request)
    }

    pub async fn submit_solver_bid(
        &self,
        request_id: String,
        solver_id: String,
        bid_amount: u128,
        estimated_completion: i64,
        credentials: Vec<u8>,
        proof_of_capability: Vec<u8>,
    ) -> Result<SolverBid> {
        let bid_id = format!("bid_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));

        let bid = SolverBid {
            bid_id: bid_id.clone(),
            request_id: request_id.clone(),
            solver_id: solver_id.clone(),
            bid_amount,
            estimated_completion,
            credentials,
            proof_of_capability,
        };

        self.db.insert_solver_bid(&bid).await?;

        if let Some(near_client) = &self.near_client {
            match near_client.submit_bid(
                request_id,
                bid_amount,
                estimated_completion as u64,
            ).await {
                Ok(_) => {
                    tracing::info!("Bid submitted on NEAR chain: {}", bid_id);
                }
                Err(e) => {
                    tracing::warn!("Failed to submit bid on-chain (continuing with local): {}", e);
                }
            }
        }

        Ok(bid)
    }

    pub async fn accept_bid(&self, bid_id: String, request_id: String) -> Result<()> {
        self.db.update_access_request_status(&request_id, RequestStatus::Accepted).await?;
        self.db.mark_bid_accepted(&bid_id).await?;

        if let Some(near_client) = &self.near_client {
            let bids = self.db.get_solver_bids_for_request(&request_id).await?;
            if let Some(bid) = bids.iter().find(|b| b.bid_id == bid_id) {
                match near_client.accept_bid(
                    request_id.clone(),
                    bid.solver_id.clone(),
                ).await {
                    Ok(_) => {
                        tracing::info!("Bid accepted on NEAR chain: {}", bid_id);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to accept bid on-chain (continuing with local): {}", e);
                    }
                }
            }
        }

        Ok(())
    }

    pub fn wrap_key_for_recipient(
        &self,
        evidence_id: String,
        viewing_key: &str,
        recipient_public_key: Vec<u8>,
    ) -> Result<WrappedKey> {
        use chacha20poly1305::{
            aead::{Aead, KeyInit, OsRng},
            ChaCha20Poly1305, Nonce as ChaNonce,
        };

        if recipient_public_key.len() != 32 {
            bail!("Invalid recipient public key length");
        }

        let cipher_key = {
            use sha2::{Sha256, Digest};
            let mut hasher = Sha256::new();
            hasher.update(b"zkfied_key_wrapping_v1");
            hasher.update(&recipient_public_key);
            let hash = hasher.finalize();
            let mut key = [0u8; 32];
            key.copy_from_slice(&hash);
            key
        };

        let cipher = ChaCha20Poly1305::new(&cipher_key.into());

        let mut nonce_bytes = [0u8; 12];
        use rand::RngCore;
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = ChaNonce::from_slice(&nonce_bytes);

        let encrypted_key = cipher.encrypt(nonce, viewing_key.as_bytes())
            .map_err(|e| anyhow::anyhow!("Key wrapping failed: {}", e))?;

        Ok(WrappedKey {
            evidence_id,
            recipient_public_key,
            encrypted_key,
            nonce: nonce_bytes.to_vec(),
        })
    }

    pub fn unwrap_key(
        &self,
        wrapped_key: &WrappedKey,
        recipient_private_key: &[u8],
    ) -> Result<String> {
        use chacha20poly1305::{
            aead::{Aead, KeyInit},
            ChaCha20Poly1305, Nonce as ChaNonce,
        };

        if recipient_private_key.len() != 32 {
            bail!("Invalid recipient private key length");
        }

        let public_key = {
            use ed25519_dalek::SigningKey;
            let signing_key = SigningKey::from_bytes(
                recipient_private_key.try_into()
                    .map_err(|_| anyhow::anyhow!("Invalid private key"))?
            );
            signing_key.verifying_key().to_bytes().to_vec()
        };

        let cipher_key = {
            use sha2::{Sha256, Digest};
            let mut hasher = Sha256::new();
            hasher.update(b"zkfied_key_wrapping_v1");
            hasher.update(&public_key);
            let hash = hasher.finalize();
            let mut key = [0u8; 32];
            key.copy_from_slice(&hash);
            key
        };

        let cipher = ChaCha20Poly1305::new(&cipher_key.into());

        if wrapped_key.nonce.len() != 12 {
            bail!("Invalid nonce size");
        }

        let nonce = ChaNonce::from_slice(&wrapped_key.nonce);

        let viewing_key_bytes = cipher.decrypt(nonce, wrapped_key.encrypted_key.as_ref())
            .map_err(|e| anyhow::anyhow!("Key unwrapping failed: {}", e))?;

        String::from_utf8(viewing_key_bytes)
            .context("Unwrapped key is not valid UTF-8")
    }

    pub fn create_near_intent(
        &self,
        signer_id: String,
        intent: Intent,
        deadline: chrono::DateTime<chrono::Utc>,
    ) -> Result<String> {
        let message = IntentMessage {
            signer_id,
            deadline: deadline.to_rfc3339(),
            intents: vec![intent],
        };

        let message_json = serde_json::to_string(&message)?;

        Ok(message_json)
    }

    pub async fn get_active_access_requests(&self, evidence_id: &str) -> Result<Vec<AccessRequest>> {
        self.db.get_access_requests_by_evidence(evidence_id).await
    }

    pub async fn get_active_verification_requests(&self) -> Result<Vec<VerificationRequest>> {
        self.db.get_pending_verification_requests().await
    }

    pub async fn get_bids_for_request(&self, request_id: &str) -> Result<Vec<SolverBid>> {
        self.db.get_solver_bids_for_request(request_id).await
    }

    pub fn verify_zk_credential(&self, credential: &[u8], required_type: &str) -> Result<bool> {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(credential);
        hasher.update(required_type.as_bytes());
        let hash = hasher.finalize();

        Ok(hash[0] % 2 == 0)
    }
}
