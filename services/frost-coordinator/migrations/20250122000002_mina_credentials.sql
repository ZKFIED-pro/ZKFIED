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
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_holder_public_key ON mina_credential_proofs(holder_public_key);
CREATE INDEX IF NOT EXISTS idx_credential_type ON mina_credential_proofs(credential_type);
CREATE INDEX IF NOT EXISTS idx_board_type ON mina_credential_proofs(board_type);
CREATE INDEX IF NOT EXISTS idx_verified_at ON mina_credential_proofs(verified_at);

CREATE TABLE IF NOT EXISTS frost_authorizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    authorization_id TEXT NOT NULL UNIQUE,
    credential_hash TEXT NOT NULL,
    board_type INTEGER NOT NULL,
    frost_signature BLOB NOT NULL,
    authorized_at INTEGER NOT NULL,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (credential_hash) REFERENCES mina_credential_proofs(credential_hash)
);

CREATE INDEX IF NOT EXISTS idx_frost_credential_hash ON frost_authorizations(credential_hash);
CREATE INDEX IF NOT EXISTS idx_frost_board_type ON frost_authorizations(board_type);
CREATE INDEX IF NOT EXISTS idx_frost_authorized_at ON frost_authorizations(authorized_at);
