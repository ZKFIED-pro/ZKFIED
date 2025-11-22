import { ZcashRPCClient } from './client';
import { MemoEncoder, EvidenceMetadata, BoardCategory } from './memo';
import { createHash } from 'crypto';

export interface EvidenceSubmission {
  whistleblowerAddress: string;
  registryAddress: string;
  ipfsCID: string;
  evidenceData: string;
  board: BoardCategory;
  frostSignature?: string;
}

export class EvidenceManager {
  constructor(private client: ZcashRPCClient) {}

  async submitEvidence(submission: EvidenceSubmission): Promise<string> {
    const commitment = this.createCommitment(submission.evidenceData);
    const viewingKeysHint = this.createViewingKeysHint([submission.registryAddress]);

    const metadata: EvidenceMetadata = {
      board: submission.board,
      ipfsCID: submission.ipfsCID,
      commitment,
      timestamp: Math.floor(Date.now() / 1000),
      viewingKeysHint,
      frostSignature: submission.frostSignature,
    };

    const memo = MemoEncoder.encodeEvidence(metadata);

    const opid = await this.client.sendShielded({
      from: submission.whistleblowerAddress,
      to: submission.registryAddress,
      amount: 0.0001,
      memo,
    });

    return await this.client.waitForOperation(opid);
  }

  async listEvidence(registryAddress: string, board?: BoardCategory): Promise<EvidenceMetadata[]> {
    const received = await this.client.listReceivedByAddress(registryAddress);

    const evidence: EvidenceMetadata[] = [];

    for (const tx of received) {
      if (!tx.memo) continue;

      try {
        const metadata = MemoEncoder.decodeEvidence(tx.memo);

        if (board === undefined || metadata.board === board) {
          evidence.push(metadata);
        }
      } catch {
        continue;
      }
    }

    return evidence.sort((a, b) => b.timestamp - a.timestamp);
  }

  async generatePaymentDisclosure(
    txid: string,
    jsIndex: number = 0,
    outputIndex: number = 0,
    message?: string
  ): Promise<string> {
    return await this.client.getPaymentDisclosure(txid, jsIndex, outputIndex, message);
  }

  async verifyPaymentDisclosure(disclosure: string): Promise<boolean> {
    return await this.client.validatePaymentDisclosure(disclosure);
  }

  private createCommitment(data: string): string {
    return createHash('blake2b512')
      .update(data)
      .digest()
      .slice(0, 32)
      .toString('hex');
  }

  private createViewingKeysHint(addresses: string[]): string {
    const combined = addresses.join('');
    return createHash('blake2b512')
      .update(combined)
      .digest()
      .slice(0, 32)
      .toString('hex');
  }
}
