use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{UnorderedMap, Vector};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, require, AccountId, BorshStorageKey, PanicOnDefault, Promise, PromiseError, NearToken, Gas};

type Balance = u128;

#[derive(BorshSerialize, BorshStorageKey)]
pub enum StorageKey {
    Agents,
    Tasks,
    TaskAssignments,
    CompletedTasks,
    AgentStakes,
    DisputedTasks,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
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

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub enum TaskStatus {
    Open,
    Assigned,
    UnderReview,
    Verified,
    Disputed,
    Rejected,
    Completed,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub enum VerificationResult {
    Authentic,
    Suspicious,
    Fabricated,
    NeedsMoreData,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct AgentProfile {
    pub agent_id: AccountId,
    pub specialization: Vec<BoardCategory>,
    pub reputation: u64,
    pub verifications_completed: u64,
    pub verifications_disputed: u64,
    pub stake_amount: U128,
    pub zcash_address: String,
    pub registration_timestamp: u64,
    pub is_active: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct VerificationTask {
    pub task_id: u64,
    pub evidence_id: String,
    pub zcash_txid: String,
    pub ipfs_cid: String,
    pub board: BoardCategory,
    pub payment_disclosure_proof: String,
    pub status: TaskStatus,
    pub assigned_to: Option<AccountId>,
    pub created_at: u64,
    pub assigned_at: Option<u64>,
    pub completed_at: Option<u64>,
    pub reward_amount: U128,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct VerificationSubmission {
    pub task_id: u64,
    pub agent_id: AccountId,
    pub result: VerificationResult,
    pub confidence_score: u8,
    pub evidence_analysis: String,
    pub metadata_check: bool,
    pub timestamp_check: bool,
    pub disclosure_valid: bool,
    pub ipfs_accessible: bool,
    pub submitted_at: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ChainSignatureRequest {
    pub payload: Vec<u8>,
    pub path: String,
    pub key_version: u32,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct RewardPayment {
    pub agent_id: AccountId,
    pub zcash_address: String,
    pub amount_near: U128,
    pub amount_zec: U128,
    pub task_id: u64,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct AIAgentCoordinator {
    agents: UnorderedMap<AccountId, AgentProfile>,
    tasks: Vector<VerificationTask>,
    task_assignments: UnorderedMap<u64, AccountId>,
    completed_tasks: UnorderedMap<u64, VerificationSubmission>,
    agent_stakes: UnorderedMap<AccountId, Balance>,
    disputed_tasks: Vector<u64>,
    next_task_id: u64,
    min_stake_amount: Balance,
    reward_per_verification: Balance,
    chain_signatures_contract: AccountId,
    intents_verifier: AccountId,
    evidence_indexer: AccountId,
}

#[near_bindgen]
impl AIAgentCoordinator {
    #[init]
    pub fn new(
        chain_signatures: AccountId,
        intents_verifier: AccountId,
        evidence_indexer: AccountId,
        min_stake: U128,
        reward_amount: U128,
    ) -> Self {
        Self {
            agents: UnorderedMap::new(StorageKey::Agents),
            tasks: Vector::new(StorageKey::Tasks),
            task_assignments: UnorderedMap::new(StorageKey::TaskAssignments),
            completed_tasks: UnorderedMap::new(StorageKey::CompletedTasks),
            agent_stakes: UnorderedMap::new(StorageKey::AgentStakes),
            disputed_tasks: Vector::new(StorageKey::DisputedTasks),
            next_task_id: 0,
            min_stake_amount: min_stake.0,
            reward_per_verification: reward_amount.0,
            chain_signatures_contract: chain_signatures,
            intents_verifier,
            evidence_indexer,
        }
    }

    #[payable]
    pub fn register_agent(
        &mut self,
        specialization: Vec<BoardCategory>,
        zcash_address: String,
    ) {
        let agent_id = env::predecessor_account_id();
        let stake = env::attached_deposit().as_yoctonear();

        require!(
            stake >= self.min_stake_amount,
            format!("Minimum stake required: {}", self.min_stake_amount)
        );

        require!(
            !self.agents.get(&agent_id).is_some(),
            "Agent already registered"
        );

        require!(
            !specialization.is_empty(),
            "Must specify at least one board specialization"
        );

        let profile = AgentProfile {
            agent_id: agent_id.clone(),
            specialization,
            reputation: 100,
            verifications_completed: 0,
            verifications_disputed: 0,
            stake_amount: U128(stake),
            zcash_address,
            registration_timestamp: env::block_timestamp(),
            is_active: true,
        };

        self.agents.insert(&agent_id, &profile);
        self.agent_stakes.insert(&agent_id, &stake);

        env::log_str(&format!(
            "Agent registered: {} with stake: {}",
            agent_id, stake
        ));
    }

    pub fn create_verification_task(
        &mut self,
        evidence_id: String,
        zcash_txid: String,
        ipfs_cid: String,
        board: BoardCategory,
        payment_disclosure_proof: String,
    ) -> u64 {
        let task = VerificationTask {
            task_id: self.next_task_id,
            evidence_id,
            zcash_txid,
            ipfs_cid,
            board,
            payment_disclosure_proof,
            status: TaskStatus::Open,
            assigned_to: None,
            created_at: env::block_timestamp(),
            assigned_at: None,
            completed_at: None,
            reward_amount: U128(self.reward_per_verification),
        };

        self.tasks.push(&task);
        let task_id = self.next_task_id;
        self.next_task_id += 1;

        env::log_str(&format!(
            "Verification task created: {} for evidence: {}",
            task_id, task.evidence_id
        ));

        task_id
    }

    pub fn claim_task(&mut self, task_id: u64) {
        let agent_id = env::predecessor_account_id();

        require!(
            self.agents.get(&agent_id).is_some(),
            "Agent not registered"
        );

        let agent = self.agents.get(&agent_id).unwrap();
        require!(agent.is_active, "Agent is not active");

        require!(
            task_id < self.tasks.len(),
            "Task does not exist"
        );

        let mut task = self.tasks.get(task_id).unwrap();

        require!(
            task.status == TaskStatus::Open,
            "Task is not available"
        );

        require!(
            agent.specialization.contains(&task.board),
            "Agent not specialized for this board"
        );

        task.status = TaskStatus::Assigned;
        task.assigned_to = Some(agent_id.clone());
        task.assigned_at = Some(env::block_timestamp());

        self.tasks.replace(task_id, &task);
        self.task_assignments.insert(&task_id, &agent_id);

        env::log_str(&format!(
            "Task {} assigned to agent {}",
            task_id, agent_id
        ));
    }

    pub fn submit_verification(
        &mut self,
        task_id: u64,
        result: VerificationResult,
        confidence_score: u8,
        evidence_analysis: String,
        metadata_check: bool,
        timestamp_check: bool,
        disclosure_valid: bool,
        ipfs_accessible: bool,
    ) -> Promise {
        let agent_id = env::predecessor_account_id();

        require!(
            task_id < self.tasks.len(),
            "Task does not exist"
        );

        let mut task = self.tasks.get(task_id).unwrap();

        require!(
            task.assigned_to == Some(agent_id.clone()),
            "Task not assigned to this agent"
        );

        require!(
            task.status == TaskStatus::Assigned,
            "Task is not in assigned status"
        );

        require!(
            confidence_score <= 100,
            "Confidence score must be 0-100"
        );

        let submission = VerificationSubmission {
            task_id,
            agent_id: agent_id.clone(),
            result: result.clone(),
            confidence_score,
            evidence_analysis,
            metadata_check,
            timestamp_check,
            disclosure_valid,
            ipfs_accessible,
            submitted_at: env::block_timestamp(),
        };

        task.status = TaskStatus::UnderReview;
        self.tasks.replace(task_id, &task);
        self.completed_tasks.insert(&task_id, &submission);

        env::log_str(&format!(
            "Verification submitted for task {} by agent {}",
            task_id, agent_id
        ));

        self.process_verification_result(task_id, submission)
    }

    fn process_verification_result(
        &mut self,
        task_id: u64,
        submission: VerificationSubmission,
    ) -> Promise {
        let mut task = self.tasks.get(task_id).unwrap();
        let mut agent = self.agents.get(&submission.agent_id).unwrap();

        let is_verified = matches!(submission.result, VerificationResult::Authentic)
            && submission.confidence_score >= 80
            && submission.metadata_check
            && submission.timestamp_check
            && submission.disclosure_valid
            && submission.ipfs_accessible;

        if is_verified {
            task.status = TaskStatus::Verified;
            task.completed_at = Some(env::block_timestamp());

            agent.verifications_completed += 1;
            agent.reputation = std::cmp::min(agent.reputation + 10, 1000);

            self.tasks.replace(task_id, &task);
            self.agents.insert(&submission.agent_id, &agent);

            let verification_status = if is_verified { "Verified" } else { "Rejected" };

            env::log_str(&format!(
                "Task {} completed: {} by agent {}",
                task_id, verification_status, submission.agent_id
            ));

            Promise::new(self.evidence_indexer.clone())
                .function_call(
                    "update_verification_status".to_string(),
                    serde_json::json!({
                        "evidence_id": task.evidence_id,
                        "status": verification_status,
                    })
                    .to_string()
                    .into_bytes(),
                    NearToken::from_yoctonear(0),
                    Gas::from_tgas(5),
                )
                .then(
                    Promise::new(env::current_account_id())
                        .function_call(
                            "on_evidence_updated".to_string(),
                            serde_json::json!({
                                "task_id": task_id,
                                "agent_id": submission.agent_id,
                            })
                            .to_string()
                            .into_bytes(),
                            NearToken::from_yoctonear(0),
                            Gas::from_tgas(5),
                        )
                )
        } else {
            task.status = TaskStatus::Rejected;
            task.completed_at = Some(env::block_timestamp());

            agent.reputation = agent.reputation.saturating_sub(5);

            self.tasks.replace(task_id, &task);
            self.agents.insert(&submission.agent_id, &agent);

            env::log_str(&format!(
                "Task {} rejected: insufficient verification",
                task_id
            ));

            Promise::new(env::current_account_id())
        }
    }

    #[private]
    pub fn on_evidence_updated(
        &mut self,
        #[callback_result] call_result: Result<(), PromiseError>,
        task_id: u64,
        agent_id: AccountId,
    ) {
        if call_result.is_ok() {
            env::log_str(&format!(
                "Evidence indexer updated for task {}",
                task_id
            ));

            let agent = self.agents.get(&agent_id).unwrap();
            let task = self.tasks.get(task_id).unwrap();

            self.pay_agent_reward(agent_id, agent.zcash_address, task.reward_amount.0, task_id);
        } else {
            env::log_str(&format!(
                "Failed to update evidence indexer for task {}",
                task_id
            ));
        }
    }

    fn pay_agent_reward(
        &self,
        agent_id: AccountId,
        zcash_address: String,
        reward_amount: Balance,
        task_id: u64,
    ) {
        let intent_data = serde_json::json!({
            "from_currency": "NEAR",
            "to_currency": "ZEC",
            "amount": U128(reward_amount),
            "recipient_address": zcash_address,
            "solver_address": "zcash-solver.near",
        });

        env::log_str(&format!(
            "Paying agent {} reward of {} NEAR -> ZEC for task {}",
            agent_id, reward_amount, task_id
        ));

        Promise::new(self.intents_verifier.clone())
            .function_call(
                "execute_intent".to_string(),
                intent_data.to_string().into_bytes(),
                NearToken::from_yoctonear(reward_amount),
                Gas::from_tgas(5),
            )
            .then(
                Promise::new(env::current_account_id())
                    .function_call(
                        "on_reward_paid".to_string(),
                        serde_json::json!({
                            "agent_id": agent_id,
                            "task_id": task_id,
                            "amount": U128(reward_amount),
                        })
                        .to_string()
                        .into_bytes(),
                        NearToken::from_yoctonear(0),
                        Gas::from_tgas(5),
                    )
            );
    }

    #[private]
    pub fn on_reward_paid(
        &mut self,
        #[callback_result] call_result: Result<(), PromiseError>,
        agent_id: AccountId,
        task_id: u64,
        amount: U128,
    ) {
        if call_result.is_ok() {
            env::log_str(&format!(
                "Reward paid successfully: {} ZEC to agent {} for task {}",
                amount.0, agent_id, task_id
            ));

            let mut task = self.tasks.get(task_id).unwrap();
            task.status = TaskStatus::Completed;
            self.tasks.replace(task_id, &task);
        } else {
            env::log_str(&format!(
                "Reward payment failed for agent {}, task {}. Refunding NEAR.",
                agent_id, task_id
            ));

            Promise::new(agent_id).transfer(NearToken::from_yoctonear(amount.0));
        }
    }

    pub fn dispute_verification(&mut self, task_id: u64, reason: String) {
        require!(
            task_id < self.tasks.len(),
            "Task does not exist"
        );

        let mut task = self.tasks.get(task_id).unwrap();

        require!(
            matches!(task.status, TaskStatus::Verified | TaskStatus::Completed),
            "Task cannot be disputed in current status"
        );

        task.status = TaskStatus::Disputed;
        self.tasks.replace(task_id, &task);
        self.disputed_tasks.push(&task_id);

        if let Some(agent_id) = task.assigned_to.as_ref() {
            let mut agent = self.agents.get(agent_id).unwrap();
            agent.verifications_disputed += 1;
            agent.reputation = agent.reputation.saturating_sub(20);
            self.agents.insert(agent_id, &agent);
        }

        env::log_str(&format!(
            "Task {} disputed: {}",
            task_id, reason
        ));
    }

    pub fn deactivate_agent(&mut self) {
        let agent_id = env::predecessor_account_id();

        require!(
            self.agents.get(&agent_id).is_some(),
            "Agent not registered"
        );

        let mut agent = self.agents.get(&agent_id).unwrap();
        agent.is_active = false;
        self.agents.insert(&agent_id, &agent);

        let stake = self.agent_stakes.get(&agent_id).unwrap_or(0);
        if stake > 0 {
            self.agent_stakes.remove(&agent_id);
            Promise::new(agent_id.clone()).transfer(NearToken::from_yoctonear(stake));

            env::log_str(&format!(
                "Agent {} deactivated, stake {} refunded",
                agent_id, stake
            ));
        }
    }

    pub fn get_agent_profile(&self, agent_id: AccountId) -> Option<AgentProfile> {
        self.agents.get(&agent_id)
    }

    pub fn get_task(&self, task_id: u64) -> Option<VerificationTask> {
        if task_id < self.tasks.len() {
            self.tasks.get(task_id)
        } else {
            None
        }
    }

    pub fn get_open_tasks(&self, board: Option<BoardCategory>, limit: u64) -> Vec<VerificationTask> {
        let mut results = Vec::new();
        let max_items = std::cmp::min(limit, self.tasks.len());

        for i in 0..max_items {
            if let Some(task) = self.tasks.get(i) {
                if task.status == TaskStatus::Open {
                    if let Some(ref filter_board) = board {
                        if &task.board == filter_board {
                            results.push(task);
                        }
                    } else {
                        results.push(task);
                    }
                }
            }
        }

        results
    }

    pub fn get_agent_tasks(&self, agent_id: AccountId) -> Vec<VerificationTask> {
        let mut results = Vec::new();

        for i in 0..self.tasks.len() {
            if let Some(task) = self.tasks.get(i) {
                if task.assigned_to.as_ref() == Some(&agent_id) {
                    results.push(task);
                }
            }
        }

        results
    }

    pub fn get_verification_submission(&self, task_id: u64) -> Option<VerificationSubmission> {
        self.completed_tasks.get(&task_id)
    }

    pub fn get_total_agents(&self) -> u64 {
        self.agents.len()
    }

    pub fn get_total_tasks(&self) -> u64 {
        self.tasks.len()
    }

    pub fn get_disputed_tasks(&self) -> Vec<u64> {
        let mut results = Vec::new();
        for i in 0..self.disputed_tasks.len() {
            if let Some(task_id) = self.disputed_tasks.get(i) {
                results.push(task_id);
            }
        }
        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{VMContextBuilder, accounts};
    use near_sdk::{testing_env, VMContext};

    fn get_context(predecessor: AccountId) -> VMContext {
        VMContextBuilder::new()
            .predecessor_account_id(predecessor)
            .build()
    }

    #[test]
    fn test_agent_registration() {
        let alice = accounts(0);
        let chain_sig = accounts(1);
        let intents = accounts(2);
        let indexer = accounts(3);

        let context = get_context(alice.clone());
        testing_env!(context);

        let mut contract = AIAgentCoordinator::new(
            chain_sig,
            intents,
            indexer,
            U128(1_000_000_000_000_000_000_000_000),
            U128(100_000_000_000_000_000_000_000),
        );

        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(alice.clone())
            .attached_deposit(NearToken::from_yoctonear(1_000_000_000_000_000_000_000_000))
            .build());

        contract.register_agent(
            vec![BoardCategory::Healthcare],
            "zs1test123".to_string(),
        );

        let profile = contract.get_agent_profile(alice).unwrap();
        assert_eq!(profile.specialization.len(), 1);
        assert_eq!(profile.reputation, 100);
        assert_eq!(profile.verifications_completed, 0);
        assert!(profile.is_active);
    }

    #[test]
    fn test_create_and_claim_task() {
        let alice = accounts(0);
        let chain_sig = accounts(1);
        let intents = accounts(2);
        let indexer = accounts(3);

        testing_env!(get_context(alice.clone()));

        let mut contract = AIAgentCoordinator::new(
            chain_sig,
            intents,
            indexer,
            U128(1_000_000_000_000_000_000_000_000),
            U128(100_000_000_000_000_000_000_000),
        );

        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(alice.clone())
            .attached_deposit(NearToken::from_yoctonear(1_000_000_000_000_000_000_000_000))
            .build());

        contract.register_agent(
            vec![BoardCategory::Healthcare],
            "zs1test".to_string(),
        );

        testing_env!(get_context(alice.clone()));

        let task_id = contract.create_verification_task(
            "evidence_001".to_string(),
            "tx123".to_string(),
            "bafkreiabc".to_string(),
            BoardCategory::Healthcare,
            "proof_data".to_string(),
        );

        assert_eq!(task_id, 0);

        contract.claim_task(task_id);

        let task = contract.get_task(task_id).unwrap();
        assert_eq!(task.status, TaskStatus::Assigned);
        assert_eq!(task.assigned_to, Some(alice.clone()));
    }

    #[test]
    fn test_submit_verification() {
        let alice = accounts(0);
        let chain_sig = accounts(1);
        let intents = accounts(2);
        let indexer = accounts(3);

        testing_env!(get_context(alice.clone()));

        let mut contract = AIAgentCoordinator::new(
            chain_sig,
            intents,
            indexer,
            U128(1_000_000_000_000_000_000_000_000),
            U128(100_000_000_000_000_000_000_000),
        );

        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(alice.clone())
            .attached_deposit(NearToken::from_yoctonear(1_000_000_000_000_000_000_000_000))
            .build());

        contract.register_agent(
            vec![BoardCategory::Healthcare],
            "zs1test".to_string(),
        );

        testing_env!(get_context(alice.clone()));

        let task_id = contract.create_verification_task(
            "evidence_001".to_string(),
            "tx123".to_string(),
            "bafkreiabc".to_string(),
            BoardCategory::Healthcare,
            "proof_data".to_string(),
        );

        contract.claim_task(task_id);

        contract.submit_verification(
            task_id,
            VerificationResult::Authentic,
            95,
            "Evidence verified through multiple checks".to_string(),
            true,
            true,
            true,
            true,
        );

        let task = contract.get_task(task_id).unwrap();
        assert_eq!(task.status, TaskStatus::Verified);

        let submission = contract.get_verification_submission(task_id).unwrap();
        assert_eq!(submission.confidence_score, 95);
        assert_eq!(submission.result, VerificationResult::Authentic);
    }

    #[test]
    fn test_reputation_system() {
        let alice = accounts(0);
        let chain_sig = accounts(1);
        let intents = accounts(2);
        let indexer = accounts(3);

        testing_env!(get_context(alice.clone()));

        let mut contract = AIAgentCoordinator::new(
            chain_sig,
            intents,
            indexer,
            U128(1_000_000_000_000_000_000_000_000),
            U128(100_000_000_000_000_000_000_000),
        );

        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(alice.clone())
            .attached_deposit(NearToken::from_yoctonear(1_000_000_000_000_000_000_000_000))
            .build());

        contract.register_agent(
            vec![BoardCategory::Healthcare],
            "zs1test".to_string(),
        );

        let initial_reputation = contract.get_agent_profile(alice.clone()).unwrap().reputation;
        assert_eq!(initial_reputation, 100);

        testing_env!(get_context(alice.clone()));

        let task_id = contract.create_verification_task(
            "evidence_001".to_string(),
            "tx123".to_string(),
            "bafkreiabc".to_string(),
            BoardCategory::Healthcare,
            "proof_data".to_string(),
        );

        contract.claim_task(task_id);

        contract.submit_verification(
            task_id,
            VerificationResult::Authentic,
            95,
            "Verified".to_string(),
            true,
            true,
            true,
            true,
        );

        let updated_profile = contract.get_agent_profile(alice).unwrap();
        assert_eq!(updated_profile.reputation, 110);
        assert_eq!(updated_profile.verifications_completed, 1);
    }

    #[test]
    fn test_get_open_tasks() {
        let alice = accounts(0);
        let chain_sig = accounts(1);
        let intents = accounts(2);
        let indexer = accounts(3);

        testing_env!(get_context(alice.clone()));

        let mut contract = AIAgentCoordinator::new(
            chain_sig,
            intents,
            indexer,
            U128(1_000_000_000_000_000_000_000_000),
            U128(100_000_000_000_000_000_000_000),
        );

        contract.create_verification_task(
            "evidence_001".to_string(),
            "tx1".to_string(),
            "cid1".to_string(),
            BoardCategory::Healthcare,
            "proof1".to_string(),
        );

        contract.create_verification_task(
            "evidence_002".to_string(),
            "tx2".to_string(),
            "cid2".to_string(),
            BoardCategory::Healthcare,
            "proof2".to_string(),
        );

        contract.create_verification_task(
            "evidence_003".to_string(),
            "tx3".to_string(),
            "cid3".to_string(),
            BoardCategory::Media,
            "proof3".to_string(),
        );

        let all_tasks = contract.get_open_tasks(None, 10);
        assert_eq!(all_tasks.len(), 3);

        let healthcare_tasks = contract.get_open_tasks(Some(BoardCategory::Healthcare), 10);
        assert_eq!(healthcare_tasks.len(), 2);

        let media_tasks = contract.get_open_tasks(Some(BoardCategory::Media), 10);
        assert_eq!(media_tasks.len(), 1);
    }

    #[test]
    fn test_dispute_verification() {
        let alice = accounts(0);
        let bob = accounts(1);
        let chain_sig = accounts(2);
        let intents = accounts(3);
        let indexer = accounts(4);

        testing_env!(get_context(alice.clone()));

        let mut contract = AIAgentCoordinator::new(
            chain_sig,
            intents,
            indexer,
            U128(1_000_000_000_000_000_000_000_000),
            U128(100_000_000_000_000_000_000_000),
        );

        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(alice.clone())
            .attached_deposit(NearToken::from_yoctonear(1_000_000_000_000_000_000_000_000))
            .build());

        contract.register_agent(
            vec![BoardCategory::Healthcare],
            "zs1test".to_string(),
        );

        testing_env!(get_context(alice.clone()));

        let task_id = contract.create_verification_task(
            "evidence_001".to_string(),
            "tx123".to_string(),
            "bafkreiabc".to_string(),
            BoardCategory::Healthcare,
            "proof_data".to_string(),
        );

        contract.claim_task(task_id);

        contract.submit_verification(
            task_id,
            VerificationResult::Authentic,
            95,
            "Verified".to_string(),
            true,
            true,
            true,
            true,
        );

        let reputation_before = contract.get_agent_profile(alice.clone()).unwrap().reputation;

        testing_env!(get_context(bob));

        contract.dispute_verification(
            task_id,
            "Evidence appears fabricated".to_string(),
        );

        let task = contract.get_task(task_id).unwrap();
        assert_eq!(task.status, TaskStatus::Disputed);

        let reputation_after = contract.get_agent_profile(alice).unwrap().reputation;
        assert!(reputation_after < reputation_before);

        let disputed = contract.get_disputed_tasks();
        assert_eq!(disputed.len(), 1);
        assert_eq!(disputed[0], task_id);
    }

    #[test]
    fn test_agent_deactivation() {
        let alice = accounts(0);
        let chain_sig = accounts(1);
        let intents = accounts(2);
        let indexer = accounts(3);

        testing_env!(get_context(alice.clone()));

        let mut contract = AIAgentCoordinator::new(
            chain_sig,
            intents,
            indexer,
            U128(1_000_000_000_000_000_000_000_000),
            U128(100_000_000_000_000_000_000_000),
        );

        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(alice.clone())
            .attached_deposit(NearToken::from_yoctonear(1_000_000_000_000_000_000_000_000))
            .build());

        contract.register_agent(
            vec![BoardCategory::Healthcare],
            "zs1test".to_string(),
        );

        assert!(contract.get_agent_profile(alice.clone()).unwrap().is_active);

        testing_env!(get_context(alice.clone()));

        contract.deactivate_agent();

        assert!(!contract.get_agent_profile(alice).unwrap().is_active);
    }
}
