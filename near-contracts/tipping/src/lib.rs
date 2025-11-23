use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, NearToken, Gas, BorshStorageKey, PanicOnDefault, Promise, PromiseError, require};

#[derive(BorshSerialize, BorshStorageKey)]
pub enum StorageKey {
    EvidenceTips,
    TipClaims,
    IntentsRegistry,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Tip {
    pub tipper: AccountId,
    pub amount: U128,
    pub currency: String,
    pub message: String,
    pub timestamp: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TipPool {
    pub evidence_id: String,
    pub tips: Vec<Tip>,
    pub total_amount: U128,
    pub claimed: bool,
    pub claimer: Option<AccountId>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct PaymentDisclosureProof {
    pub txid: String,
    pub proof_data: String,
    pub message: String,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct IntentRequest {
    pub from_currency: String,
    pub to_currency: String,
    pub amount: U128,
    pub recipient_address: String,
    pub solver_address: String,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct ZKFIEDTipping {
    evidence_tips: UnorderedMap<String, TipPool>,
    tip_claims: UnorderedMap<String, bool>,
    intents_verifier: AccountId,
    zcash_intent_solver: AccountId,
}

#[near_bindgen]
impl ZKFIEDTipping {
    #[init]
    pub fn new(intents_verifier: AccountId, zcash_solver: AccountId) -> Self {
        Self {
            evidence_tips: UnorderedMap::new(StorageKey::EvidenceTips),
            tip_claims: UnorderedMap::new(StorageKey::TipClaims),
            intents_verifier,
            zcash_intent_solver: zcash_solver,
        }
    }

    #[payable]
    pub fn tip_evidence(&mut self, evidence_id: String, message: String) {
        let tipper = env::predecessor_account_id();
        let amount = env::attached_deposit();

        require!(amount > NearToken::from_yoctonear(0), "Must attach NEAR for tip");

        let tip = Tip {
            tipper: tipper.clone(),
            amount: U128(amount.as_yoctonear()),
            currency: "NEAR".to_string(),
            message,
            timestamp: env::block_timestamp(),
        };

        let mut tip_pool = self.evidence_tips
            .get(&evidence_id)
            .unwrap_or_else(|| TipPool {
                evidence_id: evidence_id.clone(),
                tips: Vec::new(),
                total_amount: U128(0),
                claimed: false,
                claimer: None,
            });

        tip_pool.tips.push(tip);
        tip_pool.total_amount = U128(tip_pool.total_amount.0 + amount.as_yoctonear());

        self.evidence_tips.insert(&evidence_id, &tip_pool);

        env::log_str(&format!(
            "Tip received: {} from {} for evidence {}",
            amount, tipper, evidence_id
        ));
    }

    pub fn claim_tips(
        &mut self,
        evidence_id: String,
        payment_disclosure: PaymentDisclosureProof,
        zcash_address: String,
    ) -> Promise {
        require!(
            !self.tip_claims.get(&evidence_id).unwrap_or(false),
            "Tips already claimed for this evidence"
        );

        require!(
            self.verify_payment_disclosure(&payment_disclosure, &evidence_id),
            "Invalid payment disclosure proof"
        );

        let mut tip_pool = self.evidence_tips
            .get(&evidence_id)
            .expect("No tips found for this evidence");

        require!(!tip_pool.claimed, "Tips already claimed");

        let claimer = env::predecessor_account_id();
        let total_amount = tip_pool.total_amount.0;

        tip_pool.claimed = true;
        tip_pool.claimer = Some(claimer.clone());
        self.evidence_tips.insert(&evidence_id, &tip_pool);
        self.tip_claims.insert(&evidence_id, &true);

        env::log_str(&format!(
            "Tips claimed: {} NEAR for evidence {} by {}",
            total_amount, evidence_id, claimer
        ));

        let intent_request = IntentRequest {
            from_currency: "NEAR".to_string(),
            to_currency: "ZEC".to_string(),
            amount: U128(total_amount),
            recipient_address: zcash_address,
            solver_address: self.zcash_intent_solver.to_string(),
        };

        self.execute_near_intent(intent_request, claimer)
    }

    fn execute_near_intent(
        &self,
        intent: IntentRequest,
        beneficiary: AccountId,
    ) -> Promise {
        let intent_data = serde_json::to_string(&intent).unwrap();

        env::log_str(&format!(
            "Executing NEAR Intent: {} NEAR -> ZEC for {}",
            intent.amount.0, beneficiary
        ));

        Promise::new(self.intents_verifier.clone())
            .function_call(
                "execute_intent".to_string(),
                intent_data.into_bytes(),
                NearToken::from_yoctonear(intent.amount.0),
                Gas::from_gas(5_000_000_000_000),
            )
            .then(
                Promise::new(env::current_account_id())
                    .function_call(
                        "on_intent_executed".to_string(),
                        serde_json::json!({
                            "beneficiary": beneficiary,
                            "amount": intent.amount,
                        }).to_string().into_bytes(),
                        NearToken::from_yoctonear(0),
                        Gas::from_gas(5_000_000_000_000),
                    )
            )
    }

    #[private]
    pub fn on_intent_executed(
        &mut self,
        #[callback_result] call_result: Result<(), PromiseError>,
        beneficiary: AccountId,
        amount: U128,
    ) {
        if call_result.is_ok() {
            env::log_str(&format!(
                "Intent executed successfully: {} ZEC sent to {}",
                amount.0, beneficiary
            ));
        } else {
            env::log_str(&format!(
                "Intent execution failed for {}, refunding NEAR",
                beneficiary
            ));

            Promise::new(beneficiary).transfer(NearToken::from_yoctonear(amount.0));
        }
    }

    fn verify_payment_disclosure(
        &self,
        proof: &PaymentDisclosureProof,
        evidence_id: &str,
    ) -> bool {
        let txid_bytes = hex::decode(&proof.txid).unwrap_or_default();
        if txid_bytes.len() != 32 {
            return false;
        }

        proof.message.contains(evidence_id)
    }

    pub fn get_tip_pool(&self, evidence_id: String) -> Option<TipPool> {
        self.evidence_tips.get(&evidence_id)
    }

    pub fn get_total_tips(&self, evidence_id: String) -> U128 {
        self.evidence_tips
            .get(&evidence_id)
            .map(|pool| pool.total_amount)
            .unwrap_or(U128(0))
    }

    pub fn is_claimed(&self, evidence_id: String) -> bool {
        self.tip_claims.get(&evidence_id).unwrap_or(false)
    }

    pub fn get_tip_count(&self, evidence_id: String) -> u64 {
        self.evidence_tips
            .get(&evidence_id)
            .map(|pool| pool.tips.len() as u64)
            .unwrap_or(0)
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
    fn test_tip_evidence() {
        let alice = accounts(0);
        let intents = accounts(1);
        let solver = accounts(2);

        let context = get_context(alice.clone());
        testing_env!(context);

        let mut contract = ZKFIEDTipping::new(intents, solver);

        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(alice.clone())
            .attached_deposit(1_000_000_000_000_000_000_000_000)
            .build());

        contract.tip_evidence("evidence_001".to_string(), "Great work!".to_string());

        let total = contract.get_total_tips("evidence_001".to_string());
        assert_eq!(total.0, 1_000_000_000_000_000_000_000_000);

        assert_eq!(contract.get_tip_count("evidence_001".to_string()), 1);
    }

    #[test]
    fn test_multiple_tips() {
        let alice = accounts(0);
        let bob = accounts(1);
        let intents = accounts(2);
        let solver = accounts(3);

        testing_env!(get_context(alice.clone()));
        let mut contract = ZKFIEDTipping::new(intents, solver);

        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(alice.clone())
            .attached_deposit(1_000_000_000_000_000_000_000_000)
            .build());

        contract.tip_evidence("evidence_001".to_string(), "Tip 1".to_string());

        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(bob.clone())
            .attached_deposit(500_000_000_000_000_000_000_000)
            .build());

        contract.tip_evidence("evidence_001".to_string(), "Tip 2".to_string());

        let total = contract.get_total_tips("evidence_001".to_string());
        assert_eq!(total.0, 1_500_000_000_000_000_000_000_000);

        assert_eq!(contract.get_tip_count("evidence_001".to_string()), 2);
    }

    #[test]
    fn test_get_tip_pool() {
        let alice = accounts(0);
        let intents = accounts(1);
        let solver = accounts(2);

        testing_env!(get_context(alice.clone()));
        let mut contract = ZKFIEDTipping::new(intents, solver);

        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(alice.clone())
            .attached_deposit(1_000_000_000_000_000_000_000_000)
            .build());

        contract.tip_evidence("evidence_001".to_string(), "Test".to_string());

        let pool = contract.get_tip_pool("evidence_001".to_string()).unwrap();
        assert_eq!(pool.tips.len(), 1);
        assert_eq!(pool.total_amount.0, 1_000_000_000_000_000_000_000_000);
        assert!(!pool.claimed);
    }
}
