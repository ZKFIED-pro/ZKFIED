import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useWallet } from '@/hooks/useWallet'
import { Shield, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react'

const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showWalletDropdown, setShowWalletDropdown] = useState(false)
  const location = useLocation()
  const { webzjs } = useWallet()
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

  const handleConnectWallet = () => {
    // Simply open the WebZjs installation page like the submit evidence page does
    window.open('https://webzjs.chainsafe.dev', '_blank')
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
    if (webzjs.isInstalled) {
      return { 
        text: 'WEBZJS_INSTALLED', 
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
      text: 'INSTALL_WEBZJS', 
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
                className={clsx(
                  'bracket-btn border-2 px-4 py-2 text-sm font-mono font-bold flex items-center gap-2',
                  getWalletStatus().color,
                  getWalletStatus().bgColor
                )}
              >
                {getWalletStatus().icon && React.createElement(getWalletStatus().icon, { size: 16 })}
                {getWalletStatus().text}
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
                    className={clsx(
                      'bracket-btn w-full border-2 px-4 py-2 text-sm font-mono font-bold flex items-center justify-center gap-2',
                      getWalletStatus().color,
                      getWalletStatus().bgColor
                    )}
                  >
                    {getWalletStatus().icon && React.createElement(getWalletStatus().icon, { size: 16 })}
                    {getWalletStatus().text}
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