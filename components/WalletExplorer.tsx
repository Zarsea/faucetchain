
import React, { useState, useEffect } from 'react';
import { SectionCard } from './SectionCard';
import {
    WalletIcon,
    MagnifyingGlassPlusIcon,
    SparklesIcon,
    ShieldCheckIcon,
    SignalIcon,
    ChartPieIcon,
    ArrowPathIcon,
    LoadingIcon,
    XMarkIcon
} from './IconComponents';
import { useLanguage } from './LanguageContext';
import { useAuth } from './AuthContext';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import { WalletInfo } from '../types';
import { API_BASE_URL } from '../apiConfig';

export const WalletExplorer: React.FC = () => {
    const { tFn: t } = useLanguage();
    const { userAddress, isConnected } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [wallet, setWallet] = useState<WalletInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [balanceBreakdown, setBalanceBreakdown] = useState<any>(null);
    const [selectedTxHash, setSelectedTxHash] = useState<string | null>(null);
    const [searchedTxHash, setSearchedTxHash] = useState<string | null>(null);

    useEffect(() => {
        if (isConnected && userAddress && !searchTerm) {
            setSearchTerm(userAddress);
            const mockEvent = { preventDefault: () => { } } as React.FormEvent;
            handleSearch(mockEvent, userAddress);
        }
    }, [userAddress, isConnected]);

    const handleSearch = async (e: React.FormEvent, manualAddress?: string) => {
        if (e) e.preventDefault();
        const target = manualAddress || searchTerm;
        if (!target || target.length < 5) return;

        setLoading(true);

        // Detect if search is a Transaction Hash (Ethereum tx hashes are 66 chars, 0x + 64)
        if (target.startsWith('0x') && target.length > 42) {
            setSearchedTxHash(target);
            setWallet(null);
            setBalanceBreakdown(null);
            setTransactions([]);
            setLoading(false);
            return;
        } else {
            setSearchedTxHash(null);
        }

        try {
            // Fetch balance from FaucetChain API
            const balanceRes = await fetch(`${API_BASE_URL}/api/user/${target}/balance`);
            let balanceClaim = 0;
            let txCountResult = 0;
            let breakdown = null;

            if (balanceRes.ok) {
                const balanceData = await balanceRes.json();
                balanceClaim = balanceData.total_claim || 0;
                breakdown = balanceData;
            }

            // Fetch transaction history from FaucetChain API
            const txsRes = await fetch(`${API_BASE_URL}/api/address/${target}/transactions`);
            let txData: any[] = [];
            if (txsRes.ok) {
                txData = await txsRes.json();
                txCountResult = txData.length;
            }

            setWallet({
                address: target,
                balanceClaim: balanceClaim,
                balanceUsdc: 0,
                balanceUsdt: 0,
                reputationScore: Math.min(100, txCountResult * 2),
                stakedAmount: 0,
                lastActivity: txData.length > 0 ? (txData[0].timestamp * 1000) : Date.now(),
                isValidator: txCountResult > 50,
                rank: 0
            });

            setBalanceBreakdown(breakdown);
            setTransactions(txData);
        } catch (error) {
            console.error("Error fetching wallet data:", error);
            alert("Erro ao buscar dados da rede FaucetChain. Verifique se a API está ativa.");
        } finally {
            setLoading(false);
        }
    };

    const clearSearch = () => {
        setSearchTerm('');
        setWallet(null);
        setBalanceBreakdown(null);
        setTransactions([]);
        setSearchedTxHash(null);
    };

    const formatNumber = (n: number) => {
        if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
        return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
    };

    return (
        <div className="space-y-10 animate-fadeIn pb-20">
            {/* ═══════════ SEARCH HERO ═══════════ */}
            <div className="max-w-3xl mx-auto text-center space-y-6">
                <div className="space-y-3">
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter">
                        {t('walletExplorer.title')}
                    </h2>
                    <p className="text-brand-muted text-sm max-w-xl mx-auto leading-relaxed">
                        {t('walletExplorer.desc')}
                    </p>
                </div>

                <form onSubmit={handleSearch} className="relative group max-w-2xl mx-auto">
                    <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary/20 to-brand-accent/20 rounded-2xl blur opacity-0 group-hover:opacity-60 transition duration-500"></div>
                    <div className="relative glass border border-brand-border/60 rounded-xl flex items-center p-1.5">
                        <div className="pl-3 text-brand-muted">
                            <MagnifyingGlassPlusIcon className="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('walletExplorer.searchBtn')}
                            className="flex-1 bg-transparent border-none px-3 py-2.5 text-sm text-brand-secondary focus:outline-none placeholder:text-brand-muted/50 font-mono min-w-0"
                        />
                        {searchTerm && (
                            <button type="button" onClick={clearSearch} className="p-1.5 text-brand-muted hover:text-white mr-1 flex-shrink-0">
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            type="submit"
                            className="bg-brand-primary text-brand-bg px-6 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-white transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
                            disabled={loading}
                        >
                            {loading ? <LoadingIcon className="w-4 h-4 animate-spin" /> : t('walletExplorer.searchBtn')}
                        </button>
                    </div>
                </form>
            </div>

            {/* ═══════════ TX SEARCH RESULT ═══════════ */}
            {searchedTxHash && !loading && (
                <div className="max-w-5xl mx-auto mt-10 animate-slideUp">
                    <TransactionDetailsModal txHash={searchedTxHash} inline={true} />
                </div>
            )}

            {/* ═══════════ WALLET RESULTS ═══════════ */}
            {wallet && !loading && (
                <div className="space-y-6 animate-slideUp max-w-5xl mx-auto">

                    {/* ── Row 1: Address Identity Bar ── */}
                    <div className="glass border border-brand-border/40 rounded-xl p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center">
                                    <WalletIcon className="w-5 h-5 text-brand-bg" />
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-brand-muted uppercase tracking-[0.15em] block">
                                        {t('walletExplorer.primaryAddress')}
                                    </span>
                                    <p className="font-mono text-xs text-brand-primary break-all leading-relaxed">{wallet.address}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 sm:ml-auto flex-shrink-0">
                                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${wallet.isValidator ? 'bg-brand-success/10 text-brand-success border border-brand-success/20' : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'}`}>
                                    {wallet.isValidator ? t('walletExplorer.validator') : t('walletExplorer.user')}
                                </div>
                                <div className="px-3 py-1 bg-brand-surface/60 rounded-full text-[9px] font-black text-brand-muted uppercase tracking-widest border border-brand-border/30">
                                    Rank #{wallet.rank}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Row 2: Balance Overview (4 stat cards) ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Balance */}
                        <div className="glass border border-brand-primary/30 rounded-xl p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/5 rounded-full blur-2xl group-hover:bg-brand-primary/10 transition-colors"></div>
                            <span className="text-[9px] font-black text-brand-muted uppercase tracking-[0.15em] block mb-2">
                                {t('walletExplorer.totalBalance')}
                            </span>
                            <p className="text-2xl font-black text-white font-mono tracking-tight">
                                {formatNumber(wallet.balanceClaim)}
                            </p>
                            <span className="text-[10px] font-bold text-brand-primary">$CLAIM</span>
                        </div>

                        {/* Claims Revenue */}
                        <div className="glass border border-brand-border/40 rounded-xl p-5">
                            <span className="text-[9px] font-black text-brand-muted uppercase tracking-[0.15em] block mb-2">
                                {t('walletExplorer.fromClaims')}
                            </span>
                            <p className="text-2xl font-black text-brand-secondary font-mono tracking-tight">
                                {formatNumber(balanceBreakdown?.claims_total || 0)}
                            </p>
                            <span className="text-[10px] font-bold text-brand-muted">Merit Faucet</span>
                        </div>

                        {/* Mining Revenue */}
                        <div className="glass border border-brand-border/40 rounded-xl p-5">
                            <span className="text-[9px] font-black text-brand-muted uppercase tracking-[0.15em] block mb-2">
                                {t('walletExplorer.fromMining')}
                            </span>
                            <p className="text-2xl font-black text-brand-secondary font-mono tracking-tight">
                                {formatNumber(balanceBreakdown?.mining_total || 0)}
                            </p>
                            <span className="text-[10px] font-bold text-brand-muted">AutoClaim</span>
                        </div>

                        {/* Transfers */}
                        <div className="glass border border-brand-border/40 rounded-xl p-5">
                            <span className="text-[9px] font-black text-brand-muted uppercase tracking-[0.15em] block mb-2">
                                {t('walletExplorer.transfersIn')}
                            </span>
                            <p className="text-2xl font-black text-brand-secondary font-mono tracking-tight">
                                {formatNumber(balanceBreakdown?.incoming_total || 0)}
                            </p>
                            <span className="text-[10px] font-bold text-brand-muted">Received</span>
                        </div>
                    </div>

                    {/* ── Row 3: Reputation & Staking side by side ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Sentinel Reputation */}
                        <div className="glass border border-brand-accent/30 rounded-xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-28 h-28 bg-brand-accent/5 rounded-full blur-3xl"></div>
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-accent/10 rounded-lg border border-brand-accent/20">
                                        <SparklesIcon className="w-5 h-5 text-brand-accent" />
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black text-brand-muted uppercase tracking-[0.15em] block">
                                            {t('walletExplorer.sentinelScore')}
                                        </span>
                                        <p className="text-[10px] text-brand-muted">
                                            Integrity verification
                                        </p>
                                    </div>
                                </div>
                                <div className="relative">
                                    <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-brand-accent to-brand-primary">
                                        {wallet.reputationScore}
                                    </span>
                                    <div className="absolute -top-1 -right-2 p-1 bg-brand-success/20 rounded-full border border-brand-success/40">
                                        <ShieldCheckIcon className="w-3 h-3 text-brand-success" />
                                    </div>
                                </div>
                            </div>
                            <div className="w-full bg-brand-bg/80 h-2 rounded-full overflow-hidden border border-brand-border/30">
                                <div
                                    className="bg-gradient-to-r from-brand-accent to-brand-primary h-full rounded-full transition-all duration-1000"
                                    style={{ width: `${wallet.reputationScore}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Staking & Activity */}
                        <div className="glass border border-brand-success/20 rounded-xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 opacity-5">
                                <SignalIcon className="w-16 h-16 text-brand-success" />
                            </div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-brand-success/10 rounded-lg border border-brand-success/20">
                                    <SignalIcon className="w-5 h-5 text-brand-success" />
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-brand-muted uppercase tracking-[0.15em] block">
                                        {t('dashboard.myStaking')}
                                    </span>
                                    <p className="text-[10px] text-brand-muted">Yield: 12% APR</p>
                                </div>
                            </div>
                            <p className="text-3xl font-black text-white font-mono tracking-tight mb-3">
                                {wallet.stakedAmount.toLocaleString()} <span className="text-xs text-brand-muted">$CLAIM</span>
                            </p>
                            <div className="flex items-center gap-3 pt-3 border-t border-brand-border/20">
                                <ArrowPathIcon className="w-3.5 h-3.5 text-brand-muted" />
                                <div>
                                    <span className="text-[9px] font-black text-brand-muted uppercase tracking-[0.1em] block">{t('walletExplorer.recentActivities')}</span>
                                    <span className="text-xs font-bold text-brand-secondary font-mono">
                                        {new Date(wallet.lastActivity).toLocaleDateString()} @ {new Date(wallet.lastActivity).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Row 4: AI Forensic Analysis ── */}
                    <div className="glass border border-brand-primary/20 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-primary/10 to-brand-accent/10 rounded-xl blur-sm opacity-40"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-5">
                                <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary border border-brand-primary/20">
                                    <SparklesIcon className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-black text-brand-secondary tracking-tight">{t('dashboard.sentinelAnalysis')}</h3>
                            </div>
                        </div>
                    </div>

                    {/* ── Row 5: Transaction History Table ── */}
                    {transactions.length > 0 && (
                        <div className="glass border border-brand-border/40 rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-brand-border/30 flex items-center gap-3">
                                <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary border border-brand-primary/20">
                                    <SignalIcon className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-black text-brand-secondary uppercase tracking-wider">
                                    {t('walletExplorer.recentActivities')}
                                </h3>
                                <span className="ml-auto text-[9px] font-black text-brand-muted bg-brand-surface px-2.5 py-1 rounded-md border border-brand-border/30">
                                    {transactions.length} TXs
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-brand-border/30 bg-brand-bg/40">
                                            <th className="px-6 py-3 text-[9px] font-black text-brand-muted uppercase tracking-widest">TX Hash</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-brand-muted uppercase tracking-widest">Block</th>
                                            <th className="px-4 py-3 text-[9px] font-black text-brand-muted uppercase tracking-widest">From / To</th>
                                            <th className="px-6 py-3 text-[9px] font-black text-brand-muted uppercase tracking-widest text-right">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-brand-border/15">
                                        {transactions.slice(0, 20).map((tx, idx) => (
                                            <tr key={tx.hash || idx} className="text-sm group hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-3.5 font-mono text-[11px] text-brand-primary/80 group-hover:text-brand-primary">
                                                    <button 
                                                        onClick={() => setSelectedTxHash(tx.hash)} 
                                                        className="hover:underline text-left"
                                                    >
                                                        {tx.hash?.substring(0, 18)}...
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3.5 text-xs font-bold text-brand-secondary">
                                                    #{tx.block_height}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-1.5 text-[11px] font-mono">
                                                        <span className={tx.from_address?.startsWith('0x0000') || tx.from_address?.startsWith('SYSTEM') ? 'text-brand-accent' : 'text-brand-muted'}>
                                                            {tx.from_address?.startsWith('0x0000') || tx.from_address?.startsWith('SYSTEM') ? t('walletExplorer.faucetChainNetwork') : `${tx.from_address?.substring(0, 8)}...`}
                                                        </span>
                                                        <span className="text-brand-primary font-bold">→</span>
                                                        <span className="text-brand-muted">{tx.to_address?.substring(0, 8) || t('walletExplorer.contract')}...</span>
                                                    </div>
                                                    {tx.source_platform && (
                                                        <span className="text-[8px] bg-brand-bg/50 px-1.5 py-0.5 rounded text-brand-muted mt-1 inline-block uppercase border border-brand-border/30">
                                                            {tx.source_platform}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3.5 text-right">
                                                    <span className="font-mono text-xs font-black text-white">
                                                        {tx.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                                    </span>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest ml-1.5 ${tx.tx_type === 'CLAIM' ? 'text-brand-primary' : tx.tx_type === 'MINING_FEE' ? 'text-brand-accent' : 'text-brand-success'}`}>
                                                        {tx.tx_type || 'TX'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ EMPTY STATE ═══════════ */}
            {!wallet && !loading && (
                <div className="flex flex-col items-center justify-center py-24 text-center opacity-30 group">
                    <div className="relative mb-6">
                        <MagnifyingGlassPlusIcon className="w-24 h-24 text-brand-muted group-hover:scale-110 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-brand-primary rounded-full blur-[60px] opacity-20 animate-pulseGlow"></div>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest">
                        {t('walletExplorer.awaitingCommand')}
                    </h3>
                    <p className="max-w-sm text-brand-muted mt-3 text-sm leading-relaxed">
                        {t('walletExplorer.awaitingDesc')}
                    </p>
                </div>
            )}

            <TransactionDetailsModal 
                txHash={selectedTxHash} 
                onClose={() => setSelectedTxHash(null)} 
            />
        </div>
    );
};
