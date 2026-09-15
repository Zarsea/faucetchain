#!/usr/bin/env node
/**
 * ⛏️  FaucetChain Mining Node v1.0.0 — CLI Mode
 * 
 * Earn $CLAIM tokens by keeping this node running.
 * Uses the shared MinerCore engine with terminal-friendly output.
 * 
 * Usage:
 *   1. Copy .env.example to .env
 *   2. Set your WALLET_ADDRESS
 *   3. Run: npm start (or node index.js)
 * 
 * For the GUI version, run: npm run app
 */

require('dotenv').config();
const chalk = require('chalk');
const { MinerCore, VERSION } = require('./miner-core');

// ─── Configuration ────────────────────────────────────────────────
const miner = new MinerCore({
    apiUrl: process.env.API_URL || 'http://127.0.0.1:8000',
    walletAddress: process.env.WALLET_ADDRESS,
    nodeName: process.env.NODE_NAME || undefined
});

// ─── UI ───────────────────────────────────────────────────────────
const logo = `
${chalk.cyan('╔══════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.white.bold('⛏️  FaucetChain Mining Node')}  ${chalk.gray('v' + VERSION)}        ${chalk.cyan('║')}
${chalk.cyan('╠══════════════════════════════════════════════╣')}
${chalk.cyan('║')}  ${chalk.gray('Network:')} ${chalk.green('FaucetChain PoC+PoS')}               ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('Token:  ')} ${chalk.yellow('$CLAIM')}                            ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('Reward: ')} ${chalk.white('2,000 CLAIM/hour (shared)')}         ${chalk.cyan('║')}
${chalk.cyan('╚══════════════════════════════════════════════╝')}
`;

function log(level, msg) {
    const ts = new Date().toLocaleTimeString('pt-BR');
    const prefix = {
        info:  chalk.blue(`[${ts}] ℹ`),
        ok:    chalk.green(`[${ts}] ✓`),
        warn:  chalk.yellow(`[${ts}] ⚠`),
        error: chalk.red(`[${ts}] ✗`),
        mine:  chalk.cyan(`[${ts}] ⛏`),
        coin:  chalk.yellow(`[${ts}] 💰`),
    };
    console.log(`${prefix[level] || prefix.info} ${msg}`);
}

// ─── Event Handlers ───────────────────────────────────────────────
miner.on('starting', (info) => {
    console.clear();
    console.log(logo);
    log('info', `Wallet:  ${chalk.cyan(info.wallet)}`);
    log('info', `Node:    ${chalk.white(info.nodeName)} (${chalk.gray(info.nodeId)})`);
    log('info', `Server:  ${chalk.white(info.apiUrl)}`);
    log('info', `Machine: ${chalk.gray(info.system.hostname)} | ${info.system.cpuCount} CPUs | ${info.system.totalMemGB}GB RAM`);
    console.log('');
    log('mine', 'Conectando à rede FaucetChain...');
});

miner.on('registered', (info) => {
    if (info.status === 'reconnected') {
        log('ok', `Reconectado à rede! Node ID: ${chalk.cyan(info.nodeId)}`);
    } else {
        log('ok', `Registrado na rede! Node ID: ${chalk.cyan(info.nodeId)}`);
        log('info', `Intervalo de heartbeat: ${chalk.white(info.heartbeatInterval + 's')}`);
    }
});

miner.on('retry', (info) => {
    log('warn', `Tentativa ${info.attempt}/${info.maxAttempts}... Aguardando 5s`);
});

miner.on('mining-started', (info) => {
    console.log('');
    log('mine', chalk.green.bold('⛏️  MINERAÇÃO INICIADA — Mantenha este terminal aberto'));
    log('info', `Heartbeat a cada ${info.heartbeatInterval}s | Epoch reward: 2,000 CLAIM/hora`);
    log('info', `Pressione ${chalk.white('Ctrl+C')} para parar`);
    console.log('');
});

miner.on('heartbeat', (state) => {
    const bar = chalk.gray('│');
    process.stdout.write(
        `\r  ${chalk.green('●')} MINING ${bar} ` +
        `Uptime: ${chalk.white(state.totalUptimeFormatted)} ${bar} ` +
        `Epoch: ${chalk.cyan(state.epochUptimeFormatted)} ${bar} ` +
        `Earned: ${chalk.yellow(state.totalEarned.toFixed(4))} CLAIM ${bar} ` +
        `CPU: ${chalk.white(state.cpuLoad + '%')} ${bar} ` +
        `HB: ${chalk.gray('#' + state.heartbeatCount)}   `
    );
});

miner.on('block-mined', (data) => {
    console.log('');
    log('coin', chalk.yellow.bold(`[DUAL CONSENSUS] ⛏️ Bloco PoC Produzido | ${data.message} | Taxa: ${data.miner_fee.toFixed(4)} CLAIM`));
    // Redraw prompt line underneath properly next heartbeat
});

miner.on('stopped', (info) => {
    console.log('');
    console.log('');
    log('warn', 'Desconectando da rede...');
    log('info', `Sessão finalizada — Uptime: ${chalk.white(info.totalUptimeFormatted)}`);
    log('coin', `Total minerado: ${chalk.yellow(info.totalEarned.toFixed(4))} CLAIM`);
    console.log('');
});

miner.on('error', (err) => {
    if (err.type === 'config') {
        log('error', err.message);
        log('info', `Copie ${chalk.cyan('.env.example')} para ${chalk.cyan('.env')} e preencha`);
        process.exit(1);
    } else if (err.type === 'connection') {
        log('error', err.message);
        log('warn', 'Verifique se o api_server.py está rodando');
    } else {
        log('error', `${err.type}: ${err.message}`);
    }
});

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
    const started = await miner.start();
    if (!started) {
        process.exit(1);
    }

    // Graceful shutdown
    const shutdown = async () => {
        await miner.stop();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch(err => {
    log('error', `Erro fatal: ${err.message}`);
    process.exit(1);
});
