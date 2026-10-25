
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { API_BASE_URL, WS_BASE_URL } from '../apiConfig';

// `null` nos campos que a rede pode nao ter medido ainda, e `networkHashrate`
// sempre nulo porque nao ha prova de trabalho aqui para contar hash nenhum.
//
// O tipo e nulo de proposito. Era `number` em tudo, e o servidor preenchia o
// que nao sabia com estimativa -- `blockHeight` virava claims + transacoes,
// `networkHashrate` virava essa soma vezes 12.5. Deixar o tipo admitir a
// ausencia e o que obriga cada tela a escolher o que escrever quando nao ha
// medida, em vez de receber um numero que parece medido.
export interface NetworkMetrics {
    blockHeight: number;
    blockCount: number;
    activeValidators: number;
    totalStaked: number;
    tps: number | null;
    avgGasPrice: number | null;
    networkHashrate: number | null;
    totalTransactions: number;
    activeConnections: number;
    nodeCount: number;
    avgBlockFinalizationTime: number | null;
    currentReward: number;
}

/** O que uma tela escreve quando a medida nao existe. */
export const semMedida = '—';

/** Numero medido, ou um traco. Nunca um zero que se passa por medicao. */
export const medidaOuTraco = (
    v: number | null | undefined,
    casas = 2,
    sufixo = '',
): string => (v == null ? semMedida : `${v.toFixed(casas)}${sufixo}`);

/** Segundos em unidade legivel, ou um traco.
 *
 * Esta rede sela em rajadas: o intervalo tipico entre blocos foi medido em
 * 89.378 segundos. Escrito assim nao se le, e arredondar para segundos com
 * duas casas sugere uma precisao que a medida nao tem.
 */
export const duracaoOuTraco = (s: number | null | undefined): string => {
    if (s == null) return semMedida;
    if (s < 90) return `${Math.round(s)}s`;
    if (s < 5400) return `${(s / 60).toFixed(1)}min`;
    if (s < 172800) return `${(s / 3600).toFixed(1)}h`;
    return `${(s / 86400).toFixed(1)}d`;
};

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
    const [anomaly, setAnomaly] = useState<Anomaly>({ type: 'NONE', severity: 'LOW', timestamp: Date.now(), description: 'Network stable.' });
    const [metrics, setMetrics] = useState<NetworkMetrics>({
        blockHeight: 0,
        blockCount: 0,
        activeValidators: 0,
        totalStaked: 0,
        // Antes da primeira resposta nada foi medido, entao nulo. Zerar aqui
        // faria a tela anunciar uma rede parada durante o carregamento.
        tps: null,
        avgGasPrice: null,
        networkHashrate: null,
        totalTransactions: 0,
        activeConnections: 0,
        nodeCount: 0,
        avgBlockFinalizationTime: null,
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
                desc = 'Traffic spike detected on external hubs.';
                severity = 'MEDIUM';
                break;
            case 'VALIDATOR_DROP':
                desc = 'Mass disconnection of PoS nodes detected.';
                severity = 'CRITICAL';
                break;
            default:
                desc = 'Stable.';
                severity = 'LOW';
        }

        setAnomaly({ type, severity, timestamp: Date.now(), description: desc });
        setTimeout(() => {
            setAnomaly({ type: 'NONE', severity: 'LOW', timestamp: Date.now(), description: 'Network stable.' });
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
