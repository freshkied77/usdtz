const axios = require('axios');

class AdTargetingML {
    constructor(config = {}) {
        this.config = {
            rpcUrl: config.rpcUrl || process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
            priceApiUrl: config.priceApiUrl || 'https://api.coingecko.com/api/v3',
            lookbackPeriod: config.lookbackPeriod || 168,
            predictionHorizon: config.predictionHorizon || 24,
            confidenceThreshold: config.confidenceThreshold || 0.7,
            ...config
        };

        this.mlModels = this.initializeModels();
        this.addressCache = new Map();
        this.featureCache = new Map();
    }

    initializeModels() {
        return {
            ltvScorer: new LTVScoreModel(),
            riskClassifier: new RiskClassifierModel(),
            engagementPredictor: new EngagementPredictor(),
            conversionModel: new ConversionPredictor()
        };
    }

    calculateOnChainFeatures(address, positions = []) {
        const features = {
            totalValueLocked: 0,
            positionCount: positions.length,
            avgHealthFactor: 0,
            maxExposure: 0,
            tradingFrequency: 0,
            avgTradeSize: 0,
            gasPaid7d: 0,
            dexInteractions: 0,
            contractCalls: 0,
            uniqueTokens: new Set(),
            avgCollateralRatio: 0,
            liquidationRisk: 0,
            stabilityScore: 0,
            yieldFarmed: 0,
            governanceParticipation: 0
        };

        for (const pos of positions) {
            features.totalValueLocked += pos.collateralValue || 0;
            features.maxExposure = Math.max(features.maxExposure, pos.debtValue || 0);
            features.uniqueTokens.add(pos.collateralToken);
            features.uniqueTokens.add(pos.debtToken);
            if (pos.healthFactor) {
                features.avgHealthFactor += pos.healthFactor;
            }
            if (pos.collateralRatio) {
                features.avgCollateralRatio += pos.collateralRatio;
            }
        }

        if (positions.length > 0) {
            features.avgHealthFactor /= positions.length;
            features.avgCollateralRatio /= positions.length;
        }

        return features;
    }

    calculateLTVScore(address, features) {
        const score = this.mlModels.ltvScorer.predict(features);
        return {
            score: parseFloat((score * 100).toFixed(2)),
            tier: score > 0.8 ? 'whale' : score > 0.6 ? 'alpha' : score > 0.4 ? 'growth' : 'standard',
            estimatedAnnualVolume: parseFloat((score * 1000000).toFixed(2)),
            recommendedBudget: parseFloat((score * 5000).toFixed(2)),
            expectedROI: parseFloat(((1 - score) * 500 + 50).toFixed(2))
        };
    }

    classifyRisk(address, features) {
        const riskScore = this.mlModels.riskClassifier.predict(features);
        return {
            score: parseFloat((riskScore * 100).toFixed(2)),
            level: riskScore > 0.7 ? 'high' : riskScore > 0.4 ? 'medium' : 'low',
            factors: this.identifyRiskFactors(features, riskScore),
            recommendations: this.generateRiskRecommendations(riskScore, features)
        };
    }

    predictEngagement(address, features) {
        return this.mlModels.engagementPredictor.predict(features);
    }

    predictConversion(address, features, adContext = {}) {
        const featuresWithContext = { ...features, ...adContext };
        return this.mlModels.conversionModel.predict(featuresWithContext);
    }

    generateTargetingProfile(address, positions = [], adContext = {}) {
        const features = this.calculateOnChainFeatures(address, positions);
        const ltv = this.calculateLTVScore(address, features);
        const risk = this.classifyRisk(address, features);
        const engagement = this.predictEngagement(address, features);
        const conversion = this.predictConversion(address, features, adContext);

        return {
            address,
            generatedAt: new Date().toISOString(),
            features,
            ltv,
            risk,
            engagement,
            conversion,
            targeting: {
                adBudget: ltv.recommendedBudget,
                suggestedPlatforms: this.selectPlatforms(ltv.tier),
                recommendedCreatives: this.selectCreatives(risk.level, engagement.level),
                bidStrategy: this.determineBidStrategy(ltv.tier, conversion.probability)
            },
            privacy: {
                anonymized: true,
                dataRetentionDays: 30
            }
        };
    }

    selectPlatforms(tier) {
        const platforms = {
            whale: ['twitter', 'discord', 'dext', 'dextools'],
            alpha: ['twitter', 'youtube', 'dext'],
            growth: ['google', 'facebook', 'twitter'],
            standard: ['google', 'twitter', 'reddit']
        };
        return platforms[tier] || platforms.standard;
    }

    selectCreatives(riskLevel, engagementLevel) {
        const creatives = [];
        if (riskLevel === 'high') {
            creatives.push({
                type: 'risk-dashboard',
                headline: 'Check Your DeFi Risk Score',
                cta: 'Get AI Protection',
                hook: 'Your positions may be at risk'
            });
        }
        if (engagementLevel > 0.6) {
            creatives.push({
                type: 'yield-optimization',
                headline: 'Maximize Your Yield',
                cta: 'Start Farming',
                hook: 'AI-optimized strategies'
            });
        }
        if (creative.type !== 'risk-dashboard') {
            creatives.push({
                type: 'stablecoin-utilities',
                headline: 'Earn 8.5% on USDTZ',
                cta: 'Start Earning',
                hook: 'Protected by AI'
            });
        }
        return creatives;
    }

    determineBidStrategy(tier, conversionProb) {
        return {
            maxBid: tier === 'whale' ? 50 : tier === 'alpha' ? 25 : 10,
            bidMultiplier: conversionProb > 0.7 ? 1.2 : conversionProb > 0.4 ? 1.0 : 0.8,
            dailyBudget: tier === 'whale' ? 2000 : tier === 'alpha' ? 1000 : 500,
            optimizationTarget: conversionProb > 0.6 ? 'conversion' : 'volume'
        };
    }

    identifyRiskFactors(features, riskScore) {
        const factors = [];
        if (features.avgHealthFactor < 150) factors.push('Low health factor');
        if (features.liquidationRisk > 0.3) factors.push('High liquidation exposure');
        if (features.maxExposure > features.totalValueLocked * 0.8) factors.push('High leverage');
        if (features.tradingFrequency > 50) factors.push('High-frequency trading');
        if (features.gasPaid7d > 5) factors.push('High gas spending (active trader)');
        return factors;
    }

    generateRiskRecommendations(riskScore, features) {
        const recommendations = [];
        if (riskScore > 0.7) {
            recommendations.push('Target with risk dashboard ad creative');
            recommendations.push('Offer liquidation protection product');
        }
        if (features.avgCollateralRatio < 200) {
            recommendations.push('Suggest increasing collateral ratio');
        }
        if (features.yieldFarmed > 0) {
            recommendations.push('Cross-sell into advanced yield strategies');
        }
        return recommendations;
    }

    async generateAudienceReport(addresses, positionsMap = {}) {
        const profiles = [];
        for (const address of addresses) {
            const positions = positionsMap[address] || [];
            const profile = this.generateTargetingProfile(address, positions);
            profiles.push(profile);
        }

        return {
            generatedAt: new Date().toISOString(),
            totalAddresses: addresses.length,
            segments: this.segmentAudience(profiles),
            aggregateMetrics: this.calculateAggregateMetrics(profiles),
            recommendations: this.generateCampaignRecommendations(profiles)
        };
    }

    segmentAudience(profiles) {
        const segments = {
            whales: profiles.filter(p => p.ltv.tier === 'whale'),
            alphas: profiles.filter(p => p.ltv.tier === 'alpha'),
            growth: profiles.filter(p => p.ltv.tier === 'growth'),
            standard: profiles.filter(p => p.ltv.tier === 'standard')
        };

        return {
            whales: {
                count: segments.whales.length,
                avgLTV: this.average(segments.whales.map(p => p.ltv.score)),
                totalValue: segments.whales.reduce((sum, p) => sum + p.features.totalValueLocked, 0)
            },
            alphas: {
                count: segments.alphas.length,
                avgLTV: this.average(segments.alphas.map(p => p.ltv.score)),
                totalValue: segments.alphas.reduce((sum, p) => sum + p.features.totalValueLocked, 0)
            },
            growth: {
                count: segments.growth.length,
                avgLTV: this.average(segments.growth.map(p => p.ltv.score)),
                totalValue: segments.growth.reduce((sum, p) => sum + p.features.totalValueLocked, 0)
            },
            standard: {
                count: segments.standard.length,
                avgLTV: this.average(segments.standard.map(p => p.ltv.score)),
                totalValue: segments.standard.reduce((sum, p) => sum + p.features.totalValueLocked, 0)
            }
        };
    }

    calculateAggregateMetrics(profiles) {
        return {
            totalValue: profiles.reduce((sum, p) => sum + p.features.totalValueLocked, 0),
            avgLTV: this.average(profiles.map(p => p.ltv.score)),
            avgRisk: this.average(profiles.map(p => p.risk.score)),
            avgConversionProb: this.average(profiles.map(p => p.conversion.probability)),
            totalEstimatedVolume: profiles.reduce((sum, p) => sum + p.ltv.estimatedAnnualVolume, 0)
        };
    }

    generateCampaignRecommendations(profiles) {
        const segments = this.segmentAudience(profiles);
        const recommendations = [];

        if (segments.whales.count > 0) {
            recommendations.push({
                segment: 'whales',
                budget: segments.whales.count * 100,
                creative: 'exclusive-access',
                expectedConversions: Math.floor(segments.whales.count * 0.15)
            });
        }

        if (segments.alphas.count > 10) {
            recommendations.push({
                segment: 'alphas',
                budget: segments.alphas.count * 50,
                creative: 'alpha-signals',
                expectedConversions: Math.floor(segments.alphas.count * 0.12)
            });
        }

        recommendations.push({
            segment: 'growth',
            budget: segments.growth.count * 25,
            creative: 'yield-maximization',
            expectedConversions: Math.floor(segments.growth.count * 0.08)
        });

        return recommendations;
    }

    average(values) {
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
}

class LTVScoreModel {
    predict(features) {
        if (!features.totalValueLocked || features.totalValueLocked === 0) {
            return 0.3;
        }

        const valueFactor = Math.min(features.totalValueLocked / 100000, 1) * 0.3;
        const frequencyFactor = Math.min(features.tradingFrequency / 100, 1) * 0.2;
        const healthFactor = (features.avgHealthFactor / 200) * 0.25;
        const stabilityFactor = features.stabilityScore * 0.15;
        const engagementFactor = (features.govanceParticipation || 0) * 0.1;

        let score = valueFactor + frequencyFactor + healthFactor + stabilityFactor + engagementFactor;

        if (features.liquidationRisk > 0.5) {
            score *= 0.7;
        }

        return Math.max(0.1, Math.min(0.95, score));
    }
}

class RiskClassifierModel {
    predict(features) {
        let risk = 0.3;

        if (features.avgHealthFactor < 150) risk += 0.3;
        else if (features.avgHealthFactor < 200) risk += 0.15;

        if (features.maxExposure > features.totalValueLocked * 0.7) risk += 0.25;
        if (features.liquidationRisk > 0.3) risk += 0.2;
        if (features.tradingFrequency > 50) risk += 0.1;

        risk += (features.gasPaid7d / 100) * 0.15;

        return Math.max(0.1, Math.min(0.9, risk));
    }
}

class EngagementPredictor {
    predict(features) {
        const engagementScore =
            (Math.min(features.dexInteractions / 20, 1) * 0.4) +
            (Math.min(features.uniqueTokens.size / 10, 1) * 0.3) +
            (Math.min(features.govanceParticipation * 2, 1) * 0.3);

        return {
            score: parseFloat((engagementScore * 100).toFixed(2)),
            level: engagementScore > 0.7 ? 'high' : engagementScore > 0.4 ? 'medium' : 'low',
            predictedDailyActions: Math.floor(engagementScore * 10),
            preferredFeatures: this.predictPreferences(features)
        };
    }

    predictPreferences(features) {
        const prefs = [];
        if (features.yieldFarmed > 0) prefs.push('yield-farming');
        if (features.tradingFrequency > 10) prefs.push('swap');
        if (features.maxExposure > 10000) prefs.push('leverage');
        if (features.uniqueTokens.size > 3) prefs.push('diversification');
        return prefs;
    }
}

class ConversionPredictor {
    predict(features, context = {}) {
        const baseProb = 0.05;

        const featureMatchBonus = this.calculateFeatureMatch(features, context);
        const engagementBonus = Math.min(features.dexInteractions / 50, 0.2);
        const valueBonus = Math.min(features.totalValueLocked / 500000, 0.15);
        const riskAppetiteBonus = features.liquidationRisk > 0.2 ? 0.1 : 0;

        const probability = Math.min(0.5, baseProb + featureMatchBonus + engagementBonus + valueBonus + riskAppetiteBonus);

        return {
            probability: parseFloat((probability * 100).toFixed(2)),
            confidence: parseFloat((0.5 + (features.uniqueTokens.size / 20) * 0.3).toFixed(2)),
            expectedClicks: Math.floor(probability * 1000),
            expectedConversions: Math.floor(probability * 100)
        };
    }

    calculateFeatureMatch(features, context) {
        let match = 0;
        if (context.adType === 'risk-dashboard' && features.liquidationRisk > 0.2) match += 0.1;
        if (context.adType === 'yield-farming' && features.yieldFarmed > 0) match += 0.1;
        if (context.adType === 'stablecoin' && features.uniqueTokens.has('USDT')) match += 0.05;
        return match;
    }
}

module.exports = { AdTargetingML };