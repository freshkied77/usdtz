import hre from 'hardhat';
const { ethers } = hre;

// BSC Mainnet addresses
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const PANCAKE_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const CHAINLINK_BNB_USD = '0x0567F2324251f7Bb9aF2aE3D0cF8881Fb6D7F247';

const SUPPORTED_TOKENS = [USDT, '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', WBNB, '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'];

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasuryAddress = deployer.address; // deployer acts as treasury initially

  console.log('\n============================================');
  console.log('  USDTZ MAINNET DEPLOYMENT - BNB CHAIN');
  console.log('============================================\n');
  console.log('Deployer:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'BNB');

  if (balance < ethers.parseEther('0.3')) {
    console.error('INSUFFICIENT BNB. Need at least 0.3 BNB for gas.');
    process.exit(1);
  }

  const deployed = {};

  // ---- Step 1: USDTZ Core ----
  console.log('\n[1/10] Deploying USDTZChainlink...');
  const USDTZChainlink = await ethers.getContractFactory('USDTZChainlink');
  const usdtz = await USDTZChainlink.deploy(CHAINLINK_BNB_USD, WBNB, treasuryAddress);
  await usdtz.waitForDeployment();
  deployed.usdtz = await usdtz.getAddress();
  console.log('  -> USDTZChainlink:', deployed.usdtz);

  // ---- Step 2: Pool Manager ----
  console.log('\n[2/10] Deploying PoolManager...');
  const PoolManager = await ethers.getContractFactory('PoolManager');
  const poolManager = await PoolManager.deploy(deployed.usdtz, treasuryAddress);
  await poolManager.waitForDeployment();
  deployed.poolManager = await poolManager.getAddress();
  console.log('  -> PoolManager:', deployed.poolManager);

  // ---- Step 3: Stabilization Fund ----
  console.log('\n[3/10] Deploying StabilizationFund...');
  const StabilizationFund = await ethers.getContractFactory('StabilizationFund');
  const stabFund = await StabilizationFund.deploy(
    deployed.usdtz,
    USDT,
    WBNB,
    ethers.ZeroAddress, // pair set later
    treasuryAddress
  );
  await stabFund.waitForDeployment();
  deployed.stabilizationFund = await stabFund.getAddress();
  console.log('  -> StabilizationFund:', deployed.stabilizationFund);

  // ---- Step 4: Liquidity Manager ----
  console.log('\n[4/10] Deploying LiquidityManager...');
  const LiquidityManager = await ethers.getContractFactory('LiquidityManager');
  const liqManager = await LiquidityManager.deploy(
    deployed.usdtz,
    PANCAKE_ROUTER,
    PANCAKE_FACTORY,
    WBNB,
    treasuryAddress
  );
  await liqManager.waitForDeployment();
  deployed.liquidityManager = await liqManager.getAddress();
  console.log('  -> LiquidityManager:', deployed.liquidityManager);

  // ---- Step 5: Liquidity Vault ----
  console.log('\n[5/10] Deploying LiquidityVault...');
  const LiquidityVault = await ethers.getContractFactory('LiquidityVault');
  const vault = await LiquidityVault.deploy(deployed.usdtz);
  await vault.waitForDeployment();
  deployed.liquidityVault = await vault.getAddress();
  console.log('  -> LiquidityVault:', deployed.liquidityVault);

  // ---- Step 6: Cross-Chain Bridge (Zedx) ----
  console.log('\n[6/10] Deploying ZedxBridge...');
  const ZedxBridge = await ethers.getContractFactory('ZedxBridge');
  const bridge = await ZedxBridge.deploy(deployed.usdtz, WBNB);
  await bridge.waitForDeployment();
  deployed.bridge = await bridge.getAddress();
  console.log('  -> ZedxBridge:', deployed.bridge);

  // ---- Step 7: Privacy System ----
  console.log('\n[7/10] Deploying Privacy System...');
  const PrivacyPool = await ethers.getContractFactory('PrivacyPool');
  const privacyPool = await PrivacyPool.deploy(
    ethers.ZeroAddress, // verifier - set after ZK circuit deployment
    ethers.ZeroHash,    // initial merkle root
    ethers.parseEther('100'),  // denomination
    ethers.parseEther('1000')  // private denomination
  );
  await privacyPool.waitForDeployment();
  deployed.privacyPool = await privacyPool.getAddress();
  console.log('  -> PrivacyPool:', deployed.privacyPool);

  const PrivacyRegistry = await ethers.getContractFactory('PrivacyRegistry');
  const privacyRegistry = await PrivacyRegistry.deploy();
  await privacyRegistry.waitForDeployment();
  deployed.privacyRegistry = await privacyRegistry.getAddress();
  console.log('  -> PrivacyRegistry:', deployed.privacyRegistry);

  // ---- Step 8: Supporting Contracts ----
  console.log('\n[8/10] Deploying Supporting Contracts...');

  const LiquidityMining = await ethers.getContractFactory('LiquidityMining');
  const mining = await LiquidityMining.deploy(deployed.usdtz, treasuryAddress);
  await mining.waitForDeployment();
  deployed.liquidityMining = await mining.getAddress();
  console.log('  -> LiquidityMining:', deployed.liquidityMining);

  const PredictionMarket = await ethers.getContractFactory('PredictionMarket');
  const prediction = await PredictionMarket.deploy(deployed.usdtz, treasuryAddress, deployed.poolManager);
  await prediction.waitForDeployment();
  deployed.predictionMarket = await prediction.getAddress();
  console.log('  -> PredictionMarket:', deployed.predictionMarket);

  const ReferralSystem = await ethers.getContractFactory('ReferralSystem');
  const referral = await ReferralSystem.deploy(deployed.usdtz, treasuryAddress);
  await referral.waitForDeployment();
  deployed.referralSystem = await referral.getAddress();
  console.log('  -> ReferralSystem:', deployed.referralSystem);

  const FiatOnRamp = await ethers.getContractFactory('FiatOnRamp');
  const fiatRamp = await FiatOnRamp.deploy(deployed.usdtz, WBNB, USDT, treasuryAddress);
  await fiatRamp.waitForDeployment();
  deployed.fiatOnRamp = await fiatRamp.getAddress();
  console.log('  -> FiatOnRamp:', deployed.fiatOnRamp);

  const MerkleTreeVerification = await ethers.getContractFactory('MerkleTreeVerification');
  const merkle = await MerkleTreeVerification.deploy();
  await merkle.waitForDeployment();
  deployed.merkleTree = await merkle.getAddress();
  console.log('  -> MerkleTreeVerification:', deployed.merkleTree);

  // ---- Step 9: Configure Contracts ----
  console.log('\n[9/10] Configuring contracts...');

  let tx;
  tx = await usdtz.setPoolManager(deployed.poolManager);
  await tx.wait();
  console.log('  -> PoolManager linked to USDTZ');

  tx = await usdtz.setAutoRebaseEnabled(true);
  await tx.wait();
  console.log('  -> Auto-rebase enabled');

  tx = await usdtz.setAuthorizedRebaser(deployer.address, true);
  await tx.wait();
  console.log('  -> Deployer set as authorized rebaser');

  tx = await stabFund.setLiquidityManager(deployed.liquidityManager);
  await tx.wait();
  console.log('  -> LiquidityManager linked to StabilizationFund');

  tx = await stabFund.setAuthorizedSpender(deployer.address, true);
  await tx.wait();
  console.log('  -> Deployer authorized as StabilizationFund spender');

  // Set bridge vault
  tx = await bridge.setLiquidityVault(deployed.liquidityVault);
  await tx.wait();
  console.log('  -> LiquidityVault linked to Bridge');

  // Add supported tokens to bridge
  for (const token of SUPPORTED_TOKENS) {
    tx = await bridge.addSupportedToken(token);
    await tx.wait();
  }
  // Add USDTZ itself
  tx = await bridge.addSupportedToken(deployed.usdtz);
  await tx.wait();
  console.log('  -> Supported tokens added to Bridge');

  // Add deployer as bridge validator
  tx = await bridge.addValidator(deployer.address);
  await tx.wait();
  console.log('  -> Deployer added as bridge validator');

  // ---- Step 10: Token Distribution ----
  console.log('\n[10/10] Distributing initial token supply...');
  const totalSupply = await usdtz.totalSupply();

  // 50% to Liquidity Manager for LP provisioning
  const lpAlloc = totalSupply * 50n / 100n;
  tx = await usdtz.transfer(deployed.liquidityManager, lpAlloc);
  await tx.wait();
  console.log('  -> 50% to LiquidityManager:', ethers.formatEther(lpAlloc), 'USDTZ');

  // 5% to StabilizationFund for peg maintenance
  const stabAlloc = totalSupply * 5n / 100n;
  tx = await usdtz.transfer(deployed.stabilizationFund, stabAlloc);
  await tx.wait();
  console.log('  -> 5% to StabilizationFund:', ethers.formatEther(stabAlloc), 'USDTZ');

  // 5% to Bridge for cross-chain reserves
  const bridgeAlloc = totalSupply * 5n / 100n;
  tx = await usdtz.transfer(deployed.bridge, bridgeAlloc);
  await tx.wait();
  console.log('  -> 5% to Bridge:', ethers.formatEther(bridgeAlloc), 'USDTZ');

  // Remaining 40% stays in deployer wallet (treasury/team/community - distribute later)
  const remaining = totalSupply - lpAlloc - stabAlloc - bridgeAlloc;
  console.log('  -> 40% retained by deployer:', ethers.formatEther(remaining), 'USDTZ');

  // ============================================
  // DEPLOYMENT SUMMARY
  // ============================================
  const finalBalance = await ethers.provider.getBalance(deployer.address);
  const gasUsed = balance - finalBalance;

  console.log('\n============================================');
  console.log('  DEPLOYMENT COMPLETE');
  console.log('============================================\n');
  console.log('Core:');
  console.log('  USDTZChainlink:      ', deployed.usdtz);
  console.log('  PoolManager:         ', deployed.poolManager);
  console.log('  StabilizationFund:   ', deployed.stabilizationFund);
  console.log('\nInfrastructure:');
  console.log('  LiquidityManager:    ', deployed.liquidityManager);
  console.log('  LiquidityVault:      ', deployed.liquidityVault);
  console.log('  ZedxBridge:          ', deployed.bridge);
  console.log('\nPrivacy:');
  console.log('  PrivacyPool:         ', deployed.privacyPool);
  console.log('  PrivacyRegistry:     ', deployed.privacyRegistry);
  console.log('  MerkleTree:          ', deployed.merkleTree);
  console.log('\nDeFi:');
  console.log('  LiquidityMining:     ', deployed.liquidityMining);
  console.log('  PredictionMarket:    ', deployed.predictionMarket);
  console.log('  ReferralSystem:      ', deployed.referralSystem);
  console.log('  FiatOnRamp:          ', deployed.fiatOnRamp);
  console.log('\nExternal (BSC Mainnet):');
  console.log('  PancakeSwap Router:  ', PANCAKE_ROUTER);
  console.log('  PancakeSwap Factory: ', PANCAKE_FACTORY);
  console.log('  WBNB:                ', WBNB);
  console.log('  Chainlink BNB/USD:   ', CHAINLINK_BNB_USD);
  console.log('\nGas Used:', ethers.formatEther(gasUsed), 'BNB');
  console.log('\n============================================');
  console.log('  SAVE THESE ADDRESSES - UPDATE .env FILES');
  console.log('============================================\n');

  // Write addresses to a file for easy reference
  const fs = await import('fs');
  const addressFile = `# USDTZ Mainnet Deployment - ${new Date().toISOString()}
NEXT_PUBLIC_USDTZ_CONTRACT=${deployed.usdtz}
NEXT_PUBLIC_POOL_MANAGER=${deployed.poolManager}
NEXT_PUBLIC_STABILIZATION_FUND=${deployed.stabilizationFund}
NEXT_PUBLIC_LIQUIDITY_MANAGER=${deployed.liquidityManager}
NEXT_PUBLIC_LIQUIDITY_VAULT=${deployed.liquidityVault}
NEXT_PUBLIC_BRIDGE=${deployed.bridge}
NEXT_PUBLIC_PRIVACY_POOL=${deployed.privacyPool}
NEXT_PUBLIC_PRIVACY_REGISTRY=${deployed.privacyRegistry}
NEXT_PUBLIC_LIQUIDITY_MINING=${deployed.liquidityMining}
NEXT_PUBLIC_PREDICTION_MARKET=${deployed.predictionMarket}
NEXT_PUBLIC_REFERRAL_SYSTEM=${deployed.referralSystem}
NEXT_PUBLIC_FIAT_ON_RAMP=${deployed.fiatOnRamp}
NEXT_PUBLIC_MERKLE_TREE=${deployed.merkleTree}
NEXT_PUBLIC_FACTORY=${PANCAKE_FACTORY}
NEXT_PUBLIC_ROUTER=${PANCAKE_ROUTER}
`;
  fs.writeFileSync('../deployment-addresses.env', addressFile);
  console.log('Addresses saved to deployment-addresses.env');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nDEPLOYMENT FAILED:', error.message || error);
    process.exit(1);
  });
