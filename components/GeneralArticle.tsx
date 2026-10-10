
import React from 'react';
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
    XMarkIcon
} from './IconComponents';
import { useLanguage } from './LanguageContext';
import { ClaimEventSection } from './ClaimEventSection';
import { diagrams, POC_WEIGHT_LOGIC_CODE, AI_REPUTATION_LOGIC_CODE } from '../constants';
import { CodeBlock } from './CodeBlock';

export const GeneralArticle: React.FC = () => {
    const { lang } = useLanguage();

    const t = lang === 'en' ? {
        title: "Settlement Architecture",
        subtitle: "How a click becomes a proof, and a proof becomes a payment",
        hubTitle: "Partner faucets",
        hubDesc: "A faucet that already has an audience connects with one HTTP call, made after its own commit. Its money never moves, and it stays up if this chain goes down.",
        lifecycleTitle: "Detailed Execution Lifecycle",
        lifecycleDesc: "The path a claim takes: credited on the appchain, summed into a Merkle tree when the batch closes, published as a root on Solana, and withdrawn against a proof.",
        weightTitle: "Who seals the block",
        weightDesc: "A node's weight in the draw is 1 + min(stake, cap). The +1 keeps a node with no capital in the running; the cap stops whoever locks the most from sealing every round.",
        paramActivity: "The hour gets expensive",
        paramActivityDesc: "The claim puzzle costs one more bit of work for every 25% of the hourly quota spent, up to three. Each bit doubles the work.",
        paramFreq: "A ceiling on the hour",
        paramFreqDesc: "At most 2,000 $CLAIM an hour across every faucet connected to the network. A botnet cannot drain a day of emission in ten minutes.",
        paramUptime: "Paid by uptime share",
        paramUptimeDesc: "The epoch pool is split between online nodes in proportion to the seconds each was actually up, and it is bounded by the same hourly quota.",
        aiRepTitle: "Sentinel",
        aiRepDesc: "A filter, not a gate. It scores accounts that look automated, and the limits that actually hold are arithmetic — they work whether or not it classifies correctly.",
        aiParamOnChain: "Claim timing",
        aiParamOnChainDesc: "Claims arriving on a rhythm no hand produces are scored as a pattern, by similarity across the sequence.",
        aiParamIdentity: "Proof of work in the browser",
        aiParamIdentityDesc: "A keccak puzzle before the server records anything, so automated farming costs what human use costs.",
        aiParamSocial: "One IP, few wallets",
        aiParamSocialDesc: "A hard cap on how many distinct wallets one address can claim to in an hour. Arithmetic, and covered by a test that fails if the limit stops working.",
    } : {
        title: "Arquitetura de Liquidação",
        subtitle: "Como um clique vira prova, e a prova vira pagamento",
        hubTitle: "Torneiras parceiras",
        hubDesc: "Uma torneira que já tem público se conecta com uma chamada HTTP, feita depois do commit dela. O dinheiro dela não se move, e ela continua de pé se esta cadeia cair.",
        lifecycleTitle: "Ciclo de Execução Detalhado",
        lifecycleDesc: "O caminho de um claim: creditado na appchain, somado numa árvore de Merkle quando o lote fecha, publicado como raiz na Solana, e sacado contra uma prova.",
        weightTitle: "Quem sela o bloco",
        weightDesc: "O peso de um nó no sorteio é 1 + min(stake, teto). O +1 mantém no páreo quem não tem capital; o teto impede que quem trava mais sele todas as rodadas.",
        paramActivity: "A hora vai encarecendo",
        paramActivityDesc: "O desafio do claim custa um bit a mais de trabalho a cada 25% da cota da hora gasta, até três. Cada bit dobra o trabalho.",
        paramFreq: "Um teto para a hora",
        paramFreqDesc: "No máximo 2.000 $CLAIM por hora somando todas as torneiras conectadas. Uma botnet não drena a emissão de um dia em dez minutos.",
        paramUptime: "Pago por fatia de uptime",
        paramUptimeDesc: "O pool da época é dividido entre os nós online na proporção dos segundos que cada um ficou de pé, e é limitado pela mesma cota horária.",
        aiRepTitle: "Sentinel",
        aiRepDesc: "Um filtro, não uma tranca. Ele pontua contas que parecem automatizadas, e os limites que de fato seguram são aritmética — valem classificando certo ou errado.",
        aiParamOnChain: "Ritmo dos claims",
        aiParamOnChainDesc: "Claims que chegam num ritmo que mão nenhuma produz são pontuados como padrão, por similaridade ao longo da sequência.",
        aiParamIdentity: "Trabalho no navegador",
        aiParamIdentityDesc: "Um desafio keccak antes de o servidor registrar qualquer coisa, para que farmar automatizado custe o que custa o uso humano.",
        aiParamSocial: "Um IP, poucas carteiras",
        aiParamSocialDesc: "Teto rígido de quantas carteiras distintas um endereço pode reivindicar numa hora. Aritmética, e coberta por teste que falha se o limite parar de funcionar.",
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
                            {lang === 'en' ? "Architecture Mindmap" : "Mapa Mental da Arquitetura"}
                        </h2>
                        <p className="text-brand-muted text-lg max-w-2xl">
                            {lang === 'en' 
                                ? "A holistic top-down view of the FaucetChain ecosystem, mapping the latest V3 upgrades: Dual Consensus, P2P Transfers, SQLite B-Tree Indexes, and Sentinel AI V3."
                                : "Uma visão holística do ecossistema FaucetChain, mapeando os últimos upgrades V3: Consenso Duplo, Transferências P2P, Índices B-Tree no SQLite e IA Sentinela V3."}
                        </p>
                    </div>
                    <div className="w-full h-full min-h-[600px] bg-brand-bg/50 rounded-[2rem] border border-brand-border/40 p-4">
                        <MermaidDiagram 
                            code={diagrams(lang).MINDMAP_CODE} 
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
                                <p className="text-sm text-brand-secondary font-medium">Each drip splits 80 to the user, 20 to the treasury — USER_SHARE and TREASURY_SHARE, in distribution.py.</p>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="mt-1.5 w-2 h-2 rounded-full bg-brand-accent shadow-glow-accent flex-shrink-0"></div>
                                <p className="text-sm text-brand-secondary font-medium">The program refuses a root its vault cannot cover, so the reserve is checked on Solana rather than reported by us.</p>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="mt-1.5 w-2 h-2 rounded-full bg-brand-success shadow-glow-primary flex-shrink-0"></div>
                                <p className="text-sm text-brand-secondary font-medium">The fee payer is a separate signer from the recipient, so somebody holding zero SOL still collects.</p>
                            </div>
                        </div>
                        <div className="pt-6">
                        </div>
                    </div>
                    <div className="lg:w-2/3 h-full min-h-[500px]">
                        <MermaidDiagram 
                            code={diagrams(lang).CLAIM_LIFECYCLE_DETAILED_CODE} 
                            title={lang === 'en' ? "Full Execution Pipeline" : "Pipeline de Execução Completo"} 
                            prompt="Deconstruct the sequence from Minting to Yield. Why is Treasury Settlement the penultimate step before Yield generation?"
                        />
                    </div>
                </div>
            </div>

            {/* Modal de Submissão PoC */}
            {/* O botao "Submit Proof of Claim" e o modal dele sairam em
                9 de outubro de 2026.

                Eles nao transmitiam nada. `handlePoCSubmit` esperava dois
                segundos com `setTimeout`, chamava `addBlockManually`, que so
                incrementa um contador e insere um bloco num array do React,
                e entao mostrava um alerta dizendo "Proof accepted. It is
                credited off-chain now, and settles on Solana with the next
                batch." Nada saia do navegador: nenhuma requisicao, nenhum
                credito, nenhum lote.

                Um botao que afirma ter feito o que nao fez e pior do que
                nenhum botao, e contradiz a unica coisa que este projeto
                afirma sobre si mesmo. Um claim de verdade entra pela
                torneira parceira, e o caminho inteiro esta desenhado logo
                acima. */}

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
                        </div>
                    </div>
                    <div className="lg:w-1/2 w-full">
                        <div className="sticky top-24">
                            <CodeBlock 
                                code={POC_WEIGHT_LOGIC_CODE} 
                                language="python" 
                                title="api_server.py — sealer_weight" 
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
                            </div>
                        </div>
                        <div className="lg:w-1/2 w-full flex flex-col gap-6">
                            <CodeBlock 
                                code={AI_REPUTATION_LOGIC_CODE} 
                                language="python" 
                                title="api_server.py — claim_ip_allowed" 
                            />
                            <div className="p-8 bg-brand-surface/40 rounded-[2rem] border border-brand-border text-center space-y-2">
                                <p className="text-xs font-black text-brand-muted uppercase tracking-[0.2em]">Desenho, não serviço</p>
                                <p className="text-[10px] text-brand-muted font-bold">Nenhum processo lê reputação hoje. O sorteio do selador pesa 1 + stake.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ClaimEventSection />
        </div>
    );
};
