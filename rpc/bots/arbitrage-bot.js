const axios = require('axios');

class ArbitrageBot {
    constructor(config = {}) {
        this.config = {
            rpcUrl: config.rpcUrl || process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
            usdtzAddress: config.usdtzAddress || process.env.USDTZ_ADDRESS,
            usdtAddress: config.usdtAddress || '0x55d398326f99059fF775485246999027B3197955',
            routerAddress: config.routerAddress || process.env.PANCAKE_ROUTER,
            factoryAddress: config.factoryAddress || process.env.PANCAKE_FACTORY,
            privateKey: config.privateKey || process.env.BOT_PRIVATE_KEY,
            walletAddress: config.walletAddress || process.env.BOT_WALLET,
            minProfitThreshold: config.minProfitThreshold || 10,
            checkInterval: config.checkInterval || 15000,
            maxSlippage: config.maxSlippage || 50,
            maxGasPrice: config.maxGasPrice || 10000000000,
            ...config
        };
        
        this.isRunning = false;
        this.stats = {
            totalChecks: 0,
            opportunitiesFound: 0,
            successfulTrades: 0,
            failedTrades: 0,
            totalProfit: 0,
            lastOpportunityTime: null,
            lastError: null
        };
        
        this.priceCache = {
            usdtzPrice: null,
            bnbPrice: null,
            lastUpdate: null
        };
    }

    async getTokenBalance(tokenAddress, account) {
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
        return await contract.methods.balanceOf(account).call();
    }

    async getPairPrice(pairAddress, tokenIn, tokenOut) {
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
            
            const reserve0 = token0.toLowerCase() === tokenIn.toLowerCase() 
                ? reserves.reserve0 
                : reserves.reserve1;
            const reserve1 = token0.toLowerCase() === tokenIn.toLowerCase() 
                ? reserves.reserve1 
                : reserves.reserve0;

            if (reserve0 === '0') return null;
            
            const price = (BigInt(reserve1) * BigInt(1e18)) / BigInt(reserve0);
            return price.toString();
        } catch (error) {
            return null;
        }
    }

    async findArbitrageOpportunity() {
        this.stats.totalChecks++;
        
        try {
            const pairAddress = this.config.usdtzUsdtPair || await this.getPairForTokens(this.config.usdtzAddress, this.config.usdtAddress);
            
            if (!pairAddress) {
                console.log('[ArbitrageBot] No USDTZ-USDT pair found');
                return null;
            }

            const usdtzPriceInUSDT = await this.getPairPrice(pairAddress, this.config.usdtzAddress, this.config.usdtAddress);
            
            if (!usdtzPriceInUSDT) {
                return null;
            }

            const targetPrice = BigInt('1000000000000000000');
            const currentPrice = BigInt(usdtzPriceInUSDT);
            
            const deviation = currentPrice > targetPrice 
                ? currentPrice - targetPrice 
                : targetPrice - currentPrice;
            
            const deviationPercent = (deviation * BigInt(100)) / targetPrice;
            const minDeviationBps = BigInt(this.config.minProfitThreshold * 100);
            
            if (deviationPercent < minDeviationBps) {
                return null;
            }

            const profitEstimate = (deviation * BigInt(95)) / BigInt(100);
            
            return {
                pairAddress,
                price: usdtzPriceInUSDT,
                deviation: deviation.toString(),
                deviationPercent: deviationPercent.toString(),
                estimatedProfit: profitEstimate.toString(),
                action: currentPrice > targetPrice ? 'sell_usdtz_buy_usdt' : 'buy_usdtz_sell_usdt'
            };
        } catch (error) {
            this.stats.lastError = error.message;
            return null;
        }
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

    async executeTrade(opportunity) {
        try {
            const balance = await this.getTokenBalance(this.config.usdtzAddress, this.config.walletAddress);
            
            if (BigInt(balance) < BigInt('1000000000000000000')) {
                return { success: false, reason: 'Insufficient balance' };
            }

            const tradeAmount = BigInt('1000000000000000000');
            
            const routerAbi = [
                {
                    "inputs": [
                        {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
                        {"internalType": "address[]", "name": "path", "type": "address[]"},
                        {"internalType": "address", "name": "to", "type": "address"},
                        {"internalType": "uint256", "name": "deadline", "type": "uint256"}
                    ],
                    "name": "swapExactTokensForTokens",
                    "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                        {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
                        {"internalType": "address[]", "name": "path", "type": "address[]"},
                        {"internalType": "address", "name": "to", "type": "address"},
                        {"internalType": "uint256", "name": "deadline", "type": "uint256"}
                    ],
                    "name": "swapExactTokensForTokensSupportingFeeOnTransferTokens",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }
            ];

            const router = new this.web3.eth.Contract(routerAbi, this.config.routerAddress);
            
            const path = opportunity.action.includes('sell') 
                ? [this.config.usdtzAddress, this.config.usdtAddress]
                : [this.config.usdtAddress, this.config.usdtzAddress];
            
            const deadline = Math.floor(Date.now() / 1000) + 600;
            const amountOutMin = 0;

            const gasPrice = await this.web3.eth.getGasPrice();
            if (BigInt(gasPrice) > BigInt(this.config.maxGasPrice)) {
                return { success: false, reason: 'Gas price too high' };
            }

            const txData = router.methods.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                tradeAmount,
                amountOutMin,
                path,
                this.config.walletAddress,
                deadline
            ).encodeABI();

            const tx = {
                from: this.config.walletAddress,
                to: this.config.routerAddress,
                data: txData,
                gas: '300000',
                gasPrice: gasPrice
            };

            const signedTx = await this.web3.eth.accounts.signTransaction(tx, this.config.privateKey);
            const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            
            this.stats.successfulTrades++;
            
            return {
                success: true,
                txHash: receipt.transactionHash,
                opportunity: opportunity
            };
        } catch (error) {
            this.stats.failedTrades++;
            this.stats.lastError = error.message;
            console.error('[ArbitrageBot] Trade failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async start() {
        if (this.isRunning) {
            console.log('[ArbitrageBot] Already running');
            return;
        }

        const Web3 = require('web3');
        this.web3 = new Web3(this.config.rpcUrl);

        console.log('[ArbitrageBot] Starting arbitrage bot...');
        console.log(`[ArbitrageBot] Wallet: ${this.config.walletAddress}`);
        
        this.isRunning = true;
        
        const runCycle = async () => {
            if (!this.isRunning) return;
            
            try {
                const opportunity = await this.findArbitrageOpportunity();
                
                if (opportunity) {
                    this.stats.opportunitiesFound++;
                    this.stats.lastOpportunityTime = Date.now();
                    
                    console.log(`[ArbitrageBot] Opportunity found!`);
                    console.log(`  Price deviation: ${opportunity.deviationPercent / 100n}%`);
                    console.log(`  Estimated profit: ${opportunity.estimatedProfit}`);
                    console.log(`  Action: ${opportunity.action}`);
                    
                    const result = await this.executeTrade(opportunity);
                    if (result.success) {
                        console.log(`[ArbitrageBot] Trade successful! TX: ${result.txHash}`);
                    }
                }
            } catch (error) {
                console.error('[ArbitrageBot] Cycle error:', error.message);
            }
            
            if (this.isRunning) {
                setTimeout(runCycle, this.config.checkInterval);
            }
        };

        runCycle();
        console.log('[ArbitrageBot] Started successfully');
    }

    async stop() {
        this.isRunning = false;
        console.log('[ArbitrageBot] Stopped');
    }

    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning
        };
    }
}

module.exports = ArbitrageBot;