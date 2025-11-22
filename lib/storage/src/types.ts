export interface IPFSConfig {
  gateway: string;
  pinningService?: {
    url: string;
    apiKey: string;
  };
}

export interface StoredEvidence {
  cid: string;
  encrypted: boolean;
  size: number;
  timestamp: number;
  viewingKeysRequired: string[];
}

export interface PinStatus {
  cid: string;
  status: 'pinned' | 'pinning' | 'failed';
  created: string;
}

export interface IPFSUploadResult {
  cid: string;
  size: number;
  url: string;
}

export interface EncryptedIPFSData {
  cid: string;
  encryptedData: string;
  nonce: string;
  viewingKeyHints: string[];
}
