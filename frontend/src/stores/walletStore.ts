import { create } from 'zustand'
import { WalletState, Chain, WalletType, TransactionResult } from '@/types'

interface WalletStore extends WalletState {
  // Actions
  connectWallet: (walletType: WalletType) => Promise<void>
  disconnectWallet: () => void
  switchChain: (chain: Chain) => Promise<void>
  updateBalance: () => Promise<void>
  
  // Transaction methods
  sendTransaction: (tx: any) => Promise<TransactionResult>
  signMessage: (message: string) => Promise<string>
  
  // State management
  setConnecting: (connecting: boolean) => void
  setError: (error: string | null) => void
  error: string | null
  isConnecting: boolean
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  // Initial state
  isConnected: false,
  address: null,
  selectedChain: 'zcash',
  balance: {
    zcash: {
      transparent: '0',
      shielded: '0',
      zsaTokens: []
    },
    near: {
      native: '0',
      contracts: []
    }
  },
  status: 'disconnected',
  error: null,
  isConnecting: false,

  // Actions
  connectWallet: async (walletType: WalletType) => {
    set({ isConnecting: true, error: null })
    
    try {
      // Mock wallet connection - replace with actual implementation
      console.log(`Connecting to ${walletType}...`)
      
      // Simulate async connection
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock successful connection
      const mockAddress = walletType === 'ywallet' 
        ? 'zs1abc...def' 
        : 'alice.near'
      
      set({
        isConnected: true,
        address: mockAddress,
        status: 'connected',
        isConnecting: false,
        balance: {
          zcash: {
            transparent: '1.25',
            shielded: '4.75',
            zsaTokens: [
              {
                assetId: 'zsa1evidence001',
                name: 'Evidence #001',
                description: 'Government Censorship Evidence',
                balance: '1',
                isEvidence: true,
                evidenceId: 'ev-001'
              }
            ]
          },
          near: {
            native: '12.5',
            contracts: [
              {
                contractId: 'evidence.zkfied.near',
                balance: '3',
                symbol: 'EVD'
              }
            ]
          }
        }
      })
    } catch (error) {
      set({
        error: 'Failed to connect wallet',
        isConnecting: false,
        status: 'error'
      })
    }
  },

  disconnectWallet: () => {
    set({
      isConnected: false,
      address: null,
      status: 'disconnected',
      error: null,
      balance: {
        zcash: {
          transparent: '0',
          shielded: '0',
          zsaTokens: []
        },
        near: {
          native: '0',
          contracts: []
        }
      }
    })
  },

  switchChain: async (chain: Chain) => {
    console.log(`Switching to ${chain} chain...`)
    set({ selectedChain: chain })
    
    // Update balance for new chain
    get().updateBalance()
  },

  updateBalance: async () => {
    if (!get().isConnected) return
    
    try {
      // Mock balance update
      console.log('Updating wallet balance...')
      
      // In real implementation, fetch from blockchain
      // For now, just log the action
    } catch (error) {
      set({ error: 'Failed to update balance' })
    }
  },

  sendTransaction: async (tx: any): Promise<TransactionResult> => {
    console.log('Sending transaction:', tx)
    
    // Mock transaction
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    return {
      hash: '0xabc123...',
      status: 'pending',
      blockHeight: 123456
    }
  },

  signMessage: async (message: string): Promise<string> => {
    console.log('Signing message:', message)
    
    // Mock signing
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return 'mock_signature_' + Date.now()
  },

  setConnecting: (connecting: boolean) => {
    set({ isConnecting: connecting })
  },

  setError: (error: string | null) => {
    set({ error })
  }
}))

// Selectors for easier state access
export const useWalletAddress = () => useWalletStore(state => state.address)
export const useWalletBalance = () => useWalletStore(state => state.balance)
export const useWalletStatus = () => useWalletStore(state => state.status)
export const useIsWalletConnected = () => useWalletStore(state => state.isConnected)