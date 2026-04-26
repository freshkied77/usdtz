'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Users, TrendingUp, Flame, Medal, Target, Gift, Zap, Star, Copy, Check, Share2, ArrowRight } from 'lucide-react'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Tabs from '@/components/ui/Tabs'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import AnimatedSection from '@/components/ui/AnimatedSection'
import Input from '@/components/ui/Input'
import { useAccount } from 'wagmi'

const TRADERS: { rank: number; address: string; volume: string; trades: number; pnl: string; badge: string }[] = []

const REFERRAL_TIERS = [
  { name: 'Bronze', requirement: '0-5 referrals', commission: '2.5%', bonus: '—', color: 'text-orange-400' },
  { name: 'Silver', requirement: '5-20 referrals', commission: '3.5%', bonus: '500 USDTZ', color: 'text-gray-300' },
  { name: 'Gold', requirement: '20-50 referrals', commission: '5%', bonus: '2,500 USDTZ', color: 'text-yellow-400' },
  { name: 'Diamond', requirement: '50+ referrals', commission: '7.5%', bonus: '10,000 USDTZ', color: 'text-cyan-300' },
]

const CAMPAIGNS = [
  {
    title: 'Early Adopter Airdrop',
    description: 'First 1,000 holders who stake LP tokens receive bonus USDTZ rewards',
    reward: '50,000 USDTZ Pool',
    deadline: 'May 31, 2026',
    status: 'active',
    progress: 23,
  },
  {
    title: 'Trading Volume Sprint',
    description: 'Top 50 traders by volume this month split the prize pool',
    reward: '25,000 USDTZ Pool',
    deadline: 'Monthly',
    status: 'active',
    progress: 45,
  },
  {
    title: 'Referral Race',
    description: 'Refer the most new users and earn tiered commissions + bonus prizes',
    reward: '10,000 USDTZ + NFT',
    deadline: 'Ongoing',
    status: 'active',
    progress: 67,
  },
  {
    title: 'Privacy Pool Pioneer',
    description: 'First 500 users to deposit into ZK privacy pools get bonus yield multiplier',
    reward: '2x Yield for 30 days',
    deadline: 'June 15, 2026',
    status: 'upcoming',
    progress: 0,
  },
]

const BADGES_DATA = [
  { name: 'Whale', icon: '🐋', requirement: '$1M+ volume', holders: 2 },
  { name: 'Shark', icon: '🦈', requirement: '$500K+ volume', holders: 5 },
  { name: 'Dolphin', icon: '🐬', requirement: '$100K+ volume', holders: 23 },
  { name: 'OG Farmer', icon: '🌾', requirement: 'Stake in first 7 days', holders: 0 },
  { name: 'Privacy Advocate', icon: '🥷', requirement: '10+ ZK deposits', holders: 0 },
  { name: 'Bridge Builder', icon: '🌉', requirement: 'Use cross-chain bridge', holders: 0 },
  { name: 'Prophet', icon: '🔮', requirement: 'Win 10+ prediction bets', holders: 0 },
  { name: 'Diamond Hands', icon: '💎', requirement: 'Hold for 90+ days', holders: 0 },
]

function getBadgeColor(badge: string) {
  switch (badge) {
    case 'whale': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'shark': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    case 'dolphin': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState('leaderboard')
  const { address } = useAccount()
  const [copied, setCopied] = useState(false)
  const [timeRange, setTimeRange] = useState('monthly')

  const referralLink = address ? `https://frontend-green-lab-tech.vercel.app/buy?ref=${address}` : ''

  const handleCopy = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <PageHeader
          title="Community Hub"
          subtitle="Compete, earn, and grow the USDTZ ecosystem"
          action={
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Share Referral'}
              </Button>
              <Button>
                <Trophy className="w-4 h-4" />
                Claim Rewards
              </Button>
            </div>
          }
        />

        {/* Stats Overview */}
        <AnimatedSection className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Participants" value="—" icon={<Users className="w-5 h-5" />} />
            <StatCard label="Prize Pool" value="—" icon={<Gift className="w-5 h-5" />} />
            <StatCard label="Your Rank" value={address ? '—' : '—'} icon={<Medal className="w-5 h-5" />} />
            <StatCard label="Your Referrals" value={address ? '—' : '—'} icon={<Star className="w-5 h-5" />} />
          </div>
        </AnimatedSection>

        {/* Tabs */}
        <div className="mb-8">
          <Tabs
            tabs={[
              { id: 'leaderboard', label: 'Leaderboard' },
              { id: 'campaigns', label: 'Campaigns' },
              { id: 'referrals', label: 'Referrals' },
              { id: 'badges', label: 'Badges' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* ═══ LEADERBOARD TAB ═══ */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            {/* Time Range Filter */}
            <AnimatedSection>
              <div className="flex gap-2 mb-4">
                {['daily', 'weekly', 'monthly', 'all-time'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      timeRange === range
                        ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1).replace('-', ' ')}
                  </button>
                ))}
              </div>
            </AnimatedSection>

            {/* Top 3 Podium */}
            {TRADERS.length === 0 && (
              <AnimatedSection>
                <Card className="text-center py-12">
                  <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Leaderboard Coming Soon</h3>
                  <p className="text-gray-400">Start trading to appear on the leaderboard. Rankings are updated in real-time from on-chain data.</p>
                </Card>
              </AnimatedSection>
            )}
            {TRADERS.length > 0 && <AnimatedSection>
              <div className="grid grid-cols-3 gap-4 mb-8">
                {TRADERS.slice(0, 3).map((trader, i) => (
                  <motion.div
                    key={trader.rank}
                    whileHover={{ y: -4 }}
                    className={`relative p-6 rounded-2xl border text-center ${
                      i === 0
                        ? 'bg-gradient-to-b from-yellow-500/10 to-transparent border-yellow-500/30 order-2'
                        : i === 1
                        ? 'bg-gradient-to-b from-gray-400/10 to-transparent border-gray-400/30 order-1 mt-4'
                        : 'bg-gradient-to-b from-orange-600/10 to-transparent border-orange-600/30 order-3 mt-8'
                    }`}
                  >
                    <div className={`text-4xl mb-2 ${i === 0 ? 'text-5xl' : ''}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                    </div>
                    <p className="text-white font-mono text-sm mb-1">{trader.address}</p>
                    <p className="text-primary-400 font-bold text-xl">{trader.volume}</p>
                    <p className="text-green-400 text-sm mt-1">{trader.pnl}</p>
                    <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium border ${getBadgeColor(trader.badge)}`}>
                      {trader.badge.toUpperCase()}
                    </span>
                  </motion.div>
                ))}
              </div>
            </AnimatedSection>}

            {/* Full Table */}
            {TRADERS.length > 0 && <AnimatedSection delay={0.1}>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 text-sm border-b border-white/5">
                        <th className="pb-3 pl-4">Rank</th>
                        <th className="pb-3">Trader</th>
                        <th className="pb-3 text-right">Volume</th>
                        <th className="pb-3 text-right">Trades</th>
                        <th className="pb-3 text-right">P&L</th>
                        <th className="pb-3 text-right pr-4">Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TRADERS.map((trader) => (
                        <tr
                          key={trader.rank}
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <td className="py-4 pl-4">
                            <span className={`font-bold ${trader.rank <= 3 ? 'text-primary-400' : 'text-gray-400'}`}>
                              #{trader.rank}
                            </span>
                          </td>
                          <td className="py-4 font-mono text-sm">{trader.address}</td>
                          <td className="py-4 text-right font-medium">{trader.volume}</td>
                          <td className="py-4 text-right text-gray-400">{trader.trades}</td>
                          <td className="py-4 text-right text-green-400 font-medium">{trader.pnl}</td>
                          <td className="py-4 text-right pr-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getBadgeColor(trader.badge)}`}>
                              {trader.badge.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </AnimatedSection>}
          </div>
        )}

        {/* ═══ CAMPAIGNS TAB ═══ */}
        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            {CAMPAIGNS.map((campaign, i) => (
              <AnimatedSection key={campaign.title} delay={i * 0.1}>
                <Card variant="interactive">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold">{campaign.title}</h3>
                        <Badge variant={campaign.status === 'active' ? 'success' : 'info'}>
                          {campaign.status === 'active' ? 'Live' : 'Upcoming'}
                        </Badge>
                      </div>
                      <p className="text-gray-400 text-sm mb-3">{campaign.description}</p>
                      <div className="flex items-center gap-6 text-sm">
                        <span className="text-primary-400 font-medium">
                          <Gift className="w-4 h-4 inline mr-1" />
                          {campaign.reward}
                        </span>
                        <span className="text-gray-500">
                          <Target className="w-4 h-4 inline mr-1" />
                          {campaign.deadline}
                        </span>
                      </div>
                      {campaign.status === 'active' && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Progress</span>
                            <span>{campaign.progress}%</span>
                          </div>
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${campaign.progress}%` }}
                              transition={{ duration: 1, delay: 0.3 }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <Button variant={campaign.status === 'active' ? 'primary' : 'outline'} className="shrink-0">
                      {campaign.status === 'active' ? 'Participate' : 'Notify Me'}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        )}

        {/* ═══ REFERRALS TAB ═══ */}
        {activeTab === 'referrals' && (
          <div className="space-y-6">
            {/* Referral Link */}
            <AnimatedSection>
              <Card variant="highlight">
                <h3 className="text-lg font-bold mb-2">Your Referral Link</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Earn commissions on every trade and LP deposit from users you refer. On-chain tracking via the Referral System contract.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={address ? referralLink : 'Connect wallet to get your link'}
                    readOnly
                    className="font-mono text-sm flex-1"
                  />
                  <Button onClick={handleCopy} disabled={!address}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </Card>
            </AnimatedSection>

            {/* Your Referral Stats */}
            <AnimatedSection delay={0.1}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Referrals" value={address ? '—' : '—'} icon={<Users className="w-5 h-5" />} />
                <StatCard label="Active Referrals" value={address ? '—' : '—'} icon={<Zap className="w-5 h-5" />} />
                <StatCard label="Total Earned" value={address ? '—' : '—'} icon={<Gift className="w-5 h-5" />} />
                <StatCard label="Current Tier" value={address ? '—' : '—'} icon={<Medal className="w-5 h-5" />} />
              </div>
            </AnimatedSection>

            {/* Tier Table */}
            <AnimatedSection delay={0.2}>
              <Card>
                <h3 className="text-lg font-bold mb-4">Referral Tiers</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-400 text-sm border-b border-white/5">
                        <th className="pb-3">Tier</th>
                        <th className="pb-3">Requirement</th>
                        <th className="pb-3 text-right">Commission</th>
                        <th className="pb-3 text-right">Bonus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {REFERRAL_TIERS.map((tier) => (
                        <tr key={tier.name} className="border-b border-white/5">
                          <td className={`py-3 font-bold ${tier.color}`}>{tier.name}</td>
                          <td className="py-3 text-gray-400 text-sm">{tier.requirement}</td>
                          <td className="py-3 text-right text-primary-400 font-medium">{tier.commission}</td>
                          <td className="py-3 text-right text-gray-300">{tier.bonus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </AnimatedSection>
          </div>
        )}

        {/* ═══ BADGES TAB ═══ */}
        {activeTab === 'badges' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {BADGES_DATA.map((badge, i) => (
              <AnimatedSection key={badge.name} delay={i * 0.05}>
                <Card variant="interactive" className="text-center">
                  <div className="text-4xl mb-3">{badge.icon}</div>
                  <h3 className="font-bold mb-1">{badge.name}</h3>
                  <p className="text-gray-400 text-xs mb-3">{badge.requirement}</p>
                  <Badge variant={badge.holders > 0 ? 'success' : 'info'}>
                    {badge.holders > 0 ? `${badge.holders} holders` : 'Unclaimed'}
                  </Badge>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
