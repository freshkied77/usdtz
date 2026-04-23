'use client'

import { useState, useEffect } from 'react'
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

// ── Price History (simulated 24h) ──
const PRICE_HISTORY = Array.from({ length: 48 }, (_, i) => {
  const deviation = (Math.random() - 0.5) * 0.006
  return {
    time: new Date(Date.now() - (47 - i) * 30 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: 1.0 + deviation,
  }
})

const PEG_EVENTS = [
  { time: '2h ago', type: 'expansion', detail: 'Supply expanded by 12,500 USDTZ', trigger: 'Price above $1.002 for 15 min' },
  { time: '6h ago', type: 'stable', detail: 'Peg within 0.1% band', trigger: 'No action needed' },
  { time: '14h ago', type: 'contraction', detail: 'Supply contracted by 8,200 USDTZ', trigger: 'Price below $0.998 for 10 min' },
  { time: '1d ago', type: 'buyback', detail: 'Stabilization fund bought 5,000 USDTZ', trigger: 'Price dipped below $0.995' },
  { time: '2d ago', type: 'expansion', detail: 'Supply expanded by 25,000 USDTZ', trigger: 'Heavy buy pressure on PancakeSwap' },
]

const ORACLE_FEEDS = [
  { name: 'BNB / USD', address: '0x0567F2...', lastUpdate: '12s ago', price: '$598.42', deviation: '0.02%', status: 'fresh' },
  { name: 'USDT / USD', address: '0x3f822E...', lastUpdate: '45s ago', price: '$1.0001', deviation: '0.01%', status: 'fresh' },
  { name: 'USDTZ / USD', address: 'Pool Manager', lastUpdate: '30s ago', price: '$1.0012', deviation: '0.12%', status: 'fresh' },
]

const STABILIZATION_STATS = {
  fundBalance: '$2,450,000',
  buybacksToday: 3,
  totalBuybacks: '$87,450',
  pegAccuracy: '99.87%',
  avgDeviation: '0.08%',
  maxDeviation24h: '0.31%',
  rebaseCount: 47,
  lastRebase: '2h ago',
}

function MiniChart({ data }: { data: typeof PRICE_HISTORY }) {
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
        {/* Peg line at $1.00 */}
        <line
          x1="0" y1={height - ((1.0 - min) / range) * height}
          x2={width} y2={height - ((1.0 - min) / range) * height}
          stroke="#FFD700" strokeWidth="1" strokeDasharray="4,4" opacity="0.4"
        />
        {/* Price line */}
        <polyline
          points={points}
          fill="none"
          stroke={isAbovePeg ? '#22c55e' : '#ef4444'}
          strokeWidth="2"
        />
        {/* Fill under */}
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
  const [currentPrice, setCurrentPrice] = useState(1.0012)
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'stable'>('stable')

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPrice(prev => {
        const change = (Math.random() - 0.5) * 0.0008
        const newPrice = Math.max(0.99, Math.min(1.01, prev + change))
        setPriceDirection(newPrice > prev ? 'up' : newPrice < prev ? 'down' : 'stable')
        return newPrice
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const pegDeviation = ((currentPrice - 1.0) * 100).toFixed(3)
  const pegStatus = Math.abs(currentPrice - 1.0) < 0.002 ? 'healthy' : Math.abs(currentPrice - 1.0) < 0.005 ? 'warning' : 'critical'

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
                    priceDirection === 'up' ? 'text-green-400' : priceDirection === 'down' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {priceDirection === 'up' ? <TrendingUp className="w-5 h-5" /> :
                     priceDirection === 'down' ? <TrendingDown className="w-5 h-5" /> :
                     <Activity className="w-5 h-5" />}
                    {pegDeviation}%
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={pegStatus === 'healthy' ? 'success' : pegStatus === 'warning' ? 'warning' : 'danger'}>
                    {pegStatus === 'healthy' ? 'Peg Healthy' : pegStatus === 'warning' ? 'Minor Deviation' : 'Depeg Alert'}
                  </Badge>
                  <span className="text-gray-500 text-xs">
                    <RefreshCw className="w-3 h-3 inline mr-1" />
                    Updates every 3s
                  </span>
                </div>
              </div>
              <div className="w-full md:w-96">
                <MiniChart data={PRICE_HISTORY} />
              </div>
            </div>
          </Card>
        </AnimatedSection>

        {/* Stats Row */}
        <AnimatedSection className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Peg Accuracy (30d)" value={STABILIZATION_STATS.pegAccuracy} icon={<CheckCircle className="w-5 h-5" />} />
            <StatCard label="Avg Deviation" value={STABILIZATION_STATS.avgDeviation} icon={<Activity className="w-5 h-5" />} />
            <StatCard label="Stabilization Fund" value={STABILIZATION_STATS.fundBalance} icon={<Shield className="w-5 h-5" />} />
            <StatCard label="Rebase Count" value={STABILIZATION_STATS.rebaseCount.toString()} change={`Last: ${STABILIZATION_STATS.lastRebase}`} icon={<Zap className="w-5 h-5" />} />
          </div>
        </AnimatedSection>

        {/* Tabs */}
        <div className="mb-8">
          <Tabs
            tabs={[
              { id: 'dashboard', label: 'Peg Dashboard' },
              { id: 'oracles', label: 'Oracle Feeds' },
              { id: 'events', label: 'Peg Events' },
              { id: 'mechanics', label: 'How It Works' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* ═══ PEG DASHBOARD ═══ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Peg Band Visualization */}
            <AnimatedSection>
              <Card>
                <h3 className="text-lg font-bold mb-4">Peg Stability Band</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                      <span>$0.995</span>
                      <span className="text-primary-400 font-medium">$1.000 TARGET</span>
                      <span>$1.005</span>
                    </div>
                    <div className="relative h-8 bg-white/5 rounded-full overflow-hidden">
                      {/* Safe zone */}
                      <div className="absolute inset-y-0 left-[20%] right-[20%] bg-green-500/10 border-l border-r border-green-500/20" />
                      {/* Current price indicator */}
                      <motion.div
                        className="absolute top-0 bottom-0 w-1 bg-primary-400 rounded-full"
                        animate={{
                          left: `${((currentPrice - 0.995) / 0.01) * 100}%`
                        }}
                        transition={{ type: 'spring', stiffness: 200 }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-gray-400 mb-1">24h Low</p>
                      <p className="font-bold text-red-400">$0.9978</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-gray-400 mb-1">24h Average</p>
                      <p className="font-bold">$1.0003</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <p className="text-gray-400 mb-1">24h High</p>
                      <p className="font-bold text-green-400">$1.0024</p>
                    </div>
                  </div>
                </div>
              </Card>
            </AnimatedSection>

            {/* Stabilization Metrics */}
            <AnimatedSection delay={0.1}>
              <Card>
                <h3 className="text-lg font-bold mb-4">Stabilization Activity (24h)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white/5 rounded-xl text-center">
                    <p className="text-gray-400 text-xs mb-1">Buybacks</p>
                    <p className="text-2xl font-bold text-primary-400">{STABILIZATION_STATS.buybacksToday}</p>
                    <p className="text-gray-500 text-xs">{STABILIZATION_STATS.totalBuybacks} total</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl text-center">
                    <p className="text-gray-400 text-xs mb-1">Rebase Events</p>
                    <p className="text-2xl font-bold">{STABILIZATION_STATS.rebaseCount}</p>
                    <p className="text-gray-500 text-xs">Since launch</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl text-center">
                    <p className="text-gray-400 text-xs mb-1">Max Deviation</p>
                    <p className="text-2xl font-bold text-yellow-400">{STABILIZATION_STATS.maxDeviation24h}</p>
                    <p className="text-gray-500 text-xs">24h max</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl text-center">
                    <p className="text-gray-400 text-xs mb-1">Fund Health</p>
                    <p className="text-2xl font-bold text-green-400">Strong</p>
                    <p className="text-gray-500 text-xs">{STABILIZATION_STATS.fundBalance}</p>
                  </div>
                </div>
              </Card>
            </AnimatedSection>
          </div>
        )}

        {/* ═══ ORACLE FEEDS ═══ */}
        {activeTab === 'oracles' && (
          <AnimatedSection>
            <Card>
              <h3 className="text-lg font-bold mb-4">Chainlink Oracle Feeds</h3>
              <div className="space-y-4">
                {ORACLE_FEEDS.map((feed) => (
                  <div key={feed.name} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                    <div>
                      <p className="font-medium">{feed.name}</p>
                      <p className="text-gray-500 text-xs font-mono">{feed.address}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{feed.price}</p>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-gray-400 text-xs">{feed.lastUpdate}</span>
                        <Badge variant="success" className="text-xs">Fresh</Badge>
                      </div>
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

        {/* ═══ PEG EVENTS ═══ */}
        {activeTab === 'events' && (
          <AnimatedSection>
            <Card>
              <h3 className="text-lg font-bold mb-4">Recent Peg Events</h3>
              <div className="space-y-3">
                {PEG_EVENTS.map((event, i) => (
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

        {/* ═══ HOW IT WORKS ═══ */}
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
                    ['Pool Manager', '0x3c91AF7Cf1f5c44d32A6fF9222a3Ed72845d8E86'],
                    ['Stabilization Fund', '0x033fA6AFd3D7af45FBC6d617553178f4773Cba6a'],
                    ['Stabilization Fund V2', '0x23b8450530Be2A3f19Ae2FDD26cA3491C4De192D'],
                    ['Liquidity Manager', '0x6C5212B7D40154ee367f49Dc05d5C7659a544800'],
                  ].map(([name, addr]) => (
                    <div key={addr} className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                      <span className="text-gray-400">{name}</span>
                      <a
                        href={`https://bscscan.com/address/${addr}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-primary-400 hover:underline"
                      >
                        {addr.slice(0, 8)}...{addr.slice(-6)}
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
