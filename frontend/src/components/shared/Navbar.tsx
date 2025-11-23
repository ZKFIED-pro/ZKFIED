import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useWallet } from '@/hooks/useWallet'
import { Shield, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react'

const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [showWalletDropdown, setShowWalletDropdown] = useState(false)
  const location = useLocation()
  const { connect, webzjs } = useWallet()
  const dropdownRef = useRef<HTMLDivElement>(null)

  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowWalletDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
  
  const navigation = [
    { name: 'Submit Evidence', href: '/submit' },
    { name: 'Browse', href: '/browse' },
    { name: 'Cross-chain', href: '/crosschain' },
  ]
  
  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  const handleConnectWallet = async () => {
    if (webzjs.isConnected) {
    
      setShowWalletDropdown(!showWalletDropdown)
      return
    }

    try {
      setIsConnecting(true)
      setShowWalletDropdown(false)
      
      if (typeof window.ethereum === 'undefined') {
        const installMetaMask = confirm('MetaMask is required to use WebZjs wallet. Would you like to install MetaMask now?')
        if (installMetaMask) {
          window.open('https://metamask.io/download/', '_blank')
        }
        return
      }

      await connect('webzjs')
    } catch (error: any) {
      console.error('Wallet connection failed:', error)
      
      let errorMessage = error.message || 'Failed to connect wallet'
      let shouldOpenInstallPage = false
      let shouldOpenMetaMaskPage = false
      
      if (error.message?.includes('MetaMask Snaps not supported') || error.message?.includes('install MetaMask Flask') || error.message?.includes('switch to MetaMask Flask') || error.message?.includes('newer version')) {
        errorMessage = 'MetaMask Flask Required:\n\n• Make sure MetaMask Flask is installed\n• Switch to MetaMask Flask in your browser\n• Refresh this page\n• Try connecting again\n\nDownload MetaMask Flask?'
        shouldOpenMetaMaskPage = true
      } else if (error.message?.includes('approve the connection')) {
        errorMessage = 'Please approve the MetaMask connection request to continue.'
      } else if (error.message?.includes('restart MetaMask Flask')) {
        errorMessage = 'MetaMask Flask internal error.\n\nPlease:\n1. Close MetaMask Flask\n2. Restart your browser\n3. Try again'
      } else if (error.message?.includes('not available') || error.message?.includes('install it manually') || error.message?.includes('not found')) {
        errorMessage = 'WebZjs snap not found in the registry.\n\nWould you like to install it from the official page?'
        shouldOpenInstallPage = true
      } else if (error.message?.includes('cancelled') || error.message?.includes('rejected')) {
        errorMessage = 'WebZjs snap installation was cancelled.\n\nPlease try again and approve the installation to continue.'
      } else if (error.message?.includes('MetaMask is not installed')) {
        errorMessage = 'MetaMask is not installed.\n\nWould you like to install MetaMask now?'
        shouldOpenMetaMaskPage = true
      }
      
      const userWantsToOpenPage = confirm(errorMessage)
      
      if (userWantsToOpenPage) {
        if (shouldOpenInstallPage) {
          window.open('https://webzjs.chainsafe.dev', '_blank')
        } else if (shouldOpenMetaMaskPage) {
          window.open('https://metamask.io/flask/', '_blank')
        }
      }
    } finally {
      setIsConnecting(false)
    }
  }


  const handleSignTransaction = async () => {
    try {
      const result = await webzjs.signPczt(
        'ztestsapling1whatever12345678901234567890123456789012345678901234567890',
        '100000', // 0.001 ZEC in zatoshis
        'Test transaction from ZKFIED frontend'
      )
      alert(`Transaction signed successfully!\n\nSignature: ${result.substring(0, 50)}...`)
    } catch (error: any) {
      alert(`Transaction signing failed: ${error.message}`)
    }
  }

  const handleGetViewingKey = async () => {
    try {
      const viewingKey = await webzjs.getViewingKey(window.location.origin)
      alert(`Viewing Key for ${window.location.origin}:\n\n${viewingKey.substring(0, 50)}...`)
    } catch (error: any) {
      alert(`Failed to get viewing key: ${error.message}`)
    }
  }

  const handleGetSeedFingerprint = async () => {
    try {
      const fingerprint = await webzjs.getSeedFingerprint()
      alert(`Wallet Seed Fingerprint:\n\n${fingerprint}`)
    } catch (error: any) {
      alert(`Failed to get seed fingerprint: ${error.message}`)
    }
  }

  const handleOpenExtension = () => {
    window.open('https://webzjs.chainsafe.dev', '_blank')
  }

  const getWalletStatus = () => {
    if (isConnecting) {
      return { 
        text: 'CONNECTING', 
        icon: null, 
        color: 'text-yellow-400',
        bgColor: 'border-yellow-400'
      }
    }
    if (webzjs.isConnected) {
      return { 
        text: 'CONNECTED', 
        icon: CheckCircle, 
        color: 'text-green-400',
        bgColor: 'border-green-400'
      }
    }
    if (webzjs.isInstalled) {
      return { 
        text: 'CONNECT', 
        icon: CheckCircle, 
        color: 'text-blue-400',
        bgColor: 'border-blue-400'
      }
    }
    if (webzjs.error) {
      return { 
        text: 'ERROR', 
        icon: AlertCircle, 
        color: 'text-red-400',
        bgColor: 'border-red-400'
      }
    }
    return { 
      text: 'CONNECT_WALLET', 
      icon: null, 
      color: 'text-terminal-primary',
      bgColor: 'border-terminal-primary'
    }
  }
  
  return (
    <nav className="terminal-nav sticky top-0 z-fixed">
      <div className="container max-w-full px-10">
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center font-mono font-bold text-lg text-terminal-white tracking-widest">
            [ZKFIED]
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  'text-sm font-mono font-medium transition-colors border-b-2 border-transparent py-1',
                  {
                    'text-terminal-white border-terminal-bright': isActive(item.href),
                    'text-terminal-muted hover:text-terminal-white hover:border-terminal-bright': !isActive(item.href)
                  }
                )}
              >
                [{item.name.toUpperCase()}]
              </Link>
            ))}
          </div>
          
          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4 relative">
            {webzjs.isConnected ? (
              <div className="relative" ref={dropdownRef}>
                <div className="flex flex-col items-end gap-1">
                  <button 
                    onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                    className={clsx(
                      'bracket-btn border-2 px-4 py-2 text-sm font-mono font-bold flex items-center gap-2',
                      getWalletStatus().color,
                      getWalletStatus().bgColor
                    )}
                  >
                    <CheckCircle size={16} />
                    {getWalletStatus().text}
                  </button>
                  <button 
                    onClick={handleOpenExtension}
                    className="text-xs text-terminal-muted hover:text-terminal-primary transition-colors font-mono flex items-center gap-1"
                  >
                    WebZjs Page <ExternalLink size={10} />
                  </button>
                </div>
                
                {showWalletDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-black border-2 border-terminal-bright rounded-md shadow-lg z-50">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Shield size={16} className="text-green-400" />
                        <span className="text-sm font-mono text-white">WebZjs Connected</span>
                      </div>
                      <div className="text-xs text-terminal-muted font-mono">
                        Zcash privacy features enabled
                      </div>
                      
                      {/* Transaction Signing Demo */}
                      <div className="border-t border-terminal-dark pt-3">
                        <div className="text-xs text-white font-mono mb-2">Quick Actions:</div>
                        <div className="space-y-2">
                          <button 
                            onClick={() => handleSignTransaction()}
                            className="w-full text-xs text-left px-2 py-1 border border-terminal-dark hover:border-terminal-primary transition-colors font-mono text-terminal-muted hover:text-white"
                          >
                            🔐 Sign Test Transaction
                          </button>
                          <button 
                            onClick={() => handleGetViewingKey()}
                            className="w-full text-xs text-left px-2 py-1 border border-terminal-dark hover:border-terminal-primary transition-colors font-mono text-terminal-muted hover:text-white"
                          >
                            👁️ Get Viewing Key
                          </button>
                          <button 
                            onClick={() => handleGetSeedFingerprint()}
                            className="w-full text-xs text-left px-2 py-1 border border-terminal-dark hover:border-terminal-primary transition-colors font-mono text-terminal-muted hover:text-white"
                          >
                            🔍 Show Seed Fingerprint
                          </button>
                        </div>
                      </div>
                      
                      <div className="border-t border-terminal-dark pt-3">
                        <button 
                          onClick={() => window.open('https://webzjs.chainsafe.dev', '_blank')}
                          className="text-xs text-terminal-primary hover:text-white transition-colors font-mono flex items-center gap-1"
                        >
                          Manage Wallet <ExternalLink size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className={clsx(
                  'bracket-btn border-2 px-4 py-2 text-sm font-mono font-bold flex items-center gap-2',
                  {
                    'opacity-50 cursor-not-allowed': isConnecting,
                  },
                  getWalletStatus().color,
                  getWalletStatus().bgColor
                )}
              >
                {isConnecting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full"></div>
                    {getWalletStatus().text}
                  </>
                ) : (
                  <>
                    {(() => {
                      const IconComponent = getWalletStatus().icon
                      return IconComponent ? <IconComponent size={16} /> : null
                    })()}
                    {getWalletStatus().text}
                  </>
                )}
              </button>
            )}
            
            <button className="text-terminal-muted hover:text-terminal-white transition-colors font-mono text-sm">
              [SETTINGS]
            </button>
          </div>
          
          {/* Mobile menu button */}
          <button
            className="md:hidden text-terminal-muted hover:text-terminal-white transition-colors font-mono text-sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? '[CLOSE]' : '[MENU]'}
          </button>
        </div>
        
        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-terminal-bright mt-4">
            <div className="py-4 space-y-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'block py-2 text-sm font-mono font-medium transition-colors',
                    {
                      'text-terminal-white': isActive(item.href),
                      'text-terminal-muted hover:text-terminal-white': !isActive(item.href)
                    }
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  &gt; [{item.name.toUpperCase()}]
                </Link>
              ))}
              <div className="pt-4 border-t border-terminal-dark space-y-3">
                {webzjs.isConnected ? (
                  <div className="p-3 border-2 border-green-400 rounded">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={16} className="text-green-400" />
                      <span className="text-sm font-mono text-white">WebZjs Connected</span>
                    </div>
                    <div className="text-xs text-terminal-muted font-mono mb-3">
                      Zcash privacy features enabled
                    </div>
                    <div className="space-y-2">
                      <button 
                        onClick={() => {
                          setIsMobileMenuOpen(false)
                          handleOpenExtension()
                        }}
                        className="text-xs text-terminal-primary hover:text-white transition-colors font-mono flex items-center gap-1"
                      >
                        WebZjs Page <ExternalLink size={12} />
                      </button>
                      <button 
                        onClick={() => {
                          setIsMobileMenuOpen(false)
                          window.open('https://webzjs.chainsafe.dev', '_blank')
                        }}
                        className="text-xs text-terminal-muted hover:text-white transition-colors font-mono flex items-center gap-1"
                      >
                        Manage Wallet <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      handleConnectWallet()
                    }}
                    disabled={isConnecting}
                    className={clsx(
                      'bracket-btn w-full border-2 px-4 py-2 text-sm font-mono font-bold flex items-center justify-center gap-2',
                      {
                        'opacity-50 cursor-not-allowed': isConnecting,
                      },
                      getWalletStatus().color,
                      getWalletStatus().bgColor
                    )}
                  >
                    {isConnecting ? (
                      <>
                        <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full"></div>
                        {getWalletStatus().text}
                      </>
                    ) : (
                      <>
                        {(() => {
                          const IconComponent = getWalletStatus().icon
                          return IconComponent ? <IconComponent size={16} /> : null
                        })()}
                        {getWalletStatus().text}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar