import React, { useCallback, useEffect, useState } from 'react';
import { SectionCard } from './SectionCard';
import { ArrowUpRightIcon, CubeIcon, LoadingIcon, ShieldCheckIcon } from './IconComponents';
import { API_BASE_URL } from '../apiConfig';

interface RootState {
    index: number;
    root: string;
    total_amount: number;
    claimed: number;
    leaf_count: number;
    published_at: number;
}

interface Batch {
    root_index: number;
    root: string;
    total_amount: number;
    leaf_count: number;
    created_at: number;
    published_signature: string | null;
    address?: string;
    on_chain?: RootState | null;
}

interface CampaignState {
    address: string;
    sponsor: string;
    operator: string;
    mint: string;
    funded: number;
    paid: number;
    committed: number;
    root_count: number;
    closed: boolean;
    vault: string;
    vault_amount: number;
}

interface Ledger {
    campaign_id: number;
    sponsor: string;
    mint: string;
    batches: Batch[];
    on_chain: CampaignState | null;
}

const EXPLORER = 'https://explorer.solana.com';
const UNIT = 1_000_000;

const txUrl = (signature: string) => `${EXPLORER}/tx/${signature}?cluster=devnet`;
const accountUrl = (address: string) => `${EXPLORER}/address/${address}?cluster=devnet`;

const amount = (value: number) => (value / UNIT).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const short = (value: string) => (value.length > 16 ? `${value.slice(0, 6)}…${value.slice(-6)}` : value);

const Figure: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
    <div className="bg-brand-bg/40 border border-brand-border/40 rounded-2xl px-5 py-4">
        <p className="text-brand-muted text-xs uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black text-white mt-1 tabular-nums">{value}</p>
        {hint && <p className="text-brand-muted text-xs mt-1">{hint}</p>}
    </div>
);

export const SettlementLedger: React.FC = () => {
    const [campaigns, setCampaigns] = useState<number[]>([]);
    const [selected, setSelected] = useState<number | null>(null);
    const [ledger, setLedger] = useState<Ledger | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/solana/campaigns`);
                const body = await response.json();
                const ids = (body.campaigns ?? []).map((c: { campaign_id: number }) => c.campaign_id);
                setCampaigns(ids);
                setSelected(ids.length ? ids[ids.length - 1] : null);
            } catch {
                setError('Could not reach the sequencer.');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const load = useCallback(async () => {
        if (selected === null) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/api/solana/ledger/${selected}`);
            if (!response.ok) throw new Error('That campaign is not registered here.');
            setLedger(await response.json());
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not read the ledger.');
        } finally {
            setLoading(false);
        }
    }, [selected]);

    useEffect(() => {
        load();
    }, [load]);

    if (loading && !ledger) {
        return (
            <div className="flex items-center justify-center p-16 text-brand-muted gap-3">
                <LoadingIcon className="w-5 h-5 animate-spin" /> Reading the chain…
            </div>
        );
    }

    if (campaigns.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-brand-surface/20 border-2 border-dashed border-brand-border rounded-[2.5rem] text-center max-w-2xl mx-auto animate-fadeIn">
                <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mb-6">
                    <CubeIcon className="w-10 h-10 text-brand-primary opacity-50" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter settle-text">Settlement Ledger</h2>
                <p className="text-brand-muted mt-4 leading-relaxed">
                    No campaign has been registered on this sequencer yet. Once a partner funds a
                    vault, everything it owes and everything it has paid shows up here — read from
                    Solana, not from this server.
                </p>
            </div>
        );
    }

    const state = ledger?.on_chain ?? null;
    const outstanding = state ? state.committed - state.paid : 0;

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="bg-brand-surface border border-brand-border/50 p-8 rounded-[2.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-sol-purple/10 rounded-full -mr-40 -mt-40 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-sol-green/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter settle-text">Settlement Ledger</h2>
                        <p className="text-brand-muted mt-3 max-w-2xl leading-relaxed">
                            Every figure below comes from the campaign's accounts on Solana. The
                            sequencer only supplies the addresses, so you can open the explorer and
                            recompute the same numbers without trusting it.
                        </p>
                    </div>
                    {campaigns.length > 1 && (
                        <select
                            id="ledger-campaign"
                            value={selected ?? ''}
                            onChange={(e) => setSelected(Number(e.target.value))}
                            className="bg-brand-bg border border-brand-border rounded-2xl px-5 py-3 text-white font-bold"
                        >
                            {campaigns.map((id) => (
                                <option key={id} value={id}>Campaign {id}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-6 py-4 rounded-2xl text-sm">
                    {error}
                </div>
            )}

            {ledger && !state && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 px-6 py-4 rounded-2xl text-sm">
                    Solana could not be read right now, so only what the sequencer recorded is shown
                    below. Those numbers are a claim, not proof — come back when the chain answers.
                </div>
            )}

            {state && (
                <SectionCard title="The vault" icon={<ShieldCheckIcon className="w-6 h-6" />}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Figure label="In the vault" value={amount(state.vault_amount)} hint="tokens held right now" />
                        <Figure label="Promised" value={amount(outstanding)} hint="published and not collected" />
                        <Figure label="Collected" value={amount(state.paid)} hint="withdrawn by users, read from Solana" />
                        <Figure label="Funded" value={amount(state.funded)} hint="deposited by the partner" />
                    </div>
                    <div className="mt-6 space-y-2 text-sm text-brand-muted">
                        <p>
                            The vault covers what is promised{' '}
                            {state.vault_amount >= outstanding ? (
                                <span className="text-green-400 font-bold">— {amount(state.vault_amount)} against {amount(outstanding)}</span>
                            ) : (
                                <span className="text-red-400 font-bold">— it does not: {amount(state.vault_amount)} against {amount(outstanding)}</span>
                            )}
                            . The program enforces this before accepting any new root.
                        </p>
                        <p className="flex flex-wrap gap-x-6 gap-y-1">
                            <a href={accountUrl(state.vault)} target="_blank" rel="noreferrer" className="text-brand-primary hover:underline inline-flex items-center gap-1">
                                Vault {short(state.vault)} <ArrowUpRightIcon className="w-3 h-3" />
                            </a>
                            <a href={accountUrl(state.address)} target="_blank" rel="noreferrer" className="text-brand-primary hover:underline inline-flex items-center gap-1">
                                Campaign {short(state.address)} <ArrowUpRightIcon className="w-3 h-3" />
                            </a>
                            <span>{state.closed ? 'Closed to new roots' : 'Open'}</span>
                        </p>
                    </div>
                </SectionCard>
            )}

            <SectionCard title={`Published roots (${ledger?.batches.length ?? 0})`} icon={<CubeIcon className="w-6 h-6" />}>
                {!ledger || ledger.batches.length === 0 ? (
                    <p className="text-brand-muted">No batch has been closed for this campaign yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[640px]">
                            <thead>
                                <tr className="text-brand-muted text-xs uppercase tracking-widest text-left">
                                    <th className="pb-3 pr-4 font-medium">Root</th>
                                    <th className="pb-3 pr-4 font-medium">Leaves</th>
                                    <th className="pb-3 pr-4 font-medium text-right">Promised</th>
                                    <th className="pb-3 pr-4 font-medium text-right">Collected</th>
                                    <th className="pb-3 font-medium">On Solana</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledger.batches.map((item) => (
                                    <tr key={item.root_index} className="border-t border-brand-border/30">
                                        <td className="py-4 pr-4">
                                            <span className="text-white font-bold">#{item.root_index}</span>
                                            <span className="block font-mono text-xs text-brand-muted mt-1">
                                                {short(item.root)}
                                            </span>
                                        </td>
                                        <td className="py-4 pr-4 text-brand-muted tabular-nums">{item.leaf_count}</td>
                                        <td className="py-4 pr-4 text-right text-white tabular-nums">
                                            {amount(item.on_chain?.total_amount ?? item.total_amount)}
                                        </td>
                                        <td className="py-4 pr-4 text-right tabular-nums">
                                            {item.on_chain ? (
                                                <span className="text-white">{amount(item.on_chain.claimed)}</span>
                                            ) : (
                                                <span className="text-brand-muted">—</span>
                                            )}
                                        </td>
                                        <td className="py-4">
                                            {item.published_signature ? (
                                                <a
                                                    href={txUrl(item.published_signature)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-brand-primary hover:underline inline-flex items-center gap-1"
                                                >
                                                    Transaction <ArrowUpRightIcon className="w-3 h-3" />
                                                </a>
                                            ) : (
                                                <span className="text-yellow-400/80">not published yet</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </SectionCard>
        </div>
    );
};
