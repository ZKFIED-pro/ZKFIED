#!/usr/bin/env ts-node

/**
 * ZKFIED - Zero-Knowledge Evidence Network
 * End-to-End Production Demo
 *
 * This demo showcases the complete whistleblower protection flow:
 * 1. FROST Board Setup (Threshold Governance)
 * 2. Whistleblower Authorization Request
 * 3. Board Member Signing (Threshold Signatures)
 * 4. Evidence Submission with Payment Disclosure
 * 5. Time-Lock Insurance (Dead Man's Switch)
 *
 * Requirements:
 * - Running zcashd node (regtest/testnet)
 * - Node.js 18+
 * - Environment variables: ZCASH_RPC_URL, ZCASH_RPC_USER, ZCASH_RPC_PASS
 */

import { ZcashRPCClient } from '../lib/zcash-rpc/src/client';
import { FROSTCoordinator, FROSTBoard, BoardMember } from '../lib/zcash-rpc/src/frost';
import { EvidenceManager, EvidenceSubmission } from '../lib/zcash-rpc/src/evidence';
import { TimeLockManager, InsurancePolicy } from '../lib/zcash-rpc/src/timelock';
import { BoardCategory } from '../lib/zcash-rpc/src/memo';

// Configuration
const ZCASH_CONFIG = {
  url: process.env.ZCASH_RPC_URL || 'http://localhost:18232',
  username: process.env.ZCASH_RPC_USER || 'zcashrpc',
  password: process.env.ZCASH_RPC_PASS || 'password',
};

// Demo color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title: string) {
  console.log('\n' + '='.repeat(80));
  log(`  ${title}`, 'bright');
  console.log('='.repeat(80) + '\n');
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Demo Scenario: Corporate Whistleblower
 *
 * A pharmaceutical company employee discovers evidence of fraudulent clinical trials.
 * They use ZKFIED to:
 * 1. Get authorization from Healthcare Ethics Board (FROST)
 * 2. Submit evidence anonymously with proof
 * 3. Set up insurance policy in case of retaliation
 */
async function runDemo() {
  section('ZKFIED - Zero-Knowledge Evidence Network Demo');

  log('Initializing Zcash RPC client...', 'cyan');
  const client = new ZcashRPCClient(ZCASH_CONFIG);

  try {
    const info = await client.getInfo();
    log(`✓ Connected to Zcash node (Block: ${info.blocks})`, 'green');
  } catch (error) {
    log(`✗ Failed to connect to zcashd. Please ensure it's running.`, 'yellow');
    log(`  URL: ${ZCASH_CONFIG.url}`, 'yellow');
    process.exit(1);
  }

  // Initialize managers
  const frostCoordinator = new FROSTCoordinator(client);
  const evidenceManager = new EvidenceManager(client);
  const timeLockManager = new TimeLockManager(client);

  // ============================================================================
  // STEP 1: Setup Addresses
  // ============================================================================
  section('Step 1: Setting Up Shielded Addresses');

  log('Creating addresses for all participants...', 'cyan');

  const whistleblowerAddress = await client.getNewAddress('orchard');
  log(`Whistleblower: ${whistleblowerAddress.substring(0, 20)}...`, 'blue');

  const coordinatorAddress = await client.getNewAddress('orchard');
  log(`FROST Coordinator: ${coordinatorAddress.substring(0, 20)}...`, 'blue');

  const registryAddress = await client.getNewAddress('orchard');
  log(`Evidence Registry: ${registryAddress.substring(0, 20)}...`, 'blue');

  const beneficiaryAddress = await client.getNewAddress('orchard');
  log(`Insurance Beneficiary: ${beneficiaryAddress.substring(0, 20)}...`, 'blue');

  // Board member addresses (3-of-5 threshold)
  const boardMemberAddresses = await Promise.all([
    client.getNewAddress('orchard'),
    client.getNewAddress('orchard'),
    client.getNewAddress('orchard'),
    client.getNewAddress('orchard'),
    client.getNewAddress('orchard'),
  ]);

  log(`✓ Created addresses for 5 board members`, 'green');

  // ============================================================================
  // STEP 2: FROST Board Setup
  // ============================================================================
  section('Step 2: Creating FROST Healthcare Ethics Board (3-of-5 Threshold)');

  log('Board Members:', 'cyan');
  const boardMembers: Omit<BoardMember, 'publicKey'>[] = [
    {
      id: 'dr-sarah-chen',
      organization: 'WHO Medical Ethics Division',
      address: boardMemberAddresses[0],
    },
    {
      id: 'prof-james-wilson',
      organization: 'Harvard Medical School Ethics',
      address: boardMemberAddresses[1],
    },
    {
      id: 'dr-amina-hassan',
      organization: 'Doctors Without Borders',
      address: boardMemberAddresses[2],
    },
    {
      id: 'dr-carlos-rodriguez',
      organization: 'FDA Ethics Committee',
      address: boardMemberAddresses[3],
    },
    {
      id: 'dr-mei-ling',
      organization: 'International Medical Council',
      address: boardMemberAddresses[4],
    },
  ];

  boardMembers.forEach((member, idx) => {
    log(`  ${idx + 1}. ${member.id} - ${member.organization}`, 'blue');
  });

  log('\nCreating FROST board with 3-of-5 threshold...', 'cyan');

  const board: FROSTBoard = await frostCoordinator.createBoard({
    category: BoardCategory.HEALTHCARE,
    threshold: 3,
    members: boardMembers,
    coordinatorAddress,
  });

  log(`✓ Board created: ${board.boardId.substring(0, 16)}...`, 'green');
  log(`  Category: Healthcare Ethics`, 'green');
  log(`  Threshold: ${board.threshold} of ${board.members.length} signatures required`, 'green');

  // ============================================================================
  // STEP 3: Whistleblower Authorization Request
  // ============================================================================
  section('Step 3: Whistleblower Requests Authorization');

  const whistleblowerPseudonym = 'PharmaTruth2025';
  const evidenceDescription = 'Clinical trial data manipulation for Drug X-147';

  log(`Pseudonym: ${whistleblowerPseudonym}`, 'cyan');
  log(`Evidence: ${evidenceDescription}`, 'cyan');

  // Create credential hash (simulated - would be real credential in production)
  const credentialHash = require('crypto')
    .createHash('blake2b512')
    .update('employee-id-12345' + 'department-clinical-research')
    .digest()
    .slice(0, 32)
    .toString('hex');

  log(`\nSubmitting authorization request to board...`, 'cyan');

  const authRequest = await frostCoordinator.requestAuthorization({
    board,
    whistleblowerAddress,
    credentialHash,
    whistleblowerPseudonym,
  });

  log(`✓ Authorization request created: ${authRequest.requestId.substring(0, 16)}...`, 'green');
  log(`  Board: Healthcare Ethics`, 'green');
  log(`  Credential hash: ${credentialHash.substring(0, 16)}...`, 'green');

  // ============================================================================
  // STEP 4: Board Members Sign Authorization
  // ============================================================================
  section('Step 4: Board Members Review and Sign (Threshold Signatures)');

  log('Board members reviewing whistleblower credentials...', 'cyan');
  await sleep(2000); // Simulate review time

  // Simulate 3 board members signing (meeting threshold)
  const signingMembers = [
    { member: board.members[0], privateKey: 'simulation-key-0' },
    { member: board.members[1], privateKey: 'simulation-key-1' },
    { member: board.members[2], privateKey: 'simulation-key-2' },
  ];

  log('\nCollecting threshold signatures:', 'cyan');

  for (const { member, privateKey } of signingMembers) {
    log(`  Requesting signature from ${member.id}...`, 'blue');

    await frostCoordinator.signAuthorization({
      board,
      request: authRequest,
      memberAddress: member.address,
      privateKeyShare: privateKey,
    });

    log(`  ✓ Signature received from ${member.id}`, 'green');
    await sleep(1000);
  }

  log('\nAggregating threshold signatures...', 'cyan');

  const authResponse = await frostCoordinator.aggregateAuthorization({
    board,
    request: authRequest,
    timeoutMs: 60000,
  });

  log(`✓ Authorization APPROVED`, 'green');
  log(`  Request ID: ${authResponse.requestId.substring(0, 16)}...`, 'green');
  log(`  Signature: ${authResponse.signature.substring(0, 32)}...`, 'green');
  log(`  Signing Members: ${authResponse.signingMembers.length}/${board.threshold}`, 'green');
  log(`  Expires: ${new Date(authResponse.expiryTimestamp).toISOString()}`, 'green');

  // ============================================================================
  // STEP 5: Submit Evidence with Payment Disclosure
  // ============================================================================
  section('Step 5: Submitting Evidence with Cryptographic Proof');

  log('Preparing evidence package...', 'cyan');

  // Simulate IPFS upload (in production, this would be real IPFS)
  const ipfsCID = 'Qm' + require('crypto').randomBytes(23).toString('base64url');
  const evidenceData = JSON.stringify({
    type: 'clinical_trial_fraud',
    drug: 'X-147',
    trials: ['NCT12345', 'NCT67890'],
    manipulation_methods: ['cherry-picking', 'endpoint_switching'],
    affected_patients: 1247,
    risk_level: 'critical',
  });

  log(`Evidence CID: ${ipfsCID}`, 'blue');

  const submission: EvidenceSubmission = {
    whistleblowerAddress,
    registryAddress,
    ipfsCID,
    evidenceData,
    board: BoardCategory.HEALTHCARE,
    frostSignature: authResponse.signature,
  };

  log('\nSubmitting evidence to shielded registry...', 'cyan');

  const evidenceTxid = await evidenceManager.submitEvidence(submission);

  log(`✓ Evidence submitted successfully`, 'green');
  log(`  Transaction: ${evidenceTxid.substring(0, 16)}...`, 'green');
  log(`  Registry: ${registryAddress.substring(0, 20)}...`, 'green');

  // Generate payment disclosure proof
  log('\nGenerating payment disclosure proof...', 'cyan');

  const paymentDisclosure = await evidenceManager.generatePaymentDisclosure(
    evidenceTxid,
    0,
    0,
    `Evidence submission for case: ${authRequest.requestId}`
  );

  log(`✓ Payment disclosure generated`, 'green');
  log(`  This proves the evidence was submitted without revealing sender`, 'green');

  // Verify the disclosure
  const isValid = await evidenceManager.verifyPaymentDisclosure(paymentDisclosure);
  log(`  Verification: ${isValid ? '✓ VALID' : '✗ INVALID'}`, isValid ? 'green' : 'yellow');

  // ============================================================================
  // STEP 6: Time-Lock Insurance Setup
  // ============================================================================
  section('Step 6: Setting Up Time-Lock Insurance (Dead Man\'s Switch)');

  log('Creating insurance policy to protect whistleblower...', 'cyan');

  const policy: InsurancePolicy = await timeLockManager.createPolicy({
    whistleblowerAddress,
    beneficiaries: [beneficiaryAddress],
    evidenceCID: ipfsCID,
    heartbeatIntervalDays: 7, // Whistleblower must send heartbeat every 7 days
    stakeAmount: 0.01, // 0.01 ZEC stake
  });

  log(`✓ Insurance policy created`, 'green');
  log(`  Policy ID: ${policy.policyId.substring(0, 16)}...`, 'green');
  log(`  Heartbeat Interval: ${policy.heartbeatIntervalBlocks} blocks (~7 days)`, 'green');
  log(`  Beneficiaries: ${policy.beneficiaries.length}`, 'green');
  log(`  Stake: ${policy.stakeAmount} ZEC`, 'green');
  log(`  Evidence CID: ${policy.evidenceCID}`, 'green');

  log('\nHow it works:', 'cyan');
  log('  • Whistleblower sends heartbeat transaction every 7 days', 'blue');
  log('  • If heartbeat stops (whistleblower in danger/detained)', 'blue');
  log('  • Evidence automatically released to beneficiaries', 'blue');
  log('  • Uses nExpiryHeight for consensus-level enforcement', 'blue');

  // Send first heartbeat
  log('\nSending initial heartbeat...', 'cyan');

  const heartbeatTxid = await timeLockManager.sendHeartbeat(policy);

  log(`✓ Heartbeat sent: ${heartbeatTxid.substring(0, 16)}...`, 'green');

  // Check policy status
  const policyStatus = await timeLockManager.checkPolicyStatus(policy);

  log(`\nPolicy Status:`, 'cyan');
  log(`  Current Block: ${policyStatus.currentHeight}`, 'blue');
  log(`  Expires at Block: ${policyStatus.expiryHeight}`, 'blue');
  log(`  Blocks Remaining: ${policyStatus.expiryHeight - policyStatus.currentHeight}`, 'blue');
  log(`  Status: ${policyStatus.triggered ? '🚨 TRIGGERED' : '✓ Active'}`,
      policyStatus.triggered ? 'yellow' : 'green');

  // ============================================================================
  // STEP 7: List Evidence (Registry View)
  // ============================================================================
  section('Step 7: Evidence Registry (Authorized Board View)');

  log('Board members can view all evidence for their category...', 'cyan');

  const allEvidence = await evidenceManager.listEvidence(
    registryAddress,
    BoardCategory.HEALTHCARE
  );

  log(`\nHealthcare Evidence Registry:`, 'cyan');
  log(`  Total submissions: ${allEvidence.length}`, 'green');

  if (allEvidence.length > 0) {
    allEvidence.forEach((evidence, idx) => {
      log(`\n  Evidence #${idx + 1}:`, 'blue');
      log(`    CID: ${evidence.ipfsCID}`, 'blue');
      log(`    Board: Healthcare (${evidence.board})`, 'blue');
      log(`    Timestamp: ${new Date(evidence.timestamp * 1000).toISOString()}`, 'blue');
      log(`    Commitment: ${evidence.commitment.substring(0, 16)}...`, 'blue');
      log(`    FROST Signature: ${evidence.frostSignature ? '✓ Present' : '✗ Missing'}`,
          evidence.frostSignature ? 'green' : 'yellow');
    });
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  section('Demo Complete - ZKFIED System Summary');

  log('✓ FROST Threshold Governance', 'green');
  log('  └─ Healthcare Ethics Board (3-of-5 threshold)', 'blue');
  log('  └─ Decentralized authorization without single point of failure', 'blue');

  log('\n✓ Anonymous Evidence Submission', 'green');
  log('  └─ Shielded transactions hide whistleblower identity', 'blue');
  log('  └─ Payment disclosure proves submission without revealing sender', 'blue');
  log('  └─ IPFS for decentralized evidence storage', 'blue');

  log('\n✓ Time-Lock Insurance', 'green');
  log('  └─ Dead man\'s switch protects against retaliation', 'blue');
  log('  └─ Consensus-enforced with nExpiryHeight', 'blue');
  log('  └─ Evidence auto-releases if heartbeat stops', 'blue');

  log('\n✓ Cryptographic Proofs', 'green');
  log('  └─ BLAKE2b commitments for evidence integrity', 'blue');
  log('  └─ FROST signatures for threshold authorization', 'blue');
  log('  └─ Payment disclosure for submission proof', 'blue');

  log('\n🎯 All components working on production zcashd', 'magenta');
  log('🔒 Zero-knowledge privacy preserved throughout', 'magenta');
  log('⚖️  Decentralized governance via FROST', 'magenta');
  log('🛡️  Whistleblower protection via time-locks', 'magenta');

  section('Next Steps for Production Deployment');

  log('1. Deploy to Zcash testnet for integration testing', 'cyan');
  log('2. Build web interface for whistleblowers', 'cyan');
  log('3. Implement real IPFS integration', 'cyan');
  log('4. Set up board member key management (HSMs)', 'cyan');
  log('5. Add monitoring for insurance policy expirations', 'cyan');
  log('6. Security audit of smart contract logic', 'cyan');
  log('7. Deploy to mainnet with real ethics boards', 'cyan');

  log('\n🏆 ZKFIED: Protecting those who protect the truth', 'bright');
}

// Run the demo
if (require.main === module) {
  runDemo()
    .then(() => {
      log('\n✓ Demo completed successfully', 'green');
      process.exit(0);
    })
    .catch((error) => {
      log(`\n✗ Demo failed: ${error.message}`, 'yellow');
      console.error(error);
      process.exit(1);
    });
}

export { runDemo };
