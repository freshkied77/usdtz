/**
 * USDTZ Buy Wall Strategy
 *
 * Places and maintains buy orders just below the peg to create visible
 * price support. Uses limit-order-like behavior on PancakeSwap V3
 * concentrated liquidity positions.
 *
 * For PancakeSwap V2 (current): Maintains BNB reserves ready to buy
 * any dip below the configured support level.
 *
 * This acts as a "buy wall" — visible support that discourages selling
 * and gives confidence to potential buyers.
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/buy-wall.js
 *
 * Environment Variables:
 *   PRIVATE_KEY         - Wallet private key
 *   SUPPORT_PRICE       - Price level to defend (default: 0.995)
 *   MAX_BNB_PER_BUY     - Max BNB per buy (default: 0.2)
 *   TOTAL_BNB_BUDGET    - Total BNB to deploy (default: 1.0)
 *   CHECK_INTERVAL_MS   - Check interval (default: 10000)
 */

const { ethers } = require("ethers");

const CONFIG = {
  RPC_URL: "https://bsc-dataseed1.binance.org",
  USDTZ: "0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665",
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  ROUTER: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  PAIR: "0xbAe7EAF2078f053857b472c2cAE4F63D0086b89F",
  CHAINLINK_BNB_USD: "0x0567F2324251f7Bb9aF2aE3D0cF8881Fb6D7F247",

  SUPPORT_PRICE: parseFloat(process.env.SUPPORT_PRICE || "0.995"),
  MAX_BNB_PER_BUY: parseFloat(process.env.MAX_BNB_PER_BUY || "0.2"),
  TOTAL_BNB_BUDGET: parseFloat(process.env.TOTAL_BNB_BUDGET || "1.0"),
  CHECK_INTERVAL: parseInt(process.env.CHECK_INTERVAL_MS || "10000"),
  SLIPPAGE_BPS: 100,
};

const PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
];

const ROUTER_ABI = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)",
];

const CHAINLINK_ABI = [
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
];

function log(level, msg) {
  const ts = new Date().toISOString();
  const colors = { INFO: '\x1b[36m', BUY: '\x1b[32m', WALL: '\x1b[33m', ALERT: '\x1b[31m' };
  console.log(`${colors[level] || ''}[${ts}] [${level}] ${msg}\x1b[0m`);
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("Set PRIVATE_KEY environment variable");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const pair = new ethers.Contract(CONFIG.PAIR, PAIR_ABI, provider);
  const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, wallet);
  const chainlink = new ethers.Contract(CONFIG.CHAINLINK_BNB_USD, CHAINLINK_ABI, provider);

  const token0 = await pair.token0();
  const isUsdtzToken0 = token0.toLowerCase() === CONFIG.USDTZ.toLowerCase();

  let totalBnbSpent = 0;
  let buyCount = 0;
  let totalUsdtzBought = 0;

  log("INFO", `Buy Wall Bot started`);
  log("INFO", `Wallet: ${wallet.address}`);
  log("WALL", `Support level: $${CONFIG.SUPPORT_PRICE}`);
  log("WALL", `Budget: ${CONFIG.TOTAL_BNB_BUDGET} BNB | Max per buy: ${CONFIG.MAX_BNB_PER_BUY} BNB`);

  async function checkAndDefend() {
    try {
      if (totalBnbSpent >= CONFIG.TOTAL_BNB_BUDGET) {
        log("INFO", "Budget exhausted. Monitoring only.");
        return;
      }

      // Get prices
      const roundData = await chainlink.latestRoundData();
      const bnbPrice = Number(roundData.answer) / 1e8;

      const reserves = await pair.getReserves();
      const usdtzReserve = isUsdtzToken0 ? reserves.reserve0 : reserves.reserve1;
      const wbnbReserve = isUsdtzToken0 ? reserves.reserve1 : reserves.reserve0;

      const usdtzPerBnb = Number(ethers.formatEther(usdtzReserve)) / Number(ethers.formatEther(wbnbReserve));
      const usdtzPrice = bnbPrice / usdtzPerBnb;

      const budgetRemaining = CONFIG.TOTAL_BNB_BUDGET - totalBnbSpent;
      log("INFO", `USDTZ: $${usdtzPrice.toFixed(6)} | Budget remaining: ${budgetRemaining.toFixed(4)} BNB`);

      // Execute buy wall defense
      if (usdtzPrice < CONFIG.SUPPORT_PRICE) {
        const priceGap = CONFIG.SUPPORT_PRICE - usdtzPrice;
        const urgency = Math.min(priceGap / 0.01, 1); // 0-1 scale, 1 = max urgency

        // Scale buy size with urgency
        const buyBnb = Math.min(
          CONFIG.MAX_BNB_PER_BUY * (0.5 + urgency * 0.5),
          budgetRemaining
        );

        const bnbAmount = ethers.parseEther(buyBnb.toFixed(8));
        const bnbBalance = await provider.getBalance(wallet.address);

        if (bnbBalance < bnbAmount + ethers.parseEther("0.005")) {
          log("ALERT", "Insufficient BNB balance!");
          return;
        }

        const amounts = await router.getAmountsOut(bnbAmount, [CONFIG.WBNB, CONFIG.USDTZ]);
        const minOut = amounts[1] * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;

        log("BUY", `DEFENDING PEG: $${usdtzPrice.toFixed(4)} < $${CONFIG.SUPPORT_PRICE} | Buying with ${buyBnb.toFixed(6)} BNB (urgency: ${(urgency * 100).toFixed(0)}%)`);

        const tx = await router.swapExactETHForTokens(
          minOut,
          [CONFIG.WBNB, CONFIG.USDTZ],
          wallet.address,
          Math.floor(Date.now() / 1000) + 300,
          { value: bnbAmount }
        );
        const receipt = await tx.wait();

        totalBnbSpent += buyBnb;
        totalUsdtzBought += Number(ethers.formatEther(amounts[1]));
        buyCount++;

        log("BUY", `Confirmed: ${receipt.hash} | Bought ${ethers.formatEther(amounts[1])} USDTZ | Total spent: ${totalBnbSpent.toFixed(4)} BNB`);
      }

    } catch (err) {
      log("ALERT", `Error: ${err.message}`);
    }
  }

  // Stats
  setInterval(() => {
    log("WALL", `══ Buys: ${buyCount} | BNB spent: ${totalBnbSpent.toFixed(4)} | USDTZ bought: ${totalUsdtzBought.toFixed(2)} | Budget left: ${(CONFIG.TOTAL_BNB_BUDGET - totalBnbSpent).toFixed(4)} BNB ══`);
  }, 600000);

  // Run
  setInterval(checkAndDefend, CONFIG.CHECK_INTERVAL);
  checkAndDefend();

  process.on("SIGINT", () => {
    log("WALL", `Final: ${buyCount} buys, ${totalBnbSpent.toFixed(4)} BNB spent, ${totalUsdtzBought.toFixed(2)} USDTZ bought`);
    process.exit(0);
  });
}

main().catch(console.error);
