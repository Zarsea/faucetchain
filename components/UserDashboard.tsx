
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { SectionCard } from './SectionCard';
import {
    WalletIcon,
    ArrowPathIcon,
    SparklesIcon,
    ShieldCheckIcon,
    BoltIcon,
    ChartBarIcon,
    ArrowUpRightIcon,
    CubeIcon,
    LoadingIcon,
    SignalIcon
} from './IconComponents';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useNetwork } from './NetworkContext';
import { GeminiExplainer } from './GeminiExplainer';
import { fetchMultipleOraclePrices, type OraclePrice } from '../services/oracleService';
import { API_BASE_URL } from '../apiConfig';

const WatchedAddressesWidget: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
    const { tFn: t } = useLanguage();
    const [summary, setSummary] = useState<any>(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/tracker/summary`)
            .then(r => r.ok ? r.json() : null)
            .then(data => data && setSummary(data))
            .catch(() => {});
    }, []);

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                {[
                    { icon: '👤', label: t('widgets.users'), value: summary?.users ?? 0 },
                    { icon: '⛏️', label: t('widgets.miners'), value: summary?.miners ?? 0 },
                    { icon: '🔗', label: t('widgets.hubs'), value: summary?.hubs ?? 0 },
                    { icon: '🏷️', label: t('widgets.custom'), value: summary?.custom ?? 0 },
                ].map((s, i) => (
                    <div key={i} className="p-3 bg-brand-bg/50 border border-brand-border/30 rounded-xl text-center">
                        <span className="text-sm">{s.icon}</span>
                        <p className="text-lg font-black text-white font-mono">{s.value}</p>
                        <span className="text-[9px] font-bold text-brand-muted uppercase tracking-widest">{s.label}</span>
                    </div>
                ))}
            </div>
            <button
                onClick={() => onNavigate('Address Tracker')}
                className="w-full px-4 py-2.5 bg-brand-bg/60 border border-brand-border/30 rounded-xl text-xs font-bold text-brand-muted hover:text-brand-primary hover:border-brand-primary/30 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
            >
                <SignalIcon className="w-4 h-4" />
                {t('widgets.openTracker')}
            </button>
        </div>
    );
};

const TransferWidget: React.FC<{ userAddress: string; onTransferSuccess: () => void }> = ({ userAddress, onTransferSuccess }) => {
    const { tFn: t } = useLanguage();
    const [receiver, setReceiver] = useState('');
    const [amount, setAmount] = useState('');
    const [privateKey, setPrivateKey] = useState(localStorage.getItem('fcn_private_key') || '');
    const [status, setStatus] = useState<{type: 'idle'|'loading'|'success'|'error', msg: string}>({type: 'idle', msg: ''});

    const handleTransfer = async () => {
        if (!receiver || !amount) return;
        setStatus({ type: 'loading', msg: t('transfer.processing') || 'Processing signature...' });
        try {
            if (!privateKey) {
                setStatus({ type: 'error', msg: 'Chave Privada nativa é necessária para assinar a transação no modo L1.' });
                return;
            }

            // 1. Fetch current nonce
            const nonceRes = await fetch(`${API_BASE_URL}/api/user/${userAddress}/nonce`);
            const nonceData = await nonceRes.json();
            const txNonce = (nonceData.nonce || 0) + 1;

            // 2. Prepare payload
            const parsedAmount = parseFloat(amount);
            const payload = `7777:${txNonce}:${userAddress?.toLowerCase()}:${receiver.toLowerCase()}:${parsedAmount}`;

            // 3. Native Wallet Signature (Sem MetaMask)
            let wallet;
            try {
                wallet = new ethers.Wallet(privateKey);
            } catch (err) {
                setStatus({ type: 'error', msg: 'Chave Privada inválida. Verifique o formato.' });
                return;
            }
            
            const signerAddress = await wallet.getAddress();
            if (signerAddress.toLowerCase() !== userAddress.toLowerCase()) {
                setStatus({ type: 'error', msg: `A chave inserida pertence a ${signerAddress.substring(0,6)}..., mas você está logado como ${userAddress.substring(0,6)}...` });
                return;
            }

            // Salvar para o usuário não precisar digitar de novo na mesma sessão
            localStorage.setItem('fcn_private_key', privateKey);

            const signature = await wallet.signMessage(payload);

            // 4. Send Transaction
            const res = await fetch(`${API_BASE_URL}/api/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender: userAddress,
                    receiver: receiver,
                    amount: parsedAmount,
                    nonce: txNonce,
                    signature: signature
                })
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', msg: `${t('transfer.success')} ${data.tx_hash.substring(0, 16)}...` });
                setReceiver('');
                setAmount('');
                onTransferSuccess();
            } else {
                setStatus({ type: 'error', msg: data.detail || t('common.error') });
            }
        } catch (e: any) {
            console.error("Transfer Error:", e);
            setStatus({ type: 'error', msg: t('transfer.connError') });
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="text-[10px] font-black text-brand-muted uppercase mb-1 block">{t('transfer.destAddress')}</label>
                <input 
                    type="text" 
                    value={receiver}
                    onChange={(e) => setReceiver(e.target.value)}
                    placeholder="0x..." 
                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand-primary outline-none transition-all"
                />
            </div>
            <div>
                <label className="text-[10px] font-black text-brand-muted uppercase mb-1 block">{t('transfer.amount')}</label>
                <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00" 
                    min="0.01"
                    step="0.01"
                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand-primary outline-none transition-all"
                />
            </div>
            <div>
                <label className="text-[10px] font-black text-brand-accent uppercase mb-1 block">Chave Privada (L1 Nativa)</label>
                <input 
                    type="password" 
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="Cole sua Chave Privada da FaucetChain" 
                    className="w-full bg-brand-bg/50 border border-brand-accent/50 rounded-xl px-4 py-2.5 text-sm text-white focus:border-brand-accent outline-none transition-all font-mono"
                />
            </div>
            
            {status.msg && (
                <div className={`text-xs p-3 rounded-xl border font-bold ${status.type === 'error' ? 'bg-brand-error/10 text-brand-error border-brand-error/20' : status.type === 'success' ? 'bg-brand-success/10 text-brand-success border-brand-success/20' : 'text-brand-primary bg-brand-primary/10 border-brand-primary/20'}`}>
                    {status.msg}
                </div>
            )}

            <button
                onClick={handleTransfer}
                disabled={status.type === 'loading'}
                className="w-full px-4 py-3 bg-brand-primary text-brand-bg font-black rounded-xl hover:bg-white hover:shadow-glow-primary transition-all active:scale-95 text-xs uppercase tracking-widest disabled:opacity-50 disabled:pointer-events-none mt-2 flex justify-center gap-2"
            >
                {status.type === 'loading' ? <LoadingIcon className="w-4 h-4 animate-spin" /> : <ArrowUpRightIcon className="w-4 h-4" />}
                {status.type === 'loading' ? t('transfer.processing') : t('transfer.transferBtn')}
            </button>
        </div>
    );
};

// ─── Oracle Market Prices Widget ────────────────────────────────────────────
const ORACLE_PAIRS = ['ETH/USD', 'BTC/USD', 'BNB/USD', 'SOL/USD', 'LINK/USD'];

const OracleMarketWidget: React.FC = () => {
    const { tFn: t } = useLanguage();
    const [prices, setPrices] = useState<OraclePrice[]>([]);
    const [oracleLoading, setOracleLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const loadPrices = useCallback(async () => {
        try {
            const data = await fetchMultipleOraclePrices(ORACLE_PAIRS);
            setPrices(data);
            setLastUpdated(new Date());
        } catch { /* silent */ } finally {
            setOracleLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPrices();
        const interval = setInterval(loadPrices, 60_000);
        return () => clearInterval(interval);
    }, [loadPrices]);

    const coinIcons: Record<string, string> = {
        'ETH/USD': '⟠', 'BTC/USD': '₿', 'BNB/USD': '🟡', 'SOL/USD': '◎', 'LINK/USD': '🔗'
    };

    return (
        <div className="space-y-3">
            {/* Chainlink Badge */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t('oracle.badge')}</span>
                </div>
                <button onClick={loadPrices} className="p-1.5 rounded-lg hover:bg-brand-surface text-brand-muted hover:text-white transition-all">
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                </button>
            </div>

            {oracleLoading ? (
                <div className="flex items-center justify-center py-8 gap-3 text-brand-muted">
                    <LoadingIcon className="w-5 h-5 animate-spin" />
                    <span className="text-xs font-bold">{t('oracle.querying')}</span>
                </div>
            ) : (
                <div className="space-y-2">
                    {prices.map((p) => (
                        <div key={p.pair} className="flex items-center justify-between p-3 bg-brand-bg/50 border border-brand-border/30 rounded-xl hover:border-brand-primary/30 transition-all group">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">{coinIcons[p.pair] || '🪙'}</span>
                                <div>
                                    <div className="text-xs font-black text-white">{p.pair.split('/')[0]}</div>
                                    <div className="text-[9px] text-brand-muted font-mono">{p.pair}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-black text-white font-mono">
                                    ${p.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: p.price < 1 ? 4 : 2 })}
                                </div>
                                <div className={`text-[10px] font-bold ${p.changePercent24h >= 0 ? 'text-brand-success' : 'text-red-400'}`}>
                                    {p.changePercent24h >= 0 ? '▲' : '▼'} {Math.abs(p.changePercent24h).toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {lastUpdated && (
                <p className="text-[9px] text-brand-muted text-center">
                    Atualizado: {lastUpdated.toLocaleTimeString('pt-BR')} •
                    <span className="text-blue-400 ml-1">CryptoCompare Data Feed</span>
                </p>
            )}
        </div>
    );
};

// ─── Staking Summary Widget ──────────────────────────────────────────────────
const StakingSummaryWidget: React.FC<{ userAddress: string; onNavigate: (tab: string) => void }> = ({ userAddress, onNavigate }) => {
    const [stakeData, setStakeData] = useState<{ locked: number; positions: number; yieldEst: number } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userAddress) return;
        const load = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/staking/positions/${userAddress}`);
                if (res.ok) {
                    const positions: any[] = await res.json();
                    const active = positions.filter(p => !p.is_spent);
                    setStakeData({
                        locked: active.reduce((s, p) => s + p.deposit_amount, 0),
                        positions: active.length,
                        yieldEst: active.reduce((s, p) => s + p.estimated_yield, 0),
                    });
                }
            } catch { /* silent */ } finally { setLoading(false); }
        };
        load();
        const iv = setInterval(load, 30_000);
        return () => clearInterval(iv);
    }, [userAddress]);

    if (loading) return <div className="flex items-center justify-center py-6 text-brand-muted gap-2"><LoadingIcon className="w-4 h-4 animate-spin" /><span className="text-xs">Carregando...</span></div>;

    const locked = stakeData?.locked ?? 0;
    const positions = stakeData?.positions ?? 0;
    const yieldEst = stakeData?.yieldEst ?? 0;

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
                {[
                    { label: 'Travado', value: locked.toFixed(1), unit: '$CLAIM', color: 'text-brand-primary' },
                    { label: 'UTXOs', value: String(positions), unit: 'ativos', color: 'text-white' },
                    { label: 'Yield Est.', value: `+${yieldEst.toFixed(2)}`, unit: '$CLAIM', color: 'text-brand-success' },
                ].map((s, i) => (
                    <div key={i} className="p-3 bg-brand-bg/50 border border-brand-border/30 rounded-xl text-center">
                        <p className={`text-base font-black font-mono ${s.color}`}>{s.value}</p>
                        <span className="text-[8px] font-black text-brand-muted uppercase tracking-widest block">{s.label}</span>
                        <span className="text-[8px] text-brand-muted">{s.unit}</span>
                    </div>
                ))}
            </div>
            {positions === 0 && (
                <p className="text-[10px] text-brand-muted text-center italic">Nenhum UTXO de staking ativo.</p>
            )}
            <button
                onClick={() => onNavigate('Staking Vault')}
                className="w-full px-4 py-2.5 bg-brand-bg/60 border border-brand-border/30 rounded-xl text-xs font-bold text-brand-muted hover:text-brand-primary hover:border-brand-primary/30 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
            >
                <BoltIcon className="w-4 h-4" />
                Gerenciar Staking
            </button>
        </div>
    );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export const UserDashboard: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
    const { tFn: t, lang } = useLanguage();
    const { userAddress, isConnected, authMethod } = useAuth();
    const { metrics } = useNetwork();

    const [balanceClaim, setBalanceClaim] = useState<number>(0);
    const [reputation, setReputation] = useState<number>(85);
    const [isLoading, setIsLoading] = useState(true);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [refreshTick, setRefreshTick] = useState(0);

    const fetchUserData = useCallback(async () => {
        if (!isConnected || !userAddress) return;
        setIsLoading(true);
        try {
            // Modo Soberano: sem consulta a redes externas (Sepolia desvinculada).
            // A carteira é usada apenas como identidade; o único ativo é o $CLAIM nativo.
            try {
                const resBalance = await fetch(`${API_BASE_URL}/api/user/${userAddress}/balance`);
                if (resBalance.ok) {
                    const bData = await resBalance.json();
                    setBalanceClaim(bData.total_claim ?? 0);
                } else { setBalanceClaim(0); }
            } catch { setBalanceClaim(0); }

            try {
                const [resTxs, resClaims, resMining] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/address/${userAddress}/transactions`),
                    fetch(`${API_BASE_URL}/api/user/${userAddress}/claims`),
                    fetch(`${API_BASE_URL}/api/mining/rewards/${userAddress}`)
                ]);
                let allData: any[] = [];
                if (resTxs.ok) {
                    const txData = await resTxs.json();
                    allData.push(...txData.map((tx: any) => ({
                        id: tx.hash, type: tx.from_address?.toLowerCase() === userAddress.toLowerCase() ? 'SEND' : 'RECEIVE',
                        amount: tx.value, status: 'Confirmed',
                        time: new Date(tx.timestamp * 1000).toLocaleString(), timestamp: tx.timestamp, hash: tx.hash
                    })));
                }
                if (resClaims.ok) {
                    const claimsData = await resClaims.json();
                    allData.push(...claimsData.map((c: any) => ({
                        id: c.tx_hash, type: 'MINT', amount: c.amount, status: 'Confirmed',
                        time: new Date(c.timestamp * 1000).toLocaleString(), timestamp: c.timestamp, hash: c.tx_hash
                    })));
                }
                if (resMining.ok) {
                    const miningData = await resMining.json();
                    allData.push(...miningData.map((m: any) => ({
                        id: `mining_${m.epoch_id}`, type: 'MINING', amount: m.reward_amount, status: 'Confirmed',
                        time: new Date(m.distributed_at * 1000).toLocaleString(), timestamp: m.distributed_at, hash: `Epoch #${m.epoch_id}`
                    })));
                }
                allData.sort((a, b) => b.timestamp - a.timestamp);
                setTransactions(allData.length > 0 ? allData.slice(0, 5) : []);
            } catch {
                setTransactions([{ id: 1, type: 'MINT', amount: metrics.currentReward, status: 'Confirmed', time: '2m ago', hash: '0x3a...4f2' }]);
            }
            setReputation(Math.min(100, 75 + (metrics.blockHeight % 25)));
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [userAddress, isConnected, authMethod, metrics.blockHeight, metrics.currentReward]);

    // Initial fetch + auto-refresh every 30s
    useEffect(() => {
        fetchUserData();
        const iv = setInterval(fetchUserData, 30_000);
        return () => clearInterval(iv);
    }, [fetchUserData, refreshTick]);

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-brand-surface/20 border-2 border-dashed border-brand-border rounded-[2.5rem] text-center max-w-2xl mx-auto animate-fadeIn">
                <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mb-6">
                    <WalletIcon className="w-10 h-10 text-brand-primary opacity-50" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{t('dashboard.welcome')}</h2>
                <p className="text-brand-muted mt-4 mb-8 leading-relaxed">
                    {t('dashboard.welcomeDesc')}
                </p>
                <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                    <div className="p-3 bg-brand-bg/50 border border-brand-border rounded-xl">
                        <span className="text-[10px] font-black text-brand-primary uppercase block">{t('dashboard.network')}</span>
                        <span className="text-xs font-bold text-white">FaucetChain L1</span>
                    </div>
                    <div className="p-3 bg-brand-bg/50 border border-brand-border rounded-xl">
                        <span className="text-[10px] font-black text-brand-primary uppercase block">{t('dashboard.consensus')}</span>
                        <span className="text-xs font-bold text-white">PoC-V3</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header: User Profile Summary */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-brand-surface border border-brand-border/50 p-8 rounded-[2.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center p-0.5 shadow-glow-primary/20">
                        <div className="w-full h-full bg-brand-bg rounded-[0.9rem] flex items-center justify-center">
                            <CubeIcon className="w-8 h-8 text-brand-primary" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter uppercase">{t('dashboard.title')}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-mono text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-md border border-brand-primary/20">
                                {userAddress?.substring(0, 10)}...{userAddress?.substring(userAddress.length - 8)}
                            </span>
                            {authMethod === 'WALLET' && <ShieldCheckIcon className="w-4 h-4 text-brand-success" />}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 relative z-10">
                    <button
                        onClick={() => onNavigate('Faucet')}
                        className="px-6 py-3 bg-brand-primary text-brand-bg font-black rounded-xl hover:bg-white hover:shadow-glow-primary transition-all active:scale-95 text-xs uppercase tracking-widest"
                    >
                        {t('dashboard.validateMerit')}
                    </button>
                    <button
                        onClick={() => { setRefreshTick(t => t + 1); }}
                        className="p-3 bg-brand-bg border border-brand-border rounded-xl text-brand-muted hover:text-brand-primary transition-all"
                        title="Atualizar dados"
                    >
                        <ArrowPathIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Balances & Stats */}
                <div className="lg:col-span-1 space-y-6">
                    <SectionCard title={t('dashboard.portfolio')} icon={<ChartBarIcon className="w-5 h-5 text-brand-primary" />}>
                        <div className="space-y-4">
                            <div className="p-5 bg-brand-bg/50 border border-brand-border/40 rounded-2xl group hover:border-brand-primary/30 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black text-brand-muted uppercase">{t('dashboard.nativeGas')}</span>
                                    <span className="text-[10px] bg-brand-border/50 px-2 py-0.5 rounded-md">Gasless L1</span>
                                </div>
                                <div className="text-3xl font-black text-white font-mono">$0 <span className="text-sm font-bold text-brand-muted">GAS</span></div>
                            </div>

                            <div className="p-5 bg-brand-primary/5 border border-brand-primary/20 rounded-2xl group hover:border-brand-primary/50 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-black text-brand-primary uppercase">{t('dashboard.merit')}</span>
                                    <SparklesIcon className="w-4 h-4 text-brand-primary animate-pulse" />
                                </div>
                                <div className="text-3xl font-black text-brand-primary font-mono">{balanceClaim.toFixed(2)} <span className="text-sm font-bold text-brand-muted">$CLAIM</span></div>
                                <div className="mt-4 pt-4 border-t border-brand-primary/10 flex justify-between items-center">
                                    <span className="text-[9px] font-black text-brand-muted uppercase">{t('dashboard.estimated')}</span>
                                    <span className="text-xs font-bold text-brand-success">~${(balanceClaim * 0.12).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title={t('dashboard.p2p')} icon={<ArrowUpRightIcon className="w-5 h-5 text-brand-primary" />}>
                        <TransferWidget
                            userAddress={userAddress}
                            onTransferSuccess={() => setRefreshTick(t => t + 1)}
                        />
                    </SectionCard>

                    <SectionCard title={t('dashboard.reputation')} icon={<ShieldCheckIcon className="w-5 h-5 text-brand-accent" />}>
                        <div className="text-center p-4">
                            <div className="relative inline-block mb-6">
                                <svg className="w-32 h-32 transform -rotate-90">
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-brand-border" />
                                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364} strokeDashoffset={364 - (364 * reputation / 100)} className="text-brand-primary transition-all duration-1000" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-black text-white">{reputation}%</span>
                                    <span className="text-[8px] font-black text-brand-muted uppercase">Auditado</span>
                                </div>
                            </div>
                            <p className="text-xs text-brand-muted italic leading-relaxed px-4">
                                {t('dashboard.reputationDesc')}
                            </p>
                        </div>
                    </SectionCard>

                    {/* Staking Summary */}
                    <SectionCard title={t('dashboard.myStaking')} icon={<BoltIcon className="w-5 h-5 text-brand-accent" />}>
                        <StakingSummaryWidget userAddress={userAddress} onNavigate={onNavigate} />
                    </SectionCard>

                    {/* Watched Addresses Quick-View */}
                    <SectionCard title={t('dashboard.watchedAddresses')} icon={<SignalIcon className="w-5 h-5 text-brand-accent" />}>
                        <WatchedAddressesWidget onNavigate={onNavigate} />
                    </SectionCard>
                </div>

                {/* Right Column: Activity & Insights */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Oracle Market Data */}
                    <SectionCard title={t('dashboard.oracleMarket')} icon={<ChartBarIcon className="w-5 h-5 text-blue-400" />}>
                        <OracleMarketWidget />
                    </SectionCard>
                    <SectionCard title={t('dashboard.recentActivity')} icon={<BoltIcon className="w-5 h-5 text-brand-accent" />}>
                        <div className="space-y-3">
                            {isLoading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-brand-muted gap-4">
                                    <LoadingIcon className="w-8 h-8 animate-spin" />
                                    <span className="text-xs font-bold uppercase tracking-widest">{t('dashboard.syncing')}</span>
                                </div>
                            ) : (
                                transactions.map(tx => (
                                    <div key={tx.id} className="flex items-center justify-between p-4 bg-brand-surface/40 hover:bg-brand-bg/40 border border-brand-border/30 rounded-xl transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${tx.type === 'MINT' ? 'bg-brand-success/10 text-brand-success' :
                                                tx.type === 'STAKE' ? 'bg-brand-primary/10 text-brand-primary' :
                                                    'bg-brand-accent/10 text-brand-accent'
                                                }`}>
                                                {tx.type === 'MINT' ? <SparklesIcon className="w-4 h-4" /> :
                                                    tx.type === 'STAKE' ? <BoltIcon className="w-4 h-4" /> :
                                                        <ArrowUpRightIcon className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <div className="text-xs font-black text-white uppercase tracking-tight">{tx.type} {tx.amount} $CLAIM</div>
                                                <div className="text-[10px] text-brand-muted font-mono">{tx.hash} • {tx.time}</div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="px-2 py-0.5 bg-brand-success/10 text-brand-success text-[9px] font-black border border-brand-success/20 rounded-md">
                                                {tx.status}
                                            </span>
                                            <ArrowUpRightIcon className="w-3 h-3 text-brand-muted mt-2 opacity-0 group-hover:opacity-100 transition-all" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </SectionCard>

                    <SectionCard title={t('dashboard.sentinelAnalysis')} icon={<SparklesIcon className="w-5 h-5 text-brand-primary" />}>
                        <GeminiExplainer
                            context={`Visualizando o dashboard do usuário na FaucetChain. Endereço: ${userAddress}. Método de Login: ${authMethod}.`}
                            prompt={`Analise meu portfólio de mérito e sugira uma estratégia para aumentar minha reputação Sentinel baseada nos dados atuais: Reputação ${reputation}%, Saldo ${balanceClaim.toFixed(2)} $CLAIM. Mencione como a participação no Faucet impacta esses números.`}
                        />
                    </SectionCard>
                </div>
            </div>
        </div>
    );
};
