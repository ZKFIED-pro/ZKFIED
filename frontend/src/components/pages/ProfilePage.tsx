import React, { useState, useEffect } from 'react'
import { 
  User, 
  Shield, 
  Clock, 
  Eye, 
  Settings, 
  LogOut,
  ExternalLink,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react'
import Button from '@/components/shared/Button'
import Card from '@/components/shared/Card'
import { useWallet } from '@/hooks/useWallet'
import { useEvidenceStore } from '@/stores/evidenceStore'
import { Evidence } from '@/types'

const ProfilePage: React.FC = () => {
  const { isConnected, address, balance, disconnect } = useWallet()
  const { evidenceList } = useEvidenceStore()
  
  const [userEvidence, setUserEvidence] = useState<Evidence[]>([])
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'verified' | 'published'>('all')
  const [showSettings, setShowSettings] = useState(false)

  // Mock user data since we don't have real authentication
  const mockUserData = {
    memberSince: '2024-01-15',
    totalSubmissions: 3,
    verifiedSubmissions: 2,
    crossChainVerifications: 5,
    anonymityLevel: 'Maximum',
    lastActivity: new Date().toISOString()
  }

  useEffect(() => {
    if (isConnected) {
      // In a real app, filter evidence by user wallet address
      // For now, use mock data
      setUserEvidence(evidenceList.slice(0, 3))
    }
  }, [isConnected, evidenceList])

  const getFilteredEvidence = () => {
    if (selectedFilter === 'all') return userEvidence
    return userEvidence.filter(evidence => evidence.status === selectedFilter)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
      case 'published':
        return <CheckCircle className="w-4 h-4 text-terminal-white" />
      case 'submitted':
        return <Clock className="w-4 h-4 text-terminal-active" />
      case 'pending_verification':
        return <Loader className="w-4 h-4 text-terminal-active animate-spin" />
      case 'rejected':
        return <AlertCircle className="w-4 h-4 text-terminal-white" />
      default:
        return <Clock className="w-4 h-4 text-terminal-secondary" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
      case 'published':
        return 'text-terminal-white bg-terminal-hover'
      case 'submitted':
        return 'text-terminal-active bg-terminal'
      case 'pending_verification':
        return 'text-terminal-active bg-terminal'
      case 'rejected':
        return 'text-terminal-white bg-terminal'
      default:
        return 'text-terminal-secondary bg-terminal'
    }
  }

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      // In a real app, show a toast notification
      alert('Address copied to clipboard')
    }
  }

  const formatCategory = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatPrivacyLevel = (level: string) => {
    return level.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  if (!isConnected) {
    return (
      <div className="py-24 animate-fade-in">
        <div className="container">
          <div className="max-w-md mx-auto text-center">
            <User className="w-16 h-16 text-terminal-active mx-auto mb-6 opacity-50" />
            <h1 className="text-display text-terminal-white font-mono font-mono mb-4">
              [PROFILE]
            </h1>
            <p className="text-terminal-secondary mb-8 font-mono">
              &gt; CONNECT_YOUR_WALLET_TO_VIEW_WHISTLEBLOWER_PROFILE<br/>
              &gt; AND_SUBMISSION_HISTORY
            </p>
            <Button variant="primary" size="lg">
              Connect Wallet
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-8 md:py-12 animate-fade-in">
      <div className="container">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-display text-terminal-white font-mono font-mono mb-4">
              [WHISTLEBLOWER_PROFILE]
            </h1>
            <p className="text-terminal-secondary font-mono">
              &gt; YOUR_ANONYMOUS_IDENTITY_AND_SUBMISSION_HISTORY<br/>
              &gt; ALL_DATA_IS_STORED_LOCALLY_AND_CRYPTOGRAPHICALLY_PROTECTED
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Info */}
            <div className="lg:col-span-1">
              <Card>
                <div className="text-center">
                  {/* Anonymity Indicator */}
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-terminal-hover border-2 border-terminal-active flex items-center justify-center">
                    <Shield className="w-10 h-10 text-terminal-white" />
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-terminal-white font-medium text-lg mb-1">
                      Anonymous Whistleblower
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-terminal-hover rounded-full">
                      <Eye className="w-4 h-4 text-terminal-active" />
                      <span className="text-terminal-active text-sm font-medium">
                        {mockUserData.anonymityLevel}
                      </span>
                    </div>
                  </div>

                  {/* Wallet Address */}
                  <div className="mb-6">
                    <div className="text-terminal-secondary text-sm mb-2">Wallet Address</div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-code text-terminal-white font-mono">
                        {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : 'Loading...'}
                      </span>
                      <button
                        onClick={copyAddress}
                        className="p-1 text-terminal-secondary hover:text-terminal-white transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Account Stats */}
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-terminal-secondary">Member since:</span>
                      <span className="text-terminal-white">
                        {new Date(mockUserData.memberSince).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-terminal-secondary">Evidence submitted:</span>
                      <span className="text-terminal-white font-medium">
                        {mockUserData.totalSubmissions}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-terminal-secondary">Verified evidence:</span>
                      <span className="text-terminal-white font-medium">
                        {mockUserData.verifiedSubmissions}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-terminal-secondary">Cross-chain verifications:</span>
                      <span className="text-terminal-white font-medium">
                        {mockUserData.crossChainVerifications}
                      </span>
                    </div>
                  </div>

                  {/* Balance Info */}
                  <div className="bg-terminal border border-terminal-dark rounded-lg p-4 mb-6">
                    <div className="text-terminal-secondary text-sm mb-3">Wallet Balance</div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-terminal-secondary">ZEC Shielded:</span>
                        <span className="text-terminal-active font-mono">{balance.zcash.shielded}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-terminal-secondary">NEAR:</span>
                        <span className="text-terminal-active font-mono">{balance.near.native}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-terminal-secondary">ZSA Tokens:</span>
                        <span className="text-terminal-white font-medium">{balance.zcash.zsaTokens.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      onClick={() => setShowSettings(!showSettings)}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      fullWidth
                      onClick={disconnect}
                    >
                      <LogOut className="w-4 h-4" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Settings Panel */}
              {showSettings && (
                <Card className="mt-6">
                  <h3 className="text-card-title text-terminal-white font-mono font-card mb-4">
                    Privacy Settings
                  </h3>
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-terminal-secondary">Anonymity Mode:</span>
                      <span className="text-terminal-white">Maximum</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-terminal-secondary">Auto-encrypt:</span>
                      <span className="text-terminal-white">Enabled</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-terminal-secondary">Cross-chain sync:</span>
                      <span className="text-terminal-white">Enabled</span>
                    </div>
                    <div className="pt-4 border-t border-terminal-dark text-terminal-secondary">
                      All settings are stored locally and encrypted
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Evidence History */}
            <div className="lg:col-span-2">
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-section text-terminal-white font-mono font-section">
                    Evidence History
                  </h2>
                  <div className="text-terminal-secondary text-sm">
                    {userEvidence.length} submission{userEvidence.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-1 mb-6 bg-terminal border border-terminal-dark rounded-lg p-1">
                  {(['all', 'pending', 'verified', 'published'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setSelectedFilter(filter)}
                      className={`px-4 py-2 rounded text-sm font-medium transition-colors flex-1 ${
                        selectedFilter === filter
                          ? 'bg-terminal-hover text-terminal-white'
                          : 'text-terminal-secondary hover:text-terminal-white'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Evidence List */}
                {getFilteredEvidence().length > 0 ? (
                  <div className="space-y-4">
                    {getFilteredEvidence().map((evidence) => (
                      <div
                        key={evidence.id}
                        className="bg-terminal-hover border border-terminal-dark rounded-lg p-4 hover:border-terminal-active transition-colors group"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-card-title text-terminal-white font-mono font-card mb-1 group-hover:text-terminal-active transition-colors">
                              {evidence.title}
                            </h3>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-terminal-active">
                                {formatCategory(evidence.category)}
                              </span>
                              <span className="text-terminal-secondary">•</span>
                              <span className="text-terminal-secondary">
                                {formatPrivacyLevel(evidence.privacyLevel)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(evidence.status)}
                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(evidence.status)}`}>
                              {evidence.status}
                            </span>
                          </div>
                        </div>

                        <p className="text-terminal-secondary text-sm mb-4 line-clamp-2">
                          {evidence.description}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-xs text-terminal-secondary">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(evidence.submittedAt).toLocaleDateString()}</span>
                            </div>
                            <span className="uppercase">{evidence.chain}</span>
                            {evidence.zsaTokenId && (
                              <span className="font-mono">
                                {evidence.zsaTokenId.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button className="text-terminal-secondary hover:text-terminal-white transition-colors p-1">
                              <Copy className="w-4 h-4" />
                            </button>
                            <button className="text-terminal-secondary hover:text-terminal-white transition-colors p-1">
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Shield className="w-12 h-12 text-terminal-active mx-auto mb-4 opacity-50" />
                    <h3 className="text-card-title text-terminal-white font-mono font-card mb-2">
                      No Evidence Found
                    </h3>
                    <p className="text-terminal-secondary mb-6">
                      {selectedFilter === 'all' 
                        ? "You haven't submitted any evidence yet."
                        : `No ${selectedFilter} evidence found.`
                      }
                    </p>
                    {selectedFilter === 'all' && (
                      <Button variant="primary">
                        Submit Evidence
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage