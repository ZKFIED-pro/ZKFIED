import { useState } from 'react'
import { useWallet } from './useWallet'
import { EvidenceHashParams, VerificationParams, CrossChainEvidence } from '@/types'
import {
  getNearConnection,
  getEvidenceRegistryContract,
  getEvidenceIndexerContract,
  getTippingContract
} from '@/utils/nearConnection'
import * as nearAPI from 'near-api-js'

export const useNEARContract = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { isConnected, callNearContract } = useWallet()

  const storeEvidenceHash = async (params: EvidenceHashParams) => {
    if (!isConnected) {
      throw new Error('Wallet not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const { wallet, config } = await getNearConnection()
      const contract = getEvidenceRegistryContract(wallet, config.registryContractId) as any

      const result = await contract.register_evidence({
        args: {
          evidence_id: params.evidenceId,
          board: params.category,
          ipfs_cid: params.ipfsCid,
          zcash_tx_hash: params.zcashTxHash,
          commitment_hash: params.commitmentHash || '',
          frost_signatures: params.frostSignatures || [],
          metadata: {
            timestamp: params.timestamp,
            submitter: params.submitter || null
          }
        },
        gas: '300000000000000',
        amount: nearAPI.utils.format.parseNearAmount('0.1') || '0'
      })

      console.log('Evidence registered on NEAR:', result)
      return result

    } catch (error) {
      const errorMsg = 'Failed to register evidence on NEAR'
      setError(errorMsg)
      console.error('NEAR registration failed:', error)
      throw new Error(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const verifyZcashEvidence = async (params: VerificationParams): Promise<boolean> => {
    if (!isConnected) {
      throw new Error('Wallet not connected')
    }

    try {
      const { wallet, config } = await getNearConnection()
      const contract = getEvidenceRegistryContract(wallet, config.registryContractId) as any

      const isValid = await contract.verify_evidence_commitment({
        evidence_id: params.evidenceId,
        provided_hash: params.commitmentHash
      })

      if (params.submitVerification) {
        await contract.submit_verification({
          args: {
            evidence_id: params.evidenceId,
            is_valid: isValid,
            verifier_notes: params.verifierNotes || ''
          },
          gas: '300000000000000',
          amount: nearAPI.utils.format.parseNearAmount('0.01') || '0'
        })
      }

      console.log('Evidence verification result:', isValid)
      return isValid

    } catch (error) {
      console.error('NEAR evidence verification failed:', error)
      return false
    }
  }

  const queryEvidence = async (evidenceId: string): Promise<CrossChainEvidence | null> => {
    try {
      const { wallet, config } = await getNearConnection()
      const contract = getEvidenceRegistryContract(wallet, config.registryContractId) as any

      const evidenceData = await contract.get_evidence({
        evidence_id: evidenceId
      })

      if (!evidenceData) {
        return null
      }

      const evidence: CrossChainEvidence = {
        evidenceId: evidenceData.evidence_id,
        zcashTxHash: evidenceData.zcash_tx_hash,
        nearTxHash: evidenceData.near_tx_hash || '',
        ipfsCid: evidenceData.ipfs_cid,
        category: evidenceData.board,
        timestamp: evidenceData.timestamp,
        verified: evidenceData.status === 'Verified',
        verificationBlock: evidenceData.verification_block || 0,
        commitmentHash: evidenceData.commitment_hash,
        frostSignatures: evidenceData.frost_signatures
      }

      return evidence

    } catch (error) {
      console.error('NEAR evidence query failed:', error)
      return null
    }
  }

  const getBridgeStatus = async (txHash: string) => {
    try {
      return {
        sourceChain: 'zcash' as const,
        targetChain: 'near' as const,
        sourceTxHash: txHash,
        targetTxHash: `near_bridge_${txHash}`,
        status: 'completed' as const,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('Bridge status query failed:', error)
      throw error
    }
  }

  const indexEvidence = async (evidenceMetadata: {
    evidenceId: string
    title: string
    category: string
    tags: string[]
    submissionDate: string
  }) => {
    try {
      const { wallet, config } = await getNearConnection()
      const contract = getEvidenceIndexerContract(wallet, config.indexerContractId) as any

      const result = await contract.index_evidence({
        args: evidenceMetadata,
        gas: '300000000000000',
        amount: nearAPI.utils.format.parseNearAmount('0.005') || '0'
      })

      return result

    } catch (error) {
      console.error('Evidence indexing failed:', error)
      throw error
    }
  }

  const searchEvidence = async (query: {
    keywords?: string[]
    category?: string
    dateRange?: { start: string; end: string }
    limit?: number
    offset?: number
  }) => {
    try {
      const { wallet, config } = await getNearConnection()
      const contract = getEvidenceIndexerContract(wallet, config.indexerContractId) as any

      const results = await contract.search_evidence(query)

      return {
        results: results || [],
        total: results?.length || 0,
        hasMore: false
      }

    } catch (error) {
      console.error('Evidence search failed:', error)
      throw error
    }
  }

  const getTipBalance = async (evidenceId: string) => {
    try {
      const { wallet, config } = await getNearConnection()
      const contract = getTippingContract(wallet, config.tippingContractId) as any

      const tipData = await contract.get_tips_for_evidence({ evidence_id: evidenceId })

      return {
        evidenceId,
        totalTips: tipData?.total_amount || '0',
        tipCount: tipData?.tip_count || 0,
        topTipper: tipData?.top_tipper || '',
        lastTipDate: tipData?.last_tip_date || ''
      }

    } catch (error) {
      console.error('Tip balance query failed:', error)
      throw error
    }
  }

  const tipEvidence = async (evidenceId: string, amount: string, message?: string) => {
    if (!isConnected) {
      throw new Error('Wallet not connected')
    }

    try {
      const { wallet, config } = await getNearConnection()
      const contract = getTippingContract(wallet, config.tippingContractId) as any

      const result = await contract.tip_evidence({
        args: {
          evidence_id: evidenceId,
          message: message || ''
        },
        gas: '300000000000000',
        amount: nearAPI.utils.format.parseNearAmount(amount) || '0'
      })

      return result

    } catch (error) {
      console.error('Tipping failed:', error)
      throw error
    }
  }

  return {
    // State
    isLoading,
    error,
    
    // Evidence management
    storeEvidenceHash,
    verifyZcashEvidence,
    queryEvidence,
    indexEvidence,
    
    // Search functionality
    searchEvidence,
    
    // Bridge operations
    getBridgeStatus,
    
    // Tipping system
    getTipBalance,
    tipEvidence,
    
    // Utilities
    clearError: () => setError(null)
  }
}