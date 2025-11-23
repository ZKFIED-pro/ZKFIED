import React, { useState, useEffect } from 'react'
import { Shield, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react'
import Button from './Button'
import { useWallet } from '@/hooks/useWallet'

interface WebZjsWalletProps {
  onConnect?: (connected: boolean) => void
}

const WebZjsWallet: React.FC<WebZjsWalletProps> = ({ onConnect }) => {
  const { connect, webzjs } = useWallet()
  const [connecting, setConnecting] = useState(false)
  const [seedFingerprint, setSeedFingerprint] = useState<string | null>(null)

  useEffect(() => {
    if (webzjs.isConnected) {
      // Get seed fingerprint for display
      webzjs.getSeedFingerprint()
        .then(setSeedFingerprint)
        .catch(console.error)
    }
  }, [webzjs.isConnected])

  const handleConnect = async () => {
    try {
      setConnecting(true)
      await connect('webzjs')
      onConnect?.(true)
    } catch (error) {
      console.error('WebZjs connection failed:', error)
      onConnect?.(false)
    } finally {
      setConnecting(false)
    }
  }

  const handleInstallSnap = () => {
    window.open('https://webzjs.chainsafe.dev', '_blank')
  }

  if (!webzjs.isInstalled && !webzjs.isConnected) {
    return (
      <div className="st-card">
        <div className="st-card-inner">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <Shield size={20} style={{ marginRight: '12px', color: '#ffa500' }} />
            <h3 style={{ fontSize: '14px', margin: 0 }}>WebZjs Snap Required</h3>
          </div>
          
          <p className="text-gray" style={{ fontSize: '12px', marginBottom: '16px', lineHeight: '18px' }}>
            Install the WebZjs MetaMask Snap to access Zcash privacy features directly in your browser.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '12px', marginBottom: '8px', color: 'white' }}>Features:</h4>
            <ul className="text-gray" style={{ fontSize: '11px', lineHeight: '16px', paddingLeft: '16px', margin: 0 }}>
              <li>Shielded Zcash transactions</li>
              <li>Zero-knowledge proofs</li>
              <li>Private memo fields</li>
              <li>Viewing key management</li>
            </ul>
          </div>

          <Button
            onClick={handleInstallSnap}
            style={{ width: '100%', fontSize: '12px', padding: '12px' }}
          >
            Install WebZjs Snap
            <ExternalLink size={14} style={{ marginLeft: '8px' }} />
          </Button>

          <div style={{ marginTop: '12px', padding: '12px', border: '1px solid rgb(100, 100, 100)', background: 'rgba(255, 165, 0, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <AlertTriangle size={14} style={{ marginRight: '8px', color: '#ffa500' }} />
              <span style={{ fontSize: '11px', color: '#ffa500' }}>Development Notice</span>
            </div>
            <p style={{ fontSize: '10px', color: 'rgb(180, 180, 180)', margin: 0, lineHeight: '14px' }}>
              WebZjs is under active development and has not been audited. Use only for testing purposes.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (webzjs.error) {
    return (
      <div className="st-card">
        <div className="st-card-inner">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <AlertTriangle size={20} style={{ marginRight: '12px', color: '#ff4444' }} />
            <h3 style={{ fontSize: '14px', margin: 0 }}>Connection Error</h3>
          </div>
          
          <p className="text-gray" style={{ fontSize: '12px', marginBottom: '16px' }}>
            {webzjs.error}
          </p>

          <Button
            onClick={handleConnect}
            disabled={connecting}
            style={{ width: '100%', fontSize: '12px', padding: '12px' }}
          >
            {connecting ? 'Retrying...' : 'Retry Connection'}
          </Button>
        </div>
      </div>
    )
  }

  if (webzjs.isConnected) {
    return (
      <div className="st-card">
        <div className="st-card-inner">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <CheckCircle size={20} style={{ marginRight: '12px', color: '#00ff88' }} />
            <h3 style={{ fontSize: '14px', margin: 0 }}>WebZjs Connected</h3>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: 'rgb(160, 160, 160)' }}>Status:</span>
              <span style={{ fontSize: '11px', color: '#00ff88' }}>Connected</span>
            </div>
            
            {seedFingerprint && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: 'rgb(160, 160, 160)' }}>Seed Fingerprint:</span>
                <span style={{ fontSize: '11px', color: 'white', fontFamily: 'monospace' }}>
                  {seedFingerprint.substring(0, 8)}...
                </span>
              </div>
            )}
          </div>

          <div style={{ padding: '12px', border: '1px solid rgb(52, 52, 52)', background: 'rgba(0, 255, 136, 0.05)' }}>
            <p style={{ fontSize: '10px', color: 'rgb(160, 160, 160)', margin: 0, lineHeight: '14px' }}>
              Your Zcash wallet is ready for private transactions. You can now submit shielded evidence to the ZKFIED network.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="st-card">
      <div className="st-card-inner">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <Shield size={20} style={{ marginRight: '12px', color: '#00ff88' }} />
          <h3 style={{ fontSize: '14px', margin: 0 }}>Connect WebZjs Wallet</h3>
        </div>
        
        <p className="text-gray" style={{ fontSize: '12px', marginBottom: '16px', lineHeight: '18px' }}>
          Connect your WebZjs Snap to access Zcash privacy features for secure evidence submission.
        </p>

        <Button
          onClick={handleConnect}
          disabled={connecting}
          style={{ width: '100%', fontSize: '12px', padding: '12px' }}
        >
          {connecting ? 'Connecting...' : 'Connect WebZjs Snap'}
        </Button>
      </div>
    </div>
  )
}

export default WebZjsWallet