
import React from 'react';
import { SparklesIcon, WalletIcon, SignalIcon, ArrowPathIcon } from './IconComponents';
import { MermaidDiagram } from './MermaidDiagram';
import { diagrams } from '../constants';
import { useLanguage } from './LanguageContext';

export const ClaimEventSection: React.FC = () => {
    const { lang, tri } = useLanguage();

    const content = {
        en: {
            title: "The 'Claim Event' Lifecycle",
            description: "A claim is the unit of work on this network. These four steps are what the code does; the diagram beside them is the same path, drawn.",
            steps: [
                {
                    title: "Claim, with proof",
                    desc: "The claim carries a Proof of Claim: keccak over the chain tip, 16 bits, rising with the hourly quota. Tying it to the tip is what makes it impossible to precompute in bulk.",
                    icon: <SignalIcon className="w-8 h-8 text-blue-400" />,
                    bgColor: "bg-blue-400/10",
                    borderColor: "group-hover:border-blue-400/50"
                },
                {
                    title: "Credited 80/20",
                    desc: "80 percent reaches the user and 20 funds continuity. The split is written at the moment of credit, not invoiced afterwards, so it is already in the tree when the batch is built.",
                    icon: <WalletIcon className="w-8 h-8 text-brand-primary" />,
                    bgColor: "bg-brand-primary/10",
                    borderColor: "group-hover:border-brand-primary/50"
                },
                {
                    title: "Sealed into a batch",
                    desc: "Claims are grouped into a block, up to ten, and the batch root is published on Solana. The program refuses a root whose vault cannot cover what the campaign already promised.",
                    icon: <ArrowPathIcon className="w-8 h-8 text-purple-400" />,
                    bgColor: "bg-purple-400/10",
                    borderColor: "group-hover:border-purple-400/50"
                },
                {
                    title: "Withdrawn by its owner",
                    desc: "The user proves their leaf is in that root and withdraws. Each leaf is derived from the signer, so no other key can release it — ours included — and the relayer pays the fee and the rent.",
                    icon: <SparklesIcon className="w-8 h-8 text-green-400" />,
                    bgColor: "bg-green-400/10",
                    borderColor: "group-hover:border-green-400/50"
                }
            ]
        },
        pt: {
            title: "Ciclo de Vida do 'Evento de Reivindicação'",
            description: "Um claim é a unidade de trabalho desta rede. Estes quatro passos são o que o código faz; o diagrama ao lado é o mesmo caminho, desenhado.",
            steps: [
                {
                    title: "Claim, com prova",
                    desc: "O claim carrega uma Prova de Claim: keccak sobre o topo da cadeia, 16 bits, que sobem com a quota da hora. Amarrá-la ao topo é o que torna impossível pré-computar em massa.",
                    icon: <SignalIcon className="w-8 h-8 text-blue-400" />,
                    bgColor: "bg-blue-400/10",
                    borderColor: "group-hover:border-blue-400/50"
                },
                {
                    title: "Creditado 80/20",
                    desc: "80 por cento chega ao usuário e 20 financia a continuidade. A divisão é escrita no momento do crédito, não cobrada depois, então já está na árvore quando o lote é montado.",
                    icon: <WalletIcon className="w-8 h-8 text-brand-primary" />,
                    bgColor: "bg-brand-primary/10",
                    borderColor: "group-hover:border-brand-primary/50"
                },
                {
                    title: "Selado num lote",
                    desc: "Os claims são agrupados num bloco, até dez, e a raiz do lote é publicada na Solana. O programa recusa uma raiz cujo cofre não cubra o que a campanha já prometeu.",
                    icon: <ArrowPathIcon className="w-8 h-8 text-purple-400" />,
                    bgColor: "bg-purple-400/10",
                    borderColor: "group-hover:border-purple-400/50"
                },
                {
                    title: "Sacado por quem é dono",
                    desc: "O usuário prova que sua folha está naquela raiz e saca. Cada folha deriva de quem assina, então nenhuma outra chave a libera — nem a nossa — e o relayer paga a taxa e o aluguel.",
                    icon: <SparklesIcon className="w-8 h-8 text-green-400" />,
                    bgColor: "bg-green-400/10",
                    borderColor: "group-hover:border-green-400/50"
                }
            ]
        },
        es: {
            title: "Ciclo de Vida del 'Evento de Reclamo'",
            description: "Un claim es la unidad de trabajo de esta red. Estos cuatro pasos son lo que hace el código; el diagrama al lado es el mismo camino, dibujado.",
            steps: [
                {
                    title: "Claim, con prueba",
                    desc: "El claim lleva una Prueba de Claim: keccak sobre la punta de la cadena, 16 bits, que suben con la cuota de la hora. Atarla a la punta es lo que hace imposible precomputarla en masa.",
                    icon: <SignalIcon className="w-8 h-8 text-blue-400" />,
                    bgColor: "bg-blue-400/10",
                    borderColor: "group-hover:border-blue-400/50"
                },
                {
                    title: "Acreditado 80/20",
                    desc: "80 por ciento llega al usuario y 20 financia la continuidad. La división se escribe en el momento del crédito, no se cobra después, así que ya está en el árbol cuando se arma el lote.",
                    icon: <WalletIcon className="w-8 h-8 text-brand-primary" />,
                    bgColor: "bg-brand-primary/10",
                    borderColor: "group-hover:border-brand-primary/50"
                },
                {
                    title: "Sellado en un lote",
                    desc: "Los claims se agrupan en un bloque, hasta diez, y la raíz del lote se publica en Solana. El programa rechaza una raíz cuya bóveda no cubra lo que la campaña ya prometió.",
                    icon: <ArrowPathIcon className="w-8 h-8 text-purple-400" />,
                    bgColor: "bg-purple-400/10",
                    borderColor: "group-hover:border-purple-400/50"
                },
                {
                    title: "Retirado por su dueño",
                    desc: "El usuario prueba que su hoja está en esa raíz y retira. Cada hoja deriva de quien firma, así que ninguna otra clave la libera — ni la nuestra — y el relayer paga la comisión y el alquiler.",
                    icon: <SparklesIcon className="w-8 h-8 text-green-400" />,
                    bgColor: "bg-green-400/10",
                    borderColor: "group-hover:border-green-400/50"
                }
            ]
        }
    };

    // `content` tem as tres. Esta linha escolhia com `lang === 'en' ? en : pt`,
    // entao quem pedia espanhol recebia portugues; depois passou a cair no
    // ingles, que era honesto mas ainda nao era espanhol. Agora e.
    const t = lang === 'pt' ? content.pt : lang === 'es' ? content.es : content.en;

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
                                code={diagrams(lang).CLAIM_EVENT_DIAGRAM} 
                                title={tri("Protocol Execution Flow", "Fluxo de Execução do Protocolo", "Flujo de Ejecución del Protocolo")}
                                prompt="Analyze the chronological sequence of the Claim Event. Why is the 80/20 split written at credit time rather than charged at withdrawal?"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-brand-border/50">
                </div>
            </div>
        </div>
    );
};
