import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary'
  size?: 'sm' | 'md'
  dot?: boolean
  className?: string
}

export default function Badge({ children, variant = 'primary', size = 'sm', dot, className }: BadgeProps) {
  const variants = {
    success: 'bg-green-500/15 text-green-400 border-green-500/20',
    warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    danger: 'bg-red-500/15 text-red-400 border-red-500/20',
    info: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    primary: 'bg-primary-500/15 text-primary-400 border-primary-500/20',
    secondary: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  }

  const dotColors = {
    success: 'bg-green-400',
    warning: 'bg-yellow-400',
    danger: 'bg-red-400',
    info: 'bg-blue-400',
    primary: 'bg-primary-400',
    secondary: 'bg-gray-400',
  }

  const sizes = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', dotColors[variant])} />
      )}
      {children}
    </span>
  )
}
