
import React, { useState, useEffect } from 'react';
import { SectionCard } from './SectionCard';
import { SignalIcon, CubeIcon, ChartBarIcon, BeakerIcon } from './IconComponents';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, AreaChart, Area } from 'recharts';
import { useNetwork } from './NetworkContext';
import { localeDoIdioma, numeroLocal, useLanguage } from './LanguageContext';
import { NetworkSentinel } from './NetworkSentinel';
import { verifyBlockHashMerkleProof } from '../utils/merkle';
import { API_BASE_URL } from '../apiConfig';
import { BlockViewer } from './BlockViewer';

const formatNumber = (num: number, lang: string) => new Intl.NumberFormat(localeDoIdioma(lang)).format(num);

const MetricItem: React.FC<{ label: string; value: string; trend?: 'UP' | 'DOWN' | 'NEUTRAL' }> = ({ label, value, trend }) => (
    <div className="bg-brand-bg/50 p-4 rounded-lg border border-brand-border hover:border-brand-primary/30 transition-colors duration-300">
        <p className="text-xs text-brand-muted uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-xl font-semibold ${trend === 'UP' ? 'text-red-400' : trend === 'DOWN' ? 'text-green-400' : 'text-brand-secondary'}`}>
            {value}
        </p>
    </div>
);

// O que cada coluna representa, lido de `bucket_seconds` da resposta.
//
// Aqui havia uma tabela fixa de faixa para palavra, e ela estava errada em
// `all`: o backend faz o balde crescer com o historico
// (`passo = 86400 * (dias // 60 + 1)` passados 60 dias), entao com cinco meses
// de blocos o eixo ja desenhava baldes de tres dias enquanto o titulo dizia
// "by day". Qualquer tabela escrita aqui envelhece errada, porque o tamanho do
// balde e decisao de quem agrupa -- e quem agrupa ja manda o numero junto.
export const legendaDoBalde = (
    segundos: number | null | undefined,
    tri: (en: string, pt: string, es?: string) => string,
): string => {
    if (!segundos || segundos <= 0) return '';
    if (segundos % 86400 === 0) {
        const d = segundos / 86400;
        return d === 1 ? tri('day', 'dia', 'día')
                       : tri(`${d} days`, `${d} dias`, `${d} días`);
    }
    if (segundos % 3600 === 0) {
        const h = segundos / 3600;
        return h === 1 ? tri('hour', 'hora', 'hora')
                       : tri(`${h} hours`, `${h} horas`, `${h} horas`);
    }
    const m = Math.round(segundos / 60);
    if (m >= 1) {
        return m === 1 ? tri('minute', 'minuto', 'minuto')
                       : tri(`${m} minutes`, `${m} minutos`, `${m} minutos`);
    }
    return segundos === 1 ? tri('second', 'segundo', 'segundo')
                          : tri(`${segundos} seconds`, `${segundos} segundos`, `${segundos} segundos`);
};

export const NetworkStatus: React.FC = () => {
    const { metrics, blocks, triggerAnomaly, anomaly } = useNetwork();
    const { lang, tri } = useLanguage();
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
    // Quem agrupou e quem sabe o tamanho do balde. Guardar o numero e o que
    // mantem o titulo do grafico concordando com o eixo dele.
    const [balde, setBalde] = useState<number | null>(null);
    const porBalde = legendaDoBalde(balde, tri);

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
                setBalde(typeof d.bucket_seconds === 'number' ? d.bucket_seconds : null);
            } catch {
                // Serie vazia e melhor que serie velha: o grafico fica em
                // branco em vez de desenhar um passado que nao se confirmou.
                // O balde vai junto: titulo sem serie para descrever mentiria
                // sobre dados que nao chegaram.
                if (vivo) { setSerie([]); setTotais(null); setBalde(null); }
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
        if (diff < 2) return tri('Just now', 'Agora mesmo', 'Ahora mismo');
        return tri(`${diff}s ago`, `${diff}s atrás`, `hace ${diff}s`);
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
                {/* Estes botões não tocam a rede nem o servidor: só acendem o
                    alerta na tela por 15 s (NetworkContext.triggerAnomaly). O
                    rótulo diz isso, porque a tela ao redor é de dados reais. */}
                <div role="group" aria-label="Demo only: simulated alerts, no effect on the network" className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand-muted/70">Demo only · simulated alert, the network is untouched</span>
                    <div className="flex gap-2 p-1 bg-brand-surface border border-brand-border rounded-lg">
                        <button
                            onClick={() => triggerAnomaly('CONGESTION')}
                            className="px-3 py-1 min-h-[44px] md:min-h-0 text-[10px] font-bold uppercase bg-orange-500/10 text-orange-500 border border-orange-500/30 rounded hover:bg-orange-500/20 transition-all"
                        >
                            Simulate Congestion
                        </button>
                        <button
                            onClick={() => triggerAnomaly('VALIDATOR_DROP')}
                            className="px-3 py-1 min-h-[44px] md:min-h-0 text-[10px] font-bold uppercase bg-red-500/10 text-red-500 border border-red-500/30 rounded hover:bg-red-500/20 transition-all"
                        >
                            Force Validator Drop
                        </button>
                    </div>
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
                        {numeroLocal(totais.txs)} transactions in {numeroLocal(totais.blocos)} blocks
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <SectionCard title="Transaction Volume" icon={<ChartBarIcon className="w-5 h-5" />}>
                        <h4 className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-4">
                            {porBalde
                                ? tri(`Transactions per block, by ${porBalde}`,
                                      `Transações por bloco, por ${porBalde}`,
                                      `Transacciones por bloque, por ${porBalde}`)
                                : tri('Transactions per block',
                                      'Transações por bloco',
                                      'Transacciones por bloque')}
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
                            {porBalde
                                ? tri(`Transactions per second, measured per ${porBalde}`,
                                      `Transações por segundo, medidas por ${porBalde}`,
                                      `Transacciones por segundo, medidas por ${porBalde}`)
                                : tri('Transactions per second, measured',
                                      'Transações por segundo, medidas',
                                      'Transacciones por segundo, medidas')}
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
