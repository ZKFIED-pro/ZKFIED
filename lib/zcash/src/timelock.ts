/**
 * Time-Lock Insurance Implementation
 *
 * Dead-man switch using Zcash transaction expiry (nExpiryHeight, ZIP 203).
 * Whistleblowers create insurance policies that auto-release evidence to
 * beneficiaries if heartbeat transactions stop (indicating danger).
 *
 * Reference: ZIP 203 - Transaction Expiry
 */

import { ZcashClient } from './client';

export interface InsurancePolicy {
  policyId: string;
  whistleblowerAddress: string;
  beneficiaryAddresses: string[]; // NGOs, journalists, etc.
  evidenceAssetId: string;        // ZSA asset ID of evidence
  evidenceCID: string;            // IPFS CID (encrypted)
  encryptedDecryptionKeys: { [beneficiary: string]: string }; // Encrypted viewing keys
  heartbeatInterval: number;      // Seconds between heartbeats
  createdAt: number;
  lastHeartbeat: number;
  status: 'active' | 'triggered' | 'cancelled';
}

export interface HeartbeatTransaction {
  policyId: string;
  txid: string;
  blockHeight: number;
  expiryHeight: number; // nExpiryHeight field
  timestamp: number;
}

export interface TimeLockParams {
  insuranceAddress: string;       // Dedicated insurance z-address
  beneficiaries: string[];        // NGO/journalist z-addresses
  evidenceAssetId: string;        // ZSA to transfer on trigger
  evidenceCID: string;
  heartbeatIntervalDays: number;  // e.g., 7 days
  stakeAmount: number;            // ZEC amount (e.g., 1 ZEC)
}

/**
 * Time-Lock Insurance Manager
 *
 * Creates and manages dead-man switch insurance policies for whistleblowers.
 * If heartbeat transactions stop, evidence automatically releases to beneficiaries.
 */
export class TimeLockManager {
  constructor(private client: ZcashClient) {}

  /**
   * Create a new insurance policy
   *
   * Whistleblower stakes ZEC and sets up heartbeat schedule.
   * If heartbeats stop, beneficiaries can claim evidence + funds.
   */
  async createPolicy(params: TimeLockParams): Promise<InsurancePolicy> {
    const {
      insuranceAddress,
      beneficiaries,
      evidenceAssetId,
      evidenceCID,
      heartbeatIntervalDays,
      stakeAmount
    } = params;

    // Generate policy ID
    const policyId = this.generatePolicyId(
      insuranceAddress,
      evidenceAssetId
    );

    // Encrypt decryption keys for each beneficiary
    const encryptedKeys: { [key: string]: string } = {};
    const masterDecryptionKey = this.generateDecryptionKey();

    for (const beneficiary of beneficiaries) {
      encryptedKeys[beneficiary] = await this.encryptForAddress(
        masterDecryptionKey,
        beneficiary
      );
    }

    // Create policy memo
    const policyMemo = this.encodePolicyMemo({
      type: 'insurance_policy',
      policyId,
      beneficiaries,
      evidenceAssetId,
      evidenceCID,
      encryptedKeys,
      heartbeatInterval: heartbeatIntervalDays * 24 * 3600,
      createdAt: Date.now()
    });

    // Send stake transaction with policy memo
    const opid = await this.client.sendShieldedTransaction({
      from: insuranceAddress,
      to: insuranceAddress, // Self-send to create record
      amount: stakeAmount,
      memo: policyMemo
    });

    const txid = await this.client.waitForOperation(opid);

    // Create policy object
    const policy: InsurancePolicy = {
      policyId,
      whistleblowerAddress: insuranceAddress,
      beneficiaryAddresses: beneficiaries,
      evidenceAssetId,
      evidenceCID,
      encryptedDecryptionKeys: encryptedKeys,
      heartbeatInterval: heartbeatIntervalDays * 24 * 3600,
      createdAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active'
    };

    return policy;
  }

  /**
   * Send heartbeat transaction
   *
   * Whistleblower must send this periodically (e.g., weekly).
   * Uses nExpiryHeight to enforce time-lock at consensus level.
   */
  async sendHeartbeat(
    policy: InsurancePolicy,
    currentBlockHeight: number
  ): Promise<HeartbeatTransaction> {
    // Calculate expiry height (current + interval blocks)
    // Zcash: ~75 seconds per block average
    const blocksPerDay = (24 * 3600) / 75; // ~1152 blocks/day
    const intervalDays = policy.heartbeatInterval / (24 * 3600);
    const expiryHeight = currentBlockHeight + Math.floor(blocksPerDay * intervalDays);

    // Create heartbeat memo
    const heartbeatMemo = this.encodeHeartbeatMemo({
      type: 'heartbeat',
      policyId: policy.policyId,
      timestamp: Date.now(),
      expiryHeight
    });

    // Send transaction with nExpiryHeight set
    // This is consensus-enforced: transaction MUST be mined before expiryHeight
    const opid = await this.sendTransactionWithExpiry({
      from: policy.whistleblowerAddress,
      to: policy.whistleblowerAddress, // Self-send
      amount: 0.0001, // Nominal amount
      memo: heartbeatMemo,
      expiryHeight
    });

    const txid = await this.client.waitForOperation(opid);

    const heartbeat: HeartbeatTransaction = {
      policyId: policy.policyId,
      txid,
      blockHeight: currentBlockHeight,
      expiryHeight,
      timestamp: Date.now()
    };

    return heartbeat;
  }

  /**
   * Check if policy has been triggered (heartbeat expired)
   *
   * Monitors blockchain to detect missed heartbeats.
   * If heartbeat transaction not mined before expiryHeight, policy triggers.
   */
  async checkPolicyStatus(
    policy: InsurancePolicy,
    currentBlockHeight: number
  ): Promise<{ triggered: boolean; expiredHeartbeat?: HeartbeatTransaction }> {
    // Get all heartbeat transactions for policy
    const heartbeats = await this.getHeartbeats(policy);

    if (heartbeats.length === 0) {
      // No heartbeats sent yet
      return { triggered: false };
    }

    // Check most recent heartbeat
    const lastHeartbeat = heartbeats[heartbeats.length - 1];

    // If current block height exceeds expiry, heartbeat expired
    if (currentBlockHeight > lastHeartbeat.expiryHeight) {
      return {
        triggered: true,
        expiredHeartbeat: lastHeartbeat
      };
    }

    return { triggered: false };
  }

  /**
   * Trigger dead-man switch
   *
   * Called when heartbeat expires. Transfers evidence + funds to beneficiaries.
   */
  async triggerPolicy(
    policy: InsurancePolicy,
    beneficiaryAddress: string
  ): Promise<string> {
    // Verify beneficiary is authorized
    if (!policy.beneficiaryAddresses.includes(beneficiaryAddress)) {
      throw new Error('Unauthorized beneficiary');
    }

    // Create trigger memo with decryption key
    const triggerMemo = this.encodeTriggerMemo({
      type: 'insurance_trigger',
      policyId: policy.policyId,
      evidenceCID: policy.evidenceCID,
      decryptionKey: policy.encryptedDecryptionKeys[beneficiaryAddress],
      triggeredAt: Date.now()
    });

    // Transfer evidence ZSA + stake to beneficiary
    // This would use ZSA transfer in production
    const opid = await this.client.sendShieldedTransaction({
      from: policy.whistleblowerAddress,
      to: beneficiaryAddress,
      amount: 0.0001, // In production: transfer full stake
      memo: triggerMemo
    });

    return await this.client.waitForOperation(opid);
  }

  /**
   * Cancel policy (whistleblower is safe, wants to reclaim funds)
   */
  async cancelPolicy(policy: InsurancePolicy): Promise<string> {
    const cancelMemo = this.encodeCancelMemo({
      type: 'insurance_cancel',
      policyId: policy.policyId,
      cancelledAt: Date.now()
    });

    const opid = await this.client.sendShieldedTransaction({
      from: policy.whistleblowerAddress,
      to: policy.whistleblowerAddress, // Reclaim funds
      amount: 0.0001, // In production: transfer full stake back
      memo: cancelMemo
    });

    return await this.client.waitForOperation(opid);
  }

  /**
   * Send transaction with nExpiryHeight field
   *
   * Uses z_sendmany with expiryheight parameter.
   * Consensus rule: transaction MUST be mined before specified block height.
   */
  private async sendTransactionWithExpiry(params: {
    from: string;
    to: string;
    amount: number;
    memo: string;
    expiryHeight: number;
  }): Promise<string> {
    const { from, to, amount, memo, expiryHeight } = params;

    // z_sendmany with expiryheight parameter
    const operation = {
      address: to,
      amount,
      memo
    };

    // Set expiry height using setexpiryheight RPC or in transaction params
    // This is a consensus rule enforced by all nodes
    const opid = await (this.client as any).call('z_sendmany', [
      from,
      [operation],
      1, // minconf
      0, // fee
      'AllowRevealedRecipients',
      expiryHeight // nExpiryHeight
    ]) as string;

    return opid;
  }

  /**
   * Get all heartbeat transactions for a policy
   */
  private async getHeartbeats(policy: InsurancePolicy): Promise<HeartbeatTransaction[]> {
    const received = await this.client.listReceivedByAddress(policy.whistleblowerAddress);

    const heartbeats: HeartbeatTransaction[] = [];

    for (const tx of received) {
      if (!tx.memo) continue;

      try {
        const decoded = this.decodeHeartbeatMemo(tx.memo);
        if (decoded.type === 'heartbeat' && decoded.policyId === policy.policyId) {
          heartbeats.push({
            policyId: decoded.policyId,
            txid: tx.txid,
            blockHeight: 0, // TODO: Get from transaction
            expiryHeight: decoded.expiryHeight,
            timestamp: decoded.timestamp
          });
        }
      } catch {
        continue;
      }
    }

    return heartbeats.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Generate unique policy ID
   */
  private generatePolicyId(address: string, assetId: string): string {
    const crypto = require('crypto');
    return crypto
      .createHash('blake2b512')
      .update(address + assetId + Date.now().toString())
      .digest()
      .slice(0, 32)
      .toString('hex');
  }

  /**
   * Generate master decryption key for evidence
   */
  private generateDecryptionKey(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Encrypt decryption key for specific beneficiary address
   */
  private async encryptForAddress(key: string, address: string): Promise<string> {
    // In production: Use viewing key encryption
    // For now, simple placeholder
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', address)
      .update(key)
      .digest('hex');
  }

  /**
   * Encode policy memo
   */
  private encodePolicyMemo(data: any): string {
    return JSON.stringify(data);
  }

  /**
   * Encode heartbeat memo
   */
  private encodeHeartbeatMemo(data: any): string {
    return JSON.stringify(data);
  }

  /**
   * Decode heartbeat memo
   */
  private decodeHeartbeatMemo(memoHex: string): any {
    const buffer = Buffer.from(memoHex, 'hex');
    const raw = buffer.toString('utf8').replace(/\0+$/, '');
    return JSON.parse(raw);
  }

  /**
   * Encode trigger memo
   */
  private encodeTriggerMemo(data: any): string {
    return JSON.stringify(data);
  }

  /**
   * Encode cancel memo
   */
  private encodeCancelMemo(data: any): string {
    return JSON.stringify(data);
  }
}

/**
 * Example Usage:
 *
 * // Whistleblower creates insurance policy
 * const timeLock = new TimeLockManager(zcashClient);
 *
 * const policy = await timeLock.createPolicy({
 *   insuranceAddress: 'zs1whistleblower...',
 *   beneficiaries: [
 *     'zs1ngo_doctors_without_borders...',
 *     'zs1journalist_nyt...',
 *     'zs1ngo_human_rights_watch...'
 *   ],
 *   evidenceAssetId: 'evidence_zsa_123',
 *   evidenceCID: 'bafk...',
 *   heartbeatIntervalDays: 7, // Weekly heartbeats
 *   stakeAmount: 1.0 // 1 ZEC stake
 * });
 *
 * // Every week, send heartbeat
 * const currentHeight = await zcashClient.getCurrentBlockHeight();
 * const heartbeat = await timeLock.sendHeartbeat(policy, currentHeight);
 *
 * // Watcher service checks status
 * const status = await timeLock.checkPolicyStatus(policy, currentHeight);
 * if (status.triggered) {
 *   console.log('ALERT: Whistleblower may be in danger!');
 *   // Notify beneficiaries
 * }
 *
 * // If heartbeat expires, beneficiary claims
 * if (status.triggered) {
 *   const txid = await timeLock.triggerPolicy(
 *     policy,
 *     'zs1ngo_doctors_without_borders...'
 *   );
 *   console.log('Evidence released to NGO:', txid);
 * }
 */
