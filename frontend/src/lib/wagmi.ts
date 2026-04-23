'use client';

import { getDefaultWallets } from '@rainbow-me/rainbowkit';
import { configureChains, createConfig } from 'wagmi';
import { bsc, bscTestnet } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';

const ZEDXION_CHAIN = {
  id: 9000,
  name: 'Zedxion',
  network: 'zedxion',
  nativeCurrency: {
    decimals: 18,
    name: 'ZEDX',
    symbol: 'ZEDX',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.zedxion.xyz'],
    },
    public: {
      http: ['https://rpc.zedxion.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ZedxionExplorer',
      url: 'https://explorer.zedxion.xyz',
    },
  },
 contracts: {
    multicall3: {
      address: '0xca4934bFlate3d1cD1FcD1FcD1FcD1FcD1FcD1FcD' as `0x${string}`,
      blockCreated: 1,
    },
  },
}

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [bsc, bscTestnet, ZEDXION_CHAIN],
  [
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id === 56) {
          return {
            http: process.env.NEXT_PUBLIC_PRIVATE_RPC_URL || 'https://bsc-dataseed.binance.org',
          };
        }
        if (chain.id === 9000) {
          return {
            http: process.env.NEXT_PUBLIC_ZEDXION_RPC || 'https://rpc.zedxion.xyz',
          };
        }
        return {
          http: 'https://data-seed-prebsc-1-s1.binance.org:8545',
        };
      },
    }),
    publicProvider(),
  ]
);

const { connectors } = getDefaultWallets({
  appName: 'USDT.z',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || 'usdtz-default',
  chains,
});

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
});

export { chains, wagmiConfig, ZEDXION_CHAIN };