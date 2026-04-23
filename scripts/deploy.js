import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const MockBNB = await ethers.getContractFactory("MockBNB");
  const mockBNB = await MockBNB.deploy();
  await mockBNB.deployed();
  console.log("MockBNB deployed to:", mockBNB.address);

  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const mockPriceOracle = await MockPriceOracle.deploy();
  await mockPriceOracle.deployed();
  console.log("MockPriceOracle deployed to:", mockPriceOracle.address);

  const USDTZ = await ethers.getContractFactory("USDTZ");
  const usdtz = await USDTZ.deploy(
    mockPriceOracle.address,
    mockBNB.address,
    deployer.address
  );
  await usdtz.deployed();
  console.log("USDTZ deployed to:", usdtz.address);

  const PoolManager = await ethers.getContractFactory("PoolManager");
  const poolManager = await PoolManager.deploy(usdtz.address, deployer.address);
  await poolManager.deployed();
  console.log("PoolManager deployed to:", poolManager.address);

  await usdtz.setPoolManager(poolManager.address);
  console.log("PoolManager set on USDTZ");

  const PancakeSwapFactory = await ethers.getContractFactory("PancakeSwapFactory");
  const factory = await PancakeSwapFactory.deploy(deployer.address);
  await factory.deployed();
  console.log("PancakeSwapFactory deployed to:", factory.address);

  const PancakeSwapRouter = await ethers.getContractFactory("PancakeSwapRouter");
  const router = await PancakeSwapRouter.deploy(factory.address, mockBNB.address);
  await router.deployed();
  console.log("PancakeSwapRouter deployed to:", router.address);

  console.log("\n=== Deployment Summary ===");
  console.log("Network: BSC Mainnet");
  console.log("WBNB:", mockBNB.address);
  console.log("Price Oracle:", mockPriceOracle.address);
  console.log("USDTZ:", usdtz.address);
  console.log("PoolManager:", poolManager.address);
  console.log("Factory:", factory.address);
  console.log("Router:", router.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });