export const CHAIN_CONFIG = {
  bsc: {
    id: 56,
    name: 'BNB Smart Chain',
    rpc: 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
    icon: 'BNB'
  },
  zedxion: {
    id: 9000,
    name: 'Zedxion Chain',
    rpc: process.env.NEXT_PUBLIC_ZEDXION_RPC || 'https://rpc.zedxion.xyz',
    explorer: 'https://explorer.zedxion.xyz',
    icon: 'ZEDX'
  },
  ethereum: {
    id: 1,
    name: 'Ethereum',
    rpc: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    icon: 'ETH'
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    rpc: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    icon: 'MATIC'
  }
}

export const CROSS_CHAIN_PAIRS = {
  zedxion: [
    { from: 'USDTZ', to: 'USDT', type: 'one-sided', pool: '0x...', apr: '8.5' },
    { from: 'USDTZ', to: 'BNB', type: 'one-sided', pool: '0x...', apr: '12.3' },
    { from: 'USDTZ', to: 'ETH', type: 'one-sided', pool: '0x...', apr: '10.2' },
    { from: 'USDTZ', to: 'ZEDX', type: 'one-sided', pool: '0x...', apr: '15.7' },
    { from: 'ZEDX', to: 'USDT', type: 'one-sided', pool: '0x...', apr: '9.1' },
    { from: 'ZEDX', to: 'BNB', type: 'one-sided', pool: '0x...', apr: '11.4' }
  ]
}

export const ZEDXION_TOKENS = [
  { symbol: 'USDTZ', address: '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665', decimals: 18, name: 'USDTZ Stablecoin', logo: 'inline' },
  { symbol: 'ZEDX', address: '0x0000000000000000000000000000000000000001', decimals: 18, name: 'Zedxion', logo: 'inline' },
  { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, name: 'Tether USD', logo: 'usdt' },
  { symbol: 'BNB', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18, name: 'BNB', logo: 'bnb' },
  { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, name: 'Ethereum', logo: 'eth' },
  { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18, name: 'Bitcoin', logo: 'btc' }
]

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
    usdtz: process.env.NEXT_PUBLIC_USDTZ_CONTRACT || '0x...',
    poolManager: process.env.NEXT_PUBLIC_POOL_MANAGER || '0x...',
    liquidityManager: process.env.NEXT_PUBLIC_LIQUIDITY_MANAGER || '0x...',
    factory: process.env.NEXT_PUBLIC_FACTORY || '0x...',
    router: process.env.NEXT_PUBLIC_ROUTER || '0x...',
    predictionMarket: process.env.NEXT_PUBLIC_PREDICTION_MARKET || '0x...',
    stabilizationFund: process.env.NEXT_PUBLIC_STABILIZATION_FUND || '0x...',
    liquidityMining: process.env.NEXT_PUBLIC_LIQUIDITY_MINING || '0x...',
    referralSystem: process.env.NEXT_PUBLIC_REFERRAL_SYSTEM || '0x...',
    fiatOnRamp: process.env.NEXT_PUBLIC_FIAT_ON_RAMP || '0x...',
  },
  
  tokens: {
    wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    usdt: '0x55d398326f99059fF775485246999027B3197955',
    busd: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    eth: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    btc: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  },
  
  topTokens: [
    { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, allocation: 8 },
    { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, allocation: 8 },
    { symbol: 'BNB', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18, allocation: 10 },
    { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18, allocation: 6 },
    { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, allocation: 6 },
    { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68d83eE1E1b8D43eC3b10', decimals: 18, allocation: 5 },
    { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, allocation: 4 },
    { symbol: 'AUTO', address: '0xa184088a740c695e156f91f0753c44d103bf82e8', decimals: 18, allocation: 3 },
    { symbol: 'TWT', address: '0x4B0F1812e5A2f2cd3EEB17fDBAb985b3e6a3D6E6', decimals: 18, allocation: 3 },
    { symbol: 'XVS', address: '0xcF6BB5389c92Bd7828a7fA165021B0c8E9A2bD1D', decimals: 18, allocation: 3 },
    { symbol: 'AAVE', address: '0xfb6115445Bff7b52FeB98650C87fdc2E51c75D44', decimals: 18, allocation: 2 },
    { symbol: 'LINK', address: '0xF8a0BF9cF54e92EB0ACD6bbAa2B32D6d3e81bC3F', decimals: 18, allocation: 2 },
    { symbol: 'UNI', address: '0xBf5140A22545168B77C2A7C1B43C6E2A3B9dAB8c', decimals: 18, allocation: 2 },
    { symbol: 'DOT', address: '0x7083609fCE4d1d8Dc9701515325EC87e22c1F85', decimals: 18, allocation: 2 },
    { symbol: 'ADA', address: '0x3EE2200Efb3400fAbB9AacF312AbcbD20bE677B1', decimals: 18, allocation: 2 },
    { symbol: 'SOL', address: '0x570A5D26f7765Ecb712C092108484aAE84A427B0', decimals: 18, allocation: 2 },
    { symbol: 'MATIC', address: '0xCC42724C6683B7E57334c4E856f4c9965ED706dD', decimals: 18, allocation: 2 },
  ],
  
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

export const CHAINLINK_NETWORK_CONFIGS = {
  56: {
    name: ' BSC Mainnet',
    linkToken: '0x404460C6A6d1D84087513C1c06030C639E9dF7b8',
    linkEthFeed: '0x0567F2324251f7Bb9aF2aE3D0cF8881Fb6D7F247',
    fastGasFeed: '0x169E633A2D1E6c10dB1110606556F0F8E3b7De68',
  },
  97: {
    name: 'BSC Testnet',
    linkToken: '0x84b9B910527C5e1dD09813DDEcE47B9F8D60925E',
    linkEthFeed: '0x143db3CEa0a31c22302C6aB4C1f2CeCbA1d9A75d',
    fastGasFeed: '0x1FC2E8C8bC57D6C6d0A9E9C0b9dC9E8dF6f8A7A',
  },
}

export const PRIVATE_RPC_ENDPOINTS = {
  auth: '/api/v1/auth',
  call: '/api/v1/call',
  send: '/api/v1/send',
  balance: '/api/v1/balance',
  block: '/api/v1/block',
  receipt: '/api/v1/receipt',
  health: '/api/v1/health',
  gasPrice: '/api/v1/gas-price',
}