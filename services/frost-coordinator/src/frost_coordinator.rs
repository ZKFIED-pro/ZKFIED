use crate::db::Database;
use crate::frost_impl::{self, FrostError, ParticipantId};
use anyhow::{Context, Result};
use frost_rerandomized::frost_core as frost;
use frost_rerandomized::RandomizedCiphersuite;
use std::collections::BTreeMap;
use std::sync::Arc;

pub use crate::frost_impl::{
    KeyPackage, PublicKeyPackage, RandomizedParams, Randomizer, Signature,
    SignatureShare, SigningCommitments, SigningNonces, SigningPackage,
};

pub struct FrostCoordinator<C: RandomizedCiphersuite> {
    db: Arc<Database>,
    public_key_package: PublicKeyPackage<C>,
    key_packages: BTreeMap<ParticipantId, KeyPackage<C>>,
}

impl<C: RandomizedCiphersuite> FrostCoordinator<C> {
    pub fn new_with_dealer(
        db: Arc<Database>,
        max_signers: u16,
        min_signers: u16,
    ) -> Result<Self, FrostError> {
        let (key_packages, public_key_package) =
            frost_impl::generate_with_dealer::<C>(max_signers, min_signers)?;

        Ok(Self {
            db,
            public_key_package,
            key_packages,
        })
    }

    pub fn public_key_package(&self) -> &PublicKeyPackage<C> {
        &self.public_key_package
    }

    pub fn get_key_package(&self, participant_id: ParticipantId) -> Option<&KeyPackage<C>> {
        self.key_packages.get(&participant_id)
    }

    pub async fn start_signing_session(
        &self,
        session_id: &str,
        evidence_id: &str,
        message: &[u8],
        participant_ids: &[ParticipantId],
    ) -> Result<SigningSession<C>> {
        let mut commitments = BTreeMap::new();
        let mut nonces = BTreeMap::new();

        for &participant_id in participant_ids {
            let key_package = self
                .key_packages
                .get(&participant_id)
                .context(format!("Participant {} not found", participant_id))?;

            let (nonce, commitment) = frost_impl::signing_round1(key_package);

            let commitment_bytes = frost_impl::serialize_commitments(&commitment)
                .map_err(|e| anyhow::anyhow!("Failed to serialize commitment: {}", e))?;

            self.db
                .update_participant_round1(
                    session_id,
                    participant_id as i64,
                    &hex::encode(&commitment_bytes),
                )
                .await?;

            nonces.insert(participant_id, nonce);
            commitments.insert(participant_id, commitment);
        }

        let signing_package = frost_impl::create_signing_package(&commitments, message)
            .map_err(|e| anyhow::anyhow!("Failed to create signing package: {}", e))?;

        let randomized_params =
            frost_impl::generate_randomized_params(&self.public_key_package, &signing_package)
                .map_err(|e| anyhow::anyhow!("Failed to generate randomized params: {}", e))?;

        let randomizer = frost_impl::get_randomizer(&randomized_params);

        self.db
            .update_frost_session_status(session_id, "round1", 1)
            .await?;

        Ok(SigningSession {
            session_id: session_id.to_string(),
            evidence_id: evidence_id.to_string(),
            message: message.to_vec(),
            nonces,
            commitments,
            signing_package,
            randomized_params,
            randomizer,
            signature_shares: BTreeMap::new(),
        })
    }

    pub async fn collect_signature_shares(
        &self,
        session: &mut SigningSession<C>,
        participant_ids: &[ParticipantId],
    ) -> Result<()> {
        for &participant_id in participant_ids {
            let key_package = self
                .key_packages
                .get(&participant_id)
                .context(format!("Participant {} not found", participant_id))?;

            let nonce = session
                .nonces
                .get(&participant_id)
                .context(format!("Nonce not found for participant {}", participant_id))?;

            let share = frost_impl::signing_round2(
                &session.signing_package,
                nonce,
                key_package,
                session.randomizer,
            )
            .map_err(|e| anyhow::anyhow!("Failed to generate signature share: {}", e))?;

            let share_bytes = frost_impl::serialize_signature_share(&share);

            self.db
                .update_participant_round2(
                    &session.session_id,
                    participant_id as i64,
                    &hex::encode(&share_bytes),
                )
                .await?;

            session.signature_shares.insert(participant_id, share);
        }

        self.db
            .update_frost_session_status(&session.session_id, "round2", 2)
            .await?;

        Ok(())
    }

    pub async fn aggregate_signature(
        &self,
        session: &SigningSession<C>,
    ) -> Result<Signature<C>> {
        let signature = frost_impl::aggregate_signature_shares(
            &session.signing_package,
            &session.signature_shares,
            &self.public_key_package,
            &session.randomized_params,
        )
        .map_err(|e| anyhow::anyhow!("Failed to aggregate signature: {}", e))?;

        frost_impl::verify_signature(&session.message, &signature, &session.randomized_params)
            .map_err(|e| anyhow::anyhow!("Signature verification failed: {}", e))?;

        let signature_bytes = frost_impl::serialize_signature(&signature)
            .map_err(|e| anyhow::anyhow!("Failed to serialize signature: {}", e))?;

        let commitment_bytes = frost_impl::serialize_commitments(
            session
                .commitments
                .values()
                .next()
                .context("No commitments")?,
        )
        .map_err(|e| anyhow::anyhow!("Failed to serialize commitment: {}", e))?;

        self.db
            .store_frost_signature(
                &session.session_id,
                &hex::encode(&commitment_bytes[..16]),
                &hex::encode(&signature_bytes),
            )
            .await?;

        self.db
            .update_frost_session_status(&session.session_id, "completed", 3)
            .await?;

        Ok(signature)
    }
}

pub struct SigningSession<C: RandomizedCiphersuite> {
    pub session_id: String,
    pub evidence_id: String,
    pub message: Vec<u8>,
    pub nonces: BTreeMap<ParticipantId, SigningNonces<C>>,
    pub commitments: BTreeMap<ParticipantId, SigningCommitments<C>>,
    pub signing_package: SigningPackage<C>,
    pub randomized_params: RandomizedParams<C>,
    pub randomizer: Randomizer<C>,
    pub signature_shares: BTreeMap<ParticipantId, SignatureShare<C>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use frost_ristretto255::Ristretto255Sha512 as TestCiphersuite;

    #[tokio::test]
    async fn test_coordinator_full_flow() {
        type C = TestCiphersuite;

        let db = Arc::new(Database::new("sqlite::memory:").await.unwrap());
        db.migrate().await.unwrap();

        let coordinator = FrostCoordinator::<C>::new_with_dealer(db.clone(), 5, 3).unwrap();

        let session_id = "test_session_001";
        let evidence_id = "evidence_test_001";

        db.insert_evidence(
            evidence_id,
            "QmTestCID",
            "Healthcare",
            "Test Evidence",
            "Test description",
            "test_commitment_hash",
            1234567890,
        )
        .await
        .unwrap();

        db.create_frost_session(session_id, evidence_id, 3, 3, 5)
            .await
            .unwrap();

        for participant_id in 1..=3 {
            db.add_frost_participant(session_id, participant_id, &format!("participant_{}", participant_id))
                .await
                .unwrap();
        }

        let message = b"ZKFIED: Protect whistleblowers with zero-knowledge proofs";
        let participant_ids = vec![1, 2, 3];

        let mut session = coordinator
            .start_signing_session(session_id, evidence_id, message, &participant_ids)
            .await
            .unwrap();

        coordinator
            .collect_signature_shares(&mut session, &participant_ids)
            .await
            .unwrap();

        let signature = coordinator.aggregate_signature(&session).await.unwrap();

        let verification = frost_impl::verify_signature(
            &session.message,
            &signature,
            &session.randomized_params,
        );

        assert!(verification.is_ok(), "Final signature should be valid");
    }
}
