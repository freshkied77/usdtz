'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export default function ProgressBar({ value, max = 100, label, showValue = true, size = 'sm', className }: ProgressBarProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const percentage = Math.min((value / max) * 100, 100)

  return (
    <div ref={ref} className={cn('space-y-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-gray-400">{label}</span>}
          {showValue && <span className="font-medium">{percentage.toFixed(0)}%</span>}
        </div>
      )}
      <div className={cn('w-full bg-white/10 rounded-full overflow-hidden', size === 'sm' ? 'h-2' : 'h-3')}>
        <motion.div
          initial={{ width: 0 }}
          animate={isInView ? { width: `${percentage}%` } : {}}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
        />
      </div>
    </div>
  )
}
