// Wallet and blockchain-related types for ZKFIED

export interface WalletState {
  isConnected: boolean
  address: string | null
  selectedChain: Chain
  balance: WalletBalance
  status: WalletStatus
}

export interface WalletBalance {
  zcash: {
    transparent: string
    shielded: string
    zsaTokens: ZsaToken[]
  }
  near: {
    native: string
    contracts: ContractBalance[]
  }
}

export interface ZsaToken {
  assetId: string
  name: string
  description: string
  balance: string
  isEvidence: boolean
  evidenceId?: string
}

export interface ContractBalance {
  contractId: string
  tokenId?: string
  balance: string
  symbol: string
}

export type WalletStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export type WalletType = 
  | 'ywallet'
  | 'near-wallet'
  | 'here-wallet'
  | 'metamask'
  | 'webzjs'

export interface WalletConnection {
  type: WalletType
  address: string
  publicKey?: string
  accountId?: string
}

export interface TransactionRequest {
  type: 'evidence_submission' | 'cross_chain_bridge' | 'disclosure_proof'
  chain: 'zcash' | 'near'
  data: Record<string, any>
  gasLimit?: string
  gasPrice?: string
}

export interface TransactionResult {
  hash: string
  status: 'pending' | 'confirmed' | 'failed'
  blockHeight?: number
  gasUsed?: string
  error?: string
}

export type Chain = 'zcash' | 'near' | 'both'

export interface ChainInfo {
  id: string
  name: string
  nativeCurrency: {
    symbol: string
    decimals: number
  }
  rpcUrl: string
  explorerUrl: string
  testnet?: boolean
}

// MetaMask/Ethereum provider types
interface RequestArguments {
  method: string
  params?: unknown[] | object
}

export interface EthereumProvider {
  request(args: RequestArguments): Promise<any>
  isMetaMask?: boolean
  selectedAddress?: string | null
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}