'use client'

import { useState } from 'react'
import { BarChart3, Link2, Droplets, Server, Zap, Shield, Activity } from 'lucide-react'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Tabs from '@/components/ui/Tabs'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import ProgressBar from '@/components/ui/ProgressBar'
import AnimatedSection from '@/components/ui/AnimatedSection'
import { TokenIcon } from '@/components/ui/TokenIcon'

const COLLATERAL = [
  { token: 'BNB', amount: '45,234 BNB', value: '$27,140,400', ratio: '21.7%' },
  { token: 'BUSD', amount: '38,500,000 BUSD', value: '$38,500,000', ratio: '30.8%' },
  { token: 'USDT', amount: '42,100,000 USDT', value: '$42,100,000', ratio: '33.7%' },
  { token: 'BTCB', amount: '245 BTCB', value: '$15,925,000', ratio: '12.8%' },
  { token: 'ETH', amount: '1,250 ETH', value: '$4,375,000', ratio: '3.5%' },
]

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <PageHeader
          title="Protocol Statistics"
          subtitle="Real-time data from Chainlink and on-chain sources"
          status={{ label: 'Live Data', variant: 'success' }}
        />

        <div className="mb-8">
          <Tabs
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'oracle', label: 'Oracle' },
              { id: 'liquidity', label: 'Liquidity' },
              { id: 'rpc', label: 'Private RPC' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <AnimatedSection>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="USDTZ Price" value="$1.00" change="+0.01%" icon={<Activity className="w-5 h-5" />} />
                <StatCard label="Market Cap" value="$125M" icon={<BarChart3 className="w-5 h-5" />} />
                <StatCard label="24h Volume" value="$8.45M" change="+12.3%" />
                <StatCard label="Total Supply" value="125M USDTZ" />
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <Card>
                <h2 className="text-xl font-bold mb-5">Protocol Metrics</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-5 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Total Collateral</p>
                    <p className="text-3xl font-bold text-primary-400">$127.4M</p>
                    <p className="text-green-400 text-sm mt-1">+2.5% today</p>
                  </div>
                  <div className="text-center p-5 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Collateral Ratio</p>
                    <p className="text-3xl font-bold">156.2%</p>
                    <Badge variant="success" className="mt-2">Healthy</Badge>
                  </div>
                  <div className="text-center p-5 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Active Users</p>
                    <p className="text-3xl font-bold">45,234</p>
                    <p className="text-green-400 text-sm mt-1">+234 today</p>
                  </div>
                </div>
              </Card>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <Card>
                <h2 className="text-xl font-bold mb-5">Token Distribution</h2>
                <div className="space-y-3">
                  {[
                    { label: 'Circulating Supply', value: '125,000,000 USDTZ', pct: 100 },
                    { label: 'Liquidity Pool (50%)', value: '62,500,000 USDTZ', pct: 50 },
                    { label: 'Staking/Farming Rewards', value: '25,000,000 USDTZ', pct: 20 },
                    { label: 'Team/Development', value: '12,500,000 USDTZ', pct: 10 },
                    { label: 'Treasury', value: '25,000,000 USDTZ', pct: 20 },
                  ].map((item, i) => (
                    <div key={i} className="p-4 bg-white/5 rounded-xl">
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">{item.label}</span>
                        <span className="font-bold">{item.value}</span>
                      </div>
                      <ProgressBar value={item.pct} showValue={false} />
                    </div>
                  ))}
                </div>
              </Card>
            </AnimatedSection>
          </div>
        )}

        {activeTab === 'oracle' && (
          <div className="space-y-6">
            <AnimatedSection>
              <Card>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold">Chainlink Price Feed</h2>
                  <Badge variant="success" dot>Healthy</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Current Price</p>
                    <p className="text-3xl font-bold">$1.00</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Price Source</p>
                    <p className="text-xl font-bold flex items-center gap-2"><Link2 className="w-5 h-5 text-blue-400" /> Chainlink</p>
                  </div>
                </div>
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-400 text-sm mb-1">Feed Address</p>
                  <code className="text-sm text-primary-400">0x0567F2324251f7Bb9aF2aE3D0cF8881Fb6D7F247</code>
                </div>
              </Card>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <Card>
                <h2 className="text-xl font-bold mb-5">Feed Statistics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Last Update</p>
                    <p className="text-lg font-bold">12 sec ago</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Deviation</p>
                    <p className="text-lg font-bold text-green-400">0.00%</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Staleness</p>
                    <Badge variant="success">Pass</Badge>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Heartbeat</p>
                    <p className="text-lg font-bold">1 hour</p>
                  </div>
                </div>
              </Card>
            </AnimatedSection>
          </div>
        )}

        {activeTab === 'liquidity' && (
          <div className="space-y-6">
            <AnimatedSection>
              <Card>
                <h2 className="text-xl font-bold mb-5">Collateral Breakdown</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {COLLATERAL.map((c, i) => (
                    <div key={i} className="text-center p-4 bg-white/5 rounded-xl">
                      <TokenIcon symbol={c.token} size="lg" className="mx-auto mb-3" />
                      <h3 className="font-semibold mb-1">{c.token}</h3>
                      <p className="text-lg font-bold mb-1">{c.value}</p>
                      <p className="text-xs text-gray-400">{c.amount}</p>
                      <Badge variant="primary" className="mt-2">{c.ratio}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <Card className="overflow-hidden" padding="sm">
                <h2 className="text-xl font-bold px-6 pt-5 mb-4">Top Token Pairs</h2>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-400">Pair</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">Liquidity</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">24h Volume</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-gray-400">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { pair: 'USDTZ-USDT', liq: '$15.2M', vol: '$4.5M', alloc: '8%' },
                      { pair: 'USDTZ-BNB', liq: '$12.8M', vol: '$3.2M', alloc: '10%' },
                      { pair: 'USDTZ-BUSD', liq: '$10.5M', vol: '$2.8M', alloc: '8%' },
                      { pair: 'USDTZ-ETH', liq: '$8.9M', vol: '$1.9M', alloc: '6%' },
                      { pair: 'USDTZ-BTCB', liq: '$7.2M', vol: '$1.2M', alloc: '6%' },
                    ].map((r, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-3 font-medium">{r.pair}</td>
                        <td className="px-6 py-3 text-right">{r.liq}</td>
                        <td className="px-6 py-3 text-right text-gray-400">{r.vol}</td>
                        <td className="px-6 py-3 text-right"><Badge variant="primary">{r.alloc}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </AnimatedSection>
          </div>
        )}

        {activeTab === 'rpc' && (
          <div className="space-y-6">
            <AnimatedSection>
              <Card>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold">Private RPC Status</h2>
                  <Badge variant="success" dot>Connected</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Latency</p>
                    <p className="text-3xl font-bold text-green-400">45ms</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Uptime</p>
                    <p className="text-3xl font-bold">99.98%</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Block</p>
                    <p className="text-3xl font-bold">32.1M</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Chain ID</p>
                    <p className="text-3xl font-bold">56</p>
                  </div>
                </div>
              </Card>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <Card>
                <h2 className="text-xl font-bold mb-4">RPC Endpoints</h2>
                <div className="space-y-3">
                  {[
                    { name: 'eth_call', path: 'POST /api/v1/call' },
                    { name: 'eth_sendRawTransaction', path: 'POST /api/v1/send' },
                    { name: 'eth_getBalance', path: 'POST /api/v1/balance' },
                    { name: 'eth_getBlockByNumber', path: 'POST /api/v1/block' },
                  ].map((ep, i) => (
                    <div key={i} className="p-4 bg-white/5 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-medium">{ep.name}</span>
                        <p className="text-sm text-gray-500 mt-0.5"><code>{ep.path}</code></p>
                      </div>
                      <Badge variant="success">Active</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <Card>
                <h2 className="text-xl font-bold mb-5">Benefits</h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { icon: Zap, title: 'High Speed', desc: 'Sub-50ms response times', color: 'from-blue-400 to-cyan-400' },
                    { icon: Shield, title: 'Secure', desc: 'JWT auth and rate limiting', color: 'from-purple-400 to-pink-400' },
                    { icon: Server, title: 'Reliable', desc: '99.98% uptime with failover', color: 'from-orange-400 to-red-400' },
                  ].map((b, i) => (
                    <div key={i} className="text-center p-5 bg-white/5 rounded-xl">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${b.color} bg-opacity-20 flex items-center justify-center mx-auto mb-4`}>
                        <b.icon className="w-5 h-5" />
                      </div>
                      <h3 className="font-semibold mb-1">{b.title}</h3>
                      <p className="text-sm text-gray-400">{b.desc}</p>
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
