'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Inbox } from 'lucide-react'
import { useAccount } from 'wagmi'
import { formatEther } from 'viem'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Tabs from '@/components/ui/Tabs'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import AnimatedSection from '@/components/ui/AnimatedSection'
import { TokenPair } from '@/components/ui/TokenIcon'
import Skeleton from '@/components/ui/Skeleton'
import {
  useTotalTVL,
  usePoolInfo,
  useLiquidityMiningPool,
} from '@/hooks/useContracts'
import { USDTZ_CONFIG } from '@/lib/config'

// Supported token pairs for pool queries
const SUPPORTED_TOKENS = [
  { symbol: 'WBNB', address: USDTZ_CONFIG.tokens.wbnb, decimals: 18 },
  { symbol: 'USDT', address: USDTZ_CONFIG.tokens.usdt, decimals: 18 },
  { symbol: 'BUSD', address: USDTZ_CONFIG.tokens.busd, decimals: 18 },
  { symbol: 'ETH', address: USDTZ_CONFIG.tokens.eth, decimals: 18 },
  { symbol: 'BTC', address: USDTZ_CONFIG.tokens.btc, decimals: 18 },
]

// Format number with abbreviations
function formatNumber(value: string | number, decimals = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(decimals)}B`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(decimals)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(decimals)}K`
  return num.toFixed(decimals)
}

// Format USD value
function formatUSD(value: string | number): string {
  return `$${formatNumber(value)}`
}

// Parse pool data from contract result
interface PoolData {
  token0: string
  token1: string
  tvl: string
  apr: string
  volume24h: string
  fee: string
  weight: string
  userDeposit: string
  pendingRewards: string
}

function usePoolData() {
  const [pools, setPools] = useState<PoolData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get total TVL
  const { data: totalTVLData, isLoading: tvlLoading } = useTotalTVL()

  // Query pool info for each token
  const poolQueries = SUPPORTED_TOKENS.map((token) =>
    usePoolInfo(token.address)
  )

  useEffect(() => {
    const allLoading = tvlLoading || poolQueries.some((q) => q.isLoading)
    setLoading(allLoading)

    if (allLoading) return

    try {
      const poolData: PoolData[] = poolQueries
        .map((query, index) => {
          const token = SUPPORTED_TOKENS[index]
          const data = query.data

          if (!data || !Array.isArray(data) || data.length < 4) {
            return null
          }

          // PoolManager.getPoolInfo returns (weight, tvl, userDeposit, pendingRewards)
          const [weight, tvl, userDeposit, pendingRewards] = data as [
            bigint,
            bigint,
            bigint,
            bigint
          ]

          const tvlNum = Number(formatEther(tvl || BigInt(0)))
          const pendingRewardsNum = Number(formatEther(pendingRewards || BigInt(0)))

          // Calculate mock APR based on pending rewards relative to TVL
          // In production, this would come from the LiquidityMining contract
          const apr = tvlNum > 0 ? ((pendingRewardsNum * 365 * 100) / tvlNum).toFixed(2) : '0.00'

          // Mock 24h volume (would come from AMM or oracle in production)
          const volume24h = tvlNum > 0 ? (tvlNum * 0.08).toFixed(2) : '0.00'

          return {
            token0: token.symbol,
            token1: 'USDTZ',
            tvl: tvlNum.toString(),
            apr: `${apr}%`,
            volume24h: volume24h,
            fee: '0.25%',
            weight: weight?.toString() || '0',
            userDeposit: formatEther(userDeposit || BigInt(0)),
            pendingRewards: formatEther(pendingRewards || BigInt(0)),
          } as PoolData
        })
        .filter((p): p is PoolData => p !== null)

      setPools(poolData)
      setError(null)
    } catch (err) {
      console.error('Error parsing pool data:', err)
      setError('Failed to load pool data')
      setPools([])
    }
  }, [tvlLoading, poolQueries])

  return {
    pools,
    loading,
    error,
    totalTVL: totalTVLData ? formatEther(totalTVLData as bigint) : '0',
  }
}

// User position data
interface UserPosition {
  token0: string
  token1: string
  amount: string
  value: string
  share: string
  earnings: string
  apr: string
  isActive: boolean
}

function useUserPositions() {
  const { address } = useAccount()
  const [positions, setPositions] = useState<UserPosition[]>([])
  const [loading, setLoading] = useState(false)

  // For each supported token, query user deposit from pool
  const poolQueries = SUPPORTED_TOKENS.map((token) => usePoolInfo(token.address))

  useEffect(() => {
    if (!address) {
      setPositions([])
      return
    }

    const allLoading = poolQueries.some((q) => q.isLoading)
    setLoading(allLoading)

    if (allLoading) return

    try {
      const userPositions: UserPosition[] = poolQueries
        .map((query, index) => {
          const token = SUPPORTED_TOKENS[index]
          const data = query.data

          if (!data || !Array.isArray(data) || data.length < 4) {
            return null
          }

          // PoolManager.getPoolInfo returns (weight, tvl, userDeposit, pendingRewards)
          const [weight, tvl, userDeposit, pendingRewards] = data as [
            bigint,
            bigint,
            bigint,
            bigint
          ]

          const userDepositNum = Number(formatEther(userDeposit || BigInt(0)))
          const tvlNum = Number(formatEther(tvl || BigInt(0)))

          // Skip if user has no deposit
          if (userDepositNum <= 0) return null

          const share = tvlNum > 0 ? ((userDepositNum / tvlNum) * 100).toFixed(4) : '0.0000'
          const earnings = formatEther(pendingRewards || BigInt(0))
          const pendingRewardsNum = Number(formatEther(pendingRewards || BigInt(0)))
          const apr = tvlNum > 0 ? ((pendingRewardsNum * 365 * 100) / tvlNum).toFixed(2) : '0.00'

          return {
            token0: token.symbol,
            token1: 'USDTZ',
            amount: userDepositNum.toFixed(4),
            value: `$${userDepositNum.toFixed(2)}`,
            share: `${share}%`,
            earnings: `$${parseFloat(earnings).toFixed(2)}`,
            apr: `${apr}%`,
            isActive: userDepositNum > 0,
          } as UserPosition
        })
        .filter((p): p is UserPosition => p !== null)

      setPositions(userPositions)
    } catch (err) {
      console.error('Error parsing user positions:', err)
      setPositions([])
    }
  }, [address, poolQueries])

  return { positions, loading }
}

export default function PoolPage() {
  const [activeTab, setActiveTab] = useState('all')
  const { pools, loading: poolsLoading, error: poolsError, totalTVL } = usePoolData()
  const { positions, loading: positionsLoading } = useUserPositions()
  const { address } = useAccount()

  // Calculate aggregate stats
  const totalVolume24h = pools.reduce((sum, p) => sum + parseFloat(p.volume24h), 0)

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <PageHeader
          title="Liquidity Pools"
          subtitle="Provide liquidity to earn trading fees and rewards"
          action={
            <Button>
              <Plus className="w-4 h-4" />
              Create Pool
            </Button>
          }
        />

        {/* Stats */}
        <AnimatedSection className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {poolsLoading ? (
              <>
                <Card padding="sm">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-4 w-16 mt-2" />
                </Card>
                <Card padding="sm">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-4 w-16 mt-2" />
                </Card>
                <Card padding="sm">
                  <Skeleton className="h-10 w-16" />
                </Card>
              </>
            ) : (
              <>
                <StatCard label="Total Value Locked" value={formatUSD(totalTVL)} change="+3.2%" />
                <StatCard label="24h Volume" value={formatUSD(totalVolume24h)} change="+8.5%" />
                <StatCard label="Total Pools" value={pools.length.toString()} />
              </>
            )}
          </div>
        </AnimatedSection>

        {/* Tabs */}
        <div className="mb-6">
          <Tabs
            tabs={[
              { id: 'all', label: 'All Pools' },
              { id: 'my', label: 'My Positions' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* All Pools Table */}
        {activeTab === 'all' && (
          <AnimatedSection>
            <Card className="overflow-hidden" padding="sm">
              {poolsLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  ))}
                </div>
              ) : poolsError ? (
                <div className="p-6 text-center text-red-400">
                  Failed to load pools. Please try again.
                </div>
              ) : pools.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No pools available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Pool</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">TVL</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">24h Volume</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">APR</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">Fee</th>
                        <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pools.map((pool, i) => (
                        <motion.tr
                          key={`${pool.token0}-${pool.token1}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <TokenPair token0={pool.token0} token1={pool.token1} />
                              <span className="font-medium">{pool.token0}-{pool.token1}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-medium">{formatUSD(pool.tvl)}</td>
                          <td className="px-6 py-4 text-right text-gray-400">{formatUSD(pool.volume24h)}</td>
                          <td className="px-6 py-4 text-right">
                            <Badge variant="success">{pool.apr}</Badge>
                          </td>
                          <td className="px-6 py-4 text-right text-gray-400">{pool.fee}</td>
                          <td className="px-6 py-4 text-right">
                            <Button variant="secondary" size="sm">Add</Button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </AnimatedSection>
        )}

        {/* My Positions */}
        {activeTab === 'my' && (
          <AnimatedSection>
            {!address ? (
              <Card className="p-8 text-center">
                <p className="text-gray-400 mb-4">Connect your wallet to see your positions</p>
                <Button variant="secondary">Connect Wallet</Button>
              </Card>
            ) : positionsLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <Card key={i}>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12" />
                        <Skeleton className="h-6 w-32" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                      {[...Array(4)].map((_, j) => (
                        <Skeleton key={j} className="h-16" />
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <Skeleton className="h-10 flex-1" />
                      <Skeleton className="h-10 flex-1" />
                      <Skeleton className="h-10 flex-1" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : positions.length === 0 ? (
              <Card className="p-8 text-center">
                <Inbox className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                <p className="text-gray-400 mb-2">No positions yet</p>
                <p className="text-sm text-gray-500">Add liquidity to start earning</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {positions.map((pos, i) => (
                  <Card key={i} variant="interactive">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <TokenPair token0={pos.token0} token1={pos.token1} size="lg" />
                        <div>
                          <span className="text-xl font-bold">{pos.token0}-{pos.token1}</span>
                          <p className="text-sm text-gray-400">{pos.share} pool share</p>
                        </div>
                      </div>
                      <Badge variant={pos.isActive ? "success" : "secondary"} dot>
                        {pos.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-gray-400 text-xs mb-1">Position</p>
                        <p className="text-lg font-semibold">{pos.amount} LP</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-gray-400 text-xs mb-1">Value</p>
                        <p className="text-lg font-semibold">{pos.value}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-gray-400 text-xs mb-1">Pool Share</p>
                        <p className="text-lg font-semibold">{pos.share}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-gray-400 text-xs mb-1">Earnings</p>
                        <p className="text-lg font-semibold text-green-400">{pos.earnings}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="secondary" className="flex-1">Add Liquidity</Button>
                      <Button variant="secondary" className="flex-1">Remove</Button>
                      <Button variant="outline" className="flex-1">Stake</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </AnimatedSection>
        )}

        {/* Staked Assets */}
        {address && positions.length > 0 && (
          <AnimatedSection delay={0.2} className="mt-8">
            <Card>
              <h2 className="text-xl font-bold mb-4">Your Staked Assets</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-400 text-sm">Total Staked Value</p>
                  <p className="text-2xl font-bold text-primary-400">
                    {formatUSD(positions.reduce((sum, p) => sum + parseFloat(p.value.replace('$', '')), 0))}
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-400 text-sm">Pending Rewards</p>
                  <p className="text-2xl font-bold text-green-400">
                    {formatUSD(positions.reduce((sum, p) => sum + parseFloat(p.earnings.replace('$', '')), 0))}
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-400 text-sm">Average APR</p>
                  <p className="text-2xl font-bold">
                    {formatNumber(
                      positions.length > 0
                        ? positions.reduce((sum, p) => sum + parseFloat(p.apr?.replace('%', '') || '0'), 0) / positions.length
                        : 0
                    )}%
                  </p>
                </div>
              </div>
            </Card>
          </AnimatedSection>
        )}
      </div>
    </Layout>
  )
}
