'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  onMax?: () => void
  balance?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, onMax, balance, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-400">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10',
              'text-white placeholder:text-gray-500',
              'input-focus-ring outline-none transition-all duration-200',
              'hover:border-white/20',
              icon && 'pl-11',
              error && 'border-red-500/50 focus:border-red-500',
              className
            )}
            {...props}
          />
        </div>
        {(balance || onMax) && (
          <div className="flex items-center justify-between text-sm">
            {balance && <span className="text-gray-400">{balance}</span>}
            {onMax && (
              <button
                type="button"
                onClick={onMax}
                className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
              >
                MAX
              </button>
            )}
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
