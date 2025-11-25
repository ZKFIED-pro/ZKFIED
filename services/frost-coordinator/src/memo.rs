use anyhow::{Context, Result};
use zcash_primitives::memo::MemoBytes;
use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};

pub const MEMO_SIZE: usize = 512;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[repr(u8)]
pub enum EvidenceType {
    Document = 0,
    Photo = 1,
    Video = 2,
    Audio = 3,
    Dataset = 4,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[repr(u8)]
pub enum Board {
    Healthcare = 0,
    Government = 1,
    Corporate = 2,
    Environmental = 3,
    HumanRights = 4,
    Financial = 5,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceMemo {
    pub version: u8,
    pub evidence_type: EvidenceType,
    pub board: Board,
    pub ipfs_cid: String,
    pub commitment_hash: [u8; 32],
    pub timestamp: u64,
    pub viewing_keys: Vec<String>,
}

impl EvidenceMemo {
    pub fn new(
        evidence_type: EvidenceType,
        board: Board,
        ipfs_cid: String,
        commitment_hash: [u8; 32],
        timestamp: u64,
        viewing_keys: Vec<String>,
    ) -> Self {
        Self {
            version: 1,
            evidence_type,
            board,
            ipfs_cid,
            commitment_hash,
            timestamp,
            viewing_keys,
        }
    }

    pub fn encode(&self) -> Result<[u8; MEMO_SIZE]> {
        let mut memo = [0u8; MEMO_SIZE];
        let mut cursor = io::Cursor::new(&mut memo[..]);

        cursor.write_all(&[self.version])
            .context("Failed to write version")?;
        cursor.write_all(&[self.evidence_type as u8])
            .context("Failed to write evidence type")?;
        cursor.write_all(&[self.board as u8])
            .context("Failed to write board")?;

        let cid_bytes = self.ipfs_cid.as_bytes();
        let cid_len = cid_bytes.len().min(64) as u8;
        cursor.write_all(&[cid_len])
            .context("Failed to write CID length")?;
        cursor.write_all(&cid_bytes[..cid_len as usize])
            .context("Failed to write CID")?;

        cursor.write_all(&self.commitment_hash)
            .context("Failed to write commitment hash")?;

        cursor.write_all(&self.timestamp.to_le_bytes())
            .context("Failed to write timestamp")?;

        let keys_json = serde_json::to_string(&self.viewing_keys)
            .context("Failed to serialize viewing keys")?;
        let keys_bytes = keys_json.as_bytes();
        let remaining = MEMO_SIZE - cursor.position() as usize - 2;
        let keys_len = keys_bytes.len().min(remaining) as u16;
        cursor.write_all(&keys_len.to_le_bytes())
            .context("Failed to write keys length")?;
        cursor.write_all(&keys_bytes[..keys_len as usize])
            .context("Failed to write keys")?;

        Ok(memo)
    }

    pub fn decode(memo: &[u8; MEMO_SIZE]) -> Result<Self> {
        let mut cursor = io::Cursor::new(&memo[..]);

        let mut version_buf = [0u8; 1];
        cursor.read_exact(&mut version_buf)
            .context("Failed to read version")?;
        let version = version_buf[0];

        if version != 1 {
            return Err(anyhow::anyhow!("Unsupported memo version: {}", version));
        }

        let mut type_buf = [0u8; 1];
        cursor.read_exact(&mut type_buf)
            .context("Failed to read evidence type")?;
        let evidence_type = match type_buf[0] {
            0 => EvidenceType::Document,
            1 => EvidenceType::Photo,
            2 => EvidenceType::Video,
            3 => EvidenceType::Audio,
            4 => EvidenceType::Dataset,
            _ => return Err(anyhow::anyhow!("Invalid evidence type: {}", type_buf[0])),
        };

        let mut board_buf = [0u8; 1];
        cursor.read_exact(&mut board_buf)
            .context("Failed to read board")?;
        let board = match board_buf[0] {
            0 => Board::Healthcare,
            1 => Board::Government,
            2 => Board::Corporate,
            3 => Board::Environmental,
            4 => Board::HumanRights,
            5 => Board::Financial,
            _ => return Err(anyhow::anyhow!("Invalid board: {}", board_buf[0])),
        };

        let mut cid_len_buf = [0u8; 1];
        cursor.read_exact(&mut cid_len_buf)
            .context("Failed to read CID length")?;
        let cid_len = cid_len_buf[0] as usize;

        let mut cid_buf = vec![0u8; cid_len];
        cursor.read_exact(&mut cid_buf)
            .context("Failed to read CID")?;
        let ipfs_cid = String::from_utf8(cid_buf)
            .context("Failed to parse CID as UTF-8")?;

        let mut commitment_hash = [0u8; 32];
        cursor.read_exact(&mut commitment_hash)
            .context("Failed to read commitment hash")?;

        let mut timestamp_buf = [0u8; 8];
        cursor.read_exact(&mut timestamp_buf)
            .context("Failed to read timestamp")?;
        let timestamp = u64::from_le_bytes(timestamp_buf);

        let mut keys_len_buf = [0u8; 2];
        cursor.read_exact(&mut keys_len_buf)
            .context("Failed to read keys length")?;
        let keys_len = u16::from_le_bytes(keys_len_buf) as usize;

        let mut keys_buf = vec![0u8; keys_len];
        cursor.read_exact(&mut keys_buf)
            .context("Failed to read keys")?;
        let keys_json = String::from_utf8(keys_buf)
            .context("Failed to parse keys as UTF-8")?;
        let viewing_keys: Vec<String> = serde_json::from_str(&keys_json)
            .context("Failed to deserialize viewing keys")?;

        Ok(Self {
            version,
            evidence_type,
            board,
            ipfs_cid,
            commitment_hash,
            timestamp,
            viewing_keys,
        })
    }

    pub fn to_zcash_memo(&self) -> Result<MemoBytes> {
        let encoded = self.encode()?;
        Ok(MemoBytes::from_bytes(&encoded)
            .context("Failed to create MemoBytes")?)
    }

    pub fn from_zcash_memo(memo: &MemoBytes) -> Result<Self> {
        let bytes: [u8; MEMO_SIZE] = memo.as_array().clone();
        Self::decode(&bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode() {
        let memo = EvidenceMemo::new(
            EvidenceType::Document,
            Board::Healthcare,
            "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG".to_string(),
            [42u8; 32],
            1234567890,
            vec!["ivk1test".to_string(), "ivk2test".to_string()],
        );

        let encoded = memo.encode().unwrap();
        let decoded = EvidenceMemo::decode(&encoded).unwrap();

        assert_eq!(decoded.version, 1);
        assert_eq!(decoded.evidence_type, EvidenceType::Document);
        assert_eq!(decoded.board, Board::Healthcare);
        assert_eq!(decoded.ipfs_cid, memo.ipfs_cid);
        assert_eq!(decoded.commitment_hash, [42u8; 32]);
        assert_eq!(decoded.timestamp, 1234567890);
        assert_eq!(decoded.viewing_keys, memo.viewing_keys);
    }

    #[test]
    fn test_all_evidence_types() {
        let types = vec![
            EvidenceType::Document,
            EvidenceType::Photo,
            EvidenceType::Video,
            EvidenceType::Audio,
            EvidenceType::Dataset,
        ];

        for evidence_type in types {
            let memo = EvidenceMemo::new(
                evidence_type,
                Board::Government,
                "QmTest".to_string(),
                [0u8; 32],
                1000,
                vec![],
            );

            let encoded = memo.encode().unwrap();
            let decoded = EvidenceMemo::decode(&encoded).unwrap();
            assert_eq!(decoded.evidence_type, evidence_type);
        }
    }

    #[test]
    fn test_all_boards() {
        let boards = vec![
            Board::Healthcare,
            Board::Government,
            Board::Corporate,
            Board::Environmental,
            Board::HumanRights,
            Board::Financial,
        ];

        for board in boards {
            let memo = EvidenceMemo::new(
                EvidenceType::Document,
                board,
                "QmTest".to_string(),
                [0u8; 32],
                1000,
                vec![],
            );

            let encoded = memo.encode().unwrap();
            let decoded = EvidenceMemo::decode(&encoded).unwrap();
            assert_eq!(decoded.board, board);
        }
    }

    #[test]
    fn test_max_size() {
        let long_cid = "Q".repeat(64);
        let many_keys: Vec<String> = (0..20).map(|i| format!("key{}", i)).collect();

        let memo = EvidenceMemo::new(
            EvidenceType::Video,
            Board::Environmental,
            long_cid.clone(),
            [255u8; 32],
            u64::MAX,
            many_keys.clone(),
        );

        let encoded = memo.encode().unwrap();
        assert_eq!(encoded.len(), MEMO_SIZE);

        let decoded = EvidenceMemo::decode(&encoded).unwrap();
        assert_eq!(decoded.ipfs_cid, long_cid);
        assert_eq!(decoded.timestamp, u64::MAX);
    }

    #[test]
    fn test_zcash_memo_conversion() {
        let memo = EvidenceMemo::new(
            EvidenceType::Photo,
            Board::HumanRights,
            "QmTestCID".to_string(),
            [99u8; 32],
            1700000000,
            vec!["key1".to_string()],
        );

        let zcash_memo = memo.to_zcash_memo().unwrap();
        let decoded = EvidenceMemo::from_zcash_memo(&zcash_memo).unwrap();

        assert_eq!(decoded.evidence_type, EvidenceType::Photo);
        assert_eq!(decoded.board, Board::HumanRights);
        assert_eq!(decoded.ipfs_cid, "QmTestCID");
        assert_eq!(decoded.commitment_hash, [99u8; 32]);
    }
}
