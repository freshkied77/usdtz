# Hummingbot Setup for USDTZ Market Making

## Installation

### Option 1: Docker (Recommended)
```bash
# Pull the latest Hummingbot image
docker pull hummingbot/hummingbot:latest

# Create instance directory
mkdir -p ./hummingbot_files/conf ./hummingbot_files/logs ./hummingbot_files/data ./hummingbot_files/scripts

# Copy config files
cp conf_pure_market_making_usdtz_bnb.yml ./hummingbot_files/conf/
cp conf_pure_market_making_usdtz_usdt.yml ./hummingbot_files/conf/

# Run Hummingbot
docker run -it --name hummingbot \
  --network host \
  -v $(pwd)/hummingbot_files/conf:/conf \
  -v $(pwd)/hummingbot_files/logs:/logs \
  -v $(pwd)/hummingbot_files/data:/data \
  -v $(pwd)/hummingbot_files/scripts:/scripts \
  hummingbot/hummingbot:latest
```

### Option 2: Source Install
```bash
# Clone Hummingbot
git clone https://github.com/hummingbot/hummingbot.git
cd hummingbot

# Install with conda
./install
conda activate hummingbot
./compile

# Start
bin/hummingbot.py
```

## Configuration

### Inside Hummingbot CLI:

1. **Connect your wallet:**
```
connect pancakeswap
# Enter your BSC wallet private key when prompted
```

2. **Import strategy config:**
```
import --strategy pure_market_making
# Select conf_pure_market_making_usdtz_bnb.yml
```

3. **Start the bot:**
```
start
```

## Strategy Files
- `conf_pure_market_making_usdtz_bnb.yml` - USDTZ/WBNB pair on PancakeSwap
- `conf_pure_market_making_usdtz_usdt.yml` - USDTZ/USDT pair (once pair exists)

## Important Notes
- Start with VERY small amounts ($50-100) to test
- The bot needs both tokens in the pair (e.g., USDTZ + BNB)
- Monitor for at least 24h before increasing size
- Set kill_switch_enabled to true as safety net
- Adjust bid/ask spreads based on market conditions
