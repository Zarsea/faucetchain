import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../apiConfig';
import { useAuth } from './AuthContext';
import { SectionCard } from './SectionCard';
import { GlobeAltIcon, ArrowPathIcon, CheckCircleIcon } from './IconComponents';

export const DeFiLiquidityHub = () => {
    const { userAddress } = useAuth();
    const [strategies, setStrategies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stakeAmount, setStakeAmount] = useState('');
    const [activeModal, setActiveModal] = useState<string | null>(null);

    const fetchStrategies = async () => {
        try {
            const url = userAddress 
                ? `${API_BASE_URL}/api/defi/strategies?wallet=${userAddress}` 
                : `${API_BASE_URL}/api/defi/strategies`;
            const res = await fetch(url);
            const data = await res.json();
            setStrategies(data.strategies || []);
        } catch (e) {
            console.error("Error fetching strategies:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStrategies();
        const interval = setInterval(fetchStrategies, 10000);
        return () => clearInterval(interval);
    }, [userAddress]);

    const handleAction = async (protocolId: string, action: 'stake' | 'unstake') => {
        if (!userAddress) return alert("Please connect wallet first");
        if (!stakeAmount || isNaN(Number(stakeAmount)) || Number(stakeAmount) <= 0) return alert("Invalid amount");

        try {
            const res = await fetch(`${API_BASE_URL}/api/defi/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet_address: userAddress,
                    protocol_id: protocolId,
                    amount: Number(stakeAmount)
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Error");
            
            alert(data.message);
            setActiveModal(null);
            setStakeAmount('');
            fetchStrategies();
        } catch (e: any) {
            alert(e.message);
        }
    };

    if (loading) return <div className="text-center p-8"><ArrowPathIcon className="w-8 h-8 animate-spin mx-auto text-brand-primary" /></div>;

    return (
        <div className="mt-12">
            <SectionCard title="Cross-Chain DeFi Liquidity Hub" icon={<GlobeAltIcon className="w-6 h-6"/>}>
                <p className="text-sm text-brand-muted mb-6">
                    Stake your $CLAIM directly into off-chain yields. The FaucetChain CrossChainYieldRouter smart contract automatically collateralizes and bridges funds to secure baseline APYs from Tier-1 DeFi protocols like Lido and Aave.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {strategies.map((strat, idx) => (
                        <div key={idx} className="bg-brand-bg/60 border border-brand-border/40 p-5 rounded-xl hover:border-brand-primary/50 transition-colors relative overflow-hidden group">
                            {/* Glow accent */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-brand-primary/20 transition-all"></div>
                            
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div>
                                    <h4 className="font-bold text-white text-lg">{strat.name}</h4>
                                    <span className="text-[10px] uppercase text-brand-primary font-bold tracking-wider">{strat.protocol} • {strat.network}</span>
                                </div>
                                <div className="bg-green-900/30 text-green-400 border border-green-800/50 px-2 py-1 rounded text-xs font-bold">
                                    {strat.baseApy}% APY
                                </div>
                            </div>

                            <div className="space-y-3 mb-6 relative z-10">
                                <div className="flex justify-between text-sm">
                                    <span className="text-brand-muted">Treasury Allocated</span>
                                    <span className="text-white font-mono">{(strat.treasuryAllocated / 1000000).toFixed(1)}M $CLAIM</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-brand-muted">Network TVL</span>
                                    <span className="text-white font-mono">${(strat.tvl / 1000000).toFixed(1)}M</span>
                                </div>
                                <div className="h-px w-full bg-brand-border/50 my-2"></div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-brand-accent font-bold">Your Stake</span>
                                    <span className="text-brand-accent font-mono font-bold">{strat.userStaked} $CLAIM</span>
                                </div>
                            </div>

                            <div className="flex gap-2 relative z-10">
                                <button 
                                    onClick={() => setActiveModal(strat.id + '_stake')}
                                    className="flex-1 bg-brand-primary/20 hover:bg-brand-primary/40 text-brand-primary font-bold text-sm py-2 rounded transition-colors"
                                >
                                    Stake
                                </button>
                                {strat.userStaked > 0 && (
                                    <button 
                                        onClick={() => setActiveModal(strat.id + '_unstake')}
                                        className="flex-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 font-bold text-sm py-2 rounded transition-colors"
                                    >
                                        Unstake
                                    </button>
                                )}
                            </div>

                            {/* Modals */}
                            {activeModal === strat.id + '_stake' && (
                                <div className="absolute inset-0 bg-brand-surface/95 backdrop-blur-sm z-20 flex flex-col justify-center p-4">
                                    <h5 className="font-bold text-white mb-2 text-sm">Stake into {strat.protocol}</h5>
                                    <input 
                                        type="number" 
                                        value={stakeAmount} 
                                        onChange={e => setStakeAmount(e.target.value)} 
                                        placeholder="Amount of $CLAIM"
                                        className="w-full bg-brand-bg border border-brand-border rounded p-2 text-white mb-4 text-sm font-mono focus:border-brand-primary outline-none"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => handleAction(strat.id, 'stake')} className="flex-1 bg-brand-primary text-brand-surface font-bold text-xs py-2 rounded">Confirm</button>
                                        <button onClick={() => setActiveModal(null)} className="flex-1 bg-brand-border text-white font-bold text-xs py-2 rounded">Cancel</button>
                                    </div>
                                </div>
                            )}

                            {activeModal === strat.id + '_unstake' && (
                                <div className="absolute inset-0 bg-brand-surface/95 backdrop-blur-sm z-20 flex flex-col justify-center p-4">
                                    <h5 className="font-bold text-white mb-2 text-sm">Unstake from {strat.protocol}</h5>
                                    <input 
                                        type="number" 
                                        value={stakeAmount} 
                                        onChange={e => setStakeAmount(e.target.value)} 
                                        placeholder={`Max: ${strat.userStaked}`}
                                        className="w-full bg-brand-bg border border-brand-border rounded p-2 text-white mb-4 text-sm font-mono focus:border-red-500 outline-none"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => handleAction(strat.id, 'unstake')} className="flex-1 bg-red-500 text-white font-bold text-xs py-2 rounded">Withdraw</button>
                                        <button onClick={() => setActiveModal(null)} className="flex-1 bg-brand-border text-white font-bold text-xs py-2 rounded">Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
};
