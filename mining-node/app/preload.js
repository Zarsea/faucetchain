/**
 * ⛏️  FaucetChain Miner — Preload Script (Context Bridge)
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('miner', {
    // Config
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),

    // Mining controls
    start: (config) => ipcRenderer.invoke('start-mining', config),
    stop: () => ipcRenderer.invoke('stop-mining'),
    getState: () => ipcRenderer.invoke('get-state'),

    // Event listeners
    onStarting: (cb) => ipcRenderer.on('miner-starting', (_, data) => cb(data)),
    onRegistered: (cb) => ipcRenderer.on('miner-registered', (_, data) => cb(data)),
    onRetry: (cb) => ipcRenderer.on('miner-retry', (_, data) => cb(data)),
    onMiningStarted: (cb) => ipcRenderer.on('miner-mining-started', (_, data) => cb(data)),
    onHeartbeat: (cb) => ipcRenderer.on('miner-heartbeat', (_, data) => cb(data)),
    onError: (cb) => ipcRenderer.on('miner-error', (_, data) => cb(data)),
    onStopped: (cb) => ipcRenderer.on('miner-stopped', (_, data) => cb(data)),

    // Window controls
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close')
});
