use near_sdk::{near, env, AccountId, NearToken, Promise, BorshStorageKey};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::store::UnorderedMap;

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct VerificationRequest {
    pub request_id: String,
    pub evidence_id: String,
    pub requester: AccountId,
    pub verification_type: String,
    pub reward_amount: NearToken,
    pub status: String,
    pub selected_solver: Option<AccountId>,
    pub created_at: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct SolverBid {
    pub bid_id: String,
    pub solver: AccountId,
    pub bid_amount: NearToken,
    pub estimated_completion: u64,
}

#[near(contract_state)]
pub struct MarketplaceVerifier {
    owner: AccountId,
    verification_requests: UnorderedMap<String, VerificationRequest>,
    solver_bids: UnorderedMap<String, Vec<SolverBid>>,
    escrow_balances: UnorderedMap<String, NearToken>,
}

impl Default for MarketplaceVerifier {
    fn default() -> Self {
        Self {
            owner: env::current_account_id(),
            verification_requests: UnorderedMap::new(b"v"),
            solver_bids: UnorderedMap::new(b"b"),
            escrow_balances: UnorderedMap::new(b"e"),
        }
    }
}

#[near]
impl MarketplaceVerifier {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            verification_requests: UnorderedMap::new(b"v"),
            solver_bids: UnorderedMap::new(b"b"),
            escrow_balances: UnorderedMap::new(b"e"),
        }
    }

    #[payable]
    pub fn create_verification_request(
        &mut self,
        evidence_id: String,
        verification_type: String,
    ) -> String {
        let requester = env::predecessor_account_id();
        let attached_deposit = env::attached_deposit();

        let request_id = format!("verify_{}_{}", evidence_id, env::block_timestamp());

        let request = VerificationRequest {
            request_id: request_id.clone(),
            evidence_id,
            requester,
            verification_type,
            reward_amount: attached_deposit,
            status: "Pending".to_string(),
            selected_solver: None,
            created_at: env::block_timestamp(),
        };

        self.verification_requests.insert(request_id.clone(), request);
        self.escrow_balances.insert(request_id.clone(), attached_deposit);

        env::log_str(&format!("Verification request created: {} with escrow: {}", request_id, attached_deposit));
        request_id
    }

    pub fn submit_bid(
        &mut self,
        request_id: String,
        bid_amount: NearToken,
        estimated_completion: u64,
    ) {
        let solver = env::predecessor_account_id();

        let bid = SolverBid {
            bid_id: format!("bid_{}_{}", request_id, env::block_timestamp()),
            solver,
            bid_amount,
            estimated_completion,
        };

        let mut bids = self.solver_bids.get(&request_id).cloned().unwrap_or_else(Vec::new);
        bids.push(bid);
        self.solver_bids.insert(request_id.clone(), bids);

        env::log_str(&format!("Bid submitted for request: {}", request_id));
    }

    pub fn accept_bid(&mut self, request_id: String, solver: AccountId) {
        let requester = env::predecessor_account_id();

        let mut request = self.verification_requests.get(&request_id)
            .expect("Request not found").clone();

        assert_eq!(request.requester, requester, "Only requester can accept bid");
        assert_eq!(request.status, "Pending", "Request already processed");

        request.status = "Accepted".to_string();
        request.selected_solver = Some(solver.clone());

        self.verification_requests.insert(request_id.clone(), request);

        env::log_str(&format!("Bid accepted for request: {} by solver: {}", request_id, solver));
    }

    pub fn submit_verification(&mut self, request_id: String, proof_cid: String) {
        let solver = env::predecessor_account_id();

        let mut request = self.verification_requests.get(&request_id)
            .expect("Request not found").clone();

        assert_eq!(request.selected_solver, Some(solver.clone()), "Not selected solver");
        assert_eq!(request.status, "Accepted", "Request not accepted");

        request.status = "Fulfilled".to_string();
        self.verification_requests.insert(request_id.clone(), request);

        let escrow = self.escrow_balances.get(&request_id).cloned().unwrap_or(NearToken::from_near(0));
        if escrow.as_yoctonear() > 0 {
            self.escrow_balances.remove(&request_id);
            Promise::new(solver).transfer(escrow);
        }

        env::log_str(&format!("Verification fulfilled: {} with proof: {}", request_id, proof_cid));
    }

    pub fn get_request(&self, request_id: String) -> Option<VerificationRequest> {
        self.verification_requests.get(&request_id).cloned()
    }

    pub fn get_bids(&self, request_id: String) -> Vec<SolverBid> {
        self.solver_bids.get(&request_id).cloned().unwrap_or_else(Vec::new)
    }

    pub fn get_escrow_balance(&self, request_id: String) -> NearToken {
        self.escrow_balances.get(&request_id).cloned().unwrap_or(NearToken::from_near(0))
    }
}
