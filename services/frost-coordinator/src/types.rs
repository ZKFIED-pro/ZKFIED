use serde::{Deserialize, Serialize};
use thiserror::Error;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("FROST error: {0}")]
    Frost(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, msg),
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            ApiError::Frost(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            ApiError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };
        (status, Json(json!({"error": message}))).into_response()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BoardCategory {
    Government,
    Healthcare,
    Corporate,
    Media,
    Environment,
    Legal,
    Education,
    CivilSociety,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardMember {
    pub id: String,
    pub organization: String,
    pub public_key: Vec<u8>,
    pub participant_id: u16,
}


#[derive(Debug, Deserialize)]
pub struct CreateBoardMemberRequest {
    pub id: String,
    pub organization: String,
    pub public_key_hex: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateBoardRequest {
    pub category: BoardCategory,
    pub threshold: u16,
    pub members: Vec<CreateBoardMemberRequest>,
}

#[derive(Debug, Serialize)]
pub struct CreateBoardResponse {
    pub board_id: String,
    pub group_public_key_hex: String,
    pub members: Vec<BoardMember>,
}

#[derive(Debug, Deserialize)]
pub struct InitSigningRequest {
    pub board_id: String,
    pub message_hex: String,
    pub whistleblower_pseudonym: String,
    pub expiry_timestamp: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct InitSigningResponse {
    pub request_id: String,
    pub threshold: u16,
    pub participants_count: u16,
}

#[derive(Debug, Deserialize)]
pub struct SubmitCommitmentRequest {
    pub request_id: String,
    pub participant_id: u16,
    pub commitment_hex: String,
}

#[derive(Debug, Serialize)]
pub struct SubmitCommitmentResponse {
    pub commitments_received: u16,
}

#[derive(Debug, Deserialize)]
pub struct SubmitSignatureShareRequest {
    pub request_id: String,
    pub participant_id: u16,
    pub signature_share_hex: String,
}

#[derive(Debug, Serialize)]
pub struct SubmitSignatureShareResponse {
    pub shares_received: u16,
}

#[derive(Debug, Deserialize)]
pub struct AggregateSignatureRequest {
    pub request_id: String,
}

#[derive(Debug, Serialize)]
pub struct AggregateSignatureResponse {
    pub signature_hex: String,
    pub signing_participants: Vec<u16>,
    pub verified: bool,
}

#[derive(Debug, Deserialize)]
pub struct SubmitReportRequest {
    pub board_id: String,
    pub ipfs_cid: String,
    pub commitment_hash_hex: String,
    pub request_id: String,
}

#[derive(Debug, Serialize)]
pub struct SubmitReportResponse {
    pub report_id: String,
    pub board_id: String,
    pub created_at: u64,
}

#[derive(Debug, Deserialize)]
pub struct GetReportsRequest {
    pub board_id: String,
}

#[derive(Debug, Serialize)]
pub struct GetReportsResponse {
    pub reports: Vec<ReportSummary>,
}

#[derive(Debug, Serialize)]
pub struct ReportSummary {
    pub report_id: String,
    pub ipfs_cid: String,
    pub created_at: u64,
}
