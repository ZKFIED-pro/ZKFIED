CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    otp_expires_at INTEGER NOT NULL,
    is_verified INTEGER NOT NULL DEFAULT 0,
    mina_credential_hash TEXT,
    board_type INTEGER,
    created_at INTEGER NOT NULL,
    verified_at INTEGER,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_email ON user_sessions(email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_verified ON user_sessions(is_verified);

CREATE TABLE IF NOT EXISTS user_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES user_sessions(session_id),
    FOREIGN KEY (evidence_id) REFERENCES evidence_submissions(evidence_id)
);

CREATE INDEX IF NOT EXISTS idx_user_evidence_session ON user_evidence(session_id);
CREATE INDEX IF NOT EXISTS idx_user_evidence_evidence ON user_evidence(evidence_id);
