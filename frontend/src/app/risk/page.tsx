'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, AlertTriangle, TrendingUp, Activity, ChevronRight, Zap, Lock, Eye } from 'lucide-react'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import AnimatedSection from '@/components/ui/AnimatedSection'
import { cn } from '@/lib/utils'

interface RiskProfile {
  overallScore: number
  level: 'low' | 'medium' | 'high' | 'critical'
  healthFactor: number
  liquidationRisk: number
  volatilityExposure: number
  concentrationRisk: number
  recommendations: string[]
  aiInsights: {
    title: string
    description: string
    impact: 'positive' | 'negative' | 'neutral'
  }[]
}

const MOCK_RISK_PROFILES: Record<string, RiskProfile> = {}

const DEMO_ADDRESSES: string[] = []

function RiskMeter({ value, max = 100, label, color }: { value: number; max?: number; label: string; color: string }) {
  const percentage = Math.min((value / max) * 100, 100)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className={cn('font-bold', color)}>{value.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={cn('h-full rounded-full', color.replace('text-', 'bg-'))}
        />
      </div>
    </div>
  )
}

function InsightCard({ insight }: { insight: RiskProfile['aiInsights'][0] }) {
  const colors = {
    positive: { bg: 'bg-green-500/10', border: 'border-green-500/20', icon: TrendingUp, text: 'text-green-400' },
    negative: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertTriangle, text: 'text-red-400' },
    neutral: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Activity, text: 'text-blue-400' }
  }

  const style = colors[insight.impact]
  const Icon = style.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('p-4 rounded-xl border', style.bg, style.border)}
    >
      <div className="flex items-start gap-3">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', style.bg)}>
          <Icon className={cn('w-4 h-4', style.text)} />
        </div>
        <div>
          <p className="font-semibold text-sm">{insight.title}</p>
          <p className="text-xs text-gray-400 mt-1">{insight.description}</p>
        </div>
      </div>
    </motion.div>
  )
}

function RiskGauge({ score }: { score: number }) {
  const rotation = (score / 100) * 180 - 90
  const color = score < 33 ? 'text-green-400' : score < 66 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="relative w-48 h-24 mx-auto">
      <div className="absolute inset-0 flex items-end justify-center">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={score < 33 ? '#4ade80' : score < 66 ? '#fbbf24' : '#f87171'}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 251} 251`}
          />
        </svg>
      </div>
      <motion.div
        className="absolute bottom-0 left-1/2 w-1 h-16 bg-white origin-bottom"
        animate={{ rotate: rotation }}
        style={{ transformOrigin: '50% 100%' }}
      />
      <div className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-white" />
      <div className="absolute bottom-0 left-0 text-xs text-gray-500">0</div>
      <div className="absolute bottom-0 right-0 text-xs text-gray-500">100</div>
    </div>
  )
}

export default function RiskPage() {
  const [selectedAddress, setSelectedAddress] = useState(DEMO_ADDRESSES[0])
  const [isScanning, setIsScanning] = useState(false)
  const [profile, setProfile] = useState<RiskProfile>(MOCK_RISK_PROFILES[DEMO_ADDRESSES[0]])

  useEffect(() => {
    setProfile(MOCK_RISK_PROFILES[selectedAddress])
  }, [selectedAddress])

  const handleScan = async () => {
    setIsScanning(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsScanning(false)
  }

  const levelColors = {
    low: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', badge: 'bg-green-500/20' },
    medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', badge: 'bg-yellow-500/20' },
    high: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', badge: 'bg-orange-500/20' },
    critical: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', badge: 'bg-red-500/20' }
  }

  const style = profile ? levelColors[profile.level] : levelColors.low

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <AnimatedSection className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Shield className="w-8 h-8 text-primary-400" />
                AI Risk Analysis
              </h1>
              <p className="text-gray-400 mt-2">Real-time portfolio risk assessment powered by machine learning</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedAddress}
                onChange={(e) => setSelectedAddress(e.target.value)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-primary-500/50"
              >
                {DEMO_ADDRESSES.map(addr => (
                  <option key={addr} value={addr}>{addr}</option>
                ))}
              </select>
              <Button onClick={handleScan} loading={isScanning} size="md">
                {isScanning ? 'Scanning...' : 'Scan Wallet'}
              </Button>
            </div>
          </div>
        </AnimatedSection>

        {/* Main Risk Display */}
        {!profile ? (
          <AnimatedSection>
            <Card variant="highlight" padding="lg" className="text-center py-16">
              <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
              <p className="text-gray-400 mb-6">Connect your wallet to view your personalized AI risk analysis</p>
              <Button>
                <Shield className="w-4 h-4" />
                Connect Wallet
              </Button>
            </Card>
          </AnimatedSection>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Risk Score Card */}
            <AnimatedSection delay={0.1}>
              <Card variant="highlight" padding="lg" className={cn('text-center', style.bg, style.border)}>
                <Badge variant={profile.level === 'low' ? 'primary' : profile.level === 'critical' ? 'danger' : 'secondary'} className="mb-4">
                  {profile.level.toUpperCase()} RISK
                </Badge>
                <RiskGauge score={profile.overallScore} />
                <p className="text-5xl font-bold mt-4">{profile.overallScore}</p>
                <p className="text-sm text-gray-400">Risk Score</p>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Health Factor</p>
                      <p className="text-lg font-bold text-green-400">{profile.healthFactor}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Liq. Risk</p>
                      <p className={cn('text-lg font-bold', profile.liquidationRisk > 0.3 ? 'text-red-400' : 'text-yellow-400')}>
                        {(profile.liquidationRisk * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </AnimatedSection>

            {/* Risk Breakdown */}
            <AnimatedSection delay={0.2} className="lg:col-span-2">
              <Card variant="highlight" padding="lg">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary-400" />
                  Risk Breakdown
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <RiskMeter value={profile.liquidationRisk * 100} label="Liquidation Risk" color="text-red-400" />
                    <RiskMeter value={profile.volatilityExposure * 100} label="Volatility Exposure" color="text-yellow-400" />
                  </div>
                  <div className="space-y-4">
                    <RiskMeter value={profile.concentrationRisk * 100} label="Concentration Risk" color="text-orange-400" />
                    <RiskMeter value={100 - profile.healthFactor} label="Health Buffer Used" color={profile.healthFactor > 150 ? 'text-green-400' : 'text-red-400'} />
                  </div>
                </div>

                {/* AI Insights */}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h3 className="text-sm font-semibold text-gray-400 mb-4">AI Insights</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {profile.aiInsights.map((insight, i) => (
                      <InsightCard key={i} insight={insight} />
                    ))}
                  </div>
                </div>
              </Card>
            </AnimatedSection>
          </div>
        )}

        {profile && (
          <>
            {/* Recommendations */}
            <AnimatedSection delay={0.3}>
              <Card padding="lg">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary-400" />
                  AI Recommendations
                </h2>
                <div className="space-y-4">
                  {profile.recommendations.map((rec, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/8 transition-colors"
                    >
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', style.bg)}>
                        {profile.level === 'critical' ? (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-primary-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{rec}</p>
                        {profile.level === 'critical' && (
                          <p className="text-xs text-red-400 mt-1">Action required immediately</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap gap-3">
                  <Button variant="primary" size="md">
                    <Lock className="w-4 h-4" />
                    Enable Auto-Protection
                  </Button>
                  <Button variant="secondary" size="md">
                    <Eye className="w-4 h-4" />
                    Set Alert Thresholds
                  </Button>
                  <Button variant="outline" size="md">
                    <TrendingUp className="w-4 h-4" />
                    Optimize Portfolio
                  </Button>
                </div>
              </Card>
            </AnimatedSection>

            {/* Ad Hook - Show risk score to attract users */}
            <AnimatedSection delay={0.4} className="mt-8">
              <Card variant="highlight" padding="lg" className="text-center bg-gradient-to-r from-primary-500/10 to-secondary-500/10">
                <h2 className="text-2xl font-bold mb-2">Protect Your Portfolio with AI</h2>
                <p className="text-gray-400 mb-6 max-w-lg mx-auto">
                  Get real-time risk analysis, liquidation predictions, and automated protection for your DeFi positions.
                </p>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  <Button size="lg">
                    Connect Wallet for Free Analysis
                  </Button>
                  <Button variant="secondary" size="lg">
                    View Demo Portfolio
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-4">Analyze your DeFi portfolio risk exposure on BNB Chain</p>
              </Card>
            </AnimatedSection>
          </>
        )}
      </div>
    </Layout>
  )
}