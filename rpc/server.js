require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Web3 } = require('web3');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const jwt = require('jsonwebtoken');

const mlRoutes = require('./routes/ml');

const app = express();
const PORT = process.env.PORT || 3001;

const BSC_RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const BSC_CHAIN_ID = 56;
const JWT_SECRET = process.env.JWT_SECRET || 'usdtz-secure-secret-key-change-in-production';

const web3 = new Web3(new Web3.providers.HttpProvider(BSC_RPC_URL));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: ['https://usdtz.finance', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false
});

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.apiKey = decoded.apiKey;
    req.clientId = decoded.clientId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.post('/api/v1/auth', authLimiter, (req, res) => {
  const { apiKey, clientSecret } = req.body;
  
  if (!apiKey || !clientSecret) {
    return res.status(400).json({ error: 'API key and secret required' });
  }
  
  const validClients = {
    'usdtz-web': 'secure-client-secret-web',
    'usdtz-mobile': 'secure-client-secret-mobile',
    'usdtz-internal': 'secure-client-secret-internal'
  };
  
  if (validClients[apiKey] && validClients[apiKey] === clientSecret) {
    const token = jwt.sign(
      { apiKey, clientId: apiKey, iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      token,
      expiresIn: 86400,
      endpoints: {
        eth_call: '/api/v1/call',
        eth_sendRawTransaction: '/api/v1/send',
        eth_getBalance: '/api/v1/balance',
        eth_getBlockByNumber: '/api/v1/block',
        eth_getTransactionReceipt: '/api/v1/receipt'
      }
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/v1/call', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const { method, params, id } = req.body;
    
    if (!method || !params) {
      return res.status(400).json({ error: 'Method and params required' });
    }
    
    const cacheKey = `cache:${method}:${JSON.stringify(params)}`;
    
    const result = await web3.eth.call({
      to: params[0] || null,
      data: params[1] || null
    });
    
    res.json({
      jsonrpc: '2.0',
      id: id || 1,
      result
    });
  } catch (error) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.message
      }
    });
  }
});

app.post('/api/v1/send', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const { signedTransaction } = req.body;
    
    if (!signedTransaction) {
      return res.status(400).json({ error: 'Signed transaction required' });
    }
    
    const txHash = await web3.eth.sendSignedTransaction(signedTransaction);
    
    res.json({
      jsonrpc: '2.0',
      id: 1,
      result: txHash
    });
  } catch (error) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.message
      }
    });
  }
});

app.post('/api/v1/balance', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }
    
    const balance = await web3.eth.getBalance(address);
    
    res.json({
      jsonrpc: '2.0',
      id: 1,
      result: balance
    });
  } catch (error) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.message
      }
    });
  }
});

app.post('/api/v1/block', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const { blockNumber } = req.body;
    
    const block = await web3.eth.getBlock(blockNumber || 'latest');
    
    res.json({
      jsonrpc: '2.0',
      id: 1,
      result: block
    });
  } catch (error) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.message
      }
    });
  }
});

app.post('/api/v1/receipt', authMiddleware, apiLimiter, async (req, res) => {
  try {
    const { txHash } = req.body;
    
    if (!txHash) {
      return res.status(400).json({ error: 'Transaction hash required' });
    }
    
    const receipt = await web3.eth.getTransactionReceipt(txHash);
    
    res.json({
      jsonrpc: '2.0',
      id: 1,
      result: receipt
    });
  } catch (error) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.message
      }
    });
  }
});

app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    chainId: BSC_CHAIN_ID,
    connected: web3.currentProvider?.connected || false,
    version: '1.0.0'
  });
});

app.get('/api/v1/gas-price', authMiddleware, async (req, res) => {
  try {
    const gasPrice = await web3.eth.getGasPrice();
    const priorityFee = await web3.eth.getMaxPriorityFeePerGas();
    
    res.json({
      jsonrpc: '2.0',
      id: 1,
      result: {
        standard: web3.utils.fromWei(gasPrice, 'gwei'),
        priority: web3.utils.fromWei(priorityFee, 'gwei'),
        baseFee: web3.utils.fromWei(gasPrice, 'gwei')
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Internal server error'
    }
  });
});

app.use('/api/v1', mlRoutes);

const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   USDTZ Private RPC Server                                 ║
║   Running on port ${PORT}                                    ║
║                                                           ║
║   Endpoints:                                              ║
  ║   - POST /api/v1/auth        - Authenticate               ║
  ║   - POST /api/v1/call        - eth_call                   ║
  ║   - POST /api/v1/send        - eth_sendRawTransaction     ║
  ║   - POST /api/v1/balance     - eth_getBalance            ║
  ║   - POST /api/v1/block       - eth_getBlockByNumber      ║
  ║   - POST /api/v1/receipt     - eth_getTransactionReceipt ║
  ║   - GET  /api/v1/health     - Health check              ║
  ║   - GET  /api/v1/gas-price  - Current gas price         ║
  ║   ML Endpoints:                                          ║
  ║   - POST /api/v1/ml/liquidation/predict  - Predict liquidation
  ║   - POST /api/v1/ml/anomaly/detect       - Detect anomalies
  ║   - POST /api/v1/ml/risk/portfolio       - Portfolio risk
  ║   - POST /api/v1/ml/risk/report          - Full risk report
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;