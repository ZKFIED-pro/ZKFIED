// Smart contract interaction types for ZKFIED
import { TransactionResult, EncryptedMemo, FrostSignature, PaymentDisclosure } from './index'

export interface ZcashContract {
  createZsaToken: (params: ZsaTokenParams) => Promise<TransactionResult>
  submitEvidence: (params: EvidenceSubmissionParams) => Promise<TransactionResult>
  generateDisclosureProof: (params: DisclosureParams) => Promise<PaymentDisclosure>
  verifyFrostSignature: (signature: FrostSignature) => Promise<boolean>
}

export interface NearContract {
  storeEvidenceHash: (params: EvidenceHashParams) => Promise<TransactionResult>
  verifyZcashEvidence: (params: VerificationParams) => Promise<boolean>
  queryEvidence: (evidenceId: string) => Promise<CrossChainEvidence>
  getBridgeStatus: (txHash: string) => Promise<BridgeStatus>
}

export interface ZsaTokenParams {
  assetDescription: string
  issuerKey: string
  metadata: {
    title: string
    category: string
    timestamp: string
  }
  memo: string
  finalize: boolean
}

export interface EvidenceSubmissionParams {
  zsaToken: ZsaTokenParams
  recipientAddress: string
  amount: string
  memo: EncryptedMemo
  viewingKeys: string[]
}

export interface DisclosureParams {
  transactionId: string
  outputIndex: number
  outgoingViewingKey: string
  ephemeralSecretKey: string
}

export interface EvidenceHashParams {
  evidenceId: string
  zcashTxHash: string
  ipfsCid: string
  category: string
  timestamp: string
  submitter?: string
  commitmentHash?: string
  frostSignatures?: Array<{
    participant_id: string
    signature: string
  }>
}

export interface VerificationParams {
  evidenceId: string
  zcashTxHash?: string
  expectedCategory?: string
  expectedTimestamp?: string
  commitmentHash: string
  submitVerification?: boolean
  verifierNotes?: string
}

export interface CrossChainEvidence {
  evidenceId: string
  zcashTxHash: string
  nearTxHash: string
  ipfsCid: string
  category: string
  timestamp: string
  verified: boolean
  verificationBlock: number
  commitmentHash?: string
  frostSignatures?: Array<{
    participant_id: string
    signature: string
  }>
}

export interface BridgeStatus {
  sourceChain: 'zcash' | 'near'
  targetChain: 'zcash' | 'near'
  sourceTxHash: string
  targetTxHash?: string
  status: BridgeTransactionStatus
  timestamp: string
  error?: string
}

export type BridgeTransactionStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'timeout'

export interface ContractCallParams {
  method: string
  args: Record<string, any>
  attachedDeposit?: string
  gas?: string
}

export interface FrostCoordinatorApi {
  createSession: (params: FrostSessionParams) => Promise<FrostSession>
  joinSession: (sessionId: string, publicKey: string) => Promise<boolean>
  submitCommitment: (sessionId: string, commitment: FrostCommitment) => Promise<boolean>
  submitSignatureShare: (sessionId: string, share: SignatureShare) => Promise<boolean>
  getAggregatedSignature: (sessionId: string) => Promise<FrostSignature>
}

export interface FrostSessionParams {
  message: string
  threshold: number
  participants: string[]
  timeout?: number
}

export interface FrostSession {
  id: string
  message: string
  threshold: number
  participants: string[]
  status: 'created' | 'round1' | 'round2' | 'completed' | 'failed'
  createdAt: string
  expiresAt: string
}

export interface FrostCommitment {
  participantId: string
  hidingCommitment: string
  bindingCommitment: string
}

export interface SignatureShare {
  participantId: string
  signatureShare: string
}