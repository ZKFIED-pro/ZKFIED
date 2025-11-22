import { create } from 'zustand'
import { ToastNotification } from '@/types'

interface UIStore {
  // Layout state
  sidebarOpen: boolean
  darkMode: boolean
  
  // Modal state
  activeModal: string | null
  modalProps: Record<string, any>
  
  // Toast notifications
  toasts: ToastNotification[]
  
  // Loading states
  pageLoading: boolean
  globalLoading: boolean
  
  // Navigation
  currentPage: string
  previousPage: string | null
  
  // Actions
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleDarkMode: () => void
  setDarkMode: (dark: boolean) => void
  
  openModal: (modalId: string, props?: Record<string, any>) => void
  closeModal: () => void
  
  addToast: (toast: Omit<ToastNotification, 'id'>) => void
  removeToast: (id: string) => void
  clearAllToasts: () => void
  
  setPageLoading: (loading: boolean) => void
  setGlobalLoading: (loading: boolean) => void
  
  setCurrentPage: (page: string) => void
  
  // UI preferences
  preferences: {
    animationsEnabled: boolean
    compactMode: boolean
    autoSave: boolean
  }
  updatePreferences: (prefs: Partial<UIStore['preferences']>) => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  // Initial state
  sidebarOpen: false,
  darkMode: true, // Default to dark mode for ZKFIED
  
  activeModal: null,
  modalProps: {},
  
  toasts: [],
  
  pageLoading: false,
  globalLoading: false,
  
  currentPage: '/',
  previousPage: null,
  
  preferences: {
    animationsEnabled: true,
    compactMode: false,
    autoSave: true
  },

  // Actions
  toggleSidebar: () => {
    set(state => ({ sidebarOpen: !state.sidebarOpen }))
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open })
  },

  toggleDarkMode: () => {
    const newDarkMode = !get().darkMode
    set({ darkMode: newDarkMode })
    
    // Update document class for theme
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  },

  setDarkMode: (dark: boolean) => {
    set({ darkMode: dark })
    
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  },

  openModal: (modalId: string, props = {}) => {
    set({
      activeModal: modalId,
      modalProps: props
    })
  },

  closeModal: () => {
    set({
      activeModal: null,
      modalProps: {}
    })
  },

  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newToast: ToastNotification = {
      id,
      duration: 5000, // Default 5 seconds
      ...toast
    }
    
    set(state => ({
      toasts: [...state.toasts, newToast]
    }))
    
    // Auto-remove toast after duration
    setTimeout(() => {
      get().removeToast(id)
    }, newToast.duration || 5000)
  },

  removeToast: (id: string) => {
    set(state => ({
      toasts: state.toasts.filter(toast => toast.id !== id)
    }))
  },

  clearAllToasts: () => {
    set({ toasts: [] })
  },

  setPageLoading: (loading: boolean) => {
    set({ pageLoading: loading })
  },

  setGlobalLoading: (loading: boolean) => {
    set({ globalLoading: loading })
  },

  setCurrentPage: (page: string) => {
    set(state => ({
      previousPage: state.currentPage,
      currentPage: page
    }))
  },

  updatePreferences: (prefs) => {
    set(state => ({
      preferences: { ...state.preferences, ...prefs }
    }))
  }
}))

// Selector hooks for common UI state
export const useSidebarOpen = () => useUIStore(state => state.sidebarOpen)
export const useActiveModal = () => useUIStore(state => state.activeModal)
export const useToasts = () => useUIStore(state => state.toasts)
export const usePageLoading = () => useUIStore(state => state.pageLoading)
export const useDarkMode = () => useUIStore(state => state.darkMode)

// Utility functions for common UI actions
export const useToastActions = () => {
  const { addToast, removeToast, clearAllToasts } = useUIStore()
  
  return {
    showSuccess: (message: string, title = 'Success') =>
      addToast({ type: 'success', title, message }),
    
    showError: (message: string, title = 'Error') =>
      addToast({ type: 'error', title, message }),
    
    showWarning: (message: string, title = 'Warning') =>
      addToast({ type: 'warning', title, message }),
    
    showInfo: (message: string, title = 'Info') =>
      addToast({ type: 'info', title, message }),
    
    removeToast,
    clearAllToasts
  }
}