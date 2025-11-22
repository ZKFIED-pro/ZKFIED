import React from 'react'
import clsx from 'clsx'
import { ButtonProps } from '@/types'
import LoadingSpinner from './LoadingSpinner'

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  children,
  onClick,
  type = 'button',
  className,
  ...props
}) => {
  const baseStyles = 'bracket-btn inline-flex items-center justify-center gap-2 font-mono'
  
  const variantStyles = {
    primary: 'primary',
    secondary: '',
    danger: 'border-red-500 text-red-500 hover:border-red-400 hover:text-red-400'
  }
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }
  
  return (
    <button
      type={type}
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        {
          'w-full': fullWidth,
          'opacity-50 cursor-not-allowed': disabled || loading,
        },
        className
      )}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" />
          <span>LOADING...</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

export default Button