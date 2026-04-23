'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | React.ReactNode
  change?: string
  icon?: React.ReactNode
  className?: string
}

export default function StatCard({ label, value, change, icon, className }: StatCardProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const isPositive = change ? !change.startsWith('-') : true

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4 }}
      className={cn('glass-card p-5', className)}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-400 font-medium">{label}</p>
        {icon && <div className="text-primary-400">{icon}</div>}
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {change && (
        <div className={cn('flex items-center gap-1 mt-2 text-sm font-medium', isPositive ? 'text-green-400' : 'text-red-400')}>
          {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span>{change}</span>
        </div>
      )}
    </motion.div>
  )
}
