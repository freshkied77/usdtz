# USDTZ - Advanced Algorithmic Stablecoin on BNB Chain

## Overview

USDTZ is a next-generation algorithmic stablecoin built on BNB Chain with industrial-grade stability mechanisms, Chainlink oracle integration, private RPC infrastructure, complete DEX capabilities, cross-chain bridge with Zedx Chain, and **advanced zero-knowledge proof privacy system**.

## Architecture

### Core Components

#### 1. USDTZ Stablecoin (`contracts/USDTZChainlink.sol`)
- Advanced algorithmic stablecoin with Chainlink price feed
- 150%+ collateral ratio, 120% liquidation threshold
- 0.25% mint/redeem fees, dynamic rebase

#### 2. Privacy System (`contracts/PrivacyPool.sol`)
- **Privacy Pool**: ZK-SNARK deposits and withdrawals
- **Privacy Registry**: Multi-level privacy membership
- **Dark Pool**: Unmatchable orders for maximum privacy
- **Merkle Tree**: Cryptographic proof verification
- Four privacy levels: Basic (1x) → Maximum (50x)

#### 3. Cross-Chain Bridge (`contracts/CrossChainBridge.sol`, `ZedxBridge.sol`)
- Zedx Chain (primary), BNB, Ethereum, Polygon support
- 0.25% bridge fee with automatic liquidity allocation
- Liquidity vault with chain-specific reserves

#### 4. Liquidity Vault (`contracts/LiquidityVault.sol`)
- Chain-specific pools with smart allocation
- 60% bridge / 25% farm / 15% emergency split
- 24-hour automatic rebalancing, daily limits

### Privacy Features

#### Zero-Knowledge Proof Privacy
| Feature | Description |
|---------|-------------|
| **Privacy Pool** | Deposit into Merkle tree, withdraw to any address with ZK proof |
| **Anonymity Set** | Up to 50x multiplier - your transaction hidden among thousands |
| **Nullifier Hashes** | Prevent double-spending without revealing identity |
| **Merkle Tree Verification** | Cryptographic proof of deposit without disclosure |
| **Dark Pool** | Unmatchable orders for complete trading privacy |
| **Cross-Chain Privacy** | Privacy works across BNB, Zedx, Ethereum, Polygon |

#### Privacy Levels
| Level | Amount Range | Anonymity | Fee |
|-------|-------------|-----------|-----|
| Basic | 100 - 1,000 USDTZ | 1x | 0.25% |
| Standard | 1,000 - 10,000 USDTZ | 3x | 0.20% |
| Advanced | 10,000 - 100,000 USDTZ | 10x | 0.15% |
| Maximum | 100,000 - 1,000,000 USDTZ | 50x | 0.10% |

## Token Allocation

- **Total Supply**: 1,000,000,000 USDTZ
- **Liquidity Vault (50%)**: 500M for LP pairs
- **Bridge Reserves (5%)**: 50M for cross-chain
- **Privacy System**: Integrated, no separate allocation
- **Staking Rewards**: 25M USDTZ
- **Team/Treasury**: 37.5M USDTZ

## Deployment

### Quick Start
```bash
# Contracts
cd contracts && npm install && npx hardhat compile

# Deploy with Bridge + Privacy
npx hardhat run scripts/deploy-bridge.js --network bsc

# RPC Server
cd ../rpc && npm start

# Frontend
cd ../frontend && npm run dev
```

## Frontend Pages

- **/** - Landing page
- **/swap** - Token swap
- **/pool** - Liquidity pools
- **/farm** - Yield farming
- **/bridge** - Cross-chain transfers
- **/vault** - Liquidity vault
- **/privacy** - Zero-knowledge privacy hub
- **/stats** - Protocol statistics

## Privacy How It Works

```
1. User deposits USDTZ into Privacy Pool
   ↓
2. Commitment hash generated (secret + address)
   ↓
3. Deposit added to Merkle tree
   ↓
4. User joins anonymity set (1x - 50x based on level)
   ↓
5. To withdraw: generate ZK proof of ownership
   ↓
6. Proof verified on-chain, withdrawal executes
   ↓
7. NO on-chain link between deposit and withdraw
```

## Cross-Chain Support

| Chain | Status | Settlement | Privacy |
|-------|--------|------------|---------|
| BNB | ✅ Active | ~5 sec | ✅ |
| Zedx | ✅ Active | ~30 sec | ✅ |
| Ethereum | 🔜 Soon | TBD | ✅ |
| Polygon | 🔜 Soon | TBD | ✅ |

## Security Features

- Reentrancy guards on all contracts
- Chainlink decentralized oracle
- Multi-sig admin capability
- Emergency shutdown
- Time-locks on funds
- Daily withdrawal limits
- ZK proof verification

## Network

- **Chain ID**: 56 (BNB Smart Chain)
- **RPC**: Private endpoint recommended
- **Explorer**: https://bscscan.com

## License

MIT License