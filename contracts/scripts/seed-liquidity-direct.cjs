const { ethers } = require('hardhat');

const DEPLOYED = {
  usdtz: '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665',
  stabilizationFund: '0x033fA6AFd3D7af45FBC6d617553178f4773Cba6a',
};

const PANCAKE_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('\n============================================');
  console.log('  USDTZ DIRECT LIQUIDITY SEEDING');
  console.log('============================================\n');

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer:', deployer.address);
  console.log('BNB Balance:', ethers.formatEther(balance), 'BNB');

  // Check deployer's USDTZ balance
  const erc20ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address, uint256) returns (bool)',
    'function allowance(address, address) view returns (uint256)',
  ];
  const usdtz = new ethers.Contract(DEPLOYED.usdtz, erc20ABI, deployer);
  const usdtzBalance = await usdtz.balanceOf(deployer.address);
  console.log('USDTZ Balance:', ethers.formatEther(usdtzBalance), 'USDTZ');

  // Use 0.003 BNB for LP, keep rest for gas
  const bnbForLP = ethers.parseEther('0.003');
  const gasReserve = balance - bnbForLP;
  console.log('BNB for LP:', ethers.formatEther(bnbForLP));
  console.log('Gas reserve:', ethers.formatEther(gasReserve));

  if (gasReserve < ethers.parseEther('0.0005')) {
    console.error('Not enough gas reserve');
    process.exit(1);
  }

  // Get BNB price to calculate USDTZ amount for $1 peg
  let bnbPriceUSD = 640n; // fallback
  try {
    const chainlinkABI = ['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)'];
    const chainlink = new ethers.Contract('0x0567f2324251F7bB9AF2AE3D0cF8881Fb6d7F247', chainlinkABI, deployer);
    const [, answer] = await chainlink.latestRoundData();
    bnbPriceUSD = answer / (10n ** 8n);
    console.log('BNB Price (Chainlink): $' + bnbPriceUSD.toString());
  } catch (e) {
    console.log('BNB Price (fallback): $640');
  }

  // For $1 peg: usdtzAmount = bnbForLP * bnbPrice
  // 0.003 BNB * $640 = 1.92 USDTZ
  const usdtzForLP = bnbForLP * bnbPriceUSD;
  console.log('USDTZ for LP:', ethers.formatEther(usdtzForLP), 'USDTZ');
  console.log('');

  // Step 1: Approve PancakeSwap Router to spend USDTZ
  console.log('[1/4] Approving PancakeSwap Router...');
  const tx1 = await usdtz.approve(PANCAKE_ROUTER, usdtzForLP);
  await tx1.wait();
  console.log('  -> Approved', ethers.formatEther(usdtzForLP), 'USDTZ');

  // Step 2: Add liquidity via PancakeSwap Router
  console.log('\n[2/4] Adding USDTZ/BNB liquidity...');
  const routerABI = [
    'function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)',
  ];
  const router = new ethers.Contract(PANCAKE_ROUTER, routerABI, deployer);

  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const tx2 = await router.addLiquidityETH(
    DEPLOYED.usdtz,
    usdtzForLP,      // amountTokenDesired
    0,               // amountTokenMin (accept any for initial LP)
    0,               // amountETHMin
    deployer.address, // LP tokens go to deployer
    deadline,
    {
      value: bnbForLP,
      gasLimit: 500000
    }
  );
  console.log('  TX hash:', tx2.hash);
  const receipt = await tx2.wait();
  console.log('  Gas used:', receipt.gasUsed.toString());
  console.log('  -> Liquidity added!');

  // Step 3: Get pair address
  console.log('\n[3/4] Getting pair address...');
  const factoryABI = ['function getPair(address, address) view returns (address)'];
  const factory = new ethers.Contract(PANCAKE_FACTORY, factoryABI, deployer);
  const pairAddress = await factory.getPair(DEPLOYED.usdtz, WBNB);
  console.log('  USDTZ/WBNB Pair:', pairAddress);

  // Step 4: Set pair on USDTZChainlink
  console.log('\n[4/4] Configuring contracts with pair address...');
  const usdtzConfigABI = ['function setPairAddress(address)'];
  const usdtzConfig = new ethers.Contract(DEPLOYED.usdtz, usdtzConfigABI, deployer);
  const tx3 = await usdtzConfig.setPairAddress(pairAddress);
  await tx3.wait();
  console.log('  -> Pair set on USDTZChainlink');

  // Try setting on StabilizationFund
  try {
    const stabABI = ['function setPancakePair(address)'];
    const stabFund = new ethers.Contract(DEPLOYED.stabilizationFund, stabABI, deployer);
    const tx4 = await stabFund.setPancakePair(pairAddress);
    await tx4.wait();
    console.log('  -> Pair set on StabilizationFund');
  } catch (e) {
    console.log('  -> StabilizationFund pair config skipped (may not have this function)');
  }

  // Verify reserves
  const pairABI = [
    'function getReserves() view returns (uint112, uint112, uint32)',
    'function token0() view returns (address)',
  ];
  const pair = new ethers.Contract(pairAddress, pairABI, deployer);
  const [r0, r1] = await pair.getReserves();
  const token0 = await pair.token0();

  console.log('\n============================================');
  console.log('  LIQUIDITY SEEDED SUCCESSFULLY');
  console.log('============================================');
  console.log('');
  console.log('Pair Address:', pairAddress);
  if (token0.toLowerCase() === DEPLOYED.usdtz.toLowerCase()) {
    console.log('Reserve USDTZ:', ethers.formatEther(r0));
    console.log('Reserve WBNB:', ethers.formatEther(r1));
    const price = Number(r1) / Number(r0) * Number(bnbPriceUSD);
    console.log('Implied USDTZ Price: $' + price.toFixed(4));
  } else {
    console.log('Reserve WBNB:', ethers.formatEther(r0));
    console.log('Reserve USDTZ:', ethers.formatEther(r1));
    const price = Number(r0) / Number(r1) * Number(bnbPriceUSD);
    console.log('Implied USDTZ Price: $' + price.toFixed(4));
  }

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log('\nRemaining BNB:', ethers.formatEther(finalBalance));

  // Save
  const fs = require('fs');
  fs.appendFileSync('../deployment-addresses.env', `\nNEXT_PUBLIC_USDTZ_BNB_PAIR=${pairAddress}\n`);
  console.log('Pair address appended to deployment-addresses.env');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nFAILED:', error.message || error);
    process.exit(1);
  });
