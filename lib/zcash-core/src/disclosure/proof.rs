use serde::{Serialize, Deserialize};
use crate::error::Result;

#[derive(Clone, Serialize, Deserialize)]
pub struct PaymentDisclosureProof {
    pub txid: [u8; 32],
    pub proof_data: Vec<u8>,
}

impl PaymentDisclosureProof {
    pub fn new(txid: [u8; 32], proof_data: Vec<u8>) -> Self {
        PaymentDisclosureProof { txid, proof_data }
    }
}
