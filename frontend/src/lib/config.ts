/**
 * USDT.Z Configuration
 * Live onchain data with CoinGecko integration
 */

export const CHAIN_CONFIG = {
  bsc: {
    id: 56,
    name: 'BNB Smart Chain',
    rpc: 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    icon: 'BNB',
    coinGeckoId: 'binance-smart-chain',
  },
  zedxion: {
    id: 9000,
    name: 'Zedxion Chain',
    rpc: process.env.NEXT_PUBLIC_ZEDXION_RPC || 'https://rpc.zedxion.xyz',
    explorer: 'https://explorer.zedxion.xyz',
    icon: 'ZEDX',
    coinGeckoId: null,
  },
  ethereum: {
    id: 1,
    name: 'Ethereum',
    rpc: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    icon: 'ETH',
    coinGeckoId: 'ethereum',
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    rpc: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    icon: 'MATIC',
    coinGeckoId: 'polygon-pos',
  }
}

export const USDTZ_CONFIG = {
  chainId: 56,
  chainName: 'BNB Smart Chain',
  
  rpc: {
    private: {
      url: process.env.NEXT_PUBLIC_PRIVATE_RPC_URL || 'http://localhost:3001',
      authEndpoint: '/api/v1/auth',
      callEndpoint: '/api/v1/call',
      sendEndpoint: '/api/v1/send',
      healthEndpoint: '/api/v1/health',
    },
    public: {
      url: 'https://bsc-dataseed.binance.org',
      fallback: 'https://bsc.nodereal.io',
    },
    enabled: process.env.NEXT_PUBLIC_USE_PRIVATE_RPC || true,
  },
  
  oracles: {
    chainlink: {
      bnbUsd: '0x0567F2324251f7Bb9aF2aE3D0cF8881Fb6D7F247',
      usdtUsd: '0x3f822E07D7D4344091cB158B1C50E8F3BAfD9cD6',
    },
    fallbackEnabled: true,
    staleThreshold: 3600,
  },
  
  contracts: {
    usdtz: process.env.NEXT_PUBLIC_USDTZ_CONTRACT || '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665',
    poolManager: process.env.NEXT_PUBLIC_POOL_MANAGER || '0x3c91AF7Cf1f5c44d32A6fF9222a3Ed72845d8E86',
    liquidityManager: process.env.NEXT_PUBLIC_LIQUIDITY_MANAGER || '0x6C5212B7D40154ee367f49Dc05d5C7659a544800',
    factory: process.env.NEXT_PUBLIC_FACTORY || '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    router: process.env.NEXT_PUBLIC_ROUTER || '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    predictionMarket: process.env.NEXT_PUBLIC_PREDICTION_MARKET || '0x7991e75bc6505F3035335a069050d9ccB0a23555',
    stabilizationFund: process.env.NEXT_PUBLIC_STABILIZATION_FUND || '0x23b8450530Be2A3f19Ae2FDD26cA3491C4De192D',
    liquidityMining: process.env.NEXT_PUBLIC_LIQUIDITY_MINING || '0xD78096854c994741D188B53d3a5C6ef2a877bb1d',
    referralSystem: process.env.NEXT_PUBLIC_REFERRAL_SYSTEM || '0x2418D1DaC19fF54A343b605eaA247A4093d4aab2',
    fiatOnRamp: process.env.NEXT_PUBLIC_FIAT_ON_RAMP || '0x21b37aA4349EAC49dF2985248a2E4DC2faE5c44a',
    crossChainBridge: process.env.NEXT_PUBLIC_BRIDGE || '0x54C68aB92134167A42d8fF5e46bB1a566fF89BAb',
    liquidityVault: process.env.NEXT_PUBLIC_LIQUIDITY_VAULT || '0xdfbe58825699E42D786EBf9B7Ba8F6ab03C1C759',
    privacyPool: process.env.NEXT_PUBLIC_PRIVACY_POOL || '0xEC41C164E8ED73a915F3282AF6D6E0A8fbEE18e9',
    privacyRegistry: process.env.NEXT_PUBLIC_PRIVACY_REGISTRY || '0x24348f52f4b981869aDdF9A41f08d5c4dAb72873',
    merkleTree: process.env.NEXT_PUBLIC_MERKLE_TREE || '0xA1097381949cAC9513f8FeFBda905364E0281D46',
    usdtzBnbPair: process.env.NEXT_PUBLIC_USDTZ_BNB_PAIR || '0xbAe7EAF2078f053857b472c2cAE4F63D0086b89F',
  },
  
  tokens: {
    wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    usdt: '0x55d398326f99059fF775485246999027B3197955',
    busd: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    eth: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    btc: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  },
  
  fees: {
    mint: 0.25,
    redeem: 0.25,
    swap: 0.25,
    protocol: 0.1,
  },
  
  limits: {
    minCollateralRatio: 150,
    liquidationThreshold: 120,
    maxTxGas: 6721900,
    gasMargin: 200000,
  },
  
  ui: {
    defaultSlippage: 0.5,
    maxSlippage: 50,
    txDeadline: 20,
    refreshInterval: 30000,
  },
}

export const COINGECKO_CONFIG = {
  baseUrl: 'https://api.coingecko.com/api/v3',
  refreshInterval: 30000,
  maxRetries: 3,
}

// CoinGecko IDs for tokens on BSC
export const COINGECKO_TOKEN_IDS = {
  USDT: 'tether',
  USDC: 'usd-coin',
  BUSD: 'binance-usd',
  BNB: 'binancecoin',
  ETH: 'ethereum',
  BTCB: 'bitcoin',
  CAKE: 'pancakeswap-token',
  AUTO: 'auto',
  TWT: 'trust-wallet-token',
  XVS: 'venus',
  AAVE: 'aave',
  LINK: 'chainlink',
  UNI: 'uniswap',
  DOT: 'polkadot',
  ADA: 'cardano',
  SOL: 'solana',
  MATIC: 'matic-network',
} as const

export type CoinGeckoTokenId = typeof COINGECKO_TOKEN_IDS[keyof typeof COINGECKO_TOKEN_IDS]
