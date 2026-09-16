import React, { useCallback, useEffect, useState } from 'react';
import { Transaction } from '@solana/web3.js';
import { SectionCard } from './SectionCard';
import {
    ArrowUpRightIcon,
    CubeIcon,
    LoadingIcon,
    ShieldCheckIcon,
} from './IconComponents';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../apiConfig';
import { signAction } from '../utils/actionSignature';

// The reward a published Merkle root owes this user, as the sequencer serves it.
interface Proof {
    batch_id: number;
    campaign_id: number;
    root_index: number;
    root: string;
    published_signature: string | null;
    recipient: string;
    amount: number;
    leaf_index: number;
    proof: string[];
}

// Phantom and Solflare both inject a provider that speaks this much.
interface SolanaProvider {
    publicKey?: { toString(): string };
    connect(): Promise<{ publicKey: { toString(): string } }>;
    signTransaction(transaction: Transaction): Promise<Transaction>;
}

declare global {
    interface Window {
        solana?: SolanaProvider & { isPhantom?: boolean };
        solflare?: SolanaProvider;
    }
}

const CHAIN_ID = '7777';
const EXPLORER = 'https://explorer.solana.com';

function explorerUrl(signature: string): string {
    // The demo runs on devnet; a mainnet deployment drops the cluster query.
    return `${EXPLORER}/tx/${signature}?cluster=devnet`;
}

function provider(): SolanaProvider | null {
    return window.solana ?? window.solflare ?? null;
}

function short(value: string): string {
    return value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value;
}

export const SolanaPayouts: React.FC = () => {
    const { userAddress, isConnected, authMethod } = useAuth();

    const [wallet, setWallet] = useState<string | null>(null);
    const [linked, setLinked] = useState<string | null>(null);
    const [proofs, setProofs] = useState<Proof[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState<Record<number, string>>({});

    const loadLinkAndProofs = useCallback(async () => {
        if (!userAddress) return;
        try {
            const linkResponse = await fetch(`${API_BASE_URL}/api/solana/link/${userAddress}`);
            if (linkResponse.ok) {
                const body = await linkResponse.json();
                setLinked(body.solana_address);
            } else {
                setLinked(null);
                setProofs([]);
                return;
            }
            const proofResponse = await fetch(`${API_BASE_URL}/api/solana/proof/${userAddress}`);
            if (proofResponse.ok) {
                const body = await proofResponse.json();
                setProofs(body.proofs ?? []);
            }
        } catch {
            setError('Could not reach the sequencer.');
        }
    }, [userAddress]);

    useEffect(() => {
        loadLinkAndProofs();
    }, [loadLinkAndProofs]);

    const connectWallet = async () => {
        const solana = provider();
        if (!solana) {
            setError('No Solana wallet found. Install Phantom or Solflare and reload.');
            return;
        }
        setError(null);
        setBusy('connect');
        try {
            const { publicKey } = await solana.connect();
            setWallet(publicKey.toString());
        } catch {
            setError('The wallet refused the connection.');
        } finally {
            setBusy(null);
        }
    };

    const linkWallet = async () => {
        if (!wallet || !userAddress) return;
        setError(null);
        setBusy('link');
        try {
            const { signature, sig_timestamp } = await signAction(
                authMethod,
                (ts) => `FaucetChain Link Solana | chain:${CHAIN_ID} | ${userAddress.toLowerCase()} | ${wallet} | ts:${ts}`
            );
            const response = await fetch(`${API_BASE_URL}/api/solana/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: userAddress,
                    solana_address: wallet,
                    signature,
                    sig_timestamp,
                }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.detail ?? 'The sequencer refused the link.');
            }
            await loadLinkAndProofs();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not link the wallet.');
        } finally {
            setBusy(null);
        }
    };

    // The user signs a withdrawal the sequencer built and pays for. Their own
    // balance is never touched — that is the whole point of the relayer.
    const withdraw = async (batchId: number) => {
        const solana = provider();
        if (!solana || !userAddress) return;
        setError(null);
        setBusy(`claim-${batchId}`);
        try {
            const prepared = await fetch(`${API_BASE_URL}/api/solana/relay/prepare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: userAddress, batch_id: batchId }),
            });
            if (!prepared.ok) {
                const body = await prepared.json().catch(() => ({}));
                throw new Error(body.detail ?? 'The sequencer could not build the withdrawal.');
            }
            const { transaction } = await prepared.json();

            const decoded = Transaction.from(
                Uint8Array.from(atob(transaction), (c) => c.charCodeAt(0))
            );
            const signed = await solana.signTransaction(decoded);

            const submitted = await fetch(`${API_BASE_URL}/api/solana/relay/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: userAddress,
                    batch_id: batchId,
                    transaction: btoa(
                        String.fromCharCode(...signed.serialize({ requireAllSignatures: false }))
                    ),
                }),
            });
            if (!submitted.ok) {
                const body = await submitted.json().catch(() => ({}));
                throw new Error(body.detail ?? 'The withdrawal was refused.');
            }
            const { signature } = await submitted.json();
            setSent((current) => ({ ...current, [batchId]: signature }));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'The withdrawal failed.');
        } finally {
            setBusy(null);
        }
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-brand-surface/20 border-2 border-dashed border-brand-border rounded-[2.5rem] text-center max-w-2xl mx-auto animate-fadeIn">
                <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mb-6">
                    <CubeIcon className="w-10 h-10 text-brand-primary opacity-50" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Solana Payouts</h2>
                <p className="text-brand-muted mt-4 leading-relaxed">
                    Sign in to FaucetChain first. Your rewards are paid from a campaign vault on
                    Solana, and the account that earned them is the one that links the wallet.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="bg-brand-surface border border-brand-border/50 p-8 rounded-[2.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-brand-primary/5 rounded-full -mr-40 -mt-40 blur-3xl"></div>
                <div className="relative">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Solana Payouts</h2>
                    <p className="text-brand-muted mt-3 max-w-2xl leading-relaxed">
                        Rewards are held in a campaign vault on Solana and released against a Merkle
                        root the sequencer publishes on-chain. You withdraw by proving your leaf is
                        in that root — and you pay nothing: the fee and the account rent are covered
                        by the relayer.
                    </p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-6 py-4 rounded-2xl text-sm">
                    {error}
                </div>
            )}

            <SectionCard title="Receiving wallet" icon={<ShieldCheckIcon className="w-6 h-6" />}>
                {linked ? (
                    <p className="text-brand-muted">
                        Payouts go to <span className="font-mono text-white">{linked}</span>.
                        {' '}A root already published keeps paying this wallet even if you link
                        another one later.
                    </p>
                ) : (
                    <div className="space-y-4">
                        <p className="text-brand-muted">
                            No wallet linked yet. Connect the one that should receive the tokens and
                            sign the link with your FaucetChain account.
                        </p>
                        <div className="flex flex-wrap gap-3 items-center">
                            <button
                                onClick={connectWallet}
                                disabled={busy !== null}
                                className="px-6 py-3 bg-brand-primary/10 border border-brand-primary/40 text-brand-primary rounded-2xl font-bold uppercase text-sm tracking-wide hover:bg-brand-primary/20 disabled:opacity-40"
                            >
                                {busy === 'connect' ? 'Connecting…' : wallet ? `Connected ${short(wallet)}` : 'Connect wallet'}
                            </button>
                            {wallet && (
                                <button
                                    onClick={linkWallet}
                                    disabled={busy !== null}
                                    className="px-6 py-3 bg-brand-primary text-black rounded-2xl font-bold uppercase text-sm tracking-wide hover:opacity-90 disabled:opacity-40"
                                >
                                    {busy === 'link' ? 'Signing…' : 'Link this wallet'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </SectionCard>

            <SectionCard title="Rewards waiting" icon={<CubeIcon className="w-6 h-6" />}>
                {proofs.length === 0 ? (
                    <p className="text-brand-muted">
                        Nothing to withdraw yet. A reward appears here once the sequencer closes the
                        batch it belongs to and publishes its root on Solana.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {proofs.map((item) => (
                            <div
                                key={item.batch_id}
                                className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-brand-bg/40 border border-brand-border/40 rounded-2xl px-6 py-5"
                            >
                                <div className="min-w-0">
                                    <p className="text-white font-bold">
                                        Campaign {item.campaign_id} · batch {item.batch_id}
                                    </p>
                                    <p className="text-brand-muted text-sm mt-1 font-mono break-all">
                                        root {short(item.root)} · leaf {item.leaf_index} ·{' '}
                                        {item.proof.length} sibling{item.proof.length === 1 ? '' : 's'}
                                    </p>
                                    {item.published_signature && (
                                        <a
                                            href={explorerUrl(item.published_signature)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-brand-primary text-sm mt-2 hover:underline"
                                        >
                                            Root on Solana <ArrowUpRightIcon className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 flex-none">
                                    <span className="text-2xl font-black text-white tabular-nums">
                                        {(item.amount / 1_000_000).toFixed(2)}
                                    </span>
                                    {sent[item.batch_id] ? (
                                        <a
                                            href={explorerUrl(sent[item.batch_id])}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-5 py-2.5 border border-green-500/40 text-green-300 rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-green-500/10"
                                        >
                                            Withdrawn
                                        </a>
                                    ) : (
                                        <button
                                            onClick={() => withdraw(item.batch_id)}
                                            disabled={busy !== null || !linked}
                                            className="px-5 py-2.5 bg-brand-primary text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-40 flex items-center gap-2"
                                        >
                                            {busy === `claim-${item.batch_id}` && (
                                                <LoadingIcon className="w-4 h-4 animate-spin" />
                                            )}
                                            Withdraw
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>
        </div>
    );
};
