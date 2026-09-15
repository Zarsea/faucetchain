import React, { useState, useEffect } from 'react';
import { XMarkIcon, SparklesIcon, SignalIcon, WalletIcon } from './IconComponents';
import { API_BASE_URL } from '../apiConfig';
import { useLanguage } from './LanguageContext';

interface TransactionDetailsModalProps {
    txHash: string | null;
    onClose?: () => void;
    inline?: boolean;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({ txHash, onClose, inline }) => {
    const { t, lang } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [txData, setTxData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!txHash) {
            setTxData(null);
            setError(null);
            return;
        }

        const fetchTx = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_BASE_URL}/api/tx/${txHash}`);
                if (!res.ok) {
                    if (res.status === 404) throw new Error(lang === 'en' ? "Transaction not found or still pending in the mempool." : "Transação não encontrada ou ainda pendente no mempool.");
                    throw new Error("Failed to fetch transaction data.");
                }
                const data = await res.json();
                setTxData(data);
            } catch (err: any) {
                setError(err.message || "Unknown error");
            } finally {
                setLoading(false);
            }
        };

        fetchTx();
    }, [txHash, lang]);

    if (!txHash) return null;

    const content = (
        <div className={`relative glass border border-brand-primary/30 ${inline ? 'rounded-2xl w-full mx-auto max-w-5xl' : 'rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl animate-slideUp'} flex flex-col`}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-primary to-brand-accent rounded-t-2xl"></div>
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-brand-border/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
                            <SignalIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white tracking-tight">
                                {lang === 'en' ? 'Transaction Overview' : 'Visão Geral da Transação'}
                            </h3>
                            <p className="text-xs text-brand-muted font-mono">{txHash.substring(0, 16)}...{txHash.slice(-8)}</p>
                        </div>
                    </div>
                    {onClose && !inline && (
                        <button 
                            onClick={onClose}
                            className="p-2 text-brand-muted hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-brand-muted text-sm font-bold uppercase tracking-widest animate-pulse">
                                {lang === 'en' ? 'Scanning Blockchain...' : 'Analisando Blockchain...'}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-brand-accent/10 border border-brand-accent/30 rounded-xl text-center">
                            <p className="text-brand-accent text-sm font-bold">{error}</p>
                        </div>
                    )}

                    {!loading && !error && txData && (
                        <>
                            {/* Main Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-brand-muted uppercase tracking-widest block mb-1">Status</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-brand-success animate-pulseGlow"></div>
                                        <span className="text-brand-success font-black text-sm">CONFIRMED</span>
                                    </div>
                                </div>
                                <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-brand-muted uppercase tracking-widest block mb-1">Block</span>
                                    <span className="text-white font-mono text-sm font-bold">#{txData.block_height}</span>
                                </div>
                                <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-brand-muted uppercase tracking-widest block mb-1">TX Type</span>
                                    <span className={`font-black text-sm uppercase tracking-wider ${txData.tx_type === 'CLAIM' ? 'text-brand-primary' : txData.tx_type === 'MINING_FEE' ? 'text-brand-accent' : 'text-brand-success'}`}>
                                        {txData.tx_type}
                                    </span>
                                </div>
                                <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                                    <span className="text-[9px] font-black text-brand-muted uppercase tracking-widest block mb-1">Source</span>
                                    <span className="text-white font-black text-sm uppercase tracking-wider">
                                        {txData.source_platform || 'WEB3'}
                                    </span>
                                </div>
                            </div>

                            {/* Value Transfer Details */}
                            <div className="p-5 border border-brand-primary/20 bg-brand-primary/5 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                                <div className="absolute right-0 top-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-3xl"></div>
                                <div className="flex-1 w-full relative z-10">
                                    <span className="text-[9px] font-black text-brand-muted uppercase tracking-widest block mb-2">From</span>
                                    <div className="flex items-center gap-2">
                                        <WalletIcon className="w-4 h-4 text-brand-muted" />
                                        <span className="font-mono text-xs text-brand-secondary break-all">
                                            {(txData.from_address?.startsWith('0x000') || txData.from_address?.startsWith('SYSTEM')) 
                                                ? 'FaucetChain System' 
                                                : txData.from_address}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center flex-shrink-0 relative z-10">
                                    <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest mb-1">Value</span>
                                    <span className="text-2xl font-black text-white font-mono">
                                        {txData.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                    </span>
                                    <span className="text-[10px] text-brand-primary font-bold">$CLAIM</span>
                                </div>
                                <div className="flex-1 w-full text-right relative z-10">
                                    <span className="text-[9px] font-black text-brand-muted uppercase tracking-widest block mb-2">To</span>
                                    <div className="flex items-center justify-end gap-2">
                                        <span className="font-mono text-xs text-brand-secondary break-all">
                                            {txData.to_address}
                                        </span>
                                        <WalletIcon className="w-4 h-4 text-brand-muted" />
                                    </div>
                                </div>
                            </div>

                            {/* Technical Details */}
                            <div className="space-y-3 pt-4 border-t border-brand-border/20">
                                <h4 className="text-[11px] font-black text-brand-secondary uppercase tracking-widest flex items-center gap-2">
                                    <SparklesIcon className="w-3 h-3 text-brand-primary" />
                                    {lang === 'en' ? 'Consensus Engine Data' : 'Dados do Motor de Consenso'}
                                </h4>
                                <div className="bg-black/30 rounded-lg border border-brand-border/30 divide-y divide-brand-border/20">
                                    <div className="p-3 flex items-center justify-between">
                                        <span className="text-xs text-brand-muted">Block Hash</span>
                                        <span className="font-mono text-[10px] text-brand-secondary">{txData.block_hash || 'N/A'}</span>
                                    </div>
                                    <div className="p-3 flex items-center justify-between">
                                        <span className="text-xs text-brand-muted">Validated By</span>
                                        <span className="font-mono text-[10px] text-brand-secondary">{txData.validator || 'Genesis Node'}</span>
                                    </div>
                                    <div className="p-3 flex items-center justify-between">
                                        <span className="text-xs text-brand-muted">Timestamp</span>
                                        <span className="font-mono text-xs text-white font-bold">
                                            {txData.timestamp ? new Date(txData.timestamp * 1000).toLocaleString() : 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="p-3 flex items-center justify-between">
                                        <span className="text-xs text-brand-muted">Gas Fee</span>
                                        <span className="font-mono text-[10px] text-brand-success">0.00 (Network Subsidized)</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
    );

    if (inline) {
        return content;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-brand-bg/80 backdrop-blur-md transition-opacity" onClick={onClose}></div>
            {content}
        </div>
    );
};
