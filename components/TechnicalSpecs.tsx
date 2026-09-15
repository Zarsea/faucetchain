
import React from 'react';
import { SectionCard } from './SectionCard';
import { CodeBlock } from './CodeBlock';
import { CORE_RUST_CODE, P2P_SPEC_CODE } from '../constants';
import { CpuChipIcon, SignalIcon, ShieldCheckIcon, CubeIcon, ArrowPathIcon } from './IconComponents';
import { useLanguage } from './LanguageContext';

const SpecTable: React.FC<{ data: { label: string, value: string }[] }> = ({ data }) => (
    <div className="overflow-hidden border border-brand-border rounded-xl bg-brand-bg/30">
        <table className="w-full text-sm text-left">
            <tbody>
                {data.map((item, idx) => (
                    <tr key={idx} className="border-b border-brand-border last:border-0 hover:bg-brand-primary/5 transition-colors">
                        <td className="px-4 py-3 font-black text-brand-muted uppercase tracking-tighter text-[10px] w-2/5 border-r border-brand-border">
                            {item.label}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-brand-primary">
                            {item.value}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export const TechnicalSpecs: React.FC = () => {
    const { lang } = useLanguage();

    const networkSpecs = [
        { label: "Block Target Time", value: "2.1 Seconds" },
        { label: "Max Block Size", value: "2.0 MB" },
        { label: "Consensus Algorithm", value: "Hybrid PoC + PoS + VRF" },
        { label: "State Storage", value: "Optimized RocksDB (LSM-Tree)" },
        { label: "P2P Protocol", value: "libp2p (Gossipsub v1.1)" },
        { label: "Virtual Machine", value: "FVM (Faucet VM) - WASM Core" }
    ];

    const cryptographySpecs = [
        { label: "Signature Scheme", value: "Ed25519" },
        { label: "Hashing Algorithm", value: "BLAKE3 (256-bit)" },
        { label: "VRF Implementation", value: "ECVRF-EDWARDS25519-SHA512-ELL2" },
        { label: "Zero-Knowledge Ready", value: "zk-SNARKs (Groth16)" }
    ];

    return (
        <div className="space-y-12 max-w-7xl mx-auto pb-24 relative z-0">
            <div className="animate-fadeIn space-y-2">
                <h2 className="text-3xl font-black text-brand-secondary tracking-tight">
                    {lang === 'en' ? "Deep Technical Specifications" : "Especificações Técnicas Profundas"}
                </h2>
                <p className="text-brand-muted max-w-3xl text-lg">
                    {lang === 'en' 
                        ? "Detailed architectural parameters and core implementation details of the FaucetChain protocol. Built for high performance, fairness, and absolute security."
                        : "Parâmetros detalhados de arquitetura e detalhes da implementação principal do protocolo FaucetChain. Construído para alta performance, justiça e segurança absoluta."}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Coluna da Esquerda: Tabelas de Parâmetros - Removido space-y-8 para evitar colapsos em layouts flex */}
                <div className="lg:col-span-5 flex flex-col gap-8">
                    <SectionCard title="Protocol Parameters" icon={<CpuChipIcon className="w-6 h-6"/>}>
                        <p className="text-sm text-brand-muted leading-relaxed mb-4">
                            Constantes de rede fixas que garantem finalidade sub-3s e gerenciamento eficiente de estado.
                        </p>
                        <SpecTable data={networkSpecs} />
                    </SectionCard>

                    <SectionCard title="Cryptography & Privacy" icon={<ShieldCheckIcon className="w-6 h-6"/>}>
                        <p className="text-sm text-brand-muted leading-relaxed mb-4">
                            Primitivas criptográficas modernas otimizadas para velocidade de verificação e resistência futura.
                        </p>
                        <SpecTable data={cryptographySpecs} />
                    </SectionCard>
                </div>

                {/* Coluna da Direita: Código Fonte Core */}
                <div className="lg:col-span-7 flex flex-col gap-8">
                    <CodeBlock 
                        code={CORE_RUST_CODE} 
                        language="rust" 
                        title="blockchain_core/src/state_transition.rs" 
                    />
                    
                    <CodeBlock 
                        code={P2P_SPEC_CODE} 
                        language="rust" 
                        title="network/src/swarm_config.rs" 
                    />
                </div>
            </div>

            {/* Seção de Arquitetura de Estado: Design Robusto e Isolado */}
            <div className="bg-brand-surface/60 border border-brand-border/60 rounded-[2.5rem] p-8 lg:p-12 shadow-2xl relative z-10">
                <div className="flex flex-col lg:flex-row gap-12 items-start">
                    <div className="lg:w-1/3 space-y-6">
                        <div className="p-4 bg-brand-primary/10 rounded-2xl w-fit border border-brand-primary/20">
                            <CubeIcon className="w-10 h-10 text-brand-primary" />
                        </div>
                        <h3 className="text-3xl font-black text-white tracking-tight leading-tight">
                            State Architecture
                            <span className="block text-brand-primary text-sm uppercase tracking-[0.2em] font-bold mt-2">LSM-Tree Storage Engine</span>
                        </h3>
                        <p className="text-brand-muted text-base leading-relaxed">
                            O motor de armazenamento LSM-Tree é otimizado para gravações sequenciais e consultas de estado ultra-rápidas, essencial para o re-indexamento contínuo de pesos PoC e dados de reputação IA.
                        </p>
                        <div className="pt-4 grid grid-cols-1 gap-3">
                             <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-brand-secondary bg-brand-bg/60 p-3 rounded-xl border border-brand-border/40">
                                <div className="w-2 h-2 rounded-full bg-brand-success shadow-glow-primary"></div>
                                Snapshot Consistency: On-demand
                             </div>
                             <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-brand-secondary bg-brand-bg/60 p-3 rounded-xl border border-brand-border/40">
                                <div className="w-2 h-2 rounded-full bg-brand-primary shadow-glow-primary"></div>
                                Compaction Strategy: Levelled
                             </div>
                        </div>
                    </div>
                    
                    <div className="lg:w-2/3 w-full space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 bg-brand-bg/40 border border-brand-border/40 rounded-2xl hover:border-brand-primary/40 transition-colors group">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary group-hover:scale-110 transition-transform">
                                        <SignalIcon className="w-5 h-5" />
                                    </div>
                                    <h4 className="font-bold text-brand-secondary">World State Root</h4>
                                </div>
                                <p className="text-sm text-brand-muted leading-relaxed">
                                    Representação global do ledger via Sparse Merkle Tree (SMT), permitindo provas de exclusão e inclusão em tempo logarítmico para clientes leves e hubs de reputação.
                                </p>
                            </div>

                            <div className="p-6 bg-brand-bg/40 border border-brand-border/40 rounded-2xl hover:border-brand-accent/40 transition-colors group">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="p-2 bg-brand-accent/10 rounded-lg text-brand-accent group-hover:scale-110 transition-transform">
                                        <ShieldCheckIcon className="w-5 h-5" />
                                    </div>
                                    <h4 className="font-bold text-brand-secondary">Bloom Filters</h4>
                                </div>
                                <p className="text-sm text-brand-muted leading-relaxed">
                                    Filtros probabilísticos para evitar buscas desnecessárias em disco durante a validação de claims, reduzindo o I/O da base de dados em até 85% em condições de alta carga.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 bg-brand-bg/40 border border-brand-border/40 rounded-2xl border-l-4 border-l-brand-success/50">
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                                <div className="flex-1 space-y-2">
                                    <h4 className="font-bold text-brand-secondary flex items-center gap-2">
                                        <ArrowPathIcon className="w-5 h-5 text-brand-success" />
                                        Adaptive Pruning Mechanism
                                    </h4>
                                    <p className="text-sm text-brand-muted leading-relaxed">
                                        O mecanismo remove estados históricos irrelevantes de forma programática, mantendo o crescimento do ledger sob controle sem comprometer a segurança da finalidade do bloco e a auditabilidade.
                                    </p>
                                </div>
                                <div className="w-full md:w-48 p-4 bg-brand-surface rounded-xl border border-brand-border flex items-center justify-center gap-3 shadow-inner">
                                    <div className="flex gap-1.5 items-end h-8">
                                        <div className="w-2 bg-brand-primary/20 h-4 rounded-t-sm"></div>
                                        <div className="w-2 bg-brand-primary h-8 rounded-t-sm animate-pulse"></div>
                                        <div className="w-2 bg-brand-primary/50 h-6 rounded-t-sm"></div>
                                    </div>
                                    <div className="text-[9px] font-black uppercase text-brand-primary tracking-[0.2em] leading-tight">
                                        Compaction<br/>Service
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
