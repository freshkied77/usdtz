const { execSync } = require('child_process');
const https = require('https');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

const BSCSCAN_API_KEY = 'KZ8GA84T8TUYTP2GHEA2H82K5DY7WTJ59T';
const COMPILER_VERSION = 'v0.8.17+commit.8df45f5f';

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

function flattenContract(file) {
  try {
    const result = execSync(`npx hardhat flatten contracts/${file} 2>/dev/null`, {
      cwd: '/home/freshkied/usdt.z/contracts',
      maxBuffer: 10 * 1024 * 1024
    });
    let flat = result.toString();
    // Remove duplicate SPDX and pragma
    let spdxCount = 0;
    flat = flat.replace(/\/\/ SPDX-License-Identifier:[^\n]*/g, (m) => { spdxCount++; return spdxCount === 1 ? m : ''; });
    let pragmaCount = 0;
    flat = flat.replace(/pragma solidity[^;]*;/g, (m) => { pragmaCount++; return pragmaCount === 1 ? m : ''; });
    return flat;
  } catch (e) {
    console.log('  Flatten error:', e.message?.slice(0, 100));
    return null;
  }
}

function encodeConstructorArgs(name) {
  const ethers = require('ethers');
  const D = '0x75B337d0CdEF5971FE3D24468Fd3dbf074F7a36E';
  const W = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  const U = '0x55d398326f99059fF775485246999027B3197955';
  const CL = '0x0567f2324251F7bB9AF2AE3D0cF8881Fb6d7F247';
  const RT = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
  const FC = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
  const UZ = '0xF682dfB3A4742071c280E7A77f4aE6d4E8F86665';
  const PM = '0x3c91AF7Cf1f5c44d32A6fF9222a3Ed72845d8E86';
  const PR = '0xbAe7EAF2078f053857b472c2cAE4F63D0086b89F';
  const c = ethers.AbiCoder.defaultAbiCoder();
  const m = {
    'USDTZChainlink': c.encode(['address','address','address'], [CL,W,D]),
    'PoolManager': c.encode(['address','address'], [UZ,D]),
    'StabilizationFund': c.encode(['address','address','address','address','address'], [UZ,U,W,PR,D]),
    'LiquidityManager': c.encode(['address','address','address','address','address'], [UZ,RT,FC,W,D]),
    'LiquidityVault': c.encode(['address'], [UZ]),
    'ZedxBridge': c.encode(['address','address'], [UZ,W]),
    'PrivacyPool': c.encode(['address','bytes32','uint256','uint256'], [ethers.ZeroAddress,ethers.ZeroHash,ethers.parseEther('100'),ethers.parseEther('1000')]),
    'PrivacyRegistry': '',
    'LiquidityMining': c.encode(['address','address'], [UZ,D]),
    'PredictionMarket': c.encode(['address','address','address'], [UZ,D,PM]),
    'ReferralSystem': c.encode(['address','address'], [UZ,D]),
    'FiatOnRamp': c.encode(['address','address','address','address'], [UZ,W,U,D]),
    'MerkleTreeVerification': '',
  };
  return (m[name] || '').replace('0x','');
}

function postBscScan(params) {
  const postData = querystring.stringify(params);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.etherscan.io', path: '/v2/api?chainid=56', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
      timeout: 60000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({status:'0',result:data.slice(0,200)}); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(postData);
    req.end();
  });
}

function checkStatus(guid) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.etherscan.io/v2/api?chainid=56&apikey=${BSCSCAN_API_KEY}&module=contract&action=checkverifystatus&guid=${guid}`, {timeout:15000}, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({result:data.slice(0,200)}); } });
    }).on('error', reject);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('\n=== BSCSCAN VERIFICATION ===\n');

  const flatCache = {};
  const uniqueFiles = [...new Set(contracts.map(c => c.file))];
  for (const file of uniqueFiles) {
    process.stdout.write(`Flattening ${file}... `);
    flatCache[file] = flattenContract(file);
    console.log(flatCache[file] ? `${flatCache[file].length} chars` : 'FAILED');
  }
  console.log('');

  const guids = [];

  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    const flat = flatCache[c.file];
    if (!flat) { console.log(`[${i+1}] ${c.name} SKIP`); continue; }

    process.stdout.write(`[${i+1}/${contracts.length}] ${c.name}... `);
    try {
      const resp = await postBscScan({
        apikey: BSCSCAN_API_KEY,
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: c.address,
        sourceCode: flat,
        codeformat: 'solidity-single-file',
        contractname: c.name,
        compilerversion: COMPILER_VERSION,
        optimizationUsed: '1',
        runs: '200',
        constructorArguements: encodeConstructorArgs(c.name),
        evmversion: 'london',
        licenseType: '3',
      });
      const r = (resp.result || '').toString();
      if (resp.status === '1') {
        console.log('Submitted (GUID:', r.slice(0, 20) + '...)');
        guids.push({ name: c.name, guid: r, address: c.address });
      } else if (r.includes('Already Verified')) {
        console.log('Already verified!');
      } else {
        console.log('Error:', r.slice(0, 80));
      }
    } catch(e) {
      console.log('Failed:', e.message);
    }
    await sleep(2000);
  }

  if (guids.length > 0) {
    console.log('\nWaiting 45s for BscScan to process...');
    await sleep(45000);
    console.log('\nVerification results:');
    for (const g of guids) {
      try {
        const s = await checkStatus(g.guid);
        console.log(`  ${g.name}: ${s.result || s.message}`);
      } catch(e) {
        console.log(`  ${g.name}: check failed`);
      }
      await sleep(1500);
    }
  }

  console.log('\n=== BSCSCAN LINKS ===');
  for (const c of contracts) {
    console.log(`${c.name}: https://bscscan.com/address/${c.address}#code`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
