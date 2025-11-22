-- ZKFIED Evidence Tracking Database Schema
-- Initial migration for Phase 4 integration

-- Evidence submissions tracking table
-- Stores metadata about submitted evidence linked to Zcash transactions
CREATE TABLE IF NOT EXISTS evidence_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id TEXT UNIQUE NOT NULL,
    zcash_txid TEXT UNIQUE,
    ipfs_cid TEXT NOT NULL,
    board_category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    commitment_hash TEXT NOT NULL,
    block_height INTEGER,
    submission_timestamp INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'signing', 'broadcasting', 'confirmed', 'failed')),
    confirmation_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- FROST signing sessions tracking
-- Tracks multi-party threshold signature ceremonies
CREATE TABLE IF NOT EXISTS frost_signing_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    evidence_id TEXT NOT NULL,
    threshold INTEGER NOT NULL,
    min_signers INTEGER NOT NULL,
    max_signers INTEGER NOT NULL,
    current_round INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'initializing' CHECK(status IN ('initializing', 'round1', 'round2', 'completed', 'failed')),
    group_commitment TEXT,
    signature TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (evidence_id) REFERENCES evidence_submissions(evidence_id) ON DELETE CASCADE
);

-- FROST participants tracking
-- Individual signer information for each session
CREATE TABLE IF NOT EXISTS frost_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    participant_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    round1_commitment TEXT,
    round2_signature_share TEXT,
    status TEXT NOT NULL DEFAULT 'joined' CHECK(status IN ('joined', 'round1_complete', 'round2_complete', 'failed')),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES frost_signing_sessions(session_id) ON DELETE CASCADE,
    UNIQUE(session_id, participant_id)
);

-- IPFS content pinning tracker
-- Ensures evidence files remain accessible
CREATE TABLE IF NOT EXISTS ipfs_pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cid TEXT UNIQUE NOT NULL,
    evidence_id TEXT,
    content_type TEXT NOT NULL CHECK(content_type IN ('metadata', 'file', 'image', 'document')),
    size_bytes INTEGER,
    pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_at DATETIME,
    pin_service TEXT DEFAULT 'local' CHECK(pin_service IN ('local', 'pinata', 'web3storage', 'filebase')),
    FOREIGN KEY (evidence_id) REFERENCES evidence_submissions(evidence_id) ON DELETE SET NULL
);

-- NEAR cross-chain posts tracking
-- Links Zcash evidence submissions to NEAR blockchain posts
CREATE TABLE IF NOT EXISTS near_cross_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id TEXT NOT NULL,
    near_tx_hash TEXT UNIQUE NOT NULL,
    contract_id TEXT NOT NULL,
    method_name TEXT NOT NULL,
    block_height INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'failed')),
    posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    FOREIGN KEY (evidence_id) REFERENCES evidence_submissions(evidence_id) ON DELETE CASCADE
);

-- AI agent verification tasks
-- Tracks autonomous agent work on evidence verification
CREATE TABLE IF NOT EXISTS agent_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT UNIQUE NOT NULL,
    evidence_id TEXT NOT NULL,
    agent_address TEXT NOT NULL,
    task_type TEXT NOT NULL CHECK(task_type IN ('verification', 'classification', 'translation', 'moderation')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'assigned', 'in_progress', 'completed', 'disputed')),
    result_ipfs_cid TEXT,
    tip_amount INTEGER DEFAULT 0,
    tip_txid TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (evidence_id) REFERENCES evidence_submissions(evidence_id) ON DELETE CASCADE
);

-- Viewing keys for shielded transaction disclosure
-- Enables selective transparency via ZIP 311 payment disclosure
CREATE TABLE IF NOT EXISTS viewing_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id TEXT NOT NULL,
    key_type TEXT NOT NULL CHECK(key_type IN ('incoming', 'outgoing', 'full')),
    key_data TEXT NOT NULL,
    board_id TEXT NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evidence_id) REFERENCES evidence_submissions(evidence_id) ON DELETE CASCADE
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_evidence_status ON evidence_submissions(status);
CREATE INDEX IF NOT EXISTS idx_evidence_category ON evidence_submissions(board_category);
CREATE INDEX IF NOT EXISTS idx_evidence_timestamp ON evidence_submissions(submission_timestamp);
CREATE INDEX IF NOT EXISTS idx_frost_session_status ON frost_signing_sessions(status);
CREATE INDEX IF NOT EXISTS idx_frost_participants_session ON frost_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_ipfs_evidence ON ipfs_pins(evidence_id);
CREATE INDEX IF NOT EXISTS idx_near_posts_evidence ON near_cross_posts(evidence_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_viewing_keys_evidence ON viewing_keys(evidence_id);
