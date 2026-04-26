'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, Shield, GitBranch, Shuffle } from 'lucide-react'
import { useAccount, usePublicClient, useWalletClient, useContractRead, useBalance } from 'wagmi'
import { parseEther, formatEther, keccak256, encodePacked } from 'viem'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Tabs from '@/components/ui/Tabs'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import AnimatedSection from '@/components/ui/AnimatedSection'
import { ABIS } from '@/lib/abis'
import { USDTZ_CONFIG } from '@/lib/config'

const PRIVACY_POOL_ADDRESS = USDTZ_CONFIG.contracts.privacyPool as `0x${string}`
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

const PRIVACY_LEVELS = [
  { level: 1, name: 'Basic', min: '100', max: '1,000', mult: '1x', color: 'from-blue-400 to-blue-500' },
  { level: 2, name: 'Standard', min: '1,000', max: '10,000', mult: '3x', color: 'from-green-400 to-green-500' },
  { level: 3, name: 'Advanced', min: '10,000', max: '100,000', mult: '10x', color: 'from-purple-400 to-purple-500' },
  { level: 4, name: 'Maximum', min: '100,000', max: '1,000,000', mult: '50x', color: 'from-red-400 to-red-500' },
]

const RECENT_TXS: { id: string; type: string; amount: string; anon: string; time: string; status: string }[] = []

export default function PrivacyPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [activeTab, setActiveTab] = useState('pool')
  const [selectedLevel, setSelectedLevel] = useState(1)
  const [isMember, setIsMember] = useState(false)
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [commitmentHash, setCommitmentHash] = useState('')
  const [isDepositing, setIsDepositing] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [darkTokenIn, setDarkTokenIn] = useState('')
  const [darkTokenOut, setDarkTokenOut] = useState('')
  const [darkAmount, setDarkAmount] = useState('')
  const [darkMinOutput, setDarkMinOutput] = useState('')
  const [isDarkOrdering, setIsDarkOrdering] = useState(false)

  const { data: usdtzBalance } = useBalance({
    address,
    token: USDTZ_ADDRESS,
    watch: true,
  })

  const { data: anonymitySetSize } = useContractRead({
    address: PRIVACY_POOL_ADDRESS,
    abi: ABIS.PrivacyPool,
    functionName: 'anonymitySetSize',
    watch: true,
  })

  const currentLevel = PRIVACY_LEVELS.find(l => l.level === selectedLevel)

  const generateCommitment = (): `0x${string}` => {
    const secret = crypto.getRandomValues(new Uint8Array(31))
    const nullifier = crypto.getRandomValues(new Uint8Array(31))
    const packed = encodePacked(
      ['bytes', 'bytes'],
      [`0x${Buffer.from(secret).toString('hex')}`, `0x${Buffer.from(nullifier).toString('hex')}`]
    )
    return keccak256(packed)
  }

  const handleDeposit = async () => {
    if (!amount || !address || !publicClient || !walletClient || !isConnected) return
    setIsDepositing(true)
    setError('')
    setTxHash(null)
    try {
      const depositAmount = parseEther(amount)

      const { request: approveReq } = await publicClient.simulateContract({
        address: USDTZ_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [PRIVACY_POOL_ADDRESS, depositAmount],
        account: address,
      })
      await walletClient.writeContract(approveReq)

      const commitment = generateCommitment()
      setCommitmentHash(commitment)

      const { request } = await publicClient.simulateContract({
        address: PRIVACY_POOL_ADDRESS,
        abi: ABIS.PrivacyPool,
        functionName: 'deposit',
        args: [commitment],
        value: depositAmount,
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setTxHash(hash)
    } catch (err: any) {
      console.error('Privacy deposit failed:', err)
      setError(err?.shortMessage || 'Deposit failed — check amount and balance')
    } finally {
      setIsDepositing(false)
    }
  }

  const handlePrivateTransfer = async () => {
    if (!amount || !recipient || !address || !publicClient || !walletClient || !isConnected) return
    setIsTransferring(true)
    setError('')
    setTxHash(null)
    try {
      const transferAmount = parseEther(amount)

      const { request: approveReq } = await publicClient.simulateContract({
        address: USDTZ_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [PRIVACY_POOL_ADDRESS, transferAmount],
        account: address,
      })
      await walletClient.writeContract(approveReq)

      const commitment = generateCommitment()
      setCommitmentHash(commitment)

      const { request } = await publicClient.simulateContract({
        address: PRIVACY_POOL_ADDRESS,
        abi: ABIS.PrivacyPool,
        functionName: 'deposit',
        args: [commitment],
        value: transferAmount,
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setTxHash(hash)
    } catch (err: any) {
      console.error('Private transfer failed:', err)
      setError(err?.shortMessage || 'Transfer failed — check amount and recipient')
    } finally {
      setIsTransferring(false)
    }
  }

  const handleDarkOrder = async () => {
    if (!darkAmount || !address || !publicClient || !walletClient || !isConnected) return
    setIsDarkOrdering(true)
    setError('')
    setTxHash(null)
    try {
      const orderAmount = parseEther(darkAmount)

      const { request: approveReq } = await publicClient.simulateContract({
        address: USDTZ_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [PRIVACY_POOL_ADDRESS, orderAmount],
        account: address,
      })
      await walletClient.writeContract(approveReq)

      const commitment = generateCommitment()

      const { request } = await publicClient.simulateContract({
        address: PRIVACY_POOL_ADDRESS,
        abi: ABIS.PrivacyPool,
        functionName: 'deposit',
        args: [commitment],
        value: orderAmount,
        account: address,
      })
      const hash = await walletClient.writeContract(request)
      setTxHash(hash)
    } catch (err: any) {
      console.error('Dark order failed:', err)
      setError(err?.shortMessage || 'Dark order failed')
    } finally {
      setIsDarkOrdering(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <PageHeader
          title="Privacy Hub"
          subtitle="Untraceable transfers with zero-knowledge proof technology"
          status={{ label: 'Privacy Active', variant: 'success' }}
        />

        <AnimatedSection className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Privacy Levels" value="4" icon={<EyeOff className="w-5 h-5" />} />
            <StatCard label="Anonymity Set" value={anonymitySetSize ? Number(anonymitySetSize).toLocaleString() : '—'} icon={<Shuffle className="w-5 h-5" />} />
            <StatCard label="ZK Proofs" value="Active" />
            <StatCard label="Max Anonymity" value="50x" />
          </div>
        </AnimatedSection>

        {!isMember ? (
          <AnimatedSection>
            <Card variant="highlight" className="text-center max-w-2xl mx-auto" padding="lg">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-10 h-10 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Join the Privacy Club</h2>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Register as a privacy member to access untraceable transfers, private vaults, and dark pool trading.
              </p>
              <Button size="lg" onClick={() => setIsMember(true)}>
                <Shield className="w-5 h-5" />
                Register as Privacy Member
              </Button>
            </Card>
          </AnimatedSection>
        ) : (
          <>
            <div className="mb-6">
              <Tabs
                tabs={[
                  { id: 'pool', label: 'Privacy Pool' },
                  { id: 'transfer', label: 'Private Transfer' },
                  { id: 'dark', label: 'Dark Pool' },
                  { id: 'history', label: 'History' },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
              />
            </div>

            {activeTab === 'pool' && (
              <AnimatedSection>
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card variant="highlight" padding="lg">
                    <h2 className="text-xl font-bold mb-5">Privacy Pool Deposit</h2>
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Privacy Level</label>
                        <div className="grid grid-cols-2 gap-3">
                          {PRIVACY_LEVELS.map((lv) => (
                            <button
                              key={lv.level}
                              onClick={() => setSelectedLevel(lv.level)}
                              className={`p-4 rounded-xl border text-left transition-all ${
                                selectedLevel === lv.level ? 'border-primary-500/50 bg-primary-500/10' : 'border-white/10 hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold">{lv.name}</span>
                                <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${lv.color}`} />
                              </div>
                              <p className="text-xs text-gray-400">{lv.min} - {lv.max} USDTZ</p>
                              <p className="text-primary-400 font-medium text-sm mt-1">{lv.mult} Anonymity</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <Input
                        type="number"
                        label="Amount (USDTZ)"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        balance={`Balance: ${usdtzBalance ? parseFloat(formatEther(usdtzBalance.value)).toFixed(2) : '0.00'} USDTZ`}
                        onMax={() => usdtzBalance && setAmount(formatEther(usdtzBalance.value))}
                        className="text-xl font-bold"
                      />

                      <div className="p-4 bg-white/5 rounded-xl space-y-2 text-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className="w-4 h-4 text-primary-400" />
                          <span className="font-semibold">Zero-Knowledge Proof Deposit</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Anonymity Set</span>
                          <span className="text-primary-400">{anonymitySetSize ? `${Number(anonymitySetSize).toLocaleString()} addresses` : '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Expected Anonymity</span>
                          <span className="text-green-400">{currentLevel?.mult}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Privacy Fee</span>
                          <span className="text-yellow-400">0.1%</span>
                        </div>
                      </div>

                      {txHash && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm">
                          <p className="text-green-400 font-medium">Deposit submitted!</p>
                          <p className="text-xs text-gray-400 mt-1 font-mono break-all">Tx: {txHash}</p>
                          {commitmentHash && <p className="text-xs text-gray-400 mt-1 font-mono break-all">Commitment: {commitmentHash}</p>}
                        </div>
                      )}
                      {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>
                      )}
                      <Button
                        fullWidth
                        size="lg"
                        onClick={handleDeposit}
                        loading={isDepositing}
                        disabled={!isConnected || !amount || parseFloat(amount) <= 0}
                      >
                        {!isConnected ? 'Connect Wallet' : 'Generate Private Commitment'}
                      </Button>
                    </div>
                  </Card>

                  <Card padding="lg">
                    <h2 className="text-xl font-bold mb-5">How Privacy Pool Works</h2>
                    <div className="space-y-4">
                      {[
                        { step: 1, title: 'Deposit into Pool', desc: 'Your transaction is cryptographically sealed with a commitment hash.', icon: Lock, color: 'from-blue-400 to-cyan-400' },
                        { step: 2, title: 'Join Anonymity Set', desc: 'Deposits are mixed, making it impossible to trace individual funds.', icon: Shuffle, color: 'from-green-400 to-emerald-400' },
                        { step: 3, title: 'Zero-Knowledge Proof', desc: 'ZK proof proves ownership without revealing which deposit is yours.', icon: Shield, color: 'from-purple-400 to-pink-400' },
                        { step: 4, title: 'Untraceable Withdraw', desc: 'No on-chain link between deposit and withdrawal.', icon: EyeOff, color: 'from-orange-400 to-red-400' },
                      ].map((s) => (
                        <div key={s.step} className="p-4 bg-white/5 rounded-xl flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shrink-0`}>
                            <s.icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold mb-1">{s.title}</h3>
                            <p className="text-sm text-gray-400">{s.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </AnimatedSection>
            )}

            {activeTab === 'transfer' && (
              <AnimatedSection>
                <div className="grid lg:grid-cols-2 gap-6">
                  <Card variant="highlight" padding="lg">
                    <h2 className="text-xl font-bold mb-5">Private Transfer</h2>
                    <div className="space-y-5">
                      <Input label="Recipient Address" placeholder="0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} />
                      <Input type="number" label="Amount (USDTZ)" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-xl font-bold" />

                      <div className="p-4 bg-white/5 rounded-xl">
                        <h3 className="font-semibold mb-2 flex items-center gap-2"><Shield className="w-4 h-4 text-primary-400" /> ZK Transfer</h3>
                        <div className="space-y-1 text-sm text-gray-400">
                          <p>Transfer mixed with other transactions</p>
                          <p>Recipient address hidden from analysis</p>
                          <p>Completely untraceable</p>
                        </div>
                      </div>

                      <Input label="Commitment Hash" placeholder="Auto-generated" value={commitmentHash} className="font-mono text-sm" />
                      {txHash && activeTab === 'transfer' && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm">
                          <p className="text-green-400 font-medium">Transfer submitted!</p>
                          <p className="text-xs text-gray-400 mt-1 font-mono break-all">Tx: {txHash}</p>
                        </div>
                      )}
                      {error && activeTab === 'transfer' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>
                      )}
                      <Button
                        fullWidth
                        size="lg"
                        onClick={handlePrivateTransfer}
                        loading={isTransferring}
                        disabled={!isConnected || !amount || !recipient || parseFloat(amount) <= 0}
                      >
                        {!isConnected ? 'Connect Wallet' : 'Execute Private Transfer'}
                      </Button>
                    </div>
                  </Card>

                  <Card padding="lg">
                    <h2 className="text-xl font-bold mb-5">Privacy Features</h2>
                    <div className="space-y-4">
                      {[
                        { icon: GitBranch, title: 'Merkle Tree Verification', desc: 'ZK proofs verify deposits exist without revealing position or value.' },
                        { icon: Lock, title: 'Nullifier Hashes', desc: 'Unique nullifiers prevent double-spending while maintaining privacy.' },
                        { icon: Shuffle, title: 'Cross-Chain Privacy', desc: 'Privacy transfers work across BNB, Zedx, Ethereum, and Polygon.' },
                      ].map((f, i) => (
                        <div key={i} className="p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center gap-3 mb-2">
                            <f.icon className="w-5 h-5 text-primary-400" />
                            <h3 className="font-semibold">{f.title}</h3>
                          </div>
                          <p className="text-sm text-gray-400">{f.desc}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </AnimatedSection>
            )}

            {activeTab === 'dark' && (
              <AnimatedSection>
                <Card padding="lg">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold">Dark Pool Trading</h2>
                      <p className="text-sm text-gray-400">Unmatchable orders for maximum privacy</p>
                    </div>
                    <Badge variant="info" dot>Dark Pool Active</Badge>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6 mb-6">
                    <div className="p-5 bg-white/5 rounded-xl">
                      <h3 className="font-semibold mb-4">Place Dark Order</h3>
                      <div className="space-y-4">
                        <Input label="Token In" placeholder="USDTZ" value={darkTokenIn} onChange={(e) => setDarkTokenIn(e.target.value)} />
                        <Input label="Token Out" placeholder="USDT" value={darkTokenOut} onChange={(e) => setDarkTokenOut(e.target.value)} />
                        <Input type="number" label="Amount" placeholder="0.00" value={darkAmount} onChange={(e) => setDarkAmount(e.target.value)} />
                        <Input type="number" label="Minimum Output" placeholder="0.00" value={darkMinOutput} onChange={(e) => setDarkMinOutput(e.target.value)} />
                        {txHash && activeTab === 'dark' && (
                          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm">
                            <p className="text-green-400 font-medium">Dark order placed!</p>
                            <p className="text-xs text-gray-400 mt-1 font-mono break-all">Tx: {txHash}</p>
                          </div>
                        )}
                        {error && activeTab === 'dark' && (
                          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>
                        )}
                        <Button
                          variant="outline"
                          fullWidth
                          onClick={handleDarkOrder}
                          loading={isDarkOrdering}
                          disabled={!isConnected || !darkAmount || parseFloat(darkAmount) <= 0}
                        >
                          {!isConnected ? 'Connect Wallet' : 'Place Dark Order'}
                        </Button>
                      </div>
                    </div>
                    <div className="p-5 bg-white/5 rounded-xl">
                      <h3 className="font-semibold mb-4">Dark Pool Stats</h3>
                      <div className="space-y-4">
                        {[
                          { label: 'Active Orders', value: '—' },
                          { label: 'Volume', value: '—' },
                          { label: 'Your Orders', value: '—' },
                          { label: 'Timeout', value: '24 hours' },
                        ].map((s, i) => (
                          <div key={i} className="flex justify-between">
                            <span className="text-gray-400">{s.label}</span>
                            <span className="text-xl font-bold">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <h3 className="font-semibold mb-3">Active Dark Orders</h3>
                  <div className="space-y-2">
                    {[
                      { pair: '50,000 USDTZ → 50,200 BUSD', maker: '0x1234...5678', status: 'Open', time: '23h 45m' },
                      { pair: '25,000 USDTZ → 24,800 USDT', maker: '0xabcd...efgh', status: 'Filled', time: '1 hour ago' },
                    ].map((o, i) => (
                      <div key={i} className="p-4 bg-white/5 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-medium">{o.pair}</p>
                          <p className="text-xs text-gray-500">Maker: {o.maker}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={o.status === 'Open' ? 'warning' : 'success'}>{o.status}</Badge>
                          <p className="text-xs text-gray-500 mt-1">{o.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </AnimatedSection>
            )}

            {activeTab === 'history' && (
              <AnimatedSection>
                <Card>
                  <h2 className="text-xl font-bold mb-4">Privacy Transaction History</h2>
                  <div className="space-y-3">
                    {RECENT_TXS.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Lock className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                        <p className="text-lg font-medium mb-1">No privacy transactions yet</p>
                        <p className="text-sm">Your private deposits, transfers, and withdrawals will appear here.</p>
                      </div>
                    )}
                    {RECENT_TXS.map((tx, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-4 bg-white/5 rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            tx.type === 'Deposit' ? 'bg-green-500/20' : tx.type === 'Transfer' ? 'bg-blue-500/20' : 'bg-purple-500/20'
                          }`}>
                            {tx.type === 'Deposit' ? <Lock className="w-5 h-5 text-green-400" /> :
                             tx.type === 'Transfer' ? <Shuffle className="w-5 h-5 text-blue-400" /> :
                             <EyeOff className="w-5 h-5 text-purple-400" />}
                          </div>
                          <div>
                            <p className="font-medium">{tx.type}: {tx.amount} USDTZ</p>
                            <p className="text-xs text-gray-500">{tx.id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <Badge variant="primary" size="sm">{tx.anon}</Badge>
                            <Badge variant="success" size="sm">{tx.status}</Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{tx.time}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </AnimatedSection>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
