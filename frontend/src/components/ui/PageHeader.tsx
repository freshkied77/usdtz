'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import Badge from './Badge'

interface PageHeaderProps {
  title: string
  subtitle?: string
  gradient?: boolean
  action?: React.ReactNode
  status?: { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }
  className?: string
}

export default function PageHeader({ title, subtitle, gradient, action, status, className }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn('flex items-start justify-between mb-8', className)}
    >
      <div>
        <h1 className={cn('text-3xl font-bold mb-2', gradient && 'gradient-text')}>
          {title}
        </h1>
        {subtitle && <p className="text-gray-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {status && (
          <Badge variant={status.variant} dot>
            {status.label}
          </Badge>
        )}
        {action}
      </div>
    </motion.div>
  )
}
