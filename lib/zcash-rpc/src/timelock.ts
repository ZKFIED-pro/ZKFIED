import { ZcashRPCClient } from './client';
import { MemoEncoder } from './memo';

export interface InsurancePolicy {
  policyId: string;
  whistleblowerAddress: string;
  beneficiaries: string[];
  evidenceCID: string;
  heartbeatIntervalBlocks: number;
  stakeAmount: number;
  createdHeight: number;
  lastHeartbeatHeight: number;
  expiryHeight: number;
}

export class TimeLockManager {
  constructor(private client: ZcashRPCClient) {}

  async createPolicy(params: {
    whistleblowerAddress: string;
    beneficiaries: string[];
    evidenceCID: string;
    heartbeatIntervalDays: number;
    stakeAmount: number;
  }): Promise<InsurancePolicy> {
    const currentHeight = await this.client.getCurrentHeight();
    const blocksPerDay = 1152;
    const heartbeatIntervalBlocks = params.heartbeatIntervalDays * blocksPerDay;

    const policyId = this.generatePolicyId(params.whistleblowerAddress, params.evidenceCID);

    const policyMemo = JSON.stringify({
      type: 'insurance_policy',
      policyId,
      beneficiaries: params.beneficiaries,
      evidenceCID: params.evidenceCID,
      heartbeatIntervalBlocks,
      createdAt: Date.now(),
    });

    const opid = await this.client.sendShielded({
      from: params.whistleblowerAddress,
      to: params.whistleblowerAddress,
      amount: params.stakeAmount,
      memo: policyMemo,
    });

    await this.client.waitForOperation(opid);

    return {
      policyId,
      whistleblowerAddress: params.whistleblowerAddress,
      beneficiaries: params.beneficiaries,
      evidenceCID: params.evidenceCID,
      heartbeatIntervalBlocks,
      stakeAmount: params.stakeAmount,
      createdHeight: currentHeight,
      lastHeartbeatHeight: currentHeight,
      expiryHeight: currentHeight + heartbeatIntervalBlocks,
    };
  }

  async sendHeartbeat(policy: InsurancePolicy): Promise<string> {
    const currentHeight = await this.client.getCurrentHeight();
    const newExpiryHeight = currentHeight + policy.heartbeatIntervalBlocks;

    const heartbeatMemo = MemoEncoder.encodeHeartbeat(policy.policyId, newExpiryHeight);

    const opid = await this.client.sendShielded({
      from: policy.whistleblowerAddress,
      to: policy.whistleblowerAddress,
      amount: 0.0001,
      memo: heartbeatMemo,
      expiryHeight: newExpiryHeight,
    });

    return await this.client.waitForOperation(opid);
  }

  async checkPolicyStatus(policy: InsurancePolicy): Promise<{
    triggered: boolean;
    currentHeight: number;
    expiryHeight: number;
  }> {
    const currentHeight = await this.client.getCurrentHeight();

    const received = await this.client.listReceivedByAddress(policy.whistleblowerAddress);

    let latestHeartbeat: any = null;

    for (const tx of received) {
      if (!tx.memo) continue;

      try {
        const memo = JSON.parse(tx.memo);
        if (memo.type === 'heartbeat' && memo.policyId === policy.policyId) {
          if (!latestHeartbeat || memo.timestamp > latestHeartbeat.timestamp) {
            latestHeartbeat = memo;
          }
        }
      } catch {
        continue;
      }
    }

    const expiryHeight = latestHeartbeat ? latestHeartbeat.expiryHeight : policy.expiryHeight;
    const triggered = currentHeight > expiryHeight;

    return {
      triggered,
      currentHeight,
      expiryHeight,
    };
  }

  async triggerPolicy(policy: InsurancePolicy, beneficiary: string): Promise<string> {
    if (!policy.beneficiaries.includes(beneficiary)) {
      throw new Error('Unauthorized beneficiary');
    }

    const triggerMemo = JSON.stringify({
      type: 'insurance_trigger',
      policyId: policy.policyId,
      evidenceCID: policy.evidenceCID,
      triggeredAt: Date.now(),
    });

    const opid = await this.client.sendShielded({
      from: policy.whistleblowerAddress,
      to: beneficiary,
      amount: policy.stakeAmount,
      memo: triggerMemo,
    });

    return await this.client.waitForOperation(opid);
  }

  private generatePolicyId(address: string, evidenceCID: string): string {
    const { createHash } = require('crypto');
    return createHash('blake2b512')
      .update(address + evidenceCID + Date.now().toString())
      .digest()
      .slice(0, 32)
      .toString('hex');
  }
}
