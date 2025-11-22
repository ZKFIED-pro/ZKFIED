import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/services/api'
import type { EvidenceIndex, EvidenceMetadata } from '@/services/api'

const BrowseEvidencePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [evidenceIndex, setEvidenceIndex] = useState<EvidenceIndex[]>([])
  const [filteredEvidence, setFilteredEvidence] = useState<EvidenceIndex[]>([])
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [selectedBoard, setSelectedBoard] = useState<string>(searchParams.get('board') || 'all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const boardCategories = [
    { id: 'all', name: 'All Boards' },
    { id: 'healthcare', name: 'Healthcare' },
    { id: 'government', name: 'Government' },
    { id: 'corporate', name: 'Corporate' },
    { id: 'civil_society', name: 'Civil Society' },
    { id: 'media', name: 'Media' },
  ]

  useEffect(() => {
    loadEvidenceIndex()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [evidenceIndex, selectedBoard, selectedStatus, searchQuery])

  const loadEvidenceIndex = async () => {
    try {
      setLoading(true)
      const data = await api.getAllEvidenceIndex()
      setEvidenceIndex(data)
    } catch (error) {
      console.error('Failed to load evidence index:', error)
      setEvidenceIndex([])
    } finally {
      setLoading(false)
    }
  }

  const loadEvidenceMetadata = async (ipfsCid: string) => {
    try {
      setLoadingMetadata(true)
      const metadata = await api.getEvidenceMetadata(ipfsCid)
      setSelectedEvidence(metadata)
    } catch (error) {
      console.error('Failed to load evidence metadata from IPFS:', error)
      setSelectedEvidence(null)
    } finally {
      setLoadingMetadata(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...evidenceIndex]

    if (selectedBoard !== 'all') {
      filtered = filtered.filter(e => e.board_category === selectedBoard)
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(e => e.status === selectedStatus)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(e =>
        e.evidence_id.toLowerCase().includes(query) ||
        e.ipfs_cid.toLowerCase().includes(query)
      )
    }

    setFilteredEvidence(filtered)
  }

  const handleBoardChange = (board: string) => {
    setSelectedBoard(board)
    if (board === 'all') {
      searchParams.delete('board')
    } else {
      searchParams.set('board', board)
    }
    setSearchParams(searchParams)
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'white'
      case 'pending': return 'rgb(160, 160, 160)'
      case 'signing': return 'rgb(160, 160, 160)'
      case 'broadcasting': return 'rgb(160, 160, 160)'
      case 'failed': return 'rgb(100, 100, 100)'
      default: return 'rgb(160, 160, 160)'
    }
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const formatTxId = (txid?: string): string => {
    if (!txid) return 'Pending'
    return `${txid.slice(0, 8)}...${txid.slice(-8)}`
  }

  return (
    <div className="fade-in">
      <section style={{ padding: '60px 0 40px', borderBottom: '1px solid rgb(52, 52, 52)' }}>
        <div className="container">
          <h1 className="mb-sm">Evidence Database</h1>
          <p className="text-gray">
            {loading ? 'Loading...' : `${filteredEvidence.length} records found`}
          </p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '40px' }}>
          <aside style={{ position: 'sticky', top: '24px', alignSelf: 'start' }}>
            <div className="mb-md">
              <h3 className="mb-sm">Search</h3>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search evidence..."
                style={{ width: '100%' }}
              />
            </div>

            <div className="mb-md">
              <h3 className="mb-sm">Category</h3>
              <div className="flex flex-col" style={{ gap: '10px' }}>
                {boardCategories.map(board => (
                  <button
                    key={board.id}
                    onClick={() => handleBoardChange(board.id)}
                    className="st-btn"
                    style={{
                      textAlign: 'left',
                      justifyContent: 'space-between',
                      display: 'flex',
                      alignItems: 'center',
                      borderColor: selectedBoard === board.id ? 'white' : 'rgb(52, 52, 52)',
                      color: selectedBoard === board.id ? 'white' : 'rgb(160, 160, 160)',
                      padding: '12px',
                      fontSize: '12px'
                    }}
                  >
                    <span>{board.name}</span>
                    <span style={{ fontSize: '10px', opacity: 0.6 }}>
                      {board.id === 'all'
                        ? evidenceIndex.length.toString().padStart(2, '0')
                        : evidenceIndex.filter(e => e.board_category === board.id).length.toString().padStart(2, '0')
                      }
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-sm">Status</h3>
              <div className="flex flex-col" style={{ gap: '10px' }}>
                {['all', 'confirmed', 'pending', 'signing', 'failed'].map(status => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className="st-btn"
                    style={{
                      textAlign: 'left',
                      borderColor: selectedStatus === status ? 'white' : 'rgb(52, 52, 52)',
                      color: selectedStatus === status ? 'white' : 'rgb(160, 160, 160)',
                      padding: '12px',
                      fontSize: '12px',
                      textTransform: 'capitalize'
                    }}
                  >
                    {status === 'all' ? 'All Status' : status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main>
            {loading ? (
              <div className="text-center" style={{ paddingTop: '80px' }}>
                <p className="text-gray">Loading evidence...</p>
              </div>
            ) : filteredEvidence.length === 0 ? (
              <div className="st-card">
                <div className="st-card-inner" style={{ padding: '80px 40px', textAlign: 'center' }}>
                  <h3 className="mb-md">No Evidence Found</h3>
                  <p className="text-gray">
                    Try adjusting your filters or search query
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-2">
                {filteredEvidence.map((item) => (
                  <div
                    key={item.evidence_id}
                    className="st-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => loadEvidenceMetadata(item.ipfs_cid)}
                  >
                    <div className="st-card-inner">
                      <div className="flex justify-between items-start mb-md" style={{ paddingBottom: '16px', borderBottom: '1px solid rgb(52, 52, 52)' }}>
                        <span className="text-gray" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          {item.board_category.replace('_', ' ')}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: getStatusColor(item.status),
                            textTransform: 'uppercase'
                          }}
                        >
                          {item.status}
                        </span>
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <div className="flex justify-between mb-sm" style={{ fontSize: '10px' }}>
                          <span className="text-gray">Evidence ID</span>
                          <span className="text-white">{item.evidence_id.slice(0, 12)}...</span>
                        </div>

                        {item.zcash_txid && (
                          <div className="flex justify-between mb-sm" style={{ fontSize: '10px' }}>
                            <span className="text-gray">Zcash TX</span>
                            <span className="text-white">{formatTxId(item.zcash_txid)}</span>
                          </div>
                        )}

                        <div className="flex justify-between mb-sm" style={{ fontSize: '10px' }}>
                          <span className="text-gray">IPFS CID</span>
                          <span className="text-white">{item.ipfs_cid.slice(0, 12)}...</span>
                        </div>

                        {item.confirmation_count > 0 && (
                          <div className="flex justify-between mb-sm" style={{ fontSize: '10px' }}>
                            <span className="text-gray">Confirmations</span>
                            <span className="text-white" style={{ fontWeight: 700 }}>{item.confirmation_count}</span>
                          </div>
                        )}

                        <div className="flex justify-between" style={{ fontSize: '10px' }}>
                          <span className="text-gray">Submitted</span>
                          <span className="text-white">{formatDate(item.created_at)}</span>
                        </div>
                      </div>

                      <button className="st-btn" style={{ width: '100%', pointerEvents: 'none' }}>
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {selectedEvidence && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '40px'
          }}
          onClick={() => setSelectedEvidence(null)}
        >
          <div
            className="st-card"
            style={{ maxWidth: '800px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="st-card-inner">
              <div className="flex justify-between items-start mb-md">
                <h2>{selectedEvidence.title}</h2>
                <button onClick={() => setSelectedEvidence(null)} className="st-btn">
                  Close
                </button>
              </div>

              <div className="mb-md">
                <span className="st-badge">{selectedEvidence.board_category.replace('_', ' ')}</span>
              </div>

              <p className="text-gray mb-md">{selectedEvidence.description}</p>

              {selectedEvidence.files && selectedEvidence.files.length > 0 && (
                <div className="mb-md">
                  <h3 className="mb-sm">Files</h3>
                  {selectedEvidence.files.map((file, idx) => (
                    <div key={idx} className="flex justify-between mb-sm" style={{ fontSize: '12px' }}>
                      <span className="text-white">{file.filename}</span>
                      <a href={`https://ipfs.io/ipfs/${file.cid}`} target="_blank" rel="noopener noreferrer" className="text-white">
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              )}

              <div className="mb-md">
                <h3 className="mb-sm">Metadata</h3>
                <div className="flex justify-between mb-sm" style={{ fontSize: '12px' }}>
                  <span className="text-gray">Evidence ID</span>
                  <span className="text-white">{selectedEvidence.evidence_id}</span>
                </div>
                <div className="flex justify-between mb-sm" style={{ fontSize: '12px' }}>
                  <span className="text-gray">Commitment Hash</span>
                  <span className="text-white">{selectedEvidence.commitment_hash.slice(0, 16)}...</span>
                </div>
                {selectedEvidence.zcash_txid && (
                  <div className="flex justify-between" style={{ fontSize: '12px' }}>
                    <span className="text-gray">Zcash Transaction</span>
                    <span className="text-white">{selectedEvidence.zcash_txid}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BrowseEvidencePage
