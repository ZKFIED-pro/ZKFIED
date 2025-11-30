-- Add hybrid flow status values to evidence_submissions
-- Adds 'awaiting_zcash_tx', 'linked', and 'completed' status values

-- SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table

-- Create new table with updated status constraints
CREATE TABLE IF NOT EXISTS evidence_submissions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id TEXT UNIQUE NOT NULL,
    zcash_txid TEXT,
    ipfs_cid TEXT NOT NULL,
    board_category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    commitment_hash TEXT NOT NULL,
    block_height INTEGER,
    submission_timestamp INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'signing', 'broadcasting', 'confirmed', 'failed', 'awaiting_zcash_tx', 'linked', 'completed')),
    confirmation_count INTEGER DEFAULT 0,
    payment_disclosure TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table
INSERT INTO evidence_submissions_new
SELECT id, evidence_id, zcash_txid, ipfs_cid, board_category, title, description,
       commitment_hash, block_height, submission_timestamp, status, confirmation_count,
       NULL as payment_disclosure, created_at, updated_at
FROM evidence_submissions;

-- Drop old table
DROP TABLE evidence_submissions;

-- Rename new table
ALTER TABLE evidence_submissions_new RENAME TO evidence_submissions;

-- Recreate indices
CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence_submissions(status);
CREATE INDEX IF NOT EXISTS idx_evidence_category ON evidence_submissions(board_category);
CREATE INDEX IF NOT EXISTS idx_evidence_txid ON evidence_submissions(zcash_txid);
