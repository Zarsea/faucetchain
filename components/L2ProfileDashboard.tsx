import React, { useEffect } from 'react';

interface L2ProfileDashboardProps {
    drip: any;
    onClose: () => void;
}

export const L2ProfileDashboard: React.FC<L2ProfileDashboardProps> = ({ drip, onClose }) => {
    const p = drip.profile;
    
    useEffect(() => {
        drip.fetchStats();
    }, []);

    if (!p) return null;

    const expProgress = p.next_level_exp ? (p.exp / p.next_level_exp) * 100 : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-5xl bg-[#0a0018] border border-brand-accent/40 rounded-3xl shadow-[0_0_50px_rgba(234,179,8,0.2)] overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header Profile Info */}
                <div className="p-8 border-b border-brand-accent/20 bg-gradient-to-br from-[#110526] to-[#0a0018] flex flex-col md:flex-row items-center justify-between gap-6 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white p-2">✕</button>
                    
                    <div className="flex items-center gap-6">
                        <div className="relative w-24 h-24 rounded-full bg-brand-bg border-2 border-brand-accent flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.5)] overflow-hidden">
                            {/* Simple Identicon based on wallet */}
                            <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-accent to-transparent"></div>
                            <span className="relative z-10 text-3xl font-black text-brand-primary">
                                {p.wallet.substring(2, 4).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-black text-white">{p.wallet.substring(0,6)}...{p.wallet.slice(-4)}</h2>
                                <span className="px-2 py-1 bg-brand-accent/20 border border-brand-accent/50 text-brand-accent rounded text-xs font-bold tracking-widest">{p.rank_name}</span>
                            </div>
                            
                            <div className="flex flex-col gap-1 mt-3 w-64">
                                <div className="flex justify-between text-xs font-bold">
                                    <span className="text-brand-primary">LVL {p.level}</span>
                                    <span className="text-brand-secondary">{p.exp.toFixed(0)} / {p.next_level_exp} EXP</span>
                                </div>
                                <div className="w-full h-2 bg-brand-bg rounded-full overflow-hidden border border-brand-border/50">
                                    <div className="h-full bg-gradient-to-r from-brand-accent to-yellow-400 transition-all duration-500" style={{ width: `${Math.min(100, expProgress)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 text-center">
                        <div className="p-4 bg-brand-bg/50 rounded-2xl border border-brand-border/50 min-w-[120px]">
                            <p className="text-xs text-brand-muted uppercase tracking-widest mb-1">Saldo L2</p>
                            <p className="text-xl font-black text-brand-accent">{drip.virtualBalance.toFixed(2)}</p>
                        </div>
                        <div className="p-4 bg-brand-bg/50 rounded-2xl border border-brand-border/50 min-w-[120px]">
                            <p className="text-xs text-brand-muted uppercase tracking-widest mb-1">Total Earned</p>
                            <p className="text-xl font-black text-[#00ff41]">{p.total_earned.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column: Heatmap & Stats */}
                    <div className="space-y-8 lg:col-span-1">
                        <div>
                            <h3 className="text-sm font-black text-brand-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                                📊 Histograma de Atividade
                            </h3>
                            <div className="bg-brand-bg/40 p-4 rounded-2xl border border-brand-border/30">
                                <div className="flex flex-wrap gap-1">
                                    {/* Mock heatmap visually for the last 30 days based on logs */}
                                    {Array.from({length: 30}).map((_, i) => {
                                        // Simple mapping: assume we have 30 days data, match by index
                                        const d = new Date();
                                        d.setDate(d.getDate() - (29 - i));
                                        const dStr = d.toISOString().split('T')[0];
                                        const log = drip.stats?.daily_logs?.find((l: any) => l.claim_date === dStr);
                                        const intensity = log ? Math.min(1, log.claims_today / 10) : 0;
                                        
                                        return (
                                            <div 
                                                key={i} 
                                                title={log ? `${log.claims_today} claims on ${dStr}` : `No activity on ${dStr}`}
                                                className="w-4 h-4 rounded-sm border border-brand-bg transition-colors"
                                                style={{ 
                                                    backgroundColor: intensity > 0 
                                                        ? `rgba(234, 179, 8, ${0.2 + (intensity * 0.8)})` 
                                                        : 'rgba(255,255,255,0.05)'
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                                <div className="mt-3 text-xs text-brand-muted flex justify-between">
                                    <span>30 dias atrás</span>
                                    <span>Hoje</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-black text-brand-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                                🔥 Streaks & Stats
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between p-3 bg-brand-bg/40 rounded-xl border border-brand-border/30">
                                    <span className="text-brand-secondary">Current Streak</span>
                                    <span className="font-bold text-[#00ff41]">{p.streak_days} dias</span>
                                </div>
                                <div className="flex justify-between p-3 bg-brand-bg/40 rounded-xl border border-brand-border/30">
                                    <span className="text-brand-secondary">Total Drips</span>
                                    <span className="font-bold text-white">{p.total_claims}</span>
                                </div>
                                <div className="flex justify-between p-3 bg-brand-bg/40 rounded-xl border border-brand-border/30">
                                    <span className="text-brand-secondary">Multiplier Atual</span>
                                    <span className="font-bold text-brand-accent">{p.total_multiplier}x</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: NFT Gallery */}
                    <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-brand-primary uppercase tracking-widest flex items-center gap-2">
                                🖼️ NFT Inventory (Gamification)
                            </h3>
                            <span className="text-xs bg-brand-accent/20 text-brand-accent px-2 py-1 rounded">Marketplace Em Breve</span>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {drip.stats?.nfts?.length > 0 ? drip.stats.nfts.map((nft: any) => (
                                <div key={nft.id} className="relative group cursor-pointer">
                                    <div className="absolute inset-0 bg-gradient-to-br from-brand-accent to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition-opacity"></div>
                                    <div className="relative bg-[#110520] border border-brand-accent/30 rounded-2xl p-4 h-48 flex flex-col items-center justify-center text-center overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-accent to-purple-500"></div>
                                        
                                        {/* Hologram Card Effect */}
                                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-bg to-brand-surface border border-white/10 flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(255,255,255,0.1)] relative overflow-hidden group-hover:rotate-12 transition-transform">
                                            <div className="absolute inset-0 bg-white/5 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] mix-blend-overlay"></div>
                                            <span className="text-2xl drop-shadow-md">
                                                {nft.nft_id === 'FIRST_CONTACT' ? '🛸' : '💎'}
                                            </span>
                                        </div>
                                        
                                        <h4 className="font-black text-white text-sm mb-1">{nft.name}</h4>
                                        <p className="text-[10px] text-brand-secondary line-clamp-2">{nft.description}</p>
                                        
                                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/50 rounded border border-white/10 text-[8px] font-mono text-brand-muted uppercase">
                                            {nft.type}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-full py-12 text-center text-brand-muted border-2 border-dashed border-brand-border/30 rounded-2xl flex flex-col items-center">
                                    <span className="text-4xl mb-2 opacity-50">📭</span>
                                    <p className="text-sm">Nenhum NFT de Gamificação encontrado.</p>
                                    <p className="text-xs opacity-50">Mantenha seu streak ou alcance novos Ranks para ganhar.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
