import { cn } from '@/lib/utils'

const TOKEN_COLORS: Record<string, string> = {
  BNB: 'from-yellow-400 to-orange-500',
  USDT: 'from-green-400 to-emerald-500',
  USDTZ: 'from-primary-400 to-orange-500',
  BUSD: 'from-yellow-300 to-yellow-500',
  ETH: 'from-blue-400 to-indigo-500',
  BTCB: 'from-orange-400 to-orange-600',
  MATIC: 'from-purple-400 to-purple-600',
}

interface TokenIconProps {
  symbol: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TokenIcon({ symbol, size = 'md', className }: TokenIconProps) {
  const sizes = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  }

  const gradient = TOKEN_COLORS[symbol] || 'from-gray-400 to-gray-600'

  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white border-2 border-dark-300',
        gradient,
        sizes[size],
        className
      )}
    >
      {symbol[0]}
    </div>
  )
}

interface TokenPairProps {
  token0: string
  token1: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function TokenPair({ token0, token1, size = 'md', className }: TokenPairProps) {
  return (
    <div className={cn('flex -space-x-2', className)}>
      <TokenIcon symbol={token0} size={size} />
      <TokenIcon symbol={token1} size={size} />
    </div>
  )
}
