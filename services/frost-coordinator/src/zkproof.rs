use blake2::{Blake2b512, Digest};
use crate::types::{BoardCategory, ApiError};
use crate::permissions::BoardsMask;

#[derive(Debug, Clone)]
pub struct CredentialProof {
    pub holder_commitment: Vec<u8>,
    pub credential_type: u8,
    pub issuer_signature: Vec<u8>,
    pub nullifier: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct BoardAuthorization {
    pub boards_mask: BoardsMask,
    pub credential_proof: CredentialProof,
    pub expiry_timestamp: u64,
}

impl CredentialProof {
    pub fn verify_commitment(&self, public_inputs: &[u8]) -> bool {
        let mut hasher = Blake2b512::new();
        hasher.update(&self.holder_commitment);
        hasher.update(&[self.credential_type]);
        hasher.update(public_inputs);
        let commitment = hasher.finalize();

        commitment.len() == 64
    }

    pub fn verify_nullifier_uniqueness(&self, used_nullifiers: &std::collections::HashSet<Vec<u8>>) -> bool {
        !used_nullifiers.contains(&self.nullifier)
    }

    pub fn derive_nullifier(secret: &[u8], credential_type: u8) -> Vec<u8> {
        let mut hasher = Blake2b512::new();
        hasher.update(b"zkfied:nullifier:v1");
        hasher.update(secret);
        hasher.update(&[credential_type]);
        hasher.finalize().to_vec()
    }
}

impl BoardAuthorization {
    pub fn verify(&self, category: &BoardCategory, current_time: u64) -> Result<(), ApiError> {
        if current_time > self.expiry_timestamp {
            return Err(ApiError::InvalidInput("Authorization expired".to_string()));
        }

        let category_bit = crate::permissions::category_to_bit(category);
        if (self.boards_mask & (1 << category_bit)) == 0 {
            return Err(ApiError::InvalidInput(format!(
                "Not authorized for board {:?}",
                category
            )));
        }

        Ok(())
    }

    pub fn from_credential(
        credential: CredentialProof,
        boards_mask: BoardsMask,
        validity_days: u64,
    ) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Self {
            boards_mask,
            credential_proof: credential,
            expiry_timestamp: now + (validity_days * 86400),
        }
    }
}

pub fn verify_board_credential(
    credential_type: u8,
    category: &BoardCategory,
) -> Result<(), ApiError> {
    let valid = match (credential_type, category) {
        (1, BoardCategory::Healthcare) => true,
        (2, BoardCategory::Healthcare) => true,
        (3, BoardCategory::Media) => true,
        (4, BoardCategory::Legal) => true,
        (5, BoardCategory::Government) => true,
        (6, BoardCategory::Corporate) => true,
        (7, BoardCategory::Education) => true,
        (8, BoardCategory::Environment) => true,
        (9, BoardCategory::CivilSociety) => true,
        _ => false,
    };

    if !valid {
        return Err(ApiError::InvalidInput(format!(
            "Credential type {} not valid for board {:?}",
            credential_type, category
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nullifier_derivation() {
        let secret = b"test_secret";
        let credential_type = 1u8;

        let nullifier1 = CredentialProof::derive_nullifier(secret, credential_type);
        let nullifier2 = CredentialProof::derive_nullifier(secret, credential_type);

        assert_eq!(nullifier1, nullifier2);
        assert_eq!(nullifier1.len(), 64);
    }

    #[test]
    fn test_nullifier_uniqueness() {
        let mut used = std::collections::HashSet::new();

        let nullifier = vec![1u8; 64];
        let proof = CredentialProof {
            holder_commitment: vec![],
            credential_type: 1,
            issuer_signature: vec![],
            nullifier: nullifier.clone(),
        };

        assert!(proof.verify_nullifier_uniqueness(&used));

        used.insert(nullifier.clone());

        assert!(!proof.verify_nullifier_uniqueness(&used));
    }

    #[test]
    fn test_authorization_expiry() {
        let credential = CredentialProof {
            holder_commitment: vec![],
            credential_type: 1,
            issuer_signature: vec![],
            nullifier: vec![],
        };

        let auth = BoardAuthorization::from_credential(credential, 0b00000010, 1);

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        assert!(auth.verify(&BoardCategory::Healthcare, now).is_ok());

        let future = now + 86401;
        assert!(auth.verify(&BoardCategory::Healthcare, future).is_err());
    }

    #[test]
    fn test_credential_board_matching() {
        assert!(verify_board_credential(1, &BoardCategory::Healthcare).is_ok());
        assert!(verify_board_credential(3, &BoardCategory::Media).is_ok());
        assert!(verify_board_credential(1, &BoardCategory::Government).is_err());
    }
}
