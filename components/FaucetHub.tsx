import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../apiConfig';
import { useAuth } from './AuthContext';
import { signAction } from '../utils/actionSignature';import { withdrawMessage } from '../utils/actionMessage';


interface FaucetHubProps {
    onBack: () => void;
}

interface FaucetData {
    name: string;
    wallet_address: string;
    liquidity: number;
    status: string;
    recent_txs: number;
    settlements: number;
    volume_settled: number;
    registered_at: number;
}

interface ApiKeyInfo {
    api_key: string;
    created_at: number;
    is_active: boolean;
    last_used: number | null;
    total_requests: number;
    total_settled: number;
}

interface L2Stats {
    total_users: number;
    total_virtual_balance: number;
    total_claimed_all_time: number;
    total_withdrawn_all_time: number;
    total_claims_count: number;
}

interface L2UserBalance {
    faucet_wallet: string;
    faucet_name: string;
    virtual_balance: number;
    total_claimed: number;
    total_withdrawn: number;
    claim_count: number;
    can_withdraw: boolean;
    min_withdraw: number;
}

interface L2BalanceResponse {
    user: string;
    total_pending: number;
    faucets: L2UserBalance[];
}

export const FaucetHub: React.FC<FaucetHubProps> = ({ onBack }) => {
    const { authMethod } = useAuth();
    const [faucets, setFaucets] = useState<FaucetData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRegister, setShowRegister] = useState(false);
    const [newName, setNewName] = useState("");
    const [newWallet, setNewWallet] = useState("");
    const [registerError, setRegisterError] = useState("");
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [selectedFaucet, setSelectedFaucet] = useState<string | null>(null);
    const [keyInfo, setKeyInfo] = useState<ApiKeyInfo | null>(null);
    const [keyLoading, setKeyLoading] = useState(false);
    const [keyCopied, setKeyCopied] = useState(false);
    
    // L2 Ledger state
    const [l2Stats, setL2Stats] = useState<L2Stats | null>(null);
    const [l2LookupWallet, setL2LookupWallet] = useState("");
    const [l2Balances, setL2Balances] = useState<L2BalanceResponse | null>(null);
    const [l2Loading, setL2Loading] = useState(false);
    const [l2WithdrawStatus, setL2WithdrawStatus] = useState<string | null>(null);

    // Leaderboard & Activity Links state
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [activityLinks, setActivityLinks] = useState<any[]>([]);

    const fetchFaucets = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/faucets`);
            if (res.ok) {
                const data = await res.json();
                setFaucets(data);
            }
        } catch (e) {
            console.error("Failed to fetch faucets", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchL2Stats = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/stats`);
            if (res.ok) setL2Stats(await res.json());
        } catch (e) { console.error("Failed to fetch L2 stats", e); }
    };

    const fetchLeaderboard = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/leaderboard`);
            if (res.ok) {
                const data = await res.json();
                setLeaderboard(data || []);
            }
        } catch (e) { console.error("Failed to fetch leaderboard", e); }
    };

    const fetchActivityLinks = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/activity-links`);
            if (res.ok) {
                const data = await res.json();
                setActivityLinks(data || []);
            }
        } catch (e) { console.error("Failed to fetch activity links", e); }
    };

    useEffect(() => {
        fetchFaucets();
        fetchL2Stats();
        fetchLeaderboard();
        fetchActivityLinks();
        const interval = setInterval(() => { 
            fetchFaucets(); 
            fetchL2Stats(); 
            fetchLeaderboard();
            fetchActivityLinks();
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    const lookupL2Balance = async () => {
        if (!l2LookupWallet.trim()) return;
        setL2Loading(true);
        setL2Balances(null);
        setL2WithdrawStatus(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/balance/${l2LookupWallet.trim()}`);
            if (res.ok) setL2Balances(await res.json());
            else { const err = await res.json(); setL2WithdrawStatus(err.detail || "Erro"); }
        } catch (e) { console.error(e); }
        finally { setL2Loading(false); }
    };

    const handleL2Withdraw = async (faucetWallet: string) => {
        setL2WithdrawStatus(null);
        try {
            // O saque exige a assinatura do dono da carteira consultada.
            const user = l2LookupWallet.trim().toLowerCase();
            const faucet = faucetWallet.trim().toLowerCase();
            const sig = await signAction(authMethod, (ts) =>
                withdrawMessage(user, faucet, ts));
            const res = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/withdraw`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_wallet: user, faucet_wallet: faucet, ...sig })
            });
            const data = await res.json();
            if (res.ok) {
                setL2WithdrawStatus(`✅ Saque L1 realizado! Tx: ${data.tx_hash.slice(0, 18)}...`);
                lookupL2Balance(); // Refresh
                fetchFaucets();
                fetchL2Stats();
                fetchLeaderboard();
                fetchActivityLinks();
            } else {
                setL2WithdrawStatus(`❌ ${data.detail}`);
            }
        } catch (e: any) { setL2WithdrawStatus(`❌ ${e.message}`); }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegisterError("");
        setGeneratedKey(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName, wallet_address: newWallet })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Erro ao registrar");
            
            setGeneratedKey(data.api_key);
            fetchFaucets();
        } catch (e: any) {
            setRegisterError(e.message);
        }
    };

    const fetchKeyInfo = async (wallet: string) => {
        setKeyLoading(true);
        setKeyInfo(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/my-key/${wallet}`);
            if (res.ok) {
                const data = await res.json();
                setKeyInfo(data);
            }
        } catch (e) {
            console.error("Failed to fetch key info", e);
        } finally {
            setKeyLoading(false);
        }
    };

    const handleRegenerateKey = async (wallet: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/regenerate-key`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet_address: wallet })
            });
            const data = await res.json();
            if (res.ok) {
                setKeyInfo(prev => prev ? { ...prev, api_key: data.api_key } : null);
            }
        } catch (e) {
            console.error("Failed to regenerate key", e);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setKeyCopied(true);
        setTimeout(() => setKeyCopied(false), 2000);
    };

    const totalLiquidity = faucets.reduce((acc, f) => acc + f.liquidity, 0);
    const activeCount = faucets.filter(f => f.status === "Ativa").length;
    const totalSettlements = faucets.reduce((acc, f) => acc + f.settlements, 0);

    // SVG rendering helpers for interactive map
    const renderFaucetNodes = () => {
        const uniqueFaucets = Array.from(new Set(activityLinks.map(l => l.faucet_wallet.toLowerCase())));
        if (uniqueFaucets.length === 0) {
            uniqueFaucets.push("0x84da71247cbfb0737a9112de1f10dae9823fc298");
        }
        
        return uniqueFaucets.slice(0, 4).map((wallet, idx, arr) => {
            const y = arr.length <= 1 ? 150 : 50 + idx * (200 / (arr.length - 1));
            const x = 70;
            const faucetInfo = faucets.find(f => f.wallet_address.toLowerCase() === wallet) || { name: "Faucet L2" };
            const isSelected = selectedFaucet?.toLowerCase() === wallet;

            return (
                <g key={`faucet-${wallet}`} className="cursor-pointer" onClick={() => setSelectedFaucet(wallet)}>
                    <circle 
                        cx={x} cy={y} r="16" 
                        fill="#1b0c3a" 
                        stroke={isSelected ? "#c084fc" : "#7c3aed"} 
                        strokeWidth={isSelected ? "3" : "2"}
                        filter="url(#glow-purple)"
                    />
                    <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fill="#fff">💧</text>
                    <text x={x - 12} y={y - 20} fontSize="8" fontWeight="bold" fill="#c0a9e3" textAnchor="start">
                        {faucetInfo.name}
                    </text>
                </g>
            );
        });
    };

    const renderUserNodes = () => {
        const uniqueUsers: string[] = Array.from(new Set(activityLinks.map((l: any) => String(l?.user_wallet || "").toLowerCase())));
        if (uniqueUsers.length === 0) {
            return (
                <g key="no-user">
                    <circle cx="430" cy="150" r="12" fill="#0c0418" stroke="#3b82f6" strokeWidth="1.5" />
                    <text x="430" y="153" textAnchor="middle" fontSize="10" fill="#fff">👤</text>
                    <text x="360" y="153" fontSize="8" fill="#93c5fd" textAnchor="start">Aguardando claims...</text>
                </g>
            );
        }

        return uniqueUsers.slice(0, 4).map((wallet, idx, arr) => {
            const y = arr.length <= 1 ? 150 : 50 + idx * (200 / (arr.length - 1));
            const x = 430;

            return (
                <g key={`user-${wallet}`}>
                    <circle 
                        cx={x} cy={y} r="12" 
                        fill="#0c0418" 
                        stroke="#3b82f6" 
                        strokeWidth="1.5"
                    />
                    <text x={x} y={y + 3} textAnchor="middle" fontSize="10" fill="#fff">👤</text>
                    <text x={x - 75} y={y + 3} fontSize="8" fontFamily="monospace" fill="#93c5fd" textAnchor="start">
                        {String(wallet).slice(0, 6)}...{String(wallet).slice(-4)}
                    </text>
                </g>
            );
        });
    };

    const renderActivityPaths = () => {
        const uniqueFaucets = Array.from(new Set(activityLinks.map(l => l.faucet_wallet.toLowerCase())));
        if (uniqueFaucets.length === 0) uniqueFaucets.push("0x84da71247cbfb0737a9112de1f10dae9823fc298");
        const uniqueUsers = Array.from(new Set(activityLinks.map(l => l.user_wallet.toLowerCase())));

        return activityLinks.slice(0, 6).map((link, idx) => {
            const fIdx = uniqueFaucets.slice(0, 4).indexOf(link.faucet_wallet.toLowerCase());
            const uIdx = uniqueUsers.slice(0, 4).indexOf(link.user_wallet.toLowerCase());

            if (fIdx === -1 || uIdx === -1) return null;

            const fy = uniqueFaucets.slice(0, 4).length <= 1 ? 150 : 50 + fIdx * (200 / (uniqueFaucets.slice(0, 4).length - 1));
            const fx = 70;

            const uy = uniqueUsers.slice(0, 4).length <= 1 ? 150 : 50 + uIdx * (200 / (uniqueUsers.slice(0, 4).length - 1));
            const ux = 430;

            const d = `M ${fx} ${fy} C ${(fx + ux) / 2} ${fy}, ${(fx + ux) / 2} ${uy}, ${ux} ${uy}`;

            return (
                <g key={`path-${idx}`}>
                    <path 
                        d={d} 
                        fill="none" 
                        stroke="url(#glowGrad)" 
                        strokeWidth="1.5" 
                        strokeOpacity="0.4"
                    />
                    <circle r="3" fill="#fb7185">
                        <animateMotion dur={`${2 + idx * 0.5}s`} repeatCount="indefinite" path={d} />
                    </circle>
                </g>
            );
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#02000A] text-purple-100 flex flex-col font-sans overflow-hidden animate-slideUpFadeIn">
            {/* --- Dynamic OS Background --- */}
            <div className="absolute inset-0 z-0 opacity-60 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-900/20 rounded-full blur-[120px] animate-[pulse_8s_infinite]"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-purple-900/20 rounded-full blur-[150px] animate-[pulse_12s_infinite_reverse]"></div>
                
                {/* Cyber Grid Pattern */}
                <div 
                    className="absolute inset-0 opacity-[0.03]" 
                    style={{
                        backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
                        backgroundSize: '40px 40px'
                    }}
                ></div>
            </div>

            {/* --- Terminal OS Header --- */}
            <div className="relative z-30 h-16 bg-black/40 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between px-8 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-indigo-900/50 border border-indigo-400 rounded-lg flex items-center justify-center text-xl shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                        🌐
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-indigo-300 tracking-widest uppercase">FaucetHub Core</h1>
                        <p className="text-[10px] text-indigo-500 uppercase tracking-widest">L1 Infrastructure • Proof of Reserve</p>
                    </div>
                </div>
                <button 
                    onClick={onBack}
                    className="px-4 py-2 bg-black border border-indigo-500/50 text-indigo-300 rounded hover:bg-indigo-900/30 hover:border-indigo-400 transition-all font-bold text-xs tracking-widest uppercase flex items-center space-x-2"
                >
                    <span>&larr; Exit</span>
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar relative z-10">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                        <div className="bg-black/30 border border-white/10 backdrop-blur-2xl rounded-2xl p-5 shadow-[0_0_30px_rgba(99,102,241,0.05)]">
                            <h3 className="text-purple-400 text-xs font-semibold mb-1">Faucets Conectadas</h3>
                            <p className="text-3xl font-black text-purple-100 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                                {loading ? "..." : faucets.length}
                            </p>
                            <p className="text-purple-400 text-xs mt-1">{activeCount} ativas</p>
                        </div>
                        <div className="bg-black/30 border border-white/10 backdrop-blur-2xl rounded-2xl p-5 shadow-[0_0_30px_rgba(99,102,241,0.05)]">
                            <h3 className="text-purple-400 text-xs font-semibold mb-1">Proof of Reserve (PoR)</h3>
                            <p className="text-3xl font-black text-purple-100 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                                {loading ? "..." : totalLiquidity.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </p>
                            <p className="text-purple-400 text-xs mt-1">$CLAIM em reservas</p>
                        </div>
                        <div className="bg-black/30 border border-white/10 backdrop-blur-2xl rounded-2xl p-5 shadow-[0_0_30px_rgba(99,102,241,0.05)]">
                            <h3 className="text-purple-400 text-xs font-semibold mb-1">Settlements (L1)</h3>
                            <p className="text-3xl font-black text-purple-100 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                                {loading ? "..." : totalSettlements}
                            </p>
                            <p className="text-purple-400 text-xs mt-1">Liquidações na chain</p>
                        </div>
                        <div className="bg-black/30 border border-white/10 backdrop-blur-2xl rounded-2xl p-5 shadow-[0_0_30px_rgba(99,102,241,0.05)]">
                            <h3 className="text-purple-400 text-xs font-semibold mb-1">API Keys Ativas</h3>
                            <p className="text-3xl font-black text-purple-100 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                                {loading ? "..." : faucets.length}
                            </p>
                            <p className="text-purple-400 text-xs mt-1">Integrações conectadas</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Monitoramento de Torneiras */}
                        <div className="bg-black/40 border border-white/10 backdrop-blur-2xl rounded-2xl p-6 shadow-[0_0_30px_rgba(99,102,241,0.05)] flex flex-col min-h-[480px]">
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-xl font-bold text-purple-200 flex items-center">
                                    <span className="mr-2 text-lg">🌐</span> Monitoramento Web3
                                </h2>
                                <button 
                                    onClick={() => { setShowRegister(!showRegister); setGeneratedKey(null); }}
                                    className="px-4 py-1.5 text-xs bg-purple-600/30 border border-purple-500/50 rounded-lg hover:bg-purple-500/40 transition-colors"
                                >
                                    {showRegister ? "Ocultar" : "+ Registrar Nova"}
                                </button>
                            </div>
                            
                            {showRegister && (
                                <div className="mb-5 bg-purple-900/40 p-5 rounded-xl border border-purple-500/50">
                                    {!generatedKey ? (
                                        <form onSubmit={handleRegister}>
                                            <h3 className="font-semibold text-purple-200 mb-3 text-sm">Registrar Torneira (DApp)</h3>
                                            <div className="space-y-3">
                                                <input 
                                                    type="text" placeholder="Nome da Faucet" value={newName}
                                                    onChange={e => setNewName(e.target.value)}
                                                    className="w-full bg-purple-950 border border-purple-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                                                    required
                                                />
                                                <input 
                                                    type="text" placeholder="Endereço da Carteira (0x...)" value={newWallet}
                                                    onChange={e => setNewWallet(e.target.value)}
                                                    className="w-full bg-purple-950 border border-purple-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                                                    required
                                                />
                                                {registerError && <p className="text-red-400 text-xs">{registerError}</p>}
                                                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 rounded-lg text-sm transition-colors">
                                                    Vincular ao FaucetHub
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <span className="text-green-400 text-lg">✅</span>
                                                <h3 className="font-bold text-green-300 text-sm">Faucet Registrada com Sucesso!</h3>
                                            </div>
                                            <p className="text-purple-300 text-xs">Sua API Key foi gerada. Guarde-a em local seguro — ela não será exibida novamente.</p>
                                            <div className="bg-black/40 rounded-lg p-3 border border-purple-500/30 flex items-center justify-between">
                                                <code className="text-green-400 text-xs font-mono break-all flex-1 mr-2">{generatedKey}</code>
                                                <button 
                                                    onClick={() => copyToClipboard(generatedKey)}
                                                    className="px-3 py-1 bg-purple-600/40 border border-purple-500/50 rounded text-xs hover:bg-purple-500/40 transition-colors flex-shrink-0"
                                                >
                                                    {keyCopied ? "✓ Copiada!" : "Copiar"}
                                                </button>
                                            </div>
                                            <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/20 text-xs text-purple-300 space-y-1">
                                                <p className="font-semibold text-purple-200">Como integrar:</p>
                                                <code className="block bg-black/30 p-2 rounded text-green-400/90 font-mono text-[11px]">
                                                    POST /api/faucethub/settle<br/>
                                                    Header: X-Api-Key: {generatedKey.slice(0, 20)}...<br/>
                                                    Body: {`{"user_wallet": "0x...", "amount": 10.0}`}
                                                </code>
                                            </div>
                                            <button 
                                                onClick={() => { setShowRegister(false); setGeneratedKey(null); setNewName(""); setNewWallet(""); }}
                                                className="w-full bg-purple-800/40 hover:bg-purple-700/40 text-purple-200 py-2 rounded-lg text-sm transition-colors border border-purple-500/30"
                                            >
                                                Fechar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                                {loading && !faucets.length && <p className="text-purple-400/80 text-sm text-center py-8">Lendo atividade espiritual da rede...</p>}
                                {!loading && faucets.length === 0 && (
                                    <p className="text-purple-400/80 text-sm text-center py-8">Nenhuma Faucet registrada ainda.</p>
                                )}
                                {faucets.map((faucet, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => { setSelectedFaucet(faucet.wallet_address); fetchKeyInfo(faucet.wallet_address); }}
                                        className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                                            selectedFaucet === faucet.wallet_address 
                                                ? 'bg-purple-800/40 border-purple-400/60 shadow-[0_0_10px_rgba(168,85,247,0.3)]' 
                                                : 'bg-purple-900/30 border-purple-500/10 hover:border-purple-500/40'
                                        }`}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-lg bg-purple-800/50 flex items-center justify-center border border-purple-500/30 text-lg">
                                                💧
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-purple-100 text-sm">{faucet.name}</h4>
                                                <span className={`text-xs font-semibold ${faucet.status === 'Ativa' ? 'text-green-400' : 'text-yellow-400'}`}>
                                                    • {faucet.status}
                                                </span>
                                                <span className="text-purple-500 text-xs ml-2">{faucet.settlements} settlements</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-purple-200 font-bold text-sm">{faucet.liquidity.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} CLAIM</p>
                                            <p className="text-purple-400/80 text-xs">{faucet.recent_txs} Txs/hr</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Panel: API Key Management + PoR */}
                        <div className="space-y-6">
                            {/* API Key Management Panel */}
                            <div className="bg-black/40 border border-white/10 backdrop-blur-2xl rounded-2xl p-6 shadow-[0_0_30px_rgba(99,102,241,0.05)]">
                                <h2 className="text-xl font-bold text-purple-200 mb-4 flex items-center">
                                    <span className="mr-2 text-lg">🔑</span> API Key Management
                                </h2>

                                {!selectedFaucet && (
                                    <div className="text-center py-8">
                                        <p className="text-purple-400/60 text-sm">Selecione uma Faucet à esquerda para gerenciar sua API Key</p>
                                    </div>
                                )}

                                {selectedFaucet && keyLoading && (
                                    <div className="text-center py-8">
                                        <p className="text-purple-400 text-sm animate-pulse">Carregando...</p>
                                    </div>
                                )}

                                {selectedFaucet && !keyLoading && keyInfo && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-purple-400 text-xs font-semibold">Chave Ativa</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${keyInfo.is_active ? 'bg-green-900/50 text-green-400 border border-green-500/30' : 'bg-red-900/50 text-red-400 border border-red-500/30'}`}>
                                                {keyInfo.is_active ? "ATIVA" : "INATIVA"}
                                            </span>
                                        </div>
                                        
                                        <div className="bg-black/40 rounded-lg p-3 border border-purple-500/20 flex items-center justify-between">
                                            <code className="text-green-400/90 text-[11px] font-mono break-all flex-1 mr-2">
                                                {keyInfo.api_key.slice(0, 12)}{"•".repeat(20)}{keyInfo.api_key.slice(-8)}
                                            </code>
                                            <button 
                                                onClick={() => copyToClipboard(keyInfo.api_key)}
                                                className="px-2 py-1 bg-purple-600/30 border border-purple-500/40 rounded text-[10px] hover:bg-purple-500/30 transition-colors flex-shrink-0"
                                            >
                                                {keyCopied ? "✓" : "Copiar"}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/10">
                                                <p className="text-purple-400 text-[10px] font-semibold">REQUESTS</p>
                                                <p className="text-xl font-black text-purple-100">{keyInfo.total_requests}</p>
                                            </div>
                                            <div className="bg-purple-900/30 rounded-lg p-3 border border-purple-500/10">
                                                <p className="text-purple-400 text-[10px] font-semibold">VOLUME SETTLED</p>
                                                <p className="text-xl font-black text-purple-100">{keyInfo.total_settled.toLocaleString()} <span className="text-xs font-normal text-purple-400">CLAIM</span></p>
                                            </div>
                                        </div>

                                        {keyInfo.last_used && (
                                            <p className="text-purple-500 text-[10px]">
                                                Último uso: {new Date(keyInfo.last_used * 1000).toLocaleString()}
                                            </p>
                                        )}

                                        <button 
                                            onClick={() => handleRegenerateKey(selectedFaucet)}
                                            className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold transition-colors"
                                        >
                                            ⟳ Rotacionar Chave (Desativa a Anterior)
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Proof of Reserve */}
                            <div className="bg-black/40 border border-white/10 backdrop-blur-2xl rounded-2xl p-6 shadow-[0_0_30px_rgba(99,102,241,0.05)]">
                                <h2 className="text-xl font-bold text-purple-200 mb-4 flex items-center">
                                    <span className="mr-2 text-lg">🔒</span> Proof of Reserve (PoR)
                                </h2>

                                <div className="relative h-48 w-full bg-purple-900/20 rounded-xl border border-purple-500/20 flex flex-col items-center justify-center overflow-hidden">
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-800/40 via-transparent to-transparent"></div>
                                    
                                    <div className="w-24 h-24 rounded-full border-[3px] border-purple-500/50 border-t-purple-400 border-b-purple-400 animate-spin-slow flex items-center justify-center relative z-10 shadow-[0_0_25px_rgba(168,85,247,0.4)]">
                                        <div className="w-[72px] h-[72px] rounded-full border border-purple-300/30 bg-purple-900/80 flex items-center justify-center backdrop-blur-sm animate-none">
                                            <span className="text-2xl font-bold text-purple-200">{loading ? "..." : "100%"}</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 text-center relative z-10">
                                        <p className="text-purple-200 font-bold tracking-widest uppercase text-xs">Auditoria Criptográfica</p>
                                        <p className="text-purple-400 text-[10px] mt-1">Todas as reservas verificadas on-chain</p>
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={() => fetchFaucets()}
                                    className="w-full mt-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 text-purple-200 rounded-xl font-bold text-sm transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                                >
                                    Forçar Auditoria Global
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* L2 Micro-Claims Ledger */}
                    <div className="bg-black/40 border border-white/10 backdrop-blur-2xl rounded-2xl p-6 shadow-[0_0_30px_rgba(99,102,241,0.05)]">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-bold text-purple-200 flex items-center">
                                <span className="mr-2 text-lg">⚡</span> Ledger L2 — Micro-Claims Off-Chain
                            </h2>
                            <span className="px-3 py-1 bg-purple-600/20 border border-purple-500/30 rounded-full text-[10px] font-bold text-purple-300 tracking-wider">LAYER 2</span>
                        </div>

                        {/* L2 Global Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                            <div className="bg-purple-900/30 rounded-xl p-3 border border-purple-500/10 text-center">
                                <p className="text-purple-400 text-[10px] font-semibold">USUÁRIOS L2</p>
                                <p className="text-lg font-black text-purple-100">{l2Stats?.total_users ?? "..."}</p>
                            </div>
                            <div className="bg-purple-900/30 rounded-xl p-3 border border-purple-500/10 text-center">
                                <p className="text-purple-400 text-[10px] font-semibold">SALDO VIRTUAL</p>
                                <p className="text-lg font-black text-purple-100">{l2Stats?.total_virtual_balance?.toLocaleString() ?? "..."}</p>
                            </div>
                            <div className="bg-purple-900/30 rounded-xl p-3 border border-purple-500/10 text-center">
                                <p className="text-purple-400 text-[10px] font-semibold">CLAIMS TOTAIS</p>
                                <p className="text-lg font-black text-purple-100">{l2Stats?.total_claims_count?.toLocaleString() ?? "..."}</p>
                            </div>
                            <div className="bg-purple-900/30 rounded-xl p-3 border border-purple-500/10 text-center">
                                <p className="text-purple-400 text-[10px] font-semibold">DISTRIBUÍDO L2</p>
                                <p className="text-lg font-black text-purple-100">{l2Stats?.total_claimed_all_time?.toLocaleString() ?? "..."}</p>
                            </div>
                            <div className="bg-purple-900/30 rounded-xl p-3 border border-purple-500/10 text-center">
                                <p className="text-purple-400 text-[10px] font-semibold">SACADO → L1</p>
                                <p className="text-lg font-black text-green-400">{l2Stats?.total_withdrawn_all_time?.toLocaleString() ?? "..."}</p>
                            </div>
                        </div>

                        {/* User Lookup */}
                        <div className="bg-purple-900/30 rounded-xl p-5 border border-purple-500/20">
                            <h3 className="text-sm font-semibold text-purple-200 mb-3">🔍 Consultar Saldo Virtual do Usuário</h3>
                            <div className="flex gap-3">
                                <input 
                                    type="text" 
                                    placeholder="Endereço da Carteira do Usuário (0x...)" 
                                    value={l2LookupWallet}
                                    onChange={e => setL2LookupWallet(e.target.value)}
                                    className="flex-1 bg-purple-950 border border-purple-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                                />
                                <button 
                                    onClick={lookupL2Balance}
                                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-sm transition-colors"
                                >
                                    Consultar
                                </button>
                            </div>

                            {l2Loading && <p className="text-purple-400 text-sm mt-4 animate-pulse">Consultando ledger...</p>}

                            {l2WithdrawStatus && (
                                <p className={`text-sm mt-3 ${l2WithdrawStatus.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                                    {l2WithdrawStatus}
                                </p>
                            )}

                            {l2Balances && !l2Loading && (
                                <div className="mt-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-purple-300 text-xs">Usuário: <code className="text-purple-100 font-mono">{l2Balances.user.slice(0, 10)}...{l2Balances.user.slice(-6)}</code></p>
                                        <p className="text-purple-200 font-bold text-sm">Total Pendente: {l2Balances.total_pending.toLocaleString()} CLAIM</p>
                                    </div>

                                    {l2Balances.faucets.length === 0 && (
                                        <p className="text-purple-500 text-sm text-center py-4">Nenhum saldo virtual pendente para este endereço.</p>
                                    )}

                                    {l2Balances.faucets.map((entry, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-purple-800/20 rounded-xl border border-purple-500/20">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-9 h-9 rounded-lg bg-purple-700/40 flex items-center justify-center border border-purple-500/30 text-base">💧</div>
                                                <div>
                                                    <h4 className="font-bold text-purple-100 text-sm">{entry.faucet_name}</h4>
                                                    <p className="text-purple-500 text-[10px]">{entry.claim_count} claims | Sacado: {entry.total_withdrawn.toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <div className="text-right">
                                                    <p className="text-purple-100 font-bold text-sm">{entry.virtual_balance.toLocaleString()} CLAIM</p>
                                                    <p className="text-purple-500 text-[10px]">Min: {entry.min_withdraw}</p>
                                                </div>
                                                <button 
                                                    onClick={() => handleL2Withdraw(entry.faucet_wallet)}
                                                    disabled={!entry.can_withdraw}
                                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                                        entry.can_withdraw 
                                                            ? 'bg-green-600/30 border border-green-500/50 text-green-300 hover:bg-green-500/40' 
                                                            : 'bg-purple-900/30 border border-purple-500/10 text-purple-500 cursor-not-allowed'
                                                    }`}
                                                >
                                                    {entry.can_withdraw ? "Sacar → L1" : "Abaixo do mín."}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* New Dynamic Infrastructure & Loyalty Section */}
                    <div className="bg-black/40 border border-white/10 backdrop-blur-2xl rounded-2xl p-6 shadow-[0_0_30px_rgba(99,102,241,0.05)]">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-purple-200 flex items-center">
                                    <span className="mr-2 text-lg">🛰️</span> Monitor de Fidelidade & Tráfego L2
                                </h2>
                                <p className="text-xs text-purple-400 mt-1">Conexões físicas da rede e rank de fidelidade dos usuários</p>
                            </div>
                            <button 
                                onClick={() => { fetchLeaderboard(); fetchActivityLinks(); }}
                                className="px-4 py-1.5 text-xs bg-purple-600/20 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors"
                            >
                                ⟳ Atualizar Mapa
                            </button>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            {/* Leaderboard / Competividade */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-purple-300 flex items-center">
                                    <span className="mr-2">🏆</span> Ranking de Acumuladores L2
                                </h3>
                                <div className="overflow-x-auto custom-scrollbar border border-purple-500/20 rounded-xl bg-purple-900/10">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-purple-950/40 text-purple-400 font-bold uppercase">
                                            <tr>
                                                <th className="px-4 py-3">Rank</th>
                                                <th className="px-4 py-3">Usuário</th>
                                                <th className="px-4 py-3">Faucet Principal</th>
                                                <th className="px-4 py-3 text-right">Claims</th>
                                                <th className="px-4 py-3 text-right">Total Farmado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-purple-500/10">
                                            {leaderboard.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-8 text-center text-purple-500 italic">
                                                        Nenhum usuário registrado no ledger.
                                                    </td>
                                                </tr>
                                            ) : (
                                                leaderboard.map((user, idx) => {
                                                    const isTop = idx < 3;
                                                    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`;
                                                    const tier = user.claim_count >= 10 
                                                        ? { label: "Lord", style: "bg-purple-900/50 text-purple-300 border-purple-500/40" }
                                                        : user.claim_count >= 5 
                                                        ? { label: "Elite", style: "bg-blue-900/50 text-blue-300 border-blue-500/40" }
                                                        : { label: "Farmer", style: "bg-purple-950/40 text-purple-400 border-purple-500/10" };

                                                    return (
                                                        <tr key={idx} className="hover:bg-purple-950/30 transition-colors">
                                                            <td className="px-4 py-3 font-bold text-purple-300">
                                                                <span className="mr-1">{medal}</span>
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-purple-200">
                                                                {user.user_wallet.slice(0, 8)}...{user.user_wallet.slice(-4)}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <button
                                                                    onClick={() => setSelectedFaucet(user.faucet_wallet)}
                                                                    className="text-purple-400 hover:text-purple-300 hover:underline font-semibold text-left"
                                                                    title="Clique para destacar no monitor"
                                                                >
                                                                    {user.faucet_name || "Faucet Desconhecida"}
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-purple-300">
                                                                {user.claim_count}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="font-bold text-purple-100">{user.total_claimed.toFixed(2)} CLAIM</span>
                                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border mt-0.5 ${tier.style}`}>
                                                                        {tier.label}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* SVG Interactive Traffic Map */}
                            <div className="space-y-4 flex flex-col">
                                <h3 className="text-sm font-bold text-purple-300 flex items-center">
                                    <span className="mr-2">🗺️</span> Mapa de Tráfego e Conexões L2 &rarr; L1
                                </h3>
                                <div className="flex-1 min-h-[300px] border border-purple-500/20 rounded-xl bg-black/40 relative overflow-hidden flex items-center justify-center p-4 shadow-inner">
                                    {/* SVG Canvas */}
                                    <svg className="w-full h-full min-h-[280px]" viewBox="0 0 500 300">
                                        <defs>
                                            <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" stopColor="#c084fc" stopOpacity="0.8" />
                                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
                                            </linearGradient>
                                            <filter id="glow-purple" x="-30%" y="-30%" width="160%" height="160%">
                                                <feGaussianBlur stdDeviation="4" result="blur" />
                                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                            </filter>
                                        </defs>

                                        {/* Render active link paths first (below nodes) */}
                                        {renderActivityPaths()}

                                        {/* Render Left Side: Faucets */}
                                        {renderFaucetNodes()}

                                        {/* Render Right Side: Recent Users */}
                                        {renderUserNodes()}
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
