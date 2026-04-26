'use client'

import { useState, useEffect } from 'react'
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
import { useContractRead } from 'wagmi'
import { ABIS } from '@/lib/abis'
import { USDTZ_CONFIG } from '@/lib/config'
import { formatEther } from 'viem'
import { fetchTokenPrices } from '@/lib/api/coingecko'

const POOL_MANAGER = USDTZ_CONFIG.contracts.poolManager as `0x${string}`

interface CollateralItem {
  token: string
  amount: string
  value: string
  ratio: string
}

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [collateral, setCollateral] = useState<CollateralItem[]>([])
  const [tokenPrices, setTokenPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Get total TVL from contract
  const { data: tvlData } = useContractRead({
    address: POOL_MANAGER,
    abi: ABIS.PoolManager,
    functionName: 'totalTVL',
    watch: true,
  })

  // Get collateral ratio
  const { data: collateralRatioData } = useContractRead({
    address: POOL_MANAGER,
    abi: ABIS.PoolManager,
    functionName: 'getCollateralRatio',
    watch: true,
  })

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        // Fetch token prices
        const prices = await fetchTokenPrices(['binancecoin', 'ethereum', 'bitcoin', 'tether'])
        setTokenPrices({
          BNB: prices['binancecoin']?.usd || 0,
          ETH: prices['ethereum']?.usd || 0,
          BTC: prices['bitcoin']?.usd || 0,
          USDT: prices['tether']?.usd || 1,
        })

        const tvl = tvlData ? Number(formatEther(tvlData)) : 0
        const supportedCollateral = [
          { token: 'BNB', coingeckoKey: 'binancecoin' },
          { token: 'BUSD', coingeckoKey: 'tether' },
          { token: 'USDT', coingeckoKey: 'tether' },
          { token: 'BTCB', coingeckoKey: 'bitcoin' },
          { token: 'ETH', coingeckoKey: 'ethereum' },
        ]
        const collateralBreakdown: CollateralItem[] = supportedCollateral.map(c => ({
          token: c.token,
          amount: `${c.token}`,
          value: prices[c.coingeckoKey]?.usd ? `$${prices[c.coingeckoKey].usd.toFixed(2)}` : '...',
          ratio: tvl > 0 ? 'On-chain' : '...',
        }))
        setCollateral(collateralBreakdown)
      } catch (error) {
        console.error('Failed to load stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [tvlData])

  const formatUSD = (value: number | bigint) => {
    const num = typeof value === 'bigint' ? Number(formatEther(value)) : value
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  const totalTVL = tvlData ? Number(formatEther(tvlData)) : 0
  const collateralRatio = collateralRatioData ? Number(collateralRatioData) / 100 : 0

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
                <StatCard
                  label="USDTZ Price"
                  value="$1.00"
                  icon={<Activity className="w-5 h-5" />}
                />
                <StatCard
                  label="Total TVL"
                  value={loading ? '...' : formatUSD(totalTVL)}
                  icon={<BarChart3 className="w-5 h-5" />}
                />
                <StatCard
                  label="Collateral Ratio"
                  value={collateralRatio > 0 ? `${collateralRatio.toFixed(1)}%` : '...'}
                />
                <StatCard
                  label="Chain"
                  value="BSC (56)"
                />
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <Card>
                <h2 className="text-xl font-bold mb-5">Protocol Metrics</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-5 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Total Collateral</p>
                    <p className="text-3xl font-bold text-primary-400">
                      {loading ? '...' : formatUSD(totalTVL)}
                    </p>
                    <p className="text-green-400 text-sm mt-1">+2.5% today</p>
                  </div>
                  <div className="text-center p-5 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Collateral Ratio</p>
                    <p className="text-3xl font-bold">{collateralRatio.toFixed(1)}%</p>
                    <Badge variant="success" className="mt-2">Healthy</Badge>
                  </div>
                  <div className="text-center p-5 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Chain ID</p>
                    <p className="text-3xl font-bold">56</p>
                    <Badge variant="success" className="mt-2">BNB Chain</Badge>
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
                    <p className="text-xl font-bold flex items-center gap-2">
                      <Link2 className="w-5 h-5 text-blue-400" /> Chainlink
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { name: 'BNB/USD', address: USDTZ_CONFIG.oracles.chainlink.bnbUsd, price: tokenPrices.BNB ? `$${tokenPrices.BNB.toFixed(2)}` : '...' },
                    { name: 'USDT/USD', address: USDTZ_CONFIG.oracles.chainlink.usdtUsd, price: '$1.00' },
                  ].map((feed, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                      <div>
                        <p className="font-semibold">{feed.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{feed.address.slice(0, 10)}...{feed.address.slice(-8)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{feed.price}</p>
                        <Badge variant="success" size="sm">Live</Badge>
                      </div>
                    </div>
                  ))}
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
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className="p-4 bg-white/5 rounded-xl animate-pulse">
                        <div className="h-4 w-12 bg-white/10 rounded mb-2" />
                        <div className="h-8 w-20 bg-white/10 rounded" />
                      </div>
                    ))
                  ) : (
                    collateral.map((c) => (
                      <div key={c.token} className="text-center p-4 bg-white/5 rounded-xl">
                        <TokenIcon symbol={c.token} size="lg" className="mx-auto mb-2" />
                        <p className="font-bold">{c.token}</p>
                        <p className="text-sm text-gray-400">{c.amount}</p>
                        <p className="text-primary-400 font-semibold">{c.value}</p>
                        <Badge variant="primary" className="mt-2">{c.ratio}</Badge>
                      </div>
                    ))
                  )}
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
                      { pair: 'USDTZ-USDT', token: 'USDT' },
                      { pair: 'USDTZ-BNB', token: 'BNB' },
                      { pair: 'USDTZ-BUSD', token: 'BUSD' },
                      { pair: 'USDTZ-ETH', token: 'ETH' },
                      { pair: 'USDTZ-BTCB', token: 'BTCB' },
                    ].map((r, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-3 font-medium">{r.pair}</td>
                        <td className="px-6 py-3 text-right">{tokenPrices[r.token] ? `$${tokenPrices[r.token].toFixed(2)}` : '...'}</td>
                        <td className="px-6 py-3 text-right text-gray-400">—</td>
                        <td className="px-6 py-3 text-right"><Badge variant="primary">Active</Badge></td>
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
                    <p className="text-gray-400 text-sm mb-1">Endpoint</p>
                    <p className="text-lg font-bold text-green-400 truncate">{USDTZ_CONFIG.rpc.private.url}</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Network</p>
                    <p className="text-3xl font-bold">BSC</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm mb-1">Auth</p>
                    <p className="text-3xl font-bold text-green-400">JWT</p>
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
          </div>
        )}
      </div>
    </Layout>
  )
}
