/**
 * Zcash Shielded Assets (ZSA) Implementation
 *
 * ZSA allows creating custom privacy-preserving tokens on Zcash.
 * Each evidence submission is a unique ZSA token (non-fungible, amount=1).
 *
 * Reference: ZIP 226/227 - Zcash Shielded Assets
 */

import { ZcashClient } from './client';

export enum BoardCategory {
  GOVERNMENT = 0x01,
  HEALTHCARE = 0x02,
  CORPORATE = 0x03,
  MEDIA = 0x04,
  ENVIRONMENT = 0x05,
  LEGAL = 0x06,
  EDUCATION = 0x07,
  CIVIL_SOCIETY = 0x08
}

export interface EvidenceMetadata {
  type: number;           // 0x01 = evidence
  board: BoardCategory;   // Board category
  ipfsCID: string;        // 46 bytes - IPFS CID of encrypted evidence
  commitment: string;     // 32 bytes - hash of evidence for integrity
  timestamp: number;      // 4 bytes - Unix timestamp
  viewingKeys: string[];  // Authorized viewing key hints
}

export interface ZSAToken {
  assetId: string;        // Unique asset identifier (hash-based)
  amount: number;         // Always 1 for evidence tokens
  memo: EvidenceMetadata; // Evidence metadata in memo field
}

export interface ZSAMintParams {
  issuerAddress: string;      // z-address of evidence issuer
  recipientAddress: string;   // Registry or board address
  metadata: EvidenceMetadata; // Evidence details
  frostSignature?: string;    // Optional FROST authorization signature
}

export class ZSAManager {
  constructor(private client: ZcashClient) {}

  /**
   * Mint a new Evidence ZSA token
   * Each evidence submission creates a unique non-fungible ZSA
   */
  async mintEvidenceToken(params: ZSAMintParams): Promise<string> {
    const { issuerAddress, recipientAddress, metadata, frostSignature } = params;

    // Generate unique asset ID from evidence commitment
    const assetId = this.generateAssetId(metadata);

    // Encode metadata into 512-byte memo
    const memo = this.encodeEvidenceMemo(metadata, frostSignature);

    // Create ZSA issuance transaction
    // Note: This uses z_sendmany with custom asset parameters (ZSA extension)
    const opid = await this.mintZSA({
      from: issuerAddress,
      to: recipientAddress,
      assetId,
      amount: 1, // Non-divisible evidence token
      memo
    });

    return opid;
  }

  /**
   * Transfer Evidence ZSA to another address
   * Used for time-lock insurance or evidence transfer
   */
  async transferEvidenceToken(
    from: string,
    to: string,
    assetId: string,
    memo?: string
  ): Promise<string> {
    const opid = await this.transferZSA({
      from,
      to,
      assetId,
      amount: 1,
      memo
    });

    return opid;
  }

  /**
   * Generate deterministic asset ID from evidence commitment
   */
  private generateAssetId(metadata: EvidenceMetadata): string {
    // Asset ID = hash(commitment || board || timestamp)
    const buffer = Buffer.concat([
      Buffer.from(metadata.commitment, 'hex'),
      Buffer.from([metadata.board]),
      Buffer.from(metadata.timestamp.toString())
    ]);

    // Use Blake2b-256 (Zcash's hash function)
    const crypto = require('crypto');
    const hash = crypto.createHash('blake2b512').update(buffer).digest();
    return hash.slice(0, 32).toString('hex'); // 32 bytes
  }

  /**
   * Encode evidence metadata into Zcash memo (512 bytes)
   *
   * Format:
   * - Type: 1 byte (0x01 = evidence)
   * - Version: 1 byte (0x01)
   * - Board: 1 byte
   * - Reserved: 1 byte
   * - Timestamp: 4 bytes (Unix)
   * - IPFS CID: 46 bytes (base58)
   * - Commitment: 32 bytes
   * - Viewing Key Hint: 32 bytes
   * - FROST Signature: 64 bytes (if present)
   * - Reserved: remaining bytes
   */
  private encodeEvidenceMemo(
    metadata: EvidenceMetadata,
    frostSignature?: string
  ): string {
    const buffer = Buffer.alloc(512);
    let offset = 0;

    // Header
    buffer.writeUInt8(0x01, offset++); // Type: Evidence
    buffer.writeUInt8(0x01, offset++); // Version
    buffer.writeUInt8(metadata.board, offset++); // Board category
    buffer.writeUInt8(0x00, offset++); // Reserved

    // Timestamp (4 bytes, big-endian)
    buffer.writeUInt32BE(metadata.timestamp, offset);
    offset += 4;

    // IPFS CID (46 bytes)
    const cidBuffer = Buffer.from(metadata.ipfsCID, 'utf8');
    cidBuffer.copy(buffer, offset, 0, Math.min(46, cidBuffer.length));
    offset += 46;

    // Commitment (32 bytes)
    const commitmentBuffer = Buffer.from(metadata.commitment, 'hex');
    commitmentBuffer.copy(buffer, offset, 0, 32);
    offset += 32;

    // Viewing Key Hint (32 bytes)
    // Hash of authorized viewing keys for verification
    const vkHint = this.hashViewingKeys(metadata.viewingKeys);
    Buffer.from(vkHint, 'hex').copy(buffer, offset, 0, 32);
    offset += 32;

    // FROST Signature (64 bytes, if present)
    if (frostSignature) {
      const sigBuffer = Buffer.from(frostSignature, 'hex');
      sigBuffer.copy(buffer, offset, 0, Math.min(64, sigBuffer.length));
      offset += 64;
    } else {
      offset += 64; // Leave empty if no signature
    }

    // Remaining bytes are reserved for future use
    return buffer.toString('hex');
  }

  /**
   * Decode evidence memo back to metadata
   */
  decodeEvidenceMemo(memoHex: string): EvidenceMetadata {
    const buffer = Buffer.from(memoHex, 'hex');
    let offset = 0;

    const type = buffer.readUInt8(offset++);
    if (type !== 0x01) {
      throw new Error('Invalid memo type');
    }

    const version = buffer.readUInt8(offset++);
    const board = buffer.readUInt8(offset++) as BoardCategory;
    offset++; // Skip reserved byte

    const timestamp = buffer.readUInt32BE(offset);
    offset += 4;

    const ipfsCID = buffer.slice(offset, offset + 46).toString('utf8').replace(/\0+$/, '');
    offset += 46;

    const commitment = buffer.slice(offset, offset + 32).toString('hex');
    offset += 32;

    const viewingKeyHint = buffer.slice(offset, offset + 32).toString('hex');
    offset += 32;

    // Note: Viewing keys can't be recovered from hint, this is intentional
    return {
      type,
      board,
      ipfsCID,
      commitment,
      timestamp,
      viewingKeys: [] // Populated separately if needed
    };
  }

  /**
   * Hash viewing keys to create verification hint
   */
  private hashViewingKeys(viewingKeys: string[]): string {
    const crypto = require('crypto');
    const concatenated = viewingKeys.join('');
    return crypto.createHash('blake2b512')
      .update(concatenated)
      .digest()
      .slice(0, 32)
      .toString('hex');
  }

  /**
   * Low-level ZSA mint operation
   * Uses z_sendmany with ZSA parameters (requires ZSA-enabled node)
   */
  private async mintZSA(params: {
    from: string;
    to: string;
    assetId: string;
    amount: number;
    memo: string;
  }): Promise<string> {
    // ZSA issuance uses special z_sendmany format
    // This will be available when ZSA (NU7) is activated on mainnet

    // For now, we simulate with regular shielded transaction
    // Production: Use z_sendmany with asset_type parameter
    const operation = {
      address: params.to,
      amount: 0.0001, // Nominal ZEC amount
      memo: params.memo,
      // asset_type: params.assetId // Uncomment when ZSA is live
    };

    return await (this.client as any).call('z_sendmany', [
      params.from,
      [operation]
    ]);
  }

  /**
   * Low-level ZSA transfer operation
   */
  private async transferZSA(params: {
    from: string;
    to: string;
    assetId: string;
    amount: number;
    memo?: string;
  }): Promise<string> {
    const operation: any = {
      address: params.to,
      amount: params.amount,
      // asset_type: params.assetId // Uncomment when ZSA is live
    };

    if (params.memo) {
      operation.memo = params.memo;
    }

    return await (this.client as any).call('z_sendmany', [
      params.from,
      [operation]
    ]);
  }

  /**
   * Query all evidence tokens received by an address
   */
  async listEvidenceTokens(registryAddress: string): Promise<EvidenceMetadata[]> {
    const received = await this.client.listReceivedByAddress(registryAddress);

    return received
      .filter(tx => tx.memo)
      .map(tx => {
        try {
          return this.decodeEvidenceMemo(tx.memo!);
        } catch {
          return null;
        }
      })
      .filter((meta): meta is EvidenceMetadata => meta !== null);
  }
}
