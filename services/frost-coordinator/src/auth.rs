use blake2::{Blake2b512, Digest};
use rand_core::{OsRng, RngCore};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("Invalid challenge")]
    InvalidChallenge,

    #[error("Challenge expired")]
    ChallengeExpired,

    #[error("Invalid response")]
    InvalidResponse,
}

pub struct Challenge {
    pub nonce: [u8; 32],
    pub created_at: u64,
    pub participant_id: u16,
}

pub struct AuthSystem {
    challenges: Arc<RwLock<HashMap<String, Challenge>>>,
    challenge_ttl: u64,
}

impl AuthSystem {
    pub fn new(challenge_ttl: u64) -> Self {
        Self {
            challenges: Arc::new(RwLock::new(HashMap::new())),
            challenge_ttl,
        }
    }

    pub async fn create_challenge(&self, participant_id: u16) -> (String, [u8; 32]) {
        let mut nonce = [0u8; 32];
        OsRng.fill_bytes(&mut nonce);

        let challenge_id = hex::encode(&nonce[..16]);

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let challenge = Challenge {
            nonce,
            created_at: now,
            participant_id,
        };

        self.challenges.write().await.insert(challenge_id.clone(), challenge);

        (challenge_id, nonce)
    }

    pub async fn verify_response(
        &self,
        challenge_id: &str,
        response: &[u8],
        public_key: &[u8],
    ) -> Result<u16, AuthError> {
        let mut challenges = self.challenges.write().await;

        let challenge = challenges
            .remove(challenge_id)
            .ok_or(AuthError::InvalidChallenge)?;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if now - challenge.created_at > self.challenge_ttl {
            return Err(AuthError::ChallengeExpired);
        }

        let mut hasher = Blake2b512::new();
        hasher.update(&challenge.nonce);
        hasher.update(public_key);
        let expected = hasher.finalize();

        if response.len() != 64 || response != expected.as_slice() {
            return Err(AuthError::InvalidResponse);
        }

        Ok(challenge.participant_id)
    }

    pub async fn cleanup_expired(&self) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut challenges = self.challenges.write().await;
        challenges.retain(|_, challenge| {
            now - challenge.created_at <= self.challenge_ttl
        });
    }
}

pub fn generate_response(nonce: &[u8], secret_key: &[u8]) -> Vec<u8> {
    let mut hasher = Blake2b512::new();
    hasher.update(nonce);
    hasher.update(secret_key);
    hasher.finalize().to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_challenge_response_flow() {
        let auth = AuthSystem::new(300);
        let participant_id = 1u16;
        let secret_key = b"test_secret_key";

        let (challenge_id, nonce) = auth.create_challenge(participant_id).await;

        let response = generate_response(&nonce, secret_key);

        let verified_id = auth.verify_response(&challenge_id, &response, secret_key).await.unwrap();

        assert_eq!(verified_id, participant_id);
    }

    #[tokio::test]
    async fn test_invalid_response() {
        let auth = AuthSystem::new(300);
        let participant_id = 1u16;

        let (challenge_id, _) = auth.create_challenge(participant_id).await;

        let invalid_response = vec![0u8; 64];
        let public_key = b"test_key";

        let result = auth.verify_response(&challenge_id, &invalid_response, public_key).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_cleanup_expired() {
        let auth = AuthSystem::new(1);
        auth.create_challenge(1).await;

        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        auth.cleanup_expired().await;

        assert_eq!(auth.challenges.read().await.len(), 0);
    }
}
