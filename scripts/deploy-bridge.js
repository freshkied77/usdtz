const { ethers } = require("hardhat");

const BNB_CHAINLINK_PRICE_FEED = "0x0567F2324251f7Bb9aF2aE3D0cF8881Fb6D7F247";

const CHAIN_CONFIGS = [
  { chainId: 99999, name: "Zedx Chain", bridgeAddress: "0x0000000000000000000000000000000000000000", gasFee: ethers.parseEther("0.01"), minAmount: ethers.parseEther("10"), maxAmount: ethers.parseEther("100000"), transferTimeout: 3600, active: true },
  { chainId: 56, name: "BNB Chain", bridgeAddress: "0x0000000000000000000000000000000000000000", gasFee: ethers.parseEther("0.005"), minAmount: ethers.parseEther("1"), maxAmount: ethers.parseEther("1000000"), transferTimeout: 300, active: true },
  { chainId: 1, name: "Ethereum", bridgeAddress: "0x0000000000000000000000000000000000000000", gasFee: ethers.parseEther("0.02"), minAmount: ethers.parseEther("50"), maxAmount: ethers.parseEther("500000"), transferTimeout: 7200, active: false },
  { chainId: 137, name: "Polygon", bridgeAddress: "0x0000000000000000000000000000000000000000", gasFee: ethers.parseEther("0.01"), minAmount: ethers.parseEther("10"), maxAmount: ethers.parseEther("500000"), transferTimeout: 3600, active: false },
];

const TOP_TOKENS_BSC = [
  { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', allocation: 8 },
  { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', allocation: 8 },
  { symbol: 'BNB', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', allocation: 10 },
  { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', allocation: 6 },
  { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', allocation: 6 },
];

async function main() {
  const [deployer, treasury, user1, user2, user3] = await ethers.getSigners();
  
  console.log("\n========================================");
  console.log("USDTZ Full Deployment with Bridge & Vault");
  console.log("========================================\n");
  
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log("");

  console.log("1. Deploying Mock BNB...");
  const MockBNB = await ethers.getContractFactory("MockBNB");
  const mockBNB = await MockBNB.deploy();
  await mockBNB.waitForDeployment();
  const wbnbAddress = await mockBNB.getAddress();
  console.log("   MockBNB deployed at:", wbnbAddress);

  console.log("\n2. Deploying Mock Price Oracle...");
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const mockPriceOracle = await MockPriceOracle.deploy();
  await mockPriceOracle.waitForDeployment();
  const oracleAddress = await mockPriceOracle.getAddress();
  console.log("   MockPriceOracle deployed at:", oracleAddress);

  console.log("\n3. Deploying USDTZ with Chainlink...");
  const USDTZChainlink = await ethers.getContractFactory("USDTZChainlink");
  const usdtz = await USDTZChainlink.deploy(oracleAddress, wbnbAddress, treasury.address);
  await usdtz.waitForDeployment();
  const usdtzAddress = await usdtz.getAddress();
  console.log("   USDTZ deployed at:", usdtzAddress);
  console.log("   Total Supply:", ethers.formatEther(await usdtz.totalSupply()));

  console.log("\n4. Deploying Liquidity Vault...");
  const LiquidityVault = await ethers.getContractFactory("LiquidityVault");
  const liquidityVault = await LiquidityVault.deploy(usdtzAddress);
  await liquidityVault.waitForDeployment();
  const vaultAddress = await liquidityVault.getAddress();
  console.log("   LiquidityVault deployed at:", vaultAddress);

  console.log("\n5. Deploying CrossChain Bridge with Zedx...");
  const CrossChainBridge = await ethers.getContractFactory("ZedxBridge");
  const crossChainBridge = await CrossChainBridge.deploy(usdtzAddress, wbnbAddress);
  await crossChainBridge.waitForDeployment();
  const bridgeAddress = await crossChainBridge.getAddress();
  console.log("   CrossChainBridge deployed at:", bridgeAddress);

  console.log("\n6. Deploying PancakeSwap Factory...");
  const PancakeSwapFactory = await ethers.getContractFactory("PancakeSwapFactory");
  const factory = await PancakeSwapFactory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("   PancakeSwapFactory deployed at:", factoryAddress);

  console.log("\n7. Deploying PancakeSwap Router...");
  const PancakeSwapRouter = await ethers.getContractFactory("PancakeSwapRouter");
  const router = await PancakeSwapRouter.deploy(factoryAddress, wbnbAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("   PancakeSwapRouter deployed at:", routerAddress);

  console.log("\n8. Deploying Pool Manager...");
  const PoolManager = await ethers.getContractFactory("PoolManager");
  const poolManager = await PoolManager.deploy(usdtzAddress, treasury.address);
  await poolManager.waitForDeployment();
  const poolManagerAddress = await poolManager.getAddress();
  console.log("   PoolManager deployed at:", poolManagerAddress);

  console.log("\n9. Configuring Vault...");
  await liquidityVault.setTreasury(treasury.address);
  await liquidityVault.setCrossChainBridge(bridgeAddress);
  console.log("   Treasury and Bridge configured");

  console.log("\n10. Configuring Bridge...");
  await crossChainBridge.setLiquidityVault(vaultAddress);
  
  const tokenAddresses = TOP_TOKENS_BSC.map(t => t.address);
  for (const token of tokenAddresses) {
    await crossChainBridge.addSupportedToken(token);
  }
  console.log("   Supported tokens added to bridge");
  
  for (const chain of CHAIN_CONFIGS) {
    await crossChainBridge.setChainConfig(
      chain.chainId,
      chain.name,
      chain.bridgeAddress,
      chain.gasFee,
      chain.minAmount,
      chain.maxAmount,
      chain.transferTimeout,
      chain.active
    );
    console.log(`   Chain ${chain.chainId} (${chain.name}) configured`);
  }

  console.log("\n11. Setting up Vault chains...");
  for (const chain of CHAIN_CONFIGS.filter(c => c.active)) {
    await liquidityVault.addSupportedChain(chain.chainId, chain.name, 0);
    console.log(`   Vault chain ${chain.chainId} added`);
  }

  console.log("\n12. Distributing tokens...");
  const totalSupply = await usdtz.totalSupply();
  const halfSupply = totalSupply / 2n;
  
  await usdtz.transfer(vaultAddress, halfSupply);
  console.log("   50% supply (", ethers.formatEther(halfSupply), ") sent to LiquidityVault for LP");
  
  await usdtz.transfer(bridgeAddress, totalSupply / 20n);
  console.log("   5% supply sent to Bridge for cross-chain operations");
  
  await usdtz.transfer(user1.address, totalSupply / 20n);
  await usdtz.transfer(user2.address, totalSupply / 20n);
  await usdtz.transfer(user3.address, totalSupply / 20n);
  console.log("   Tokens allocated to test users");

  console.log("\n13. Setting contract references...");
  await usdtz.setPoolManager(poolManagerAddress);
  await usdtz.setChainlinkEnabled(true);
  console.log("   USDTZ configured");

  console.log("\n========================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log("");
  console.log("Core Contracts:");
  console.log("  USDTZ (Chainlink):    ", usdtzAddress);
  console.log("  PoolManager:          ", poolManagerAddress);
  console.log("");
  console.log("Cross-Chain Infrastructure:");
  console.log("  CrossChainBridge:    ", bridgeAddress);
  console.log("  LiquidityVault:       ", vaultAddress);
  console.log("");
  console.log("DEX Infrastructure:");
  console.log("  PancakeSwap Factory:  ", factoryAddress);
  console.log("  PancakeSwap Router:   ", routerAddress);
  console.log("");
  console.log("Oracle:");
  console.log("  Price Oracle:         ", oracleAddress);
  console.log("  Chainlink Feed:       ", BNB_CHAINLINK_PRICE_FEED);
  console.log("");
  console.log("Network: BNB Smart Chain (Chain ID: 56)");
  console.log("");
  console.log("Cross-Chain Support:");
  console.log("  Zedx Chain (99999):   Active - Primary target");
  console.log("  BNB Chain (56):       Active");
  console.log("  Ethereum (1):         Coming Soon");
  console.log("  Polygon (137):        Coming Soon");
  console.log("");
  console.log("Token Allocation:");
  console.log("  50% -> LiquidityVault for LP pairs");
  console.log("  5%  -> CrossChainBridge reserves");
  console.log("  20% -> Test users");
  console.log("  25% -> Remaining (team/treasury)");
  console.log("");
  console.log("========================================\n");
  
  console.log("IMPORTANT DEPLOYMENT NOTES:");
  console.log("1. Update frontend config with these contract addresses");
  console.log("2. Fund the LiquidityVault with tokens for cross-chain pairs");
  console.log("3. Configure actual Zedx bridge addresses when available");
  console.log("4. Enable additional chains when ready for expansion");
  console.log("5. Set up Chainlink price feeds for production");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nDeployment failed:", error);
    process.exit(1);
  });