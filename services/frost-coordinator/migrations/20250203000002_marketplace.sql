CREATE TABLE IF NOT EXISTS access_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL UNIQUE,
    evidence_id TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    bid_amount INTEGER NOT NULL,
    purpose TEXT NOT NULL,
    zk_credentials BLOB,
    deadline INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Pending', 'Bidding', 'Accepted', 'Fulfilled', 'Rejected', 'Expired')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evidence_id) REFERENCES evidence_submissions(evidence_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verification_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL UNIQUE,
    evidence_id TEXT NOT NULL,
    verification_type TEXT NOT NULL,
    reward_amount INTEGER NOT NULL,
    deadline INTEGER NOT NULL,
    requirements TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evidence_id) REFERENCES evidence_submissions(evidence_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS solver_bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bid_id TEXT NOT NULL UNIQUE,
    request_id TEXT NOT NULL,
    solver_id TEXT NOT NULL,
    bid_amount INTEGER NOT NULL,
    estimated_completion INTEGER NOT NULL,
    credentials BLOB NOT NULL,
    proof_of_capability BLOB NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES access_requests(request_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wrapped_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id TEXT NOT NULL,
    recipient_public_key BLOB NOT NULL,
    encrypted_key BLOB NOT NULL,
    nonce BLOB NOT NULL,
    request_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evidence_id) REFERENCES evidence_submissions(evidence_id) ON DELETE CASCADE,
    FOREIGN KEY (request_id) REFERENCES access_requests(request_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_access_requests_evidence ON access_requests(evidence_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_evidence ON verification_requests(evidence_id);
CREATE INDEX IF NOT EXISTS idx_solver_bids_request ON solver_bids(request_id);
CREATE INDEX IF NOT EXISTS idx_wrapped_keys_evidence ON wrapped_keys(evidence_id);
