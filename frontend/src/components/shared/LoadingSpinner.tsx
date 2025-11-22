import React from 'react'
import clsx from 'clsx'
import { LoadingSpinnerProps } from '@/types'

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
  ...props
}) => {
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }
  
  return (
    <div
      className={clsx(
        'animate-spin rounded-full border-2 border-terminal-dark border-t-terminal-white',
        sizeStyles[size],
        className
      )}
      {...props}
    />
  )
}

export default LoadingSpinner