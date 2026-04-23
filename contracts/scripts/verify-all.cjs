const { run, ethers } = require('hardhat');

const DEPLOYER = '0x75B337d0CdEF5971FE3D24468Fd3dbf074F7a36E';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const CHAINLINK_BNB_USD = '0x0567f2324251F7bB9AF2AE3D0cF8881Fb6d7F247';
const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const PANCAKE_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';

const contracts = [
  {
    name: 'USDTZChainlink',
    address: '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665',
    args: [CHAINLINK_BNB_USD, WBNB, DEPLOYER],
    contract: 'contracts/USDTZChainlink.sol:USDTZChainlink'
  },
  {
    name: 'PoolManager',
    address: '0x3c91AF7Cf1f5c44d32A6fF9222a3Ed72845d8E86',
    args: ['0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665', DEPLOYER],
    contract: 'contracts/PoolManager.sol:PoolManager'
  },
  {
    name: 'StabilizationFund (v2)',
    address: '0x23b8450530Be2A3f19Ae2FDD26cA3491C4De192D',
    args: [
      '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665',
      USDT,
      WBNB,
      '0xbAe7EAF2078f053857b472c2cAE4F63D0086b89F', // pair address
      DEPLOYER
    ],
    contract: 'contracts/StabilizationFund.sol:StabilizationFund'
  },
  {
    name: 'LiquidityManager',
    address: '0x6C5212B7D40154ee367f49Dc05d5C7659a544800',
    args: [
      '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665',
      PANCAKE_ROUTER,
      PANCAKE_FACTORY,
      WBNB,
      DEPLOYER
    ],
    contract: 'contracts/LiquidityManager.sol:LiquidityManager'
  },
  {
    name: 'LiquidityVault',
    address: '0xdfbe58825699E42D786EBf9B7Ba8F6ab03C1C759',
    args: ['0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665'],
    contract: 'contracts/LiquidityVault.sol:LiquidityVault'
  },
  {
    name: 'ZedxBridge',
    address: '0x54C68aB92134167A42d8fF5e46bB1a566fF89BAb',
    args: ['0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665', WBNB],
    contract: 'contracts/CrossChainBridge.sol:ZedxBridge'
  },
  {
    name: 'PrivacyPool',
    address: '0xEC41C164E8ED73a915F3282AF6D6E0A8fbEE18e9',
    args: [
      ethers.ZeroAddress,
      ethers.ZeroHash,
      ethers.parseEther('100'),
      ethers.parseEther('1000')
    ],
    contract: 'contracts/PrivacyPool.sol:PrivacyPool'
  },
  {
    name: 'PrivacyRegistry',
    address: '0x24348f52f4b981869aDdF9A41f08d5c4dAb72873',
    args: [],
    contract: 'contracts/PrivacyPool.sol:PrivacyRegistry'
  },
  {
    name: 'LiquidityMining',
    address: '0xD78096854c994741D188B53d3a5C6ef2a877bb1d',
    args: ['0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665', DEPLOYER],
    contract: 'contracts/LiquidityMining.sol:LiquidityMining'
  },
  {
    name: 'PredictionMarket',
    address: '0x7991e75bc6505F3035335a069050d9ccB0a23555',
    args: [
      '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665',
      DEPLOYER,
      '0x3c91AF7Cf1f5c44d32A6fF9222a3Ed72845d8E86'
    ],
    contract: 'contracts/PredictionMarket.sol:PredictionMarket'
  },
  {
    name: 'ReferralSystem',
    address: '0x2418D1DaC19fF54A343b605eaA247A4093d4aab2',
    args: ['0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665', DEPLOYER],
    contract: 'contracts/ReferralSystem.sol:ReferralSystem'
  },
  {
    name: 'FiatOnRamp',
    address: '0x21b37aA4349EAC49dF2985248a2E4DC2faE5c44a',
    args: [
      '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665',
      WBNB,
      USDT,
      DEPLOYER
    ],
    contract: 'contracts/FiatOnRamp.sol:FiatOnRamp'
  },
  {
    name: 'MerkleTreeVerification',
    address: '0xA1097381949cAC9513f8FeFBda905364E0281D46',
    args: [],
    contract: 'contracts/PrivacyPool.sol:MerkleTreeVerification'
  },
];

async function main() {
  console.log('\n============================================');
  console.log('  BSCSCAN CONTRACT VERIFICATION');
  console.log('============================================\n');

  const results = { verified: [], failed: [], skipped: [] };

  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    console.log(`[${i + 1}/${contracts.length}] Verifying ${c.name} at ${c.address}...`);

    try {
      await run('verify:verify', {
        address: c.address,
        constructorArguments: c.args,
        contract: c.contract,
      });
      console.log(`  -> VERIFIED\n`);
      results.verified.push(c.name);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('Already Verified') || msg.includes('already verified')) {
        console.log(`  -> Already verified\n`);
        results.skipped.push(c.name);
      } else {
        console.log(`  -> FAILED: ${msg.slice(0, 120)}\n`);
        results.failed.push({ name: c.name, error: msg.slice(0, 120) });
      }
    }
  }

  console.log('\n============================================');
  console.log('  VERIFICATION SUMMARY');
  console.log('============================================');
  console.log(`Verified: ${results.verified.length} - ${results.verified.join(', ') || 'none'}`);
  console.log(`Already verified: ${results.skipped.length} - ${results.skipped.join(', ') || 'none'}`);
  console.log(`Failed: ${results.failed.length}`);
  for (const f of results.failed) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
  console.log('');

  // Print BscScan links
  console.log('BscScan Links:');
  for (const c of contracts) {
    console.log(`  ${c.name}: https://bscscan.com/address/${c.address}#code`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
