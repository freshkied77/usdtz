#!/bin/bash
# Hummingbot Quick Install for USDTZ Market Making
# Run: chmod +x install.sh && ./install.sh

set -e

echo "=== USDTZ Hummingbot Market Making Setup ==="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "Docker installed. You may need to log out and back in."
fi

# Create directory structure
HMBOT_DIR="$HOME/hummingbot_files"
mkdir -p "$HMBOT_DIR/conf" "$HMBOT_DIR/logs" "$HMBOT_DIR/data" "$HMBOT_DIR/scripts"

# Copy strategy configs
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/conf_pure_market_making_usdtz_bnb.yml" "$HMBOT_DIR/conf/"
cp "$SCRIPT_DIR/conf_pure_market_making_usdtz_usdt.yml" "$HMBOT_DIR/conf/"

echo ""
echo "Config files copied to $HMBOT_DIR/conf/"
echo ""

# Pull Hummingbot
echo "Pulling Hummingbot Docker image..."
docker pull hummingbot/hummingbot:latest

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start Hummingbot:"
echo "  docker run -it --name hummingbot \\"
echo "    --network host \\"
echo "    -v $HMBOT_DIR/conf:/conf \\"
echo "    -v $HMBOT_DIR/logs:/logs \\"
echo "    -v $HMBOT_DIR/data:/data \\"
echo "    -v $HMBOT_DIR/scripts:/scripts \\"
echo "    hummingbot/hummingbot:latest"
echo ""
echo "Inside Hummingbot:"
echo "  1. connect pancakeswap"
echo "  2. import --strategy pure_market_making"
echo "  3. Select conf_pure_market_making_usdtz_bnb.yml"
echo "  4. start"
echo ""
echo "IMPORTANT: You need BNB + USDTZ in your wallet to market make."
echo "Start small ($50-100) and monitor for 24h before scaling up."
