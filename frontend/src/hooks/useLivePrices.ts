'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchTokenPrices, buildTokenList, type TokenData } from '@/lib/api/coingecko'
import { useContractRead } from 'wagmi'
import { ABIS } from '@/lib/abis'
import { USDTZ_CONFIG } from '@/lib/config'

/**
 * Hook to fetch and manage live token prices from CoinGecko
 */
export function useLivePrices(tokenIds: string[]) {
  const [prices, setPrices] = useState<Record<string, { usd: number; usd_24h_change?: number }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPrices = useCallback(async () => {
    if (tokenIds.length === 0) return
    setLoading(true)
    try {
      const data = await fetchTokenPrices(tokenIds)
      setPrices(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prices')
    } finally {
      setLoading(false)
    }
  }, [tokenIds])

  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [fetchPrices])

  return { prices, loading, error, refresh: fetchPrices }
}

/**
 * Hook to fetch the complete token list from CoinGecko
 */
export function useTokenList() {
  const [tokens, setTokens] = useState<TokenData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTokens = useCallback(async () => {
    setLoading(true)
    try {
      const data = await buildTokenList()
      setTokens(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch token list')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTokens()
    const interval = setInterval(fetchTokens, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [fetchTokens])

  return { tokens, loading, error, refresh: fetchTokens }
}

/**
 * Hook to get live USDTZ price from Chainlink oracle
 */
export function useUSDTZLivePrice() {
  const { data: priceData, isLoading } = useContractRead({
    address: USDTZ_CONFIG.contracts.usdtz as `0x${string}`,
    abi: ABIS.USDTZChainlink,
    functionName: 'getMarketPrice',
    watch: true,
    enabled: true,
  })

  // Also fetch from CoinGecko as fallback
  const { prices: cgPrices } = useLivePrices(['usdtz'])

  const chainlinkPrice = priceData ? Number(priceData) / 1e8 : 1.0
  const coingeckoPrice = cgPrices['usdtz']?.usd || 1.0

  // Prefer Chainlink if available, fallback to CoinGecko
  const price = chainlinkPrice > 0 ? chainlinkPrice : coingeckoPrice

  return {
    price,
    chainlinkPrice,
    coingeckoPrice,
    loading: isLoading,
    source: chainlinkPrice > 0 ? 'chainlink' : 'coingecko',
  }
}

/**
 * Hook to get BNB live price
 */
export function useBNBPrice() {
  const { prices } = useLivePrices(['binancecoin'])
  return {
    price: prices['binancecoin']?.usd || 0,
    change24h: prices['binancecoin']?.usd_24h_change || 0,
  }
}

/**
 * Hook to get ETH live price
 */
export function useETHPrice() {
  const { prices } = useLivePrices(['ethereum'])
  return {
    price: prices['ethereum']?.usd || 0,
    change24h: prices['ethereum']?.usd_24h_change || 0,
  }
}

/**
 * Hook to get BTC live price
 */
export function useBTCPrice() {
  const { prices } = useLivePrices(['bitcoin'])
  return {
    price: prices['bitcoin']?.usd || 0,
    change24h: prices['bitcoin']?.usd_24h_change || 0,
  }
}
