import type { Metadata } from 'next'
import './globals.css'
import dynamic from 'next/dynamic'

const Web3Provider = dynamic(() => import('@/components/Web3Provider'), {
  ssr: false,
})

export const metadata: Metadata = {
  title: 'USDT.z - Next Generation Algorithmic Stablecoin on BNB Chain',
  description: 'USDT.z is an advanced algorithmic stablecoin with industrial-grade stability mechanisms, cross-chain bridging, yield farming, and privacy features built on BNB Chain.',
  keywords: ['USDTZ', 'stablecoin', 'DeFi', 'BNB Chain', 'yield farming', 'cross-chain bridge'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  )
}
