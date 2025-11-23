import { useState, useCallback } from 'react'

const WEBZJS_SNAP_ID = 'npm:@chainsafe/webzjs-zcash-snap'
const WEBZJS_SNAP_VERSION = '^0.2.7'

interface WebZjsState {
  isConnected: boolean
  isInstalled: boolean
  snapState: any
  provider: any
  error: string | null
}

interface WebZjsActions {
  connectSnap: () => Promise<boolean>
  invokeSnap: (method: string, params?: any) => Promise<any>
  getViewingKey: (origin: string) => Promise<string>
  signPczt: (recipient: string, amount: string, memo?: string) => Promise<string>
  getSeedFingerprint: () => Promise<string>
  setBirthdayBlock: (blockNumber?: number) => Promise<void>
  getSnapState: () => Promise<any>
  setSnapState: (state: any) => Promise<void>
}

export const useWebZjs = (): WebZjsState & WebZjsActions => {
  const [state, setState] = useState<WebZjsState>({
    isConnected: false,
    isInstalled: false,
    snapState: null,
    provider: null,
    error: null,
  })

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }))
    if (error) {
      setTimeout(() => setState(prev => ({ ...prev, error: null })), 10000)
    }
  }, [])

  const connectSnap = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, error: null }))

      // Check if MetaMask is available
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed. Please install MetaMask and try again.')
      }

      // First try to detect Snaps support
      let snapsSupported = false
      try {
        await window.ethereum.request({ method: 'wallet_getSnaps' })
        snapsSupported = true
      } catch (err: any) {
        console.error('Snaps detection failed:', err)
        if (err.code === -32601) {
          throw new Error('MetaMask Snaps are not supported. You need MetaMask Flask or a newer version (v10.25.0+) that supports Snaps.')
        }
        throw new Error('Unable to detect MetaMask Snaps support. Please ensure you have a compatible MetaMask version.')
      }

      if (!snapsSupported) {
        throw new Error('MetaMask Snaps are not available in your current MetaMask version.')
      }

      const snapId = WEBZJS_SNAP_ID

      // Check if snap is already installed
      let existingSnaps: any = {}
      try {
        existingSnaps = await window.ethereum.request({
          method: 'wallet_getSnaps',
        })
        console.log('Existing snaps:', Object.keys(existingSnaps))
      } catch (err) {
        console.warn('Failed to get existing snaps:', err)
      }

      const isInstalled = snapId in existingSnaps
      if (isInstalled) {
        const isConnected = existingSnaps[snapId].enabled
        console.log('WebZjs snap already installed, enabled:', isConnected)
        setState(prev => ({
          ...prev,
          isConnected,
          isInstalled: true,
          provider: window.ethereum,
        }))
        return isConnected
      }

      // Try to install/request the snap
      console.log('Requesting WebZjs snap installation...')
      try {
        const requestResult = await window.ethereum.request({
          method: 'wallet_requestSnaps',
          params: {
            [snapId]: {
              version: WEBZJS_SNAP_VERSION,
            },
          },
        })
        
        console.log('Snap installation result:', requestResult)

        // Verify installation
        const updatedSnaps = await window.ethereum.request({
          method: 'wallet_getSnaps',
        })

        const newlyInstalled = snapId in updatedSnaps
        const isConnected = newlyInstalled && updatedSnaps[snapId].enabled

        console.log('Post-installation check - installed:', newlyInstalled, 'connected:', isConnected)

        setState(prev => ({
          ...prev,
          isConnected,
          isInstalled: newlyInstalled,
          provider: window.ethereum,
        }))

        if (!newlyInstalled) {
          throw new Error('WebZjs snap installation failed. Please try installing manually from https://webzjs.chainsafe.dev')
        }

        return isConnected
      } catch (err: any) {
        console.error('Snap installation error:', err)
        
        if (err.code === 4001) {
          throw new Error('WebZjs snap installation was cancelled. Please approve the installation to continue.')
        }
        
        if (err.code === -32601) {
          throw new Error('MetaMask Snaps are not supported. You need MetaMask Flask or a newer version that supports Snaps.')
        }
        
        if (err.code === -32603) {
          throw new Error('WebZjs snap is not available in the snap registry. Please install it manually from https://webzjs.chainsafe.dev')
        }
        
        if (err.message?.includes('does not exist')) {
          throw new Error('WebZjs snap not found. Please install it manually from the official page.')
        }
        
        throw new Error(`WebZjs snap installation failed: ${err.message || 'Please try installing manually from https://webzjs.chainsafe.dev'}`)
      }
    } catch (error: any) {
      console.error('WebZjs connection error:', error)
      setError(error.message || 'Failed to connect to WebZjs snap')
      return false
    }
  }, [setError])

  const invokeSnap = useCallback(async (method: string, params?: any): Promise<any> => {
    if (!state.provider) {
      throw new Error('WebZjs snap not connected')
    }

    try {
      const result = await state.provider.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: WEBZJS_SNAP_ID,
          request: {
            method,
            params,
          },
        },
      })
      return result
    } catch (error: any) {
      setError(error.message || `Failed to invoke ${method}`)
      throw error
    }
  }, [state.provider, setError])

  const getViewingKey = useCallback(async (origin: string): Promise<string> => {
    return invokeSnap('getViewingKey', { origin })
  }, [invokeSnap])

  const signPczt = useCallback(async (
    recipient: string, 
    amount: string, 
    memo?: string
  ): Promise<string> => {
    return invokeSnap('signPczt', { recipient, amount, memo })
  }, [invokeSnap])

  const getSeedFingerprint = useCallback(async (): Promise<string> => {
    return invokeSnap('getSeedFingerprint')
  }, [invokeSnap])

  const setBirthdayBlock = useCallback(async (blockNumber?: number): Promise<void> => {
    return invokeSnap('setBirthdayBlock', { latestBlockNum: blockNumber })
  }, [invokeSnap])

  const getSnapState = useCallback(async (): Promise<any> => {
    const snapState = await invokeSnap('getSnapState')
    setState(prev => ({ ...prev, snapState }))
    return snapState
  }, [invokeSnap])

  const setSnapState = useCallback(async (newState: any): Promise<void> => {
    await invokeSnap('setSnapState', { state: newState })
    setState(prev => ({ ...prev, snapState: newState }))
  }, [invokeSnap])

  return {
    ...state,
    connectSnap,
    invokeSnap,
    getViewingKey,
    signPczt,
    getSeedFingerprint,
    setBirthdayBlock,
    getSnapState,
    setSnapState,
  }
}