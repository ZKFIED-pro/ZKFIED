import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type EvidenceIndex, type FrostSession, type EvidenceMetadata } from '@/services/api'
import { ExternalLink, Shield, Database, Clock, CheckCircle, XCircle, Loader } from 'lucide-react'

const EvidenceDetailPage: React.FC = () => {
  const { evidenceId } = useParams<{ evidenceId: string }>()
  const [evidence, setEvidence] = useState<EvidenceIndex | null>(null)
  const [metadata, setMetadata] = useState<EvidenceMetadata | null>(null)
  const [frostSession, setFrostSession] = useState<FrostSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!evidenceId) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const evidenceData = await api.getEvidenceIndex(evidenceId)
        setEvidence(evidenceData)

        if (evidenceData.ipfs_cid) {
          try {
            const metadataData = await api.getEvidenceMetadata(evidenceData.ipfs_cid)
            setMetadata(metadataData)
          } catch (e) {
            console.error('Failed to fetch metadata:', e)
          }
        }

        try {
          const session = await api.getFrostSession(evidenceId)
          setFrostSession(session)
        } catch (e) {
          console.error('Failed to fetch FROST session:', e)
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load evidence')
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [evidenceId])

  if (loading && !evidence) {
    return (
      <div className="fade-in">
        <section style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="container">
            <Loader className="animate-spin" size={40} style={{ margin: '0 auto 20px', color: '#00ff88' }} />
            <p className="text-gray">Loading evidence...</p>
          </div>
        </section>
      </div>
    )
  }

  if (error || !evidence) {
    return (
      <div className="fade-in">
        <section style={{ padding: '60px 0' }}>
          <div className="container">
            <div style={{ padding: '40px', border: '1px solid rgb(100, 100, 100)', background: 'rgba(255, 0, 0, 0.05)' }}>
              <h2 style={{ color: '#ff4444', marginBottom: '16px' }}>Error</h2>
              <p className="text-gray">{error || 'Evidence not found'}</p>
              <Link to="/" className="st-btn" style={{ display: 'inline-block', marginTop: '20px', padding: '12px 24px', fontSize: '12px' }}>
                Back to Home
              </Link>
            </div>
          </div>
        </section>
      </div>
    )
  }

  const statusColor = {
    pending: '#ffa500',
    signing: '#00a8ff',
    broadcasting: '#00a8ff',
    confirmed: '#00ff88',
    failed: '#ff4444'
  }[evidence.status] || '#888'

  const StatusIcon = {
    pending: Clock,
    signing: Loader,
    broadcasting: Loader,
    confirmed: CheckCircle,
    failed: XCircle
  }[evidence.status] || Clock

  return (
    <div className="fade-in">
      <section style={{ padding: '60px 0 40px', borderBottom: '1px solid rgb(52, 52, 52)' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <StatusIcon size={32} style={{ marginRight: '16px', color: statusColor }} />
            <div>
              <h1 className="mb-sm">Evidence Details</h1>
              <p className="text-gray" style={{ fontSize: '12px' }}>ID: {evidence.evidence_id}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

          <div className="st-card" style={{ marginBottom: '24px' }}>
            <div className="st-card-inner">
              <h3 className="mb-md" style={{ fontSize: '14px' }}>Status</h3>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ padding: '8px 16px', border: `1px solid ${statusColor}`, background: `${statusColor}15`, borderRadius: '4px' }}>
                  <span style={{ fontSize: '12px', color: statusColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {evidence.status}
                  </span>
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Board Category</p>
                  <p className="text-white" style={{ fontSize: '12px', textTransform: 'capitalize' }}>{evidence.board_category}</p>
                </div>
                <div>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Confirmations</p>
                  <p className="text-white" style={{ fontSize: '12px' }}>{evidence.confirmation_count}</p>
                </div>
                <div>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Submitted</p>
                  <p className="text-white" style={{ fontSize: '12px' }}>{new Date(evidence.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Timestamp</p>
                  <p className="text-white" style={{ fontSize: '12px' }}>{evidence.submission_timestamp}</p>
                </div>
              </div>
            </div>
          </div>

          {evidence.zcash_txid && (
            <div className="st-card" style={{ marginBottom: '24px' }}>
              <div className="st-card-inner">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                  <Shield size={20} style={{ marginRight: '12px', color: '#00ff88' }} />
                  <h3 style={{ fontSize: '14px', margin: 0 }}>Zcash Transaction</h3>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Transaction ID</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <code style={{ fontSize: '11px', padding: '8px 12px', background: 'rgba(0, 255, 136, 0.05)', border: '1px solid rgba(0, 255, 136, 0.2)', borderRadius: '4px', flex: 1, wordBreak: 'break-all' }}>
                      {evidence.zcash_txid}
                    </code>
                    <a
                      href={`https://testnet.zcashblockexplorer.com/transactions/${evidence.zcash_txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="st-btn"
                      style={{ padding: '8px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                    >
                      <ExternalLink size={14} />
                      Explorer
                    </a>
                  </div>
                </div>

                <div style={{ padding: '12px', border: '1px solid rgb(52, 52, 52)', background: 'rgba(0, 255, 136, 0.02)' }}>
                  <p className="text-gray" style={{ fontSize: '10px', lineHeight: '16px' }}>
                    Shielded transaction with zero-knowledge proofs. Only viewing key holders can decrypt the memo field containing evidence metadata.
                  </p>
                </div>
              </div>
            </div>
          )}

          {evidence.near_tx_hash && (
            <div className="st-card" style={{ marginBottom: '24px' }}>
              <div className="st-card-inner">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                  <Database size={20} style={{ marginRight: '12px', color: '#00a8ff' }} />
                  <h3 style={{ fontSize: '14px', margin: 0 }}>NEAR Protocol Registration</h3>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Transaction Hash</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <code style={{ fontSize: '11px', padding: '8px 12px', background: 'rgba(0, 168, 255, 0.05)', border: '1px solid rgba(0, 168, 255, 0.2)', borderRadius: '4px', flex: 1, wordBreak: 'break-all' }}>
                      {evidence.near_tx_hash}
                    </code>
                    <a
                      href={`https://explorer.testnet.near.org/transactions/${evidence.near_tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="st-btn"
                      style={{ padding: '8px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                    >
                      <ExternalLink size={14} />
                      Explorer
                    </a>
                  </div>
                </div>

                <div style={{ padding: '12px', border: '1px solid rgb(52, 52, 52)', background: 'rgba(0, 168, 255, 0.02)' }}>
                  <p className="text-gray" style={{ fontSize: '10px', lineHeight: '16px' }}>
                    Evidence commitment registered on NEAR Protocol blockchain at contract: zkfied-evidence.reg.mrhashfox.testnet
                  </p>
                </div>
              </div>
            </div>
          )}

          {evidence.ipfs_cid && (
            <div className="st-card" style={{ marginBottom: '24px' }}>
              <div className="st-card-inner">
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                  <Database size={20} style={{ marginRight: '12px', color: '#00a8ff' }} />
                  <h3 style={{ fontSize: '14px', margin: 0 }}>IPFS Storage</h3>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Content ID</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <code style={{ fontSize: '11px', padding: '8px 12px', background: 'rgba(0, 168, 255, 0.05)', border: '1px solid rgba(0, 168, 255, 0.2)', borderRadius: '4px', flex: 1, wordBreak: 'break-all' }}>
                      {evidence.ipfs_cid}
                    </code>
                    <a
                      href={`https://ipfs.io/ipfs/${evidence.ipfs_cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="st-btn"
                      style={{ padding: '8px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                    >
                      <ExternalLink size={14} />
                      View
                    </a>
                  </div>
                </div>

                {metadata && (
                  <div style={{ marginTop: '16px', padding: '16px', border: '1px solid rgb(52, 52, 52)', background: 'rgb(10, 10, 10)' }}>
                    <h4 style={{ fontSize: '12px', marginBottom: '12px', color: 'white' }}>Metadata</h4>
                    <div style={{ fontSize: '11px', color: 'rgb(180, 180, 180)', marginBottom: '8px' }}>
                      <strong>Title:</strong> {metadata.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgb(180, 180, 180)', marginBottom: '12px' }}>
                      <strong>Description:</strong> {metadata.description}
                    </div>
                    {metadata.files && metadata.files.length > 0 && (
                      <div>
                        <p style={{ fontSize: '10px', color: 'rgb(140, 140, 140)', marginBottom: '8px' }}>Files ({metadata.files.length}):</p>
                        {metadata.files.map((file, idx) => (
                          <div key={idx} style={{ fontSize: '10px', color: 'rgb(160, 160, 160)', marginBottom: '4px', paddingLeft: '12px' }}>
                            {file.filename} ({(file.size / 1024).toFixed(1)} KB)
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {frostSession && (
            <div className="st-card" style={{ marginBottom: '24px' }}>
              <div className="st-card-inner">
                <h3 className="mb-md" style={{ fontSize: '14px' }}>FROST Signature Session</h3>

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px' }}>Threshold</p>
                    <p className="text-white" style={{ fontSize: '12px' }}>{frostSession.threshold} of {frostSession.max_signers}</p>
                  </div>
                  <div>
                    <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px' }}>Current Round</p>
                    <p className="text-white" style={{ fontSize: '12px' }}>Round {frostSession.current_round}</p>
                  </div>
                  <div>
                    <p className="text-gray" style={{ fontSize: '10px', marginBottom: '8px' }}>Status</p>
                    <p className="text-white" style={{ fontSize: '12px', textTransform: 'capitalize' }}>{frostSession.status}</p>
                  </div>
                </div>

                <div>
                  <p className="text-gray" style={{ fontSize: '10px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Participants</p>
                  {frostSession.participants.map((participant) => (
                    <div key={participant.participant_id} style={{ padding: '12px', border: '1px solid rgb(52, 52, 52)', marginBottom: '8px', background: 'rgb(10, 10, 10)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'white' }}>Participant {participant.participant_id}</span>
                        <span style={{ fontSize: '10px', color: participant.status === 'round2_complete' ? '#00ff88' : '#ffa500', textTransform: 'uppercase' }}>
                          {participant.status}
                        </span>
                      </div>
                      <code style={{ fontSize: '10px', color: 'rgb(160, 160, 160)', wordBreak: 'break-all' }}>
                        {participant.public_key}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ padding: '16px', border: '1px solid rgb(52, 52, 52)', background: 'rgba(0, 255, 136, 0.02)' }}>
            <p className="text-gray" style={{ fontSize: '10px', lineHeight: '18px' }}>
              This evidence is cryptographically secured using FROST threshold signatures (3-of-5 board members), Zcash shielded transactions, and IPFS content-addressed storage. All metadata is encrypted and only accessible to authorized viewing key holders.
            </p>
          </div>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <Link to="/" className="st-btn" style={{ padding: '12px 32px', fontSize: '12px' }}>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EvidenceDetailPage
