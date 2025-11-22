import { ShieldedMemo, DecryptedMemo } from './types';

export class MemoEncoder {
  private static readonly MAX_MEMO_SIZE = 512;

  static encode(data: string | Record<string, unknown>): ShieldedMemo {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);

    if (jsonStr.length > this.MAX_MEMO_SIZE) {
      throw new Error(`Memo exceeds maximum size of ${this.MAX_MEMO_SIZE} bytes`);
    }

    const hex = Buffer.from(jsonStr, 'utf8').toString('hex');
    const paddedHex = hex.padEnd(this.MAX_MEMO_SIZE * 2, '0');

    return {
      data: jsonStr,
      hex: paddedHex
    };
  }

  static decode(hex: string): DecryptedMemo {
    const buffer = Buffer.from(hex, 'hex');
    const raw = buffer.toString('utf8').replace(/\0+$/, '');

    let parsed: Record<string, unknown> | undefined;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = undefined;
    }

    return {
      raw,
      parsed,
      timestamp: parsed?.timestamp as number | undefined
    };
  }

  static createAuthenticationMemo(params: {
    domainHash: string;
    boardsMask: number;
    expiryDays: number;
    nonce: string;
  }): ShieldedMemo {
    return this.encode({
      type: 'auth',
      ...params,
      timestamp: Date.now()
    });
  }

  static createEvidenceMemo(params: {
    reportId: string;
    evidenceHash: string;
    encryptionKey?: string;
  }): ShieldedMemo {
    return this.encode({
      type: 'evidence',
      ...params,
      timestamp: Date.now()
    });
  }
}
