// Mock evidence data with government/classified themed images
// Images will be processed with halftone B&W effects

export interface MockEvidence {
  id: number
  title: string
  description: string
  category: 'government_censorship' | 'corporate_suppression' | 'media_blackout' | 'whistleblower_retaliation' | 'surveillance_overreach' | 'other'
  privacyLevel: 'fully_private' | 'selective_disclosure' | 'public_anonymous'
  chain: 'zcash' | 'near'
  status: 'verified' | 'published' | 'pending'
  submittedAt: string
  zsaTokenId: string
  image: string // Path to processed government/classified image
}

export const mockEvidenceData: MockEvidence[] = [
  {
    id: 1,
    title: 'GOVERNMENT_DATABASE_BREACH',
    description: 'Documentation of unauthorized access to citizen records database. Internal memos and access logs showing systematic exploitation of privacy laws.',
    category: 'government_censorship',
    privacyLevel: 'selective_disclosure',
    chain: 'zcash',
    status: 'verified',
    submittedAt: '2024-01-15T10:30:00Z',
    zsaTokenId: 'zsa1evid8f2a9d1c3e4b5',
    image: '/images/government-database.jpg'
  },
  {
    id: 2,
    title: 'CORPORATE_WHISTLEBLOWER_RETALIATION',
    description: 'Internal emails and HR documents showing coordinated effort to silence employee reporting financial misconduct. Timeline of threats and wrongful termination.',
    category: 'whistleblower_retaliation',
    privacyLevel: 'fully_private',
    chain: 'near',
    status: 'verified',
    submittedAt: '2024-01-14T15:45:00Z',
    zsaTokenId: 'zsa1evid7e3f8b2d9c1a4',
    image: '/images/corporate-retaliation.jpg'
  }
]

// Helper functions for filtering and sorting
export const getCategoryLabel = (category: MockEvidence['category']): string => {
  const labels: Record<MockEvidence['category'], string> = {
    government_censorship: 'Government Censorship',
    corporate_suppression: 'Corporate Suppression', 
    media_blackout: 'Media Blackout',
    whistleblower_retaliation: 'Whistleblower Retaliation',
    surveillance_overreach: 'Surveillance Overreach',
    other: 'Other'
  }
  return labels[category]
}

export const getPrivacyLabel = (level: MockEvidence['privacyLevel']): string => {
  const labels: Record<MockEvidence['privacyLevel'], string> = {
    fully_private: 'Fully Private',
    selective_disclosure: 'Selective Disclosure',
    public_anonymous: 'Public Anonymous'
  }
  return labels[level]
}

export const getStatusBadgeClass = (status: MockEvidence['status']): string => {
  const classes = {
    verified: 'bg-terminal-hover text-terminal-white',
    published: 'bg-terminal-hover text-terminal-white',
    pending: 'bg-terminal text-terminal-secondary'
  }
  return classes[status]
}