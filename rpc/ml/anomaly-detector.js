const axios = require('axios');

class AnomalyDetector {
    constructor(config = {}) {
        this.config = {
            rpcUrl: config.rpcUrl || process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
            priceApiUrl: config.priceApiUrl || 'https://api.coingecko.com/api/v3',
            bscScanApiKey: config.bscScanApiKey || process.env.BSCSCAN_API_KEY,
            detectionThreshold: config.detectionThreshold || 50,
            ...config
        };
        
        this.transactionHistory = [];
        this.addressProfiles = new Map();
        this.networkStats = {
            avgGasPrice: 0,
            avgTxValue: 0,
            txCount: 0,
            lastUpdate: Date.now()
        };
        
        this.Suspicious_PATTERNS = {
            FLASH_LOAN: 'flash_loan',
            RAPID_SWAPS: 'rapid_swaps',
            LARGE_VALUE: 'large_value',
            FREQUENT_BRIDGE: 'frequent_bridge',
            LARGE_USDTZ_PURCHASE: 'large_usdtz_purchase',
            COORDINATED_MOVEMENT: 'coordinated_movement',
            PRICE_MANIPULATION: 'price_manipulation',
            NEW_ACCOUNT_BURST: 'new_account_burst',
            UNUSUAL_TIMING: 'unusual_timing',
            CONTRACT_INTERACTION_SPIKE: 'contract_spike',
            SANDWICH_ATTACK: 'sandwich_attack',
            REENTRANCY_PATTERN: 'reentrancy_pattern'
        };
        
        this.priceCache = new Map();
        this.priceHistory = new Map();
        this.maxPriceHistory = 60;
    }

    async fetchPriceData(tokenAddress) {
        const cacheKey = `price_${tokenAddress}`;
        const cached = this.priceCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < 30000) {
            return cached.price;
        }

        try {
            const coingeckoId = this.getCoingeckoId(tokenAddress);
            const response = await axios.get(
                `${this.config.priceApiUrl}/simple/price`,
                {
                    params: {
                        ids: coingeckoId,
                        vs_currencies: 'usd'
                    },
                    timeout: 5000
                }
            );

            const price = response.data[coingeckoId]?.usd;
            if (price) {
                this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
                return price;
            }
        } catch (error) {
            console.log(`[AnomalyDetector] Price fetch failed for ${tokenAddress}`);
        }
        
        return this.getDefaultPrice(tokenAddress);
    }

    getCoingeckoId(tokenAddress) {
        const tokenMap = {
            '0x55d398326f99059fF775485246999027B3197955': 'tether',
            '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56': 'binance-usd',
            '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c': 'binancecoin',
            '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c': 'bitcoin',
            '0x2170Ed0880ac9A755fd29B2688956BD959F933F8': 'ethereum'
        };
        return tokenMap[tokenAddress.toLowerCase()] || 'tether';
    }

    getDefaultPrice(tokenAddress) {
        const prices = {
            '0x55d398326f99059fF775485246999027B3197955': 1.0,
            '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56': 1.0,
            '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c': 600,
            '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c': 67000,
            '0x2170Ed0880ac9A755fd29B2688956BD959F933F8': 3500
        };
        return prices[tokenAddress.toLowerCase()] || 1.0;
    }

    async updatePriceHistory(tokenAddress) {
        const price = await this.fetchPriceData(tokenAddress);
        
        if (!this.priceHistory.has(tokenAddress)) {
            this.priceHistory.set(tokenAddress, []);
        }
        
        const history = this.priceHistory.get(tokenAddress);
        history.push({ price, timestamp: Date.now() });
        
        if (history.length > this.maxPriceHistory) {
            history.shift();
        }
    }

    calculatePriceVolatility(tokenAddress) {
        const history = this.priceHistory.get(tokenAddress);
        if (!history || history.length < 5) return 0;
        
        const prices = history.map(h => h.price);
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
        
        return Math.sqrt(variance);
    }

    updateNetworkStats(gasPrice, txValue) {
        const now = Date.now();
        const alpha = 0.1;
        
        if (this.networkStats.txCount === 0) {
            this.networkStats.avgGasPrice = gasPrice;
            this.networkStats.avgTxValue = txValue;
        } else {
            this.networkStats.avgGasPrice = alpha * gasPrice + (1 - alpha) * this.networkStats.avgGasPrice;
            this.networkStats.avgTxValue = alpha * txValue + (1 - alpha) * this.networkStats.avgTxValue;
        }
        
        this.networkStats.txCount++;
        this.networkStats.lastUpdate = now;
    }

    updateAddressProfile(address, txData) {
        if (!this.addressProfiles.has(address)) {
            this.addressProfiles.set(address, {
                firstSeen: Date.now(),
                txCount: 0,
                totalVolume: 0,
                avgGasPrice: 0,
                interactions: new Map(),
                lastActivity: Date.now(),
                flags: [],
                usdtzBalance: 0,
                usdtzTransactions: []
            });
        }

        const profile = this.addressProfiles.get(address);
        profile.txCount++;
        profile.totalVolume += txData.value || 0;
        profile.avgGasPrice = (profile.avgGasPrice * (profile.txCount - 1) + (txData.gasPrice || 0)) / profile.txCount;
        profile.lastActivity = Date.now();

        if (txData.to) {
            const count = profile.interactions.get(txData.to) || 0;
            profile.interactions.set(txData.to, count + 1);
        }
        
        if (txData.token === 'USDTZ') {
            profile.usdtzTransactions.push({
                value: txData.value,
                timestamp: Date.now(),
                type: txData.type
            });
            
            if (profile.usdtzTransactions.length > 100) {
                profile.usdtzTransactions.shift();
            }
        }
    }

    detectAnomalies(address, currentTx) {
        const profile = this.addressProfiles.get(address);
        if (!profile) {
            return { 
                isAnomalous: false, 
                risk: 'unknown',
                reasons: ['No historical data for address']
            };
        }

        const anomalies = [];
        let riskScore = 0;

        if (this.isLargeValueTransaction(currentTx)) {
            anomalies.push(this.Suspicious_PATTERNS.LARGE_VALUE);
            riskScore += 30;
        }

        if (this.isRapidSwapPattern(profile, currentTx)) {
            anomalies.push(this.Suspicious_PATTERNS.RAPID_SWAPS);
            riskScore += 25;
        }

        if (this.isFrequentBridgeUsage(profile, currentTx)) {
            anomalies.push(this.Suspicious_PATTERNS.FREQUENT_BRIDGE);
            riskScore += 35;
        }

        if (this.isUnusualTiming(profile, currentTx)) {
            anomalies.push(this.Suspicious_PATTERNS.UNUSUAL_TIMING);
            riskScore += 15;
        }

        if (this.isContractInteractionSpike(profile)) {
            anomalies.push(this.Suspicious_PATTERNS.CONTRACT_INTERACTION_SPIKE);
            riskScore += 20;
        }

        if (this.isNewAccountWithHighActivity(profile)) {
            anomalies.push(this.Suspicious_PATTERNS.NEW_ACCOUNT_BURST);
            riskScore += 40;
        }
        
        if (this.isLargeUSDTZPurchase(profile, currentTx)) {
            anomalies.push(this.Suspicious_PATTERNS.LARGE_USDTZ_PURCHASE);
            riskScore += 35;
        }
        
        if (this.isPriceManipulation(currentTx)) {
            anomalies.push(this.Suspicious_PATTERNS.PRICE_MANIPULATION);
            riskScore += 45;
        }

        const isAnomalous = riskScore >= this.config.detectionThreshold;

        return {
            isAnomalous,
            riskScore: Math.min(100, riskScore),
            risk: riskScore >= 70 ? 'HIGH' : riskScore >= 50 ? 'MEDIUM' : 'LOW',
            reasons: [...new Set(anomalies)],
            profile: {
                txCount: profile.txCount,
                totalVolume: profile.totalVolume,
                age: Date.now() - profile.firstSeen,
                lastActivity: profile.lastActivity,
                interactionCount: profile.interactions.size,
                usdtzTransactionCount: profile.usdtzTransactions.length
            },
            recommendations: this.getRecommendations(anomalies)
        };
    }

    isLargeValueTransaction(tx) {
        if (!this.networkStats.avgTxValue) return false;
        return tx.value > this.networkStats.avgTxValue * 10;
    }

    isRapidSwapPattern(profile, tx) {
        if (!tx.timestamp || !profile.lastActivity) return false;
        const timeDiff = tx.timestamp - profile.lastActivity;
        return timeDiff < 5000 && profile.txCount > 5;
    }

    isFrequentBridgeUsage(profile, tx) {
        const bridgeInteractions = ['CrossChainBridge', 'ZedxBridge'];
        let bridgeCount = 0;
        
        for (const [contract, count] of profile.interactions) {
            if (bridgeInteractions.some(b => contract.includes(b))) {
                bridgeCount += count;
            }
        }
        
        return bridgeCount > 10 && profile.interactions.size > 20;
    }

    isUnusualTiming(profile, tx) {
        if (!tx.timestamp) return false;
        const hour = new Date(tx.timestamp).getHours();
        return (hour >= 2 && hour <= 4) && profile.txCount > 20;
    }

    isContractInteractionSpike(profile) {
        const interactionCount = Array.from(profile.interactions.values()).reduce((a, b) => a + b, 0);
        return interactionCount > 50 && profile.interactions.size < 5;
    }

    isNewAccountWithHighActivity(profile) {
        const ageHours = (Date.now() - profile.firstSeen) / (1000 * 60 * 60);
        return ageHours < 24 && profile.txCount > 50;
    }

    isLargeUSDTZPurchase(profile, tx) {
        if (!tx.token || tx.token !== 'USDTZ') return false;
        
        const recentUSDTZTxs = profile.usdtzTransactions.filter(
            t => Date.now() - t.timestamp < 3600000
        );
        
        const totalUSDTZ = recentUSDTZTxs.reduce((sum, t) => sum + (t.value || 0), 0);
        const avgTransaction = profile.usdtzTransactions.length > 0 
            ? profile.usdtzTransactions.reduce((sum, t) => sum + (t.value || 0), 0) / profile.usdtzTransactions.length
            : 0;
        
        return tx.value > avgTransaction * 5 && recentUSDTZTxs.length > 3;
    }

    async isPriceManipulation(tx) {
        if (!tx.token) return false;
        
        await this.updatePriceHistory(tx.token);
        const volatility = this.calculatePriceVolatility(tx.token);
        
        if (volatility > 0.05) {
            const priceChange = Math.abs(tx.value - this.getDefaultPrice(tx.token)) / this.getDefaultPrice(tx.token);
            if (priceChange > 0.1) {
                return true;
            }
        }
        
        return false;
    }

    getRecommendations(anomalies) {
        const recs = [];
        if (anomalies.includes(this.Suspicious_PATTERNS.LARGE_VALUE)) {
            recs.push('Review transaction with unusually high value');
        }
        if (anomalies.includes(this.Suspicious_PATTERNS.RAPID_SWAPS)) {
            recs.push('Consider implementing rate limiting for rapid swaps');
        }
        if (anomalies.includes(this.Suspicious_PATTERNS.FREQUENT_BRIDGE)) {
            recs.push('Monitor bridge activity - unusually high frequency detected');
        }
        if (anomalies.includes(this.Suspicious_PATTERNS.NEW_ACCOUNT_BURST)) {
            recs.push('New account with high activity - enhanced monitoring recommended');
        }
        if (anomalies.includes(this.Suspicious_PATTERNS.CONTRACT_INTERACTION_SPIKE)) {
            recs.push('Contract interaction spike detected - possible automated activity');
        }
        if (anomalies.includes(this.Suspicious_PATTERNS.LARGE_USDTZ_PURCHASE)) {
            recs.push('Large USDTZ purchase detected - monitor for price impact');
        }
        if (anomalies.includes(this.Suspicious_PATTERNS.PRICE_MANIPULATION)) {
            recs.push('Potential price manipulation - review with Exchange安全团队');
        }
        return recs;
    }

    batchAnalyze(transactions) {
        return transactions.map(tx => ({
            hash: tx.hash,
            ...this.detectAnomalies(tx.from || tx.to, tx)
        }));
    }

    async analyzeFlashLoan(tx) {
        const timeWindow = 300000;
        const recentTxs = this.transactionHistory.filter(
            t => Date.now() - t.timestamp < timeWindow && t.from === tx.from
        );
        
        if (recentTxs.length < 3) return { isFlashLoan: false, confidence: 0 };
        
        const uniqueContracts = new Set(recentTxs.map(t => t.to));
        const interactionsPerContract = recentTxs.length / uniqueContracts.size;
        
        const isFlashLoan = uniqueContracts.size <= 2 && recentTxs.length >= 5 && interactionsPerContract > 3;
        
        return {
            isFlashLoan,
            confidence: isFlashLoan ? 0.85 : 0,
            contractCount: uniqueContracts.size,
            transactionCount: recentTxs.length,
            recommendation: isFlashLoan ? 'Flash loan detected - monitor for arbitrage' : 'Normal activity'
        };
    }

    getNetworkAnomalies() {
        const now = Date.now();
        const recentWindow = 300000;
        
        const recentTxs = this.transactionHistory.filter(
            tx => now - tx.timestamp < recentWindow
        );

        if (recentTxs.length < 10) {
            return { isAnomalous: false, reason: 'Insufficient recent transaction data' };
        }

        const volumes = recentTxs.map(tx => tx.value || 0);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const maxVolume = Math.max(...volumes);
        const minVolume = Math.min(...volumes);

        if (maxVolume > avgVolume * 20) {
            return {
                isAnomalous: true,
                reason: 'Extreme volume outlier detected',
                details: { avgVolume, maxVolume, deviation: maxVolume / avgVolume }
            };
        }

        return { isAnomalous: false, recentTxCount: recentTxs.length };
    }

    async generateSecurityReport(address) {
        const profile = this.addressProfiles.get(address);
        
        if (!profile) {
            return {
                address,
                generatedAt: new Date().toISOString(),
                status: 'unknown',
                message: 'No data available for this address'
            };
        }

        const analysis = this.detectAnomalies(address, { timestamp: Date.now() });
        
        const recentUSDTZTxs = profile.usdtzTransactions.filter(
            t => Date.now() - t.timestamp < 86400000
        );
        
        const volume24h = recentUSDTZTxs.reduce((sum, t) => sum + (t.value || 0), 0);
        
        let riskLevel = 'LOW';
        if (analysis.riskScore >= 70) riskLevel = 'CRITICAL';
        else if (analysis.riskScore >= 50) riskLevel = 'HIGH';
        else if (analysis.riskScore >= 30) riskLevel = 'MEDIUM';

        return {
            address,
            generatedAt: new Date().toISOString(),
            profile: {
                age: `${Math.floor((Date.now() - profile.firstSeen) / 86400000)} days`,
                totalTransactions: profile.txCount,
                totalVolume: profile.totalVolume,
                recentVolume24h: volume24h,
                interactionCount: profile.interactions.size
            },
            riskAssessment: {
                level: riskLevel,
                score: analysis.riskScore,
                anomalies: analysis.reasons,
                recommendations: analysis.recommendations
            },
            transactionPatterns: this.analyzeTransactionPatterns(profile),
            threatDetection: await this.detectThreats(profile)
        };
    }

    analyzeTransactionPatterns(profile) {
        const patterns = {
            automated: false,
            human: true,
            trading: false,
            bridging: false,
            lending: false
        };
        
        const interactionCount = Array.from(profile.interactions.values()).reduce((a, b) => a + b, 0);
        const uniqueContracts = profile.interactions.size;
        
        if (interactionCount > 100 && uniqueContracts < 5) {
            patterns.automated = true;
            patterns.human = false;
        }
        
        if (profile.usdtzTransactions.length > 10) {
            patterns.trading = true;
        }
        
        const bridgeContracts = ['CrossChainBridge', 'ZedxBridge'];
        for (const [contract] of profile.interactions) {
            if (bridgeContracts.some(b => contract.includes(b))) {
                patterns.bridging = true;
                break;
            }
        }
        
        return patterns;
    }

    async detectThreats(profile) {
        const threats = [];
        
        const ageHours = (Date.now() - profile.firstSeen) / (1000 * 60 * 60);
        if (ageHours < 1 && profile.txCount > 20) {
            threats.push({
                type: 'suspicious_new_account',
                severity: 'HIGH',
                description: 'Very new account with high transaction volume'
            });
        }
        
        const largeTxs = profile.usdtzTransactions.filter(t => t.value > 1000000);
        if (largeTxs.length > 5) {
            threats.push({
                type: 'large_transaction_spike',
                severity: 'MEDIUM',
                description: `${largeTxs.length} large USDTZ transactions detected`
            });
        }
        
        return threats;
    }
}

module.exports = { AnomalyDetector };