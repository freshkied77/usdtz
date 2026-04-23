const axios = require('axios');

class LiquidityBot {
    constructor(config = {}) {
        this.config = {
            rpcUrl: config.rpcUrl || process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
            usdtzAddress: config.usdtzAddress || process.env.USDTZ_ADDRESS,
            usdtAddress: config.usdtAddress || '0x55d398326f99059fF775485246999027B3197955',
            wbnbAddress: config.wbnbAddress || '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
            routerAddress: config.routerAddress || process.env.PANCAKE_ROUTER,
            factoryAddress: config.factoryAddress || process.env.PANCAKE_FACTORY,
            liquidityManagerAddress: config.liquidityManagerAddress || process.env.LIQUIDITY_MANAGER,
            privateKey: config.privateKey || process.env.BOT_PRIVATE_KEY,
            walletAddress: config.walletAddress || process.env.BOT_WALLET,
            minLiquidityRatio: config.minLiquidityRatio || 30,
            targetLiquidityRatio: config.targetLiquidityRatio || 50,
            checkInterval: config.checkInterval || 45000,
            autoAddEnabled: config.autoAddEnabled !== false,
            ...config
        };
        
        this.isRunning = false;
        this.stats = {
            totalChecks: 0,
            rebalancesExecuted: 0,
            liquidityAdded: 0,
            liquidityRemoved: 0,
            failedOperations: 0,
            lastRebalanceTime: null,
            lastError: null
        };
    }

    async getPairReserves(pairAddress) {
        try {
            const pairAbi = [
                {
                    "inputs": [],
                    "name": "getReserves",
                    "outputs": [
                        {"internalType": "uint112", "name": "reserve0", "type": "uint112"},
                        {"internalType": "uint112", "name": "reserve1", "type": "uint112"},
                        {"internalType": "uint32", "name": "blockTimestampLast", "type": "uint32"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "token0",
                    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ];

            const pair = new this.web3.eth.Contract(pairAbi, pairAddress);
            const reserves = await pair.methods.getReserves().call();
            const token0 = await pair.methods.token0().call();
            
            return {
                reserve0: reserves.reserve0,
                reserve1: reserves.reserve1,
                token0: token0
            };
        } catch (error) {
            return null;
        }
    }

    async getTokenBalance(tokenAddress) {
        const erc20Abi = [
            {
                "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            }
        ];
        
        const contract = new this.web3.eth.Contract(erc20Abi, tokenAddress);
        return await contract.methods.balanceOf(this.config.walletAddress).call();
    }

    async checkLiquidityHealth() {
        const pairAddress = await this.getPairForTokens(this.config.usdtzAddress, this.config.usdtAddress);
        
        if (!pairAddress) {
            return { healthy: false, reason: 'No pair found' };
        }

        const reserves = await this.getPairReserves(pairAddress);
        
        if (!reserves) {
            return { healthy: false, reason: 'Could not fetch reserves' };
        }

        const usdtzReserve = reserves.token0.toLowerCase() === this.config.usdtzAddress.toLowerCase()
            ? reserves.reserve0
            : reserves.reserve1;
        const usdtReserve = reserves.token0.toLowerCase() === this.config.usdtzAddress.toLowerCase()
            ? reserves.reserve1
            : reserves.reserve0;

        const usdtValue = BigInt(usdtReserve) / BigInt(1e18);
        const usdtzValue = BigInt(usdtzReserve) / BigInt(1e18);
        
        const totalLiquidityUSD = Number(usdtValue) + Number(usdtzValue);
        
        const targetRatio = this.config.targetLiquidityRatio;
        const minRatio = this.config.minLiquidityRatio;
        
        let ratio = 0;
        if (Number(usdtzValue) > 0) {
            ratio = (Number(usdtValue) / Number(usdtzValue)) * 100;
        }

        return {
            healthy: ratio >= minRatio && ratio <= targetRatio * 2,
            usdtzReserve: usdtzReserve.toString(),
            usdtReserve: usdtReserve.toString(),
            totalLiquidityUSD,
            usdtToUSDTZRatio: ratio,
            needsRebalance: ratio < minRatio || ratio > targetRatio * 2,
            action: ratio < minRatio ? 'add_usdt_liquidity' : 'remove_excess_liquidity',
            pairAddress
        };
    }

    async getPairForTokens(tokenA, tokenB) {
        try {
            const factoryAbi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "", "type": "address"},
                        {"internalType": "address", "name": "", "type": "address"}
                    ],
                    "name": "getPair",
                    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ];

            const factory = new this.web3.eth.Contract(factoryAbi, this.config.factoryAddress);
            const pair = await factory.methods.getPair(tokenA, tokenB).call();
            
            return pair === '0x0000000000000000000000000000000000000000' ? null : pair;
        } catch (error) {
            return null;
        }
    }

    async addLiquidity(usdtAmount, usdtzAmount) {
        try {
            const routerAbi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "tokenA", "type": "address"},
                        {"internalType": "address", "name": "tokenB", "type": "address"},
                        {"internalType": "uint256", "name": "amountADesired", "type": "uint256"},
                        {"internalType": "uint256", "name": "amountBDesired", "type": "uint256"},
                        {"internalType": "uint256", "name": "amountAMin", "type": "uint256"},
                        {"internalType": "uint256", "name": "amountBMin", "type": "uint256"},
                        {"internalType": "address", "name": "to", "type": "address"},
                        {"internalType": "uint256", "name": "deadline", "type": "uint256"}
                    ],
                    "name": "addLiquidity",
                    "outputs": [
                        {"internalType": "uint256", "name": "amountA", "type": "uint256"},
                        {"internalType": "uint256", "name": "amountB", "type": "uint256"},
                        {"internalType": "uint256", "name": "liquidity", "type": "uint256"}
                    ],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ];

            const router = new this.web3.eth.Contract(routerAbi, this.config.routerAddress);
            const deadline = Math.floor(Date.now() / 1000) + 600;

            const txData = router.methods.addLiquidity(
                this.config.usdtAddress,
                this.config.usdtzAddress,
                usdtAmount,
                usdtzAmount,
                0,
                0,
                this.config.walletAddress,
                deadline
            ).encodeABI();

            const gasPrice = await this.web3.eth.getGasPrice();
            
            const tx = {
                from: this.config.walletAddress,
                to: this.config.routerAddress,
                data: txData,
                gas: '400000',
                gasPrice: gasPrice
            };

            const signedTx = await this.web3.eth.accounts.signTransaction(tx, this.config.privateKey);
            const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            
            return { success: true, txHash: receipt.transactionHash };
        } catch (error) {
            this.stats.failedOperations++;
            this.stats.lastError = error.message;
            return { success: false, error: error.message };
        }
    }

    async removeLiquidity(pairAddress, liquidityAmount) {
        try {
            const pairAbi = [
                {
                    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
                    "name": "balanceOf",
                    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ];

            const pair = new this.web3.eth.Contract(pairAbi, pairAddress);
            const lpBalance = await pair.methods.balanceOf(this.config.walletAddress).call();
            
            if (BigInt(liquidityAmount) > BigInt(lpBalance)) {
                liquidityAmount = lpBalance;
            }

            const routerAbi = [
                {
                    "inputs": [
                        {"internalType": "address", "name": "tokenA", "type": "address"},
                        {"internalType": "address", "name": "tokenB", "type": "address"},
                        {"internalType": "uint256", "name": "liquidity", "type": "uint256"},
                        {"internalType": "uint256", "name": "amountAMin", "type": "uint256"},
                        {"internalType": "uint256", "name": "amountBMin", "type": "uint256"},
                        {"internalType": "address", "name": "to", "type": "address"},
                        {"internalType": "uint256", "name": "deadline", "type": "uint256"}
                    ],
                    "name": "removeLiquidity",
                    "outputs": [
                        {"internalType": "uint256", "name": "amountA", "type": "uint256"},
                        {"internalType": "uint256", "name": "amountB", "type": "uint256"}
                    ],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ];

            const router = new this.web3.eth.Contract(routerAbi, this.config.routerAddress);
            const deadline = Math.floor(Date.now() / 1000) + 600;

            const txData = router.methods.removeLiquidity(
                this.config.usdtAddress,
                this.config.usdtzAddress,
                liquidityAmount,
                0,
                0,
                this.config.walletAddress,
                deadline
            ).encodeABI();

            const gasPrice = await this.web3.eth.getGasPrice();
            
            const tx = {
                from: this.config.walletAddress,
                to: this.config.routerAddress,
                data: txData,
                gas: '400000',
                gasPrice: gasPrice
            };

            const signedTx = await this.web3.eth.accounts.signTransaction(tx, this.config.privateKey);
            const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            
            return { success: true, txHash: receipt.transactionHash };
        } catch (error) {
            this.stats.failedOperations++;
            this.stats.lastError = error.message;
            return { success: false, error: error.message };
        }
    }

    async start() {
        if (this.isRunning) {
            console.log('[LiquidityBot] Already running');
            return;
        }

        const Web3 = require('web3');
        this.web3 = new Web3(this.config.rpcUrl);

        console.log('[LiquidityBot] Starting liquidity management bot...');
        console.log(`[LiquidityBot] Wallet: ${this.config.walletAddress}`);
        console.log(`[LiquidityBot] Auto-add enabled: ${this.config.autoAddEnabled}`);
        
        this.isRunning = true;
        
        const runCycle = async () => {
            if (!this.isRunning) return;
            
            try {
                this.stats.totalChecks++;
                const health = await this.checkLiquidityHealth();
                
                if (!health.healthy && health.needsRebalance) {
                    console.log(`[LiquidityBot] Liquidity needs rebalancing:`);
                    console.log(`  USDT Reserve: ${health.usdtReserve}`);
                    console.log(`  USDTZ Reserve: ${health.usdtzReserve}`);
                    console.log(`  Ratio: ${health.usdtToUSDTZRatio.toFixed(2)}%`);
                    console.log(`  Action needed: ${health.action}`);
                    
                    if (this.config.autoAddEnabled && health.action === 'add_usdt_liquidity') {
                        const usdtBalance = await this.getTokenBalance(this.config.usdtAddress);
                        
                        if (BigInt(usdtBalance) > BigInt('1000000000000000000')) {
                            const addAmount = BigInt(usdtBalance) / BigInt(4);
                            
                            console.log(`[LiquidityBot] Adding ${addAmount.toString()} USDT liquidity...`);
                            const result = await this.addLiquidity(addAmount, 0);
                            
                            if (result.success) {
                                console.log(`[LiquidityBot] Liquidity added! TX: ${result.txHash}`);
                                this.stats.liquidityAdded++;
                                this.stats.rebalancesExecuted++;
                            }
                        }
                    }
                    
                    this.stats.rebalancesExecuted++;
                    this.stats.lastRebalanceTime = Date.now();
                } else {
                    console.log(`[LiquidityBot] Liquidity healthy. Ratio: ${health.usdtToUSDTZRatio?.toFixed(2) || 'N/A'}%`);
                }
            } catch (error) {
                console.error('[LiquidityBot] Cycle error:', error.message);
                this.stats.lastError = error.message;
            }
            
            if (this.isRunning) {
                setTimeout(runCycle, this.config.checkInterval);
            }
        };

        runCycle();
        console.log('[LiquidityBot] Started successfully');
    }

    async stop() {
        this.isRunning = false;
        console.log('[LiquidityBot] Stopped');
    }

    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning
        };
    }
}

module.exports = LiquidityBot;