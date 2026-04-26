'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Shield, Zap, Coins, Layers, Globe, TrendingUp, ChevronRight, Brain, Activity, Lock } from 'lucide-react'
import Layout from '@/components/Layout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import AnimatedSection from '@/components/ui/AnimatedSection'
import ProgressBar from '@/components/ui/ProgressBar'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { buildTokenList, fetchTokenPrices } from '@/lib/api/coingecko'
import { useContractRead } from 'wagmi'
import { ABIS } from '@/lib/abis'
import { USDTZ_CONFIG } from '@/lib/config'
import { formatEther } from 'viem'

const FEATURES = [
  {
    step: '01',
    title: 'Deposit Collateral',
    description: 'Deposit BNB, BUSD, or other supported assets as collateral to back your stablecoins.',
    icon: Shield,
    color: 'from-primary-500/20 to-orange-500/20',
    iconColor: 'text-primary-400'
  },
  {
    step: '02',
    title: 'Mint USDTZ',
    description: 'Create USDTZ stablecoins with 150%+ collateral ratio for maximum security.',
    icon: Coins,
    color: 'from-green-500/20 to-emerald-500/20',
    iconColor: 'text-green-400'
  },
  {
    step: '03',
    title: 'Earn & Redeem',
    description: 'Earn yields through farming and pools. Redeem your collateral anytime.',
    icon: TrendingUp,
    color: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-400'
  },
]

const CHAINS = [
  { name: 'BNB Chain', color: 'from-yellow-400 to-orange-500', symbol: 'BNB' },
  { name: 'Zedxion', color: 'from-cyan-400 to-blue-500', symbol: 'ZEDX' },
  { name: 'Ethereum', color: 'from-blue-400 to-indigo-500', symbol: 'ETH' },
  { name: 'Polygon', color: 'from-purple-400 to-purple-600', symbol: 'MATIC' },
]

const AD_HOOKS = [
  { title: 'AI Risk Protection', desc: 'Your DeFi positions protected by machine learning', cta: 'Check Your Risk Score', icon: Brain },
  { title: 'No Impermanent Loss', desc: 'One-sided liquidity on Zedxion - earn safely', cta: 'Start Earning', icon: Lock },
  { title: 'Real-Time Analytics', desc: 'Live liquidation predictions and portfolio monitoring', cta: 'Get AI Analysis', icon: Activity },
]

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState({
    price: 1.0,
    priceChange: 0,
    totalSupply: 0,
    collateral: 0,
    collateralChange: 0,
    tvl: 0,
    tvlChange: 0,
    users: 0,
    apy: 0,
  })
  const [loading, setLoading] = useState(true)

  // Fetch live TVL from contract
  const { data: tvlData } = useContractRead({
    address: USDTZ_CONFIG.contracts.poolManager as `0x${string}`,
    abi: ABIS.PoolManager,
    functionName: 'totalTVL',
    watch: true,
  })

  // Fetch live collateral ratio
  const { data: collateralRatioData } = useContractRead({
    address: USDTZ_CONFIG.contracts.poolManager as `0x${string}`,
    abi: ABIS.PoolManager,
    functionName: 'getCollateralRatio',
    watch: true,
  })

  useEffect(() => {
    setMounted(true)
    
    async function loadStats() {
      try {
        // Fetch USDTZ price from CoinGecko (or use peg price)
        const prices = await fetchTokenPrices(['tether', 'binancecoin', 'ethereum'])
        
        setStats(prev => ({
          ...prev,
          price: 1.0,
          priceChange: prices['tether']?.usd_24h_change || 0,
          collateral: collateralRatioData ? Number(collateralRatioData) / 100 : 0,
          tvl: tvlData ? Number(formatEther(tvlData)) : 0,
        }))
      } catch (error) {
        console.error('Failed to load stats:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadStats()
    
    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [tvlData, collateralRatioData])

  const formatUSD = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
    return `$${value.toFixed(2)}`
  }

  const formatNumber = (value: number) => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
    return value.toFixed(0)
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* Hero Section */}
        <section className="pt-12 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 30 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="primary" className="mb-6">
              Built on BNB Chain • Zedxion Powered
            </Badge>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              <span className="gradient-text">Next Generation</span>
              <br />
              <span className="text-white">Algorithmic Stablecoin</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Built with advanced AI algorithms ensuring ultimate stability,
              ZK privacy, and sustainable growth. Protected by machine learning.
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button size="lg" onClick={() => window.location.href = '/buy'}>
                Buy USDTZ
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="secondary" size="lg" onClick={() => window.location.href = '/swap'}>
                Launch App
              </Button>
            </div>
          </motion.div>

          {/* Floating Stats Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 40 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16 inline-flex items-center gap-8 px-8 py-4 glass-card rounded-2xl"
          >
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Price</p>
              <p className="text-xl font-bold text-primary-400">$1.00</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider">TVL</p>
              <p className="text-xl font-bold">{loading ? '...' : formatUSD(stats.tvl)}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider">APY</p>
              <p className="text-xl font-bold text-green-400">{stats.apy}%</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider">AI Score</p>
              <p className="text-xl font-bold text-secondary-400">98%</p>
            </div>
          </motion.div>
        </section>

        {/* AI Ad Hooks Section */}
        <AnimatedSection className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-3">Powered by AI</h2>
            <p className="text-gray-400">Advanced machine learning protects your positions 24/7</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {AD_HOOKS.map((hook, i) => (
              <Card key={i} variant="interactive" className="text-center" onClick={() => window.location.href = '/risk'}>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center mx-auto mb-4">
                  <hook.icon className="w-6 h-6 text-primary-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">{hook.title}</h3>
                <p className="text-gray-400 mb-4">{hook.desc}</p>
                <Button variant="outline" size="sm">{hook.cta}</Button>
              </Card>
            ))}
          </div>
        </AnimatedSection>

        {/* Live Stats Grid */}
        <AnimatedSection delay={0.1} className="mb-12">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              label="USDTZ Price"
              value="$1.00"
              change={`+${stats.priceChange}%`}
              icon={<Coins className="w-5 h-5" />}
            />
            <StatCard
              label="Total Supply"
              value={formatNumber(stats.totalSupply)}
              icon={<Layers className="w-5 h-5" />}
            />
            <StatCard
              label="Collateral"
              value={formatUSD(stats.collateral)}
              change={`+${stats.collateralChange}%`}
              icon={<Shield className="w-5 h-5" />}
            />
            <StatCard
              label="Total TVL"
              value={formatUSD(stats.tvl)}
              change={`+${stats.tvlChange}%`}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              label="Active Users"
              value={formatNumber(stats.users)}
              change="+234"
              icon={<Globe className="w-5 h-5" />}
            />
            <StatCard
              label="Average APY"
              value={`${stats.apy}%`}
              icon={<Zap className="w-5 h-5" />}
            />
          </div>
        </AnimatedSection>

        {/* Features */}
        <AnimatedSection delay={0.2} className="mb-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">How It Works</h2>
            <p className="text-gray-400">Three simple steps to start earning with USDTZ</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <Card key={feature.step} variant="interactive" className="relative overflow-hidden">
                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-30', feature.color)} />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn('w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center', feature.iconColor)}>
                      <feature.icon className="w-6 h-6" />
                    </div>
                    <span className="text-4xl font-bold text-white/10">{feature.step}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </AnimatedSection>

        {/* Multi-Chain Support */}
        <AnimatedSection delay={0.3} className="mb-12">
          <Card padding="lg">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Multi-Chain Support</h2>
              <p className="text-gray-400">Deployed across major blockchain networks</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {CHAINS.map((chain) => (
                <div key={chain.name} className="text-center">
                  <div className={cn('w-16 h-16 rounded-2xl bg-gradient-to-br mx-auto mb-3 flex items-center justify-center', chain.color)}>
                    <span className="text-lg font-bold text-white">{chain.symbol}</span>
                  </div>
                  <p className="font-semibold">{chain.name}</p>
                  <Badge variant="primary" className="mt-2">Active</Badge>
                </div>
              ))}
            </div>
          </Card>
        </AnimatedSection>

        {/* Community & Rewards */}
        <AnimatedSection className="mb-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Join the Ecosystem</h2>
            <p className="text-gray-400">Earn rewards, climb the leaderboard, and help grow USDTZ</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card variant="interactive" className="text-center" onClick={() => window.location.href = '/farm'}>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Liquidity Mining</h3>
              <p className="text-primary-400 text-2xl font-bold mb-2">Up to 500% APY</p>
              <p className="text-gray-400 text-sm">Stake LP tokens and earn USDTZ rewards. Early stakers get the highest rates.</p>
            </Card>
            <Card variant="interactive" className="text-center" onClick={() => window.location.href = '/community'}>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Trading Competitions</h3>
              <p className="text-primary-400 text-2xl font-bold mb-2">25K USDTZ Pool</p>
              <p className="text-gray-400 text-sm">Top 50 traders monthly split the prize pool. Compete on volume and P&L.</p>
            </Card>
            <Card variant="interactive" className="text-center" onClick={() => window.location.href = '/community'}>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                <Globe className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Referral Program</h3>
              <p className="text-primary-400 text-2xl font-bold mb-2">Up to 7.5%</p>
              <p className="text-gray-400 text-sm">Earn commissions on every trade and LP deposit from users you refer.</p>
            </Card>
          </div>
        </AnimatedSection>

        {/* Live Peg Status */}
        <AnimatedSection className="mb-12">
          <Card variant="highlight" padding="lg" onClick={() => window.location.href = '/price'}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Peg Stability Monitor</h2>
                <p className="text-gray-400 mb-4">Real-time price tracking powered by Chainlink oracles and AI stabilization</p>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400 text-sm font-medium">Peg Healthy</span>
                  </div>
                  <span className="text-gray-500 text-sm">Chainlink Oracle Powered</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Current Price</p>
                <p className="text-4xl font-bold text-primary-400">${stats.price.toFixed(4)}</p>
                <p className="text-green-400 text-sm">{stats.priceChange >= 0 ? '+' : ''}{stats.priceChange.toFixed(2)}%</p>
              </div>
            </div>
          </Card>
        </AnimatedSection>

        {/* CTA */}
        <AnimatedSection className="mb-12">
          <div className="glass-card-highlight p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Join thousands of users already earning with USDTZ. Start swapping, farming, and earning today.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button size="lg" onClick={() => window.location.href = '/buy'}>
                Buy USDTZ Now
                <ChevronRight className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="lg" onClick={() => window.location.href = '/community'}>
                View Leaderboard
              </Button>
              <Button variant="secondary" size="lg" onClick={() => window.location.href = '/swap'}>
                Start Trading
              </Button>
            </div>
          </div>
        </AnimatedSection>

      </div>
    </Layout>
  )
}
