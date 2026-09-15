/**
 * ⛏️  FaucetChain Mining Core v1.0.0
 * 
 * Shared mining engine used by both CLI and Electron GUI.
 * Uses EventEmitter pattern so any frontend can listen for updates.
 */

const EventEmitter = require('events');
const fetch = require('node-fetch');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const VERSION = '1.0.0';

class MinerCore extends EventEmitter {
    constructor(options = {}) {
        super();
        this.apiUrl = options.apiUrl || 'http://127.0.0.1:8000';
        this.wallet = options.walletAddress || '';
        this.nodeName = options.nodeName || `node-${os.hostname()}`;
        this.version = VERSION;

        // Persistent node ID
        this.nodeIdFile = options.nodeIdFile || path.join(__dirname, '.node_id');
        this.nodeId = this._loadOrCreateNodeId();

        // State
        this.heartbeatInterval = 30; // seconds, updated from server
        this.totalUptime = 0;
        this.epochUptime = 0;
        this.totalEarned = 0;
        this.epochsActive = 0;
        this.isRunning = false;
        this.heartbeatCount = 0;
        this.startTime = null;
        this._heartbeatTimer = null;
    }

    _loadOrCreateNodeId() {
        try {
            if (fs.existsSync(this.nodeIdFile)) {
                return fs.readFileSync(this.nodeIdFile, 'utf8').trim();
            }
        } catch (e) { /* ignore */ }
        
        const id = `fcn-${uuidv4().substring(0, 12)}`;
        try {
            fs.writeFileSync(this.nodeIdFile, id);
        } catch (e) { /* ignore */ }
        return id;
    }

    getSystemMetrics() {
        const cpus = os.cpus();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();

        let cpuLoad = 0;
        if (cpus.length > 0) {
            const cpu = cpus[0];
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            cpuLoad = Math.round((1 - cpu.times.idle / total) * 100);
        }

        const memFreePercent = Math.round((freeMem / totalMem) * 100);
        return { cpuLoad, memFreePercent };
    }

    getSystemInfo() {
        return {
            hostname: os.hostname(),
            cpuCount: os.cpus().length,
            totalMemGB: Math.round(os.totalmem() / 1073741824),
            platform: os.platform(),
            arch: os.arch()
        };
    }

    formatUptime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    }

    getState() {
        const metrics = this.getSystemMetrics();
        return {
            isRunning: this.isRunning,
            nodeId: this.nodeId,
            nodeName: this.nodeName,
            wallet: this.wallet,
            apiUrl: this.apiUrl,
            totalUptime: this.totalUptime,
            totalUptimeFormatted: this.formatUptime(this.totalUptime),
            epochUptime: this.epochUptime,
            epochUptimeFormatted: this.formatUptime(this.epochUptime),
            totalEarned: this.totalEarned,
            epochsActive: this.epochsActive,
            heartbeatCount: this.heartbeatCount,
            heartbeatInterval: this.heartbeatInterval,
            cpuLoad: metrics.cpuLoad,
            memFree: metrics.memFreePercent,
            sessionUptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0
        };
    }

    // ─── API Functions ──────────────────────────────────────────

    async registerNode() {
        try {
            const res = await fetch(`${this.apiUrl}/api/mining/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: this.wallet,
                    node_id: this.nodeId,
                    node_name: this.nodeName,
                    version: this.version
                })
            });

            const data = await res.json();

            if (res.ok) {
                if (data.config) {
                    this.heartbeatInterval = data.config.heartbeat_interval || 30;
                }
                this.emit('registered', {
                    status: data.status,
                    nodeId: this.nodeId,
                    config: data.config || {},
                    heartbeatInterval: this.heartbeatInterval
                });
                return true;
            } else {
                this.emit('error', { type: 'register', message: data.detail || 'Registration failed' });
                return false;
            }
        } catch (err) {
            this.emit('error', { type: 'connection', message: `Connection refused: ${this.apiUrl}` });
            return false;
        }
    }

    async sendHeartbeat() {
        try {
            const metrics = this.getSystemMetrics();
            const uptime = Math.floor((Date.now() - this.startTime) / 1000);

            const res = await fetch(`${this.apiUrl}/api/mining/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    node_id: this.nodeId,
                    wallet_address: this.wallet,
                    uptime_seconds: uptime,
                    cpu_load: metrics.cpuLoad,
                    memory_free: metrics.memFreePercent
                })
            });

            if (res.ok) {
                const data = await res.json();
                this.heartbeatCount++;
                this.totalUptime = data.total_uptime;
                this.epochUptime = data.epoch_uptime;
                this.totalEarned = data.total_earned;
                this.epochsActive = data.epochs_active;

                this.emit('heartbeat', this.getState());
                return true;
            } else if (res.status === 429) {
                // Rate limited, just wait
                return true;
            } else {
                const data = await res.json();
                this.emit('error', { type: 'heartbeat', message: data.detail || 'Heartbeat rejected' });
                return false;
            }
        } catch (err) {
            this.emit('error', { type: 'heartbeat', message: 'Server unreachable' });
            return false;
        }
    }

    async disconnect() {
        try {
            await fetch(`${this.apiUrl}/api/mining/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    node_id: this.nodeId,
                    wallet_address: this.wallet
                })
            });
        } catch (e) {
            // Ignore disconnect errors
        }
    }

    // ─── Lifecycle ──────────────────────────────────────────────

    async start() {
        if (this.isRunning) return false;

        if (!this.wallet) {
            this.emit('error', { type: 'config', message: 'WALLET_ADDRESS not configured' });
            return false;
        }

        this.isRunning = true;
        this.startTime = Date.now();
        this.heartbeatCount = 0;

        this.emit('starting', {
            wallet: this.wallet,
            nodeName: this.nodeName,
            nodeId: this.nodeId,
            apiUrl: this.apiUrl,
            system: this.getSystemInfo()
        });

        // Register with retries
        let registered = false;
        let retries = 0;

        while (!registered && retries < 5 && this.isRunning) {
            registered = await this.registerNode();
            if (!registered) {
                retries++;
                this.emit('retry', { attempt: retries, maxAttempts: 5 });
                await new Promise(r => setTimeout(r, 5000));
            }
        }

        if (!registered) {
            this.isRunning = false;
            this.emit('error', { type: 'register', message: 'Failed to connect after 5 attempts' });
            return false;
        }

        this.emit('mining-started', { heartbeatInterval: this.heartbeatInterval });

        // First heartbeat immediately
        await this.sendHeartbeat();

        // Heartbeat loop
        this._heartbeatTimer = setInterval(async () => {
            if (!this.isRunning) return;
            await this.sendHeartbeat();
        }, this.heartbeatInterval * 1000);

        // Continuous Dual Exploration loop (Fast Poll)
        this._exploreTimer = setInterval(async () => {
            if (!this.isRunning) return;
            await this.exploreNetwork();
        }, 5000);

        return true;
    }

    async stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
        if (this._exploreTimer) {
            clearInterval(this._exploreTimer);
            this._exploreTimer = null;
        }

        await this.disconnect();

        this.emit('stopped', {
            totalUptime: this.totalUptime,
            totalUptimeFormatted: this.formatUptime(this.totalUptime),
            totalEarned: this.totalEarned
        });
    }

    async exploreNetwork() {
        try {
            const res = await fetch(`${this.apiUrl}/api/mining/explore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ miner_address: this.wallet, node_id: this.nodeId })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.explored) {
                    this.totalEarned += data.miner_fee;
                    this.emit('block-mined', data);
                }
            }
        } catch (e) {
            // Ignore explore errors silently
        }
    }

    // ─── Config Management ──────────────────────────────────────

    updateConfig(config) {
        if (config.walletAddress !== undefined) this.wallet = config.walletAddress;
        if (config.apiUrl !== undefined) this.apiUrl = config.apiUrl;
        if (config.nodeName !== undefined) this.nodeName = config.nodeName;
    }

    getConfig() {
        return {
            walletAddress: this.wallet,
            apiUrl: this.apiUrl,
            nodeName: this.nodeName,
            nodeId: this.nodeId
        };
    }

    saveConfigToEnv(configPath) {
        const envContent = `# FaucetChain Mining Node Configuration\n\n# Your wallet address\nWALLET_ADDRESS=${this.wallet}\n\n# API server URL\nAPI_URL=${this.apiUrl}\n\n# Name for your node\nNODE_NAME=${this.nodeName}\n`;
        fs.writeFileSync(configPath || path.join(__dirname, '.env'), envContent);
    }
}

module.exports = { MinerCore, VERSION };
