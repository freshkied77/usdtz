'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ChevronDown, ArrowRightLeft, Sprout, Landmark, BarChart3, Eye, ShieldAlert, BrainCircuit, Layers, CreditCard, Trophy, Activity } from 'lucide-react'
import ConnectButton from './ConnectButton'
import { cn } from '@/lib/utils'

const NAV_GROUPS = [
  {
    label: 'Trade',
    items: [
      { href: '/swap', label: 'Swap', icon: ArrowRightLeft, desc: 'Exchange tokens instantly' },
      { href: '/buy', label: 'Buy USDTZ', icon: CreditCard, desc: 'Buy with card or bank' },
    ],
  },
  {
    label: 'Earn',
    items: [
      { href: '/pool', label: 'Pools', icon: Layers, desc: 'Provide liquidity' },
      { href: '/farm', label: 'Farm', icon: Sprout, desc: 'Stake LP tokens' },
      { href: '/vault', label: 'Vault', icon: Landmark, desc: 'Liquidity reserves' },
    ],
  },
  {
    label: 'Bridge',
    href: '/bridge',
  },
  {
    label: 'More',
    items: [
      { href: '/stats', label: 'Statistics', icon: BarChart3, desc: 'Protocol analytics' },
      { href: '/price', label: 'Peg Monitor', icon: Activity, desc: 'Price & peg stability' },
      { href: '/community', label: 'Community', icon: Trophy, desc: 'Leaderboard & rewards' },
      { href: '/prediction', label: 'Prediction', icon: BrainCircuit, desc: 'Trade on events' },
      { href: '/privacy', label: 'Privacy', icon: Eye, desc: 'ZK transfers' },
      { href: '/risk', label: 'Risk', icon: ShieldAlert, desc: 'AI risk analysis' },
    ],
  },
]

const ALL_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/swap', label: 'Swap' },
  { href: '/buy', label: 'Buy USDTZ' },
  { href: '/pool', label: 'Pools' },
  { href: '/farm', label: 'Farm' },
  { href: '/vault', label: 'Vault' },
  { href: '/bridge', label: 'Bridge' },
  { href: '/stats', label: 'Statistics' },
  { href: '/price', label: 'Peg Monitor' },
  { href: '/community', label: 'Community' },
  { href: '/prediction', label: 'Prediction' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/risk', label: 'Risk' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setOpenDropdown(null)
  }, [pathname])

  return (
    <>
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-dark-400/80 backdrop-blur-xl border-b border-white/5 shadow-lg shadow-black/20'
            : 'bg-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-orange-500 flex items-center justify-center font-bold text-dark-300 text-base group-hover:shadow-lg group-hover:shadow-primary-500/20 transition-shadow">
                $
              </div>
              <span className="text-lg font-bold text-white">USDT.z</span>
            </a>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-1">
              <a
                href="/"
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === '/' ? 'text-primary-400' : 'text-gray-300 hover:text-white hover:bg-white/5'
                )}
              >
                Home
              </a>

              {NAV_GROUPS.map((group) => (
                <div
                  key={group.label}
                  className="relative"
                  onMouseEnter={() => group.items && setOpenDropdown(group.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  {group.href ? (
                    <a
                      href={group.href}
                      className={cn(
                        'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        pathname === group.href ? 'text-primary-400' : 'text-gray-300 hover:text-white hover:bg-white/5'
                      )}
                    >
                      {group.label}
                    </a>
                  ) : (
                    <button
                      className={cn(
                        'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        group.items?.some(i => i.href === pathname) ? 'text-primary-400' : 'text-gray-300 hover:text-white hover:bg-white/5'
                      )}
                    >
                      {group.label}
                      <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', openDropdown === group.label && 'rotate-180')} />
                    </button>
                  )}

                  {/* Dropdown */}
                  <AnimatePresence>
                    {group.items && openDropdown === group.label && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-1 w-56 py-2 glass-card border border-white/10 rounded-xl overflow-hidden"
                      >
                        {group.items.map((item) => (
                          <a
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors',
                              pathname === item.href && 'bg-white/5'
                            )}
                          >
                            <item.icon className={cn('w-4 h-4', pathname === item.href ? 'text-primary-400' : 'text-gray-400')} />
                            <div>
                              <p className={cn('text-sm font-medium', pathname === item.href ? 'text-primary-400' : 'text-white')}>
                                {item.label}
                              </p>
                              <p className="text-xs text-gray-500">{item.desc}</p>
                            </div>
                          </a>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:block">
                <ConnectButton />
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="fixed top-0 right-0 bottom-0 w-[280px] bg-dark-300 border-l border-white/10 z-50 lg:hidden overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <span className="text-lg font-bold">Menu</span>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-1 mb-8">
                  {ALL_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className={cn(
                        'block px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                        pathname === link.href
                          ? 'bg-primary-500/10 text-primary-400'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>

                <div className="pt-6 border-t border-white/10">
                  <ConnectButton />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Spacer for fixed navbar */}
      <div className="h-16" />
    </>
  )
}
