import React, { useEffect, useState } from 'react'
import { marketplaceApi, type VerificationRequest, type AccessRequest, type SolverBid } from '@/services/marketplace'

const MarketplacePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'requests' | 'create'>('requests')
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([])
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null)
  const [bids, setBids] = useState<SolverBid[]>([])
  const [loading, setLoading] = useState(true)
  const [nearData, setNearData] = useState<{ request?: any; escrow_balance?: string } | null>(null)
  const [nearLoading, setNearLoading] = useState(false)
  const [nearError, setNearError] = useState<string | null>(null)
  const [rpcStatus, setRpcStatus] = useState<'connected' | 'fallback' | 'error'>('connected')
  const [myEvidence, setMyEvidence] = useState<string[]>([])
  const [showBidForm, setShowBidForm] = useState(false)

  const [formData, setFormData] = useState({
    evidence_id: '',
    verification_type: '',
    reward_amount: '',
    requirements: '',
    deadline: '',
    deadlineDate: ''
  })

  const [bidFormData, setBidFormData] = useState({
    solver_id: '',
    bid_amount: '',
    estimated_completion: '',
    credentials: '',
    proof_of_capability: ''
  })

  useEffect(() => {
    loadVerificationRequests()
    loadMyEvidence()
  }, [])

  const loadMyEvidence = async () => {
    try {
      const sessionId = localStorage.getItem('session_id') || 'skip_otp'
      const response = await marketplaceApi.getMyEvidence(sessionId)
      if (response.success) {
        setMyEvidence(response.evidence_ids)
      }
    } catch (error) {
      console.error('Failed to load my evidence:', error)
    }
  }

  const loadVerificationRequests = async () => {
    try {
      const response = await marketplaceApi.getVerificationRequests()
      setVerificationRequests(Array.isArray(response) ? response : (response.requests || []))
    } catch (error) {
      console.error('Failed to load verification requests:', error)
      setVerificationRequests([])
    } finally {
      setLoading(false)
    }
  }

  const loadBids = async (requestId: string) => {
    try {
      const response = await marketplaceApi.getBids(requestId)
      setBids(Array.isArray(response) ? response : (response.bids || []))
    } catch (error) {
      console.error('Failed to load bids:', error)
      setBids([])
    }
  }

  const loadNearData = async (requestId: string) => {
    setNearLoading(true)
    setNearError(null)
    try {
      const data = await marketplaceApi.getNearRequest(requestId)
      setNearData(data)
      setRpcStatus('connected')
    } catch (error: any) {
      console.error('Failed to load NEAR data:', error)
      setNearData(null)
      setNearError(error?.message || 'Failed to connect to NEAR network')
      setRpcStatus('error')
    } finally {
      setNearLoading(false)
    }
  }

  useEffect(() => {
    if (selectedRequest) {
      loadNearData(selectedRequest.request_id)
    } else {
      setNearData(null)
    }
  }, [selectedRequest])

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.deadline) {
      alert('Please select a deadline date')
      return
    }

    try {
      const nearAmount = parseFloat(formData.reward_amount)
      const yoctoNearAmount = Math.floor(nearAmount * 1e24).toString()

      const requestData = {
        evidence_id: formData.evidence_id.trim(),
        verification_type: formData.verification_type,
        reward_amount: yoctoNearAmount,
        requirements: formData.requirements.split('\n').filter(r => r.trim()),
        deadline: formData.deadline
      }
      console.log('Sending request:', requestData)
      await marketplaceApi.createVerificationRequest(requestData)
      alert('Verification request created successfully')
      loadVerificationRequests()
      setActiveTab('requests')
      setFormData({
        evidence_id: '',
        verification_type: '',
        reward_amount: '',
        requirements: '',
        deadline: '',
        deadlineDate: ''
      })
    } catch (error: any) {
      console.error('Failed to create verification request:', error)
      let errorMsg = error?.message || 'Failed to create verification request'
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        errorMsg = 'Network error: Please check your connection. The system will automatically retry with backup providers.'
      }
      alert(errorMsg)
    }
  }

  const handleViewRequest = (request: VerificationRequest) => {
    setSelectedRequest(request)
    loadBids(request.request_id)
    setShowBidForm(false)
  }

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRequest) return

    try {
      const nearAmount = parseFloat(bidFormData.bid_amount)
      const yoctoNearAmount = Math.floor(nearAmount * 1e24).toString()

      const completionDate = new Date()
      completionDate.setHours(completionDate.getHours() + parseInt(bidFormData.estimated_completion))
      const isoCompletionDate = completionDate.toISOString()

      await marketplaceApi.submitBid({
        request_id: selectedRequest.request_id,
        solver_id: bidFormData.solver_id,
        bid_amount: yoctoNearAmount,
        estimated_completion: isoCompletionDate,
        credentials: bidFormData.credentials || '00',
        proof_of_capability: bidFormData.proof_of_capability || '00'
      })
      alert('Bid submitted successfully')
      loadBids(selectedRequest.request_id)
      setShowBidForm(false)
      setBidFormData({
        solver_id: '',
        bid_amount: '',
        estimated_completion: '',
        credentials: '',
        proof_of_capability: ''
      })
    } catch (error: any) {
      console.error('Failed to submit bid:', error)
      let errorMsg = error?.message || 'Failed to submit bid'
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        errorMsg = 'Network error: Connection failed. The system is automatically retrying with backup NEAR RPC providers.'
      }
      alert(errorMsg)
    }
  }

  const handleAcceptBid = async (bidId: string) => {
    if (!selectedRequest) return
    if (!confirm('Accept this bid? This will lock the escrow.')) return

    try {
      await marketplaceApi.acceptBid({
        request_id: selectedRequest.request_id,
        bid_id: bidId
      })
      alert('Bid accepted successfully')
      loadBids(selectedRequest.request_id)
      loadNearData(selectedRequest.request_id)
    } catch (error: any) {
      console.error('Failed to accept bid:', error)
      let errorMsg = error?.message || 'Failed to accept bid'
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        errorMsg = 'Network error: Connection failed. The system is automatically retrying with backup NEAR RPC providers.'
      }
      alert(errorMsg)
    }
  }

  return (
    <div className="fade-in">
      <section className="section bg-black" style={{
        paddingTop: '120px',
        paddingBottom: '60px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url(/images/1.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'grayscale(100%) contrast(1.3)',
          zIndex: 0
        }} />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 1
        }} />
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div className="text-center" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '24px' }}>
              Evidence Marketplace
            </h1>
            <p className="text-gray" style={{ fontSize: '12px', marginBottom: '24px', maxWidth: '700px', margin: '0 auto 24px' }}>
              Request evidence verification, access encrypted evidence, or compete as a solver.
              Powered by NEAR Intents for trustless matching and escrow.
            </p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'rgba(0, 255, 0, 0.1)',
              border: '1px solid rgba(0, 255, 0, 0.3)',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#00ff00'
            }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: rpcStatus === 'connected' ? '#00ff00' : rpcStatus === 'fallback' ? '#ffaa00' : '#ff0000',
                animation: rpcStatus === 'connected' ? 'pulse 2s infinite' : 'none'
              }} />
              <span>
                {rpcStatus === 'connected' ? 'NEAR RPC Connected' :
                 rpcStatus === 'fallback' ? 'NEAR RPC Using Fallback' :
                 'NEAR RPC Connection Issue'}
              </span>
              <span style={{ color: '#666', fontSize: '10px' }}>• 6 providers available</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-void">
        <div className="container">
          <div style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #333' }}>
              <button
                onClick={() => setActiveTab('requests')}
                style={{
                  padding: '12px 24px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'requests' ? '2px solid #00ff00' : '2px solid transparent',
                  color: activeTab === 'requests' ? '#00ff00' : '#888',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  transition: 'all 0.3s'
                }}
              >
                [BROWSE_REQUESTS]
              </button>
              <button
                onClick={() => setActiveTab('create')}
                style={{
                  padding: '12px 24px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'create' ? '2px solid #00ff00' : '2px solid transparent',
                  color: activeTab === 'create' ? '#00ff00' : '#888',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  transition: 'all 0.3s'
                }}
              >
                [CREATE_REQUEST]
              </button>
            </div>
          </div>

          {activeTab === 'requests' && !selectedRequest && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '24px'
              }}>
                {loading ? (
                  <div style={{ color: '#888', fontFamily: 'monospace' }}>Loading requests...</div>
                ) : verificationRequests.length === 0 ? (
                  <div style={{ color: '#888', fontFamily: 'monospace' }}>No verification requests found</div>
                ) : (
                  verificationRequests.map((request) => (
                    <div
                      key={request.request_id}
                      style={{
                        background: '#0a0a0a',
                        border: '1px solid #333',
                        padding: '24px',
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#00ff00'
                        e.currentTarget.style.transform = 'translateY(-4px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#333'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                      onClick={() => handleViewRequest(request)}
                    >
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{
                          color: '#00ff00',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          marginBottom: '8px'
                        }}>
                          [ACTIVE]
                        </div>
                        <div style={{
                          color: '#fff',
                          fontFamily: 'monospace',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          marginBottom: '8px'
                        }}>
                          {request.verification_type}
                        </div>
                        <div style={{
                          color: '#888',
                          fontFamily: 'monospace',
                          fontSize: '11px'
                        }}>
                          Evidence: {request.evidence_id.substring(0, 16)}...
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '16px',
                        borderTop: '1px solid #222'
                      }}>
                        <div style={{ color: '#00ff00', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>
                          {(Number(request.reward_amount) / 1e24).toFixed(2)} NEAR
                        </div>
                        <div style={{ color: '#888', fontFamily: 'monospace', fontSize: '11px' }}>
                          Deadline: {new Date(request.deadline * 1000).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'requests' && selectedRequest && (
            <div>
              <button
                onClick={() => setSelectedRequest(null)}
                style={{
                  marginBottom: '24px',
                  padding: '8px 16px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  color: '#00ff00',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                ← [BACK_TO_REQUESTS]
              </button>

              <div style={{
                background: '#0a0a0a',
                border: '1px solid #333',
                padding: '32px',
                marginBottom: '32px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ color: '#fff', fontFamily: 'monospace', fontSize: '18px' }}>
                    Request Details
                  </h2>
                  {nearLoading && (
                    <div style={{
                      color: '#00ff00',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        border: '2px solid #00ff00',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      Loading NEAR data...
                    </div>
                  )}
                  {nearError && !nearLoading && (
                    <div style={{
                      color: '#ff4444',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      background: 'rgba(255, 68, 68, 0.1)',
                      border: '1px solid rgba(255, 68, 68, 0.3)',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      maxWidth: '300px'
                    }}>
                      {nearError}
                      <div style={{ color: '#888', fontSize: '10px', marginTop: '4px' }}>
                        Auto-rotating through backup providers
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <div style={{ color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '4px' }}>
                      Request ID
                    </div>
                    <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>
                      {selectedRequest.request_id}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '4px' }}>
                      Evidence ID
                    </div>
                    <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>
                      {selectedRequest.evidence_id}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '4px' }}>
                      Verification Type
                    </div>
                    <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: '12px' }}>
                      {selectedRequest.verification_type}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '4px' }}>
                      Reward
                    </div>
                    <div style={{ color: '#00ff00', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>
                      {(Number(selectedRequest.reward_amount) / 1e24).toFixed(2)} NEAR
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '4px' }}>
                      Status
                    </div>
                    <div style={{ color: '#00ff00', fontFamily: 'monospace', fontSize: '12px' }}>
                      [ACTIVE]
                    </div>
                  </div>
                </div>
              </div>

              <div style={{
                background: '#0a0a0a',
                border: '1px solid #333',
                padding: '32px',
                marginBottom: '32px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ color: '#fff', fontFamily: 'monospace', fontSize: '18px' }}>
                    Solver Bids ({bids.length})
                  </h2>
                  <button
                    onClick={() => setShowBidForm(!showBidForm)}
                    style={{
                      padding: '8px 16px',
                      background: showBidForm ? '#333' : '#0a0a0a',
                      border: '1px solid #00ff00',
                      color: '#00ff00',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {showBidForm ? '[CANCEL]' : '[SUBMIT_BID]'}
                  </button>
                </div>

                {showBidForm && (
                  <form onSubmit={handleSubmitBid} style={{
                    background: '#000',
                    border: '1px solid #222',
                    padding: '24px',
                    marginBottom: '24px'
                  }}>
                    <h3 style={{ color: '#fff', fontFamily: 'monospace', fontSize: '14px', marginBottom: '16px' }}>
                      Submit Your Bid
                    </h3>
                    <div style={{ display: 'grid', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '4px' }}>
                          Solver ID (NEAR Account)
                        </label>
                        <input
                          type="text"
                          value={bidFormData.solver_id}
                          onChange={(e) => setBidFormData({ ...bidFormData, solver_id: e.target.value })}
                          placeholder="solver.near"
                          required
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#0a0a0a',
                            border: '1px solid #333',
                            color: '#fff',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '4px' }}>
                          Bid Amount (NEAR)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={bidFormData.bid_amount}
                          onChange={(e) => setBidFormData({ ...bidFormData, bid_amount: e.target.value })}
                          placeholder="1.5"
                          required
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#0a0a0a',
                            border: '1px solid #333',
                            color: '#fff',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '4px' }}>
                          Estimated Completion (hours)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={bidFormData.estimated_completion}
                          onChange={(e) => setBidFormData({ ...bidFormData, estimated_completion: e.target.value })}
                          placeholder="24"
                          required
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#0a0a0a',
                            border: '1px solid #333',
                            color: '#fff',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '4px' }}>
                          Credentials (hex, optional)
                        </label>
                        <input
                          type="text"
                          value={bidFormData.credentials}
                          onChange={(e) => setBidFormData({ ...bidFormData, credentials: e.target.value })}
                          placeholder="00"
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#0a0a0a',
                            border: '1px solid #333',
                            color: '#fff',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '4px' }}>
                          Proof of Capability (hex, optional)
                        </label>
                        <input
                          type="text"
                          value={bidFormData.proof_of_capability}
                          onChange={(e) => setBidFormData({ ...bidFormData, proof_of_capability: e.target.value })}
                          placeholder="00"
                          style={{
                            width: '100%',
                            padding: '8px',
                            background: '#0a0a0a',
                            border: '1px solid #333',
                            color: '#fff',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}
                        />
                      </div>
                      <button
                        type="submit"
                        style={{
                          padding: '12px',
                          background: '#0a0a0a',
                          border: '1px solid #00ff00',
                          color: '#00ff00',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        [SUBMIT_BID]
                      </button>
                    </div>
                  </form>
                )}

                {bids.length === 0 ? (
                  <div style={{ color: '#888', fontFamily: 'monospace', fontSize: '12px' }}>
                    No bids submitted yet
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {bids.map((bid) => (
                      <div
                        key={bid.bid_id}
                        style={{
                          background: '#000',
                          border: '1px solid #222',
                          padding: '16px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: '12px' }}>
                            Solver: {bid.solver_id.substring(0, 20)}...
                          </div>
                          <div style={{ color: '#00ff00', fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold' }}>
                            {bid.bid_amount} NEAR
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ color: '#888', fontFamily: 'monospace', fontSize: '11px' }}>
                            Estimated: {bid.estimated_completion}h
                          </div>
                          <button
                            onClick={() => handleAcceptBid(bid.bid_id)}
                            style={{
                              padding: '6px 12px',
                              background: '#0a0a0a',
                              border: '1px solid #00ff00',
                              color: '#00ff00',
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            [ACCEPT_BID]
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <form onSubmit={handleCreateRequest} style={{
                background: '#0a0a0a',
                border: '1px solid #333',
                padding: '32px'
              }}>
                <h2 style={{ color: '#fff', fontFamily: 'monospace', fontSize: '18px', marginBottom: '24px' }}>
                  Create Verification Request
                </h2>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '8px' }}>
                    Evidence ID
                  </label>
                  <select
                    value={formData.evidence_id}
                    onChange={(e) => setFormData({ ...formData, evidence_id: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#000',
                      border: '1px solid #333',
                      color: '#fff',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Select your evidence</option>
                    {myEvidence.map((evidenceId) => (
                      <option key={evidenceId} value={evidenceId}>
                        {evidenceId}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '8px' }}>
                    Verification Type
                  </label>
                  <select
                    value={formData.verification_type}
                    onChange={(e) => setFormData({ ...formData, verification_type: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#000',
                      border: '1px solid #333',
                      color: '#fff',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Select verification type</option>
                    <option value="timestamp_proximity">Timestamp Proximity</option>
                    <option value="location_metadata">Location Metadata</option>
                    <option value="original_capture">Original Capture</option>
                    <option value="deepfake_detection">Deepfake Detection</option>
                    <option value="integrity_check">Integrity Check</option>
                    <option value="cross_chain_signature">Cross-chain Signature</option>
                    <option value="forensic_analysis">Forensic Analysis</option>
                  </select>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '8px' }}>
                    Reward Amount (NEAR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.reward_amount}
                    onChange={(e) => setFormData({ ...formData, reward_amount: e.target.value })}
                    placeholder="2.5"
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#000',
                      border: '1px solid #333',
                      color: '#fff',
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '8px' }}>
                    Requirements (one per line)
                  </label>
                  <textarea
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    placeholder="Must verify within 48 hours&#10;Provide detailed analysis report"
                    required
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#000',
                      border: '1px solid #333',
                      color: '#fff',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', color: '#888', fontFamily: 'monospace', fontSize: '11px', marginBottom: '8px' }}>
                    Deadline (Click to open calendar)
                  </label>
                  <input
                    type="date"
                    value={formData.deadlineDate}
                    onChange={(e) => setFormData({
                      ...formData,
                      deadlineDate: e.target.value,
                      deadline: e.target.value + 'T23:59:59Z'
                    })}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#000',
                      border: '1px solid #333',
                      color: '#fff',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      cursor: 'pointer',
                      colorScheme: 'dark'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="st-btn"
                  style={{ width: '100%' }}
                >
                  [CREATE_REQUEST]
                </button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default MarketplacePage
