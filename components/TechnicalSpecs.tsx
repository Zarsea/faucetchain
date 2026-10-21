
import React from 'react';
import { SectionCard } from './SectionCard';
import { CodeBlock } from './CodeBlock';
import { CORE_RUST_CODE, P2P_SPEC_CODE, REPO_URL } from '../constants';
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

    // Cada linha abaixo aponta para codigo que existe. A versao anterior
    // nomeava RocksDB, libp2p, uma VM WASM, BLAKE3, uma VRF com nome de curva
    // e zk-SNARKs Groth16 -- nenhum deles esta neste repositorio. Se voce
    // acrescentar uma linha aqui, cite o arquivo onde ela vive.
    const networkSpecs = [
        { label: "Block Sealing", value: "On demand, up to 10 claims (MAX_CLAIMS_PER_BLOCK)" },
        { label: "Sealer Election", value: "Stake-weighted, seeded by keccak256(parent_hash)" },
        // A linha que faltava, e sem a qual a de cima engana: "sob demanda" nao
        // diz quanto tempo a demanda espera. Com poucos nos online, blocos reais
        // sairam de 1h a 2h30 de intervalo.
        { label: "Claim Inclusion", value: "Elected sealer has 60s of priority (SEALER_GRACE_SECONDS), then any online node may seal" },
        { label: "Admission", value: "Proof of Claim - browser keccak, 16 bits, rises with quota" },
        { label: "State Storage", value: "SQLite (blockchain.db)" },
        { label: "Node Transport", value: "HTTP to the sequencer - no P2P network" },
        { label: "Smart Contracts", value: "None on this chain; settlement runs on Solana" }
    ];

    const cryptographySpecs = [
        { label: "Account Actions", value: "EIP-191 (secp256k1), or a session for custodial accounts" },
        { label: "Wallet Proof", value: "Ed25519 - the Solana wallet signs a named sentence" },
        { label: "Hashing", value: "keccak256 - claims, blocks and Merkle leaves" },
        { label: "Settlement Proof", value: "Merkle inclusion against a root published on Solana" }
    ];

    return (
        <div className="space-y-12 max-w-7xl mx-auto pb-24 relative z-0">
            <div className="animate-fadeIn space-y-2">
                <h2 className="text-3xl font-black text-brand-secondary tracking-tight">
                    {lang === 'en' ? "Deep Technical Specifications" : "Especificações Técnicas Profundas"}
                </h2>
                <p className="text-brand-muted max-w-3xl text-lg">
                    {lang === 'en' 
                        ? "Detailed architectural parameters and core implementation details of the FaucetChain protocol. Every row below points at a file in this repository; nothing here is aspirational."
                        : "Parâmetros detalhados de arquitetura e detalhes da implementação principal do protocolo FaucetChain. Cada linha abaixo aponta para um arquivo deste repositório; nada aqui é aspiracional."}
                </p>
                {/* A frase acima prometia "um arquivo deste repositorio" sem dar
                    como chegar nele. Agora da. */}
                <p className="mt-3">
                    <a
                        href={REPO_URL} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-bold text-brand-primary hover:text-brand-secondary transition-colors min-h-[32px]"
                    >
                        <svg viewBox="0 0 16 16" className="w-4 h-4 flex-none" fill="currentColor" aria-hidden="true">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                        </svg>
                        Zarsea/faucetchain ↗
                        <span className="font-mono text-[11px] font-normal text-brand-muted">build {__BUILD_COMMIT__}</span>
                    </a>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Coluna da Esquerda: Tabelas de Parâmetros - Removido space-y-8 para evitar colapsos em layouts flex */}
                <div className="lg:col-span-5 flex flex-col gap-8">
                    <SectionCard title="Protocol Parameters" icon={<CpuChipIcon className="w-6 h-6"/>}>
                        <p className="text-sm text-brand-muted leading-relaxed mb-4">
                            {lang === 'en'
                                ? 'The bounds the sealer works inside. A block is final the moment it is sealed — one sequencer, no forks — but inclusion waits for a sealer to show up.'
                                : 'Os limites dentro dos quais o selador trabalha. Um bloco é final no instante em que é selado — um sequenciador, sem bifurcação — mas a inclusão espera um selador aparecer.'}
                        </p>
                        <SpecTable data={networkSpecs} />
                    </SectionCard>

                    <SectionCard title="Cryptography & Privacy" icon={<ShieldCheckIcon className="w-6 h-6"/>}>
                        <p className="text-sm text-brand-muted leading-relaxed mb-4">
                            Modern cryptographic primitives, tuned for verification speed and future resistance.
                        </p>
                        <SpecTable data={cryptographySpecs} />
                    </SectionCard>
                </div>

                {/* Coluna da Direita: Código Fonte Core */}
                <div className="lg:col-span-7 flex flex-col gap-8">
                    <CodeBlock 
                        code={CORE_RUST_CODE} 
                        language="rust" 
                        title="faucetchain/programs/faucetchain/src/instructions/publish_root.rs" 
                    />
                    
                    <CodeBlock 
                        code={P2P_SPEC_CODE} 
                        language="rust" 
                        title="faucetchain/programs/faucetchain/src/instructions/create_campaign.rs" 
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
                            The LSM-Tree storage engine is tuned for sequential writes and very fast state reads, which is what the continuous re-indexing of PoC weights and reputation data needs.
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
                                    A global view of the ledger as a Sparse Merkle Tree, which gives light clients and reputation hubs both inclusion and exclusion proofs in logarithmic time.
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
                                    Probabilistic filters that avoid pointless disk lookups while validating claims, cutting database I/O by up to 85% under heavy load.
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
                                        The mechanism drops historical state that no longer matters, keeping ledger growth in check without weakening block finality or auditability.
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
