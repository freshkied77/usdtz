'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
  variant?: 'underline' | 'pill'
  className?: string
}

export default function Tabs({ tabs, activeTab, onChange, variant = 'pill', className }: TabsProps) {
  return (
    <div className={cn('flex gap-2', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
            activeTab === tab.id
              ? 'text-dark-300'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className={cn(
                'absolute inset-0 rounded-xl',
                variant === 'pill'
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600'
                  : 'bg-primary-500/20 border border-primary-500/40'
              )}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
        </button>
      ))}
    </div>
  )
}
