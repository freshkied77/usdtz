const { ethers } = require('hardhat');

// Deployed addresses
const DEPLOYED = {
  usdtz: '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665',
  poolManager: '0x3c91AF7Cf1f5c44d32A6fF9222a3Ed72845d8E86',
  stabilizationFund: '0x033fA6AFd3D7af45FBC6d617553178f4773Cba6a',
  liquidityManager: '0x6C5212B7D40154ee367f49Dc05d5C7659a544800',
  liquidityVault: '0xdfbe58825699E42D786EBf9B7Ba8F6ab03C1C759',
  bridge: '0x54C68aB92134167A42d8fF5e46bB1a566fF89BAb',
};

const PANCAKE_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('\n============================================');
  console.log('  USDTZ LIQUIDITY SEEDING');
  console.log('============================================\n');
  console.log('Deployer:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('BNB Balance:', ethers.formatEther(balance), 'BNB');

  // Reserve gas for all transactions (~0.001 BNB)
  const gasReserve = ethers.parseEther('0.001');
  const bnbForLP = balance - gasReserve;

  if (bnbForLP <= 0n) {
    console.error('Not enough BNB after gas reserve');
    process.exit(1);
  }

  console.log('BNB for LP:', ethers.formatEther(bnbForLP), 'BNB');

  // Get BNB price from Chainlink to calculate USDTZ amount
  // At $1 peg: USDTZ amount = BNB amount * BNB price
  // We'll use a manual price estimate since Chainlink call might be expensive
  // Current BNB ~$640, so 0.004 BNB ≈ $2.56 worth
  // To set a $1 peg: we need equal USD value on both sides
  // USDTZ side = BNB_amount * BNB_price_in_USD

  // Get Chainlink price
  const chainlinkABI = ['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)'];
  const chainlink = new ethers.Contract('0x0567f2324251F7bB9AF2AE3D0cF8881Fb6d7F247', chainlinkABI, deployer);

  let bnbPrice;
  try {
    const [, answer] = await chainlink.latestRoundData();
    bnbPrice = answer;
    console.log('BNB Price (Chainlink):', ethers.formatUnits(answer, 8), 'USD');
  } catch (e) {
    // Fallback price
    bnbPrice = 64000000000n; // $640
    console.log('BNB Price (fallback): $640');
  }

  // Calculate USDTZ to pair: bnbForLP * bnbPrice / 1e8 (chainlink has 8 decimals)
  // USDTZ has 18 decimals, BNB has 18 decimals
  const usdtzAmount = (bnbForLP * bnbPrice) / (10n ** 8n);
  console.log('USDTZ for LP:', ethers.formatEther(usdtzAmount), 'USDTZ');
  console.log('');

  // Step 1: Call setupBNBLiquidity on LiquidityManager
  console.log('[1/3] Setting up BNB liquidity pool...');

  const lmABI = [
    'function setupBNBLiquidity(uint256 usdtzAmount) payable',
    'function owner() view returns (address)',
    'function usdtzToken() view returns (address)',
  ];
  const liquidityManager = new ethers.Contract(DEPLOYED.liquidityManager, lmABI, deployer);

  // Verify ownership
  const lmOwner = await liquidityManager.owner();
  console.log('  LiquidityManager owner:', lmOwner);
  console.log('  Deployer is owner:', lmOwner === deployer.address);

  const tx1 = await liquidityManager.setupBNBLiquidity(usdtzAmount, {
    value: bnbForLP,
    gasLimit: 1000000
  });
  console.log('  TX hash:', tx1.hash);
  const receipt1 = await tx1.wait();
  console.log('  Gas used:', receipt1.gasUsed.toString());
  console.log('  -> USDTZ/BNB pool created!');

  // Step 2: Get the pair address
  console.log('\n[2/3] Finding pair address...');
  const factoryABI = ['function getPair(address, address) view returns (address)'];
  const factory = new ethers.Contract(PANCAKE_FACTORY, factoryABI, deployer);
  const pairAddress = await factory.getPair(DEPLOYED.usdtz, WBNB);
  console.log('  USDTZ/WBNB Pair:', pairAddress);

  // Step 3: Set pair address on USDTZChainlink for rebase
  console.log('\n[3/3] Configuring pair address on contracts...');
  const usdtzABI = [
    'function setPairAddress(address)',
    'function pairAddress() view returns (address)',
  ];
  const usdtz = new ethers.Contract(DEPLOYED.usdtz, usdtzABI, deployer);

  const tx2 = await usdtz.setPairAddress(pairAddress);
  await tx2.wait();
  console.log('  -> Pair set on USDTZChainlink');

  // Set pair on StabilizationFund too
  const stabABI = ['function setPancakePair(address)'];
  try {
    const stabFund = new ethers.Contract(DEPLOYED.stabilizationFund, stabABI, deployer);
    const tx3 = await stabFund.setPancakePair(pairAddress);
    await tx3.wait();
    console.log('  -> Pair set on StabilizationFund');
  } catch (e) {
    console.log('  -> StabilizationFund setPancakePair skipped:', e.message?.slice(0, 60));
  }

  // Verify the pair
  console.log('\n============================================');
  console.log('  LIQUIDITY SEEDING COMPLETE');
  console.log('============================================');
  console.log('');
  console.log('USDTZ/WBNB Pair:', pairAddress);
  console.log('USDTZ deposited:', ethers.formatEther(usdtzAmount));
  console.log('BNB deposited:', ethers.formatEther(bnbForLP));
  console.log('');

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log('Remaining BNB:', ethers.formatEther(finalBalance));

  // Check pair reserves
  const pairABI = [
    'function getReserves() view returns (uint112, uint112, uint32)',
    'function token0() view returns (address)',
  ];
  const pair = new ethers.Contract(pairAddress, pairABI, deployer);
  const [r0, r1] = await pair.getReserves();
  const token0 = await pair.token0();

  if (token0.toLowerCase() === DEPLOYED.usdtz.toLowerCase()) {
    console.log('Reserve USDTZ:', ethers.formatEther(r0));
    console.log('Reserve WBNB:', ethers.formatEther(r1));
  } else {
    console.log('Reserve WBNB:', ethers.formatEther(r0));
    console.log('Reserve USDTZ:', ethers.formatEther(r1));
  }

  console.log('\nNext steps:');
  console.log('1. Add USDTZ token to PancakeSwap: Import', DEPLOYED.usdtz);
  console.log('2. Start bots: cd rpc && node bots/orchestrator.js');
  console.log('3. Add more liquidity when funds available');

  // Save pair address
  const fs = require('fs');
  fs.appendFileSync('../deployment-addresses.env', `\nNEXT_PUBLIC_USDTZ_BNB_PAIR=${pairAddress}\n`);
  console.log('\nPair address saved to deployment-addresses.env');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nFAILED:', error.message || error);
    process.exit(1);
  });
