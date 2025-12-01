import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface AccordionItem {
  id: string
  title: string
  content: React.ReactNode
}

const HowItWorksPage: React.FC = () => {
  const [openSection, setOpenSection] = useState<string | null>('why')

  const toggleSection = (id: string) => {
    setOpenSection(openSection === id ? null : id)
  }

  const sections: AccordionItem[] = [
    {
      id: 'why',
      title: 'Why ZKFIED Exists',
      content: (
        <div className="space-y-4">
          <p className="text-gray">
            Traditional whistleblower platforms have failed to protect sources. From Reality Winner
            to Chelsea Manning, centralized servers, metadata leakage, and single points of failure
            have led to exposure and prosecution.
          </p>
          <p className="text-gray">
            <strong className="text-white">ZKFIED changes this.</strong> We use cryptographic guarantees
            instead of promises. No servers to seize. No admins with god-mode access. No metadata
            that can trace back to YOU.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <div className="st-card">
              <div className="st-card-inner" style={{ padding: '12px' }}>
                <div className="text-white mb-1" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Traditional Platforms
                </div>
                <div className="text-gray" style={{ fontSize: '10px' }}>
                  Centralized servers • Seizure risk • Metadata exposure • Admin access
                </div>
              </div>
            </div>
            <div className="st-card">
              <div className="st-card-inner" style={{ padding: '12px' }}>
                <div className="text-white mb-1" style={{ fontSize: '12px', fontWeight: 700 }}>
                  ZKFIED
                </div>
                <div className="text-gray" style={{ fontSize: '10px' }}>
                  Decentralized • Cryptographic proofs • Anonymous • Immutable
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'privacy',
      title: 'How YOUR Privacy is Protected',
      content: (
        <div className="space-y-4">
          <p className="text-gray">
            When YOU submit evidence, YOUR identity is protected through multiple cryptographic layers:
          </p>
          <div className="space-y-3">
            <div className="st-card">
              <div className="st-card-inner" style={{ padding: '16px' }}>
                <div className="flex items-start gap-3">
                  <div className="text-white" style={{ fontSize: '24px', fontWeight: 700 }}>1</div>
                  <div>
                    <div className="text-white mb-1" style={{ fontSize: '12px', fontWeight: 700 }}>
                      Zcash Shielded Pool
                    </div>
                    <p className="text-gray" style={{ fontSize: '11px' }}>
                      YOUR transaction is completely private. No one can see who sent it, how much,
                      or what's in the memo. Zero-knowledge proofs mathematically guarantee privacy.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="st-card">
              <div className="st-card-inner" style={{ padding: '16px' }}>
                <div className="flex items-start gap-3">
                  <div className="text-white" style={{ fontSize: '24px', fontWeight: 700 }}>2</div>
                  <div>
                    <div className="text-white mb-1" style={{ fontSize: '12px', fontWeight: 700 }}>
                      FROST Threshold Signatures
                    </div>
                    <p className="text-gray" style={{ fontSize: '11px' }}>
                      Board members use distributed signing (3-of-5 threshold). No single person
                      has full access. YOUR evidence requires multiple independent approvals.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="st-card">
              <div className="st-card-inner" style={{ padding: '16px' }}>
                <div className="flex items-start gap-3">
                  <div className="text-white" style={{ fontSize: '24px', fontWeight: 700 }}>3</div>
                  <div>
                    <div className="text-white mb-1" style={{ fontSize: '12px', fontWeight: 700 }}>
                      Decentralized Storage
                    </div>
                    <p className="text-gray" style={{ fontSize: '11px' }}>
                      YOUR files are stored on IPFS - no central server that can be seized or
                      taken offline. Content-addressed storage ensures immutability.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'submit',
      title: 'How YOU Submit Evidence',
      content: (
        <div className="space-y-4">
          <p className="text-gray">
            ZKFIED offers two submission modes depending on YOUR technical expertise:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="st-card">
              <div className="st-card-inner">
                <div className="text-white mb-2" style={{ fontSize: '14px', fontWeight: 700 }}>
                  Hybrid Mode (Recommended)
                </div>
                <p className="text-gray mb-3" style={{ fontSize: '11px' }}>
                  Perfect if YOU already have a Zcash wallet (Zashi, Nighthawk). YOU control
                  the transaction creation.
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-white flex-shrink-0 mt-0.5">•</span>
                    <span className="text-gray" style={{ fontSize: '10px' }}>
                      Submit YOUR evidence details
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-white flex-shrink-0 mt-0.5">•</span>
                    <span className="text-gray" style={{ fontSize: '10px' }}>
                      Get YOUR evidence ID
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-white flex-shrink-0 mt-0.5">•</span>
                    <span className="text-gray" style={{ fontSize: '10px' }}>
                      Create shielded transaction in YOUR wallet
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-white flex-shrink-0 mt-0.5">•</span>
                    <span className="text-gray" style={{ fontSize: '10px' }}>
                      Link YOUR transaction - Done!
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="st-card">
              <div className="st-card-inner">
                <div className="text-white mb-2" style={{ fontSize: '14px', fontWeight: 700 }}>
                  Full Mode
                </div>
                <p className="text-gray mb-3" style={{ fontSize: '11px' }}>
                  Don't have a Zcash wallet? No problem. WE handle everything for YOU
                  automatically.
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-white flex-shrink-0 mt-0.5">•</span>
                    <span className="text-gray" style={{ fontSize: '10px' }}>
                      Connect WebZjs wallet (simple browser extension)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-white flex-shrink-0 mt-0.5">•</span>
                    <span className="text-gray" style={{ fontSize: '10px' }}>
                      Upload YOUR evidence and files
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-white flex-shrink-0 mt-0.5">•</span>
                    <span className="text-gray" style={{ fontSize: '10px' }}>
                      Click submit - WE handle the rest
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-white flex-shrink-0 mt-0.5">•</span>
                    <span className="text-gray" style={{ fontSize: '10px' }}>
                      Track YOUR evidence status in real-time
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'process',
      title: 'What Happens to YOUR Evidence',
      content: (
        <div className="space-y-4">
          <p className="text-gray">
            After YOU submit, YOUR evidence goes through a secure cryptographic pipeline:
          </p>
          <div className="space-y-2">
            <div style={{ paddingLeft: '20px', borderLeft: '2px solid rgb(52, 52, 52)' }}>
              <div className="mb-3">
                <div className="text-white mb-1" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Step 1: IPFS Upload
                </div>
                <p className="text-gray" style={{ fontSize: '11px' }}>
                  YOUR files are uploaded to IPFS (InterPlanetary File System), a decentralized
                  storage network. YOU receive a unique content identifier (CID) that proves
                  the files haven't been tampered with.
                </p>
              </div>
              <div className="mb-3">
                <div className="text-white mb-1" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Step 2: FROST Signing
                </div>
                <p className="text-gray" style={{ fontSize: '11px' }}>
                  Board members cryptographically sign YOUR evidence using threshold signatures.
                  3 out of 5 members must approve. This happens without revealing who signed,
                  preventing coercion or targeting.
                </p>
              </div>
              <div className="mb-3">
                <div className="text-white mb-1" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Step 3: Zcash Transaction
                </div>
                <p className="text-gray" style={{ fontSize: '11px' }}>
                  YOUR evidence ID is included in a shielded Zcash transaction. This creates an
                  immutable, private record on the blockchain. No one can see YOUR identity,
                  but everyone can verify the evidence exists.
                </p>
              </div>
              <div>
                <div className="text-white mb-1" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Step 4: NEAR Registry
                </div>
                <p className="text-gray" style={{ fontSize: '11px' }}>
                  The evidence is registered on NEAR Protocol's blockchain, linking the Zcash
                  privacy with public verifiability. Anyone can confirm YOUR evidence was
                  properly authorized, but YOUR identity remains hidden.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'verify',
      title: 'How Others Verify YOUR Evidence',
      content: (
        <div className="space-y-4">
          <p className="text-gray">
            Journalists, researchers, or anyone can verify YOUR evidence without compromising
            YOUR anonymity:
          </p>
          <div className="space-y-3">
            <div className="st-card">
              <div className="st-card-inner" style={{ padding: '12px' }}>
                <div className="text-white mb-2" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Public Verification
                </div>
                <p className="text-gray" style={{ fontSize: '11px' }}>
                  Anyone can query the NEAR registry to see that YOUR evidence received the required
                  threshold signatures. The IPFS files are accessible to prove authenticity. But
                  YOUR identity? Mathematically hidden in the Zcash shielded pool.
                </p>
              </div>
            </div>
            <div className="st-card">
              <div className="st-card-inner" style={{ padding: '12px' }}>
                <div className="text-white mb-2" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Immutable Record
                </div>
                <p className="text-gray" style={{ fontSize: '11px' }}>
                  Once YOUR evidence is on the blockchain, it cannot be deleted, modified, or
                  censored. No government, corporation, or platform admin can remove it. The
                  truth is permanent.
                </p>
              </div>
            </div>
            <div className="st-card">
              <div className="st-card-inner" style={{ padding: '12px' }}>
                <div className="text-white mb-2" style={{ fontSize: '12px', fontWeight: 700 }}>
                  Cryptographic Proof
                </div>
                <p className="text-gray" style={{ fontSize: '11px' }}>
                  The FROST signatures prove that YOUR evidence was reviewed and approved by the
                  board. The Zcash transaction proves it was submitted. The IPFS hash proves the
                  files weren't altered. All verifiable, all cryptographic, all protecting YOU.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="fade-in">
      <section style={{
        padding: '60px 0 40px',
        borderBottom: '1px solid rgb(52, 52, 52)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url(/images/6.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          filter: 'grayscale(100%) contrast(1.3)',
          zIndex: 0
        }} />
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          zIndex: 1
        }} />
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 className="mb-sm">How It Works</h1>
          <p className="text-gray">
            Understanding how YOUR evidence stays private and verifiable
          </p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: '40px', paddingBottom: '80px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.id} className="st-card">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full text-left"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <div className="st-card-inner" style={{ padding: '20px' }}>
                    <div className="flex items-center justify-between">
                      <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                        {section.title}
                      </h3>
                      <ChevronDown
                        className="w-5 h-5 text-gray transition-transform"
                        style={{
                          transform: openSection === section.id ? 'rotate(180deg)' : 'rotate(0deg)'
                        }}
                      />
                    </div>
                    {openSection === section.id && (
                      <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgb(52, 52, 52)' }}>
                        {section.content}
                      </div>
                    )}
                  </div>
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <div className="st-card">
              <div className="st-card-inner" style={{ padding: '24px' }}>
                <h3 className="mb-md">Ready to Submit YOUR Evidence?</h3>
                <p className="text-gray mb-lg" style={{ fontSize: '12px' }}>
                  YOUR identity is protected. YOUR evidence is immutable. YOUR truth matters.
                </p>
                <div className="flex justify-center gap-3">
                  <a href="/submit" className="st-btn">
                    Submit Evidence
                  </a>
                  <a href="/browse" className="st-btn" style={{ borderColor: 'rgb(52, 52, 52)', color: 'rgb(160, 160, 160)' }}>
                    Browse Database
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HowItWorksPage
