import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'

const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  
  const navigation = [
    { name: 'Submit Evidence', href: '/submit' },
    { name: 'Browse', href: '/browse' },
    { name: 'Cross-chain', href: '/crosschain' },
  ]
  
  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
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
          <div className="hidden md:flex items-center gap-4">
            <button className="bracket-btn text-terminal-primary border-2 border-terminal-primary px-4 py-2 text-sm font-mono font-bold">
              CONNECT_WALLET
            </button>
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
                <button className="bracket-btn w-full text-terminal-primary border-2 border-terminal-primary px-4 py-2 text-sm font-mono font-bold">
                  CONNECT_WALLET
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar