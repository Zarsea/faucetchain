
import React from 'react';
import { SparklesIcon, WalletIcon, SignalIcon, ArrowPathIcon } from './IconComponents';
import { MermaidDiagram } from './MermaidDiagram';
import { DIAGRAMS } from '../constants';
import { useLanguage } from './LanguageContext';
import { GeminiExplainer } from './GeminiExplainer';

export const ClaimEventSection: React.FC = () => {
    const { lang } = useLanguage();

    const content = {
        en: {
            title: "The 'Claim Event' Lifecycle",
            description: "The 'Claim Event' is the fundamental unit of work in FaucetChain. Unlike traditional mining, it represents a verified contribution that triggers a complex cascade of economic and technical state updates.",
            steps: [
                {
                    title: "Cryptographic Submission",
                    desc: "A user submits a claim packet containing their PoC proof and stake commitment.",
                    icon: <SignalIcon className="w-8 h-8 text-blue-400" />,
                    bgColor: "bg-blue-400/10",
                    borderColor: "group-hover:border-blue-400/50"
                },
                {
                    title: "Atomic Reward Minting",
                    desc: "Upon validation, the reward for the current block is minted and split 60/40 immediately.",
                    icon: <WalletIcon className="w-8 h-8 text-brand-primary" />,
                    bgColor: "bg-brand-primary/10",
                    borderColor: "group-hover:border-brand-primary/50"
                },
                {
                    title: "Programmatic Swap Trigger",
                    desc: "The 60% Ecosystem portion is instantly swapped for Stablecoins via a native DEX aggregator.",
                    icon: <ArrowPathIcon className="w-8 h-8 text-purple-400" />,
                    bgColor: "bg-purple-400/10",
                    borderColor: "group-hover:border-purple-400/50"
                },
                {
                    title: "Treasury Settlement",
                    desc: "Stablecoins are deposited into the multi-sig treasury for yield generation strategies.",
                    icon: <SparklesIcon className="w-8 h-8 text-green-400" />,
                    bgColor: "bg-green-400/10",
                    borderColor: "group-hover:border-green-400/50"
                }
            ]
        },
        pt: {
            title: "Ciclo de Vida do 'Evento de Reivindicação'",
            description: "O 'Evento de Reivindicação' é a unidade fundamental de trabalho na FaucetChain. Diferente da mineração tradicional, ele representa uma contribuição verificada que dispara uma cascata complexa de atualizações de estado econômico e técnico.",
            steps: [
                {
                    title: "Submissão Criptográfica",
                    desc: "O usuário envia um pacote de claim contendo sua prova de PoC e compromisso de stake.",
                    icon: <SignalIcon className="w-8 h-8 text-blue-400" />,
                    bgColor: "bg-blue-400/10",
                    borderColor: "group-hover:border-blue-400/50"
                },
                {
                    title: "Mint de Recompensa Atômica",
                    desc: "Após a validação, a recompensa do bloco atual é cunhada e dividida 60/40 imediatamente.",
                    icon: <WalletIcon className="w-8 h-8 text-brand-primary" />,
                    bgColor: "bg-brand-primary/10",
                    borderColor: "group-hover:border-brand-primary/50"
                },
                {
                    title: "Gatilho de Swap Programático",
                    desc: "A porção de 60% do Ecossistema é instantaneamente trocada por Stablecoins via um agregador DEX nativo.",
                    icon: <ArrowPathIcon className="w-8 h-8 text-purple-400" />,
                    bgColor: "bg-purple-400/10",
                    borderColor: "group-hover:border-purple-400/50"
                },
                {
                    title: "Liquidação do Tesouro",
                    desc: "As Stablecoins são depositadas no tesouro multi-sig para estratégias de geração de rendimento.",
                    icon: <SparklesIcon className="w-8 h-8 text-green-400" />,
                    bgColor: "bg-green-400/10",
                    borderColor: "group-hover:border-green-400/50"
                }
            ]
        }
    };

    const t = lang === 'en' ? content.en : content.pt;

    return (
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 lg:p-10 shadow-2xl relative overflow-hidden animate-slideUpFadeIn">
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-[120px] -mr-48 -mt-48 pointer-events-none"></div>
            
            <div className="relative z-10 space-y-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-brand-primary/20 rounded-xl">
                                <ArrowPathIcon className="w-8 h-8 text-brand-primary" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-brand-secondary">{t.title}</h2>
                                <div className="h-1 w-20 bg-brand-primary mt-1 rounded-full"></div>
                            </div>
                        </div>
                        <p className="text-brand-muted text-lg leading-relaxed">
                            {t.description}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        {t.steps.map((step, idx) => (
                            <div 
                                key={idx} 
                                className={`group relative flex items-start gap-5 p-5 rounded-2xl bg-brand-bg/40 border border-brand-border/60 transition-all duration-500 hover:bg-brand-bg/80 hover:-translate-y-1 ${step.borderColor}`}
                            >
                                <div className="absolute top-4 right-4 text-brand-muted/20 text-3xl font-black italic select-none group-hover:text-brand-primary/10 transition-colors">
                                    0{idx + 1}
                                </div>
                                <div className={`flex-shrink-0 p-4 rounded-xl ${step.bgColor} group-hover:scale-110 transition-transform duration-500`}>
                                    {step.icon}
                                </div>
                                <div className="flex-1 pr-6">
                                    <h4 className="text-lg font-bold text-brand-secondary group-hover:text-brand-primary transition-colors mb-1">
                                        {step.title}
                                    </h4>
                                    <p className="text-sm text-brand-muted leading-relaxed">
                                        {step.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="lg:col-span-7 flex flex-col h-full">
                        <div className="sticky top-24">
                            <MermaidDiagram 
                                code={DIAGRAMS[lang].CLAIM_EVENT_DIAGRAM} 
                                title={lang === 'en' ? "Protocol Execution Flow" : "Fluxo de Execução do Protocolo"}
                                prompt="Analyze the chronological sequence of the Claim Event. Why is the 60/40 split handled at step 2 specifically?"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-brand-border/50">
                    <GeminiExplainer 
                        context={t.description} 
                        prompt="How does the 'Claim Event' cascade protect the protocol from token price crashes and ensure long-term treasury sustainability?" 
                    />
                </div>
            </div>
        </div>
    );
};
