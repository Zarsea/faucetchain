/**
 * ⛏️  FaucetChain Miner — Electron Main Process
 */
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { MinerCore } = require('../miner-core');

let mainWindow;
let tray = null;
let miner = null;

// ─── Config Persistence ──────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, '..', '.env');
const DEFAULT_CONFIG = {
    walletAddress: '',
    apiUrl: 'http://localhost:8000',
    nodeName: `node-${require('os').hostname()}`
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const content = fs.readFileSync(CONFIG_FILE, 'utf8');
            const config = { ...DEFAULT_CONFIG };
            const lines = content.split('\n');
            for (const line of lines) {
                if (line.startsWith('WALLET_ADDRESS=')) config.walletAddress = line.split('=')[1].trim();
                if (line.startsWith('API_URL=')) config.apiUrl = line.split('=')[1].trim();
                if (line.startsWith('NODE_NAME=')) config.nodeName = line.split('=')[1].trim();
            }
            return config;
        }
    } catch (e) { /* ignore */ }
    return DEFAULT_CONFIG;
}

function saveConfig(config) {
    const envContent = [
        '# FaucetChain Mining Node Configuration',
        '',
        '# Your wallet address',
        `WALLET_ADDRESS=${config.walletAddress || ''}`,
        '',
        '# API server URL',
        `API_URL=${config.apiUrl || 'http://127.0.0.1:8000'}`,
        '',
        '# Name for your node',
        `NODE_NAME=${config.nodeName || ''}`,
        ''
    ].join('\n');
    fs.writeFileSync(CONFIG_FILE, envContent);
}

// ─── Create Window ───────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 680,
        minWidth: 780,
        minHeight: 580,
        frame: false,
        transparent: false,
        backgroundColor: '#0a0e1a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'FaucetChain Miner',
        show: false
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Minimize to tray instead of closing
    mainWindow.on('close', (event) => {
        if (miner && miner.isRunning) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ─── System Tray ─────────────────────────────────────────────────
function createTray() {
    // Create a simple 16x16 tray icon
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    let trayIcon;
    try {
        trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    } catch (e) {
        trayIcon = nativeImage.createEmpty();
    }
    
    tray = new Tray(trayIcon);
    tray.setToolTip('FaucetChain Miner');

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Abrir FaucetChain Miner', click: () => { if (mainWindow) mainWindow.show(); } },
        { type: 'separator' },
        { label: 'Sair', click: () => { app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (mainWindow) mainWindow.show();
    });
}

// ─── IPC Handlers ────────────────────────────────────────────────
function setupIPC() {
    ipcMain.handle('get-config', () => {
        return loadConfig();
    });

    ipcMain.handle('save-config', (_, config) => {
        saveConfig(config);
        return { status: 'saved' };
    });

    ipcMain.handle('start-mining', async (_, config) => {
        if (miner && miner.isRunning) {
            return { status: 'already-running' };
        }

        // Save config
        saveConfig(config);

        // Create new miner instance
        miner = new MinerCore({
            apiUrl: config.apiUrl || 'http://127.0.0.1:8000',
            walletAddress: config.walletAddress,
            nodeName: config.nodeName,
            nodeIdFile: path.join(__dirname, '..', '.node_id')
        });

        // Forward events to renderer
        const events = ['starting', 'registered', 'retry', 'mining-started', 'heartbeat', 'error', 'stopped'];
        events.forEach(event => {
            miner.on(event, (data) => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send(`miner-${event}`, data);
                }
            });
        });

        const success = await miner.start();
        return { status: success ? 'started' : 'failed' };
    });

    ipcMain.handle('stop-mining', async () => {
        if (miner && miner.isRunning) {
            await miner.stop();
            miner = null;
            return { status: 'stopped' };
        }
        return { status: 'not-running' };
    });

    ipcMain.handle('get-state', () => {
        if (miner) return miner.getState();
        return null;
    });

    // Window controls
    ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
    ipcMain.on('window-maximize', () => {
        if (mainWindow) {
            mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
        }
    });
    ipcMain.on('window-close', () => {
        if (miner && miner.isRunning) {
            if (mainWindow) mainWindow.hide();
        } else {
            if (mainWindow) mainWindow.close();
        }
    });
}

// ─── App Lifecycle ───────────────────────────────────────────────
app.whenReady().then(() => {
    setupIPC();
    createWindow();
    createTray();
});

app.on('window-all-closed', () => {
    // Keep running in tray if mining
    if (!miner || !miner.isRunning) {
        app.quit();
    }
});

app.on('activate', () => {
    if (!mainWindow) createWindow();
    else mainWindow.show();
});

app.on('before-quit', async () => {
    if (miner && miner.isRunning) {
        await miner.stop();
    }
});
