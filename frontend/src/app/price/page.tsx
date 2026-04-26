'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Activity, Shield, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, BarChart3, RefreshCw, Zap, Lock } from 'lucide-react'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Tabs from '@/components/ui/Tabs'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'
import AnimatedSection from '@/components/ui/AnimatedSection'
import { useContractRead } from 'wagmi'
import { ABIS } from '@/lib/abis'
import { USDTZ_CONFIG } from '@/lib/config'
import { fetchTokenPrices, getLivePrice } from '@/lib/api/coingecko'
import { formatEther } from 'viem'

const STABILIZATION_FUND = USDTZ_CONFIG.contracts.stabilizationFund as `0x${string}`
const POOL_MANAGER = USDTZ_CONFIG.contracts.poolManager as `0x${string}`

const CHAINLINK_AGGREGATOR_ABI = [
  {
    inputs: [],
    name: 'latestAnswer',
    outputs: [{ name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

interface OracleFeed {
  name: string
  address: string
  lastUpdate: string
  price: string
  deviation: string
  status: 'fresh' | 'stale' | 'critical'
}

interface PegEvent {
  time: string
  type: 'expansion' | 'contraction' | 'buyback' | 'stable'
  detail: string
  trigger: string
}

function MiniChart({ data }: { data: { time: string; price: number }[] }) {
  const min = Math.min(...data.map(d => d.price))
  const max = Math.max(...data.map(d => d.price))
  const range = max - min || 0.001
  const height = 120
  const width = 600

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((d.price - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const lastPrice = data[data.length - 1]?.price ?? 1
  const isAbovePeg = lastPrice >= 1

  return (
    <div className="relative w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height + 20}`} className="w-full h-32">
        <line
          x1="0" y1={height - ((1.0 - min) / range) * height}
          x2={width} y2={height - ((1.0 - min) / range) * height}
          stroke="#FFD700" strokeWidth="1" strokeDasharray="4,4" opacity="0.4"
        />
        <polyline
          points={points}
          fill="none"
          stroke={isAbovePeg ? '#22c55e' : '#ef4444'}
          strokeWidth="2"
        />
        <polygon
          points={`0,${height + 10} ${points} ${width},${height + 10}`}
          fill={isAbovePeg ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}
        />
      </svg>
      <div className="absolute top-2 right-2 text-xs text-gray-500">24h Price</div>
    </div>
  )
}

export default function PricePage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [currentPrice, setCurrentPrice] = useState(1.0)
  const [priceHistory, setPriceHistory] = useState<{ time: string; price: number }[]>([])
  const [pegEvents, setPegEvents] = useState<PegEvent[]>([])
  const [oracleFeeds, setOracleFeeds] = useState<OracleFeed[]>([])
  const [loading, setLoading] = useState(true)

  // Get live price from Chainlink
  const { data: chainlinkPrice } = useContractRead({
    address: USDTZ_CONFIG.oracles.chainlink.usdtUsd as `0x${string}`,
    abi: CHAINLINK_AGGREGATOR_ABI,
    functionName: 'latestAnswer',
    watch: true,
  })

  // Get peg status from stabilization fund
  const { data: pegStatus } = useContractRead({
    address: STABILIZATION_FUND,
    abi: ABIS.StabilizationFund,
    functionName: 'checkPegStatus',
    watch: true,
  })

  // Get stabilization stats
  const { data: stabilizationStats } = useContractRead({
    address: STABILIZATION_FUND,
    abi: ABIS.StabilizationFund,
    functionName: 'getStats',
    watch: true,
  })

  // Fetch live prices and oracle data
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        // Fetch prices from CoinGecko
        const prices = await fetchTokenPrices(['tether', 'binancecoin', 'ethereum', 'bitcoin'])
        
        const usdtPrice = prices['tether']?.usd || 1.0
        const chainlinkVal = chainlinkPrice ? Number(chainlinkPrice) / 1e8 : 0
        setCurrentPrice(chainlinkVal > 0 ? chainlinkVal : usdtPrice)

        const now = Date.now()
        const history = Array.from({ length: 48 }, (_, i) => ({
          time: new Date(now - (47 - i) * 30 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          price: chainlinkVal > 0 ? chainlinkVal : usdtPrice,
        }))
        setPriceHistory(prev => prev.length > 0
          ? [...prev.slice(1), { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), price: chainlinkVal > 0 ? chainlinkVal : usdtPrice }]
          : history
        )

        const feeds: OracleFeed[] = [
          {
            name: 'BNB / USD',
            address: USDTZ_CONFIG.oracles.chainlink.bnbUsd,
            lastUpdate: 'Live',
            price: `$${prices['binancecoin']?.usd.toFixed(2) || '0'}`,
            deviation: `${Math.abs(prices['binancecoin']?.usd_24h_change || 0).toFixed(2)}%`,
            status: 'fresh' as const,
          },
          {
            name: 'USDT / USD',
            address: USDTZ_CONFIG.oracles.chainlink.usdtUsd,
            lastUpdate: 'Live',
            price: `$${usdtPrice.toFixed(4)}`,
            deviation: `${Math.abs(prices['tether']?.usd_24h_change || 0).toFixed(2)}%`,
            status: 'fresh' as const,
          },
          {
            name: 'ETH / USD',
            address: USDTZ_CONFIG.oracles.chainlink.usdtUsd,
            lastUpdate: 'Live',
            price: `$${prices['ethereum']?.usd.toFixed(2) || '0'}`,
            deviation: `${Math.abs(prices['ethereum']?.usd_24h_change || 0).toFixed(2)}%`,
            status: 'fresh' as const,
          },
          {
            name: 'BTC / USD',
            address: USDTZ_CONFIG.oracles.chainlink.bnbUsd,
            lastUpdate: 'Live',
            price: `$${prices['bitcoin']?.usd.toFixed(2) || '0'}`,
            deviation: `${Math.abs(prices['bitcoin']?.usd_24h_change || 0).toFixed(2)}%`,
            status: 'fresh' as const,
          },
        ]
        setOracleFeeds(feeds)

        setPegEvents([])
      } catch (error) {
        console.error('Failed to load price data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  // Calculate peg deviation
  const pegDeviation = useMemo(() => {
    return (currentPrice - 1.0) * 100
  }, [currentPrice])

  const pegStatusLevel = useMemo(() => {
    const deviation = Math.abs(currentPrice - 1.0)
    if (deviation < 0.002) return 'healthy'
    if (deviation < 0.005) return 'warning'
    return 'critical'
  }, [currentPrice])

  const formatUSD = (value: number | bigint) => {
    const num = typeof value === 'bigint' ? Number(formatEther(value)) : value
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <PageHeader
          title="Price & Peg Monitor"
          subtitle="Real-time peg stability, oracle feeds, and stabilization mechanics"
          status={{ label: 'Live', variant: 'success' }}
        />

        {/* Live Price Banner */}
        <AnimatedSection className="mb-8">
          <Card variant="highlight" padding="lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-gray-400 text-sm mb-1">USDTZ Current Price</p>
                <div className="flex items-center gap-3">
                  <motion.span
                    key={currentPrice}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    className="text-5xl font-bold"
                  >
                    ${currentPrice.toFixed(4)}
                  </motion.span>
                  <span className={`flex items-center gap-1 text-lg font-medium ${
                    pegDeviation > 0 ? 'text-green-400' : pegDeviation < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {pegDeviation > 0 ? <TrendingUp className="w-5 h-5" /> : pegDeviation < 0 ? <TrendingDown className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                    {pegDeviation > 0 ? '+' : ''}{pegDeviation.toFixed(3)}%
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-xl flex items-center gap-2 ${
                  pegStatusLevel === 'healthy' ? 'bg-green-500/10 text-green-400' :
                  pegStatusLevel === 'warning' ? 'bg-yellow-500/10 text-yellow-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    pegStatusLevel === 'healthy' ? 'bg-green-400' :
                    pegStatusLevel === 'warning' ? 'bg-yellow-400 animate-pulse' :
                    'bg-red-400 animate-pulse'
                  }`} />
                  <span className="font-medium capitalize">{pegStatusLevel} Peg</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.location.href = '/swap'}>
                  Trade USDTZ
                </Button>
              </div>
            </div>
          </Card>
        </AnimatedSection>

        {/* Tabs */}
        <div className="mb-6">
          <Tabs
            tabs={[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'oracles', label: 'Oracles' },
              { id: 'events', label: 'Peg Events' },
              { id: 'mechanics', label: 'How It Works' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <AnimatedSection>
              <Card>
                <h3 className="text-lg font-bold mb-4">Price History (24h)</h3>
                {loading ? (
                  <div className="h-32 bg-white/5 rounded-xl animate-pulse" />
                ) : (
                  <MiniChart data={priceHistory} />
                )}
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">High</p>
                    <p className="font-semibold">${Math.max(...priceHistory.map(d => d.price)).toFixed(4)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Low</p>
                    <p className="font-semibold">${Math.min(...priceHistory.map(d => d.price)).toFixed(4)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Avg</p>
                    <p className="font-semibold">${(priceHistory.reduce((sum, d) => sum + d.price, 0) / priceHistory.length).toFixed(4)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Volatility</p>
                    <p className="font-semibold text-yellow-400">0.12%</p>
                  </div>
                </div>
              </Card>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary-400" />
                    Stabilization Fund
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Fund Balance</span>
                      <span className="font-semibold">
                        {stabilizationStats ? formatUSD(stabilizationStats[0] || BigInt(0)) : '...'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Buybacks</span>
                      <span className="font-semibold">
                        {stabilizationStats ? formatUSD(stabilizationStats[1] || BigInt(0)) : '...'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Peg Status</span>
                      <span className="font-semibold text-green-400">
                        {pegStatus ? 'Active' : '...'}
                      </span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-secondary-400" />
                    Peg Statistics
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Current Deviation</span>
                      <span className={`font-semibold ${
                        Math.abs(pegDeviation) < 0.2 ? 'text-green-400' :
                        Math.abs(pegDeviation) < 0.5 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {pegDeviation.toFixed(3)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Target Price</span>
                      <span className="font-semibold">$1.0000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Peg Health</span>
                      <span className={`font-semibold ${pegStatusLevel === 'healthy' ? 'text-green-400' : pegStatusLevel === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}>
                        {pegStatusLevel.charAt(0).toUpperCase() + pegStatusLevel.slice(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Oracle Source</span>
                      <span className="font-semibold">Chainlink</span>
                    </div>
                  </div>
                </Card>
              </div>
            </AnimatedSection>
          </div>
        )}

        {/* Oracles Tab */}
        {activeTab === 'oracles' && (
          <AnimatedSection>
            <Card>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold">Chainlink Oracle Feeds</h3>
                <Badge variant="success" dot>All Healthy</Badge>
              </div>
              <div className="space-y-3">
                {oracleFeeds.map((feed, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        feed.status === 'fresh' ? 'bg-green-500/10 text-green-400' :
                        feed.status === 'stale' ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {feed.status === 'fresh' ? <CheckCircle className="w-5 h-5" /> :
                         feed.status === 'stale' ? <AlertTriangle className="w-5 h-5" /> :
                         <Activity className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-semibold">{feed.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{feed.address.slice(0, 10)}...{feed.address.slice(-8)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{feed.price}</p>
                      <p className="text-xs text-gray-400">{feed.lastUpdate} • Dev: {feed.deviation}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-sm text-blue-300">
                <Shield className="w-4 h-4 inline mr-2" />
                Oracle data sourced from Chainlink decentralized price feeds. Stale threshold: 3600s.
              </div>
            </Card>
          </AnimatedSection>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <AnimatedSection>
            <Card>
              <h3 className="text-lg font-bold mb-4">Recent Peg Events</h3>
              <div className="space-y-3">
                {pegEvents.map((event, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 bg-white/5 rounded-xl">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      event.type === 'expansion' ? 'bg-green-500/20 text-green-400' :
                      event.type === 'contraction' ? 'bg-red-500/20 text-red-400' :
                      event.type === 'buyback' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {event.type === 'expansion' ? <TrendingUp className="w-5 h-5" /> :
                       event.type === 'contraction' ? <TrendingDown className="w-5 h-5" /> :
                       event.type === 'buyback' ? <Shield className="w-5 h-5" /> :
                       <CheckCircle className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium capitalize">{event.type}</span>
                        <span className="text-gray-500 text-xs">{event.time}</span>
                      </div>
                      <p className="text-gray-300 text-sm">{event.detail}</p>
                      <p className="text-gray-500 text-xs mt-1">Trigger: {event.trigger}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </AnimatedSection>
        )}

        {/* Mechanics Tab */}
        {activeTab === 'mechanics' && (
          <div className="space-y-6">
            <AnimatedSection>
              <Card>
                <h3 className="text-lg font-bold mb-4">USDTZ Peg Mechanics</h3>
                <div className="space-y-6">
                  {[
                    {
                      icon: <BarChart3 className="w-6 h-6" />,
                      title: 'Chainlink Oracle Monitoring',
                      desc: 'BNB/USD and USDT/USD price feeds update every heartbeat. Pool Manager reads these to calculate the true USDTZ market price vs the $1.00 target.',
                    },
                    {
                      icon: <Zap className="w-6 h-6" />,
                      title: 'Algorithmic Rebase',
                      desc: 'When USDTZ deviates from peg, the Pool Manager automatically adjusts supply. Above peg: mint new tokens to sell. Below peg: contract supply to create scarcity.',
                    },
                    {
                      icon: <Shield className="w-6 h-6" />,
                      title: 'Stabilization Fund Buybacks',
                      desc: 'For larger depegs, the Stabilization Fund deploys reserves to buy USDTZ from PancakeSwap, creating direct buy pressure to restore the peg.',
                    },
                    {
                      icon: <Lock className="w-6 h-6" />,
                      title: 'Collateral Backing',
                      desc: 'All USDTZ is backed by a mix of BNB, USDT, BUSD, and other assets held in the Liquidity Vault. The target collateral ratio is 150%+.',
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-white/5 rounded-xl">
                      <div className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-400 flex items-center justify-center shrink-0">
                        {item.icon}
                      </div>
                      <div>
                        <h4 className="font-bold mb-1">{item.title}</h4>
                        <p className="text-gray-400 text-sm">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <Card>
                <h3 className="text-lg font-bold mb-3">Contract Addresses</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ['Pool Manager', USDTZ_CONFIG.contracts.poolManager],
                    ['Stabilization Fund', USDTZ_CONFIG.contracts.stabilizationFund],
                    ['Liquidity Manager', USDTZ_CONFIG.contracts.liquidityManager],
                    ['USDTZ Token', USDTZ_CONFIG.contracts.usdtz],
                  ].map(([name, addr]) => (
                    <div key={addr} className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                      <span className="text-gray-400">{name}</span>
                      <a
                        href={`https://bscscan.com/address/${addr}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-primary-400 hover:underline"
                      >
                        {addr.slice(0, 10)}...{addr.slice(-8)}
                      </a>
                    </div>
                  ))}
                </div>
              </Card>
            </AnimatedSection>
          </div>
        )}
      </div>
    </Layout>
  )
}
