const RebaseBot = require('./rebase-bot');
const ArbitrageBot = require('./arbitrage-bot');
const LiquidityBot = require('./liquidity-bot');
const PegMaintenanceBot = require('./peg-bot');

class BotOrchestrator {
    constructor(config = {}) {
        this.config = {
            mode: config.mode || 'all',
            ...config
        };
        
        this.bots = {};
        this.isRunning = false;
        this.stats = {
            startedAt: null,
            totalCycles: 0,
            errors: 0
        };
    }

    async initialize() {
        console.log('[Orchestrator] Initializing bot orchestrator...');
        console.log(`[Orchestrator] Mode: ${this.config.mode}`);
        
        if (this.config.mode === 'all' || this.config.mode === 'rebase') {
            this.bots.rebase = new RebaseBot({
                rpcUrl: this.config.rpcUrl,
                usdtzAddress: this.config.usdtzAddress,
                pairAddress: this.config.usdtzUsdtPair,
                authorizedWallet: this.config.authorizedWallet,
                privateKey: this.config.botPrivateKey,
                checkInterval: this.config.rebaseCheckInterval || 30000
            });
        }
        
        if (this.config.mode === 'all' || this.config.mode === 'arbitrage') {
            this.bots.arbitrage = new ArbitrageBot({
                rpcUrl: this.config.rpcUrl,
                usdtzAddress: this.config.usdtzAddress,
                usdtAddress: this.config.usdtAddress,
                routerAddress: this.config.routerAddress,
                factoryAddress: this.config.factoryAddress,
                privateKey: this.config.botPrivateKey,
                walletAddress: this.config.botWallet,
                minProfitThreshold: this.config.minProfitThreshold || 10,
                checkInterval: this.config.arbitrageCheckInterval || 15000
            });
        }
        
        if (this.config.mode === 'all' || this.config.mode === 'liquidity') {
            this.bots.liquidity = new LiquidityBot({
                rpcUrl: this.config.rpcUrl,
                usdtzAddress: this.config.usdtzAddress,
                usdtAddress: this.config.usdtAddress,
                wbnbAddress: this.config.wbnbAddress,
                routerAddress: this.config.routerAddress,
                factoryAddress: this.config.factoryAddress,
                liquidityManagerAddress: this.config.liquidityManagerAddress,
                privateKey: this.config.botPrivateKey,
                walletAddress: this.config.botWallet,
                autoAddEnabled: this.config.autoAddLiquidity !== false,
                checkInterval: this.config.liquidityCheckInterval || 45000
            });
        }
        
        if (this.config.mode === 'all' || this.config.mode === 'peg') {
            this.bots.peg = new PegMaintenanceBot({
                rpcUrl: this.config.rpcUrl,
                stabilizationFundAddress: this.config.stabilizationFundAddress,
                usdtzAddress: this.config.usdtzAddress,
                usdtAddress: this.config.usdtAddress,
                privateKey: this.config.botPrivateKey,
                walletAddress: this.config.botWallet,
                aggressiveMode: this.config.aggressiveMode || false,
                checkInterval: this.config.pegCheckInterval || 20000
            });
        }
        
        console.log(`[Orchestrator] Initialized ${Object.keys(this.bots).length} bots`);
    }

    async start() {
        if (this.isRunning) {
            console.log('[Orchestrator] Already running');
            return;
        }
        
        await this.initialize();
        
        console.log('[Orchestrator] Starting all bots...');
        this.isRunning = true;
        this.stats.startedAt = Date.now();
        
        for (const [name, bot] of Object.entries(this.bots)) {
            try {
                await bot.start();
                console.log(`[Orchestrator] Started ${name} bot`);
            } catch (error) {
                console.error(`[Orchestrator] Failed to start ${name} bot:`, error.message);
            }
        }
        
        this.startHealthCheck();
        console.log('[Orchestrator] All bots started successfully');
    }

    startHealthCheck() {
        this.healthCheckInterval = setInterval(async () => {
            if (!this.isRunning) return;
            
            this.stats.totalCycles++;
            
            const health = this.getHealthReport();
            
            if (health.status === 'degraded') {
                console.log('[Orchestrator] Health check: DEGRADED');
                for (const [name, status] of Object.entries(health.bots)) {
                    if (status !== 'healthy') {
                        console.log(`  ${name}: ${status}`);
                    }
                }
            }
            
            if (health.status === 'critical') {
                console.log('[Orchestrator] Health check: CRITICAL');
                this.stats.errors++;
                
                if (this.stats.errors > 10) {
                    console.log('[Orchestrator] Too many errors, stopping...');
                    await this.stop();
                }
            }
        }, 60000);
    }

    getHealthReport() {
        const botStatuses = {};
        let healthyCount = 0;
        
        for (const [name, bot] of Object.entries(this.bots)) {
            const stats = bot.getStats();
            botStatuses[name] = stats.isRunning ? 'healthy' : 'stopped';
            if (stats.isRunning) healthyCount++;
        }
        
        let status = 'healthy';
        if (healthyCount === 0) {
            status = 'critical';
        } else if (healthyCount < Object.keys(this.bots).length) {
            status = 'degraded';
        }
        
        return {
            status,
            bots: botStatuses,
            uptime: Date.now() - this.stats.startedAt,
            totalCycles: this.stats.totalCycles,
            errors: this.stats.errors
        };
    }

    async stop() {
        console.log('[Orchestrator] Stopping all bots...');
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        this.isRunning = false;
        
        for (const [name, bot] of Object.entries(this.bots)) {
            try {
                await bot.stop();
                console.log(`[Orchestrator] Stopped ${name} bot`);
            } catch (error) {
                console.error(`[Orchestrator] Error stopping ${name} bot:`, error.message);
            }
        }
        
        console.log('[Orchestrator] All bots stopped');
    }

    getStats() {
        const allStats = {
            orchestrator: {
                isRunning: this.isRunning,
                uptime: this.isRunning ? Date.now() - this.stats.startedAt : 0,
                totalCycles: this.stats.totalCycles,
                errors: this.stats.errors,
                health: this.getHealthReport()
            },
            bots: {}
        };
        
        for (const [name, bot] of Object.entries(this.bots)) {
            allStats.bots[name] = bot.getStats();
        }
        
        return allStats;
    }

    async restartBot(botName) {
        if (this.bots[botName]) {
            console.log(`[Orchestrator] Restarting ${botName}...`);
            await this.bots[botName].stop();
            await this.bots[botName].start();
            console.log(`[Orchestrator] ${botName} restarted`);
        }
    }

    async updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[Orchestrator] Configuration updated');
    }
}

module.exports = BotOrchestrator;