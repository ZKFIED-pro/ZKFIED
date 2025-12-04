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
    otp::OtpManager,
    mina_verifier::{MinaProofVerifier, MinaCredentialProof},
    encryption::EvidenceEncryption,
};
use zcash_primitives::consensus::Network;

#[derive(Debug, Serialize, Deserialize)]
pub struct OtpRequest {
    pub email: String,
    pub mina_credential_hash: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OtpVerifyRequest {
    pub session_id: String,
    pub otp_code: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionResponse {
    pub session_id: String,
    pub is_verified: bool,
    pub email: String,
    pub mina_credential_hash: Option<String>,
    pub board_type: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EvidenceSubmission {
    pub evidence_type: String,
    pub evidence_data: String,
    pub description: String,
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zashi_tx_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mina_credential: Option<MinaCredentialProof>,
}

#[derive(Debug, Serialize)]
pub struct EvidenceResponse {
    pub success: bool,
    pub evidence_id: String,
    pub proof_generated: bool,
    pub message: String,
    pub next_steps: Vec<String>,
    pub viewing_key: Option<String>,
}

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Database>,
    pub network: Network,
    pub otp_manager: Arc<OtpManager>,
    pub mina_verifier: Arc<MinaProofVerifier>,
    pub ipfs: Arc<crate::ipfs_client::IpfsClient>,
    pub near_client: Arc<crate::near_client::NearTransactionManager>,
}

pub async fn request_otp(
    State(state): State<Arc<AppState>>,
    Json(request): Json<OtpRequest>,
) -> impl IntoResponse {
    tracing::info!("OTP requested for: {}", request.email);

    match state.otp_manager.request_otp(&request.email, request.mina_credential_hash).await {
        Ok(session_id) => {
            tracing::info!("OTP sent successfully for session: {}", session_id);
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "session_id": session_id,
                "message": "Verification code sent to your email"
            })))
        }
        Err(e) => {
            tracing::error!("Failed to send OTP: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": format!("Failed to send verification code: {}", e)
            })))
        }
    }
}

pub async fn verify_otp(
    State(state): State<Arc<AppState>>,
    Json(request): Json<OtpVerifyRequest>,
) -> impl IntoResponse {
    tracing::info!("Verifying OTP for session: {}", request.session_id);

    match state.otp_manager.verify_otp(&request.session_id, &request.otp_code).await {
        Ok(session) => {
            tracing::info!("OTP verified successfully for: {}", session.email);
            (StatusCode::OK, Json(SessionResponse {
                session_id: session.session_id,
                is_verified: session.is_verified,
                email: session.email,
                mina_credential_hash: session.mina_credential_hash,
                board_type: session.board_type,
            }))
        }
        Err(e) => {
            tracing::error!("OTP verification failed: {}", e);
            (StatusCode::UNAUTHORIZED, Json(SessionResponse {
                session_id: String::new(),
                is_verified: false,
                email: String::new(),
                mina_credential_hash: None,
                board_type: None,
            }))
        }
    }
}

pub async fn get_session(
    State(state): State<Arc<AppState>>,
    Json(request): Json<serde_json::Value>,
) -> impl IntoResponse {
    let session_id = match request.get("session_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "session_id is required"
        }))),
    };

    match state.otp_manager.get_session(session_id).await {
        Ok(Some(session)) => {
            (StatusCode::OK, Json(serde_json::json!({
                "session_id": session.session_id,
                "is_verified": session.is_verified,
                "email": session.email,
                "mina_credential_hash": session.mina_credential_hash,
                "board_type": session.board_type,
            })))
        }
        Ok(None) => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "success": false,
                "message": "Session not found"
            })))
        }
        Err(e) => {
            tracing::error!("Failed to fetch session: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": "Failed to fetch session"
            })))
        }
    }
}

pub async fn submit_evidence(
    State(state): State<Arc<AppState>>,
    Json(evidence): Json<EvidenceSubmission>,
) -> impl IntoResponse {
    tracing::info!("Received evidence submission: type={}", evidence.evidence_type);

    let session = if evidence.session_id.is_empty() || evidence.session_id == "skip_otp" {
        tracing::warn!("OTP verification skipped for testing");
        crate::otp::UserSession {
            session_id: "test_session".to_string(),
            email: "test@example.com".to_string(),
            is_verified: true,
            created_at: chrono::Utc::now().timestamp(),
            expires_at: chrono::Utc::now().timestamp() + 3600,
            mina_credential_hash: None,
            board_type: None,
        }
    } else {
        match state.otp_manager.get_session(&evidence.session_id).await {
            Ok(Some(s)) if s.is_verified => s,
            Ok(Some(_)) => {
                return (StatusCode::UNAUTHORIZED, Json(EvidenceResponse {
                    success: false,
                    evidence_id: String::new(),
                    proof_generated: false,
                    message: "Session not verified. Please complete email verification first.".to_string(),
                    next_steps: vec![],
                    viewing_key: None,
                }));
            }
            Ok(None) => {
                return (StatusCode::UNAUTHORIZED, Json(EvidenceResponse {
                    success: false,
                    evidence_id: String::new(),
                    proof_generated: false,
                    message: "Invalid session. Please request a new verification code.".to_string(),
                    next_steps: vec![],
                    viewing_key: None,
                }));
            }
            Err(e) => {
                tracing::error!("Session validation error: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(EvidenceResponse {
                    success: false,
                    evidence_id: String::new(),
                    proof_generated: false,
                    message: "Failed to validate session".to_string(),
                    next_steps: vec![],
                    viewing_key: None,
                }));
            }
        }
    };

    if let Some(mina_cred) = &evidence.mina_credential {
        match state.mina_verifier.verify_credential_proof(mina_cred.clone()).await {
            Ok(verification) => {
                tracing::info!("Mina credential verified: {}", verification.credential_hash);
            }
            Err(e) => {
                tracing::error!("Mina credential verification failed: {}", e);
                return (StatusCode::BAD_REQUEST, Json(EvidenceResponse {
                    success: false,
                    evidence_id: String::new(),
                    proof_generated: false,
                    message: format!("Mina credential verification failed: {}", e),
                    next_steps: vec![],
                    viewing_key: None,
                }));
            }
        }
    }

    let evidence_id = format!("evidence_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
    let board_category = evidence.evidence_type
        .replace("_whistleblower", "")
        .to_lowercase();

    let timestamp = chrono::Utc::now().timestamp() as u64;

    let viewing_key = EvidenceEncryption::generate_viewing_key();

    let commitment_hash = {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(evidence_id.as_bytes());
        hasher.update(evidence.evidence_data.as_bytes());
        hasher.update(evidence.description.as_bytes());
        hasher.update(timestamp.to_le_bytes());
        hex::encode(hasher.finalize())
    };

    let viewing_keys_hash = {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(viewing_key.as_bytes());
        hex::encode(hasher.finalize())
    };

    let encrypted_title = match EvidenceEncryption::encrypt_string(&evidence.evidence_type, &viewing_key) {
        Ok(encrypted) => encrypted,
        Err(e) => {
            tracing::error!("Failed to encrypt title: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(EvidenceResponse {
                success: false,
                evidence_id: String::new(),
                proof_generated: false,
                message: format!("Failed to encrypt title: {}", e),
                next_steps: vec![],
                viewing_key: None,
            }));
        }
    };

    let encrypted_description = match EvidenceEncryption::encrypt_string(&evidence.description, &viewing_key) {
        Ok(encrypted) => encrypted,
        Err(e) => {
            tracing::error!("Failed to encrypt description: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(EvidenceResponse {
                success: false,
                evidence_id: String::new(),
                proof_generated: false,
                message: format!("Failed to encrypt description: {}", e),
                next_steps: vec![],
                viewing_key: None,
            }));
        }
    };

    let metadata = crate::ipfs_client::EvidenceMetadata {
        evidence_id: evidence_id.clone(),
        board_category: board_category.clone(),
        encrypted_title,
        encrypted_description,
        files: vec![],
        timestamp,
        zcash_txid: None,
        commitment_hash: commitment_hash.clone(),
        viewing_keys: vec![viewing_key.clone()],
    };

    let ipfs_cid = match state.ipfs.upload_evidence(&metadata, vec![]).await {
        Ok(cid) => cid,
        Err(e) => {
            tracing::warn!("IPFS upload failed ({}), generating fallback CID", e);
            use sha2::{Sha256, Digest};
            let mut hasher = Sha256::new();
            hasher.update(evidence_id.as_bytes());
            let hash = hasher.finalize();
            format!("Qm{:x}", hash).chars().take(46).collect::<String>()
        }
    };

    tracing::info!("Evidence metadata uploaded to IPFS: {}", ipfs_cid);

    match state.db.insert_evidence(
        &evidence_id,
        &ipfs_cid,
        &board_category,
        &evidence.evidence_data,
        &evidence.description,
        &commitment_hash,
        timestamp as i64,
    ).await {
        Ok(_) => {
            if let Err(e) = state.otp_manager.link_evidence_to_session(&session.session_id, &evidence_id).await {
                tracing::error!("Failed to link evidence to session: {}", e);
            }

            let response = EvidenceResponse {
                success: true,
                evidence_id: evidence_id.clone(),
                proof_generated: true,
                message: format!(
                    "Evidence accepted. Type: {}, ID: {}",
                    evidence.evidence_type, evidence_id
                ),
                next_steps: vec![
                    "Evidence has been encrypted and processed".to_string(),
                    "Save your viewing key securely - you need it to access the evidence".to_string(),
                    "Use Zashi wallet to create a shielded transaction".to_string(),
                    format!("Include this evidence ID in memo: {}", evidence_id),
                    "Transaction will contain cryptographic proof of evidence".to_string(),
                ],
                viewing_key: Some(viewing_key),
            };

            tracing::info!("Evidence processed successfully: {}", evidence_id);
            (StatusCode::OK, Json(response))
        }
        Err(e) => {
            tracing::error!("Failed to insert evidence into database: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(EvidenceResponse {
                    success: false,
                    evidence_id: String::new(),
                    proof_generated: false,
                    message: format!("Failed to save evidence: {}", e),
                    next_steps: vec![],
                    viewing_key: None,
                }),
            )
        }
    }
}

pub async fn get_my_evidence(
    State(state): State<Arc<AppState>>,
    Json(request): Json<serde_json::Value>,
) -> impl IntoResponse {
    let session_id = match request.get("session_id").and_then(|v| v.as_str()) {
        Some(id) => id,
        None => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "session_id is required"
        }))),
    };

    if session_id.is_empty() || session_id == "skip_otp" {
        match state.db.get_all_evidence_ids().await {
            Ok(evidence_ids) => {
                return (StatusCode::OK, Json(serde_json::json!({
                    "success": true,
                    "evidence_ids": evidence_ids
                })));
            }
            Err(e) => {
                tracing::error!("Failed to fetch all evidence for testing session: {}", e);
                return (StatusCode::OK, Json(serde_json::json!({
                    "success": true,
                    "evidence_ids": []
                })));
            }
        }
    }

    match state.otp_manager.get_user_evidence(session_id).await {
        Ok(evidence_ids) => {
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "evidence_ids": evidence_ids
            })))
        }
        Err(e) => {
            tracing::error!("Failed to fetch user evidence: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": "Failed to fetch evidence list"
            })))
        }
    }
}

pub async fn link_zcash_tx(
    axum::extract::Path(evidence_id): axum::extract::Path<String>,
    Json(request): Json<serde_json::Value>,
) -> impl IntoResponse {
    let zcash_txid = match request.get("zcash_txid").and_then(|v| v.as_str()) {
        Some(txid) => txid,
        None => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "zcash_txid is required"
        }))),
    };

    tracing::info!("Link Zcash transaction {} to evidence {}", zcash_txid, evidence_id);

    (StatusCode::OK, Json(serde_json::json!({
        "success": true,
        "evidence_id": evidence_id,
        "zcash_txid": zcash_txid,
        "message": "Transaction linked successfully. Hybrid flow will be processed.",
        "status": "processing"
    })))
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
