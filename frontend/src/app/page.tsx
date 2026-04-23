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

const STATS = [
  { label: 'USDTZ Price', value: '$1.00', change: '+0.01%', icon: <Coins className="w-5 h-5" /> },
  { label: 'Total Supply', value: '$125M', icon: <Layers className="w-5 h-5" /> },
  { label: 'Collateral', value: '$128.7M', change: '+2.5%', icon: <Shield className="w-5 h-5" /> },
  { label: 'Total TVL', value: '$98.5M', change: '+1.8%', icon: <TrendingUp className="w-5 h-5" /> },
  { label: 'Active Users', value: '45.2K', change: '+234', icon: <Globe className="w-5 h-5" /> },
  { label: 'Average APY', value: '8.5%', icon: <Zap className="w-5 h-5" /> },
]

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

  useEffect(() => {
    setMounted(true)
  }, [])

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
              <p className="text-xl font-bold">$98.5M</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider">APY</p>
              <p className="text-xl font-bold text-green-400">8.5%</p>
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
            <h2 className="text-2xl font-bold mb-2">AI-Powered DeFi</h2>
            <p className="text-gray-400">Machine learning protection for your assets</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {AD_HOOKS.map((hook, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="cursor-pointer"
                onClick={() => window.location.href = '/risk'}
              >
                <Card variant="interactive" className="text-center p-6">
                <div className={cn(
                  'w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center',
                  i === 0 ? 'bg-gradient-to-br from-primary-500/20 to-orange-500/20' :
                  i === 1 ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20' :
                  'bg-gradient-to-br from-blue-500/20 to-cyan-500/20'
                )}>
                  <hook.icon className={cn('w-7 h-7',
                    i === 0 ? 'text-primary-400' : i === 1 ? 'text-green-400' : 'text-blue-400'
                  )} />
                </div>
                <h3 className="text-lg font-bold mb-2">{hook.title}</h3>
                <p className="text-sm text-gray-400 mb-4">{hook.desc}</p>
                <Button variant="outline" size="sm">{hook.cta}</Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>

        {/* Live Stats */}
        <AnimatedSection className="mb-12">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {STATS.map((stat, i) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                change={stat.change}
                icon={stat.icon}
              />
            ))}
          </div>
        </AnimatedSection>

        {/* Quick Actions */}
        <AnimatedSection className="mb-12">
          <div className="grid md:grid-cols-4 gap-4">
            <Card variant="interactive" className="text-center p-6 cursor-pointer" onClick={() => window.location.href = '/swap'}>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-primary-400" />
              </div>
              <h3 className="font-bold mb-1">Swap</h3>
              <p className="text-xs text-gray-400">Instant token exchange</p>
            </Card>
            <Card variant="interactive" className="text-center p-6 cursor-pointer" onClick={() => window.location.href = '/bridge'}>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <Globe className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="font-bold mb-1">Bridge</h3>
              <p className="text-xs text-gray-400">Cross-chain transfers</p>
            </Card>
            <Card variant="interactive" className="text-center p-6 cursor-pointer" onClick={() => window.location.href = '/farm'}>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="font-bold mb-1">Farm</h3>
              <p className="text-xs text-gray-400">Earn up to 500% APY</p>
            </Card>
            <Card variant="interactive" className="text-center p-6 cursor-pointer" onClick={() => window.location.href = '/risk'}>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-4">
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="font-bold mb-1">AI Risk</h3>
              <p className="text-xs text-gray-400">ML-powered analysis</p>
            </Card>
          </div>
        </AnimatedSection>

        {/* Mint / Redeem */}
        <AnimatedSection className="mb-12">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Mint Card */}
            <Card variant="highlight" padding="lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-orange-500/20 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-primary-400" />
                </div>
                <h2 className="text-2xl font-bold">Mint USDTZ</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Amount</span>
                    <span className="text-sm text-gray-400">Balance: 12.5 BNB</span>
                  </div>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-gray-600"
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400 px-1">
                  <span>Fee: 0.25%</span>
                  <span>Min Ratio: 150%</span>
                </div>
                <Button fullWidth size="lg" onClick={() => window.location.href = '/buy'}>
                  Mint USDTZ
                </Button>
              </div>
            </Card>

            {/* Redeem Card */}
            <Card variant="highlight" padding="lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary-500/20 to-blue-500/20 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-secondary-400" />
                </div>
                <h2 className="text-2xl font-bold">Redeem USDTZ</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Amount</span>
                    <span className="text-sm text-gray-400">Balance: 50,000 USDTZ</span>
                  </div>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-gray-600"
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400 px-1">
                  <span>Fee: 0.25%</span>
                  <span>Min Ratio: 150%</span>
                </div>
                <Button variant="secondary" fullWidth size="lg" onClick={() => window.location.href = '/swap'}>
                  Redeem
                </Button>
              </div>
            </Card>
          </div>
        </AnimatedSection>

        {/* Protocol Overview */}
        <AnimatedSection className="mb-12">
          <Card padding="lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Protocol Overview</h2>
              <Badge variant="success" className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                All Systems Operational
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Value Locked</p>
                <p className="text-2xl font-bold">$98,542,891</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">24h Volume</p>
                <p className="text-2xl font-bold">$12,458,234</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Collateral Ratio</p>
                <p className="text-2xl font-bold text-primary-400">156.2%</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">AI Confidence</p>
                <p className="text-2xl font-bold text-secondary-400">98.7%</p>
              </div>
            </div>
            <ProgressBar value={156.2} max={200} label="Global Collateral Health" size="md" />
          </Card>
        </AnimatedSection>

        {/* How It Works */}
        <AnimatedSection className="mb-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">How It Works</h2>
            <p className="text-gray-400">Three simple steps to get started with USDTZ</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <AnimatedSection key={feature.step} delay={i * 0.15}>
                <Card variant="interactive" className="text-center h-full p-6">
                  <div className={cn('w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center', feature.color)}>
                    <feature.icon className={cn('w-6 h-6', feature.iconColor)} />
                  </div>
                  <span className="text-xs font-bold text-primary-500/60 uppercase tracking-widest">{feature.step}</span>
                  <h3 className="text-xl font-semibold mt-2 mb-3">{feature.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </AnimatedSection>

        {/* Supported Chains */}
        <AnimatedSection className="mb-12">
          <Card padding="lg" className="text-center">
            <h2 className="text-2xl font-bold mb-2">Multi-Chain Support</h2>
            <p className="text-gray-400 mb-8">USDTZ operates across multiple blockchain networks</p>
            <div className="flex items-center justify-center gap-6 flex-wrap">
              {CHAINS.map((chain) => (
                <div key={chain.name} className="flex items-center gap-3 px-5 py-3 bg-white/5 rounded-xl border border-white/5">
                  <div className={cn('w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-bold text-white', chain.color)}>
                    {chain.symbol}
                  </div>
                  <span className="font-medium">{chain.name}</span>
                  {chain.name === 'Zedxion' && (
                    <Badge variant="primary" className="text-xs">One-Sided</Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </AnimatedSection>

        {/* AI Protection CTA */}
        <AnimatedSection className="mb-12">
          <Card variant="highlight" padding="lg" className="bg-gradient-to-r from-primary-500/10 via-transparent to-secondary-500/10">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <Badge variant="primary" className="mb-4">AI-Powered</Badge>
                <h2 className="text-3xl font-bold mb-4">Protect Your Portfolio with Machine Learning</h2>
                <p className="text-gray-400 mb-6">
                  Our AI continuously monitors your positions, predicts liquidation risks,
                  and alerts you before it's too late. Join 45,000+ users protecting $98M+ with AI.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => window.location.href = '/risk'}>
                    Get Free Risk Analysis
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button variant="secondary">
                    Watch Demo
                  </Button>
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-6 text-center">
                <div className="text-6xl font-bold text-primary-400 mb-2">98.7%</div>
                <p className="text-gray-400 mb-4">AI Prediction Accuracy</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-2xl font-bold text-green-400">45K+</p>
                    <p className="text-gray-500">Protected Users</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-2xl font-bold text-blue-400">$98M+</p>
                    <p className="text-gray-500">Assets Protected</p>
                  </div>
                </div>
              </div>
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
                  <span className="text-gray-500 text-sm">99.87% accuracy (30d)</span>
                  <span className="text-gray-500 text-sm">47 rebase events</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Current Price</p>
                <p className="text-4xl font-bold text-primary-400">$1.0012</p>
                <p className="text-green-400 text-sm">+0.12%</p>
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