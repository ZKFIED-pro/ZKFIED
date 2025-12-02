import React, { useState } from 'react'
import { api, type OtpRequestResponse, type OtpVerifyResponse } from '@/services/api'

interface OtpAuthProps {
  onAuthenticated: (session: OtpVerifyResponse) => void
}

const OtpAuth: React.FC<OtpAuthProps> = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.requestOtp(email)
      setSessionId(response.session_id)
      setOtpSent(true)
    } catch (e: any) {
      setError(e?.message || 'Failed to send verification code')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.verifyOtp(sessionId, otpCode)
      onAuthenticated(response)
    } catch (e: any) {
      setError(e?.message || 'Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  if (!otpSent) {
    return (
      <div className="st-card" style={{ marginBottom: '24px' }}>
        <div className="st-card-inner">
          <h3 className="mb-md" style={{ fontSize: '14px' }}>Email Verification Required</h3>

          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0, 136, 255, 0.05)', border: '1px solid rgba(0, 136, 255, 0.2)' }}>
            <p className="text-gray" style={{ fontSize: '10px', lineHeight: '16px' }}>
              To submit evidence and track your submissions, verify your email address. Your email is only used for authentication and will not be stored or shared.
            </p>
          </div>

          <form onSubmit={handleRequestOtp}>
            {error && (
              <div style={{ padding: '12px', marginBottom: '16px', background: 'rgba(255, 0, 0, 0.05)', border: '1px solid rgba(255, 0, 0, 0.3)' }}>
                <p className="text-white" style={{ fontSize: '11px' }}>{error}</p>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label className="text-gray" style={{ fontSize: '10px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={loading}
                style={{ width: '100%' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="st-btn"
              style={{ width: '100%', fontSize: '11px', padding: '12px' }}
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="st-card" style={{ marginBottom: '24px' }}>
      <div className="st-card-inner">
        <h3 className="mb-md" style={{ fontSize: '14px' }}>Enter Verification Code</h3>

        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0, 255, 136, 0.05)', border: '1px solid rgba(0, 255, 136, 0.2)' }}>
          <p className="text-white" style={{ fontSize: '10px', marginBottom: '8px' }}>
            Verification code sent to: <strong>{email}</strong>
          </p>
          <p className="text-gray" style={{ fontSize: '10px', lineHeight: '16px' }}>
            Check your email and enter the 6-digit code below. The code expires in 10 minutes.
          </p>
        </div>

        <form onSubmit={handleVerifyOtp}>
          {error && (
            <div style={{ padding: '12px', marginBottom: '16px', background: 'rgba(255, 0, 0, 0.05)', border: '1px solid rgba(255, 0, 0, 0.3)' }}>
              <p className="text-white" style={{ fontSize: '11px' }}>{error}</p>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label className="text-gray" style={{ fontSize: '10px', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Verification Code
            </label>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              disabled={loading}
              style={{ width: '100%', fontSize: '18px', letterSpacing: '4px', textAlign: 'center', fontFamily: 'monospace' }}
              maxLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className="st-btn"
            style={{ width: '100%', fontSize: '11px', padding: '12px', marginBottom: '12px' }}
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>

          <button
            type="button"
            onClick={() => {
              setOtpSent(false)
              setOtpCode('')
              setError('')
            }}
            className="st-btn"
            style={{ width: '100%', fontSize: '11px', padding: '12px' }}
          >
            Use Different Email
          </button>
        </form>
      </div>
    </div>
  )
}

export default OtpAuth
