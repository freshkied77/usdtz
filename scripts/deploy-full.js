const { ethers } = require('hardhat');

const BSC_CHAIN_ID = 56;
const CHAINLINK_BNB_USD = '0x0567F2324251f7Bb9aF2aE3D0cF8881Fb6D7F247';

const TOP_TOKENS_BSC = [
  { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, allocation: 8 },
  { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, allocation: 8 },
  { symbol: 'BNB', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', decimals: 18, allocation: 10 },
  { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18, allocation: 6 },
  { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, allocation: 6 },
  { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68d83eE1E1b8D43eC3b10', decimals: 18, allocation: 5 },
  { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, allocation: 4 },
  { symbol: 'AUTO', address: '0xa184088a740c695e156f91f0753c44d103bf82e8', decimals: 18, allocation: 3 },
  { symbol: 'TWT', address: '0x4B0F1812e5A2f2cd3EEB17fDBAb985b3e6a3D6E6', decimals: 18, allocation: 3 },
  { symbol: 'XVS', address: '0xcF6BB5389c92Bd7828a7fA165021B0c8E9A2bD1D', decimals: 18, allocation: 3 },
];

const SUPPORTED_TOKENS = [
  '0x55d398326f99059fF775485246999027B3197955',
  '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
];

async function main() {
  const [deployer, treasury, communityFund, liquidityFund, team] = await ethers.getSigners();
  
  console.log('\n========================================');
  console.log('USDTZ Production Deployment - BNB Chain');
  console.log('========================================\n');
  
  console.log('Network: BNB Smart Chain (Chain ID:', BSC_CHAIN_ID, ')');
  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log('');

  console.log('1. Deploying Mock BNB (for testing if needed)...');
  const MockBNB = await ethers.getContractFactory('MockBNB');
  const mockBNB = await MockBNB.deploy();
  await mockBNB.waitForDeployment();
  const wbnbAddress = await mockBNB.getAddress();
  console.log('   MockBNB deployed at:', wbnbAddress);

  console.log('\n2. Deploying USDTZ with Chainlink Oracle...');
  const USDTZChainlink = await ethers.getContractFactory('USDTZChainlink');
  const usdtz = await USDTZChainlink.deploy(
    CHAINLINK_BNB_USD,
    wbnbAddress,
    treasury.address
  );
  await usdtz.waitForDeployment();
  const usdtzAddress = await usdtz.getAddress();
  console.log('   USDTZ deployed at:', usdtzAddress);
  console.log('   Total Supply:', ethers.formatEther(await usdtz.totalSupply()));

  console.log('\n3. Deploying PancakeSwap Factory...');
  const PancakeSwapFactory = await ethers.getContractFactory('PancakeSwapFactory');
  const factory = await PancakeSwapFactory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log('   PancakeSwapFactory deployed at:', factoryAddress);

  console.log('\n4. Deploying PancakeSwap Router...');
  const PancakeSwapRouter = await ethers.getContractFactory('PancakeSwapRouter');
  const router = await PancakeSwapRouter.deploy(factoryAddress, wbnbAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log('   PancakeSwapRouter deployed at:', routerAddress);

  console.log('\n5. Deploying Pool Manager...');
  const PoolManager = await ethers.getContractFactory('PoolManager');
  const poolManager = await PoolManager.deploy(usdtzAddress, treasury.address);
  await poolManager.waitForDeployment();
  const poolManagerAddress = await poolManager.getAddress();
  console.log('   PoolManager deployed at:', poolManagerAddress);

  console.log('\n6. Deploying StabilizationFund...');
  const StabilizationFund = await ethers.getContractFactory('StabilizationFund');
  const stabilizationFund = await StabilizationFund.deploy(
    usdtzAddress,
    SUPPORTED_TOKENS[0],
    wbnbAddress,
    address(0),
    treasury.address
  );
  await stabilizationFund.waitForDeployment();
  const stabilizationFundAddress = await stabilizationFund.getAddress();
  console.log('   StabilizationFund deployed at:', stabilizationFundAddress);

  console.log('\n7. Deploying LiquidityManager...');
  const LiquidityManager = await ethers.getContractFactory('LiquidityManager');
  const liquidityManager = await LiquidityManager.deploy(
    usdtzAddress,
    routerAddress,
    factoryAddress,
    wbnbAddress,
    treasury.address
  );
  await liquidityManager.waitForDeployment();
  const liquidityManagerAddress = await liquidityManager.getAddress();
  console.log('   LiquidityManager deployed at:', liquidityManagerAddress);

  console.log('\n8. Setting up contract configurations...');
  await usdtz.setPoolManager(poolManagerAddress);
  console.log('   PoolManager set on USDTZ');
  await usdtz.setChainlinkEnabled(true);
  console.log('   Chainlink oracle enabled');
  
  await usdtz.setPairAddress(address(0));
  console.log('   Pair address placeholder set (update after LP creation)');
  await usdtz.setAutoRebaseEnabled(true);
  console.log('   Auto-rebase enabled');
  console.log('   Rebase parameters: Upper=1005e14, Lower=995e14, Max=100e18');

  console.log('\n9. Creating USDTZ-USDT LP pair...');
  const usdtAddress = SUPPORTED_TOKENS[0];
  const pairAddress = await factory.createPair(usdtzAddress, usdtAddress);
  const pair = await factory.getPair(usdtzAddress, usdtAddress);
  console.log('   USDTZ-USDT pair created at:', pair);
  
  await usdtz.setPairAddress(pair);
  console.log('   Pair address updated on USDTZ contract');

  console.log('\n10. Initializing supported tokens in LiquidityManager...');
  const tokenAddresses = SUPPORTED_TOKENS;
  const allocations = [800, 800, 1000, 600, 600];
  try {
    await liquidityManager.initializeTopTokens(tokenAddresses, allocations);
    console.log('   Supported tokens initialized');
  } catch (e) {
    console.log('   Note: Token initialization requires token holdings');
  }

  console.log('\n11. Distributing initial token allocations...');
  const totalSupply = await usdtz.totalSupply();
  
  const lpAllocation = totalSupply * 50n / 100n;
  await usdtz.transfer(liquidityManagerAddress, lpAllocation);
  console.log('   50% (', ethers.formatEther(lpAllocation), ') allocated to LiquidityManager for LP');
  
  const bridgeAllocation = totalSupply * 5n / 100n;
  await usdtz.transfer(stabilizationFundAddress, bridgeAllocation);
  console.log('   5% (', ethers.formatEther(bridgeAllocation), ') allocated to StabilizationFund');
  
  const communityAllocation = totalSupply * 25n / 100n;
  await usdtz.transfer(communityFund.address, communityAllocation);
  console.log('   25% (', ethers.formatEther(communityAllocation), ') allocated to Community Fund');
  
  const teamAllocation = totalSupply * 15n / 100n;
  await usdtz.transfer(team.address, teamAllocation);
  console.log('   15% (', ethers.formatEther(teamAllocation), ') allocated to Team');
  
  const remaining = totalSupply - lpAllocation - bridgeAllocation - communityAllocation - teamAllocation;
  await usdtz.transfer(deployer.address, remaining);
  console.log('   Remaining (', ethers.formatEther(remaining), ') retained by deployer');

  console.log('\n12. Setting up authorized rebasers...');
  const botAddress = process.env.BOT_WALLET || deployer.address;
  await usdtz.setAuthorizedRebaser(botAddress, true);
  console.log('   Bot wallet authorized for auto-rebase');

  console.log('\n13. Setting up authorized spender on StabilizationFund...');
  await stabilizationFund.setAuthorizedSpender(botAddress, true);
  console.log('   Bot wallet authorized for rebalancing');

  console.log('\n========================================');
  console.log('DEPLOYMENT SUMMARY');
  console.log('========================================');
  console.log('');
  console.log('Core Contracts:');
  console.log('  USDTZ (Chainlink):     ', usdtzAddress);
  console.log('  PoolManager:           ', poolManagerAddress);
  console.log('  StabilizationFund:     ', stabilizationFundAddress);
  console.log('');
  console.log('DEX Infrastructure:');
  console.log('  PancakeSwap Factory:   ', factoryAddress);
  console.log('  PancakeSwap Router:    ', routerAddress);
  console.log('  LP Pair (USDTZ/USDT):  ', pair);
  console.log('');
  console.log('Liquidity & Management:');
  console.log('  LiquidityManager:      ', liquidityManagerAddress);
  console.log('  WBNB (Mock):           ', wbnbAddress);
  console.log('');
  console.log('Oracle:');
  console.log('  Chainlink BNB/USD:     ', CHAINLINK_BNB_USD);
  console.log('');
  console.log('Token Allocation:');
  console.log('  Liquidity (50%):       ', ethers.formatEther(lpAllocation));
  console.log('  Stabilization (5%):     ', ethers.formatEther(bridgeAllocation));
  console.log('  Community (25%):        ', ethers.formatEther(communityAllocation));
  console.log('  Team (15%):            ', ethers.formatEther(teamAllocation));
  console.log('');
  console.log('Network: BNB Smart Chain (Chain ID:', BSC_CHAIN_ID, ')');
  console.log('');
  console.log('========================================');
  console.log('NEXT STEPS:');
  console.log('========================================');
  console.log('1. Update frontend/config.ts with contract addresses');
  console.log('2. Add initial liquidity to the USDTZ-USDT pair');
  console.log('3. Fund StabilizationFund with USDT for peg maintenance');
  console.log('4. Configure bot wallets in rpc/.env.mainnet');
  console.log('5. Start trading bots: node rpc/bots/orchestrator.js');
  console.log('6. Verify all contracts on BscScan');
  console.log('');
  
  console.log('IMPORTANT:');
  console.log('- Keep your deployer private key secure');
  console.log('- Update contract addresses in frontend');
  console.log('- Fund StabilizationFund before starting peg bot');
  console.log('- Set up monitoring for rebase events');
  console.log('');
  console.log('========================================\n');
}

function address(addr) {
  if (typeof addr === 'string') return addr;
  return addr.address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nDeployment failed:', error);
    process.exit(1);
  });