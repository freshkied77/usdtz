const { ethers } = require("hardhat");

// PancakeSwap V3 BSC addresses
const V3_POSITION_MANAGER = "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364";
const V3_FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";

// Tokens
const USDTZ = "0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665";       // $1.00
const USDT_Z_BRIDGED = "0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4"; // $0.00768

// Pool config
const FEE_TIER = 2500;       // 0.25% — appropriate for different-priced tokens
const TICK_SPACING = 50;     // tick spacing for 0.25% fee tier
const LIQUIDITY_AMOUNT = ethers.parseEther("100000"); // 100,000 USDTZ

// Sort tokens — V3 requires token0 < token1 by address
const token0 = USDT_Z_BRIDGED.toLowerCase() < USDTZ.toLowerCase() ? USDT_Z_BRIDGED : USDTZ;
const token1 = token0 === USDT_Z_BRIDGED ? USDTZ : USDT_Z_BRIDGED;
// token0 = USDT.z (0x4BE3...), token1 = USDTZ (0xF682...)

// Price: how many token1 (USDTZ) per token0 (USDT.z) = 0.00768
// Because 1 USDT.z = $0.00768 and 1 USDTZ = $1.00, so 1 USDT.z buys 0.00768 USDTZ
const PRICE = 0.00768;

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)",
];

const POSITION_MANAGER_ABI = [
  "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) payable returns (address pool)",
  "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  "function multicall(bytes[] data) payable returns (bytes[] results)",
];

const POOL_ABI = [
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint32 feeProtocol, bool unlocked)",
  "function tickSpacing() view returns (int24)",
];

function priceToSqrtPriceX96(price) {
  const sqrtPrice = Math.sqrt(price);
  const Q96 = 2n ** 96n;
  // Use high precision: multiply first, then convert
  const numerator = BigInt(Math.round(sqrtPrice * 1e18));
  const denominator = BigInt(1e18);
  return (numerator * Q96) / denominator;
}

function priceToTick(price) {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

function nearestUsableTick(tick, tickSpacing) {
  return Math.round(tick / tickSpacing) * tickSpacing;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n================================================");
  console.log("PancakeSwap V3 Pool: USDTZ / USDT.z (Bridged)");
  console.log("================================================\n");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  const usdtz = new ethers.Contract(USDTZ, ERC20_ABI, deployer);
  const usdtzBridged = new ethers.Contract(USDT_Z_BRIDGED, ERC20_ABI, deployer);
  const factory = new ethers.Contract(V3_FACTORY, FACTORY_ABI, deployer);
  const positionManager = new ethers.Contract(V3_POSITION_MANAGER, POSITION_MANAGER_ABI, deployer);

  // Verify tokens
  const sym0 = await usdtzBridged.symbol();
  const sym1 = await usdtz.symbol();
  console.log(`\ntoken0: ${sym0} (${USDT_Z_BRIDGED}) — $0.00768`);
  console.log(`token1: ${sym1} (${USDTZ}) — $1.00`);
  console.log(`Price: 1 ${sym0} = ${PRICE} ${sym1}`);

  // Check USDTZ balance
  const balance = await usdtz.balanceOf(deployer.address);
  console.log(`\n${sym1} balance: ${ethers.formatEther(balance)}`);
  if (balance < LIQUIDITY_AMOUNT) {
    console.error(`ERROR: Insufficient ${sym1} balance. Need 100,000, have ${ethers.formatEther(balance)}`);
    process.exit(1);
  }

  // Check if pool already exists
  const existingPool = await factory.getPool(token0, token1, FEE_TIER);
  console.log(`\nExisting pool at fee ${FEE_TIER}: ${existingPool}`);

  // Compute sqrtPriceX96
  const sqrtPriceX96 = priceToSqrtPriceX96(PRICE);
  console.log(`\nsqrtPriceX96: ${sqrtPriceX96}`);

  const currentTick = priceToTick(PRICE);
  const snappedTick = nearestUsableTick(currentTick, TICK_SPACING);
  console.log(`Current tick: ${currentTick} (snapped: ${snappedTick})`);

  // ======================================================
  // STEP 1: Create and initialize pool
  // ======================================================
  if (existingPool === "0x0000000000000000000000000000000000000000") {
    console.log("\n--- Step 1: Creating and initializing pool ---");
    const tx1 = await positionManager.createAndInitializePoolIfNecessary(
      token0, token1, FEE_TIER, sqrtPriceX96,
      { gasLimit: 5000000 }
    );
    console.log("Create pool tx:", tx1.hash);
    const receipt1 = await tx1.wait();
    console.log("Pool created! Gas used:", receipt1.gasUsed.toString());

    const newPool = await factory.getPool(token0, token1, FEE_TIER);
    console.log("New pool address:", newPool);
  } else {
    console.log("\nPool already exists, reading current state...");
    const pool = new ethers.Contract(existingPool, POOL_ABI, deployer);
    const slot0 = await pool.slot0();
    console.log("Current sqrtPriceX96:", slot0.sqrtPriceX96.toString());
    console.log("Current tick:", slot0.tick.toString());
  }

  // ======================================================
  // STEP 2: Approve USDTZ spending
  // ======================================================
  console.log("\n--- Step 2: Approving USDTZ for PositionManager ---");
  const currentAllowance = await usdtz.allowance(deployer.address, V3_POSITION_MANAGER);
  if (currentAllowance < LIQUIDITY_AMOUNT) {
    const tx2 = await usdtz.approve(V3_POSITION_MANAGER, LIQUIDITY_AMOUNT);
    console.log("Approve tx:", tx2.hash);
    await tx2.wait();
    console.log("Approved!");
  } else {
    console.log("Already approved.");
  }

  // ======================================================
  // STEP 3: Mint one-sided position (USDTZ only = token1)
  // ======================================================
  // To deposit only token1 (USDTZ), the range must be BELOW the current tick
  // so that the current price is ABOVE the range
  //
  // We set a reasonable range below the current price:
  //   tickUpper = snappedTick (at current price — position starts getting used immediately)
  //   tickLower = snappedTick - 5000 (wide range below for deep liquidity)
  //
  const tickUpper = snappedTick;
  const tickLower = snappedTick - 5000;

  console.log("\n--- Step 3: Minting one-sided position ---");
  console.log(`Tick range: [${tickLower}, ${tickUpper}]`);
  console.log(`Depositing: 100,000 ${sym1} (token1 only)`);
  console.log(`amount0Desired (${sym0}): 0`);
  console.log(`amount1Desired (${sym1}): ${ethers.formatEther(LIQUIDITY_AMOUNT)}`);

  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

  const mintParams = {
    token0: token0,
    token1: token1,
    fee: FEE_TIER,
    tickLower: tickLower,
    tickUpper: tickUpper,
    amount0Desired: 0,
    amount1Desired: LIQUIDITY_AMOUNT,
    amount0Min: 0,
    amount1Min: 0,
    recipient: deployer.address,
    deadline: deadline,
  };

  const tx3 = await positionManager.mint(mintParams, { gasLimit: 5000000 });
  console.log("Mint tx:", tx3.hash);
  const receipt3 = await tx3.wait();
  console.log("Position minted! Gas used:", receipt3.gasUsed.toString());

  // Parse the mint event to get tokenId
  console.log("\n================================================");
  console.log("V3 POOL CREATED SUCCESSFULLY");
  console.log("================================================");
  console.log(`Pool: ${sym1} / ${sym0}`);
  console.log(`Fee: ${FEE_TIER / 10000}%`);
  console.log(`Liquidity: 100,000 ${sym1}`);
  console.log(`Tick range: [${tickLower}, ${tickUpper}]`);
  console.log(`Tx: https://bscscan.com/tx/${tx3.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nError:", error.message || error);
    process.exit(1);
  });
