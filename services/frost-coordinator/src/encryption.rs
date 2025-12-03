use anyhow::{Result, Context, bail};
use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng},
    ChaCha20Poly1305, Nonce,
};
use sha2::{Sha256, Digest};
use serde::{Deserialize, Serialize};

const NONCE_SIZE: usize = 12;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
}

pub struct EvidenceEncryption;

impl EvidenceEncryption {
    pub fn generate_viewing_key() -> String {
        let mut key_bytes = [0u8; 32];
        use rand::RngCore;
        rand::thread_rng().fill_bytes(&mut key_bytes);
        hex::encode(key_bytes)
    }

    pub fn derive_encryption_key(viewing_key: &str) -> Result<[u8; 32]> {
        let key_bytes = hex::decode(viewing_key)
            .context("Invalid viewing key format")?;

        if key_bytes.len() != 32 {
            bail!("Viewing key must be 32 bytes");
        }

        let mut hasher = Sha256::new();
        hasher.update(b"zkfied_evidence_encryption_v1");
        hasher.update(&key_bytes);
        let hash = hasher.finalize();

        let mut encryption_key = [0u8; 32];
        encryption_key.copy_from_slice(&hash);
        Ok(encryption_key)
    }

    pub fn encrypt_data(data: &[u8], viewing_key: &str) -> Result<EncryptedData> {
        let encryption_key = Self::derive_encryption_key(viewing_key)?;

        let cipher = ChaCha20Poly1305::new(&encryption_key.into());

        let mut nonce_bytes = [0u8; NONCE_SIZE];
        use rand::RngCore;
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher.encrypt(nonce, data)
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        Ok(EncryptedData {
            ciphertext,
            nonce: nonce_bytes.to_vec(),
        })
    }

    pub fn decrypt_data(encrypted: &EncryptedData, viewing_key: &str) -> Result<Vec<u8>> {
        let encryption_key = Self::derive_encryption_key(viewing_key)?;

        let cipher = ChaCha20Poly1305::new(&encryption_key.into());

        if encrypted.nonce.len() != NONCE_SIZE {
            bail!("Invalid nonce size");
        }

        let nonce = Nonce::from_slice(&encrypted.nonce);

        let plaintext = cipher.decrypt(nonce, encrypted.ciphertext.as_ref())
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        Ok(plaintext)
    }

    pub fn encrypt_string(text: &str, viewing_key: &str) -> Result<EncryptedData> {
        Self::encrypt_data(text.as_bytes(), viewing_key)
    }

    pub fn decrypt_string(encrypted: &EncryptedData, viewing_key: &str) -> Result<String> {
        let plaintext = Self::decrypt_data(encrypted, viewing_key)?;
        String::from_utf8(plaintext)
            .context("Decrypted data is not valid UTF-8")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_roundtrip() {
        let viewing_key = EvidenceEncryption::generate_viewing_key();
        let data = b"sensitive evidence data";

        let encrypted = EvidenceEncryption::encrypt_data(data, &viewing_key).unwrap();
        let decrypted = EvidenceEncryption::decrypt_data(&encrypted, &viewing_key).unwrap();

        assert_eq!(data, decrypted.as_slice());
    }

    #[test]
    fn test_wrong_key_fails() {
        let viewing_key1 = EvidenceEncryption::generate_viewing_key();
        let viewing_key2 = EvidenceEncryption::generate_viewing_key();
        let data = b"sensitive evidence data";

        let encrypted = EvidenceEncryption::encrypt_data(data, &viewing_key1).unwrap();
        let result = EvidenceEncryption::decrypt_data(&encrypted, &viewing_key2);

        assert!(result.is_err());
    }

    #[test]
    fn test_string_encryption() {
        let viewing_key = EvidenceEncryption::generate_viewing_key();
        let text = "This is sensitive evidence";

        let encrypted = EvidenceEncryption::encrypt_string(text, &viewing_key).unwrap();
        let decrypted = EvidenceEncryption::decrypt_string(&encrypted, &viewing_key).unwrap();

        assert_eq!(text, decrypted);
    }
}

impl EvidenceEncryption {
    pub fn hash_viewing_keys(keys: &[String]) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        for key in keys {
            hasher.update(key.as_bytes());
        }
        hex::encode(hasher.finalize())
    }
}
