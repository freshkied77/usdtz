'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, RotateCcw, ChevronDown, AlertTriangle, Check, Info, Zap, Shield } from 'lucide-react'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import AnimatedSection from '@/components/ui/AnimatedSection'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { cn } from '@/lib/utils'

interface Token {
  symbol: string
  name: string
  address: string
  decimals: number
  balance?: string
  logo?: string
}

const TOKENS: Token[] = [
  { symbol: 'BNB', name: 'BNB', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18 },
  { symbol: 'USDT', name: 'Tether USD', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  { symbol: 'BUSD', name: 'Binance USD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18 },
  { symbol: 'USDTZ', name: 'USDT.z', address: '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665', decimals: 18 },
  { symbol: 'ETH', name: 'Ethereum', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18 },
  { symbol: 'BTCB', name: 'Bitcoin', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18 },
]

const RECENT_TXS = [
  { tokenIn: 'BNB', tokenOut: 'USDT', amountIn: '2.5', amountOut: '1,503.62', time: '2 mins ago', status: 'confirmed' },
  { tokenIn: 'USDTZ', tokenOut: 'BUSD', amountIn: '10,000', amountOut: '10,015', time: '5 mins ago', status: 'confirmed' },
  { tokenIn: 'BUSD', tokenOut: 'BNB', amountIn: '5,000', amountOut: '8.31', time: '12 mins ago', status: 'confirmed' },
]

const SLIPPAGE_OPTIONS = ['0.1', '0.5', '1.0', '3.0']

const PRICE_IMPACT_THRESHOLDS = { safe: 1, warning: 3, danger: 5 }

export default function SwapPage() {
  const [fromToken, setFromToken] = useState<Token>(TOKENS[0])
  const [toToken, setToToken] = useState<Token>(TOKENS[1])
  const [fromAmount, setFromAmount] = useState('')
  const [slippage, setSlippage] = useState('0.5')
  const [showSettings, setShowSettings] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showTokenSelect, setShowTokenSelect] = useState<'from' | 'to' | null>(null)
  const [rotation, setRotation] = useState(0)
  const [isSwapping, setIsSwapping] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [priceImpact, setPriceImpact] = useState<{ value: number; severity: 'safe' | 'warning' | 'danger' } | null>(null)
  const [route, setRoute] = useState<string[]>([])
  const [minReceived, setMinReceived] = useState<string>('')
  const [gasEstimate, setGasEstimate] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  const mockPrices: Record<string, number> = {
    BNB: 601.45,
    USDT: 1.0,
    BUSD: 1.0,
    USDTZ: 1.001,
    ETH: 3512.82,
    BTCB: 67843.21,
  }

  const toAmount = fromAmount ? (parseFloat(fromAmount) * mockPrices[fromToken.symbol] / mockPrices[toToken.symbol]).toFixed(6) : ''

  const calculateTradeDetails = useCallback(() => {
    if (!fromAmount || !toAmount) {
      setPriceImpact(null)
      setRoute([])
      setMinReceived('')
      setGasEstimate('')
      return
    }

    const impact = Math.random() * 0.5
    setPriceImpact({
      value: impact,
      severity: impact < PRICE_IMPACT_THRESHOLDS.safe ? 'safe' : impact < PRICE_IMPACT_THRESHOLDS.warning ? 'warning' : 'danger'
    })

    setRoute(['PancakeSwap', 'USDTZ Router'])
    setMinReceived((parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(2))
    setGasEstimate('0.0025 BNB')
  }, [fromAmount, toAmount, slippage])

  useEffect(() => {
    calculateTradeDetails()
  }, [calculateTradeDetails])

  const handleSwapTokens = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
    setFromAmount('')
    setRotation(r => r + 180)
  }

  const handleSwap = async () => {
    if (!fromAmount) return
    setIsSwapping(true)
    setError(null)

    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      const mockTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
      setTxHash(mockTxHash)
      setFromAmount('')
    } catch (err) {
      setError('Transaction failed. Please try again.')
    } finally {
      setIsSwapping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && fromAmount && !isSwapping) {
      handleSwap()
    }
  }

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <AnimatedSection>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold">Swap</h1>
              <p className="text-sm text-gray-400 mt-1">Best price found across all DEXs</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={cn(
                  'p-2.5 rounded-xl transition-all',
                  showSettings ? 'bg-primary-500/20 text-primary-400' : 'hover:bg-white/10 text-gray-400'
                )}
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setFromAmount(''); setError(null); setTxHash(null) }}
                className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>

          <Card variant="highlight" padding="lg" className="mt-4">
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-4"
                >
                  <div className="p-4 bg-white/5 rounded-xl space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-3 flex items-center gap-2">
                        <span>Slippage Tolerance</span>
                        <span className="text-xs text-gray-500">(auto: 0.5%)</span>
                      </p>
                      <div className="flex gap-2">
                        {SLIPPAGE_OPTIONS.map((val) => (
                          <button
                            key={val}
                            onClick={() => setSlippage(val)}
                            className={cn(
                              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                              slippage === val
                                ? 'bg-primary-500 text-dark-300'
                                : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            )}
                          >
                            {val}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Info className="w-4 h-4" />
                      <span>Your transaction will revert if price moves more than {slippage}%</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* From Token */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:border-primary-500/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">From</span>
                <span className="text-sm text-gray-400">Balance: 12.5 {fromToken.symbol}</span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  ref={inputRef}
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="0.00"
                  className="w-full bg-transparent text-4xl font-bold outline-none placeholder:text-gray-600 text-white"
                />
                <button
                  onClick={() => setShowTokenSelect('from')}
                  className="flex items-center gap-2 px-4 py-3 bg-white/10 rounded-xl hover:bg-white/15 transition-colors shrink-0"
                >
                  <TokenIcon symbol={fromToken.symbol} size="md" />
                  <span className="font-semibold text-base">{fromToken.symbol}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              {fromAmount && (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-gray-500">~${(parseFloat(fromAmount) * mockPrices[fromToken.symbol]).toLocaleString()}</p>
                  <button
                    onClick={() => setFromAmount('12.5')}
                    className="text-xs text-primary-400 hover:text-primary-300 font-medium"
                  >
                    Max
                  </button>
                </div>
              )}
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-3 relative z-10">
              <motion.button
                onClick={handleSwapTokens}
                animate={{ rotate: rotation }}
                transition={{ duration: 0.3 }}
                className="w-12 h-12 rounded-xl bg-gradient-to-r from-primary-500 to-orange-500 flex items-center justify-center hover:shadow-lg hover:shadow-primary-500/30 transition-all border-2 border-dark-300"
              >
                <svg className="w-5 h-5 text-dark-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </motion.button>
            </div>

            {/* To Token */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:border-secondary-500/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">To</span>
                <span className="text-sm text-gray-400">Balance: 5,420 {toToken.symbol}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-full bg-transparent text-4xl font-bold text-gray-300">
                  {toAmount || '0.00'}
                </div>
                <button
                  onClick={() => setShowTokenSelect('to')}
                  className="flex items-center gap-2 px-4 py-3 bg-white/10 rounded-xl hover:bg-white/15 transition-colors shrink-0"
                >
                  <TokenIcon symbol={toToken.symbol} size="md" />
                  <span className="font-semibold text-base">{toToken.symbol}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              {toAmount && toToken.symbol === 'USDTZ' && (
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <Shield className="w-3.5 h-3.5 text-secondary-400" />
                  <span className="text-secondary-400">AI-Protected</span>
                </div>
              )}
            </div>

            {/* Price Details */}
            {fromAmount && priceImpact && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 space-y-2"
              >
                <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl text-sm">
                  <span className="text-gray-400">Rate</span>
                  <span className="font-medium">1 {fromToken.symbol} = {(mockPrices[fromToken.symbol] / mockPrices[toToken.symbol]).toFixed(6)} {toToken.symbol}</span>
                </div>

                <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl text-sm">
                  <span className="text-gray-400">Price Impact</span>
                  <span className={cn(
                    'font-medium flex items-center gap-1',
                    priceImpact.severity === 'safe' ? 'text-green-400' : priceImpact.severity === 'warning' ? 'text-yellow-400' : 'text-red-400'
                  )}>
                    {priceImpact.severity !== 'safe' && <AlertTriangle className="w-3.5 h-3.5" />}
                    {priceImpact.value.toFixed(2)}%
                  </span>
                </div>

                <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl text-sm">
                  <span className="text-gray-400">Min. Received</span>
                  <span className="font-medium">{minReceived} {toToken.symbol}</span>
                </div>

                <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl text-sm">
                  <span className="text-gray-400">Est. Gas</span>
                  <span className="font-medium text-gray-400">{gasEstimate}</span>
                </div>

                <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-xl text-sm">
                  <span className="text-gray-400">Route</span>
                  <div className="flex items-center gap-1.5">
                    {route.map((r, i) => (
                      <Badge key={i} variant="primary" className="text-xs py-1">{r}</Badge>
                    ))}
                    <span className="text-xs text-primary-400 font-medium">Optimal</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3"
                >
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <span className="text-red-400 text-sm">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success */}
            <AnimatePresence>
              {txHash && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Check className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">Swap successful!</span>
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

            {/* Swap Button */}
            <Button
              fullWidth
              size="lg"
              onClick={handleSwap}
              loading={isSwapping}
              disabled={!fromAmount || parseFloat(fromAmount) <= 0}
              className="mt-6"
            >
              {!fromAmount ? 'Enter Amount' : isSwapping ? 'Swapping...' : `Swap ${fromToken.symbol} for ${toToken.symbol}`}
            </Button>

            {/* Keyboard hint */}
            <p className="text-xs text-gray-500 text-center mt-3">Press Enter to swap</p>
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
              <p className="text-lg font-bold">2</p>
              <p className="text-xs text-gray-500">DEX Routes</p>
            </div>
          </div>
        </AnimatedSection>

        {/* Recent Transactions */}
        <AnimatedSection delay={0.2} className="mt-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Recent Transactions</h2>
              <button className="text-xs text-primary-400 hover:text-primary-300 font-medium">View All</button>
            </div>
            <div className="space-y-2">
              {RECENT_TXS.map((tx, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/8 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/20 to-orange-500/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {tx.amountIn} {tx.tokenIn} → {tx.amountOut} {tx.tokenOut}
                      </p>
                      <p className="text-xs text-gray-500">{tx.time}</p>
                    </div>
                  </div>
                  <Badge variant="primary" className="text-xs">{tx.status}</Badge>
                </motion.div>
              ))}
            </div>
          </Card>
        </AnimatedSection>

        {/* Token Select Modal */}
        <AnimatePresence>
          {showTokenSelect && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
              onClick={() => setShowTokenSelect(null)}
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
                  <button onClick={() => setShowTokenSelect(null)} className="p-2 hover:bg-white/10 rounded-lg">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Search by name or address"
                  className="w-full px-4 py-3 bg-white/5 rounded-xl border border-white/10 outline-none focus:border-primary-500/50 text-white placeholder:text-gray-500 mb-4"
                />
                <div className="space-y-1">
                  {TOKENS.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => {
                        if (showTokenSelect === 'from') {
                          if (token.symbol !== toToken.symbol) setFromToken(token)
                        } else {
                          if (token.symbol !== fromToken.symbol) setToToken(token)
                        }
                        setShowTokenSelect(null)
                      }}
                      className={cn(
                        'w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors',
                        (showTokenSelect === 'from' && token.symbol === fromToken.symbol) ||
                        (showTokenSelect === 'to' && token.symbol === toToken.symbol)
                          ? 'bg-primary-500/10'
                          : ''
                      )}
                    >
                      <TokenIcon symbol={token.symbol} size="lg" />
                      <div className="text-left">
                        <p className="font-semibold">{token.symbol}</p>
                        <p className="text-xs text-gray-400">{token.name}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-sm text-gray-400">${mockPrices[token.symbol].toFixed(2)}</p>
                      </div>
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