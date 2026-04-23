'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, Building2, Smartphone, DollarSign, Shield, Clock, ChevronDown, CheckCircle, AlertCircle, Zap, Globe, ArrowRight } from 'lucide-react'
import Layout from '@/components/Layout'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Tabs from '@/components/ui/Tabs'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import PageHeader from '@/components/ui/PageHeader'
import AnimatedSection from '@/components/ui/AnimatedSection'

const PAYMENT_METHODS = [
  { id: 'card', label: 'Debit / Credit Card', icon: CreditCard, fee: '2.5%', time: '~2 min', desc: 'Visa, Mastercard, Apple Pay, Google Pay' },
  { id: 'bank', label: 'Bank Transfer', icon: Building2, fee: '0.5%', time: '~1-3 hrs', desc: 'ACH, SEPA, Wire Transfer' },
  { id: 'mobile', label: 'Mobile Pay', icon: Smartphone, fee: '1.5%', time: '~1 min', desc: 'Apple Pay, Google Pay, Samsung Pay' },
]

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '\u20AC' },
  { code: 'GBP', name: 'British Pound', symbol: '\u00A3' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '\u20A6' },
]

const RECENT_PURCHASES = [
  { amount: '5,000', currency: 'USD', usdtz: '4,975', method: 'card', status: 'Completed', time: '12 mins ago' },
  { amount: '12,500', currency: 'USD', usdtz: '12,437.50', method: 'bank', status: 'Completed', time: '2 hrs ago' },
  { amount: '1,000', currency: 'EUR', usdtz: '1,082.50', method: 'mobile', status: 'Processing', time: '5 mins ago' },
  { amount: '25,000', currency: 'USD', usdtz: '24,875', method: 'bank', status: 'Completed', time: '1 day ago' },
]

const WHY_BUY = [
  { title: 'Instant Settlement', desc: 'USDTZ arrives in your wallet within minutes, not days', icon: Zap },
  { title: 'Lowest Fees', desc: 'Starting at 0.5% — up to 80% cheaper than competitors', icon: DollarSign },
  { title: 'No Hidden Costs', desc: 'What you see is what you pay. Oracle-verified pricing', icon: Shield },
  { title: '160+ Countries', desc: 'Buy from anywhere with local payment methods', icon: Globe },
]

export default function BuyPage() {
  const [activeTab, setActiveTab] = useState('buy')
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [showCurrencySelect, setShowCurrencySelect] = useState(false)
  const [kycStatus] = useState<'verified' | 'pending' | 'none'>('none')

  const selectedMethod = PAYMENT_METHODS.find(m => m.id === paymentMethod)
  const selectedCurrency = CURRENCIES.find(c => c.code === currency)
  const feePercent = selectedMethod?.id === 'bank' ? 0.005 : selectedMethod?.id === 'mobile' ? 0.015 : 0.025
  const protocolFee = 0.005 // 0.5% on-chain
  const totalFeePercent = feePercent + protocolFee
  const numAmount = parseFloat(amount || '0')
  const feeAmount = numAmount * totalFeePercent
  const receiveAmount = numAmount > 0 ? (numAmount - feeAmount).toFixed(2) : '0.00'

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <PageHeader
          title="Buy USDTZ"
          subtitle="Purchase USDTZ instantly with debit card, bank transfer, or mobile pay"
          status={{ label: 'On-Ramp Active', variant: 'success' }}
        />

        {/* Stats */}
        <AnimatedSection className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Purchased" value="$48.2M" icon={<DollarSign className="w-5 h-5" />} />
            <StatCard label="24h Volume" value="$2.1M" change="+18.5%" />
            <StatCard label="Total Buyers" value="12,458" change="+342" />
            <StatCard label="Avg. Completion" value="~2 min" icon={<Clock className="w-5 h-5" />} />
          </div>
        </AnimatedSection>

        <div className="mb-6">
          <Tabs
            tabs={[
              { id: 'buy', label: 'Buy USDTZ' },
              { id: 'history', label: 'Purchase History' },
              { id: 'kyc', label: 'Verification' },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Buy Tab */}
        {activeTab === 'buy' && (
          <AnimatedSection>
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Purchase Form — 3 cols */}
              <div className="lg:col-span-3">
                <Card variant="highlight" padding="lg">
                  <h2 className="text-xl font-bold mb-6">Purchase USDTZ</h2>

                  {/* KYC Banner */}
                  {kycStatus === 'none' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-6"
                    >
                      <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-400">Verification Required</p>
                        <p className="text-xs text-gray-400">Complete KYC to unlock purchases up to $50,000</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('kyc')}
                        className="text-sm font-medium text-yellow-400 hover:text-yellow-300 transition-colors"
                      >
                        Verify Now
                      </button>
                    </motion.div>
                  )}
                  {kycStatus === 'verified' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl mb-6"
                    >
                      <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                      <p className="text-sm font-medium text-green-400">Identity Verified — Purchases up to $50,000</p>
                    </motion.div>
                  )}

                  <div className="space-y-6">
                    {/* Payment Method Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-3">Payment Method</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {PAYMENT_METHODS.map((method) => (
                          <button
                            key={method.id}
                            onClick={() => setPaymentMethod(method.id)}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              paymentMethod === method.id
                                ? 'border-primary-500/50 bg-primary-500/10'
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <method.icon className={`w-5 h-5 mb-2 ${paymentMethod === method.id ? 'text-primary-400' : 'text-gray-400'}`} />
                            <p className="font-medium text-sm">{method.label}</p>
                            <p className="text-xs text-gray-500 mt-1">{method.desc}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              <span className="text-primary-400">{method.fee} fee</span>
                              <span className="text-gray-500">{method.time}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">You Pay</label>
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            min="10"
                            max="50000"
                            className="w-full bg-transparent text-3xl font-bold outline-none placeholder:text-gray-600"
                          />
                          <div className="relative">
                            <button
                              onClick={() => setShowCurrencySelect(!showCurrencySelect)}
                              className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl hover:bg-white/15 transition-colors shrink-0"
                            >
                              <span className="font-semibold">{currency}</span>
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            </button>
                            <AnimatePresence>
                              {showCurrencySelect && (
                                <motion.div
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 8 }}
                                  className="absolute right-0 top-full mt-2 w-48 py-2 glass-card border border-white/10 rounded-xl overflow-hidden z-20"
                                >
                                  {CURRENCIES.map((cur) => (
                                    <button
                                      key={cur.code}
                                      onClick={() => { setCurrency(cur.code); setShowCurrencySelect(false) }}
                                      className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors text-sm ${
                                        currency === cur.code ? 'text-primary-400' : 'text-white'
                                      }`}
                                    >
                                      <span>{cur.symbol} {cur.name}</span>
                                      {currency === cur.code && <CheckCircle className="w-4 h-4" />}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-sm">
                          <span className="text-gray-500">Min: {selectedCurrency?.symbol}10 — Max: {selectedCurrency?.symbol}50,000</span>
                          {numAmount > 0 && numAmount < 10 && (
                            <span className="text-red-400">Below minimum</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center -my-2">
                      <div className="w-10 h-10 rounded-xl bg-dark-300 border border-white/10 flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 rotate-90" />
                      </div>
                    </div>

                    {/* You Receive */}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">You Receive</label>
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <div className="flex items-center gap-4">
                          <p className="w-full text-3xl font-bold text-primary-400">
                            {numAmount > 0 ? parseFloat(receiveAmount).toLocaleString() : '0.00'}
                          </p>
                          <div className="flex items-center gap-2 px-4 py-2 bg-primary-500/10 border border-primary-500/20 rounded-xl shrink-0">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-orange-500 flex items-center justify-center text-xs font-bold text-dark-300">$</div>
                            <span className="font-semibold text-primary-400">USDTZ</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">Delivered to your connected wallet</p>
                      </div>
                    </div>

                    {/* Fee Breakdown */}
                    {numAmount > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-4 bg-white/5 rounded-xl space-y-2 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Payment Processing Fee ({(feePercent * 100).toFixed(1)}%)</span>
                          <span>{selectedCurrency?.symbol}{(numAmount * feePercent).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Protocol Fee (0.5%)</span>
                          <span>{selectedCurrency?.symbol}{(numAmount * protocolFee).toFixed(2)}</span>
                        </div>
                        <div className="border-t border-white/5 pt-2 flex items-center justify-between font-medium">
                          <span className="text-gray-400">Total Fees</span>
                          <span className="text-primary-400">{selectedCurrency?.symbol}{feeAmount.toFixed(2)} ({(totalFeePercent * 100).toFixed(1)}%)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Est. Time</span>
                          <span>{selectedMethod?.time}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Price Source</span>
                          <span className="text-primary-400">Chainlink Oracle</span>
                        </div>
                      </motion.div>
                    )}

                    {/* Buy Button */}
                    <Button
                      fullWidth
                      size="lg"
                      disabled={!amount || numAmount < 10 || numAmount > 50000 || kycStatus === 'none'}
                    >
                      {kycStatus === 'none' ? 'Complete Verification to Buy' :
                       !amount ? 'Enter Amount' :
                       numAmount < 10 ? 'Below Minimum ($10)' :
                       numAmount > 50000 ? 'Above Maximum ($50,000)' :
                       `Buy ${parseFloat(receiveAmount).toLocaleString()} USDTZ`}
                    </Button>

                    <p className="text-xs text-gray-500 text-center">
                      By purchasing, you agree to our terms. Prices powered by Chainlink oracles.
                    </p>
                  </div>
                </Card>
              </div>

              {/* Sidebar — 2 cols */}
              <div className="lg:col-span-2 space-y-4">
                {/* Why Buy */}
                <Card>
                  <h3 className="text-lg font-bold mb-4">Why Buy Here</h3>
                  <div className="space-y-3">
                    {WHY_BUY.map((item, i) => (
                      <motion.div
                        key={item.title}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-3 p-3 bg-white/5 rounded-xl"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
                          <item.icon className="w-4 h-4 text-primary-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-gray-500">{item.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Card>

                {/* Accepted Payments */}
                <Card className="border-primary-500/20 bg-primary-500/5">
                  <h3 className="text-lg font-bold mb-3">Accepted Payments</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {['Visa', 'Mastercard', 'Apple Pay', 'Google Pay', 'Bank Transfer', 'SEPA', 'ACH', 'Wire'].map((method) => (
                      <div key={method} className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg text-sm">
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-gray-300">{method}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Security */}
                <Card>
                  <div className="flex items-center gap-3 mb-3">
                    <Shield className="w-5 h-5 text-primary-400" />
                    <h3 className="text-lg font-bold">Secure Purchases</h3>
                  </div>
                  <div className="space-y-2 text-sm text-gray-400">
                    <p>All transactions are protected by bank-grade encryption and settled on-chain via smart contract.</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="success" size="sm">PCI DSS</Badge>
                      <Badge variant="success" size="sm">KYC/AML</Badge>
                      <Badge variant="success" size="sm">On-Chain</Badge>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <AnimatedSection>
            <Card>
              <h2 className="text-xl font-bold mb-4">Purchase History</h2>
              <div className="space-y-3">
                {RECENT_PURCHASES.map((purchase, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 bg-white/5 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-orange-400 flex items-center justify-center text-sm font-bold text-dark-300">$</div>
                      <div>
                        <p className="font-medium">${purchase.amount} {purchase.currency}</p>
                        <p className="text-sm text-gray-400">{purchase.usdtz} USDTZ via {purchase.method}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={purchase.status === 'Completed' ? 'success' : 'warning'}>
                        {purchase.status}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">{purchase.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </AnimatedSection>
        )}

        {/* KYC Tab */}
        {activeTab === 'kyc' && (
          <AnimatedSection>
            <div className="grid lg:grid-cols-2 gap-6">
              <Card variant="highlight" padding="lg">
                <h2 className="text-xl font-bold mb-2">Identity Verification</h2>
                <p className="text-gray-400 text-sm mb-6">Complete verification to unlock full purchase limits</p>

                <div className="space-y-4">
                  {/* Tier 1 */}
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-green-400">1</span>
                        </div>
                        <div>
                          <p className="font-medium">Email Verification</p>
                          <p className="text-xs text-gray-500">Basic access — up to $100/day</p>
                        </div>
                      </div>
                      <Badge variant="success">Required</Badge>
                    </div>
                    <Input placeholder="your@email.com" className="mt-3" />
                    <Button fullWidth className="mt-3" variant="secondary" size="sm">Send Verification</Button>
                  </div>

                  {/* Tier 2 */}
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-primary-400">2</span>
                        </div>
                        <div>
                          <p className="font-medium">Identity Document</p>
                          <p className="text-xs text-gray-500">Upload passport, driver's license, or national ID — up to $10,000/day</p>
                        </div>
                      </div>
                      <Badge variant="warning">Optional</Badge>
                    </div>
                    <Button fullWidth className="mt-3" variant="secondary" size="sm" disabled>Upload Document</Button>
                  </div>

                  {/* Tier 3 */}
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-secondary-500/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-secondary-400">3</span>
                        </div>
                        <div>
                          <p className="font-medium">Enhanced Verification</p>
                          <p className="text-xs text-gray-500">Proof of address + selfie — up to $50,000/day</p>
                        </div>
                      </div>
                      <Badge variant="info">Full Access</Badge>
                    </div>
                    <Button fullWidth className="mt-3" variant="secondary" size="sm" disabled>Complete Enhanced KYC</Button>
                  </div>
                </div>
              </Card>

              <div className="space-y-4">
                <Card>
                  <h3 className="text-lg font-bold mb-4">Purchase Limits</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <div>
                        <p className="font-medium text-sm">Unverified</p>
                        <p className="text-xs text-gray-500">No purchases allowed</p>
                      </div>
                      <span className="text-sm font-bold text-gray-500">$0/day</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <div>
                        <p className="font-medium text-sm">Tier 1 — Email</p>
                        <p className="text-xs text-gray-500">Card payments only</p>
                      </div>
                      <span className="text-sm font-bold">$100/day</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <div>
                        <p className="font-medium text-sm">Tier 2 — ID Verified</p>
                        <p className="text-xs text-gray-500">All payment methods</p>
                      </div>
                      <span className="text-sm font-bold text-primary-400">$10,000/day</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-500/5 rounded-xl border border-green-500/10">
                      <div>
                        <p className="font-medium text-sm text-green-400">Tier 3 — Full KYC</p>
                        <p className="text-xs text-gray-500">Maximum limits, priority processing</p>
                      </div>
                      <span className="text-sm font-bold text-green-400">$50,000/day</span>
                    </div>
                  </div>
                </Card>

                <Card className="border-primary-500/20 bg-primary-500/5">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-5 h-5 text-primary-400" />
                    <h3 className="font-semibold text-primary-400">Your Data is Safe</h3>
                  </div>
                  <p className="text-sm text-gray-400">
                    KYC data is encrypted end-to-end and processed by our certified compliance partner. We never store raw identity documents.
                  </p>
                </Card>
              </div>
            </div>
          </AnimatedSection>
        )}
      </div>
    </Layout>
  )
}
