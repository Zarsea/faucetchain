
import React from 'react';
import { CodeBlock } from './CodeBlock';
import { YAML_CODE, diagrams } from '../constants';
import { SectionCard } from './SectionCard';
import { CreditCardIcon, SignalIcon, ChartBarIcon, CubeIcon, BookOpenIcon, BoltIcon, ChartPieIcon } from './IconComponents';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Area, AreaChart } from 'recharts';
import { useLanguage } from './LanguageContext';
import { MermaidDiagram } from './MermaidDiagram';
import { API_BASE_URL } from '../apiConfig';

interface TokenomicsProps {
    onNavigate?: (tab: string) => void;
}

// Este gráfico mostrava um halving: 28,25 por bloco caindo pela metade a cada
// 525.600 blocos, com assíntota em 29,7M. Nada disso roda no servidor. Lá o
// pagamento por época é `MINING_CONFIG["epoch_reward"] = 1695.0`, constante, e
// o que limita a emissão é `TOKENS_PER_HOUR = 2000` contra o teto de 99M. As
// duas curvas coincidiam no primeiro ano e divergiam para sempre depois.
//
// O que está desenhado agora é o mecanismo que existe de verdade: dentro de
// cada hora, o desafio do claim encarece conforme a cota é gasta.
// `claim_difficulty_bits` soma +1 bit a cada 25% da cota, até +3 — e cada bit
// dobra o trabalho. Quem chega cedo paga o custo base; quem tenta varrer o
// resto da hora paga oito vezes mais.
const CLAIM_PROOF_DIFFICULTY_BITS = 16;  // api_server.py
const CLAIM_PROOF_MAX_EXTRA_BITS = 3;

const generateDifficultyData = () => {
    const data = [];
    for (let pct = 0; pct <= 100; pct += 2) {
        const extra = Math.min(CLAIM_PROOF_MAX_EXTRA_BITS, Math.floor((pct / 100) * 4));
        data.push({
            quota: pct,
            work: Math.pow(2, extra),          // trabalho relativo ao primeiro claim da hora
            bits: CLAIM_PROOF_DIFFICULTY_BITS + extra,
        });
    }
    return data;
};

const DIFFICULTY_DATA = generateDifficultyData();

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-brand-surface border border-brand-border p-3 rounded-lg shadow-xl backdrop-blur-md">
                <p className="text-xs text-brand-muted mb-1 uppercase tracking-tighter">Hourly quota</p>
                <p className="text-sm font-bold text-brand-secondary mb-2">{payload[0].payload.quota}% spent</p>
                <div className="h-px bg-brand-border mb-2" />
                <p className="text-sm font-bold text-orange-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
                    {payload[0].value}x <span className="text-[10px] text-brand-muted">
                        work · {payload[0].payload.bits} bits
                    </span>
                </p>
            </div>
        );
    }
    return null;
};

const VaultDataWidget = ({ vault }: { vault: any }) => {
    if (!vault) return (
        <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-green-900/30 text-green-400 text-[10px] font-bold uppercase rounded border border-green-800">USDC Farming</span>
            <span className="px-2 py-1 bg-blue-900/30 text-blue-400 text-[10px] font-bold uppercase rounded border border-blue-800">Cross-Protocol Yield</span>
        </div>
    );

    return (
        <div className="mt-4 p-4 border border-brand-primary/30 rounded-xl bg-brand-bg/50 hover:border-brand-primary/50 transition-colors">
            <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] text-brand-muted font-black uppercase tracking-widest">Treasury Balance</span>
                <span className="text-xl font-black text-brand-primary font-mono">{(vault.totalExternalValue || 0).toLocaleString()} <span className="text-sm text-brand-muted">$CLAIM</span></span>
            </div>
            <div className="space-y-2">
                {vault.assets?.map((a: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-brand-surface p-2 rounded border border-brand-border/30">
                        <span className="text-xs text-brand-secondary font-bold uppercase flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${a.symbol === 'TREASURY_CLAIM' ? 'bg-brand-primary' : 'bg-orange-400'}`}></div>
                            {a.symbol.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-brand-muted font-mono">{a.amount.toLocaleString()}</span>
                    </div>
                ))}
            </div>
            <div className="mt-4 pt-4 border-t border-brand-border flex justify-between items-center">
                <div>
                    <span className="text-[10px] text-brand-accent font-bold uppercase block">Total Fees Distributed</span>
                    <span className="text-sm text-brand-accent font-mono block">+{vault.yieldGenerated || 0} $CLAIM</span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-brand-primary font-bold uppercase block flex items-center gap-1 justify-end">
                        <span className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-ping"></span>
                        Dynamic Fee Scale
                    </span>
                    <span className="text-sm font-black text-white font-mono block">Active (Base 0.1)</span>
                </div>
            </div>
        </div>
    );
};

const ConsensusDistributionWidget = () => {
    const [dist, setDist] = React.useState<any>(null);
    React.useEffect(() => {
        fetch(`${API_BASE_URL}/api/tokenomics/distribution`)
            .then(res => res.json())
            .then(data => setDist(data))
            .catch(() => {});
    }, []);

    if (!dist) return null;

    return (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.values(dist).map((item: any, idx: number) => {
                const percent = (item.extracted / item.limit) * 100;
                return (
                    <div key={idx} className="p-4 bg-brand-bg/50 border border-brand-border/40 rounded-xl relative overflow-hidden group hover:border-brand-primary/40 transition-colors">
                        <div className="flex justify-between items-end mb-2 relative z-10">
                            <div>
                                <span className="text-xs text-brand-secondary font-bold uppercase tracking-wider block mb-1">{item.label}</span>
                                <span className="text-xl font-black text-white font-mono">{item.extracted.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] text-brand-muted uppercase block">Allocation Limit</span>
                                <span className="text-sm text-brand-muted font-mono">{(item.limit / 1000000).toFixed(1)}M</span>
                            </div>
                        </div>
                        <div className="w-full bg-brand-surface rounded-full h-4 mt-4 relative z-10 overflow-hidden border border-brand-border/30">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ${percent > 80 ? 'bg-orange-500' : 'bg-brand-primary'}`} 
                                style={{ width: `${Math.min(percent, 100)}%` }}
                            ></div>
                        </div>
                        <div className="mt-2 text-right">
                            <span className="text-[10px] text-brand-accent font-bold">{percent.toFixed(4)}% Extracted</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export const Tokenomics: React.FC<TokenomicsProps> = ({ onNavigate }) => {
    const { tFn: t, lang } = useLanguage();
    const [vault, setVault] = React.useState<any>(null);

    React.useEffect(() => {
        fetch(`${API_BASE_URL}/api/vault/yield`)
            .then(res => res.json())
            .then(data => setVault(data))
            .catch(() => {});
    }, []);

    const apy = vault?.stakingApy ? vault.stakingApy + '%' : '14.5%';
    const burned = vault?.totalBurned ? (vault.totalBurned / 1000000).toFixed(2) + 'M' : '1.24M';
    const circ = vault?.circulatingSupply ? (vault.circulatingSupply / 1000000).toFixed(2) + 'M' : '15.4M';

    return (
        <div className="space-y-8">
             <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 animate-fadeIn">
                <div>
                    <h2 className="text-3xl font-bold text-brand-secondary mb-4">{t('tokenomics.title')}</h2>
                    <p className="text-brand-muted mb-6 max-w-3xl text-lg">
                        {t('tokenomics.desc')}
                    </p>
                </div>
                <button 
                    onClick={() => onNavigate?.('Whitepaper')}
                    className="flex items-center gap-2 text-xs font-bold text-brand-primary border border-brand-primary/30 rounded-lg px-4 py-2 hover:bg-brand-primary/10 transition-all duration-300 hover:scale-[1.05] whitespace-nowrap group"
                >
                    <BookOpenIcon className="w-4 h-4" />
                    {lang === 'en' ? "READ WHITEPAPER" : "LER WHITEPAPER"}
                </button>
             </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <SectionCard title={t('tokenomics.fixedSupplyTitle')} icon={<CubeIcon className="w-5 h-5 text-brand-primary"/>}>
                    <p className="text-brand-muted leading-relaxed">
                        {t('tokenomics.fixedSupplyDesc')}
                    </p>
                    <div className="mt-4 p-4 bg-brand-bg rounded border border-brand-border text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-brand-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
                        <span className="text-xs text-brand-muted uppercase block mb-1 tracking-widest font-bold relative z-10">Total Supply Cap</span>
                        <span className="text-4xl font-black text-brand-primary relative z-10">99,000,000</span>
                        <span className="text-brand-muted ml-2 font-mono relative z-10">$CLAIM</span>
                    </div>
                </SectionCard>

                <SectionCard title={t('tokenomics.decayTitle')} icon={<ChartBarIcon className="w-5 h-5 text-orange-400"/>}>
                    <p className="text-brand-muted leading-relaxed mb-4">
                        {t('tokenomics.decayDesc')}
                    </p>
                    <div style={{ width: '100%', height: 220 }} className="bg-brand-bg/40 rounded-xl p-4 border border-brand-border/50 relative overflow-hidden">
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                            <span className="text-[10px] text-brand-muted font-bold uppercase tracking-wider">
                                {lang === 'en' ? "Work per claim" : "Trabalho por claim"}
                            </span>
                        </div>
                        <ResponsiveContainer>
                            <AreaChart data={DIFFICULTY_DATA} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorReward" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#F78166" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#F78166" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} opacity={0.5} />
                                <XAxis
                                    dataKey="quota"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#8B949E', fontSize: 10 }}
                                    tickFormatter={(val) => `${val}%`}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#8B949E', fontSize: 10 }}
                                    domain={[0, 9]}
                                    ticks={[1, 2, 4, 8]}
                                    tickFormatter={(val) => `${val}x`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                
                                <ReferenceLine x={25} stroke="#8B949E" strokeDasharray="3 3" label={{ position: 'top', value: '+1 bit', fill: '#8B949E', fontSize: 9 }} />
                                <ReferenceLine x={50} stroke="#8B949E" strokeDasharray="3 3" label={{ position: 'top', value: '+2', fill: '#8B949E', fontSize: 9 }} />
                                <ReferenceLine x={75} stroke="#8B949E" strokeDasharray="3 3" label={{ position: 'top', value: '+3', fill: '#8B949E', fontSize: 9 }} />

                                <Area
                                    type="stepAfter"
                                    dataKey="work"
                                    stroke="#F78166"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorReward)"
                                    animationDuration={2500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-between mt-2 px-1">
                        <span className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">
                            {lang === 'en' ? "Start of the hour" : "Início da hora"}
                        </span>
                        <span className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">
                            {lang === 'en' ? "Quota spent" : "Cota esgotada"}
                        </span>
                    </div>
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <SectionCard title={lang === 'en' ? "Staking APY" : "APY de Staking"} icon={<BoltIcon className="w-5 h-5 text-green-400"/>}>
                    <p className="text-brand-muted leading-relaxed mb-4 text-sm">
                        {lang === 'en' ? "Dynamic yield based on network participation and PoS epoch rewards." : "Rendimento dinâmico baseado na participação da rede e recompensas de época PoS."}
                    </p>
                    <div className="p-4 bg-brand-bg rounded border border-brand-border text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-green-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
                        <span className="text-4xl font-black text-green-400 relative z-10">{apy}</span>
                        <span className="text-brand-muted block mt-1 text-xs uppercase tracking-widest font-bold relative z-10">Current Rate</span>
                    </div>
                </SectionCard>

                <SectionCard title={lang === 'en' ? "Total Burned" : "Total Queimado"} icon={<ChartPieIcon className="w-5 h-5 text-orange-400"/>}>
                    <p className="text-brand-muted leading-relaxed mb-4 text-sm">
                        {lang === 'en' ? "Tokens permanently removed from circulation via transaction fees." : "Tokens removidos permanentemente de circulação via taxas de transação."}
                    </p>
                    <div className="p-4 bg-brand-bg rounded border border-brand-border text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-orange-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
                        <span className="text-4xl font-black text-orange-400 relative z-10">{burned}</span>
                        <span className="text-brand-muted block mt-1 text-xs uppercase tracking-widest font-bold relative z-10">Deflationary Mechanism</span>
                    </div>
                </SectionCard>

                <SectionCard title={lang === 'en' ? "Circulating Supply" : "Fornecimento Circulante"} icon={<SignalIcon className="w-5 h-5 text-brand-primary"/>}>
                    <p className="text-brand-muted leading-relaxed mb-4 text-sm">
                        {lang === 'en' ? "Liquid tokens currently available across network wallets and DEXs." : "Tokens líquidos atualmente disponíveis nas carteiras da rede e DEXs."}
                    </p>
                    <div className="p-4 bg-brand-bg rounded border border-brand-border text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-brand-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
                        <span className="text-4xl font-black text-brand-primary relative z-10">{circ}</span>
                        <span className="text-brand-muted block mt-1 text-xs uppercase tracking-widest font-bold relative z-10">Of 99M Max Supply</span>
                    </div>
                </SectionCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="lg:col-span-2">
                    <MermaidDiagram 
                        code={diagrams(lang).TOKENOMICS_FLOW_CODE} 
                        title={t('tokenomics.flowTitle')} 
                        icon={<SignalIcon className="w-5 h-5"/>}
                        prompt="Explain how the $CLAIM token flows from user claims into the Ecosystem Fund and Team wallet. Why is the 60/40 split used?"
                    />
                </div>
            </div>

            <h3 className="text-2xl font-bold text-brand-secondary mt-12 mb-6 border-b border-brand-border/30 pb-3">
                {lang === 'en' ? "Real-Time Supply Extraction" : "Extração de Suprimento em Tempo Real"}
            </h3>
            <ConsensusDistributionWidget />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mt-12">
                <div className="lg:col-span-2 space-y-6">
                    <MermaidDiagram 
                        code={diagrams(lang).TREASURY_ALLOCATION_DIAGRAM} 
                        title={t('tokenomics.distTitle')} 
                        icon={<CreditCardIcon className="w-5 h-5"/>}
                        prompt="Why is a majority (60%) of the block rewards allocated to an Ecosystem Fund instead of distributed entirely to miners/validators?"
                    />

                    <div className="mt-8">
                        <SectionCard title={t('tokenomics.ecoFundTitle')} icon={<SignalIcon className="w-5 h-5"/>}>
                            <p className="text-brand-muted text-sm leading-relaxed">
                                {t('tokenomics.ecoFundDesc')}
                            </p>
                            <VaultDataWidget vault={vault} />
                        </SectionCard>
                    </div>
                </div>
                <div className="lg:col-span-3">
                    <CodeBlock code={YAML_CODE} language="yaml" title="tokenomics_config.yaml" />
                </div>
            </div>

        </div>
    );
};
