const axios = require('axios');

class PegMaintenanceBot {
    constructor(config = {}) {
        this.config = {
            rpcUrl: config.rpcUrl || process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
            stabilizationFundAddress: config.stabilizationFundAddress || process.env.STABILIZATION_FUND,
            usdtzAddress: config.usdtzAddress || process.env.USDTZ_ADDRESS,
            usdtAddress: config.usdtAddress || '0x55d398326f99059fF775485246999027B3197955',
            privateKey: config.privateKey || process.env.BOT_PRIVATE_KEY,
            walletAddress: config.walletAddress || process.env.BOT_WALLET,
            checkInterval: config.checkInterval || 20000,
            aggressiveMode: config.aggressiveMode || false,
            ...config
        };
        
        this.isRunning = false;
        this.stats = {
            totalCycles: 0,
            buybacksExecuted: 0,
            sellSupportsExecuted: 0,
            failedOperations: 0,
            totalVolume: 0,
            lastActionTime: null,
            lastError: null
        };
        
        this.priceHistory = [];
        this.maxPriceHistory = 60;
    }

    async getMarketPrice() {
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

            const pair = new this.web3.eth.Contract(pairAbi, this.config.pairAddress);
            const reserves = await pair.methods.getReserves().call();
            const token0 = await pair.methods.token0().call();
            
            const usdtzReserve = token0.toLowerCase() === this.config.usdtzAddress.toLowerCase()
                ? reserves.reserve0
                : reserves.reserve1;
            const usdtReserve = token0.toLowerCase() === this.config.usdtzAddress.toLowerCase()
                ? reserves.reserve1
                : reserves.reserve0;

            const price = (BigInt(usdtReserve) * BigInt(1e18)) / BigInt(usdtzReserve);
            return price.toString();
        } catch (error) {
            console.error('[PegBot] Error getting price:', error.message);
            return null;
        }
    }

    async updatePriceHistory(price) {
        this.priceHistory.push({
            price: price,
            timestamp: Date.now()
        });
        
        if (this.priceHistory.length > this.maxPriceHistory) {
            this.priceHistory.shift();
        }
    }

    async getMovingAverage() {
        if (this.priceHistory.length === 0) return null;
        
        let sum = BigInt(0);
        for (const entry of this.priceHistory) {
            sum += BigInt(entry.price);
        }
        
        return (sum / BigInt(this.priceHistory.length)).toString();
    }

    async checkPriceDeviation(currentPrice) {
        const targetPrice = '1000000000000000000';
        const upperBand = '1005000000000000000';
        const lowerBand = '995000000000000000';
        
        const current = BigInt(currentPrice);
        const target = BigInt(targetPrice);
        const upper = BigInt(upperBand);
        const lower = BigInt(lowerBand);
        
        if (current > upper) {
            const deviation = current - target;
            const deviationPercent = (deviation * 100) / target;
            
            return {
                status: 'above_peg',
                deviation: deviation.toString(),
                deviationPercent: Number(deviationPercent) / 100,
                severity: deviationPercent > 500n ? 'high' : deviationPercent > 200n ? 'medium' : 'low'
            };
        } else if (current < lower) {
            const deviation = target - current;
            const deviationPercent = (deviation * 100) / target;
            
            return {
                status: 'below_peg',
                deviation: deviation.toString(),
                deviationPercent: Number(deviationPercent) / 100,
                severity: deviationPercent > 500n ? 'high' : deviationPercent > 200n ? 'medium' : 'low'
            };
        }
        
        return {
            status: 'pegged',
            deviation: '0',
            deviationPercent: 0,
            severity: 'none'
        };
    }

    async executeRebalance(action) {
        try {
            const stabilizationAbi = [
                {
                    "inputs": [],
                    "name": "rebalance",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "checkPegStatus",
                    "outputs": [
                        {"internalType": "string", "name": "status", "type": "string"},
                        {"internalType": "uint256", "name": "currentPrice", "type": "uint256"},
                        {"internalType": "uint256", "name": "deviation", "type": "uint256"},
                        {"internalType": "uint256", "name": "bufferBalance", "type": "uint256"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "bufferUSDT",
                    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "lastRebalanceTime",
                    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ];

            const contract = new this.web3.eth.Contract(stabilizationAbi, this.config.stabilizationFundAddress);
            
            const lastRebalance = await contract.methods.lastRebalanceTime().call();
            const cooldown = 5 * 60;
            
            if (Date.now() / 1000 - Number(lastRebalance) < cooldown) {
                return { success: false, reason: 'Cooldown period active' };
            }
            
            const bufferUSDT = await contract.methods.bufferUSDT().call();
            console.log(`[PegBot] StabilizationFund buffer: ${bufferUSDT} USDT`);
            
            const txData = contract.methods.rebalance().encodeABI();
            
            const gasPrice = await this.web3.eth.getGasPrice();
            
            const tx = {
                from: this.config.walletAddress,
                to: this.config.stabilizationFundAddress,
                data: txData,
                gas: '250000',
                gasPrice: gasPrice
            };

            const signedTx = await this.web3.eth.accounts.signTransaction(tx, this.config.privateKey);
            const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            
            return {
                success: true,
                txHash: receipt.transactionHash,
                action: action
            };
        } catch (error) {
            this.stats.failedOperations++;
            this.stats.lastError = error.message;
            console.error('[PegBot] Rebalance failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async analyzeAndAct() {
        const currentPrice = await this.getMarketPrice();
        if (!currentPrice) return;
        
        await this.updatePriceHistory(currentPrice);
        
        const deviation = await this.checkPriceDeviation(currentPrice);
        const movingAvg = await this.getMovingAverage();
        
        this.stats.totalCycles++;
        
        if (deviation.status === 'pegged') {
            console.log(`[PegBot] Price stable at ${currentPrice}`);
            return;
        }
        
        console.log(`[PegBot] ${deviation.status.toUpperCase()} - Deviation: ${deviation.deviationPercent.toFixed(3)}%`);
        
        if (movingAvg) {
            const movingAvgNum = Number(BigInt(movingAvg) / 1n);
            const currentNum = Number(BigInt(currentPrice) / 1n);
            const trend = currentNum > movingAvgNum ? 'rising' : 'falling';
            console.log(`[PegBot] Trend: ${trend}, Moving Avg: ${movingAvgNum}`);
        }
        
        const shouldAct = this.config.aggressiveMode 
            ? deviation.deviationPercent > 0.3
            : deviation.severity !== 'none';
        
        if (shouldAct) {
            console.log(`[PegBot] Executing ${deviation.status} correction...`);
            
            const result = await this.executeRebalance(deviation.status);
            
            if (result.success) {
                if (deviation.status === 'above_peg') {
                    this.stats.buybacksExecuted++;
                } else {
                    this.stats.sellSupportsExecuted++;
                }
                this.stats.lastActionTime = Date.now();
                console.log(`[PegBot] Correction successful! TX: ${result.txHash}`);
            }
        }
    }

    async start() {
        if (this.isRunning) {
            console.log('[PegBot] Already running');
            return;
        }

        const Web3 = require('web3');
        this.web3 = new Web3(this.config.rpcUrl);

        console.log('[PegBot] Starting peg maintenance bot...');
        console.log(`[PegBot] StabilizationFund: ${this.config.stabilizationFundAddress}`);
        console.log(`[PegBot] Aggressive mode: ${this.config.aggressiveMode}`);
        
        this.isRunning = true;
        
        const runCycle = async () => {
            if (!this.isRunning) return;
            
            try {
                await this.analyzeAndAct();
            } catch (error) {
                console.error('[PegBot] Cycle error:', error.message);
            }
            
            if (this.isRunning) {
                setTimeout(runCycle, this.config.checkInterval);
            }
        };

        runCycle();
        console.log('[PegBot] Started successfully');
    }

    async stop() {
        this.isRunning = false;
        console.log('[PegBot] Stopped');
    }

    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            priceHistorySize: this.priceHistory.length
        };
    }
}

module.exports = PegMaintenanceBot;