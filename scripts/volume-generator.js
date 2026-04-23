/**
 * USDTZ Volume & Activity Generator
 *
 * Creates organic-looking trading activity on PancakeSwap to:
 * - Generate visible volume for CoinGecko/CMC listing requirements
 * - Create orderbook depth illusion for potential investors
 * - Maintain price stability through balanced buy/sell pressure
 *
 * Strategy: Small alternating buy/sell trades at random intervals
 * Net cost: Only gas fees (~$0.10-0.20 per round trip)
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/volume-generator.js
 *
 * Environment Variables:
 *   PRIVATE_KEY       - Wallet private key
 *   MIN_TRADE_USD     - Minimum trade size in USD (default: 5)
 *   MAX_TRADE_USD     - Maximum trade size in USD (default: 50)
 *   MIN_INTERVAL_MS   - Minimum time between trades (default: 60000)
 *   MAX_INTERVAL_MS   - Maximum time between trades (default: 300000)
 *   DAILY_BUDGET_BNB  - Max BNB to spend on gas per day (default: 0.05)
 */

const { ethers } = require("ethers");

const CONFIG = {
  RPC_URL: "https://bsc-dataseed1.binance.org",
  USDTZ: "0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665",
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  ROUTER: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  CHAINLINK_BNB_USD: "0x0567F2324251f7Bb9aF2aE3D0cF8881Fb6D7F247",

  MIN_TRADE_USD: parseFloat(process.env.MIN_TRADE_USD || "5"),
  MAX_TRADE_USD: parseFloat(process.env.MAX_TRADE_USD || "50"),
  MIN_INTERVAL: parseInt(process.env.MIN_INTERVAL_MS || "60000"),
  MAX_INTERVAL: parseInt(process.env.MAX_INTERVAL_MS || "300000"),
  DAILY_BUDGET_BNB: parseFloat(process.env.DAILY_BUDGET_BNB || "0.05"),
  SLIPPAGE_BPS: 200,
};

const ROUTER_ABI = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

const CHAINLINK_ABI = [
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
];

function log(level, msg) {
  const ts = new Date().toISOString();
  const colors = { INFO: '\x1b[36m', BUY: '\x1b[32m', SELL: '\x1b[33m', ERROR: '\x1b[31m', STATS: '\x1b[35m' };
  console.log(`${colors[level] || ''}[${ts}] [${level}] ${msg}\x1b[0m`);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("Set PRIVATE_KEY environment variable");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);
  const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, wallet);
  const usdtz = new ethers.Contract(CONFIG.USDTZ, ERC20_ABI, wallet);
  const chainlink = new ethers.Contract(CONFIG.CHAINLINK_BNB_USD, CHAINLINK_ABI, provider);

  log("INFO", `Volume Generator started`);
  log("INFO", `Wallet: ${wallet.address}`);
  log("INFO", `Trade range: $${CONFIG.MIN_TRADE_USD} - $${CONFIG.MAX_TRADE_USD}`);
  log("INFO", `Interval: ${CONFIG.MIN_INTERVAL / 1000}s - ${CONFIG.MAX_INTERVAL / 1000}s`);
  log("INFO", `Daily gas budget: ${CONFIG.DAILY_BUDGET_BNB} BNB`);

  // Ensure USDTZ approved
  const allowance = await usdtz.allowance(wallet.address, CONFIG.ROUTER);
  if (allowance < ethers.parseEther("1000000")) {
    log("INFO", "Approving USDTZ for router...");
    const tx = await usdtz.approve(CONFIG.ROUTER, ethers.MaxUint256);
    await tx.wait();
    log("INFO", "Approved");
  }

  let totalVolume = 0;
  let tradeCount = 0;
  let gasSpent = 0;
  let lastBuy = false; // Alternate buy/sell
  const startTime = Date.now();

  async function executeTrade() {
    try {
      // Check daily gas budget
      const elapsed = (Date.now() - startTime) / (24 * 60 * 60 * 1000);
      if (gasSpent > CONFIG.DAILY_BUDGET_BNB && elapsed < 1) {
        log("INFO", "Daily gas budget reached. Waiting for reset...");
        setTimeout(executeTrade, 3600000); // Check again in 1h
        return;
      }

      // Get BNB price
      const roundData = await chainlink.latestRoundData();
      const bnbPrice = Number(roundData.answer) / 1e8;

      // Random trade size in USD
      const tradeUsd = randomBetween(CONFIG.MIN_TRADE_USD, CONFIG.MAX_TRADE_USD);
      const tradeBnb = tradeUsd / bnbPrice;

      if (!lastBuy) {
        // BUY USDTZ with BNB
        const bnbAmount = ethers.parseEther(tradeBnb.toFixed(8));
        const bnbBalance = await provider.getBalance(wallet.address);

        if (bnbBalance < bnbAmount + ethers.parseEther("0.005")) {
          log("ERROR", "Insufficient BNB");
          scheduleNext();
          return;
        }

        const amounts = await router.getAmountsOut(bnbAmount, [CONFIG.WBNB, CONFIG.USDTZ]);
        const minOut = amounts[1] * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;

        const tx = await router.swapExactETHForTokens(
          minOut,
          [CONFIG.WBNB, CONFIG.USDTZ],
          wallet.address,
          Math.floor(Date.now() / 1000) + 300,
          { value: bnbAmount }
        );
        const receipt = await tx.wait();
        const gasCost = Number(ethers.formatEther(receipt.gasUsed * receipt.gasPrice));
        gasSpent += gasCost;
        totalVolume += tradeUsd;
        tradeCount++;
        lastBuy = true;

        log("BUY", `$${tradeUsd.toFixed(2)} (${tradeBnb.toFixed(6)} BNB -> ${ethers.formatEther(amounts[1])} USDTZ) | Gas: ${gasCost.toFixed(6)} BNB`);

      } else {
        // SELL USDTZ for BNB
        const usdtzBalance = await usdtz.balanceOf(wallet.address);
        const sellAmount = ethers.parseEther(tradeUsd.toFixed(2));

        if (usdtzBalance < sellAmount) {
          log("INFO", "Not enough USDTZ, switching to buy");
          lastBuy = false;
          scheduleNext();
          return;
        }

        const amounts = await router.getAmountsOut(sellAmount, [CONFIG.USDTZ, CONFIG.WBNB]);
        const minOut = amounts[1] * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;

        const tx = await router.swapExactTokensForETH(
          sellAmount,
          minOut,
          [CONFIG.USDTZ, CONFIG.WBNB],
          wallet.address,
          Math.floor(Date.now() / 1000) + 300
        );
        const receipt = await tx.wait();
        const gasCost = Number(ethers.formatEther(receipt.gasUsed * receipt.gasPrice));
        gasSpent += gasCost;
        totalVolume += tradeUsd;
        tradeCount++;
        lastBuy = false;

        log("SELL", `$${tradeUsd.toFixed(2)} (${ethers.formatEther(sellAmount)} USDTZ -> ${ethers.formatEther(amounts[1])} BNB) | Gas: ${gasCost.toFixed(6)} BNB`);
      }

    } catch (err) {
      log("ERROR", err.message);
    }

    scheduleNext();
  }

  function scheduleNext() {
    const delay = randomBetween(CONFIG.MIN_INTERVAL, CONFIG.MAX_INTERVAL);
    log("INFO", `Next trade in ${(delay / 1000).toFixed(0)}s`);
    setTimeout(executeTrade, delay);
  }

  // Stats every 30 min
  setInterval(() => {
    log("STATS", `═══ Volume: $${totalVolume.toFixed(2)} | Trades: ${tradeCount} | Gas: ${gasSpent.toFixed(6)} BNB ═══`);
  }, 1800000);

  // Start
  executeTrade();

  process.on("SIGINT", () => {
    log("STATS", `Final - Volume: $${totalVolume.toFixed(2)} | Trades: ${tradeCount} | Gas: ${gasSpent.toFixed(6)} BNB`);
    process.exit(0);
  });
}

main().catch(console.error);
