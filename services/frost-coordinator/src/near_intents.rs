use anyhow::{Result, Context, bail};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

const SOLVER_BUS_RPC: &str = "https://solver-relay-v2.chaindefuser.com/rpc";
const SOLVER_BUS_WS: &str = "wss://solver-relay-v2.chaindefuser.com/ws";
const VERIFIER_CONTRACT: &str = "intents.near";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Nep413SignedData {
    pub standard: String,
    pub payload: Nep413Payload,
    pub public_key: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Nep413Payload {
    pub message: String,
    pub nonce: String,
    pub recipient: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentMessage {
    pub signer_id: String,
    pub deadline: String,
    pub intents: Vec<CustomIntent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "intent")]
pub enum CustomIntent {
    #[serde(rename = "access_evidence")]
    AccessEvidence {
        evidence_id: String,
        payment_amount: String,
        payment_token: String,
        purpose: String,
        zk_credential_hash: Option<String>,
    },
    #[serde(rename = "verify_evidence")]
    VerifyEvidence {
        evidence_id: String,
        verification_type: String,
        reward_amount: String,
        reward_token: String,
        requirements_hash: String,
    },
    #[serde(rename = "submit_verification")]
    SubmitVerification {
        request_id: String,
        evidence_id: String,
        proof_data: String,
        proof_hash: String,
    },
    #[serde(rename = "token_diff")]
    TokenDiff {
        diff: HashMap<String, String>,
    },
    #[serde(rename = "transfer")]
    Transfer {
        receiver_id: String,
        tokens: HashMap<String, String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishIntentRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    pub params: Vec<PublishIntentParams>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishIntentParams {
    pub quote_hashes: Vec<String>,
    pub signed_data: Nep413SignedData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishIntentResponse {
    pub jsonrpc: String,
    pub id: u64,
    pub result: IntentStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IntentStatus {
    Pending,
    TxBroadcasted,
    Settled,
    NotFoundOrNotValid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    pub params: Vec<QuoteParams>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteParams {
    pub defuse_asset_identifier_in: String,
    pub defuse_asset_identifier_out: String,
    pub exact_amount_in: Option<String>,
    pub exact_amount_out: Option<String>,
    pub min_deadline_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteResponse {
    pub jsonrpc: String,
    pub id: u64,
    pub result: Vec<QuoteResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteResult {
    pub quote_hash: String,
    pub amount_in: String,
    pub amount_out: String,
    pub expires_at: u64,
    pub solver_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentStatusRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    pub params: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentStatusResponse {
    pub jsonrpc: String,
    pub id: u64,
    pub result: IntentExecutionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentExecutionStatus {
    pub status: IntentStatus,
    pub tx_hash: Option<String>,
    pub error: Option<String>,
}

pub struct NearIntentsClient {
    client: reqwest::Client,
    rpc_url: String,
}

impl NearIntentsClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            rpc_url: SOLVER_BUS_RPC.to_string(),
        }
    }

    pub async fn publish_intent(
        &self,
        signed_data: Nep413SignedData,
        quote_hashes: Vec<String>,
    ) -> Result<IntentStatus> {
        let request = PublishIntentRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "publish_intent".to_string(),
            params: vec![PublishIntentParams {
                quote_hashes,
                signed_data,
            }],
        };

        let response = self.client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await
            .context("Failed to publish intent")?;

        let result: PublishIntentResponse = response.json().await
            .context("Failed to parse publish intent response")?;

        Ok(result.result)
    }

    pub async fn request_quote(
        &self,
        asset_in: String,
        asset_out: String,
        exact_amount_in: Option<String>,
        exact_amount_out: Option<String>,
    ) -> Result<Vec<QuoteResult>> {
        if exact_amount_in.is_some() && exact_amount_out.is_some() {
            bail!("Cannot specify both exact_amount_in and exact_amount_out");
        }

        let request = QuoteRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "quote".to_string(),
            params: vec![QuoteParams {
                defuse_asset_identifier_in: asset_in,
                defuse_asset_identifier_out: asset_out,
                exact_amount_in,
                exact_amount_out,
                min_deadline_ms: Some(60000),
            }],
        };

        let response = self.client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await
            .context("Failed to request quote")?;

        let result: QuoteResponse = response.json().await
            .context("Failed to parse quote response")?;

        Ok(result.result)
    }

    pub async fn get_intent_status(&self, intent_hash: String) -> Result<IntentExecutionStatus> {
        let request = IntentStatusRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "get_status".to_string(),
            params: vec![intent_hash],
        };

        let response = self.client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await
            .context("Failed to get intent status")?;

        let result: IntentStatusResponse = response.json().await
            .context("Failed to parse intent status response")?;

        Ok(result.result)
    }

    pub fn create_access_evidence_intent(
        &self,
        evidence_id: String,
        payment_amount: String,
        payment_token: String,
        purpose: String,
        zk_credential_hash: Option<String>,
    ) -> CustomIntent {
        CustomIntent::AccessEvidence {
            evidence_id,
            payment_amount,
            payment_token,
            purpose,
            zk_credential_hash,
        }
    }

    pub fn create_verify_evidence_intent(
        &self,
        evidence_id: String,
        verification_type: String,
        reward_amount: String,
        reward_token: String,
        requirements_hash: String,
    ) -> CustomIntent {
        CustomIntent::VerifyEvidence {
            evidence_id,
            verification_type,
            reward_amount,
            reward_token,
            requirements_hash,
        }
    }

    pub fn create_submit_verification_intent(
        &self,
        request_id: String,
        evidence_id: String,
        proof_data: String,
        proof_hash: String,
    ) -> CustomIntent {
        CustomIntent::SubmitVerification {
            request_id,
            evidence_id,
            proof_data,
            proof_hash,
        }
    }

    pub fn build_intent_message(
        &self,
        signer_id: String,
        intents: Vec<CustomIntent>,
        deadline: DateTime<Utc>,
    ) -> Result<String> {
        let message = IntentMessage {
            signer_id,
            deadline: deadline.to_rfc3339(),
            intents,
        };

        serde_json::to_string(&message)
            .context("Failed to serialize intent message")
    }

    pub fn sign_intent_nep413(
        &self,
        message: String,
        signer_id: &str,
        private_key: &ed25519_dalek::SigningKey,
    ) -> Result<Nep413SignedData> {
        use ed25519_dalek::{Signer, VerifyingKey};
        use sha2::{Sha256, Digest};

        let mut nonce_bytes = [0u8; 32];
        use rand::RngCore;
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = base64::encode(&nonce_bytes);

        let payload = Nep413Payload {
            message,
            nonce,
            recipient: VERIFIER_CONTRACT.to_string(),
        };

        let payload_bytes = serde_json::to_vec(&payload)?;
        let mut hasher = Sha256::new();
        hasher.update(&payload_bytes);
        let payload_hash = hasher.finalize();

        let signature = private_key.sign(&payload_hash);

        let public_key: VerifyingKey = private_key.verifying_key();
        let public_key_bytes = public_key.to_bytes();
        let public_key_str = format!("ed25519:{}", bs58::encode(&public_key_bytes).into_string());

        let signature_bytes = signature.to_bytes();
        let signature_str = format!("ed25519:{}", bs58::encode(&signature_bytes).into_string());

        Ok(Nep413SignedData {
            standard: "nep413".to_string(),
            payload,
            public_key: public_key_str,
            signature: signature_str,
        })
    }

    pub fn calculate_intent_hash(&self, signed_data: &Nep413SignedData) -> Result<String> {
        use sha2::{Sha256, Digest};

        let data_bytes = serde_json::to_vec(signed_data)?;
        let mut hasher = Sha256::new();
        hasher.update(&data_bytes);
        let hash = hasher.finalize();

        Ok(hex::encode(hash))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_intent_message() {
        let client = NearIntentsClient::new();

        let intent = client.create_access_evidence_intent(
            "evidence_123".to_string(),
            "1000000".to_string(),
            "nep141:usdc.near".to_string(),
            "journalist_verification".to_string(),
            None,
        );

        let deadline = Utc::now() + chrono::Duration::hours(1);
        let message = client.build_intent_message(
            "alice.near".to_string(),
            vec![intent],
            deadline,
        ).unwrap();

        assert!(message.contains("access_evidence"));
        assert!(message.contains("evidence_123"));
    }
}
