const axios = require('axios');

class RiskScorer {
    constructor(config = {}) {
        this.config = {
            bscScanApiKey: config.bscScanApiKey || process.env.BSCSCAN_API_KEY,
            priceApiUrl: config.priceApiUrl || 'https://api.coingecko.com/api/v3',
            cacheDuration: config.cacheDuration || 30000,
            ...config
        };
        
        this.priceCache = new Map();
        this.userScores = new Map();
        this.positionHistory = new Map();
        
        this.PROTOCOL_CONFIGS = {
            minCollateralRatio: 150,
            liquidationThreshold: 120,
            maxTxGas: 6721900,
            gasMargin: 200000,
            mintFeeBps: 25,
            redeemFeeBps: 25,
            chainlinkCollateralRatio: 1500000000000000000,
            chainlinkLiquidationThreshold: 1200000000000000000
        };
        
        this.volatilityWindow = 24;
        this.priceHistory = new Map();
    }

    async fetchPriceFromAPI(tokenAddress) {
        const cacheKey = `price_${tokenAddress}`;
        const cached = this.priceCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.config.cacheDuration) {
            return cached.price;
        }
        
        try {
            const response = await axios.get(`${this.config.priceApiUrl}/simple/price`, {
                params: {
                    ids: this.getCoingeckoId(tokenAddress),
                    vs_currencies: 'usd'
                },
                timeout: 5000
            });
            
            const price = response.data[this.getCoingeckoId(tokenAddress)]?.usd;
            if (price) {
                this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
                return price;
            }
        } catch (error) {
            console.log(`[RiskScorer] Price fetch failed for ${tokenAddress}, using fallback`);
        }
        
        return this.getFallbackPrice(tokenAddress);
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

    getFallbackPrice(tokenAddress) {
        const fallbackPrices = {
            '0x55d398326f99059fF775485246999027B3197955': 1.0,
            '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56': 1.0,
            '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c': 600,
            '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c': 67000,
            '0x2170Ed0880ac9A755fd29B2688956BD959F933F8': 3500
        };
        return fallbackPrices[tokenAddress.toLowerCase()] || 1.0;
    }

    async updatePriceHistory(tokenAddress, price) {
        if (!this.priceHistory.has(tokenAddress)) {
            this.priceHistory.set(tokenAddress, []);
        }
        
        const history = this.priceHistory.get(tokenAddress);
        history.push({ price, timestamp: Date.now() });
        
        if (history.length > this.volatilityWindow) {
            history.shift();
        }
    }

    calculateVolatility(tokenAddress) {
        const history = this.priceHistory.get(tokenAddress);
        if (!history || history.length < 2) return 0.02;
        
        const prices = history.map(h => h.price);
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
        
        return Math.sqrt(variance) / mean;
    }

    calculateEWMAvolatility(tokenAddress, lambda = 0.94) {
        const history = this.priceHistory.get(tokenAddress);
        if (!history || history.length < 2) return 0.02;
        
        const returns = [];
        for (let i = 1; i < history.length; i++) {
            const ret = (history[i].price - history[i-1].price) / history[i-1].price;
            returns.push(ret);
        }
        
        if (returns.length === 0) return 0.02;
        
        let ewma = returns[0] * returns[0];
        for (let i = 1; i < returns.length; i++) {
            ewma = lambda * ewma + (1 - lambda) * returns[i] * returns[i];
        }
        
        return Math.sqrt(ewma);
    }

    async calculatePositionRisk(collateral, debt, collateralToken, debtToken) {
        const collateralPrice = await this.fetchPriceFromAPI(collateralToken);
        const debtPrice = await this.fetchPriceFromAPI(debtToken);
        
        await this.updatePriceHistory(collateralToken, collateralPrice);
        
        const collateralVolatility = this.calculateEWMAvolatility(collateralToken);
        
        if (debt === 0) {
            return {
                riskScore: 0,
                riskLevel: 'NONE',
                healthFactor: Infinity,
                collateralValue: collateral * collateralPrice,
                debtValue: 0,
                margin: Infinity,
                recommendation: 'No debt position - optimal state'
            };
        }

        const collateralValue = collateral * collateralPrice;
        const debtValue = debt * debtPrice;
        const healthFactor = (collateralValue / debtValue) * 100;

        const baseRiskScore = this.calculateBaseRiskScore(healthFactor);
        const volatilityPenalty = this.calculateVolatilityPenalty(collateralVolatility);
        const concentrationPenalty = this.calculateConcentrationPenalty(collateralValue, collateralValue + debtValue);
        
        const riskScore = Math.min(100, baseRiskScore + volatilityPenalty + concentrationPenalty);

        let riskLevel;
        let recommendation;

        if (healthFactor >= 200) {
            riskLevel = 'EXCELLENT';
            recommendation = 'Position is well collateralized';
        } else if (healthFactor >= this.PROTOCOL_CONFIGS.minCollateralRatio * 100) {
            riskLevel = 'GOOD';
            recommendation = 'Collateral ratio healthy - maintain current position';
        } else if (healthFactor >= this.PROTOCOL_CONFIGS.liquidationThreshold * 100) {
            riskLevel = 'WARNING';
            recommendation = 'Approaching liquidation threshold - consider adding collateral';
        } else if (healthFactor >= 100) {
            riskLevel = 'CRITICAL';
            recommendation = 'HIGH RISK - Add collateral immediately to avoid liquidation';
        } else {
            riskLevel = 'LIQUIDATION_IMMINENT';
            recommendation = 'LIQUIDATION WILL OCCUR - Emergency action required';
        }

        return {
            riskScore: Math.floor(riskScore),
            riskLevel,
            healthFactor: parseFloat(healthFactor.toFixed(2)),
            collateralValue: parseFloat(collateralValue.toFixed(2)),
            debtValue: parseFloat(debtValue.toFixed(2)),
            collateralPrice: parseFloat(collateralPrice.toFixed(6)),
            debtPrice: parseFloat(debtPrice.toFixed(6)),
            volatility: parseFloat((collateralVolatility * 100).toFixed(2)),
            margin: parseFloat((healthFactor - this.PROTOCOL_CONFIGS.liquidationThreshold * 100).toFixed(2)),
            recommendation
        };
    }

    calculateBaseRiskScore(healthFactor) {
        if (healthFactor >= 200) return 10;
        if (healthFactor >= 175) return 20;
        if (healthFactor >= 150) return 35;
        if (healthFactor >= 130) return 50;
        if (healthFactor >= 120) return 65;
        if (healthFactor >= 100) return 80;
        return 95;
    }

    calculateVolatilityPenalty(volatility) {
        if (volatility <= 0.01) return 0;
        if (volatility <= 0.02) return 5;
        if (volatility <= 0.05) return 15;
        if (volatility <= 0.10) return 25;
        return 35;
    }

    calculateConcentrationPenalty(collateralValue, totalValue) {
        if (totalValue === 0) return 0;
        const concentration = collateralValue / totalValue;
        if (concentration >= 0.8) return 20;
        if (concentration >= 0.6) return 10;
        if (concentration >= 0.4) return 5;
        return 0;
    }

    async calculatePortfolioRisk(address, positions) {
        let totalCollateralValue = 0;
        let totalDebtValue = 0;
        const positionRisks = [];

        for (const pos of positions) {
            const result = await this.calculatePositionRisk(
                pos.collateral,
                pos.debt,
                pos.collateralToken,
                pos.debtToken
            );
            
            totalCollateralValue += result.collateralValue;
            totalDebtValue += result.debtValue;

            positionRisks.push({
                token: pos.collateralToken,
                collateralAmount: pos.collateral,
                debtAmount: pos.debt,
                ...result
            });
        }

        const overallHealthFactor = totalDebtValue > 0
            ? (totalCollateralValue / totalDebtValue) * 100
            : 0;

        const diversificationScore = this.calculateDiversificationScore(positions, totalCollateralValue);
        const concentrationRisk = this.calculateConcentrationRisk(positions, totalCollateralValue);
        
        let portfolioRiskScore = this.calculateBaseRiskScore(overallHealthFactor);
        portfolioRiskScore += (1 - diversificationScore) * 15;
        portfolioRiskScore += concentrationRisk;

        return {
            overallRiskScore: Math.min(100, Math.max(0, Math.floor(portfolioRiskScore))),
            overallHealthFactor: parseFloat(overallHealthFactor.toFixed(2)),
            totalCollateralValue: parseFloat(totalCollateralValue.toFixed(2)),
            totalDebtValue: parseFloat(totalDebtValue.toFixed(2)),
            diversificationScore: parseFloat((diversificationScore * 100).toFixed(0)) + '%',
            riskLevel: this.getRiskLevel(portfolioRiskScore),
            positions: positionRisks,
            recommendations: this.getPortfolioRecommendations(portfolioRiskScore, diversificationScore)
        };
    }

    calculateDiversificationScore(positions, totalValue) {
        if (positions.length <= 1 || totalValue === 0) return 1;
        
        const values = positions.map(p => p.collateralValue || 0);
        
        const herfindahlIndex = values.reduce((sum, val) => {
            const share = val / totalValue;
            return sum + (share * share);
        }, 0);
        
        return Math.max(0, 1 - herfindahlIndex);
    }

    calculateConcentrationRisk(positions, totalValue) {
        if (totalValue === 0 || positions.length === 0) return 0;
        
        let maxConcentration = 0;
        for (const pos of positions) {
            const concentration = (pos.collateralValue || 0) / totalValue;
            if (concentration > maxConcentration) {
                maxConcentration = concentration;
            }
        }
        
        if (maxConcentration > 0.8) return 15;
        if (maxConcentration > 0.6) return 10;
        if (maxConcentration > 0.4) return 5;
        return 0;
    }

    getRiskLevel(score) {
        if (score <= 20) return 'EXCELLENT';
        if (score <= 40) return 'GOOD';
        if (score <= 60) return 'MODERATE';
        if (score <= 80) return 'HIGH';
        return 'CRITICAL';
    }

    getPortfolioRecommendations(riskScore, diversificationScore) {
        const recs = [];
        
        if (riskScore > 70) {
            recs.push('CRITICAL: Portfolio at high risk - consider reducing debt positions');
        } else if (riskScore > 50) {
            recs.push('WARNING: Monitor portfolio health closely');
        }
        
        if (diversificationScore < 0.5) {
            recs.push('Improve diversification - spread collateral across multiple assets');
        }
        
        if (recs.length === 0) {
            recs.push('Portfolio health is good - maintain current strategy');
        }
        
        return recs;
    }

    async predictLiquidationRisk(address, positions) {
        const portfolio = await this.calculatePortfolioRisk(address, positions);
        
        let liquidationProbability = 0;
        let timeToLiquidation = null;
        const riskFactors = [];

        for (const pos of portfolio.positions) {
            if (pos.healthFactor < 150) {
                const marginToThreshold = pos.healthFactor - 120;
                const annualVolatility = pos.volatility / 100;
                
                if (annualVolatility > 0) {
                    const daysToThreshold = (marginToThreshold / 100) / annualVolatility * 365;
                    if (!timeToLiquidation || daysToThreshold < timeToLiquidation) {
                        timeToLiquidation = Math.max(0, Math.floor(daysToThreshold));
                    }
                }
                
                const volRisk = Math.min(1, annualVolatility * 5);
                const marginRisk = Math.min(1, (120 - marginToThreshold) / 120);
                const posProb = volRisk * marginRisk * (pos.debtValue / portfolio.totalDebtValue);
                liquidationProbability += posProb;
                
                riskFactors.push({
                    token: pos.token,
                    healthFactor: pos.healthFactor,
                    volatility: pos.volatility,
                    timeToLiquidation: timeToLiquidation
                });
            }
        }

        return {
            liquidationProbability: parseFloat((liquidationProbability * 100).toFixed(2)) + '%',
            estimatedDaysToLiquidation: timeToLiquidation,
            riskFactors: riskFactors,
            riskLevel: liquidationProbability > 0.5 ? 'HIGH' : liquidationProbability > 0.2 ? 'MEDIUM' : 'LOW',
            recommendation: liquidationProbability > 0.5 
                ? 'HIGH LIQUIDATION RISK - Emergency action required'
                : liquidationProbability > 0.2
                    ? 'Moderate risk - monitor closely and prepare collateral'
                    : 'Low liquidation risk - position is stable'
        };
    }

    async generateRiskReport(address, positions) {
        const portfolioRisk = await this.calculatePortfolioRisk(address, positions);
        const liquidationPrediction = await this.predictLiquidationRisk(address, positions);
        
        return {
            address,
            generatedAt: new Date().toISOString(),
            portfolio: portfolioRisk,
            liquidationPrediction,
            protocolConfig: this.PROTOCOL_CONFIGS,
            riskFactors: this.identifyRiskFactors(portfolioRisk),
            protectiveMeasures: this.suggestProtectiveMeasures(portfolioRisk),
            marketContext: await this.getMarketContext()
        };
    }

    identifyRiskFactors(portfolio) {
        const factors = [];
        
        if (portfolio.overallHealthFactor < 150) {
            factors.push('Low collateral ratio relative to protocol minimum');
        }
        
        if (parseInt(portfolio.diversificationScore) < 50) {
            factors.push('Poor diversification - concentrated positions');
        }
        
        const criticalPositions = portfolio.positions.filter(p => 
            ['CRITICAL', 'LIQUIDATION_IMMINENT'].includes(p.riskLevel)
        );
        if (criticalPositions.length > 0) {
            factors.push(`${criticalPositions.length} position(s) at critical risk level`);
        }
        
        const highVolatilityPositions = portfolio.positions.filter(p => p.volatility > 5);
        if (highVolatilityPositions.length > 0) {
            factors.push(`${highVolatilityPositions.length} position(s) with high volatility`);
        }
        
        return factors;
    }

    suggestProtectiveMeasures(portfolio) {
        const measures = [];
        
        if (portfolio.overallHealthFactor < 150) {
            measures.push('Add collateral to increase health factor above 150%');
        }
        
        if (parseInt(portfolio.diversificationScore) < 50) {
            measures.push('Rebalance portfolio to spread risk across multiple assets');
        }
        
        const highRiskPositions = portfolio.positions.filter(p => p.riskScore > 60);
        if (highRiskPositions.length > 0) {
            measures.push(`Reduce debt on ${highRiskPositions.length} high-risk position(s)`);
        }
        
        return measures;
    }

    async getMarketContext() {
        const btcPrice = await this.fetchPriceFromAPI('0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c');
        const ethPrice = await this.fetchPriceFromAPI('0x2170Ed0880ac9A755fd29B2688956BD959F933F8');
        const bnbPrice = await this.fetchPriceFromAPI('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');
        
        return {
            btcPrice,
            ethPrice,
            bnbPrice,
            marketSentiment: this.assessMarketSentiment(btcPrice, ethPrice, bnbPrice)
        };
    }

    assessMarketSentiment(btcPrice, ethPrice, bnbPrice) {
        const btcChange = this.calculatePriceChange('0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c');
        const ethChange = this.calculatePriceChange('0x2170Ed0880ac9A755fd29B2688956BD959F933F8');
        
        const avgChange = (btcChange + ethChange) / 2;
        
        if (avgChange > 0.03) return 'BULLISH';
        if (avgChange < -0.03) return 'BEARISH';
        return 'NEUTRAL';
    }

    calculatePriceChange(tokenAddress) {
        const history = this.priceHistory.get(tokenAddress);
        if (!history || history.length < 2) return 0;
        
        const oldest = history[0].price;
        const newest = history[history.length - 1].price;
        
        return (newest - oldest) / oldest;
    }
}

module.exports = { RiskScorer };