/**
 * USDTZ Peg Arbitrage & Price Support Bot
 *
 * Monitors USDTZ price on PancakeSwap and executes stabilization trades:
 * - Buys USDTZ when below peg (< $0.998)
 * - Sells USDTZ when above peg (> $1.002)
 * - Triggers Stabilization Fund buybacks for larger depegs
 * - Logs all actions for monitoring
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/peg-arbitrage-bot.js
 *
 * Environment Variables:
 *   PRIVATE_KEY       - Wallet private key
 *   BUY_THRESHOLD     - Buy when price below this (default: 0.998)
 *   SELL_THRESHOLD    - Sell when price above this (default: 1.002)
 *   MAX_TRADE_BNB     - Max BNB per trade (default: 0.1)
 *   CHECK_INTERVAL_MS - Price check interval (default: 15000)
 */

const { ethers } = require("ethers");

// ── Configuration ──
const CONFIG = {
  RPC_URL: "https://bsc-dataseed1.binance.org",
  USDTZ: "0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665",
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  ROUTER: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  PAIR: "0xbAe7EAF2078f053857b472c2cAE4F63D0086b89F",
  STABILIZATION_FUND: "0x23b8450530Be2A3f19Ae2FDD26cA3491C4De192D",
  CHAINLINK_BNB_USD: "0x0567F2324251f7Bb9aF2aE3D0cF8881Fb6D7F247",

  BUY_THRESHOLD: parseFloat(process.env.BUY_THRESHOLD || "0.998"),
  SELL_THRESHOLD: parseFloat(process.env.SELL_THRESHOLD || "1.002"),
  EMERGENCY_THRESHOLD: 0.99, // Trigger stabilization fund below this
  MAX_TRADE_BNB: parseFloat(process.env.MAX_TRADE_BNB || "0.1"),
  CHECK_INTERVAL: parseInt(process.env.CHECK_INTERVAL_MS || "15000"),
  SLIPPAGE_BPS: 100, // 1% slippage tolerance
};

// ── ABIs ──
const PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
];

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

const STAB_FUND_ABI = [
  "function triggerBuyback(uint256 amount) external",
  "function checkPegStatus() external view returns (bool needsAction, bool isBelowPeg, uint256 deviation)",
];

// ── Logging ──
function log(level, msg) {
  const ts = new Date().toISOString();
  const colors = { INFO: '\x1b[36m', TRADE: '\x1b[32m', WARN: '\x1b[33m', ERROR: '\x1b[31m', STAB: '\x1b[35m' };
  console.log(`${colors[level] || ''}[${ts}] [${level}] ${msg}\x1b[0m`);
}

// ── Main Bot ──
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
  const usdtz = new ethers.Contract(CONFIG.USDTZ, ERC20_ABI, wallet);
  const chainlink = new ethers.Contract(CONFIG.CHAINLINK_BNB_USD, CHAINLINK_ABI, provider);
  const stabFund = new ethers.Contract(CONFIG.STABILIZATION_FUND, STAB_FUND_ABI, wallet);

  log("INFO", `Peg Arbitrage Bot started`);
  log("INFO", `Wallet: ${wallet.address}`);
  log("INFO", `Buy threshold: $${CONFIG.BUY_THRESHOLD} | Sell threshold: $${CONFIG.SELL_THRESHOLD}`);
  log("INFO", `Max trade: ${CONFIG.MAX_TRADE_BNB} BNB | Check every ${CONFIG.CHECK_INTERVAL / 1000}s`);

  // Determine token order in pair
  const token0 = await pair.token0();
  const isUsdtzToken0 = token0.toLowerCase() === CONFIG.USDTZ.toLowerCase();
  log("INFO", `USDTZ is token${isUsdtzToken0 ? '0' : '1'} in pair`);

  // Ensure USDTZ approved for router
  const allowance = await usdtz.allowance(wallet.address, CONFIG.ROUTER);
  if (allowance < ethers.parseEther("1000000")) {
    log("INFO", "Approving USDTZ for router...");
    const approveTx = await usdtz.approve(CONFIG.ROUTER, ethers.MaxUint256);
    await approveTx.wait();
    log("INFO", "Approved");
  }

  let tradeCount = 0;
  let totalBnbUsed = 0;
  let totalUsdtzBought = 0;
  let totalUsdtzSold = 0;

  // ── Price Check Loop ──
  async function checkAndTrade() {
    try {
      // Get BNB price from Chainlink
      const roundData = await chainlink.latestRoundData();
      const bnbPrice = Number(roundData.answer) / 1e8;

      // Get pair reserves
      const reserves = await pair.getReserves();
      const usdtzReserve = isUsdtzToken0 ? reserves.reserve0 : reserves.reserve1;
      const wbnbReserve = isUsdtzToken0 ? reserves.reserve1 : reserves.reserve0;

      // Calculate USDTZ price in USD
      const usdtzPerBnb = Number(ethers.formatEther(usdtzReserve)) / Number(ethers.formatEther(wbnbReserve));
      const usdtzPrice = bnbPrice / usdtzPerBnb;
      const deviation = ((usdtzPrice - 1.0) * 100).toFixed(4);

      log("INFO", `USDTZ: $${usdtzPrice.toFixed(6)} (${deviation}%) | BNB: $${bnbPrice.toFixed(2)} | Reserve: ${Number(ethers.formatEther(usdtzReserve)).toFixed(0)} USDTZ / ${Number(ethers.formatEther(wbnbReserve)).toFixed(4)} WBNB`);

      // ── Emergency: Stabilization Fund Trigger ──
      if (usdtzPrice < CONFIG.EMERGENCY_THRESHOLD) {
        log("STAB", `EMERGENCY: Price $${usdtzPrice.toFixed(4)} below $${CONFIG.EMERGENCY_THRESHOLD}!`);
        try {
          const status = await stabFund.checkPegStatus();
          if (status.needsAction) {
            log("STAB", "Triggering Stabilization Fund buyback...");
            const tx = await stabFund.triggerBuyback(ethers.parseEther("5000"));
            log("STAB", `TX: ${tx.hash}`);
            await tx.wait();
            log("STAB", "Stabilization buyback executed!");
          }
        } catch (e) {
          log("WARN", `Stabilization fund call failed: ${e.message}`);
        }
      }

      // ── Buy USDTZ (price below peg) ──
      if (usdtzPrice < CONFIG.BUY_THRESHOLD) {
        const bnbBalance = await provider.getBalance(wallet.address);
        const tradeBnb = ethers.parseEther(CONFIG.MAX_TRADE_BNB.toString());

        if (bnbBalance > tradeBnb + ethers.parseEther("0.01")) {
          // Calculate expected USDTZ out
          const amounts = await router.getAmountsOut(tradeBnb, [CONFIG.WBNB, CONFIG.USDTZ]);
          const expectedOut = amounts[1];
          const minOut = expectedOut * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;

          log("TRADE", `BUYING: ${CONFIG.MAX_TRADE_BNB} BNB -> ~${ethers.formatEther(expectedOut)} USDTZ (price: $${usdtzPrice.toFixed(4)})`);

          const tx = await router.swapExactETHForTokens(
            minOut,
            [CONFIG.WBNB, CONFIG.USDTZ],
            wallet.address,
            Math.floor(Date.now() / 1000) + 300,
            { value: tradeBnb }
          );
          const receipt = await tx.wait();
          tradeCount++;
          totalBnbUsed += CONFIG.MAX_TRADE_BNB;
          totalUsdtzBought += Number(ethers.formatEther(expectedOut));
          log("TRADE", `BUY confirmed: ${receipt.hash} | Gas: ${receipt.gasUsed.toString()}`);
        } else {
          log("WARN", `Insufficient BNB for buy trade (have ${ethers.formatEther(bnbBalance)} BNB)`);
        }
      }

      // ── Sell USDTZ (price above peg) ──
      if (usdtzPrice > CONFIG.SELL_THRESHOLD) {
        const usdtzBalance = await usdtz.balanceOf(wallet.address);
        const maxSellUsdtz = ethers.parseEther((CONFIG.MAX_TRADE_BNB * bnbPrice).toString());
        const sellAmount = usdtzBalance < maxSellUsdtz ? usdtzBalance : maxSellUsdtz;

        if (sellAmount > ethers.parseEther("10")) {
          const amounts = await router.getAmountsOut(sellAmount, [CONFIG.USDTZ, CONFIG.WBNB]);
          const expectedBnb = amounts[1];
          const minBnb = expectedBnb * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;

          log("TRADE", `SELLING: ${ethers.formatEther(sellAmount)} USDTZ -> ~${ethers.formatEther(expectedBnb)} BNB (price: $${usdtzPrice.toFixed(4)})`);

          const tx = await router.swapExactTokensForETH(
            sellAmount,
            minBnb,
            [CONFIG.USDTZ, CONFIG.WBNB],
            wallet.address,
            Math.floor(Date.now() / 1000) + 300
          );
          const receipt = await tx.wait();
          tradeCount++;
          totalUsdtzSold += Number(ethers.formatEther(sellAmount));
          log("TRADE", `SELL confirmed: ${receipt.hash} | Gas: ${receipt.gasUsed.toString()}`);
        } else {
          log("WARN", `Insufficient USDTZ for sell trade`);
        }
      }

    } catch (err) {
      log("ERROR", `Check failed: ${err.message}`);
    }
  }

  // ── Stats Display ──
  function showStats() {
    log("INFO", "═══════════════════════════════════════");
    log("INFO", `Total trades: ${tradeCount}`);
    log("INFO", `BNB spent buying: ${totalBnbUsed.toFixed(4)}`);
    log("INFO", `USDTZ bought: ${totalUsdtzBought.toFixed(2)}`);
    log("INFO", `USDTZ sold: ${totalUsdtzSold.toFixed(2)}`);
    log("INFO", "═══════════════════════════════════════");
  }

  // Run immediately, then on interval
  await checkAndTrade();
  setInterval(checkAndTrade, CONFIG.CHECK_INTERVAL);
  setInterval(showStats, 300000); // Stats every 5 min

  // Handle shutdown
  process.on("SIGINT", () => {
    log("INFO", "Shutting down...");
    showStats();
    process.exit(0);
  });
}

main().catch(console.error);
