pub mod dkg;
pub mod signing;
pub mod aggregation;
pub mod verification;

pub use dkg::BoardDKG;
pub use signing::FROSTSigner;
pub use aggregation::aggregate_signatures;
pub use verification::verify_authorization;

use serde::{Serialize, Deserialize};

use crate::error::{Result, ZKFIEDError};
use crate::zsa::BoardCategory;

#[derive(Clone, Serialize, Deserialize)]
pub struct BoardGroup {
    pub group_id: [u8; 32],
    pub board: BoardCategory,
    pub threshold: u16,
    pub total_participants: u16,
    pub participants: Vec<Participant>,
    pub group_public_key: Vec<u8>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Participant {
    pub identifier: Vec<u8>,
    pub organization: String,
    pub index: u16,
    pub public_key_share: Vec<u8>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct AuthorizationRequest {
    pub request_id: [u8; 32],
    pub board: BoardCategory,
    pub credential_hash: [u8; 32],
    pub timestamp: u64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct AuthorizationMemo {
    pub request_id: [u8; 32],
    pub board: BoardCategory,
    pub approved: bool,
    pub frost_signature: Vec<u8>,
    pub signing_participants: Vec<u16>,
    pub expiry_timestamp: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_frost_module_exports() {
        let _: Option<BoardGroup> = None;
        let _: Option<AuthorizationMemo> = None;
    }
}
