use anyhow::{Result, Context, bail};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::db::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSession {
    pub session_id: String,
    pub email: String,
    pub is_verified: bool,
    pub mina_credential_hash: Option<String>,
    pub board_type: Option<u32>,
    pub created_at: i64,
    pub expires_at: i64,
}

pub struct OtpManager {
    db: Arc<Database>,
    resend_api_key: String,
    client: reqwest::Client,
}

impl OtpManager {
    pub fn new(db: Arc<Database>, resend_api_key: String) -> Self {
        Self {
            db,
            resend_api_key,
            client: reqwest::Client::new(),
        }
    }

    pub async fn request_otp(&self, email: &str, mina_credential_hash: Option<String>) -> Result<String> {
        let otp_code = self.generate_otp();
        let session_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();
        let otp_expires_at = now + 600;
        let session_expires_at = now + 86400;

        self.send_otp_email(email, &otp_code).await?;

        self.db.create_user_session(
            &session_id,
            email,
            &otp_code,
            otp_expires_at,
            mina_credential_hash.as_deref(),
            None,
            now,
            session_expires_at,
        ).await?;

        Ok(session_id)
    }

    pub async fn verify_otp(&self, session_id: &str, otp_code: &str) -> Result<UserSession> {
        let session = self.db.get_user_session(session_id).await?
            .ok_or_else(|| anyhow::anyhow!("Session not found"))?;

        let now = chrono::Utc::now().timestamp();

        if session.otp_expires_at < now {
            bail!("OTP expired");
        }

        if session.otp_code != otp_code {
            bail!("Invalid OTP code");
        }

        self.db.mark_session_verified(session_id, now).await?;

        Ok(UserSession {
            session_id: session.session_id.clone(),
            email: session.email.clone(),
            is_verified: true,
            mina_credential_hash: session.mina_credential_hash.clone(),
            board_type: session.board_type.map(|b| b as u32),
            created_at: session.created_at,
            expires_at: session.expires_at,
        })
    }

    pub async fn get_session(&self, session_id: &str) -> Result<Option<UserSession>> {
        let session = self.db.get_user_session(session_id).await?;

        Ok(session.map(|s| {
            let now = chrono::Utc::now().timestamp();
            UserSession {
                session_id: s.session_id.clone(),
                email: s.email.clone(),
                is_verified: s.is_verified == 1 && s.expires_at > now,
                mina_credential_hash: s.mina_credential_hash.clone(),
                board_type: s.board_type.map(|b| b as u32),
                created_at: s.created_at,
                expires_at: s.expires_at,
            }
        }))
    }

    pub async fn link_evidence_to_session(&self, session_id: &str, evidence_id: &str) -> Result<()> {
        self.db.link_evidence_to_session(session_id, evidence_id).await
    }

    pub async fn get_user_evidence(&self, session_id: &str) -> Result<Vec<String>> {
        self.db.get_user_evidence_list(session_id).await
    }

    fn generate_otp(&self) -> String {
        let mut rng = rand::thread_rng();
        format!("{:06}", rng.gen_range(0..1000000))
    }

    async fn send_otp_email(&self, email: &str, otp_code: &str) -> Result<()> {
        let payload = serde_json::json!({
            "from": "ZKFIED <onboarding@resend.dev>",
            "to": [email],
            "subject": "Your ZKFIED Verification Code",
            "html": format!(
                "<h2>Your verification code is: <strong>{}</strong></h2><p>This code will expire in 10 minutes.</p><p>If you didn't request this code, please ignore this email.</p>",
                otp_code
            )
        });

        let response = self.client
            .post("https://api.resend.com/emails")
            .header("Authorization", format!("Bearer {}", self.resend_api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .context("Failed to send email via Resend")?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            bail!("Failed to send OTP email: {}", error_text);
        }

        Ok(())
    }
}
