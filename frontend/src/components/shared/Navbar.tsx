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

  // Close dropdown when clicking outside
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
    try {
      setIsConnecting(true)
      setShowWalletDropdown(false)
      
      // Check if MetaMask is available
      if (typeof window.ethereum === 'undefined') {
        const installMetaMask = confirm('MetaMask is required to use WebZjs wallet. Would you like to install MetaMask now?')
        if (installMetaMask) {
          window.open('https://metamask.io/download/', '_blank')
        }
        return
      }

      console.log('Attempting to connect WebZjs wallet...')
      await connect('webzjs')
      console.log('WebZjs wallet connected successfully')
    } catch (error: any) {
      console.error('Wallet connection failed:', error)
      
      let errorMessage = error.message || 'Failed to connect wallet'
      let shouldOpenInstallPage = false
      let shouldOpenMetaMaskPage = false
      
      if (error.message?.includes('MetaMask Snaps are not supported') || error.message?.includes('newer version')) {
        errorMessage = 'MetaMask Snaps not supported.\n\nYou need MetaMask Flask or a newer version (v10.25.0+) that supports Snaps.\n\nWould you like to download MetaMask Flask?'
        shouldOpenMetaMaskPage = true
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

  const handleInstallSnap = () => {
    window.open('https://webzjs.chainsafe.dev', '_blank')
  }

  const getWalletStatus = () => {
    if (webzjs.isConnected) {
      return { 
        text: 'CONNECTED', 
        icon: CheckCircle, 
        color: 'text-green-400',
        bgColor: 'border-green-400'
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
      icon: Shield, 
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
                
                {showWalletDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-black border-2 border-terminal-bright rounded-md shadow-lg z-50">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Shield size={16} className="text-green-400" />
                        <span className="text-sm font-mono text-white">WebZjs Connected</span>
                      </div>
                      <div className="text-xs text-terminal-muted font-mono">
                        Zcash privacy features enabled
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
                    [getWalletStatus().color]: !isConnecting,
                    [getWalletStatus().bgColor]: !isConnecting,
                  }
                )}
              >
                {isConnecting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full"></div>
                    CONNECTING...
                  </>
                ) : (
                  <>
                    <Shield size={16} />
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
                    <button 
                      onClick={() => {
                        setIsMobileMenuOpen(false)
                        window.open('https://webzjs.chainsafe.dev', '_blank')
                      }}
                      className="text-xs text-terminal-primary hover:text-white transition-colors font-mono flex items-center gap-1"
                    >
                      Manage Wallet <ExternalLink size={12} />
                    </button>
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
                        [getWalletStatus().color]: !isConnecting,
                        [getWalletStatus().bgColor]: !isConnecting,
                      }
                    )}
                  >
                    {isConnecting ? (
                      <>
                        <div className="animate-spin h-4 w-4 border border-current border-t-transparent rounded-full"></div>
                        CONNECTING...
                      </>
                    ) : (
                      <>
                        <Shield size={16} />
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