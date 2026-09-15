/**
 * ⛏️  FaucetChain AutoClaim — Renderer (Frontend Logic)
 */

// ─── DOM Elements ────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const elements = {
    // Config
    inputWallet: $('input-wallet'),
    inputApi:    $('input-api'),
    inputName:   $('input-name'),
    configPanel: $('config-panel'),

    // Mining control
    btnMine:     $('btn-mine'),
    mineIcon:    $('mine-btn-icon'),
    mineText:    $('mine-btn-text'),
    mineHint:    $('mine-hint'),

    // Status
    statusBadge: $('status-badge'),
    statusDot:   $('status-dot'),
    statusText:  $('status-text'),

    // Stats
    statUptime:  $('stat-uptime'),
    statEarned:  $('stat-earned'),
    statCpu:     $('stat-cpu'),
    statHb:      $('stat-hb'),

    // Epoch
    epochTimer:   $('epoch-timer'),
    epochBarFill: $('epoch-bar-fill'),
    epochUptime:  $('epoch-uptime'),
    epochsActive: $('epochs-active'),

    // Log
    logContainer: $('log-container'),

    // Footer
    footerNodeId: $('footer-node-id'),

    // Window controls
    btnMinimize: $('btn-minimize'),
    btnMaximize: $('btn-maximize'),
    btnClose:    $('btn-close'),
    btnClearLog: $('btn-clear-log'),

    // Particles
    canvas: $('particles-canvas')
};

// ─── State ───────────────────────────────────────────────────
let isMining = false;
let epochStartTime = null;
const EPOCH_DURATION = 3600; // 1 hour in seconds

// ─── Window Controls ─────────────────────────────────────────
elements.btnMinimize.addEventListener('click', () => window.miner.minimize());
elements.btnMaximize.addEventListener('click', () => window.miner.maximize());
elements.btnClose.addEventListener('click', () => window.miner.close());

// ─── Log ─────────────────────────────────────────────────────
function addLog(type, message) {
    const time = new Date().toLocaleTimeString('pt-BR');
    const typeClass = {
        info: 'log-info', ok: 'log-ok', error: 'log-error',
        warn: 'log-warn', mine: 'log-mine'
    };
    const entry = document.createElement('div');
    entry.className = `log-entry ${typeClass[type] || 'log-info'}`;
    entry.innerHTML = `<span class="log-time">${time}</span><span class="log-msg">${message}</span>`;
    elements.logContainer.appendChild(entry);
    elements.logContainer.scrollTop = elements.logContainer.scrollHeight;

    // Keep max 100 entries
    while (elements.logContainer.children.length > 100) {
        elements.logContainer.removeChild(elements.logContainer.firstChild);
    }
}

elements.btnClearLog.addEventListener('click', () => {
    elements.logContainer.innerHTML = '';
    addLog('info', 'Log limpo.');
});

// ─── Status ──────────────────────────────────────────────────
function setStatus(state) {
    elements.statusBadge.className = `status-badge ${state}`;
    const labels = { online: 'AutoClaim', offline: 'Offline', connecting: 'Connecting...' };
    elements.statusText.textContent = labels[state] || state;
}

// ─── Config ──────────────────────────────────────────────────
async function loadConfig() {
    const config = await window.miner.getConfig();
    if (config) {
        elements.inputWallet.value = config.walletAddress || '';
        elements.inputApi.value = config.apiUrl || 'http://127.0.0.1:8000';
        elements.inputName.value = config.nodeName || '';
    }
}

function getConfigFromForm() {
    return {
        walletAddress: elements.inputWallet.value.trim(),
        apiUrl: elements.inputApi.value.trim() || 'http://127.0.0.1:8000',
        nodeName: elements.inputName.value.trim()
    };
}

function setConfigEnabled(enabled) {
    elements.inputWallet.disabled = !enabled;
    elements.inputApi.disabled = !enabled;
    elements.inputName.disabled = !enabled;
}

// ─── Mining Control ──────────────────────────────────────────
elements.btnMine.addEventListener('click', async () => {
    if (isMining) {
        // Stop
        elements.mineText.textContent = 'STOPPING...';
        elements.btnMine.disabled = true;
        const result = await window.miner.stop();
        if (result.status === 'stopped' || result.status === 'not-running') {
            setMiningUI(false);
        }
        elements.btnMine.disabled = false;
    } else {
        // Start
        const config = getConfigFromForm();
        if (!config.walletAddress || config.walletAddress === '0xSuaCarteiraAqui') {
            addLog('error', 'Configure seu WALLET_ADDRESS antes de iniciar!');
            elements.inputWallet.focus();
            elements.inputWallet.style.borderColor = 'var(--red)';
            setTimeout(() => { elements.inputWallet.style.borderColor = ''; }, 2000);
            return;
        }

        elements.mineText.textContent = 'CONNECTING...';
        elements.btnMine.disabled = true;
        setStatus('connecting');

        const result = await window.miner.start(config);
        if (result.status === 'failed') {
            addLog('error', 'Falha ao conectar à rede. Verifique o servidor.');
            setMiningUI(false);
        }
        elements.btnMine.disabled = false;
    }
});

function setMiningUI(mining) {
    isMining = mining;
    if (mining) {
        elements.btnMine.classList.add('mining');
        elements.mineIcon.textContent = '⏹️';
        elements.mineText.textContent = 'STOP AUTOCLAIM';
        elements.mineHint.textContent = 'Node ativo — resgatando $CLAIM';
        setConfigEnabled(false);
        setStatus('online');
        epochStartTime = Date.now();
    } else {
        elements.btnMine.classList.remove('mining');
        elements.mineIcon.textContent = '⛏️';
        elements.mineText.textContent = 'START AUTOCLAIM';
        elements.mineHint.textContent = 'Configure sua wallet e clique para iniciar';
        setConfigEnabled(true);
        setStatus('offline');
        epochStartTime = null;
        elements.epochBarFill.style.width = '0%';
        elements.epochTimer.textContent = '60:00';
    }
}

// ─── Miner Events ────────────────────────────────────────────
window.miner.onStarting((data) => {
    addLog('mine', `Conectando à rede FaucetChain...`);
    addLog('info', `Wallet: ${data.wallet}`);
    addLog('info', `Node: ${data.nodeName} (${data.nodeId})`);
    elements.footerNodeId.textContent = data.nodeId;
});

window.miner.onRegistered((data) => {
    if (data.status === 'reconnected') {
        addLog('ok', `Reconectado à rede! Node: ${data.nodeId}`);
    } else {
        addLog('ok', `Registrado na rede! HB interval: ${data.heartbeatInterval}s`);
    }
});

window.miner.onRetry((data) => {
    addLog('warn', `Tentativa ${data.attempt}/${data.maxAttempts}... aguardando 5s`);
});

window.miner.onMiningStarted((data) => {
    addLog('mine', '✨ AUTOCLAIM INICIADO — 2,000 CLAIM/hora');
    setMiningUI(true);
});

window.miner.onHeartbeat((state) => {
    // Update stats
    elements.statUptime.textContent  = state.totalUptimeFormatted;
    elements.statEarned.textContent  = state.totalEarned.toFixed(4);
    elements.statCpu.textContent     = state.cpuLoad + '%';
    elements.statHb.textContent      = '#' + state.heartbeatCount;
    elements.epochUptime.textContent = state.epochUptimeFormatted;
    elements.epochsActive.textContent = state.epochsActive;

    // Epoch progress bar
    if (epochStartTime) {
        const elapsed = state.epochUptime;
        const progress = Math.min(100, (elapsed / EPOCH_DURATION) * 100);
        elements.epochBarFill.style.width = progress + '%';

        const remaining = Math.max(0, EPOCH_DURATION - elapsed);
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        elements.epochTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
});

window.miner.onError((err) => {
    addLog('error', `${err.type}: ${err.message}`);
    if (err.type === 'register' && err.message.includes('5 attempts')) {
        setMiningUI(false);
    }
});

window.miner.onStopped((data) => {
    addLog('warn', `Desconectado. Uptime: ${data.totalUptimeFormatted}`);
    addLog('info', `Total ganho: ${data.totalEarned.toFixed(4)} CLAIM`);
    setMiningUI(false);
});

// ─── Particles Background ─────────────────────────────────────
function initParticles() {
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const PARTICLE_COUNT = 40;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = (Math.random() - 0.5) * 0.3;
            this.opacity = Math.random() * 0.5 + 0.1;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
                this.reset();
            }
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 212, 255, ${this.opacity})`;
            ctx.fill();
        }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Particle());
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0, 212, 255, ${0.1 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }

        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animate);
    }
    animate();
}

// ─── Init ────────────────────────────────────────────────────
async function init() {
    await loadConfig();
    initParticles();
    setStatus('offline');
    addLog('info', 'FaucetChain AutoClaim v1.0.0 pronto.');
}

init();
