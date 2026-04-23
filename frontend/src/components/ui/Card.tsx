'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  variant?: 'default' | 'highlight' | 'interactive'
  className?: string
  padding?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export default function Card({ children, variant = 'default', className, padding = 'md', onClick }: CardProps) {
  const variants = {
    default: 'glass-card',
    highlight: 'glass-card-highlight',
    interactive: 'glass-card cursor-pointer',
  }

  const paddings = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  if (variant === 'interactive') {
    return (
      <motion.div
        whileHover={{ y: -4, boxShadow: '0 8px 30px rgba(255, 215, 0, 0.1)' }}
        transition={{ duration: 0.2 }}
        onClick={onClick}
        className={cn(variants[variant], paddings[padding], className)}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div onClick={onClick} className={cn(variants[variant], paddings[padding], className)}>
      {children}
    </div>
  )
}
