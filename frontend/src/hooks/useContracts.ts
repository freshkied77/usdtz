'use client';

import { useContractRead, useContractWrite, usePrepareContractWrite, useAccount, useBalance } from 'wagmi';
import { ABIS } from '@/lib/abis';
import { USDTZ_CONFIG } from '@/lib/config';
import { parseEther, formatEther } from 'viem';

const contracts = USDTZ_CONFIG.contracts;

// ---------- USDTZ Core ----------
export function useUSDTZPrice() {
  return useContractRead({
    address: contracts.usdtz as `0x${string}`,
    abi: ABIS.USDTZChainlink,
    functionName: 'getMarketPrice',
    watch: true,
  });
}

export function useUSDTZRebaseInfo() {
  return useContractRead({
    address: contracts.usdtz as `0x${string}`,
    abi: ABIS.USDTZChainlink,
    functionName: 'getRebaseInfo',
    watch: true,
  });
}

export function useUSDTZPosition(userAddress?: string) {
  return useContractRead({
    address: contracts.usdtz as `0x${string}`,
    abi: ABIS.USDTZChainlink,
    functionName: 'getPositionInfo',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    enabled: !!userAddress,
  });
}

export function useUSDTZBalance() {
  const { address } = useAccount();
  return useBalance({
    address,
    token: contracts.usdtz as `0x${string}`,
    watch: true,
  });
}

export function useMintCollateralized(amount: string, tokenAddress: string) {
  const { config } = usePrepareContractWrite({
    address: contracts.usdtz as `0x${string}`,
    abi: ABIS.USDTZChainlink,
    functionName: 'mintCollateralized',
    args: [parseEther(amount || '0'), tokenAddress as `0x${string}`, BigInt(0)],
    enabled: !!amount && parseFloat(amount) > 0,
  });
  return useContractWrite(config);
}

export function useRedeemCollateralized(amount: string, tokenAddress: string) {
  const { config } = usePrepareContractWrite({
    address: contracts.usdtz as `0x${string}`,
    abi: ABIS.USDTZChainlink,
    functionName: 'redeemCollateralized',
    args: [parseEther(amount || '0'), tokenAddress as `0x${string}`, BigInt(0)],
    enabled: !!amount && parseFloat(amount) > 0,
  });
  return useContractWrite(config);
}

// ---------- Pool Manager ----------
export function usePoolInfo(token: string) {
  return useContractRead({
    address: contracts.poolManager as `0x${string}`,
    abi: ABIS.PoolManager,
    functionName: 'getPoolInfo',
    args: [token as `0x${string}`],
    enabled: !!token,
  });
}

export function useCollateralRatio() {
  return useContractRead({
    address: contracts.poolManager as `0x${string}`,
    abi: ABIS.PoolManager,
    functionName: 'getCollateralRatio',
    watch: true,
  });
}

export function useTotalTVL() {
  return useContractRead({
    address: contracts.poolManager as `0x${string}`,
    abi: ABIS.PoolManager,
    functionName: 'totalTVL',
    watch: true,
  });
}

// ---------- Stabilization Fund ----------
export function usePegStatus() {
  return useContractRead({
    address: contracts.stabilizationFund as `0x${string}`,
    abi: ABIS.StabilizationFund,
    functionName: 'checkPegStatus',
    watch: true,
  });
}

export function useStabilizationStats() {
  return useContractRead({
    address: contracts.stabilizationFund as `0x${string}`,
    abi: ABIS.StabilizationFund,
    functionName: 'getStats',
    watch: true,
  });
}

// ---------- Cross-Chain Bridge ----------
export function useBridgeChainConfig(chainId: number) {
  return useContractRead({
    address: contracts.usdtz as `0x${string}`, // Bridge address needed
    abi: ABIS.CrossChainBridge,
    functionName: 'getChainConfig',
    args: [BigInt(chainId)],
    enabled: !!chainId,
  });
}

// ---------- Prediction Market ----------
export function useMarketInfo(marketId: number) {
  return useContractRead({
    address: contracts.predictionMarket as `0x${string}`,
    abi: ABIS.PredictionMarket,
    functionName: 'getMarketInfo',
    args: [BigInt(marketId)],
    enabled: marketId >= 0,
  });
}

export function usePlaceBet(marketId: number, isYes: boolean, amount: string) {
  const { config } = usePrepareContractWrite({
    address: contracts.predictionMarket as `0x${string}`,
    abi: ABIS.PredictionMarket,
    functionName: 'placeBet',
    args: [BigInt(marketId), isYes, parseEther(amount || '0')],
    enabled: !!amount && parseFloat(amount) > 0,
  });
  return useContractWrite(config);
}

// ---------- Liquidity Mining ----------
export function useLiquidityMiningPool(poolToken: string) {
  return useContractRead({
    address: contracts.liquidityMining as `0x${string}`,
    abi: ABIS.LiquidityMining,
    functionName: 'pools',
    args: [poolToken as `0x${string}`],
    enabled: !!poolToken,
  });
}

// ---------- Privacy Pool ----------
export function usePrivacyAnonymitySet() {
  return useContractRead({
    address: contracts.usdtz as `0x${string}`, // Privacy pool address needed
    abi: ABIS.PrivacyPool,
    functionName: 'getAnonymitySet',
    watch: true,
  });
}

// ---------- Fiat On-Ramp ----------
export function useFiatOnRampStats() {
  return useContractRead({
    address: contracts.fiatOnRamp as `0x${string}`,
    abi: ABIS.FiatOnRamp,
    functionName: 'getStats',
    watch: true,
  });
}

export function useUserPurchaseStats(userAddress?: string) {
  return useContractRead({
    address: contracts.fiatOnRamp as `0x${string}`,
    abi: ABIS.FiatOnRamp,
    functionName: 'getUserStats',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    enabled: !!userAddress,
  });
}

export function useKYCStatus(userAddress?: string) {
  return useContractRead({
    address: contracts.fiatOnRamp as `0x${string}`,
    abi: ABIS.FiatOnRamp,
    functionName: 'kycVerified',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    enabled: !!userAddress,
  });
}

export function usePurchaseUSDTZ(usdAmount: string, partner?: string) {
  const { config } = usePrepareContractWrite({
    address: contracts.fiatOnRamp as `0x${string}`,
    abi: ABIS.FiatOnRamp,
    functionName: 'purchaseUSDTZ',
    args: [parseEther(usdAmount || '0'), (partner || '0x0000000000000000000000000000000000000000') as `0x${string}`],
    enabled: !!usdAmount && parseFloat(usdAmount) >= 10,
  });
  return useContractWrite(config);
}

// ---------- Utility ----------
export function useUserAccount() {
  return useAccount();
}
