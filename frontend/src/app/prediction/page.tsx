'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { BrainCircuit, Plus } from 'lucide-react'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import PageHeader from '@/components/ui/PageHeader'
import AnimatedSection from '@/components/ui/AnimatedSection'

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

const INITIAL_MARKETS: Market[] = [
  { id: 0, question: 'Will USDTZ reach $1.05 by end of Q2 2026?', resolveTime: new Date('2026-06-30'), totalYES: 125000, totalNO: 85000, yesOdds: 1.42, noOdds: 0.58, resolved: false, userBetYes: 100, userBetNo: 0 },
  { id: 1, question: 'Will BNB Chain surpass Ethereum in daily transactions by Q3 2026?', resolveTime: new Date('2026-09-30'), totalYES: 45000, totalNO: 72000, yesOdds: 0.63, noOdds: 1.61, resolved: false, userBetYes: 0, userBetNo: 200 },
  { id: 2, question: 'Will USDTZ be listed on major CEX by Q4 2026?', resolveTime: new Date('2026-12-31'), totalYES: 89000, totalNO: 43000, yesOdds: 2.07, noOdds: 0.48, resolved: false, userBetYes: 500, userBetNo: 0 },
]

export default function PredictionPage() {
  const [markets, setMarkets] = useState<Market[]>(INITIAL_MARKETS)
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [betAmount, setBetAmount] = useState('')
  const [betSide, setBetSide] = useState<'YES' | 'NO'>('YES')
  const [showCreate, setShowCreate] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newLiq, setNewLiq] = useState('')

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString()
  const fmtTime = (d: Date) => {
    const days = Math.floor((d.getTime() - Date.now()) / 86400000)
    return days > 30 ? d.toLocaleDateString() : `${days}d left`
  }

  const placeBet = () => {
    if (!selectedMarket || !betAmount) return
    const amt = parseFloat(betAmount)
    setMarkets(ms => ms.map(m => m.id === selectedMarket.id ? {
      ...m,
      totalYES: betSide === 'YES' ? m.totalYES + amt : m.totalYES,
      totalNO: betSide === 'NO' ? m.totalNO + amt : m.totalNO,
      userBetYes: betSide === 'YES' ? m.userBetYes + amt : m.userBetYes,
      userBetNo: betSide === 'NO' ? m.userBetNo + amt : m.userBetNo,
    } : m))
    setSelectedMarket(null)
    setBetAmount('')
  }

  const createMarket = () => {
    if (!newQ || !newDate || !newLiq) return
    const liq = parseFloat(newLiq)
    setMarkets([...markets, {
      id: markets.length, question: newQ, resolveTime: new Date(newDate),
      totalYES: liq * 0.5, totalNO: liq * 0.5, yesOdds: 2.0, noOdds: 2.0,
      resolved: false, userBetYes: 0, userBetNo: 0,
    }])
    setShowCreate(false)
    setNewQ(''); setNewDate(''); setNewLiq('')
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <PageHeader
          title="Prediction Market"
          subtitle="Trade on future events with USDTZ"
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" />
              Create Market
            </Button>
          }
        />

        <AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {markets.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card variant="interactive" className="cursor-pointer h-full" onClick={() => setSelectedMarket(m)}>
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
                        style={{ width: `${(m.totalYES / (m.totalYES + m.totalNO)) * 100}%` }}
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

              <Button fullWidth size="lg" onClick={placeBet} disabled={!betAmount}>
                Place Bet
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
            <div className="flex gap-3 mt-5">
              <Button variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="flex-1" onClick={createMarket} disabled={!newQ || !newDate || !newLiq}>Create</Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  )
}
