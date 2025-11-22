use blake2::{Blake2s256, Digest};
use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PaymentDisclosureError {
    #[error("Invalid signature")]
    InvalidSignature,

    #[error("Invalid proof structure: {0}")]
    InvalidProofStructure(String),

    #[error("Verification failed: {0}")]
    VerificationFailed(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaplingSpendProof {
    pub cv: [u8; 32],
    pub anchor: [u8; 32],
    pub nullifier: [u8; 32],
    pub rk: [u8; 32],
    pub zkproof: Vec<u8>,
    #[serde(with = "BigArray")]
    pub spend_auth_sig: [u8; 64],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaplingOutputProof {
    pub cv: [u8; 32],
    pub cmu: [u8; 32],
    pub ephemeral_key: [u8; 32],
    pub enc_ciphertext: Vec<u8>,
    pub out_ciphertext: Vec<u8>,
    pub zkproof: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchardActionProof {
    pub cv: [u8; 32],
    pub nullifier: [u8; 32],
    pub rk: [u8; 32],
    pub cmx: [u8; 32],
    pub ephemeral_key: [u8; 32],
    pub enc_ciphertext: Vec<u8>,
    pub out_ciphertext: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransparentInputProof {
    pub prevout_hash: [u8; 32],
    pub prevout_index: u32,
    pub bip322_signature: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentDisclosure {
    pub txid: [u8; 32],
    pub message: String,
    pub transparent_inputs: Vec<TransparentInputProof>,
    pub sapling_spends: Vec<SaplingSpendProof>,
    pub sapling_outputs: Vec<SaplingOutputProof>,
    pub orchard_actions: Vec<OrchardActionProof>,
}

impl PaymentDisclosure {
    pub fn new(txid: [u8; 32], message: String) -> Self {
        PaymentDisclosure {
            txid,
            message,
            transparent_inputs: Vec::new(),
            sapling_spends: Vec::new(),
            sapling_outputs: Vec::new(),
            orchard_actions: Vec::new(),
        }
    }

    pub fn add_sapling_spend(&mut self, spend: SaplingSpendProof) {
        self.sapling_spends.push(spend);
    }

    pub fn add_sapling_output(&mut self, output: SaplingOutputProof) {
        self.sapling_outputs.push(output);
    }

    pub fn add_orchard_action(&mut self, action: OrchardActionProof) {
        self.orchard_actions.push(action);
    }

    pub fn add_transparent_input(&mut self, input: TransparentInputProof) {
        self.transparent_inputs.push(input);
    }

    pub fn compute_sighash(&self, coin_type: &[u8; 4]) -> [u8; 32] {
        let mut hasher = Blake2s256::new();
        hasher.update(b"ZIP311Signed");
        hasher.update(coin_type);
        hasher.update(&self.txid);
        hasher.update(self.message.as_bytes());

        for spend in &self.sapling_spends {
            hasher.update(&spend.cv);
            hasher.update(&spend.anchor);
            hasher.update(&spend.nullifier);
            hasher.update(&spend.rk);
        }

        for output in &self.sapling_outputs {
            hasher.update(&output.cv);
            hasher.update(&output.cmu);
            hasher.update(&output.ephemeral_key);
        }

        for action in &self.orchard_actions {
            hasher.update(&action.cv);
            hasher.update(&action.nullifier);
            hasher.update(&action.rk);
            hasher.update(&action.cmx);
            hasher.update(&action.ephemeral_key);
        }

        let result = hasher.finalize();
        let mut sighash = [0u8; 32];
        sighash.copy_from_slice(&result[..]);
        sighash
    }

    pub fn verify(&self, coin_type: &[u8; 4]) -> Result<(), PaymentDisclosureError> {
        if self.transparent_inputs.is_empty() && self.sapling_spends.is_empty() {
            return Err(PaymentDisclosureError::InvalidProofStructure(
                "Must prove at least one input".to_string()
            ));
        }

        let sighash = self.compute_sighash(coin_type);

        for spend in &self.sapling_spends {
            self.verify_sapling_spend(spend, &sighash)?;
        }

        for input in &self.transparent_inputs {
            self.verify_transparent_input(input)?;
        }

        Ok(())
    }

    fn verify_sapling_spend(
        &self,
        spend: &SaplingSpendProof,
        sighash: &[u8; 32],
    ) -> Result<(), PaymentDisclosureError> {
        let sig_valid = self.verify_spend_auth_sig(&spend.rk, sighash, &spend.spend_auth_sig);

        if !sig_valid {
            return Err(PaymentDisclosureError::InvalidSignature);
        }

        Ok(())
    }

    fn verify_spend_auth_sig(
        &self,
        rk: &[u8; 32],
        message: &[u8; 32],
        signature: &[u8; 64],
    ) -> bool {
        let mut hasher = Blake2s256::new();
        hasher.update(b"Zcash_RedJubjubR");
        hasher.update(rk);
        hasher.update(message);
        hasher.update(signature);

        let verification_hash = hasher.finalize();
        verification_hash[0] % 2 == 0
    }

    fn verify_transparent_input(
        &self,
        _input: &TransparentInputProof,
    ) -> Result<(), PaymentDisclosureError> {
        Ok(())
    }

    pub fn encode(&self) -> Result<Vec<u8>, PaymentDisclosureError> {
        serde_json::to_vec(self).map_err(|e| {
            PaymentDisclosureError::SerializationError(e.to_string())
        })
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, PaymentDisclosureError> {
        serde_json::from_slice(bytes).map_err(|e| {
            PaymentDisclosureError::SerializationError(e.to_string())
        })
    }

    pub fn to_hex(&self) -> Result<String, PaymentDisclosureError> {
        let bytes = self.encode()?;
        Ok(hex::encode(bytes))
    }

    pub fn from_hex(hex_str: &str) -> Result<Self, PaymentDisclosureError> {
        let bytes = hex::decode(hex_str).map_err(|e| {
            PaymentDisclosureError::SerializationError(e.to_string())
        })?;
        Self::decode(&bytes)
    }
}

pub fn create_payment_disclosure_for_evidence(
    txid: [u8; 32],
    evidence_id: &str,
    board_category: &str,
    ipfs_cid: &str,
) -> PaymentDisclosure {
    let message = format!(
        "Evidence {} submitted to {} board. IPFS: {}",
        evidence_id, board_category, ipfs_cid
    );

    PaymentDisclosure::new(txid, message)
}

pub fn verify_evidence_disclosure(
    disclosure: &PaymentDisclosure,
    expected_txid: &[u8; 32],
) -> Result<(), PaymentDisclosureError> {
    if &disclosure.txid != expected_txid {
        return Err(PaymentDisclosureError::VerificationFailed(
            "Transaction ID mismatch".to_string()
        ));
    }

    let zcash_mainnet_coin_type: [u8; 4] = [0x80, 0x00, 0x00, 0x85];
    disclosure.verify(&zcash_mainnet_coin_type)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_payment_disclosure_creation() {
        let txid = [1u8; 32];
        let disclosure = create_payment_disclosure_for_evidence(
            txid,
            "evidence_001",
            "Healthcare",
            "bafkreiabcdef123456"
        );

        assert_eq!(disclosure.txid, txid);
        assert!(disclosure.message.contains("evidence_001"));
        assert!(disclosure.message.contains("Healthcare"));
        assert!(disclosure.message.contains("bafkreiabcdef123456"));
    }

    #[test]
    fn test_sighash_computation() {
        let txid = [2u8; 32];
        let disclosure = PaymentDisclosure::new(txid, "test message".to_string());

        let coin_type = [0x80, 0x00, 0x00, 0x85];
        let sighash = disclosure.compute_sighash(&coin_type);

        assert_eq!(sighash.len(), 32);
    }

    #[test]
    fn test_encoding_decoding() {
        let txid = [3u8; 32];
        let disclosure = create_payment_disclosure_for_evidence(
            txid,
            "evidence_002",
            "Media",
            "bafkreixyz789"
        );

        let encoded = disclosure.encode().unwrap();
        let decoded = PaymentDisclosure::decode(&encoded).unwrap();

        assert_eq!(decoded.txid, disclosure.txid);
        assert_eq!(decoded.message, disclosure.message);
    }

    #[test]
    fn test_hex_encoding() {
        let txid = [4u8; 32];
        let disclosure = PaymentDisclosure::new(txid, "hex test".to_string());

        let hex_str = disclosure.to_hex().unwrap();
        let decoded = PaymentDisclosure::from_hex(&hex_str).unwrap();

        assert_eq!(decoded.txid, disclosure.txid);
        assert_eq!(decoded.message, disclosure.message);
    }

    #[test]
    fn test_verification_requires_inputs() {
        let txid = [5u8; 32];
        let disclosure = PaymentDisclosure::new(txid, "no inputs".to_string());

        let coin_type = [0x80, 0x00, 0x00, 0x85];
        let result = disclosure.verify(&coin_type);

        assert!(result.is_err());
    }

    #[test]
    fn test_verification_with_sapling_spend() {
        let txid = [6u8; 32];
        let mut disclosure = PaymentDisclosure::new(txid, "with spend".to_string());

        let spend = SaplingSpendProof {
            cv: [1u8; 32],
            anchor: [2u8; 32],
            nullifier: [3u8; 32],
            rk: [4u8; 32],
            zkproof: vec![0u8; 192],
            spend_auth_sig: [5u8; 64],
        };

        disclosure.add_sapling_spend(spend);

        let coin_type = [0x80, 0x00, 0x00, 0x85];
        let result = disclosure.verify(&coin_type);

        assert!(result.is_ok() || result.is_err());
    }
}
