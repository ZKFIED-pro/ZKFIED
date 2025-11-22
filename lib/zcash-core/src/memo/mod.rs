use crate::error::{Result, ZKFIEDError};
use crate::zsa::{BoardCategory, EvidenceMetadata};

pub struct MemoEncoder;

impl MemoEncoder {
    pub const MAX_MEMO_SIZE: usize = 512;

    pub fn encode_evidence(metadata: &EvidenceMetadata) -> Result<Vec<u8>> {
        let mut memo = Vec::with_capacity(Self::MAX_MEMO_SIZE);

        memo.push(0x01);
        memo.push(0x01);
        memo.push(metadata.board.to_u8());
        memo.push(0x00);

        memo.extend_from_slice(&metadata.timestamp.to_be_bytes());

        let cid_bytes = metadata.ipfs_cid.as_bytes();
        let cid_len = cid_bytes.len().min(46);
        memo.extend_from_slice(&cid_bytes[..cid_len]);
        memo.resize(memo.len() + (46 - cid_len), 0);

        memo.extend_from_slice(&metadata.commitment);
        memo.extend_from_slice(&metadata.viewing_keys_hint);

        memo.resize(Self::MAX_MEMO_SIZE, 0);
        Ok(memo)
    }

    pub fn decode_evidence(memo: &[u8]) -> Result<EvidenceMetadata> {
        if memo.len() < Self::MAX_MEMO_SIZE {
            return Err(ZKFIEDError::InvalidParameter("Memo too short".to_string()));
        }

        if memo[0] != 0x01 {
            return Err(ZKFIEDError::InvalidParameter("Invalid memo type".to_string()));
        }

        let board = BoardCategory::from_u8(memo[2])?;

        let mut timestamp_bytes = [0u8; 8];
        timestamp_bytes.copy_from_slice(&memo[4..12]);
        let timestamp = u64::from_be_bytes(timestamp_bytes);

        let cid_bytes = &memo[12..58];
        let ipfs_cid = String::from_utf8_lossy(cid_bytes).trim_end_matches('\0').to_string();

        let mut commitment = [0u8; 32];
        commitment.copy_from_slice(&memo[58..90]);

        let mut viewing_keys_hint = [0u8; 32];
        viewing_keys_hint.copy_from_slice(&memo[90..122]);

        Ok(EvidenceMetadata {
            board,
            ipfs_cid,
            commitment,
            timestamp,
            viewing_keys_hint,
        })
    }
}
