const express = require('express');
const { LiquidationPredictor } = require('../ml/liquidation-predictor');
const { AnomalyDetector } = require('../ml/anomaly-detector');
const { RiskScorer } = require('../ml/risk-scorer');

const router = express.Router();

const liquidationPredictor = new LiquidationPredictor();
const anomalyDetector = new AnomalyDetector();
const riskScorer = new RiskScorer();

router.post('/ml/liquidation/predict', (req, res) => {
  try {
    const { user, collateral, debt, token, price } = req.body;
    
    if (!user) {
      return res.status(400).json({ error: 'User address required' });
    }

    if (collateral !== undefined && debt !== undefined && token && price) {
      liquidationPredictor.updatePrice(token, price, Date.now());
      liquidationPredictor.updatePosition(user, collateral, debt, token);
    }

    const prediction = liquidationPredictor.predictLiquidation(user);
    
    res.json({
      success: true,
      user,
      prediction,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ml/liquidation/batch-predict', (req, res) => {
  try {
    const { users } = req.body;
    
    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ error: 'Users array required' });
    }

    const predictions = liquidationPredictor.batchPredictLiquidation(users);
    
    res.json({
      success: true,
      predictions,
      count: predictions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ml/liquidation/risk-metrics/:token', (req, res) => {
  try {
    const { token } = req.params;
    const metrics = liquidationPredictor.getRiskMetrics(token);
    
    res.json({
      success: true,
      token,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ml/anomaly/detect', (req, res) => {
  try {
    const { address, transaction } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }

    if (transaction) {
      anomalyDetector.updateNetworkStats(
        transaction.gasPrice || 0,
        transaction.value || 0
      );
      anomalyDetector.updateAddressProfile(address, transaction);
    }

    const detection = anomalyDetector.detectAnomalies(address, transaction || {});
    
    res.json({
      success: true,
      address,
      detection,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ml/anomaly/batch-analyze', (req, res) => {
  try {
    const { transactions } = req.body;
    
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Transactions array required' });
    }

    const results = anomalyDetector.batchAnalyze(transactions);
    
    res.json({
      success: true,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ml/anomaly/network-status', (req, res) => {
  try {
    const networkAnomalies = anomalyDetector.getNetworkAnomalies();
    
    res.json({
      success: true,
      networkAnomalies,
      networkStats: anomalyDetector.networkStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ml/risk/position', (req, res) => {
  try {
    const { address, collateral, debt, collateralPrice, debtPrice } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }

    const riskAssessment = riskScorer.calculatePositionRisk(
      collateral || 0,
      debt || 0,
      collateralPrice || 1,
      debtPrice || 1
    );
    
    res.json({
      success: true,
      address,
      riskAssessment,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ml/risk/portfolio', (req, res) => {
  try {
    const { address, positions, prices } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }

    const portfolioRisk = riskScorer.calculatePortfolioRisk(
      address,
      positions || [],
      prices || {}
    );
    
    res.json({
      success: true,
      address,
      portfolioRisk,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ml/risk/report', (req, res) => {
  try {
    const { address, positions, prices } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }

    const report = riskScorer.generateRiskReport(
      address,
      positions || [],
      prices || {}
    );
    
    res.json({
      success: true,
      report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ml/risk/simulate', (req, res) => {
  try {
    const { positions, priceChanges } = req.body;
    
    if (!positions || !priceChanges) {
      return res.status(400).json({ error: 'Positions and priceChanges required' });
    }

    const simulation = riskScorer.simulateScenario(positions, priceChanges);
    
    res.json({
      success: true,
      simulation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/ml/risk/token/:token', (req, res) => {
  try {
    const { token } = req.params;
    const { price, volatility } = req.query;
    
    const tokenRisk = riskScorer.getTokenRisk(
      token,
      parseFloat(price) || 0,
      parseFloat(volatility) || 0.02
    );
    
    res.json({
      success: true,
      tokenRisk,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/ml/price/update', (req, res) => {
  try {
    const { token, price } = req.body;
    
    if (!token || price === undefined) {
      return res.status(400).json({ error: 'Token and price required' });
    }

    liquidationPredictor.updatePrice(token, price, Date.now());
    
    res.json({
      success: true,
      token,
      price,
      riskMetrics: liquidationPredictor.getRiskMetrics(token),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;