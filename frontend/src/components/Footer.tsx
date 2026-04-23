'use client'

import { Globe, MessageCircle, BookOpen, Shield, ExternalLink, Code2, Send } from 'lucide-react'

const FOOTER_LINKS = {
  products: [
    { label: 'Swap', href: '/swap' },
    { label: 'Liquidity Pools', href: '/pool' },
    { label: 'Yield Farming', href: '/farm' },
    { label: 'Bridge', href: '/bridge' },
    { label: 'Vault', href: '/vault' },
  ],
  protocol: [
    { label: 'Statistics', href: '/stats' },
    { label: 'Prediction', href: '/prediction' },
    { label: 'Privacy Hub', href: '/privacy' },
    { label: 'Risk Dashboard', href: '/risk' },
  ],
  resources: [
    { label: 'Documentation', href: '#' },
    { label: 'GitHub', href: '#' },
    { label: 'Security Audit', href: '#' },
    { label: 'Bug Bounty', href: '#' },
    { label: 'Brand Kit', href: '#' },
  ],
  community: [
    { label: 'Twitter / X', href: '#', icon: Globe },
    { label: 'Telegram', href: '#', icon: Send },
    { label: 'Discord', href: '#', icon: MessageCircle },
    { label: 'Medium', href: '#', icon: BookOpen },
  ],
}

export default function Footer() {
  return (
    <footer className="relative mt-20">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-orange-500 flex items-center justify-center font-bold text-dark-300 text-lg">
                $
              </div>
              <span className="text-xl font-bold text-white">USDT.z</span>
            </a>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              Next-generation algorithmic stablecoin with industrial-grade stability mechanisms on BNB Chain.
            </p>
            <div className="flex items-center gap-3">
              {[Globe, Send, MessageCircle, Code2].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors group"
                >
                  <Icon className="w-4 h-4 text-gray-400 group-hover:text-primary-400 transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Products</h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.products.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Protocol */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Protocol</h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.protocol.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Resources</h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.resources.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors inline-flex items-center gap-1">
                    {link.label}
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Community</h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.community.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors inline-flex items-center gap-2">
                    {link.icon && <link.icon className="w-4 h-4" />}
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              &copy; 2026 USDTZ Protocol. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Terms</a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Privacy</a>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Shield className="w-3.5 h-3.5" />
                <span>Audited by CertiK</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
