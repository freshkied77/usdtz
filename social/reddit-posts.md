# Reddit Launch Posts

## Post 1: r/CryptoCurrency

**Title:** We built a privacy-enabled stablecoin with 13 smart contracts on BNB Chain — all verified on BscScan

**Body:**
```
Hey r/CryptoCurrency,

We just launched USDTZ, and instead of writing a whitepaper and asking for investment, we built the entire thing first. All 13 smart contracts are deployed and verified on BscScan. You can read every line of code right now.

**What is USDTZ?**

A $1 USD-pegged stablecoin on BNB Chain, but with features no other stablecoin offers:

- **ZK-SNARK Privacy Pools** — Private transfers using zero-knowledge proofs. Deposit USDTZ, generate a proof, withdraw to any address with zero on-chain link.
- **Chainlink Oracle Integration** — BNB/USD and USDT/USD price feeds for accurate peg maintenance
- **Algorithmic Supply Management** — Automated rebase + Stabilization Fund for peg defense
- **Cross-Chain Bridge** — Native bridge (not relying on third parties)
- **Prediction Markets** — Binary outcome betting settled in USDTZ
- **Liquidity Mining** — LP staking with referral commissions
- **Fiat On-Ramp** — Buy with debit card or bank transfer

**Why another stablecoin?**

Every stablecoin transaction is public. USDTZ is the first BNB Chain stablecoin where you can transact privately. The privacy pools use the same ZK-SNARK technology that powers Zcash.

**Verified contracts:**
- Token: https://bscscan.com/token/0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665
- All 13 contracts verified and readable on BscScan

**Frontend (live):** https://frontend-green-lab-tech.vercel.app

We're not asking you to trust us. We're asking you to verify the code. Happy to answer any questions about the architecture.
```

---

## Post 2: r/defi

**Title:** Built a complete DeFi protocol on BNB Chain from scratch — 13 contracts, privacy pools, prediction markets, bridge. Feedback welcome.

**Body:**
```
Looking for honest feedback from the DeFi community on what we've built.

**USDTZ** is an algorithmic stablecoin with a full DeFi ecosystem:

**Smart Contracts (13, all verified):**
1. Core stablecoin token with rebase
2. Pool Manager (algorithmic supply)
3. Stabilization Fund (peg defense)
4. Liquidity Manager
5. Liquidity Vault
6. Cross-Chain Bridge
7. ZK Privacy Pool
8. Privacy Registry
9. Merkle Tree (ZK verification)
10. Liquidity Mining
11. Prediction Market
12. Referral System
13. Fiat On-Ramp

**Peg Mechanism:**
- Chainlink oracles (BNB/USD, USDT/USD)
- Algorithmic rebase (expand supply above peg, contract below)
- Stabilization fund buybacks for larger deviations
- 150%+ collateral target ratio

**What makes it different:**
- ZK-SNARK privacy pools on a stablecoin (first on BSC)
- Prediction markets using the stablecoin as settlement
- Native cross-chain bridge (not third-party dependent)
- Fiat on-ramp built into the protocol

**What we need feedback on:**
1. Is the peg mechanism robust enough?
2. What's your take on the privacy pool implementation?
3. Any security concerns you see from looking at the contracts?
4. What would make you actually use this?

All code is on BscScan. Frontend at frontend-green-lab-tech.vercel.app. Roast it.
```

---

## Post 3: r/BNBChainCommunity

**Title:** USDTZ — New privacy stablecoin built natively on BNB Chain with 13 verified contracts

**Body:**
```
Just launched USDTZ on BNB Chain mainnet. Built specifically for BSC because of low gas fees (makes privacy pool deposits actually affordable at ~$0.05 vs $5+ on Ethereum).

**Quick facts:**
- 13 smart contracts, all verified on BscScan
- PancakeSwap V2 pair live
- ZK-SNARK privacy pools (private USDTZ transfers)
- Chainlink oracle price feeds
- Liquidity mining with up to 500% APY for early LPs
- Cross-chain bridge
- Prediction markets
- Fiat on-ramp

**PancakeSwap pair:** USDTZ/WBNB
**Farm rewards:** Live now at /farm

Happy to answer any questions. We chose BSC because privacy should be affordable for everyone, not just whales who can afford $20 Ethereum gas fees.

Website: frontend-green-lab-tech.vercel.app
Token: bscscan.com/token/0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665
```

---

## Post 4: r/ethfinance (Cross-chain angle)

**Title:** ZK-SNARK stablecoin privacy pools — why we built on BSC first and why Ethereum bridge is coming

**Body:**
```
We built USDTZ — an algorithmic stablecoin with integrated ZK-SNARK privacy pools. Currently live on BNB Chain, but Ethereum bridge is in active development.

**Why BSC first:**
Privacy pool deposits/withdrawals cost ~$0.05 on BSC vs $5-20 on Ethereum. Privacy should be accessible to everyone, not a luxury feature.

**Why Ethereum matters to us:**
BSC is the launch pad. Ethereum is the destination. Our cross-chain bridge contract is already deployed, and Ethereum support is the #1 priority on our roadmap.

**The privacy implementation:**
- Merkle tree commitment scheme (on-chain)
- ZK-SNARK proof generation (client-side)
- Fixed denomination deposits (prevents amount analysis)
- No link between deposit address and withdrawal address

Similar to the Tornado Cash architecture but purpose-built for a stablecoin with integrated peg management.

Would love to hear from the Ethereum privacy community on our approach. All contracts are verified and readable on BscScan.

Token: bscscan.com/token/0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665
Frontend: frontend-green-lab-tech.vercel.app/privacy
```
