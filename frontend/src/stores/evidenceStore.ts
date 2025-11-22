import { create } from 'zustand'
import { Evidence, EvidenceFormData, FilterCriteria, EvidencePreview, EvidenceStats } from '@/types'

interface EvidenceStore {
  // Evidence data
  evidenceList: Evidence[]
  filteredEvidence: Evidence[]
  currentEvidence: Evidence | null
  
  // Form state
  submitFormData: Partial<EvidenceFormData>
  formPreview: EvidencePreview | null
  
  // Filters and search
  filterCriteria: FilterCriteria
  searchQuery: string
  
  // UI state
  isLoading: boolean
  isSubmitting: boolean
  error: string | null
  
  // Stats
  stats: EvidenceStats
  
  // Actions
  setFilter: (criteria: Partial<FilterCriteria>) => void
  setSearchQuery: (query: string) => void
  addEvidence: (evidence: Evidence) => void
  updateEvidence: (id: string, updates: Partial<Evidence>) => void
  setFormData: (data: Partial<EvidenceFormData>) => void
  updateFormPreview: () => void
  submitEvidence: () => Promise<void>
  fetchEvidence: (filters?: FilterCriteria) => Promise<void>
  fetchEvidenceById: (id: string) => Promise<Evidence | null>
  clearForm: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

// Mock data
const mockEvidence: Evidence[] = [
  {
    id: 'ev-001',
    title: 'Government Database Breach Evidence',
    description: 'Documentation of unauthorized access to citizen surveillance systems. Contains server logs, access records, and internal communications revealing systematic privacy violations.',
    category: 'government_censorship',
    evidenceType: 'document',
    privacyLevel: 'selective_disclosure',
    submittedAt: '2024-01-15T10:30:00Z',
    status: 'verified',
    chain: 'zcash',
    zsaTokenId: 'zsa1evidence001',
    ipfsCid: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco'
  },
  {
    id: 'ev-002', 
    title: 'Corporate Whistleblower Retaliation',
    description: 'Internal emails and HR documents showing systematic targeting of employees who reported safety violations.',
    category: 'whistleblower_retaliation',
    evidenceType: 'communication',
    privacyLevel: 'fully_private',
    submittedAt: '2024-01-14T08:45:00Z',
    status: 'verified',
    chain: 'near',
    ipfsCid: 'QmYwAPJzv5CZsnA8rdVS1F5mCJ5XQEG2VNE94z2UYZzZN6'
  },
  {
    id: 'ev-003',
    title: 'Media Suppression Campaign Documents',
    description: 'Leaked strategy documents outlining coordinated efforts to suppress investigative journalism.',
    category: 'media_blackout',
    evidenceType: 'document',
    privacyLevel: 'public_anonymous',
    submittedAt: '2024-01-13T16:20:00Z',
    status: 'published',
    chain: 'zcash',
    zsaTokenId: 'zsa1evidence003'
  }
]

export const useEvidenceStore = create<EvidenceStore>((set, get) => ({
  // Initial state
  evidenceList: mockEvidence,
  filteredEvidence: mockEvidence,
  currentEvidence: null,
  
  submitFormData: {},
  formPreview: null,
  
  filterCriteria: {
    categories: [],
    privacyLevels: [],
    chains: []
  },
  searchQuery: '',
  
  isLoading: false,
  isSubmitting: false,
  error: null,
  
  stats: {
    totalSubmissions: 2847,
    verifiedEvidence: 2203,
    activeChains: 2,
    anonymityGuarantee: '100%'
  },

  // Actions
  setFilter: (criteria: Partial<FilterCriteria>) => {
    const newCriteria = { ...get().filterCriteria, ...criteria }
    set({ filterCriteria: newCriteria })
    
    // Apply filters
    const { evidenceList, searchQuery } = get()
    let filtered = evidenceList
    
    // Filter by categories
    if (newCriteria.categories.length > 0) {
      filtered = filtered.filter(ev => newCriteria.categories.includes(ev.category))
    }
    
    // Filter by privacy levels
    if (newCriteria.privacyLevels.length > 0) {
      filtered = filtered.filter(ev => newCriteria.privacyLevels.includes(ev.privacyLevel))
    }
    
    // Filter by chains
    if (newCriteria.chains.length > 0) {
      filtered = filtered.filter(ev => newCriteria.chains.includes(ev.chain as any))
    }
    
    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(ev => 
        ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    set({ filteredEvidence: filtered })
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
    get().setFilter({}) // Reapply filters with search
  },

  addEvidence: (evidence: Evidence) => {
    const evidenceList = [...get().evidenceList, evidence]
    set({ evidenceList, filteredEvidence: evidenceList })
  },

  updateEvidence: (id: string, updates: Partial<Evidence>) => {
    const evidenceList = get().evidenceList.map(ev =>
      ev.id === id ? { ...ev, ...updates } : ev
    )
    set({ evidenceList, filteredEvidence: evidenceList })
  },

  setFormData: (data: Partial<EvidenceFormData>) => {
    const newFormData = { ...get().submitFormData, ...data }
    set({ submitFormData: newFormData })
    get().updateFormPreview()
  },

  updateFormPreview: () => {
    const { submitFormData } = get()
    
    if (submitFormData.title || submitFormData.description) {
      const preview: EvidencePreview = {
        title: submitFormData.title || 'Untitled Evidence',
        description: submitFormData.description || 'No description provided',
        category: submitFormData.category || 'other',
        privacyLevel: submitFormData.privacyLevel || 'fully_private',
        chain: submitFormData.chain || 'zcash',
        estimatedSize: submitFormData.files?.reduce((size, file) => size + file.size, 0) || 0,
        timestamp: new Date().toISOString()
      }
      set({ formPreview: preview })
    } else {
      set({ formPreview: null })
    }
  },

  submitEvidence: async () => {
    const { submitFormData } = get()
    set({ isSubmitting: true, error: null })
    
    try {
      console.log('Submitting evidence:', submitFormData)
      
      // Mock submission process
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Create new evidence entry
      const newEvidence: Evidence = {
        id: `ev-${Date.now()}`,
        title: submitFormData.title || 'Untitled Evidence',
        description: submitFormData.description || '',
        category: submitFormData.category || 'other',
        evidenceType: submitFormData.evidenceType || 'document',
        privacyLevel: submitFormData.privacyLevel || 'fully_private',
        submittedAt: new Date().toISOString(),
        status: 'submitted',
        chain: submitFormData.chain || 'zcash',
        zsaTokenId: `zsa1evidence${Date.now()}`
      }
      
      get().addEvidence(newEvidence)
      get().clearForm()
      
    } catch (error) {
      set({ error: 'Failed to submit evidence' })
    } finally {
      set({ isSubmitting: false })
    }
  },

  fetchEvidence: async (filters?: FilterCriteria) => {
    set({ isLoading: true, error: null })
    
    try {
      console.log('Fetching evidence with filters:', filters)
      
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // In real implementation, fetch from backend
      // For now, just use mock data
      set({ evidenceList: mockEvidence, filteredEvidence: mockEvidence })
      
    } catch (error) {
      set({ error: 'Failed to fetch evidence' })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchEvidenceById: async (id: string) => {
    console.log('Fetching evidence by ID:', id)
    
    // Mock fetch
    const evidence = mockEvidence.find(ev => ev.id === id)
    set({ currentEvidence: evidence || null })
    
    return evidence || null
  },

  clearForm: () => {
    set({
      submitFormData: {},
      formPreview: null
    })
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading })
  },

  setError: (error: string | null) => {
    set({ error })
  }
}))

// Selectors
export const useEvidenceList = () => useEvidenceStore(state => state.filteredEvidence)
export const useEvidenceForm = () => useEvidenceStore(state => state.submitFormData)
export const useEvidencePreview = () => useEvidenceStore(state => state.formPreview)
export const useEvidenceStats = () => useEvidenceStore(state => state.stats)