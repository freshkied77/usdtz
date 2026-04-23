import { cn } from '@/lib/utils'

interface SkeletonProps {
  variant?: 'text' | 'card' | 'circle' | 'table-row'
  className?: string
}

export default function Skeleton({ variant = 'text', className }: SkeletonProps) {
  const variants = {
    text: 'h-4 w-full rounded-md',
    card: 'h-48 w-full rounded-2xl',
    circle: 'h-10 w-10 rounded-full',
    'table-row': 'h-16 w-full rounded-xl',
  }

  return (
    <div className={cn('skeleton', variants[variant], className)} />
  )
}
