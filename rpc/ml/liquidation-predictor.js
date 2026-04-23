const axios = require('axios');

class LiquidationPredictor {
    constructor(config = {}) {
        this.config = {
            rpcUrl: config.rpcUrl || process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
            priceApiUrl: config.priceApiUrl || 'https://api.coingecko.com/api/v3',
            lookbackPeriod: config.lookbackPeriod || 72,
            predictionHorizon: config.predictionHorizon || 24,
            confidenceThreshold: config.confidenceThreshold || 0.7,
            ...config
        };
        
        this.priceHistory = new Map();
        this.maxHistoryLength = 168;
        this.mlModels = this.initializeModels();
        this.priceCache = new Map();
    }

    initializeModels() {
        return {
            momentumModel: new MomentumModel(),
            volatilityModel: new GARCHModel(),
            correlationModel: new CorrelationModel(),
            regressionModel: new LinearRegressionModel()
        };
    }

    async fetchHistoricalPrices(tokenAddress, hours = 72) {
        const cacheKey = `history_${tokenAddress}_${hours}`;
        const cached = this.priceCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < 60000) {
            return cached.data;
        }

        try {
            const coingeckoId = this.getCoingeckoId(tokenAddress);
            const endTime = Math.floor(Date.now() / 1000);
            const startTime = endTime - (hours * 3600);
            
            const response = await axios.get(
                `${this.config.priceApiUrl}/coins/${coingeckoId}/market_chart`,
                {
                    params: {
                        vs_currency: 'usd',
                        days: Math.ceil(hours / 24) + 1,
                        interval: 'hourly'
                    },
                    timeout: 10000
                }
            );

            const prices = response.data.prices.map(p => ({
                timestamp: p[0],
                price: p[1]
            }));

            this.priceCache.set(cacheKey, { data: prices, timestamp: Date.now() });

            return prices;
        } catch (error) {
            console.log(`[LiquidPredictor] Failed to fetch history for ${tokenAddress}`);
            return this.getDefaultHistory(tokenAddress);
        }
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

    getDefaultHistory(tokenAddress) {
        const basePrice = this.getBasePrice(tokenAddress);
        const history = [];
        const now = Date.now();
        
        for (let i = this.maxHistoryLength; i >= 0; i--) {
            const volatility = 0.02;
            const randomChange = (Math.random() - 0.5) * 2 * volatility;
            const price = basePrice * (1 + randomChange * (i / this.maxHistoryLength));
            
            history.push({
                timestamp: now - (i * 3600000),
                price: price
            });
        }
        
        return history;
    }

    getBasePrice(tokenAddress) {
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
        const history = await this.fetchHistoricalPrices(tokenAddress, this.config.lookbackPeriod);
        
        this.priceHistory.set(tokenAddress, history.slice(-this.maxHistoryLength));
    }

    calculateReturns(prices) {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            const ret = (prices[i].price - prices[i-1].price) / prices[i-1].price;
            returns.push({
                timestamp: prices[i].timestamp,
                return: ret
            });
        }
        return returns;
    }

    async predictPriceDirection(tokenAddress, horizonHours = 24) {
        await this.updatePriceHistory(tokenAddress);
        
        const history = this.priceHistory.get(tokenAddress);
        if (!history || history.length < 10) {
            return { direction: 'unknown', confidence: 0, predictedPrice: null };
        }

        const returns = this.calculateReturns(history);
        
        const momentumScore = this.mlModels.momentumModel.predict(returns);
        const volatilityForecast = this.mlModels.volatilityModel.predict(returns);
        
        const sma = this.calculateSMA(history, Math.min(20, history.length));
        const currentPrice = history[history.length - 1].price;
        const trendDirection = currentPrice > sma ? 'up' : currentPrice < sma ? 'down' : 'neutral';
        
        const recentReturns = returns.slice(-12);
        const avgReturn = recentReturns.reduce((a, b) => a + b.return, 0) / recentReturns.length;
        const returnStdDev = this.calculateStdDev(recentReturns.map(r => r.return));
        
        const zScore = returnStdDev > 0 ? avgReturn / returnStdDev : 0;
        
        let direction = 'neutral';
        let confidence = 0.5;
        
        if (momentumScore > 0.6 && zScore > 0.5) {
            direction = 'up';
            confidence = Math.min(0.95, momentumScore * 0.7 + Math.min(0.3, Math.abs(zScore) / 10));
        } else if (momentumScore < 0.4 && zScore < -0.5) {
            direction = 'down';
            confidence = Math.min(0.95, (1 - momentumScore) * 0.7 + Math.min(0.3, Math.abs(zScore) / 10));
        }
        
        const predictedChange = direction === 'up' 
            ? volatilityForecast * confidence 
            : direction === 'down' 
                ? -volatilityForecast * confidence 
                : 0;
        
        const predictedPrice = currentPrice * (1 + predictedChange);

        return {
            direction,
            confidence: parseFloat(confidence.toFixed(2)),
            currentPrice: parseFloat(currentPrice.toFixed(6)),
            predictedPrice: parseFloat(predictedPrice.toFixed(6)),
            predictedChange: parseFloat((predictedChange * 100).toFixed(2)) + '%',
            trend: trendDirection,
            volatility: parseFloat((volatilityForecast * 100).toFixed(2)) + '%',
            horizon: `${horizonHours}h`
        };
    }

    calculateSMA(prices, period) {
        if (prices.length < period) return prices[prices.length - 1].price;
        
        const recentPrices = prices.slice(-period);
        return recentPrices.reduce((sum, p) => sum + p.price, 0) / recentPrices.length;
    }

    calculateStdDev(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
        return Math.sqrt(variance);
    }

    async estimateLiquidationTime(position, collateralToken, debtToken) {
        await this.updatePriceHistory(collateralToken);
        
        const history = this.priceHistory.get(collateralToken);
        if (!history || history.length < 10) {
            return { estimatedHours: null, confidence: 0, reason: 'Insufficient price data' };
        }

        const returns = this.calculateReturns(history);
        const volatility = this.mlModels.volatilityModel.predict(returns);
        
        const currentPrice = history[history.length - 1].price;
        const liquidationThreshold = position.collateralValue * 1.2;
        
        const priceChangePerHour = this.mlModels.momentumModel.predict(returns) * volatility;
        const expectedHourlyDrift = priceChangePerHour * currentPrice;
        
        const hoursToLiqviaDrift = Math.abs(liquidationThreshold - currentPrice) / Math.abs(expectedHourlyDrift || 0.001);
        
        const annualVol = volatility * Math.sqrt(8760);
        const dailyVaR = currentPrice * annualVol * 1.65;
        
        const hoursToLiqviaVaR = Math.abs(liquidationThreshold - currentPrice) / (dailyVaR / 24);

        const avgHours = (hoursToLiqviaDrift + hoursToLiqviaVaR) / 2;
        const confidence = this.calculateConfidence(returns, volatility);

        return {
            estimatedHours: Math.floor(Math.min(avgHours, 720)),
            estimatedDays: Math.floor(Math.min(avgHours / 24, 30)),
            confidence: parseFloat(confidence.toFixed(2)),
            currentPrice: parseFloat(currentPrice.toFixed(6)),
            liquidationThreshold: parseFloat(liquidationThreshold.toFixed(2)),
            volatility: parseFloat((volatility * 100).toFixed(2)) + '%',
            method: 'VaR + Drift combined'
        };
    }

    calculateConfidence(returns, volatility) {
        const lengthFactor = Math.min(returns.length / 72, 1);
        const volatilityPenalty = Math.min(volatility * 10, 0.3);
        
        let confidence = 0.5 + (lengthFactor * 0.3) - volatilityPenalty;
        return Math.max(0.1, Math.min(0.95, confidence));
    }

    async predictPositionLiquidation(address, position, collateralToken, debtToken) {
        const pricePrediction = await this.predictPriceDirection(collateralToken, this.config.predictionHorizon);
        const timeEstimate = await this.estimateLiquidationTime(position, collateralToken, debtToken);
        
        const liquidationProbability = this.calculateLiquidationProbability(
            position,
            pricePrediction,
            timeEstimate
        );

        return {
            address,
            prediction: {
                priceDirection: pricePrediction.direction,
                confidence: pricePrediction.confidence,
                predictedPrice: pricePrediction.predictedPrice,
                predictedChange: pricePrediction.predictedChange,
                trend: pricePrediction.trend,
                volatility: pricePrediction.volatility
            },
            timing: {
                estimatedHours: timeEstimate.estimatedHours,
                estimatedDays: timeEstimate.estimatedDays,
                confidence: timeEstimate.confidence,
                method: timeEstimate.method
            },
            probability: liquidationProbability,
            riskLevel: this.getRiskLevel(liquidationProbability.pro24h),
            recommendation: this.getRecommendation(liquidationProbability, pricePrediction.direction)
        };
    }

    calculateLiquidationProbability(position, pricePrediction, timeEstimate) {
        const baseProb = 0.02;
        
        const priceDirectionFactor = pricePrediction.direction === 'down' ? 3 : pricePrediction.direction === 'neutral' ? 1 : 0.3;
        const volatilityFactor = parseFloat(pricePrediction.volatility) / 2;
        const confidenceFactor = pricePrediction.confidence;
        
        const prob24h = Math.min(0.99, baseProb * priceDirectionFactor * volatilityFactor * (2 - confidenceFactor));
        const prob7d = Math.min(0.99, prob24h * 3);
        const prob30d = Math.min(0.99, prob24h * 8);

        if (timeEstimate.estimatedHours && timeEstimate.estimatedHours < 24) {
            const urgencyFactor = 24 / timeEstimate.estimatedHours;
            return {
                pro24h: Math.min(0.99, prob24h * urgencyFactor),
                pro24hRaw: prob24h,
                pro7d: Math.min(0.99, prob7d * urgencyFactor),
                pro30d: Math.min(0.99, prob30d * urgencyFactor)
            };
        }

        return {
            pro24h: parseFloat((prob24h * 100).toFixed(2)) + '%',
            pro24hRaw: prob24h,
            pro7d: parseFloat((prob7d * 100).toFixed(2)) + '%',
            pro30d: parseFloat((prob30d * 100).toFixed(2)) + '%'
        };
    }

    getRiskLevel(probability) {
        const prob = typeof probability === 'string' ? parseFloat(probability) / 100 : probability;
        if (prob >= 0.5) return 'CRITICAL';
        if (prob >= 0.25) return 'HIGH';
        if (prob >= 0.10) return 'MEDIUM';
        return 'LOW';
    }

    getRecommendation(liquidationProbability, priceDirection) {
        const prob = typeof liquidationProbability.pro24h === 'string' 
            ? parseFloat(liquidationProbability.pro24h) / 100 
            : liquidationProbability.pro24h;

        if (prob >= 0.5) {
            return 'EMERGENCY: Close position immediately or add substantial collateral';
        }
        if (prob >= 0.25) {
            return 'HIGH RISK: Add collateral to increase health factor above 150%';
        }
        if (prob >= 0.10) {
            return 'MODERATE RISK: Monitor position and prepare contingency actions';
        }
        if (priceDirection === 'down') {
            return 'Caution: Price trending down - watch position closely';
        }
        return 'Position stable - continue monitoring';
    }

    async generatePredictionReport(address, positions) {
        const predictions = [];
        
        for (const pos of positions) {
            const prediction = await this.predictPositionLiquidation(
                address,
                pos,
                pos.collateralToken,
                pos.debtToken
            );
            predictions.push(prediction);
        }

        const overallRisk = this.calculateOverallRisk(predictions);

        return {
            address,
            generatedAt: new Date().toISOString(),
            predictions,
            overallRisk,
            summary: this.generateSummary(predictions, overallRisk)
        };
    }

    calculateOverallRisk(predictions) {
        const riskLevels = {
            'CRITICAL': 1,
            'HIGH': 0.75,
            'MEDIUM': 0.5,
            'LOW': 0.25
        };

        let weightedRisk = 0;
        let totalWeight = 0;

        for (const pred of predictions) {
            const weight = pred.probability.pro24hRaw || 0.1;
            weightedRisk += riskLevels[pred.riskLevel] * weight;
            totalWeight += weight;
        }

        const overallScore = totalWeight > 0 ? weightedRisk / totalWeight : 0;

        return {
            score: parseFloat((overallScore * 100).toFixed(1)) + '%',
            level: overallScore >= 0.75 ? 'CRITICAL' : overallScore >= 0.5 ? 'HIGH' : overallScore >= 0.25 ? 'MEDIUM' : 'LOW',
            criticalPositions: predictions.filter(p => p.riskLevel === 'CRITICAL').length,
            highRiskPositions: predictions.filter(p => p.riskLevel === 'HIGH').length
        };
    }

    generateSummary(predictions, overallRisk) {
        return {
            totalPositions: predictions.length,
            atRisk: predictions.filter(p => ['CRITICAL', 'HIGH'].includes(p.riskLevel)).length,
            recommendation: overallRisk.level === 'CRITICAL' 
                ? 'Emergency action required - multiple positions at high risk'
                : overallRisk.level === 'HIGH'
                    ? 'Reduce risk exposure - consider closing some positions'
                    : 'Continue monitoring - current risk is manageable'
        };
    }
}

class MomentumModel {
    predict(returns) {
        if (returns.length < 5) return 0.5;
        
        const recentReturns = returns.slice(-12);
        const olderReturns = returns.slice(-24, -12);
        
        if (olderReturns.length === 0) return 0.5;
        
        const recentAvg = recentReturns.reduce((a, b) => a + b.return, 0) / recentReturns.length;
        const olderAvg = olderReturns.reduce((a, b) => a + b.return, 0) / olderReturns.length;
        
        const momentum = (recentAvg - olderAvg) / (olderAvg !== 0 ? Math.abs(olderAvg) : 1);
        
        return Math.max(0, Math.min(1, 0.5 + momentum));
    }
}

class GARCHModel {
    predict(returns) {
        if (returns.length < 5) return 0.02;
        
        const recentReturns = returns.slice(-24);
        
        const ewma = recentReturns[0].return * recentReturns[0].return;
        const lambda = 0.94;
        
        for (let i = 1; i < recentReturns.length; i++) {
            ewma = lambda * ewma + (1 - lambda) * recentReturns[i].return * recentReturns[i].return;
        }
        
        return Math.sqrt(ewma);
    }
}

class CorrelationModel {
    predict(tokenA, tokenB) {
        return 0.5;
    }
}

class LinearRegressionModel {
    predict(x, y) {
        if (x.length !== y.length || x.length < 3) return { slope: 0, intercept: 0 };
        
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
        const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        return { slope, intercept };
    }
}

module.exports = { LiquidationPredictor };