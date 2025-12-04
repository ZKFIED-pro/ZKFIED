import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type AttestationGrant, type MinaCredentialProof, type HybridEvidenceResponse, type OtpVerifyResponse } from '@/services/api'
import WebZjsWallet from '../shared/WebZjsWallet'
import { useWallet } from '@/hooks/useWallet'
import OtpAuth from '../auth/OtpAuth'

type SubmissionMode = 'hybrid' | 'full'

const SubmitEvidencePage: React.FC = () => {
  const navigate = useNavigate()
  const { webzjs } = useWallet()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userSession, setUserSession] = useState<OtpVerifyResponse | null>(null)
  const [mode, setMode] = useState<SubmissionMode>('hybrid')
  const [attestation, setAttestation] = useState<AttestationGrant | undefined>(undefined)
  const [boardCategory, setBoardCategory] = useState<'healthcare' | 'government' | 'corporate' | 'civil_society' | 'media'>('healthcare')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [hybridResponse, setHybridResponse] = useState<HybridEvidenceResponse | undefined>(undefined)

  const [showMinaCredential, setShowMinaCredential] = useState(false)
  const [minaProof, setMinaProof] = useState('')
  const [minaPublicInput, setMinaPublicInput] = useState('')
  const [minaHolderKey, setMinaHolderKey] = useState('')
  const [minaCredentialType, setMinaCredentialType] = useState<number>(1)
  const [minaZkappAddress, setMinaZkappAddress] = useState('B62qjfNr4fERPmVx6RbZxdYLmELeJwoisWGqcsWyceAn17DVAMNm4zr')
  const [verifyingCredential, setVerifyingCredential] = useState(false)
  const [credentialVerified, setCredentialVerified] = useState<boolean | null>(null)
  const [zcashTxid, setZcashTxid] = useState('')
  const [linkingTx, setLinkingTx] = useState(false)
  const [completionResponse, setCompletionResponse] = useState<any | undefined>(undefined)

  const handleSkipOtp = () => {
    setIsAuthenticated(true)
    setUserSession({
      session_id: 'skip_otp',
      email: 'test@example.com',
      is_verified: true,
      mina_credential_hash: null,
      board_type: null,
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleAuthenticated = (session: OtpVerifyResponse) => {
    setUserSession(session)
    setIsAuthenticated(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)
    setHybridResponse(undefined)

    if (!title.trim() || !description.trim()) {
      setError('Title and description are required')
      return
    }

    if (mode === 'full' && !webzjs.isConnected) {
      setError('WebZjs wallet connection is required for full orchestrator mode')
      return
    }

    if (mode === 'hybrid' && !userSession) {
      setError('Authentication required for hybrid mode')
      return
    }

    try {
      setSubmitting(true)

      if (mode === 'hybrid') {
        let minaCredential: MinaCredentialProof | undefined
        if (showMinaCredential && minaProof && minaHolderKey) {
          minaCredential = {
            proof: minaProof,
            public_input: minaPublicInput.split(',').map(s => s.trim()).filter(Boolean),
            holder_public_key: minaHolderKey,
            credential_type: minaCredentialType,
            timestamp: Date.now(),
            zkapp_address: minaZkappAddress,
          }
        }

        const response = await api.submitHybridEvidence({
          session_id: userSession?.session_id || 'skip_otp',
          evidence_type: `${boardCategory}_whistleblower`,
          evidence_data: `${title}\n\n${description}`,
          description: description,
          mina_credential: minaCredential,
        })

        setHybridResponse(response)
      } else {
        // Full orchestrator mode: Original submission flow
        let minaCredential: MinaCredentialProof | undefined
        if (showMinaCredential && minaProof && minaHolderKey) {
          minaCredential = {
            proof: minaProof,
            public_input: minaPublicInput.split(',').map(s => s.trim()).filter(Boolean),
            holder_public_key: minaHolderKey,
            credential_type: minaCredentialType,
            timestamp: Date.now(),
            zkapp_address: minaZkappAddress,
          }
        }

        const response = await api.submitEvidence({
          title,
          description,
          board_category: boardCategory,
          files,
          attestation: attestation || undefined,
          mina_credential: minaCredential,
        })

        navigate(`/evidence/${response.evidence_id}`)
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to submit evidence')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyCredential = async () => {
    if (!minaProof || !minaHolderKey) {
      setError('Proof and holder public key are required')
      return
    }

    try {
      setVerifyingCredential(true)
      setError(undefined)
      const verification = await api.verifyMinaCredential({
        proof: minaProof,
        public_input: minaPublicInput.split(',').map(s => s.trim()).filter(Boolean),
        holder_public_key: minaHolderKey,
        credential_type: minaCredentialType,
        timestamp: Date.now(),
        zkapp_address: minaZkappAddress,
      })

      setCredentialVerified(verification.is_valid)
    } catch (e: any) {
      setError(`Credential verification failed: ${e?.message ?? 'Unknown error'}`)
      setCredentialVerified(false)
    } finally {
      setVerifyingCredential(false)
    }
  }

  const handleLinkTransaction = async () => {
    if (!hybridResponse || !zcashTxid.trim()) {
      setError('Evidence ID and Zcash transaction ID are required')
      return
    }

    try {
      setLinkingTx(true)
      setError(undefined)
      const response = await api.linkTransaction(hybridResponse.evidence_id, zcashTxid.trim())
      setCompletionResponse(response)
    } catch (e: any) {
      setError(`Failed to link transaction: ${e?.message ?? 'Unknown error'}`)
    } finally {
      setLinkingTx(false)
    }
  }

  const boardCategories = [
    { id: 'healthcare', name: 'Healthcare' },
    { id: 'government', name: 'Government' },
    { id: 'corporate', name: 'Corporate' },
    { id: 'civil_society', name: 'Civil Society' },
    { id: 'media', name: 'Media' },
  ] as const

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="fade-in">
      <section style={{
        padding: '60px 0 40px',
        borderBottom: '1px solid rgb(52, 52, 52)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url(/images/5.jpg)',
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
          <h1 className="mb-sm">Submit Evidence</h1>
          <p className="text-gray">
            Cryptographically protected whistleblower evidence submission
          </p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Mode Toggle */}
          <div className="st-card" style={{ marginBottom: '24px' }}>
            <div className="st-card-inner">
              <h3 className="mb-md" style={{ fontSize: '14px' }}>Submission Mode</h3>
              <div className="flex flex-col" style={{ gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setMode('hybrid')}
                  className="st-btn"
                  style={{
                    textAlign: 'left',
                    borderColor: mode === 'hybrid' ? 'rgb(0, 255, 136)' : 'rgb(52, 52, 52)',
                    color: mode === 'hybrid' ? 'rgb(0, 255, 136)' : 'rgb(160, 160, 160)',
                    padding: '16px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Hybrid Mode (Recommended)</div>
                  <div style={{ fontSize: '10px', opacity: 0.7 }}>
                    Get ZK proof + evidence ID → Complete transaction in your own Zashi wallet
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('full')}
                  className="st-btn"
                  style={{
                    textAlign: 'left',
                    borderColor: mode === 'full' ? 'white' : 'rgb(52, 52, 52)',
                    color: mode === 'full' ? 'white' : 'rgb(160, 160, 160)',
                    padding: '16px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Full Orchestrator (Experimental)</div>
                  <div style={{ fontSize: '10px', opacity: 0.7 }}>
                    Automated transaction building & broadcasting (requires working RPC endpoints)
                  </div>
                </button>
              </div>
            </div>
          </div>

          {mode === 'hybrid' && !isAuthenticated && (
            <div>
              <OtpAuth onAuthenticated={handleAuthenticated} />
              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <button
                  onClick={handleSkipOtp}
                  className="st-button-secondary"
                  style={{ fontSize: '10px', padding: '8px 16px' }}
                >
                  Skip OTP (Testing)
                </button>
              </div>
            </div>
          )}

          {mode === 'hybrid' && isAuthenticated && userSession && (
            <div className="st-card" style={{ marginBottom: '24px' }}>
              <div className="st-card-inner">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '12px', marginBottom: '4px' }}>Authenticated</h3>
                    <p className="text-gray" style={{ fontSize: '10px' }}>{userSession.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAuthenticated(false)
                      setUserSession(null)
                    }}
                    className="st-btn"
                    style={{ padding: '6px 12px', fontSize: '10px' }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'full' && <WebZjsWallet />}

          {/* Hybrid Mode Success Response */}
          {hybridResponse && !completionResponse && (
            <div className="st-card" style={{ marginBottom: '24px', borderColor: 'rgb(0, 255, 136)' }}>
              <div className="st-card-inner">
                <h3 className="mb-md" style={{ fontSize: '16px', color: 'rgb(0, 255, 136)' }}>
                  Step 1/2: Evidence Submitted Successfully!
                </h3>

                <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(0, 255, 136, 0.05)', border: '1px solid rgba(0, 255, 136, 0.2)' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Evidence ID
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <code style={{ flex: 1, padding: '12px', background: 'rgb(20, 20, 20)', border: '1px solid rgb(52, 52, 52)', fontSize: '11px', fontFamily: 'monospace', color: 'rgb(0, 255, 136)' }}>
                      {hybridResponse.evidence_id}
                    </code>
                    <button
                      onClick={() => copyToClipboard(hybridResponse.evidence_id)}
                      className="st-btn"
                      style={{ padding: '10px 16px', fontSize: '10px' }}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {hybridResponse.viewing_key && (
                  <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255, 165, 0, 0.05)', border: '1px solid rgba(255, 165, 0, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <p className="text-gray" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                        Viewing Key
                      </p>
                      <span style={{ fontSize: '10px', color: 'rgb(255, 165, 0)', fontWeight: 'bold' }}> IMPORTANT</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <code style={{ flex: 1, padding: '12px', background: 'rgb(20, 20, 20)', border: '1px solid rgb(52, 52, 52)', fontSize: '11px', fontFamily: 'monospace', color: 'rgb(255, 165, 0)', wordBreak: 'break-all' }}>
                        {hybridResponse.viewing_key}
                      </code>
                      <button
                        onClick={() => copyToClipboard(hybridResponse.viewing_key!)}
                        className="st-btn"
                        style={{ padding: '10px 16px', fontSize: '10px', borderColor: 'rgb(255, 165, 0)', color: 'rgb(255, 165, 0)' }}
                      >
                        Copy
                      </button>
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(255, 0, 0, 0.1)', border: '1px solid rgba(255, 0, 0, 0.3)', borderRadius: '4px' }}>
                      <p style={{ fontSize: '10px', color: 'rgb(255, 165, 0)', lineHeight: '16px', margin: 0 }}>
                        <strong> SAVE THIS VIEWING KEY SECURELY!</strong><br/>
                        • This is the ONLY way to decrypt and access your evidence<br/>
                        • We do NOT store this key - if you lose it, your evidence cannot be recovered<br/>
                        • Keep it in a secure location <br/>
                      </p>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(0, 136, 255, 0.05)', border: '1px solid rgba(0, 136, 255, 0.2)' }}>
                  <h4 className="text-white mb-sm" style={{ fontSize: '12px' }}>Step 2: Create Zcash Transaction in Zashi Wallet</h4>
                  <ol className="text-gray" style={{ fontSize: '10px', lineHeight: '18px', paddingLeft: '20px' }}>
                    <li style={{ marginBottom: '8px' }}>Open Zashi wallet app on your device</li>
                    <li style={{ marginBottom: '8px' }}>Tap "Send" to create a new shielded transaction</li>
                    <li style={{ marginBottom: '8px' }}>Enter any Zcash shielded address (can be your own)</li>
                    <li style={{ marginBottom: '8px' }}>Amount: Minimum (0.00001 ZEC)</li>
                    <li style={{ marginBottom: '8px' }}>
                      <strong>In the MEMO field, paste:</strong>
                      <div style={{ marginTop: '8px', padding: '8px', background: 'rgb(20, 20, 20)', border: '1px solid rgb(52, 52, 52)', fontFamily: 'monospace', fontSize: '9px', wordBreak: 'break-all' }}>
                        ZKFIED:{hybridResponse.evidence_id}
                      </div>
                    </li>
                    <li style={{ marginBottom: '8px' }}>Review and confirm the transaction</li>
                    <li style={{ marginBottom: '8px' }}>Copy the transaction ID from your wallet</li>
                    <li>Paste it below to complete the submission!</li>
                  </ol>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <a
                    href="https://apps.apple.com/app/zashi-zcash-wallet/id1672392439"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="st-btn"
                    style={{ flex: 1, textAlign: 'center', fontSize: '10px', padding: '12px' }}
                  >
                    Download Zashi (iOS)
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=co.electriccoin.zcash"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="st-btn"
                    style={{ flex: 1, textAlign: 'center', fontSize: '10px', padding: '12px' }}
                  >
                    Download Zashi (Android)
                  </a>
                </div>

                <div style={{ marginTop: '24px', padding: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgb(52, 52, 52)' }}>
                  <h4 className="text-white mb-md" style={{ fontSize: '12px' }}>Complete Your Submission</h4>

                  <div style={{ marginBottom: '16px' }}>
                    <label className="text-gray" style={{ fontSize: '10px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Zcash Transaction ID
                    </label>
                    <input
                      type="text"
                      value={zcashTxid}
                      onChange={(e) => setZcashTxid(e.target.value)}
                      placeholder="Paste your Zcash transaction ID here..."
                      style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px' }}
                      disabled={linkingTx}
                    />
                  </div>

                  <button
                    onClick={handleLinkTransaction}
                    disabled={linkingTx || !zcashTxid.trim()}
                    className="st-btn"
                    style={{ width: '100%', fontSize: '11px', padding: '12px', marginBottom: '12px' }}
                  >
                    {linkingTx ? 'Processing...' : 'Complete Submission'}
                  </button>

                  {linkingTx && (
                    <div style={{ padding: '12px', background: 'rgba(0, 255, 136, 0.05)', border: '1px solid rgba(0, 255, 136, 0.2)' }}>
                      <p className="text-white" style={{ fontSize: '10px', marginBottom: '8px' }}>Processing your submission...</p>
                      <div style={{ fontSize: '9px', color: 'rgb(180, 180, 180)', lineHeight: '16px' }}>
                        <div>• Verifying Zcash transaction</div>
                        <div>• Generating payment disclosure proof</div>
                        <div>• Registering on NEAR Protocol</div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setHybridResponse(undefined)
                    setZcashTxid('')
                    setTitle('')
                    setDescription('')
                  }}
                  className="st-btn"
                  style={{ width: '100%', marginTop: '16px', fontSize: '11px', padding: '12px' }}
                >
                  Cancel & Submit New Evidence
                </button>
              </div>
            </div>
          )}

          {/* Completion Success Response */}
          {completionResponse && (
            <div className="st-card" style={{ marginBottom: '24px', borderColor: 'rgb(0, 255, 136)' }}>
              <div className="st-card-inner">
                <h3 className="mb-md" style={{ fontSize: '18px', color: 'rgb(0, 255, 136)' }}>
                  Evidence Submission Complete!
                </h3>

                <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(0, 255, 136, 0.05)', border: '1px solid rgba(0, 255, 136, 0.2)' }}>
                  <p className="text-white" style={{ fontSize: '11px', marginBottom: '12px' }}>
                    Your evidence has been successfully anchored to the blockchain with full cryptographic protection.
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Evidence ID
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <code style={{ flex: 1, padding: '12px', background: 'rgb(20, 20, 20)', border: '1px solid rgb(52, 52, 52)', fontSize: '11px', fontFamily: 'monospace', color: 'rgb(0, 255, 136)' }}>
                      {completionResponse.evidence_id}
                    </code>
                    <button
                      onClick={() => copyToClipboard(completionResponse.evidence_id)}
                      className="st-btn"
                      style={{ padding: '10px 16px', fontSize: '10px' }}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Status
                  </p>
                  <div style={{ padding: '12px', background: 'rgb(20, 20, 20)', border: '1px solid rgb(52, 52, 52)' }}>
                    <code style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgb(0, 255, 136)' }}>
                      {completionResponse.status}
                    </code>
                  </div>
                </div>

                {completionResponse.near_tx_hash && (
                  <div style={{ marginBottom: '16px' }}>
                    <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      NEAR Transaction
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <code style={{ flex: 1, padding: '12px', background: 'rgb(20, 20, 20)', border: '1px solid rgb(52, 52, 52)', fontSize: '10px', fontFamily: 'monospace', color: 'rgb(160, 160, 160)', wordBreak: 'break-all' }}>
                        {completionResponse.near_tx_hash}
                      </code>
                      <button
                        onClick={() => copyToClipboard(completionResponse.near_tx_hash)}
                        className="st-btn"
                        style={{ padding: '10px 16px', fontSize: '10px' }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                {completionResponse.payment_disclosure && (
                  <div style={{ marginBottom: '20px' }}>
                    <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Payment Disclosure Proof (ZIP-311)
                    </p>
                    <textarea
                      readOnly
                      value={completionResponse.payment_disclosure}
                      style={{ width: '100%', minHeight: '120px', fontFamily: 'monospace', fontSize: '9px', background: 'rgb(20, 20, 20)', border: '1px solid rgb(52, 52, 52)', color: 'rgb(160, 160, 160)', padding: '12px' }}
                    />
                    <button
                      onClick={() => copyToClipboard(completionResponse.payment_disclosure)}
                      className="st-btn"
                      style={{ width: '100%', marginTop: '8px', fontSize: '10px', padding: '10px' }}
                    >
                      Copy Payment Disclosure
                    </button>
                  </div>
                )}

                <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid rgb(52, 52, 52)' }}>
                  <h4 className="text-white mb-sm" style={{ fontSize: '11px' }}>What Happened:</h4>
                  <ul className="text-gray" style={{ fontSize: '10px', lineHeight: '18px', paddingLeft: '20px' }}>
                    <li style={{ marginBottom: '6px' }}>Evidence encrypted and stored on IPFS</li>
                    <li style={{ marginBottom: '6px' }}>Zero-knowledge commitment generated using FROST signatures</li>
                    <li style={{ marginBottom: '6px' }}>Zcash transaction verified and linked</li>
                    <li style={{ marginBottom: '6px' }}>Payment disclosure proof (ZIP-311) generated</li>
                    <li>Evidence registered on NEAR Protocol</li>
                  </ul>
                </div>

                <button
                  onClick={() => navigate(`/evidence/${completionResponse.evidence_id}`)}
                  className="st-btn"
                  style={{ width: '100%', fontSize: '12px', padding: '14px', marginBottom: '12px', borderColor: 'rgb(0, 255, 136)', color: 'rgb(0, 255, 136)' }}
                >
                  View Evidence Details
                </button>

                <button
                  onClick={() => navigate('/browse')}
                  className="st-btn"
                  style={{ width: '100%', fontSize: '12px', padding: '14px', marginBottom: '12px' }}
                >
                  Browse All Evidence
                </button>

                <button
                  onClick={() => {
                    setHybridResponse(undefined)
                    setCompletionResponse(undefined)
                    setZcashTxid('')
                    setTitle('')
                    setDescription('')
                  }}
                  className="st-btn"
                  style={{ width: '100%', fontSize: '12px', padding: '14px' }}
                >
                  Submit Another Evidence
                </button>
              </div>
            </div>
          )}

          {!hybridResponse && !completionResponse && (
            <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ padding: '16px', border: '1px solid rgb(100, 100, 100)', marginBottom: '24px', background: 'rgba(255, 0, 0, 0.05)' }}>
                <p className="text-white" style={{ fontSize: '12px' }}>{error}</p>
              </div>
            )}

            <div className="st-card" style={{ marginBottom: '24px' }}>
              <div className="st-card-inner">
                <h3 className="mb-md" style={{ fontSize: '14px' }}>Board Category</h3>
                <div className="flex flex-col" style={{ gap: '10px' }}>
                  {boardCategories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setBoardCategory(cat.id)}
                      className="st-btn"
                      style={{
                        textAlign: 'left',
                        borderColor: boardCategory === cat.id ? 'white' : 'rgb(52, 52, 52)',
                        color: boardCategory === cat.id ? 'white' : 'rgb(160, 160, 160)',
                        padding: '12px',
                        fontSize: '12px'
                      }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="st-card" style={{ marginBottom: '24px' }}>
              <div className="st-card-inner">
                <h3 className="mb-md" style={{ fontSize: '14px' }}>Evidence Details</h3>

                <div style={{ marginBottom: '20px' }}>
                  <label className="text-gray" style={{ fontSize: '10px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief description of evidence"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label className="text-gray" style={{ fontSize: '10px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed description of evidence and context"
                    style={{ width: '100%', minHeight: '150px' }}
                  />
                </div>

                <div>
                  <label className="text-gray" style={{ fontSize: '10px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Files
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    style={{ width: '100%' }}
                  />
                  {files.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px' }}>
                        {files.length} file(s) selected:
                      </p>
                      {files.map((file, idx) => (
                        <div key={idx} style={{ fontSize: '10px', color: 'rgb(160, 160, 160)', marginBottom: '4px' }}>
                          {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="st-card" style={{ marginBottom: '24px' }}>
              <div className="st-card-inner">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px' }}>Mina Credential Proof (Optional)</h3>
                  <button
                    type="button"
                    onClick={() => setShowMinaCredential(!showMinaCredential)}
                    className="st-btn"
                    style={{ padding: '6px 12px', fontSize: '10px' }}
                  >
                    {showMinaCredential ? 'Hide' : 'Add Credential'}
                  </button>
                </div>

                {showMinaCredential && (
                  <>
                    <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0, 136, 255, 0.05)', border: '1px solid rgba(0, 136, 255, 0.2)' }}>
                      <p className="text-gray" style={{ fontSize: '10px', lineHeight: '16px' }}>
                        Attach a Mina zkApp credential proof to verify your professional identity (doctor, nurse, journalist, etc.) without revealing personal information.
                      </p>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label className="text-gray" style={{ fontSize: '10px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Credential Type
                      </label>
                      <select
                        value={minaCredentialType}
                        onChange={(e) => setMinaCredentialType(Number(e.target.value))}
                        style={{ width: '100%', padding: '10px', fontSize: '12px' }}
                      >
                        <option value={1}>Doctor (Healthcare)</option>
                        <option value={2}>Nurse (Healthcare)</option>
                        <option value={3}>Journalist (Government/Media)</option>
                        <option value={4}>Laborer (Corporate)</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label className="text-gray" style={{ fontSize: '10px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Holder Public Key
                      </label>
                      <input
                        type="text"
                        value={minaHolderKey}
                        onChange={(e) => setMinaHolderKey(e.target.value)}
                        placeholder="B62q..."
                        style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px' }}
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label className="text-gray" style={{ fontSize: '10px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Proof (JSON or Base64)
                      </label>
                      <textarea
                        value={minaProof}
                        onChange={(e) => setMinaProof(e.target.value)}
                        placeholder="Enter zkApp proof..."
                        style={{ width: '100%', minHeight: '100px', fontFamily: 'monospace', fontSize: '10px' }}
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label className="text-gray" style={{ fontSize: '10px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Public Input (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={minaPublicInput}
                        onChange={(e) => setMinaPublicInput(e.target.value)}
                        placeholder="field1, field2, field3..."
                        style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px' }}
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label className="text-gray" style={{ fontSize: '10px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        zkApp Address
                      </label>
                      <input
                        type="text"
                        value={minaZkappAddress}
                        onChange={(e) => setMinaZkappAddress(e.target.value)}
                        placeholder="B62q..."
                        style={{ width: '100%', fontFamily: 'monospace', fontSize: '11px' }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleVerifyCredential}
                      disabled={verifyingCredential || !minaProof || !minaHolderKey}
                      className="st-btn"
                      style={{ width: '100%', fontSize: '11px', padding: '12px', marginBottom: '12px' }}
                    >
                      {verifyingCredential ? 'Verifying...' : 'Verify Credential'}
                    </button>

                    {credentialVerified === true && (
                      <div style={{ padding: '12px', background: 'rgba(0, 255, 136, 0.05)', border: '1px solid rgba(0, 255, 136, 0.3)' }}>
                        <p className="text-white" style={{ fontSize: '11px' }}>Credential verified successfully</p>
                      </div>
                    )}

                    {credentialVerified === false && (
                      <div style={{ padding: '12px', background: 'rgba(255, 0, 0, 0.05)', border: '1px solid rgba(255, 0, 0, 0.3)' }}>
                        <p className="text-white" style={{ fontSize: '11px' }}>Credential verification failed</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || (mode === 'full' && !webzjs.isConnected) || !title.trim() || !description.trim()}
              className="st-btn"
              style={{ width: '100%', fontSize: '12px', padding: '16px' }}
            >
              {submitting
                ? (mode === 'hybrid' ? 'Generating ZK Proof...' : 'Submitting Evidence...')
                : (mode === 'hybrid' ? 'Submit & Get Evidence ID' : 'Submit Evidence')}
            </button>

            {mode === 'full' && !webzjs.isConnected && (
              <p className="text-gray" style={{ fontSize: '10px', textAlign: 'center', marginTop: '8px' }}>
                Connect WebZjs wallet to enable full orchestrator mode
              </p>
            )}

            {submitting && mode === 'hybrid' && (
              <div style={{ marginTop: '16px', padding: '16px', border: '1px solid rgba(0, 255, 136, 0.3)', background: 'rgba(0, 255, 136, 0.05)' }}>
                <p className="text-white" style={{ fontSize: '11px', marginBottom: '12px' }}>Processing your submission...</p>
                <div style={{ fontSize: '10px', color: 'rgb(180, 180, 180)', lineHeight: '18px' }}>
                  <div style={{ marginBottom: '8px' }}>1. Uploading evidence to IPFS...</div>
                  <div style={{ marginBottom: '8px' }}>2. Generating cryptographic commitment...</div>
                  <div>3. Creating zero-knowledge proof...</div>
                </div>
              </div>
            )}

            {submitting && mode === 'full' && (
              <div style={{ marginTop: '16px', padding: '16px', border: '1px solid rgba(0, 255, 136, 0.3)', background: 'rgba(0, 255, 136, 0.05)' }}>
                <p className="text-white" style={{ fontSize: '11px', marginBottom: '12px' }}>Processing your submission...</p>
                <div style={{ fontSize: '10px', color: 'rgb(180, 180, 180)', lineHeight: '18px' }}>
                  <div style={{ marginBottom: '8px' }}>1. Uploading files to IPFS...</div>
                  <div style={{ marginBottom: '8px' }}>2. Encrypting evidence metadata...</div>
                  <div style={{ marginBottom: '8px' }}>3. Initiating FROST signature (3-of-5 threshold)...</div>
                  <div style={{ marginBottom: '8px' }}>4. Building Zcash shielded transaction...</div>
                  <div>5. Broadcasting to testnet...</div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px', padding: '16px', border: '1px solid rgb(52, 52, 52)' }}>
              <h4 className="text-white mb-sm" style={{ fontSize: '12px' }}>
                {mode === 'hybrid' ? 'Hybrid Mode Features' : 'Privacy Guarantees'}
              </h4>
              {mode === 'hybrid' ? (
                <ul className="text-gray" style={{ fontSize: '10px', lineHeight: '18px', paddingLeft: '20px' }}>
                  <li>Evidence uploaded to decentralized IPFS network</li>
                  <li>Zero-knowledge proof generated for cryptographic commitment</li>
                  <li>You control your own Zashi wallet and funds</li>
                  <li>Transaction completed privately in your own wallet</li>
                  <li>No custody - maximum privacy and security</li>
                </ul>
              ) : (
                <ul className="text-gray" style={{ fontSize: '10px', lineHeight: '18px', paddingLeft: '20px' }}>
                  <li>Evidence encrypted in Zcash shielded pool</li>
                  <li>FROST threshold signatures (3-of-5 board members)</li>
                  <li>IPFS content-addressed storage</li>
                  <li>Zero-knowledge payment disclosure proofs</li>
                  <li>Email domain-based attestation (no email stored)</li>
                </ul>
              )}
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default SubmitEvidencePage
