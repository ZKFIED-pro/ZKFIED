CREATE TABLE IF NOT EXISTS mina_credential_proofs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credential_hash TEXT NOT NULL UNIQUE,
    holder_public_key TEXT NOT NULL,
    credential_type INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    proof_data TEXT NOT NULL,
    board_type INTEGER NOT NULL,
    is_revoked INTEGER NOT NULL DEFAULT 0,
    verified_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    INDEX idx_holder_public_key (holder_public_key),
    INDEX idx_credential_type (credential_type),
    INDEX idx_board_type (board_type),
    INDEX idx_verified_at (verified_at)
);

CREATE TABLE IF NOT EXISTS frost_authorizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    authorization_id TEXT NOT NULL UNIQUE,
    credential_hash TEXT NOT NULL,
    board_type INTEGER NOT NULL,
    frost_signature BLOB NOT NULL,
    authorized_at INTEGER NOT NULL,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (credential_hash) REFERENCES mina_credential_proofs(credential_hash),
    INDEX idx_credential_hash (credential_hash),
    INDEX idx_board_type (board_type),
    INDEX idx_authorized_at (authorized_at)
);
