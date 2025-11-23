use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{UnorderedMap, Vector};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, BorshStorageKey, PanicOnDefault};

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    Evidences,
    EvidencesByBoard,
    BoardMembers,
    Verifications,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct EvidenceRecord {
    pub evidence_id: String,
    pub ipfs_cid: String,
    pub board_id: String,
    pub commitment_hash: Vec<u8>,
    pub zcash_txid: String,
    pub zcash_block_height: u64,
    pub frost_signatures: Vec<FrostSignature>,
    pub registered_by: AccountId,
    pub registered_at: u64,
    pub status: EvidenceStatus,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct FrostSignature {
    pub participant_id: u16,
    pub signature: Vec<u8>,
    pub public_key: Vec<u8>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub enum EvidenceStatus {
    Pending,
    Verified,
    Rejected,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VerificationEvent {
    pub evidence_id: String,
    pub verifier: AccountId,
    pub result: bool,
    pub timestamp: u64,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct EvidenceRegistry {
    evidences: UnorderedMap<String, EvidenceRecord>,
    evidences_by_board: UnorderedMap<String, Vector<String>>,
    board_members: UnorderedMap<String, Vector<AccountId>>,
    verifications: UnorderedMap<String, Vector<VerificationEvent>>,
    owner: AccountId,
}

#[near_bindgen]
impl EvidenceRegistry {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            evidences: UnorderedMap::new(StorageKey::Evidences),
            evidences_by_board: UnorderedMap::new(StorageKey::EvidencesByBoard),
            board_members: UnorderedMap::new(StorageKey::BoardMembers),
            verifications: UnorderedMap::new(StorageKey::Verifications),
            owner,
        }
    }

    #[payable]
    pub fn register_evidence(
        &mut self,
        evidence_id: String,
        ipfs_cid: String,
        board_id: String,
        commitment_hash: Vec<u8>,
        zcash_txid: String,
        zcash_block_height: u64,
        frost_signatures: Vec<FrostSignature>,
    ) {
        assert!(
            commitment_hash.len() == 32,
            "Invalid commitment hash length"
        );

        assert!(
            frost_signatures.len() >= 3,
            "Minimum 3 FROST signatures required"
        );

        assert!(
            !self.evidences.get(&evidence_id).is_some(),
            "Evidence already registered"
        );

        let record = EvidenceRecord {
            evidence_id: evidence_id.clone(),
            ipfs_cid,
            board_id: board_id.clone(),
            commitment_hash,
            zcash_txid,
            zcash_block_height,
            frost_signatures,
            registered_by: env::predecessor_account_id(),
            registered_at: env::block_timestamp(),
            status: EvidenceStatus::Pending,
        };

        self.evidences.insert(&evidence_id, &record);

        let mut board_evidences = self
            .evidences_by_board
            .get(&board_id)
            .unwrap_or_else(|| Vector::new(b"b".to_vec()));

        board_evidences.push(&evidence_id);
        self.evidences_by_board.insert(&board_id, &board_evidences);

        env::log_str(&format!(
            "Evidence registered: {} for board {}",
            evidence_id, board_id
        ));
    }

    pub fn get_evidence(&self, evidence_id: String) -> Option<EvidenceRecord> {
        self.evidences.get(&evidence_id)
    }

    pub fn get_evidences_by_board(
        &self,
        board_id: String,
        from_index: u64,
        limit: u64,
    ) -> Vec<EvidenceRecord> {
        let evidence_ids = self.evidences_by_board.get(&board_id);

        if evidence_ids.is_none() {
            return Vec::new();
        }

        let evidence_ids = evidence_ids.unwrap();
        let start = from_index as usize;
        let end = std::cmp::min(start + limit as usize, evidence_ids.len() as usize);

        (start..end)
            .filter_map(|i| {
                let id = evidence_ids.get(i as u64)?;
                self.evidences.get(&id)
            })
            .collect()
    }

    pub fn verify_evidence_commitment(
        &self,
        evidence_id: String,
        expected_hash: Vec<u8>,
    ) -> bool {
        if let Some(record) = self.evidences.get(&evidence_id) {
            record.commitment_hash == expected_hash
        } else {
            false
        }
    }

    #[payable]
    pub fn submit_verification(
        &mut self,
        evidence_id: String,
        result: bool,
    ) {
        assert!(
            self.evidences.get(&evidence_id).is_some(),
            "Evidence not found"
        );

        let verification = VerificationEvent {
            evidence_id: evidence_id.clone(),
            verifier: env::predecessor_account_id(),
            result,
            timestamp: env::block_timestamp(),
        };

        let mut verifications = self
            .verifications
            .get(&evidence_id)
            .unwrap_or_else(|| Vector::new(b"v".to_vec()));

        verifications.push(&verification);
        self.verifications.insert(&evidence_id, &verifications);

        if result {
            if let Some(mut record) = self.evidences.get(&evidence_id) {
                record.status = EvidenceStatus::Verified;
                self.evidences.insert(&evidence_id, &record);
            }
        }

        env::log_str(&format!(
            "Verification submitted for {}: {}",
            evidence_id, result
        ));
    }

    pub fn get_verifications(&self, evidence_id: String) -> Vec<VerificationEvent> {
        self.verifications
            .get(&evidence_id)
            .map(|v| (0..v.len()).filter_map(|i| v.get(i)).collect())
            .unwrap_or_default()
    }

    pub fn get_total_evidences(&self) -> u64 {
        self.evidences.len()
    }

    pub fn get_board_evidence_count(&self, board_id: String) -> u64 {
        self.evidences_by_board
            .get(&board_id)
            .map(|v| v.len())
            .unwrap_or(0)
    }

    pub fn search_by_zcash_txid(&self, zcash_txid: String) -> Option<EvidenceRecord> {
        for evidence_id in self.evidences.keys() {
            if let Some(record) = self.evidences.get(&evidence_id) {
                if record.zcash_txid == zcash_txid {
                    return Some(record);
                }
            }
        }
        None
    }

    #[payable]
    pub fn add_board_member(&mut self, board_id: String, member: AccountId) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "Only owner can add board members"
        );

        let mut members = self
            .board_members
            .get(&board_id)
            .unwrap_or_else(|| Vector::new(b"m".to_vec()));

        members.push(&member);
        self.board_members.insert(&board_id, &members);
    }

    pub fn get_board_members(&self, board_id: String) -> Vec<AccountId> {
        self.board_members
            .get(&board_id)
            .map(|v| (0..v.len()).filter_map(|i| v.get(i)).collect())
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, VMContext};

    fn get_context(predecessor_account_id: AccountId) -> VMContext {
        VMContextBuilder::new()
            .predecessor_account_id(predecessor_account_id)
            .build()
    }

    #[test]
    fn test_register_evidence() {
        let context = get_context(accounts(0));
        testing_env!(context);

        let mut contract = EvidenceRegistry::new(accounts(0));

        let frost_sigs = vec![
            FrostSignature {
                participant_id: 1,
                signature: vec![1, 2, 3],
                public_key: vec![4, 5, 6],
            },
            FrostSignature {
                participant_id: 2,
                signature: vec![7, 8, 9],
                public_key: vec![10, 11, 12],
            },
            FrostSignature {
                participant_id: 3,
                signature: vec![13, 14, 15],
                public_key: vec![16, 17, 18],
            },
        ];

        contract.register_evidence(
            "evidence-001".to_string(),
            "QmTest123".to_string(),
            "healthcare".to_string(),
            vec![0u8; 32],
            "zcash-txid-123".to_string(),
            100000,
            frost_sigs,
        );

        let evidence = contract.get_evidence("evidence-001".to_string());
        assert!(evidence.is_some());

        let evidence = evidence.unwrap();
        assert_eq!(evidence.evidence_id, "evidence-001");
        assert_eq!(evidence.ipfs_cid, "QmTest123");
        assert_eq!(evidence.board_id, "healthcare");
    }

    #[test]
    fn test_verify_commitment() {
        let context = get_context(accounts(0));
        testing_env!(context);

        let mut contract = EvidenceRegistry::new(accounts(0));

        let commitment_hash = vec![1u8; 32];

        let frost_sigs = vec![
            FrostSignature {
                participant_id: 1,
                signature: vec![1, 2, 3],
                public_key: vec![4, 5, 6],
            },
            FrostSignature {
                participant_id: 2,
                signature: vec![7, 8, 9],
                public_key: vec![10, 11, 12],
            },
            FrostSignature {
                participant_id: 3,
                signature: vec![13, 14, 15],
                public_key: vec![16, 17, 18],
            },
        ];

        contract.register_evidence(
            "evidence-002".to_string(),
            "QmTest456".to_string(),
            "corporate".to_string(),
            commitment_hash.clone(),
            "zcash-txid-456".to_string(),
            200000,
            frost_sigs,
        );

        assert!(contract.verify_evidence_commitment(
            "evidence-002".to_string(),
            commitment_hash
        ));

        assert!(!contract.verify_evidence_commitment(
            "evidence-002".to_string(),
            vec![2u8; 32]
        ));
    }
}
