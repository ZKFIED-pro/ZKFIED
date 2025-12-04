import React, { useState } from 'react'
import { api } from '@/services/api'

interface EvidenceResult {
  success: boolean
  evidence_id: string
  evidence_data: any
  metadata: {
    ipfs_cid: string
    board_category: string
    title: string
    description: string
    status: string
    submission_timestamp: number
  }
  message?: string
}

const CheckEvidencePage: React.FC = () => {
  const [evidenceId, setEvidenceId] = useState('')
  const [viewingKey, setViewingKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [result, setResult] = useState<EvidenceResult | undefined>(undefined)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted!')
    console.log('Evidence ID:', evidenceId)
    console.log('Viewing Key:', viewingKey)

    setError(undefined)
    setResult(undefined)

    if (!evidenceId.trim() || !viewingKey.trim()) {
      setError('Evidence ID and Viewing Key are required')
      return
    }

    try {
      setLoading(true)
      console.log('Calling checkEvidence API...')
      const response = await api.checkEvidence(evidenceId.trim(), viewingKey.trim())
      console.log('API Response:', response)
      setResult(response)
    } catch (err: any) {
      console.error('Failed to check evidence:', err)
      setError(err.message || 'Failed to decrypt evidence. Please check your viewing key.')
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const formatBoardCategory = (category: string) => {
    return category.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
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
          backgroundImage: 'url(/images/6.jpg)',
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
          <h1 className="mb-sm">Check Evidence</h1>
          <p className="text-gray">
            Decrypt and view evidence using your viewing key
          </p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <form onSubmit={handleSubmit}>
            <div className="st-card" style={{ marginBottom: '24px' }}>
              <div className="st-card-inner">
                <h3 className="mb-md" style={{ fontSize: '14px' }}>Evidence ID</h3>
                <input
                  type="text"
                  value={evidenceId}
                  onChange={(e) => setEvidenceId(e.target.value)}
                  placeholder="evidence_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled={loading}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>
            </div>

            <div className="st-card" style={{ marginBottom: '24px' }}>
              <div className="st-card-inner">
                <h3 className="mb-md" style={{ fontSize: '14px' }}>Viewing Key</h3>
                <input
                  type="password"
                  value={viewingKey}
                  onChange={(e) => setViewingKey(e.target.value)}
                  placeholder="Enter your viewing key"
                  disabled={loading}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px' }}
                />
                <p className="text-gray" style={{ fontSize: '10px', marginTop: '8px' }}>
                  This key was provided when the evidence was submitted
                </p>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '16px',
                border: '1px solid rgb(255, 0, 0)',
                marginBottom: '24px',
                background: 'rgba(255, 0, 0, 0.05)'
              }}>
                <p className="text-white" style={{ fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>Error:</p>
                <p className="text-white" style={{ fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{error}</p>
              </div>
            )}

            {loading && (
              <div style={{
                padding: '16px',
                border: '1px solid rgb(0, 255, 136)',
                marginBottom: '24px',
                background: 'rgba(0, 255, 136, 0.05)'
              }}>
                <p className="text-white" style={{ fontSize: '12px' }}>Decrypting evidence...</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="st-btn"
              style={{
                width: '100%',
                fontSize: '12px',
                padding: '16px',
                borderColor: 'rgb(0, 255, 136)',
                color: 'rgb(0, 255, 136)'
              }}
            >
              {loading ? 'Decrypting...' : 'Decrypt Evidence'}
            </button>
          </form>

          {result && result.success && (
            <div className="st-card" style={{ marginTop: '24px', borderColor: 'rgb(0, 255, 136)' }}>
              <div className="st-card-inner">
                <h3 className="mb-md" style={{ fontSize: '16px', color: 'rgb(0, 255, 136)' }}>
                  Evidence Decrypted Successfully
                </h3>

                <div style={{ marginBottom: '16px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Evidence ID
                  </p>
                  <p className="text-white" style={{ fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {result.evidence_id}
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Board Category
                  </p>
                  <p className="text-white" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                    {formatBoardCategory(result.metadata.board_category)}
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Status
                  </p>
                  <p className="text-white" style={{ fontSize: '12px', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                    {result.metadata.status}
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Submission Time
                  </p>
                  <p className="text-white" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                    {formatTimestamp(result.metadata.submission_timestamp)}
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Title
                  </p>
                  <p className="text-white" style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                    {result.metadata.title}
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Description
                  </p>
                  <div style={{ padding: '12px', background: 'rgb(20, 20, 20)', border: '1px solid rgb(52, 52, 52)' }}>
                    <p className="text-white" style={{ fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      {result.metadata.description}
                    </p>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    IPFS CID
                  </p>
                  <p className="text-white" style={{ fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {result.metadata.ipfs_cid}
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Decrypted Evidence Data
                  </p>
                  <div style={{
                    padding: '16px',
                    background: 'rgb(20, 20, 20)',
                    border: '1px solid rgb(52, 52, 52)',
                    maxHeight: '400px',
                    overflow: 'auto'
                  }}>
                    <pre style={{
                      margin: 0,
                      color: 'rgb(0, 255, 136)',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {JSON.stringify(result.evidence_data, null, 2)}
                    </pre>
                  </div>
                </div>

                <div style={{ paddingTop: '16px', borderTop: '1px solid rgb(52, 52, 52)' }}>
                  <p className="text-gray" style={{ fontSize: '10px' }}>
                    Evidence verified and decrypted successfully
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CheckEvidencePage
