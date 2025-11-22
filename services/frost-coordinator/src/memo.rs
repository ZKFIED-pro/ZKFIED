use anyhow::{Context, Result};
use zcash_primitives::memo::MemoBytes;
use serde::{Deserialize, Serialize};

const EVIDENCE_MEMO_PREFIX: u8 = 0xF0;
const MAX_MEMO_SIZE: usize = 511;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceMemo {
    pub evidence_id: String,
    pub ipfs_cid: String,
    pub board_category: String,
    pub commitment_hash: String,
    pub timestamp: u64,
}

impl EvidenceMemo {
    pub fn encode(&self) -> Result<MemoBytes> {
        let json = serde_json::to_string(self)
            .context("Failed to serialize evidence memo")?;

        let mut bytes = Vec::with_capacity(MAX_MEMO_SIZE);
        bytes.push(EVIDENCE_MEMO_PREFIX);
        bytes.extend_from_slice(json.as_bytes());

        if bytes.len() > MAX_MEMO_SIZE {
            return Err(anyhow::anyhow!(
                "Memo too large: {} bytes (max {})",
                bytes.len(),
                MAX_MEMO_SIZE
            ));
        }

        bytes.resize(MAX_MEMO_SIZE, 0);

        let memo_array: [u8; 511] = bytes.try_into()
            .map_err(|_| anyhow::anyhow!("Failed to convert memo to array"))?;

        Ok(MemoBytes::from_bytes(&memo_array)
            .context("Failed to create MemoBytes")?)
    }

    pub fn decode(memo_bytes: &MemoBytes) -> Result<Self> {
        let bytes = memo_bytes.as_slice();

        if bytes.is_empty() || bytes[0] != EVIDENCE_MEMO_PREFIX {
            return Err(anyhow::anyhow!("Not an evidence memo"));
        }

        let json_end = bytes.iter()
            .position(|&b| b == 0)
            .unwrap_or(bytes.len());

        let json_bytes = &bytes[1..json_end];

        let evidence_memo: EvidenceMemo = serde_json::from_slice(json_bytes)
            .context("Failed to deserialize evidence memo")?;

        Ok(evidence_memo)
    }

    pub fn new(
        evidence_id: String,
        ipfs_cid: String,
        board_category: String,
        commitment_hash: String,
    ) -> Self {
        Self {
            evidence_id,
            ipfs_cid,
            board_category,
            commitment_hash,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evidence_memo_encoding() {
        let memo = EvidenceMemo::new(
            "evidence_001".to_string(),
            "QmTest123".to_string(),
            "Healthcare".to_string(),
            "abc123def456".to_string(),
        );

        let memo_bytes = memo.encode().unwrap();
        let decoded = EvidenceMemo::decode(&memo_bytes).unwrap();

        assert_eq!(decoded.evidence_id, memo.evidence_id);
        assert_eq!(decoded.ipfs_cid, memo.ipfs_cid);
        assert_eq!(decoded.board_category, memo.board_category);
        assert_eq!(decoded.commitment_hash, memo.commitment_hash);
    }

    #[test]
    fn test_memo_size_limit() {
        let long_string = "x".repeat(1000);
        let memo = EvidenceMemo::new(
            long_string.clone(),
            long_string.clone(),
            long_string.clone(),
            long_string,
        );

        let result = memo.encode();
        assert!(result.is_err());
    }
}
