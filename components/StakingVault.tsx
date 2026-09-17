
import React, { useState, useEffect, useCallback } from 'react';
import { SectionCard } from './SectionCard';
import {
    BoltIcon,
    SparklesIcon,
    ShieldCheckIcon,
    CubeIcon,
    LoadingIcon,
    ArrowUpRightIcon,
    ChartBarIcon,
} from './IconComponents';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { API_BASE_URL } from '../apiConfig';
import { signAction } from '../utils/actionSignature';import { stakeMessage, unstakeMessage } from '../utils/actionMessage';


// ─── Types ────────────────────────────────────────────────────────────────
interface StakingPosition {
    token_id: number;
    staker_address: string;
    deposit_amount: number;
    deposit_timestamp: number;
    lock_duration: number;
    yield_basis_points: number;
    tier: number;
    is_spent: number;
    spent_timestamp: number | null;
    yield_paid: number;
    unlock_time: number;
    is_unlocked: boolean;
    estimated_yield: number;
    time_remaining: number;
    progress_pct: number;
}

interface VaultStats {
    totalLocked: number;
    activePositions: number;
    totalYieldPaid: number;
    spentPositions: number;
}

const TIER_INFO: Record<number, { label: string; duration: string; yield: string; apy: string; color: string; icon: string }> = {
    0: { label: 'Flash Lock', duration: '1 Hora', yield: '0.5%', apy: '4,380%', color: 'brand-accent', icon: '⚡' },
    1: { label: 'Standard Lock', duration: '24 Horas', yield: '2%', apy: '730%', color: 'brand-primary', icon: '🔒' },
    2: { label: 'Diamond Lock', duration: '7 Dias', yield: '10%', apy: '520%', color: 'brand-success', icon: '💎' },
};

const API_BASE = API_BASE_URL;

// ─── Helpers ──────────────────────────────────────────────────────────────
function formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return 'Desbloqueado';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function formatDate(ts: number): string {
    return new Date(ts * 1000).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

// ─── Component ────────────────────────────────────────────────────────────
export const StakingVault: React.FC = () => {
    const { userAddress, isConnected, authMethod } = useAuth();

    const signStakingAction = (buildMessage: (ts: number) => string) => signAction(authMethod, buildMessage);
    const { tFn: t } = useLanguage();

    const [positions, setPositions] = useState<StakingPosition[]>([]);
    const [stats, setStats] = useState<VaultStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [stakeAmount, setStakeAmount] = useState('');
    const [selectedTier, setSelectedTier] = useState(1);
    const [isStaking, setIsStaking] = useState(false);
    const [isUnstaking, setIsUnstaking] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [viewMode, setViewMode] = useState<'active' | 'spent'>('active');

    // ── Fetch data ───────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!userAddress) return;
        setIsLoading(true);
        try {
            const [posRes, statsRes] = await Promise.all([
                fetch(`${API_BASE}/api/staking/positions/${userAddress}`),
                fetch(`${API_BASE}/api/staking/stats`),
            ]);
            if (posRes.ok) setPositions(await posRes.json());
            if (statsRes.ok) setStats(await statsRes.json());
        } catch (e) {
            console.warn('Staking API unreachable:', e);
        } finally {
            setIsLoading(false);
        }
    }, [userAddress]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-refresh every 30s
    useEffect(() => {
        if (!isConnected) return;
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData, isConnected]);

    // ── Stake ────────────────────────────────────────────────────────────
    const handleStake = async () => {
        const amount = parseFloat(stakeAmount);
        if (!amount || amount <= 0 || !userAddress) return;
        setIsStaking(true);
        setFeedback(null);
        try {
            // fix B6: mensagem canônica idêntica à verificada pelo backend
            const { signature, sig_timestamp } = await signStakingAction((ts) =>
                stakeMessage(userAddress.toLowerCase(), amount, selectedTier, ts)
            );
            const res = await fetch(`${API_BASE}/api/staking/stake`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staker_address: userAddress, amount, tier: selectedTier, signature, sig_timestamp }),
            });
            const data = await res.json();
            if (res.ok) {
                setFeedback({ type: 'success', msg: `UTXO #${data.token_id} criado! Lock: ${data.tier_label} | Yield: ${data.estimated_yield} CLAIM` });
                setStakeAmount('');
                fetchData();
            } else {
                setFeedback({ type: 'error', msg: data.detail || 'Erro ao criar stake' });
            }
        } catch {
            setFeedback({ type: 'error', msg: 'API indisponível' });
        } finally {
            setIsStaking(false);
        }
    };

    // ── Unstake ──────────────────────────────────────────────────────────
    const handleUnstake = async (tokenId: number) => {
        if (!userAddress) return;
        setIsUnstaking(tokenId);
        setFeedback(null);
        try {
            // fix B6: mensagem canônica idêntica à verificada pelo backend
            const { signature, sig_timestamp } = await signStakingAction((ts) =>
                unstakeMessage(userAddress.toLowerCase(), tokenId, ts)
            );
            const res = await fetch(`${API_BASE}/api/staking/unstake`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staker_address: userAddress, token_id: tokenId, signature, sig_timestamp }),
            });
            const data = await res.json();
            if (res.ok) {
                setFeedback({ type: 'success', msg: `UTXO #${tokenId} gasto! Recebido: ${data.total_payout} CLAIM (yield: +${data.yield_paid})` });
                fetchData();
            } else {
                setFeedback({ type: 'error', msg: data.detail || 'Erro ao gastar UTXO' });
            }
        } catch {
            setFeedback({ type: 'error', msg: 'API indisponível' });
        } finally {
            setIsUnstaking(null);
        }
    };

    // ── Computed ─────────────────────────────────────────────────────────
    const activePositions = positions.filter(p => !p.is_spent);
    const spentPositions = positions.filter(p => p.is_spent);
    const displayedPositions = viewMode === 'active' ? activePositions : spentPositions;
    const totalUserLocked = activePositions.reduce((s, p) => s + p.deposit_amount, 0);
    const totalUserYieldPending = activePositions.reduce((s, p) => s + p.estimated_yield, 0);

    // ── Not connected ────────────────────────────────────────────────────
    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-brand-surface/20 border-2 border-dashed border-brand-border rounded-[2.5rem] text-center max-w-2xl mx-auto animate-fadeIn">
                <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mb-6">
                    <CubeIcon className="w-10 h-10 text-brand-primary opacity-50" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{t('staking.vaultTitle')}</h2>
                <p className="text-brand-muted mt-4 mb-4 leading-relaxed">
                    {t('staking.vaultDesc')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* ─── Header ──────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-brand-surface border border-brand-border/50 p-8 rounded-[2.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-brand-primary/5 rounded-full -mr-40 -mt-40 blur-3xl"></div>
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary via-brand-accent to-brand-success flex items-center justify-center text-3xl shadow-glow-primary/30">
                        💎
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter uppercase">{t('staking.vaultTitle')}</h2>
                        <p className="text-xs text-brand-muted mt-1">
                            Every deposit becomes its own position, spent exactly once • Coin control
                        </p>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="flex gap-3 relative z-10">
                    <div className="p-3 bg-brand-bg/70 border border-brand-border rounded-xl text-center min-w-[90px]">
                        <span className="text-[9px] font-black text-brand-muted uppercase block">Travado</span>
                        <span className="text-sm font-black text-brand-primary font-mono">{totalUserLocked.toFixed(1)}</span>
                    </div>
                    <div className="p-3 bg-brand-bg/70 border border-brand-border rounded-xl text-center min-w-[90px]">
                        <span className="text-[9px] font-black text-brand-muted uppercase block">Yield Est.</span>
                        <span className="text-sm font-black text-brand-success font-mono">+{totalUserYieldPending.toFixed(2)}</span>
                    </div>
                    <div className="p-3 bg-brand-bg/70 border border-brand-border rounded-xl text-center min-w-[90px]">
                        <span className="text-[9px] font-black text-brand-muted uppercase block">UTXOs</span>
                        <span className="text-sm font-black text-white font-mono">{activePositions.length}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ─── Left: Stake Form + Global Stats ──────────────── */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Stake Form */}
                    <SectionCard title={t('staking.createToGenerate')} icon={<BoltIcon className="w-5 h-5 text-brand-accent" />}>
                        <div className="space-y-4">
                            {/* Tier Selector */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest">{t('staking.lockTier')}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.entries(TIER_INFO).map(([tierKey, info]) => {
                                        const tier = parseInt(tierKey);
                                        const isSelected = selectedTier === tier;
                                        return (
                                            <button
                                                key={tier}
                                                onClick={() => setSelectedTier(tier)}
                                                className={`p-3 rounded-xl border transition-all text-center ${isSelected
                                                    ? 'border-brand-primary bg-brand-primary/10 shadow-glow-primary/10'
                                                    : 'border-brand-border/40 bg-brand-bg/50 hover:border-brand-border'}`}
                                            >
                                                <span className="text-lg block">{info.icon}</span>
                                                <span className="text-[9px] font-black text-brand-muted block mt-1">{info.duration}</span>
                                                <div className="flex flex-col mt-1">
                                                    <span className={`text-xs font-black ${isSelected ? 'text-brand-primary' : 'text-white'}`}>Yield: {info.yield}</span>
                                                    <span className={`text-[10px] font-bold ${isSelected ? 'text-brand-accent' : 'text-brand-success'}`}>APY: {info.apy}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Amount Input */}
                            <div>
                                <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest block mb-2">{t('staking.claimAmount')}</label>
                                <input
                                    type="number"
                                    value={stakeAmount}
                                    onChange={(e) => setStakeAmount(e.target.value)}
                                    placeholder="100.0"
                                    min="0"
                                    step="0.1"
                                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-white font-mono text-sm focus:border-brand-primary focus:outline-none transition-all"
                                />
                                {stakeAmount && parseFloat(stakeAmount) > 0 && (
                                    <div className="mt-2 p-2 bg-brand-success/5 border border-brand-success/20 rounded-lg">
                                        <span className="text-[10px] text-brand-success font-bold">
                                            Yield estimado: +{(parseFloat(stakeAmount) * (TIER_INFO[selectedTier]?.yield === '0.5%' ? 0.005 : TIER_INFO[selectedTier]?.yield === '2%' ? 0.02 : 0.10)).toFixed(4)} CLAIM
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Stake Button */}
                            <button
                                onClick={handleStake}
                                disabled={isStaking || !stakeAmount || parseFloat(stakeAmount) <= 0}
                                className="w-full py-3 bg-gradient-to-r from-brand-primary to-brand-accent text-brand-bg font-black rounded-xl hover:shadow-glow-primary transition-all active:scale-95 text-xs uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                {isStaking ? '⏳ ...' : `🔒 ${t('staking.stakeBtn')} ${TIER_INFO[selectedTier].duration}`}
                            </button>

                            {/* Feedback */}
                            {feedback && (
                                <div className={`p-3 rounded-xl border text-xs font-bold ${feedback.type === 'success'
                                    ? 'bg-brand-success/10 border-brand-success/30 text-brand-success'
                                    : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                    {feedback.msg}
                                </div>
                            )}
                        </div>
                    </SectionCard>

                    {/* Global Vault Stats */}
                    <SectionCard title={t('staking.vaultGlobal')} icon={<ChartBarIcon className="w-5 h-5 text-brand-primary" />}>
                        {stats ? (
                            <div className="flex flex-wrap gap-3">
                                <div className="flex-1 min-w-[120px] p-3 bg-brand-bg/50 border border-brand-border/30 rounded-xl shadow-inner">
                                    <span className="text-[9px] font-black text-brand-muted uppercase block mb-1">{t('staking.tvl')}</span>
                                    <span className="text-base sm:text-lg font-black text-brand-primary font-mono">{Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(stats.totalLocked)}</span>
                                    <span className="text-[9px] text-brand-muted ml-1 font-bold">CLAIM</span>
                                </div>
                                <div className="flex-1 min-w-[100px] p-3 bg-brand-bg/50 border border-brand-border/30 rounded-xl shadow-inner">
                                    <span className="text-[9px] font-black text-brand-muted uppercase block mb-1">{t('staking.activeUtxos')}</span>
                                    <span className="text-base sm:text-lg font-black text-white font-mono">{Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(stats.activePositions)}</span>
                                </div>
                                <div className="flex-1 min-w-[120px] p-3 bg-brand-bg/50 border border-brand-border/30 rounded-xl shadow-inner">
                                    <span className="text-[9px] font-black text-brand-muted uppercase block mb-1">{t('staking.yieldPaid')}</span>
                                    <span className="text-base sm:text-lg font-black text-brand-success font-mono">{Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(stats.totalYieldPaid)}</span>
                                </div>
                                <div className="flex-1 min-w-[100px] p-3 bg-brand-bg/50 border border-brand-border/30 rounded-xl shadow-inner">
                                    <span className="text-[9px] font-black text-brand-muted uppercase block mb-1">{t('staking.spent')}</span>
                                    <span className="text-base sm:text-lg font-black text-brand-accent font-mono">{Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(stats.spentPositions)}</span>
                                </div>
                                <div className="flex-1 min-w-[120px] p-3 bg-brand-success/10 border border-brand-success/30 rounded-xl shadow-glow-primary/20">
                                    <span className="text-[9px] font-black text-brand-success uppercase flex items-center gap-1 mb-1">
                                        <span className="w-1.5 h-1.5 bg-brand-success rounded-full animate-ping"></span>
                                        {t('staking.statusApy')}
                                    </span>
                                    <span className="text-base sm:text-lg font-black text-white font-mono">1,876%</span>
                                    <span className="text-[9px] text-brand-success ml-1 block mt-1 border-t border-brand-success/20 pt-1">Média Global</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-brand-muted text-xs">Carregando...</div>
                        )}
                    </SectionCard>
                </div>

                {/* ─── Right: UTXO Coin Control ────────────────────── */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Tab Switch */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode('active')}
                            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'active'
                                ? 'bg-brand-primary text-brand-bg'
                                : 'bg-brand-surface border border-brand-border text-brand-muted hover:text-white'}`}
                        >
                            UTXOs Ativos ({activePositions.length})
                        </button>
                        <button
                            onClick={() => setViewMode('spent')}
                            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'spent'
                                ? 'bg-brand-accent text-brand-bg'
                                : 'bg-brand-surface border border-brand-border text-brand-muted hover:text-white'}`}
                        >
                            Gastos ({spentPositions.length})
                        </button>
                    </div>

                    <SectionCard
                        title={viewMode === 'active' ? t('staking.activePositions') : t('staking.spentPositions')}
                        icon={<ShieldCheckIcon className="w-5 h-5 text-brand-primary" />}
                    >
                        {isLoading ? (
                            <div className="py-16 flex flex-col items-center justify-center text-brand-muted gap-4">
                                <LoadingIcon className="w-8 h-8 animate-spin" />
                                <span className="text-xs font-bold uppercase tracking-widest">Sincronizando UTXOs...</span>
                            </div>
                        ) : displayedPositions.length === 0 ? (
                            <div className="py-16 flex flex-col items-center justify-center text-brand-muted gap-3">
                                <CubeIcon className="w-12 h-12 opacity-20" />
                                <p className="text-xs font-bold uppercase tracking-widest">
                                    {viewMode === 'active' ? t('staking.noUtxos') : t('staking.noUtxos')}
                                </p>
                                {viewMode === 'active' && (
                                    <p className="text-[10px] text-brand-muted">{t('staking.createToGenerate')}</p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {displayedPositions.map(pos => {
                                    const tierInfo = TIER_INFO[pos.tier] || TIER_INFO[0];
                                    const isThisUnstaking = isUnstaking === pos.token_id;
                                    return (
                                        <div
                                            key={pos.token_id}
                                            className={`p-5 border rounded-2xl transition-all group relative overflow-hidden ${pos.is_spent
                                                ? 'bg-brand-surface/20 border-brand-border/20 opacity-60'
                                                : pos.is_unlocked
                                                    ? 'bg-brand-success/5 border-brand-success/30 hover:border-brand-success/60'
                                                    : 'bg-brand-surface/40 border-brand-border/30 hover:border-brand-primary/40'}`}
                                        >
                                            {/* Progress bar background */}
                                            {!pos.is_spent && (
                                                <div
                                                    className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ${pos.is_unlocked ? 'bg-brand-success' : 'bg-brand-primary/40'}`}
                                                    style={{ width: `${pos.progress_pct}%` }}
                                                />
                                            )}

                                            <div className="flex items-start justify-between gap-4">
                                                {/* Left: UTXO Info */}
                                                <div className="flex items-start gap-4 flex-1">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${pos.is_spent
                                                        ? 'bg-brand-border/20'
                                                        : pos.is_unlocked ? 'bg-brand-success/10' : 'bg-brand-primary/10'}`}>
                                                        {pos.is_spent ? '🔥' : tierInfo.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-xs font-black text-white uppercase">
                                                                UTXO #{pos.token_id}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase border ${pos.is_spent
                                                                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                                                : pos.is_unlocked
                                                                    ? 'bg-brand-success/10 border-brand-success/20 text-brand-success'
                                                                    : 'bg-brand-accent/10 border-brand-accent/20 text-brand-accent'}`}>
                                                                {pos.is_spent ? 'GASTO' : pos.is_unlocked ? 'DESBLOQUEADO' : 'TRAVADO'}
                                                            </span>
                                                            <span className="px-2 py-0.5 bg-brand-bg/50 border border-brand-border/30 rounded-md text-[8px] font-bold text-brand-muted">
                                                                {tierInfo.label}
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                                            <div>
                                                                <span className="text-[8px] font-black text-brand-muted uppercase block">Valor</span>
                                                                <span className="text-sm font-black text-brand-primary font-mono">{pos.deposit_amount.toFixed(2)}</span>
                                                                <span className="text-[9px] text-brand-muted ml-1">CLAIM</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[8px] font-black text-brand-muted uppercase block">Yield</span>
                                                                <span className="text-sm font-black text-brand-success font-mono">+{pos.estimated_yield.toFixed(4)}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[8px] font-black text-brand-muted uppercase block">Criado</span>
                                                                <span className="text-[10px] font-mono text-brand-muted">{formatDate(pos.deposit_timestamp)}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[8px] font-black text-brand-muted uppercase block">
                                                                    {pos.is_spent ? 'Gasto em' : 'Lock'}
                                                                </span>
                                                                <span className={`text-[10px] font-mono ${pos.is_unlocked ? 'text-brand-success' : 'text-brand-accent'}`}>
                                                                    {pos.is_spent
                                                                        ? (pos.spent_timestamp ? formatDate(pos.spent_timestamp) : '—')
                                                                        : formatTimeRemaining(pos.time_remaining)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Action */}
                                                {!pos.is_spent && pos.is_unlocked && (
                                                    <button
                                                        onClick={() => handleUnstake(pos.token_id)}
                                                        disabled={isThisUnstaking}
                                                        className="px-4 py-2 bg-brand-success text-brand-bg font-black rounded-xl text-[10px] uppercase tracking-widest hover:shadow-glow-primary transition-all active:scale-95 shrink-0 disabled:opacity-50"
                                                    >
                                                        {isThisUnstaking ? '⏳' : '🔥 Gastar'}
                                                    </button>
                                                )}
                                                {!pos.is_spent && !pos.is_unlocked && (
                                                    <div className="text-center shrink-0">
                                                        <div className="text-brand-accent text-lg">🔒</div>
                                                        <span className="text-[8px] text-brand-muted font-bold uppercase block">{Math.round(pos.progress_pct)}%</span>
                                                    </div>
                                                )}
                                                {!!pos.is_spent && (
                                                    <div className="text-center shrink-0">
                                                        <span className="text-[9px] font-bold text-brand-muted">Pago:</span>
                                                        <span className="text-xs font-black text-brand-success font-mono block">{pos.yield_paid.toFixed(4)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </SectionCard>
                </div>
            </div>
        </div>
    );
};
