import { create } from 'zustand'
import { Evidence, EvidenceFormData, FilterCriteria, EvidencePreview, EvidenceStats } from '@/types'
import { api } from '@/services/api'

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
  evidenceList: [],
  filteredEvidence: [],
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
      if (!submitFormData.title || !submitFormData.files?.length || !submitFormData.board_category) {
        throw new Error('Missing required fields')
      }

      const response = await api.submitEvidence({
        title: submitFormData.title,
        description: submitFormData.description || '',
        board_category: submitFormData.board_category as any,
        files: submitFormData.files,
        viewing_keys: submitFormData.viewing_keys || [],
        mina_credential: submitFormData.mina_credential
      })

      const newEvidence: Evidence = {
        id: response.evidence_id,
        title: submitFormData.title,
        description: submitFormData.description || '',
        category: submitFormData.category || 'other',
        evidenceType: submitFormData.evidenceType || 'document',
        privacyLevel: submitFormData.privacyLevel || 'fully_private',
        submittedAt: new Date().toISOString(),
        status: response.status === 'confirmed' ? 'verified' : 'submitted',
        chain: submitFormData.chain || 'zcash',
        zsaTokenId: response.zcash_txid || undefined,
        ipfsCid: response.ipfs_cid,
        zcashTxId: response.zcash_txid || undefined
      }

      get().addEvidence(newEvidence)
      get().clearForm()

    } catch (error) {
      console.error('Evidence submission failed:', error)
      set({ error: error instanceof Error ? error.message : 'Failed to submit evidence' })
      throw error
    } finally {
      set({ isSubmitting: false })
    }
  },

  fetchEvidence: async (filters?: FilterCriteria) => {
    set({ isLoading: true, error: null })

    try {
      const indices = await api.getAllEvidenceIndex()

      const evidenceList: (Evidence | null)[] = await Promise.all(
        indices.map(async (index) => {
          try {
            const metadata = await api.getIpfsEvidence(index.ipfs_cid)

            return {
              id: index.evidence_id,
              title: metadata.title,
              description: metadata.description,
              category: index.board_category as any,
              evidenceType: 'document' as const,
              privacyLevel: 'selective_disclosure' as const,
              submittedAt: index.created_at,
              status: index.status === 'confirmed' ? 'verified' : index.status === 'failed' ? 'submitted' : 'submitted',
              chain: 'zcash' as const,
              zsaTokenId: index.zcash_txid,
              ipfsCid: index.ipfs_cid,
              zcashTxId: index.zcash_txid
            } as Evidence
          } catch (err) {
            console.error(`Failed to fetch metadata for ${index.evidence_id}:`, err)
            return null
          }
        })
      )

      const validEvidence = evidenceList.filter(e => e !== null) as Evidence[]
      set({ evidenceList: validEvidence, filteredEvidence: validEvidence })

      if (filters) {
        get().setFilter(filters)
      }

    } catch (error) {
      console.error('Failed to fetch evidence:', error)
      set({ error: error instanceof Error ? error.message : 'Failed to fetch evidence' })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchEvidenceById: async (id: string) => {
    set({ isLoading: true, error: null })

    try {
      const index = await api.getEvidenceIndex(id)
      const metadata = await api.getIpfsEvidence(index.ipfs_cid)

      const evidence: Evidence = {
        id: index.evidence_id,
        title: metadata.title,
        description: metadata.description,
        category: index.board_category as any,
        evidenceType: 'document',
        privacyLevel: 'selective_disclosure',
        submittedAt: index.created_at,
        status: index.status === 'confirmed' ? 'verified' : 'submitted',
        chain: 'zcash',
        zsaTokenId: index.zcash_txid,
        ipfsCid: index.ipfs_cid,
        zcashTxId: index.zcash_txid,
        files: metadata.files?.map(f => ({
          name: f.filename,
          cid: f.cid,
          size: f.size,
          type: f.type
        }))
      }

      set({ currentEvidence: evidence })
      return evidence

    } catch (error) {
      console.error('Failed to fetch evidence by ID:', error)
      set({ error: error instanceof Error ? error.message : 'Evidence not found' })
      return null
    } finally {
      set({ isLoading: false })
    }
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