
import React from 'react';
import { SectionCard } from './SectionCard';
import { MermaidDiagram } from './MermaidDiagram';
import { CubeIcon, ShieldCheckIcon, SignalIcon, CreditCardIcon, SparklesIcon, ChartBarIcon, CpuChipIcon, BoltIcon } from './IconComponents';
import { useLanguage } from './LanguageContext';
import { DIAGRAMS } from '../constants';
import { useNetwork } from './NetworkContext';

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; accent?: string }> = ({ label, value, icon, accent = "text-brand-primary" }) => (
    <div className="glass border border-brand-border/30 rounded-2xl p-5 group relative overflow-hidden transition-all duration-500 hover:border-brand-primary/50 hover:shadow-glow-primary z-10">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-brand-primary/5 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform duration-700 pointer-events-none -z-10"></div>
        <div className="flex items-center gap-4 mb-4 relative z-20">
            <div className={`p-3 bg-brand-surface/80 rounded-2xl border border-brand-border/50 ${accent} group-hover:shadow-lg transition-all`}>
                {icon}
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] font-black text-brand-muted uppercase tracking-[0.2em]">{label}</span>
                <span className="text-xl font-extrabold text-brand-secondary font-mono tracking-tighter mt-1 group-hover:text-white transition-colors">
                    {value}
                </span>
            </div>
        </div>
    </div>
);

export const Overview: React.FC = () => {
    const { t, lang } = useLanguage();
    const { metrics } = useNetwork();

    const formatNum = (n: number) => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US').format(n);

    return (
        <div className="space-y-10 animate-slideUp relative z-0">
            {/* Header de Evolução V3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                <StatCard 
                    label="PoC-V3 BLOCK" 
                    value={`#${formatNum(metrics.blockHeight)}`} 
                    icon={<CubeIcon className="w-6 h-6" />} 
                />
                <StatCard 
                    label="NETWORK ERA" 
                    value="HYBRID EVOLUTION" 
                    icon={<BoltIcon className="w-6 h-6" />} 
                    accent="text-brand-accent"
                />
                <StatCard 
                    label="AI REPUTATION" 
                    value="SENTINEL ACTIVE" 
                    icon={<SparklesIcon className="w-6 h-6" />} 
                    accent="text-brand-success"
                />
                <StatCard 
                    label="ADAPTIVE SECURITY" 
                    value="PoC-GRADE-AA" 
                    icon={<ShieldCheckIcon className="w-6 h-6" />}
                    accent="text-brand-primary"
                />
            </div>

            {/* AI Command Center Insight */}
            <div className="relative group z-10">
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary to-brand-accent rounded-[2rem] blur opacity-15 group-hover:opacity-25 transition duration-1000 group-hover:duration-200 pointer-events-none"></div>
                <div className="relative glass border border-brand-primary/20 rounded-[1.8rem] p-10 overflow-hidden">
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl animate-pulseGlow pointer-events-none -z-10"></div>
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-brand-accent/10 rounded-full blur-3xl animate-pulseGlow pointer-events-none -z-10" style={{ animationDelay: '1.5s' }}></div>
                    
                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-10 relative z-10">
                        <div className="flex-shrink-0 p-8 bg-brand-surface border border-brand-primary/30 rounded-[2.5rem] shadow-2xl relative">
                            <CpuChipIcon className="w-16 h-16 text-brand-primary drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-brand-success rounded-full border-4 border-brand-surface flex items-center justify-center">
                                <span className="text-brand-bg font-black text-[10px]">V3</span>
                            </div>
                        </div>
                        
                        <div className="flex-1 space-y-4">
                            <div className="flex flex-wrap items-center gap-4">
                                <h3 className="text-3xl font-black text-brand-secondary tracking-tight">
                                    {lang === 'en' ? 'Adaptive PoC-V3 Consensus' : 'Consenso Adaptativo PoC-V3'}
                                </h3>
                                <span className="px-4 py-1.5 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 text-[10px] rounded-full uppercase font-black tracking-widest">Protocol Evolution</span>
                            </div>
                            <p className="text-brand-muted text-xl leading-relaxed max-w-4xl font-medium">
                                {lang === 'en' 
                                    ? "Welcome to the next stage of FaucetChain. Version V3 introduces the Proof of Claim (PoC), which rebalances voting power between Merit and Stake in real-time." 
                                    : "Bem-vindo ao próximo estágio da FaucetChain. A versão V3 introduz o Proof of Claim (PoC), que reequilibra o poder de voto entre Mérito e Stake em tempo real."
                                }
                            </p>
                            <div className="pt-2">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Technical Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
                <div className="lg:col-span-5 flex flex-col gap-8">
                    <SectionCard title="Sealer Weight" icon={<ChartBarIcon className="w-6 h-6" />}>
                         <p className="text-lg font-medium text-brand-secondary/80">
                             {lang === 'en'
                                ? "A proposal. Today the sealer election weighs staked capital alone."
                                : "Uma proposta. Hoje o sorteio do selador pesa só o capital em stake."}
                        </p>
                        <div className="grid grid-cols-1 gap-4 mt-6">
                            {[
                                { label: 'MERIT (α)', sub: 'PoC Weight', val: '0%', color: 'from-brand-primary to-blue-400', desc: 'Proposed. The sealer election carries no merit term today.' },
                                { label: 'CAPITAL (β)', sub: 'PoS Stake', val: '100%', color: 'from-brand-success to-emerald-400', desc: 'What runs: weight = 1 + active stake, with no cap.' },
                                { label: 'COGNITION (γ)', sub: 'Reputation', val: '0%', color: 'from-brand-accent to-purple-400', desc: 'Proposed. Nothing measures reputation here yet.' }
                            ].map((item) => (
                                <div key={item.label} className="p-5 bg-brand-surface/40 border border-brand-border/40 rounded-[1.25rem] group transition-all hover:bg-brand-surface">
                                    <div className="flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-brand-muted tracking-[0.2em]">{item.label}</span>
                                            <span className="text-sm font-bold text-brand-secondary mt-1">{item.sub}</span>
                                        </div>
                                        <div className={`text-2xl font-black bg-gradient-to-br ${item.color} bg-clip-text text-transparent font-mono`}>
                                            {item.val}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-brand-muted mt-2 group-hover:text-brand-secondary transition-colors italic">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>

                <div className="lg:col-span-7 h-full">
                    <MermaidDiagram 
                        code={DIAGRAMS[lang].MERMAID_CODE} 
                        title="V3 Consensus Evolution Flow" 
                        prompt="Explique como o Sentinel AI Audit atua como o 'segundo fator de autenticação' para o consenso PoC+PoS nesta evolução V3."
                    />
                </div>
            </div>
        </div>
    );
};
