CREATE TABLE IF NOT EXISTS evidence_commitments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id TEXT NOT NULL UNIQUE,
    ipfs_cid TEXT NOT NULL,
    board_id TEXT NOT NULL,
    commitment_hash BLOB NOT NULL,
    timestamp INTEGER NOT NULL,
    zcash_txid TEXT,
    zcash_block_height INTEGER,
    near_txid TEXT,
    near_block_height INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_commitments_evidence_id ON evidence_commitments(evidence_id);
CREATE INDEX idx_commitments_board_id ON evidence_commitments(board_id);
CREATE INDEX idx_commitments_zcash_txid ON evidence_commitments(zcash_txid);
CREATE INDEX idx_commitments_near_txid ON evidence_commitments(near_txid);
CREATE INDEX idx_commitments_status ON evidence_commitments(status);
CREATE INDEX idx_commitments_timestamp ON evidence_commitments(timestamp);

CREATE TABLE IF NOT EXISTS commitment_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commitment_id INTEGER NOT NULL,
    verifier_type TEXT NOT NULL,
    verification_result BOOLEAN NOT NULL,
    verification_data TEXT,
    verified_at INTEGER NOT NULL,
    FOREIGN KEY (commitment_id) REFERENCES evidence_commitments(id) ON DELETE CASCADE
);

CREATE INDEX idx_verifications_commitment_id ON commitment_verifications(commitment_id);
CREATE INDEX idx_verifications_verified_at ON commitment_verifications(verified_at);
