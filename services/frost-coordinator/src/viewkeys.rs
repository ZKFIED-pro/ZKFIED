use blake2::{Blake2b512, Digest};
use crate::types::ApiError;
use zcash_keys::keys::UnifiedFullViewingKey;
use zcash_primitives::zip32::AccountId;
use zcash_client_backend::encoding::{encode_extended_full_viewing_key, decode_extended_full_viewing_key};
use anyhow::{Context, Result};
use base64::Engine;

pub struct ViewingKey {
    pub key_type: ViewingKeyType,
    pub key_material: Vec<u8>,
    pub scope: ViewingScope,
}

#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
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

pub struct ZcashViewingKeyManager {
    ufvks: std::collections::HashMap<String, String>,
}

impl ZcashViewingKeyManager {
    pub fn new() -> Self {
        Self {
            ufvks: std::collections::HashMap::new(),
        }
    }

    pub fn register_ufvk(&mut self, evidence_id: String, ufvk: String) -> Result<()> {
        self.ufvks.insert(evidence_id, ufvk);
        Ok(())
    }

    pub fn get_ufvk(&self, evidence_id: &str) -> Option<&String> {
        self.ufvks.get(evidence_id)
    }

    pub fn export_viewing_key(&self, evidence_id: &str, format: ViewingKeyFormat) -> Result<String> {
        let ufvk = self.ufvks
            .get(evidence_id)
            .context("Evidence not found")?;

        match format {
            ViewingKeyFormat::Bech32 => Ok(ufvk.clone()),
            ViewingKeyFormat::Hex => {
                let bytes = ufvk.as_bytes();
                Ok(hex::encode(bytes))
            }
            ViewingKeyFormat::Base64 => {
                let bytes = ufvk.as_bytes();
                Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
            }
        }
    }

    pub fn import_viewing_key(&mut self, evidence_id: String, key_data: &str, format: ViewingKeyFormat) -> Result<()> {
        let ufvk_string = match format {
            ViewingKeyFormat::Bech32 => key_data.to_string(),
            ViewingKeyFormat::Hex => {
                let bytes = hex::decode(key_data)
                    .context("Invalid hex format")?;
                String::from_utf8(bytes)
                    .context("Invalid UTF-8")?
            }
            ViewingKeyFormat::Base64 => {
                let bytes = base64::engine::general_purpose::STANDARD.decode(key_data)
                    .context("Invalid base64 format")?;
                String::from_utf8(bytes)
                    .context("Invalid UTF-8")?
            }
        };

        self.register_ufvk(evidence_id, ufvk_string)?;
        Ok(())
    }

    pub fn grant_tiered_access(
        &self,
        evidence_id: &str,
        recipient: &str,
        access_level: ViewingKeyType,
    ) -> Result<TieredAccessGrant> {
        let ufvk = self.ufvks
            .get(evidence_id)
            .context("Evidence not found")?;

        let expiration = chrono::Utc::now() + chrono::Duration::days(365);

        Ok(TieredAccessGrant {
            evidence_id: evidence_id.to_string(),
            recipient: recipient.to_string(),
            access_level,
            ufvk: ufvk.clone(),
            granted_at: chrono::Utc::now(),
            expires_at: expiration,
        })
    }

    pub fn revoke_access(&mut self, evidence_id: &str) -> Result<()> {
        self.ufvks.remove(evidence_id);
        Ok(())
    }
}

#[derive(Debug, Clone, Copy)]
pub enum ViewingKeyFormat {
    Bech32,
    Hex,
    Base64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TieredAccessGrant {
    pub evidence_id: String,
    pub recipient: String,
    pub access_level: ViewingKeyType,
    pub ufvk: String,
    pub granted_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

impl TieredAccessGrant {
    pub fn is_expired(&self) -> bool {
        chrono::Utc::now() > self.expires_at
    }

    pub fn to_json(&self) -> Result<String> {
        serde_json::to_string_pretty(self)
            .context("Failed to serialize access grant")
    }

    pub fn from_json(json: &str) -> Result<Self> {
        serde_json::from_str(json)
            .context("Failed to deserialize access grant")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zcash_viewing_key_manager() {
        let mut manager = ZcashViewingKeyManager::new();
        let evidence_id = "evidence_001".to_string();
        let test_ufvk = "uview1test...".to_string();

        manager.register_ufvk(evidence_id.clone(), test_ufvk.clone()).unwrap();

        let retrieved = manager.get_ufvk(&evidence_id);
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap(), &test_ufvk);
    }

    #[test]
    fn test_tiered_access_grant() {
        let mut manager = ZcashViewingKeyManager::new();
        let evidence_id = "evidence_002";
        let ufvk = "uview1test...".to_string();

        manager.register_ufvk(evidence_id.to_string(), ufvk).unwrap();

        let grant = manager.grant_tiered_access(
            evidence_id,
            "recipient@example.com",
            ViewingKeyType::Full
        ).unwrap();

        assert_eq!(grant.evidence_id, evidence_id);
        assert_eq!(grant.recipient, "recipient@example.com");
        assert_eq!(grant.access_level, ViewingKeyType::Full);
        assert!(!grant.is_expired());
    }

    #[test]
    fn test_viewing_key_export_formats() {
        let mut manager = ZcashViewingKeyManager::new();
        let evidence_id = "evidence_003".to_string();
        let ufvk = "uview1test123".to_string();

        manager.register_ufvk(evidence_id.clone(), ufvk.clone()).unwrap();

        let bech32_export = manager.export_viewing_key(&evidence_id, ViewingKeyFormat::Bech32).unwrap();
        assert_eq!(bech32_export, ufvk);

        let hex_export = manager.export_viewing_key(&evidence_id, ViewingKeyFormat::Hex).unwrap();
        assert!(!hex_export.is_empty());

        let base64_export = manager.export_viewing_key(&evidence_id, ViewingKeyFormat::Base64).unwrap();
        assert!(!base64_export.is_empty());
    }

    #[test]
    fn test_viewing_key_revocation() {
        let mut manager = ZcashViewingKeyManager::new();
        let evidence_id = "evidence_004".to_string();
        let ufvk = "uview1test...".to_string();

        manager.register_ufvk(evidence_id.clone(), ufvk).unwrap();
        assert!(manager.get_ufvk(&evidence_id).is_some());

        manager.revoke_access(&evidence_id).unwrap();
        assert!(manager.get_ufvk(&evidence_id).is_none());
    }

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
