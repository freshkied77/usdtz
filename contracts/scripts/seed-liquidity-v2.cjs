const { ethers } = require('hardhat');

const USDTZ = '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665';
const STAB_FUND = '0x033fA6AFd3D7af45FBC6d617553178f4773Cba6a';
const PANCAKE_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('\n=== USDTZ LIQUIDITY SEEDING v2 ===\n');

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Deployer:', deployer.address);
  console.log('BNB:', ethers.formatEther(balance));

  const erc20ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address, uint256) returns (bool)',
    'function allowance(address, address) view returns (uint256)',
    'function transfer(address, uint256) returns (bool)',
  ];
  const usdtz = new ethers.Contract(USDTZ, erc20ABI, deployer);
  const usdtzBal = await usdtz.balanceOf(deployer.address);
  console.log('USDTZ:', ethers.formatEther(usdtzBal));

  // Use 0.002 BNB for LP
  const bnbForLP = ethers.parseEther('0.002');
  // At ~$640/BNB, 0.002 BNB = $1.28
  // For $1 peg: pair 1.28 USDTZ with 0.002 BNB
  // But use more USDTZ to be safe with rounding: 1000 USDTZ with 0.002 BNB
  // This sets initial price at 1000/0.002 = 500,000 USDTZ/BNB
  // BNB = $640, so USDTZ = $640/500000 = $0.00128 (NOT $1)
  //
  // For $1 peg: need USDTZ_amount / BNB_amount = BNB_price / USDTZ_target_price
  // USDTZ_amount / 0.002 = 640 / 1
  // USDTZ_amount = 0.002 * 640 = 1.28 USDTZ
  //
  // PancakeSwap minimum: sqrt(1.28e18 * 0.002e18) = sqrt(2.56e33) = ~1.6e16 > 1000 ✓

  const usdtzForLP = ethers.parseEther('1.28');
  console.log('\nPlan: Add', ethers.formatEther(usdtzForLP), 'USDTZ +', ethers.formatEther(bnbForLP), 'BNB');
  console.log('Implied price: $1.00 per USDTZ (assuming BNB=$640)');

  // Step 1: Check if pair exists, if not create it first
  console.log('\n[1] Checking for existing pair...');
  const factoryABI = [
    'function getPair(address, address) view returns (address)',
    'function createPair(address, address) returns (address)',
  ];
  const factory = new ethers.Contract(PANCAKE_FACTORY, factoryABI, deployer);
  let pairAddress = await factory.getPair(USDTZ, WBNB);

  if (pairAddress === ethers.ZeroAddress) {
    console.log('  No pair found. Creating USDTZ/WBNB pair...');
    const createTx = await factory.createPair(USDTZ, WBNB);
    const createReceipt = await createTx.wait();
    pairAddress = await factory.getPair(USDTZ, WBNB);
    console.log('  -> Pair created:', pairAddress);
  } else {
    console.log('  Pair already exists:', pairAddress);
  }

  // Step 2: Transfer tokens directly to pair and mint (bypass router)
  // This is the lowest-level way to add initial liquidity
  console.log('\n[2] Transferring tokens to pair...');

  // Transfer USDTZ to pair
  const tx1 = await usdtz.transfer(pairAddress, usdtzForLP);
  await tx1.wait();
  console.log('  -> Sent', ethers.formatEther(usdtzForLP), 'USDTZ to pair');

  // Transfer BNB as WBNB to pair
  // Need to wrap BNB first by sending to WBNB contract
  const wbnbABI = [
    'function deposit() payable',
    'function transfer(address, uint256) returns (bool)',
    'function balanceOf(address) view returns (uint256)',
  ];
  const wbnb = new ethers.Contract(WBNB, wbnbABI, deployer);

  // Deposit BNB -> WBNB
  const tx2 = await wbnb.deposit({ value: bnbForLP });
  await tx2.wait();
  console.log('  -> Wrapped', ethers.formatEther(bnbForLP), 'BNB -> WBNB');

  // Transfer WBNB to pair
  const tx3 = await wbnb.transfer(pairAddress, bnbForLP);
  await tx3.wait();
  console.log('  -> Sent', ethers.formatEther(bnbForLP), 'WBNB to pair');

  // Step 3: Mint LP tokens
  console.log('\n[3] Minting LP tokens...');
  const pairABI = [
    'function mint(address) returns (uint256)',
    'function getReserves() view returns (uint112, uint112, uint32)',
    'function token0() view returns (address)',
    'function totalSupply() view returns (uint256)',
  ];
  const pair = new ethers.Contract(pairAddress, pairABI, deployer);

  const tx4 = await pair.mint(deployer.address, { gasLimit: 500000 });
  const receipt4 = await tx4.wait();
  console.log('  -> LP tokens minted! Gas:', receipt4.gasUsed.toString());

  // Step 4: Verify reserves
  console.log('\n[4] Verifying pool...');
  const [r0, r1] = await pair.getReserves();
  const token0 = await pair.token0();
  const totalLP = await pair.totalSupply();

  let usdtzReserve, wbnbReserve;
  if (token0.toLowerCase() === USDTZ.toLowerCase()) {
    usdtzReserve = r0;
    wbnbReserve = r1;
  } else {
    usdtzReserve = r1;
    wbnbReserve = r0;
  }

  console.log('  USDTZ Reserve:', ethers.formatEther(usdtzReserve));
  console.log('  WBNB Reserve:', ethers.formatEther(wbnbReserve));
  console.log('  Total LP Supply:', ethers.formatEther(totalLP));

  const impliedPrice = (Number(ethers.formatEther(wbnbReserve)) / Number(ethers.formatEther(usdtzReserve))) * 640;
  console.log('  Implied USDTZ Price: $' + impliedPrice.toFixed(4));

  // Step 5: Configure pair on contracts
  console.log('\n[5] Setting pair on USDTZChainlink...');
  const usdtzConfigABI = ['function setPairAddress(address)'];
  const usdtzConfig = new ethers.Contract(USDTZ, usdtzConfigABI, deployer);
  const tx5 = await usdtzConfig.setPairAddress(pairAddress);
  await tx5.wait();
  console.log('  -> Done');

  // StabilizationFund
  try {
    const stabABI = ['function setPancakePair(address)'];
    const stabFund = new ethers.Contract(STAB_FUND, stabABI, deployer);
    const tx6 = await stabFund.setPancakePair(pairAddress);
    await tx6.wait();
    console.log('  -> StabilizationFund pair set');
  } catch (e) {
    console.log('  -> StabilizationFund skipped');
  }

  // Done
  const finalBal = await ethers.provider.getBalance(deployer.address);
  console.log('\n=== DONE ===');
  console.log('Pair:', pairAddress);
  console.log('Remaining BNB:', ethers.formatEther(finalBal));

  const fs = require('fs');
  fs.appendFileSync('../deployment-addresses.env', `\nNEXT_PUBLIC_USDTZ_BNB_PAIR=${pairAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('\nFAILED:', e.message || e); process.exit(1); });
