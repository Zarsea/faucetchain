
import React, { useState, useEffect } from 'react';
import { SectionCard } from './SectionCard';
import { SignalIcon, CubeIcon, ChartBarIcon, BeakerIcon } from './IconComponents';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, AreaChart, Area } from 'recharts';
import { useNetwork } from './NetworkContext';
import { useLanguage } from './LanguageContext';
import { NetworkSentinel } from './NetworkSentinel';
import { verifyBlockHashMerkleProof } from '../utils/merkle';
import { API_BASE_URL } from '../apiConfig';
import { BlockViewer } from './BlockViewer';

const formatNumber = (num: number, lang: string) => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US').format(num);

const MetricItem: React.FC<{ label: string; value: string; trend?: 'UP' | 'DOWN' | 'NEUTRAL' }> = ({ label, value, trend }) => (
    <div className="bg-brand-bg/50 p-4 rounded-lg border border-brand-border hover:border-brand-primary/30 transition-colors duration-300">
        <p className="text-xs text-brand-muted uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-xl font-semibold ${trend === 'UP' ? 'text-red-400' : trend === 'DOWN' ? 'text-green-400' : 'text-brand-secondary'}`}>
            {value}
        </p>
    </div>
);

// O que cada coluna representa, por faixa. O titulo do grafico dizer "hourly"
// enquanto o eixo mostra datas foi parte do que fazia esta tela nao bater.
const FAIXA_LEGENDA: Record<string, string> = {
    '4h': '10 minutes',
    '24h': 'hour',
    '7d': '6 hours',
    '30d': 'day',
    'all': 'day',
};

export const NetworkStatus: React.FC = () => {
    const { metrics, blocks, triggerAnomaly, anomaly } = useNetwork();
    const { lang } = useLanguage();
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [verifyState, setVerifyState] = useState<Record<number, 'idle' | 'loading' | 'verified' | 'failed'>>({});
    const [epochActive, setEpochActive] = useState(true);

    // Estes dois arrays eram vinte e quatro zeros declarados aqui dentro, e o
    // comentario do laco abaixo dizia que ficariam assim "ate termos um
    // indexador". Ficaram meses: quem abria a tela via uma linha no chao com
    // um espeto na ponta, que era o valor atual escrito no ultimo balde. Agora
    // os dois leem /api/network/history, e a faixa e escolha de quem olha.
    const [faixa, setFaixa] = useState<'4h' | '24h' | '7d' | '30d' | 'all'>('24h');
    const [serie, setSerie] = useState<{ label: string; txs: number; blocks: number; tps: number }[]>([]);
    const [totais, setTotais] = useState<{ blocos: number; txs: number } | null>(null);

    // Recarrega quando a faixa muda, e de minuto em minuto. Nao de segundo em
    // segundo como o resto desta tela: o balde mais curto tem dez minutos,
    // entao pedir a cada segundo seria a mesma resposta sessenta vezes.
    useEffect(() => {
        let vivo = true;
        const buscar = async () => {
            try {
                const r = await fetch(`${API_BASE_URL}/api/network/history?range=${faixa}`);
                if (!r.ok) throw new Error(String(r.status));
                const d = await r.json();
                if (!vivo) return;
                setSerie(d.points ?? []);
                setTotais({ blocos: d.total_blocks ?? 0, txs: d.total_txs ?? 0 });
            } catch {
                // Serie vazia e melhor que serie velha: o grafico fica em
                // branco em vez de desenhar um passado que nao se confirmou.
                if (vivo) { setSerie([]); setTotais(null); }
            }
        };
        buscar();
        const timer = setInterval(buscar, 60000);
        return () => { vivo = false; clearInterval(timer); };
    }, [faixa]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(Date.now());

            // Fetch current L1 epoch health
            fetch(`${API_BASE_URL}/api/epoch/status`)
                .then(r => r.json())
                .then(d => setEpochActive(d.isActive))
                .catch(() => {});

        }, 1000);
        return () => clearInterval(interval);
    }, [anomaly.type]);

    const getRelativeTime = (timestamp: number) => {
        const diff = Math.floor((currentTime - timestamp) / 1000);
        if (diff < 2) return lang === 'pt' ? 'Agora mesmo' : 'Just now';
        return lang === 'pt' ? `${diff}s atrás` : `${diff}s ago`;
    };

    const verifyBlock = async (height: number) => {
        setVerifyState(prev => ({ ...prev, [height]: 'loading' }));
        try {
            const res = await fetch(`${API_BASE_URL}/api/blocks/${height}/merkle-proof?epoch_size=128`);
            if (!res.ok) throw new Error('proof fetch failed');
            const proof = await res.json();
            const ok = verifyBlockHashMerkleProof({
                blockHash: proof.blockHash,
                root: proof.root,
                siblings: proof.siblings,
                index: proof.index
            });
            setVerifyState(prev => ({ ...prev, [height]: ok ? 'verified' : 'failed' }));
        } catch {
            setVerifyState(prev => ({ ...prev, [height]: 'failed' }));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-secondary">Network Status</h2>
                    <p className="text-brand-muted">
                        Live metrics and AI-driven supervision of the FaucetChain appchain, which settles on Solana.
                    </p>
                </div>
                <div className="flex gap-2 p-1 bg-brand-surface border border-brand-border rounded-lg">
                    <button
                        onClick={() => triggerAnomaly('CONGESTION')}
                        className="px-3 py-1 text-[10px] font-bold uppercase bg-orange-500/10 text-orange-500 border border-orange-500/30 rounded hover:bg-orange-500/20 transition-all"
                    >
                        Simulate Congestion
                    </button>
                    <button
                        onClick={() => triggerAnomaly('VALIDATOR_DROP')}
                        className="px-3 py-1 text-[10px] font-bold uppercase bg-red-500/10 text-red-500 border border-red-500/30 rounded hover:bg-red-500/20 transition-all"
                    >
                        Force Validator Drop
                    </button>
                </div>
            </div>

            <NetworkSentinel />

            <SectionCard title="Live Network Metrics" icon={<SignalIcon className="w-5 h-5 animate-pulse text-green-500" />}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricItem label="Latest Block" value={`#${formatNumber(metrics.blockHeight, lang)}`} />
                    <MetricItem label="Block Time" value="2.1s" />
                    <MetricItem label="Epoch Quota" value={epochActive ? "ACTIVE" : "DEPLETED"} trend={epochActive ? "DOWN" : "UP"} />
                    <MetricItem
                        label="Avg Finality"
                        value={`${metrics.avgBlockFinalizationTime}s`}
                        trend={metrics.avgBlockFinalizationTime > 2 ? 'UP' : 'NEUTRAL'}
                    />
                    <MetricItem label="Total Nodes" value={formatNumber(metrics.nodeCount, lang)} />
                    <MetricItem
                        label="Validators"
                        value={formatNumber(metrics.activeValidators, lang)}
                        trend={metrics.activeValidators < 100 ? 'DOWN' : 'NEUTRAL'}
                    />
                    <MetricItem label="Connections" value={formatNumber(metrics.activeConnections, lang)} />
                    <MetricItem label="Total Staked" value={`${formatNumber(metrics.totalStaked, lang)} $CLAIM`} />
                    <MetricItem label="Total Transactions" value={formatNumber(metrics.totalTransactions, lang)} />
                    <MetricItem
                        label="Avg Network Fee"
                        value={`${metrics.avgGasPrice} µCLAIM`}
                        trend={metrics.avgGasPrice > 4 ? 'UP' : 'NEUTRAL'}
                    />
                    <MetricItem label="Hashrate" value={`${metrics.networkHashrate} TH/s`} />
                    <MetricItem
                        label="Current TPS"
                        value={metrics.tps.toString()}
                        trend={metrics.tps > 300 ? 'UP' : 'NEUTRAL'}
                    />
                </div>
            </SectionCard>

            {/* A faixa fica fora dos cartoes porque governa os dois. Dentro de
                um deles, pareceria ajuste daquele grafico so. */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-muted mr-1">Range</span>
                {([['4h', '4 hours'], ['24h', '24 hours'], ['7d', '7 days'],
                   ['30d', '30 days'], ['all', 'All time']] as const).map(([id, rotulo]) => (
                    <button
                        key={id}
                        onClick={() => setFaixa(id)}
                        className={`min-h-[36px] px-3 rounded-lg text-xs font-bold border transition-colors
                            ${faixa === id
                                ? 'bg-brand-primary/15 border-brand-primary/50 text-brand-primary'
                                : 'bg-brand-card/40 border-brand-border text-brand-muted hover:text-brand-secondary'}`}
                    >
                        {rotulo}
                    </button>
                ))}
                {totais && (
                    <span className="text-[11px] text-brand-muted ml-auto tabular">
                        {totais.txs.toLocaleString()} transactions in {totais.blocos.toLocaleString()} blocks
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <SectionCard title="Transaction Volume" icon={<ChartBarIcon className="w-5 h-5" />}>
                        <h4 className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-4">
                            Transactions per block, by {FAIXA_LEGENDA[faixa]}
                        </h4>
                        <div style={{ width: '100%', height: 260 }}>
                            <ResponsiveContainer>
                                <BarChart data={serie}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
                                    <XAxis
                                        dataKey="label"
                                        stroke="#8B949E"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#8B949E"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(88, 166, 255, 0.1)' }}
                                        contentStyle={{ backgroundColor: '#0D1117', border: '1px solid #30363D', color: '#C9D1D9' }}
                                    />
                                    <Bar dataKey="txs" fill="#58A6FF" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </SectionCard>

                    <SectionCard title="TPS" icon={<SignalIcon className="w-5 h-5 text-brand-primary" />}>
                        {/* Era "estimated history" sobre numeros que nao vinham
                            de lugar nenhum. Isto e medido: transacoes do balde
                            divididas pelos segundos dele. */}
                        <h4 className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-4">
                            Transactions per second, measured per {FAIXA_LEGENDA[faixa]}
                        </h4>
                        <div style={{ width: '100%', height: 260 }}>
                            <ResponsiveContainer>
                                <AreaChart data={serie}>
                                    <defs>
                                        <linearGradient id="colorTps" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#58A6FF" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#58A6FF" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
                                    <XAxis
                                        dataKey="label"
                                        stroke="#8B949E"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#8B949E"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0D1117', border: '1px solid #30363D', color: '#C9D1D9', borderRadius: '8px' }}
                                        formatter={(val: number) => [`${val} TPS`, 'Performance']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="tps"
                                        stroke="#58A6FF"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#colorTps)"
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </SectionCard>
                </div>
            </div>

            {/* Block Explorer Integration */}
            <div className="pt-8 mt-8 border-t border-brand-border/30">
                <BlockViewer />
            </div>
        </div>
    );
};
