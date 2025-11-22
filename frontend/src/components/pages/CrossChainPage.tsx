import React, { useState, useEffect } from 'react'
import { 
  ArrowRight, 
  Shield, 
  Zap, 
  ExternalLink, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Loader
} from 'lucide-react'
import Button from '@/components/shared/Button'
import Card from '@/components/shared/Card'
import { useCrossChain } from '@/hooks/useCrossChain'
import { useWallet } from '@/hooks/useWallet'
import { BridgeStatus } from '@/types'

const CrossChainPage: React.FC = () => {
  const { 
    bridgeStatus, 
    isLoading, 
    bridgeEvidence, 
    verifyOnNear, 
    verifyOnZcash,
    getBridgeHistory,
    estimateBridgeFee
  } = useCrossChain()
  
  const { isConnected, address, balance } = useWallet()
  
  const [selectedEvidence, setSelectedEvidence] = useState<string>('')
  const [targetChain, setTargetChain] = useState<'zcash' | 'near'>('near')
  const [bridgeHistory, setBridgeHistory] = useState<BridgeStatus[]>([])
  const [bridgeFee, setBridgeFee] = useState<{
    zcashFee: string
    nearFee: string
    totalUsd: string
  } | null>(null)

  useEffect(() => {
    if (isConnected) {
      loadBridgeHistory()
    }
  }, [isConnected])

  useEffect(() => {
    if (selectedEvidence) {
      loadBridgeFee()
    }
  }, [selectedEvidence, targetChain])

  const loadBridgeHistory = async () => {
    try {
      const history = await getBridgeHistory()
      setBridgeHistory(history)
    } catch (error) {
      console.error('Failed to load bridge history:', error)
    }
  }

  const loadBridgeFee = async () => {
    try {
      const sourceChain = targetChain === 'near' ? 'zcash' : 'near'
      const fee = await estimateBridgeFee(sourceChain, targetChain, 1024 * 1024) // 1MB estimated
      setBridgeFee(fee)
    } catch (error) {
      console.error('Failed to estimate bridge fee:', error)
    }
  }

  const handleBridge = async () => {
    if (!selectedEvidence) {
      alert('Please select evidence to bridge')
      return
    }

    try {
      await bridgeEvidence(selectedEvidence, targetChain)
      alert('Bridge transaction initiated successfully!')
      loadBridgeHistory()
    } catch (error) {
      alert('Bridge failed. Please try again.')
    }
  }

  const handleVerification = async (chain: 'zcash' | 'near') => {
    if (!selectedEvidence) {
      alert('Please enter an evidence ID to verify')
      return
    }

    try {
      const isValid = chain === 'near' 
        ? await verifyOnNear(selectedEvidence)
        : await verifyOnZcash(selectedEvidence)
      
      alert(`Verification ${isValid ? 'successful' : 'failed'}`)
    } catch (error) {
      alert('Verification failed. Please try again.')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-terminal-white" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-terminal-white" />
      case 'pending':
      case 'processing':
        return <Loader className="w-4 h-4 text-terminal-active animate-spin" />
      default:
        return <Clock className="w-4 h-4 text-terminal-secondary" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-terminal-white'
      case 'failed':
        return 'text-terminal-white'
      case 'pending':
      case 'processing':
        return 'text-terminal-active'
      default:
        return 'text-terminal-secondary'
    }
  }

  const mockEvidenceOptions = [
    { id: 'ev-001', title: 'Government Database Breach Evidence' },
    { id: 'ev-002', title: 'Corporate Whistleblower Retaliation' },
    { id: 'ev-003', title: 'Media Suppression Campaign Documents' }
  ]

  return (
    <div className="py-8 md:py-12 animate-fade-in">
      <div className="container">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-display text-terminal-white font-mono font-mono mb-4">
              [CROSS_CHAIN_BRIDGE]
            </h1>
            <p className="text-terminal-secondary max-w-3xl font-mono">
              &gt; BRIDGE_EVIDENCE_BETWEEN_ZCASH_AND_NEAR_NETWORKS<br/>
              &gt; FOR_MAXIMUM_RESILIENCE_AND_ACCESSIBILITY<br/>
              &gt; ALL_OPERATIONS_MAINTAIN_CRYPTOGRAPHIC_PRIVACY_GUARANTEES
            </p>
          </div>

          {/* Bridge Visualization */}
          <Card className="mb-8">
            <div className="text-center">
              <h2 className="text-section text-terminal-white font-mono font-section mb-8">
                Network Bridge Status
              </h2>
              
              <div className="flex items-center justify-center gap-8 md:gap-16 mb-8">
                {/* Zcash Side */}
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-terminal-hover border-2 border-terminal-dark flex items-center justify-center hover:border-terminal-active transition-colors">
                    <Shield className="w-10 h-10 text-terminal-white" />
                  </div>
                  <h3 className="text-card-title text-terminal-white font-mono font-card mb-2">
                    Zcash
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="text-terminal-secondary">
                      {isConnected && address ? (
                        <span className="font-mono">{address.slice(0, 8)}...</span>
                      ) : (
                        'Not connected'
                      )}
                    </div>
                    <div className="text-terminal-active">
                      {balance.zcash.shielded} ZEC Shielded
                    </div>
                    <div className="text-terminal-secondary">
                      {balance.zcash.zsaTokens.length} ZSA Tokens
                    </div>
                  </div>
                </div>

                {/* Bridge Animation */}
                <div className="flex items-center">
                  <div className="w-16 h-0.5 bg-gradient-to-r from-border to-text-accent relative">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className={`w-2 h-2 rounded-full bg-text-accent ${
                        bridgeStatus?.status === 'pending' || bridgeStatus?.status === 'processing'
                          ? 'animate-pulse' 
                          : ''
                      }`} />
                    </div>
                  </div>
                  <ArrowRight className="w-6 h-6 mx-2 text-terminal-active" />
                  <div className="w-16 h-0.5 bg-gradient-to-r from-text-accent to-border" />
                </div>

                {/* NEAR Side */}
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-terminal-hover border-2 border-terminal-dark flex items-center justify-center hover:border-terminal-active transition-colors">
                    <Zap className="w-10 h-10 text-terminal-white" />
                  </div>
                  <h3 className="text-card-title text-terminal-white font-mono font-card mb-2">
                    NEAR
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="text-terminal-secondary">
                      {isConnected && address ? (
                        <span className="font-mono">alice.near</span>
                      ) : (
                        'Not connected'
                      )}
                    </div>
                    <div className="text-terminal-active">
                      {balance.near.native} NEAR
                    </div>
                    <div className="text-terminal-secondary">
                      {balance.near.contracts.length} Contracts
                    </div>
                  </div>
                </div>
              </div>

              {/* Bridge Status */}
              {bridgeStatus && (
                <div className="bg-terminal-hover border border-terminal-dark rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    {getStatusIcon(bridgeStatus.status)}
                    <span className={`font-medium ${getStatusColor(bridgeStatus.status)}`}>
                      Bridge {bridgeStatus.status}
                    </span>
                  </div>
                  <div className="text-sm text-terminal-secondary">
                    {bridgeStatus.sourceTxHash && (
                      <div className="font-mono mb-1">
                        Source: {bridgeStatus.sourceTxHash.slice(0, 16)}...
                      </div>
                    )}
                    {bridgeStatus.targetTxHash && (
                      <div className="font-mono">
                        Target: {bridgeStatus.targetTxHash.slice(0, 16)}...
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="text-sm text-terminal-white bg-terminal border border-terminal-dark rounded-lg p-3">
                Bridge Active • Last sync: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Bridge Controls */}
            <Card>
              <h2 className="text-section text-terminal-white font-mono font-section mb-6">
                Bridge Evidence
              </h2>
              
              <div className="space-y-6">
                {/* Evidence Selection */}
                <div>
                  <label className="block text-sm font-medium text-terminal-white mb-2">
                    Select Evidence
                  </label>
                  <select
                    className="input w-full"
                    value={selectedEvidence}
                    onChange={(e) => setSelectedEvidence(e.target.value)}
                  >
                    <option value="">Choose evidence to bridge</option>
                    {mockEvidenceOptions.map((evidence) => (
                      <option key={evidence.id} value={evidence.id}>
                        {evidence.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Chain */}
                <div>
                  <label className="block text-sm font-medium text-terminal-white mb-3">
                    Target Chain
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className={`p-3 rounded border transition-colors ${
                        targetChain === 'near'
                          ? 'border-terminal-active bg-terminal-hover text-terminal-white'
                          : 'border-terminal-dark bg-terminal text-terminal-secondary hover:border-terminal-active'
                      }`}
                      onClick={() => setTargetChain('near')}
                    >
                      <Zap className="w-5 h-5 mx-auto mb-2" />
                      <div className="text-sm">NEAR</div>
                    </button>
                    <button
                      type="button"
                      className={`p-3 rounded border transition-colors ${
                        targetChain === 'zcash'
                          ? 'border-terminal-active bg-terminal-hover text-terminal-white'
                          : 'border-terminal-dark bg-terminal text-terminal-secondary hover:border-terminal-active'
                      }`}
                      onClick={() => setTargetChain('zcash')}
                    >
                      <Shield className="w-5 h-5 mx-auto mb-2" />
                      <div className="text-sm">Zcash</div>
                    </button>
                  </div>
                </div>

                {/* Bridge Fee */}
                {bridgeFee && selectedEvidence && (
                  <div className="bg-terminal border border-terminal-dark rounded-lg p-4">
                    <div className="text-sm font-medium text-terminal-white mb-2">
                      Estimated Bridge Fee
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-terminal-secondary">Zcash Fee:</span>
                        <span className="font-mono text-terminal-active">{bridgeFee.zcashFee} ZEC</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-terminal-secondary">NEAR Fee:</span>
                        <span className="font-mono text-terminal-active">{bridgeFee.nearFee} NEAR</span>
                      </div>
                      <div className="flex justify-between border-t border-terminal-dark pt-1">
                        <span className="text-terminal-white font-medium">Total USD:</span>
                        <span className="font-mono text-terminal-white">${bridgeFee.totalUsd}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bridge Button */}
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleBridge}
                  loading={isLoading}
                  disabled={!isConnected || !selectedEvidence}
                >
                  {isLoading ? 'Initiating Bridge...' : `Bridge to ${targetChain.toUpperCase()}`}
                </Button>

                {!isConnected && (
                  <p className="text-terminal-secondary text-sm text-center">
                    Please connect your wallet to use the bridge
                  </p>
                )}

                {/* Verification */}
                <div className="pt-4 border-t border-terminal-dark">
                  <div className="text-sm font-medium text-terminal-white mb-3">
                    Verify Evidence
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleVerification('zcash')}
                      disabled={!selectedEvidence}
                    >
                      Verify on Zcash
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleVerification('near')}
                      disabled={!selectedEvidence}
                    >
                      Verify on NEAR
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Bridge History */}
            <Card>
              <h2 className="text-section text-terminal-white font-mono font-section mb-6">
                Recent Bridge Transactions
              </h2>
              
              {bridgeHistory.length > 0 ? (
                <div className="space-y-4">
                  {bridgeHistory.map((transaction, index) => (
                    <div
                      key={index}
                      className="bg-terminal-hover border border-terminal-dark rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(transaction.status)}
                          <span className={`text-sm font-medium ${getStatusColor(transaction.status)}`}>
                            {transaction.status}
                          </span>
                        </div>
                        <span className="text-xs text-terminal-secondary">
                          {new Date(transaction.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1">
                          {transaction.sourceChain === 'zcash' ? (
                            <Shield className="w-4 h-4 text-terminal-active" />
                          ) : (
                            <Zap className="w-4 h-4 text-terminal-active" />
                          )}
                          <span className="text-terminal-secondary uppercase">
                            {transaction.sourceChain}
                          </span>
                        </div>
                        
                        <ArrowRight className="w-4 h-4 text-terminal-active" />
                        
                        <div className="flex items-center gap-1">
                          {transaction.targetChain === 'zcash' ? (
                            <Shield className="w-4 h-4 text-terminal-active" />
                          ) : (
                            <Zap className="w-4 h-4 text-terminal-active" />
                          )}
                          <span className="text-terminal-secondary uppercase">
                            {transaction.targetChain}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-3 space-y-1">
                        <div className="text-xs">
                          <span className="text-terminal-secondary">Source TX: </span>
                          <span className="font-mono text-terminal-active">
                            {transaction.sourceTxHash.slice(0, 16)}...
                          </span>
                          <button className="ml-2 text-terminal-active hover:text-terminal-white">
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                        {transaction.targetTxHash && (
                          <div className="text-xs">
                            <span className="text-terminal-secondary">Target TX: </span>
                            <span className="font-mono text-terminal-active">
                              {transaction.targetTxHash.slice(0, 16)}...
                            </span>
                            <button className="ml-2 text-terminal-active hover:text-terminal-white">
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-terminal-secondary">
                  <Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>No bridge transactions yet</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrossChainPage