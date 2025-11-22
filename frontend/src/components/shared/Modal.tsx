import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { ModalProps } from '@/types'
import { X } from 'lucide-react'

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])
  
  if (!isOpen) return null
  
  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }
  
  const modalContent = (
    <div className="fixed inset-0 z-modal-backdrop">
      {/* Backdrop */}
      <div
        className={clsx('modal-overlay fixed inset-0', {
          active: isOpen
        })}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={clsx(
              'modal-content relative w-full bg-terminal border border-terminal-dark rounded-lg shadow-xl',
              sizeStyles[size],
              {
                active: isOpen
              },
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {title && (
              <div className="flex items-center justify-between p-6 border-b border-terminal-dark">
                <h3 className="text-section text-terminal-white font-mono">
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="text-terminal-secondary hover:text-terminal-white transition-colors p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            )}
            
            {/* Content */}
            <div className={clsx('p-6', { 'pt-6': !title })}>
              {children}
            </div>
            
            {/* Close button if no title */}
            {!title && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-terminal-secondary hover:text-terminal-white transition-colors p-1"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
  
  return createPortal(modalContent, document.body)
}

export default Modal