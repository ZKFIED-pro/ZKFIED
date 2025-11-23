import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type AttestationGrant } from '@/services/api'
import { AttestationFlow } from '../attestation/AttestationFlow'
import WebZjsWallet from '../shared/WebZjsWallet'
import { useWallet } from '@/hooks/useWallet'

const SubmitEvidencePage: React.FC = () => {
  const navigate = useNavigate()
  const { webzjs } = useWallet()
  const [attestation, setAttestation] = useState<AttestationGrant | undefined>(undefined)
  const [boardCategory, setBoardCategory] = useState<'healthcare' | 'government' | 'corporate' | 'civil_society' | 'media'>('healthcare')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)

    if (!title.trim() || !description.trim()) {
      setError('Title and description are required')
      return
    }

    if (!attestation) {
      setError('Email attestation is required')
      return
    }

    if (!webzjs.isConnected) {
      setError('WebZjs wallet connection is required for secure evidence submission')
      return
    }

    try {
      setSubmitting(true)
      const response = await api.submitEvidence({
        title,
        description,
        board_category: boardCategory,
        files,
        attestation,
      })

      navigate(`/evidence/${response.evidence_id}`)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to submit evidence')
    } finally {
      setSubmitting(false)
    }
  }

  const boardCategories = [
    { id: 'healthcare', name: 'Healthcare' },
    { id: 'government', name: 'Government' },
    { id: 'corporate', name: 'Corporate' },
    { id: 'civil_society', name: 'Civil Society' },
    { id: 'media', name: 'Media' },
  ] as const

  return (
    <div className="fade-in">
      <section style={{ padding: '60px 0 40px', borderBottom: '1px solid rgb(52, 52, 52)' }}>
        <div className="container">
          <h1 className="mb-sm">Submit Evidence</h1>
          <p className="text-gray">
            Cryptographically protected whistleblower evidence submission
          </p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <WebZjsWallet />
          
          <AttestationFlow
            onAttestationComplete={setAttestation}
            boardCategory={boardCategory}
          />

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

            <button
              type="submit"
              disabled={submitting || !attestation || !webzjs.isConnected}
              className="st-btn"
              style={{ width: '100%', fontSize: '12px', padding: '16px' }}
            >
              {submitting ? 'Submitting Evidence...' : 'Submit Evidence'}
            </button>
            
            {(!attestation || !webzjs.isConnected) && (
              <p className="text-gray" style={{ fontSize: '10px', textAlign: 'center', marginTop: '8px' }}>
                {!webzjs.isConnected && 'Connect WebZjs wallet and '}
                {!attestation && 'complete email attestation to enable submission'}
              </p>
            )}

            <div style={{ marginTop: '24px', padding: '16px', border: '1px solid rgb(52, 52, 52)' }}>
              <h4 className="text-white mb-sm" style={{ fontSize: '12px' }}>Privacy Guarantees</h4>
              <ul className="text-gray" style={{ fontSize: '10px', lineHeight: '18px', paddingLeft: '20px' }}>
                <li>Evidence encrypted in Zcash shielded pool</li>
                <li>FROST threshold signatures (3-of-5 board members)</li>
                <li>IPFS content-addressed storage</li>
                <li>Zero-knowledge payment disclosure proofs</li>
                <li>Email domain-based attestation (no email stored)</li>
              </ul>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SubmitEvidencePage
