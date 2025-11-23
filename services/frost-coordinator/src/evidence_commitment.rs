use anyhow::{Result, Context, bail};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use zcash_primitives::memo::{Memo, MemoBytes};

const MEMO_VERSION: u8 = 1;
const MAX_EVIDENCE_ID_LEN: usize = 64;
const MAX_IPFS_CID_LEN: usize = 64;
const MAX_BOARD_ID_LEN: usize = 32;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceCommitment {
    pub evidence_id: String,
    pub ipfs_cid: String,
    pub board_id: String,
    pub commitment_hash: [u8; 32],
    pub timestamp: u64,
}

impl EvidenceCommitment {
    pub fn new(
        evidence_id: String,
        ipfs_cid: String,
        board_id: String,
        timestamp: u64,
    ) -> Result<Self> {
        if evidence_id.len() > MAX_EVIDENCE_ID_LEN {
            bail!("Evidence ID too long");
        }
        if ipfs_cid.len() > MAX_IPFS_CID_LEN {
            bail!("IPFS CID too long");
        }
        if board_id.len() > MAX_BOARD_ID_LEN {
            bail!("Board ID too long");
        }

        let commitment_hash = Self::compute_commitment_hash(
            &evidence_id,
            &ipfs_cid,
            &board_id,
            timestamp,
        );

        Ok(Self {
            evidence_id,
            ipfs_cid,
            board_id,
            commitment_hash,
            timestamp,
        })
    }

    pub fn compute_commitment_hash(
        evidence_id: &str,
        ipfs_cid: &str,
        board_id: &str,
        timestamp: u64,
    ) -> [u8; 32] {
        let mut hasher = Sha256::new();
        hasher.update(evidence_id.as_bytes());
        hasher.update(ipfs_cid.as_bytes());
        hasher.update(board_id.as_bytes());
        hasher.update(&timestamp.to_le_bytes());
        hasher.finalize().into()
    }

    pub fn to_memo_bytes(&self) -> Result<MemoBytes> {
        let mut memo_data = Vec::with_capacity(512);

        memo_data.push(MEMO_VERSION);

        let evidence_id_bytes = self.evidence_id.as_bytes();
        memo_data.push(evidence_id_bytes.len() as u8);
        memo_data.extend_from_slice(evidence_id_bytes);

        let ipfs_cid_bytes = self.ipfs_cid.as_bytes();
        memo_data.push(ipfs_cid_bytes.len() as u8);
        memo_data.extend_from_slice(ipfs_cid_bytes);

        let board_id_bytes = self.board_id.as_bytes();
        memo_data.push(board_id_bytes.len() as u8);
        memo_data.extend_from_slice(board_id_bytes);

        memo_data.extend_from_slice(&self.commitment_hash);

        memo_data.extend_from_slice(&self.timestamp.to_le_bytes());

        if memo_data.len() > 512 {
            bail!("Memo data exceeds 512 bytes");
        }

        memo_data.resize(512, 0);

        let memo_bytes: [u8; 512] = memo_data.try_into()
            .map_err(|_| anyhow::anyhow!("Invalid memo size"))?;

        Ok(MemoBytes::from_bytes(&memo_bytes)?)
    }

    pub fn from_memo_bytes(memo_bytes: &MemoBytes) -> Result<Self> {
        let data = memo_bytes.as_slice();

        if data.len() < 512 {
            bail!("Invalid memo length");
        }

        let mut pos = 0;

        let version = data[pos];
        if version != MEMO_VERSION {
            bail!("Unsupported memo version: {}", version);
        }
        pos += 1;

        let evidence_id_len = data[pos] as usize;
        pos += 1;
        if pos + evidence_id_len > data.len() {
            bail!("Invalid evidence ID length");
        }
        let evidence_id = String::from_utf8(data[pos..pos + evidence_id_len].to_vec())
            .context("Invalid evidence ID UTF-8")?;
        pos += evidence_id_len;

        let ipfs_cid_len = data[pos] as usize;
        pos += 1;
        if pos + ipfs_cid_len > data.len() {
            bail!("Invalid IPFS CID length");
        }
        let ipfs_cid = String::from_utf8(data[pos..pos + ipfs_cid_len].to_vec())
            .context("Invalid IPFS CID UTF-8")?;
        pos += ipfs_cid_len;

        let board_id_len = data[pos] as usize;
        pos += 1;
        if pos + board_id_len > data.len() {
            bail!("Invalid board ID length");
        }
        let board_id = String::from_utf8(data[pos..pos + board_id_len].to_vec())
            .context("Invalid board ID UTF-8")?;
        pos += board_id_len;

        if pos + 32 > data.len() {
            bail!("Invalid commitment hash position");
        }
        let mut commitment_hash = [0u8; 32];
        commitment_hash.copy_from_slice(&data[pos..pos + 32]);
        pos += 32;

        if pos + 8 > data.len() {
            bail!("Invalid timestamp position");
        }
        let mut timestamp_bytes = [0u8; 8];
        timestamp_bytes.copy_from_slice(&data[pos..pos + 8]);
        let timestamp = u64::from_le_bytes(timestamp_bytes);

        let computed_hash = Self::compute_commitment_hash(
            &evidence_id,
            &ipfs_cid,
            &board_id,
            timestamp,
        );

        if computed_hash != commitment_hash {
            bail!("Commitment hash verification failed");
        }

        Ok(Self {
            evidence_id,
            ipfs_cid,
            board_id,
            commitment_hash,
            timestamp,
        })
    }

    pub fn verify(&self) -> bool {
        let computed = Self::compute_commitment_hash(
            &self.evidence_id,
            &self.ipfs_cid,
            &self.board_id,
            self.timestamp,
        );
        computed == self.commitment_hash
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_commitment_encoding_decoding() {
        let commitment = EvidenceCommitment::new(
            "evidence-001".to_string(),
            "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG".to_string(),
            "healthcare".to_string(),
            1234567890,
        ).unwrap();

        let memo_bytes = commitment.to_memo_bytes().unwrap();
        let decoded = EvidenceCommitment::from_memo_bytes(&memo_bytes).unwrap();

        assert_eq!(commitment.evidence_id, decoded.evidence_id);
        assert_eq!(commitment.ipfs_cid, decoded.ipfs_cid);
        assert_eq!(commitment.board_id, decoded.board_id);
        assert_eq!(commitment.commitment_hash, decoded.commitment_hash);
        assert_eq!(commitment.timestamp, decoded.timestamp);
        assert!(decoded.verify());
    }

    #[test]
    fn test_commitment_verification() {
        let commitment = EvidenceCommitment::new(
            "evidence-002".to_string(),
            "QmTest123456789".to_string(),
            "corporate".to_string(),
            9876543210,
        ).unwrap();

        assert!(commitment.verify());
    }
}
