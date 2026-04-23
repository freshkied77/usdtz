const { RiskScorer } = require('../ml/risk-scorer');
const { LiquidationPredictor } = require('../ml/liquidation-predictor');
const { AnomalyDetector } = require('../ml/anomaly-detector');

class MLBotConnector {
    constructor(config = {}) {
        this.config = {
            rpcUrl: config.rpcUrl || process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
            usdtzAddress: config.usdtzAddress || process.env.USDTZ_ADDRESS,
            stabilizationFundAddress: config.stabilizationFundAddress || process.env.STABILIZATION_FUND,
            checkInterval: config.checkInterval || 60000,
            riskThreshold: config.riskThreshold || 70,
            liquidationThreshold: config.liquidationThreshold || 25,
            ...config
        };
        
        this.riskScorer = new RiskScorer({
            priceApiUrl: this.config.priceApiUrl,
            cacheDuration: 30000
        });
        
        this.liquidationPredictor = new LiquidationPredictor({
            priceApiUrl: this.config.priceApiUrl,
            lookbackPeriod: 72,
            predictionHorizon: 24
        });
        
        this.anomalyDetector = new AnomalyDetector({
            rpcUrl: this.config.rpcUrl,
            priceApiUrl: this.config.priceApiUrl,
            detectionThreshold: 50
        });
        
        this.isRunning = false;
        this.lastCheck = null;
        this.alerts = [];
        this.stats = {
            totalChecks: 0,
            riskAlerts: 0,
            liquidationWarnings: 0,
            anomalyDetections: 0,
            rebalanceTriggers: 0
        };
    }

    async getProtocolPositions() {
        return [];
    }

    async runRiskAssessment() {
        try {
            const positions = await this.getProtocolPositions();
            
            if (positions.length === 0) {
                console.log('[MLConnector] No positions to assess');
                return { status: 'no_positions' };
            }

            const riskReport = await this.riskScorer.generateRiskReport(
                this.config.usdtzAddress,
                positions
            );

            if (riskReport.portfolio.overallRiskScore > this.config.riskThreshold) {
                this.stats.riskAlerts++;
                this.triggerRiskAlert(riskReport);
            }

            const liquidationPrediction = await this.liquidationPredictor.generatePredictionReport(
                this.config.usdtzAddress,
                positions
            );

            if (liquidationPrediction.overallRisk.level !== 'LOW') {
                this.stats.liquidationWarnings++;
                this.triggerLiquidationWarning(liquidationPrediction);
            }

            return {
                riskReport,
                liquidationPrediction,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[MLConnector] Risk assessment failed:', error.message);
            return { status: 'error', error: error.message };
        }
    }

    async runAnomalyDetection(transaction) {
        try {
            const result = await this.anomalyDetector.detectAnomalies(
                transaction.from || transaction.to,
                transaction
            );

            if (result.isAnomalous) {
                this.stats.anomalyDetections++;
                this.triggerAnomalyAlert(result, transaction);
            }

            return result;
        } catch (error) {
            console.error('[MLConnector] Anomaly detection failed:', error.message);
            return { status: 'error', error: error.message };
        }
    }

    async checkPegStability() {
        try {
            const marketPrice = await this.riskScorer.fetchPriceFromAPI(this.config.usdtzAddress);
            const targetPrice = 1.0;
            const deviation = Math.abs(marketPrice - targetPrice) / targetPrice;

            if (deviation > 0.01) {
                this.stats.rebalanceTriggers++;
                return {
                    needsRebalance: true,
                    marketPrice,
                    deviation: (deviation * 100).toFixed(2) + '%',
                    severity: deviation > 0.03 ? 'HIGH' : 'MEDIUM'
                };
            }

            return { needsRebalance: false, marketPrice, deviation: 'stable' };
        } catch (error) {
            console.error('[MLConnector] Peg stability check failed:', error.message);
            return { status: 'error', error: error.message };
        }
    }

    async runFullAssessment() {
        const riskAssessment = await this.runRiskAssessment();
        const pegStability = await this.checkPegStability();

        return {
            timestamp: new Date().toISOString(),
            riskAssessment,
            pegStability,
            stats: this.getStats(),
            recommendations: this.generateRecommendations(riskAssessment, pegStability)
        };
    }

    triggerRiskAlert(report) {
        const alert = {
            type: 'RISK_ALERT',
            severity: report.portfolio.overallRiskScore > 80 ? 'CRITICAL' : 'HIGH',
            timestamp: Date.now(),
            message: `Portfolio risk score: ${report.portfolio.overallRiskScore}/100`,
            details: {
                healthFactor: report.portfolio.overallHealthFactor,
                diversification: report.portfolio.diversificationScore,
                positionsAtRisk: report.portfolio.positions.filter(p => p.riskScore > 60).length
            },
            recommendations: report.portfolio.recommendations
        };
        
        this.alerts.push(alert);
        console.log(`[MLConnector] 🚨 RISK ALERT [${alert.severity}]: ${alert.message}`);
        
        if (this.config.onAlert) {
            this.config.onAlert(alert);
        }
        
        return alert;
    }

    triggerLiquidationWarning(prediction) {
        const alert = {
            type: 'LIQUIDATION_WARNING',
            severity: prediction.overallRisk.level === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
            timestamp: Date.now(),
            message: `${prediction.overallRisk.criticalPositions} positions at critical liquidation risk`,
            details: prediction.summary,
            recommendations: [prediction.summary.recommendation]
        };
        
        this.alerts.push(alert);
        console.log(`[MLConnector] ⚠️ LIQUIDATION WARNING [${alert.severity}]: ${alert.message}`);
        
        if (this.config.onAlert) {
            this.config.onAlert(alert);
        }
        
        return alert;
    }

    triggerAnomalyAlert(analysis, transaction) {
        const alert = {
            type: 'ANOMALY_DETECTED',
            severity: analysis.risk,
            timestamp: Date.now(),
            message: `Suspicious activity detected - Score: ${analysis.riskScore}/100`,
            details: {
                reasons: analysis.reasons,
                transactionHash: transaction.hash,
                profile: analysis.profile
            },
            recommendations: analysis.recommendations
        };
        
        this.alerts.push(alert);
        console.log(`[MLConnector] 🔍 ANOMALY [${alert.severity}]: ${analysis.reasons.join(', ')}`);
        
        if (this.config.onAlert) {
            this.config.onAlert(alert);
        }
        
        return alert;
    }

    generateRecommendations(riskAssessment, pegStability) {
        const recommendations = [];
        
        if (riskAssessment?.portfolio?.overallRiskScore > 60) {
            recommendations.push({
                priority: 'HIGH',
                action: 'Reduce portfolio risk',
                details: riskAssessment.portfolio.recommendations
            });
        }
        
        if (pegStability?.needsRebalance) {
            recommendations.push({
                priority: pegStability.severity,
                action: 'Execute peg stabilization',
                details: `Market deviation: ${pegStability.deviation}`
            });
        }
        
        if (this.stats.liquidationWarnings > 0) {
            recommendations.push({
                priority: 'CRITICAL',
                action: 'Monitor liquidation risk',
                details: `${this.stats.liquidationWarnings} warnings in last cycle`
            });
        }
        
        return recommendations;
    }

    async start() {
        if (this.isRunning) {
            console.log('[MLConnector] Already running');
            return;
        }

        console.log('[MLConnector] Starting ML bot connector...');
        console.log(`[MLConnector] Risk threshold: ${this.config.riskThreshold}`);
        console.log(`[MLConnector] Check interval: ${this.config.checkInterval}ms`);
        
        this.isRunning = true;
        this.runCycle();
        
        console.log('[MLConnector] ML bot connector started successfully');
    }

    async runCycle() {
        if (!this.isRunning) return;
        
        try {
            this.stats.totalChecks++;
            this.lastCheck = Date.now();
            
            const assessment = await this.runFullAssessment();
            
            if (assessment.recommendations && assessment.recommendations.length > 0) {
                console.log(`[MLConnector] Generated ${assessment.recommendations.length} recommendations`);
            }
        } catch (error) {
            console.error('[MLConnector] Cycle error:', error.message);
        }
        
        if (this.isRunning) {
            setTimeout(() => this.runCycle(), this.config.checkInterval);
        }
    }

    async stop() {
        this.isRunning = false;
        console.log('[MLConnector] Stopped');
    }

    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            lastCheck: this.lastCheck,
            alertCount: this.alerts.length
        };
    }

    getAlerts(limit = 10) {
        return this.alerts.slice(-limit);
    }

    clearAlerts() {
        this.alerts = [];
    }
}

module.exports = { MLBotConnector };