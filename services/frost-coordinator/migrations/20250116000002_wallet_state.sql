CREATE TABLE accounts (
    account INTEGER PRIMARY KEY,
    ufvk TEXT NOT NULL,
    birthday_height INTEGER NOT NULL,
    recover_until_height INTEGER
);

CREATE TABLE received_notes (
    id_note INTEGER PRIMARY KEY AUTOINCREMENT,
    tx BLOB NOT NULL,
    output_pool TEXT NOT NULL CHECK(output_pool IN ('Orchard', 'Sapling')),
    output_index INTEGER NOT NULL,
    account INTEGER NOT NULL,
    diversifier BLOB NOT NULL,
    value INTEGER NOT NULL,
    rcm BLOB NOT NULL,
    nf BLOB UNIQUE,
    is_change BOOLEAN NOT NULL DEFAULT 0,
    memo BLOB,
    spent INTEGER,
    commitment_tree_position INTEGER,
    FOREIGN KEY (account) REFERENCES accounts(account),
    FOREIGN KEY (spent) REFERENCES sent_notes(id_note),
    CONSTRAINT tx_output UNIQUE (tx, output_pool, output_index)
);

CREATE TABLE sent_notes (
    id_note INTEGER PRIMARY KEY AUTOINCREMENT,
    tx INTEGER NOT NULL,
    output_pool TEXT NOT NULL,
    output_index INTEGER NOT NULL,
    from_account INTEGER NOT NULL,
    to_address TEXT,
    to_account INTEGER,
    value INTEGER NOT NULL,
    memo BLOB,
    FOREIGN KEY (tx) REFERENCES transactions(id_tx),
    FOREIGN KEY (from_account) REFERENCES accounts(account)
);

CREATE TABLE sapling_witnesses (
    id_witness INTEGER PRIMARY KEY AUTOINCREMENT,
    note INTEGER NOT NULL,
    block INTEGER NOT NULL,
    witness BLOB NOT NULL,
    FOREIGN KEY (note) REFERENCES received_notes(id_note),
    CONSTRAINT witness_height UNIQUE (note, block)
);

CREATE TABLE orchard_tree (
    block_height INTEGER PRIMARY KEY,
    tree_state BLOB NOT NULL
);

CREATE TABLE blocks (
    height INTEGER PRIMARY KEY,
    hash BLOB NOT NULL UNIQUE,
    time INTEGER NOT NULL,
    sapling_tree BLOB NOT NULL,
    orchard_tree BLOB,
    sapling_commitments_count INTEGER NOT NULL DEFAULT 0,
    orchard_commitments_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE transactions (
    id_tx INTEGER PRIMARY KEY AUTOINCREMENT,
    txid BLOB UNIQUE NOT NULL,
    block INTEGER,
    tx_index INTEGER,
    expiry_height INTEGER,
    raw BLOB,
    fee INTEGER,
    FOREIGN KEY (block) REFERENCES blocks(height)
);

CREATE TABLE transparent_received_outputs (
    id_utxo INTEGER PRIMARY KEY AUTOINCREMENT,
    tx BLOB NOT NULL,
    output_index INTEGER NOT NULL,
    account INTEGER NOT NULL,
    address TEXT NOT NULL,
    script BLOB NOT NULL,
    value INTEGER NOT NULL,
    height INTEGER NOT NULL,
    spent_in_tx BLOB,
    FOREIGN KEY (account) REFERENCES accounts(account),
    CONSTRAINT tx_transparent_output UNIQUE (tx, output_index)
);

CREATE TABLE nullifier_map (
    spend_pool TEXT NOT NULL CHECK(spend_pool IN ('Orchard', 'Sapling')),
    nf BLOB NOT NULL,
    note INTEGER NOT NULL,
    CONSTRAINT nf_pool UNIQUE (spend_pool, nf),
    FOREIGN KEY (note) REFERENCES received_notes(id_note)
);

CREATE INDEX idx_received_notes_account ON received_notes(account);
CREATE INDEX idx_received_notes_tx ON received_notes(tx);
CREATE INDEX idx_received_notes_nf ON received_notes(nf) WHERE nf IS NOT NULL;
CREATE INDEX idx_received_notes_spent ON received_notes(spent);
CREATE INDEX idx_sent_notes_tx ON sent_notes(tx);
CREATE INDEX idx_sent_notes_from_account ON sent_notes(from_account);
CREATE INDEX idx_witnesses_note ON sapling_witnesses(note);
CREATE INDEX idx_witnesses_block ON sapling_witnesses(block);
CREATE INDEX idx_transactions_block ON transactions(block);
CREATE INDEX idx_transparent_received_account ON transparent_received_outputs(account);
CREATE INDEX idx_transparent_received_address ON transparent_received_outputs(address);
CREATE INDEX idx_nullifier_map_nf ON nullifier_map(nf);
CREATE INDEX idx_nullifier_map_note ON nullifier_map(note);
