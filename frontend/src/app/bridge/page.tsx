'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, ChevronRight, Globe, Lock, Coins, ArrowRightLeft, Shield } from 'lucide-react'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import AnimatedSection from '@/components/ui/AnimatedSection'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { cn } from '@/lib/utils'
import { useContractRead, useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { ABIS } from '@/lib/abis'
import { USDTZ_CONFIG } from '@/lib/config'
import { formatEther, parseEther } from 'viem'

const CROSS_CHAIN_BRIDGE_ADDRESS = USDTZ_CONFIG.contracts.crossChainBridge as `0x${string}`
const LIQUIDITY_VAULT_ADDRESS = USDTZ_CONFIG.contracts.liquidityVault as `0x${string}`
const USDTZ_ADDRESS = USDTZ_CONFIG.contracts.usdtz as `0x${string}`

const CHAINS = [
  { id: 'bsc', name: 'BNB Chain', icon: 'BNB', color: 'from-yellow-400 to-orange-500', status: 'active', chainId: 56 },
  { id: 'zedxion', name: 'Zedxion', icon: 'ZEDX', color: 'from-cyan-400 to-blue-500', status: 'active', chainId: 9000 },
  { id: 'ethereum', name: 'Ethereum', icon: 'ETH', color: 'from-blue-400 to-indigo-500', status: 'coming', chainId: 1 },
  { id: 'polygon', name: 'Polygon', icon: 'MATIC', color: 'from-purple-400 to-purple-600', status: 'coming', chainId: 137 },
]

const BRIDGE_PAIRS = [
  { from: 'USDTZ', to: 'USDT', type: 'one-sided' },
  { from: 'USDTZ', to: 'BNB', type: 'one-sided' },
  { from: 'USDTZ', to: 'ETH', type: 'one-sided' },
  { from: 'USDTZ', to: 'ZEDX', type: 'one-sided' },
  { from: 'ZEDX', to: 'USDT', type: 'one-sided' },
  { from: 'ZEDX', to: 'BNB', type: 'one-sided' },
]

// Contract returns tuples, not objects — access by index
// chainLiquidity: [chainId, name, totalBalance, availableBalance, lockedBalance, lastRebalance, active]
// getChainConfig returns similar tuple

function formatUsd(value: bigint | string | number): string {
  const num = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number(formatEther(value))
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`
  return `$${num.toFixed(2)}`
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-white/10 rounded', className)} />
}

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

export default function BridgePage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [selectedChain, setSelectedChain] = useState('zedxion')
  const [selectedPair, setSelectedPair] = useState<typeof BRIDGE_PAIRS[0] | null>(null)
  const [amount, setAmount] = useState('')
  const [isBridging, setIsBridging] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [bridgeError, setBridgeError] = useState('')

  // Read chain configs — results are tuples, access safely
  const { data: bscChainConfigRaw } = useContractRead({
    address: CROSS_CHAIN_BRIDGE_ADDRESS,
    abi: ABIS.CrossChainBridge,
    functionName: 'getChainConfig',
    args: [BigInt(56)],
  })

  const { data: zedxionChainConfigRaw } = useContractRead({
    address: CROSS_CHAIN_BRIDGE_ADDRESS,
    abi: ABIS.CrossChainBridge,
    functionName: 'getChainConfig',
    args: [BigInt(9000)],
  })

  // Read chain liquidity — results are tuples: [chainId, name, totalBalance, availableBalance, lockedBalance, lastRebalance, active]
  const { data: bscLiquidityRaw } = useContractRead({
    address: LIQUIDITY_VAULT_ADDRESS,
    abi: ABIS.LiquidityVault,
    functionName: 'chainLiquidity',
    args: [BigInt(56)],
  })

  const { data: zedxionLiquidityRaw } = useContractRead({
    address: LIQUIDITY_VAULT_ADDRESS,
    abi: ABIS.LiquidityVault,
    functionName: 'chainLiquidity',
    args: [BigInt(9000)],
  })

  const safeBigInt = (val: unknown): bigint => {
    if (typeof val === 'bigint') return val
    if (typeof val === 'number') return BigInt(val)
    return BigInt(0)
  }

  const parseLiquidity = (raw: unknown) => {
    if (!raw || !Array.isArray(raw) || raw.length < 7) return null
    return {
      chainId: safeBigInt(raw[0]),
      name: String(raw[1] || ''),
      totalBalance: safeBigInt(raw[2]),
      availableBalance: safeBigInt(raw[3]),
      lockedBalance: safeBigInt(raw[4]),
      lastRebalance: safeBigInt(raw[5]),
      active: Boolean(raw[6]),
    }
  }

  const bscLiquidity = parseLiquidity(bscLiquidityRaw)
  const zedxionLiquidity = parseLiquidity(zedxionLiquidityRaw)

  const totalLiquidity = useMemo(() => {
    const bsc = bscLiquidity ? Number(formatEther(bscLiquidity.totalBalance)) : 0
    const zedxion = zedxionLiquidity ? Number(formatEther(zedxionLiquidity.totalBalance)) : 0
    return bsc + zedxion
  }, [bscLiquidity, zedxionLiquidity])

  const volume24h = useMemo(() => {
    const parseGasFee = (raw: unknown) => {
      if (!raw || !Array.isArray(raw)) return 0
      const fee = raw[3] ?? raw[2]
      return fee ? Number(safeBigInt(fee)) / 1e18 * 100 : 0
    }
    return parseGasFee(bscChainConfigRaw) + parseGasFee(zedxionChainConfigRaw)
  }, [bscChainConfigRaw, zedxionChainConfigRaw])

  const selectedChainLiquidity = selectedChain === 'bsc' ? bscLiquidity : selectedChain === 'zedxion' ? zedxionLiquidity : null

  const parseChainConfig = (raw: unknown) => {
    if (!raw || !Array.isArray(raw) || raw.length < 5) return null
    return {
      active: Boolean(raw[0] ?? false),
      gasFee: safeBigInt(raw[1]),
      minAmount: safeBigInt(raw[2]),
      maxAmount: safeBigInt(raw[3]),
      transferTimeout: safeBigInt(raw[4]),
    }
  }

  const selectedChainConfig = parseChainConfig(
    selectedChain === 'bsc' ? bscChainConfigRaw : selectedChain === 'zedxion' ? zedxionChainConfigRaw : undefined
  )

  const handleBridge = async () => {
    if (!selectedPair || !amount || !address || !publicClient || !walletClient || !isConnected) {
      setBridgeError('Please connect your wallet and select a bridge pair')
      return
    }
    setIsBridging(true)
    setTxHash(null)
    setBridgeError('')
    try {
      const chain = CHAINS.find(c => c.id === selectedChain)
      const destChainId = BigInt(chain?.chainId ?? 9000)
      const bridgeAmount = parseEther(amount)

      // Step 1: Approve USDTZ spend
      try {
        const { request: approveReq } = await publicClient.simulateContract({
          address: USDTZ_ADDRESS,
          abi: ERC20_APPROVE_ABI,
          functionName: 'approve',
          args: [CROSS_CHAIN_BRIDGE_ADDRESS, bridgeAmount],
          account: address,
        })
        const approveTx = await walletClient.writeContract(approveReq)
        await publicClient.waitForTransactionReceipt({ hash: approveTx })
      } catch (approveErr: any) {
        throw new Error(`Approval failed: ${approveErr?.shortMessage || approveErr?.message || 'Unknown error'}`)
      }

      // Step 2: Call initiateBridge(token, amount, destinationChainId, recipient)
      const { request } = await publicClient.simulateContract({
        address: CROSS_CHAIN_BRIDGE_ADDRESS,
        abi: ABIS.CrossChainBridge,
        functionName: 'initiateBridge',
        args: [USDTZ_ADDRESS, bridgeAmount, destChainId, address],
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setTxHash(hash)
    } catch (error: any) {
      console.error('Bridge failed:', error)
      const msg = error?.shortMessage || error?.message || ''
      if (msg.includes('insufficient') || msg.includes('balance')) {
        setBridgeError('Insufficient USDTZ balance for this bridge amount')
      } else if (msg.includes('Chain not active') || msg.includes('not active')) {
        setBridgeError('This bridge route is not active yet — try a different chain')
      } else if (msg.includes('Approval failed')) {
        setBridgeError(msg)
      } else {
        setBridgeError(msg || 'Bridge failed — the bridge contract may not be configured for this route yet')
      }
    } finally {
      setIsBridging(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <AnimatedSection className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <Globe className="w-6 h-6 text-cyan-400" />
            </div>
            <h1 className="text-3xl font-bold">Cross-Chain Bridge</h1>
          </div>
          <p className="text-gray-400">Transfer USDTZ and other tokens across chains with one click</p>
        </AnimatedSection>

        {/* Quick Stats */}
        <AnimatedSection className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center">
              {totalLiquidity > 0 ? (
                <>
                  <p className="text-2xl font-bold">{formatUsd(BigInt(Math.floor(totalLiquidity * 1e18)))}</p>
                  <p className="text-sm text-gray-400">Total Liquidity</p>
                </>
              ) : (
                <>
                  <Skeleton className="h-8 w-20 mx-auto mb-2" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                </>
              )}
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-green-400">0.25%</p>
              <p className="text-sm text-gray-400">Bridge Fee</p>
            </Card>
            <Card className="text-center">
              {selectedChainConfig ? (
                <>
                  <p className="text-2xl font-bold">
                    {selectedChainConfig.active ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-sm text-gray-400">Bridge Status</p>
                </>
              ) : (
                <>
                  <Skeleton className="h-8 w-20 mx-auto mb-2" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                </>
              )}
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold">4</p>
              <p className="text-sm text-gray-400">Supported Chains</p>
            </Card>
          </div>
        </AnimatedSection>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chain Selection */}
          <AnimatedSection delay={0.1}>
            <Card padding="lg">
              <h2 className="text-lg font-bold mb-4">Select Destination</h2>
              <div className="space-y-3">
                {CHAINS.map((chain) => {
                  const chainConfig = parseChainConfig(chain.id === 'bsc' ? bscChainConfigRaw : chain.id === 'zedxion' ? zedxionChainConfigRaw : undefined)
                  const chainLiquidityData = chain.id === 'bsc' ? bscLiquidity : chain.id === 'zedxion' ? zedxionLiquidity : undefined

                  return (
                    <button
                      key={chain.id}
                      onClick={() => chain.status === 'active' && setSelectedChain(chain.id)}
                      className={cn(
                        'w-full flex items-center gap-4 p-4 rounded-xl transition-all',
                        selectedChain === chain.id
                          ? 'bg-primary-500/10 border border-primary-500/30'
                          : chain.status === 'coming'
                            ? 'opacity-50 cursor-not-allowed'
                            : 'bg-white/5 hover:bg-white/10 border border-transparent'
                      )}
                    >
                      <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center', chain.color)}>
                        <span className="text-xs font-bold text-white">{chain.icon[0]}</span>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{chain.name}</p>
                        {chain.status === 'coming' ? (
                          <p className="text-xs text-gray-400">Coming soon</p>
                        ) : chainLiquidityData ? (
                          <p className="text-xs text-gray-400">
                            TVL: {formatUsd(chainLiquidityData.totalBalance)}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">Loading...</p>
                        )}
                      </div>
                      {selectedChain === chain.id && (
                        <Badge variant="primary" className="ml-auto">Selected</Badge>
                      )}
                      {chain.status === 'coming' && (
                        <Badge variant="warning" className="ml-auto text-xs">Soon</Badge>
                      )}
                      {chain.status === 'active' && chainConfig && (
                        <Badge
                          variant={chainConfig.active ? 'success' : 'secondary'}
                          className="ml-auto text-xs"
                        >
                          {chainConfig.active ? 'Live' : 'Inactive'}
                        </Badge>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Zedxion Notice */}
              <div className="mt-6 p-4 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-sm text-cyan-400">Zedxion Integration</span>
                </div>
                <p className="text-xs text-gray-400">
                  Zedxion offers instant settlement and one-sided liquidity pools - no impermanent loss!
                </p>
              </div>

              {/* Chain Limits */}
              {selectedChainConfig && (
                <div className="mt-4 p-4 bg-white/5 rounded-xl">
                  <p className="text-sm font-semibold mb-2">Chain Limits</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Min Amount</span>
                      <span>{Number(formatEther(selectedChainConfig.minAmount)).toFixed(2)} USDTZ</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Amount</span>
                      <span>{Number(formatEther(selectedChainConfig.maxAmount)).toFixed(2)} USDTZ</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Gas Fee</span>
                      <span>{Number(formatEther(selectedChainConfig.gasFee)).toFixed(4)} BNB</span>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </AnimatedSection>

          {/* Liquidity Pairs */}
          <AnimatedSection delay={0.2} className="lg:col-span-2">
            <Card padding="lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold">One-Sided Liquidity</h2>
                  <p className="text-sm text-gray-400">Earn yield by providing single-sided liquidity</p>
                </div>
                <Badge variant="primary">{selectedChain.toUpperCase()}</Badge>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {BRIDGE_PAIRS.map((pair, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedPair(pair)}
                    className={cn(
                      'p-4 rounded-xl border cursor-pointer transition-all',
                      selectedPair === pair
                        ? 'bg-primary-500/10 border-primary-500/30'
                        : 'bg-white/5 border-white/5 hover:border-white/10'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex -space-x-2">
                        <TokenIcon symbol={pair.from} size="sm" />
                        <TokenIcon symbol={pair.to} size="sm" />
                      </div>
                      <span className="font-semibold">{pair.from}/{pair.to}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">one-sided</Badge>
                    </div>
                    <div className="text-sm">
                      <Badge variant="primary" className="text-xs">{pair.type}</Badge>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Bridge Action */}
              <AnimatePresence>
                {selectedPair && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 pt-6 border-t border-white/10"
                  >
                    <h3 className="font-semibold mb-4">Bridge {selectedPair.from} to {selectedChain.toUpperCase()}</h3>
                    <div className="space-y-4">
                      <div className="bg-white/5 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">Amount</span>
                          <span className="text-sm text-gray-400">{selectedPair.from}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-gray-600 text-white"
                          />
                          <button
                            onClick={() => setAmount('1000')}
                            className="px-4 py-2 bg-white/10 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors"
                          >
                            MAX
                          </button>
                        </div>
                      </div>

                      {/* Fee Breakdown */}
                      {selectedChainConfig && amount && parseFloat(amount) > 0 && (
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center gap-3">
                            <Coins className="w-4 h-4 text-primary-400" />
                            <span className="text-sm">Bridge Fee (0.25%)</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{(parseFloat(amount) * 0.0025).toFixed(2)} {selectedPair.from}</p>
                            <p className="text-xs text-gray-400">≈ ${(parseFloat(amount) * 0.0025).toFixed(2)}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Lock className="w-4 h-4 text-primary-400" />
                          <span className="text-sm">You will receive</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            {amount ? (parseFloat(amount) * 0.9975).toFixed(2) : '0.00'} {selectedPair.to}
                          </p>
                          <p className="text-xs text-gray-400">
                            ≈ ${amount ? (parseFloat(amount) * 0.9975).toFixed(2) : '0.00'}
                          </p>
                        </div>
                      </div>

                      {bridgeError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{bridgeError}</div>
                      )}

                      <Button
                        fullWidth
                        size="lg"
                        onClick={handleBridge}
                        loading={isBridging}
                        disabled={!isConnected || !amount || parseFloat(amount) <= 0}
                      >
                        {!isConnected ? 'Connect Wallet' : isBridging ? 'Bridging...' : `Bridge to ${selectedChain.toUpperCase()}`}
                      </Button>

                      <AnimatePresence>
                        {txHash && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl"
                          >
                            <p className="text-green-400 text-sm font-medium mb-2">Bridge initiated!</p>
                            <a
                              href={`https://bscscan.com/tx/${txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-400 hover:text-primary-400 flex items-center gap-1"
                            >
                              View on Explorer <ExternalLink className="w-3 h-3" />
                            </a>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                        <Coins className="w-4 h-4" />
                        <span>Add to one-sided pool after bridge to earn yield</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* One-Sided Pool Info */}
              <div className="mt-6 p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/20">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                    <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">One-Sided Liquidity</p>
                    <p className="text-xs text-gray-400 mt-1">
                      No impermanent loss! Provide liquidity with just one asset.
                      Your single token goes directly into the pool - no need to pair with another asset.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </AnimatedSection>
        </div>

        {/* Supported Chains */}
        <AnimatedSection delay={0.3} className="mt-8">
          <Card padding="lg">
            <h2 className="text-lg font-bold mb-4">Multi-Chain Support</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {CHAINS.map((chain) => {
                const chainConfig = parseChainConfig(chain.id === 'bsc' ? bscChainConfigRaw : chain.id === 'zedxion' ? zedxionChainConfigRaw : undefined)
                const chainLiquidityData = chain.id === 'bsc' ? bscLiquidity : chain.id === 'zedxion' ? zedxionLiquidity : undefined
                const explorerUrl = chain.id === 'bsc' ? 'https://bscscan.com' : chain.id === 'zedxion' ? 'https://explorer.zedxion.xyz' : chain.id === 'ethereum' ? 'https://etherscan.io' : 'https://polygonscan.com'

                return (
                  <div key={chain.id} className="text-center p-4 bg-white/5 rounded-xl">
                    <div className={cn('w-12 h-12 rounded-full bg-gradient-to-br mx-auto mb-3 flex items-center justify-center', chain.color)}>
                      <span className="text-sm font-bold text-white">{chain.icon}</span>
                    </div>
                    <p className="font-semibold">{chain.name}</p>
                    {chain.status === 'active' && chainLiquidityData ? (
                      <p className="text-xs text-green-400 mt-1">TVL: {formatUsd(chainLiquidityData.totalBalance)}</p>
                    ) : chain.status === 'coming' ? (
                      <p className="text-xs text-yellow-400 mt-1">Coming soon</p>
                    ) : (
                      <Skeleton className="h-3 w-16 mx-auto mt-1" />
                    )}
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-400 flex items-center justify-center gap-1 mt-2"
                    >
                      Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )
              })}
            </div>
          </Card>
        </AnimatedSection>
      </div>
    </Layout>
  )
}