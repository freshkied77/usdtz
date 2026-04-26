'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { BrainCircuit, Plus } from 'lucide-react'
import { useAccount, usePublicClient, useWalletClient, useContractRead, useContractReads } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import PageHeader from '@/components/ui/PageHeader'
import AnimatedSection from '@/components/ui/AnimatedSection'
import { ABIS } from '@/lib/abis'
import { USDTZ_CONFIG } from '@/lib/config'

const PREDICTION_MARKET_ADDRESS = USDTZ_CONFIG.contracts.predictionMarket as `0x${string}`
const USDTZ_ADDRESS = USDTZ_CONFIG.contracts.usdtz as `0x${string}`

const ERC20_APPROVE_ABI = [
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

interface Market {
  id: number
  question: string
  resolveTime: Date
  totalYES: number
  totalNO: number
  yesOdds: number
  noOdds: number
  resolved: boolean
  answer?: boolean
  userBetYes: number
  userBetNo: number
}

export default function PredictionPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [betAmount, setBetAmount] = useState('')
  const [betSide, setBetSide] = useState<'YES' | 'NO'>('YES')
  const [showCreate, setShowCreate] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newLiq, setNewLiq] = useState('')
  const [isBetting, setIsBetting] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)

  const { data: marketCounter } = useContractRead({
    address: PREDICTION_MARKET_ADDRESS,
    abi: ABIS.PredictionMarket,
    functionName: 'marketCounter',
    watch: true,
  })

  const marketIndices = useMemo(() => {
    if (!marketCounter) return []
    const count = Number(marketCounter)
    return Array.from({ length: Math.min(count, 20) }, (_, i) => i)
  }, [marketCounter])

  const marketReadConfigs = useMemo(() =>
    marketIndices.map((idx) => ({
      address: PREDICTION_MARKET_ADDRESS,
      abi: ABIS.PredictionMarket,
      functionName: 'getMarketInfo' as const,
      args: [BigInt(idx)] as const,
    })),
    [marketIndices]
  )

  const { data: marketInfosData, isLoading: isLoadingMarkets } = useContractReads({
    contracts: marketReadConfigs,
  })

  useEffect(() => {
    if (isLoadingMarkets || !marketInfosData) {
      setLoading(isLoadingMarkets)
      return
    }

    const parsed: Market[] = marketIndices.map((idx, i) => {
      const info = marketInfosData[i]
      if (!info || !info.result || !Array.isArray(info.result)) return null

      const result = info.result as unknown as any[]
      const [question, resolveTime, resolved, answer, totalYes, totalNo, yesOdds, noOdds] = result

      return {
        id: idx,
        question,
        resolveTime: new Date(Number(resolveTime) * 1000),
        resolved,
        answer,
        totalYES: Number(formatEther(totalYes || BigInt(0))),
        totalNO: Number(formatEther(totalNo || BigInt(0))),
        yesOdds: Number(yesOdds || BigInt(0)) / 1000,
        noOdds: Number(noOdds || BigInt(0)) / 1000,
        userBetYes: 0,
        userBetNo: 0,
      } as Market
    }).filter((m): m is Market => m !== null && m.question !== '')

    setMarkets(parsed)
    setLoading(false)
  }, [marketInfosData, isLoadingMarkets, marketIndices])

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toFixed(0)
  const fmtTime = (d: Date) => {
    const days = Math.floor((d.getTime() - Date.now()) / 86400000)
    return days > 30 ? d.toLocaleDateString() : days > 0 ? `${days}d left` : 'Ended'
  }

  const placeBet = async () => {
    if (!selectedMarket || !betAmount || !address || !publicClient || !walletClient) return
    setIsBetting(true)
    setError('')
    setTxHash(null)
    try {
      const amount = parseEther(betAmount)

      const { request: approveReq } = await publicClient.simulateContract({
        address: USDTZ_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [PREDICTION_MARKET_ADDRESS, amount],
        account: address,
      })
      await walletClient.writeContract(approveReq)

      const { request } = await publicClient.simulateContract({
        address: PREDICTION_MARKET_ADDRESS,
        abi: ABIS.PredictionMarket,
        functionName: 'placeBet',
        args: [BigInt(selectedMarket.id), betSide === 'YES', amount],
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setTxHash(hash)
      setSelectedMarket(null)
      setBetAmount('')
    } catch (err: any) {
      console.error('Place bet failed:', err)
      setError(err?.shortMessage || 'Bet failed — check USDTZ balance and approval')
    } finally {
      setIsBetting(false)
    }
  }

  const createMarket = async () => {
    if (!newQ || !newDate || !newLiq || !address || !publicClient || !walletClient) return
    setIsCreating(true)
    setError('')
    setTxHash(null)
    try {
      const liq = parseEther(newLiq)
      const resolveTimestamp = BigInt(Math.floor(new Date(newDate).getTime() / 1000))

      const { request: approveReq } = await publicClient.simulateContract({
        address: USDTZ_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [PREDICTION_MARKET_ADDRESS, liq],
        account: address,
      })
      await walletClient.writeContract(approveReq)

      const { request } = await publicClient.simulateContract({
        address: PREDICTION_MARKET_ADDRESS,
        abi: ABIS.PredictionMarket,
        functionName: 'createMarket',
        args: [newQ, resolveTimestamp, liq],
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setTxHash(hash)
      setShowCreate(false)
      setNewQ(''); setNewDate(''); setNewLiq('')
    } catch (err: any) {
      console.error('Create market failed:', err)
      setError(err?.shortMessage || 'Create market failed — check USDTZ balance')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <PageHeader
          title="Prediction Market"
          subtitle="Trade on future events with USDTZ"
          action={
            <Button onClick={() => { setShowCreate(true); setError(''); setTxHash(null); }} disabled={!isConnected}>
              <Plus className="w-4 h-4" />
              Create Market
            </Button>
          }
        />

        <AnimatedSection>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="h-48 animate-pulse bg-white/5"><div /></Card>
              ))}
            </div>
          ) : markets.length === 0 ? (
            <Card className="p-12 text-center">
              <BrainCircuit className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              <h3 className="text-xl font-semibold mb-2">No Markets Yet</h3>
              <p className="text-gray-400 mb-4">Be the first to create a prediction market</p>
              <Button onClick={() => setShowCreate(true)} disabled={!isConnected}>
                <Plus className="w-4 h-4" /> Create Market
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {markets.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card variant="interactive" className="cursor-pointer h-full" onClick={() => { setSelectedMarket(m); setError(''); setTxHash(null); }}>
                    <div className="flex items-start justify-between mb-4">
                      <Badge variant={m.resolved ? 'success' : 'primary'}>
                        {m.resolved ? (m.answer ? 'YES' : 'NO') : 'Open'}
                      </Badge>
                      <span className="text-xs text-gray-500">{fmtTime(m.resolveTime)}</span>
                    </div>

                    <h3 className="text-base font-semibold mb-5 leading-snug line-clamp-2">{m.question}</h3>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">YES</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-green-400">{m.yesOdds.toFixed(2)}x</span>
                          <span className="text-xs text-gray-500">{fmt(m.totalYES)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                          style={{ width: `${m.totalYES + m.totalNO > 0 ? (m.totalYES / (m.totalYES + m.totalNO)) * 100 : 50}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">NO</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-red-400">{m.noOdds.toFixed(2)}x</span>
                          <span className="text-xs text-gray-500">{fmt(m.totalNO)}</span>
                        </div>
                      </div>
                    </div>

                    {(m.userBetYes > 0 || m.userBetNo > 0) && (
                      <div className="mt-4 pt-3 border-t border-white/5">
                        <p className="text-xs text-gray-500 mb-1">Your bets:</p>
                        <div className="flex gap-3">
                          {m.userBetYes > 0 && <Badge variant="success" size="sm">YES: {m.userBetYes}</Badge>}
                          {m.userBetNo > 0 && <Badge variant="danger" size="sm">NO: {m.userBetNo}</Badge>}
                        </div>
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatedSection>

        {/* Bet Modal */}
        <Modal isOpen={!!selectedMarket} onClose={() => setSelectedMarket(null)} title="Place Bet" size="md">
          {selectedMarket && (
            <div>
              <p className="text-sm text-gray-400 mb-5 line-clamp-2">{selectedMarket.question}</p>

              <div className="flex gap-3 mb-5">
                <button
                  onClick={() => setBetSide('YES')}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                    betSide === 'YES' ? 'bg-green-500 text-dark-300' : 'bg-white/10 text-gray-400'
                  }`}
                >
                  YES @ {selectedMarket.yesOdds.toFixed(2)}x
                </button>
                <button
                  onClick={() => setBetSide('NO')}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                    betSide === 'NO' ? 'bg-red-500 text-dark-300' : 'bg-white/10 text-gray-400'
                  }`}
                >
                  NO @ {selectedMarket.noOdds.toFixed(2)}x
                </button>
              </div>

              <Input
                type="number"
                label="Amount (USDTZ)"
                placeholder="0.00"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
              />

              <div className="flex gap-2 mt-2 mb-5">
                {[100, 500, 1000, 5000].map(a => (
                  <button key={a} onClick={() => setBetAmount(a.toString())}
                    className="px-3 py-1.5 bg-white/10 rounded-lg text-xs hover:bg-white/20 transition-colors">
                    {a}
                  </button>
                ))}
              </div>

              <div className="p-4 bg-white/5 rounded-xl mb-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Potential Payout</span>
                  <span className="font-semibold text-primary-400">
                    {betAmount ? (parseFloat(betAmount) * (betSide === 'YES' ? selectedMarket.yesOdds : selectedMarket.noOdds)).toFixed(2) : '0.00'} USDTZ
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Pool Fee</span>
                  <span className="text-gray-500">1%</span>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 mb-4">{error}</div>
              )}
              {txHash && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400 mb-4">
                  Bet placed! Tx: {txHash.slice(0, 16)}...
                </div>
              )}

              <Button
                fullWidth
                size="lg"
                onClick={placeBet}
                loading={isBetting}
                disabled={!betAmount || !isConnected || parseFloat(betAmount) <= 0}
              >
                {!isConnected ? 'Connect Wallet' : 'Place Bet'}
              </Button>
            </div>
          )}
        </Modal>

        {/* Create Modal */}
        <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Prediction Market" size="md">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Question</label>
              <textarea
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                placeholder="Will USDTZ reach $1.05 by end of Q2 2026?"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary-500 resize-none h-24 text-white placeholder:text-gray-500"
              />
            </div>
            <Input type="date" label="Resolution Date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <Input type="number" label="Initial Liquidity (USDTZ)" placeholder="10000" value={newLiq} onChange={(e) => setNewLiq(e.target.value)} />

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>
            )}
            {txHash && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400">
                Market created! Tx: {txHash.slice(0, 16)}...
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <Button variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={createMarket}
                loading={isCreating}
                disabled={!newQ || !newDate || !newLiq || !isConnected}
              >
                {!isConnected ? 'Connect Wallet' : 'Create'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
