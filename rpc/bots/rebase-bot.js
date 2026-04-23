const axios = require('axios');

class RebaseBot {
    constructor(config = {}) {
        this.config = {
            rpcUrl: config.rpcUrl || process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
            usdtzAddress: config.usdtzAddress || process.env.USDTZ_ADDRESS,
            pairAddress: config.pairAddress || process.env.USDTZ_USDT_PAIR,
            minDeviation: config.minDeviation || 1000000000000,
            maxRebaseAmount: config.maxRebaseAmount || '1000000000000000000',
            checkInterval: config.checkInterval || 30000,
            authorizedWallet: config.authorizedWallet || process.env.AUTHORIZED_WALLET,
            privateKey: config.privateKey || process.env.BOT_PRIVATE_KEY,
            ...config
        };
        
        this.isRunning = false;
        this.lastRebaseTime = 0;
        this.rebaseCooldown = 15 * 60 * 1000;
        this.stats = {
            totalRebases: 0,
            successfulRebases: 0,
            failedRebases: 0,
            lastError: null
        };
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
            console.error('[RebaseBot] Error getting market price:', error.message);
            return null;
        }
    }

    async checkRebaseNeeded() {
        const currentPrice = await this.getMarketPrice();
        if (!currentPrice) return { needed: false, reason: 'Could not fetch price' };

        const targetPrice = '1000000000000000000';
        const upperBound = '1005000000000000000';
        const lowerBound = '995000000000000000';
        
        const current = BigInt(currentPrice);
        const target = BigInt(targetPrice);
        const upper = BigInt(upperBound);
        const lower = BigInt(lowerBound);

        if (current > upper) {
            const deviation = current - target;
            return { 
                needed: true, 
                direction: 'above', 
                deviation: deviation.toString(),
                currentPrice,
                targetPrice
            };
        } else if (current < lower) {
            const deviation = target - current;
            return { 
                needed: true, 
                direction: 'below', 
                deviation: deviation.toString(),
                currentPrice,
                targetPrice
            };
        }

        return { needed: false, reason: 'Price within band', currentPrice };
    }

    async executeRebase() {
        if (Date.now() - this.lastRebaseTime < this.rebaseCooldown) {
            return { success: false, reason: 'Cooldown period active' };
        }

        const rebaseData = await this.checkRebaseNeeded();
        if (!rebaseData.needed) {
            return { success: true, action: 'No rebase needed', currentPrice: rebaseData.currentPrice };
        }

        try {
            const usdtzAbi = [
                {
                    "inputs": [],
                    "name": "rebase",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "autoRebase",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "lastRebaseTimestamp",
                    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [],
                    "name": "rebaseCounter",
                    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                    "stateMutability": "view",
                    "type": "function"
                }
            ];

            const contract = new this.web3.eth.Contract(usdtzAbi, this.config.usdtzAddress);
            
            const lastRebase = await contract.methods.lastRebaseTimestamp().call();
            const rebaseCount = await contract.methods.rebaseCounter().call();
            
            console.log(`[RebaseBot] Current state - Last rebase: ${lastRebase}, Count: ${rebaseCount}`);
            console.log(`[RebaseBot] Executing ${rebaseData.direction} rebase. Deviation: ${rebaseData.deviation}`);

            const txData = contract.methods.autoRebase().encodeABI();
            
            const tx = {
                from: this.config.authorizedWallet,
                to: this.config.usdtzAddress,
                data: txData,
                gas: '200000',
                gasPrice: await this.web3.eth.getGasPrice()
            };

            const signedTx = await this.web3.eth.accounts.signTransaction(tx, this.config.privateKey);
            const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            
            this.lastRebaseTime = Date.now();
            this.stats.successfulRebases++;
            this.stats.totalRebases++;

            console.log(`[RebaseBot] Rebase successful! TX: ${receipt.transactionHash}`);
            
            return {
                success: true,
                direction: rebaseData.direction,
                txHash: receipt.transactionHash,
                newPrice: await this.getMarketPrice()
            };
        } catch (error) {
            this.stats.failedRebases++;
            this.stats.lastError = error.message;
            console.error(`[RebaseBot] Rebase failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async start() {
        if (this.isRunning) {
            console.log('[RebaseBot] Already running');
            return;
        }

        const Web3 = require('web3');
        this.web3 = new Web3(this.config.rpcUrl);

        console.log('[RebaseBot] Starting rebase bot...');
        console.log(`[RebaseBot] Monitoring pair: ${this.config.pairAddress}`);
        console.log(`[RebaseBot] Target: ${this.config.usdtzAddress}`);
        
        this.isRunning = true;
        
        const runCycle = async () => {
            if (!this.isRunning) return;
            
            try {
                const rebaseData = await this.checkRebaseNeeded();
                
                if (rebaseData.needed) {
                    console.log(`[RebaseBot] Rebase needed - ${rebaseData.direction} peg by ${rebaseData.deviation}`);
                    await this.executeRebase();
                } else {
                    console.log(`[RebaseBot] Price stable: ${rebaseData.currentPrice || 'checking...'}`);
                }
            } catch (error) {
                console.error('[RebaseBot] Cycle error:', error.message);
            }
            
            if (this.isRunning) {
                setTimeout(runCycle, this.config.checkInterval);
            }
        };

        runCycle();
        console.log('[RebaseBot] Started successfully');
    }

    async stop() {
        this.isRunning = false;
        console.log('[RebaseBot] Stopped');
    }

    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            lastRebaseTime: this.lastRebaseTime,
            cooldownRemaining: Math.max(0, this.rebaseCooldown - (Date.now() - this.lastRebaseTime))
        };
    }
}

module.exports = RebaseBot;