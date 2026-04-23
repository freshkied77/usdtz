const { ethers } = require('hardhat');

const USDTZ = '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665';
const STAB_FUND = '0x033fA6AFd3D7af45FBC6d617553178f4773Cba6a';
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const PANCAKE_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('\n=== USDTZ LIQUIDITY v3 (Router approach) ===\n');

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer:', deployer.address);
  console.log('BNB:', ethers.formatEther(balance));

  const erc20ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address, uint256) returns (bool)',
    'function allowance(address, address) view returns (uint256)',
  ];
  const usdtz = new ethers.Contract(USDTZ, erc20ABI, deployer);
  const usdtzBal = await usdtz.balanceOf(deployer.address);
  console.log('USDTZ:', ethers.formatEther(usdtzBal));

  // Use 0.001 BNB for LP, keep rest for gas
  const bnbForLP = ethers.parseEther('0.001');
  // BNB ~$640, so 0.001 BNB = $0.64
  // For $1 peg: need 0.64 USDTZ paired with 0.001 BNB
  const usdtzForLP = ethers.parseEther('0.64');

  console.log('LP: ', ethers.formatEther(usdtzForLP), 'USDTZ +', ethers.formatEther(bnbForLP), 'BNB');

  // Step 1: Approve with max allowance
  console.log('\n[1] Approving router with max allowance...');
  const maxApproval = ethers.MaxUint256;
  const currentAllowance = await usdtz.allowance(deployer.address, PANCAKE_ROUTER);
  console.log('  Current allowance:', ethers.formatEther(currentAllowance));

  if (currentAllowance < usdtzForLP) {
    const approveTx = await usdtz.approve(PANCAKE_ROUTER, maxApproval);
    const approveReceipt = await approveTx.wait();
    console.log('  -> Approved. Gas:', approveReceipt.gasUsed.toString());
  } else {
    console.log('  -> Already approved');
  }

  // Verify allowance
  const newAllowance = await usdtz.allowance(deployer.address, PANCAKE_ROUTER);
  console.log('  New allowance:', newAllowance >= usdtzForLP ? 'sufficient' : 'INSUFFICIENT');

  // Step 2: Add liquidity via router
  console.log('\n[2] Adding liquidity via PancakeSwap Router...');

  const routerABI = [
    'function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)',
    'function WETH() view returns (address)',
  ];
  const router = new ethers.Contract(PANCAKE_ROUTER, routerABI, deployer);

  // Verify WETH matches
  const weth = await router.WETH();
  console.log('  Router WETH:', weth);
  console.log('  Expected WBNB:', WBNB);
  console.log('  Match:', weth.toLowerCase() === WBNB.toLowerCase());

  const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 min

  try {
    // Estimate gas first
    const gasEstimate = await router.addLiquidityETH.estimateGas(
      USDTZ,
      usdtzForLP,
      0,       // accept any minimum
      0,       // accept any minimum
      deployer.address,
      deadline,
      { value: bnbForLP }
    );
    console.log('  Gas estimate:', gasEstimate.toString());

    const tx = await router.addLiquidityETH(
      USDTZ,
      usdtzForLP,
      0,
      0,
      deployer.address,
      deadline,
      {
        value: bnbForLP,
        gasLimit: gasEstimate * 120n / 100n  // 20% buffer
      }
    );
    console.log('  TX:', tx.hash);
    const receipt = await tx.wait();
    console.log('  -> Success! Gas used:', receipt.gasUsed.toString());

    // Parse events
    for (const log of receipt.logs) {
      console.log('  Log:', log.address, log.topics[0]?.slice(0, 10));
    }
  } catch (e) {
    console.error('  REVERT REASON:', e.message?.slice(0, 200));

    // If gas estimation fails, try to decode the error
    if (e.data) {
      console.log('  Error data:', e.data);
    }

    // Try static call to get revert reason
    try {
      await router.addLiquidityETH.staticCall(
        USDTZ,
        usdtzForLP,
        0,
        0,
        deployer.address,
        deadline,
        { value: bnbForLP }
      );
    } catch (e2) {
      console.error('  Static call error:', e2.reason || e2.message?.slice(0, 200));
    }

    process.exit(1);
  }

  // Step 3: Get pair and configure
  console.log('\n[3] Getting pair address...');
  const factoryABI = ['function getPair(address, address) view returns (address)'];
  const factory = new ethers.Contract(PANCAKE_FACTORY, factoryABI, deployer);
  const pairAddress = await factory.getPair(USDTZ, WBNB);
  console.log('  Pair:', pairAddress);

  // Set pair on USDTZ
  console.log('\n[4] Configuring contracts...');
  const usdtzConfigABI = ['function setPairAddress(address)'];
  const usdtzConfig = new ethers.Contract(USDTZ, usdtzConfigABI, deployer);
  const tx5 = await usdtzConfig.setPairAddress(pairAddress);
  await tx5.wait();
  console.log('  -> USDTZChainlink pair set');

  try {
    const stabABI = ['function setPancakePair(address)'];
    const stabFund = new ethers.Contract(STAB_FUND, stabABI, deployer);
    const tx6 = await stabFund.setPancakePair(pairAddress);
    await tx6.wait();
    console.log('  -> StabilizationFund pair set');
  } catch (e) {
    console.log('  -> StabilizationFund skipped');
  }

  // Verify
  const pairABI = ['function getReserves() view returns (uint112, uint112, uint32)', 'function token0() view returns (address)'];
  const pair = new ethers.Contract(pairAddress, pairABI, deployer);
  const [r0, r1] = await pair.getReserves();
  const t0 = await pair.token0();

  console.log('\n=== LIQUIDITY LIVE ===');
  if (t0.toLowerCase() === USDTZ.toLowerCase()) {
    console.log('USDTZ:', ethers.formatEther(r0));
    console.log('WBNB:', ethers.formatEther(r1));
  } else {
    console.log('WBNB:', ethers.formatEther(r0));
    console.log('USDTZ:', ethers.formatEther(r1));
  }
  console.log('Pair:', pairAddress);
  console.log('Remaining BNB:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const fs = require('fs');
  fs.appendFileSync('../deployment-addresses.env', `\nNEXT_PUBLIC_USDTZ_BNB_PAIR=${pairAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('\nFAILED:', e.message?.slice(0, 300) || e); process.exit(1); });
