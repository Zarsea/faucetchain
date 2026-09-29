import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';

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
    campaigns: number[];
    credited: number;
    published: number;
    collected: number;
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
    const total = t.credited + t.published + t.collected;
    if (total <= 0) return null;
    const pct = (v: number) => `${(v / total) * 100}%`;
    return (
        <div className="mt-3">
            <div className="flex h-2 w-full rounded-full overflow-hidden bg-brand-bg/60 border border-brand-border/40">
                {t.credited > 0 && <div style={{ width: pct(t.credited) }} className="bg-amber-500/80" />}
                {t.published > 0 && <div style={{ width: pct(t.published) }} className="bg-sky-500/80" />}
                {t.collected > 0 && <div style={{ width: pct(t.collected) }} className="bg-green-500/80" />}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-brand-muted">
                <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500/80 mr-1" />
                    creditado aqui {fmt(t.credited, t.decimals)}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-sky-500/80 mr-1" />
                    em raiz na Solana {fmt(t.published, t.decimals)}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-green-500/80 mr-1" />
                    sacado {fmt(t.collected, t.decimals)}</span>
            </div>
        </div>
    );
};

export const CampaignHoldings: React.FC<{ userAddress: string | null }> = ({ userAddress }) => {
    const [tokens, setTokens] = useState<TokenHolding[] | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!userAddress) { setTokens(null); return; }
        let alive = true;
        fetch(`${API_BASE_URL}/api/solana/holdings/${userAddress}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((body) => { if (alive) setTokens(body.tokens ?? []); })
            .catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [userAddress]);

    if (!userAddress || failed) return null;

    return (
        <div className="bg-brand-surface border border-brand-border/50 rounded-3xl p-6">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <h3 className="text-lg font-black text-white">Tokens recebidos de campanhas</h3>
                <span className="text-[10px] uppercase tracking-widest text-brand-muted">Solana devnet</span>
            </div>
            <p className="text-brand-muted text-xs mt-2 leading-relaxed max-w-2xl">
                Estes não são $CLAIM. São tokens de quem patrocinou a campanha, e é o
                que carrega valor — o $CLAIM é a unidade com que esta rede mede trabalho.
                O caminho é sempre o mesmo: o clique credita aqui, o lote vira uma raiz
                publicada na Solana, e o saque leva para a sua carteira.
            </p>

            {tokens === null && (
                <p className="text-brand-muted text-sm mt-6">Lendo…</p>
            )}

            {tokens?.length === 0 && (
                <p className="text-brand-muted text-sm mt-6">
                    Nenhuma campanha pagou esta conta ainda. Um clique numa torneira
                    matriculada numa campanha financiada é o que começa isto.
                </p>
            )}

            <div className="mt-5 space-y-4">
                {tokens?.map((t) => (
                    <div key={t.mint} className="bg-brand-bg/40 border border-brand-border/40 rounded-2xl px-5 py-4">
                        <div className="flex items-baseline justify-between gap-3 flex-wrap">
                            <div>
                                <p className="text-white font-bold">
                                    {t.name ?? <span className="text-yellow-400">Token sem nome</span>}
                                    {t.symbol && <span className="text-brand-muted font-normal ml-2">{t.symbol}</span>}
                                </p>
                                <p className="text-[11px] text-brand-muted mt-0.5">
                                    Campanha{t.campaigns.length > 1 ? 's' : ''} {t.campaigns.join(', ')}
                                </p>
                            </div>
                            <p className="text-xl font-black text-white tabular-nums">
                                {fmt(t.credited + t.published + t.collected, t.decimals)}
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
                                Este mint não tem metadados na Solana, então aparece sem nome aqui
                                e sem nome na sua carteira também. Quem o emitiu é quem pode
                                resolver isso.
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
