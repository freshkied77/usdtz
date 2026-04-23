'use client'

import { useState, useMemo } from 'react'
import { Sprout, Flame, Gift } from 'lucide-react'
import { useAccount, useContractRead, useContractReads } from 'wagmi'
import { formatEther } from 'viem'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Tabs from '@/components/ui/Tabs'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import AnimatedSection from '@/components/ui/AnimatedSection'
import Select from '@/components/ui/Select'
import Skeleton from '@/components/ui/Skeleton'
import { TokenPair } from '@/components/ui/TokenIcon'
import { ABIS } from '@/lib/abis'
import { USDTZ_CONFIG } from '@/lib/config'
import { formatCurrency } from '@/lib/utils'

const LIQUIDITY_MINING_ADDRESS = USDTZ_CONFIG.contracts.liquidityMining as `0x${string}`
const USDTZ_ADDRESS = USDTZ_CONFIG.contracts.usdtz as `0x${string}`
const SECONDS_PER_YEAR_BIGINT = BigInt(31536000)

// Known LP token pairs
const KNOWN_LP_PAIRS: Record<number, { token0: string; token1: string; multiplier?: string; lpToken?: string }> = {
  0: { token0: 'USDTZ', token1: 'BNB', multiplier: '2x', lpToken: '0xbAe7EAF2078f053857b472c2cAE4F63D0086b89F' },
}

const MAX_POOLS = 10
const DEFAULT_TVL = 1000000

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface PoolInfo {
  allocation: bigint
  totalStaked: bigint
  active: boolean
  startTime: bigint
  endTime: bigint
  remainingDays: bigint
}

interface UserPoolInfo {
  amount: bigint
  pendingRewards: bigint
  totalEarned: bigint
  lastClaimTime: bigint
}

interface FarmData {
  index: number
  lpToken: string
  token0: string
  token1: string
  apr: string
  aprValue: number
  tvl: string
  tvlValue: number
  multiplier: string
  earned: string
  earnedValue: number
  isActive: boolean
  allocation: bigint
  totalStaked: bigint
  userAmount: bigint
  userPendingRewards: bigint
  userTotalEarned: bigint
}

// ─────────────────────────────────────────────────────────────
// Hook: useFarmsData - batch read all pool + user data
// ─────────────────────────────────────────────────────────────
function useFarmsData() {
  const { address, isConnected } = useAccount()

  // 1. Pool counter
  const { data: poolCount } = useContractRead({
    address: LIQUIDITY_MINING_ADDRESS,
    abi: ABIS.LiquidityMining,
    functionName: 'poolCounter',
  })

  // 2. Global stats
  const { data: stats } = useContractRead({
    address: LIQUIDITY_MINING_ADDRESS,
    abi: ABIS.LiquidityMining,
    functionName: 'getStats',
  })

  // 3. Rewards per second
  const { data: rewardsPerSecond } = useContractRead({
    address: LIQUIDITY_MINING_ADDRESS,
    abi: ABIS.LiquidityMining,
    functionName: 'currentRewardsPerSecond',
  })

  // Build indices for known pools only
  const poolIndices = useMemo(() => {
    if (!poolCount) return Object.keys(KNOWN_LP_PAIRS).map(Number)
    const count = Number(poolCount)
    return Array.from({ length: Math.min(count, MAX_POOLS) }, (_, i) => i)
  }, [poolCount])

  // Build batch read configs for pool infos
  const poolReadConfigs = useMemo(() => {
    return poolIndices.map((idx) => ({
      address: LIQUIDITY_MINING_ADDRESS,
      abi: ABIS.LiquidityMining,
      functionName: 'getPoolInfo',
      args: [BigInt(idx)] as const,
    }))
  }, [poolIndices])

  // Batch read pool infos
  const { data: poolInfosData, isLoading: isLoadingPools } = useContractReads({
    contracts: poolReadConfigs,
  })

  // Build batch read configs for user infos
  const userReadConfigs = useMemo(() => {
    if (!isConnected || !address) return []
    return poolIndices.map((idx) => ({
      address: LIQUIDITY_MINING_ADDRESS,
      abi: ABIS.LiquidityMining,
      functionName: 'getUserInfo',
      args: [BigInt(idx), address] as const,
    }))
  }, [poolIndices, isConnected, address])

  const { data: userInfosData, isLoading: isLoadingUser } = useContractReads({
    contracts: userReadConfigs,
  })

  const isLoading = isLoadingPools || isLoadingUser || !poolCount

  return {
    poolCount: poolCount as bigint | undefined,
    poolIndices,
    poolInfosData,
    userInfosData,
    stats: stats as { _totalRewardsDistributed: bigint; _totalStakedValue: bigint; _poolCount: bigint; _currentRewardsPerSecond: bigint; _totalReferralRewards: bigint } | undefined,
    rewardsPerSecond: rewardsPerSecond as bigint | undefined,
    isLoading,
  }
}

// ─────────────────────────────────────────────────────────────
// Component: Skeleton loader
// ─────────────────────────────────────────────────────────────
function FarmCardSkeleton() {
  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Skeleton variant="circle" className="w-10 h-10" />
          <div className="space-y-2">
            <Skeleton variant="text" className="w-24 h-5" />
            <div className="flex gap-2">
              <Skeleton variant="text" className="w-16 h-5" />
              <Skeleton variant="text" className="w-10 h-5" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center hidden sm:block">
            <Skeleton variant="text" className="w-16 h-4" />
            <Skeleton variant="text" className="w-12 h-6 mt-1" />
          </div>
          <div className="text-center hidden sm:block">
            <Skeleton variant="text" className="w-16 h-4" />
            <Skeleton variant="text" className="w-12 h-6 mt-1" />
          </div>
          <div className="flex gap-2">
            <Skeleton variant="text" className="w-16 h-8" />
            <Skeleton variant="text" className="w-16 h-8" />
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Component: Farm Card (All Farms tab)
// ─────────────────────────────────────────────────────────────
function FarmCard({ farm, index }: { farm: FarmData; index: number }) {
  return (
    <AnimatedSection delay={index * 0.05}>
      <Card variant="interactive">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <TokenPair token0={farm.token0} token1={farm.token1} size="lg" />
            <div>
              <h3 className="text-lg font-bold">{farm.token0}-{farm.token1}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="success">{farm.apr} APR</Badge>
                <Badge variant="primary">{farm.multiplier}</Badge>
                {farm.isActive && <Badge variant="success" dot>Active</Badge>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center hidden sm:block">
              <p className="text-gray-400 text-xs">TVL</p>
              <p className="text-lg font-semibold">{farm.tvl}</p>
            </div>
            <div className="text-center hidden sm:block">
              <p className="text-gray-400 text-xs">Earned</p>
              <p className="text-lg font-semibold text-green-400">{farm.earned}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">View</Button>
              <Button size="sm">Stake</Button>
            </div>
          </div>
        </div>
      </Card>
    </AnimatedSection>
  )
}

// ─────────────────────────────────────────────────────────────
// Component: Staked Farm Card (My Farms tab)
// ─────────────────────────────────────────────────────────────
function StakedFarmCard({ farm, index }: { farm: FarmData; index: number }) {
  const stakedAmount = farm.userAmount > BigInt(0) ? formatEther(farm.userAmount).split('.')[0] : '0'
  const pendingRewards = farm.userPendingRewards > BigInt(0) ? formatEther(farm.userPendingRewards).split('.')[0] : '0'

  return (
    <AnimatedSection delay={index * 0.1}>
      <Card variant="highlight">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <TokenPair token0={farm.token0} token1={farm.token1} size="lg" />
            <div>
              <h3 className="text-lg font-bold">{farm.token0}-{farm.token1}</h3>
              <p className="text-sm text-gray-400">APR {farm.apr}</p>
            </div>
          </div>
          <Badge variant="success" dot>Staked</Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div className="p-3 bg-white/5 rounded-xl">
            <p className="text-gray-400 text-xs mb-1">Staked</p>
            <p className="text-lg font-semibold">{stakedAmount} {farm.token0}</p>
          </div>
          <div className="p-3 bg-white/5 rounded-xl">
            <p className="text-gray-400 text-xs mb-1">Value</p>
            <p className="text-lg font-semibold">{farm.tvl}</p>
          </div>
          <div className="p-3 bg-white/5 rounded-xl">
            <p className="text-gray-400 text-xs mb-1">Rewards</p>
            <p className="text-lg font-semibold text-green-400">{pendingRewards} {farm.token0}</p>
          </div>
          <div className="p-3 bg-white/5 rounded-xl">
            <p className="text-gray-400 text-xs mb-1">APR</p>
            <p className="text-lg font-semibold text-green-400">{farm.apr}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1">Add</Button>
          <Button variant="outline" className="flex-1">Claim</Button>
          <Button variant="danger" className="flex-1">Unstake</Button>
        </div>
      </Card>
    </AnimatedSection>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Farm Page Component
// ─────────────────────────────────────────────────────────────
export default function FarmPage() {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState('all')
  const [sortBy, setSortBy] = useState('tvl')

  const {
    poolCount,
    poolIndices,
    poolInfosData,
    userInfosData,
    stats,
    rewardsPerSecond,
    isLoading,
  } = useFarmsData()

  // Build farms array from batched pool data
  const farms: FarmData[] = useMemo(() => {
    if (!poolInfosData) return []

    const result: FarmData[] = []

    poolIndices.forEach((idx) => {
      const poolInfoRaw = poolInfosData[idx]
      const userInfoRaw = userInfosData?.[idx]

      if (!poolInfoRaw || poolInfoRaw.status === 'failure') return

      const poolInfo = poolInfoRaw.result as PoolInfo | undefined
      if (!poolInfo) return

      const [allocation = BigInt(0), totalStaked = BigInt(0), active = false, startTime = BigInt(0), endTime = BigInt(0)] = Array.isArray(poolInfoRaw.result)
        ? poolInfoRaw.result
        : []

      const userInfo = userInfoRaw?.result as UserPoolInfo | undefined
      const [userAmount = BigInt(0), userPendingRewards = BigInt(0), userTotalEarned = BigInt(0)] = userInfo
        ? [userInfo.amount, userInfo.pendingRewards, userInfo.totalEarned]
        : []

      // Find known pair by index
      const knownPair = KNOWN_LP_PAIRS[idx]
      const token0 = knownPair?.token0 || 'USDTZ'
      const token1 = knownPair?.token1 || `Pool ${idx}`
      const multiplier = knownPair?.multiplier || '1x'

      // Calculate TVL
      const tvlValue = Number(formatEther(totalStaked))
      const tvlFormatted = tvlValue >= 1_000_000
        ? `$${(tvlValue / 1_000_000).toFixed(1)}M`
        : tvlValue >= 1_000
          ? `$${(tvlValue / 1_000).toFixed(1)}K`
          : tvlValue > 0 ? `$${tvlValue.toFixed(0)}` : '$0'

      // Calculate APR
      let aprValue = 0
      if (stats && rewardsPerSecond) {
        const totalPools = Number(stats._poolCount || BigInt(1))
        const poolWeight = totalPools > 0 ? Number(allocation) / (totalPools * 100) : 0
        const annualRewards = Number(rewardsPerSecond) * Number(SECONDS_PER_YEAR_BIGINT)
        const annualRewardsForPool = annualRewards * poolWeight
        const divisor = tvlValue > 0 ? tvlValue : DEFAULT_TVL
        aprValue = (annualRewardsForPool / divisor) * 100
      }

      const earnedFormatted = userPendingRewards > BigInt(0)
        ? formatEther(userPendingRewards).split('.')[0]
        : '0'

      result.push({
        index: idx,
        lpToken: knownPair?.lpToken || `pool-${idx}`,
        token0,
        token1,
        apr: `${aprValue.toFixed(1)}%`,
        aprValue,
        tvl: tvlFormatted,
        tvlValue: tvlValue || DEFAULT_TVL,
        multiplier,
        earned: earnedFormatted,
        earnedValue: Number(earnedFormatted),
        isActive: active,
        allocation,
        totalStaked,
        userAmount,
        userPendingRewards,
        userTotalEarned,
      })
    })

    return result
  }, [poolIndices, poolInfosData, userInfosData, stats, rewardsPerSecond])

  // Sort farms
  const sortedFarms = useMemo(() => {
    const sorted = [...farms]
    switch (sortBy) {
      case 'tvl':
        sorted.sort((a, b) => b.tvlValue - a.tvlValue)
        break
      case 'apr':
        sorted.sort((a, b) => b.aprValue - a.aprValue)
        break
      default:
        break
    }
    return sorted
  }, [farms, sortBy])

  // Filter farms with user stake
  const stakedFarms = useMemo(() => {
    return farms.filter(f => f.userAmount > BigInt(0))
  }, [farms])

  // Calculate aggregate stats
  const totalStakedValue = useMemo(() => {
    return farms.reduce((sum, f) => sum + f.tvlValue, 0)
  }, [farms])

  const totalUserStaked = useMemo(() => {
    return stakedFarms.reduce((sum, f) => {
      const userStakedValue = f.tvlValue * (Number(formatEther(f.userAmount)) / f.tvlValue)
      return sum + (isNaN(userStakedValue) ? 0 : userStakedValue)
    }, 0)
  }, [stakedFarms])

  const totalPendingRewards = useMemo(() => {
    return stakedFarms.reduce((sum, f) => sum + Number(formatEther(f.userPendingRewards)), 0)
  }, [stakedFarms])

  const averageApr = useMemo(() => {
    if (farms.length === 0) return '0%'
    const totalApr = farms.reduce((sum, f) => sum + f.aprValue, 0)
    return `${(totalApr / farms.length).toFixed(1)}%`
  }, [farms])

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <PageHeader
          title="Yield Farming"
          subtitle="Stake LP tokens to earn USDTZ rewards"
          action={
            <Button disabled={!isConnected || stakedFarms.length === 0}>
              <Gift className="w-4 h-4" />
              Claim All Rewards
            </Button>
          }
        />

        {/* Stats */}
        <AnimatedSection className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Staked"
              value={isLoading ? '...' : formatCurrency(totalStakedValue)}
              icon={<Sprout className="w-5 h-5" />}
            />
            <StatCard
              label="Your Staked"
              value={!isConnected ? 'Connect' : isLoading ? '...' : formatCurrency(totalUserStaked)}
            />
            <StatCard
              label="Pending Rewards"
              value={!isConnected ? '0' : isLoading ? '...' : formatCurrency(totalPendingRewards)}
            />
            <StatCard
              label="Average APR"
              value={isLoading ? '...' : averageApr}
              icon={<Flame className="w-5 h-5" />}
            />
          </div>
        </AnimatedSection>

        {/* Tabs + Sort */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <Tabs
            tabs={[
              { id: 'all', label: 'All Farms' },
              { id: 'staked', label: 'My Farms' },
              { id: 'archived', label: 'Archived' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
          <Select
            options={[
              { value: 'tvl', label: 'Sort by TVL' },
              { value: 'apr', label: 'Sort by APR' },
              { value: 'name', label: 'Sort by Name' },
            ]}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-40"
          />
        </div>

        {/* All Farms */}
        {activeTab === 'all' && (
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <FarmCardSkeleton key={i} />
              ))
            ) : sortedFarms.length > 0 ? (
              sortedFarms.map((farm, i) => (
                <FarmCard key={farm.lpToken} farm={farm} index={i} />
              ))
            ) : (
              <Card className="text-center py-16">
                <Sprout className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Farms Available</h3>
                <p className="text-gray-400">Check back later for farming opportunities</p>
              </Card>
            )}
          </div>
        )}

        {/* Staked Farms */}
        {activeTab === 'staked' && (
          <div className="space-y-4">
            {!isConnected ? (
              <Card className="text-center py-16">
                <Sprout className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
                <p className="text-gray-400">Connect your wallet to see your staked farms</p>
              </Card>
            ) : stakedFarms.length > 0 ? (
              stakedFarms.map((farm, i) => (
                <StakedFarmCard key={farm.lpToken} farm={farm} index={i} />
              ))
            ) : (
              <Card className="text-center py-16">
                <Sprout className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Staked Farms</h3>
                <p className="text-gray-400">Stake LP tokens in farms to start earning</p>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'archived' && (
          <Card className="text-center py-16">
            <Sprout className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Archived Farms</h3>
            <p className="text-gray-400">Archived farms will appear here</p>
          </Card>
        )}

        {/* How Farming Works */}
        <AnimatedSection delay={0.2} className="mt-8">
          <Card>
            <h2 className="text-xl font-bold mb-6">How Farming Works</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { step: '1', title: 'Add Liquidity', desc: 'Provide liquidity to our pools to receive LP tokens' },
                { step: '2', title: 'Stake LP Tokens', desc: 'Stake your LP tokens in our farms to start earning' },
                { step: '3', title: 'Harvest Rewards', desc: 'Claim your USDTZ rewards and reinvest' },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4 text-lg font-bold text-primary-400">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </AnimatedSection>
      </div>
    </Layout>
  )
}
