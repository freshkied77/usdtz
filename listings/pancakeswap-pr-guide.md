# PancakeSwap Token List PR Guide

## Steps to Submit

### 1. Fork the Repository
```bash
gh repo fork pancakeswap/token-list --clone
cd token-list
```

### 2. Add USDTZ Token Entry
Add the following to `src/tokens/pancakeswap-extended.json` in the `tokens` array:

```json
{
  "name": "USDTZ",
  "symbol": "USDTZ",
  "address": "0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665",
  "chainId": 56,
  "decimals": 18,
  "logoURI": "https://frontend-green-lab-tech.vercel.app/branding/usdtz-256.png"
}
```

### 3. Add Logo
- Copy `usdtz-256.png` to `logos/0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665.png`
- Logo must be 256x256 PNG

### 4. Create Pull Request
```bash
git checkout -b add-usdtz-token
git add .
git commit -m "feat: add USDTZ stablecoin (BSC)"
gh pr create --title "Add USDTZ Token" --body "## Token Details
- **Name:** USDTZ
- **Symbol:** USDTZ  
- **Chain:** BNB Smart Chain (56)
- **Address:** 0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665
- **Decimals:** 18
- **Type:** Algorithmic Stablecoin

## Verification
- Contract verified on BscScan: https://bscscan.com/token/0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665
- Active PancakeSwap V2 pair: 0xbAe7EAF2078f053857b472c2cAE4F63D0086b89F
- Working website: https://frontend-green-lab-tech.vercel.app
- Full DeFi platform with 13 deployed contracts

## Features
- Chainlink oracle price feeds (BNB/USD, USDT/USD)
- Algorithmic supply management with stabilization fund
- ZK-SNARK privacy pools
- Cross-chain bridge
- Prediction markets
- Liquidity mining with referral system
"
```

## Requirements Checklist
- [x] Contract deployed and verified on BSC
- [x] Active trading pair on PancakeSwap
- [x] 256x256 PNG logo
- [x] Valid token metadata (name, symbol, decimals)
- [ ] Review PancakeSwap's current PR requirements (may have changed)

## Alternative: PancakeSwap Token Request Form
PancakeSwap also accepts token additions via their request form:
https://pancakeswap.finance/token-request

Fill in:
- Token Contract Address: `0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665`
- Project Name: USDTZ
- Logo URL: `https://frontend-green-lab-tech.vercel.app/branding/usdtz-256.png`
