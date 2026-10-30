import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';
import { useLanguage } from './LanguageContext';

/**
 * O que este usuário ganhou de campanha, e onde cada parte está.
 *
 * O saldo grande do painel é $CLAIM, que é a unidade interna desta rede e não
 * tem preço. O que carrega valor é o token do patrocinador, e ele não aparecia
 * em lugar nenhum — o usuário clicava numa torneira, ganhava token de alguém, e
 * a tela dele não sabia disso.
 *
 * Os três estados existem porque a diferença entre eles é a diferença entre
 * promessa e pagamento, que é a distinção inteira deste projeto:
 *
 *   creditado   está no livro daqui e em lugar nenhum na cadeia
 *   na Solana   dentro de uma raiz publicada, e o programa já provou que o
 *               vault cobre; dá para sacar
 *   sacado      na carteira Solana do usuário, lido do bitmap da raiz
 *
 * `collected` vem da cadeia. Quando a Solana não responde ele fica nulo e a tela
 * diz que não sabe, em vez de contar como não sacado.
 */

interface TokenHolding {
    mint: string;
    name: string | null;
    symbol: string | null;
    decimals: number;
    // `label` vem pronto do servidor: nome próprio da campanha, senão o nome do
    // token, senão o símbolo, senão `#652608`. Não remontar essa cadeia aqui —
    // ela existe num lugar só justamente para não divergir entre telas.
    campaigns: { id: number; name: string | null; label: string }[];
    credited: number;
    published: number;
    // Nulo quando a Solana nao respondeu sobre algum lote deste token. Zero
    // significa "nada sacado", e isso so a cadeia pode afirmar -- tratar o
    // silencio dela como zero foi exatamente o defeito que esta tela tinha.
    collected: number | null;
}

/** Um credito de campanha, com a torneira que o originou. */
interface HistoryEntry {
    campaign_id: number;
    campaign_label: string;
    faucet_wallet: string | null;
    faucet_name: string | null;
    faucet_site: string | null;
    amount: number;
    symbol: string | null;
    decimals: number;
    created_at: number;
    paid_to: string | null;
    batch_id: number | null;
    root_index: number | null;
    state: 'credited' | 'published' | 'collected' | 'unknown';
}

const EXPLORER = 'https://explorer.solana.com';
const accountUrl = (address: string) => `${EXPLORER}/address/${address}?cluster=devnet`;
const short = (v: string) => (v.length > 14 ? `${v.slice(0, 5)}…${v.slice(-5)}` : v);

const fmt = (raw: number, decimals: number) =>
    (raw / 10 ** decimals).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    });

// Uma barra que mostra por onde o valor está, não só quanto ele é. Com tudo
// creditado e nada publicado ela fica inteira âmbar, que é exatamente o que se
// quer ver: prometido, ainda não pago.
const Flow: React.FC<{ t: TokenHolding }> = ({ t }) => {
    const { tri } = useLanguage();
    // `?? 0` so para a largura da barra. O rotulo abaixo continua dizendo
    // "nao sei" em vez de desenhar um zero que a cadeia nao confirmou.
    const sacado = t.collected ?? 0;
    const total = t.credited + t.published + sacado;
    if (total <= 0) return null;
    const pct = (v: number) => `${(v / total) * 100}%`;
    return (
        <div className="mt-3">
            <div className="flex h-2 w-full rounded-full overflow-hidden bg-brand-bg/60 border border-brand-border/40">
                {t.credited > 0 && <div style={{ width: pct(t.credited) }} className="bg-amber-500/80" />}
                {t.published > 0 && <div style={{ width: pct(t.published) }} className="bg-sky-500/80" />}
                {sacado > 0 && <div style={{ width: pct(sacado) }} className="bg-green-500/80" />}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-brand-muted">
                <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500/80 mr-1" />
                    {tri('credited here', 'creditado aqui', 'acreditado aquí')} {fmt(t.credited, t.decimals)}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-sky-500/80 mr-1" />
                    {tri('in a root on Solana', 'em raiz na Solana', 'en una raíz en Solana')} {fmt(t.published, t.decimals)}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-green-500/80 mr-1" />
                    {t.collected === null
                        ? tri('collected — Solana did not answer',
                              'sacado — a Solana não respondeu',
                              'cobrado — Solana no respondió')
                        : `${tri('collected', 'sacado', 'cobrado')} ${fmt(t.collected, t.decimals)}`}</span>
            </div>
        </div>
    );
};

export const CampaignHoldings: React.FC<{ userAddress: string | null }> = ({ userAddress }) => {
    const { tri, locale } = useLanguage();
    const [tokens, setTokens] = useState<TokenHolding[] | null>(null);
    const [history, setHistory] = useState<HistoryEntry[] | null>(null);
    const [failed, setFailed] = useState(false);
    // O extrato chega com ate 200 linhas, uma por clique, e empurrava o resto
    // do painel para longe. Os dez mais recentes respondem "de onde veio".
    const [tudo, setTudo] = useState(false);

    useEffect(() => {
        if (!userAddress) { setTokens(null); setHistory(null); return; }
        let alive = true;
        fetch(`${API_BASE_URL}/api/solana/holdings/${userAddress}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((body) => { if (alive) setTokens(body.tokens ?? []); })
            .catch(() => { if (alive) setFailed(true); });
        // O extrato falha sozinho: sem ele os saldos acima continuam valendo, e
        // derrubar a tela inteira por causa da procedencia seria pior do que
        // nao mostrar a procedencia.
        fetch(`${API_BASE_URL}/api/solana/history/${userAddress}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((body) => { if (alive) setHistory(body.entries ?? []); })
            .catch(() => { if (alive) setHistory([]); });
        return () => { alive = false; };
    }, [userAddress]);

    if (!userAddress || failed) return null;

    return (
        <div className="bg-brand-surface border border-brand-border/50 rounded-3xl p-6">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <h3 className="text-lg font-black text-white">
                    {tri('Tokens received from campaigns', 'Tokens recebidos de campanhas',
                         'Tokens recibidos de campañas')}
                </h3>
                <span className="text-[10px] uppercase tracking-widest text-brand-muted">Solana devnet</span>
            </div>
            <p className="text-brand-muted text-xs mt-2 leading-relaxed max-w-2xl">
                {tri(
                    'These are not $CLAIM. They are the tokens of whoever funded the campaign, and they are what carries value: $CLAIM is the unit this network measures work in. The path is always the same. The click credits here, the batch becomes a root published on Solana, and the withdrawal takes it to your wallet.',
                    'Estes não são $CLAIM. São os tokens de quem financiou a campanha, e é o que carrega valor: $CLAIM é a unidade com que esta rede mede trabalho. O caminho é sempre o mesmo. O clique credita aqui, o lote vira uma raiz publicada na Solana, e o saque leva até a sua carteira.',
                    'Estos no son $CLAIM. Son los tokens de quien financió la campaña, y es lo que carga valor: $CLAIM es la unidad con la que esta red mide trabajo. El camino es siempre el mismo. El clic acredita aquí, el lote se vuelve una raíz publicada en Solana, y el retiro lo lleva a su billetera.')}
            </p>

            {tokens === null && (
                <p className="text-brand-muted text-sm mt-6">{tri('Reading…', 'Lendo…', 'Leyendo…')}</p>
            )}

            {tokens?.length === 0 && (
                <p className="text-brand-muted text-sm mt-6">
                    {tri(
                        'No campaign has paid this account yet. A click on a faucet enrolled in a funded campaign is what starts it.',
                        'Nenhuma campanha pagou esta conta ainda. Um clique numa torneira inscrita numa campanha com orçamento é o que começa.',
                        'Ninguna campaña ha pagado esta cuenta todavía. Un clic en un grifo inscrito en una campaña con presupuesto es lo que lo empieza.')}
                </p>
            )}

            <div className="mt-5 space-y-4">
                {tokens?.map((t) => (
                    <div key={t.mint} className="bg-brand-bg/40 border border-brand-border/40 rounded-2xl px-5 py-4">
                        <div className="flex items-baseline justify-between gap-3 flex-wrap">
                            <div>
                                <p className="text-white font-bold">
                                    {t.name ?? <span className="text-yellow-400">{tri('Unnamed token', 'Token sem nome', 'Token sin nombre')}</span>}
                                    {t.symbol && <span className="text-brand-muted font-normal ml-2">{t.symbol}</span>}
                                </p>
                                <p className="text-[11px] text-brand-muted mt-0.5">
                                    {t.campaigns.length > 1
                                        ? tri('Campaigns', 'Campanhas', 'Campañas')
                                        : tri('Campaign', 'Campanha', 'Campaña')}{' '}
                                    {t.campaigns.map(c => c.label).join(', ')}
                                </p>
                            </div>
                            <p className="text-xl font-black text-white tabular-nums">
                                {fmt(t.credited + t.published + (t.collected ?? 0), t.decimals)}
                            </p>
                        </div>

                        <Flow t={t} />

                        <a
                            href={accountUrl(t.mint)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-primary hover:underline text-[11px] font-mono mt-3 inline-block"
                        >
                            mint {short(t.mint)} ↗
                        </a>
                        {!t.name && (
                            <p className="text-yellow-200/70 text-[10px] mt-2 leading-relaxed">
                                {tri(
                                    'This mint has no metadata on Solana, so it shows up unnamed here and unnamed in your wallet too. Whoever issued it is who can fix that.',
                                    'Este mint não tem metadados na Solana, então aparece sem nome aqui e sem nome na sua carteira também. Quem o emitiu é quem pode corrigir isso.',
                                    'Este mint no tiene metadatos en Solana, así que aparece sin nombre aquí y sin nombre en su billetera también. Quien lo emitió es quien puede corregirlo.')}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {!!history?.length && (
                <div className="mt-8 pt-6 border-t border-brand-border/40">
                    <h4 className="text-white font-bold text-sm">
                        {tri('Where it came from', 'De onde veio', 'De dónde vino')}
                    </h4>
                    <p className="text-brand-muted text-xs mt-1 leading-relaxed max-w-2xl">
                        {tri(
                            'Every credit, with the faucet that originated it and the Solana wallet it is destined for. The faucet only appears on credits from 23 October 2026 onwards: before that it was known at the moment of the click and was not recorded, and reconstructing it now would be guessing dressed as a record.',
                            'Cada crédito, com a torneira que o originou e a carteira Solana para onde ele vai. A torneira só aparece em créditos a partir de 23/10/2026: antes disso ela era conhecida no momento do clique e não era gravada, e reconstruir isso agora seria chute com cara de registro.',
                            'Cada crédito, con el grifo que lo originó y la billetera Solana a la que va. El grifo solo aparece en créditos a partir del 23/10/2026: antes de esa fecha se conocía en el momento del clic y no se registraba, y reconstruirlo ahora sería adivinar con apariencia de registro.')}
                    </p>
                    <div className="overflow-x-auto mt-4">
                        <table className="w-full text-xs min-w-[600px]">
                            <thead>
                                <tr className="text-left text-[10px] uppercase tracking-widest text-brand-muted">
                                    <th className="py-2 pr-4">{tri('when', 'quando', 'cuándo')}</th>
                                    <th className="py-2 pr-4">{tri('faucet', 'torneira', 'grifo')}</th>
                                    <th className="py-2 pr-4">{tri('campaign', 'campanha', 'campaña')}</th>
                                    <th className="py-2 pr-4 text-right">{tri('amount', 'valor', 'valor')}</th>
                                    <th className="py-2 pr-4">{tri('to the wallet', 'para a carteira', 'a la billetera')}</th>
                                    <th className="py-2">{tri('state', 'estado', 'estado')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(tudo ? history : history.slice(0, 10)).map((e, i) => (
                                    <tr key={`${e.campaign_id}-${e.created_at}-${i}`}
                                        className="border-t border-brand-border/30">
                                        <td className="py-2 pr-4 text-brand-muted whitespace-nowrap">
                                            {/* `locale` do app, nao do navegador: sem ele um
                                                leitor em espanhol veria a data no formato de
                                                onde o Chrome dele foi instalado. */}
                                            {new Date(e.created_at * 1000).toLocaleDateString(locale)}
                                        </td>
                                        <td className="py-2 pr-4">
                                            {!e.faucet_wallet ? (
                                                <span className="text-brand-muted">
                                                    {tri('not recorded', 'não registrado', 'no registrado')}
                                                </span>
                                            ) : e.faucet_site ? (
                                                <a href={e.faucet_site} target="_blank" rel="noreferrer"
                                                   className="text-brand-primary hover:underline">
                                                    {e.faucet_name ?? short(e.faucet_wallet)} ↗
                                                </a>
                                            ) : (
                                                <span className="text-brand-secondary font-mono">
                                                    {e.faucet_name ?? short(e.faucet_wallet)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 pr-4 text-brand-secondary">{e.campaign_label}</td>
                                        <td className="py-2 pr-4 text-right font-mono tabular-nums text-white whitespace-nowrap">
                                            {fmt(e.amount, e.decimals)}{e.symbol ? ` ${e.symbol}` : ''}
                                        </td>
                                        <td className="py-2 pr-4 font-mono text-brand-muted">
                                            {e.paid_to ? (
                                                <a href={accountUrl(e.paid_to)} target="_blank" rel="noreferrer"
                                                   className="hover:text-brand-primary">
                                                    {short(e.paid_to)}
                                                </a>
                                            ) : tri('no wallet linked', 'sem carteira vinculada',
                                                    'sin billetera vinculada')}
                                        </td>
                                        <td className="py-2">
                                            {e.state === 'collected' ? (
                                                <span className="text-green-400">
                                                    {tri('collected', 'sacado', 'cobrado')}
                                                </span>
                                            ) : e.state === 'published' ? (
                                                <span className="text-sky-400">
                                                    {tri('ready to withdraw', 'pronto para sacar',
                                                         'listo para retirar')}
                                                </span>
                                            ) : e.state === 'unknown' ? (
                                                <span className="text-brand-muted">
                                                    {tri('Solana did not answer', 'a Solana não respondeu',
                                                         'Solana no respondió')}
                                                </span>
                                            ) : (
                                                <span className="text-amber-400">
                                                    {tri('credited here', 'creditado aqui', 'acreditado aquí')}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {history.length > 10 && (
                        <button
                            type="button"
                            onClick={() => setTudo(v => !v)}
                            className="mt-3 text-[11px] font-bold text-brand-primary hover:underline"
                        >
                            {tudo
                                ? tri('Show fewer', 'Mostrar menos', 'Mostrar menos')
                                : tri(`Show all (${history.length})`, `Ver tudo (${history.length})`,
                                      `Ver todo (${history.length})`)}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
