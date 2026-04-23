/**
 * USDTZ LiquidityMining Contract Configuration Script
 *
 * This script configures the deployed LiquidityMining contract:
 * - Adds the USDTZ/WBNB LP token pool
 * - Sets reward rate for 500%+ APY to attract early LPs
 * - Configures referral commission
 *
 * Contract: 0xD78096854c994741D188B53d3a5C6ef2a877bb1d
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run scripts/configure-liquidity-mining.js --network bsc
 *
 *   OR with environment variable:
 *   source deployment-addresses.env
 *   PRIVATE_KEY=0x... node scripts/configure-liquidity-mining.js
 */

const { ethers } = require("ethers");

// Contract addresses
const LIQUIDITY_MINING = "0xD78096854c994741D188B53d3a5C6ef2a877bb1d";
const USDTZ_TOKEN = "0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665";
const LP_TOKEN = "0xbAe7EAF2078f053857b472c2cAE4F63D0086b89F"; // USDTZ/WBNB PancakeSwap V2

// LiquidityMining ABI (relevant functions only)
const MINING_ABI = [
  "function addPool(address _lpToken, uint256 _allocPoint, uint256 _lockDuration) external",
  "function setRewardsPerSecond(uint256 _rewardsPerSecond) external",
  "function setReferralCommission(uint256 _bps) external",
  "function poolLength() external view returns (uint256)",
  "function poolInfo(uint256) external view returns (address lpToken, uint256 allocPoint, uint256 lastRewardTime, uint256 accRewardPerShare, uint256 totalStaked, uint256 lockDuration)",
  "function rewardsPerSecond() external view returns (uint256)",
  "function owner() external view returns (address)",
];

// USDTZ ABI (for approval)
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

async function main() {
  // --- Setup Provider ---
  const RPC_URL = "https://bsc-dataseed1.binance.org";
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: Set PRIVATE_KEY environment variable");
    console.error("Usage: PRIVATE_KEY=0x... node scripts/configure-liquidity-mining.js");
    process.exit(1);
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Wallet: ${wallet.address}`);

  // --- Connect to Contracts ---
  const mining = new ethers.Contract(LIQUIDITY_MINING, MINING_ABI, wallet);
  const usdtz = new ethers.Contract(USDTZ_TOKEN, ERC20_ABI, wallet);

  // --- Check Ownership ---
  const owner = await mining.owner();
  console.log(`Contract owner: ${owner}`);
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error("ERROR: Wallet is not the contract owner!");
    process.exit(1);
  }

  // --- Step 1: Check Existing Pools ---
  const poolCount = await mining.poolLength();
  console.log(`\nExisting pools: ${poolCount}`);

  let lpPoolExists = false;
  for (let i = 0; i < poolCount; i++) {
    const pool = await mining.poolInfo(i);
    console.log(`  Pool ${i}: LP=${pool.lpToken}, alloc=${pool.allocPoint}, staked=${ethers.formatEther(pool.totalStaked)}`);
    if (pool.lpToken.toLowerCase() === LP_TOKEN.toLowerCase()) {
      lpPoolExists = true;
      console.log("  ^ USDTZ/WBNB pool already exists!");
    }
  }

  // --- Step 2: Add USDTZ/WBNB LP Pool ---
  if (!lpPoolExists) {
    console.log("\n--- Adding USDTZ/WBNB LP Pool ---");
    const allocPoint = 1000; // Allocation points (weight relative to other pools)
    const lockDuration = 0;  // No lock requirement (user-friendly for bootstrapping)

    const tx = await mining.addPool(LP_TOKEN, allocPoint, lockDuration);
    console.log(`TX: ${tx.hash}`);
    await tx.wait();
    console.log("Pool added successfully!");
  }

  // --- Step 3: Set Rewards Rate ---
  // Target: ~500% APY on initial small pool
  //
  // Math for 500% APY with $1000 TVL:
  //   Annual reward = $5,000 worth of USDTZ = 5,000 USDTZ
  //   Per second = 5,000 / (365 * 24 * 3600) = ~0.0001585 USDTZ/sec
  //   In wei: ~158,500,000,000,000 (1.585e14)
  //
  // Start aggressive, reduce as TVL grows:
  //   $1K TVL  -> 500% APY at 0.16 USDTZ/sec
  //   $10K TVL -> 500% APY at 1.6 USDTZ/sec
  //   $100K TVL -> 500% APY at 16 USDTZ/sec
  //
  // Starting conservative at 0.16 USDTZ/sec (~5K USDTZ/year)

  const rewardsPerSecond = ethers.parseEther("0.16"); // 0.16 USDTZ per second

  console.log("\n--- Setting Rewards Rate ---");
  console.log(`Rate: 0.16 USDTZ/sec (~13,824 USDTZ/day, ~5M USDTZ/year)`);
  console.log(`At $1K TVL = ~500% APY`);
  console.log(`At $10K TVL = ~50% APY`);
  console.log(`At $100K TVL = ~5% APY`);

  const tx2 = await mining.setRewardsPerSecond(rewardsPerSecond);
  console.log(`TX: ${tx2.hash}`);
  await tx2.wait();
  console.log("Rewards rate set!");

  // --- Step 4: Set Referral Commission ---
  console.log("\n--- Setting Referral Commission ---");
  const referralBps = 250; // 2.5% referral commission
  const tx3 = await mining.setReferralCommission(referralBps);
  console.log(`TX: ${tx3.hash}`);
  await tx3.wait();
  console.log(`Referral commission set to ${referralBps / 100}%`);

  // --- Step 5: Fund Rewards ---
  const usdtzBalance = await usdtz.balanceOf(wallet.address);
  console.log(`\n--- Reward Funding ---`);
  console.log(`Your USDTZ balance: ${ethers.formatEther(usdtzBalance)}`);

  // Transfer USDTZ to mining contract as rewards
  // Start with 50,000 USDTZ (~3 months of rewards at current rate)
  const fundAmount = ethers.parseEther("50000");

  if (usdtzBalance >= fundAmount) {
    console.log(`Funding mining contract with 50,000 USDTZ...`);
    const allowance = await usdtz.allowance(wallet.address, LIQUIDITY_MINING);
    if (allowance < fundAmount) {
      const approveTx = await usdtz.approve(LIQUIDITY_MINING, ethers.MaxUint256);
      await approveTx.wait();
      console.log("Approved!");
    }
    const transferTx = await usdtz.transfer(LIQUIDITY_MINING, fundAmount);
    await transferTx.wait();
    console.log("Funded!");
  } else {
    console.log(`WARNING: Insufficient USDTZ to fund rewards.`);
    console.log(`Need 50,000 USDTZ, have ${ethers.formatEther(usdtzBalance)}`);
    console.log(`Transfer USDTZ to mining contract manually when available.`);
  }

  // --- Summary ---
  console.log("\n========== CONFIGURATION COMPLETE ==========");
  console.log(`LiquidityMining: ${LIQUIDITY_MINING}`);
  console.log(`LP Token Pool:   ${LP_TOKEN}`);
  console.log(`Rewards Rate:    0.16 USDTZ/sec`);
  console.log(`Referral:        2.5%`);
  console.log(`Lock:            None (flexible)`);
  console.log("=============================================");
  console.log("\nNext steps:");
  console.log("1. Ensure mining contract has USDTZ for rewards");
  console.log("2. Announce farming program on socials");
  console.log("3. Monitor TVL and adjust rewardsPerSecond as needed");
  console.log("4. Add more pools (USDTZ/USDT, USDTZ single-stake) later");
}

main().catch(console.error);
