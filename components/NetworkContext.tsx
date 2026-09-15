
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { API_BASE_URL, WS_BASE_URL } from '../apiConfig';

interface NetworkMetrics {
    blockHeight: number;
    activeValidators: number;
    totalStaked: number;
    tps: number;
    avgGasPrice: number;
    networkHashrate: number;
    totalTransactions: number;
    activeConnections: number;
    nodeCount: number;
    avgBlockFinalizationTime: number;
    currentReward: number;
}

interface Block {
    height: number;
    validator: string;
    txs: number;
    timestamp: number;
    reward: number;
}

interface Anomaly {
    type: 'CONGESTION' | 'VALIDATOR_DROP' | 'LATENCY_SPIKE' | 'NONE';
    severity: 'LOW' | 'MEDIUM' | 'CRITICAL';
    timestamp: number;
    description: string;
}

interface NetworkContextType {
    metrics: NetworkMetrics;
    blocks: Block[];
    anomaly: Anomaly;
    setAnomaly: (a: Anomaly) => void;
    triggerAnomaly: (type: Anomaly['type']) => void;
    addBlockManually: (validator: string, txCount: number) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [anomaly, setAnomaly] = useState<Anomaly>({ type: 'NONE', severity: 'LOW', timestamp: Date.now(), description: 'Rede estável.' });
    const [metrics, setMetrics] = useState<NetworkMetrics>({
        blockHeight: 0,
        activeValidators: 0,
        totalStaked: 0,
        tps: 0,
        avgGasPrice: 0,
        networkHashrate: 0,
        totalTransactions: 0,
        activeConnections: 0,
        nodeCount: 0,
        avgBlockFinalizationTime: 0,
        currentReward: 0
    });

    const [blocks, setBlocks] = useState<Block[]>([]);

    const addBlockManually = (validator: string, txCount: number) => {
        setBlocks(prev => {
            const nextHeight = metrics.blockHeight + 1;

            const newBlock = {
                height: nextHeight,
                validator,
                txs: txCount,
                timestamp: Date.now(),
                reward: metrics.currentReward || 50
            };

            setMetrics(m => ({
                ...m,
                blockHeight: nextHeight,
                totalTransactions: m.totalTransactions + txCount,
            }));

            return [newBlock, ...prev.slice(0, 19)];
        });
    };

    const triggerAnomaly = (type: Anomaly['type']) => {
        let desc = '';
        let severity: Anomaly['severity'] = 'MEDIUM';

        switch (type) {
            case 'CONGESTION':
                desc = 'Pico de tráfego detectado nos Hubs externos.';
                severity = 'MEDIUM';
                break;
            case 'VALIDATOR_DROP':
                desc = 'Desconexão massiva de nós PoS detectada.';
                severity = 'CRITICAL';
                break;
            default:
                desc = 'Estável.';
                severity = 'LOW';
        }

        setAnomaly({ type, severity, timestamp: Date.now(), description: desc });
        setTimeout(() => {
            setAnomaly({ type: 'NONE', severity: 'LOW', timestamp: Date.now(), description: 'Rede estável.' });
        }, 15000);
    };

    const fetchNetworkData = async () => {
        try {
            const [blocksRes, metricsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/blocks`),
                fetch(`${API_BASE_URL}/api/network-metrics`)
            ]);

            if (blocksRes.ok) setBlocks(await blocksRes.json());
            if (metricsRes.ok) {
                const data = await metricsRes.json();
                setMetrics(prev => ({ ...prev, ...data }));
            }
        } catch (error) {
            console.error("Failed to fetch initial network data:", error);
        }
    };

    useEffect(() => {
        fetchNetworkData();

        // WebSocket with auto-reconnect and exponential backoff
        let socket: WebSocket | null = null;
        let reconnectTimeout: ReturnType<typeof setTimeout>;
        let reconnectDelay = 1000;
        const MAX_DELAY = 30000;
        let unmounted = false;

        const connect = () => {
            if (unmounted) return;
            socket = new WebSocket(`${WS_BASE_URL}/ws/network`);

            socket.onopen = () => {
                console.log('🔗 WebSocket connected');
                reconnectDelay = 1000; // reset backoff on success
            };

            socket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                if (message.type === 'NEW_BLOCK') {
                    console.log("🚀 Real-time Block Update Received:", message.data);
                    fetchNetworkData();
                }
            };

            socket.onclose = () => {
                if (unmounted) return;
                console.warn(`WebSocket disconnected. Reconnecting in ${reconnectDelay / 1000}s...`);
                reconnectTimeout = setTimeout(() => {
                    reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
                    connect();
                }, reconnectDelay);
            };

            socket.onerror = () => {
                socket?.close();
            };
        };

        connect();

        return () => {
            unmounted = true;
            clearTimeout(reconnectTimeout);
            socket?.close();
        };
    }, []);

    return (
        <NetworkContext.Provider value={{ metrics, blocks, anomaly, setAnomaly, triggerAnomaly, addBlockManually }}>
            {children}
        </NetworkContext.Provider>
    );
};

export const useNetwork = () => {
    const context = useContext(NetworkContext);
    if (context === undefined) {
        throw new Error('useNetwork must be used within a NetworkProvider');
    }
    return context;
};
