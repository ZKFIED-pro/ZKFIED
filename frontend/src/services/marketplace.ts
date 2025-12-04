const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export interface AccessRequest {
  request_id: string
  evidence_id: string
  requester_id: string
  bid_amount: string
  payment_token: string
  purpose: string
  zk_credentials?: string
  status: 'Pending' | 'Accepted' | 'Fulfilled' | 'Rejected'
  deadline: number
  created_at: number
}

export interface VerificationRequest {
  request_id: string
  evidence_id: string
  requester_id: string
  verification_type: string
  reward_amount: string
  reward_token: string
  requirements_hash: string
  status: 'Pending' | 'Accepted' | 'Fulfilled' | 'Rejected'
  selected_solver?: string
  deadline: number
  created_at: number
}

export interface SolverBid {
  bid_id: string
  request_id: string
  solver_id: string
  bid_amount: string
  estimated_completion: number
  credentials: string
  proof_of_capability: string
  created_at: number
}

export const marketplaceApi = {
  async createAccessRequest(data: {
    evidence_id: string
    bid_amount: string
    payment_token: string
    purpose: string
    zk_credentials?: string
    deadline: number
  }) {
    const response = await fetch(`${API_BASE_URL}/api/marketplace/access-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to create access request')
    return response.json()
  },

  async createVerificationRequest(data: {
    evidence_id: string
    verification_type: string
    reward_amount: string
    requirements: string[]
    deadline: string
  }) {
    const response = await fetch(`${API_BASE_URL}/api/marketplace/verification-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to create verification request')
    return response.json()
  },

  async submitBid(data: {
    request_id: string
    solver_id: string
    bid_amount: string
    estimated_completion: string
    credentials: string
    proof_of_capability: string
  }) {
    const response = await fetch(`${API_BASE_URL}/api/marketplace/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to submit bid')
    return response.json()
  },

  async acceptBid(data: {
    request_id: string
    bid_id: string
  }) {
    const response = await fetch(`${API_BASE_URL}/api/marketplace/accept-bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to accept bid')
    return response.json()
  },

  async getActiveRequests(evidenceId: string): Promise<{
    access_requests: AccessRequest[]
    verification_requests: VerificationRequest[]
  }> {
    const response = await fetch(`${API_BASE_URL}/api/marketplace/requests/${evidenceId}`)
    if (!response.ok) throw new Error('Failed to fetch active requests')
    return response.json()
  },

  async getVerificationRequests(): Promise<VerificationRequest[]> {
    const response = await fetch(`${API_BASE_URL}/api/marketplace/verification-requests`)
    if (!response.ok) throw new Error('Failed to fetch verification requests')
    return response.json()
  },

  async getBids(requestId: string): Promise<SolverBid[]> {
    const response = await fetch(`${API_BASE_URL}/api/marketplace/bids/${requestId}`)
    if (!response.ok) throw new Error('Failed to fetch bids')
    return response.json()
  },

  async wrapKey(data: {
    evidence_id: string
    viewing_key: string
    recipient_public_key: string
  }) {
    const response = await fetch(`${API_BASE_URL}/api/marketplace/wrap-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to wrap key')
    return response.json()
  },

  // NEAR-specific endpoints
  async getNearRequest(requestId: string): Promise<{
    success: boolean
    request?: any
    escrow_balance?: string
  }> {
    const response = await fetch(`${API_BASE_URL}/api/marketplace/near/request/${requestId}`)
    if (!response.ok) throw new Error('Failed to fetch NEAR request')
    return response.json()
  },

  async getNearBids(requestId: string): Promise<{
    success: boolean
    bids: any[]
  }> {
    const response = await fetch(`${API_BASE_URL}/api/marketplace/near/bids/${requestId}`)
    if (!response.ok) throw new Error('Failed to fetch NEAR bids')
    return response.json()
  },

  async getMyEvidence(sessionId: string): Promise<{
    success: boolean
    evidence_ids: string[]
  }> {
    const response = await fetch(`${API_BASE_URL}/api/evidence/my-evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId })
    })
    if (!response.ok) throw new Error('Failed to fetch my evidence')
    return response.json()
  }
}
