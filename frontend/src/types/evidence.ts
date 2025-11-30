// Evidence-related types for ZKFIED

export interface Evidence {
  id: string
  title: string
  description: string
  category: EvidenceCategory
  evidenceType: EvidenceType
  privacyLevel: PrivacyLevel
  submittedAt: string
  status: EvidenceStatus
  chain: 'zcash' | 'near' | 'both'
  zsaTokenId?: string
  ipfsCid?: string
  zcashTxId?: string
  memo?: EncryptedMemo
  viewingKeys?: string[]
  frostSignature?: FrostSignature
  disclosureProof?: PaymentDisclosure
  files?: Array<{
    name: string
    cid: string
    size: number
    type: string
  }>
}

export interface MinaCredentialProof {
  proof: string
  public_input: string[]
  holder_public_key: string
  credential_type: number
  timestamp: number
  zkapp_address: string
}

export interface EvidenceFormData {
  title?: string
  description?: string
  category?: EvidenceCategory
  board_category?: 'healthcare' | 'government' | 'corporate' | 'civil_society' | 'media'
  evidenceType?: EvidenceType
  privacyLevel?: PrivacyLevel
  chain?: 'zcash' | 'near'
  files?: File[]
  viewing_keys?: string[]
  metadata?: EvidenceMetadata
  mina_credential?: MinaCredentialProof
}

export interface EvidenceMetadata {
  jurisdiction?: string
  sourceType?: string
  timestamp: string
  tags: string[]
  classification: SecurityClassification
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

export type EvidenceCategory = 
  | 'government_censorship'
  | 'corporate_suppression'
  | 'media_blackout'
  | 'whistleblower_retaliation'
  | 'surveillance_overreach'
  | 'other'

export type EvidenceType = 
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'communication'
  | 'metadata'

export type PrivacyLevel = 
  | 'fully_private'
  | 'selective_disclosure'
  | 'public_anonymous'

export type EvidenceStatus = 
  | 'draft'
  | 'submitted'
  | 'pending_verification'
  | 'verified'
  | 'published'
  | 'rejected'

export type SecurityClassification = 
  | 'public'
  | 'sensitive'
  | 'confidential'
  | 'secret'

export interface FilterCriteria {
  categories: EvidenceCategory[]
  privacyLevels: PrivacyLevel[]
  chains: ('zcash' | 'near')[]
  dateRange?: {
    start: string
    end: string
  }
  searchQuery?: string
  status?: EvidenceStatus[]
}

export interface EvidenceStats {
  totalSubmissions: number
  verifiedEvidence: number
  activeChains: number
  anonymityGuarantee: string
}

export interface EvidencePreview {
  title: string
  description: string
  category: EvidenceCategory
  privacyLevel: PrivacyLevel
  chain: 'zcash' | 'near'
  estimatedSize: number
  timestamp: string
}