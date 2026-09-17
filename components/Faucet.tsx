
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { SectionCard } from './SectionCard';
import { WalletIcon, LoadingIcon, CheckCircleIcon, InformationCircleIcon, CubeIcon, BoltIcon, SignalIcon, SparklesIcon } from './IconComponents';
import { useLanguage } from './LanguageContext';
import { useNetwork } from './NetworkContext';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../apiConfig';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import { solvePocChallenge } from '../utils/poc';import { claimMessage as buildClaimMessage } from '../utils/actionMessage';


interface ClaimHistory {
    blockHeight: number;
    amount: number;
    timestamp: number;
    txHash: string;
}

export const Faucet: React.FC = () => {
    const { t, lang } = useLanguage();
    const { metrics, addBlockManually } = useNetwork();
    const { isConnected, userAddress, authMethod } = useAuth();

    const [userBalance, setUserBalance] = useState(0);
    const [isHubActive, setIsHubActive] = useState(false);
    const [claims, setClaims] = useState<ClaimHistory[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [pocStatus, setPocStatus] = useState<string | null>(null);
    const [epochActive, setEpochActive] = useState(true);

    // Fetch real balance from API
    const fetchBalance = async () => {
        if (!userAddress) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/${userAddress}/balance`);
            if (res.ok) {
                const data = await res.json();
                setUserBalance(data.total_claim);
            }
        } catch (e) {
            console.warn('Balance API unreachable');
        }
    };

    useEffect(() => {
        if (isConnected && userAddress) fetchBalance();
    }, [isConnected, userAddress]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/epoch/status`)
            .then(res => res.json())
            .then(data => setEpochActive(data.isActive))
            .catch(() => setEpochActive(true));
    }, []);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [pendingTxHash, setPendingTxHash] = useState('');
    const [selectedTxHash, setSelectedTxHash] = useState<string | null>(null);

    const fetchClaims = async () => {
        if (!userAddress) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/${userAddress}/claims`);
            if (res.ok) {
                const data = await res.json();
                setClaims(data.map((c: any) => ({
                    blockHeight: c.block_height,
                    amount: c.amount,
                    timestamp: c.timestamp * 1000,
                    txHash: c.tx_hash
                })));
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (isConnected && userAddress) {
            fetchClaims();
        }
    }, [userAddress, isConnected]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPending && pendingTxHash) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`${API_BASE_URL}/api/claim/status/${pendingTxHash}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.status === 'confirmed') {
                            setIsPending(false);
                            setIsSuccess(true);
                            fetchClaims();
                            fetchBalance();  // Refresh real balance from API
                            clearInterval(interval);
                        }
                    }
                } catch (e) {
                    console.error("Error checking claim status", e);
                }
            }, 2000); // Check every 2s
        }
        return () => clearInterval(interval);
    }, [isPending, pendingTxHash]);

    const isCooldownActive = claims.length > 0 && (Date.now() - claims[0].timestamp < 3600000);

    const handleClaim = async () => {
        if (!isConnected || !userAddress) return;

        setIsLoading(true);
        setIsSuccess(false);
        setPocStatus(null);

        try {
            // ── Proof of Claim: resolve o desafio criptográfico (o "trabalho" do clique)
            const pocProof = await solvePocChallenge(userAddress, setPocStatus);

            // Gera um hash criptográfico local caso não seja Metamask
            const randomBytes = new Uint8Array(32);
            crypto.getRandomValues(randomBytes);
            let txHash = '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            let claimSignature: string | null = null;
            let claimSigTimestamp: number | null = null;

            if (authMethod === 'WALLET') {
                if (typeof window.ethereum === 'undefined') throw new Error("MetaMask não encontrado");

                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();

                // Modo Soberano: assinatura de mensagem (gasless, sem rede externa).
                // A carteira é usada apenas como identidade — nenhuma transação
                // on-chain é enviada. O tx hash nativo deriva da assinatura.
                // O backend verifica esta MESMA mensagem via ECDSA (fix B6).
                claimSigTimestamp = Math.floor(Date.now() / 1000);
                const claimMessage = buildClaimMessage(userAddress.toLowerCase(), claimSigTimestamp);
                claimSignature = await signer.signMessage(claimMessage);
                txHash = ethers.keccak256(ethers.toUtf8Bytes(`${claimMessage}|${claimSignature}`));
            } else {
                // Simulate network latency for demo logins
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            const verifyRes = await fetch(`${API_BASE_URL}/api/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_address: userAddress,
                    block_height: metrics.blockHeight,
                    tx_hash: txHash,
                    source_platform: authMethod || 'WEB3',
                    signature: claimSignature,
                    sig_timestamp: claimSigTimestamp,
                    ...pocProof
                })
            });

            if (!verifyRes.ok) {
                if (verifyRes.status === 429) {
                    throw new Error("Cooldown temporal ativo para esta carteira (1 Hora).");
                }
                throw new Error("Transaction rejected by PoC Manager.");
            }

            const verifyData = await verifyRes.json();
            if (verifyData.status === 'pending') {
                setIsPending(true);
                setPendingTxHash(verifyData.tx_hash);
            } else {
                await fetchClaims();
                await fetchBalance();  // Refresh real balance from API
                setIsSuccess(true);
            }

            // Trigger local update manually for UI
            addBlockManually(`POC_CLAIM_USER`, 1);

        } catch (error) {
            console.error("Erro no Claim:", error);
            alert("Falha ao processar transação: " + (error as any).message);
            setIsLoading(false);
        }
    };

    const activateExternalHub = () => {
        if (userBalance >= 10000) {
            setUserBalance(prev => prev - 10000);
            setIsHubActive(true);
        } else {
            const msg = lang === 'pt'
                ? "Saldo insuficiente! Você precisa travar 10.000 CLAIM para ativar um Hub Externo."
                : "Insufficient balance! You need to lock 10,000 CLAIM to activate an External Hub.";
            alert(msg);
        }
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="text-center max-w-3xl mx-auto space-y-4">
                <h2 className="text-4xl font-black text-brand-secondary tracking-tighter uppercase">{t.faucet.title}</h2>
                <p className="text-brand-muted text-lg">
                    {lang === 'pt'
                        ? 'O sistema de mérito da FaucetChain V3 recompensa a participação ativa. Conecte sua conta para minerar mérito baseado na curvatura de emissão dinâmica.'
                        : 'The FaucetChain V3 merit system rewards active participation. Connect your account to mine merit based on dynamic emission curvature.'}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Painel de Controle de Claim */}
                <div className="lg:col-span-1">
                    <SectionCard title="Minting de Mérito" icon={<SparklesIcon className="w-5 h-5 text-brand-primary" />}>
                        <div className="space-y-6">
                            <div className="p-5 bg-brand-bg/60 border border-brand-border/40 rounded-2xl text-center">
                                <span className="text-[10px] font-black text-brand-muted uppercase tracking-[0.2em] mb-1 block">Recompensa do Bloco Atual</span>
                                <div className="text-4xl font-black text-brand-primary font-mono tracking-tighter">
                                    {metrics.currentReward} <span className="text-xs text-brand-muted">CLAIM</span>
                                </div>
                                <div className="mt-2 h-1.5 w-full bg-brand-border rounded-full overflow-hidden">
                                    <div className="bg-brand-primary h-full transition-all duration-1000" style={{ width: `${Math.max(5, 100 - (metrics.blockHeight / 2))}%` }}></div>
                                </div>
                                <p className="text-[10px] text-brand-muted mt-2 italic">A emissão decresce a cada bloco minerado.</p>
                            </div>

                            {!isConnected ? (
                                <div className="p-6 border-2 border-dashed border-brand-border rounded-2xl text-center bg-brand-surface/20">
                                    <BoltIcon className="w-10 h-10 text-brand-muted mx-auto mb-4 opacity-50" />
                                    <p className="text-sm font-bold text-brand-muted mb-4">Autenticação Necessária</p>
                                    <p className="text-xs text-brand-muted mb-4 leading-relaxed">Conecte-se com Google ou E-mail para habilitar o mint de mérito.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-xl flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-brand-primary uppercase">Seu Saldo Consolidado</span>
                                            <span className="text-xl font-black text-white">{userBalance.toFixed(2)} $CLAIM</span>
                                        </div>
                                        <WalletIcon className="w-8 h-8 text-brand-primary opacity-30" />
                                    </div>

                                    {!epochActive && (
                                        <div className="p-3 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs rounded-xl mb-2 text-center animate-pulse">
                                            ⚠️ Bloco da Hora atual ESGOTADO. Faucet Chain em Hiato. Retorne na próxima hora!
                                        </div>
                                    )}

                                    {isCooldownActive && epochActive && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl mb-2 text-center animate-pulse">
                                            ⏱️ Cooldown Ativo: O PoC liberará seus hashes na próxima hora!
                                        </div>
                                    )}

                                    <button
                                        onClick={handleClaim}
                                        disabled={isLoading || isPending || !epochActive || isCooldownActive}
                                        className="w-full py-4 rounded-2xl bg-brand-primary text-brand-bg font-black text-sm uppercase tracking-widest hover:bg-white transition-all shadow-glow-primary active:scale-95 disabled:opacity-50"
                                    >
                                        {isLoading || isPending
                                            ? (pocStatus
                                                ? <span className="text-xs font-mono">{pocStatus}</span>
                                                : <LoadingIcon className="w-5 h-5 animate-spin mx-auto" />)
                                            : "REIVINDICAR MÉRITO V3"}
                                        {isPending && <span className="block mt-1 text-[10px] text-brand-bg opacity-80">⛏️ Expandindo Mempool. Aguardando Nós...</span>}
                                    </button>
                                </div>
                            )}

                            {isSuccess && (
                                <div className="p-4 bg-brand-success/10 border border-brand-success/30 rounded-xl animate-slideUp">
                                    <div className="flex items-center gap-2 text-brand-success font-black text-xs uppercase mb-1">
                                        <CheckCircleIcon className="w-4 h-4" /> Mintagem e Exploração Completas
                                    </div>
                                    <p className="text-[10px] text-brand-muted">Sua Prova de Mérito foi validada e envelopada em um Bloco PoC por um Nó Minerador da rede.</p>
                                </div>
                            )}
                        </div>
                    </SectionCard>
                </div>

                {/* Dashboard do Participante e Hub Externo */}
                <div className="lg:col-span-2 space-y-8">
                    <SectionCard title="Painel do Participante" icon={<CubeIcon className="w-5 h-5 text-brand-secondary" />}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {/* Card de Ativação de Hub */}
                            <div className="p-5 bg-brand-bg/40 border border-brand-border/40 rounded-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-5">
                                    <SignalIcon className="w-12 h-12" />
                                </div>
                                <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest block mb-1">Infraestrutura Hub</span>
                                <p className={`text-lg font-black ${isHubActive ? 'text-brand-success' : 'text-brand-muted'}`}>
                                    {isHubActive ? 'HUB EXTERNO ATIVO' : 'NÓ PASSIVO'}
                                </p>
                                {!isHubActive && isConnected && (
                                    <button
                                        onClick={activateExternalHub}
                                        className="mt-3 text-[10px] font-black bg-brand-primary/10 text-brand-primary border border-brand-primary/30 px-3 py-1.5 rounded-lg hover:bg-brand-primary hover:text-brand-bg transition-all"
                                    >
                                        ATIVAR REDE DERIVADA (TRAVAR 10K $CLAIM)
                                    </button>
                                )}
                            </div>

                            <div className="p-5 bg-brand-bg/40 border border-brand-border/40 rounded-xl">
                                <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest block mb-1">Participação na Rede</span>
                                <div className="text-lg font-black text-brand-secondary">
                                    {claims.length} <span className="text-xs text-brand-muted">Claims Verificados</span>
                                </div>
                                <p className="text-[10px] text-brand-muted mt-2 uppercase font-bold tracking-tighter">Última Atividade: {claims[0] ? `Bloco #${claims[0].blockHeight}` : 'Sem registros'}</p>
                            </div>
                        </div>

                        {/* Tabela de Histórico de Clamação */}
                        <div className="overflow-hidden border border-brand-border rounded-xl">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-brand-bg text-[10px] font-black uppercase text-brand-muted">
                                    <tr>
                                        <th className="px-4 py-3 border-b border-brand-border">Bloco Clamado</th>
                                        <th className="px-4 py-3 border-b border-brand-border">Unidades Mintadas</th>
                                        <th className="px-4 py-3 border-b border-brand-border">TX Hash do Mérito</th>
                                        <th className="px-4 py-3 border-b border-brand-border">Status Sentinel</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {claims.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-10 text-center text-brand-muted italic">Nenhuma atividade registrada no ledger V3. Conecte-se e inicie o claim.</td>
                                        </tr>
                                    ) : (
                                        claims.map((claim, idx) => (
                                            <tr key={idx} className="border-b border-brand-border/50 hover:bg-brand-bg/20 transition-colors">
                                                <td className="px-4 py-3 font-mono text-brand-primary">#{claim.blockHeight}</td>
                                                <td className="px-4 py-3 font-bold text-brand-secondary">{claim.amount} $CLAIM</td>
                                                <td className="px-4 py-3 font-mono text-[10px] text-brand-muted truncate max-w-[150px]">
                                                    <button 
                                                        onClick={() => setSelectedTxHash(claim.txHash)} 
                                                        className="hover:text-brand-primary underline text-left"
                                                    >
                                                        {claim.txHash}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 bg-brand-success/10 text-brand-success text-[9px] font-black border border-brand-success/20 rounded-md">CONFIRMADO</span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </SectionCard>

                    {/* Nota Técnica sobre Hubs */}
                    <div className="p-6 bg-brand-primary/5 border border-brand-primary/20 rounded-3xl flex items-start gap-4">
                        <InformationCircleIcon className="w-6 h-6 text-brand-primary flex-shrink-0 mt-1" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-black text-brand-secondary uppercase tracking-tight">Reestabelecimento de Rede Derivada</h4>
                            <p className="text-xs text-brand-muted leading-relaxed">
                                Ao ativar um <b>Hub Externo</b>, você estabelece uma camada L2 derivada da <b>FaucetChain</b> principal. O travamento de <b>10.000 tokens</b> atua como garantia econômica, permitindo que seu Hub processe Provas de Mérito agregadas com autoridade descentralizada.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <TransactionDetailsModal 
                txHash={selectedTxHash} 
                onClose={() => setSelectedTxHash(null)} 
            />
        </div>
    );
};
