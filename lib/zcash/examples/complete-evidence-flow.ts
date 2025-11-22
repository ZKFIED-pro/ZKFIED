/**
 * Complete ZKFIED Evidence Submission Flow
 *
 * This example demonstrates the full end-to-end flow of evidence submission
 * using all Zcash-native features: ZSA, FROST, Payment Disclosure, and Time-Lock.
 */

import {
  ZcashClient,
  ZSAManager,
  FROSTManager,
  PaymentDisclosureManager,
  TimeLockManager,
  BoardCategory,
  EvidenceMetadata,
  AuthorizationRequest,
  CredentialProof
} from '../src';

/**
 * Step 1: Setup Zcash Client
 */
async function setupClient(): Promise<ZcashClient> {
  const client = new ZcashClient({
    url: process.env.ZCASH_RPC_URL || 'http://localhost:8232',
    username: process.env.ZCASH_RPC_USER,
    password: process.env.ZCASH_RPC_PASSWORD
  });

  console.log('✓ Zcash client connected');
  return client;
}

/**
 * Step 2: Setup FROST Board (Healthcare Example)
 *
 * 5 NGOs form a 3-of-5 threshold group to authorize healthcare whistleblowers
 */
async function setupHealthcareBoard(
  frostManager: FROSTManager
) {
  const healthcareBoard = await frostManager.createGroup({
    board: BoardCategory.HEALTHCARE,
    threshold: 3,
    participants: [
      {
        id: 'ngo1',
        organization: 'Doctors Without Borders',
        index: 1
      },
      {
        id: 'ngo2',
        organization: 'World Health Organization',
        index: 2
      },
      {
        id: 'ngo3',
        organization: 'International Committee Red Cross',
        index: 3
      },
      {
        id: 'ngo4',
        organization: 'Amnesty International Health',
        index: 4
      },
      {
        id: 'ngo5',
        organization: 'Human Rights Watch',
        index: 5
      }
    ]
  });

  console.log('✓ Healthcare FROST board created');
  console.log(`  Group ID: ${healthcareBoard.groupId}`);
  console.log(`  Threshold: ${healthcareBoard.threshold} of ${healthcareBoard.totalParticipants}`);

  return healthcareBoard;
}

/**
 * Step 3: Whistleblower Requests Authorization
 *
 * A nurse submits credential proof to Healthcare FROST group
 */
async function requestAuthorization(
  frostManager: FROSTManager,
  healthcareBoard: any
) {
  // Whistleblower creates credential proof
  const credentialProof: CredentialProof = {
    credentialType: 'nurse',
    credentialHash: '0xabc123...', // Hash of nursing license
    minaProof: '...', // Mina zkApp proof (optional)
    metadata: {
      institution: 'General Hospital',
      licenseNumber: 'RN-12345',
      state: 'California'
    }
  };

  // Create authorization request
  const request: AuthorizationRequest = {
    requestId: 'req_' + Date.now(),
    whistleblowerPseudonym: 'nurse_anonymous_01',
    board: BoardCategory.HEALTHCARE,
    credentialProof,
    timestamp: Date.now()
  };

  // Submit to FROST group
  const opid = await frostManager.requestAuthorization(healthcareBoard, request);

  console.log('✓ Authorization requested');
  console.log(`  Request ID: ${request.requestId}`);
  console.log(`  Credential: ${credentialProof.credentialType}`);

  return request;
}

/**
 * Step 4: NGOs Verify and Sign Authorization
 *
 * 3 out of 5 NGOs verify the credential and sign authorization
 */
async function approveAuthorization(
  frostManager: FROSTManager,
  healthcareBoard: any,
  request: AuthorizationRequest
) {
  console.log('✓ NGOs verifying credential...');

  // Simulate 3 NGOs signing (in production, each NGO does this independently)
  const signatures = [];

  // NGO 1 signs
  const signature1 = await frostManager.signAuthorization(
    healthcareBoard,
    request,
    1,
    'private_key_share_ngo1' // In production: stored securely
  );
  signatures.push({ participantIndex: 1, share: signature1 });
  console.log('  ✓ Doctors Without Borders signed');

  // NGO 2 signs
  const signature2 = await frostManager.signAuthorization(
    healthcareBoard,
    request,
    2,
    'private_key_share_ngo2'
  );
  signatures.push({ participantIndex: 2, share: signature2 });
  console.log('  ✓ WHO signed');

  // NGO 3 signs
  const signature3 = await frostManager.signAuthorization(
    healthcareBoard,
    request,
    3,
    'private_key_share_ngo3'
  );
  signatures.push({ participantIndex: 3, share: signature3 });
  console.log('  ✓ Red Cross signed');

  // Aggregate signatures
  const authMemo = await frostManager.aggregateSignatures(
    healthcareBoard,
    request,
    signatures
  );

  console.log('✓ Authorization approved!');
  console.log(`  FROST Signature: ${authMemo.frostSignature.slice(0, 32)}...`);
  console.log(`  Expires: ${new Date(authMemo.expiryTimestamp).toISOString()}`);

  return authMemo;
}

/**
 * Step 5: Prepare Evidence Package
 *
 * Whistleblower creates evidence offline and uploads to IPFS
 */
async function prepareEvidence() {
  // In production:
  // 1. Write report + attachments offline
  // 2. Encrypt with AES-256
  // 3. Upload to IPFS
  // 4. Generate commitment hash

  const evidencePackage = {
    title: 'Hospital Malpractice Evidence',
    description: 'Evidence of systematic patient safety violations',
    attachments: ['medical_records.pdf', 'incident_reports.pdf'],
    ipfsCID: 'bafkreiabcd1234...', // IPFS CID after upload
    commitment: '0xdef456...' // Hash for integrity verification
  };

  console.log('✓ Evidence prepared');
  console.log(`  IPFS CID: ${evidencePackage.ipfsCID}`);

  return evidencePackage;
}

/**
 * Step 6: Mint Evidence ZSA Token
 *
 * Create Evidence as Zcash Shielded Asset with FROST authorization
 */
async function mintEvidenceToken(
  zsaManager: ZSAManager,
  authMemo: any,
  evidencePackage: any,
  whistleblowerAddress: string,
  registryAddress: string
) {
  // Prepare evidence metadata for memo
  const metadata: EvidenceMetadata = {
    type: 0x01, // Evidence
    board: BoardCategory.HEALTHCARE,
    ipfsCID: evidencePackage.ipfsCID,
    commitment: evidencePackage.commitment,
    timestamp: Date.now(),
    viewingKeys: [
      'viewing_key_ngo1',
      'viewing_key_journalist1',
      'viewing_key_investigator1'
    ]
  };

  // Mint Evidence ZSA
  const opid = await zsaManager.mintEvidenceToken({
    issuerAddress: whistleblowerAddress,
    recipientAddress: registryAddress,
    metadata,
    frostSignature: authMemo.frostSignature
  });

  console.log('✓ Evidence ZSA minted');
  console.log(`  Operation ID: ${opid}`);

  return opid;
}

/**
 * Step 7: Generate Payment Disclosure Proof
 *
 * Create public proof that evidence was submitted (without revealing identity)
 */
async function createPublicProof(
  disclosureManager: PaymentDisclosureManager,
  txid: string
) {
  // Generate payment disclosure proof
  const shareableProof = await disclosureManager.generateShareableProof({
    txid,
    jsIndex: 0,
    outputIndex: 0,
    message: 'Healthcare whistleblower evidence - Hospital malpractice'
  });

  console.log('✓ Payment disclosure proof generated');
  console.log('  Proof can be posted publicly for verification:');
  console.log(shareableProof);

  // Anyone can verify this proof
  const verification = await disclosureManager.verifyShareableProof(shareableProof);
  console.log(`✓ Proof verified: ${verification.valid}`);

  return shareableProof;
}

/**
 * Step 8: Setup Time-Lock Insurance Policy
 *
 * Whistleblower creates dead-man switch for protection
 */
async function setupInsurancePolicy(
  timeLockManager: TimeLockManager,
  whistleblowerAddress: string,
  evidenceAssetId: string,
  evidenceCID: string
) {
  const policy = await timeLockManager.createPolicy({
    insuranceAddress: whistleblowerAddress,
    beneficiaries: [
      'zs1ngo_doctors_without_borders...',
      'zs1journalist_nyt...',
      'zs1ngo_human_rights_watch...'
    ],
    evidenceAssetId,
    evidenceCID,
    heartbeatIntervalDays: 7, // Weekly heartbeats
    stakeAmount: 1.0 // 1 ZEC stake
  });

  console.log('✓ Time-lock insurance policy created');
  console.log(`  Policy ID: ${policy.policyId}`);
  console.log(`  Heartbeat interval: ${policy.heartbeatInterval / 86400} days`);
  console.log(`  Beneficiaries: ${policy.beneficiaryAddresses.length}`);

  return policy;
}

/**
 * Step 9: Send Weekly Heartbeat
 *
 * Whistleblower sends heartbeat to prove they're safe
 */
async function sendWeeklyHeartbeat(
  client: ZcashClient,
  timeLockManager: TimeLockManager,
  policy: any
) {
  // Get current block height
  const currentHeight = await (client as any).call('getblockcount');

  // Send heartbeat with nExpiryHeight
  const heartbeat = await timeLockManager.sendHeartbeat(policy, currentHeight);

  console.log('✓ Heartbeat sent');
  console.log(`  Transaction ID: ${heartbeat.txid}`);
  console.log(`  Expires at block: ${heartbeat.expiryHeight}`);
  console.log(`  Next heartbeat due: ${new Date(Date.now() + policy.heartbeatInterval * 1000).toISOString()}`);

  return heartbeat;
}

/**
 * Step 10: Monitor Policy Status
 *
 * Watcher service checks if whistleblower is safe
 */
async function monitorPolicy(
  client: ZcashClient,
  timeLockManager: TimeLockManager,
  policy: any
) {
  const currentHeight = await (client as any).call('getblockcount');

  const status = await timeLockManager.checkPolicyStatus(policy, currentHeight);

  if (status.triggered) {
    console.log('⚠️  ALERT: Dead-man switch triggered!');
    console.log('   Whistleblower may be in danger');
    console.log('   Evidence auto-releasing to beneficiaries...');

    // Beneficiary can now claim
    const claimTxid = await timeLockManager.triggerPolicy(
      policy,
      'zs1ngo_doctors_without_borders...'
    );

    console.log('✓ Evidence released to NGO');
    console.log(`  Claim transaction: ${claimTxid}`);
  } else {
    console.log('✓ Whistleblower status: SAFE');
    console.log('  Last heartbeat active');
  }
}

/**
 * Main execution flow
 */
async function main() {
  console.log('='.repeat(60));
  console.log('ZKFIED: Complete Evidence Submission Flow');
  console.log('Zcash-Native Whistleblower Platform');
  console.log('='.repeat(60));
  console.log();

  try {
    // Initialize
    const client = await setupClient();
    const zsaManager = new ZSAManager(client);
    const frostManager = new FROSTManager(client);
    const disclosureManager = new PaymentDisclosureManager(client);
    const timeLockManager = new TimeLockManager(client);

    // Setup board
    console.log('\n[Phase 1: Board Setup]');
    const healthcareBoard = await setupHealthcareBoard(frostManager);

    // Request authorization
    console.log('\n[Phase 2: Authorization Request]');
    const request = await requestAuthorization(frostManager, healthcareBoard);

    // NGOs approve
    console.log('\n[Phase 3: FROST Authorization]');
    const authMemo = await approveAuthorization(frostManager, healthcareBoard, request);

    // Prepare evidence
    console.log('\n[Phase 4: Evidence Preparation]');
    const evidencePackage = await prepareEvidence();

    // Mint ZSA
    console.log('\n[Phase 5: Evidence ZSA Minting]');
    const whistleblowerAddress = 'zs1whistleblower...';
    const registryAddress = 'zs1registry_healthcare...';
    const mintOpid = await mintEvidenceToken(
      zsaManager,
      authMemo,
      evidencePackage,
      whistleblowerAddress,
      registryAddress
    );

    // Wait for confirmation
    const txid = await client.waitForOperation(mintOpid);
    console.log(`✓ Evidence confirmed on-chain: ${txid}`);

    // Generate public proof
    console.log('\n[Phase 6: Payment Disclosure]');
    const publicProof = await createPublicProof(disclosureManager, txid);

    // Setup insurance
    console.log('\n[Phase 7: Time-Lock Insurance]');
    const policy = await setupInsurancePolicy(
      timeLockManager,
      whistleblowerAddress,
      'evidence_zsa_' + txid.slice(0, 16),
      evidencePackage.ipfsCID
    );

    // Send heartbeat
    console.log('\n[Phase 8: Heartbeat Monitoring]');
    const heartbeat = await sendWeeklyHeartbeat(client, timeLockManager, policy);

    // Monitor status
    console.log('\n[Phase 9: Status Check]');
    await monitorPolicy(client, timeLockManager, policy);

    console.log('\n' + '='.repeat(60));
    console.log('✓ Complete flow executed successfully!');
    console.log('='.repeat(60));
    console.log();
    console.log('Summary:');
    console.log('  ✓ FROST authorization with 3-of-5 NGO signatures');
    console.log('  ✓ Evidence minted as ZSA token');
    console.log('  ✓ Payment disclosure proof generated');
    console.log('  ✓ Time-lock insurance policy active');
    console.log('  ✓ Heartbeat monitoring enabled');
    console.log();
    console.log('Next steps:');
    console.log('  - Whistleblower sends weekly heartbeats');
    console.log('  - Journalists decrypt evidence with viewing keys');
    console.log('  - Public verifies authenticity via payment disclosure');
    console.log('  - NGOs receive evidence if heartbeat stops');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };
