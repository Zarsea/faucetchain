
import React, { useState, useEffect, useCallback } from 'react';
import { SectionCard } from './SectionCard';
import {
    WalletIcon,
    SignalIcon,
    CpuChipIcon,
    SparklesIcon,
    ShieldCheckIcon,
    ChartBarIcon,
    BoltIcon,
    LoadingIcon,
    XMarkIcon,
    MagnifyingGlassPlusIcon,
    ArrowUpRightIcon,
    CubeIcon
} from './IconComponents';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { API_BASE_URL } from '../apiConfig';

const API = API_BASE_URL;

interface TrackedAddress {
    id: number;
    address: string;
    label: string;
    category: string;
    notes: string;
    added_at: number;
    tx_count: number;
    is_miner: boolean;
    miner_online?: boolean;
    miner_earned?: number;
    miner_uptime?: number;
    miner_name?: string;
}

interface TrackerSummary {
    total: number;
    users: number;
    miners: number;
    hubs: number;
    custom: number;
}

interface ActivityData {
    address: string;
    transactions: any[];
    claims: any[];
    mining_rewards: any[];
    staking_positions: any[];
    total_txs: number;
    total_claims: number;
    total_mining_rewards: number;
}

const CATEGORIES = [
    { key: 'all', label: 'Todos', icon: '🌐' },
    { key: 'user', label: 'Usuários', icon: '👤' },
    { key: 'miner', label: 'Mineradores', icon: '⛏️' },
    { key: 'hub', label: 'Hubs Externas', icon: '🔗' },
    { key: 'custom', label: 'Custom', icon: '🏷️' },
];

const CATEGORY_COLORS: Record<string, string> = {
    user: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    miner: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    hub: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    custom: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

export const AddressTracker: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
    const { lang } = useLanguage();
    const { isConnected } = useAuth();

    const [addresses, setAddresses] = useState<TrackedAddress[]>([]);
    const [summary, setSummary] = useState<TrackerSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');

    // Add form state
    const [newAddress, setNewAddress] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newCategory, setNewCategory] = useState('custom');
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState('');

    // Activity drawer
    const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
    const [activity, setActivity] = useState<ActivityData | null>(null);
    const [activityLoading, setActivityLoading] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [aRes, sRes] = await Promise.all([
                fetch(`${API}/api/tracker/addresses${activeCategory !== 'all' ? `?category=${activeCategory}` : ''}`),
                fetch(`${API}/api/tracker/summary`)
            ]);
            if (aRes.ok) setAddresses(await aRes.json());
            if (sRes.ok) setSummary(await sRes.json());
        } catch (err) {
            console.error('Tracker fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [activeCategory]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAddress.trim()) return;
        setAddLoading(true);
        setAddError('');

        try {
            const res = await fetch(`${API}/api/tracker/addresses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: newAddress.trim(),
                    label: newLabel.trim(),
                    category: newCategory
                })
            });
            if (res.ok) {
                setNewAddress('');
                setNewLabel('');
                setNewCategory('custom');
                fetchData();
            } else {
                const data = await res.json();
                setAddError(data.detail || 'Erro ao adicionar');
            }
        } catch (err) {
            setAddError('Servidor não acessível');
        } finally {
            setAddLoading(false);
        }
    };

    const handleRemove = async (address: string) => {
        try {
            const res = await fetch(`${API}/api/tracker/addresses/${address}`, { method: 'DELETE' });
            if (res.ok) {
                fetchData();
                if (selectedAddress === address) setSelectedAddress(null);
            }
        } catch (err) {
            console.error('Remove error:', err);
        }
    };

    const openActivity = async (address: string) => {
        setSelectedAddress(address);
        setActivityLoading(true);
        try {
            const res = await fetch(`${API}/api/tracker/addresses/${address}/activity`);
            if (res.ok) setActivity(await res.json());
        } catch (err) {
            console.error('Activity fetch error:', err);
        } finally {
            setActivityLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <LoadingIcon className="w-12 h-12 animate-spin text-brand-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn pb-20">
            {/* Hero */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-surface via-brand-bg to-brand-surface border border-brand-border/50 p-8 md:p-12">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl">
                            <MagnifyingGlassPlusIcon className="w-8 h-8 text-brand-primary" />
                        </div>
                        <div>
                            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter">
                                Address Tracker
                            </h2>
                            <p className="text-xs text-brand-primary font-black uppercase tracking-[0.3em]">
                                Watchlist & Monitoring
                            </p>
                        </div>
                    </div>
                    <p className="text-brand-muted max-w-xl leading-relaxed">
                        Monitore carteiras de usuários, mineradores e hubs conectadas à rede FaucetChain. Rastreie transações, rewards e atividade de staking em tempo real.
                    </p>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                        { label: 'Total', value: summary.total, icon: '📋', color: 'border-brand-border/50' },
                        { label: 'Usuários', value: summary.users, icon: '👤', color: 'border-blue-500/30 bg-blue-500/5' },
                        { label: 'Mineradores', value: summary.miners, icon: '⛏️', color: 'border-amber-500/30 bg-amber-500/5' },
                        { label: 'Hubs', value: summary.hubs, icon: '🔗', color: 'border-purple-500/30 bg-purple-500/5' },
                        { label: 'Custom', value: summary.custom, icon: '🏷️', color: 'border-brand-border/50' },
                    ].map((s, i) => (
                        <div key={i} className={`glass border rounded-2xl p-4 transition-all hover:border-brand-primary/30 ${s.color}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{s.icon}</span>
                                <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest">{s.label}</span>
                            </div>
                            <p className="text-2xl font-black text-white font-mono">{s.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Address Form */}
            <SectionCard title="Adicionar Endereço" icon={<WalletIcon className="w-5 h-5 text-brand-primary" />}>
                <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-3 mt-2">
                    <input
                        type="text"
                        value={newAddress}
                        onChange={e => setNewAddress(e.target.value)}
                        placeholder="0x... endereço da carteira"
                        className="flex-1 bg-brand-bg/80 border border-brand-border/50 rounded-xl px-4 py-3 text-sm text-brand-secondary font-mono focus:outline-none focus:border-brand-primary/50 placeholder:text-brand-muted/50"
                    />
                    <input
                        type="text"
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        placeholder="Label (ex: Binance Hot)"
                        className="md:w-48 bg-brand-bg/80 border border-brand-border/50 rounded-xl px-4 py-3 text-sm text-brand-secondary focus:outline-none focus:border-brand-primary/50 placeholder:text-brand-muted/50"
                    />
                    <select
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                        className="md:w-40 bg-brand-bg/80 border border-brand-border/50 rounded-xl px-4 py-3 text-sm text-brand-secondary focus:outline-none focus:border-brand-primary/50 appearance-none cursor-pointer"
                    >
                        <option value="user">👤 Usuário</option>
                        <option value="miner">⛏️ Minerador</option>
                        <option value="hub">🔗 Hub Externa</option>
                        <option value="custom">🏷️ Custom</option>
                    </select>
                    <button
                        type="submit"
                        disabled={addLoading || !newAddress}
                        className="px-6 py-3 bg-brand-primary text-brand-bg font-black rounded-xl text-xs uppercase tracking-widest hover:bg-white hover:shadow-glow-primary transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
                    >
                        {addLoading ? <LoadingIcon className="w-5 h-5 animate-spin" /> : '+ Adicionar'}
                    </button>
                </form>
                {addError && <p className="text-red-400 text-xs mt-2 font-bold">{addError}</p>}
            </SectionCard>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.key}
                        onClick={() => setActiveCategory(cat.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${activeCategory === cat.key
                                ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30'
                                : 'bg-brand-surface/50 text-brand-muted border-brand-border/30 hover:text-white hover:border-brand-border/60'
                            }`}
                    >
                        <span>{cat.icon}</span>
                        {cat.label}
                        {summary && (
                            <span className="ml-1 text-[10px] opacity-60">
                                ({cat.key === 'all' ? summary.total : (summary as any)[cat.key === 'all' ? 'total' : `${cat.key}s` === 'customs' ? 'custom' : `${cat.key}s`] ?? (summary as any)[cat.key] ?? 0})
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content: Address List or Activity Drawer */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Address Cards */}
                <div className={`${selectedAddress ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-3`}>
                    {addresses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                            <MagnifyingGlassPlusIcon className="w-20 h-20 text-brand-muted mb-4" />
                            <h3 className="text-lg font-black text-white uppercase tracking-widest">Nenhum Endereço</h3>
                            <p className="text-brand-muted mt-2 max-w-sm">Adicione endereços de carteiras para começar a rastrear atividade na FaucetChain.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {addresses.map(addr => (
                                <div
                                    key={addr.id}
                                    onClick={() => openActivity(addr.address)}
                                    className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${selectedAddress === addr.address
                                            ? 'bg-brand-primary/5 border-brand-primary/30'
                                            : 'bg-brand-surface/40 border-brand-border/30 hover:border-brand-primary/20 hover:bg-brand-bg/40'
                                        }`}
                                >
                                    {/* Category icon */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border text-sm ${CATEGORY_COLORS[addr.category] || CATEGORY_COLORS.custom}`}>
                                        {addr.category === 'miner' ? '⛏️' : addr.category === 'user' ? '👤' : addr.category === 'hub' ? '🔗' : '🏷️'}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-bold text-white truncate">
                                                {addr.label || addr.address.substring(0, 16) + '...'}
                                            </span>
                                            {addr.is_miner && addr.miner_online && (
                                                <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.5)]" />
                                            )}
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${CATEGORY_COLORS[addr.category] || CATEGORY_COLORS.custom}`}>
                                                {addr.category}
                                            </span>
                                        </div>
                                        <p className="text-xs font-mono text-brand-muted truncate">{addr.address}</p>
                                        <div className="flex items-center gap-4 mt-1.5 text-[10px] text-brand-muted">
                                            <span>{addr.tx_count} TXs</span>
                                            {addr.is_miner && (
                                                <>
                                                    <span className="text-amber-400">{addr.miner_earned?.toFixed(2)} CLAIM</span>
                                                    <span>{addr.miner_name}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <ArrowUpRightIcon className="w-4 h-4 text-brand-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <button
                                            onClick={e => { e.stopPropagation(); handleRemove(addr.address); }}
                                            className="p-1.5 rounded-lg text-brand-muted hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                                            title="Remover"
                                        >
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Activity Drawer */}
                {selectedAddress && (
                    <div className="lg:col-span-7 space-y-4 animate-slideUp">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-white tracking-tight">Atividade do Endereço</h3>
                            <button
                                onClick={() => setSelectedAddress(null)}
                                className="p-2 text-brand-muted hover:text-white rounded-lg hover:bg-brand-bg/60 transition-all"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="text-xs font-mono text-brand-primary bg-brand-primary/5 border border-brand-primary/20 rounded-xl px-4 py-3">
                            {selectedAddress}
                        </div>

                        {activityLoading ? (
                            <div className="flex justify-center py-12">
                                <LoadingIcon className="w-8 h-8 animate-spin text-brand-primary" />
                            </div>
                        ) : activity ? (
                            <div className="space-y-4">
                                {/* Activity Summary */}
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Transações', value: activity.total_txs, icon: <BoltIcon className="w-4 h-4 text-brand-accent" /> },
                                        { label: 'Claims', value: activity.total_claims, icon: <SparklesIcon className="w-4 h-4 text-brand-primary" /> },
                                        { label: 'Rewards', value: activity.total_mining_rewards, icon: <CubeIcon className="w-4 h-4 text-amber-400" /> },
                                    ].map((s, i) => (
                                        <div key={i} className="bg-brand-bg/40 border border-brand-border/30 rounded-xl p-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5 mb-1">{s.icon}
                                                <span className="text-[9px] font-black text-brand-muted uppercase tracking-widest">{s.label}</span>
                                            </div>
                                            <p className="text-xl font-black text-white font-mono">{s.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Recent Transactions */}
                                {activity.transactions.length > 0 && (
                                    <SectionCard title="Transações Recentes" icon={<BoltIcon className="w-4 h-4 text-brand-accent" />}>
                                        <div className="space-y-2 mt-2 max-h-[250px] overflow-y-auto scrollbar-hide">
                                            {activity.transactions.map((tx: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-brand-bg/30 rounded-xl border border-brand-border/20">
                                                    <div>
                                                        <span className="text-xs font-mono text-brand-primary">{tx.hash?.substring(0, 20)}...</span>
                                                        <div className="text-[10px] text-brand-muted mt-0.5">
                                                            Block #{tx.block_height} • {new Date(tx.timestamp * 1000).toLocaleString('pt-BR')}
                                                        </div>
                                                    </div>
                                                    <span className="text-sm font-black text-white font-mono">{tx.value?.toFixed(6)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}

                                {/* Mining Rewards */}
                                {activity.mining_rewards.length > 0 && (
                                    <SectionCard title="Mining Rewards" icon={<CpuChipIcon className="w-4 h-4 text-amber-400" />}>
                                        <div className="space-y-2 mt-2 max-h-[200px] overflow-y-auto scrollbar-hide">
                                            {activity.mining_rewards.map((r: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-brand-bg/30 rounded-xl border border-brand-border/20">
                                                    <div>
                                                        <span className="text-xs font-bold text-brand-secondary">Epoch #{r.epoch_id}</span>
                                                        <p className="text-[10px] text-brand-muted mt-0.5">{new Date(r.distributed_at * 1000).toLocaleString('pt-BR')}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-black text-amber-400 font-mono">+{r.reward_amount.toFixed(4)}</span>
                                                        <p className="text-[10px] text-brand-muted">{r.uptime_share}% share</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}

                                {/* Staking Positions */}
                                {activity.staking_positions.length > 0 && (
                                    <SectionCard title="Staking Positions" icon={<ShieldCheckIcon className="w-4 h-4 text-brand-primary" />}>
                                        <div className="space-y-2 mt-2 max-h-[200px] overflow-y-auto scrollbar-hide">
                                            {activity.staking_positions.map((s: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-brand-bg/30 rounded-xl border border-brand-border/20">
                                                    <div>
                                                        <span className="text-xs font-bold text-brand-secondary">UTXO #{s.token_id} — Tier {s.tier}</span>
                                                        <p className="text-[10px] text-brand-muted mt-0.5">{s.is_spent ? '🔴 Gasto' : '🟢 Ativo'}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-black text-brand-primary font-mono">{s.deposit_amount}</span>
                                                        <p className="text-[10px] text-brand-muted">yield: {s.yield_paid}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}

                                {/* Claims */}
                                {activity.claims.length > 0 && (
                                    <SectionCard title="Faucet Claims" icon={<SparklesIcon className="w-4 h-4 text-green-400" />}>
                                        <div className="space-y-2 mt-2 max-h-[200px] overflow-y-auto scrollbar-hide">
                                            {activity.claims.map((c: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-brand-bg/30 rounded-xl border border-brand-border/20">
                                                    <div>
                                                        <span className="text-xs font-mono text-brand-primary">{c.tx_hash?.substring(0, 20)}...</span>
                                                        <p className="text-[10px] text-brand-muted mt-0.5">{new Date(c.timestamp * 1000).toLocaleString('pt-BR')}</p>
                                                    </div>
                                                    <span className="text-sm font-black text-green-400 font-mono">+{c.amount}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </SectionCard>
                                )}

                                {/* Empty state */}
                                {activity.total_txs === 0 && activity.total_claims === 0 && activity.total_mining_rewards === 0 && activity.staking_positions.length === 0 && (
                                    <div className="text-center py-12 opacity-40">
                                        <CubeIcon className="w-16 h-16 text-brand-muted mx-auto mb-3" />
                                        <p className="text-sm text-brand-muted">Nenhuma atividade registrada para este endereço</p>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
};
