import React, { useState } from 'react'
import { Upload, FileText, Image, Video, Mic, Shield, Eye, Globe, Zap } from 'lucide-react'
import Button from '@/components/shared/Button'
import Card from '@/components/shared/Card'
import { useEvidenceForm, useEvidencePreview } from '@/stores/evidenceStore'
import { useEvidenceSubmission } from '@/hooks/useEvidenceSubmission'
import { useWallet } from '@/hooks/useWallet'
import { EvidenceCategory, EvidenceType, PrivacyLevel } from '@/types'

const SubmitEvidencePage: React.FC = () => {
  const formData = useEvidenceForm()
  const preview = useEvidencePreview()
  const { setFormData, isSubmitting, submit, clearForm } = useEvidenceSubmission()
  const { isConnected } = useWallet()
  
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleInputChange = (field: string, value: any) => {
    setFormData({ [field]: value })
  }

  const handleFileUpload = (files: FileList) => {
    const fileArray = Array.from(files)
    handleInputChange('files', fileArray)
    
    // Mock upload progress
    setUploadProgress(0)
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 10
      })
    }, 200)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }
    
    if (!formData.title || !formData.description) {
      alert('Please fill in required fields')
      return
    }

    try {
      await submit({
        title: formData.title || '',
        description: formData.description || '',
        category: formData.category || 'other',
        evidenceType: formData.evidenceType || 'document',
        privacyLevel: formData.privacyLevel || 'fully_private',
        chain: formData.chain || 'zcash',
        files: formData.files || [],
        metadata: {
          timestamp: new Date().toISOString(),
          tags: [],
          classification: 'sensitive'
        }
      })
      
      alert('Evidence submitted successfully!')
      clearForm()
      
    } catch (error) {
      alert('Failed to submit evidence. Please try again.')
    }
  }

  const categoryOptions: { value: EvidenceCategory; label: string }[] = [
    { value: 'government_censorship', label: 'Government Censorship' },
    { value: 'corporate_suppression', label: 'Corporate Suppression' },
    { value: 'media_blackout', label: 'Media Blackout' },
    { value: 'whistleblower_retaliation', label: 'Whistleblower Retaliation' },
    { value: 'surveillance_overreach', label: 'Surveillance Overreach' },
    { value: 'other', label: 'Other' }
  ]

  const evidenceTypeOptions: { value: EvidenceType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'document', label: 'Document', icon: FileText },
    { value: 'image', label: 'Image', icon: Image },
    { value: 'video', label: 'Video', icon: Video },
    { value: 'audio', label: 'Audio', icon: Mic },
    { value: 'communication', label: 'Communication', icon: FileText },
    { value: 'metadata', label: 'Metadata', icon: FileText }
  ]

  const privacyLevelOptions: { 
    value: PrivacyLevel
    label: string
    description: string
    icon: React.ComponentType<{ className?: string }>
  }[] = [
    {
      value: 'fully_private',
      label: 'Fully Private',
      description: 'Only you can view',
      icon: Shield
    },
    {
      value: 'selective_disclosure',
      label: 'Selective Disclosure',
      description: 'Share with trusted recipients',
      icon: Eye
    },
    {
      value: 'public_anonymous',
      label: 'Public Anonymous',
      description: 'Anonymously published',
      icon: Globe
    }
  ]

  return (
    <div className="py-8 md:py-12 animate-fade-in">
      <div className="container">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-display text-terminal-white font-mono mb-4">
              [SUBMIT_EVIDENCE]
            </h1>
            <p className="text-terminal-secondary max-w-2xl font-mono">
              &gt; SUBMIT_CENSORSHIP_EVIDENCE_WITH_CRYPTOGRAPHIC_ANONYMITY_GUARANTEES<br/>              &gt; YOUR_IDENTITY_REMAINS_PROTECTED_THROUGH_ZCASH_SHIELDED_PROTOCOLS
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Form - Left Column (60%) */}
            <div className="lg:col-span-3">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Evidence Details */}
                <Card>
                  <h2 className="text-section text-terminal-white font-mono mb-6">
                    [EVIDENCE_DETAILS]
                  </h2>
                  
                  <div className="space-y-6">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-terminal-white font-mono mb-2">
                        [TITLE] *
                      </label>
                      <div className="form-group">
                        <input
                          type="text"
                          className="w-full bg-terminal border-2 border-terminal-dark text-terminal-white font-mono px-4 py-3 focus:border-terminal-light focus:bg-terminal-void transition-colors"
                          placeholder="&gt; ENTER_TITLE_HERE"
                          value={formData.title || ''}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          maxLength={200}
                          required
                        />
                      </div>
                      <div className="text-xs text-terminal-secondary mt-1 font-mono">
                        [{(formData.title?.length || 0)}/200_CHARS]
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-terminal-white font-mono mb-2">
                        [DESCRIPTION] *
                      </label>
                      <div className="form-group">
                        <textarea
                          className="w-full bg-terminal border-2 border-terminal-dark text-terminal-white font-mono px-4 py-3 h-32 resize-none focus:border-terminal-light focus:bg-terminal-void transition-colors"
                          placeholder="&gt; ENTER_DESCRIPTION_HERE&NewLine;&gt; PROVIDE_DETAILED_EVIDENCE_CONTEXT&NewLine;&gt; EXPLAIN_SIGNIFICANCE"
                          value={formData.description || ''}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          maxLength={5000}
                          required
                        />
                      </div>
                      <div className="text-xs text-terminal-secondary mt-1 font-mono">
                        [{(formData.description?.length || 0)}/5000_CHARS]
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-terminal-white font-mono mb-2">
                        [CATEGORY] *
                      </label>
                      <div className="form-group">
                        <select
                          className="w-full bg-terminal border-2 border-terminal-dark text-terminal-white font-mono px-4 py-3 focus:border-terminal-light focus:bg-terminal-void transition-colors"
                          value={formData.category || ''}
                          onChange={(e) => handleInputChange('category', e.target.value as EvidenceCategory)}
                          required
                        >
                          <option value="">[SELECT_CATEGORY]</option>
                          {categoryOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              [{option.label.toUpperCase()}]
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Evidence Type */}
                    <div>
                      <label className="block text-sm font-medium text-terminal-white font-mono mb-3">
                        [EVIDENCE_TYPE] *
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {evidenceTypeOptions.map((option) => {
                          const IconComponent = option.icon
                          const isSelected = formData.evidenceType === option.value
                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={`bracket-btn p-4 transition-colors text-left ${
                                isSelected
                                  ? 'border-terminal-active bg-terminal-hover text-terminal-white'
                                  : 'border-terminal-dark bg-terminal text-terminal-secondary hover:border-terminal-light'
                              }`}
                              onClick={() => handleInputChange('evidenceType', option.value)}
                            >
                              <IconComponent className="w-5 h-5 mb-2" />
                              <div className="text-sm font-medium font-mono">[{option.label.toUpperCase()}]</div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* File Upload */}
                    <div>
                      <label className="block text-sm font-medium text-terminal-white font-mono mb-3">
                        [FILES]
                      </label>
                      <div
                        className={`border-2 border-dashed p-8 text-center transition-colors form-group ${
                          dragActive
                            ? 'border-terminal-active bg-terminal-hover'
                            : 'border-terminal-dark hover:border-terminal-light'
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                      >
                        <Upload className="w-8 h-8 text-terminal-active mx-auto mb-4" />
                        <p className="text-terminal-white mb-2 font-mono">
                          [DROP_FILES_HERE] OR [CLICK_TO_BROWSE]
                        </p>
                        <p className="text-terminal-secondary text-sm font-mono">
                          SUPPORTS: IMAGES | DOCUMENTS | VIDEO | AUDIO
                        </p>
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.mp4,.mp3,.wav"
                        />
                        {uploadProgress > 0 && uploadProgress < 100 && (
                          <div className="mt-4">
                            <div className="w-full bg-terminal-dark rounded-full h-2">
                              <div
                                className="bg-terminal-active h-2 rounded-full transition-all"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {formData.files && formData.files.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {formData.files.map((file, index) => (
                            <div key={index} className="flex items-center gap-3 p-3 bg-terminal-hover rounded border border-terminal-dark">
                              <FileText className="w-4 h-4 text-terminal-active" />
                              <span className="text-sm text-terminal-white">{file.name}</span>
                              <span className="text-xs text-terminal-secondary ml-auto">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Privacy Settings */}
                <Card>
                  <h2 className="text-section text-terminal-white font-mono mb-6">
                    [PRIVACY_SETTINGS]
                  </h2>
                  
                  <div className="space-y-6">
                    {/* Privacy Level */}
                    <div>
                      <label className="block text-sm font-medium text-terminal-white font-mono mb-3">
                        [DISCLOSURE_LEVEL] *
                      </label>
                      <div className="space-y-3">
                        {privacyLevelOptions.map((option) => {
                          const IconComponent = option.icon
                          const isSelected = formData.privacyLevel === option.value
                          return (
                            <button
                              key={option.value}
                              type="button"
                              className={`w-full bracket-btn p-4 transition-colors text-left ${
                                isSelected
                                  ? 'border-terminal-active bg-terminal-hover'
                                  : 'border-terminal-dark bg-terminal hover:border-terminal-light'
                              }`}
                              onClick={() => handleInputChange('privacyLevel', option.value)}
                            >
                              <div className="flex items-start gap-3">
                                <IconComponent className={`w-5 h-5 mt-0.5 ${
                                  isSelected ? 'text-terminal-white' : 'text-terminal-primary'
                                }`} />
                                <div>
                                  <div className={`font-medium font-mono ${
                                    isSelected ? 'text-terminal-white' : 'text-terminal-primary'
                                  }`}>
                                    [{option.label.toUpperCase()}]
                                  </div>
                                  <div className="text-sm text-terminal-secondary font-mono">
                                    {option.description.toUpperCase()}
                                  </div>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Chain Selection */}
                <Card>
                  <h2 className="text-section text-terminal-white font-mono mb-6">
                    [NETWORK_SELECTION]
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      className={`bracket-btn p-4 transition-colors text-left ${
                        formData.chain === 'zcash'
                          ? 'border-terminal-active bg-terminal-hover'
                          : 'border-terminal-dark bg-terminal hover:border-terminal-light'
                      }`}
                      onClick={() => handleInputChange('chain', 'zcash')}
                    >
                      <div className="flex items-center gap-3">
                        <Shield className={`w-6 h-6 ${
                          formData.chain === 'zcash' ? 'text-terminal-white' : 'text-terminal-primary'
                        }`} />
                        <div>
                          <div className={`font-medium font-mono ${
                            formData.chain === 'zcash' ? 'text-terminal-white' : 'text-terminal-primary'
                          }`}>
                            [ZCASH]
                          </div>
                          <div className="text-sm text-terminal-secondary font-mono">
                            MAXIMUM_PRIVACY_WITH_SHIELDED_TRANSACTIONS
                          </div>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      type="button"
                      className={`bracket-btn p-4 transition-colors text-left ${
                        formData.chain === 'near'
                          ? 'border-terminal-active bg-terminal-hover'
                          : 'border-terminal-dark bg-terminal hover:border-terminal-light'
                      }`}
                      onClick={() => handleInputChange('chain', 'near')}
                    >
                      <div className="flex items-center gap-3">
                        <Zap className={`w-6 h-6 ${
                          formData.chain === 'near' ? 'text-terminal-white' : 'text-terminal-primary'
                        }`} />
                        <div>
                          <div className={`font-medium font-mono ${
                            formData.chain === 'near' ? 'text-terminal-white' : 'text-terminal-primary'
                          }`}>
                            [NEAR]
                          </div>
                          <div className="text-sm text-terminal-secondary font-mono">
                            CROSS_CHAIN_VERIFICATION_AND_INDEXING
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </Card>

                {/* Submit Button */}
                <div className="flex items-center gap-4">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={isSubmitting}
                    disabled={!isConnected || !formData.title || !formData.description}
                    fullWidth
                  >
                    {isSubmitting ? '[GENERATING_ZSA_TOKEN...]' : '[SUBMIT_EVIDENCE]'}
                  </Button>
                </div>
                
                {!isConnected && (
                  <p className="text-terminal-secondary text-sm text-center font-mono">
                    [PLEASE_CONNECT_WALLET_TO_SUBMIT_EVIDENCE]
                  </p>
                )}
              </form>
            </div>

            {/* Live Preview - Right Column (40%) */}
            <div className="lg:col-span-2">
              <div className="sticky top-24">
                <Card>
                  <h2 className="text-section text-terminal-white font-mono mb-6">
                    [LIVE_PREVIEW]
                  </h2>
                  
                  {preview ? (
                    <div className="space-y-4">
                      {/* Preview Card */}
                      <div className="border border-terminal-dark rounded bg-terminal-hover p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-card-title text-terminal-white font-mono font-card mb-1">
                              {preview.title}
                            </h3>
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`px-2 py-1 rounded text-terminal-white bg-terminal`}>
                                {preview.privacyLevel.replace('_', ' ')}
                              </span>
                              <span className="text-terminal-secondary">
                                {preview.chain.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <Shield className="w-5 h-5 text-terminal-active" />
                        </div>
                        
                        <p className="text-terminal-secondary text-sm mb-4 line-clamp-3">
                          {preview.description}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-terminal-secondary">
                          <span>{preview.category.replace('_', ' ')}</span>
                          <span className="font-mono">
                            {new Date(preview.timestamp).toLocaleString()}
                          </span>
                        </div>
                        
                        {preview.estimatedSize > 0 && (
                          <div className="mt-3 pt-3 border-t border-terminal-dark">
                            <div className="text-xs text-terminal-secondary">
                              Estimated size: {(preview.estimatedSize / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Mock ZSA Token ID */}
                      <div className="text-center p-4 bg-terminal border border-terminal-dark rounded">
                        <div className="text-xs text-terminal-secondary mb-2">
                          Mock ZSA Token ID
                        </div>
                        <div className="text-code text-terminal-active font-mono break-all">
                          zsa1{Math.random().toString(36).substring(2, 15)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-terminal-secondary">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Fill out the form to see a preview of your evidence submission</p>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubmitEvidencePage