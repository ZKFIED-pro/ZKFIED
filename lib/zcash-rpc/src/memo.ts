export enum BoardCategory {
  GOVERNMENT = 0x01,
  HEALTHCARE = 0x02,
  CORPORATE = 0x03,
  MEDIA = 0x04,
  ENVIRONMENT = 0x05,
  LEGAL = 0x06,
  EDUCATION = 0x07,
  CIVIL_SOCIETY = 0x08,
}

export interface EvidenceMetadata {
  board: BoardCategory;
  ipfsCID: string;
  commitment: string;
  timestamp: number;
  viewingKeysHint: string;
  frostSignature?: string;
}

export class MemoEncoder {
  static readonly MAX_SIZE = 512;
  static readonly EVIDENCE_TYPE = 0x01;
  static readonly VERSION = 0x01;

  static encodeEvidence(metadata: EvidenceMetadata): string {
    const buffer = Buffer.alloc(this.MAX_SIZE);
    let offset = 0;

    buffer.writeUInt8(this.EVIDENCE_TYPE, offset++);
    buffer.writeUInt8(this.VERSION, offset++);
    buffer.writeUInt8(metadata.board, offset++);
    buffer.writeUInt8(0x00, offset++);

    buffer.writeUInt32BE(metadata.timestamp, offset);
    offset += 4;

    const cidBytes = Buffer.from(metadata.ipfsCID, 'utf8');
    const cidLen = Math.min(46, cidBytes.length);
    cidBytes.copy(buffer, offset, 0, cidLen);
    offset += 46;

    const commitmentBytes = Buffer.from(metadata.commitment, 'hex');
    commitmentBytes.copy(buffer, offset, 0, Math.min(32, commitmentBytes.length));
    offset += 32;

    const vkHintBytes = Buffer.from(metadata.viewingKeysHint, 'hex');
    vkHintBytes.copy(buffer, offset, 0, Math.min(32, vkHintBytes.length));
    offset += 32;

    if (metadata.frostSignature) {
      const sigBytes = Buffer.from(metadata.frostSignature, 'hex');
      sigBytes.copy(buffer, offset, 0, Math.min(64, sigBytes.length));
    }

    return buffer.toString('hex');
  }

  static decodeEvidence(memoHex: string): EvidenceMetadata {
    const buffer = Buffer.from(memoHex, 'hex');

    if (buffer.length < this.MAX_SIZE) {
      throw new Error('Invalid memo size');
    }

    let offset = 0;
    const type = buffer.readUInt8(offset++);

    if (type !== this.EVIDENCE_TYPE) {
      throw new Error(`Invalid memo type: ${type}`);
    }

    const version = buffer.readUInt8(offset++);
    const board = buffer.readUInt8(offset++) as BoardCategory;
    offset++;

    const timestamp = buffer.readUInt32BE(offset);
    offset += 4;

    const ipfsCID = buffer.slice(offset, offset + 46).toString('utf8').replace(/\0+$/, '');
    offset += 46;

    const commitment = buffer.slice(offset, offset + 32).toString('hex');
    offset += 32;

    const viewingKeysHint = buffer.slice(offset, offset + 32).toString('hex');
    offset += 32;

    const frostSignature = buffer.slice(offset, offset + 64).toString('hex');

    return {
      board,
      ipfsCID,
      commitment,
      timestamp,
      viewingKeysHint,
      frostSignature: frostSignature.replace(/^0+$/, '') || undefined,
    };
  }

  static encodeHeartbeat(policyId: string, expiryHeight: number): string {
    const data = {
      type: 'heartbeat',
      policyId,
      expiryHeight,
      timestamp: Date.now(),
    };
    return JSON.stringify(data);
  }

  static encodeFROSTRequest(credentialHash: string, board: BoardCategory): string {
    const data = {
      type: 'frost_request',
      credentialHash,
      board,
      timestamp: Date.now(),
    };
    return JSON.stringify(data);
  }

  static encodeFROSTAuthorization(requestId: string, signature: string, approved: boolean): string {
    const data = {
      type: 'frost_authorization',
      requestId,
      signature,
      approved,
      timestamp: Date.now(),
    };
    return JSON.stringify(data);
  }
}
