/**
 * CoinGecko API Service
 * Fetches real-time token data, prices, and market data
 */

import { USDTZ_CONFIG } from '@/lib/config'

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3'

export interface CoinGeckoToken {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  total_volume: number
  price_change_percentage_24h: number
  circulating_supply: number
  total_supply: number
}

export interface TokenPrice {
  usd: number
  usd_24h_change?: number
}

export interface TokenData {
  address: string
  chainId: number
  symbol: string
  name: string
  decimals: number
  logoURI: string
  price: number
  priceChange24h: number
  marketCap: number
  volume24h: number
}

// BSC tokens mapped to CoinGecko IDs
export const BSC_TOKENS: Record<string, { coingeckoId: string; address: string; decimals: number }> = {
  USDT: { coingeckoId: 'tether', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  USDC: { coingeckoId: 'usd-coin', address: '0x8AC76a51cc950d9822D68d83eE1E1b8D43eC3b10', decimals: 18 },
  BUSD: { coingeckoId: 'binance-usd', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18 },
  BNB: { coingeckoId: 'binancecoin', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18 },
  ETH: { coingeckoId: 'ethereum', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18 },
  BTCB: { coingeckoId: 'bitcoin', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18 },
  CAKE: { coingeckoId: 'pancakeswap-token', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18 },
  AUTO: { coingeckoId: 'auto', address: '0xa184088a740c695e156f91f0753c44d103bf82e8', decimals: 18 },
  TWT: { coingeckoId: 'trust-wallet-token', address: '0x4B0F1812e5A2f2cd3EEB17fDBAb985b3e6a3D6E6', decimals: 18 },
  XVS: { coingeckoId: 'venus', address: '0xcF6BB5389c92Bd7828a7fA165021B0c8E9A2bD1D', decimals: 18 },
  AAVE: { coingeckoId: 'aave', address: '0xfb6115445Bff7b52FeB98650C87fdc2E51c75D44', decimals: 18 },
  LINK: { coingeckoId: 'chainlink', address: '0xF8a0BF9cF54e92EB0ACD6bbAa2B32D6d3e81bC3F', decimals: 18 },
  UNI: { coingeckoId: 'uniswap', address: '0xBf5140A22545168B77C2A7C1B43C6E2A3B9dAB8c', decimals: 18 },
  DOT: { coingeckoId: 'polkadot', address: '0x7083609fCE4d1d8Dc9701515325EC87e22c1F85', decimals: 18 },
  ADA: { coingeckoId: 'cardano', address: '0x3EE2200Efb3400fAbB9AacF312AbcbD20bE677B1', decimals: 18 },
  SOL: { coingeckoId: 'solana', address: '0x570A5D26f7765Ecb712C092108484aAE84A427B0', decimals: 18 },
  MATIC: { coingeckoId: 'matic-network', address: '0xCC42724C6683B7E57334c4E856f4c9965ED706dD', decimals: 18 },
}

/**
 * Fetch prices for multiple tokens by CoinGecko IDs
 */
export async function fetchTokenPrices(ids: string[]): Promise<Record<string, TokenPrice>> {
  try {
    const url = `${COINGECKO_BASE_URL}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to fetch prices')
    return await response.json()
  } catch (error) {
    console.error('Error fetching token prices:', error)
    return {}
  }
}

/**
 * Fetch top tokens by market cap
 */
export async function fetchTopTokens(limit = 50): Promise<CoinGeckoToken[]> {
  try {
    const url = `${COINGECKO_BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error('Failed to fetch top tokens')
    return await response.json()
  } catch (error) {
    console.error('Error fetching top tokens:', error)
    return []
  }
}

/**
 * Build token list from CoinGecko for BSC
 */
export async function buildTokenList(): Promise<TokenData[]> {
  const tokens: TokenData[] = []

  // Fetch prices for all BSC tokens
  const coingeckoIds = Object.values(BSC_TOKENS).map(t => t.coingeckoId)
  const prices = await fetchTokenPrices(coingeckoIds)

  // USDTZ — native project token (not on CoinGecko, pegged to $1)
  tokens.push({
    address: USDTZ_CONFIG.contracts.usdtz,
    chainId: 56,
    symbol: 'USDTZ',
    name: 'USDTZ Stablecoin',
    decimals: 18,
    logoURI: '/usdtz-logo.png',
    price: 1.0,
    priceChange24h: 0,
    marketCap: 0,
    volume24h: 0,
  })

  // Build token data for each BSC token
  for (const [symbol, token] of Object.entries(BSC_TOKENS)) {
    const priceData = prices[token.coingeckoId]
    tokens.push({
      address: token.address,
      chainId: 56,
      symbol,
      name: symbol === 'BNB' ? 'BNB' :
             symbol === 'ETH' ? 'Ethereum' :
             symbol === 'BTCB' ? 'Bitcoin BEP2' :
             symbol === 'USDT' ? 'Tether USD' :
             symbol === 'USDC' ? 'USD Coin' :
             symbol === 'BUSD' ? 'Binance USD' :
             symbol === 'CAKE' ? 'PancakeSwap' :
             symbol === 'AUTO' ? 'Auto' :
             symbol === 'TWT' ? 'Trust Wallet' :
             symbol === 'XVS' ? 'Venus' :
             symbol === 'AAVE' ? 'Aave' :
             symbol === 'LINK' ? 'Chainlink' :
             symbol === 'UNI' ? 'Uniswap' :
             symbol === 'DOT' ? 'Polkadot' :
             symbol === 'ADA' ? 'Cardano' :
             symbol === 'SOL' ? 'Solana' :
             symbol === 'MATIC' ? 'Polygon' : symbol,
      decimals: token.decimals,
      logoURI: `https://assets.coingecko.com/coins/images/${token.coingeckoId}/small.png`,
      price: priceData?.usd || 0,
      priceChange24h: priceData?.usd_24h_change || 0,
      marketCap: 0,
      volume24h: 0,
    })
  }

  return tokens
}

/**
 * Get live price for a specific token
 */
export async function getLivePrice(coingeckoId: string): Promise<{ price: number; change24h: number }> {
  try {
    const prices = await fetchTokenPrices([coingeckoId])
    const data = prices[coingeckoId]
    return {
      price: data?.usd || 0,
      change24h: data?.usd_24h_change || 0,
    }
  } catch (error) {
    console.error('Error fetching live price:', error)
    return { price: 0, change24h: 0 }
  }
}
