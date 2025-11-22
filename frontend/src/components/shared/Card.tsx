import React from 'react'
import clsx from 'clsx'
import { CardProps } from '@/types'

const Card: React.FC<CardProps> = ({
  children,
  className,
  hover = true,
  padding = 'md',
  onClick,
  ...props
}) => {
  const baseStyles = 'terminal-card'
  
  const paddingStyles = {
    sm: 'p-4',
    md: 'p-6', 
    lg: 'p-8'
  }
  
  return (
    <div
      className={clsx(
        baseStyles,
        paddingStyles[padding],
        {
          'cursor-pointer': hover && onClick,
        },
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
      {/* Add corner markers manually if needed for full corners */}
      <div className="corner-bl absolute bottom-0 left-0 transform translate-x-[-12px] translate-y-[12px] text-terminal-secondary">+</div>
      <div className="corner-br absolute bottom-0 right-0 transform translate-x-[12px] translate-y-[12px] text-terminal-secondary">+</div>
    </div>
  )
}

export default Card