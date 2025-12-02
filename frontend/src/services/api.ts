export interface EvidenceIndex {
  evidence_id: string
  board_category: 'healthcare' | 'government' | 'corporate' | 'civil_society' | 'media'
  ipfs_cid: string
  zcash_txid?: string
  near_tx_hash?: string
  status: 'pending' | 'signing' | 'broadcasting' | 'confirmed' | 'failed'
  confirmation_count: number
  submission_timestamp: number
  created_at: string
}

export interface EvidenceMetadata {
  evidence_id: string
  board_category: string
  title: string
  description: string
  files: Array<{
    filename: string
    cid: string
    size: number
    type: string
  }>
  timestamp: number
  zcash_txid?: string
  commitment_hash: string
}

export interface FrostSession {
  session_id: string
  evidence_id: string
  threshold: number
  min_signers: number
  max_signers: number
  current_round: 1 | 2
  status: 'initializing' | 'round1' | 'round2' | 'completed' | 'failed'
  participants: Array<{
    participant_id: number
    public_key: string
    status: 'joined' | 'round1_complete' | 'round2_complete' | 'failed'
  }>
  created_at: string
  completed_at?: string
}

export interface AttestationGrant {
  domainHash: string
  boardsMask: number
  expiryDays: number
  sigR8x: string
  sigR8y: string
  sigS: string
  boardsGranted?: number[]
}

export interface EmailAttestationRequest {
  email: string
  board_category: string
}

export interface EmailVerificationRequest {
  email: string
  verification_code: string
}

export interface MinaCredentialProof {
  proof: string
  public_input: string[]
  holder_public_key: string
  credential_type: number
  timestamp: number
  zkapp_address: string
}

export interface SubmitEvidenceRequest {
  title: string
  description: string
  board_category: 'healthcare' | 'government' | 'corporate' | 'civil_society' | 'media'
  files: File[]
  attestation?: AttestationGrant
  viewing_keys?: string[]
  mina_credential?: MinaCredentialProof
}

export interface SubmitEvidenceResponse {
  evidence_id: string
  zcash_txid: string | null
  ipfs_cid: string
  frost_session_id: string
  status: 'pending' | 'signing' | 'broadcasting' | 'confirmed' | 'failed'
  payment_disclosure: string | null
}

export interface HybridEvidenceRequest {
  session_id: string
  evidence_type: string
  evidence_data: string
  description: string
  zashi_tx_id?: string
  mina_credential?: MinaCredentialProof
}

export interface OtpRequestResponse {
  success: boolean
  session_id: string
  message: string
}

export interface OtpVerifyResponse {
  session_id: string
  is_verified: boolean
  email: string
  mina_credential_hash: string | null
  board_type: number | null
}

export interface UserSession {
  session_id: string
  is_verified: boolean
  email: string
  mina_credential_hash: string | null
  board_type: number | null
}

export interface MyEvidenceResponse {
  success: boolean
  evidence_ids: string[]
}

export interface HybridEvidenceResponse {
  success: boolean
  evidence_id: string
  proof_generated: boolean
  message: string
  next_steps: string[]
}

export interface WalletAddress {
  unified_address: string
  transparent_address: string | null
  network: string
}

class ZKFIEDApi {
  private baseURL: string

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`API Error (${response.status}): ${error}`)
      }

      return response.json()
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  async submitEvidence(request: SubmitEvidenceRequest): Promise<SubmitEvidenceResponse> {
    const filesData = await Promise.all(
      request.files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer()
        const bytes = Array.from(new Uint8Array(arrayBuffer))
        return {
          filename: file.name,
          mime_type: file.type,
          data: bytes
        }
      })
    )

    const payload = {
      title: request.title,
      description: request.description,
      board_category: request.board_category,
      files: filesData,
      viewing_keys: request.viewing_keys || [],
      attestation: request.attestation || null,
      mina_credential: request.mina_credential || null,
    }

    return this.request<SubmitEvidenceResponse>('/evidence/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getEvidenceIndex(evidenceId: string): Promise<EvidenceIndex> {
    return this.request<EvidenceIndex>(`/evidence/${evidenceId}`)
  }

  async getEvidenceByBoard(category: string): Promise<EvidenceIndex[]> {
    return this.request<EvidenceIndex[]>(`/evidence/board/${category}`)
  }

  async getAllEvidenceIndex(): Promise<EvidenceIndex[]> {
    const categories = ['healthcare', 'government', 'corporate', 'civil_society', 'media']
    const results = await Promise.all(
      categories.map(cat => this.getEvidenceByBoard(cat).catch(() => []))
    )
    return results.flat()
  }

  async getEvidenceMetadata(ipfsCid: string): Promise<EvidenceMetadata> {
    const ipfsGateway = import.meta.env.VITE_IPFS_GATEWAY || 'https://ipfs.io/ipfs'
    const url = `${ipfsGateway}/${ipfsCid}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch IPFS content: ${response.statusText}`)
    }

    return response.json()
  }

  async getFrostSession(sessionId: string): Promise<FrostSession> {
    return this.request<FrostSession>(`/frost/session/${sessionId}`)
  }

  async healthCheck(): Promise<{ status: string }> {
    const response = await fetch(`${this.baseURL}/health`)
    const text = await response.text()
    return { status: text }
  }

  async getStats(): Promise<{ status: string; message: string }> {
    return this.request<{ status: string; message: string }>('/stats')
  }

  async requestEmailAttestation(request: EmailAttestationRequest): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/attestation/email/request', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async verifyEmailAttestation(request: EmailVerificationRequest): Promise<AttestationGrant> {
    return this.request<AttestationGrant>('/attestation/email/verify', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async getWalletAddress(): Promise<WalletAddress> {
    return this.request<WalletAddress>('/api/wallet/address')
  }

  async submitHybridEvidence(request: HybridEvidenceRequest): Promise<HybridEvidenceResponse> {
    return this.request<HybridEvidenceResponse>('/api/evidence/submit', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async getMetrics(): Promise<string> {
    const response = await fetch(`${this.baseURL}/metrics`)
    return response.text()
  }

  async getIpfsEvidence(cid: string): Promise<EvidenceMetadata> {
    return this.request<EvidenceMetadata>(`/ipfs/evidence/${cid}`)
  }

  async getIpfsFile(cid: string): Promise<Blob> {
    const url = `${this.baseURL}/ipfs/file/${cid}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch IPFS file: ${response.statusText}`)
    }

    return response.blob()
  }

  async getZcashTransaction(txid: string): Promise<{
    txid: string
    confirmations: number
    height: number | null
    hex: string
    raw_data: any
  }> {
    return this.request(`/zcash/transaction/${txid}`)
  }

  async getWalletInfo(address: string): Promise<{
    address: string
    current_height: number
    network: string
  }> {
    return this.request(`/wallet/info/${address}`)
  }

  async verifyMinaCredential(proof: MinaCredentialProof): Promise<{
    credential_hash: string
    board_type: number
    is_valid: boolean
    verified_at: number
  }> {
    return this.request('/mina/verify-credential', {
      method: 'POST',
      body: JSON.stringify(proof),
    })
  }

  async getMinaCredential(credentialHash: string): Promise<{
    credential_hash: string
    board_type: number
    is_valid: boolean
    verified_at: number
  }> {
    return this.request(`/mina/credential/${credentialHash}`)
  }

  async linkTransaction(evidenceId: string, zcashTxid: string): Promise<SubmitEvidenceResponse & { near_tx_hash?: string }> {
    return this.request(`/evidence/${evidenceId}/link-tx`, {
      method: 'POST',
      body: JSON.stringify({ zcash_txid: zcashTxid }),
    })
  }

  async requestOtp(email: string, minaCredentialHash?: string): Promise<OtpRequestResponse> {
    return this.request('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({
        email,
        mina_credential_hash: minaCredentialHash
      }),
    })
  }

  async verifyOtp(sessionId: string, otpCode: string): Promise<OtpVerifyResponse> {
    return this.request('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        otp_code: otpCode
      }),
    })
  }

  async getSession(sessionId: string): Promise<UserSession> {
    return this.request('/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    })
  }

  async getMyEvidence(sessionId: string): Promise<MyEvidenceResponse> {
    return this.request('/api/evidence/my-evidence', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    })
  }
}

export const api = new ZKFIEDApi()
export default api
