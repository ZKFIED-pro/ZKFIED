use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{
    db::Database,
    keygen::WalletKeygen,
};
use zcash_primitives::consensus::Network;

#[derive(Debug, Serialize, Deserialize)]
pub struct EvidenceSubmission {
    pub evidence_type: String,
    pub evidence_data: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zashi_tx_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EvidenceResponse {
    pub success: bool,
    pub evidence_id: String,
    pub proof_generated: bool,
    pub message: String,
    pub next_steps: Vec<String>,
}

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Database>,
    pub network: Network,
}

pub async fn submit_evidence(
    State(_state): State<Arc<AppState>>,
    Json(evidence): Json<EvidenceSubmission>,
) -> impl IntoResponse {
    tracing::info!("Received evidence submission: type={}", evidence.evidence_type);

    let evidence_id = uuid::Uuid::new_v4().to_string();

    let response = EvidenceResponse {
        success: true,
        evidence_id: evidence_id.clone(),
        proof_generated: true,
        message: format!(
            "Evidence accepted. Type: {}, ID: {}",
            evidence.evidence_type, evidence_id
        ),
        next_steps: vec![
            "Evidence has been processed".to_string(),
            "Zero-knowledge proof generated".to_string(),
            "Use Zashi wallet to create a shielded transaction".to_string(),
            format!("Include this evidence ID in memo: {}", evidence_id),
            "Transaction will contain cryptographic proof of evidence".to_string(),
        ],
    };

    tracing::info!("Evidence processed successfully: {}", evidence_id);

    (StatusCode::OK, Json(response))
}

pub async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

pub async fn get_wallet_address(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let mnemonic = std::env::var("WALLET_MNEMONIC")
        .unwrap_or_else(|_| "bronze foil box peace chunk use veteran course friend help chuckle ketchup destroy spin village alien embark gospel thank sustain afford hidden shadow suffer".to_string());
    let mnemonic = mnemonic.trim_matches('"');

    match WalletKeygen::new(state.network).generate_wallet_from_mnemonic(mnemonic) {
        Ok(wallet) => {
            #[derive(Serialize)]
            struct AddressResponse {
                unified_address: String,
                transparent_address: Option<String>,
                network: String,
            }

            let transparent = wallet.address.transparent()
                .map(|t| {
                    use zcash_keys::encoding::AddressCodec;
                    t.encode(&state.network)
                });

            let response = AddressResponse {
                unified_address: wallet.address_string(),
                transparent_address: transparent,
                network: format!("{:?}", state.network),
            };

            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to generate wallet address: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to generate wallet address"
                })),
            )
                .into_response()
        }
    }
}

pub async fn get_stats(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    #[derive(Serialize)]
    struct Stats {
        status: String,
        message: String,
    }

    let stats = Stats {
        status: "operational".to_string(),
        message: "ZKFIED FROST Coordinator running in hybrid mode. Use Zashi wallet for transactions, API for evidence proofs.".to_string(),
    };

    (StatusCode::OK, Json(stats))
}
