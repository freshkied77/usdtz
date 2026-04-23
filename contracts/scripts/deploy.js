require('dotenv').config();
const { ethers } = require('ethers');

const BSC_RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS;
const CHAINLINK_BNB_USD = '0x0567F2324251f7Bb9aF2aE3D0cF8881Fb6D7F247';

const TOKENS = {
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  USDT: '0x55d398326f99059fF775485246999027B3197955',
  BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
  ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
  BTCB: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c'
};

async function main() {
  console.log('===========================================');
  console.log('  USDTZ Protocol Deployment');
  console.log('===========================================\n');

  console.log('Network:', 'BNB Smart Chain');
  console.log('RPC URL:', BSC_RPC_URL);
  console.log('Treasury:', TREASURY_ADDRESS || '(not set - will use deployer)');
  console.log('');

  const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
  const deployer = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'BNB');
  console.log('');

  const treasury = TREASURY_ADDRESS || deployer.address;

  console.log('Deploying contracts...\n');

  const usdtzFactory = await ethers.getContractFactory('USDTZChainlink', deployer);
  const usdtz = await usdtzFactory.deploy(
    CHAINLINK_BNB_USD,
    TOKENS.WBNB,
    treasury
  );
  await usdtz.waitForDeployment();
  const usdtzAddress = await usdtz.getAddress();
  console.log('USDTZ Stablecoin:', usdtzAddress);

  const poolManagerFactory = await ethers.getContractFactory('PoolManager', deployer);
  const poolManager = await poolManagerFactory.deploy(usdtzAddress, treasury);
  await poolManager.waitForDeployment();
  const poolManagerAddress = await poolManager.getAddress();
  console.log('Pool Manager:', poolManagerAddress);

  await usdtz.setPoolManager(poolManagerAddress);
  console.log('USDTZ -> PoolManager linked\n');

  const pancakeFactory = await ethers.getContractFactory('PancakeSwapFactory', deployer);
  const pancake = await pancakeFactory.deploy(deployer.address);
  await pancake.waitForDeployment();
  const pancakeAddress = await pancake.getAddress();
  console.log('PancakeSwap Factory:', pancakeAddress);

  const pancakeRouterFactory = await ethers.getContractFactory('PancakeSwapRouter', deployer);
  const router = await pancakeRouterFactory.deploy(pancakeAddress, TOKENS.WBNB);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log('PancakeSwap Router:', routerAddress);

  const predictionFactory = await ethers.getContractFactory('PredictionMarket', deployer);
  const prediction = await predictionFactory.deploy(usdtzAddress, treasury, poolManagerAddress);
  await prediction.waitForDeployment();
  const predictionAddress = await prediction.getAddress();
  console.log('Prediction Market:', predictionAddress);

  const stabilizationFactory = await ethers.getContractFactory('StabilizationFund', deployer);
  const stabilization = await stabilizationFactory.deploy(usdtzAddress, TOKENS.USDT, pancakeAddress, treasury);
  await stabilization.waitForDeployment();
  const stabilizationAddress = await stabilization.getAddress();
  console.log('Stabilization Fund:', stabilizationAddress);

  const liquidityMiningFactory = await ethers.getContractFactory('LiquidityMining', deployer);
  const liquidityMining = await liquidityMiningFactory.deploy(usdtzAddress, treasury);
  await liquidityMining.waitForDeployment();
  const liquidityMiningAddress = await liquidityMining.getAddress();
  console.log('Liquidity Mining:', liquidityMiningAddress);

  const referralFactory = await ethers.getContractFactory('ReferralSystem', deployer);
  const referral = await referralFactory.deploy(usdtzAddress, treasury);
  await referral.waitForDeployment();
  const referralAddress = await referral.getAddress();
  console.log('Referral System:', referralAddress);

  const fiatRampFactory = await ethers.getContractFactory('FiatOnRamp', deployer);
  const fiatRamp = await fiatRampFactory.deploy(usdtzAddress, TOKENS.WBNB, TOKENS.USDT, treasury);
  await fiatRamp.waitForDeployment();
  const fiatRampAddress = await fiatRamp.getAddress();
  console.log('Fiat On-Ramp:', fiatRampAddress);

  console.log('\n===========================================');
  console.log('  Contract Configuration');
  console.log('===========================================\n');

  console.log('Setting up PancakeSwap pair for USDTZ-USDT...');
  const pairAddress = await pancake.createPair(usdtzAddress, TOKENS.USDT);
  console.log('USDTZ-USDT Pair:', pairAddress);
  console.log('');

  console.log('Configuring Liquidity Mining pools...');
  const usdtzPairAddress = pairAddress;
  await liquidityMining.addPool(usdtzPairAddress, 5000, 90, 0);
  console.log('Added USDTZ-USDT LP pool (50% allocation, 90 days)');

  const wbnbPairAddress = await pancake.createPair(TOKENS.WBNB, TOKENS.USDT);
  await liquidityMining.addPool(wbnbPairAddress, 3000, 90, 0);
  console.log('Added WBNB-USDT LP pool (30% allocation, 90 days)');

  const busdPairAddress = await pancake.createPair(TOKENS.BUSD, TOKENS.USDT);
  await liquidityMining.addPool(busdPairAddress, 2000, 90, 0);
  console.log('Added BUSD-USDT LP pool (20% allocation, 90 days)');

  console.log('\n===========================================');
  console.log('  Deployment Summary');
  console.log('===========================================\n');

  console.log('CONTRACT_ADDRESSES=');
  console.log(`USDTZ=${usdtzAddress}`);
  console.log(`POOL_MANAGER=${poolManagerAddress}`);
  console.log(`PANCAKE_FACTORY=${pancakeAddress}`);
  console.log(`PANCAKE_ROUTER=${routerAddress}`);
  console.log(`PREDICTION_MARKET=${predictionAddress}`);
  console.log(`STABILIZATION_FUND=${stabilizationAddress}`);
  console.log(`LIQUIDITY_MINING=${liquidityMiningAddress}`);
  console.log(`REFERRAL_SYSTEM=${referralAddress}`);
  console.log(`FIAT_ON_RAMP=${fiatRampAddress}`);
  console.log(`USDTZ_USDT_PAIR=${usdtzPairAddress}`);
  console.log(`WBNB_USDT_PAIR=${wbnbPairAddress}`);
  console.log(`BUSD_USDT_PAIR=${busdPairAddress}`);
  console.log('');

  console.log('NEXT_PUBLIC_USDTZ_CONTRACT=' + usdtzAddress);
  console.log('NEXT_PUBLIC_POOL_MANAGER=' + poolManagerAddress);
  console.log('NEXT_PUBLIC_FACTORY=' + pancakeAddress);
  console.log('NEXT_PUBLIC_ROUTER=' + routerAddress);
  console.log('NEXT_PUBLIC_PREDICTION_MARKET=' + predictionAddress);
  console.log('NEXT_PUBLIC_STABILIZATION_FUND=' + stabilizationAddress);
  console.log('NEXT_PUBLIC_LIQUIDITY_MINING=' + liquidityMiningAddress);
  console.log('NEXT_PUBLIC_REFERRAL_SYSTEM=' + referralAddress);
  console.log('NEXT_PUBLIC_FIAT_ON_RAMP=' + fiatRampAddress);
  console.log('');

  const fs = require('fs');
  const envContent = `
# Contract Addresses
USDTZ=${usdtzAddress}
POOL_MANAGER=${poolManagerAddress}
PANCAKE_FACTORY=${pancakeAddress}
PANCAKE_ROUTER=${routerAddress}
PREDICTION_MARKET=${predictionAddress}
STABILIZATION_FUND=${stabilizationAddress}
LIQUIDITY_MINING=${liquidityMiningAddress}
REFERRAL_SYSTEM=${referralAddress}
FIAT_ON_RAMP=${fiatRampAddress}
USDTZ_USDT_PAIR=${usdtzPairAddress}
WBNB_USDT_PAIR=${wbnbPairAddress}
BUSD_USDT_PAIR=${busdPairAddress}

# Network
BSC_RPC_URL=${BSC_RPC_URL}
TREASURY_ADDRESS=${treasury}
CHAINLINK_BNB_USD=${CHAINLINK_BNB_USD}
`;
  
  fs.writeFileSync('.env.deployed', envContent);
  console.log('Deployment config saved to .env.deployed');

  console.log('\n===========================================');
  console.log('  Deployment Complete!');
  console.log('===========================================\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
