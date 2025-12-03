PRAGMA foreign_keys=off;

CREATE TABLE solver_bids_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bid_id TEXT NOT NULL UNIQUE,
    request_id TEXT NOT NULL,
    solver_id TEXT NOT NULL,
    bid_amount INTEGER NOT NULL,
    estimated_completion INTEGER NOT NULL,
    credentials BLOB NOT NULL,
    proof_of_capability BLOB NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO solver_bids_new SELECT * FROM solver_bids;

DROP TABLE solver_bids;

ALTER TABLE solver_bids_new RENAME TO solver_bids;

CREATE INDEX idx_solver_bids_request ON solver_bids(request_id);

PRAGMA foreign_keys=on;
