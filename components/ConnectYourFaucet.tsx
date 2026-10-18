import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';

/**
 * A pagina de integracao para quem ja opera uma torneira web2.
 *
 * O cliente desta tela nao e o usuario final, e o operador. Ele ja tem
 * torneira, ja tem usuarios, e paga as recompensas deles do proprio bolso. O
 * que esta rede oferece a ele e dinheiro de patrocinador para pagar os
 * usuarios que ele ja tem.
 *
 * Por isso a ordem das secoes nao e a ordem de um tutorial. Operador de
 * torneira ja ouviu "integre e depois havera dinheiro" e nao acredita mais.
 * Entao o dinheiro vem primeiro, com o cofre na cadeia e o link para conferir
 * sem sair daqui; a integracao vem depois, quando ele ja sabe que vale; e a
 * prova de reserva vem por ultimo, como resposta a "por que eu confiaria em
 * voces" -- que e a pergunta que ele faz depois de querer, nao antes.
 *
 * Tudo aqui e lido ao vivo da API. Numero de slide nao convence quem opera
 * torneira; numero que ele mesmo abre no explorer, sim.
 */

interface Props {
    onBack: () => void;
}

interface Token {
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
}

interface Campanha {
    campaign_id: number;
    mint: string;
    label: string | null;
    retired_at: number | null;
}

interface Cofre {
    campaign_id: number;
    symbol: string;
    name: string;
    decimals: number;
    funded: number;
    paid: number;
    vault: string;
    vaultAmount: number;
    program: string;
}

interface Solvencia {
    asset: string;
    reserve: number;
    obligations: number;
    faucets: { name: string; coverageRatio: number | null; solvent: boolean }[];
}

const CLUSTER = 'devnet';
const explorer = (endereco: string) =>
    `https://explorer.solana.com/address/${endereco}?cluster=${CLUSTER}`;

/** Unidade minima -> legivel, sem notacao cientifica em numero grande. */
const legivel = (bruto: number, casas: number) =>
    (bruto / 10 ** casas).toLocaleString('en-US', { maximumFractionDigits: 2 });

const Copiavel: React.FC<{ codigo: string; rotulo: string }> = ({ codigo, rotulo }) => {
    const [copiado, setCopiado] = useState(false);
    return (
        <div className="relative group">
            <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border border-white/10 border-b-0 rounded-t-xl">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{rotulo}</span>
                <button
                    onClick={() => {
                        navigator.clipboard?.writeText(codigo).then(
                            () => { setCopiado(true); setTimeout(() => setCopiado(false), 1600); },
                            () => undefined,   // area de transferencia bloqueada nao pode quebrar a pagina
                        );
                    }}
                    className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300/70 hover:text-cyan-200 transition-colors"
                >
                    {copiado ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre className="px-4 py-3 bg-black/50 border border-white/10 rounded-b-xl overflow-x-auto text-[12px] leading-relaxed text-cyan-100/80 font-mono">
{codigo}
            </pre>
        </div>
    );
};

const Passo: React.FC<{ n: number; titulo: string; children: React.ReactNode }> = ({ n, titulo, children }) => (
    <div className="flex gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-sm font-black text-cyan-300">
            {n}
        </div>
        <div className="min-w-0 flex-1 pb-8 border-l border-white/[0.06] pl-5 -ml-[1.05rem] pt-1">
            <h3 className="text-white font-bold mb-2">{titulo}</h3>
            {children}
        </div>
    </div>
);

export const ConnectYourFaucet: React.FC<Props> = ({ onBack }) => {
    const [cofres, setCofres] = useState<Cofre[]>([]);
    const [solvencia, setSolvencia] = useState<Solvencia | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState<string | null>(null);

    // Dois fluxos independentes, de proposito. A prova de reserva nao depende
    // das campanhas, e quando ela estava na mesma cadeia de promessas os
    // cofres ficavam escondidos esperando uma chamada que nao tem nada a ver
    // com eles -- tres idas ao servidor antes de aparecer o primeiro numero.
    useEffect(() => {
        let vivo = true;

        (async () => {
            try {
                const [rc, rt] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/solana/campaigns`),
                    fetch(`${API_BASE_URL}/api/solana/tokens`),
                ]);
                const campanhas: Campanha[] = (await rc.json()).campaigns ?? [];
                const tokens: Token[] = (await rt.json()).tokens ?? [];
                const porMint = new Map(tokens.map((t) => [t.mint, t]));

                // So campanhas vivas e com token conhecido: uma campanha sem
                // metadados nao tem nada que um operador possa ler.
                const vivas = campanhas.filter((c) => !c.retired_at && porMint.has(c.mint));

                const lidos = await Promise.all(vivas.map(async (c) => {
                    const r = await fetch(`${API_BASE_URL}/api/solana/ledger/${c.campaign_id}`);
                    if (!r.ok) return null;
                    const oc = (await r.json()).on_chain;
                    if (!oc) return null;
                    const t = porMint.get(c.mint)!;
                    return {
                        campaign_id: c.campaign_id,
                        symbol: t.symbol, name: t.name, decimals: t.decimals,
                        funded: oc.funded ?? 0, paid: oc.paid ?? 0,
                        vault: oc.vault, vaultAmount: oc.vault_amount ?? 0,
                        program: oc.program,
                    } as Cofre;
                }));

                if (!vivo) return;
                setCofres(lidos.filter(Boolean) as Cofre[]);
            } catch {
                if (vivo) setErro('Could not reach the network. These figures are read live, so none is shown rather than showing a stale one.');
            } finally {
                if (vivo) setCarregando(false);
            }
        })();

        (async () => {
            try {
                const r = await fetch(`${API_BASE_URL}/api/faucethub/proof-of-reserve`);
                const prova = await r.json();
                const claim = (prova.assets ?? []).find((a: Solvencia) => a.asset === 'CLAIM') ?? null;
                if (vivo) setSolvencia(claim);
            } catch {
                // A secao inteira some se isto falhar, e some em silencio: um
                // argumento de confianca pela metade e pior que nenhum.
            }
        })();

        return () => { vivo = false; };
    }, []);

    const base = API_BASE_URL || 'https://www.faucetchain.com.br';

    return (
        <div className="fixed inset-0 z-50 bg-[#02000A] text-white overflow-y-auto font-sans animate-slideUpFadeIn">
            <div className="absolute inset-0 z-0 pointer-events-none opacity-60">
                <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-cyan-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-900/20 rounded-full blur-[140px]" />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto px-5 md:px-8 py-10 md:py-16">
                <button
                    onClick={onBack}
                    className="mb-10 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold transition-colors"
                >
                    ← Back
                </button>

                <span className="block text-[11px] font-black uppercase tracking-[0.22em] text-cyan-400 mb-4">
                    For faucet operators
                </span>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.08] mb-5">
                    A sponsor pays your users.<br />You keep your faucet.
                </h1>
                <p className="text-white/60 text-lg leading-relaxed max-w-2xl">
                    You already have a faucet and you already have users. What you do not have is
                    somebody else funding the rewards. Campaign sponsors put tokens in a vault on
                    Solana; your faucet draws from it on every click it already serves. You change
                    nothing about how your faucet works, and you add one HTTP call.
                </p>

                {/* 1. O DINHEIRO ---------------------------------------------------- */}
                <h2 className="mt-16 mb-2 pt-8 border-t border-white/10 text-xl font-black tracking-tight">
                    The money is already in a vault
                </h2>
                <p className="text-white/50 text-sm leading-relaxed mb-6">
                    Read live from the chain, not from this page. Open any vault below and count it
                    yourself before you write a line of code.
                </p>

                {carregando && <p className="text-white/40 text-sm">Reading the chain…</p>}
                {erro && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-200/90 text-sm">
                        {erro}
                    </div>
                )}
                {!carregando && !erro && cofres.length === 0 && (
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-white/50 text-sm">
                        No funded campaign is open right now. Nothing is being hidden here — when a
                        sponsor funds one it appears on this list by itself.
                    </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                    {cofres.map((c) => (
                        <div key={c.campaign_id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                            <div className="flex items-baseline justify-between gap-3 mb-1">
                                <span className="font-black text-cyan-300 tracking-tight">{c.symbol}</span>
                                <span className="text-[10px] font-mono text-white/30">#{c.campaign_id}</span>
                            </div>
                            <p className="text-white/40 text-xs mb-4 truncate">{c.name}</p>
                            <p className="text-3xl font-black tracking-tight tabular-nums">
                                {legivel(c.vaultAmount, c.decimals)}
                            </p>
                            <p className="text-white/40 text-[11px] uppercase tracking-[0.14em] font-bold mt-1 mb-4">
                                in the vault now
                            </p>
                            <dl className="text-xs space-y-1 text-white/50">
                                <div className="flex justify-between">
                                    <dt>Funded by sponsor</dt>
                                    <dd className="tabular-nums text-white/70">{legivel(c.funded, c.decimals)}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt>Already paid to users</dt>
                                    <dd className="tabular-nums text-white/70">{legivel(c.paid, c.decimals)}</dd>
                                </div>
                            </dl>
                            <a
                                href={explorer(c.vault)} target="_blank" rel="noopener noreferrer"
                                className="mt-4 inline-block text-[11px] font-bold text-cyan-300/80 hover:text-cyan-200 transition-colors"
                            >
                                Verify this vault on Solana ↗
                            </a>
                        </div>
                    ))}
                </div>

                {/* 2. A INTEGRACAO -------------------------------------------------- */}
                <h2 className="mt-16 mb-2 pt-8 border-t border-white/10 text-xl font-black tracking-tight">
                    What you have to build
                </h2>
                <p className="text-white/50 text-sm leading-relaxed mb-8">
                    One call from the claim handler you already have. No SDK, no wallet in your
                    backend, no key of ours on your server beyond the API key below.
                </p>

                <Passo n={1} titulo="Register your faucet">
                    <p className="text-white/50 text-sm leading-relaxed mb-3">
                        Self-serve. The response carries your API key once and never again —
                        we store only its hash, so nothing can hand it back to you later.
                    </p>
                    <Copiavel
                        rotulo="POST /api/faucethub/register"
                        codigo={`curl -X POST ${base}/api/faucethub/register \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My Faucet",
       "wallet_address":"0xYourFaucetWallet",
       "site_url":"https://myfaucet.example"}'`}
                    />
                </Passo>

                <Passo n={2} titulo="Call us when you pay a user">
                    <p className="text-white/50 text-sm leading-relaxed mb-3">
                        The click you already serve. We credit $CLAIM to that user and draw from
                        every campaign your faucet carries, in the same call.
                    </p>
                    <Copiavel
                        rotulo="POST /api/faucethub/microclaim"
                        codigo={`curl -X POST ${base}/api/faucethub/microclaim \\
  -H "X-Api-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"user_wallet":"0xYourUser","amount":1.0}'`}
                    />
                    <p className="text-white/40 text-xs leading-relaxed mt-3">
                        Give one claim per campaign token instead? Send
                        <code className="mx-1 px-1.5 py-0.5 rounded bg-white/10 font-mono text-[11px]">campaign_id</code>
                        to pay only that campaign, or
                        <code className="mx-1 px-1.5 py-0.5 rounded bg-white/10 font-mono text-[11px]">"campaigns": false</code>
                        to pay $CLAIM and no campaign.
                    </p>
                </Passo>

                <Passo n={3} titulo="Ask what you can pay, before you promise it">
                    <p className="text-white/50 text-sm leading-relaxed mb-3">
                        What each campaign pays per click right now, and when it pays nothing, why.
                        Build your screen from this instead of discovering a dry campaign in the
                        claim that failed.
                    </p>
                    <Copiavel
                        rotulo="GET /api/faucethub/my-campaigns"
                        codigo={`curl ${base}/api/faucethub/my-campaigns \\
  -H "X-Api-Key: YOUR_KEY"`}
                    />
                </Passo>

                <div className="p-4 rounded-xl bg-amber-500/[0.07] border border-amber-400/25 text-amber-100/80 text-sm leading-relaxed -mt-2">
                    <strong className="text-amber-200">One thing you cannot do alone.</strong> A faucet
                    does not enrol itself into somebody else's budget — the campaign declares which
                    faucets it wants. Register first, then talk to us and we add you. That rule is
                    there to protect sponsors, and it protects you from the faucet next door too.
                </div>

                {/* 3. A CONFIANCA --------------------------------------------------- */}
                <h2 className="mt-16 mb-2 pt-8 border-t border-white/10 text-xl font-black tracking-tight">
                    Why you would trust this
                </h2>
                <p className="text-white/50 text-sm leading-relaxed mb-6">
                    The usual answer is a promise. Ours is an endpoint: what every faucet on this
                    network holds against what it owes its users, published whether it flatters us
                    or not.
                </p>

                {solvencia && (
                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                        <div className="flex flex-wrap gap-6 mb-5">
                            <div>
                                <p className="text-2xl font-black tabular-nums">{solvencia.reserve.toLocaleString('en-US')}</p>
                                <p className="text-white/40 text-[10px] uppercase tracking-[0.14em] font-bold">$CLAIM held</p>
                            </div>
                            <div>
                                <p className="text-2xl font-black tabular-nums">{solvencia.obligations.toLocaleString('en-US')}</p>
                                <p className="text-white/40 text-[10px] uppercase tracking-[0.14em] font-bold">owed to users</p>
                            </div>
                            <div>
                                <p className="text-2xl font-black tabular-nums text-emerald-300">
                                    {solvencia.faucets.filter((f) => f.solvent).length}/{solvencia.faucets.length}
                                </p>
                                <p className="text-white/40 text-[10px] uppercase tracking-[0.14em] font-bold">faucets solvent</p>
                            </div>
                        </div>
                        <p className="text-white/40 text-xs leading-relaxed">
                            A faucet that owes nothing shows no ratio, because a faucet nobody has
                            claimed from has not failed a promise it never made. The full table,
                            per faucet and per asset, is at
                            <code className="mx-1 px-1.5 py-0.5 rounded bg-white/10 font-mono text-[11px]">/api/faucethub/proof-of-reserve</code>
                            and needs no login.
                        </p>
                    </div>
                )}

                <footer className="mt-16 pt-6 border-t border-white/10 text-white/35 text-xs leading-relaxed">
                    FaucetChain runs as a public testnet and settles campaign tokens on Solana
                    <strong className="text-white/50"> devnet</strong>. The tokens in the vaults above
                    are devnet tokens: they are real on the chain and they are not money. Integrate
                    now to be ready and to shape what this becomes — not for the value of what it
                    pays today.
                </footer>
            </div>
        </div>
    );
};

export default ConnectYourFaucet;
