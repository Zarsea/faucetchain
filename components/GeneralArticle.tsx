
import React, { useState } from 'react';
import { SectionCard } from './SectionCard';
import { MermaidDiagram } from './MermaidDiagram';
import { 
    CubeIcon, 
    ShieldCheckIcon, 
    SignalIcon, 
    GlobeAltIcon, 
    CpuChipIcon, 
    ArrowPathIcon, 
    SparklesIcon, 
    ChartBarIcon, 
    XMarkIcon,
    BoltIcon
} from './IconComponents';
import { useLanguage } from './LanguageContext';
import { GeminiExplainer } from './GeminiExplainer';
import { ClaimEventSection } from './ClaimEventSection';
import { DIAGRAMS, POC_WEIGHT_LOGIC_CODE, AI_REPUTATION_LOGIC_CODE } from '../constants';
import { useNetwork } from './NetworkContext';
import { CodeBlock } from './CodeBlock';

export const GeneralArticle: React.FC = () => {
    const { lang } = useLanguage();
    const { addBlockManually } = useNetwork();
    const [showPoCModal, setShowPoCModal] = useState(false);
    const [formData, setFormData] = useState({
        txHash: '',
        timestamp: new Date().toISOString().slice(0, 16),
        activity: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const t = lang === 'en' ? {
        title: "L1 Architectural Protocol",
        subtitle: "Deep-dive into the FaucetChain PoC-V3 Consensus Engine",
        hubTitle: "Decentralized Reputation Hubs",
        hubDesc: "External entities acting as Merit Aggregators, bridging off-chain utility into on-chain influence through verifiable proofs.",
        lifecycleTitle: "Detailed Execution Lifecycle",
        lifecycleDesc: "A granular end-to-end view of the Claim Event pipeline, illustrating the path from user submission to treasury vault settlement and yield automation.",
        weightTitle: "PoC Weight Formula",
        weightDesc: "Algorithmic merit scoring that values consistent, long-term network stability over pure capital dominance.",
        paramActivity: "Decay Dynamics",
        paramActivityDesc: "Historical claims lose value exponentially (e^-λt), ensuring network renewal.",
        paramFreq: "Loyalty Multipliers",
        paramFreqDesc: "Bonus influence for nodes with high-density consecutive block participation.",
        paramUptime: "Liveness Factor",
        paramUptimeDesc: "A core multiplier directly proportional to the validator's heartbeat consistency.",
        aiRepTitle: "Sentinel AI Scoring",
        aiRepDesc: "The proprietary AI weight modulator that audits identities across multiple vectors to ensure true decentralization.",
        aiParamOnChain: "Deep Chain Scan",
        aiParamOnChainDesc: "Analysis of transactional depth, contract diversity, and wallet maturity.",
        aiParamIdentity: "Sovereign ID",
        aiParamIdentityDesc: "Multi-factor verification confirming operator humanhood via external DID bridges.",
        aiParamSocial: "Graph Resistance",
        aiParamSocialDesc: "Sybil detection via connectivity clustering and entropy analysis of node relations.",
        pocSubmitBtn: "Submit Proof of Claim",
        modalTitle: "PoC Verification Request",
        modalLabelTx: "Transaction Hash",
        modalLabelTime: "Activity Timestamp",
        modalLabelDetails: "Activity Details",
        modalPlaceholderDetails: "Describe the verifiable contribution (e.g., node uptime, governance voting, app interaction)...",
        modalSubmit: "Broadcast to Network",
        modalSuccess: "Proof registered in Mempool. Awaiting PoC-V3 validation."
    } : {
        title: "Protocolo de Arquitetura L1",
        subtitle: "Imersão no Mecanismo de Consenso PoC-V3 FaucetChain",
        hubTitle: "Hubs de Reputação Descentralizados",
        hubDesc: "Entidades externas atuando como Agregadores de Mérito, conectando utilidade off-chain em influência on-chain via provas verificáveis.",
        lifecycleTitle: "Ciclo de Execução Detalhado",
        lifecycleDesc: "Uma visão granular ponta-a-ponta do pipeline do Evento de Reivindicação, ilustrando o caminho desde a submissão do usuário até a liquidação no tesouro e automação de rendimento.",
        weightTitle: "Fórmula de Peso PoC",
        weightDesc: "Pontuação de mérito algorítmica que valoriza a estabilidade de rede consistente e de longo prazo sobre o domínio puro de capital.",
        paramActivity: "Dinâmica de Decaimento",
        paramActivityDesc: "Reivindicações históricas perdem valor exponencialmente (e^-λt), garantindo a renovação da rede.",
        paramFreq: "Multiplicadores de Fidelidade",
        paramFreqDesc: "Influência bônus para nós com alta densidade de participação em blocos consecutivos.",
        paramUptime: "Fator de Liveness",
        paramUptimeDesc: "Um multiplicador central diretamente proporcional à consistência do heartbeat do validador.",
        aiRepTitle: "Score IA Sentinela",
        aiRepDesc: "O modulador de peso IA proprietário que audita identidades em múltiplos vetores para garantir a verdadeira descentralização.",
        aiParamOnChain: "Escaneamento Profundo",
        aiParamOnChainDesc: "Análise da profundidade transacional, diversidade de contratos e maturidade da carteira.",
        aiParamIdentity: "ID Soberana",
        aiParamIdentityDesc: "Verificação multi-fatorial confirmando a humanidade do operador via bridges de DID externas.",
        aiParamSocial: "Resistência de Grafo",
        aiParamSocialDesc: "Detecção Sybil via agrupamento de conectividade e análise de entropia das relações dos nós.",
        pocSubmitBtn: "Submeter Prova de Mérito",
        modalTitle: "Solicitação de Verificação PoC",
        modalLabelTx: "Hash da Transação",
        modalLabelTime: "Timestamp da Atividade",
        modalLabelDetails: "Detalhes da Atividade",
        modalPlaceholderDetails: "Descreva a contribuição verificável (ex: uptime do nó, votação em governança, interação com dApp)...",
        modalSubmit: "Transmitir para a Rede",
        modalSuccess: "Prova registrada no Mempool. Aguardando validação PoC-V3."
    };

    const handlePoCSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        // Simulate network broadcast
        setTimeout(() => {
            addBlockManually("POC_V3_POC_VALIDATOR", 1);
            setIsSubmitting(false);
            setShowPoCModal(false);
            setFormData({
                txHash: '',
                timestamp: new Date().toISOString().slice(0, 16),
                activity: ''
            });
            alert(t.modalSuccess);
        }, 2000);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-20 pb-20 animate-fadeIn text-brand-secondary">
            <div className="text-center space-y-4 pt-10">
                <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter">
                    {t.title}
                </h1>
                <p className="text-brand-primary font-bold text-lg uppercase tracking-[0.3em] opacity-80">
                    {t.subtitle}
                </p>
                <div className="w-24 h-1 bg-gradient-to-r from-brand-primary to-brand-accent mx-auto rounded-full mt-6"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="p-8 glass border border-brand-primary/20 rounded-[2.5rem] relative overflow-hidden group hover:border-brand-primary/50 transition-all duration-700 flex flex-col">
                    <div className="absolute -top-10 -right-10 p-10 bg-brand-primary/5 rounded-full group-hover:scale-125 transition-transform">
                        <CubeIcon className="w-16 h-16 text-brand-primary" />
                    </div>
                    <div className="relative z-10 space-y-4 flex-1">
                        <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em]">Module 01</span>
                        <h3 className="text-2xl font-black text-white">Proof of Claim (PoC)</h3>
                        <p className="text-brand-muted leading-relaxed text-lg">
                            {lang === 'en' 
                                ? "Decentralized validation allowing any entity proving legitimate activity to gain network weight, eliminating the hardware-gate for entry."
                                : "Validação descentralizada permitindo que qualquer entidade que prove atividade legítima ganhe peso na rede, eliminando a barreira de hardware."}
                        </p>
                        <p className="text-brand-primary font-bold italic border-l-2 border-brand-primary pl-4 py-1">
                            "Meritocracy encoded in the ledger."
                        </p>
                    </div>
                    <div className="relative z-10 mt-8">
                        <button 
                            onClick={() => setShowPoCModal(true)}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-brand-primary text-brand-bg font-black rounded-2xl hover:bg-white hover:shadow-glow-primary transition-all active:scale-95 uppercase tracking-wider text-sm"
                        >
                            <BoltIcon className="w-5 h-5" />
                            {t.pocSubmitBtn}
                        </button>
                    </div>
                </div>

                <div className="p-8 glass border border-brand-accent/20 rounded-[2.5rem] relative overflow-hidden group hover:border-brand-accent/50 transition-all duration-700">
                    <div className="absolute -top-10 -right-10 p-10 bg-brand-accent/5 rounded-full group-hover:scale-125 transition-transform">
                        <GlobeAltIcon className="w-16 h-16 text-brand-accent" />
                    </div>
                    <div className="relative z-10 space-y-4">
                        <span className="text-[10px] font-black text-brand-accent uppercase tracking-[0.3em]">Module 02</span>
                        <h3 className="text-2xl font-black text-white">{t.hubTitle}</h3>
                        <p className="text-brand-muted leading-relaxed text-lg">
                            {t.hubDesc}
                        </p>
                        <div className="pt-2 flex items-center gap-2 text-xs font-bold text-brand-accent">
                            <SignalIcon className="w-4 h-4 animate-pulse" />
                            Live Bridge Synchronization Active
                        </div>
                    </div>
                </div>
            </div>

            {/* HIGH-VISIBILITY: FaucetChain V3 Full Ecosystem Mindmap */}
            <div className="glass border border-brand-primary/30 rounded-[3rem] p-1 lg:p-10 shadow-glow-primary relative overflow-hidden">
                <div className="absolute inset-0 bg-brand-primary/5 pointer-events-none opacity-30"></div>
                <div className="relative z-10 space-y-6">
                    <div className="flex flex-col items-center justify-center text-center space-y-4 mb-8">
                        <div className="p-4 bg-brand-primary/10 rounded-2xl w-fit">
                            <CubeIcon className="w-10 h-10 text-brand-primary" />
                        </div>
                        <h2 className="text-4xl font-black text-white tracking-tighter leading-none">
                            {lang === 'en' ? "V3 Architecture Mindmap" : "Mapa Mental da Arquitetura V3"}
                        </h2>
                        <p className="text-brand-muted text-lg max-w-2xl">
                            {lang === 'en' 
                                ? "A holistic top-down view of the FaucetChain ecosystem, mapping the latest V3 upgrades: Dual Consensus, P2P Transfers, SQLite B-Tree Indexes, and Sentinel AI V3."
                                : "Uma visão holística do ecossistema FaucetChain, mapeando os últimos upgrades V3: Consenso Duplo, Transferências P2P, Índices B-Tree no SQLite e IA Sentinela V3."}
                        </p>
                    </div>
                    <div className="w-full h-full min-h-[600px] bg-brand-bg/50 rounded-[2rem] border border-brand-border/40 p-4">
                        <MermaidDiagram 
                            code={DIAGRAMS[lang].MINDMAP_CODE} 
                            title={lang === 'en' ? "Full Ecosystem Topology" : "Topologia Completa do Ecossistema"} 
                        />
                    </div>
                </div>
            </div>

            {/* HIGH-VISIBILITY: Claim Event Lifecycle Diagram */}
            <div className="glass border border-brand-primary/30 rounded-[3rem] p-1 lg:p-10 shadow-glow-primary relative overflow-hidden">
                <div className="absolute inset-0 bg-brand-primary/5 pointer-events-none opacity-30"></div>
                <div className="relative z-10 flex flex-col lg:flex-row gap-12">
                    <div className="lg:w-1/3 space-y-6">
                        <div className="p-4 bg-brand-primary/10 rounded-2xl w-fit">
                            <ArrowPathIcon className="w-10 h-10 text-brand-primary" />
                        </div>
                        <h2 className="text-4xl font-black text-white tracking-tighter leading-none">{t.lifecycleTitle}</h2>
                        <p className="text-brand-muted text-lg leading-relaxed">
                            {t.lifecycleDesc}
                        </p>
                        <div className="space-y-4 pt-4">
                            <div className="flex gap-4 items-start">
                                <div className="mt-1.5 w-2 h-2 rounded-full bg-brand-primary shadow-glow-primary flex-shrink-0"></div>
                                <p className="text-sm text-brand-secondary font-medium">Automatic 60/40 reward splitting for immediate ecosystem liquidity.</p>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="mt-1.5 w-2 h-2 rounded-full bg-brand-accent shadow-glow-accent flex-shrink-0"></div>
                                <p className="text-sm text-brand-secondary font-medium">Native DEX Aggregation for real-time stablecoin hedging.</p>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="mt-1.5 w-2 h-2 rounded-full bg-brand-success shadow-glow-primary flex-shrink-0"></div>
                                <p className="text-sm text-brand-secondary font-medium">Multi-vault settlement securing protocol longevity and non-volatile growth.</p>
                            </div>
                        </div>
                        <div className="pt-6">
                            <GeminiExplainer 
                                context="Claim Lifecycle PoC-V3: User Submission -> AI Audit -> Reward Minting -> 60/40 Split -> Stablecoin Swap -> Treasury Settlement." 
                                prompt="Explain the game theory behind forcing a 60% swap to stablecoins upon reward minting. How does this prevent a death spiral compared to tokens that don't hedge their rewards?" 
                            />
                        </div>
                    </div>
                    <div className="lg:w-2/3 h-full min-h-[500px]">
                        <MermaidDiagram 
                            code={DIAGRAMS[lang].CLAIM_LIFECYCLE_DETAILED_CODE} 
                            title={lang === 'en' ? "Full Execution Pipeline" : "Pipeline de Execução Completo"} 
                            prompt="Deconstruct the sequence from Minting to Yield. Why is Treasury Settlement the penultimate step before Yield generation?"
                        />
                    </div>
                </div>
            </div>

            {/* Modal de Submissão PoC */}
            {showPoCModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
                    <div className="absolute inset-0 bg-brand-bg/90 backdrop-blur-md" onClick={() => !isSubmitting && setShowPoCModal(false)}></div>
                    <div className="relative glass border border-brand-primary/30 rounded-[2.5rem] p-10 max-w-2xl w-full shadow-glow-primary animate-slideUp overflow-hidden">
                        <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl animate-pulse"></div>
                        <button 
                            disabled={isSubmitting}
                            onClick={() => setShowPoCModal(false)} 
                            className="absolute top-8 right-8 text-brand-muted hover:text-white transition-colors"
                        >
                            <XMarkIcon className="w-8 h-8" />
                        </button>

                        <div className="relative z-10 space-y-8">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-brand-primary/10 rounded-2xl border border-brand-primary/20">
                                    <SparklesIcon className="w-8 h-8 text-brand-primary" />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{t.modalTitle}</h3>
                                    <p className="text-brand-muted text-sm font-bold uppercase tracking-widest">{lang === 'en' ? 'Direct L1 Transmission' : 'Transmissão Direta L1'}</p>
                                </div>
                            </div>

                            <form onSubmit={handlePoCSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] ml-2">{t.modalLabelTx}</label>
                                    <input 
                                        required
                                        type="text"
                                        placeholder="0x..."
                                        className="w-full bg-brand-bg/80 border border-brand-border/60 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-brand-primary transition-colors font-mono text-sm"
                                        value={formData.txHash}
                                        onChange={(e) => setFormData({...formData, txHash: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] ml-2">{t.modalLabelTime}</label>
                                    <input 
                                        required
                                        type="datetime-local"
                                        className="w-full bg-brand-bg/80 border border-brand-border/60 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-brand-primary transition-colors font-mono text-sm"
                                        value={formData.timestamp}
                                        onChange={(e) => setFormData({...formData, timestamp: e.target.value})}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] ml-2">{t.modalLabelDetails}</label>
                                    <textarea 
                                        required
                                        rows={4}
                                        placeholder={t.modalPlaceholderDetails}
                                        className="w-full bg-brand-bg/80 border border-brand-border/60 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-brand-primary transition-colors text-sm leading-relaxed"
                                        value={formData.activity}
                                        onChange={(e) => setFormData({...formData, activity: e.target.value})}
                                    />
                                </div>

                                <button 
                                    disabled={isSubmitting}
                                    type="submit"
                                    className="w-full flex items-center justify-center gap-4 py-5 bg-brand-primary text-brand-bg font-black rounded-[1.5rem] hover:bg-white hover:shadow-glow-primary transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-sm"
                                >
                                    {isSubmitting ? <ArrowPathIcon className="w-6 h-6 animate-spin" /> : <SignalIcon className="w-6 h-6" />}
                                    {t.modalSubmit}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* PoC Weight Detail - Interactive Grid */}
            <div className="glass border border-brand-border/40 rounded-[3rem] p-10 shadow-2xl">
                <div className="flex flex-col lg:flex-row gap-12">
                    <div className="lg:w-1/2 space-y-8">
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-4">
                                <ChartBarIcon className="w-8 h-8 text-brand-primary" />
                                {t.weightTitle}
                            </h2>
                            <p className="text-brand-muted text-lg leading-relaxed">
                                {t.weightDesc}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {[
                                { title: t.paramActivity, desc: t.paramActivityDesc, icon: <ArrowPathIcon className="w-5 h-5 text-brand-primary"/> },
                                { title: t.paramFreq, desc: t.paramFreqDesc, icon: <SignalIcon className="w-5 h-5 text-brand-accent"/> },
                                { title: t.paramUptime, desc: t.paramUptimeDesc, icon: <ShieldCheckIcon className="w-5 h-5 text-brand-success"/> }
                            ].map((p) => (
                                <div key={p.title} className="p-6 bg-brand-surface/60 border border-brand-border/40 rounded-2xl flex gap-5 group hover:border-brand-primary/30 transition-all duration-500">
                                    <div className="flex-shrink-0 p-3 bg-brand-bg/80 rounded-xl border border-brand-border/50 group-hover:shadow-glow-primary transition-all">
                                        {p.icon}
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-extrabold text-brand-secondary">{p.title}</h4>
                                        <p className="text-sm text-brand-muted leading-relaxed">{p.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4">
                            <GeminiExplainer 
                                context="Weight Algorithm V3: Exponential Decay λ=0.05, Loyalty Threshold 30 epochs, Liveness minimum 95.0%." 
                                prompt="How does this weighting model impact the distribution of rewards between early adopters and late newcomers compared to standard halving models?" 
                            />
                        </div>
                    </div>
                    <div className="lg:w-1/2 w-full">
                        <div className="sticky top-24">
                            <CodeBlock 
                                code={POC_WEIGHT_LOGIC_CODE} 
                                language="rust" 
                                title="consensus/src/weight_modulator.rs" 
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Reputation Deep-Scan Section */}
            <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-brand-accent to-brand-primary rounded-[3.5rem] opacity-10 blur-xl"></div>
                <div className="relative glass border border-brand-accent/30 rounded-[3rem] p-12 overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-accent/10 rounded-full blur-[120px]"></div>
                    <div className="flex flex-col lg:flex-row gap-16">
                        <div className="lg:w-1/2 space-y-10">
                            <div className="flex items-center gap-6">
                                <div className="p-5 bg-brand-accent/10 rounded-3xl border border-brand-accent/30 shadow-glow-accent">
                                    <SparklesIcon className="w-10 h-10 text-brand-accent" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-white tracking-tight">{t.aiRepTitle}</h2>
                                    <p className="text-brand-accent font-bold uppercase tracking-widest text-xs opacity-80">Sentinel AI Audit Module</p>
                                </div>
                            </div>
                            
                            <p className="text-brand-muted text-xl leading-relaxed font-medium italic border-l-4 border-brand-accent/40 pl-6">
                                "{t.aiRepDesc}"
                            </p>

                            <div className="grid grid-cols-1 gap-6">
                                {[
                                    { title: t.aiParamOnChain, desc: t.aiParamOnChainDesc, icon: <CpuChipIcon className="text-brand-primary"/> },
                                    { title: t.aiParamIdentity, desc: t.aiParamIdentityDesc, icon: <ShieldCheckIcon className="text-brand-success"/> },
                                    { title: t.aiParamSocial, desc: t.aiParamSocialDesc, icon: <SignalIcon className="text-brand-accent"/> }
                                ].map((item) => (
                                    <div key={item.title} className="p-6 bg-brand-bg/40 border border-brand-border/40 rounded-[1.5rem] flex gap-6 items-start hover:bg-brand-bg/60 transition-all duration-500 border-b-4 border-b-transparent hover:border-b-brand-accent/40">
                                        <div className="p-3 bg-brand-surface rounded-2xl flex-shrink-0">
                                            {/* Fix: cast element to ReactElement with any props to resolve the 'className' prop error */}
                                            {React.cloneElement(item.icon as React.ReactElement<any>, { className: 'w-6 h-6' })}
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="font-black text-brand-secondary text-lg">{item.title}</h4>
                                            <p className="text-sm text-brand-muted leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-6">
                                <GeminiExplainer 
                                    context="Sentinel Audit: Deep-Chain Entropy, Graph Clustering Coefficient, Decentralized Credential Multiplexer." 
                                    prompt="Explain why 'Social Graph Entropy' is a more reliable Sybil deterrent than standard IP address tracking in decentralized networks." 
                                />
                            </div>
                        </div>
                        <div className="lg:w-1/2 w-full flex flex-col gap-6">
                            <CodeBlock 
                                code={AI_REPUTATION_LOGIC_CODE} 
                                language="python" 
                                title="sentinel/reputation_engine.py" 
                            />
                            <div className="p-8 bg-brand-accent/5 rounded-[2rem] border border-brand-accent/20 text-center space-y-2">
                                <div className="w-2 h-2 bg-brand-accent rounded-full animate-ping mx-auto"></div>
                                <p className="text-xs font-black text-brand-accent uppercase tracking-[0.2em]">IA Monitorando Camada L1</p>
                                <p className="text-[10px] text-brand-muted font-bold">Scanning for malicious entropy patterns...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ClaimEventSection />
        </div>
    );
};
