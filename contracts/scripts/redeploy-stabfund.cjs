const { ethers } = require('hardhat');

const USDTZ = '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665';
const OLD_STAB = '0x033fA6AFd3D7af45FBC6d617553178f4773Cba6a';
const LIQ_MANAGER = '0x6C5212B7D40154ee367f49Dc05d5C7659a544800';
const PAIR = '0xbAe7EAF2078f053857b472c2cAE4F63D0086b89F';
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('\n=== Redeploy StabilizationFund with setPancakePair ===\n');
  console.log('Deployer:', deployer.address);

  // Check old StabilizationFund USDTZ balance
  const erc20ABI = ['function balanceOf(address) view returns (uint256)', 'function transfer(address, uint256) returns (bool)'];
  const usdtz = new ethers.Contract(USDTZ, erc20ABI, deployer);
  const oldBalance = await usdtz.balanceOf(OLD_STAB);
  console.log('Old StabFund USDTZ:', ethers.formatEther(oldBalance));

  // Deploy new StabilizationFund WITH the pair address
  console.log('\n[1] Deploying new StabilizationFund...');
  const StabilizationFund = await ethers.getContractFactory('StabilizationFund');
  const newStab = await StabilizationFund.deploy(
    USDTZ,
    USDT,
    WBNB,
    PAIR,            // Now set correctly from the start
    deployer.address // treasury
  );
  await newStab.waitForDeployment();
  const newStabAddr = await newStab.getAddress();
  console.log('  -> New StabilizationFund:', newStabAddr);

  // Configure it
  console.log('\n[2] Configuring new StabilizationFund...');
  let tx = await newStab.setLiquidityManager(LIQ_MANAGER);
  await tx.wait();
  console.log('  -> LiquidityManager linked');

  tx = await newStab.setAuthorizedSpender(deployer.address, true);
  await tx.wait();
  console.log('  -> Deployer authorized as spender');

  // Verify pair is set
  const pairAddr = await newStab.pancakePair();
  console.log('  -> Pair address:', pairAddr);

  // Transfer USDTZ from deployer to new StabFund (same amount old one had)
  // The old StabFund had 50M USDTZ but we can't extract from it (no function for that)
  // We'll transfer from deployer's balance instead
  console.log('\n[3] Funding new StabilizationFund...');
  const fundAmount = ethers.parseEther('50000000'); // 50M USDTZ
  const deployerUsdtz = await usdtz.balanceOf(deployer.address);
  console.log('  Deployer USDTZ:', ethers.formatEther(deployerUsdtz));

  if (deployerUsdtz >= fundAmount) {
    tx = await usdtz.transfer(newStabAddr, fundAmount);
    await tx.wait();
    console.log('  -> 50M USDTZ transferred to new StabilizationFund');
  } else {
    console.log('  -> Not enough USDTZ, transferring what\'s available');
    // Transfer a smaller amount
    const halfBal = deployerUsdtz / 8n; // ~50M from 400M
    tx = await usdtz.transfer(newStabAddr, halfBal);
    await tx.wait();
    console.log('  -> Transferred', ethers.formatEther(halfBal), 'USDTZ');
  }

  const newBalance = await usdtz.balanceOf(newStabAddr);
  console.log('  New StabFund USDTZ:', ethers.formatEther(newBalance));

  console.log('\n=== DONE ===');
  console.log('NEW StabilizationFund:', newStabAddr);
  console.log('Pair:', pairAddr);
  console.log('Old StabFund (50M USDTZ locked):', OLD_STAB);

  // Save address
  const fs = require('fs');
  fs.appendFileSync('../deployment-addresses.env',
    `\n# Redeployed StabilizationFund (with setPancakePair)\nNEXT_PUBLIC_STABILIZATION_FUND_V2=${newStabAddr}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('\nFAILED:', e.message || e); process.exit(1); });
