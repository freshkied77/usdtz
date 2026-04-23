const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BSCSCAN_API_KEY = 'KZ8GA84T8TUYTP2GHEA2H82K5DY7WTJ59T';
const COMPILER_VERSION = 'v0.8.17+commit.8df45f5f';
const OPTIMIZATION = true;
const OPTIMIZATION_RUNS = 200;

// Flattened source approach: we flatten each contract and submit
const contracts = [
  { name: 'USDTZChainlink', file: 'USDTZChainlink.sol', address: '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665' },
  { name: 'PoolManager', file: 'PoolManager.sol', address: '0x3c91AF7Cf1f5c44d32A6fF9222a3Ed72845d8E86' },
  { name: 'StabilizationFund', file: 'StabilizationFund.sol', address: '0x23b8450530Be2A3f19Ae2FDD26cA3491C4De192D' },
  { name: 'LiquidityManager', file: 'LiquidityManager.sol', address: '0x6C5212B7D40154ee367f49Dc05d5C7659a544800' },
  { name: 'LiquidityVault', file: 'LiquidityVault.sol', address: '0xdfbe58825699E42D786EBf9B7Ba8F6ab03C1C759' },
  { name: 'ZedxBridge', file: 'CrossChainBridge.sol', address: '0x54C68aB92134167A42d8fF5e46bB1a566fF89BAb' },
  { name: 'PrivacyPool', file: 'PrivacyPool.sol', address: '0xEC41C164E8ED73a915F3282AF6D6E0A8fbEE18e9' },
  { name: 'PrivacyRegistry', file: 'PrivacyPool.sol', address: '0x24348f52f4b981869aDdF9A41f08d5c4dAb72873' },
  { name: 'LiquidityMining', file: 'LiquidityMining.sol', address: '0xD78096854c994741D188B53d3a5C6ef2a877bb1d' },
  { name: 'PredictionMarket', file: 'PredictionMarket.sol', address: '0x7991e75bc6505F3035335a069050d9ccB0a23555' },
  { name: 'ReferralSystem', file: 'ReferralSystem.sol', address: '0x2418D1DaC19fF54A343b605eaA247A4093d4aab2' },
  { name: 'FiatOnRamp', file: 'FiatOnRamp.sol', address: '0x21b37aA4349EAC49dF2985248a2E4DC2faE5c44a' },
  { name: 'MerkleTreeVerification', file: 'PrivacyPool.sol', address: '0xA1097381949cAC9513f8FeFBda905364E0281D46' },
];

async function flattenContract(file) {
  try {
    const result = execSync(`npx hardhat flatten contracts/${file} 2>/dev/null`, {
      cwd: '/home/freshkied/usdt.z/contracts',
      maxBuffer: 5 * 1024 * 1024
    });
    // Remove duplicate SPDX license identifiers (keep first one)
    let flat = result.toString();
    let first = true;
    flat = flat.replace(/\/\/ SPDX-License-Identifier:.*$/gm, (match) => {
      if (first) { first = false; return match; }
      return '';
    });
    // Remove duplicate pragma solidity lines (keep first one)
    let firstPragma = true;
    flat = flat.replace(/^pragma solidity.*$/gm, (match) => {
      if (firstPragma) { firstPragma = false; return match; }
      return '';
    });
    return flat;
  } catch (e) {
    return null;
  }
}

function encodeConstructorArgs(name) {
  const { ethers } = require('ethers');
  const DEPLOYER = '0x75B337d0CdEF5971FE3D24468Fd3dbf074F7a36E';
  const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  const USDT = '0x55d398326f99059fF775485246999027B3197955';
  const CHAINLINK = '0x0567f2324251F7bB9AF2AE3D0cF8881Fb6d7F247';
  const ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
  const FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
  const USDTZ = '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665';
  const POOL_MGR = '0x3c91AF7Cf1f5c44d32A6fF9222a3Ed72845d8E86';
  const PAIR = '0xbAe7EAF2078f053857b472c2cAE4F63D0086b89F';
  const coder = ethers.AbiCoder.defaultAbiCoder();

  const argMap = {
    'USDTZChainlink': coder.encode(['address','address','address'], [CHAINLINK, WBNB, DEPLOYER]),
    'PoolManager': coder.encode(['address','address'], [USDTZ, DEPLOYER]),
    'StabilizationFund': coder.encode(['address','address','address','address','address'], [USDTZ, USDT, WBNB, PAIR, DEPLOYER]),
    'LiquidityManager': coder.encode(['address','address','address','address','address'], [USDTZ, ROUTER, FACTORY, WBNB, DEPLOYER]),
    'LiquidityVault': coder.encode(['address'], [USDTZ]),
    'ZedxBridge': coder.encode(['address','address'], [USDTZ, WBNB]),
    'PrivacyPool': coder.encode(['address','bytes32','uint256','uint256'], [
      ethers.ZeroAddress, ethers.ZeroHash,
      ethers.parseEther('100'), ethers.parseEther('1000')
    ]),
    'PrivacyRegistry': '',
    'LiquidityMining': coder.encode(['address','address'], [USDTZ, DEPLOYER]),
    'PredictionMarket': coder.encode(['address','address','address'], [USDTZ, DEPLOYER, POOL_MGR]),
    'ReferralSystem': coder.encode(['address','address'], [USDTZ, DEPLOYER]),
    'FiatOnRamp': coder.encode(['address','address','address','address'], [USDTZ, WBNB, USDT, DEPLOYER]),
    'MerkleTreeVerification': '',
  };
  return (argMap[name] || '').replace('0x', '');
}

async function verifyContract(contract, flatSource) {
  const https = require('https');
  const querystring = require('querystring');

  const constructorArgs = encodeConstructorArgs(contract.name);

  const params = {
    apikey: BSCSCAN_API_KEY,
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contract.address,
    sourceCode: flatSource,
    codeformat: 'solidity-single-file',
    contractname: contract.name,
    compilerversion: COMPILER_VERSION,
    optimizationUsed: OPTIMIZATION ? '1' : '0',
    runs: OPTIMIZATION_RUNS.toString(),
    constructorArguements: constructorArgs,
    evmversion: 'london',
    licenseType: '3', // MIT
  };

  const postData = querystring.stringify(params);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.bscscan.com',
      path: '/api',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ status: '0', message: 'Parse error', result: data.slice(0, 200) });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(postData);
    req.end();
  });
}

async function checkVerificationStatus(guid) {
  const https = require('https');

  return new Promise((resolve, reject) => {
    const url = `https://api.bscscan.com/api?apikey=${BSCSCAN_API_KEY}&module=contract&action=checkverifystatus&guid=${guid}`;
    https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ status: '0', result: data.slice(0, 200) }); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('\n============================================');
  console.log('  BSCSCAN VERIFICATION (API)');
  console.log('============================================\n');

  // First flatten all unique source files
  const flatCache = {};
  const uniqueFiles = [...new Set(contracts.map(c => c.file))];

  console.log('Flattening source files...');
  for (const file of uniqueFiles) {
    console.log(`  Flattening ${file}...`);
    flatCache[file] = await flattenContract(file);
    if (!flatCache[file]) {
      console.log(`    FAILED to flatten ${file}`);
    }
  }
  console.log('');

  const results = { submitted: [], failed: [] };

  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    const flatSource = flatCache[c.file];
    if (!flatSource) {
      console.log(`[${i+1}/${contracts.length}] ${c.name} - SKIP (no flattened source)`);
      results.failed.push({ name: c.name, error: 'flatten failed' });
      continue;
    }

    console.log(`[${i+1}/${contracts.length}] ${c.name} at ${c.address}`);

    try {
      const response = await verifyContract(c, flatSource);
      console.log(`  Response: ${response.status} - ${response.message} - ${(response.result || '').toString().slice(0, 80)}`);

      if (response.status === '1' && response.result) {
        results.submitted.push({ name: c.name, guid: response.result });
      } else if (response.result && response.result.toString().includes('Already Verified')) {
        console.log('  -> Already verified!');
        results.submitted.push({ name: c.name, guid: 'already-verified' });
      } else {
        results.failed.push({ name: c.name, error: (response.result || response.message || '').toString().slice(0, 100) });
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
      results.failed.push({ name: c.name, error: e.message });
    }

    // BscScan rate limit: 5 requests per second
    await sleep(1500);
  }

  // Wait and check verification status
  if (results.submitted.length > 0) {
    console.log('\nWaiting 30s for verification to complete...');
    await sleep(30000);

    console.log('\nChecking verification status:');
    for (const s of results.submitted) {
      if (s.guid === 'already-verified') {
        console.log(`  ${s.name}: Already verified`);
        continue;
      }
      try {
        const status = await checkVerificationStatus(s.guid);
        console.log(`  ${s.name}: ${status.result || status.message}`);
        await sleep(1000);
      } catch (e) {
        console.log(`  ${s.name}: Check failed - ${e.message}`);
      }
    }
  }

  console.log('\n============================================');
  console.log('  VERIFICATION SUMMARY');
  console.log('============================================');
  console.log(`Submitted: ${results.submitted.length}`);
  console.log(`Failed: ${results.failed.length}`);
  for (const f of results.failed) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
  console.log('\nBscScan Links:');
  for (const c of contracts) {
    console.log(`  ${c.name}: https://bscscan.com/address/${c.address}#code`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
