import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'

// Layout components
import Navbar from '@/components/shared/Navbar'
import Footer from '@/components/shared/Footer'

// Pages
import HomePage from '@/components/pages/HomePage'
import SubmitEvidencePage from '@/components/pages/SubmitEvidencePage'
import BrowseEvidencePage from '@/components/pages/BrowseEvidencePage'
import CrossChainPage from '@/components/pages/CrossChainPage'
import ProfilePage from '@/components/pages/ProfilePage'
import EvidenceDetailPage from '@/components/pages/EvidenceDetailPage'

// Layout wrapper component
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-void text-terminal-white flex flex-col">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

// Route tracker for UI state
const RouteTracker: React.FC = () => {
  const location = useLocation()
  const setCurrentPage = useUIStore(state => state.setCurrentPage)
  
  useEffect(() => {
    setCurrentPage(location.pathname)
  }, [location.pathname, setCurrentPage])
  
  return null
}

function App() {
  const { setDarkMode } = useUIStore()
  
  // Initialize dark mode on app start
  useEffect(() => {
    setDarkMode(true)
  }, [setDarkMode])

  return (
    <Router>
      <RouteTracker />
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/submit" element={<SubmitEvidencePage />} />
          <Route path="/browse" element={<BrowseEvidencePage />} />
          <Route path="/evidence/:evidenceId" element={<EvidenceDetailPage />} />
          <Route path="/crosschain" element={<CrossChainPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Catch-all route for 404 */}
          <Route path="*" element={
            <div className="container py-24 text-center">
              <h1 className="text-hero text-terminal-white mb-6 font-mono">[404]</h1>
              <p className="text-body-large text-terminal-secondary mb-8 font-mono">
                &gt; PAGE_NOT_FOUND
              </p>
              <a 
                href="/" 
                className="text-terminal-white hover:text-terminal-active transition-colors font-mono"
              >
                [RETURN_TO_HOME]
              </a>
            </div>
          } />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App