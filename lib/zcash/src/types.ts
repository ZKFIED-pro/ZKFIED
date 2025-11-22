export interface ZcashAddress {
  address: string;
  type: 'transparent' | 'shielded';
}

export interface ShieldedMemo {
  data: string;
  hex: string;
}

export interface ZcashTransaction {
  txid: string;
  confirmations: number;
  blockHeight?: number;
  timestamp?: number;
}

export interface ShieldedTransactionParams {
  from: string;
  to: string;
  amount: number;
  memo?: string;
}

export interface ViewingKey {
  address: string;
  key: string;
  type: 'incoming' | 'full';
}

export interface DecryptedMemo {
  raw: string;
  parsed?: Record<string, unknown>;
  timestamp?: number;
}

export interface LightwalletdConfig {
  url: string;
  port?: number;
  tls?: boolean;
}

export interface ZcashRPCConfig {
  url: string;
  username?: string;
  password?: string;
}
