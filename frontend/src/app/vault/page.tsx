'use client'

import { useState, useMemo } from 'react'
import { Landmark, Lock, Unlock } from 'lucide-react'
import { useContractRead, useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { formatEther, parseEther } from 'viem'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Tabs from '@/components/ui/Tabs'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import ProgressBar from '@/components/ui/ProgressBar'
import AnimatedSection from '@/components/ui/AnimatedSection'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { ABIS } from '@/lib/abis'

const LIQUIDITY_VAULT_ADDRESS = '0xdfbe58825699E42D786EBf9B7Ba8F6ab03C1C759' as const
const USDTZ_ADDRESS = '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665' as const

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

// Chain IDs matching the UI
const CHAINS = [
  { id: 9000, name: 'Zedx Chain', icon: '🔷' },
  { id: 56, name: 'BNB Chain', icon: '🔶' },
  { id: 1, name: 'Ethereum', icon: '🔵' },
  { id: 137, name: 'Polygon', icon: '🟣' },
]

// Token list - matching config
const TOKENS_CONFIG = [
  { symbol: 'USDTZ', address: USDTZ_ADDRESS, decimals: 18 },
  { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18 },
  { symbol: 'BNB', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18 },
]

function formatUsd(value: bigint, decimals: number = 18): string {
  const formatted = Number(formatEther(value))
  if (formatted >= 1_000_000_000) return `$${(formatted / 1_000_000_000).toFixed(1)}B`
  if (formatted >= 1_000_000) return `$${(formatted / 1_000_000).toFixed(1)}M`
  if (formatted >= 1_000) return `$${(formatted / 1_000).toFixed(1)}K`
  return `$${formatted.toFixed(2)}`
}

function formatNumber(value: bigint, decimals: number = 18): string {
  const formatted = Number(formatEther(value))
  if (formatted >= 1_000_000_000) return `${(formatted / 1_000_000_000).toFixed(1)}B`
  if (formatted >= 1_000_000) return `${(formatted / 1_000_000).toFixed(1)}M`
  if (formatted >= 1_000) return `${(formatted / 1_000).toFixed(1)}K`
  return formatted.toFixed(2)
}

function SkeletonBox({ className = 'h-4 w-20' }: { className?: string }) {
  return <div className={`bg-white/5 rounded animate-pulse ${className}`} />
}

interface TokenBreakdown {
  symbol: string
  address: string
  currentBalance: bigint
  bridgeReserve: bigint
  farmReserve: bigint
  emergencyReserve: bigint
  totalDeposited: bigint
}

interface ChainData {
  chainId: number
  name: string
  icon: string
  totalBalance: bigint
  availableBalance: bigint
  lockedBalance: bigint
  active: boolean
}

export default function VaultPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [selToken, setSelToken] = useState('USDTZ')
  const [selChain, setSelChain] = useState('9000')
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [vaultError, setVaultError] = useState('')
  const [vaultTxHash, setVaultTxHash] = useState<string | null>(null)

  const handleVaultDeposit = async () => {
    if (!amount || !address || !publicClient || !walletClient || !isConnected) return
    setIsSubmitting(true)
    setVaultError('')
    setVaultTxHash(null)
    try {
      const depositAmount = parseEther(amount)
      const tokenConfig = TOKENS_CONFIG.find(t => t.symbol === selToken)
      if (!tokenConfig) return

      const { request: approveReq } = await publicClient.simulateContract({
        address: tokenConfig.address as `0x${string}`,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [LIQUIDITY_VAULT_ADDRESS as `0x${string}`, depositAmount],
        account: address,
      })
      await walletClient.writeContract(approveReq)

      const { request } = await publicClient.simulateContract({
        address: LIQUIDITY_VAULT_ADDRESS as `0x${string}`,
        abi: ABIS.LiquidityVault,
        functionName: 'deposit',
        args: [tokenConfig.address as `0x${string}`, depositAmount, BigInt(selChain)],
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setVaultTxHash(hash)
      setAmount('')
    } catch (err: any) {
      console.error('Vault deposit failed:', err)
      setVaultError(err?.shortMessage || 'Deposit failed — check balance and allowance')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVaultWithdraw = async () => {
    if (!amount || !address || !publicClient || !walletClient || !isConnected) return
    setIsSubmitting(true)
    setVaultError('')
    setVaultTxHash(null)
    try {
      const withdrawAmount = parseEther(amount)
      const tokenConfig = TOKENS_CONFIG.find(t => t.symbol === selToken)
      if (!tokenConfig) return

      const { request } = await publicClient.simulateContract({
        address: LIQUIDITY_VAULT_ADDRESS as `0x${string}`,
        abi: ABIS.LiquidityVault,
        functionName: 'withdraw',
        args: [tokenConfig.address as `0x${string}`, withdrawAmount, BigInt(selChain)],
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setVaultTxHash(hash)
      setAmount('')
    } catch (err: any) {
      console.error('Vault withdraw failed:', err)
      setVaultError(err?.shortMessage || 'Withdraw failed — check available balance')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get vault address for config
  const vaultAddress = LIQUIDITY_VAULT_ADDRESS

  // Get allocation percentages
  const { data: bridgePercent } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'BRIDGE_RESERVE_PERCENT',
  })

  const { data: farmPercent } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'FARM_RESERVE_PERCENT',
  })

  const { data: emergencyPercent } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'EMERGENCY_RESERVE_PERCENT',
  })

  // Get supported tokens
  const { data: supportedTokensArray } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'supportedTokens',
  })

  // Get chain count
  const { data: chainCount } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'supportedChainIds',
    args: [BigInt(0)],
    enabled: false, // Will be called per-index
  })

  // Get token liquidity for each configured token
  const tokenBreakdowns = useMemo(() => {
    return TOKENS_CONFIG.map((token) => {
      return { token, data: null as TokenBreakdown | null }
    })
  }, [])

  // Token 0: USDTZ
  const { data: usdtzLiquidity } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'tokenLiquidity',
    args: [TOKENS_CONFIG[0].address as `0x${string}`],
  })

  // Token 1: USDT
  const { data: usdtLiquidity } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'tokenLiquidity',
    args: [TOKENS_CONFIG[1].address as `0x${string}`],
  })

  // Token 2: BUSD
  const { data: busdLiquidity } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'tokenLiquidity',
    args: [TOKENS_CONFIG[2].address as `0x${string}`],
  })

  // Token 3: BNB
  const { data: bnbLiquidity } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'tokenLiquidity',
    args: [TOKENS_CONFIG[3].address as `0x${string}`],
  })

  // Token 4: ETH
  const { data: ethLiquidity } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'tokenLiquidity',
    args: [TOKENS_CONFIG[4].address as `0x${string}`],
  })

  const allLiquidityData = [usdtzLiquidity, usdtLiquidity, busdLiquidity, bnbLiquidity, ethLiquidity]

  // Build token data
  const tokensData = useMemo(() => {
    return TOKENS_CONFIG.map((token, i) => {
      const data = allLiquidityData[i]
      if (!data) return null

      return {
        symbol: token.symbol,
        address: token.address,
        currentBalance: data[2] as bigint, // currentBalance
        bridgeReserve: data[3] as bigint,  // bridgeReserve
        farmReserve: data[4] as bigint,    // farmReserve
        emergencyReserve: data[5] as bigint, // emergencyReserve
        totalDeposited: data[6] as bigint, // totalDeposited
      } as TokenBreakdown
    }).filter(Boolean) as TokenBreakdown[]
  }, [allLiquidityData])

  // Calculate totals from tokens
  const totals = useMemo(() => {
    let totalValue = BigInt(0)
    let totalAvailable = BigInt(0)
    let totalLocked = BigInt(0)

    tokensData.forEach(t => {
      totalValue += t.currentBalance
      totalAvailable += t.bridgeReserve
      totalLocked += t.farmReserve + t.emergencyReserve
    })

    return { totalValue, totalAvailable, totalLocked }
  }, [tokensData])

  // Get chain liquidity data
  const { data: chain0Data } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'chainLiquidity',
    args: [BigInt(CHAINS[0].id)],
  })

  const { data: chain1Data } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'chainLiquidity',
    args: [BigInt(CHAINS[1].id)],
  })

  const { data: chain2Data } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'chainLiquidity',
    args: [BigInt(CHAINS[2].id)],
  })

  const { data: chain3Data } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'chainLiquidity',
    args: [BigInt(CHAINS[3].id)],
  })

  const allChainData = [chain0Data, chain1Data, chain2Data, chain3Data]

  const chainsData = useMemo(() => {
    return CHAINS.map((chain, i) => {
      const data = allChainData[i]
      if (!data) return null

      return {
        chainId: chain.id,
        name: chain.name,
        icon: chain.icon,
        totalBalance: data[2] as bigint,
        availableBalance: data[3] as bigint,
        lockedBalance: data[4] as bigint,
        active: data[6] as boolean,
      } as ChainData
    }).filter(Boolean) as ChainData[]
  }, [allChainData])

  // Get daily limit for selected chain
  const { data: dailyLimit } = useContractRead({
    address: vaultAddress,
    abi: ABIS.LiquidityVault,
    functionName: 'tokenLiquidity',
    args: [TOKENS_CONFIG.find(t => t.symbol === selToken)?.address as `0x${string}`],
    enabled: !!selToken,
  })

  // Calculate utilization
  const utilization = useMemo(() => {
    if (!dailyLimit || dailyLimit[7] === BigInt(0)) return 0
    const used = dailyLimit[8] as bigint
    const limit = dailyLimit[7] as bigint
    return Math.round(Number(used * BigInt(10000) / limit) / 100)
  }, [dailyLimit])

  // Allocation percentages
  const bridgePct = bridgePercent ? Number(bridgePercent) / 100 : 60
  const farmPct = farmPercent ? Number(farmPercent) / 100 : 25
  const emergencyPct = emergencyPercent ? Number(emergencyPercent) / 100 : 15

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <PageHeader
          title="Liquidity Vault"
          subtitle="Cross-chain liquidity reserves for seamless bridging"
          status={{ label: 'Vault Healthy', variant: 'success' }}
        />

        <AnimatedSection className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              label="Total Value"
              value={totals.totalValue > 0 ? formatUsd(totals.totalValue) : <SkeletonBox className="h-8 w-24" />}
              icon={<Landmark className="w-5 h-5" />}
            />
            <StatCard
              label="Available"
              value={totals.totalAvailable > 0 ? formatUsd(totals.totalAvailable) : <SkeletonBox className="h-8 w-24" />}
              icon={<Unlock className="w-5 h-5" />}
            />
            <StatCard
              label="Locked"
              value={totals.totalLocked > 0 ? formatUsd(totals.totalLocked) : <SkeletonBox className="h-8 w-24" />}
              icon={<Lock className="w-5 h-5" />}
            />
            <StatCard
              label="Total Deposits"
              value={tokensData.length > 0 ? formatUsd(tokensData.reduce((acc, t) => acc + t.totalDeposited, BigInt(0))) : <SkeletonBox className="h-8 w-24" />}
            />
            <StatCard
              label="Active Chains"
              value={chainsData.filter(c => c.active).length.toString()}
            />
          </div>
        </AnimatedSection>

        <div className="mb-6">
          <Tabs
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'deposit', label: 'Deposit' },
              { id: 'withdraw', label: 'Withdraw' },
              { id: 'chains', label: 'Chain Liquidity' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {activeTab === 'overview' && (
          <AnimatedSection>
            <div className="grid lg:grid-cols-2 gap-6">
              <Card padding="lg">
                <h2 className="text-xl font-bold mb-5">Token Breakdown</h2>
                <div className="space-y-4">
                  {tokensData.length === 0 ? (
                    // Loading skeleton
                    Array(5).fill(0).map((_, i) => (
                      <div key={i} className="p-4 bg-white/5 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <SkeletonBox className="w-10 h-10 rounded-full" />
                            <div>
                              <SkeletonBox className="w-16 h-5 mb-1" />
                              <SkeletonBox className="w-20 h-4" />
                            </div>
                          </div>
                          <SkeletonBox className="w-12 h-6 rounded-full" />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center p-2 bg-white/5 rounded-lg h-16" />
                          <div className="text-center p-2 bg-white/5 rounded-lg h-16" />
                          <div className="text-center p-2 bg-white/5 rounded-lg h-16" />
                        </div>
                      </div>
                    ))
                  ) : (
                    tokensData.map((t, i) => {
                      const total = t.currentBalance > 0 ? t.currentBalance : BigInt(1)
                      const bridgePctValue = Math.round(Number(t.bridgeReserve * BigInt(10000) / total) / 100)

                      return (
                        <div key={i} className="p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <TokenIcon symbol={t.symbol} />
                              <div>
                                <h3 className="font-semibold">{t.symbol}</h3>
                                <p className="text-sm text-gray-400">{t.currentBalance > 0 ? formatUsd(t.currentBalance) : '$0.00'}</p>
                              </div>
                            </div>
                            <Badge variant="primary">{bridgePctValue}%</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="text-center p-2 bg-white/5 rounded-lg">
                              <p className="text-gray-500">Bridge</p>
                              <p className="font-semibold mt-0.5">{t.bridgeReserve > 0 ? formatUsd(t.bridgeReserve) : '$0.00'}</p>
                            </div>
                            <div className="text-center p-2 bg-white/5 rounded-lg">
                              <p className="text-gray-500">Farm</p>
                              <p className="font-semibold mt-0.5">{t.farmReserve > 0 ? formatUsd(t.farmReserve) : '$0.00'}</p>
                            </div>
                            <div className="text-center p-2 bg-white/5 rounded-lg">
                              <p className="text-gray-500">Emergency</p>
                              <p className="font-semibold mt-0.5">{t.emergencyReserve > 0 ? formatUsd(t.emergencyReserve) : '$0.00'}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Card>

              <Card padding="lg">
                <h2 className="text-xl font-bold mb-5">Chain Allocation</h2>
                <div className="space-y-4">
                  {chainsData.length === 0 ? (
                    Array(4).fill(0).map((_, i) => (
                      <div key={i} className="p-4 bg-white/5 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <SkeletonBox className="w-8 h-8 rounded-full" />
                            <SkeletonBox className="w-24 h-5" />
                          </div>
                          <SkeletonBox className="w-16 h-6" />
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                          <div className="flex justify-between">
                            <SkeletonBox className="w-16 h-4" />
                            <SkeletonBox className="w-16 h-4" />
                          </div>
                          <div className="flex justify-between">
                            <SkeletonBox className="w-16 h-4" />
                            <SkeletonBox className="w-16 h-4" />
                          </div>
                        </div>
                        <SkeletonBox className="w-full h-2 rounded-full" />
                      </div>
                    ))
                  ) : (
                    chainsData.map((c, i) => {
                      const util = c.totalBalance > 0
                        ? Math.round(Number(c.lockedBalance * BigInt(10000) / c.totalBalance) / 100)
                        : 0

                      return (
                        <div key={i} className="p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{c.icon}</span>
                              <div>
                                <h3 className="font-semibold">{c.name}</h3>
                              </div>
                            </div>
                            <span className="text-lg font-bold">{c.totalBalance > 0 ? formatUsd(c.totalBalance) : '$0.00'}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Available</span>
                              <span className="text-green-400">{c.availableBalance > 0 ? formatUsd(c.availableBalance) : '$0.00'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Locked</span>
                              <span className="text-yellow-400">{c.lockedBalance > 0 ? formatUsd(c.lockedBalance) : '$0.00'}</span>
                            </div>
                          </div>
                          <ProgressBar value={util} label={`Utilization`} />
                        </div>
                      )
                    })
                  )}
                </div>
              </Card>
            </div>
          </AnimatedSection>
        )}

        {(activeTab === 'deposit' || activeTab === 'withdraw') && (
          <AnimatedSection>
            <div className="max-w-2xl mx-auto">
              <Card variant="highlight" padding="lg">
                <h2 className="text-xl font-bold mb-6">
                  {activeTab === 'deposit' ? 'Deposit to Vault' : 'Withdraw from Vault'}
                </h2>
                <div className="space-y-5">
                  <Select
                    label="Token"
                    value={selToken}
                    onChange={(e) => setSelToken(e.target.value)}
                    options={TOKENS_CONFIG.map(t => ({ value: t.symbol, label: t.symbol }))}
                  />
                  <Select
                    label={activeTab === 'deposit' ? 'Destination Chain' : 'Source Chain'}
                    value={selChain}
                    onChange={(e) => setSelChain(e.target.value)}
                    options={CHAINS.map(c => ({ value: c.id.toString(), label: c.name }))}
                  />
                  <Input
                    type="number"
                    label="Amount"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    balance={`Available: ${amount || '0'} ${selToken}`}
                    onMax={() => setAmount('1000')}
                    className="text-xl font-bold"
                  />

                  <div className="p-4 bg-white/5 rounded-xl space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Allocation</span>
                      <span>{bridgePct}% Bridge | {farmPct}% Farm | {emergencyPct}% Emergency</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Daily Limit</span>
                      <span>{dailyLimit && dailyLimit[7] ? formatUsd(dailyLimit[7] as bigint) : '$0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Utilization</span>
                      <span>{utilization}%</span>
                    </div>
                  </div>

                  {vaultError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{vaultError}</div>
                  )}
                  {vaultTxHash && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm">
                      <p className="text-green-400 font-medium">Transaction submitted!</p>
                      <p className="text-xs text-gray-400 mt-1 font-mono break-all">Tx: {vaultTxHash}</p>
                    </div>
                  )}
                  <Button
                    fullWidth
                    size="lg"
                    onClick={activeTab === 'deposit' ? handleVaultDeposit : handleVaultWithdraw}
                    loading={isSubmitting}
                    disabled={!isConnected || !amount || parseFloat(amount) <= 0}
                  >
                    {!isConnected ? 'Connect Wallet' : activeTab === 'deposit' ? 'Deposit to Vault' : 'Withdraw from Vault'}
                  </Button>
                </div>
              </Card>
            </div>
          </AnimatedSection>
        )}

        {activeTab === 'chains' && (
          <AnimatedSection>
            <Card className="overflow-hidden" padding="sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Chain</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">Available</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">Locked</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">Total</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">Utilization</th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chainsData.length === 0 ? (
                      Array(4).fill(0).map((_, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="px-6 py-4"><SkeletonBox className="w-24 h-5" /></td>
                          <td className="px-6 py-4"><SkeletonBox className="w-20 h-5 ml-auto" /></td>
                          <td className="px-6 py-4"><SkeletonBox className="w-20 h-5 ml-auto" /></td>
                          <td className="px-6 py-4"><SkeletonBox className="w-20 h-5 ml-auto" /></td>
                          <td className="px-6 py-4"><SkeletonBox className="w-20 h-5 ml-auto" /></td>
                          <td className="px-6 py-4"><SkeletonBox className="w-16 h-5 ml-auto" /></td>
                        </tr>
                      ))
                    ) : (
                      chainsData.map((c, i) => {
                        const util = c.totalBalance > 0
                          ? Math.round(Number(c.lockedBalance * BigInt(10000) / c.totalBalance) / 100)
                          : 0

                        return (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{c.icon}</span>
                                <span className="font-medium">{c.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right text-green-400">
                              {c.availableBalance > 0 ? formatUsd(c.availableBalance) : '$0.00'}
                            </td>
                            <td className="px-6 py-4 text-right text-yellow-400">
                              {c.lockedBalance > 0 ? formatUsd(c.lockedBalance) : '$0.00'}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold">
                              {c.totalBalance > 0 ? formatUsd(c.totalBalance) : '$0.00'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-white/10 rounded-full h-2">
                                  <div className="bg-gradient-to-r from-green-400 to-primary-400 h-2 rounded-full" style={{ width: `${util}%` }} />
                                </div>
                                <span className="text-sm">{util}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Badge variant={c.active ? 'success' : 'warning'}>
                                {c.active ? 'Healthy' : 'Inactive'}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </AnimatedSection>
        )}
      </div>
    </Layout>
  )
}