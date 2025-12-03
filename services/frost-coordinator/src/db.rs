use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use sqlx::Row;
use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};

pub struct Database {
    pool: SqlitePool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceSubmission {
    pub id: i64,
    pub evidence_id: String,
    pub zcash_txid: Option<String>,
    pub ipfs_cid: String,
    pub board_category: String,
    pub title: String,
    pub description: String,
    pub commitment_hash: String,
    pub block_height: Option<i64>,
    pub submission_timestamp: i64,
    pub status: String,
    pub confirmation_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrostSigningSession {
    pub id: i64,
    pub session_id: String,
    pub evidence_id: String,
    pub threshold: i64,
    pub min_signers: i64,
    pub max_signers: i64,
    pub current_round: i64,
    pub status: String,
    pub group_commitment: Option<String>,
    pub signature: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrostParticipant {
    pub id: i64,
    pub session_id: String,
    pub participant_id: i64,
    pub public_key: String,
    pub round1_commitment: Option<String>,
    pub round2_signature_share: Option<String>,
    pub status: String,
    pub joined_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpfsPin {
    pub id: i64,
    pub cid: String,
    pub evidence_id: Option<String>,
    pub content_type: String,
    pub size_bytes: Option<i64>,
    pub pinned_at: String,
    pub verified_at: Option<String>,
    pub pin_service: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NearCrossPost {
    pub id: i64,
    pub evidence_id: String,
    pub near_tx_hash: String,
    pub contract_id: String,
    pub method_name: String,
    pub block_height: Option<i64>,
    pub status: String,
    pub posted_at: String,
    pub confirmed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceCommitment {
    pub id: i64,
    pub evidence_id: String,
    pub ipfs_cid: String,
    pub board_id: String,
    pub commitment_hash: Vec<u8>,
    pub timestamp: i64,
    pub zcash_txid: Option<String>,
    pub zcash_block_height: Option<i64>,
    pub near_txid: Option<String>,
    pub near_block_height: Option<i64>,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MinaCredentialProofRecord {
    pub id: i64,
    pub credential_hash: String,
    pub holder_public_key: String,
    pub credential_type: i64,
    pub timestamp: i64,
    pub proof_data: String,
    pub board_type: i64,
    pub is_revoked: i64,
    pub verified_at: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrostAuthorizationRecord {
    pub id: i64,
    pub authorization_id: String,
    pub credential_hash: String,
    pub board_type: i64,
    pub frost_signature: Vec<u8>,
    pub authorized_at: i64,
    pub expires_at: Option<i64>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSessionRecord {
    pub id: i64,
    pub session_id: String,
    pub email: String,
    pub otp_code: String,
    pub otp_expires_at: i64,
    pub is_verified: i64,
    pub mina_credential_hash: Option<String>,
    pub board_type: Option<i64>,
    pub created_at: i64,
    pub verified_at: Option<i64>,
    pub expires_at: i64,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        // Add mode=rwc for SQLite URLs (r=read, w=write, c=create)
        let url = if database_url.starts_with("sqlite://") {
            if database_url.contains('?') {
                format!("{}&mode=rwc", database_url)
            } else {
                format!("{}?mode=rwc", database_url)
            }
        } else {
            database_url.to_string()
        };

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&url)
            .await
            .context("Failed to create database connection pool")?;

        tracing::info!("Database pool created: {}", database_url);

        Ok(Self { pool })
    }

    pub async fn migrate(&self) -> Result<()> {
        tracing::info!("Running database migrations...");

        sqlx::migrate!("./migrations")
            .run(&self.pool)
            .await
            .context("Failed to run migrations")?;

        tracing::info!("Migrations completed successfully");

        Ok(())
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }


    pub async fn insert_evidence(
        &self,
        evidence_id: &str,
        ipfs_cid: &str,
        board_category: &str,
        title: &str,
        description: &str,
        commitment_hash: &str,
        submission_timestamp: i64,
    ) -> Result<i64> {
        let result = sqlx::query(
            r#"
            INSERT INTO evidence_submissions
            (evidence_id, ipfs_cid, board_category, title, description, commitment_hash, submission_timestamp, status)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending')
            "#
        )
        .bind(evidence_id)
        .bind(ipfs_cid)
        .bind(board_category)
        .bind(title)
        .bind(description)
        .bind(commitment_hash)
        .bind(submission_timestamp)
        .execute(&self.pool)
        .await
        .context("Failed to insert evidence submission")?;

        let id = result.last_insert_rowid();

        tracing::info!("Evidence submission inserted: {} (id: {})", evidence_id, id);

        Ok(id)
    }

    pub async fn update_evidence_txid(
        &self,
        evidence_id: &str,
        zcash_txid: &str,
        status: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE evidence_submissions
            SET zcash_txid = ?1, status = ?2, updated_at = CURRENT_TIMESTAMP
            WHERE evidence_id = ?3
            "#
        )
        .bind(zcash_txid)
        .bind(status)
        .bind(evidence_id)
        .execute(&self.pool)
        .await
        .context("Failed to update evidence txid")?;

        tracing::info!("Evidence {} updated: txid={}, status={}", evidence_id, zcash_txid, status);

        Ok(())
    }

    pub async fn update_evidence_confirmations(
        &self,
        evidence_id: &str,
        confirmation_count: i64,
        block_height: i64,
    ) -> Result<()> {
        let status = if confirmation_count >= 10 { "confirmed" } else { "broadcasting" };

        sqlx::query(
            r#"
            UPDATE evidence_submissions
            SET confirmation_count = ?1, block_height = ?2, status = ?3, updated_at = CURRENT_TIMESTAMP
            WHERE evidence_id = ?4
            "#
        )
        .bind(confirmation_count)
        .bind(block_height)
        .bind(status)
        .bind(evidence_id)
        .execute(&self.pool)
        .await
        .context("Failed to update evidence confirmations")?;

        tracing::debug!("Evidence {} confirmations: {} (height: {})", evidence_id, confirmation_count, block_height);

        Ok(())
    }

    pub async fn get_evidence(&self, evidence_id: &str) -> Result<Option<EvidenceSubmission>> {
        let record = sqlx::query_as::<_, EvidenceSubmission>(
            r#"
            SELECT id, evidence_id, zcash_txid, ipfs_cid, board_category, title, description,
                   commitment_hash, block_height, submission_timestamp, status, confirmation_count,
                   created_at, updated_at
            FROM evidence_submissions
            WHERE evidence_id = ?1
            "#
        )
        .bind(evidence_id)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to fetch evidence submission")?;

        Ok(record)
    }

    pub async fn get_evidence_by_status(&self, status: &str) -> Result<Vec<EvidenceSubmission>> {
        let records = sqlx::query_as::<_, EvidenceSubmission>(
            r#"
            SELECT id, evidence_id, zcash_txid, ipfs_cid, board_category, title, description,
                   commitment_hash, block_height, submission_timestamp, status, confirmation_count,
                   created_at, updated_at
            FROM evidence_submissions
            WHERE status = ?1
            ORDER BY submission_timestamp DESC
            "#
        )
        .bind(status)
        .fetch_all(&self.pool)
        .await
        .context("Failed to fetch evidence by status")?;

        Ok(records)
    }

    pub async fn get_evidence_by_category(&self, category: &str) -> Result<Vec<EvidenceSubmission>> {
        let records = sqlx::query_as::<_, EvidenceSubmission>(
            r#"
            SELECT id, evidence_id, zcash_txid, ipfs_cid, board_category, title, description,
                   commitment_hash, block_height, submission_timestamp, status, confirmation_count,
                   created_at, updated_at
            FROM evidence_submissions
            WHERE board_category = ?1
            ORDER BY submission_timestamp DESC
            "#
        )
        .bind(category)
        .fetch_all(&self.pool)
        .await
        .context("Failed to fetch evidence by category")?;

        Ok(records)
    }


    pub async fn create_frost_session(
        &self,
        session_id: &str,
        evidence_id: &str,
        threshold: i64,
        min_signers: i64,
        max_signers: i64,
    ) -> Result<i64> {
        let result = sqlx::query(
            r#"
            INSERT INTO frost_signing_sessions
            (session_id, evidence_id, threshold, min_signers, max_signers, status, current_round)
            VALUES (?1, ?2, ?3, ?4, ?5, 'initializing', 1)
            "#
        )
        .bind(session_id)
        .bind(evidence_id)
        .bind(threshold)
        .bind(min_signers)
        .bind(max_signers)
        .execute(&self.pool)
        .await
        .context("Failed to create FROST signing session")?;

        let id = result.last_insert_rowid();

        tracing::info!("FROST session created: {} (id: {})", session_id, id);

        Ok(id)
    }

    pub async fn update_frost_session_status(
        &self,
        session_id: &str,
        status: &str,
        current_round: i64,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE frost_signing_sessions
            SET status = ?1, current_round = ?2
            WHERE session_id = ?3
            "#
        )
        .bind(status)
        .bind(current_round)
        .bind(session_id)
        .execute(&self.pool)
        .await
        .context("Failed to update FROST session status")?;

        tracing::debug!("FROST session {} updated: status={}, round={}", session_id, status, current_round);

        Ok(())
    }

    pub async fn store_frost_signature(
        &self,
        session_id: &str,
        group_commitment: &str,
        signature: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE frost_signing_sessions
            SET group_commitment = ?1, signature = ?2, status = 'completed', completed_at = CURRENT_TIMESTAMP
            WHERE session_id = ?3
            "#
        )
        .bind(group_commitment)
        .bind(signature)
        .bind(session_id)
        .execute(&self.pool)
        .await
        .context("Failed to store FROST signature")?;

        tracing::info!("FROST session {} completed with signature", session_id);

        Ok(())
    }

    pub async fn get_frost_session(&self, session_id: &str) -> Result<Option<FrostSigningSession>> {
        let record = sqlx::query_as::<_, FrostSigningSession>(
            r#"
            SELECT id, session_id, evidence_id, threshold, min_signers, max_signers,
                   current_round, status, group_commitment, signature, created_at, completed_at
            FROM frost_signing_sessions
            WHERE session_id = ?1
            "#
        )
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to fetch FROST session")?;

        Ok(record)
    }


    pub async fn add_frost_participant(
        &self,
        session_id: &str,
        participant_id: i64,
        public_key: &str,
    ) -> Result<i64> {
        let result = sqlx::query(
            r#"
            INSERT INTO frost_participants
            (session_id, participant_id, public_key, status)
            VALUES (?1, ?2, ?3, 'joined')
            "#
        )
        .bind(session_id)
        .bind(participant_id)
        .bind(public_key)
        .execute(&self.pool)
        .await
        .context("Failed to add FROST participant")?;

        let id = result.last_insert_rowid();

        tracing::debug!("Participant {} added to FROST session {}", participant_id, session_id);

        Ok(id)
    }

    pub async fn update_participant_round1(
        &self,
        session_id: &str,
        participant_id: i64,
        commitment: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE frost_participants
            SET round1_commitment = ?1, status = 'round1_complete'
            WHERE session_id = ?2 AND participant_id = ?3
            "#
        )
        .bind(commitment)
        .bind(session_id)
        .bind(participant_id)
        .execute(&self.pool)
        .await
        .context("Failed to update participant Round 1")?;

        tracing::debug!("Participant {} Round 1 complete in session {}", participant_id, session_id);

        Ok(())
    }

    pub async fn update_participant_round2(
        &self,
        session_id: &str,
        participant_id: i64,
        signature_share: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE frost_participants
            SET round2_signature_share = ?1, status = 'round2_complete'
            WHERE session_id = ?2 AND participant_id = ?3
            "#
        )
        .bind(signature_share)
        .bind(session_id)
        .bind(participant_id)
        .execute(&self.pool)
        .await
        .context("Failed to update participant Round 2")?;

        tracing::debug!("Participant {} Round 2 complete in session {}", participant_id, session_id);

        Ok(())
    }

    pub async fn get_session_participants(&self, session_id: &str) -> Result<Vec<FrostParticipant>> {
        let records = sqlx::query_as::<_, FrostParticipant>(
            r#"
            SELECT id, session_id, participant_id, public_key, round1_commitment,
                   round2_signature_share, status, joined_at
            FROM frost_participants
            WHERE session_id = ?1
            ORDER BY participant_id ASC
            "#
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await
        .context("Failed to fetch session participants")?;

        Ok(records)
    }


    pub async fn record_ipfs_pin(
        &self,
        cid: &str,
        evidence_id: Option<&str>,
        content_type: &str,
        size_bytes: Option<i64>,
        pin_service: &str,
    ) -> Result<i64> {
        tracing::debug!("Recording IPFS pin: cid={}, evidence_id={:?}, content_type={}, size_bytes={:?}, pin_service={}",
            cid, evidence_id, content_type, size_bytes, pin_service);

        let result = sqlx::query(
            r#"
            INSERT INTO ipfs_pins
            (cid, evidence_id, content_type, size_bytes, pin_service)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#
        )
        .bind(cid)
        .bind(evidence_id)
        .bind(content_type)
        .bind(size_bytes)
        .bind(pin_service)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            tracing::error!("SQL error in record_ipfs_pin: {:?}", e);
            e
        })
        .context("Failed to record IPFS pin")?;

        let id = result.last_insert_rowid();

        tracing::debug!("IPFS pin recorded: {} (service: {})", cid, pin_service);

        Ok(id)
    }

    pub async fn verify_ipfs_pin(&self, cid: &str) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE ipfs_pins
            SET verified_at = CURRENT_TIMESTAMP
            WHERE cid = ?1
            "#
        )
        .bind(cid)
        .execute(&self.pool)
        .await
        .context("Failed to verify IPFS pin")?;

        tracing::debug!("IPFS pin verified: {}", cid);

        Ok(())
    }

    pub async fn get_evidence_pins(&self, evidence_id: &str) -> Result<Vec<IpfsPin>> {
        let records = sqlx::query_as::<_, IpfsPin>(
            r#"
            SELECT id, cid, evidence_id, content_type, size_bytes, pinned_at, verified_at, pin_service
            FROM ipfs_pins
            WHERE evidence_id = ?1
            ORDER BY pinned_at DESC
            "#
        )
        .bind(evidence_id)
        .fetch_all(&self.pool)
        .await
        .context("Failed to fetch evidence pins")?;

        Ok(records)
    }


    pub async fn record_near_post(
        &self,
        evidence_id: &str,
        near_tx_hash: &str,
        contract_id: &str,
        method_name: &str,
    ) -> Result<i64> {
        let result = sqlx::query(
            r#"
            INSERT INTO near_cross_posts
            (evidence_id, near_tx_hash, contract_id, method_name, status)
            VALUES (?1, ?2, ?3, ?4, 'pending')
            "#
        )
        .bind(evidence_id)
        .bind(near_tx_hash)
        .bind(contract_id)
        .bind(method_name)
        .execute(&self.pool)
        .await
        .context("Failed to record NEAR post")?;

        let id = result.last_insert_rowid();

        tracing::info!("NEAR cross-post recorded: {} -> {}", evidence_id, near_tx_hash);

        Ok(id)
    }

    pub async fn confirm_near_post(
        &self,
        near_tx_hash: &str,
        block_height: i64,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE near_cross_posts
            SET status = 'confirmed', block_height = ?1, confirmed_at = CURRENT_TIMESTAMP
            WHERE near_tx_hash = ?2
            "#
        )
        .bind(block_height)
        .bind(near_tx_hash)
        .execute(&self.pool)
        .await
        .context("Failed to confirm NEAR post")?;

        tracing::info!("NEAR post confirmed: {} at height {}", near_tx_hash, block_height);

        Ok(())
    }

    pub async fn get_evidence_near_posts(&self, evidence_id: &str) -> Result<Vec<NearCrossPost>> {
        let records = sqlx::query_as::<_, NearCrossPost>(
            r#"
            SELECT id, evidence_id, near_tx_hash, contract_id, method_name,
                   block_height, status, posted_at, confirmed_at
            FROM near_cross_posts
            WHERE evidence_id = ?1
            ORDER BY posted_at DESC
            "#
        )
        .bind(evidence_id)
        .fetch_all(&self.pool)
        .await
        .context("Failed to fetch evidence NEAR posts")?;

        Ok(records)
    }


    pub async fn insert_evidence_commitment(
        &self,
        evidence_id: &str,
        ipfs_cid: &str,
        board_id: &str,
        commitment_hash: &[u8],
        timestamp: i64,
    ) -> Result<i64> {
        let now = chrono::Utc::now().timestamp();
        let result = sqlx::query(
            r#"
            INSERT INTO evidence_commitments
            (evidence_id, ipfs_cid, board_id, commitment_hash, timestamp, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#
        )
        .bind(evidence_id)
        .bind(ipfs_cid)
        .bind(board_id)
        .bind(commitment_hash)
        .bind(timestamp)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .context("Failed to insert evidence commitment")?;

        let id = result.last_insert_rowid();
        tracing::info!("Evidence commitment inserted: {} (id: {})", evidence_id, id);
        Ok(id)
    }

    pub async fn update_commitment_zcash_tx(
        &self,
        evidence_id: &str,
        zcash_txid: &str,
        block_height: i64,
    ) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE evidence_commitments
            SET zcash_txid = ?1, zcash_block_height = ?2, updated_at = ?3
            WHERE evidence_id = ?4
            "#
        )
        .bind(zcash_txid)
        .bind(block_height)
        .bind(now)
        .bind(evidence_id)
        .execute(&self.pool)
        .await
        .context("Failed to update commitment Zcash tx")?;

        tracing::info!("Commitment Zcash tx updated: {} -> {}", evidence_id, zcash_txid);
        Ok(())
    }

    pub async fn update_commitment_near_tx(
        &self,
        evidence_id: &str,
        near_txid: &str,
        block_height: i64,
    ) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE evidence_commitments
            SET near_txid = ?1, near_block_height = ?2, status = 'registered', updated_at = ?3
            WHERE evidence_id = ?4
            "#
        )
        .bind(near_txid)
        .bind(block_height)
        .bind(now)
        .bind(evidence_id)
        .execute(&self.pool)
        .await
        .context("Failed to update commitment NEAR tx")?;

        tracing::info!("Commitment NEAR tx updated: {} -> {}", evidence_id, near_txid);
        Ok(())
    }

    pub async fn get_commitment_by_evidence_id(&self, evidence_id: &str) -> Result<Option<EvidenceCommitment>> {
        let record = sqlx::query_as::<_, EvidenceCommitment>(
            r#"
            SELECT id, evidence_id, ipfs_cid, board_id, commitment_hash, timestamp,
                   zcash_txid, zcash_block_height, near_txid, near_block_height,
                   status, created_at, updated_at
            FROM evidence_commitments
            WHERE evidence_id = ?1
            "#
        )
        .bind(evidence_id)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to fetch evidence commitment")?;

        Ok(record)
    }

    pub async fn get_commitments_by_board(&self, board_id: &str) -> Result<Vec<EvidenceCommitment>> {
        let records = sqlx::query_as::<_, EvidenceCommitment>(
            r#"
            SELECT id, evidence_id, ipfs_cid, board_id, commitment_hash, timestamp,
                   zcash_txid, zcash_block_height, near_txid, near_block_height,
                   status, created_at, updated_at
            FROM evidence_commitments
            WHERE board_id = ?1
            ORDER BY timestamp DESC
            "#
        )
        .bind(board_id)
        .fetch_all(&self.pool)
        .await
        .context("Failed to fetch board commitments")?;

        Ok(records)
    }

    pub async fn get_stats(&self) -> Result<DatabaseStats> {
        let row = sqlx::query(
            r#"
            SELECT
                (SELECT COUNT(*) FROM evidence_submissions) as total_evidence,
                (SELECT COUNT(*) FROM evidence_submissions WHERE status = 'confirmed') as confirmed_evidence,
                (SELECT COUNT(*) FROM frost_signing_sessions) as total_sessions,
                (SELECT COUNT(*) FROM frost_signing_sessions WHERE status = 'completed') as completed_sessions,
                (SELECT COUNT(*) FROM ipfs_pins) as total_pins,
                (SELECT COUNT(*) FROM near_cross_posts) as total_near_posts
            "#
        )
        .fetch_one(&self.pool)
        .await
        .context("Failed to fetch database stats")?;

        Ok(DatabaseStats {
            total_evidence: row.get(0),
            confirmed_evidence: row.get(1),
            total_sessions: row.get(2),
            completed_sessions: row.get(3),
            total_pins: row.get(4),
            total_near_posts: row.get(5),
        })
    }

    pub async fn store_mina_credential_proof(
        &self,
        credential_hash: &str,
        holder_public_key: &str,
        credential_type: u32,
        timestamp: u64,
        proof_data: &str,
        board_type: u32,
    ) -> Result<i64> {
        let now = chrono::Utc::now().timestamp();
        let result = sqlx::query(
            r#"
            INSERT INTO mina_credential_proofs
            (credential_hash, holder_public_key, credential_type, timestamp, proof_data, board_type, verified_at, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#
        )
        .bind(credential_hash)
        .bind(holder_public_key)
        .bind(credential_type as i64)
        .bind(timestamp as i64)
        .bind(proof_data)
        .bind(board_type as i64)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .context("Failed to store Mina credential proof")?;

        let id = result.last_insert_rowid();
        tracing::info!("Mina credential proof stored: {} (id: {})", credential_hash, id);
        Ok(id)
    }

    pub async fn get_mina_credential_proof(
        &self,
        credential_hash: &str,
    ) -> Result<Option<MinaCredentialProofRecord>> {
        let record = sqlx::query_as::<_, MinaCredentialProofRecord>(
            r#"
            SELECT id, credential_hash, holder_public_key, credential_type, timestamp,
                   proof_data, board_type, is_revoked, verified_at, created_at
            FROM mina_credential_proofs
            WHERE credential_hash = ?1
            "#
        )
        .bind(credential_hash)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to fetch Mina credential proof")?;

        Ok(record)
    }

    pub async fn store_frost_authorization(
        &self,
        authorization_id: &str,
        credential_hash: &str,
        board_type: u32,
        frost_signature: &[u8],
        expires_at: Option<i64>,
    ) -> Result<i64> {
        let now = chrono::Utc::now().timestamp();
        let result = sqlx::query(
            r#"
            INSERT INTO frost_authorizations
            (authorization_id, credential_hash, board_type, frost_signature, authorized_at, expires_at, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#
        )
        .bind(authorization_id)
        .bind(credential_hash)
        .bind(board_type as i64)
        .bind(frost_signature)
        .bind(now)
        .bind(expires_at)
        .bind(now)
        .execute(&self.pool)
        .await
        .context("Failed to store FROST authorization")?;

        let id = result.last_insert_rowid();
        tracing::info!("FROST authorization stored: {} for credential {}", authorization_id, credential_hash);
        Ok(id)
    }

    pub async fn get_frost_authorization(
        &self,
        credential_hash: &str,
    ) -> Result<Option<FrostAuthorizationRecord>> {
        let record = sqlx::query_as::<_, FrostAuthorizationRecord>(
            r#"
            SELECT id, authorization_id, credential_hash, board_type, frost_signature,
                   authorized_at, expires_at, created_at
            FROM frost_authorizations
            WHERE credential_hash = ?1
            ORDER BY authorized_at DESC
            LIMIT 1
            "#
        )
        .bind(credential_hash)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to fetch FROST authorization")?;

        Ok(record)
    }

    pub async fn store_payment_disclosure(&self, evidence_id: &str, disclosure_hex: &str) -> Result<()> {
        sqlx::query(
            "UPDATE evidence_submissions
             SET payment_disclosure = ?, updated_at = CURRENT_TIMESTAMP
             WHERE evidence_id = ?"
        )
        .bind(disclosure_hex)
        .bind(evidence_id)
        .execute(&self.pool)
        .await
        .context("Failed to store payment disclosure")?;

        Ok(())
    }

    pub async fn update_evidence_status(&self, evidence_id: &str, status: &str) -> Result<()> {
        sqlx::query(
            "UPDATE evidence_submissions
             SET status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE evidence_id = ?"
        )
        .bind(status)
        .bind(evidence_id)
        .execute(&self.pool)
        .await
        .context("Failed to update evidence status")?;

        Ok(())
    }

    pub async fn get_frost_signatures_for_evidence(&self, evidence_id: &str) -> Result<Vec<(u16, Vec<u8>)>> {
        let session_id = format!("frost_{}", evidence_id);

        let participants = sqlx::query_as::<_, FrostParticipant>(
            "SELECT * FROM frost_participants WHERE session_id = ? AND round2_signature_share IS NOT NULL"
        )
        .bind(&session_id)
        .fetch_all(&self.pool)
        .await
        .context("Failed to fetch FROST participants")?;

        let mut signatures = Vec::new();
        for participant in participants {
            if let Some(sig_hex) = participant.round2_signature_share {
                let sig_bytes = hex::decode(&sig_hex)
                    .context("Failed to decode signature share")?;
                signatures.push((participant.participant_id as u16, sig_bytes));
            }
        }

        Ok(signatures)
    }

    pub async fn get_payment_disclosure(&self, evidence_id: &str) -> Result<Option<String>> {
        let result = sqlx::query(
            "SELECT payment_disclosure FROM evidence_submissions WHERE evidence_id = ?"
        )
        .bind(evidence_id)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to fetch payment disclosure")?;

        Ok(result.and_then(|row| row.try_get("payment_disclosure").ok()))
    }

    pub async fn update_evidence_hybrid_flow(
        &self,
        evidence_id: &str,
        submission_type: &str,
        frost_signature_count: i64,
        registration_path: &str,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE evidence_submissions
             SET submission_type = ?, frost_signature_count = ?, registration_path = ?, updated_at = CURRENT_TIMESTAMP
             WHERE evidence_id = ?"
        )
        .bind(submission_type)
        .bind(frost_signature_count)
        .bind(registration_path)
        .bind(evidence_id)
        .execute(&self.pool)
        .await
        .context("Failed to update evidence hybrid flow")?;

        Ok(())
    }

    pub async fn insert_hybrid_flow_log(
        &self,
        evidence_id: &str,
        flow_stage: &str,
        signature_count: Option<i64>,
        details: Option<&str>,
    ) -> Result<()> {
        sqlx::query(
            "INSERT INTO hybrid_flow_log (evidence_id, flow_stage, signature_count, details)
             VALUES (?1, ?2, ?3, ?4)"
        )
        .bind(evidence_id)
        .bind(flow_stage)
        .bind(signature_count)
        .bind(details)
        .execute(&self.pool)
        .await
        .context("Failed to insert hybrid flow log")?;

        Ok(())
    }

    pub async fn get_frost_signature_count(&self, evidence_id: &str) -> Result<i64> {
        let session_id = format!("frost_{}", evidence_id);

        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM frost_participants
             WHERE session_id = ? AND round2_signature_share IS NOT NULL"
        )
        .bind(&session_id)
        .fetch_one(&self.pool)
        .await
        .context("Failed to get FROST signature count")?;

        Ok(count)
    }

    pub async fn update_frost_session_threshold_status(
        &self,
        session_id: &str,
        collected_signatures: i64,
        threshold_met: bool,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE frost_signing_sessions
             SET collected_signatures = ?, threshold_met = ?
             WHERE session_id = ?"
        )
        .bind(collected_signatures)
        .bind(threshold_met)
        .bind(session_id)
        .execute(&self.pool)
        .await
        .context("Failed to update FROST session threshold status")?;

        Ok(())
    }

    pub async fn create_user_session(
        &self,
        session_id: &str,
        email: &str,
        otp_code: &str,
        otp_expires_at: i64,
        mina_credential_hash: Option<&str>,
        board_type: Option<i64>,
        created_at: i64,
        expires_at: i64,
    ) -> Result<()> {
        sqlx::query(
            "INSERT INTO user_sessions
             (session_id, email, otp_code, otp_expires_at, mina_credential_hash, board_type, created_at, expires_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
        )
        .bind(session_id)
        .bind(email)
        .bind(otp_code)
        .bind(otp_expires_at)
        .bind(mina_credential_hash)
        .bind(board_type)
        .bind(created_at)
        .bind(expires_at)
        .execute(&self.pool)
        .await
        .context("Failed to create user session")?;

        Ok(())
    }

    pub async fn get_user_session(&self, session_id: &str) -> Result<Option<UserSessionRecord>> {
        let session = sqlx::query_as::<_, UserSessionRecord>(
            "SELECT * FROM user_sessions WHERE session_id = ?"
        )
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to get user session")?;

        Ok(session)
    }

    pub async fn mark_session_verified(&self, session_id: &str, verified_at: i64) -> Result<()> {
        sqlx::query(
            "UPDATE user_sessions
             SET is_verified = 1, verified_at = ?
             WHERE session_id = ?"
        )
        .bind(verified_at)
        .bind(session_id)
        .execute(&self.pool)
        .await
        .context("Failed to mark session as verified")?;

        Ok(())
    }

    pub async fn link_evidence_to_session(&self, session_id: &str, evidence_id: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp();

        sqlx::query(
            "INSERT INTO user_evidence (session_id, evidence_id, created_at)
             VALUES (?1, ?2, ?3)"
        )
        .bind(session_id)
        .bind(evidence_id)
        .bind(now)
        .execute(&self.pool)
        .await
        .context("Failed to link evidence to session")?;

        Ok(())
    }

    pub async fn get_user_evidence_list(&self, session_id: &str) -> Result<Vec<String>> {
        let evidence_ids = sqlx::query_scalar::<_, String>(
            "SELECT evidence_id FROM user_evidence WHERE session_id = ? ORDER BY created_at DESC"
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await
        .context("Failed to get user evidence list")?;

        Ok(evidence_ids)
    }

    pub async fn get_all_evidence_ids(&self) -> Result<Vec<String>> {
        let evidence_ids = sqlx::query_scalar::<_, String>(
            "SELECT evidence_id FROM evidence_submissions ORDER BY submission_timestamp DESC"
        )
        .fetch_all(&self.pool)
        .await
        .context("Failed to get all evidence IDs")?;

        Ok(evidence_ids)
    }

    pub async fn insert_access_request(&self, request: &crate::marketplace::AccessRequest) -> Result<()> {
        let purpose_str = serde_json::to_string(&request.purpose)?;

        sqlx::query(
            "INSERT INTO access_requests (request_id, evidence_id, requester_id, bid_amount, purpose, zk_credentials, deadline, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&request.request_id)
        .bind(&request.evidence_id)
        .bind(&request.requester_id)
        .bind(request.bid_amount as i64)
        .bind(purpose_str)
        .bind(request.zk_credentials.as_ref())
        .bind(request.deadline)
        .bind(format!("{:?}", request.status))
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn insert_verification_request(&self, request: &crate::marketplace::VerificationRequest) -> Result<()> {
        let verification_type_str = serde_json::to_string(&request.verification_type)?;
        let requirements_str = serde_json::to_string(&request.requirements)?;

        sqlx::query(
            "INSERT INTO verification_requests (request_id, evidence_id, verification_type, reward_amount, deadline, requirements)
             VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&request.request_id)
        .bind(&request.evidence_id)
        .bind(verification_type_str)
        .bind(request.reward_amount as i64)
        .bind(request.deadline)
        .bind(requirements_str)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn insert_solver_bid(&self, bid: &crate::marketplace::SolverBid) -> Result<()> {
        sqlx::query(
            "INSERT INTO solver_bids (bid_id, request_id, solver_id, bid_amount, estimated_completion, credentials, proof_of_capability)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&bid.bid_id)
        .bind(&bid.request_id)
        .bind(&bid.solver_id)
        .bind(bid.bid_amount as i64)
        .bind(bid.estimated_completion)
        .bind(&bid.credentials)
        .bind(&bid.proof_of_capability)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn update_access_request_status(&self, request_id: &str, status: crate::marketplace::RequestStatus) -> Result<()> {
        sqlx::query(
            "UPDATE access_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?"
        )
        .bind(format!("{:?}", status))
        .bind(request_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn mark_bid_accepted(&self, bid_id: &str) -> Result<()> {
        sqlx::query(
            "UPDATE solver_bids SET status = 'Accepted' WHERE bid_id = ?"
        )
        .bind(bid_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_access_requests_by_evidence(&self, evidence_id: &str) -> Result<Vec<crate::marketplace::AccessRequest>> {
        let rows = sqlx::query(
            "SELECT request_id, evidence_id, requester_id, bid_amount, purpose, zk_credentials, deadline, status
             FROM access_requests WHERE evidence_id = ? ORDER BY bid_amount DESC"
        )
        .bind(evidence_id)
        .fetch_all(&self.pool)
        .await?;

        let mut requests = Vec::new();
        for row in rows {
            let purpose_str: String = row.get("purpose");
            let status_str: String = row.get("status");

            let purpose: crate::marketplace::AccessPurpose = serde_json::from_str(&purpose_str)?;
            let status = match status_str.as_str() {
                "Pending" => crate::marketplace::RequestStatus::Pending,
                "Bidding" => crate::marketplace::RequestStatus::Bidding,
                "Accepted" => crate::marketplace::RequestStatus::Accepted,
                "Fulfilled" => crate::marketplace::RequestStatus::Fulfilled,
                "Rejected" => crate::marketplace::RequestStatus::Rejected,
                "Expired" => crate::marketplace::RequestStatus::Expired,
                _ => crate::marketplace::RequestStatus::Pending,
            };

            requests.push(crate::marketplace::AccessRequest {
                request_id: row.get("request_id"),
                evidence_id: row.get("evidence_id"),
                requester_id: row.get("requester_id"),
                bid_amount: row.get::<i64, _>("bid_amount") as u128,
                purpose,
                zk_credentials: row.get("zk_credentials"),
                deadline: row.get("deadline"),
                status,
            });
        }

        Ok(requests)
    }

    pub async fn get_pending_verification_requests(&self) -> Result<Vec<crate::marketplace::VerificationRequest>> {
        let rows = sqlx::query(
            "SELECT request_id, evidence_id, verification_type, reward_amount, deadline, requirements
             FROM verification_requests WHERE status = 'Pending' ORDER BY reward_amount DESC"
        )
        .fetch_all(&self.pool)
        .await?;

        let mut requests = Vec::new();
        for row in rows {
            let verification_type_str: String = row.get("verification_type");
            let requirements_str: String = row.get("requirements");

            let verification_type: crate::marketplace::VerificationType = serde_json::from_str(&verification_type_str)?;
            let requirements: Vec<String> = serde_json::from_str(&requirements_str)?;

            requests.push(crate::marketplace::VerificationRequest {
                request_id: row.get("request_id"),
                evidence_id: row.get("evidence_id"),
                verification_type,
                reward_amount: row.get::<i64, _>("reward_amount") as u128,
                deadline: row.get("deadline"),
                requirements,
            });
        }

        Ok(requests)
    }

    pub async fn get_solver_bids_for_request(&self, request_id: &str) -> Result<Vec<crate::marketplace::SolverBid>> {
        let rows = sqlx::query(
            "SELECT bid_id, request_id, solver_id, bid_amount, estimated_completion, credentials, proof_of_capability
             FROM solver_bids WHERE request_id = ? ORDER BY bid_amount ASC"
        )
        .bind(request_id)
        .fetch_all(&self.pool)
        .await?;

        let mut bids = Vec::new();
        for row in rows {
            bids.push(crate::marketplace::SolverBid {
                bid_id: row.get("bid_id"),
                request_id: row.get("request_id"),
                solver_id: row.get("solver_id"),
                bid_amount: row.get::<i64, _>("bid_amount") as u128,
                estimated_completion: row.get("estimated_completion"),
                credentials: row.get("credentials"),
                proof_of_capability: row.get("proof_of_capability"),
            });
        }

        Ok(bids)
    }

    pub async fn store_wrapped_key(&self, wrapped_key: &crate::marketplace::WrappedKey, request_id: Option<&str>) -> Result<()> {
        sqlx::query(
            "INSERT INTO wrapped_keys (evidence_id, recipient_public_key, encrypted_key, nonce, request_id)
             VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&wrapped_key.evidence_id)
        .bind(&wrapped_key.recipient_public_key)
        .bind(&wrapped_key.encrypted_key)
        .bind(&wrapped_key.nonce)
        .bind(request_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_wrapped_key(&self, evidence_id: &str, recipient_public_key: &[u8]) -> Result<Option<crate::marketplace::WrappedKey>> {
        let row = sqlx::query(
            "SELECT evidence_id, recipient_public_key, encrypted_key, nonce
             FROM wrapped_keys WHERE evidence_id = ? AND recipient_public_key = ?"
        )
        .bind(evidence_id)
        .bind(recipient_public_key)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            Ok(Some(crate::marketplace::WrappedKey {
                evidence_id: row.get("evidence_id"),
                recipient_public_key: row.get("recipient_public_key"),
                encrypted_key: row.get("encrypted_key"),
                nonce: row.get("nonce"),
            }))
        } else {
            Ok(None)
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseStats {
    pub total_evidence: i64,
    pub confirmed_evidence: i64,
    pub total_sessions: i64,
    pub completed_sessions: i64,
    pub total_pins: i64,
    pub total_near_posts: i64,
}

impl sqlx::FromRow<'_, sqlx::sqlite::SqliteRow> for EvidenceSubmission {
    fn from_row(row: &sqlx::sqlite::SqliteRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get("id")?,
            evidence_id: row.try_get("evidence_id")?,
            zcash_txid: row.try_get("zcash_txid")?,
            ipfs_cid: row.try_get("ipfs_cid")?,
            board_category: row.try_get("board_category")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            commitment_hash: row.try_get("commitment_hash")?,
            block_height: row.try_get("block_height")?,
            submission_timestamp: row.try_get("submission_timestamp")?,
            status: row.try_get("status")?,
            confirmation_count: row.try_get("confirmation_count")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

impl sqlx::FromRow<'_, sqlx::sqlite::SqliteRow> for FrostSigningSession {
    fn from_row(row: &sqlx::sqlite::SqliteRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get("id")?,
            session_id: row.try_get("session_id")?,
            evidence_id: row.try_get("evidence_id")?,
            threshold: row.try_get("threshold")?,
            min_signers: row.try_get("min_signers")?,
            max_signers: row.try_get("max_signers")?,
            current_round: row.try_get("current_round")?,
            status: row.try_get("status")?,
            group_commitment: row.try_get("group_commitment")?,
            signature: row.try_get("signature")?,
            created_at: row.try_get("created_at")?,
            completed_at: row.try_get("completed_at")?,
        })
    }
}

impl sqlx::FromRow<'_, sqlx::sqlite::SqliteRow> for FrostParticipant {
    fn from_row(row: &sqlx::sqlite::SqliteRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get("id")?,
            session_id: row.try_get("session_id")?,
            participant_id: row.try_get("participant_id")?,
            public_key: row.try_get("public_key")?,
            round1_commitment: row.try_get("round1_commitment")?,
            round2_signature_share: row.try_get("round2_signature_share")?,
            status: row.try_get("status")?,
            joined_at: row.try_get("joined_at")?,
        })
    }
}

impl sqlx::FromRow<'_, sqlx::sqlite::SqliteRow> for IpfsPin {
    fn from_row(row: &sqlx::sqlite::SqliteRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get("id")?,
            cid: row.try_get("cid")?,
            evidence_id: row.try_get("evidence_id")?,
            content_type: row.try_get("content_type")?,
            size_bytes: row.try_get("size_bytes")?,
            pinned_at: row.try_get("pinned_at")?,
            verified_at: row.try_get("verified_at")?,
            pin_service: row.try_get("pin_service")?,
        })
    }
}

impl sqlx::FromRow<'_, sqlx::sqlite::SqliteRow> for NearCrossPost {
    fn from_row(row: &sqlx::sqlite::SqliteRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get("id")?,
            evidence_id: row.try_get("evidence_id")?,
            near_tx_hash: row.try_get("near_tx_hash")?,
            contract_id: row.try_get("contract_id")?,
            method_name: row.try_get("method_name")?,
            block_height: row.try_get("block_height")?,
            status: row.try_get("status")?,
            posted_at: row.try_get("posted_at")?,
            confirmed_at: row.try_get("confirmed_at")?,
        })
    }
}

impl sqlx::FromRow<'_, sqlx::sqlite::SqliteRow> for EvidenceCommitment {
    fn from_row(row: &sqlx::sqlite::SqliteRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get("id")?,
            evidence_id: row.try_get("evidence_id")?,
            ipfs_cid: row.try_get("ipfs_cid")?,
            board_id: row.try_get("board_id")?,
            commitment_hash: row.try_get("commitment_hash")?,
            timestamp: row.try_get("timestamp")?,
            zcash_txid: row.try_get("zcash_txid")?,
            zcash_block_height: row.try_get("zcash_block_height")?,
            near_txid: row.try_get("near_txid")?,
            near_block_height: row.try_get("near_block_height")?,
            status: row.try_get("status")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

impl sqlx::FromRow<'_, sqlx::sqlite::SqliteRow> for MinaCredentialProofRecord {
    fn from_row(row: &sqlx::sqlite::SqliteRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get("id")?,
            credential_hash: row.try_get("credential_hash")?,
            holder_public_key: row.try_get("holder_public_key")?,
            credential_type: row.try_get("credential_type")?,
            timestamp: row.try_get("timestamp")?,
            proof_data: row.try_get("proof_data")?,
            board_type: row.try_get("board_type")?,
            is_revoked: row.try_get("is_revoked")?,
            verified_at: row.try_get("verified_at")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

impl sqlx::FromRow<'_, sqlx::sqlite::SqliteRow> for FrostAuthorizationRecord {
    fn from_row(row: &sqlx::sqlite::SqliteRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get("id")?,
            authorization_id: row.try_get("authorization_id")?,
            credential_hash: row.try_get("credential_hash")?,
            board_type: row.try_get("board_type")?,
            frost_signature: row.try_get("frost_signature")?,
            authorized_at: row.try_get("authorized_at")?,
            expires_at: row.try_get("expires_at")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

impl sqlx::FromRow<'_, sqlx::sqlite::SqliteRow> for UserSessionRecord {
    fn from_row(row: &sqlx::sqlite::SqliteRow) -> sqlx::Result<Self> {
        Ok(Self {
            id: row.try_get("id")?,
            session_id: row.try_get("session_id")?,
            email: row.try_get("email")?,
            otp_code: row.try_get("otp_code")?,
            otp_expires_at: row.try_get("otp_expires_at")?,
            is_verified: row.try_get("is_verified")?,
            mina_credential_hash: row.try_get("mina_credential_hash")?,
            board_type: row.try_get("board_type")?,
            created_at: row.try_get("created_at")?,
            verified_at: row.try_get("verified_at")?,
            expires_at: row.try_get("expires_at")?,
        })
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_database_creation() {
        let db = Database::new("sqlite::memory:").await;
        assert!(db.is_ok());
    }

    #[tokio::test]
    async fn test_migrations() {
        let db = Database::new("sqlite::memory:").await.unwrap();
        let result = db.migrate().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_insert_and_fetch_evidence() {
        let db = Database::new("sqlite::memory:").await.unwrap();
        db.migrate().await.unwrap();

        let evidence_id = "test_001";
        let ipfs_cid = "QmTest123";

        let id = db.insert_evidence(
            evidence_id,
            ipfs_cid,
            "Healthcare",
            "Test Evidence",
            "Test description",
            &"a".repeat(64),
            1234567890,
        ).await.unwrap();

        assert!(id > 0);

        let evidence = db.get_evidence(evidence_id).await.unwrap();
        assert!(evidence.is_some());

        let evidence = evidence.unwrap();
        assert_eq!(evidence.evidence_id, evidence_id);
        assert_eq!(evidence.ipfs_cid, ipfs_cid);
        assert_eq!(evidence.status, "pending");
    }

    #[tokio::test]
    async fn test_frost_session_workflow() {
        let db = Database::new("sqlite::memory:").await.unwrap();
        db.migrate().await.unwrap();

        db.insert_evidence(
            "test_001",
            "QmTest123",
            "Healthcare",
            "Test Evidence",
            "Description",
            &"a".repeat(64),
            1234567890,
        ).await.unwrap();

        let session_id = "session_001";
        let id = db.create_frost_session(
            session_id,
            "test_001",
            2,
            2,
            3,
        ).await.unwrap();

        assert!(id > 0);

        db.add_frost_participant(session_id, 1, "pubkey1").await.unwrap();
        db.add_frost_participant(session_id, 2, "pubkey2").await.unwrap();

        let session = db.get_frost_session(session_id).await.unwrap();
        assert!(session.is_some());

        let session = session.unwrap();
        assert_eq!(session.session_id, session_id);
        assert_eq!(session.threshold, 2);

        let participants = db.get_session_participants(session_id).await.unwrap();
        assert_eq!(participants.len(), 2);
    }

    #[tokio::test]
    async fn test_database_stats() {
        let db = Database::new("sqlite::memory:").await.unwrap();
        db.migrate().await.unwrap();

        db.insert_evidence(
            "test_001",
            "QmTest1",
            "Healthcare",
            "Evidence 1",
            "Description 1",
            &"a".repeat(64),
            1234567890,
        ).await.unwrap();

        db.insert_evidence(
            "test_002",
            "QmTest2",
            "Legal",
            "Evidence 2",
            "Description 2",
            &"b".repeat(64),
            1234567891,
        ).await.unwrap();

        let stats = db.get_stats().await.unwrap();
        assert_eq!(stats.total_evidence, 2);
        assert_eq!(stats.confirmed_evidence, 0);
    }
}
