import { useWalletStore } from '@/stores/walletStore'
import { WalletType, TransactionRequest, TransactionResult } from '@/types'
import { useWebZjs } from './useWebZjs'

export const useWallet = () => {
  const {
    isConnected,
    address,
    balance,
    status,
    selectedChain,
    error,
    isConnecting,
    connectWallet: connectWalletStore,
    disconnectWallet,
    switchChain,
    updateBalance,
    sendTransaction,
    signMessage
  } = useWalletStore()
  
  const webzjs = useWebZjs()

  const connect = async (walletType: WalletType) => {
    try {
      if (walletType === 'webzjs') {
        const connected = await webzjs.connectSnap()
        
        if (connected) {
          try {
            const viewingKey = await webzjs.getViewingKey(window.location.origin)
            await connectWalletStore(walletType)
          } catch (error) {
          }
        } else {
          throw new Error('Failed to connect to WebZjs Snap')
        }
      } else if (walletType === 'ywallet') {
        // TODO: Integrate yWallet for Zcash
        console.log('TODO: Integrate yWallet SDK')
        console.log('Will connect to Zcash via yWallet...')
        
        // For now, use mock connection from store
        await connectWalletStore(walletType)
      } else if (walletType === 'near-wallet' || walletType === 'here-wallet') {
        // TODO: Integrate Near Wallet Selector
        console.log('TODO: Integrate Near Wallet Selector')
        console.log(`Will connect to NEAR via ${walletType}...`)
        
        // For now, use mock connection from store
        await connectWalletStore(walletType)
      }
    } catch (error) {
      console.error('Wallet connection failed:', error)
      throw error
    }
  }

  const disconnect = () => {
    // TODO: Disconnect from wallet
    console.log('Disconnecting wallet...')
    disconnectWallet()
  }

  const getBalance = async () => {
    // TODO: Fetch wallet balance from blockchain
    console.log('Fetching wallet balance...')
    await updateBalance()
  }

  const submitTransaction = async (request: TransactionRequest): Promise<TransactionResult> => {
    // TODO: Submit transaction to appropriate blockchain
    console.log('Submitting transaction:', request)
    
    if (request.chain === 'zcash') {
      console.log('TODO: Submit to Zcash network via yWallet')
    } else if (request.chain === 'near') {
      console.log('TODO: Submit to NEAR network via wallet selector')
    }
    
    return await sendTransaction(request)
  }

  const sign = async (message: string): Promise<string> => {
    // TODO: Sign message with connected wallet
    console.log('Signing message:', message)
    return await signMessage(message)
  }

  // Utility functions for Zcash-specific operations
  const createShieldedTransaction = async (params: {
    recipient: string
    amount: string
    memo?: string
    privacyLevel: 'transparent' | 'shielded'
  }) => {
    try {
      console.log('Creating shielded transaction with WebZjs:', params)
      
      // Use WebZjs to sign the transaction
      const signedTx = await webzjs.signPczt(
        params.recipient,
        params.amount,
        params.memo
      )
      
      console.log('Transaction signed:', signedTx.substring(0, 20) + '...')
      
      return await submitTransaction({
        type: 'evidence_submission',
        chain: 'zcash',
        data: {
          ...params,
          signedTransaction: signedTx
        }
      })
    } catch (error) {
      console.error('Failed to create shielded transaction:', error)
      throw error
    }
  }

  // Utility functions for NEAR-specific operations
  const callNearContract = async (params: {
    contractId: string
    methodName: string
    args: Record<string, any>
    attachedDeposit?: string
  }) => {
    // TODO: Call NEAR contract method
    console.log('TODO: Call NEAR contract method', params)
    
    return await submitTransaction({
      type: 'evidence_submission',
      chain: 'near',
      data: params
    })
  }

  return {
    // State
    isConnected,
    address,
    balance,
    status,
    selectedChain,
    error,
    isConnecting,
    
    // Actions
    connect,
    disconnect,
    getBalance,
    submitTransaction,
    sign,
    switchChain,
    
    // Chain-specific utilities
    createShieldedTransaction,
    callNearContract,
    
    // WebZjs specific
    webzjs: {
      isConnected: webzjs.isConnected,
      isInstalled: webzjs.isInstalled,
      getViewingKey: webzjs.getViewingKey,
      getSeedFingerprint: webzjs.getSeedFingerprint,
      setBirthdayBlock: webzjs.setBirthdayBlock,
      getSnapState: webzjs.getSnapState,
      setSnapState: webzjs.setSnapState,
      signPczt: webzjs.signPczt,
      error: webzjs.error,
    }
  }
}