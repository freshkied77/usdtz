'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus, Inbox, TrendingUp, Droplets, Shield, X } from 'lucide-react'
import { useAccount, useContractRead, useContractReads, usePublicClient, useWalletClient } from 'wagmi'
import { formatEther, parseEther } from 'viem'
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
import { ABIS } from '@/lib/abis'
import { USDTZ_CONFIG } from '@/lib/config'
import { buildTokenList, type TokenData } from '@/lib/api/coingecko'

const POOL_MANAGER = USDTZ_CONFIG.contracts.poolManager as `0x${string}`
const LIQUIDITY_MANAGER = USDTZ_CONFIG.contracts.liquidityManager as `0x${string}`
const USDTZ_ADDRESS = USDTZ_CONFIG.contracts.usdtz as `0x${string}`

const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

interface PoolData {
  token0: string
  token1: string
  token0Address: string
  token1Address: string
  tvl: number
  apr: number
  volume24h: number
  fee: string
  userDeposit: number
  pendingRewards: number
  weight: bigint
}

interface UserPosition {
  token0: string
  token1: string
  amount: number
  value: number
  share: string
  earnings: number
  apr: number
  isActive: boolean
}

export default function PoolPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [activeTab, setActiveTab] = useState('all')
  const [tokens, setTokens] = useState<TokenData[]>([])
  const [pools, setPools] = useState<PoolData[]>([])
  const [positions, setPositions] = useState<UserPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [showAddLiquidity, setShowAddLiquidity] = useState<PoolData | null>(null)
  const [showRemoveLiquidity, setShowRemoveLiquidity] = useState<PoolData | null>(null)
  const [liquidityAmount, setLiquidityAmount] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)

  const handleAddLiquidity = async (pool: PoolData) => {
    if (!liquidityAmount || !address || !publicClient || !walletClient) return
    setActionLoading(true)
    setActionError('')
    setTxHash(null)
    try {
      const amount = parseEther(liquidityAmount)
      const { request: approveReq } = await publicClient.simulateContract({
        address: USDTZ_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [POOL_MANAGER, amount],
        account: address,
      })
      await walletClient.writeContract(approveReq)

      const { request } = await publicClient.simulateContract({
        address: POOL_MANAGER,
        abi: ABIS.PoolManager,
        functionName: 'deposit',
        args: [pool.token0Address as `0x${string}`, amount],
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setTxHash(hash)
      setShowAddLiquidity(null)
      setLiquidityAmount('')
    } catch (err: any) {
      console.error('Add liquidity failed:', err)
      setActionError(err?.shortMessage || 'Add liquidity failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveLiquidity = async (pool: PoolData) => {
    if (!liquidityAmount || !address || !publicClient || !walletClient) return
    setActionLoading(true)
    setActionError('')
    setTxHash(null)
    try {
      const amount = parseEther(liquidityAmount)
      const { request } = await publicClient.simulateContract({
        address: POOL_MANAGER,
        abi: ABIS.PoolManager,
        functionName: 'withdraw',
        args: [pool.token0Address as `0x${string}`, amount],
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setTxHash(hash)
      setShowRemoveLiquidity(null)
      setLiquidityAmount('')
    } catch (err: any) {
      console.error('Remove liquidity failed:', err)
      setActionError(err?.shortMessage || 'Remove liquidity failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStakeLP = async (pool: PoolData) => {
    if (!address || !publicClient || !walletClient) return
    setActionLoading(true)
    setActionError('')
    try {
      const amount = parseEther(pool.userDeposit.toString())
      const { request } = await publicClient.simulateContract({
        address: USDTZ_CONFIG.contracts.liquidityMining as `0x${string}`,
        abi: ABIS.LiquidityMining,
        functionName: 'deposit',
        args: [pool.token0Address as `0x${string}`, amount, '0x0000000000000000000000000000000000000000' as `0x${string}`],
        account: address,
      })
      await walletClient.writeContract(request)
    } catch (err: any) {
      console.error('Stake failed:', err)
      setActionError(err?.shortMessage || 'Stake failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Load tokens from CoinGecko
  useEffect(() => {
    async function loadTokens() {
      try {
        const tokenList = await buildTokenList()
        setTokens(tokenList)
      } catch (error) {
        console.error('Failed to load tokens:', error)
      }
    }
    loadTokens()
  }, [])

  // Get total TVL
  const { data: totalTVLData, isLoading: tvlLoading } = useContractRead({
    address: POOL_MANAGER,
    abi: ABIS.PoolManager,
    functionName: 'totalTVL',
    watch: true,
  })

  // Define pool token pairs to query
  const poolTokens = useMemo(() => [
    USDTZ_CONFIG.tokens.wbnb,
    USDTZ_CONFIG.tokens.usdt,
    USDTZ_CONFIG.tokens.busd,
    USDTZ_CONFIG.tokens.eth,
    USDTZ_CONFIG.tokens.btc,
  ], [])

  // Query pool info for each token
  const poolConfigs = useMemo(() => 
    poolTokens.map((token) => ({
      address: POOL_MANAGER,
      abi: ABIS.PoolManager,
      functionName: 'getPoolInfo' as const,
      args: [token as `0x${string}`],
    })),
    [poolTokens]
  )

  const { data: poolInfosData, isLoading: poolsLoading } = useContractReads({
    contracts: poolConfigs,
  })

  // Build pool data from contract results
  useEffect(() => {
    if (poolsLoading || !poolInfosData || tokens.length === 0) {
      setLoading(poolsLoading || tvlLoading)
      return
    }

    try {
      const poolData: PoolData[] = poolInfosData
        .map((result, index) => {
          if (!result || !Array.isArray(result.result) || result.result.length < 4) {
            return null
          }

          const token = poolTokens[index]
          const [weight, tvl, userDeposit, pendingRewards] = result.result as [bigint, bigint, bigint, bigint]

          const tvlNum = Number(formatEther(tvl || BigInt(0)))
          const pendingRewardsNum = Number(formatEther(pendingRewards || BigInt(0)))

          // Calculate APR based on pending rewards relative to TVL
          const apr = tvlNum > 0 ? ((pendingRewardsNum * 365 * 100) / tvlNum) : 0

          // Estimate 24h volume (would come from AMM in production)
          const volume24h = tvlNum > 0 ? tvlNum * 0.08 : 0

          // Find token symbol
          const tokenInfo = tokens.find(t => t.address.toLowerCase() === token.toLowerCase())
          const tokenSymbol = tokenInfo?.symbol || 'UNKNOWN'

          return {
            token0: tokenSymbol,
            token1: 'USDTZ',
            token0Address: token,
            token1Address: USDTZ_CONFIG.contracts.usdtz,
            tvl: tvlNum,
            apr,
            volume24h,
            fee: '0.25%',
            weight,
            userDeposit: Number(formatEther(userDeposit || BigInt(0))),
            pendingRewards: pendingRewardsNum,
          } as PoolData
        })
        .filter((p): p is PoolData => p !== null && p.tvl > 0)

      setPools(poolData)
    } catch (err) {
      console.error('Error parsing pool data:', err)
    } finally {
      setLoading(false)
    }
  }, [poolInfosData, poolsLoading, tvlLoading, tokens, poolTokens])

  // Load user positions
  useEffect(() => {
    if (!isConnected || !address) {
      setPositions([])
      return
    }

    async function loadPositions() {
      setPositionsLoading(true)
      try {
        const userPositions: UserPosition[] = pools
          .map((pool) => {
            const userDeposit = pool.userDeposit
            if (userDeposit <= 0) return null

            const share = pool.tvl > 0 ? ((userDeposit / pool.tvl) * 100).toFixed(2) : '0'
            const value = userDeposit // Simplified - would calculate from LP token value
            const earnings = pool.pendingRewards > 0 ? pool.pendingRewards : 0

            return {
              token0: pool.token0,
              token1: pool.token1,
              amount: userDeposit,
              value,
              share: `${share}%`,
              earnings,
              apr: pool.apr,
              isActive: true,
            } as UserPosition
          })
          .filter((p): p is UserPosition => p !== null)

        setPositions(userPositions)
      } catch (error) {
        console.error('Failed to load positions:', error)
      } finally {
        setPositionsLoading(false)
      }
    }

    loadPositions()
  }, [pools, isConnected, address])

  const totalTVL = useMemo(() => {
    return totalTVLData ? Number(formatEther(totalTVLData)) : 0
  }, [totalTVLData])

  const formatUSD = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
    return `$${value.toFixed(2)}`
  }

  const formatNumber = (value: number, decimals = 2) => {
    return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  const filteredPools = useMemo(() => {
    if (activeTab === 'all') return pools
    if (activeTab === 'stable') return pools.filter(p => ['USDT', 'BUSD', 'USDTZ'].includes(p.token0))
    if (activeTab === 'volatile') return pools.filter(p => !['USDT', 'BUSD', 'USDTZ'].includes(p.token0))
    return pools
  }, [pools, activeTab])

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <PageHeader
          title="Liquidity Pools"
          subtitle="Provide liquidity and earn fees from trading volume"
          action={
            <Button onClick={() => setActiveTab('all')} disabled={!isConnected}>
              <Plus className="w-4 h-4" />
              Create Pool
            </Button>
          }
        />

        {/* Stats */}
        <AnimatedSection className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total TVL"
              value={loading ? '...' : formatUSD(totalTVL)}
              icon={<Droplets className="w-5 h-5" />}
            />
            <StatCard
              label="Active Pools"
              value={pools.length.toString()}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              label="24h Volume"
              value={formatUSD(pools.reduce((sum, p) => sum + p.volume24h, 0))}
              icon={<Shield className="w-5 h-5" />}
            />
            <StatCard
              label="Avg. APR"
              value={pools.length > 0 ? `${(pools.reduce((sum, p) => sum + p.apr, 0) / pools.length).toFixed(2)}%` : '0%'}
            />
          </div>
        </AnimatedSection>

        {/* Tabs */}
        <div className="mb-6">
          <Tabs
            tabs={[
              { id: 'all', label: 'All Pools' },
              { id: 'stable', label: 'Stablecoin' },
              { id: 'volatile', label: 'Volatile' },
              { id: 'my', label: 'My Positions' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* All Pools */}
        {activeTab !== 'my' && (
          <AnimatedSection>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Card key={i}>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12" />
                        <Skeleton className="h-6 w-32" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[...Array(4)].map((_, j) => (
                        <Skeleton key={j} className="h-16" />
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredPools.length === 0 ? (
              <Card className="p-8 text-center">
                <Inbox className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                <p className="text-gray-400 mb-2">No pools available</p>
                <p className="text-sm text-gray-500">Check back later for new pools</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredPools.map((pool, i) => (
                  <Card key={i} variant="interactive">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <TokenPair token0={pool.token0} token1={pool.token1} size="lg" />
                        <div>
                          <span className="text-xl font-bold">{pool.token0}-{pool.token1}</span>
                          <p className="text-sm text-gray-400">Fee: {pool.fee}</p>
                        </div>
                      </div>
                      <Badge variant="success" dot>
                        Active
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-gray-400 text-xs mb-1">TVL</p>
                        <p className="text-lg font-semibold">{formatUSD(pool.tvl)}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-gray-400 text-xs mb-1">APR</p>
                        <p className="text-lg font-semibold text-green-400">{pool.apr.toFixed(2)}%</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-gray-400 text-xs mb-1">24h Volume</p>
                        <p className="text-lg font-semibold">{formatUSD(pool.volume24h)}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-gray-400 text-xs mb-1">Your Deposit</p>
                        <p className="text-lg font-semibold">{pool.userDeposit > 0 ? formatUSD(pool.userDeposit) : '—'}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="primary" className="flex-1" onClick={() => { setShowAddLiquidity(pool); setLiquidityAmount(''); setActionError(''); setTxHash(null); }} disabled={!isConnected}>Add Liquidity</Button>
                      <Button variant="outline" className="flex-1" onClick={() => setShowAddLiquidity(pool)}>View Details</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </AnimatedSection>
        )}

        {/* My Positions */}
        {activeTab === 'my' && (
          <AnimatedSection>
            {!isConnected ? (
              <Card className="p-8 text-center">
                <p className="text-gray-400 mb-4">Connect your wallet to see your positions</p>
                <Button variant="secondary">Connect Wallet</Button>
              </Card>
            ) : positionsLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <Card key={i}>
                    <Skeleton className="h-32" />
                  </Card>
                ))}
              </div>
            ) : positions.length === 0 ? (
              <Card className="p-8 text-center">
                <Inbox className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                <p className="text-gray-400 mb-2">No positions yet</p>
                <p className="text-sm text-gray-500">Add liquidity to start earning fees</p>
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
                      <Badge variant="success" dot>
                        Active
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-gray-400 text-xs mb-1">Position</p>
                        <p className="text-lg font-semibold">{formatNumber(pos.amount)} LP</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-gray-400 text-xs mb-1">Value</p>
                        <p className="text-lg font-semibold">{formatUSD(pos.value)}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-gray-400 text-xs mb-1">Pool Share</p>
                        <p className="text-lg font-semibold">{pos.share}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl">
                        <p className="text-gray-400 text-xs mb-1">Earnings</p>
                        <p className="text-lg font-semibold text-green-400">{formatUSD(pos.earnings)}</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="secondary" className="flex-1" onClick={() => {
                        const pool = pools.find(p => p.token0 === pos.token0 && p.token1 === pos.token1)
                        if (pool) { setShowAddLiquidity(pool); setLiquidityAmount(''); setActionError(''); setTxHash(null); }
                      }}>Add Liquidity</Button>
                      <Button variant="secondary" className="flex-1" onClick={() => {
                        const pool = pools.find(p => p.token0 === pos.token0 && p.token1 === pos.token1)
                        if (pool) { setShowRemoveLiquidity(pool); setLiquidityAmount(''); setActionError(''); setTxHash(null); }
                      }}>Remove</Button>
                      <Button variant="outline" className="flex-1" onClick={() => {
                        const pool = pools.find(p => p.token0 === pos.token0 && p.token1 === pos.token1)
                        if (pool) handleStakeLP(pool)
                      }} loading={actionLoading}>Stake</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </AnimatedSection>
        )}
        {/* Add Liquidity Modal */}
        {showAddLiquidity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-dark-200 border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold">Add Liquidity — {showAddLiquidity.token0}/{showAddLiquidity.token1}</h2>
                <button onClick={() => setShowAddLiquidity(null)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Amount (USDTZ)</label>
                  <input
                    type="number"
                    value={liquidityAmount}
                    onChange={(e) => setLiquidityAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-primary-500 text-lg"
                  />
                </div>
                {actionError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{actionError}</div>}
                {txHash && <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400">Success! Tx: {txHash.slice(0, 16)}...</div>}
                <Button fullWidth size="lg" onClick={() => handleAddLiquidity(showAddLiquidity)} loading={actionLoading} disabled={!liquidityAmount || parseFloat(liquidityAmount) <= 0}>
                  Add Liquidity
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Liquidity Modal */}
        {showRemoveLiquidity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-dark-200 border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold">Remove Liquidity — {showRemoveLiquidity.token0}/{showRemoveLiquidity.token1}</h2>
                <button onClick={() => setShowRemoveLiquidity(null)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Amount to Remove (USDTZ)</label>
                  <input
                    type="number"
                    value={liquidityAmount}
                    onChange={(e) => setLiquidityAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-primary-500 text-lg"
                  />
                </div>
                {actionError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{actionError}</div>}
                {txHash && <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400">Success! Tx: {txHash.slice(0, 16)}...</div>}
                <Button fullWidth size="lg" onClick={() => handleRemoveLiquidity(showRemoveLiquidity)} loading={actionLoading} disabled={!liquidityAmount || parseFloat(liquidityAmount) <= 0}>
                  Remove Liquidity
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
