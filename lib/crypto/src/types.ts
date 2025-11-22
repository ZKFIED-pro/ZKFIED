export interface EncryptedData {
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey?: string;
}

export interface ViewingKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface EncryptionMetadata {
  algorithm: 'xchacha20-poly1305';
  version: number;
  timestamp: number;
}

export interface EncryptedEvidence {
  data: EncryptedData;
  metadata: EncryptionMetadata;
  viewingKeyRequired: boolean;
  authorizedKeys?: string[];
}

export interface DerivedKey {
  key: Uint8Array;
  salt: Uint8Array;
}
