import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import type { EvidenceIndex } from '@/services/api'

const HomePage: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean | null>(null)
  const [evidenceIndex, setEvidenceIndex] = useState<EvidenceIndex[]>([])
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    pending: 0,
    boards: 5
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await api.healthCheck()
        setIsOnline(true)
      } catch (error) {
        console.error('Backend offline:', error)
        setIsOnline(false)
      }
    }

    const loadEvidenceIndex = async () => {
      try {
        const index = await api.getAllEvidenceIndex()
        setEvidenceIndex(index)
        setStats({
          total: index.length,
          confirmed: index.filter(e => e.status === 'confirmed').length,
          pending: index.filter(e => e.status === 'pending').length,
          boards: 5
        })
      } catch (error) {
        console.error('Failed to load evidence index:', error)
      } finally {
        setLoading(false)
      }
    }

    checkHealth()
    loadEvidenceIndex()
  }, [])

  return (
    <div className="fade-in">
      <section className="section bg-black" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
        <div className="container">
          <div className="text-center" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '24px' }}>
              ZKFIED
            </h1>
            <p className="text-white" style={{ fontSize: '16px', marginBottom: '16px', fontWeight: 700 }}>
              Whistleblower Evidence Network
            </p>
            <p className="text-gray" style={{ fontSize: '12px', marginBottom: '48px', maxWidth: '700px', margin: '0 auto 48px' }}>
              Cryptographic guarantees for whistleblower anonymity through Zcash shielded transactions,
              FROST threshold signatures, and decentralized IPFS storage.
            </p>

            <div className="flex justify-center gap" style={{ flexWrap: 'wrap' }}>
              <Link to="/submit" className="st-btn">
                Submit Evidence
              </Link>
              <Link to="/browse" className="st-btn">
                Browse Database
              </Link>
            </div>

            <div className="flex justify-center gap" style={{ marginTop: '48px', fontSize: '12px' }}>
              <div className="flex items-center gap">
                <span className="text-gray">Status:</span>
                <span className={isOnline ? 'text-white' : 'text-gray'} style={{ fontWeight: 700 }}>
                  {isOnline === null ? 'Checking...' : isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center gap">
                <span className="text-gray">Protocol:</span>
                <span className="text-white">FROST 3-of-5</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '48px 0', borderTop: '1px solid rgb(52, 52, 52)', borderBottom: '1px solid rgb(52, 52, 52)' }}>
        <div className="container">
          <div className="grid grid-4">
            <div className="text-center">
              <div className="text-white" style={{ fontSize: '48px', fontWeight: 700, marginBottom: '8px' }}>
                {loading ? '—' : stats.total}
              </div>
              <div className="text-gray" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Total Submissions
              </div>
            </div>
            <div className="text-center">
              <div className="text-white" style={{ fontSize: '48px', fontWeight: 700, marginBottom: '8px' }}>
                {loading ? '—' : stats.confirmed}
              </div>
              <div className="text-gray" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Confirmed On-Chain
              </div>
            </div>
            <div className="text-center">
              <div className="text-white" style={{ fontSize: '48px', fontWeight: 700, marginBottom: '8px' }}>
                {loading ? '—' : stats.pending}
              </div>
              <div className="text-gray" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Pending Authorization
              </div>
            </div>
            <div className="text-center">
              <div className="text-white" style={{ fontSize: '48px', fontWeight: 700, marginBottom: '8px' }}>
                {stats.boards}
              </div>
              <div className="text-gray" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Board Categories
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="mb-lg">
            <h2 className="mb-sm">Board Categories</h2>
            <p className="text-gray">
              Each category requires FROST threshold signatures from authorized board members
            </p>
          </div>

          <div className="grid grid-3">
            {[
              {
                id: 'healthcare',
                name: 'Healthcare',
                desc: 'Medical malpractice, pharmaceutical fraud, clinical trial violations',
                count: evidenceIndex.filter(e => e.board_category === 'healthcare').length
              },
              {
                id: 'government',
                name: 'Government',
                desc: 'Public corruption, regulatory capture, institutional fraud',
                count: evidenceIndex.filter(e => e.board_category === 'government').length
              },
              {
                id: 'corporate',
                name: 'Corporate',
                desc: 'Financial fraud, labor violations, environmental damage',
                count: evidenceIndex.filter(e => e.board_category === 'corporate').length
              },
              {
                id: 'civil_society',
                name: 'Civil Society',
                desc: 'NGO mismanagement, charity fraud, advocacy group misconduct',
                count: evidenceIndex.filter(e => e.board_category === 'civil_society').length
              },
              {
                id: 'media',
                name: 'Media',
                desc: 'Journalistic misconduct, propaganda, censorship evidence',
                count: evidenceIndex.filter(e => e.board_category === 'media').length
              },
            ].map((board) => (
              <div key={board.id} className="st-card">
                <div className="st-card-inner">
                  <div className="flex justify-between items-start mb-md">
                    <h3>{board.name}</h3>
                    <span className="text-gray" style={{ fontSize: '32px', fontWeight: 700 }}>
                      {board.count.toString().padStart(2, '0')}
                    </span>
                  </div>

                  <p className="text-gray mb-md">
                    {board.desc}
                  </p>

                  <Link to={`/browse?board=${board.id}`} className="st-btn" style={{ width: '100%', textAlign: 'center' }}>
                    View Evidence
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ borderTop: '1px solid rgb(52, 52, 52)' }}>
        <div className="container">
          <div className="mb-lg">
            <h2 className="mb-sm">Cryptographic Architecture</h2>
            <p className="text-gray">
              Multi-layer privacy and authentication protocol
            </p>
          </div>

          <div className="grid grid-3">
            <div className="st-card">
              <div className="st-card-inner">
                <div className="text-gray mb-sm" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  frost-rerandomized
                </div>
                <h3 className="mb-md">FROST Threshold</h3>
                <p className="text-gray">
                  3-of-5 threshold signatures with re-randomization for unlinkable board authorization
                </p>
              </div>
            </div>

            <div className="st-card">
              <div className="st-card-inner">
                <div className="text-gray mb-sm" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  orchard + sapling
                </div>
                <h3 className="mb-md">Zcash Shielded</h3>
                <p className="text-gray">
                  Zero-knowledge proofs for complete transaction privacy using ZSA custom assets
                </p>
              </div>
            </div>

            <div className="st-card">
              <div className="st-card-inner">
                <div className="text-gray mb-sm" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  content-addressed
                </div>
                <h3 className="mb-md">IPFS Storage</h3>
                <p className="text-gray">
                  Decentralized storage with cryptographic content verification and pinning
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ borderTop: '1px solid rgb(52, 52, 52)', borderBottom: '1px solid rgb(52, 52, 52)' }}>
        <div className="container text-center">
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <h2 className="mb-md">Ready to Submit?</h2>
            <p className="text-gray mb-lg">
              Your identity remains cryptographically protected through the Zcash shielded pool.
              Evidence is authenticated by threshold board signatures.
            </p>

            <Link to="/submit" className="st-btn">
              Submit Evidence Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
