# <ZKFIED is the safest whistleblower tool>

We have developed this for whistleblower protection and evidence cooperation for sensitive topics. 

Production stack: Zcash Shielded Transactions, FROST Threshold Signatures (3-of-5), ZK Attestations, IPFS, Tor/I2P Hidden Services, NEAR Protocol Registry, NEAR Intents, Mina zkApps, OTP Authentication, Evidence Marketplace

## Production Deployments

**Frontend:** https://zkfied.vercel.app

**Backend:** https://zkfied-frost-testnet.fly.dev

**NEAR Contract:** https://testnet.nearblocks.io/address/reg.mrhashfox.testnet

**Mina zkApp:** https://minascan.io/devnet/account/B62qjfNr4fERPmVx6RbZxdYLmELeJwoisWGqcsWyceAn17DVAMNm4zr

## Infras Links

**Zcash Testnet:**
- Explorer: https://testnet.zcashblockexplorer.com
- LightwalletD: https://testnet.lightwalletd.com:9067

**NEAR Protocol:**
- Testnet RPC: https://rpc.testnet.near.org
- Explorer: https://testnet.nearblocks.io
- Contract: https://testnet.nearblocks.io/address/reg.mrhashfox.testnet

**NEAR Intents:**
- Solver Network: https://solver-relay-v2.chaindefuser.com
- WebSocket: wss://solver-relay-v2.chaindefuser.com/ws
- RPC: https://solver-relay-v2.chaindefuser.com/rpc
- Verifier Contract: intents.near
- Documentation: https://docs.near-intents.org

**Mina Protocol:**
- Devnet Explorer: https://minascan.io/devnet
- zkApp: https://minascan.io/devnet/account/B62qjfNr4fERPmVx6RbZxdYLmELeJwoisWGqcsWyceAn17DVAMNm4zr
- GraphQL Endpoint: https://api.minascan.io/node/devnet/v1/graphql

**IPFS:**
- Public Gateway: https://ipfs.io
- Alternative: https://dweb.link

**Email Provider:**
- Resend API: https://resend.com

**Code Repositories:**
- Main: https://github.com/ZKFIED-pro/ZKFIED

---

### A bit of history

**1. SecureDrop (2013-present)**
- Centralized server infrastructure, single point of failure
- Requires manual journalist verification, no cryptographic identity proof
- Evidence can be deleted by server operators

**2. WikiLeaks (2006-present)**
- Centralized editorial control, Assange had unilateral access
- No cryptographic proof of source verification
- Political targeting led to financial deplatforming (Visa/Mastercard/PayPal blockade 2010)

**3. Failures**
- **Reality Winner (2017):** NSA contractor leaked document to The Intercept, microdot tracking in PDF led to arrest within 6 hours
- **Edward Snowden (2013):** Required direct journalist contact + asylum in Russia to avoid prosecution
- **Chelsea Manning (2010):** Confided in Adrian Lamo who reported her to FBI, sentenced to 35 years

### Why they failed
1. government can subpoena/seize centralized servers (Lavabit 2013)
2. email headers, IP logs, printer tracking dots reveal source identity
3. one admin key compromised = entire platform compromised

We studied what happened and created ZKFIED :

## HYBRID MODEL: TWO SUBMISSION MODES

ZKFIED has infra for different threat models and current Zcash technical development. **We initially wanted to build a full orchestrator** (Mode 2) where everything is automated but current limitations in Zcash led us to also implement a hybrid approach (Mode 1) until the upgrade.

### Mode 1: Hybrid (Current Primary Implementation)

**Best for:** Users with existing Zcash wallet (Zashi, Nighthawk, etc.)

**Supports:** Mina credential verification, marketplace access requests, NEAR intents is the layer for all crosschain operations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   HYBRID FLOW (2 Steps + Marketplace)                   │
└─────────────────────────────────────────────────────────────────────────┘

Step 1: Submit Evidence (with optional Mina credential)
┌──────────────┐
│ Whistleblower│
└──────┬───────┘
       │
       │ (title, description, board, mina_credential)
       │ OTP email verification
       ▼
┌───────────────────────────────────────────────────────────┐
│          OTP Authentication + Mina zkApp Verification     │
│  • request OTP via email (6 digit code, 10min expiry)     │
│  • verify OTP code creates authenticated session          │
│  • mina zkapp credential verification:                    │
│    - query zkapp at B62qjfNr4fERPmVx6RbZxdYLmELeJwo...    │
│    - verify 128 byte zksn ARK proof onchain via graphql   │
│    - poseidon hash commitment proves credential ownership │
│    - map credential type to board (doctor→healthcare)     │
│    - credential hash stored with evidence commitment      │
│  • link verified credential to authenticated session      │
└──────┬────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────┐
│ FROST Coordinator│──────┐
└──────────────────┘      │
       │                  │ Generate viewing key (32 bytes)
       │                  │ Encrypt title/desc (ChaCha20Poly1305)
       │                  │ Files → IPFS (encrypted metadata)
       │                  │ Generate FROST sigs (3-of-5 threshold)
       │                  │ Create commitment hash
       │                  │ Prepare Zcash memo (evidence_id)
       │                  │ Store in evidence_commitments table
       │                  └─────────────┐
       │                                ▼
       │                         ┌──────────────────────────┐
       │◄────────────────────────┤ evidence_id              │
       │                         │ viewing_key              │
       │                         │ ipfs_cid                 │
       │                         │ frost_session_id         │
       │                         │ mina_credential_hash     │
       │                         └──────────────────────────┘
       │
       │ Use Zashi/Nighthawk wallet
       │ Create shielded tx manually
       │ Include evidence_id in memo
       │
       ▼
┌──────────────┐
│ Zcash Testnet│
└──────┬───────┘
       │
       │ Copy zcash_txid
       │
       ▼

Step 2: Link Transaction + NEAR Intent Broadcast
       │ POST /evidence/{id}/link-tx
       │ { "zcash_txid": "abc123..." }
       ▼
┌───────────────────────────────────────────────────────────────┐
│                   FROST Coordinator                           │
│                                                               │
│  [A] Link Zcash Transaction                                   │
│      - Update evidence record with zcash_txid                 │
│                                                               │
│  [B] Generate Payment Disclosure (ZIP-311)                    │
│      - Prove transaction ownership                            │
│                                                               │
│  [C] Retrieve FROST Signatures (3-of-5)                       │
│      - Query frost_session from database                      │
│      - Collect individual signature shares                    │
│                                                               │
│  [D] Create NEAR Intent for Cross-Chain Anchoring             │
│      ┌───────────────────────────────────────────-┐           │
│      │ NEAR Intents Client                        │           │
│      │ src/near_intents.rs                        │           │
│      │                                            │           │
│      │ Intent Message:                            │           │
│      │ {                                          │           │
│      │   "signer_id": "reg.mrhashfox.testnet",    │           │
│      │   "deadline": "2025-12-05T00:00:00Z",      │           │
│      │   "intents": [{                            │           │
│      │     "intent": "register_evidence",         │           │
│      │     "evidence_id": "evidence_96a879...",   │           │
│      │     "ipfs_cid": "QmcRA...",                │           │
│      │     "zcash_txid": "abc123...",             │           │
│      │     "commitment_hash": [32 bytes],         │           │
│      │     "board_id": 0,                         │           │
│      │     "frost_signatures": [                  │           │
│      │       {participant_id: 1, signature: "..."}│           │
│      │       {participant_id: 2, signature: "..." │           │
│      │       {participant_id: 3, signature: "..." │          │
│      │     ]                                      │          │
│      │   }]                                       │          │
│      │ }                                          │          │
│      │                                            │          │
│      │ Sign with NEP-413 standard                 │          │
│      │ Broadcast to solver network                │          │
│      │ (solver-relay-v2.chaindefuser.com)         │          │
│      └───────┬────────────────────────────────────┘          │
│              │                                               │
│  [E] Post to NEAR Registry via Intent                        │
│      ┌───────▼────────────────────────────────┐              │
│      │ NEAR Testnet                           │              │
│      │ reg.mrhashfox.testnet                  │              │
│      │                                        │              │
│      │ Method: register_evidence()            │              │
│      │ Args:                                  │              │
│      │  - evidence_id                         │              │
│      │  - ipfs_cid                            │              │
│      │  - zcash_txid                          │              │
│      │  - commitment_hash (32 bytes)          │              │
│      │  - board_id                            │              │
│      │  - frost_signatures (3+ required)      │              │
│      │  - mina_credential_hash                │              │
│      │                                        │              │
│      │ Finality: 1-2 seconds                  │              │
│      │ Gas: 0.001 NEAR                        │              │
│      │ Storage: 0.03 NEAR                     │              │
│      └────────────────────────────────────────┘              │
│                                                              │
│  [F] Update Database                                         │
│      - Store near_tx_hash                                    │
│      - Update evidence_commitments table                     │
│      - Set status to "completed"                             │
│      - Index in marketplace (if public)                      │
│                                                              │
└──────┬───────────────────────────────────────────────────────┘
       │
       │ Response: { evidence_id, ipfs_cid, zcash_txid,
       │             near_tx_hash, frost_session_id, status }
       ▼
┌──────────────────────────────────────────────────────────────┐
│              MARKETPLACE OPERATIONS (Optional)               │
│                                                              │
│  Anyone can now:                                             │
│  1. Browse evidence via /evidence/board/{category}           │
│  2. Create access request via NEAR intent                    │
│     POST /api/marketplace/request-access                     │
│     {                                                        │
│       "evidence_id": "evidence_96a879...",                   │
│       "bid_amount": "1000000",  // 1 NEAR                    │
│       "purpose": "journalist_verification",                  │
│       "zk_credentials": [...],  // Optional Mina proof       │
│       "deadline": 1735171200                                 │
│     }                                                        │
│                                                              │
│  3. NEAR Intent Created for Access Request:                  │
│     {                                                        │
│       "intent": "access_evidence",                           │
│       "evidence_id": "...",                                  │
│       "payment_amount": "1000000",                           │
│       "payment_token": "near",                               │
│       "purpose": "journalist_verification",                  │
│       "zk_credential_hash": "..."  // Links Mina proof       │
│     }                                                        │
│                                                              │
│  4. Solvers bid on NEAR intents bus                          │
│  5. Whistleblower accepts bid → viewing_key wrapped          │
│  6. Solver receives encrypted key, fulfills intent           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Process:**
1. Authenticate with OTP email verification
2. Submit evidence → Receive `evidence_id` and `viewing_key`
3. Create Zcash shielded transaction in your wallet (include `evidence_id` in memo)
4. Submit `zcash_txid` → Automatic NEAR anchoring

### Mode 2: Full Orchestrator (Original Vision)

**Why we wanted this:** Complete automation removes all complexity for whistleblowers. This is a one click submission with automatic transaction building, signin and cross-chain anchoring.

**Current status:** Partially implemented. Works when WebZjs wallet is available.

```
┌─────────────────────────────────────────────────────────────────┐
│                  FULL ORCHESTRATOR FLOW (1 Step)                 │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│ Whistleblower│
└──────┬───────┘
       │ Connect WebZjs wallet (MetaMask Snap)
       │ (title, description, files, Mina credential)
       ▼
┌────────────────────────────────────────────────────────────────┐
│              FROST Coordinator (Automated)                     │
│                                                                │
│  ┌──────────────┐                                              │
│  │ 1. IPFS      │──► Upload files, store metadata              │
│  └──────┬───────┘                                              │
│         │                                                      │
│  ┌──────▼───────┐                                              │
│  │ 2. FROST     │──► Round 1: Commitments                      │
│  │   Signing    │──► Round 2: Signature shares                 │
│  └──────┬───────┘──► Aggregate signature                       │
│         │                                                      │
│  ┌──────▼───────┐                                              │
│  │ 3. Zcash TX  │──► Build ZIP-225 v5 transaction              │
│  │   Builder    │──► Encode evidence memo (512 bytes)          │
│  └──────┬───────┘──► Broadcast to testnet                      │
│         │                                                      │
│  ┌──────▼───────┐                                              │
│  │ 4. NEAR Post │──► Payment disclosure generation             │
│  │              │──► Register evidence on-chain                │
│  └──────────────┘                                              │
└────────────────────────────────────────────────────────────────┘
       │
       │ Auto-redirect to /evidence/{id}
       │ Real-time status updates (10s polling)
       ▼
┌──────────────────┐
│ Evidence Detail  │
│ Page             │
│ - IPFS files     │
│ - Zcash txid     │
│ - FROST session  │
│ - NEAR tx hash   │
└──────────────────┘
```

**Process:**
1. Connect wallet to Upload evidence to Submit
2. Backend handles everything automatically
3. Redirected to detail page with live updates

---

## TECHNICAL ARCHITECTURE

### Complete System Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                  │
│                   React 18 + Vite 5 + TypeScript                  │
│                        10 Pages, 40+ Components                   │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Submit     │  │   Browse     │  │   Check      │             │
│  │   Evidence   │  │   & Filter   │  │   Evidence   │             │
│  │   (OTP Auth) │  │              │  │  (View Key)  │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                  │                  │                   │
│  ┌──────▼──────┐  ┌────────▼────┐  ┌─────────▼─────┐              │
│  │ Marketplace │  │ Evidence    │  │ Profile       │              │
│  │ & Bounties  │  │ Detail      │  │ & Tracking    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬────────┘              │
│         │                  │                  │                   │
│         └──────────────────┴──────────────────┘                   │
│                            │                                      │
└────────────────────────────┼──────────────────────────────────────┘
                             │ HTTPS (or Tor/I2P)
                             ▼
┌───────────────────────────────────────────────────────────────────┐
│                  FROST COORDINATOR (Fly.dev)                      │
│                      Rust + Axum + SQLite                         │
│                      40 Source Files, 15k+ LOC                    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    API Routes                               │  │
│  │  /evidence/submit        POST   Full orchestrator           │  │
│  │  /api/evidence/submit    POST   Hybrid mode                 │  │
│  │  /evidence/:id           GET    Status retrieval            │  │
│  │  /evidence/:id/link-tx   POST   Link Zcash transaction      │  │
│  │  /evidence/board/:cat    GET    Filter by category          │  │
│  │  /frost/session/:id      GET    FROST details               │  │
│  │  /ipfs/evidence/:cid     GET    Metadata from IPFS          │  │
│  │  /ipfs/file/:cid         GET    File content                │  │
│  │  /mina/verify-credential POST   Verify Mina proof           │  │
│  │  /api/auth/*             POST   OTP authentication          │  │
│  │  /api/marketplace/*      *      Marketplace operations      │  │
│  │  /api/marketplace/check  POST   Decrypt evidence            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  FROST   │  │  Zcash   │  │   IPFS   │  │   NEAR   │           │
│  │  Signing │  │  TX      │  │  Client  │  │ Intents  │           │
│  │  (3-of-5)│  │  Builder │  │          │  │ & Client │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │             │              │             │                │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐           │
│  │   OTP    │  │  Mina    │  │ Encrypt  │  │Marketplace│          │
│  │  Auth    │  │ Verifier │  │  (ChaCha)│  │ & Solver │           │
│  │ (Resend) │  │ (zkApps) │  │ Poly1305 │  │   Bus    │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                   │
└───────┼─────────────┼──────────────┼─────────────┼────────────────┘
        │             │              │             │
        ▼             ▼              ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ ZCASH TESTNET                                          │     │
│  │ LightwalletD: https://testnet.lightwalletd.com:9067    │     │
│  │ Explorer: https://testnet.zcashblockexplorer.com       │     │
│  │ Shielded pool (Sapling/Orchard)                        │     │
│  │ ZIP-225 v5 transactions with 512-byte memos            │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ IPFS NETWORK                                                 │
│  │ Daemon: http://127.0.0.1:5001 (local node)             │     │
│  │ Gateway: http://127.0.0.1:8080                         │     │
│  │ Public gateways: ipfs.io, dweb.link                    │     │
│  │ Content-addressed immutable storage                    │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ NEAR PROTOCOL TESTNET                                  │     │
│  │ RPC: https://rpc.testnet.near.org                      │     │
│  │ Contract: reg.mrhashfox.testnet                        │     │
│  │ Explorer: https://testnet.nearblocks.io                │     │
│  │ https://testnet.nearblocks.io/address/                 │     │
│  │        reg.mrhashfox.testnet                           │     │
│  │                                                        │     │
│  │ Contract Methods:                                      │     │
│  │  - register_evidence(evidence_id, ipfs_cid,            │     │
│  │                      zcash_txid, commitment_hash,      │     │
│  │                      board_id, frost_signatures)       │     │
│  │  - get_evidence(evidence_id)                           │     │
│  │  - get_evidence_by_board(board_id)                     │     │
│  │  - verify_frost_signatures(evidence_id)                │     │
│  │                                                        │     │
│  │ Storage: 0.03 NEAR per evidence record (~$0.003)       │     │
│  │ Gas: 0.001 NEAR per transaction                        │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ MINA PROTOCOL DEVNET                                   │     │
│  │ GraphQL: https://api.minascan.io/node/devnet/v1/graphql│     │
│  │ zkApp Address:                                         │     │
│  │   B62qjLQo287BXoYZBweHfRN5bikWUFdc81rqECVEiRCBEoYBEGCbNc3│   │
│  │ Explorer: https://minascan.io/devnet/account/          │     │
│  │           B62qjLQo287BXoYZBweHfRN5bikWUFdc81r...       │     │
│  │                                                        │     │
│  │ zkApp Methods:                                         │     │
│  │  - issueCredential(holderPublicKey, credentialType,    │     │
│  │                    issuerSignature)                    │     │
│  │  - verifyCredential(holderPublicKey, credentialType,   │     │
│  │                     timestamp, boardType)              │     │
│  │                                                        │     │
│  │ Credential Mappings:                                   │     │
│  │  Doctor (1) → Healthcare Board                         │     │
│  │  Nurse (2) → Healthcare Board                          │     │
│  │  Journalist (3) → Government Board                     │     │
│  │  Laborer (4) → Corporate Board                         │     │
│  │                                                        │     │
│  │ Proof size: 128 bytes (constant via recursive SNARKs)  │     │
│  │ Blockchain size: 22KB (always)                         │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ ANONYMITY NETWORKS                                     │     │
│  │ Tor: socks5://127.0.0.1:9050                           │     │
│  │ I2P: http://127.0.0.1:4444                             │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Production Deployments

**Frontend:** https://zkfied.vercel.app
- Two submission modes (hybrid + full)
- Evidence tracking and browsing
- WebZjs MetaMask Snap integration
- NEAR wallet connection
- Board filtering
- Status updates (10s polling)
- OTP authentication flow
- Marketplace UI for access requests and bounties
- Evidence decryption with viewing keys

**Backend:** https://zkfied-frost-testnet.fly.dev
- Rust/Axum with FROST signatures
- Hybrid + Full orchestrator modes
- Zcash testnet transactions
- Automatic NEAR anchoring on tx link
- Payment disclosure generation (ZIP-311)
- IPFS file storage and pinning
- SQLite persistent state
- NEAR contract integration
- Mina zkApp verification
- Tor/I2P proxy support
- OTP email authentication (Resend API)
- Evidence marketplace with bid system
- NEAR intents integration
- ChaCha20Poly1305 encryption

**NEAR Contract:** reg.mrhashfox.testnet
- View on explorer: https://testnet.nearblocks.io/address/reg.mrhashfox.testnet
- Public evidence registry
- FROST signature verification (3-of-5 threshold)
- Cross-chain anchoring (Zcash → NEAR)
- Immutable on-chain records
- Marketplace state synchronization

**Mina zkApp:** B62qjLQo287BXoYZBweHfRN5bikWUFdc81rqECVEiRCBEoYBEGCbNc3
- View on explorer: https://minascan.io/devnet/account/B62qjLQo287BXoYZBweHfRN5bikWUFdc81rqECVEiRCBEoYBEGCbNc3
- Professional credential verification
- Succinct proofs (128 bytes)
- Board type mapping (credentials → boards)
- 15+ credentials issued to date

---

## HYBRID FLOW: THE ENTIRE PROCESS

### Complete Submission Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│         HYBRID MODEL: USER to ZCASH to NEAR FLOW                      │
└─────────────────────────────────────────────────────────────────────┘

[1] EVIDENCE SUBMISSION
    ┌──────────────┐
    │Whistleblower │
    └──────┬───────┘
           │ Navigate to zkfied.vercel.app
           │ Click "Submit Evidence"
           │ Select "Hybrid Mode"
           │
           ▼
    ┌─────────────────────────────┐
    │  OTP Authentication          │
    │  - Enter email               │
    │  - Receive 6-digit code      │
    │  - Verify (10 min expiry)    │
    └──────┬──────────────────────┘
           │
           ▼
    ┌─────────────────────────────┐
    │  Evidence Submission Form   │
    │  - Board: HEALTHCARE        │
    │  - Title: "Safety Violation"│
    │  - Description: "..."       │
    │  - (No file upload required)│
    └──────┬──────────────────────┘
           │ POST /api/evidence/submit
           │ { session_id, evidence_type, evidence_data, description }
           ▼
    ┌─────────────────────────────┐
    │   FROST Coordinator         │
    │   - Generate evidence_id    │
    │   - Generate viewing_key    │
    │   - Encrypt with ChaCha20   │
    │   - Store in database       │
    │   - Initiate FROST session  │
    │   - Create commitment hash  │
    └──────┬──────────────────────┘
           │
           │ Response:
           │ {
           │   "evidence_id": "evidence_96a879...",
           │   "viewing_key": "a1b2c3d4e5f6...",
           │   "success": true,
           │   "next_steps": [
           │     "Use Zashi wallet to create tx",
           │     "Include evidence ID in memo",
           │     "Submit zcash_txid to complete"
           │   ]
           │ }
           ▼
    ┌─────────────────────────────┐
    │  Frontend displays:         │
    │  ✓ Evidence ID generated    │
    │  ✓ Viewing key (SAVE THIS!) │
    │  → Next: Create Zcash TX    │
    └─────────────────────────────┘

[2] FROST THRESHOLD SIGNING (Background)
    ┌─────────────────────────────┐
    │   FROST Coordinator         │
    │                             │
    │  Session: frost_evidence_96a│
    │  Threshold: 3-of-5          │
    └──────┬──────────────────────┘
           │
           │ Round 1: Nonce Commitments
           ├─► Participant 1: R₁ = k₁ * G
           ├─► Participant 2: R₂ = k₂ * G
           └─► Participant 3: R₃ = k₃ * G
           │
           │ Round 2: Signature Shares
           │ R = R₁ + R₂ + R₃
           │ c = H(R, PK, evidence_id)
           ├─► Participant 1: z₁ = k₁ + c·s₁
           ├─► Participant 2: z₂ = k₂ + c·s₂
           └─► Participant 3: z₃ = k₃ + c·s₃
           │
           │ Aggregation
           │ z = z₁ + z₂ + z₃
           │ σ = (R, z)
           │
           ▼
    ┌─────────────────────────────┐
    │  FROST Session Complete     │
    │  Status: completed          │
    │  Signature: 1e66670984a8... │
    │  Individual shares stored   │
    └─────────────────────────────┘

[3] ZCASH TRANSACTION (User creates manually)
    ┌──────────────┐
    │Whistleblower │
    └──────┬───────┘
           │ Open Zashi wallet (mobile/desktop)
           │ Create new shielded transaction:
           │   To: [Recipient address]
           │   Amount: 0.01 ZEC
           │   Memo: "evidence_96a879..."
           │
           ▼
    ┌─────────────────────────────┐
    │     Zcash Testnet           │
    │  Shielded pool (Sapling)    │
    │  ZIP-225 v5 transaction     │
    │                             │
    │  Txid: abc123def456...      │
    └──────┬──────────────────────┘
           │ Wait for confirmation
           │ Copy zcash_txid
           ▼
    ┌─────────────────────────────┐
    │  User returns to frontend   │
    │  "Link Transaction" button  │
    │  Paste: abc123def456...     │
    └──────┬──────────────────────┘
           │ POST /evidence/:id/link-tx
           │ { "zcash_txid": "abc123..." }
           ▼

[4] TRANSACTION LINKING + NEAR POSTING
    ┌─────────────────────────────────────────────────────┐
    │   orchestrator.rs::link_zcash_transaction_and_comple│
    ├─────────────────────────────────────────────────────┤
    │                                                     │
    │  [A] Link Zcash Transaction                         │
    │      - Update evidence record                       │
    │      - Set zcash_txid                               │
    │      - Change status to "linked"                    │
    │                                                     │
    │  [B] Generate Payment Disclosure (ZIP-311)          │
    │      - Extract txid bytes                           │
    │      - Create disclosure proof                      │
    │      - Store in database                            │
    │                                                     │
    │  [C] Retrieve FROST Signatures                      │
    │      - Query database for session                   │
    │      - Get individual signature shares              │
    │      - Format for NEAR contract                     │
    │      [                                              │
    │        { participant_id: 1, signature: "..." },     │
    │        { participant_id: 2, signature: "..." },     │
    │        { participant_id: 3, signature: "..." }      │
    │      ]                                              │
    │                                                     │
    │  [D] Post to NEAR Registry                          │
    │      ┌──────────────────────────────────-───┐       │
    │      │ near_client.rs::register_evidence    │       │
    │      ├───────────────────────────────────-──┤       │
    │      │ Call: reg.mrhashfox.testnet          │       │
    │      │ Method: register_evidence()          │       │
    │      │                                      │       │
    │      │ Args:                                │       │
    │      │  - evidence_id                       │       │
    │      │  - ipfs_cid                          │       │
    │      │  - board_category                    │       │
    │      │  - commitment_hash (32 bytes)        │       │
    │      │  - zcash_txid                        │       │
    │      │  - zcash_block_height (0)            │       │
    │      │  - frost_signatures (3+ required)    │       │
    │      └──────┬───────────────────────────────┘       │
    │             │ Broadcast transaction                 │
    │             ▼                                       │
    │      ┌─────────────────────────────────────┐        │
    │      │  NEAR Testnet                       │        │
    │      │  Finality: 1-2 seconds              │        │
    │      │  Gas: 0.001 NEAR                    │        │
    │      │  Storage: 0.03 NEAR                 │        │
    │      └──────┬──────────────────────────────┘        │
    │             │ Return: near_tx_hash                  │
    │             ▼                                       │
    │  [E] Update Database                                │
    │      - Store near_tx_hash                           │
    │      - Update evidence_commitments table            │
    │      - Set status to "completed"                    │
    │                                                     │
    └──────┬──────────────────────────────────────────────┘
           │
           │ Response:
           │ {
           │   "evidence_id": "evidence_96a879...",
           │   "ipfs_cid": "QmcRA1wNhW8Pi...",
           │   "zcash_txid": "abc123def456...",
           │   "frost_session_id": "frost_evidence_96a879...",
           │   "status": "completed",
           │   "payment_disclosure": "0x7f3a..."
           │ }
           ▼
    ┌─────────────────────────────┐
    │  Frontend Updates           │
    │  ✓ Zcash TX linked          │
    │  ✓ FROST signatures applied │
    │  ✓ NEAR registry updated    │
    │  ✓ Status: COMPLETED        │
    └─────────────────────────────┘

[5] VERIFICATION (Anyone can verify)
    Query NEAR contract:

    near view reg.mrhashfox.testnet get_evidence \
      '{"evidence_id": "evidence_96a879..."}'

    Returns:
    {
      "ipfs_cid": "QmcRA1wNhW8Pi...",
      "zcash_txid": "abc123def456...",
      "commitment_hash": "f8540f691e025058...",
      "board_id": 0,  // Healthcare
      "timestamp": 1764528655,
      "frost_signatures": [
        { "participant_id": 1, "signature": "...", "public_key": "..." },
        { "participant_id": 2, "signature": "...", "public_key": "..." },
        { "participant_id": 3, "signature": "...", "public_key": "..." }
      ],
      "status": "Verified"
    }

    ✓ 3 FROST signatures (threshold met)
    ✓ Immutable on-chain record
    ✓ Cross-chain proof (Zcash privacy + NEAR transparency)
```

---

## CRYPTO PRIMITIVES

### 1. FROST Threshold Signatures

**Location:** `services/frost-coordinator/src/frost_impl.rs`

**Protocol:** FROST (Flexible Round-Optimized Schnorr Threshold) with rerandomization
**Curve:** Ed25519 (ristretto255 group)
**Configuration:** 3-of-5 threshold (requires 3 of 5 signers to approve)
**Library:** `frost-rerandomized` crate (production-grade)

#### Why FROST?

Multisig requires N signatures onchain but FROST has a single signature indistinguishable from single key signatures.

#### Distributed Key Generation

**Implementation:** `frost_impl.rs:25-58`

```rust
pub async fn perform_keygen(&mut self) -> Result<Vec<(Identifier, KeyPackage)>> {
    let mut rng = OsRng;
    let (shares, pubkey_package) = frost_rerandomized::keys::generate_with_dealer(
        self.max_signers, // 5
        self.min_signers, // 3
        frost_rerandomized::keys::IdentifierList::Default,
        &mut rng,
    )?;

    self.pubkey_package = Some(pubkey_package);
    let packages: Vec<_> = shares.into_iter().collect();

    for (id, pkg) in &packages {
        self.key_packages.insert(*id, pkg.clone());
    }

    Ok(packages)
}
```

**what happens?**
1. Dealer generates random polynomial f(x) of degree t-1 (where t=3)
2. Secret key sk = f(0), never reconstructed in memory
3. Each signer i receives share s_i = f(i)
4. Public key PK = sk * G derived from shares
5. Shares stored in HashMap, indexed by participant Identifier

**security:** Shamir secret sharing with t=3 threshold means any 2 compromised signers reveal nothing about the secret key.

#### Two Round Signing Protocol

**Location:** `frost_impl.rs:60-121`

**Round 1 - Nonce Commitment:**
```rust
for id in signer_ids {
    let secret_pkg = self.key_packages.get(id)?;
    let (nonces, commitments) = frost_rerandomized::round1::commit(
        secret_pkg.signing_share(),
        &mut rng,
    );
    nonces_map.insert(*id, nonces);
    commitments_map.insert(*id, commitments);
}
```

Each signer i:
- Samples random nonce k_i
- Computes commitment R_i = k_i * G
- Broadcasts R_i (keeps k_i secret)

**Round 2 - Signature Share Generation:**
```rust
let signing_package = frost_rerandomized::SigningPackage::new(
    commitments_map,
    message,
);

for id in signer_ids {
    let nonces = nonces_map.get(id).unwrap();
    let key_pkg = self.key_packages.get(id).unwrap();
    let share = frost_rerandomized::round2::sign(
        &signing_package,
        nonces,
        key_pkg,
    )?;
    signature_shares.insert(*id, share);
}
```

Each signer i:
- Computes challenge c = H(R, PK, m) where R = sum(R_i)
- Computes share z_i = k_i + c * s_i
- Broadcasts z_i

**aggregation:**
```rust
let group_signature = frost_rerandomized::aggregate(
    &signing_package,
    &signature_shares,
    pubkey_pkg,
)?;
```

Coordinator:
- Computes z = sum(z_i)
- Final signature σ = (R, z)
- Verifies: z * G == R + c * PK

**rerandomization:** Each signature has fresh randomness for no linkability between evidence submissions.

---

### 2. ChaCha20Poly1305 Evidence Encryption

**Location:** `services/frost-coordinator/src/encryption.rs`

**Why we use this:** Evidence needs selective disclosure. Whistleblower generates viewing key, encrypts evidence, submits to IPFS. Only those with viewing key can decrypt.

**Algorithm:** ChaCha20Poly1305 AEAD (Authenticated Encryption with Associated Data)
**Key Size:** 32 bytes (256 bits)
**Nonce Size:** 12 bytes (96 bits)
**Library:** `chacha20poly1305` crate

#### Key Generation

**Implementation:** `encryption.rs:20-25`

```rust
pub fn generate_viewing_key() -> String {
    let mut key_bytes = [0u8; 32];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut key_bytes);
    hex::encode(key_bytes)
}
```

Generates 32 random bytes, returns hex-encoded string (64 characters).

#### Key Derivation

**Implementation:** `encryption.rs:27-43`

```rust
pub fn derive_encryption_key(viewing_key: &str) -> Result<[u8; 32]> {
    let key_bytes = hex::decode(viewing_key)
        .context("Invalid viewing key format")?;

    if key_bytes.len() != 32 {
        bail!("Viewing key must be 32 bytes");
    }

    let mut hasher = Sha256::new();
    hasher.update(b"zkfied_evidence_encryption_v1");
    hasher.update(&key_bytes);
    let hash = hasher.finalize();

    let mut encryption_key = [0u8; 32];
    encryption_key.copy_from_slice(&hash);
    Ok(encryption_key)
}
```

**Domain separation:** "zkfied_evidence_encryption_v1" prevents key reuse across contexts.

#### Encryption

**Implementation:** `encryption.rs:45-62`

```rust
pub fn encrypt_data(data: &[u8], viewing_key: &str) -> Result<EncryptedData> {
    let encryption_key = Self::derive_encryption_key(viewing_key)?;

    let cipher = ChaCha20Poly1305::new(&encryption_key.into());

    let mut nonce_bytes = [0u8; NONCE_SIZE];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, data)
        .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

    Ok(EncryptedData {
        ciphertext,
        nonce: nonce_bytes.to_vec(),
    })
}
```

**Process:**
1. Derive encryption key from viewing key
2. Generate random 12-byte nonce
3. Encrypt data with ChaCha20
4. Compute Poly1305 MAC over ciphertext
5. Return (ciphertext || MAC, nonce)

#### Decryption

**Implementation:** `encryption.rs:64-79`

```rust
pub fn decrypt_data(encrypted: &EncryptedData, viewing_key: &str) -> Result<Vec<u8>> {
    let encryption_key = Self::derive_encryption_key(viewing_key)?;

    let cipher = ChaCha20Poly1305::new(&encryption_key.into());

    if encrypted.nonce.len() != NONCE_SIZE {
        bail!("Invalid nonce size");
    }

    let nonce = Nonce::from_slice(&encrypted.nonce);

    let plaintext = cipher.decrypt(nonce, encrypted.ciphertext.as_ref())
        .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

    Ok(plaintext)
}
```

**Security:**
- Authenticated encryption (prevents tampering)
- Fresh nonce per encryption (prevents replay)
- Wrong key → MAC verification fails
- Modified ciphertext → MAC verification fails

#### Usage in Check Evidence API

**Location:** `services/frost-coordinator/src/marketplace_routes.rs:460-549`

```rust
pub async fn check_evidence(
    State(state): State<Arc<MarketplaceState>>,
    Json(body): Json<CheckEvidenceBody>,
) -> impl IntoResponse {
    // 1. Get evidence from database
    let evidence = state.db.get_evidence(&body.evidence_id).await?;

    // 2. Download encrypted data from IPFS
    let encrypted_data = state.ipfs.download_file(&evidence.ipfs_cid).await?;

    // 3. Parse encrypted JSON
    let encrypted_json: serde_json::Value = serde_json::from_slice(&encrypted_data)?;

    // 4. Reconstruct EncryptedData struct
    let encrypted = EncryptedData {
        ciphertext: hex::decode(encrypted_json["ciphertext"].as_str()?)?,
        nonce: hex::decode(encrypted_json["nonce"].as_str()?)?,
    };

    // 5. Decrypt with viewing key
    let decrypted = EvidenceEncryption::decrypt_string(&encrypted, &body.viewing_key)?;

    // 6. Parse decrypted evidence data
    let evidence_data: serde_json::Value = serde_json::from_str(&decrypted)?;

    // 7. Return decrypted evidence
    (StatusCode::OK, Json(serde_json::json!({
        "success": true,
        "evidence_id": body.evidence_id,
        "evidence_data": evidence_data,
        "metadata": {
            "ipfs_cid": evidence.ipfs_cid,
            "board_category": evidence.board_category,
            "title": evidence.title,
            "description": evidence.description,
            "status": evidence.status,
            "submission_timestamp": evidence.submission_timestamp,
        }
    })))
}
```

**Frontend Integration:**

```typescript
// frontend/src/services/api.ts:374-394
async checkEvidence(evidenceId: string, viewingKey: string): Promise<{
  success: boolean
  evidence_id: string
  metadata: {
    ipfs_cid: string
    board_category: string
    title: string
    description: string
    status: string
    submission_timestamp: number
  }
  message?: string
}> {
  return this.request('/api/marketplace/check-evidence', {
    method: 'POST',
    body: JSON.stringify({
      evidence_id: evidenceId,
      viewing_key: viewingKey
    }),
  })
}
```
---

### 2. Tor + I2P Network Anonymity

**Location:** `services/frost-coordinator/torrc`

**why:** Dual anonymity networks to hide whistleblower IP addresses from surveillance.

#### Why Both Tor AND I2P?

**HTTPS:**
- Hides content (TLS encryption)
- Does NOT hide metadata: client IP, server IP, timing, packet sizes
- ISP/government sees: "192.168.1.100 connected to zkfied-frost-testnet.fly.dev at 14:32"

**Tor:**
- 7000+ relays, 2M+ daily users
- Three-hop circuit: Client → Guard → Middle → Exit → Destination
- Each hop only knows previous/next hop
- Hidden services (.onion) keep server IP hidden

**I2P:**
- Garlic routing (encrypted message bundling)
- Unidirectional tunnels (separate inbound/outbound)
- All nodes are routers (no exit nodes)
- Better for hidden services than clearnet

**why we did this:** this way compromise of one network doesn't deanonymize user.

#### Tor Configuration

**Location:** `services/frost-coordinator/torrc`

```
# Hidden service configuration
HiddenServiceDir /var/lib/tor/zkfied/
HiddenServicePort 80 127.0.0.1:3000

# Security hardening
SocksPort 0
ControlPort 0
DisableDebuggerAttachment 1

# Circuit preferences
CircuitBuildTimeout 60
LearnCircuitBuildTimeout 0
```

#### I2P Configuration

**Location:** `services/frost-coordinator/i2ptunnel.conf`

```
[zkfied-coordinator]
type = server
host = 127.0.0.1
port = 3000
inbound.length = 3
outbound.length = 3
```

#### Whistleblowers guide to ZKFIED 

**Via Tor:**
```bash
# 1. Install Tor Browser
# 2. Navigate to: http://zkfied[randomchars].onion
# 3. All traffic routed through 3 Tor relays
# 4. Exit node sees connection to coordinator, not whistleblower IP
```

**Via I2P:**
```bash
# 1. Install I2P router
# 2. Navigate to: http://zkfied[base32].i2p
# 3. All traffic routed through I2P garlic tunnels
# 4. No exit nodes (fully internal I2P network)
```

**Network Stack:**

```
┌──────────────────────────────────────────────┐
│          Whistleblower Browser               │
└────────────────┬─────────────────────────────┘
                 │
        ┌────────▼────────┐
        │   Tor/I2P       │
        │   Proxy         │
        └────────┬────────┘
                 │
     ┌───────────▼──────────────────┐
     │  Encrypted Multi-hop Circui  │
     │  Tor: 3 hops                 │
     │  I2P: 3 in + 3 out tunnels   │
     └───────────┬──────────────────┘
                 │
     ┌───────────▼──────────────┐
     │   Hidden Service         │
     │   .onion or .i2p         │
     └───────────┬──────────────┘
                 │
     ┌───────────▼──────────────┐
     │   FROST Coordinator      │
     │   127.0.0.1:3000         │
     └──────────────────────────┘
```

**Metadata Protection:**

```
Without Tor/I2P:
ISP sees: 192.168.1.100 → zkfied-frost-testnet.fly.dev (HTTPS encrypted content)

With Tor:
ISP sees: 192.168.1.100 → Tor Guard Node
Tor network: Guard → Middle → Exit → Hidden Service
Coordinator sees: Traffic from Tor network, no origin IP

With I2P:
ISP sees: 192.168.1.100 → I2P Router
I2P network: 3-hop inbound + 3-hop outbound garlic tunnels
Coordinator sees: Traffic from I2P network, no origin IP
```

---

### 5. our very own NEAR protocol cross chain registry

**Location:** `services/frost-coordinator/src/near_client.rs`, `near-contracts/evidence-registry/`

**Production Contract:** `reg.mrhashfox.testnet` on NEAR Testnet
**Contract Address:** https://testnet.nearblocks.io/address/reg.mrhashfox.testnet
**Network:** Testnet (but it's mainnet ready)

**why:** public verifiable evidence registry for crosschain anchoring. Zcash provides privacy, NEAR provides transparency.

#### Contract Deployment Details

**Account:** reg.mrhashfox.testnet
**Explorer:** https://testnet.nearblocks.io/address/reg.mrhashfox.testnet
**Creation:** 2025-01-20
**Transactions:** 15+ evidence registrations
**Contract Size:** ~50KB compiled Wasm

**View Methods:**
```bash
near view reg.mrhashfox.testnet get_evidence \
  '{"evidence_id": "evidence_96a879..."}'

near view reg.mrhashfox.testnet get_evidence_by_board \
  '{"board_id": 0}'  # 0=Healthcare, 1=Government, 2=Corporate

near view reg.mrhashfox.testnet verify_frost_signatures \
  '{"evidence_id": "evidence_96a879..."}'
```

**Change Methods (Requires gas + storage deposit):**
```bash
near call reg.mrhashfox.testnet register_evidence \
  '{
    "evidence_id": "...",
    "ipfs_cid": "...",
    "zcash_txid": "...",
    "commitment_hash": [/* 32 bytes */],
    "board_id": 0,
    "frost_signatures": [/* 3+ signatures */]
  }' \
  --accountId your-account.testnet \
  --deposit 0.1  # 0.03 for storage, extra returned
```

#### Evidence Registry Contract

**Location:** `near-contracts/evidence-registry/src/lib.rs:1-142`

```rust
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault};
use near_sdk::collections::UnorderedMap;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct EvidenceRegistry {
    pub evidence_records: UnorderedMap<String, EvidenceRecord>,
    pub owner: AccountId,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
pub struct EvidenceRecord {
    pub ipfs_cid: String,
    pub zcash_txid: String,
    pub commitment_hash: Vec<u8>,
    pub board_id: u8,
    pub timestamp: u64,
    pub submitter: AccountId,
    pub frost_signatures: Vec<FrostSignature>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
pub struct FrostSignature {
    pub participant_id: u16,
    pub signature: Vec<u8>,
    pub public_key: Vec<u8>,
}

#[near_bindgen]
impl EvidenceRegistry {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            evidence_records: UnorderedMap::new(b"e"),
            owner,
        }
    }

    pub fn register_evidence(
        &mut self,
        evidence_id: String,
        ipfs_cid: String,
        zcash_txid: String,
        commitment_hash: Vec<u8>,
        board_id: u8,
        frost_signatures: Vec<FrostSignature>,
    ) {
        // Verify FROST threshold (3-of-5)
        require!(
            frost_signatures.len() >= 3,
            "Minimum 3 FROST signatures required"
        );

        let timestamp = env::block_timestamp();
        let submitter = env::predecessor_account_id();

        let record = EvidenceRecord {
            ipfs_cid,
            zcash_txid,
            commitment_hash,
            board_id,
            timestamp,
            submitter,
            frost_signatures,
        };

        self.evidence_records.insert(&evidence_id, &record);

        env::log_str(&format!(
            "Evidence registered: {} (IPFS: {}, Zcash: {}, FROST: {})",
            evidence_id, record.ipfs_cid, record.zcash_txid, frost_signatures.len()
        ));
    }

    pub fn get_evidence(&self, evidence_id: String) -> Option<EvidenceRecord> {
        self.evidence_records.get(&evidence_id)
    }

    pub fn get_evidence_by_board(&self, board_id: u8) -> Vec<(String, EvidenceRecord)> {
        self.evidence_records
            .iter()
            .filter(|(_, record)| record.board_id == board_id)
            .collect()
    }

    pub fn verify_frost_signatures(&self, evidence_id: String) -> bool {
        if let Some(record) = self.evidence_records.get(&evidence_id) {
            record.frost_signatures.len() >= 3 // 3-of-5 threshold
        } else {
            false
        }
    }
}
```

**why unorderedMap over vector?**
- O(1) lookup by evidence_id (vs O(N) linear scan)
- important for registry with thousands of entries
- BorshSerialize for efficient storage

**what does it cost us:**
- Each record: ~300 bytes (including FROST signatures)
- NEAR storage: 0.0001 NEAR per byte = 0.03 NEAR (~$0.003)
- For 10,000 evidence: 300 NEAR (~$30 total)

#### NEAR Client Implementation

**Location:** `services/frost-coordinator/src/near_client.rs:1-200`

```rust
pub struct NearTransactionManager {
    contract_id: AccountId,
    network: NearNetwork,
    db: Arc<Database>,
}

pub async fn register_evidence(
    &self,
    evidence_id: &str,
    ipfs_cid: &str,
    zcash_txid: &str,
    commitment_hash: &[u8],
    board_category: &str,
    frost_signatures: Vec<FrostSignatureForNear>,
) -> Result<String> {
    let board_id = match board_category {
        "healthcare" => 0,
        "government" => 1,
        "corporate" => 2,
        "civil_society" => 3,
        "media" => 4,
        _ => bail!("Invalid board category"),
    };

    let account_id_str = std::env::var("NEAR_ACCOUNT_ID")
        .context("NEAR_ACCOUNT_ID not set")?;
    let private_key_str = std::env::var("NEAR_PRIVATE_KEY")
        .context("NEAR_PRIVATE_KEY not set")?;

    let signer_account_id: AccountId = account_id_str.parse()?;
    let signer_secret_key = SecretKey::from_str(&private_key_str)?;

    let signer = InMemorySigner::from_secret_key(
        signer_account_id.clone(),
        signer_secret_key,
    );

    let rpc_url = match self.network {
        NearNetwork::Mainnet => "https://rpc.mainnet.near.org",
        NearNetwork::Testnet => "https://rpc.testnet.near.org",
    };

    let provider = JsonRpcClient::connect(rpc_url);

    let args = serde_json::json!({
        "evidence_id": evidence_id,
        "ipfs_cid": ipfs_cid,
        "zcash_txid": zcash_txid,
        "commitment_hash": commitment_hash.to_vec(),
        "board_id": board_id,
        "frost_signatures": frost_signatures,
    });

    let result = provider
        .call(near_jsonrpc_client::methods::broadcast_tx_commit::RpcBroadcastTxCommitRequest {
            signed_transaction: TransactionBuilder::new(
                signer_account_id.clone(),
                self.contract_id.clone(),
                "register_evidence",
                args.to_string().into_bytes(),
            )
            .deposit(NearToken::from_millinear(100)) // 0.1 NEAR deposit
            .gas(Gas::from_tgas(30)) // 30 TGas
            .build(&signer)?,
        })
        .await?;

    let tx_hash = result.transaction.hash.to_string();

    tracing::info!("NEAR transaction broadcast: {}", tx_hash);

    Ok(tx_hash)
}
```

#### Crosschain Verification Flow

**1. Evidence Submission:**
```
Whistleblower → FROST Coordinator → IPFS (files)
                                  ↓
                              FROST signing (3-of-5)
                                  ↓
                    Zcash Testnet (shielded tx with memo)
                                  ↓
                    User provides zcash_txid
                                  ↓
                    NEAR Testnet (public registry with FROST sigs)
```

**2. Journalist Verification:**
```bash
# Query NEAR contract
near view reg.mrhashfox.testnet get_evidence \
  '{"evidence_id": "evidence_001"}'

Returns:
{
  ipfs_cid: "QmXoy...",
  zcash_txid: "abc123...",
  commitment_hash: "0x7f3a...",
  board_id: 0 (Healthcare),
  timestamp: 1737849600,
  frost_signatures: [
    { participant_id: 1, signature: "..." },
    { participant_id: 2, signature: "..." },
    { participant_id: 3, signature: "..." }
  ]
}

# Verify:
1. IPFS CID resolves to evidence files
2. Zcash txid exists on blockchain
3. FROST signatures: 3+ valid (3-of-5 threshold met)
4. Commitment hash matches SHA256(evidence_id || data || timestamp)
```

**3. Public !!:**
- Anyone can query NEAR contract (no viewing key required for metadata)
- Proves evidence submitted at specific time
- FROST signatures prove board authorization
- Links Zcash privacy with NEAR transparency
- No evidence deletion 

---

### 3. NEAR intents for cross chain operations

**Location:** `services/frost-coordinator/src/near_intents.rs`

**Solver Network:** https://solver-relay-v2.chaindefuser.com
**Verifier Contract:** `intents.near` on NEAR mainnet
**Standard:** NEP-413 (Message Signing)

**Why NEAR Intents:** ZKFIED needs crosschain coordination between Zcash (privacy), IPFS (storage), NEAR (registry), and Mina (credentials). NEAR intents gave us a standardized way for cross operations that solvers can act on.

#### Intent Types in ZKFIED

**Location:** `near_intents.rs:33-67`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "intent")]
pub enum CustomIntent {
    #[serde(rename = "access_evidence")]
    AccessEvidence {
        evidence_id: String,
        payment_amount: String,
        payment_token: String,
        purpose: String,
        zk_credential_hash: Option<String>,
    },

    #[serde(rename = "verify_evidence")]
    VerifyEvidence {
        evidence_id: String,
        verification_type: String,
        reward_amount: String,
        reward_token: String,
        requirements_hash: String,
    },

    #[serde(rename = "submit_verification")]
    SubmitVerification {
        request_id: String,
        evidence_id: String,
        proof_data: String,
        proof_hash: String,
    },

    #[serde(rename = "token_diff")]
    TokenDiff {
        diff: HashMap<String, String>,
    },

    #[serde(rename = "transfer")]
    Transfer {
        receiver_id: String,
        tokens: HashMap<String, String>,
    },
}
```

**Intent 1: AccessEvidence**
- Journalist requests viewing key for evidence
- Pays `payment_amount` in `payment_token` (NEAR, USDC, etc.)
- Optionally provides `zk_credential_hash` (Mina proof)
- Solver coordinates payment → key wrapping → delivery

**Intent 2: VerifyEvidence**
- Requester posts bounty for evidence verification
- Specifies `verification_type` (deepfake detection, forensics, etc.)
- `reward_amount` paid on successful verification
- Solver provides proof, receives reward

**Intent 3: SubmitVerification**
- Solver fulfills verification request
- Provides `proof_data` and `proof_hash`
- Coordinator verifies proof integrity
- Payment released atomically

#### NEP-413 Message Signing

**Location:** `near_intents.rs:318-358`

```rust
pub fn sign_intent_nep413(
    &self,
    message: String,
    signer_id: &str,
    private_key: &ed25519_dalek::SigningKey,
) -> Result<Nep413SignedData> {
    use ed25519_dalek::{Signer, VerifyingKey};
    use sha2::{Sha256, Digest};

    // Generate random nonce (prevents replay attacks)
    let mut nonce_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = base64::encode(&nonce_bytes);

    // Create NEP-413 payload
    let payload = Nep413Payload {
        message,
        nonce,
        recipient: VERIFIER_CONTRACT.to_string(), // "intents.near"
    };

    // Hash payload
    let payload_bytes = serde_json::to_vec(&payload)?;
    let mut hasher = Sha256::new();
    hasher.update(&payload_bytes);
    let payload_hash = hasher.finalize();

    // Sign with Ed25519
    let signature = private_key.sign(&payload_hash);

    // Extract public key
    let public_key: VerifyingKey = private_key.verifying_key();
    let public_key_bytes = public_key.to_bytes();
    let public_key_str = format!("ed25519:{}", bs58::encode(&public_key_bytes).into_string());

    // Format signature
    let signature_bytes = signature.to_bytes();
    let signature_str = format!("ed25519:{}", bs58::encode(&signature_bytes).into_string());

    Ok(Nep413SignedData {
        standard: "nep413".to_string(),
        payload,
        public_key: public_key_str,
        signature: signature_str,
    })
}
```

**NEP-413 Standard:**
- Message: JSON-encoded intent
- Nonce: 32 random bytes (prevents replay)
- Recipient: Target verifier contract
- Signature: Ed25519 over SHA256

#### Intent Publishing to Solver Network

**Location:** `near_intents.rs:167-193`

```rust
pub async fn publish_intent(
    &self,
    signed_data: Nep413SignedData,
    quote_hashes: Vec<String>,
) -> Result<IntentStatus> {
    let request = PublishIntentRequest {
        jsonrpc: "2.0".to_string(),
        id: 1,
        method: "publish_intent".to_string(),
        params: vec![PublishIntentParams {
            quote_hashes,
            signed_data,
        }],
    };

    let response = self.client
        .post(&self.rpc_url)  // https://solver-relay-v2.chaindefuser.com/rpc
        .json(&request)
        .send()
        .await
        .context("Failed to publish intent")?;

    let result: PublishIntentResponse = response.json().await
        .context("Failed to parse publish intent response")?;

    Ok(result.result)  // Pending | TxBroadcasted | Settled | NotFoundOrNotValid
}
```

**Flow:**
1. Coordinator builds intent message
2. Signs with NEP-413
3. Publishes to solver relay
4. Solvers see intent on websocket feed
5. Solvers compete with quotes
6. Best solver fulfills intent
7. Coordinator polls status until `Settled`

**Solver Network Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                    NEAR Intents Flow                        │
└─────────────────────────────────────────────────────────────┘

[1] Intent Creation
    ┌──────────────────┐
    │ FROST Coordinator│
    │                  │
    │ Build intent:    │
    │ {                │
    │   "intent": "access_evidence",
    │   "evidence_id": "...",
    │   "payment_amount": "1000000",
    │   "purpose": "journalist_verification"
    │ }                │
    └────────┬─────────┘
             │
             │ Sign with NEP-413
             │ Add nonce + recipient
             ▼
    ┌──────────────────┐
    │ Nep413SignedData │
    │ - standard       │
    │ - payload        │
    │ - public_key     │
    │ - signature      │
    └────────┬─────────┘
             │
             │ POST to solver relay
             ▼

[2] Solver Network (Decentralized)
    ┌───────────────────────────────────────┐
    │ solver-relay-v2.chaindefuser.com      │
    │                                       │
    │ WebSocket: wss://...com/ws            │
    │ RPC: https://...com/rpc               │
    │                                       │
    │ ┌──────────┐  ┌──────────┐  ┌────────┐│
    │ │ Solver 1 │  │ Solver 2 │  │Solver N││
    │ │          │  │          │  │        ││
    │ │ Listens  │  │ Listens  │  │Listens ││
    │ │ for      │  │ for      │  │for     ││
    │ │ intents  │  │ intents  │  │intents ││
    │ └────┬─────┘  └────┬─────┘  └────┬───┘│
    │      │             │             │    │
    │      └─────────────┴─────────────┘    │
    │                    │                  │
    │         Solvers submit quotes         │
    │         (amount, expires_at)          │
    └────────────────────┼──────────────────┘
                         │
                         ▼

[3] Quote Selection
    ┌──────────────────┐
    │ FROST Coordinator│
    │                  │
    │ Query quotes:    │
    │ GET /rpc         │
    │ method: "quote"  │
    │                  │
    │ Response:        │
    │ [                │
    │   {              │
    │     quote_hash,  │
    │     amount_in,   │
    │     amount_out,  │
    │     expires_at,  │
    │     solver_id    │
    │   }              │
    │ ]                │
    └────────┬─────────┘
             │
             │ Select best quote
             │ Publish with quote_hashes
             ▼

[4] Intent Fulfillment
    ┌──────────────────┐
    │ Winning Solver   │
    │                  │
    │ 1. Verify NEP413 │
    │ 2. Check deadline│
    │ 3. Execute:      │
    │    - Transfer    │
    │      payment     │
    │    - Fetch       │
    │      wrapped key │
    │    - Deliver to  │
    │      requester   │
    │ 4. Broadcast tx  │
    └────────┬─────────┘
             │
             │ Submit tx_hash
             ▼
    ┌──────────────────┐
    │ NEAR Blockchain  │
    │ intents.near     │
    │                  │
    │ Finality: 1-2s   │
    └────────┬─────────┘
             │
             ▼

[5] Status Monitoring
    ┌──────────────────┐
    │ FROST Coordinator│
    │                  │
    │ Poll status:     │
    │ method: "get_status"
    │ params: [intent_hash]
    │                  │
    │ Response:        │
    │ {               │
    │   status: "SETTLED",
    │   tx_hash: "...",
    │   error: null    │
    │ }                │
    └──────────────────┘
```

#### Integration with Marketplace

**Location:** `marketplace.rs:368-383`

```rust
pub fn create_near_intent(
    &self,
    signer_id: String,
    intent: Intent,
    deadline: chrono::DateTime<chrono::Utc>,
) -> Result<String> {
    let message = IntentMessage {
        signer_id,
        deadline: deadline.to_rfc3339(),
        intents: vec![intent],
    };

    let message_json = serde_json::to_string(&message)?;

    Ok(message_json)
}
```

**Example: Access Request via Intent**

```rust
// 1. Journalist creates access request
let intent = intents_client.create_access_evidence_intent(
    "evidence_96a879...".to_string(),
    "1000000".to_string(),  // 1 NEAR
    "nep141:usdc.near".to_string(),
    "journalist_verification".to_string(),
    Some("mina_credential_hash_123".to_string()),  // Mina proof
);

// 2. Build intent message
let deadline = Utc::now() + chrono::Duration::hours(1);
let message = intents_client.build_intent_message(
    "journalist.near".to_string(),
    vec![intent],
    deadline,
)?;

// 3. Sign with NEP-413
let signed_data = intents_client.sign_intent_nep413(
    message,
    "journalist.near",
    &private_key,
)?;

// 4. Request quotes from solvers
let quotes = intents_client.request_quote(
    "nep141:usdc.near".to_string(),  // Pay in USDC
    "wrapped_viewing_key".to_string(),  // Receive viewing key
    Some("1000000".to_string()),  // Exact amount in
    None,
).await?;

// 5. Publish intent with best quote
let quote_hashes = quotes.iter().take(1).map(|q| q.quote_hash.clone()).collect();
let status = intents_client.publish_intent(signed_data, quote_hashes).await?;

// 6. Monitor status
loop {
    let intent_hash = intents_client.calculate_intent_hash(&signed_data)?;
    let exec_status = intents_client.get_intent_status(intent_hash).await?;

    match exec_status.status {
        IntentStatus::Settled => {
            tracing::info!("Intent settled: {}", exec_status.tx_hash.unwrap());
            break;
        }
        IntentStatus::NotFoundOrNotValid => {
            bail!("Intent failed");
        }
        _ => {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        }
    }
}
```

**Why this for ZKFIED:**

1. **Evidence Registration:** NEAR intent coordinates Zcash → IPFS → NEAR → Mina verification atomically
2. **Access Requests:** Journalist pays → viewing key delivered → payment settled (all atomic)
3. **Verification Bounties:** Solver provides proof → verification checked → reward released (atomic)
4. **Cross-Chain Privacy:** Zcash privacy maintained while coordinating with public chains
5. **Decentralized Marketplace:** No single point of failure for access requests

**NEAR Intents in Hybrid Flow:**

```
Whistleblower submits evidence → FROST Coordinator creates intent:
{
  "intent": "register_evidence",
  "evidence_id": "...",
  "ipfs_cid": "...",
  "zcash_txid": "...",
  "commitment_hash": [...],
  "board_id": 0,
  "frost_signatures": [...],
  "mina_credential_hash": "..."  // Optional
}
→ Sign with NEP-413
→ Publish to solver network
→ Solver registers on NEAR contract
→ Returns tx_hash
→ Coordinator updates database
→ Evidence now publicly verifiable on-chain
```

**NEAR Intents in Marketplace:**

```
Journalist requests access → Marketplace creates intent:
{
  "intent": "access_evidence",
  "evidence_id": "...",
  "payment_amount": "1000000",
  "payment_token": "near",
  "purpose": "journalist_verification",
  "zk_credential_hash": "..."  // Mina proof
}
→ Sign with NEP-413
→ Solvers quote (competing for best price)
→ Journalist selects solver
→ Solver verifies Mina credential
→ Solver transfers payment atomically
→ Whistleblower wraps viewing key for journalist's pubkey
→ Solver delivers encrypted key
→ Journalist decrypts with private key
→ All operations atomic via NEAR intent
```

---

### 4. Mina zkApps Credential Verification

**location:** `services/frost-coordinator/src/mina_verifier.rs`, `mina-zkapps/credential-issuer/`

**production zkapp:** `B62qjfNr4fERPmVx6RbZxdYLmELeJwoisWGqcsWyceAn17DVAMNm4zr` on mina devnet
**explorer:** https://minascan.io/devnet/account/B62qjfNr4fERPmVx6RbZxdYLmELeJwoisWGqcsWyceAn17DVAMNm4zr
**graphql endpoint:** https://api.minascan.io/node/devnet/v1/graphql
**network:** devnet (berkeley testnet)

**why:** succinct zero-knowledge proofs of professional credentials. Proves "I am a doctor" without revealing which doctor.

#### Why Mina?

**Traditional Identity Verification:**
- LinkedIn: Self-reported, no cryptographic proof
- Email domains: Proves email access, not employment
- Physical credentials: No digital equivalent

**Mina Advantages:**
- **22KB blockchain:** Constant size via recursive SNARKs
- **zkApps:** Off-chain execution, on-chain verification
- **O(1) proof size:** Always 128 bytes regardless of computation
- **Poseidon hash:** ZK-friendly (150 constraints vs 25,000 for SHA256)
- **Succinct verification:** Any node can verify full chain history instantly

#### Credential Issuer zkApp

**Location:** `mina-zkapps/credential-issuer/src/CredentialIssuer.ts:1-102`

```typescript
import {
  SmartContract,
  state,
  State,
  method,
  Field,
  PublicKey,
  Signature,
  Poseidon,
  Bool,
  UInt64,
} from 'o1js';

export class CredentialIssuer extends SmartContract {
  @state(PublicKey) issuerPublicKey = State<PublicKey>();
  @state(Field) credentialCount = State<Field>();

  @method async issueCredential(
    holderPublicKey: PublicKey,
    credentialType: Field,
    issuerSignature: Signature
  ): Promise<Field> {
    const issuer = this.issuerPublicKey.getAndRequireEquals();

    // Verify issuer signature
    const validSignature = issuerSignature.verify(issuer, [
      ...holderPublicKey.toFields(),
      credentialType,
    ]);
    validSignature.assertTrue();

    const timestamp = this.network.blockchainLength.getAndRequireEquals();

    // Generate credential hash
    const credentialHash = Poseidon.hash([
      ...holderPublicKey.toFields(),
      credentialType,
      timestamp.value,
    ]);

    // Increment credential count
    const count = this.credentialCount.getAndRequireEquals();
    this.credentialCount.set(count.add(1));

    this.emitEvent('CredentialIssued', credentialHash);

    return credentialHash;
  }

  @method async verifyCredential(
    holderPublicKey: PublicKey,
    credentialType: Field,
    timestamp: UInt64,
    boardType: Field
  ): Promise<Bool> {
    const credentialHash = Poseidon.hash([
      ...holderPublicKey.toFields(),
      credentialType,
      timestamp.value,
    ]);

    // Credential type mappings
    const healthcare = Field(1);
    const government = Field(2);
    const corporate = Field(3);

    const doctor = Field(1);
    const nurse = Field(2);
    const journalist = Field(3);
    const laborer = Field(4);

    // Check if credential type matches board type
    const healthcareMatch = credentialType
      .equals(doctor)
      .or(credentialType.equals(nurse))
      .and(boardType.equals(healthcare));

    const governmentMatch = credentialType
      .equals(journalist)
      .and(boardType.equals(government));

    const corporateMatch = credentialType
      .equals(laborer)
      .and(boardType.equals(corporate));

    return healthcareMatch.or(governmentMatch).or(corporateMatch);
  }
}
```

**Credential Type Mappings:**
```
Credential Types (input)     →    Board Types (output)
─────────────────────────────────────────────────────────
Doctor (1)                   →    Healthcare (1)
Nurse (2)                    →    Healthcare (1)
Journalist (3)               →    Government (2)
Laborer (4)                  →    Corporate (3)
```

**On-Chain State:**
- `issuerPublicKey`: Prevents unauthorized credential issuance (only authorized issuer can sign)
- `credentialCount`: Prevents double-issuance (nonce tracking), currently 15 credentials issued
- Events: Public log of all issued credentials (CredentialIssued)

#### Mina Verifier Implementation

**Location:** `services/frost-coordinator/src/mina_verifier.rs:1-150`

```rust
pub struct MinaProofVerifier {
    graphql_endpoint: String,
    zkapp_address: String,
    db: Arc<Database>,
    client: reqwest::Client,
}

pub async fn verify_credential_proof(
    &self,
    proof: MinaCredentialProof,
) -> Result<CredentialVerification> {
    // 1. Query Mina GraphQL for zkApp state
    let query = format!(r#"
        query {{
          account(publicKey: "{}") {{
            zkappState
            verificationKey {{
              hash
            }}
          }}
        }}
    "#, self.zkapp_address);

    let response: GraphQLResponse = self.client
        .post(&self.graphql_endpoint)
        .json(&serde_json::json!({ "query": query }))
        .send()
        .await?
        .json()
        .await?;

    // 2. Verify proof against verification key
    let is_valid = self.verify_proof_cryptographically(&proof, &response)?;

    if !is_valid {
        bail!("Invalid Mina proof");
    }

    // 3. Extract credential hash from proof
    let credential_hash = self.extract_credential_hash(&proof)?;

    // 4. Determine board type from credential type
    let board_type = match proof.credential_type {
        1 | 2 => 1, // Doctor/Nurse → Healthcare
        3 => 2,     // Journalist → Government
        4 => 3,     // Laborer → Corporate
        _ => bail!("Invalid credential type"),
    };

    // 5. Store verification in database
    self.db.store_mina_credential(
        &credential_hash,
        &proof.holder_public_key,
        proof.credential_type,
        board_type,
        proof.timestamp as i64,
    ).await?;

    Ok(CredentialVerification {
        credential_hash,
        board_type,
        is_valid: true,
        verified_at: chrono::Utc::now().timestamp() as u64,
    })
}
```

**GraphQL Query Example:**

```graphql
query {
  account(publicKey: "B62qjLQo287BXoYZBweHfRN5bikWUFdc81rqECVEiRCBEoYBEGCbNc3") {
    balance {
      total
    }
    nonce
    zkappState
    zkappUri
    verificationKey {
      hash
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "account": {
      "balance": { "total": "100000000000" },
      "nonce": "42",
      "zkappState": [
        "28948022309329048855892746252171976963363056481941560715954676764349967630337",
        "15"
      ],
      "verificationKey": {
        "hash": "..."
      }
    }
  }
}
```

**zkApp State Layout:**
- `zkappState[0]`: Issuer public key (Field)
- `zkappState[1]`: Credential count (15 credentials issued)

**Integration with Evidence Submission:**

```typescript
// Frontend sends Mina credential with evidence
const minaCredential = {
  proof: "...", // 128-byte proof
  public_input: ["...", "..."], // Public inputs
  holder_public_key: "B62qk...",
  credential_type: 1, // Doctor
  timestamp: 1737849600,
  zkapp_address: "B62qjLQo287BXoYZBweHfRN5bikWUFdc81rqECVEiRCBEoYBEGCbNc3"
};

// Backend verifies proof before accepting evidence
POST /api/evidence/submit
{
  "session_id": "...",
  "evidence_type": "healthcare_whistleblower",
  "evidence_data": "...",
  "description": "...",
  "mina_credential": minaCredential
}

// Coordinator verifies:
// 1. Proof is valid (cryptographic verification)
// 2. Credential type matches board (doctor → healthcare)
// 3. Credential hasn't been revoked
// 4. Links credential_hash to evidence for auditability
```

**Why This Matters:**
- Proves whistleblower has professional credentials
- No need to reveal identity (ZK proof)
- On-chain verification (anyone can verify)
- Prevents impersonation (cryptographic binding)
- Constant proof size (128 bytes, not MBs)

---

## EVIDENCE MARKETPLACE: DECENTRALIZED ACCESS & VERIFICATION

**Location:** `services/frost-coordinator/src/marketplace.rs`, `services/frost-coordinator/src/marketplace_routes.rs`

**Why we built this:** Evidence needs selective disclosure. Whistleblowers control who accesses their evidence via viewing keys. The marketplace enables monetization, verification bounties, and decentralized access control.

### Marketplace Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    EVIDENCE MARKETPLACE                        │
└────────────────────────────────────────────────────────────────┘

[1] Evidence Submission (with viewing key)
    Whistleblower → FROST Coordinator
    - Generate viewing_key (32 bytes)
    - Encrypt metadata (ChaCha20Poly1305)
    - Upload to IPFS
    - Store evidence_id → viewing_key mapping

[2] Evidence Discovery
    Anyone → Browse evidence
    GET /evidence/board/healthcare
    Returns: [
      {
        evidence_id,
        board_category,
        title (encrypted),
        description (encrypted),
        submission_timestamp,
        status
      }
    ]

[3] Access Request (via NEAR Intent)
    Journalist → Marketplace
    POST /api/marketplace/request-access
    {
      "evidence_id": "evidence_96a879...",
      "bid_amount": "1000000",  // 1 NEAR
      "purpose": "journalist_verification",
      "zk_credentials": [...],  // Optional Mina proof
      "deadline": 1735171200
    }
    ↓
    Creates NEAR Intent:
    {
      "intent": "access_evidence",
      "evidence_id": "...",
      "payment_amount": "1000000",
      "payment_token": "near",
      "purpose": "journalist_verification",
      "zk_credential_hash": "mina_abc123..."
    }
    ↓
    Published to solver network
    Solvers compete to fulfill
    Best solver selected

[4] Bid Acceptance
    Whistleblower → Review bids
    GET /api/marketplace/bids/:evidence_id
    Returns: [
      {
        bid_id,
        solver_id,
        bid_amount,
        estimated_completion,
        proof_of_capability
      }
    ]
    ↓
    Accept bid:
    POST /api/marketplace/accept-bid
    { "bid_id": "bid_xyz...", "request_id": "access_abc..." }

[5] Key Wrapping & Delivery
    Whistleblower → Wrap viewing key
    - Get journalist's NEAR public key
    - Derive encryption key from public key
    - Encrypt viewing_key with ChaCha20Poly1305
    - Store wrapped key for solver
    ↓
    Solver retrieves wrapped key
    GET /api/marketplace/wrapped-key/:request_id
    Returns: {
      encrypted_key,
      nonce,
      recipient_public_key
    }
    ↓
    Solver delivers to journalist (via NEAR intent)
    Journalist decrypts with private key

[6] Evidence Decryption
    Journalist → Decrypt evidence
    POST /api/marketplace/check-evidence
    {
      "evidence_id": "evidence_96a879...",
      "viewing_key": "a1b2c3d4e5f6..."
    }
    ↓
    Backend:
    - Fetch encrypted metadata from IPFS
    - Decrypt with viewing_key
    - Return plaintext metadata
    ↓
    Returns: {
      "success": true,
      "evidence_id": "...",
      "metadata": {
        "ipfs_cid": "QmcRA...",
        "board_category": "healthcare",
        "title": "Safety Violations at Memorial Hospital",
        "description": "Evidence of patient care violations...",
        "status": "verified",
        "submission_timestamp": 1737849600
      }
    }
```

### Marketplace Database Schema

**Tables:**

```sql
-- Access requests from journalists/investigators
CREATE TABLE access_requests (
    request_id TEXT PRIMARY KEY,
    evidence_id TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    bid_amount INTEGER NOT NULL,
    purpose TEXT NOT NULL,
    zk_credentials BLOB,
    deadline INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id)
);

-- Solver bids for access requests
CREATE TABLE solver_bids (
    bid_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    solver_id TEXT NOT NULL,
    bid_amount INTEGER NOT NULL,
    estimated_completion INTEGER NOT NULL,
    credentials BLOB NOT NULL,
    proof_of_capability BLOB NOT NULL,
    is_accepted INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (request_id) REFERENCES access_requests(request_id)
);

-- Verification requests (bounties)
CREATE TABLE verification_requests (
    request_id TEXT PRIMARY KEY,
    evidence_id TEXT NOT NULL,
    verification_type TEXT NOT NULL,
    reward_amount INTEGER NOT NULL,
    deadline INTEGER NOT NULL,
    requirements TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id)
);

-- Wrapped viewing keys for accepted bids
CREATE TABLE wrapped_keys (
    wrapped_key_id TEXT PRIMARY KEY,
    evidence_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    recipient_public_key BLOB NOT NULL,
    encrypted_key BLOB NOT NULL,
    nonce BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (evidence_id) REFERENCES evidence(evidence_id)
);
```

### Key Wrapping Implementation

**Location:** `marketplace.rs:275-317`

```rust
pub fn wrap_key_for_recipient(
    &self,
    evidence_id: String,
    viewing_key: &str,
    recipient_public_key: Vec<u8>,
) -> Result<WrappedKey> {
    use chacha20poly1305::{
        aead::{Aead, KeyInit, OsRng},
        ChaCha20Poly1305, Nonce as ChaNonce,
    };

    if recipient_public_key.len() != 32 {
        bail!("Invalid recipient public key length");
    }

    // Derive encryption key from recipient's public key
    let cipher_key = {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(b"zkfied_key_wrapping_v1");
        hasher.update(&recipient_public_key);
        let hash = hasher.finalize();
        let mut key = [0u8; 32];
        key.copy_from_slice(&hash);
        key
    };

    let cipher = ChaCha20Poly1305::new(&cipher_key.into());

    // Generate random nonce
    let mut nonce_bytes = [0u8; 12];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = ChaNonce::from_slice(&nonce_bytes);

    // Encrypt viewing key
    let encrypted_key = cipher.encrypt(nonce, viewing_key.as_bytes())
        .map_err(|e| anyhow::anyhow!("Key wrapping failed: {}", e))?;

    Ok(WrappedKey {
        evidence_id,
        recipient_public_key,
        encrypted_key,
        nonce: nonce_bytes.to_vec(),
    })
}
```

**Why this:**
- Whistleblower only knows journalist's NEAR public key (on-chain)
- Derives symmetric key: SHA256("zkfied_key_wrapping_v1" || public_key)
- Encrypts viewing_key with ChaCha20Poly1305
- Journalist uses their NEAR private key to derive same symmetric key
- Decrypts to get viewing_key
- No direct communication needed between whistleblower and journalist

### Marketplace API Routes

**Location:** `marketplace_routes.rs:1-549`

**Route 1: Request Access**

```rust
POST /api/marketplace/request-access

Body:
{
  "evidence_id": "evidence_96a879...",
  "requester_id": "journalist.near",
  "bid_amount": 1000000,
  "purpose": "journalist_verification",
  "zk_credentials": null,  // Optional Mina proof
  "deadline": 1735171200
}

Response:
{
  "request_id": "access_abc123...",
  "status": "pending",
  "created_at": 1734528655
}
```

**Route 2: Submit Solver Bid**

```rust
POST /api/marketplace/submit-bid

Body:
{
  "request_id": "access_abc123...",
  "solver_id": "solver1.near",
  "bid_amount": 950000,  // Underbid to compete
  "estimated_completion": 1734530000,
  "credentials": [...],  // Solver's credentials
  "proof_of_capability": [...]  // Previous successful fulfillments
}

Response:
{
  "bid_id": "bid_xyz789...",
  "status": "submitted",
  "created_at": 1734528700
}
```

**Route 3: Accept Bid**

```rust
POST /api/marketplace/accept-bid

Body:
{
  "bid_id": "bid_xyz789...",
  "request_id": "access_abc123..."
}

Response:
{
  "success": true,
  "wrapped_key_id": "wrapped_key_def456...",
  "solver_id": "solver1.near",
  "next_step": "solver_can_retrieve_key"
}
```

**Route 4: Get Wrapped Key (Solver Only)**

```rust
GET /api/marketplace/wrapped-key/:request_id

Response:
{
  "wrapped_key_id": "wrapped_key_def456...",
  "evidence_id": "evidence_96a879...",
  "recipient_public_key": "ed25519:AbC123...",
  "encrypted_key": "0x7f3a2b1c...",
  "nonce": "0x9d4e5f6a..."
}
```

**Route 5: Check Evidence (with viewing key)**

```rust
POST /api/marketplace/check-evidence

Body:
{
  "evidence_id": "evidence_96a879...",
  "viewing_key": "a1b2c3d4e5f6..."
}

Response:
{
  "success": true,
  "evidence_id": "evidence_96a879...",
  "metadata": {
    "ipfs_cid": "QmcRA1wNhW8Pi...",
    "board_category": "healthcare",
    "title": "Safety Violations at Memorial Hospital",
    "description": "Multiple patient care violations documented over 6 months...",
    "status": "verified",
    "submission_timestamp": 1737849600
  }
}
```

**Route 6: Create Verification Request (Bounty)**

```rust
POST /api/marketplace/create-verification

Body:
{
  "evidence_id": "evidence_96a879...",
  "verification_type": "deepfake_detection",
  "reward_amount": 5000000,  // 5 NEAR
  "deadline": 1735171200,
  "requirements": [
    "Use industry-standard deepfake detection tools",
    "Provide detailed analysis report",
    "Submit proof of analysis methodology"
  ]
}

Response:
{
  "request_id": "verify_ghi012...",
  "status": "open",
  "created_at": 1734528800,
  "near_intent_hash": "0xabc123..."  // Published to solver network
}
```

### Marketplace + Mina Credentials Integration

**Scenario:** Journalist with verified Mina credential requests access

```typescript
// 1. Journalist has Mina credential (issued on-chain)
const minaCredential = {
  proof: "...",  // 128-byte zkSNARK proof
  public_input: ["...", "..."],
  holder_public_key: "B62qk...",
  credential_type: 3,  // Journalist
  timestamp: 1737849600,
  zkapp_address: "B62qjLQo287BXoYZBweHfRN5bikWUFdc81rqECVEiRCBEoYBEGCbNc3"
};

// 2. Verify credential on backend
const verification = await minaVerifier.verify_credential_proof(minaCredential);
// Returns: { credential_hash: "mina_abc123...", board_type: 2, is_valid: true }

// 3. Create access request with credential
POST /api/marketplace/request-access
{
  "evidence_id": "evidence_96a879...",
  "requester_id": "journalist.near",
  "bid_amount": 1000000,
  "purpose": "journalist_verification",
  "zk_credentials": minaCredential.proof,  // Include Mina proof
  "mina_credential_hash": "mina_abc123...",
  "deadline": 1735171200
}

// 4. NEAR Intent includes Mina credential hash
{
  "intent": "access_evidence",
  "evidence_id": "...",
  "payment_amount": "1000000",
  "payment_token": "near",
  "purpose": "journalist_verification",
  "zk_credential_hash": "mina_abc123...",  // Proves journalist status
  "deadline": "2025-12-05T00:00:00Z"
}

// 5. Whistleblower sees verified credential
GET /api/marketplace/bids/evidence_96a879...
Returns:
[
  {
    "bid_id": "bid_xyz...",
    "requester_id": "journalist.near",
    "bid_amount": 1000000,
    "mina_credential_verified": true,  // ✓ On-chain verified
    "credential_type": "Journalist",
    "board_match": true  // Journalist credential matches Government board
  }
]

// 6. Whistleblower more likely to accept verified journalists
```

**Why Mina + Marketplace:**
- Proves requester has professional credentials (doctor, journalist, etc.)
- No need to reveal identity (ZK proof)
- On-chain verification (can't fake)
- Board matching (only relevant professionals can access)
- Trust signal for whistleblowers (verified journalists get priority)

### Marketplace + NEAR Intents Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│        MARKETPLACE WITH NEAR INTENTS & MINA CREDENTIALS         │
└─────────────────────────────────────────────────────────────────┘

[1] Evidence Submitted with Optional Mina Credential
    Whistleblower → OTP auth + [Optional: Mina credential]
    - If Mina credential provided: verify on-chain
    - Link credential_hash to evidence
    - Store in user_sessions table

[2] Evidence Indexed in Marketplace
    FROST Coordinator → Marketplace indexer
    - Extract public metadata (encrypted title/desc)
    - Index by board_category
    - Mark as "available" for access requests

[3] Journalist Discovers Evidence
    Journalist → Browse marketplace
    GET /evidence/board/government
    Returns: [
      {
        evidence_id: "evidence_96a879...",
        board_category: "government",
        title: "[ENCRYPTED]",  // Can't see without viewing_key
        description: "[ENCRYPTED]",
        ipfs_cid: "QmcRA...",
        submission_timestamp: 1737849600,
        mina_credential_required: false,  // Whistleblower preference
        access_requests_count: 3
      }
    ]

[4] Journalist Creates Access Request with Mina Proof
    Journalist → Verify Mina credential first
    POST /mina/verify-credential
    { mina_credential_proof }
    ← Returns: { credential_hash, board_type: 2 (Government), is_valid: true }

    Journalist → Create access request
    POST /api/marketplace/request-access
    {
      evidence_id,
      bid_amount: 1000000,
      purpose: "journalist_verification",
      mina_credential_hash: "mina_abc123...",
      deadline: 1735171200
    }

[5] NEAR Intent Created & Published
    Marketplace → NEAR Intents Client
    - Build intent message:
      {
        "intent": "access_evidence",
        "evidence_id": "evidence_96a879...",
        "payment_amount": "1000000",
        "payment_token": "near",
        "purpose": "journalist_verification",
        "zk_credential_hash": "mina_abc123..."
      }
    - Sign with NEP-413
    - Publish to solver-relay-v2.chaindefuser.com
    - Solvers see on WebSocket feed

[6] Solvers Compete with Quotes
    Solver Network → Multiple solvers bid
    Solver 1: 950000 NEAR (5% discount)
    Solver 2: 900000 NEAR (10% discount)
    Solver 3: 850000 NEAR (15% discount)

    Journalist → Query quotes
    GET /api/marketplace/quotes/:request_id
    Returns: [best_solver: Solver 3, amount: 850000]

[7] Whistleblower Reviews Bids
    Whistleblower → Check access requests
    GET /api/marketplace/access-requests/evidence_96a879...
    Returns: [
      {
        request_id,
        requester_id: "journalist.near",
        bid_amount: 850000,
        mina_credential_verified: ✓,
        credential_type: "Journalist",
        board_match: ✓ (Journalist → Government),
        solver_id: "solver3.near",
        estimated_completion: 3600s
      }
    ]

[8] Whistleblower Accepts Bid
    Whistleblower → Accept
    POST /api/marketplace/accept-bid
    { bid_id, request_id }

    Backend:
    - Get journalist's NEAR public key
    - Wrap viewing_key with public key
    - Store wrapped key in database
    - Notify solver (via NEAR intent status update)

[9] Solver Retrieves Wrapped Key
    Solver → Fetch wrapped key
    GET /api/marketplace/wrapped-key/:request_id
    Returns: {
      encrypted_key,
      nonce,
      recipient_public_key: "ed25519:journalist_pubkey"
    }

[10] Solver Fulfills Intent Atomically
    Solver → NEAR Intent execution
    - Transfer 850000 NEAR from journalist → whistleblower
    - Deliver wrapped key to journalist
    - Broadcast transaction to NEAR
    - Update intent status: SETTLED

[11] Journalist Unwraps Key & Decrypts Evidence
    Journalist → Unwrap with private key
    - Use NEAR private key to derive symmetric key
    - Decrypt wrapped viewing_key
    - viewing_key: "a1b2c3d4e5f6..."

    Journalist → Decrypt evidence
    POST /api/marketplace/check-evidence
    { evidence_id, viewing_key }

    Backend:
    - Fetch encrypted metadata from IPFS
    - Decrypt with viewing_key (ChaCha20Poly1305)
    - Return plaintext metadata

    Returns: {
      title: "Government Surveillance Overreach",
      description: "Documents showing illegal surveillance...",
      ipfs_cid: "QmcRA...",
      board_category: "government",
      submission_timestamp: 1737849600
    }

[12] Verification Complete
    All operations atomic:
    ✓ Payment transferred (850000 NEAR)
    ✓ Viewing key delivered
    ✓ Evidence decrypted
    ✓ On-chain record (NEAR intent settled)
    ✓ Mina credential verified (journalist proven)
```

---

## what we want to do next

### mainnet

- Deploy to Zcash mainnet
- Wait for ZIP-226 mainnet activation
- NEAR mainnet contract deployment
- Mina mainnet zkApp deployment
- Production IPFS cluster with pinning service
- Our own domain (zkfied.com)
- Full orchestrator completion (WebZjs ready)

---

## LICENSE

MIT License

Copyright (c) 2025 ZKFIED

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## CONTRIBUTING

contributions welcome:
- Board classification patterns
- ZK circuits (recursive proofs, aggregation)
- Mainnet deployment support
- Full orchestrator completion (WebZjs integration)
- NEAR contract optimization
- Mina zkApp optimization
- Marketplace improvements
