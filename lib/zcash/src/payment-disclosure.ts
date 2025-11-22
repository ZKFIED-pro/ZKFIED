/**
 * Payment Disclosure Proof Implementation (ZIP 311)
 *
 * Allows proving that a shielded payment was made without revealing the sender's identity.
 * Used to prove evidence submission while maintaining whistleblower anonymity.
 *
 * Reference: ZIP 311 - Payment Disclosure
 */

import { ZcashClient } from './client';

export interface PaymentDisclosureParams {
  txid: string;           // Transaction ID
  jsIndex: number;        // JoinSplit index (0 for most transactions)
  outputIndex: number;    // Output index (usually 0 or 1)
  message?: string;       // Optional message to include in proof
}

export interface PaymentDisclosureProof {
  txid: string;           // Transaction ID being disclosed
  jsIndex: number;        // JoinSplit index
  outputIndex: number;    // Output index
  recipient: string;      // Receiving z-address (disclosed)
  value: number;          // Amount sent (disclosed)
  memo: string;           // Memo contents (disclosed)
  paymentDisclosure: string; // Cryptographic proof signature
  message?: string;       // Optional message
}

export interface VerifyDisclosureResult {
  valid: boolean;
  recipient?: string;
  value?: number;
  memo?: string;
}

/**
 * Payment Disclosure Manager
 *
 * Generates and verifies payment disclosure proofs for evidence submission.
 * This allows whistleblowers to prove they submitted evidence without revealing their identity.
 */
export class PaymentDisclosureManager {
  constructor(private client: ZcashClient) {}

  /**
   * Generate a payment disclosure proof for an evidence submission
   *
   * This creates a cryptographic proof that:
   * - A specific transaction sent funds to the registry address
   * - The transaction contained specific memo data (evidence metadata)
   * - WITHOUT revealing the sender's z-address
   *
   * The proof can be posted publicly (Twitter, Reddit, Zcash forum) for verification
   */
  async generateProof(params: PaymentDisclosureParams): Promise<PaymentDisclosureProof> {
    const { txid, jsIndex, outputIndex, message } = params;

    // Call z_getpaymentdisclosure RPC
    // Returns signature that proves payment to specific output
    const disclosure = await (this.client as any).call('z_getpaymentdisclosure', [
      txid,
      jsIndex,
      outputIndex,
      message || ''
    ]) as {
      paymentDisclosure: string;
    };

    // Get transaction details to include in proof
    const tx = await this.client.getTransaction(txid);

    // Get memo from shielded outputs
    // Note: Payment disclosure reveals the specific output details
    const memo = await this.getOutputMemo(txid, outputIndex);
    const value = await this.getOutputValue(txid, outputIndex);
    const recipient = await this.getOutputRecipient(txid, outputIndex);

    return {
      txid,
      jsIndex,
      outputIndex,
      recipient,
      value,
      memo,
      paymentDisclosure: disclosure.paymentDisclosure,
      message
    };
  }

  /**
   * Verify a payment disclosure proof
   *
   * Anyone can verify the proof without needing access to private keys.
   * This proves evidence authenticity to journalists, NGOs, and the public.
   */
  async verifyProof(proof: PaymentDisclosureProof): Promise<VerifyDisclosureResult> {
    try {
      // Call z_validatepaymentdisclosure RPC
      const result = await (this.client as any).call('z_validatepaymentdisclosure', [
        proof.paymentDisclosure
      ]) as {
        valid: boolean;
      };

      if (!result.valid) {
        return { valid: false };
      }

      // Extract disclosed information
      return {
        valid: true,
        recipient: proof.recipient,
        value: proof.value,
        memo: proof.memo
      };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Generate a shareable proof package
   *
   * Creates a JSON object that can be posted to public forums
   */
  async generateShareableProof(params: PaymentDisclosureParams): Promise<string> {
    const proof = await this.generateProof(params);

    const shareableProof = {
      version: 1,
      network: 'mainnet', // or 'testnet'
      proof: {
        txid: proof.txid,
        jsIndex: proof.jsIndex,
        outputIndex: proof.outputIndex,
        recipient: proof.recipient,
        value: proof.value,
        memo: proof.memo,
        signature: proof.paymentDisclosure,
        message: proof.message,
        timestamp: Date.now()
      },
      metadata: {
        description: 'ZKFIED Evidence Submission Proof',
        platform: 'ZKFIED',
        boardCategory: this.extractBoardFromMemo(proof.memo)
      }
    };

    return JSON.stringify(shareableProof, null, 2);
  }

  /**
   * Verify a shareable proof from JSON
   */
  async verifyShareableProof(proofJson: string): Promise<VerifyDisclosureResult> {
    try {
      const shareableProof = JSON.parse(proofJson);
      const proof: PaymentDisclosureProof = {
        txid: shareableProof.proof.txid,
        jsIndex: shareableProof.proof.jsIndex,
        outputIndex: shareableProof.proof.outputIndex,
        recipient: shareableProof.proof.recipient,
        value: shareableProof.proof.value,
        memo: shareableProof.proof.memo,
        paymentDisclosure: shareableProof.proof.signature,
        message: shareableProof.proof.message
      };

      return await this.verifyProof(proof);
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Helper: Get memo from transaction output
   */
  private async getOutputMemo(txid: string, outputIndex: number): Promise<string> {
    // In production, parse transaction outputs
    // For now, return placeholder
    // Use z_viewtransaction for detailed output inspection
    const viewResult = await (this.client as any).call('z_viewtransaction', [txid]) as any;

    if (viewResult.outputs && viewResult.outputs[outputIndex]) {
      return viewResult.outputs[outputIndex].memo || '';
    }

    return '';
  }

  /**
   * Helper: Get value from transaction output
   */
  private async getOutputValue(txid: string, outputIndex: number): Promise<number> {
    const viewResult = await (this.client as any).call('z_viewtransaction', [txid]) as any;

    if (viewResult.outputs && viewResult.outputs[outputIndex]) {
      return viewResult.outputs[outputIndex].value || 0;
    }

    return 0;
  }

  /**
   * Helper: Get recipient from transaction output
   */
  private async getOutputRecipient(txid: string, outputIndex: number): Promise<string> {
    const viewResult = await (this.client as any).call('z_viewtransaction', [txid]) as any;

    if (viewResult.outputs && viewResult.outputs[outputIndex]) {
      return viewResult.outputs[outputIndex].address || '';
    }

    return '';
  }

  /**
   * Extract board category from evidence memo
   */
  private extractBoardFromMemo(memoHex: string): string {
    try {
      const buffer = Buffer.from(memoHex, 'hex');
      const boardByte = buffer.readUInt8(2); // Board is at offset 2

      const boardNames: Record<number, string> = {
        0x01: 'GOVERNMENT',
        0x02: 'HEALTHCARE',
        0x03: 'CORPORATE',
        0x04: 'MEDIA',
        0x05: 'ENVIRONMENT',
        0x06: 'LEGAL',
        0x07: 'EDUCATION',
        0x08: 'CIVIL_SOCIETY'
      };

      return boardNames[boardByte] || 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }
}

/**
 * Example Usage:
 *
 * // Whistleblower generates proof after submitting evidence
 * const disclosureManager = new PaymentDisclosureManager(zcashClient);
 *
 * const proof = await disclosureManager.generateProof({
 *   txid: 'abc123...',
 *   jsIndex: 0,
 *   outputIndex: 0,
 *   message: 'Evidence of government corruption - Healthcare board'
 * });
 *
 * // Create shareable JSON
 * const shareableProof = await disclosureManager.generateShareableProof({
 *   txid: 'abc123...',
 *   jsIndex: 0,
 *   outputIndex: 0
 * });
 *
 * // Post to Twitter/Reddit/Forum
 * console.log(shareableProof);
 *
 * // Anyone can verify
 * const verification = await disclosureManager.verifyShareableProof(shareableProof);
 * console.log('Proof valid:', verification.valid);
 * console.log('Evidence memo:', verification.memo);
 */
