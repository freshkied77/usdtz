# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

USDTZ is an algorithmic stablecoin on BNB Chain (Chain ID 56) with ZK-SNARK privacy, cross-chain bridging to Zedx Chain, and a liquidity vault system. The repository is a monorepo with three main components.

## Repository Structure

```
contracts/       Hardhat project — Solidity smart contracts
frontend/        Next.js 14 App Router — React frontend
rpc/             Express RPC server — private node infrastructure
scripts/          Deployment and bot scripts
```

## Commands

### Contracts
```bash
cd contracts
npm install
npx hardhat compile              # Compile all contracts
npx hardhat test                 # Run tests (test/ is currently empty)
npx hardhat run scripts/deploy.js --network bsc          # Deploy to mainnet
npx hardhat run scripts/deploy.js --network bscTestnet   # Deploy to testnet
npx hardhat run scripts/deploy-bridge.js --network bsc    # Deploy with bridge + privacy
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # Development server on localhost:3000
npm run build    # Production build
npm run lint     # Lint with Next.js
```

### RPC Server
```bash
cd rpc
npm install
npm start        # Start production server
npm run dev      # Start with nodemon (auto-reload)
```

## Smart Contract Architecture

**Core Protocol Contracts** (`contracts/contracts/`):
- `USDTZChainlink.sol` — Algorithmic stablecoin with Chainlink oracle, 150%+ collateral ratio, 0.25% mint/redeem fees
- `USDTZStablecoin.sol` — Base stablecoin implementation
- `LiquidityVault.sol` — Chain-specific pool reserves, 60/25/15 bridge/farm/emergency split
- `LiquidityManager.sol` — LP pair management
- `LiquidityMining.sol` — Yield farming rewards
- `StabilizationFund.sol` — Protocol stability reserves
- `PoolManager.sol` — Pool creation and management
- `CrossChainBridge.sol` — BNB/Zedx cross-chain bridge with 0.25% fee
- `ReferralSystem.sol` — Referral tracking and rewards

**Privacy System**:
- `PrivacyPool.sol` — ZK-SNARK deposits/withdrawals, 4 privacy levels (1x-50x anonymity)
- `MerkleTree.sol` — Cryptographic proof verification for privacy deposits
- Privacy levels: Basic (100-1K, 0.25%), Standard (1K-10K, 0.20%), Advanced (10K-100K, 0.15%), Maximum (100K-1M, 0.10%)

**Other**:
- `FiatOnRamp.sol` — Fiat entrance
- `PredictionMarket.sol` — Prediction markets

**Configuration**: `contracts/hardhat.config.cjs` — Solidity 0.8.17, optimizer (200 runs), BSC mainnet/testnet/localhost networks.

## Frontend Architecture

**Framework**: Next.js 14 App Router, TypeScript, Tailwind CSS, RainbowKit + wagmi + viem for web3.

**Routes** (`frontend/src/app/`): `/` (landing), `/swap`, `/pool`, `/farm`, `/bridge`, `/vault`, `/privacy`, `/stats`, `/risk`, `/prediction`, `/price`, `/community`, `/buy`

**Stack**: `@rainbow-me/rainbowkit`, `@tanstack/react-query`, `framer-motion`, `lucide-react`

## RPC Server Architecture

Express server with Redis caching, rate limiting, JWT auth, and helmet security. Provides private BNB Chain RPC access with `routes/` for different endpoint handlers.

## Deployment

Deployment addresses are stored in `deployment-addresses.env`. Key deployment scripts:
- `scripts/deploy-bridge.js` — Deploys full stack with bridge and privacy
- `scripts/deploy-full.js` — Full protocol deployment
- `scripts/buy-wall.js` — Liquidity bot
- `scripts/peg-arbitrage-bot.js` — Peg stabilization bot
- `scripts/volume-generator.js` — Volume generation

## Key Environment Variables

**Contracts** (`contracts/.env`): `PRIVATE_KEY`, `BSC_RPC_URL`, `BSCSCAN_API_KEY`
**Frontend** (`frontend/.env.local`): `NEXT_PUBLIC_*` for public vars
**RPC** (`rpc/.env`): `PORT`, Redis config, JWT secret, RPC URLs
