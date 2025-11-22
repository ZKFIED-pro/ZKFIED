import React from 'react'
import { Shield } from 'lucide-react'

const Footer: React.FC = () => {
  return (
    <footer className="bg-void border-t border-terminal-dark mt-auto">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded border border-terminal-dark">
                <Shield className="w-5 h-5 text-terminal-white" />
              </div>
              <span className="font-mono font-bold text-xl text-terminal-white">
                ZKFIED
              </span>
            </div>
            <p className="text-terminal-secondary text-sm leading-relaxed font-mono">
              &gt; PRIVACY_INFRASTRUCTURE_FOR_WHISTLEBLOWER_PROTECTION<br/>
              &gt; USING_ZCASH_SHIELDED_PROTOCOLS_AND_FROST_SIGNATURES
            </p>
          </div>
          
          {/* Product */}
          <div className="space-y-4">
            <h3 className="text-terminal-white font-medium">Product</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/submit" className="text-terminal-secondary hover:text-terminal-white transition-colors">
                  Submit Evidence
                </a>
              </li>
              <li>
                <a href="/browse" className="text-terminal-secondary hover:text-terminal-white transition-colors">
                  Browse Evidence
                </a>
              </li>
              <li>
                <a href="/crosschain" className="text-terminal-secondary hover:text-terminal-white transition-colors">
                  Cross-chain Bridge
                </a>
              </li>
            </ul>
          </div>
          
          {/* Technology */}
          <div className="space-y-4">
            <h3 className="text-terminal-white font-medium">Technology</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-terminal-secondary hover:text-terminal-white transition-colors">
                  Zcash Protocol
                </a>
              </li>
              <li>
                <a href="#" className="text-terminal-secondary hover:text-terminal-white transition-colors">
                  FROST Signatures
                </a>
              </li>
              <li>
                <a href="#" className="text-terminal-secondary hover:text-terminal-white transition-colors">
                  ZSA Tokens
                </a>
              </li>
              <li>
                <a href="#" className="text-terminal-secondary hover:text-terminal-white transition-colors">
                  NEAR Protocol
                </a>
              </li>
            </ul>
          </div>
          
          {/* Community */}
          <div className="space-y-4">
            <h3 className="text-terminal-white font-medium">Community</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="text-terminal-secondary hover:text-terminal-white transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-terminal-secondary hover:text-terminal-white transition-colors">
                  Security Audit
                </a>
              </li>
              <li>
                <a href="#" className="text-terminal-secondary hover:text-terminal-white transition-colors">
                  Bug Bounty
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 mt-8 border-t border-terminal-dark">
          <p className="text-terminal-secondary text-sm">
            © 2024 ZKFIED. Built for whistleblower protection.
          </p>
          
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <span className="text-terminal-secondary text-sm font-mono">
              [ANONYMOUS_SUBMISSION_PROTOCOL]
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer