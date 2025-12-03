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
    marketplace::{EvidenceMarketplace, AccessPurpose, VerificationType},
    near_intents::NearIntentsClient,
};

#[derive(Clone)]
pub struct MarketplaceState {
    pub db: Arc<Database>,
    pub marketplace: Arc<EvidenceMarketplace>,
    pub intents_client: Arc<NearIntentsClient>,
    pub near_marketplace: Arc<crate::near_client::NearMarketplaceClient>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateAccessRequestBody {
    pub evidence_id: String,
    pub requester_id: String,
    pub bid_amount: String,
    pub purpose: String,
    pub zk_credentials: Option<String>,
    pub deadline: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateVerificationRequestBody {
    pub evidence_id: String,
    pub verification_type: String,
    pub reward_amount: String,
    pub requirements: Vec<String>,
    pub deadline: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitBidBody {
    pub request_id: String,
    pub solver_id: String,
    pub bid_amount: String,
    pub estimated_completion: String,
    pub credentials: String,
    pub proof_of_capability: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AcceptBidBody {
    pub bid_id: String,
    pub request_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WrapKeyBody {
    pub evidence_id: String,
    pub viewing_key: String,
    pub recipient_public_key: String,
}

pub async fn create_access_request(
    State(state): State<Arc<MarketplaceState>>,
    Json(body): Json<CreateAccessRequestBody>,
) -> impl IntoResponse {
    let bid_amount: u128 = match body.bid_amount.parse() {
        Ok(amt) => amt,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "Invalid bid amount"
        }))),
    };

    let deadline: i64 = match chrono::DateTime::parse_from_rfc3339(&body.deadline) {
        Ok(dt) => dt.timestamp(),
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "Invalid deadline format"
        }))),
    };

    let purpose = match body.purpose.as_str() {
        "journalist_verification" => AccessPurpose::JournalistVerification,
        "ngo_validation" => AccessPurpose::NGOValidation,
        "forensic_analysis" => AccessPurpose::ForensicAnalysis,
        "legal_compliance" => AccessPurpose::LegalCompliance,
        "foia_request" => AccessPurpose::FOIARequest,
        "audit_access" => AccessPurpose::AuditAccess,
        _ => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "Invalid purpose"
        }))),
    };

    let zk_credentials = body.zk_credentials.map(|s| hex::decode(s).ok()).flatten();

    match state.marketplace.create_access_request(
        body.evidence_id,
        body.requester_id,
        bid_amount,
        purpose,
        zk_credentials,
        deadline,
    ).await {
        Ok(request) => {
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "request_id": request.request_id,
                "message": "Access request created successfully"
            })))
        }
        Err(e) => {
            tracing::error!("Failed to create access request: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": format!("Failed to create request: {}", e)
            })))
        }
    }
}

pub async fn create_verification_request(
    State(state): State<Arc<MarketplaceState>>,
    Json(body): Json<CreateVerificationRequestBody>,
) -> impl IntoResponse {
    let reward_amount: u128 = match body.reward_amount.parse() {
        Ok(amt) => amt,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "Invalid reward amount"
        }))),
    };

    let deadline: i64 = match chrono::DateTime::parse_from_rfc3339(&body.deadline) {
        Ok(dt) => dt.timestamp(),
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "Invalid deadline format"
        }))),
    };

    let verification_type = match body.verification_type.as_str() {
        "timestamp_proximity" => VerificationType::TimestampProximity,
        "location_metadata" => VerificationType::LocationMetadata,
        "original_capture" => VerificationType::OriginalCapture,
        "deepfake_detection" => VerificationType::DeepfakeDetection,
        "integrity_check" => VerificationType::IntegrityCheck,
        "cross_chain_signature" => VerificationType::CrossChainSignature,
        "forensic_analysis" => VerificationType::ForensicAnalysis,
        _ => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "Invalid verification type"
        }))),
    };

    // First save to database
    match state.marketplace.create_verification_request(
        body.evidence_id.clone(),
        verification_type,
        reward_amount,
        deadline,
        body.requirements.clone(),
    ).await {
        Ok(request) => {
            // Then call NEAR contract to create on-chain request with escrow
            match state.near_marketplace.create_verification_request(
                body.evidence_id,
                body.verification_type,
                reward_amount,
            ).await {
                Ok(near_request_id) => {
                    tracing::info!("NEAR marketplace request created: {}", near_request_id);
                    (StatusCode::OK, Json(serde_json::json!({
                        "success": true,
                        "request_id": request.request_id,
                        "near_request_id": near_request_id,
                        "message": "Verification request created on NEAR with escrow"
                    })))
                }
                Err(e) => {
                    tracing::error!("Failed to create NEAR marketplace request: {}", e);
                    // Return success for database but warn about NEAR
                    (StatusCode::OK, Json(serde_json::json!({
                        "success": true,
                        "request_id": request.request_id,
                        "near_error": format!("{}", e),
                        "message": "Request created in database, but NEAR transaction failed"
                    })))
                }
            }
        }
        Err(e) => {
            tracing::error!("Failed to create verification request: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": format!("Failed to create request: {}", e)
            })))
        }
    }
}

pub async fn submit_bid(
    State(state): State<Arc<MarketplaceState>>,
    Json(body): Json<SubmitBidBody>,
) -> impl IntoResponse {
    let bid_amount: u128 = match body.bid_amount.parse() {
        Ok(amt) => amt,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "Invalid bid amount"
        }))),
    };

    let estimated_completion: i64 = match chrono::DateTime::parse_from_rfc3339(&body.estimated_completion) {
        Ok(dt) => dt.timestamp(),
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "Invalid estimated completion format"
        }))),
    };

    let credentials = match hex::decode(&body.credentials) {
        Ok(c) => c,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "Invalid credentials format"
        }))),
    };

    let proof_of_capability = match hex::decode(&body.proof_of_capability) {
        Ok(p) => p,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "Invalid proof format"
        }))),
    };

    match state.marketplace.submit_solver_bid(
        body.request_id,
        body.solver_id,
        bid_amount,
        estimated_completion,
        credentials,
        proof_of_capability,
    ).await {
        Ok(bid) => {
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "bid_id": bid.bid_id,
                "message": "Bid submitted successfully"
            })))
        }
        Err(e) => {
            tracing::error!("Failed to submit bid: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": format!("Failed to submit bid: {}", e)
            })))
        }
    }
}

pub async fn accept_bid(
    State(state): State<Arc<MarketplaceState>>,
    Json(body): Json<AcceptBidBody>,
) -> impl IntoResponse {
    match state.marketplace.accept_bid(body.bid_id, body.request_id).await {
        Ok(_) => {
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "message": "Bid accepted successfully"
            })))
        }
        Err(e) => {
            tracing::error!("Failed to accept bid: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": format!("Failed to accept bid: {}", e)
            })))
        }
    }
}

pub async fn get_active_requests(
    State(state): State<Arc<MarketplaceState>>,
    axum::extract::Path(evidence_id): axum::extract::Path<String>,
) -> impl IntoResponse {
    match state.marketplace.get_active_access_requests(&evidence_id).await {
        Ok(requests) => {
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "requests": requests
            })))
        }
        Err(e) => {
            tracing::error!("Failed to get requests: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": format!("Failed to get requests: {}", e)
            })))
        }
    }
}

pub async fn get_verification_requests(
    State(state): State<Arc<MarketplaceState>>,
) -> impl IntoResponse {
    match state.marketplace.get_active_verification_requests().await {
        Ok(requests) => {
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "requests": requests
            })))
        }
        Err(e) => {
            tracing::error!("Failed to get verification requests: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": format!("Failed to get requests: {}", e)
            })))
        }
    }
}

pub async fn get_bids(
    State(state): State<Arc<MarketplaceState>>,
    axum::extract::Path(request_id): axum::extract::Path<String>,
) -> impl IntoResponse {
    match state.marketplace.get_bids_for_request(&request_id).await {
        Ok(bids) => {
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "bids": bids
            })))
        }
        Err(e) => {
            tracing::error!("Failed to get bids: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": format!("Failed to get bids: {}", e)
            })))
        }
    }
}

pub async fn wrap_key(
    State(state): State<Arc<MarketplaceState>>,
    Json(body): Json<WrapKeyBody>,
) -> impl IntoResponse {
    let recipient_public_key = match hex::decode(&body.recipient_public_key) {
        Ok(key) => key,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "success": false,
            "message": "Invalid public key format"
        }))),
    };

    match state.marketplace.wrap_key_for_recipient(
        body.evidence_id.clone(),
        &body.viewing_key,
        recipient_public_key,
    ) {
        Ok(wrapped_key) => {
            if let Err(e) = state.db.store_wrapped_key(&wrapped_key, None).await {
                tracing::error!("Failed to store wrapped key: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                    "success": false,
                    "message": "Failed to store wrapped key"
                })));
            }

            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "encrypted_key": hex::encode(&wrapped_key.encrypted_key),
                "nonce": hex::encode(&wrapped_key.nonce),
                "message": "Key wrapped successfully"
            })))
        }
        Err(e) => {
            tracing::error!("Failed to wrap key: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": format!("Failed to wrap key: {}", e)
            })))
        }
    }
}

pub async fn get_near_request(
    State(state): State<Arc<MarketplaceState>>,
    axum::extract::Path(request_id): axum::extract::Path<String>,
) -> impl IntoResponse {
    match state.near_marketplace.get_request(request_id.clone()).await {
        Ok(Some(request)) => {
            // Also get escrow balance
            match state.near_marketplace.get_escrow_balance(request_id.clone()).await {
                Ok(escrow_balance) => {
                    (StatusCode::OK, Json(serde_json::json!({
                        "success": true,
                        "request": request,
                        "escrow_balance": escrow_balance
                    })))
                }
                Err(_) => {
                    (StatusCode::OK, Json(serde_json::json!({
                        "success": true,
                        "request": request,
                        "escrow_balance": "0"
                    })))
                }
            }
        }
        Ok(None) => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "success": false,
                "message": "Request not found on NEAR"
            })))
        }
        Err(e) => {
            tracing::error!("Failed to get NEAR request: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": format!("Failed to get NEAR request: {}", e)
            })))
        }
    }
}

pub async fn get_near_bids(
    State(state): State<Arc<MarketplaceState>>,
    axum::extract::Path(request_id): axum::extract::Path<String>,
) -> impl IntoResponse {
    match state.near_marketplace.get_bids(request_id).await {
        Ok(bids) => {
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "bids": bids
            })))
        }
        Err(e) => {
            tracing::error!("Failed to get NEAR bids: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "message": format!("Failed to get bids: {}", e)
            })))
        }
    }
}
