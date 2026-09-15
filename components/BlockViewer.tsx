import React, { useState, useEffect } from 'react';
import { SectionCard } from './SectionCard';
import { CubeIcon, CpuChipIcon, BoltIcon } from './IconComponents';
import { API_BASE_URL } from '../apiConfig';
import { useNetwork } from './NetworkContext';
import { useLanguage } from './LanguageContext';

interface BlockData {
    height: number;
    hash: string;
    validator: string;
    txs: number;
    timestamp: number;
    reward: number;
}

const formatNumber = (num: number, lang: string) => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : 'en-US').format(num);

export const BlockViewer: React.FC = () => {
    const { lang } = useLanguage();
    const { metrics } = useNetwork();
    const [recentBlocks, setRecentBlocks] = useState<BlockData[]>([]);
    const [miningStats, setMiningStats] = useState<any>(null);
    const [epochStatus, setEpochStatus] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Recent Blocks
                const blocksRes = await fetch(`${API_BASE_URL}/api/blocks?limit=10`);
                if (blocksRes.ok) {
                    const bData = await blocksRes.json();
                    setRecentBlocks(bData);
                }

                // Fetch Mining Stats
                const statsRes = await fetch(`${API_BASE_URL}/api/mining/stats`);
                if (statsRes.ok) {
                    const sData = await statsRes.json();
                    setMiningStats(sData);
                }

                // Fetch Epoch Status
                const epochRes = await fetch(`${API_BASE_URL}/api/epoch/status`);
                if (epochRes.ok) {
                    const eData = await epochRes.json();
                    setEpochStatus(eData);
                }
            } catch (err) {
                console.error("Failed to fetch block viewer data", err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 3000); // Poll every 3s
        return () => clearInterval(interval);
    }, []);

    const nextBlockHeight = metrics.blockHeight > 0 ? metrics.blockHeight + 1 : recentBlocks.length > 0 ? recentBlocks[0].height + 1 : 0;
    
    return (
        <div className="space-y-8 animate-fadeIn">
            <div>
                <h2 className="text-3xl font-bold text-brand-secondary bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-purple-500">
                    Live Block Explorer
                </h2>
                <p className="text-brand-muted mt-2">
                    Visualização em tempo real da atividade de mineração e exploração de blocos na FaucetChain.
                </p>
            </div>

            {/* Current Mining Block - The Next Block */}
            <div className="relative overflow-hidden rounded-2xl p-1 bg-gradient-to-r from-brand-primary/20 via-purple-500/20 to-brand-primary/20 animate-pulse">
                <div className="bg-[#0A0D14]/90 backdrop-blur-xl rounded-xl p-8 relative z-10 border border-brand-border">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <CubeIcon className="w-32 h-32 text-brand-primary" />
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-20">
                        <div className="flex items-center gap-4">
                            <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/30">
                                <BoltIcon className="w-8 h-8 text-brand-primary animate-pulse" />
                                <div className="absolute inset-0 rounded-2xl border border-brand-primary animate-ping opacity-20"></div>
                            </div>
                            <div>
                                <div className="text-[10px] font-black tracking-widest text-brand-primary uppercase mb-1 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span>
                                    Explorando Próximo Bloco
                                </div>
                                <h3 className="text-4xl font-black text-brand-secondary">
                                    #{formatNumber(nextBlockHeight, lang)}
                                </h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            <div>
                                <p className="text-xs text-brand-muted uppercase tracking-wider mb-1">Hashrate da Rede</p>
                                <p className="text-xl font-mono text-brand-secondary">
                                    {(metrics.networkHashrate / 1000000).toFixed(2)} MH/s
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-brand-muted uppercase tracking-wider mb-1">Nós Minerando</p>
                                <p className="text-xl font-mono text-brand-secondary flex items-center gap-2">
                                    <CpuChipIcon className="w-4 h-4 text-brand-primary" />
                                    {miningStats?.nodesOnline || 0} Ativos
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-brand-muted uppercase tracking-wider mb-1">Recompensa Estimada</p>
                                <p className="text-xl font-mono text-green-400">
                                    ~{miningStats?.estimatedRewardPerNode || metrics.currentReward} $CLAIM
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-brand-muted uppercase tracking-wider mb-1">Status do Epoch</p>
                                <p className="text-xl font-mono text-brand-secondary">
                                    {epochStatus?.isActive ? 'Ativo' : 'Aguardando'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Progress bar simulation */}
                    <div className="mt-8 pt-6 border-t border-brand-border/50">
                        <div className="flex justify-between text-xs text-brand-muted mb-2 font-mono">
                            <span>Buscando PoC...</span>
                            <span>Validando PoS...</span>
                        </div>
                        <div className="w-full h-2 bg-brand-bg rounded-full overflow-hidden border border-brand-border/50">
                            <div className="h-full bg-brand-primary relative animate-shimmer" style={{ width: '100%', backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%)', backgroundSize: '200% 100%' }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mined Blocks Conveyor */}
            <SectionCard title="Blocos Recentes" icon={<CubeIcon className="w-5 h-5 text-brand-primary" />}>
                <div className="flex flex-col gap-4">
                    {recentBlocks.map((block, i) => (
                        <div 
                            key={block.hash} 
                            className="bg-brand-bg/50 border border-brand-border p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 hover:border-brand-primary/30 transition-all duration-300"
                            style={{ animationDelay: `${i * 100}ms`, animation: 'slideUpFadeIn 0.5s ease forwards' }}
                        >
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
                                    <CubeIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-brand-secondary">
                                        Bloco #{formatNumber(block.height, lang)}
                                    </div>
                                    <div className="text-xs font-mono text-brand-muted truncate w-48 md:w-64" title={block.hash}>
                                        {block.hash}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-6 w-full md:w-auto text-center md:text-right">
                                <div>
                                    <p className="text-[10px] uppercase text-brand-muted tracking-wider mb-1">Transações</p>
                                    <p className="font-mono text-brand-secondary">{block.txs}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase text-brand-muted tracking-wider mb-1">Recompensa</p>
                                    <p className="font-mono text-green-400">{(block.reward || 0).toFixed(2)} CLAIM</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase text-brand-muted tracking-wider mb-1">Validador</p>
                                    <p className="font-mono text-brand-primary text-sm truncate w-24">
                                        {block.validator || 'Genesis'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {recentBlocks.length === 0 && (
                        <div className="py-8 text-center text-brand-muted">
                            Nenhum bloco encontrado ou carregando...
                        </div>
                    )}
                </div>
            </SectionCard>
        </div>
    );
};
