'use client'

import { useState, useMemo, useEffect } from 'react'
import { Sprout, Flame, Gift, TrendingUp } from 'lucide-react'
import { useAccount, useContractRead, useContractReads, useContractWrite, usePrepareContractWrite, usePublicClient, useWalletClient } from 'wagmi'
import { formatEther, parseEther } from 'viem'
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
import { buildTokenList } from '@/lib/api/coingecko'

const LIQUIDITY_MINING_ADDRESS = USDTZ_CONFIG.contracts.liquidityMining as `0x${string}`
const SECONDS_PER_YEAR = 31536000

interface FarmData {
  index: number
  lpToken: string
  token0: string
  token1: string
  apr: number
  tvl: number
  multiplier: string
  earned: number
  isActive: boolean
  allocation: bigint
  totalStaked: bigint
  userAmount: bigint
  userPendingRewards: bigint
  userTotalEarned: bigint
}

function FarmCardSkeleton() {
  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Skeleton variant="circle" className="w-10 h-10" />
          <div className="space-y-2">
            <Skeleton variant="text" className="w-24 h-5" />
            <div className="flex gap-2">
              <Skeleton variant="text" className="w-16 h-4" />
              <Skeleton variant="text" className="w-16 h-4" />
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} variant="text" className="w-20 h-10" />
          ))}
        </div>
      </div>
    </Card>
  )
}

export default function FarmPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [activeTab, setActiveTab] = useState('all')
  const [sortBy, setSortBy] = useState('tvl')
  const [farms, setFarms] = useState<FarmData[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)

  const handleStake = async (poolIndex: number, amount: string) => {
    if (!address || !publicClient || !walletClient) return
    setActionLoading(poolIndex)
    setActionError('')
    try {
      const farm = farms.find(f => f.index === poolIndex)
      if (!farm) return
      
      const { request } = await publicClient.simulateContract({
        address: LIQUIDITY_MINING_ADDRESS,
        abi: ABIS.LiquidityMining,
        functionName: 'deposit',
        args: [farm.lpToken as `0x${string}`, farm.userAmount, '0x0000000000000000000000000000000000000000'],
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setTxHash(hash)
    } catch (error: any) {
      console.error('Stake failed:', error)
      setActionError(error?.shortMessage || 'Stake failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnstake = async (poolIndex: number, amount: string) => {
    if (!address || !publicClient || !walletClient) return
    setActionLoading(poolIndex)
    setActionError('')
    try {
      const farm = farms.find(f => f.index === poolIndex)
      if (!farm) return
      
      const { request } = await publicClient.simulateContract({
        address: LIQUIDITY_MINING_ADDRESS,
        abi: ABIS.LiquidityMining,
        functionName: 'withdraw',
        args: [farm.lpToken as `0x${string}`, farm.userAmount],
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setTxHash(hash)
    } catch (error: any) {
      console.error('Unstake failed:', error)
      setActionError(error?.shortMessage || 'Unstake failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleHarvest = async (poolIndex: number) => {
    if (!address || !publicClient || !walletClient) return
    setActionLoading(poolIndex)
    setActionError('')
    try {
      const farm = farms.find(f => f.index === poolIndex)
      if (!farm) return
      
      const { request } = await publicClient.simulateContract({
        address: LIQUIDITY_MINING_ADDRESS,
        abi: ABIS.LiquidityMining,
        functionName: 'claimReward',
        args: [farm.lpToken as `0x${string}`],
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setTxHash(hash)
    } catch (error: any) {
      console.error('Harvest failed:', error)
      setActionError(error?.shortMessage || 'Harvest failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleHarvestAll = async () => {
    if (!address || !publicClient || !walletClient || stakedFarms.length === 0) return
    setActionLoading(-1)
    setActionError('')
    try {
      for (const farm of stakedFarms) {
        const { request } = await publicClient.simulateContract({
          address: LIQUIDITY_MINING_ADDRESS,
          abi: ABIS.LiquidityMining,
          functionName: 'claimReward',
          args: [farm.lpToken as `0x${string}`],
          account: address,
        })
        await walletClient.writeContract(request)
      }
    } catch (error: any) {
      console.error('Harvest all failed:', error)
      setActionError(error?.shortMessage || 'Harvest all failed')
    } finally {
      setActionLoading(null)
    }
  }

  // Get pool count
  const { data: poolCount } = useContractRead({
    address: LIQUIDITY_MINING_ADDRESS,
    abi: ABIS.LiquidityMining,
    functionName: 'poolCounter',
  })

  // Get global stats
  const { data: stats } = useContractRead({
    address: LIQUIDITY_MINING_ADDRESS,
    abi: ABIS.LiquidityMining,
    functionName: 'getStats',
  })

  // Get rewards per second
  const { data: rewardsPerSecond } = useContractRead({
    address: LIQUIDITY_MINING_ADDRESS,
    abi: ABIS.LiquidityMining,
    functionName: 'currentRewardsPerSecond',
  })

  // Build pool indices
  const poolIndices = useMemo(() => {
    if (!poolCount) return [0, 1, 2] // Default pools
    const count = Number(poolCount)
    return Array.from({ length: Math.min(count, 10) }, (_, i) => i)
  }, [poolCount])

  // Batch read pool infos
  const poolReadConfigs = useMemo(() => 
    poolIndices.map((idx) => ({
      address: LIQUIDITY_MINING_ADDRESS,
      abi: ABIS.LiquidityMining,
      functionName: 'getPoolInfo' as const,
      args: [BigInt(idx)] as const,
    })),
    [poolIndices]
  )

  const { data: poolInfosData, isLoading: isLoadingPools } = useContractReads({
    contracts: poolReadConfigs,
  })

  // Batch read user infos
  const userReadConfigs = useMemo(() => {
    if (!isConnected || !address) return []
    return poolIndices.map((idx) => ({
      address: LIQUIDITY_MINING_ADDRESS,
      abi: ABIS.LiquidityMining,
      functionName: 'getUserInfo' as const,
      args: [BigInt(idx), address] as const,
    }))
  }, [poolIndices, isConnected, address])

  const { data: userInfosData, isLoading: isLoadingUser } = useContractReads({
    contracts: userReadConfigs,
  })

  // Build farm data
  useEffect(() => {
    async function buildFarms() {
      setLoading(isLoadingPools || isLoadingUser || !poolInfosData)
      if (!poolInfosData) return

      const farmData: FarmData[] = poolIndices.map((idx, i) => {
        const poolInfo = poolInfosData[i]?.result
        const userInfo = userInfosData?.[i]?.result

        if (!poolInfo || !Array.isArray(poolInfo) || poolInfo.length < 6) {
          return null
        }

        const [allocation, totalStaked, active, startTime, endTime, remainingDays] = poolInfo as [
          bigint, bigint, boolean, bigint, bigint, bigint
        ]

        const userAmount = userInfo && Array.isArray(userInfo) ? userInfo[0] || BigInt(0) : BigInt(0)
        const pendingRewards = userInfo && Array.isArray(userInfo) ? userInfo[1] || BigInt(0) : BigInt(0)
        const totalEarned = userInfo && Array.isArray(userInfo) ? userInfo[2] || BigInt(0) : BigInt(0)

        // Calculate APR
        const tvlNum = Number(formatEther(totalStaked))
        const rewardsPerSec = rewardsPerSecond ? Number(formatEther(rewardsPerSecond)) : 0
        const allocationNum = Number(allocation)
        const totalAllocation = poolInfosData?.reduce((sum, p) => sum + Number((p.result as bigint[] | undefined)?.[0] || BigInt(0)), 0) || 1
        
        const poolRewardsPerSec = (rewardsPerSec * allocationNum) / totalAllocation
        const yearlyRewards = poolRewardsPerSec * SECONDS_PER_YEAR
        const apr = tvlNum > 0 ? ((yearlyRewards / tvlNum) * 100) : 0

        // Mock token pair data (in production, get from LP token contract)
        const tokenPairs = [
          { token0: 'USDTZ', token1: 'BNB', lpToken: '0x...' },
          { token0: 'USDTZ', token1: 'USDT', lpToken: '0x...' },
          { token0: 'USDTZ', token1: 'BUSD', lpToken: '0x...' },
        ]
        const pair = tokenPairs[idx % tokenPairs.length]

        return {
          index: idx,
          lpToken: pair.lpToken,
          token0: pair.token0,
          token1: pair.token1,
          apr,
          tvl: tvlNum,
          multiplier: allocationNum > 100 ? '2x' : '1x',
          earned: Number(formatEther(pendingRewards)),
          isActive: active && remainingDays > BigInt(0),
          allocation,
          totalStaked,
          userAmount,
          userPendingRewards: pendingRewards,
          userTotalEarned: totalEarned,
        } as FarmData
      }).filter((f): f is FarmData => f !== null)

      setFarms(farmData)
      setLoading(false)
    }

    buildFarms()
  }, [poolInfosData, userInfosData, isLoadingPools, isLoadingUser, rewardsPerSecond, poolIndices])

  // Sort farms
  const sortedFarms = useMemo(() => {
    let sorted = [...farms]
    if (sortBy === 'tvl') sorted.sort((a, b) => b.tvl - a.tvl)
    if (sortBy === 'apr') sorted.sort((a, b) => b.apr - a.apr)
    if (sortBy === 'name') sorted.sort((a, b) => a.token0.localeCompare(b.token0))
    return sorted
  }, [farms, sortBy])

  const stakedFarms = useMemo(() => 
    farms.filter(f => f.userAmount > BigInt(0)),
    [farms]
  )

  const totalStakedValue = useMemo(() => 
    farms.reduce((sum, f) => sum + f.tvl, 0),
    [farms]
  )

  const totalUserStaked = useMemo(() => 
    stakedFarms.reduce((sum, f) => {
      const userStakedValue = f.tvl * (Number(formatEther(f.userAmount)) / f.tvl)
      return sum + (isNaN(userStakedValue) ? 0 : userStakedValue)
    }, 0),
    [stakedFarms]
  )

  const totalPendingRewards = useMemo(() => 
    stakedFarms.reduce((sum, f) => sum + Number(formatEther(f.userPendingRewards)), 0),
    [stakedFarms]
  )

  const averageApr = useMemo(() => 
    farms.length > 0 ? `${(farms.reduce((sum, f) => sum + f.apr, 0) / farms.length).toFixed(1)}%` : '0%',
    [farms]
  )

  const formatUSD = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
    return `$${value.toFixed(2)}`
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <PageHeader
          title="Yield Farming"
          subtitle="Stake LP tokens to earn USDTZ rewards"
          action={
            <Button 
              disabled={!isConnected || stakedFarms.length === 0}
              onClick={handleHarvestAll}
              loading={actionLoading === -1}
            >
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
              value={loading ? '...' : formatUSD(totalStakedValue)}
              icon={<Sprout className="w-5 h-5" />}
            />
            <StatCard
              label="Your Staked"
              value={!isConnected ? 'Connect' : loading ? '...' : formatUSD(totalUserStaked)}
            />
            <StatCard
              label="Pending Rewards"
              value={!isConnected ? '0' : loading ? '...' : formatUSD(totalPendingRewards)}
            />
            <StatCard
              label="Average APR"
              value={loading ? '...' : averageApr}
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
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <FarmCardSkeleton key={i} />
              ))
            ) : sortedFarms.length > 0 ? (
              sortedFarms.map((farm) => (
                <Card key={farm.lpToken} variant="interactive">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <TokenPair token0={farm.token0} token1={farm.token1} size="lg" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">{farm.token0}-{farm.token1}</span>
                          {farm.multiplier !== '1x' && (
                            <Badge variant="primary" size="sm">{farm.multiplier}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <span>TVL: {formatUSD(farm.tvl)}</span>
                          <span>•</span>
                          <span className="text-green-400 font-medium">{farm.apr.toFixed(2)}% APR</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {farm.userAmount > BigInt(0) ? (
                        <>
                          <div className="text-right mr-4">
                            <p className="text-sm text-gray-400">Staked</p>
                            <p className="font-semibold">{formatUSD(Number(formatEther(farm.userAmount)))}</p>
                            <p className="text-xs text-green-400">+{formatUSD(farm.earned)} earned</p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleHarvest(farm.index)} loading={actionLoading === farm.index}>Harvest</Button>
                          <Button size="sm" onClick={() => handleUnstake(farm.index, '')} loading={actionLoading === farm.index}>Unstake</Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm">View Details</Button>
                          <Button size="sm" onClick={() => handleStake(farm.index, '')} loading={actionLoading === farm.index}>Stake</Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
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
              stakedFarms.map((farm) => (
                <Card key={farm.lpToken} variant="interactive">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <TokenPair token0={farm.token0} token1={farm.token1} size="lg" />
                      <div>
                        <span className="text-lg font-bold">{farm.token0}-{farm.token1}</span>
                        <p className="text-sm text-gray-400">
                          Staked: {formatUSD(Number(formatEther(farm.userAmount)))}
                        </p>
                        <p className="text-sm text-green-400">
                          Pending: {formatUSD(farm.earned)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" size="sm" onClick={() => handleStake(farm.index, '')} loading={actionLoading === farm.index}>Add More</Button>
                      <Button size="sm" onClick={() => handleHarvest(farm.index)} loading={actionLoading === farm.index}>Harvest</Button>
                      <Button variant="secondary" size="sm" onClick={() => handleUnstake(farm.index, '')} loading={actionLoading === farm.index}>Unstake</Button>
                    </div>
                  </div>
                </Card>
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
                { step: '2', title: 'Stake LP Tokens', desc: 'Stake your LP tokens in farms to start earning' },
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
