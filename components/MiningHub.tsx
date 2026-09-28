
import React, { useState, useEffect, useCallback } from 'react';
import { SectionCard } from './SectionCard';
import {
    SignalIcon,
    CubeIcon,
    SparklesIcon,
    ShieldCheckIcon,
    ChartBarIcon,
    CpuChipIcon,
    LoadingIcon,
    BoltIcon
} from './IconComponents';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { API_BASE_URL } from '../apiConfig';

interface MiningStats {
    nodesOnline: number;
    totalRegistered: number;
    totalDistributed: number;
    epochReward: number;
    estimatedRewardPerNode: number;
    lastEpochId: number;
    avgCpuLoad: number;
    heartbeatInterval: number;
    epochDuration: number;
}

interface SealerState {
    tip: { height: number; hash: string; sealed_at: number | null };
    pending_claims: number;
    elected: string | null;
    nodes: { wallet: string; stake: number; weight: number; share: number }[];
    stake_cap: number;
    bootstrap: boolean;
}

interface Miner {
    rank: number;
    wallet_address: string;
    node_name: string;
    total_uptime_seconds: number;
    uptime_hours: number;
    total_earned: number;
    epochs_active: number;
    is_online: boolean;
}

interface Reward {
    epoch_id: number;
    node_id: string;
    reward_amount: number;
    uptime_share: number;
    distributed_at: number;
}

export const MiningHub: React.FC = () => {
    const { userAddress, isConnected } = useAuth();
    const { lang } = useLanguage();

    const [stats, setStats] = useState<MiningStats | null>(null);
    const [sealer, setSealer] = useState<SealerState | null>(null);
    const [leaderboard, setLeaderboard] = useState<Miner[]>([]);
    const [myRewards, setMyRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);
    const [epochCountdown, setEpochCountdown] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            const [sRes, lRes, secRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/mining/stats`),
                fetch(`${API_BASE_URL}/api/mining/leaderboard?limit=20`),
                fetch(`${API_BASE_URL}/api/mining/sealer`)
            ]);
            if (sRes.ok) setStats(await sRes.json());
            if (lRes.ok) setLeaderboard(await lRes.json());
            if (secRes.ok) setSealer(await secRes.json());

            if (isConnected && userAddress) {
                const rRes = await fetch(`${API_BASE_URL}/api/mining/rewards/${userAddress}`);
                if (rRes.ok) setMyRewards(await rRes.json());
            }
        } catch (err) {
            console.error('Mining data fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [isConnected, userAddress]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Epoch countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const epochStart = Math.floor(now / 3600) * 3600;
            const remaining = (epochStart + 3600) - now;
            setEpochCountdown(remaining);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatCountdown = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <LoadingIcon className="w-12 h-12 animate-spin text-brand-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn pb-20">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-surface via-brand-bg to-brand-surface border border-brand-border/50 p-8 md:p-12">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-accent/5 rounded-full blur-3xl" />

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl">
                                <CpuChipIcon className="w-8 h-8 text-brand-primary" />
                            </div>
                            <div>
                                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter">
                                    {lang === 'en' ? 'AutoClaim Hub' : 'Hub AutoClaim'}
                                </h2>
                                <p className="text-xs text-brand-primary font-black uppercase tracking-[0.3em]">
                                    Auto-Claim Network
                                </p>
                            </div>
                        </div>
                        <p className="text-brand-muted max-w-xl leading-relaxed">
                            {lang === 'en'
                                ? 'Run the AutoClaim Node on your machine to earn $CLAIM automatically. Keep your node online — the longer your uptime, the bigger your share of the 2,000 CLAIM/hour epoch reward.'
                                : 'Rode o Nó de AutoClaim na sua máquina para ganhar $CLAIM automaticamente. Mantenha seu nó online — quanto mais uptime, maior sua parcela da recompensa de 2.000 CLAIM/hora.'}
                        </p>
                    </div>

                    {/* Epoch Countdown */}
                    <div className="flex-shrink-0 text-center">
                        <div className="relative">
                            <svg className="w-32 h-32 transform -rotate-90">
                                <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="4" className="text-brand-border/30" />
                                <circle cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth="4"
                                    className="text-brand-primary" strokeLinecap="round"
                                    strokeDasharray={`${(1 - epochCountdown / 3600) * 352} 352`}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-black text-white font-mono">{formatCountdown(epochCountdown)}</span>
                                <span className="text-[8px] font-black text-brand-muted uppercase tracking-widest">
                                    {lang === 'en' ? 'Next Epoch' : 'Próx. Epoch'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: lang === 'en' ? 'Nodes Online' : 'Nós Online', value: stats.nodesOnline.toString(), icon: <SignalIcon className="w-5 h-5 text-green-400" />, highlight: true },
                        { label: lang === 'en' ? 'CLAIM/Hour' : 'CLAIM/Hora', value: stats.epochReward.toLocaleString(), icon: <BoltIcon className="w-5 h-5 text-yellow-400" /> },
                        { label: lang === 'en' ? 'Est. per Node' : 'Est. por Nó', value: `${stats.estimatedRewardPerNode}`, icon: <SparklesIcon className="w-5 h-5 text-brand-primary" /> },
                        { label: lang === 'en' ? 'Total Distributed' : 'Total Distribuído', value: `${stats.totalDistributed.toLocaleString()}`, icon: <ChartBarIcon className="w-5 h-5 text-brand-accent" /> },
                    ].map((s, i) => (
                        <div key={i} className={`glass border rounded-2xl p-5 transition-all hover:border-brand-primary/30 ${
                            s.highlight ? 'border-green-500/30 bg-green-500/5' : 'border-brand-border/50'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">{s.icon}
                                <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest">{s.label}</span>
                            </div>
                            <p className="text-3xl font-black text-white font-mono tracking-tighter">{s.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* O sorteio do selador, dito como ele e. Este bloco existe porque o
                cabecalho promete "Hybrid PoC-V3 Consensus" e a tela nao mostrava
                nada que sustentasse a frase. Cada numero vem de
                /api/mining/sealer, e qualquer um refaz a conta. */}
            {sealer && (
                <SectionCard
                    title={lang === 'en' ? 'Who seals the next block' : 'Quem sela o proximo bloco'}
                    icon={<CubeIcon className="w-5 h-5 text-brand-primary" />}
                >
                    <div className="space-y-5">
                        <p className="text-sm text-brand-muted leading-relaxed max-w-2xl">
                            {lang === 'en'
                                ? 'The draw is a function of the parent block hash and active stake, so anyone holding the chain can recompute it. Weight is 1 + min(stake, cap): the +1 keeps a node with no stake in the draw, and the cap stops the largest staker from sealing every round.'
                                : 'O sorteio e funcao do hash do bloco pai e do stake ativo, entao qualquer um que tenha a cadeia refaz a conta. O peso e 1 + min(stake, teto): o +1 mantem no sorteio um no sem stake, e o teto impede que quem travou mais sele toda rodada.'}
                        </p>

                        {sealer.bootstrap ? (
                            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400 mb-1">
                                    {lang === 'en' ? 'Bootstrap - no consensus running' : 'Bootstrap - sem consenso rodando'}
                                </p>
                                <p className="text-sm text-brand-muted leading-relaxed">
                                    {lang === 'en'
                                        ? 'No node is online, so the election has no participants and any caller may seal. Start a node to change that.'
                                        : 'Nenhum no online, entao a eleicao nao tem participantes e qualquer chamador pode selar. Suba um no para mudar isso.'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {sealer.nodes.map((n) => (
                                    <div key={n.wallet} className="rounded-xl border border-brand-border/50 bg-brand-bg/40 p-3">
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <span className="font-mono text-xs text-brand-secondary break-all">
                                                {n.wallet}
                                                {n.wallet === sealer.elected && (
                                                    <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-green-400">
                                                        {lang === 'en' ? 'elected' : 'sorteado'}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="font-mono text-sm font-black text-white tabular-nums">
                                                {(n.share * 100).toFixed(2)}%
                                            </span>
                                        </div>
                                        <div className="mt-2 h-1.5 rounded-full bg-brand-border/40 overflow-hidden">
                                            <div className="h-full bg-brand-primary rounded-full"
                                                 style={{ width: `${Math.max(n.share * 100, 0.4)}%` }} />
                                        </div>
                                        <p className="mt-2 text-[11px] text-brand-muted font-mono">
                                            stake {n.stake.toLocaleString()} -&gt; {lang === 'en' ? 'weight' : 'peso'} {n.weight.toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* A parte que ninguem estava dizendo. */}
                        <div className="rounded-xl border border-brand-border/50 bg-brand-bg/40 p-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">
                                        {lang === 'en' ? 'Queued to seal' : 'Fila para selar'}
                                    </p>
                                    <p className="text-2xl font-black font-mono text-white tabular-nums">{sealer.pending_claims}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">
                                        {lang === 'en' ? 'Chain height' : 'Altura da cadeia'}
                                    </p>
                                    <p className="text-2xl font-black font-mono text-white tabular-nums">{sealer.tip.height}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">
                                        {lang === 'en' ? 'Last block' : 'Ultimo bloco'}
                                    </p>
                                    <p className="text-sm font-mono text-brand-secondary pt-1">
                                        {sealer.tip.sealed_at
                                            ? new Date(sealer.tip.sealed_at * 1000).toLocaleDateString()
                                            : '-'}
                                    </p>
                                </div>
                            </div>
                            {sealer.pending_claims === 0 && (
                                <p className="text-sm text-brand-muted leading-relaxed">
                                    {lang === 'en'
                                        ? 'Nothing is queued, so the elected node has nothing to seal. Only the browser Proof of Claim creates blocks - the partner faucet bridge credits off-chain by design and never queues one. Until somebody claims natively, this election decides nothing.'
                                        : 'Nao ha nada na fila, entao o no sorteado nao tem o que selar. So o Proof of Claim do navegador cria blocos - a ponte das torneiras parceiras credita fora da cadeia por projeto e nunca enfileira nada. Enquanto ninguem fizer claim nativo, esta eleicao nao decide nada.'}
                                </p>
                            )}
                        </div>
                    </div>
                </SectionCard>
            )}

            <SectionCard title={lang === 'en' ? 'Start AutoClaim' : 'Iniciar AutoClaim'} icon={<CpuChipIcon className="w-5 h-5 text-brand-primary" />}>
                <div className="space-y-4 mt-2">
                    {[
                        {
                            step: '1',
                            title: lang === 'en' ? 'Navigate to the mining-node folder' : 'Navegue até a pasta mining-node',
                            cmd: 'cd mining-node'
                        },
                        {
                            step: '2',
                            title: lang === 'en' ? 'Install dependencies' : 'Instale as dependências',
                            cmd: 'npm install'
                        },
                        {
                            step: '3',
                            title: lang === 'en' ? 'Configure your wallet' : 'Configure sua carteira',
                            cmd: 'cp .env.example .env   # Edit .env and set WALLET_ADDRESS'
                        },
                        {
                            step: '4',
                            title: lang === 'en' ? 'Start AutoClaim!' : 'Inicie o AutoClaim!',
                            cmd: 'npm start'
                        },
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 bg-brand-bg/40 rounded-xl border border-brand-border/30 group hover:border-brand-primary/30 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center flex-shrink-0 text-sm font-black text-brand-primary group-hover:bg-brand-primary/20 transition-colors">
                                {item.step}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-brand-secondary">{item.title}</p>
                                <code className="text-xs font-mono text-brand-primary mt-1 block bg-brand-bg/80 px-3 py-2 rounded-lg border border-brand-border/30 overflow-x-auto">
                                    {item.cmd}
                                </code>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Leaderboard */}
                <SectionCard title={lang === 'en' ? 'Leaderboard — Top Nodes' : 'Leaderboard — Melhores Nós'} icon={<ChartBarIcon className="w-5 h-5 text-yellow-400" />}>
                    {leaderboard.length === 0 ? (
                        <div className="text-center py-12 opacity-30">
                            <CubeIcon className="w-16 h-16 text-brand-muted mx-auto mb-3" />
                            <p className="text-sm text-brand-muted">{lang === 'en' ? 'No nodes yet — be the first!' : 'Nenhum nó ainda — seja o primeiro!'}</p>
                        </div>
                    ) : (
                        <div className="space-y-2 mt-2 max-h-[500px] overflow-y-auto scrollbar-hide">
                            {leaderboard.map((miner, i) => {
                                const maxEarned = leaderboard[0]?.total_earned || 1;
                                const barWidth = Math.max(5, (miner.total_earned / maxEarned) * 100);

                                return (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-brand-bg/30 rounded-xl border border-brand-border/20 hover:border-brand-primary/20 transition-colors group">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black ${
                                            i === 0 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                            i === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30' :
                                            i === 2 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                            'bg-brand-bg text-brand-muted border border-brand-border/30'
                                        }`}>
                                            {miner.rank}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${miner.is_online ? 'bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.5)]' : 'bg-red-400'}`} />
                                                    <span className="text-xs font-mono text-brand-secondary truncate">{miner.wallet_address.substring(0, 12)}...</span>
                                                    <span className="text-[10px] text-brand-muted hidden md:inline">{miner.node_name}</span>
                                                </div>
                                                <span className="text-sm font-black text-brand-primary font-mono flex-shrink-0 ml-2">{miner.total_earned.toFixed(2)}</span>
                                            </div>
                                            <div className="w-full bg-brand-bg/50 h-1.5 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent transition-all duration-500"
                                                    style={{ width: `${barWidth}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-[10px] text-brand-muted">{miner.uptime_hours}h uptime</span>
                                                <span className="text-[10px] text-brand-muted">{miner.epochs_active} epochs</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </SectionCard>

                {/* My Rewards */}
                <SectionCard title={lang === 'en' ? 'My Reward History' : 'Meu Histórico de Recompensas'} icon={<SparklesIcon className="w-5 h-5 text-brand-primary" />}>
                    {!isConnected ? (
                        <div className="text-center py-12 opacity-40">
                            <ShieldCheckIcon className="w-16 h-16 text-brand-muted mx-auto mb-3" />
                            <p className="text-sm text-brand-muted">{lang === 'en' ? 'Connect wallet to see rewards' : 'Conecte a carteira para ver recompensas'}</p>
                        </div>
                    ) : myRewards.length === 0 ? (
                        <div className="text-center py-12 opacity-30">
                            <BoltIcon className="w-16 h-16 text-brand-muted mx-auto mb-3" />
                            <p className="text-sm text-brand-muted">{lang === 'en' ? 'No rewards yet — start AutoClaim!' : 'Nenhuma recompensa ainda — inicie o AutoClaim!'}</p>
                        </div>
                    ) : (
                        <div className="space-y-2 mt-2 max-h-[500px] overflow-y-auto scrollbar-hide">
                            {myRewards.map((r, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-brand-bg/30 rounded-xl border border-brand-border/20">
                                    <div>
                                        <span className="text-xs font-bold text-brand-secondary">Epoch #{r.epoch_id}</span>
                                        <p className="text-[10px] text-brand-muted font-mono mt-0.5">
                                            {new Date(r.distributed_at * 1000).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-black text-brand-primary font-mono">+{r.reward_amount.toFixed(4)}</span>
                                        <p className="text-[10px] text-brand-muted">{r.uptime_share}% share</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>
            </div>

            {/* Network Specs */}
            <SectionCard title={lang === 'en' ? 'Network Parameters' : 'Parâmetros da Rede'} icon={<ShieldCheckIcon className="w-5 h-5 text-brand-primary" />}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                    {[
                        { param: lang === 'en' ? 'Epoch Duration' : 'Duração do Epoch', value: '1 hora' },
                        { param: 'Reward/Epoch', value: '2,000 CLAIM' },
                        { param: 'Heartbeat', value: '30s' },
                        { param: 'Timeout', value: '90s' },
                        { param: lang === 'en' ? 'Max Nodes/Wallet' : 'Max Nós/Wallet', value: '3' },
                        { param: 'Anti-Sybil', value: 'CPU + RAM metrics' },
                    ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-brand-bg/40 rounded-lg border border-brand-border/30">
                            <span className="text-[10px] text-brand-muted font-bold uppercase tracking-wider">{item.param}</span>
                            <span className="text-xs font-mono font-bold text-brand-primary">{item.value}</span>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
};
