use anyhow::{Result, Context, bail};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::sync::Arc;
use crate::db::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinaCredentialProof {
    pub proof: String,
    pub public_input: Vec<String>,
    pub holder_public_key: String,
    pub credential_type: u32,
    pub timestamp: u64,
    pub zkapp_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialVerification {
    pub credential_hash: String,
    pub board_type: BoardType,
    pub is_valid: bool,
    pub verified_at: u64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum BoardType {
    Healthcare = 1,
    Government = 2,
    Corporate = 3,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum CredentialType {
    Doctor = 1,
    Nurse = 2,
    Journalist = 3,
    Laborer = 4,
}

impl CredentialType {
    pub fn to_board_type(self) -> BoardType {
        match self {
            CredentialType::Doctor | CredentialType::Nurse => BoardType::Healthcare,
            CredentialType::Journalist => BoardType::Government,
            CredentialType::Laborer => BoardType::Corporate,
        }
    }
}

pub struct MinaProofVerifier {
    client: Arc<Client>,
    graphql_endpoint: String,
    zkapp_address: String,
    db: Arc<Database>,
}

impl MinaProofVerifier {
    pub fn new(graphql_endpoint: String, zkapp_address: String, db: Arc<Database>) -> Self {
        Self {
            client: Arc::new(Client::new()),
            graphql_endpoint,
            zkapp_address,
            db,
        }
    }

    pub async fn verify_credential_proof(
        &self,
        proof: MinaCredentialProof,
    ) -> Result<CredentialVerification> {
        if proof.zkapp_address != self.zkapp_address {
            bail!("Invalid zkApp address");
        }

        let is_valid = self.verify_proof_on_chain(&proof).await?;

        if !is_valid {
            bail!("Proof verification failed on Mina blockchain");
        }

        let credential_type = CredentialType::from_u32(proof.credential_type)?;
        let board_type = credential_type.to_board_type();

        let credential_hash = self.compute_credential_hash(&proof);

        let verification = CredentialVerification {
            credential_hash: credential_hash.clone(),
            board_type,
            is_valid: true,
            verified_at: chrono::Utc::now().timestamp() as u64,
        };

        self.db.store_mina_credential_proof(
            &credential_hash,
            &proof.holder_public_key,
            proof.credential_type,
            proof.timestamp,
            &proof.proof,
            board_type as u32,
        ).await?;

        Ok(verification)
    }

    async fn verify_proof_on_chain(&self, proof: &MinaCredentialProof) -> Result<bool> {
        let query = format!(
            r#"
            query {{
              account(publicKey: "{}") {{
                zkappState
              }}
            }}
            "#,
            proof.zkapp_address
        );

        let response = self.client
            .post(&self.graphql_endpoint)
            .json(&serde_json::json!({ "query": query }))
            .send()
            .await
            .context("Failed to query Mina blockchain")?;

        let result: serde_json::Value = response.json().await?;

        let zkapp_state = result
            .get("data")
            .and_then(|d| d.get("account"))
            .and_then(|a| a.get("zkappState"))
            .ok_or_else(|| anyhow::anyhow!("Invalid response from Mina GraphQL"))?;

        let credential_count = zkapp_state
            .get(1)
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Invalid credential count"))?;

        Ok(credential_count > 0)
    }

    fn compute_credential_hash(&self, proof: &MinaCredentialProof) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(proof.holder_public_key.as_bytes());
        hasher.update(&proof.credential_type.to_le_bytes());
        hasher.update(&proof.timestamp.to_le_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub async fn get_credential_verification(
        &self,
        credential_hash: &str,
    ) -> Result<Option<CredentialVerification>> {
        let record = self.db.get_mina_credential_proof(credential_hash).await?;

        Ok(record.map(|r| {
            let board_type = match r.board_type {
                1 => BoardType::Healthcare,
                2 => BoardType::Government,
                3 => BoardType::Corporate,
                _ => BoardType::Healthcare,
            };

            CredentialVerification {
                credential_hash: r.credential_hash,
                board_type,
                is_valid: r.is_revoked == 0,
                verified_at: r.verified_at as u64,
            }
        }))
    }
}

impl CredentialType {
    fn from_u32(value: u32) -> Result<Self> {
        match value {
            1 => Ok(CredentialType::Doctor),
            2 => Ok(CredentialType::Nurse),
            3 => Ok(CredentialType::Journalist),
            4 => Ok(CredentialType::Laborer),
            _ => bail!("Invalid credential type: {}", value),
        }
    }
}
