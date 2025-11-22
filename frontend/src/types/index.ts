// Main type exports for ZKFIED frontend

export * from './evidence'
export * from './wallet'
export * from './contracts'
export * from './ui'

// Common utility types
export type Status = 'idle' | 'loading' | 'success' | 'error'

export type Chain = 'zcash' | 'near' | 'both'

export interface ApiResponse<T> {
  data: T
  message?: string
  status: number
}

export interface PaginatedResponse<T> {
  data: T[]
  page: number
  limit: number
  total: number
  hasNext: boolean
  hasPrev: boolean
}

// Base entity interface
export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

// Error types
export interface AppError {
  code: string
  message: string
  details?: Record<string, any>
}

export type NetworkError = {
  type: 'network'
  message: string
}

export type ValidationError = {
  type: 'validation'
  field: string
  message: string
}

export type ContractError = {
  type: 'contract'
  contractType: 'zcash' | 'near'
  message: string
  txHash?: string
}

// Re-export types that are used across modules
export interface TransactionResult {
  hash: string
  status: 'pending' | 'confirmed' | 'failed'
  blockHeight?: number
  gasUsed?: string
  error?: string
}

export interface EncryptedMemo {
  ciphertext: string
  nonce: string
  authTag: string
  keyHint: string
}

export interface FrostSignature {
  signature: string
  publicKey: string
  threshold: number
  participants: string[]
}

export interface PaymentDisclosure {
  txId: string
  outputIndex: number
  ephemeralKey: string
  outgoingViewingKey: string
  proof: string
}