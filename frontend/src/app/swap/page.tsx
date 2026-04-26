'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, RotateCcw, ChevronDown, AlertTriangle, Check, Info, Zap, Shield, Loader2, Search, Plus } from 'lucide-react'
import { useAccount, useContractRead, usePublicClient, useWalletClient } from 'wagmi'
import { createPublicClient, http, formatUnits, parseUnits } from 'viem'
import { bsc } from 'viem/chains'
import { useDebounce } from 'use-debounce'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import AnimatedSection from '@/components/ui/AnimatedSection'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { cn } from '@/lib/utils'
import { USDTZ_CONFIG, COINGECKO_TOKEN_IDS } from '@/lib/config'
import { buildTokenList, fetchTokenPrices, type TokenData } from '@/lib/api/coingecko'

const ROUTER = USDTZ_CONFIG.contracts.router as `0x${string}`

const bscClient = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed.binance.org'),
})

const PANCAKE_ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsOut',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactETHForTokens',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'swapExactTokensForETH',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
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

interface Token {
  symbol: string
  name: string
  address: `0x${string}`
  decimals: number
  logoURI?: string
  price?: number
  priceChange24h?: number
}

const SLIPPAGE_OPTIONS = ['0.1', '0.5', '1.0', '3.0']
const DEFAULT_DEADLINE = 20 * 60

function useTokenBalance(token: Token | null, address?: `0x${string}`) {
  const isNative = token?.symbol === 'BNB'
  return useContractRead({
    address: isNative || !token ? undefined : token.address,
    abi: isNative || !token ? undefined : ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    account: address,
    enabled: !!address && !!token && !isNative,
    watch: true,
  })
}

function useTokenAllowance(token: Token | null, owner?: `0x${string}`, spender?: `0x${string}`) {
  const isNative = token?.symbol === 'BNB'
  return useContractRead({
    address: isNative || !token ? undefined : token.address,
    abi: isNative || !token ? undefined : ERC20_ABI,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    enabled: !!owner && !!spender && !!token && !isNative,
  })
}

export default function SwapPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  
  const [allTokens, setAllTokens] = useState<Token[]>([])
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [fromToken, setFromToken] = useState<Token | null>(null)
  const [toToken, setToToken] = useState<Token | null>(null)
  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [slippage, setSlippage] = useState('0.5')
  const [showSettings, setShowSettings] = useState(false)
  const [showTokenSelect, setShowTokenSelect] = useState<'from' | 'to' | null>(null)
  const [isSwapping, setIsSwapping] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [isApproved, setIsApproved] = useState(true)
  const [debouncedFromAmount] = useDebounce(fromAmount, 500)
  const [tokenSearch, setTokenSearch] = useState('')
  const [customTokenAddress, setCustomTokenAddress] = useState('')
  const [importingToken, setImportingToken] = useState(false)

  // Fetch token list from CoinGecko on mount
  useEffect(() => {
    async function loadTokens() {
      setLoading(true)
      try {
        const tokens = await buildTokenList()
        const formattedTokens: Token[] = tokens.map(t => ({
          symbol: t.symbol,
          name: t.name,
          address: t.address as `0x${string}`,
          decimals: t.decimals,
          logoURI: t.logoURI,
          price: t.price,
          priceChange24h: t.priceChange24h,
        }))
        setAllTokens(formattedTokens)
        
        // Set defaults
        const usdtz = formattedTokens.find(t => t.symbol === 'USDTZ')
        const bnb = formattedTokens.find(t => t.symbol === 'BNB')
        setFromToken(bnb || formattedTokens[0])
        setToToken(usdtz || formattedTokens[1])
        
        // Build price map
        const priceMap: Record<string, number> = {}
        formattedTokens.forEach(t => {
          if (t.price) priceMap[t.symbol] = t.price
        })
        setTokenPrices(priceMap)
      } catch (error) {
        console.error('Failed to load tokens:', error)
      } finally {
        setLoading(false)
      }
    }
    loadTokens()
    
    // Refresh prices every 30 seconds
    const interval = setInterval(async () => {
      const tokens = await buildTokenList()
      const priceMap: Record<string, number> = {}
      tokens.forEach(t => {
        if (t.price) priceMap[t.symbol] = t.price
      })
      setTokenPrices(priceMap)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  // Calculate output amount — try on-chain quote first, fallback to CoinGecko prices
  useEffect(() => {
    if (!fromToken || !toToken || !debouncedFromAmount || parseFloat(debouncedFromAmount) <= 0) {
      setToAmount('')
      return
    }

    let cancelled = false
    const getQuote = async () => {
      const wbnb = USDTZ_CONFIG.tokens.wbnb as `0x${string}`
      const fromAddr = fromToken.symbol === 'BNB' ? wbnb : fromToken.address
      const toAddr = toToken.symbol === 'BNB' ? wbnb : toToken.address
      const amountIn = parseUnits(debouncedFromAmount, fromToken.decimals)

      try {
        const path = await findBestPath(fromAddr, toAddr, amountIn)
        const amounts = await bscClient.readContract({
          address: ROUTER,
          abi: PANCAKE_ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [amountIn, path],
        })
        if (!cancelled) {
          const outAmount = (amounts as bigint[])[path.length - 1]
          setToAmount(formatUnits(outAmount, toToken.decimals))
        }
      } catch {
        // Fallback to CoinGecko price estimate
        if (!cancelled && tokenPrices[fromToken.symbol] && tokenPrices[toToken.symbol]) {
          const fromPrice = tokenPrices[fromToken.symbol]
          const toPrice = tokenPrices[toToken.symbol]
          const fromValue = parseFloat(debouncedFromAmount) * fromPrice
          setToAmount((fromValue / toPrice).toFixed(6))
        }
      }
    }
    getQuote()
    return () => { cancelled = true }
  }, [debouncedFromAmount, fromToken, toToken, tokenPrices])

  // Check allowance
  useEffect(() => {
    if (!isConnected || !address || !fromToken || fromToken.symbol === 'BNB') {
      setIsApproved(true)
      return
    }
    
    const checkAllowance = async () => {
      try {
        const allowance = await publicClient?.readContract({
          address: fromToken.address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, ROUTER],
        })
        const amount = parseUnits(debouncedFromAmount || '0', fromToken.decimals)
        setIsApproved(allowance >= amount)
      } catch (error) {
        console.error('Failed to check allowance:', error)
        setIsApproved(false)
      }
    }
    checkAllowance()
  }, [isConnected, address, fromToken, debouncedFromAmount, publicClient])

  const { data: fromBalance } = useTokenBalance(fromToken, address)
  const { data: toBalance } = useTokenBalance(toToken, address)
  const { data: allowance } = useTokenAllowance(fromToken, address, ROUTER)

  const handleApprove = async () => {
    if (!fromToken || !debouncedFromAmount || !address || !publicClient || !walletClient) return
    try {
      const { request } = await publicClient.simulateContract({
        address: fromToken.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ROUTER, parseUnits(debouncedFromAmount, fromToken.decimals)],
        account: address,
      })
      const tx = await walletClient.writeContract(request)
      await publicClient.waitForTransactionReceipt({ hash: tx })
      setIsApproved(true)
    } catch (error: any) {
      console.error('Approval failed:', error)
      setSwapError(error?.shortMessage || 'Approval failed')
    }
  }

  const [swapError, setSwapError] = useState('')

  const findBestPath = async (fromAddr: `0x${string}`, toAddr: `0x${string}`, amountIn: bigint): Promise<`0x${string}`[]> => {
    const wbnb = USDTZ_CONFIG.tokens.wbnb as `0x${string}`
    const usdt = USDTZ_CONFIG.tokens.usdt as `0x${string}`
    const busd = USDTZ_CONFIG.tokens.busd as `0x${string}`

    const candidates: `0x${string}`[][] = [
      [fromAddr, toAddr],
      [fromAddr, wbnb, toAddr],
      [fromAddr, usdt, toAddr],
      [fromAddr, busd, toAddr],
      [fromAddr, wbnb, usdt, toAddr],
    ].filter(p => {
      const unique = new Set(p.map(a => a.toLowerCase()))
      return unique.size === p.length
    }) as `0x${string}`[][]

    let bestPath = candidates[0]
    let bestOut = BigInt(0)

    for (const path of candidates) {
      try {
        const amounts = await bscClient.readContract({
          address: ROUTER,
          abi: PANCAKE_ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [amountIn, path],
        })
        const out = (amounts as bigint[])[path.length - 1]
        if (out > bestOut) {
          bestOut = out
          bestPath = path
        }
      } catch {
        // path has no liquidity, skip
      }
    }

    if (bestOut === BigInt(0)) throw new Error('No liquidity found for this pair')
    return bestPath
  }

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount || !address || !publicClient || !walletClient) return
    setIsSwapping(true)
    setTxHash(null)
    setSwapError('')
    try {
      const isFromNative = fromToken.symbol === 'BNB'
      const isToNative = toToken.symbol === 'BNB'
      const wbnb = USDTZ_CONFIG.tokens.wbnb as `0x${string}`

      const amountIn = parseUnits(fromAmount, fromToken.decimals)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE)

      // Build path: native cases are simple, token-to-token finds best route
      let path: `0x${string}`[]
      if (isFromNative) {
        path = await findBestPath(wbnb, toToken.address, amountIn)
      } else if (isToNative) {
        path = await findBestPath(fromToken.address, wbnb, amountIn)
      } else {
        path = await findBestPath(fromToken.address, toToken.address, amountIn)
      }

      // Get actual expected output from the router
      const amounts = await bscClient.readContract({
        address: ROUTER,
        abi: PANCAKE_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountIn, path],
      })
      const expectedOut = (amounts as bigint[])[path.length - 1]
      const slippageBps = BigInt(Math.floor(parseFloat(slippage) * 100))
      const minAmountOut = expectedOut - (expectedOut * slippageBps / BigInt(10000))

      // Approve token spend for non-native swaps
      if (!isFromNative) {
        const { request: approveReq } = await publicClient.simulateContract({
          address: fromToken.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ROUTER, amountIn],
          account: address,
        })
        const approveTx = await walletClient.writeContract(approveReq)
        await publicClient.waitForTransactionReceipt({ hash: approveTx })
      }

      let hash: `0x${string}`
      if (isFromNative) {
        const { request } = await publicClient.simulateContract({
          address: ROUTER,
          abi: PANCAKE_ROUTER_ABI,
          functionName: 'swapExactETHForTokens',
          args: [minAmountOut, path, address, deadline],
          value: amountIn,
          account: address,
        })
        hash = await walletClient.writeContract(request)
      } else if (isToNative) {
        const { request } = await publicClient.simulateContract({
          address: ROUTER,
          abi: PANCAKE_ROUTER_ABI,
          functionName: 'swapExactTokensForETH',
          args: [amountIn, minAmountOut, path, address, deadline],
          account: address,
        })
        hash = await walletClient.writeContract(request)
      } else {
        const { request } = await publicClient.simulateContract({
          address: ROUTER,
          abi: PANCAKE_ROUTER_ABI,
          functionName: 'swapExactTokensForTokens',
          args: [amountIn, minAmountOut, path, address, deadline],
          account: address,
        })
        hash = await walletClient.writeContract(request)
      }
      setTxHash(hash)
    } catch (error: any) {
      console.error('Swap failed:', error)
      setSwapError(error?.shortMessage || error?.message || 'Swap failed — no liquidity or insufficient balance')
    } finally {
      setIsSwapping(false)
    }
  }

  const handleSwitchTokens = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount(toAmount)
  }

  const priceImpact = useMemo(() => {
    if (!fromToken || !toToken || !fromAmount || !toAmount || !tokenPrices[fromToken.symbol] || !tokenPrices[toToken.symbol]) return 0
    const expectedOut = (parseFloat(fromAmount) * tokenPrices[fromToken.symbol]) / tokenPrices[toToken.symbol]
    const actualOut = parseFloat(toAmount)
    if (expectedOut === 0) return 0
    return Math.abs((expectedOut - actualOut) / expectedOut)
  }, [fromToken, toToken, fromAmount, toAmount, tokenPrices])

  const exchangeRate = useMemo(() => {
    if (!fromToken || !toToken || !fromAmount || !toAmount) return 0
    return parseFloat(toAmount) / parseFloat(fromAmount)
  }, [fromToken, toToken, fromAmount, toAmount])

  const filteredTokens = useMemo(() => {
    const search = tokenSearch.toLowerCase().trim()
    const excludeSymbol = showTokenSelect === 'from' ? toToken?.symbol : fromToken?.symbol
    return allTokens
      .filter(t => t.symbol !== excludeSymbol)
      .filter(t => !search || t.symbol.toLowerCase().includes(search) || t.name.toLowerCase().includes(search) || t.address.toLowerCase() === search)
  }, [allTokens, tokenSearch, showTokenSelect, fromToken, toToken])

  const [importError, setImportError] = useState('')

  const handleImportToken = async () => {
    setImportError('')
    const addr = customTokenAddress.trim()
    if (!addr) return
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setImportError('Invalid address format')
      return
    }

    const exists = allTokens.find(t => t.address.toLowerCase() === addr.toLowerCase())
    if (exists) {
      setImportError(`${exists.symbol} is already in the list`)
      return
    }

    setImportingToken(true)
    try {
      const tokenAbi = [
        { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
        { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
        { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
      ] as const
      const typedAddr = addr as `0x${string}`

      const [symbol, name, decimals] = await Promise.all([
        bscClient.readContract({ address: typedAddr, abi: tokenAbi, functionName: 'symbol' }),
        bscClient.readContract({ address: typedAddr, abi: tokenAbi, functionName: 'name' }),
        bscClient.readContract({ address: typedAddr, abi: tokenAbi, functionName: 'decimals' }),
      ])

      const newToken: Token = { symbol: symbol as string, name: name as string, address: typedAddr, decimals: Number(decimals), price: 0, priceChange24h: 0 }
      setAllTokens(prev => [...prev, newToken])
      setCustomTokenAddress('')
    } catch (error) {
      console.error('Failed to import token:', error)
      setImportError('Not a valid BEP-20 token on BSC')
    } finally {
      setImportingToken(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-400" />
            <p className="text-gray-400">Loading live token prices...</p>
          </Card>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <AnimatedSection>
          <Card variant="highlight" padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Swap</h1>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <div className="mb-6 p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium">Slippage Tolerance</span>
                </div>
                <div className="flex gap-2">
                  {SLIPPAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSlippage(opt)}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        slippage === opt
                          ? 'bg-primary-500 text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      )}
                    >
                      {opt}%
                    </button>
                  ))}
                  <input
                    type="number"
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                    className="w-20 px-3 py-2 bg-white/10 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Custom"
                  />
                </div>
              </div>
            )}

            {/* From Token */}
            <div className="p-4 bg-white/5 rounded-2xl mb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">From</span>
                {isConnected && fromBalance && (
                  <span className="text-sm text-gray-400">
                    Balance: {formatUnits(fromBalance || BigInt(0), fromToken?.decimals || 18).slice(0, 6)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-3xl font-bold outline-none placeholder:text-gray-600"
                />
                <button
                  onClick={() => setShowTokenSelect('from')}
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                >
                  {fromToken && <TokenIcon symbol={fromToken.symbol} size="lg" />}
                  <span className="font-semibold">{fromToken?.symbol || 'Select'}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              {fromToken && tokenPrices[fromToken.symbol] && (
                <p className="text-sm text-gray-400 mt-2">
                  ≈ ${(parseFloat(fromAmount || '0') * tokenPrices[fromToken.symbol]).toFixed(2)}
                </p>
              )}
            </div>

            {/* Switch Button */}
            <div className="flex justify-center -my-3 relative z-10">
              <button
                onClick={handleSwitchTokens}
                className="p-3 bg-dark-200 border-4 border-dark-300 rounded-xl hover:scale-110 transition-transform"
              >
                <RotateCcw className="w-5 h-5 text-primary-400" />
              </button>
            </div>

            {/* To Token */}
            <div className="p-4 bg-white/5 rounded-2xl mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">To</span>
                {isConnected && toToken && (
                  <span className="text-sm text-gray-400">
                    Balance: {formatUnits(toBalance || BigInt(0), toToken.decimals).slice(0, 6)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={toAmount}
                  readOnly
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-3xl font-bold outline-none placeholder:text-gray-600"
                />
                <button
                  onClick={() => setShowTokenSelect('to')}
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                >
                  {toToken && <TokenIcon symbol={toToken.symbol} size="lg" />}
                  <span className="font-semibold">{toToken?.symbol || 'Select'}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              {toToken && tokenPrices[toToken.symbol] && (
                <p className="text-sm text-gray-400 mt-2">
                  ≈ ${(parseFloat(toAmount || '0') * tokenPrices[toToken.symbol]).toFixed(2)}
                </p>
              )}
            </div>

            {/* Price Info */}
            {fromAmount && toAmount && (
              <div className="mt-4 p-4 bg-white/5 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Rate</span>
                  <span className="text-gray-300">
                    1 {fromToken?.symbol} = {exchangeRate.toFixed(6)} {toToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Price Impact</span>
                  <span className={cn(
                    priceImpact > 3 ? 'text-red-400' : priceImpact > 1 ? 'text-yellow-400' : 'text-green-400'
                  )}>
                    {(priceImpact * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Network Fee</span>
                  <span className="text-gray-300">~$0.12</span>
                </div>
                {priceImpact > 3 && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    High price impact. Consider smaller trade size.
                  </div>
                )}
              </div>
            )}

            {/* Transaction Status */}
            <AnimatePresence>
              {txHash && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Check className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">Transaction submitted!</span>
                  </div>
                  <a
                    href={`https://bscscan.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-400 hover:text-primary-400 transition-colors"
                  >
                    View on BSCScan: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                  </a>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Button */}
            {!isConnected ? (
              <Button fullWidth size="lg" className="mt-6">
                Connect Wallet
              </Button>
            ) : !isApproved && fromToken && fromToken.symbol !== 'BNB' ? (
              <Button fullWidth size="lg" className="mt-6" onClick={handleApprove}>
                Approve {fromToken.symbol}
              </Button>
            ) : (
              <Button
                fullWidth
                size="lg"
                onClick={handleSwap}
                loading={isSwapping}
                disabled={!fromAmount || parseFloat(fromAmount) <= 0 || !toAmount}
                className="mt-6"
              >
                {!fromAmount ? 'Enter Amount' : isSwapping ? 'Swapping...' : `Swap ${fromToken?.symbol} for ${toToken?.symbol}`}
              </Button>
            )}

            {swapError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {swapError}
                </p>
              </div>
            )}
          </Card>
        </AnimatedSection>

        {/* Quick Stats */}
        <AnimatedSection delay={0.1} className="mt-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <Zap className="w-5 h-5 text-primary-400 mx-auto mb-2" />
              <p className="text-lg font-bold">$0.12</p>
              <p className="text-xs text-gray-500">Avg. Gas</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <Shield className="w-5 h-5 text-secondary-400 mx-auto mb-2" />
              <p className="text-lg font-bold">&lt;0.01%</p>
              <p className="text-xs text-gray-500">Price Impact</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <Check className="w-5 h-5 text-green-400 mx-auto mb-2" />
              <p className="text-lg font-bold">{allTokens.length}+</p>
              <p className="text-xs text-gray-500">Tokens</p>
            </div>
          </div>
        </AnimatedSection>

        {/* Token Select Modal */}
        <AnimatePresence>
          {showTokenSelect && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
              onClick={() => { setShowTokenSelect(null); setTokenSearch(''); setCustomTokenAddress('') }}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', bounce: 0 }}
                className="bg-dark-200 w-full max-w-lg rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Select Token</h2>
                  <button onClick={() => { setShowTokenSelect(null); setTokenSearch(''); setCustomTokenAddress('') }} className="p-2 hover:bg-white/10 rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    placeholder="Search by name, symbol, or address"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-gray-500"
                    autoFocus
                  />
                </div>

                {/* Import Custom Token */}
                <div className="mb-4 p-3 bg-white/5 rounded-xl">
                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Import token by contract address
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customTokenAddress}
                      onChange={(e) => { setCustomTokenAddress(e.target.value); setImportError('') }}
                      placeholder="0x..."
                      className="flex-1 px-3 py-2 bg-white/5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-gray-500 font-mono"
                    />
                    <button
                      onClick={handleImportToken}
                      disabled={importingToken || !customTokenAddress}
                      className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
                    >
                      {importingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Import'}
                    </button>
                  </div>
                  {importError && <p className="text-xs text-red-400 mt-2">{importError}</p>}
                </div>

                {/* Token List */}
                <div className="space-y-1">
                  {filteredTokens.length === 0 && (
                    <p className="text-center text-gray-500 py-8 text-sm">No tokens found. Try importing by address above.</p>
                  )}
                  {filteredTokens.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => {
                        if (showTokenSelect === 'from') {
                          setFromToken(token)
                        } else {
                          setToToken(token)
                        }
                        setShowTokenSelect(null)
                        setTokenSearch('')
                      }}
                      className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <TokenIcon symbol={token.symbol} size="lg" />
                      <div className="text-left flex-1">
                        <p className="font-semibold">{token.symbol}</p>
                        <p className="text-xs text-gray-400">{token.name}</p>
                      </div>
                      {token.price ? (
                        <div className="text-right">
                          <p className="font-medium">${token.price.toFixed(2)}</p>
                          {token.priceChange24h != null && token.priceChange24h !== 0 && (
                            <p className={cn(
                              'text-xs',
                              token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                            )}>
                              {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                            </p>
                          )}
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  )
}
