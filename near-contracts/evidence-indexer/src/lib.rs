use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, BorshStorageKey, PanicOnDefault};

#[derive(BorshSerialize, BorshStorageKey)]
pub enum StorageKey {
    EvidenceMetadata,
    BoardEvidence,
    VerificationStatus,
    Anchors,
    Nullifiers,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum BoardCategory {
    Healthcare,
    Media,
    Legal,
    Government,
    Corporate,
    Education,
    Environment,
    CivilSociety,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum VerificationStatus {
    Pending,
    Verified,
    Disputed,
    Rejected,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct EvidenceMetadata {
    pub zcash_txid: String,
    pub ipfs_cid: String,
    pub board: BoardCategory,
    pub timestamp: u64,
    pub block_height: u32,
    pub anchor_root: String,
    pub verification_status: VerificationStatus,
    pub indexed_at: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PaymentDisclosureProof {
    pub txid: String,
    pub proof_data: String,
    pub public_inputs: String,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct EvidenceIndexer {
    evidence_metadata: UnorderedMap<String, EvidenceMetadata>,
    board_evidence: LookupMap<BoardCategory, Vector<String>>,
    verification_status: LookupMap<String, VerificationStatus>,
    anchor_roots: LookupMap<u32, String>,
    nullifiers: LookupMap<String, bool>,
}

#[near_bindgen]
impl EvidenceIndexer {
    #[init]
    pub fn new() -> Self {
        Self {
            evidence_metadata: UnorderedMap::new(StorageKey::EvidenceMetadata),
            board_evidence: LookupMap::new(StorageKey::BoardEvidence),
            verification_status: LookupMap::new(StorageKey::VerificationStatus),
            anchor_roots: LookupMap::new(StorageKey::Anchors),
            nullifiers: LookupMap::new(StorageKey::Nullifiers),
        }
    }

    pub fn index_evidence(
        &mut self,
        evidence_id: String,
        zcash_txid: String,
        payment_disclosure: PaymentDisclosureProof,
        ipfs_cid: String,
        board: BoardCategory,
        block_height: u32,
        anchor_root: String,
    ) {
        require!(
            self.verify_payment_disclosure(&payment_disclosure),
            "Invalid payment disclosure proof"
        );

        require!(
            !self.evidence_metadata.get(&evidence_id).is_some(),
            "Evidence already indexed"
        );

        let metadata = EvidenceMetadata {
            zcash_txid,
            ipfs_cid,
            board: board.clone(),
            timestamp: env::block_timestamp(),
            block_height,
            anchor_root: anchor_root.clone(),
            verification_status: VerificationStatus::Pending,
            indexed_at: env::block_timestamp(),
        };

        self.evidence_metadata.insert(&evidence_id, &metadata);
        self.anchor_roots.insert(&block_height, &anchor_root);

        let board_key = board.clone();
        let mut evidence_list = self.board_evidence
            .get(&board_key)
            .unwrap_or_else(|| Vector::new(format!("board_{:?}", board_key).as_bytes()));

        evidence_list.push(&evidence_id);
        self.board_evidence.insert(&board_key, &evidence_list);

        env::log_str(&format!("Evidence indexed: {} on board {:?}", evidence_id, board));
    }

    pub fn verify_payment_disclosure(&self, proof: &PaymentDisclosureProof) -> bool {
        let txid_bytes = hex::decode(&proof.txid).unwrap_or_default();
        let proof_bytes = hex::decode(&proof.proof_data).unwrap_or_default();

        if txid_bytes.len() != 32 || proof_bytes.is_empty() {
            return false;
        }

        true
    }

    pub fn update_verification_status(
        &mut self,
        evidence_id: String,
        status: VerificationStatus,
    ) {
        let mut metadata = self.evidence_metadata
            .get(&evidence_id)
            .expect("Evidence not found");

        metadata.verification_status = status.clone();
        self.evidence_metadata.insert(&evidence_id, &metadata);
        self.verification_status.insert(&evidence_id, &status);

        env::log_str(&format!("Verification status updated: {} -> {:?}", evidence_id, status));
    }

    pub fn get_evidence(&self, evidence_id: String) -> Option<EvidenceMetadata> {
        self.evidence_metadata.get(&evidence_id)
    }

    pub fn get_evidence_by_board(&self, board: BoardCategory, from_index: u64, limit: u64) -> Vec<EvidenceMetadata> {
        let evidence_list = self.board_evidence.get(&board);

        match evidence_list {
            Some(list) => {
                let mut results = Vec::new();
                let end = std::cmp::min(from_index + limit, list.len());

                for i in from_index..end {
                    if let Some(evidence_id) = list.get(i) {
                        if let Some(metadata) = self.evidence_metadata.get(&evidence_id) {
                            results.push(metadata);
                        }
                    }
                }

                results
            }
            None => Vec::new(),
        }
    }

    pub fn get_anchor_root(&self, block_height: u32) -> Option<String> {
        self.anchor_roots.get(&block_height)
    }

    pub fn register_nullifier(&mut self, nullifier: String) -> bool {
        if self.nullifiers.get(&nullifier).is_some() {
            return false;
        }

        self.nullifiers.insert(&nullifier, &true);
        true
    }

    pub fn check_nullifier(&self, nullifier: String) -> bool {
        self.nullifiers.get(&nullifier).unwrap_or(false)
    }

    pub fn get_total_evidence(&self) -> u64 {
        self.evidence_metadata.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{VMContextBuilder};
    use near_sdk::{testing_env, VMContext};

    fn get_context() -> VMContext {
        VMContextBuilder::new()
            .predecessor_account_id("alice.near".parse().unwrap())
            .build()
    }

    #[test]
    fn test_indexer_init() {
        let context = get_context();
        testing_env!(context);

        let contract = EvidenceIndexer::new();
        assert_eq!(contract.get_total_evidence(), 0);
    }

    #[test]
    fn test_index_evidence() {
        let context = get_context();
        testing_env!(context);

        let mut contract = EvidenceIndexer::new();

        let proof = PaymentDisclosureProof {
            txid: "a".repeat(64),
            proof_data: "proof123".to_string(),
            public_inputs: "inputs".to_string(),
        };

        contract.index_evidence(
            "evidence_001".to_string(),
            "tx123".to_string(),
            proof,
            "bafkreiabcdef".to_string(),
            BoardCategory::Healthcare,
            1000,
            "anchor_root_123".to_string(),
        );

        assert_eq!(contract.get_total_evidence(), 1);

        let metadata = contract.get_evidence("evidence_001".to_string()).unwrap();
        assert_eq!(metadata.zcash_txid, "tx123");
        assert_eq!(metadata.ipfs_cid, "bafkreiabcdef");
    }

    #[test]
    fn test_get_evidence_by_board() {
        let context = get_context();
        testing_env!(context);

        let mut contract = EvidenceIndexer::new();

        let proof = PaymentDisclosureProof {
            txid: "a".repeat(64),
            proof_data: "proof".to_string(),
            public_inputs: "inputs".to_string(),
        };

        contract.index_evidence(
            "evidence_001".to_string(),
            "tx1".to_string(),
            proof.clone(),
            "cid1".to_string(),
            BoardCategory::Healthcare,
            1000,
            "anchor1".to_string(),
        );

        contract.index_evidence(
            "evidence_002".to_string(),
            "tx2".to_string(),
            proof,
            "cid2".to_string(),
            BoardCategory::Healthcare,
            1001,
            "anchor2".to_string(),
        );

        let results = contract.get_evidence_by_board(BoardCategory::Healthcare, 0, 10);
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_nullifier_tracking() {
        let context = get_context();
        testing_env!(context);

        let mut contract = EvidenceIndexer::new();

        let nullifier = "nullifier123".to_string();

        assert!(!contract.check_nullifier(nullifier.clone()));

        assert!(contract.register_nullifier(nullifier.clone()));
        assert!(contract.check_nullifier(nullifier.clone()));

        assert!(!contract.register_nullifier(nullifier.clone()));
    }
}
