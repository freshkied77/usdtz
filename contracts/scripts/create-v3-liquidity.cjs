const { ethers } = require('hardhat');

// ============================================
// TOKENS
// ============================================
const USDTZ = '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665';
const USDT  = '0x55d398326f99059fF775485246999027B3197955';
const USDC  = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const WBNB  = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// ============================================
// DEX CONTRACTS (BSC Mainnet)
// ============================================
const DEXES = {
  PancakeSwapV3: {
    name: 'PancakeSwap V3',
    npm: '0x46a15b0b27311cedf172ab29e4f4766fbe7f4364',
    factory: '0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865',
  },
  UniswapV3: {
    name: 'Uniswap V3',
    npm: '0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613',
    factory: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7',
  },
};

// ============================================
// V3 ABIs
// ============================================
const NPM_ABI = [
  'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) payable returns (address pool)',
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function balanceOf(address owner) view returns (uint256)',
];

const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
];

// ============================================
// HELPERS
// ============================================

// Sort tokens for V3 (token0 < token1)
function sortTokens(tokenA, tokenB) {
  return tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];
}

// Calculate sqrtPriceX96 from a price ratio (token1/token0)
// sqrtPriceX96 = sqrt(price) * 2^96
function priceToSqrtPriceX96(price) {
  const sqrtPrice = Math.sqrt(price);
  // Use BigInt math for precision
  // 2^96 = 79228162514264337593543950336
  const Q96 = 79228162514264337593543950336n;
  // Multiply sqrtPrice by Q96 - use string conversion for large numbers
  const result = BigInt(Math.floor(sqrtPrice * 1e18)) * Q96 / (10n ** 18n);
  return result;
}

// Calculate tick from price: tick = log(sqrt(price)) / log(sqrt(1.0001))
// = log(price) / log(1.0001)
function priceToTick(price) {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

// Round tick down to nearest tick spacing
function roundTickDown(tick, tickSpacing) {
  return Math.floor(tick / tickSpacing) * tickSpacing;
}

// Round tick up to nearest tick spacing
function roundTickUp(tick, tickSpacing) {
  return Math.ceil(tick / tickSpacing) * tickSpacing;
}

// ============================================
// POOL CONFIGS
// ============================================
// In all pairs, USDTZ is token1 (highest address)
// For single-sided token1 deposit: tick range BELOW current tick
// (V3 rule: when current price > upper price of range, only token1 is needed)

function getPoolConfigs(dexKey) {
  // USDT/USDTZ: price = 1.0 (1 USDTZ per 1 USDT)
  // Current tick at price 1.0 = 0
  // Single-sided USDTZ (token1): range BELOW current tick
  // tickLower=-1000, tickUpper=-10 → price range ~0.905 to 0.999
  const stableTickSpacing = 10; // fee 500

  // WBNB/USDTZ: price = 640 (640 USDTZ per 1 WBNB)
  // Current tick at price 640 ≈ 64714
  // Single-sided USDTZ (token1): range BELOW current tick
  // tickLower=60000, tickUpper=64700 → price range ~403 to ~639
  const bnbPrice = 640;
  const bnbTick = priceToTick(bnbPrice); // ~64714
  // PCS uses fee 2500 (tickSpacing 50), Uniswap uses fee 3000 (tickSpacing 60)
  const bnbFee = dexKey === 'UniswapV3' ? 3000 : 2500;
  const bnbTickSpacing = dexKey === 'UniswapV3' ? 60 : 50;

  return [
    {
      label: 'USDTZ/USDT',
      token0: USDT,
      token1: USDTZ,
      fee: 500,
      tickSpacing: stableTickSpacing,
      sqrtPriceX96: priceToSqrtPriceX96(1.0),
      tickLower: -1000,
      tickUpper: -10,
    },
    {
      label: 'USDTZ/USDC',
      token0: USDC,
      token1: USDTZ,
      fee: 500,
      tickSpacing: stableTickSpacing,
      sqrtPriceX96: priceToSqrtPriceX96(1.0),
      tickLower: -1000,
      tickUpper: -10,
    },
    {
      label: 'USDTZ/WBNB',
      token0: WBNB,
      token1: USDTZ,
      fee: bnbFee,
      tickSpacing: bnbTickSpacing,
      sqrtPriceX96: priceToSqrtPriceX96(bnbPrice),
      // Current tick ~64714, place range below it
      tickLower: roundTickDown(60000, bnbTickSpacing),
      tickUpper: roundTickDown(bnbTick, bnbTickSpacing), // just below current tick
    },
  ];
}

// ============================================
// MAIN
// ============================================
async function main() {
  const [deployer] = await ethers.getSigners();
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const USDTZ_AMOUNT = ethers.parseEther('10000'); // 10,000 USDTZ per pool

  console.log('\n============================================================');
  console.log('  USDTZ V3 CONCENTRATED LIQUIDITY - SINGLE SIDED DEPOSIT');
  console.log('============================================================\n');

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer:', deployer.address);
  console.log('BNB:', ethers.formatEther(balance));

  const usdtz = new ethers.Contract(USDTZ, ERC20_ABI, deployer);
  const usdtzBal = await usdtz.balanceOf(deployer.address);
  console.log('USDTZ:', ethers.formatEther(usdtzBal));

  if (usdtzBal < USDTZ_AMOUNT * 6n) {
    console.error('Need at least 60,000 USDTZ');
    process.exit(1);
  }

  const dexKeys = Object.keys(DEXES);
  const results = [];

  // ---- Step 1: Approve both NPMs ----
  console.log('\n[1] Approving NonfungiblePositionManagers...');
  const totalApproval = USDTZ_AMOUNT * 3n; // 30,000 per DEX

  for (const dexKey of dexKeys) {
    const dex = DEXES[dexKey];
    const allowance = await usdtz.allowance(deployer.address, dex.npm);
    if (allowance < totalApproval) {
      const tx = await usdtz.approve(dex.npm, ethers.MaxUint256);
      await tx.wait();
      console.log(`  -> ${dex.name} NPM approved`);
    } else {
      console.log(`  -> ${dex.name} NPM already approved`);
    }
  }

  // ---- Step 2 & 3: Create pools and mint positions ----
  let poolNum = 0;
  const totalPools = 3 * dexKeys.length; // 3 pairs per DEX

  for (const dexKey of dexKeys) {
    const dex = DEXES[dexKey];
    const npm = new ethers.Contract(dex.npm, NPM_ABI, deployer);
    const factory = new ethers.Contract(dex.factory, FACTORY_ABI, deployer);

    const poolConfigs = getPoolConfigs(dexKey);
    console.log(`\n--- ${dex.name} ---`);

    for (const pool of poolConfigs) {
      poolNum++;
      console.log(`\n[${poolNum}/${totalPools}] ${pool.label} (fee: ${pool.fee / 10000}%)`);
      console.log(`  token0: ${pool.token0}`);
      console.log(`  token1: ${pool.token1}`);
      console.log(`  sqrtPriceX96: ${pool.sqrtPriceX96}`);
      console.log(`  tickRange: [${pool.tickLower}, ${pool.tickUpper}]`);

      // Create and initialize pool
      let poolAddress;
      try {
        const existingPool = await factory.getPool(pool.token0, pool.token1, pool.fee);
        if (existingPool !== ethers.ZeroAddress) {
          poolAddress = existingPool;
          console.log(`  Pool exists: ${poolAddress}`);
        }
      } catch (e) {
        // getPool might not exist, continue to create
      }

      if (!poolAddress || poolAddress === ethers.ZeroAddress) {
        console.log('  Creating pool...');
        try {
          const createTx = await npm.createAndInitializePoolIfNecessary(
            pool.token0,
            pool.token1,
            pool.fee,
            pool.sqrtPriceX96,
            { gasLimit: 5000000 }
          );
          const createReceipt = await createTx.wait();
          console.log(`  -> Pool created. Gas: ${createReceipt.gasUsed}`);

          // Get pool address
          poolAddress = await factory.getPool(pool.token0, pool.token1, pool.fee);
          console.log(`  -> Pool: ${poolAddress}`);
        } catch (e) {
          console.log(`  -> CREATE FAILED: ${e.message?.slice(0, 120)}`);
          // Try to get pool in case it was created but we got an error
          try {
            poolAddress = await factory.getPool(pool.token0, pool.token1, pool.fee);
            if (poolAddress !== ethers.ZeroAddress) {
              console.log(`  -> Pool already existed: ${poolAddress}`);
            }
          } catch (e2) {}
          if (!poolAddress || poolAddress === ethers.ZeroAddress) {
            results.push({ dex: dex.name, pair: pool.label, status: 'POOL_FAILED', error: e.message?.slice(0, 80) });
            continue;
          }
        }
      }

      // Mint single-sided position (only token1 = USDTZ)
      console.log('  Minting position (10,000 USDTZ)...');
      try {
        const mintParams = {
          token0: pool.token0,
          token1: pool.token1,
          fee: pool.fee,
          tickLower: pool.tickLower,
          tickUpper: pool.tickUpper,
          amount0Desired: 0n,           // No token0 (single-sided)
          amount1Desired: USDTZ_AMOUNT, // 10,000 USDTZ
          amount0Min: 0n,
          amount1Min: 0n,               // Accept any (first LP)
          recipient: deployer.address,
          deadline: deadline,
        };

        // Estimate gas first
        let gasLimit;
        try {
          const gasEst = await npm.mint.estimateGas(mintParams);
          gasLimit = gasEst * 130n / 100n; // 30% buffer
        } catch (e) {
          gasLimit = 2000000n;
          console.log(`  Gas estimate failed, using default 2M: ${e.message?.slice(0, 60)}`);
        }

        const mintTx = await npm.mint(mintParams, { gasLimit });
        const mintReceipt = await mintTx.wait();

        // Parse tokenId from Transfer event (ERC721)
        let tokenId = 'unknown';
        let liquidity = 'unknown';
        for (const log of mintReceipt.logs) {
          // Transfer(address,address,uint256) for ERC721
          if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' &&
              log.address.toLowerCase() === dex.npm.toLowerCase()) {
            tokenId = BigInt(log.topics[3]).toString();
          }
          // IncreaseLiquidity(uint256,uint128,uint256,uint256)
          if (log.topics[0] === '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f') {
            tokenId = BigInt(log.topics[1]).toString();
          }
        }

        console.log(`  -> MINTED! Token ID: ${tokenId}, Gas: ${mintReceipt.gasUsed}`);
        results.push({
          dex: dex.name,
          pair: pool.label,
          status: 'SUCCESS',
          pool: poolAddress,
          tokenId,
          tickLower: pool.tickLower,
          tickUpper: pool.tickUpper,
        });
      } catch (e) {
        console.log(`  -> MINT FAILED: ${e.message?.slice(0, 150)}`);
        results.push({ dex: dex.name, pair: pool.label, status: 'MINT_FAILED', pool: poolAddress, error: e.message?.slice(0, 80) });
      }
    }
  }

  // ---- Summary ----
  const finalBal = await ethers.provider.getBalance(deployer.address);
  const gasUsed = balance - finalBal;

  console.log('\n============================================================');
  console.log('  DEPLOYMENT SUMMARY');
  console.log('============================================================\n');

  const succeeded = results.filter(r => r.status === 'SUCCESS');
  const failed = results.filter(r => r.status !== 'SUCCESS');

  console.log(`Successful: ${succeeded.length}/${results.length}`);
  console.log(`Failed: ${failed.length}/${results.length}`);
  console.log(`Gas Used: ${ethers.formatEther(gasUsed)} BNB`);
  console.log('');

  for (const r of results) {
    if (r.status === 'SUCCESS') {
      console.log(`${r.dex} | ${r.pair}`);
      console.log(`  Pool: ${r.pool}`);
      console.log(`  NFT: #${r.tokenId}`);
      console.log(`  Ticks: [${r.tickLower}, ${r.tickUpper}]`);
    } else {
      console.log(`${r.dex} | ${r.pair} — ${r.status}: ${r.error || ''}`);
    }
    console.log('');
  }

  // Save results
  const fs = require('fs');
  const output = results.map(r =>
    `${r.dex}|${r.pair}|${r.status}|${r.pool || ''}|${r.tokenId || ''}|${r.tickLower || ''}|${r.tickUpper || ''}`
  ).join('\n');
  fs.writeFileSync('../v3-positions.txt', output);
  console.log('Results saved to v3-positions.txt');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('\nFATAL:', e.message || e); process.exit(1); });
