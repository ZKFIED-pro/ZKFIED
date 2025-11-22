use blake2::{Blake2b512, Digest};
use crate::types::ApiError;

pub struct ViewingKey {
    pub key_type: ViewingKeyType,
    pub key_material: Vec<u8>,
    pub scope: ViewingScope,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ViewingKeyType {
    Incoming,
    Full,
    Audit,
}

#[derive(Debug, Clone)]
pub enum ViewingScope {
    Board(String),
    Report(String),
    Global,
}

impl ViewingKey {
    pub fn derive_from_master(master_key: &[u8], scope: &str, key_type: ViewingKeyType) -> Self {
        let type_byte = match key_type {
            ViewingKeyType::Incoming => 0x01,
            ViewingKeyType::Full => 0x02,
            ViewingKeyType::Audit => 0x03,
        };

        let mut hasher = Blake2b512::new();
        hasher.update(b"zkfied:viewkey:v1");
        hasher.update(master_key);
        hasher.update(scope.as_bytes());
        hasher.update(&[type_byte]);
        let key_material = hasher.finalize().to_vec();

        ViewingKey {
            key_type,
            key_material,
            scope: ViewingScope::Board(scope.to_string()),
        }
    }

    pub fn encrypt_metadata(&self, plaintext: &[u8]) -> Vec<u8> {
        let mut result = Vec::with_capacity(plaintext.len());
        for (i, &byte) in plaintext.iter().enumerate() {
            let key_byte = self.key_material[i % self.key_material.len()];
            result.push(byte ^ key_byte);
        }
        result
    }

    pub fn decrypt_metadata(&self, ciphertext: &[u8]) -> Vec<u8> {
        self.encrypt_metadata(ciphertext)
    }

    pub fn can_access(&self, required_level: ViewingKeyType) -> bool {
        match (self.key_type, required_level) {
            (ViewingKeyType::Audit, _) => true,
            (ViewingKeyType::Full, ViewingKeyType::Full) => true,
            (ViewingKeyType::Full, ViewingKeyType::Incoming) => true,
            (ViewingKeyType::Incoming, ViewingKeyType::Incoming) => true,
            _ => false,
        }
    }
}

pub struct ViewingKeyDistributor {
    master_keys: std::collections::HashMap<String, Vec<u8>>,
}

impl ViewingKeyDistributor {
    pub fn new() -> Self {
        Self {
            master_keys: std::collections::HashMap::new(),
        }
    }

    pub fn register_board(&mut self, board_id: String, master_key: Vec<u8>) {
        self.master_keys.insert(board_id, master_key);
    }

    pub fn issue_key(
        &self,
        board_id: &str,
        key_type: ViewingKeyType,
    ) -> Result<ViewingKey, ApiError> {
        let master_key = self
            .master_keys
            .get(board_id)
            .ok_or_else(|| ApiError::NotFound("Board not found".to_string()))?;

        Ok(ViewingKey::derive_from_master(master_key, board_id, key_type))
    }

    pub fn revoke_board(&mut self, board_id: &str) {
        self.master_keys.remove(board_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_derivation() {
        let master = b"master_secret_key";
        let board_id = "board_123";

        let key1 = ViewingKey::derive_from_master(master, board_id, ViewingKeyType::Full);
        let key2 = ViewingKey::derive_from_master(master, board_id, ViewingKeyType::Full);

        assert_eq!(key1.key_material, key2.key_material);
        assert_eq!(key1.key_material.len(), 64);
    }

    #[test]
    fn test_different_key_types() {
        let master = b"master_secret_key";
        let board_id = "board_123";

        let incoming = ViewingKey::derive_from_master(master, board_id, ViewingKeyType::Incoming);
        let full = ViewingKey::derive_from_master(master, board_id, ViewingKeyType::Full);
        let audit = ViewingKey::derive_from_master(master, board_id, ViewingKeyType::Audit);

        assert_ne!(incoming.key_material, full.key_material);
        assert_ne!(full.key_material, audit.key_material);
        assert_ne!(incoming.key_material, audit.key_material);
    }

    #[test]
    fn test_encryption_decryption() {
        let master = b"test_key";
        let key = ViewingKey::derive_from_master(master, "board", ViewingKeyType::Full);

        let plaintext = b"sensitive evidence metadata";
        let ciphertext = key.encrypt_metadata(plaintext);
        let decrypted = key.decrypt_metadata(&ciphertext);

        assert_eq!(plaintext.to_vec(), decrypted);
        assert_ne!(plaintext.to_vec(), ciphertext);
    }

    #[test]
    fn test_access_levels() {
        let master = b"key";
        let incoming = ViewingKey::derive_from_master(master, "b", ViewingKeyType::Incoming);
        let full = ViewingKey::derive_from_master(master, "b", ViewingKeyType::Full);
        let audit = ViewingKey::derive_from_master(master, "b", ViewingKeyType::Audit);

        assert!(incoming.can_access(ViewingKeyType::Incoming));
        assert!(!incoming.can_access(ViewingKeyType::Full));
        assert!(!incoming.can_access(ViewingKeyType::Audit));

        assert!(full.can_access(ViewingKeyType::Incoming));
        assert!(full.can_access(ViewingKeyType::Full));
        assert!(!full.can_access(ViewingKeyType::Audit));

        assert!(audit.can_access(ViewingKeyType::Incoming));
        assert!(audit.can_access(ViewingKeyType::Full));
        assert!(audit.can_access(ViewingKeyType::Audit));
    }

    #[test]
    fn test_distributor() {
        let mut dist = ViewingKeyDistributor::new();
        let board_id = "test_board".to_string();
        let master = vec![0u8; 32];

        dist.register_board(board_id.clone(), master);

        let key = dist.issue_key(&board_id, ViewingKeyType::Full).unwrap();
        assert_eq!(key.key_type, ViewingKeyType::Full);

        dist.revoke_board(&board_id);
        assert!(dist.issue_key(&board_id, ViewingKeyType::Full).is_err());
    }
}
