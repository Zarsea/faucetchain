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
    program: string;
}

// O nome vem dos metadados Metaplex, que sao uma conta separada do mint e que
// ninguem e obrigado a criar. `null` quer dizer que este token nao tem nome em
// lugar nenhum -- nao que a leitura falhou.
interface TokenMeta {
    name: string;
    symbol: string;
    uri: string;
}

// Um pagamento que de fato aconteceu: so ganha linha quando a transferencia
// foi assinada e confirmada. E diferente de uma recompensa, que registra o que
// foi prometido -- e juntar os dois numa tela so foi o erro que este projeto
// existe para nao repetir.
interface Payout {
    signature: string;
    recipient: string;
    mint: string;
    amount: number;
    paid_at: number;
    lamports: number;
    root_index: number;
}

interface Ledger {
    campaign_id: number;
    sponsor: string;
    mint: string;
    batches: Batch[];
    payouts: Payout[];
    paid_total: number;
    paid_recipients: number;
    on_chain: CampaignState | null;
    token?: TokenMeta | null;
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

// Cada endereco com o nome do que ele e e uma linha dizendo o que ele faz.
// Cinco strings base58 sem rotulo nao sao verificaveis por ninguem que nao
// tenha escrito o programa.
const Address: React.FC<{ role: string; what: string; address: string }> = ({ role, what, address }) => (
    <div className="bg-brand-bg/40 border border-brand-border/40 rounded-2xl px-5 py-4">
        <p className="text-brand-muted text-xs uppercase tracking-widest">{role}</p>
        <a
            href={accountUrl(address)}
            target="_blank"
            rel="noreferrer"
            className="text-brand-primary hover:underline inline-flex items-center gap-1 font-mono text-sm mt-1 break-all"
        >
            {short(address)} <ArrowUpRightIcon className="w-3 h-3 flex-shrink-0" />
        </a>
        <p className="text-brand-muted text-xs mt-1 leading-relaxed">{what}</p>
    </div>
);

const Figure: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
    <div className="bg-brand-bg/40 border border-brand-border/40 rounded-2xl px-5 py-4">
        <p className="text-brand-muted text-xs uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-bold text-white mt-1 tabular-nums">{value}</p>
        {hint && <p className="text-brand-muted text-xs mt-1">{hint}</p>}
    </div>
);

export const SettlementLedger: React.FC = () => {
    // Guarda o rótulo junto do id: montar o nome aqui seria a quarta cópia da
    // mesma cadeia de fallback, e a primeira a divergir.
    const [campaigns, setCampaigns] = useState<{ campaign_id: number; label: string }[]>([]);
    const [selected, setSelected] = useState<number | null>(null);
    const [ledger, setLedger] = useState<Ledger | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/solana/campaigns`);
                const body = await response.json();
                const lista = (body.campaigns ?? []) as { campaign_id: number; label: string }[];
                setCampaigns(lista);
                setSelected(lista.length ? lista[lista.length - 1].campaign_id : null);
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
            <div className="flex flex-col items-center justify-center p-12 bg-brand-surface/20 border-2 border-dashed border-brand-border rounded-2xl text-center max-w-2xl mx-auto animate-fadeIn">
                <div className="w-20 h-20 bg-brand-primary/10 rounded-full flex items-center justify-center mb-6">
                    <CubeIcon className="w-10 h-10 text-brand-primary opacity-50" />
                </div>
                <h2 className="text-2xl font-bold uppercase tracking-tighter settle-text">Settlement Ledger</h2>
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
        <div className="space-y-8 rise">
            <div className="bg-brand-surface border border-brand-border/50 p-8 rounded-2xl relative overflow-hidden">
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl font-bold uppercase tracking-tighter settle-text">Settlement Ledger</h2>
                        {ledger && (
                            <p className="text-white font-bold mt-2">
                                Campaign {ledger.campaign_id} pays{' '}
                                {ledger.token ? (
                                    <span className="text-brand-primary">
                                        {ledger.token.name}
                                        {ledger.token.symbol && ` (${ledger.token.symbol})`}
                                    </span>
                                ) : (
                                    <span className="text-yellow-400">an unnamed token</span>
                                )}
                            </p>
                        )}
                        <p className="text-brand-muted mt-3 max-w-2xl leading-relaxed">
                            Every figure below comes from the campaign's accounts on Solana. The
                            sequencer only supplies the addresses, so you can open the explorer and
                            recompute the same numbers without trusting it.
                        </p>
                        {ledger && !ledger.token && (
                            <p className="text-yellow-200/80 text-xs mt-3 max-w-2xl leading-relaxed">
                                This mint has no Metaplex metadata, so it has no name, symbol or logo
                                anywhere on Solana — not here, and not in the wallet of whoever
                                receives it. Creating that metadata is the sponsor's to do; until
                                then the address below is the only thing that identifies it.
                            </p>
                        )}
                    </div>
                    {campaigns.length > 1 && (
                        <select
                            id="ledger-campaign"
                            value={selected ?? ''}
                            onChange={(e) => setSelected(Number(e.target.value))}
                            className="bg-brand-bg border border-brand-border rounded-2xl px-5 py-3 text-white font-bold"
                        >
                            {campaigns.map((c) => (
                                <option key={c.campaign_id} value={c.campaign_id}>{c.label}</option>
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
                        <p>{state.closed ? 'This campaign is closed to new roots.' : 'This campaign is open to new roots.'}</p>
                    </div>
                </SectionCard>
            )}

            {state && ledger && (
                <SectionCard title="What each address is" icon={<CubeIcon className="w-6 h-6" />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Address
                            role="Program"
                            address={state.program}
                            what="The Anchor program that refuses to publish a root its vault cannot cover. The guarantee lives here, not on the appchain."
                        />
                        <Address
                            role="Campaign"
                            address={state.address}
                            what="This campaign's account. Holds what has been funded, promised and paid, and the roots published so far."
                        />
                        <Address
                            role="Vault"
                            address={state.vault}
                            what="The token account holding the sponsor's budget. Every withdrawal is paid out of this."
                        />
                        <Address
                            role={ledger.token ? `Mint — ${ledger.token.symbol || ledger.token.name}` : 'Mint — unnamed'}
                            address={ledger.mint}
                            what={ledger.token
                                ? `The token this campaign pays: ${ledger.token.name}. This is what carries value to the user; $CLAIM does not.`
                                : 'The token this campaign pays. It carries no name on Solana, so wallets and explorers show only this address.'}
                        />
                        <Address
                            role="Sponsor"
                            address={ledger.sponsor}
                            what="The wallet that opened the campaign and funded the vault. It can reclaim only the surplus, never a promised reward."
                        />
                        <Address
                            role="Operator"
                            address={state.operator}
                            what="The key allowed to publish roots for this campaign. It cannot move money, only commit to paying it."
                        />
                    </div>
                </SectionCard>
            )}

            <SectionCard
                title={`Paid out (${ledger?.payouts?.length ?? 0})`}
                icon={<CubeIcon className="w-6 h-6" />}
            >
                <p className="text-sm text-brand-muted mb-4 max-w-3xl">
                    Who was paid through this server's relayer, and how much. Every row exists
                    because the relayer signed a transfer and Solana confirmed it — the
                    signature beside it opens in the explorer and shows the same thing without
                    passing through this server. A published root says what the campaign{' '}
                    <em>owes</em>; this table says what the relayer <em>paid</em>. A withdrawal
                    whose fee the recipient paid themselves settles on chain without appearing
                    here, which is why the vault figures above are the ones to trust for a
                    total.
                </p>

                {/* Esta mensagem negava qualquer saque sempre que a tabela vinha
                    vazia, e a campanha 711670 exibia essa negativa logo abaixo
                    de "Collected 350,00" lido da cadeia. As duas frases liam
                    fontes diferentes: a cadeia conta todo saque, esta tabela so
                    os que o nosso relayer assinou. Tabela vazia nunca provou
                    que ninguem sacou -- provou que nao sacamos por ninguem.
                    Agora e a cadeia que decide o que a frase diz. */}
                {!ledger?.payouts?.length ? (
                    !state ? (
                        <p className="text-brand-muted">
                            The relayer has signed no withdrawal on this campaign. Whether
                            anyone collected by paying their own fee is a question for Solana,
                            and the chain could not be read just now.
                        </p>
                    ) : state.paid > 0 ? (
                        <p className="text-brand-muted">
                            The relayer has signed no withdrawal here, but Solana reports{' '}
                            <span className="text-white font-mono font-bold tabular-nums">
                                {amount(state.paid)}
                            </span>{' '}
                            already collected on this campaign. Those recipients paid their own
                            transaction fee, so the transfers settled without passing through
                            this server and leave no row below.
                        </p>
                    ) : (
                        <p className="text-brand-muted">
                            No withdrawal has been signed on this campaign, and Solana agrees
                            that nothing has been collected. The roots below promise value that
                            is still waiting.
                        </p>
                    )
                ) : (
                    <>
                        <div className="flex flex-wrap gap-6 mb-4 text-sm">
                            <span className="text-brand-muted">
                                relayed{' '}
                                <span className="text-white font-mono font-bold tabular-nums">
                                    {(ledger.paid_total / UNIT).toFixed(6)}
                                </span>
                            </span>
                            <span className="text-brand-muted">
                                recipients{' '}
                                <span className="text-white font-mono font-bold">{ledger.paid_recipients}</span>
                            </span>
                        </div>
                        {/* Mesma armadilha da tabela vazia, um passo adiante: com
                            linhas presentes o total daqui parece o total pago, e
                            e so a parte que passou pelo relayer. */}
                        {state && state.paid > ledger.paid_total && (
                            <p className="text-sm text-brand-muted mb-4 max-w-3xl">
                                Solana reports{' '}
                                <span className="text-white font-mono font-bold tabular-nums">
                                    {amount(state.paid)}
                                </span>{' '}
                                collected in total, so{' '}
                                <span className="text-white font-mono font-bold tabular-nums">
                                    {amount(state.paid - ledger.paid_total)}
                                </span>{' '}
                                of it was withdrawn by recipients paying their own fee. Those
                                transfers are final on chain and simply have no row here.
                            </p>
                        )}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-widest text-brand-muted">
                                        <th className="py-2 pr-4">to</th>
                                        <th className="py-2 pr-4 text-right">units</th>
                                        <th className="py-2 pr-4">root</th>
                                        <th className="py-2">signature</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledger.payouts.map((p) => (
                                        <tr key={p.signature} className="border-t border-brand-border/40">
                                            <td className="py-2 pr-4 font-mono text-xs text-brand-secondary">
                                                <a
                                                    href={`${EXPLORER}/address/${p.recipient}?cluster=devnet`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:text-brand-primary"
                                                >
                                                    {p.recipient.slice(0, 8)}…{p.recipient.slice(-6)}
                                                </a>
                                            </td>
                                            <td className="py-2 pr-4 font-mono text-right tabular-nums text-white">
                                                {(p.amount / UNIT).toFixed(6)}
                                            </td>
                                            <td className="py-2 pr-4 font-mono text-xs text-brand-muted">
                                                #{p.root_index}
                                            </td>
                                            <td className="py-2 font-mono text-xs">
                                                <a
                                                    href={`${EXPLORER}/tx/${p.signature}?cluster=devnet`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-brand-primary hover:underline"
                                                >
                                                    {p.signature.slice(0, 12)}… ↗
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </SectionCard>

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
