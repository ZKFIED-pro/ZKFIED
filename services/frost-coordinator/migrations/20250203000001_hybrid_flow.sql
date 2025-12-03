-- Hybrid Evidence Flow Migration
-- Adds tracking for hybrid evidence submission flow with FROST threshold checking

-- Add hybrid flow tracking columns to evidence_submissions
ALTER TABLE evidence_submissions ADD COLUMN submission_type TEXT DEFAULT 'hybrid' CHECK(submission_type IN ('hybrid', 'full_frost', 'lightweight'));
ALTER TABLE evidence_submissions ADD COLUMN frost_signature_count INTEGER DEFAULT 0;
ALTER TABLE evidence_submissions ADD COLUMN registration_path TEXT CHECK(registration_path IN ('full_frost', 'lightweight', 'pending'));

-- Add index for hybrid flow queries
CREATE INDEX IF NOT EXISTS idx_evidence_submission_type ON evidence_submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_evidence_registration_path ON evidence_submissions(registration_path);

-- Update FROST sessions to track signature collection progress
ALTER TABLE frost_signing_sessions ADD COLUMN collected_signatures INTEGER DEFAULT 0;
ALTER TABLE frost_signing_sessions ADD COLUMN threshold_met BOOLEAN DEFAULT 0;

-- Create hybrid flow status log table
CREATE TABLE IF NOT EXISTS hybrid_flow_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id TEXT NOT NULL,
    flow_stage TEXT NOT NULL CHECK(flow_stage IN (
        'commitment_computed',
        'metadata_uploaded',
        'frost_requested',
        'signatures_collecting',
        'threshold_check',
        'full_frost_path',
        'lightweight_path',
        'near_registration',
        'indexing_complete'
    )),
    signature_count INTEGER,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evidence_id) REFERENCES evidence_submissions(evidence_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hybrid_flow_evidence ON hybrid_flow_log(evidence_id);
CREATE INDEX IF NOT EXISTS idx_hybrid_flow_stage ON hybrid_flow_log(flow_stage);
