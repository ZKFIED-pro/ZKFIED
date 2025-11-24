import { useWalletStore } from '@/stores/walletStore'
import { WalletType, TransactionRequest, TransactionResult } from '@/types'
import { useWebZjs } from './useWebZjs'
import { getNearConnection, signIn, signOut, isSignedIn, getAccountId } from '@/utils/nearConnection'

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
        console.log('Will connect to Zcash via yWallet...')
        await connectWalletStore(walletType)
      } else if (walletType === 'near-wallet' || walletType === 'here-wallet') {
        await signIn()
        const accountId = await getAccountId()
        if (accountId) {
          await connectWalletStore(walletType)
        }
      }
    } catch (error) {
      console.error('Wallet connection failed:', error)
      throw error
    }
  }

  const disconnect = async () => {
    if (selectedChain === 'near') {
      await signOut()
    }
    disconnectWallet()
  }

  const getBalance = async () => {
    await updateBalance()
  }

  const submitTransaction = async (request: TransactionRequest): Promise<TransactionResult> => {
    console.log('Submitting transaction:', request)
    return await sendTransaction(request)
  }

  const sign = async (message: string): Promise<string> => {
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

  const callNearContract = async (params: {
    contractId: string
    methodName: string
    args: Record<string, any>
    attachedDeposit?: string
  }) => {
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