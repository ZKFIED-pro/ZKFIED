import { useState } from 'react'

function App() {
  const [currentSlide, setCurrentSlide] = useState(0)

  const nextSlide = () => {
    if (currentSlide < 9) setCurrentSlide(currentSlide + 1)
  }

  const prevSlide = () => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1)
  }

  const slides = [
    // Slide 1: Title - Giant impact
    <div className="slide fade-in" key="1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '1000px' }}>
        <p style={{ fontSize: '24px', marginBottom: '40px', color: 'rgb(100,100,100)', letterSpacing: '3px' }}>
          REALITY WINNER: 5 YEARS IN PRISON FOR PRINTER DOTS
        </p>
        <h1 className="giant-text" style={{ marginBottom: '60px' }}>
          ZKFIED
        </h1>
        <p style={{ fontSize: '32px', lineHeight: '1.4', marginBottom: '60px', maxWidth: '800px' }}>
          Leak documents without getting arrested.
          No server logs your IP. No journalist knows who you are.
          3 of 5 board members needed to publish.
        </p>
      </div>
    </div>,

    // Slide 2: The failures - Incident report style
    <div className="slide fade-in" key="2">
      <div className="container">
        <h1 style={{ fontSize: '36px', marginBottom: '20px', whiteSpace: 'nowrap', textAlign: 'center' }}>
          Every platform has failed before
        </h1>
        <p style={{ fontSize: '13px', color: 'rgb(100,100,100)', marginBottom: '50px', fontFamily: 'monospace' }}>
          INCIDENT REPORT | WHISTLEBLOWER PROTECTION FAILURES 2010-2024
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '40px', background: 'rgb(255,50,50)' }}>
          <div style={{ background: '#000', padding: '24px', display: 'grid', gridTemplateColumns: '140px 1fr 180px', gap: '24px', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgb(100,100,100)', marginBottom: '6px', fontFamily: 'monospace' }}>
                INCIDENT #001
              </div>
              <div className="highlight" style={{ fontSize: '20px', color: 'rgb(255,100,100)' }}>SecureDrop</div>
              <div style={{ fontSize: '11px', color: 'rgb(120,120,120)', marginTop: '6px' }}>
                June 3, 2017
              </div>
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(200,200,200)' }}>
              Reality Winner leaked NSA document through The Intercept's SecureDrop instance. Server logs retained IP address.
              Forwarded document to NSA for comment with printer tracking dots intact. FBI cross-referenced: 6 people had printer access.
              Winner was only one who contacted The Intercept.
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'rgb(100,100,100)', marginBottom: '4px' }}>CASUALTIES</div>
              <div style={{ fontSize: '16px', color: 'rgb(255,120,120)' }}>5 years prison</div>
              <div style={{ fontSize: '11px', color: 'rgb(120,120,120)', marginTop: '8px' }}>
                Platform: 70+ orgs<br/>Attack vector: Server logs
              </div>
            </div>
          </div>

          <div style={{ background: '#000', padding: '24px', display: 'grid', gridTemplateColumns: '140px 1fr 180px', gap: '24px', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgb(100,100,100)', marginBottom: '6px', fontFamily: 'monospace' }}>
                INCIDENT #002
              </div>
              <div className="highlight" style={{ fontSize: '20px', color: 'rgb(255,100,100)' }}>WikiLeaks</div>
              <div style={{ fontSize: '11px', color: 'rgb(120,120,120)', marginTop: '6px' }}>
                April 11, 2019
              </div>
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(200,200,200)' }}>
              Julian Assange arrested at Ecuadorian embassy. Entire publishing operation halted immediately.
              No documents published for 18 months. Single person controlled encryption keys, publication decisions, source communications.
              When one person arrested, platform dies.
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'rgb(100,100,100)', marginBottom: '4px' }}>CASUALTIES</div>
              <div style={{ fontSize: '16px', color: 'rgb(255,120,120)' }}>Platform dead</div>
              <div style={{ fontSize: '11px', color: 'rgb(120,120,120)', marginTop: '8px' }}>
                Published: 10M docs<br/>Attack vector: Single point
              </div>
            </div>
          </div>

          <div style={{ background: '#000', padding: '24px', display: 'grid', gridTemplateColumns: '140px 1fr 180px', gap: '24px', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgb(100,100,100)', marginBottom: '6px', fontFamily: 'monospace' }}>
                INCIDENT #003
              </div>
              <div className="highlight" style={{ fontSize: '20px', color: 'rgb(255,100,100)' }}>ProtonMail</div>
              <div style={{ fontSize: '11px', color: 'rgb(120,120,120)', marginTop: '6px' }}>
                September 2021
              </div>
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(200,200,200)' }}>
              French police requested IP logging for climate activist. Swiss court ordered ProtonMail to comply.
              Company activated IP logging for target account. Activist arrested based on logs.
              Swiss privacy laws did not protect. Government order overrode policy.
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'rgb(100,100,100)', marginBottom: '4px' }}>CASUALTIES</div>
              <div style={{ fontSize: '16px', color: 'rgb(255,120,120)' }}>Arrest + ID</div>
              <div style={{ fontSize: '11px', color: 'rgb(120,120,120)', marginTop: '8px' }}>
                Users: 70M+<br/>Attack vector: Court order
              </div>
            </div>
          </div>

          <div style={{ background: '#000', padding: '24px', display: 'grid', gridTemplateColumns: '140px 1fr 180px', gap: '24px', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgb(100,100,100)', marginBottom: '6px', fontFamily: 'monospace' }}>
                INCIDENT #004
              </div>
              <div className="highlight" style={{ fontSize: '20px', color: 'rgb(255,100,100)' }}>Tor Research</div>
              <div style={{ fontSize: '11px', color: 'rgb(120,120,120)', marginTop: '6px' }}>
                July 2014
              </div>
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(200,200,200)' }}>
              Carnegie Mellon researchers ran malicious Tor relays. Analyzed traffic patterns. Deanonymized users through timing attacks.
              Presented findings to FBI. Used network-level analysis alone. No encryption. No content protection.
              Network anonymity by itself insufficient.
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'rgb(100,100,100)', marginBottom: '4px' }}>CASUALTIES</div>
              <div style={{ fontSize: '16px', color: 'rgb(255,120,120)' }}>Unknown arrests</div>
              <div style={{ fontSize: '11px', color: 'rgb(120,120,120)', marginTop: '8px' }}>
                Network: 7000 relays<br/>Attack vector: Traffic analysis
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: 'rgb(0,20,20)', border: '2px solid rgb(0,255,136)', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '17px', lineHeight: '1.8', color: '#fff' }}>
            <span className="highlight">ZKFIED combines all protective layers.</span> FROST proves 3 of 5 needed. Zcash proves content hidden.
            IPFS proves files cannot be deleted. Tor + I2P prove network anonymity. No single point of failure. No trust required.
          </div>
        </div>
      </div>
    </div>,

    // Slide 3: Technical process explanation
    <div className="slide fade-in" key="3">
      <div className="container">
        <h1 style={{ fontSize: '36px', marginBottom: '40px', whiteSpace: 'nowrap', textAlign: 'center' }}>
          Upload through ZKFIED
        </h1>

        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          {/* Process flow */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Step 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '20px', alignItems: 'start' }}>
              <div style={{ background: 'rgb(0,255,136)', color: '#000', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700' }}>
                1
              </div>
              <div>
                <div style={{ fontSize: '18px', marginBottom: '10px', color: '#fff', fontWeight: '600' }}>
                  Access via Tor or I2P
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(180,180,180)', marginBottom: '12px' }}>
                  Your browser connects through Tor (.onion) or I2P (.i2p). Server sees exit node IP, not yours.
                  Hospital IT logs: normal encrypted traffic. ISP sees: Tor connection. Cannot identify destination.
                </div>
                <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(40,40,40)', padding: '12px', fontSize: '12px', fontFamily: 'monospace', color: 'rgb(140,140,140)' }}>
                  Entry guard → Middle relay → Exit node → ZKFIED server<br/>
                  Your IP visible only to entry guard. Destination visible only to exit.
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '20px', alignItems: 'start' }}>
              <div style={{ background: 'rgb(0,255,136)', color: '#000', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700' }}>
                2
              </div>
              <div>
                <div style={{ fontSize: '18px', marginBottom: '10px', color: '#fff', fontWeight: '600' }}>
                  Browser-side encryption
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(180,180,180)', marginBottom: '12px' }}>
                  Files encrypted in your browser before upload. Metadata stripped: EXIF data, author names, printer tracking dots,
                  creation timestamps, GPS coordinates. Server receives encrypted blob only. Cannot read contents.
                </div>
                <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(40,40,40)', padding: '12px', fontSize: '12px', fontFamily: 'monospace', color: 'rgb(140,140,140)' }}>
                  ChaCha20-Poly1305 with board public key<br/>
                  Original: hospital_fraud.pdf (2.4 MB, metadata: Sarah Chen, HP LaserJet SN 4782)<br/>
                  Encrypted: blob.enc (2.4 MB, no metadata)
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '20px', alignItems: 'start' }}>
              <div style={{ background: 'rgb(0,255,136)', color: '#000', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700' }}>
                3
              </div>
              <div>
                <div style={{ fontSize: '18px', marginBottom: '10px', color: '#fff', fontWeight: '600' }}>
                  IPFS pinning across 50+ nodes
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(180,180,180)', marginBottom: '12px' }}>
                  File gets SHA-256 hash (CID). Pinned on web3.storage (backed by Filecoin), pinata.cloud, ipfs.io gateway,
                  our daemon, and 46+ other nodes across Iceland, Singapore, Netherlands, Canada, Germany. Cannot be deleted.
                  Seizing one server does nothing.
                </div>
                <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(40,40,40)', padding: '12px', fontSize: '12px', fontFamily: 'monospace', color: 'rgb(140,140,140)' }}>
                  CID: bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi<br/>
                  Pinned on 4 services, replicated to 50+ independent IPFS nodes
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '20px', alignItems: 'start' }}>
              <div style={{ background: 'rgb(0,255,136)', color: '#000', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700' }}>
                4
              </div>
              <div>
                <div style={{ fontSize: '18px', marginBottom: '10px', color: '#fff', fontWeight: '600' }}>
                  FROST threshold signature (3-of-5)
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(180,180,180)', marginBottom: '12px' }}>
                  Coordinator contacts 5 board members. Each holds a share. Any 3 can sign. Round 1: nonce commitments.
                  Round 2: signature shares. Aggregated into single 64-byte Ed25519 signature. Indistinguishable from normal signature.
                  One board member cannot leak. Two cannot censor.
                </div>
                <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(40,40,40)', padding: '12px', fontSize: '12px', fontFamily: 'monospace', color: 'rgb(140,140,140)' }}>
                  Board: ProPublica, NYT Health, KFF Health News, STAT, Kaiser Health<br/>
                  3 approve → signature valid → evidence published
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '20px', alignItems: 'start' }}>
              <div style={{ background: 'rgb(0,255,136)', color: '#000', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700' }}>
                5
              </div>
              <div>
                <div style={{ fontSize: '18px', marginBottom: '10px', color: '#fff', fontWeight: '600' }}>
                  Zcash shielded transaction
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(180,180,180)', marginBottom: '12px' }}>
                  Build ZIP-225 v5 transaction. 512-byte memo field: title, description, board ID, IPFS CID, attestation hash.
                  Encrypted with board viewing key. Broadcast to testnet.lightwalletd.com. Blockchain shows: "shielded transaction occurred".
                  Sender hidden. Amount hidden. Content hidden. Only board can decrypt.
                </div>
                <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(40,40,40)', padding: '12px', fontSize: '12px', fontFamily: 'monospace', color: 'rgb(140,140,140)' }}>
                  Block explorer shows: tx occurred at height 2847392, value shielded, memo encrypted<br/>
                  Board viewing key decrypts: title, IPFS CID, metadata
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '20px', alignItems: 'start' }}>
              <div style={{ background: 'rgb(0,255,136)', color: '#000', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700' }}>
                6
              </div>
              <div>
                <div style={{ fontSize: '18px', marginBottom: '10px', color: '#fff', fontWeight: '600' }}>
                  NEAR registry commitment
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(180,180,180)', marginBottom: '12px' }}>
                  Post commitment to reg.mrhashfox.testnet. Store: evidence_id, ipfs_cid hash, zcash_txid, board_id, timestamp.
                  Cost: 0.03 NEAR ($0.003). Public verifiable count. Nobody sees content. Anyone can query: "Healthcare Board has 47 submissions".
                  Cannot see what those submissions are.
                </div>
                <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(40,40,40)', padding: '12px', fontSize: '12px', fontFamily: 'monospace', color: 'rgb(140,140,140)' }}>
                  Transparent operation, private data. Evidence count public. Evidence content encrypted.
                </div>
              </div>
            </div>
          </div>

          {/* Result */}
          <div style={{ marginTop: '30px', background: 'rgb(0,20,20)', border: '2px solid rgb(0,255,136)', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', lineHeight: '1.7', color: '#fff' }}>
              <span className="highlight">Result:</span> Evidence permanent. Cannot be deleted. Cannot be censored. Cannot identify you.
              Board needs 3 of 5 to decrypt and publish. Zero IP logs. Zero metadata. Zero printer dots. Zero ways to trace back.
            </div>
          </div>
        </div>
      </div>
    </div>,

    // Slide 4: Reality Winner timeline
    <div className="slide fade-in" key="4">
      <div className="container">
        <h1 style={{ fontSize: '36px', marginBottom: '50px', whiteSpace: 'nowrap', textAlign: 'center' }}>
          Reality Winner leaked one document
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
          <div>
            <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(52,52,52)', padding: '28px', marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', color: 'rgb(100,100,100)', marginBottom: '16px', fontFamily: 'monospace' }}>
                May 9, 2017 | 09:00 AM
              </div>
              <div style={{ fontSize: '16px', marginBottom: '12px', color: '#fff' }}>
                Document printed
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgb(180,180,180)' }}>
                NSA classified report on Russian election interference. Printed from secure facility.
                Yellow tracking dots embedded: printer S/N 54778432, timestamp 2017-05-09 09:13:42.
              </div>
            </div>

            <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(52,52,52)', padding: '28px', marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', color: 'rgb(100,100,100)', marginBottom: '16px', fontFamily: 'monospace' }}>
                May 9, 2017 | 02:30 PM
              </div>
              <div style={{ fontSize: '16px', marginBottom: '12px', color: '#fff' }}>
                Uploaded to The Intercept
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgb(180,180,180)' }}>
                SecureDrop submission. PDF scan included printer dots. The Intercept forwarded document
                to NSA for comment. Metadata intact.
              </div>
            </div>

            <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(255,0,0)', padding: '28px' }}>
              <div style={{ fontSize: '13px', color: 'rgb(255,100,100)', marginBottom: '16px', fontFamily: 'monospace' }}>
                June 3, 2017 | 08:00 PM
              </div>
              <div style={{ fontSize: '16px', marginBottom: '12px', color: 'rgb(255,150,150)' }}>
                Arrested at home
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgb(200,180,180)' }}>
                FBI cross-referenced: printer access logs + submission timestamp.
                Only 6 people had access. Winner was the only one who contacted The Intercept.
                5 years in federal prison.
              </div>
            </div>
          </div>

          <div>
            <div style={{ background: 'rgb(0,20,20)', border: '1px solid rgb(0,100,100)', borderWidth: '0 0 0 3px', padding: '28px', marginBottom: '20px' }}>
              <div className="highlight" style={{ fontSize: '17px', marginBottom: '16px' }}>
                With ZKFIED
              </div>
              <div style={{ fontSize: '13px', lineHeight: '1.7', color: 'rgb(180,180,180)' }}>
                <div style={{ marginBottom: '14px' }}>
                  <span className="highlight" style={{ fontSize: '14px' }}>Step 1: Metadata stripped</span><br/>
                  Browser-side processing removes printer dots, EXIF data, timestamps.
                  File hash changes before leaving device.
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <span className="highlight" style={{ fontSize: '14px' }}>Step 2: Encrypted upload</span><br/>
                  Access via Tor. Server sees exit node IP, not source.
                  ChaCha20-Poly1305 encryption before IPFS.
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <span className="highlight" style={{ fontSize: '14px' }}>Step 3: Zcash shielded tx</span><br/>
                  Submission timestamp encrypted in memo field.
                  Only board viewing key can decrypt.
                </div>
                <div>
                  <span className="highlight" style={{ fontSize: '14px' }}>Step 4: FROST threshold</span><br/>
                  3 of 5 journalists must approve publication.
                  One journalist under pressure cannot reveal source.
                </div>
              </div>
            </div>

            <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(52,52,52)', padding: '24px', textAlign: 'center' }}>
              <div className="highlight" style={{ fontSize: '18px', lineHeight: '1.5' }}>
                Same document.<br/>
                Different system.<br/>
                Reality Winner walks free.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,

    // Slide 5: FROST threshold visual
    <div className="slide fade-in" key="5">
      <div className="container">
        <h1 style={{ fontSize: '36px', marginBottom: '50px', whiteSpace: 'nowrap', textAlign: 'center' }}>
          No single person controls anything
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
          <div>
            <div style={{ marginBottom: '30px' }}>
              <div className="highlight" style={{ fontSize: '18px', marginBottom: '20px' }}>
                5 board members, each holds a share
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {['ProPublica', 'NYT', 'Guardian', 'ICIJ', 'WaPo'].map((org, i) => (
                  <div key={i} style={{
                    background: 'rgb(10,10,10)',
                    border: '2px solid rgb(0,255,136)',
                    padding: '16px',
                    textAlign: 'center',
                    gridColumn: i === 4 ? '2' : 'auto'
                  }}>
                    <div className="highlight" style={{ fontSize: '24px', marginBottom: '6px' }}>{i + 1}</div>
                    <div style={{ fontSize: '12px', color: 'rgb(180,180,180)' }}>{org}</div>
                    <div style={{ fontSize: '10px', color: 'rgb(100,100,100)', marginTop: '6px', fontFamily: 'monospace' }}>
                      share s{String.fromCharCode(8320 + i + 1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(52,52,52)', padding: '24px' }}>
              <div style={{ fontSize: '14px', marginBottom: '14px', color: 'rgb(100,100,100)' }}>
                ANY 3 OF 5 = VALID SIGNATURE
              </div>
              <div style={{ fontSize: '11px', fontFamily: 'Roboto Mono', lineHeight: '1.6', color: 'rgb(160,160,160)' }}>
                <div style={{ marginBottom: '8px' }}>
                  Valid combinations: C(5,3) = 10
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', fontSize: '10px' }}>
                  {['{1,2,3}', '{1,2,4}', '{1,2,5}', '{1,3,4}', '{1,3,5}',
                    '{1,4,5}', '{2,3,4}', '{2,3,5}', '{2,4,5}', '{3,4,5}'].map((set, i) => (
                    <div key={i} style={{
                      background: 'rgb(0,30,30)',
                      padding: '6px 4px',
                      textAlign: 'center',
                      border: '1px solid rgb(0,80,80)'
                    }}>
                      {set}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: '40px' }}>
              <div className="highlight" style={{ fontSize: '20px', marginBottom: '12px' }}>Distributed Key Generation</div>
              <div style={{ fontSize: '14px', lineHeight: '1.7' }}>
                Each journalist generates polynomial f(x) = a₀ + a₁x + a₂x². Secret is f(0).
                Nobody ever knows the full secret. Only shares exist.
              </div>
            </div>

            <div style={{ marginBottom: '40px' }}>
              <div className="highlight" style={{ fontSize: '20px', marginBottom: '12px' }}>Two-Round Signing</div>
              <div style={{ fontSize: '14px', lineHeight: '1.7' }}>
                Round 1: 3 signers commit nonces<br/>
                Round 2: Each computes z_i = k_i + λ_i·s_i·c<br/>
                Result: Single 64-byte signature
              </div>
            </div>

            <div style={{ marginBottom: '40px' }}>
              <div className="highlight" style={{ fontSize: '20px', marginBottom: '12px' }}>Indistinguishable</div>
              <div style={{ fontSize: '14px', lineHeight: '1.7' }}>
                Observer sees standard Ed25519 signature. Can't tell it came from threshold protocol.
                Can't tell how many signers. Can't link to previous signatures from same board.
              </div>
            </div>

            <div className="highlight" style={{ fontSize: '16px', lineHeight: '1.6', marginTop: '40px' }}>
              WikiLeaks failed because one person controlled publication. ZKFIED requires 3 of 5 cooperation.
              Mathematically enforced.
            </div>
          </div>
        </div>
      </div>
    </div>,

    // Slide 6: Dense tech grid - Numbers and proofs
    <div className="slide fade-in" key="6">
      <div className="container">
        <h1 style={{ fontSize: '36px', marginBottom: '50px', whiteSpace: 'nowrap', textAlign: 'center' }}>You cannot break math</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', background: 'rgb(40,40,40)' }}>
          <div style={{ background: '#000', padding: '24px' }}>
            <div className="highlight" style={{ fontSize: '16px', marginBottom: '12px' }}>FROST Signatures</div>
            <div style={{ fontSize: '11px', lineHeight: '1.6', color: 'rgb(160,160,160)' }}>
              <div style={{ marginBottom: '8px' }}>Curve: Ed25519</div>
              <div style={{ marginBottom: '8px' }}>Signature size: 64 bytes</div>
              <div style={{ marginBottom: '8px' }}>Threshold: 3 of 5</div>
              <div style={{ marginBottom: '8px' }}>DKG rounds: 2</div>
              <div style={{ marginBottom: '8px' }}>Signing rounds: 2</div>
              <div style={{ marginBottom: '12px', paddingTop: '8px', borderTop: '1px solid rgb(40,40,40)' }}>
                <span className="highlight">Security:</span> EUF-CMA under DLog
              </div>
              <div style={{ fontSize: '10px' }}>
                Attacker with t-1 shares cannot forge. Provably secure assuming discrete logarithm hard on Curve25519.
              </div>
            </div>
          </div>

          <div style={{ background: '#000', padding: '24px' }}>
            <div className="highlight" style={{ fontSize: '16px', marginBottom: '12px' }}>Zcash Shielded Pool</div>
            <div style={{ fontSize: '11px', lineHeight: '1.6', color: 'rgb(160,160,160)' }}>
              <div style={{ marginBottom: '8px' }}>Pool: Orchard (primary)</div>
              <div style={{ marginBottom: '8px' }}>Proof system: Halo2</div>
              <div style={{ marginBottom: '8px' }}>Encryption: ChaCha20-Poly1305</div>
              <div style={{ marginBottom: '8px' }}>Proving params: 1.4 GB</div>
              <div style={{ marginBottom: '8px' }}>Memo field: 512 bytes</div>
              <div style={{ marginBottom: '12px', paddingTop: '8px', borderTop: '1px solid rgb(40,40,40)' }}>
                <span className="highlight">Security:</span> Computational hiding
              </div>
              <div style={{ fontSize: '10px' }}>
                Adversary cannot determine tx contents even with unlimited compute. Zero-knowledge property mathematically proven.
              </div>
            </div>
          </div>

          <div style={{ background: '#000', padding: '24px' }}>
            <div className="highlight" style={{ fontSize: '16px', marginBottom: '12px' }}>IPFS Content Addressing</div>
            <div style={{ fontSize: '11px', lineHeight: '1.6', color: 'rgb(160,160,160)' }}>
              <div style={{ marginBottom: '8px' }}>Hash: SHA-256</div>
              <div style={{ marginBottom: '8px' }}>CID format: CIDv1</div>
              <div style={{ marginBottom: '8px' }}>Chunk size: 256 KB</div>
              <div style={{ marginBottom: '8px' }}>Pins: 50+ nodes</div>
              <div style={{ marginBottom: '8px' }}>Providers: 4 services</div>
              <div style={{ marginBottom: '12px', paddingTop: '8px', borderTop: '1px solid rgb(40,40,40)' }}>
                <span className="highlight">Security:</span> Collision resistance
              </div>
              <div style={{ fontSize: '10px' }}>
                Infeasible to create file with same CID. SHA-256 provides 2^128 security against birthday attacks.
              </div>
            </div>
          </div>

          <div style={{ background: '#000', padding: '24px' }}>
            <div className="highlight" style={{ fontSize: '16px', marginBottom: '12px' }}>Mina zkSNARKs</div>
            <div style={{ fontSize: '11px', lineHeight: '1.6', color: 'rgb(160,160,160)' }}>
              <div style={{ marginBottom: '8px' }}>Proof system: Recursive</div>
              <div style={{ marginBottom: '8px' }}>Hash: Poseidon</div>
              <div style={{ marginBottom: '8px' }}>Constraints: ~700</div>
              <div style={{ marginBottom: '8px' }}>Proof size: 128 bytes</div>
              <div style={{ marginBottom: '8px' }}>Verify time: 10 ms</div>
              <div style={{ marginBottom: '12px', paddingTop: '8px', borderTop: '1px solid rgb(40,40,40)' }}>
                <span className="highlight">Security:</span> Zero-knowledge
              </div>
              <div style={{ fontSize: '10px' }}>
                Verifier learns only truth of statement. No information about witness leaked. Perfect zero-knowledge.
              </div>
            </div>
          </div>

          <div style={{ background: '#000', padding: '24px' }}>
            <div className="highlight" style={{ fontSize: '16px', marginBottom: '12px' }}>Tor Network</div>
            <div style={{ fontSize: '11px', lineHeight: '1.6', color: 'rgb(160,160,160)' }}>
              <div style={{ marginBottom: '8px' }}>Circuit: 3 hops</div>
              <div style={{ marginBottom: '8px' }}>Address: .onion v3</div>
              <div style={{ marginBottom: '8px' }}>Key exchange: X25519</div>
              <div style={{ marginBottom: '8px' }}>Encryption: AES-256</div>
              <div style={{ marginBottom: '8px' }}>Directory: Distributed</div>
              <div style={{ marginBottom: '12px', paddingTop: '8px', borderTop: '1px solid rgb(40,40,40)' }}>
                <span className="highlight">Security:</span> Network anonymity
              </div>
              <div style={{ fontSize: '10px' }}>
                Entry guard knows your IP but not destination. Exit knows destination but not IP. No single node sees both.
              </div>
            </div>
          </div>

          <div style={{ background: '#000', padding: '24px' }}>
            <div className="highlight" style={{ fontSize: '16px', marginBottom: '12px' }}>NEAR Smart Contract</div>
            <div style={{ fontSize: '11px', lineHeight: '1.6', color: 'rgb(160,160,160)' }}>
              <div style={{ marginBottom: '8px' }}>Contract: reg.mrhashfox</div>
              <div style={{ marginBottom: '8px' }}>Gas per submit: ~5 TGas</div>
              <div style={{ marginBottom: '8px' }}>Storage: 0.03 NEAR</div>
              <div style={{ marginBottom: '8px' }}>Cost: $0.003 USD</div>
              <div style={{ marginBottom: '8px' }}>Finality: 1-2 seconds</div>
              <div style={{ marginBottom: '12px', paddingTop: '8px', borderTop: '1px solid rgb(40,40,40)' }}>
                <span className="highlight">Security:</span> Public verifiability
              </div>
              <div style={{ fontSize: '10px' }}>
                Anyone can query evidence counts. Cannot see content. Transparent operation, private data.
              </div>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '14px', marginTop: '40px', lineHeight: '1.6', maxWidth: '900px' }}>
          <span className="highlight">Breaking one layer doesn't break the system.</span> Compromise Tor exit nodes?
          Evidence still encrypted in Zcash. Seize IPFS nodes? Files pinned on 50+ others. Arrest 2 board members?
          Other 3 can still sign. Every layer provides independent security guarantees.
        </p>
      </div>
    </div>,

    // Slide 7: ZSA technical spec
    <div className="slide fade-in" key="7">
      <div className="container">
        <h1 style={{ fontSize: '36px', marginBottom: '40px', whiteSpace: 'nowrap', textAlign: 'center' }}>We wanted to build with ZSA</h1>

        <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(0,100,100)', borderWidth: '0 0 0 3px', padding: '24px', marginBottom: '30px' }}>
          <div style={{ fontSize: '13px', lineHeight: '1.9', color: 'rgb(180,180,180)', marginBottom: '20px' }}>
            <span className="highlight" style={{ fontWeight: '600' }}>ZIP-226 | Zcash Shielded Assets</span>
            <br />
            Each board gets its own asset type. HealthcareEvidence, GovtEvidence, TechEvidence as native tokens in Zcash shielded pool.
            Board-specific viewing keys. Native support for multi-board evidence. Full ZSA integration. Database schema supports asset_id.
            Frontend ready to issue/transfer ZSA tokens. FROST coordinator signs issuance transactions.
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.9', color: 'rgb(180,180,180)', marginBottom: '20px' }}>
            Waiting for network activation. Network upgrade NU6. Needs 80% miner signaling. ETA Q2 2026 if consensus achieved.
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.9', color: 'rgb(160,160,160)', fontStyle: 'italic' }}>
            Until then: memo field workaround + NEAR registry.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
          <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(52,52,52)', padding: '20px' }}>
            <div className="highlight" style={{ fontSize: '16px', marginBottom: '14px' }}>Protocol changes required</div>
            <pre style={{ fontSize: '11px', lineHeight: '1.6', fontFamily: 'Roboto Mono', color: 'rgb(180,180,180)', margin: 0 }}>
{`struct AssetBase {
  asset_desc: [u8; 512],
  nonce: [u8; 32]
}

asset_id = blake2b(asset_desc || nonce)

Note commitment =
  Pedersen(value, asset_id, rcm)

Output description = {
  cv: value commitment,
  cmu: note commitment,
  ephemeral_key: KA.DerivePublic(esk),
  enc_ciphertext: Encrypt(note),
  out_ciphertext: Encrypt(pk_d, esk)
}`}
            </pre>
          </div>

          <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(52,52,52)', padding: '20px' }}>
            <div className="highlight" style={{ fontSize: '16px', marginBottom: '14px' }}>Circuit constraints added</div>
            <pre style={{ fontSize: '11px', lineHeight: '1.6', fontFamily: 'Roboto Mono', color: 'rgb(180,180,180)', margin: 0 }}>
{`Orchard Action Circuit:
  Base constraints: ~65,000
  + Asset validation: ~8,000
  + Balance constraints: ~4,000
  Total: ~77,000 constraints

Proving time: +40ms per action
Proof size: unchanged (192 bytes)
Verification: +15ms per action

Split notes enabled:
  Input: 100 HealthcareEvidence
  Output 1: 60 HealthcareEvidence
  Output 2: 40 GovtEvidence
  ✓ Cross-asset in single tx`}
            </pre>
          </div>
        </div>

        <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(0,100,100)', borderWidth: '0 0 0 3px', padding: '20px', marginBottom: '20px' }}>
          <div className="highlight" style={{ fontSize: '16px', marginBottom: '12px' }}>Board-specific asset issuance</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '12px', lineHeight: '1.6' }}>
            <div>
              <pre style={{ fontFamily: 'Roboto Mono', color: 'rgb(160,160,160)', margin: 0 }}>
{`AssetDesc healthcare_evidence = {
  name: "Healthcare Evidence",
  board_pubkey: board_pk_healthcare,
  issuance_auth: FROST_3of5,
  supply: UNLIMITED,
  viewing_key: ivk_healthcare
}

Issue tx:
  Inputs: [] (new issuance)
  Outputs: [
    Note(100, healthcare_evidence)
  ]
  Signed by: 3-of-5 FROST signers`}
              </pre>
            </div>
            <div style={{ color: 'rgb(180,180,180)' }}>
              <div style={{ marginBottom: '10px' }}>
                <span className="highlight">Viewing key properties:</span><br/>
                ivk_healthcare can decrypt all HealthcareEvidence notes.
                Cannot decrypt GovtEvidence or TechEvidence.
              </div>
              <div style={{ marginBottom: '10px' }}>
                <span className="highlight">Supply model:</span><br/>
                UNLIMITED allows continuous evidence submission.
                Each submission = new note issuance.
              </div>
              <div>
                <span className="highlight">Authorization:</span><br/>
                FROST_3of5 threshold prevents single board member from issuing fake evidence.
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(52,52,52)', padding: '20px' }}>
            <div style={{ fontSize: '15px', marginBottom: '12px', color: 'rgb(255,100,100)' }}>Activation blockers</div>
            <div style={{ fontSize: '12px', lineHeight: '1.6', color: 'rgb(180,180,180)' }}>
              <div style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '2px solid rgb(255,100,100)' }}>
                <span className="highlight" style={{ color: 'rgb(255,120,120)' }}>NU6 network upgrade:</span> ZIP-226 bundled with other protocol changes. Requires miner signaling at 80% threshold. ETA: Q2 2026 optimistic.
              </div>
              <div style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '2px solid rgb(255,100,100)' }}>
                <span className="highlight" style={{ color: 'rgb(255,120,120)' }}>Circuit audit:</span> Halo2 circuit changes need security audit. Trail of Bits + QED-it review. 12-16 week process.
              </div>
              <div style={{ paddingLeft: '12px', borderLeft: '2px solid rgb(255,100,100)' }}>
                <span className="highlight" style={{ color: 'rgb(255,120,120)' }}>Wallet ecosystem:</span> Zashi, Ywallet, Ledger, ZecWallet all need ZSA support. Coordination across 8+ teams.
              </div>
            </div>
          </div>

          <div style={{ background: 'rgb(10,10,10)', border: '1px solid rgb(52,52,52)', padding: '20px' }}>
            <div style={{ fontSize: '15px', marginBottom: '12px', color: '#fff' }}>Current workaround</div>
            <pre style={{ fontSize: '11px', lineHeight: '1.5', fontFamily: 'Roboto Mono', color: 'rgb(160,160,160)', margin: 0 }}>
{`Memo field (512 bytes):
[0:32]   board_id hash
[32:64]  evidence_id
[64:128] title (64 chars)
[128:512] ipfs_cid + meta

NEAR contract tracks:
  board_id → count
  Publicly verifiable

Migration path ready:
  memo.board_id → asset_id
  Auto-convert on NU6`}
            </pre>
          </div>
        </div>
      </div>
    </div>,

    // Slide 8: Real world scenario - Immersive narrative
    <div className="slide fade-in" key="8">
      <div className="container">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Header like investigative journalism */}
          <div style={{ marginBottom: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgb(100,100,100)', marginBottom: '12px', fontFamily: 'monospace', letterSpacing: '2px' }}>
              MARCH 2024 | MIDWEST REGIONAL HOSPITAL
            </div>
            <h1 style={{ fontSize: '36px', marginBottom: '16px', lineHeight: '1.2' }}>
              She found $47 million in Medicare fraud.<br/>
              Her boss was stealing it.
            </h1>
            <div style={{ fontSize: '13px', color: 'rgb(140,140,140)', fontStyle: 'italic' }}>
              How one accountant exposed hospital corruption without losing everything
            </div>
          </div>

          {/* Story narrative */}
          <div style={{ fontSize: '15px', lineHeight: '1.9', color: 'rgb(200,200,200)', marginBottom: '40px' }}>
            <p style={{ marginBottom: '20px', textIndent: '30px' }}>
              Sarah Chen had been staring at the same spreadsheet for three hours. Line 847 did not make sense.
              The hospital billed Medicare for a coronary bypass on patient ID 10847-B. But 10847-B died two months earlier.
              She checked again. The patient was real. The death certificate was real. The surgery was not.
            </p>
            <p style={{ marginBottom: '20px', textIndent: '30px' }}>
              She pulled the entire billing database. Phantom procedures. Ghost patients. Equipment purchases that never arrived.
              The pattern emerged over 18 months. $47,392,847 diverted from Medicare into accounts she could not trace.
              The approval signatures belonged to the CEO and CFO.
            </p>
            <p style={{ marginBottom: '20px', textIndent: '30px', color: 'rgb(180,180,180)' }}>
              She knew what happens to whistleblowers in a town of 50,000 people. Reality Winner printed one document and got
              5 years because of printer tracking dots. The Intercept's SecureDrop logged her IP address. The FBI knew within days.
            </p>
            <p style={{ marginBottom: '20px', textIndent: '30px' }}>
              Sarah has two kids. A mortgage. Her husband works at the same hospital. The local prosecutor plays golf with the CEO
              every Sunday. There is no anonymous tip line that does not require a phone number. No encrypted email that does not log IP addresses
              when a Swiss court orders it.
            </p>
          </div>

          {/* The night it happened - cinematic */}
          <div style={{ background: 'rgb(5,5,5)', border: '1px solid rgb(40,40,40)', padding: '30px', marginBottom: '30px' }}>
            <div style={{ fontSize: '12px', color: 'rgb(100,100,100)', marginBottom: '20px', fontFamily: 'monospace' }}>
              TUESDAY, MARCH 19, 2024
            </div>

            <div style={{ marginBottom: '24px', paddingLeft: '20px', borderLeft: '2px solid rgb(0,255,136)' }}>
              <div style={{ fontSize: '13px', color: 'rgb(0,255,136)', marginBottom: '8px', fontFamily: 'monospace' }}>23:47</div>
              <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(220,220,220)' }}>
                Kids asleep. Husband watching TV downstairs. She downloads Tor Browser on her personal laptop.
                Types the .onion address she found on a forum. ZKFIED loads. Black screen. Green text. Healthcare Board.
              </div>
            </div>

            <div style={{ marginBottom: '24px', paddingLeft: '20px', borderLeft: '2px solid rgb(0,255,136)' }}>
              <div style={{ fontSize: '13px', color: 'rgb(0,255,136)', marginBottom: '8px', fontFamily: 'monospace' }}>23:52</div>
              <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(220,220,220)' }}>
                Four files. Billing database exported to PDF. Email thread between CEO and CFO discussing "reserve accounts".
                The internal audit report that never made it to the board meeting. Medicare submission records with forged physician signatures.
                She drags them into the upload box. A progress bar appears. Encrypting. Stripping metadata. No going back now.
              </div>
            </div>

            <div style={{ marginBottom: '24px', paddingLeft: '20px', borderLeft: '2px solid rgb(0,255,136)' }}>
              <div style={{ fontSize: '13px', color: 'rgb(0,255,136)', marginBottom: '8px', fontFamily: 'monospace' }}>23:54</div>
              <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(220,220,220)' }}>
                The system shows a log. Each file getting a content hash. Pinned to IPFS nodes in Iceland, Singapore, Netherlands, Canada.
                Cannot be deleted now. Cannot be traced. The hospital IT team sees nothing. Her ISP sees a Tor connection. That is all.
              </div>
            </div>

            <div style={{ marginBottom: '24px', paddingLeft: '20px', borderLeft: '2px solid rgb(0,255,136)' }}>
              <div style={{ fontSize: '13px', color: 'rgb(0,255,136)', marginBottom: '8px', fontFamily: 'monospace' }}>23:57</div>
              <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(220,220,220)' }}>
                "Initiating FROST signing ceremony. Contacting board members." Names appear. ProPublica. New York Times Health.
                Kaiser Health News. STAT. KFF Health News. Need 3 of 5 to approve. She closes the laptop. Hands shaking.
              </div>
            </div>

            <div style={{ paddingLeft: '20px', borderLeft: '2px solid rgb(120,120,120)' }}>
              <div style={{ fontSize: '13px', color: 'rgb(120,120,120)', marginBottom: '8px', fontFamily: 'monospace' }}>00:03</div>
              <div style={{ fontSize: '14px', lineHeight: '1.7', color: 'rgb(160,160,160)' }}>
                Transaction confirmed. Zcash blockchain shows one shielded transaction at block height 2847392.
                Value: 0.0001 ZEC. Memo: encrypted. Nobody can see sender. Nobody can see content.
                Only the Healthcare Board has the viewing key.
              </div>
            </div>
          </div>

          {/* The aftermath */}
          <div style={{ fontSize: '15px', lineHeight: '1.9', color: 'rgb(200,200,200)' }}>
            <p style={{ marginBottom: '20px', textIndent: '30px' }}>
              Forty-eight hours later, the stories published simultaneously. ProPublica, New York Times, STAT.
              Same documents. Same evidence. Cross-verified against public Medicare data. FBI field office in
              Minneapolis opened an investigation that afternoon.
            </p>
            <p style={{ marginBottom: '20px', textIndent: '30px' }}>
              Sarah still works at the hospital. Still reconciles billing reports. Still has coffee with the same coworkers.
              The CEO was arrested at his home on a Tuesday morning. The CFO turned witness. Nobody knows who leaked the documents.
              Nobody ever will.
            </p>
            <p style={{ textIndent: '30px', color: 'rgb(0,255,136)', fontStyle: 'italic' }}>
              Three journalists approved publication. Fifty IPFS nodes store the evidence. One person stayed anonymous.
              Zero printer tracking dots. Zero IP logs. Zero ways to identify the source. This is what changes.
            </p>
          </div>
        </div>
      </div>
    </div>,

    // Slide 9: Threat model - What we defend against
    <div className="slide fade-in" key="9">
      <div className="container">
        <h1 style={{ fontSize: '36px', marginBottom: '50px', whiteSpace: 'nowrap', textAlign: 'center' }}>What happens when they come for us</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', background: 'rgb(255,0,0)', marginBottom: '40px' }}>
          <div style={{ background: '#000', padding: '28px' }}>
            <div style={{ fontSize: '18px', marginBottom: '12px', color: 'rgb(255,100,100)' }}>They subpoena our server logs</div>
            <div style={{ fontSize: '14px', color: 'rgb(180,180,180)', lineHeight: '1.7' }}>
              Logs show Tor exit node IPs, not real sources. Timestamps show evidence submitted, but files encrypted.
              CIDs are hashes, reveal nothing. No correlation possible.
            </div>
            <div className="highlight" style={{ fontSize: '13px', marginTop: '12px' }}>
              → Sources safe. Files encrypted. No way to identify.
            </div>
          </div>

          <div style={{ background: '#000', padding: '28px' }}>
            <div style={{ fontSize: '18px', marginBottom: '12px', color: 'rgb(255,100,100)' }}>They seize our domain</div>
            <div style={{ fontSize: '14px', color: 'rgb(180,180,180)', lineHeight: '1.7' }}>
              Platform accessible via .onion (Tor hidden service) and .i2p (I2P destination). No DNS needed.
              Can't seize cryptographic addresses. Users switch to hidden service.
            </div>
            <div className="highlight" style={{ fontSize: '13px', marginTop: '12px' }}>
              → Platform continues. Access uninterrupted.
            </div>
          </div>

          <div style={{ background: '#000', padding: '28px' }}>
            <div style={{ fontSize: '18px', marginBottom: '12px', color: 'rgb(255,100,100)' }}>They arrest 2 board members</div>
            <div style={{ fontSize: '14px', color: 'rgb(180,180,180)', lineHeight: '1.7' }}>
              Need 3 of 5 to publish. Remaining 3 members can still sign. FROST threshold unchanged.
              Arrested members can't be forced to reveal sources (they don't know).
            </div>
            <div className="highlight" style={{ fontSize: '13px', marginTop: '12px' }}>
              → System operational. Other 3 continue publishing.
            </div>
          </div>

          <div style={{ background: '#000', padding: '28px' }}>
            <div style={{ fontSize: '18px', marginBottom: '12px', color: 'rgb(255,100,100)' }}>They shut down our IPFS nodes</div>
            <div style={{ fontSize: '14px', color: 'rgb(180,180,180)', lineHeight: '1.7' }}>
              Files pinned on web3.storage (Filecoin-backed), pinata.cloud, ipfs.io gateway, and 50+ independent nodes.
              Different jurisdictions. Can't shut down all of them.
            </div>
            <div className="highlight" style={{ fontSize: '13px', marginTop: '12px' }}>
              → Files persist. Redundancy across providers.
            </div>
          </div>

          <div style={{ background: '#000', padding: '28px' }}>
            <div style={{ fontSize: '18px', marginBottom: '12px', color: 'rgb(255,100,100)' }}>They compromise Tor exit nodes</div>
            <div style={{ fontSize: '14px', color: 'rgb(180,180,180)', lineHeight: '1.7' }}>
              We run .onion hidden service. No exit nodes in circuit. Traffic stays in Tor network.
              Plus I2P fallback. Plus evidence encrypted before leaving browser.
            </div>
            <div className="highlight" style={{ fontSize: '13px', marginTop: '12px' }}>
              → No exit nodes involved. Hidden service only.
            </div>
          </div>

          <div style={{ background: '#000', padding: '28px' }}>
            <div style={{ fontSize: '18px', marginBottom: '12px', color: 'rgb(255,100,100)' }}>They demand we decrypt evidence</div>
            <div style={{ fontSize: '14px', color: 'rgb(180,180,180)', lineHeight: '1.7' }}>
              We don't have viewing keys. Board members have viewing keys. Encrypted client-side before upload.
              Server only sees encrypted blob. Can't decrypt even if we want to.
            </div>
            <div className="highlight" style={{ fontSize: '13px', marginTop: '12px' }}>
              → Cryptographically impossible. No keys to hand over.
            </div>
          </div>
        </div>

        <div style={{ background: 'rgb(10,10,10)', padding: '32px', border: '1px solid rgb(0, 255, 136)' }}>
          <div style={{ fontSize: '20px', marginBottom: '16px' }} className="highlight">
            The only way to stop this platform
          </div>
          <div style={{ fontSize: '16px', lineHeight: '1.8' }}>
            Shut down Zcash blockchain (billions in market cap, thousands of nodes). Shut down NEAR (major L1).
            Shut down IPFS (used by NFT.storage, Filecoin, thousands of apps). Shut down Tor (used by millions daily).
            Arrest all 5 board members simultaneously across different countries.
            <br/><br/>
            <span className="highlight">Not happening.</span> Too many independent pieces. Too many jurisdictions.
            Too many users depending on same infrastructure.
          </div>
        </div>
      </div>
    </div>,

    // Slide 10: End - Back to human story
    <div className="slide fade-in" key="10" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '900px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', color: 'rgb(100,100,100)', marginBottom: '40px', letterSpacing: '3px' }}>
          ZKFIED
        </div>

        <h1 className="medium-text" style={{ marginBottom: '60px', lineHeight: '1.2' }}>
          The next whistleblower<br/>
          shouldn't have to choose<br/>
          between revealing corruption<br/>
          and staying alive
        </h1>

        <div style={{ fontSize: '14px', color: 'rgb(100,100,100)', marginBottom: '40px', letterSpacing: '2px' }}>
          LIVE ON TESTNET
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '60px', fontSize: '13px' }}>
          <div>
            <div className="highlight" style={{ marginBottom: '6px' }}>Platform</div>
            <div>zkfied.vercel.app</div>
          </div>
          <div>
            <div className="highlight" style={{ marginBottom: '6px' }}>Backend</div>
            <div>zkfied-frost-testnet.fly.dev</div>
          </div>
          <div>
            <div className="highlight" style={{ marginBottom: '6px' }}>NEAR</div>
            <div>reg.mrhashfox.testnet</div>
          </div>
          <div>
            <div className="highlight" style={{ marginBottom: '6px' }}>Mina</div>
            <div style={{ fontSize: '9px' }}>B62qjLQo287BXoY...</div>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'rgb(80,80,80)' }}>
          Mainnet deployment Q1 2026
        </div>
      </div>
    </div>
  ]

  return (
    <div>
      <div className="slide-number">
        {currentSlide + 1} / 10
      </div>

      {slides[currentSlide]}

      <div className="nav">
        <button
          className="nav-btn"
          onClick={prevSlide}
          disabled={currentSlide === 0}
        >
          Previous
        </button>
        <button
          className="nav-btn"
          onClick={nextSlide}
          disabled={currentSlide === 9}
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default App
