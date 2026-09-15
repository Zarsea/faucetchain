
import React, { useState, useEffect, useCallback } from 'react';
import { SectionCard } from './SectionCard';
import {
    SparklesIcon,
    CubeIcon,
    ShieldCheckIcon,
    SignalIcon,
    LoadingIcon,
    ChartBarIcon
} from './IconComponents';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { API_BASE_URL } from '../apiConfig';

interface Bounty {
    id: number;
    creator_address: string;
    hunter_address: string | null;
    title: string;
    description: string;
    reward: number;
    created_at: number;
    deadline: number;
    status: 'OPEN' | 'CLAIMED' | 'COMPLETED' | 'CANCELLED';
    completed_at: number | null;
    is_expired: boolean;
    time_remaining: number;
    role?: 'creator' | 'hunter';
}

interface BountyStats {
    totalBounties: number;
    openBounties: number;
    completedBounties: number;
    lockedRewards: number;
    paidRewards: number;
}

const STATUS_CONFIG: Record<string, { label: string; labelPt: string; color: string; bg: string; border: string }> = {
    OPEN: { label: 'Open', labelPt: 'Aberta', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
    CLAIMED: { label: 'In Progress', labelPt: 'Em Progresso', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
    COMPLETED: { label: 'Completed', labelPt: 'Concluída', color: 'text-brand-primary', bg: 'bg-brand-primary/10', border: 'border-brand-primary/30' },
    CANCELLED: { label: 'Cancelled', labelPt: 'Cancelada', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return 'Expired';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

export const BountyBoard: React.FC = () => {
    const { userAddress, isConnected } = useAuth();
    const { lang } = useLanguage();

    const [bounties, setBounties] = useState<Bounty[]>([]);
    const [stats, setStats] = useState<BountyStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<string>('ALL');
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formReward, setFormReward] = useState('');
    const [formDuration, setFormDuration] = useState('24');

    const fetchBounties = useCallback(async () => {
        setLoading(true);
        try {
            const statusParam = filter !== 'ALL' ? `?status=${filter}` : '';
            const [bRes, sRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/bounties/list${statusParam}`),
                fetch(`${API_BASE_URL}/api/bounties/stats`)
            ]);
            if (bRes.ok) setBounties(await bRes.json());
            if (sRes.ok) setStats(await sRes.json());
        } catch (err) {
            console.error('Error fetching bounties:', err);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchBounties();
        const interval = setInterval(fetchBounties, 30000);
        return () => clearInterval(interval);
    }, [fetchBounties]);

    const handleCreateBounty = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isConnected || !userAddress) {
            alert(lang === 'en' ? 'Connect your wallet first' : 'Conecte sua carteira primeiro');
            return;
        }
        setActionLoading(-1);
        try {
            const res = await fetch(`${API_BASE_URL}/api/bounties/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creator_address: userAddress,
                    title: formTitle,
                    description: formDescription,
                    reward: parseFloat(formReward),
                    duration_hours: parseInt(formDuration)
                })
            });
            if (res.ok) {
                setFormTitle('');
                setFormDescription('');
                setFormReward('');
                setFormDuration('24');
                setShowForm(false);
                fetchBounties();
            } else {
                const err = await res.json();
                alert(err.detail);
            }
        } catch (err) {
            console.error('Error creating bounty:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleAction = async (bountyId: number, action: 'claim' | 'approve' | 'cancel') => {
        if (!isConnected || !userAddress) return;
        setActionLoading(bountyId);
        try {
            const bodyMap: Record<string, object> = {
                claim: { hunter_address: userAddress },
                approve: { creator_address: userAddress },
                cancel: { creator_address: userAddress },
            };
            const res = await fetch(`${API_BASE_URL}/api/bounties/${bountyId}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyMap[action])
            });
            if (res.ok) {
                fetchBounties();
            } else {
                const err = await res.json();
                alert(err.detail);
            }
        } catch (err) {
            console.error(`Error performing ${action}:`, err);
        } finally {
            setActionLoading(null);
        }
    };

    const isOwner = (b: Bounty) => userAddress?.toLowerCase() === b.creator_address;

    return (
        <div className="space-y-8 animate-fadeIn pb-20">
            {/* Hero */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter">
                        {lang === 'en' ? 'Community Bounty Board' : 'Quadro de Bounties'}
                    </h2>
                    <p className="text-brand-muted text-lg mt-2 max-w-2xl">
                        {lang === 'en'
                            ? 'Create bounties by locking $CLAIM as rewards. Complete tasks to earn tokens. A decentralized task marketplace powered by FaucetChain.'
                            : 'Crie bounties travando $CLAIM como recompensa. Complete tarefas para ganhar tokens. Um marketplace descentralizado de tarefas na FaucetChain.'}
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-brand-primary text-brand-bg px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-white hover:shadow-glow-primary transition-all active:scale-95 whitespace-nowrap"
                >
                    <SparklesIcon className="w-5 h-5" />
                    {showForm
                        ? (lang === 'en' ? 'Close' : 'Fechar')
                        : (lang === 'en' ? 'New Bounty' : 'Nova Bounty')}
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { label: lang === 'en' ? 'Total Bounties' : 'Total', value: stats.totalBounties.toString(), icon: <CubeIcon className="w-5 h-5" /> },
                        { label: lang === 'en' ? 'Open' : 'Abertas', value: stats.openBounties.toString(), icon: <SignalIcon className="w-5 h-5 text-green-400" /> },
                        { label: lang === 'en' ? 'Completed' : 'Concluídas', value: stats.completedBounties.toString(), icon: <ShieldCheckIcon className="w-5 h-5 text-brand-primary" /> },
                        { label: lang === 'en' ? 'CLAIM Locked' : 'CLAIM Travados', value: `${stats.lockedRewards.toLocaleString()}`, icon: <ChartBarIcon className="w-5 h-5 text-yellow-400" /> },
                        { label: lang === 'en' ? 'CLAIM Paid' : 'CLAIM Pagos', value: `${stats.paidRewards.toLocaleString()}`, icon: <ChartBarIcon className="w-5 h-5 text-brand-accent" /> },
                    ].map((stat, i) => (
                        <div key={i} className="glass border border-brand-border/50 rounded-2xl p-5 hover:border-brand-primary/30 transition-colors">
                            <div className="flex items-center gap-2 mb-2 text-brand-muted">{stat.icon}
                                <span className="text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                            </div>
                            <p className="text-2xl font-black text-white font-mono tracking-tighter">{stat.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Form */}
            {showForm && (
                <div className="animate-slideUp">
                    <SectionCard title={lang === 'en' ? 'Create New Bounty' : 'Criar Nova Bounty'} icon={<SparklesIcon className="w-5 h-5 text-brand-primary" />}>
                        <form onSubmit={handleCreateBounty} className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest block mb-2">
                                    {lang === 'en' ? 'Title' : 'Título'} *
                                </label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    placeholder={lang === 'en' ? 'e.g. Write documentation for API v2' : 'ex. Escrever documentação para API v2'}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-secondary placeholder:text-brand-muted/40 focus:outline-none focus:border-brand-primary/50 font-mono text-sm"
                                    required
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest block mb-2">
                                    {lang === 'en' ? 'Description' : 'Descrição'}
                                </label>
                                <textarea
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    placeholder={lang === 'en' ? 'Describe the task requirements...' : 'Descreva os requisitos da tarefa...'}
                                    rows={3}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-secondary placeholder:text-brand-muted/40 focus:outline-none focus:border-brand-primary/50 font-mono text-sm resize-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest block mb-2">
                                    {lang === 'en' ? 'Reward ($CLAIM)' : 'Recompensa ($CLAIM)'} *
                                </label>
                                <input
                                    type="number"
                                    value={formReward}
                                    onChange={e => setFormReward(e.target.value)}
                                    placeholder="100"
                                    min="1"
                                    step="1"
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-secondary placeholder:text-brand-muted/40 focus:outline-none focus:border-brand-primary/50 font-mono text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-brand-muted uppercase tracking-widest block mb-2">
                                    {lang === 'en' ? 'Duration (hours)' : 'Duração (horas)'}
                                </label>
                                <select
                                    value={formDuration}
                                    onChange={e => setFormDuration(e.target.value)}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-brand-secondary focus:outline-none focus:border-brand-primary/50 font-mono text-sm"
                                >
                                    <option value="1">1 {lang === 'en' ? 'hour' : 'hora'}</option>
                                    <option value="6">6 {lang === 'en' ? 'hours' : 'horas'}</option>
                                    <option value="24">24 {lang === 'en' ? 'hours' : 'horas'}</option>
                                    <option value="72">3 {lang === 'en' ? 'days' : 'dias'}</option>
                                    <option value="168">7 {lang === 'en' ? 'days' : 'dias'}</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <button
                                    type="submit"
                                    disabled={actionLoading === -1 || !isConnected}
                                    className="w-full bg-gradient-to-r from-brand-primary to-brand-accent text-brand-bg py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-40"
                                >
                                    {actionLoading === -1
                                        ? <LoadingIcon className="w-5 h-5 animate-spin mx-auto" />
                                        : (lang === 'en' ? '🔒 Lock CLAIM & Create Bounty' : '🔒 Travar CLAIM & Criar Bounty')}
                                </button>
                                {!isConnected && (
                                    <p className="text-center text-xs text-red-400 mt-2">
                                        {lang === 'en' ? 'Connect your wallet to create bounties' : 'Conecte sua carteira para criar bounties'}
                                    </p>
                                )}
                            </div>
                        </form>
                    </SectionCard>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 p-1 bg-brand-surface border border-brand-border rounded-xl w-fit">
                {['ALL', 'OPEN', 'CLAIMED', 'COMPLETED', 'CANCELLED'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                            filter === f
                                ? 'bg-brand-primary text-brand-bg shadow-glow-primary'
                                : 'text-brand-muted hover:text-white hover:bg-brand-bg/50'
                        }`}
                    >
                        {f === 'ALL' ? (lang === 'en' ? 'All' : 'Todas') : STATUS_CONFIG[f]?.[lang === 'pt' ? 'labelPt' : 'label'] || f}
                    </button>
                ))}
            </div>

            {/* Bounty Cards */}
            {loading && bounties.length === 0 ? (
                <div className="flex justify-center py-20">
                    <LoadingIcon className="w-10 h-10 animate-spin text-brand-primary" />
                </div>
            ) : bounties.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                    <CubeIcon className="w-24 h-24 text-brand-muted mb-6" />
                    <h3 className="text-xl font-black text-white uppercase tracking-widest">
                        {lang === 'en' ? 'No Bounties Found' : 'Nenhuma Bounty Encontrada'}
                    </h3>
                    <p className="text-brand-muted mt-2">
                        {lang === 'en' ? 'Create the first bounty to get started!' : 'Crie a primeira bounty para começar!'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bounties.map(bounty => {
                        const sc = STATUS_CONFIG[bounty.status] || STATUS_CONFIG.OPEN;
                        const canClaim = bounty.status === 'OPEN' && !bounty.is_expired && !isOwner(bounty) && isConnected;
                        const canApprove = bounty.status === 'CLAIMED' && isOwner(bounty);
                        const canCancel = isOwner(bounty) && (bounty.status === 'OPEN' || (bounty.status === 'CLAIMED' && bounty.is_expired));

                        return (
                            <div key={bounty.id} className="glass border border-brand-border/50 rounded-2xl p-6 hover:border-brand-primary/30 transition-all duration-300 group relative overflow-hidden">
                                {/* Glow effect */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                {/* Header */}
                                <div className="flex items-start justify-between mb-4 relative z-10">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${sc.color} ${sc.bg} border ${sc.border}`}>
                                                {lang === 'pt' ? sc.labelPt : sc.label}
                                            </span>
                                            {bounty.is_expired && bounty.status === 'OPEN' && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/30">
                                                    {lang === 'en' ? 'Expired' : 'Expirada'}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-black text-brand-secondary tracking-tight truncate group-hover:text-white transition-colors">
                                            {bounty.title}
                                        </h3>
                                    </div>
                                    <div className="text-right ml-4 flex-shrink-0">
                                        <p className="text-2xl font-black text-brand-primary font-mono tracking-tighter">{bounty.reward}</p>
                                        <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest">$CLAIM</p>
                                    </div>
                                </div>

                                {/* Description */}
                                {bounty.description && (
                                    <p className="text-sm text-brand-muted leading-relaxed mb-4 line-clamp-2">{bounty.description}</p>
                                )}

                                {/* Meta */}
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-brand-muted">{lang === 'en' ? 'Creator' : 'Criador'}</span>
                                        <span className="font-mono text-brand-secondary opacity-70">{bounty.creator_address.substring(0, 10)}...</span>
                                    </div>
                                    {bounty.hunter_address && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-brand-muted">Hunter</span>
                                            <span className="font-mono text-yellow-400 opacity-70">{bounty.hunter_address.substring(0, 10)}...</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-xs">
                                        <span className="text-brand-muted">{lang === 'en' ? 'Time Left' : 'Tempo Restante'}</span>
                                        <span className={`font-mono font-bold ${bounty.is_expired ? 'text-red-400' : 'text-green-400'}`}>
                                            {bounty.is_expired ? (lang === 'en' ? 'Expired' : 'Expirada') : formatTimeRemaining(bounty.time_remaining)}
                                        </span>
                                    </div>
                                </div>

                                {/* Progress bar for time */}
                                {bounty.status !== 'COMPLETED' && bounty.status !== 'CANCELLED' && (
                                    <div className="w-full bg-brand-bg/80 h-1.5 rounded-full overflow-hidden mb-4 border border-brand-border/30">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${bounty.is_expired ? 'bg-red-500' : 'bg-gradient-to-r from-brand-primary to-brand-accent'}`}
                                            style={{ width: `${bounty.is_expired ? 100 : Math.max(5, 100 - (bounty.time_remaining / ((bounty.deadline - bounty.created_at) || 1)) * 100)}%` }}
                                        />
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 relative z-10">
                                    {canClaim && (
                                        <button
                                            onClick={() => handleAction(bounty.id, 'claim')}
                                            disabled={actionLoading === bounty.id}
                                            className="flex-1 bg-green-500/10 text-green-400 border border-green-500/30 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-500/20 transition-all active:scale-95 disabled:opacity-40"
                                        >
                                            {actionLoading === bounty.id ? <LoadingIcon className="w-4 h-4 animate-spin mx-auto" /> : (lang === 'en' ? '⚡ Accept' : '⚡ Aceitar')}
                                        </button>
                                    )}
                                    {canApprove && (
                                        <button
                                            onClick={() => handleAction(bounty.id, 'approve')}
                                            disabled={actionLoading === bounty.id}
                                            className="flex-1 bg-brand-primary/10 text-brand-primary border border-brand-primary/30 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-primary/20 transition-all active:scale-95 disabled:opacity-40"
                                        >
                                            {actionLoading === bounty.id ? <LoadingIcon className="w-4 h-4 animate-spin mx-auto" /> : (lang === 'en' ? '✅ Approve & Pay' : '✅ Aprovar & Pagar')}
                                        </button>
                                    )}
                                    {canCancel && (
                                        <button
                                            onClick={() => handleAction(bounty.id, 'cancel')}
                                            disabled={actionLoading === bounty.id}
                                            className="flex-1 bg-red-500/10 text-red-400 border border-red-500/30 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-40"
                                        >
                                            {actionLoading === bounty.id ? <LoadingIcon className="w-4 h-4 animate-spin mx-auto" /> : (lang === 'en' ? '✕ Cancel' : '✕ Cancelar')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
