
use frost_rerandomized::{
    self as frost_rerand,
    frost_core::{self as frost},
    RandomizedCiphersuite,
};
use rand_core::OsRng;
use std::collections::BTreeMap;
use thiserror::Error;

pub use frost::keys::{KeyPackage, PublicKeyPackage};
pub use frost::keys::dkg::{round1 as dkg_round1, round2 as dkg_round2};
pub use frost::round1::{SigningCommitments, SigningNonces};
pub use frost::round2::SignatureShare;
pub use frost::{Identifier, Signature, SigningPackage};
pub use frost_rerand::{RandomizedParams, Randomizer};

#[derive(Debug, Error)]
pub enum FrostError {
    #[error("FROST core error: {0}")]
    FrostCore(String),

    #[error("Invalid identifier: {0}")]
    InvalidIdentifier(String),

    #[error("Serialization error: {0}")]
    Serialization(String),
}

pub type ParticipantId = u16;

fn to_identifier<C: frost::Ciphersuite>(id: ParticipantId) -> Result<Identifier<C>, FrostError> {
    Identifier::try_from(id).map_err(|e| FrostError::InvalidIdentifier(format!("{}", e)))
}
pub fn generate_with_dealer<C: frost::Ciphersuite>(
    max_signers: u16,
    min_signers: u16,
) -> Result<(BTreeMap<ParticipantId, KeyPackage<C>>, PublicKeyPackage<C>), FrostError> {
    tracing::warn!("DEPRECATED: Using centralized dealer for key generation. Use DKG ceremony instead.");

    let mut rng = OsRng;

    let (shares, pubkeys) = frost::keys::generate_with_dealer(
        max_signers,
        min_signers,
        frost::keys::IdentifierList::Default,
        &mut rng,
    )
    .map_err(|e| FrostError::FrostCore(e.to_string()))?;

    let mut key_packages = BTreeMap::new();
    for (identifier, secret_share) in shares {
        let key_package = KeyPackage::try_from(secret_share)
            .map_err(|e| FrostError::FrostCore(e.to_string()))?;

        let id: u16 = identifier
            .serialize()
            .first()
            .copied()
            .ok_or_else(|| FrostError::Serialization("Empty identifier".to_string()))?
            .into();

        key_packages.insert(id, key_package);
    }

    Ok((key_packages, pubkeys))
}

pub fn signing_round1<C: frost::Ciphersuite>(
    key_package: &KeyPackage<C>,
) -> (SigningNonces<C>, SigningCommitments<C>) {
    let mut rng = OsRng;
    frost::round1::commit(key_package.signing_share(), &mut rng)
}
pub fn create_signing_package<C: frost::Ciphersuite>(
    commitments: &BTreeMap<ParticipantId, SigningCommitments<C>>,
    message: &[u8],
) -> Result<SigningPackage<C>, FrostError> {
    let mut frost_commitments = BTreeMap::new();
    for (&id, commitment) in commitments {
        let identifier = to_identifier::<C>(id)?;
        frost_commitments.insert(identifier, commitment.clone());
    }

    Ok(SigningPackage::new(frost_commitments, message))
}
pub fn generate_randomized_params<C: RandomizedCiphersuite>(
    public_key_package: &PublicKeyPackage<C>,
    signing_package: &SigningPackage<C>,
) -> Result<RandomizedParams<C>, FrostError> {
    let mut rng = OsRng;

    RandomizedParams::new(
        public_key_package.verifying_key(),
        signing_package,
        &mut rng,
    )
    .map_err(|e| FrostError::FrostCore(e.to_string()))
}
pub fn signing_round2<C: RandomizedCiphersuite>(
    signing_package: &SigningPackage<C>,
    nonces: &SigningNonces<C>,
    key_package: &KeyPackage<C>,
    randomizer: Randomizer<C>,
) -> Result<SignatureShare<C>, FrostError> {
    frost_rerand::sign(signing_package, nonces, key_package, randomizer)
        .map_err(|e| FrostError::FrostCore(e.to_string()))
}
pub fn aggregate_signature_shares<C: RandomizedCiphersuite>(
    signing_package: &SigningPackage<C>,
    signature_shares: &BTreeMap<ParticipantId, SignatureShare<C>>,
    public_key_package: &PublicKeyPackage<C>,
    randomized_params: &RandomizedParams<C>,
) -> Result<Signature<C>, FrostError> {
    let mut frost_shares = BTreeMap::new();
    for (&id, share) in signature_shares {
        let identifier = to_identifier::<C>(id)?;
        frost_shares.insert(identifier, share.clone());
    }

    frost_rerand::aggregate(
        signing_package,
        &frost_shares,
        public_key_package,
        randomized_params,
    )
    .map_err(|e| FrostError::FrostCore(e.to_string()))
}
pub fn verify_signature<C: RandomizedCiphersuite>(
    message: &[u8],
    signature: &Signature<C>,
    randomized_params: &RandomizedParams<C>,
) -> Result<(), FrostError> {
    randomized_params
        .randomized_verifying_key()
        .verify(message, signature)
        .map_err(|e| FrostError::FrostCore(e.to_string()))
}
pub fn serialize_key_package<C: frost::Ciphersuite>(
    key_package: &KeyPackage<C>,
) -> Result<Vec<u8>, FrostError> {
    key_package
        .serialize()
        .map(|bytes| bytes.into())
        .map_err(|e| FrostError::Serialization(e.to_string()))
}

pub fn deserialize_key_package<C: frost::Ciphersuite>(
    bytes: &[u8],
) -> Result<KeyPackage<C>, FrostError> {
    KeyPackage::deserialize(bytes).map_err(|e| FrostError::Serialization(e.to_string()))
}

pub fn serialize_public_key_package<C: frost::Ciphersuite>(
    pkg: &PublicKeyPackage<C>,
) -> Result<Vec<u8>, FrostError> {
    pkg.serialize()
        .map(|bytes| bytes.into())
        .map_err(|e| FrostError::Serialization(e.to_string()))
}

pub fn deserialize_public_key_package<C: frost::Ciphersuite>(
    bytes: &[u8],
) -> Result<PublicKeyPackage<C>, FrostError> {
    PublicKeyPackage::deserialize(bytes).map_err(|e| FrostError::Serialization(e.to_string()))
}

pub fn serialize_signature<C: frost::Ciphersuite>(
    signature: &Signature<C>,
) -> Result<Vec<u8>, FrostError> {
    signature
        .serialize()
        .map(|bytes| bytes.into())
        .map_err(|e| FrostError::Serialization(e.to_string()))
}

pub fn deserialize_signature<C: frost::Ciphersuite>(
    bytes: &[u8],
) -> Result<Signature<C>, FrostError> {
    Signature::deserialize(bytes).map_err(|e| FrostError::Serialization(e.to_string()))
}

pub fn serialize_commitments<C: frost::Ciphersuite>(
    commitments: &SigningCommitments<C>,
) -> Result<Vec<u8>, FrostError> {
    commitments
        .serialize()
        .map(|bytes| bytes.into())
        .map_err(|e| FrostError::Serialization(e.to_string()))
}

pub fn deserialize_commitments<C: frost::Ciphersuite>(
    bytes: &[u8],
) -> Result<SigningCommitments<C>, FrostError> {
    SigningCommitments::deserialize(bytes).map_err(|e| FrostError::Serialization(e.to_string()))
}

pub fn serialize_signature_share<C: frost::Ciphersuite>(
    share: &SignatureShare<C>,
) -> Vec<u8> {
    share.serialize().to_vec()
}

pub fn deserialize_signature_share<C: frost::Ciphersuite>(
    bytes: &[u8],
) -> Result<SignatureShare<C>, FrostError> {
    SignatureShare::deserialize(bytes).map_err(|e| FrostError::Serialization(e.to_string()))
}

pub fn get_randomizer<C: RandomizedCiphersuite>(
    params: &RandomizedParams<C>,
) -> Randomizer<C> {
    *params.randomizer()
}

pub fn dkg_part1<C: frost::Ciphersuite>(
    participant_id: ParticipantId,
    max_signers: u16,
    min_signers: u16,
) -> Result<(dkg_round1::SecretPackage<C>, dkg_round1::Package<C>), FrostError> {
    let mut rng = OsRng;
    let identifier = to_identifier::<C>(participant_id)?;

    frost::keys::dkg::part1(identifier, max_signers, min_signers, &mut rng)
        .map_err(|e| FrostError::FrostCore(e.to_string()))
}

pub fn dkg_part2<C: frost::Ciphersuite>(
    secret_package: dkg_round1::SecretPackage<C>,
    round1_packages: &BTreeMap<ParticipantId, dkg_round1::Package<C>>,
) -> Result<(dkg_round2::SecretPackage<C>, BTreeMap<ParticipantId, dkg_round2::Package<C>>), FrostError> {
    let mut frost_packages = BTreeMap::new();
    for (&id, package) in round1_packages {
        let identifier = to_identifier::<C>(id)?;
        frost_packages.insert(identifier, package.clone());
    }

    let (secret_package, frost_round2_packages) = frost::keys::dkg::part2(secret_package, &frost_packages)
        .map_err(|e| FrostError::FrostCore(e.to_string()))?;

    let mut round2_packages = BTreeMap::new();
    for (identifier, package) in frost_round2_packages {
        let id: u16 = identifier
            .serialize()
            .first()
            .copied()
            .ok_or_else(|| FrostError::Serialization("Empty identifier".to_string()))?
            .into();
        round2_packages.insert(id, package);
    }

    Ok((secret_package, round2_packages))
}

pub fn dkg_part3<C: frost::Ciphersuite>(
    secret_package: &dkg_round2::SecretPackage<C>,
    round1_packages: &BTreeMap<ParticipantId, dkg_round1::Package<C>>,
    round2_packages: &BTreeMap<ParticipantId, dkg_round2::Package<C>>,
) -> Result<(KeyPackage<C>, PublicKeyPackage<C>), FrostError> {
    let mut frost_round1_packages = BTreeMap::new();
    for (&id, package) in round1_packages {
        let identifier = to_identifier::<C>(id)?;
        frost_round1_packages.insert(identifier, package.clone());
    }

    let mut frost_round2_packages = BTreeMap::new();
    for (&id, package) in round2_packages {
        let identifier = to_identifier::<C>(id)?;
        frost_round2_packages.insert(identifier, package.clone());
    }

    frost::keys::dkg::part3(secret_package, &frost_round1_packages, &frost_round2_packages)
        .map_err(|e| FrostError::FrostCore(e.to_string()))
}

pub fn serialize_randomizer<C: frost::Ciphersuite>(
    randomizer: &Randomizer<C>,
) -> Vec<u8> {
    randomizer.serialize().to_vec()
}

pub fn deserialize_randomizer<C: frost::Ciphersuite>(
    bytes: &[u8],
) -> Result<Randomizer<C>, FrostError> {
    Randomizer::deserialize(bytes).map_err(|e| FrostError::Serialization(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use frost_ristretto255::Ristretto255Sha512 as TestCiphersuite;

    #[test]
    fn test_full_rerandomized_frost_flow() {
        type C = TestCiphersuite;

        let max_signers = 5;
        let min_signers = 3;

        let (key_packages, public_key_package) =
            generate_with_dealer::<C>(max_signers, min_signers).unwrap();

        assert_eq!(key_packages.len(), 5);

        let mut nonces = BTreeMap::new();
        let mut commitments = BTreeMap::new();

        for participant_id in 1..=3 {
            let key_package = key_packages.get(&participant_id).unwrap();
            let (nonce, commitment) = signing_round1(key_package);
            nonces.insert(participant_id, nonce);
            commitments.insert(participant_id, commitment);
        }

        let message = b"ZKFIED: Protecting whistleblowers with FROST";
        let signing_package = create_signing_package(&commitments, message).unwrap();

        let randomized_params =
            generate_randomized_params(&public_key_package, &signing_package).unwrap();

        let randomizer = get_randomizer(&randomized_params);

        let mut signature_shares = BTreeMap::new();

        for participant_id in 1..=3 {
            let key_package = key_packages.get(&participant_id).unwrap();
            let nonce = nonces.get(&participant_id).unwrap();

            let share =
                signing_round2(&signing_package, nonce, key_package, randomizer).unwrap();
            signature_shares.insert(participant_id, share);
        }

        let signature = aggregate_signature_shares(
            &signing_package,
            &signature_shares,
            &public_key_package,
            &randomized_params,
        )
        .unwrap();

        let verification_result = verify_signature(message, &signature, &randomized_params);

        assert!(verification_result.is_ok(), "Signature should be valid");
    }

    #[test]
    fn test_serialization_round_trip() {
        type C = TestCiphersuite;

        let (key_packages, public_key_package) = generate_with_dealer::<C>(3, 2).unwrap();

        let pub_bytes = serialize_public_key_package(&public_key_package).unwrap();
        let pub_restored = deserialize_public_key_package::<C>(&pub_bytes).unwrap();
        assert_eq!(
            pub_restored.verifying_key(),
            public_key_package.verifying_key()
        );

        let key_package = key_packages.get(&1).unwrap();
        let key_bytes = serialize_key_package(key_package).unwrap();
        let key_restored = deserialize_key_package::<C>(&key_bytes).unwrap();
        assert_eq!(key_restored.verifying_key(), key_package.verifying_key());
    }

    #[test]
    fn test_different_participant_sets() {
        type C = TestCiphersuite;

        let (key_packages, public_key_package) = generate_with_dealer::<C>(5, 3).unwrap();

        let mut nonces1 = BTreeMap::new();
        let mut commitments1 = BTreeMap::new();

        for participant_id in 1..=3 {
            let key_package = key_packages.get(&participant_id).unwrap();
            let (nonce, commitment) = signing_round1(key_package);
            nonces1.insert(participant_id, nonce);
            commitments1.insert(participant_id, commitment);
        }

        let message1 = b"first message";
        let signing_package1 = create_signing_package(&commitments1, message1).unwrap();
        let randomized_params1 =
            generate_randomized_params(&public_key_package, &signing_package1).unwrap();
        let randomizer1 = get_randomizer(&randomized_params1);

        let mut signature_shares1 = BTreeMap::new();
        for participant_id in 1..=3 {
            let key_package = key_packages.get(&participant_id).unwrap();
            let nonce = nonces1.get(&participant_id).unwrap();
            let share =
                signing_round2(&signing_package1, nonce, key_package, randomizer1).unwrap();
            signature_shares1.insert(participant_id, share);
        }

        let signature1 = aggregate_signature_shares(
            &signing_package1,
            &signature_shares1,
            &public_key_package,
            &randomized_params1,
        )
        .unwrap();

        assert!(verify_signature(message1, &signature1, &randomized_params1).is_ok());

        let mut nonces2 = BTreeMap::new();
        let mut commitments2 = BTreeMap::new();

        for participant_id in 3..=5 {
            let key_package = key_packages.get(&participant_id).unwrap();
            let (nonce, commitment) = signing_round1(key_package);
            nonces2.insert(participant_id, nonce);
            commitments2.insert(participant_id, commitment);
        }

        let message2 = b"second message";
        let signing_package2 = create_signing_package(&commitments2, message2).unwrap();
        let randomized_params2 =
            generate_randomized_params(&public_key_package, &signing_package2).unwrap();
        let randomizer2 = get_randomizer(&randomized_params2);

        let mut signature_shares2 = BTreeMap::new();
        for participant_id in 3..=5 {
            let key_package = key_packages.get(&participant_id).unwrap();
            let nonce = nonces2.get(&participant_id).unwrap();
            let share =
                signing_round2(&signing_package2, nonce, key_package, randomizer2).unwrap();
            signature_shares2.insert(participant_id, share);
        }

        let signature2 = aggregate_signature_shares(
            &signing_package2,
            &signature_shares2,
            &public_key_package,
            &randomized_params2,
        )
        .unwrap();

        assert!(verify_signature(message2, &signature2, &randomized_params2).is_ok());
    }

    #[test]
    fn test_dkg_full_protocol() {
        type C = TestCiphersuite;

        let max_signers = 5;
        let min_signers = 3;

        let mut round1_secret_packages = BTreeMap::new();
        let mut round1_packages = BTreeMap::new();

        for participant_id in 1..=max_signers {
            let (secret_package, package) =
                dkg_part1::<C>(participant_id, max_signers, min_signers).unwrap();
            round1_secret_packages.insert(participant_id, secret_package);
            round1_packages.insert(participant_id, package);
        }

        let mut round2_secret_packages = BTreeMap::new();
        let mut round2_packages: BTreeMap<u16, BTreeMap<u16, dkg_round2::Package<C>>> =
            BTreeMap::new();

        for participant_id in 1..=max_signers {
            let secret_package = round1_secret_packages.remove(&participant_id).unwrap();

            let mut round1_packages_for_participant = BTreeMap::new();
            for (id, package) in &round1_packages {
                if *id != participant_id {
                    round1_packages_for_participant.insert(*id, package.clone());
                }
            }

            let (round2_secret_package, round2_packages_from_participant) =
                dkg_part2(secret_package, &round1_packages_for_participant).unwrap();

            round2_secret_packages.insert(participant_id, round2_secret_package);
            round2_packages.insert(participant_id, round2_packages_from_participant);
        }

        let mut key_packages = BTreeMap::new();
        let mut public_key_package = None;

        for participant_id in 1..=max_signers {
            let round2_secret_package = round2_secret_packages.get(&participant_id).unwrap();

            let mut round1_packages_for_participant = BTreeMap::new();
            for (id, package) in &round1_packages {
                if *id != participant_id {
                    round1_packages_for_participant.insert(*id, package.clone());
                }
            }

            let mut round2_packages_for_participant = BTreeMap::new();
            for (sender_id, packages_map) in &round2_packages {
                if let Some(package) = packages_map.get(&participant_id) {
                    round2_packages_for_participant.insert(*sender_id, package.clone());
                }
            }

            let (key_package, pubkey_package) = dkg_part3(
                round2_secret_package,
                &round1_packages_for_participant,
                &round2_packages_for_participant,
            )
            .unwrap();

            key_packages.insert(participant_id, key_package);

            if public_key_package.is_none() {
                public_key_package = Some(pubkey_package);
            }
        }

        let public_key_package = public_key_package.unwrap();

        assert_eq!(key_packages.len(), max_signers as usize);

        let mut nonces = BTreeMap::new();
        let mut commitments = BTreeMap::new();

        for participant_id in 1..=3 {
            let key_package = key_packages.get(&participant_id).unwrap();
            let (nonce, commitment) = signing_round1(key_package);
            nonces.insert(participant_id, nonce);
            commitments.insert(participant_id, commitment);
        }

        let message = b"DKG test message";
        let signing_package = create_signing_package(&commitments, message).unwrap();

        let randomized_params =
            generate_randomized_params(&public_key_package, &signing_package).unwrap();

        let randomizer = get_randomizer(&randomized_params);

        let mut signature_shares = BTreeMap::new();

        for participant_id in 1..=3 {
            let key_package = key_packages.get(&participant_id).unwrap();
            let nonce = nonces.get(&participant_id).unwrap();

            let share =
                signing_round2(&signing_package, nonce, key_package, randomizer).unwrap();
            signature_shares.insert(participant_id, share);
        }

        let signature = aggregate_signature_shares(
            &signing_package,
            &signature_shares,
            &public_key_package,
            &randomized_params,
        )
        .unwrap();

        assert!(verify_signature(message, &signature, &randomized_params).is_ok());
    }
}
