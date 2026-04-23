# Trust Wallet Token List PR Guide

## Steps to Submit

### 1. Fork the Repository
```bash
gh repo fork trustwallet/assets --clone
cd assets
```

### 2. Add USDTZ Token
```bash
mkdir -p blockchains/smartchain/assets/0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665
```

### 3. Add Logo
Copy the 256x256 PNG logo:
```bash
cp /path/to/usdtz-256.png blockchains/smartchain/assets/0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665/logo.png
```

### 4. Add Token Info
Create `blockchains/smartchain/assets/0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665/info.json`:
```json
{
  "name": "USDTZ",
  "symbol": "USDTZ",
  "type": "BEP20",
  "decimals": 18,
  "description": "Algorithmic stablecoin on BNB Chain with Chainlink oracles, ZK privacy pools, cross-chain bridge, prediction markets, and liquidity mining.",
  "website": "https://frontend-green-lab-tech.vercel.app",
  "explorer": "https://bscscan.com/token/0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665",
  "status": "active",
  "id": "0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665",
  "links": [
    {
      "name": "website",
      "url": "https://frontend-green-lab-tech.vercel.app"
    }
  ],
  "tags": ["stablecoin", "defi"]
}
```

### 5. Create Pull Request
```bash
git checkout -b add-usdtz-bsc
git add .
git commit -m "Add USDTZ token (BSC)"
gh pr create --title "[BSC] Add USDTZ Token - 0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665" --body "Add USDTZ algorithmic stablecoin on BNB Smart Chain.

Contract: https://bscscan.com/token/0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665
Website: https://frontend-green-lab-tech.vercel.app

Verified contract with active PancakeSwap trading pair."
```

## Requirements
- [x] 256x256 PNG logo (non-transparent background preferred)
- [x] Verified contract on BscScan
- [x] Valid info.json with required fields
- [ ] Minimum 2,500 token holders (Trust Wallet may require this)
- [ ] Active trading volume
