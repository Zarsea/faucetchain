import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';
import { useLanguage } from './LanguageContext';

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
    const { tri } = useLanguage();
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
                if (vivo) setErro(tri(
                    'Could not reach the network. These figures are read live, so none is shown rather than showing a stale one.',
                    'Não foi possível falar com a rede. Estes números são lidos ao vivo, então nenhum é mostrado em vez de mostrar um velho.',
                    'No fue posible hablar con la red. Estos números se leen en vivo, así que no se muestra ninguno en lugar de mostrar uno viejo.'));
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
                    {tri('For faucet operators', 'Para quem opera torneira',
                         'Para quien opera un grifo')}
                </span>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.08] mb-5">
                    {tri('A sponsor pays your users.', 'Um patrocinador paga seus usuários.',
                         'Un patrocinador paga a sus usuarios.')}<br />
                    {tri('You keep your faucet.', 'Você continua com a sua torneira.',
                         'Usted se queda con su grifo.')}
                </h1>
                <p className="text-white/60 text-lg leading-relaxed max-w-2xl">
                    {tri(
                        'You already have a faucet and you already have users. What you do not have is somebody else funding the rewards. Campaign sponsors put tokens in a vault on Solana; your faucet draws from it on every click it already serves. You change nothing about how your faucet works, and you add one HTTP call.',
                        'Você já tem torneira e já tem usuários. O que você não tem é outra pessoa financiando as recompensas. Patrocinadores de campanha põem tokens num cofre na Solana; sua torneira saca dele em cada clique que ela já atende. Você não muda nada em como a torneira funciona, e acrescenta uma chamada HTTP.',
                        'Usted ya tiene grifo y ya tiene usuarios. Lo que no tiene es a otra persona financiando las recompensas. Los patrocinadores de campaña ponen tokens en una bóveda en Solana; su grifo retira de ella en cada clic que ya atiende. Usted no cambia nada en cómo funciona el grifo, y agrega una llamada HTTP.')}
                </p>

                {/* 1. O DINHEIRO ---------------------------------------------------- */}
                <h2 className="mt-16 mb-2 pt-8 border-t border-white/10 text-xl font-black tracking-tight">
                    {tri('The money is already in a vault', 'O dinheiro já está num cofre',
                         'El dinero ya está en una bóveda')}
                </h2>
                <p className="text-white/50 text-sm leading-relaxed mb-6">
                    {tri(
                        'Read live from the chain, not from this page. Open any vault below and count it yourself before you write a line of code.',
                        'Lido ao vivo da cadeia, não desta página. Abra qualquer cofre abaixo e confira você mesmo antes de escrever uma linha de código.',
                        'Leído en vivo de la cadena, no de esta página. Abra cualquier bóveda de abajo y cuéntela usted mismo antes de escribir una línea de código.')}
                </p>

                {carregando && (
                    <p className="text-white/40 text-sm">
                        {tri('Reading the chain…', 'Lendo a cadeia…', 'Leyendo la cadena…')}
                    </p>
                )}
                {erro && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-200/90 text-sm">
                        {erro}
                    </div>
                )}
                {!carregando && !erro && cofres.length === 0 && (
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-white/50 text-sm">
                        {tri(
                            'No funded campaign is open right now. Nothing is being hidden here — when a sponsor funds one it appears on this list by itself.',
                            'Nenhuma campanha com orçamento está aberta agora. Nada está sendo escondido aqui — quando um patrocinador financiar uma, ela aparece nesta lista sozinha.',
                            'Ninguna campaña con presupuesto está abierta ahora. Nada se está escondiendo aquí — cuando un patrocinador financie una, aparece en esta lista sola.')}
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
                                    <dt>{tri('Funded by sponsor', 'Financiado pelo patrocinador',
                                             'Financiado por el patrocinador')}</dt>
                                    <dd className="tabular-nums text-white/70">{legivel(c.funded, c.decimals)}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt>{tri('Already paid to users', 'Já pago aos usuários',
                                             'Ya pagado a los usuarios')}</dt>
                                    <dd className="tabular-nums text-white/70">{legivel(c.paid, c.decimals)}</dd>
                                </div>
                            </dl>
                            <a
                                href={explorer(c.vault)} target="_blank" rel="noopener noreferrer"
                                className="mt-4 inline-block text-[11px] font-bold text-cyan-300/80 hover:text-cyan-200 transition-colors"
                            >
                                {tri('Verify this vault on Solana', 'Confira este cofre na Solana',
                                     'Verifique esta bóveda en Solana')} ↗
                            </a>
                        </div>
                    ))}
                </div>

                {/* 2. O AGENT CLI ---------------------------------------------------
                    Antes dos curl de proposito. Quem integra hoje costuma estar com um
                    agente aberto, e mandar a integracao inteira para ele de uma vez e
                    mais curto do que ele ler esta pagina por cima do ombro de alguem. */}
                <h2 className="mt-16 mb-2 pt-8 border-t border-white/10 text-xl font-black tracking-tight">
                    {tri('Hand this to your agent', 'Entregue isto ao seu agente',
                         'Entregue esto a su agente')}
                </h2>
                <p className="text-white/50 text-sm leading-relaxed mb-5">
                    {tri(
                        'One command installs a skill that carries the whole integration: the request shapes, the webhook signature, and the four mistakes that cost your users money. Your agent reads it and writes the integration against it.',
                        'Um comando instala uma skill que carrega a integração inteira: o formato das requisições, a assinatura do webhook, e os quatro erros que custam dinheiro aos seus usuários. Seu agente lê e escreve a integração contra isso.',
                        'Un comando instala una skill que lleva la integración entera: el formato de las peticiones, la firma del webhook, y los cuatro errores que cuestan dinero a sus usuarios. Su agente la lee y escribe la integración contra ella.')}
                </p>
                <Copiavel rotulo="Agent CLI" codigo="npx skills add Zarsea/faucetchain" />
                <p className="text-white/40 text-xs leading-relaxed mt-3">
                    Works with Claude Code, Codex and anything else that reads
                    <code className="mx-1 px-1.5 py-0.5 rounded bg-white/10 font-mono text-[11px]">SKILL.md</code>.
                    Add <code className="mx-1 px-1.5 py-0.5 rounded bg-white/10 font-mono text-[11px]">-g</code> to
                    install it for every project instead of this one. The skill ships
                    <code className="mx-1 px-1.5 py-0.5 rounded bg-white/10 font-mono text-[11px]">check.py</code>,
                    which asserts its own promises against this API — run it before you trust what
                    it told your agent.
                </p>

                {/* 3. A INTEGRACAO -------------------------------------------------- */}
                <h2 className="mt-16 mb-2 pt-8 border-t border-white/10 text-xl font-black tracking-tight">
                    {tri('Or build it yourself', 'Ou construa você mesmo',
                         'O constrúyalo usted mismo')}
                </h2>
                <p className="text-white/50 text-sm leading-relaxed mb-8">
                    {tri(
                        'One call from the claim handler you already have. No SDK, no wallet in your backend, no key of ours on your server beyond the API key below.',
                        'Uma chamada a partir do handler de claim que você já tem. Sem SDK, sem carteira no seu backend, sem chave nossa no seu servidor além da chave de API abaixo.',
                        'Una llamada desde el handler de claim que ya tiene. Sin SDK, sin billetera en su backend, sin clave nuestra en su servidor más allá de la clave de API de abajo.')}
                </p>

                <Passo n={1} titulo={tri('Register your faucet', 'Registre sua torneira',
                                         'Registre su grifo')}>
                    <p className="text-white/50 text-sm leading-relaxed mb-3">
                        {tri(
                            'Self-serve. The response carries your API key once and never again — we store only its hash, so nothing can hand it back to you later.',
                            'Autoatendimento. A resposta traz sua chave de API uma vez e nunca mais — guardamos só o hash dela, então nada consegue devolvê-la a você depois.',
                            'Autoservicio. La respuesta trae su clave de API una vez y nunca más — guardamos solo su hash, así que nada puede devolvérsela después.')}
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

                <Passo n={2} titulo={tri('Call us when you pay a user', 'Chame a gente quando pagar um usuário',
                                         'Llámenos cuando pague a un usuario')}>
                    <p className="text-white/50 text-sm leading-relaxed mb-3">
                        {tri(
                            'The click you already serve. We credit $CLAIM to that user and draw from every campaign your faucet carries, in the same call.',
                            'O clique que você já atende. Creditamos $CLAIM àquele usuário e sacamos de todas as campanhas que sua torneira carrega, na mesma chamada.',
                            'El clic que usted ya atiende. Acreditamos $CLAIM a ese usuario y retiramos de todas las campañas que su grifo lleva, en la misma llamada.')}
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

                <Passo n={3} titulo={tri('Ask what you can pay, before you promise it',
                                         'Pergunte o que dá para pagar, antes de prometer',
                                         'Pregunte lo que puede pagar, antes de prometerlo')}>
                    <p className="text-white/50 text-sm leading-relaxed mb-3">
                        {tri(
                            'What each campaign pays per click right now, and when it pays nothing, why. Build your screen from this instead of discovering a dry campaign in the claim that failed.',
                            'Quanto cada campanha paga por clique agora, e quando não paga nada, por quê. Monte sua tela a partir disto em vez de descobrir campanha seca no claim que falhou.',
                            'Cuánto paga cada campaña por clic ahora, y cuando no paga nada, por qué. Arme su pantalla a partir de esto en lugar de descubrir una campaña seca en el claim que falló.')}
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
                    {tri('Why you would trust this', 'Por que confiar nisto',
                         'Por qué confiar en esto')}
                </h2>
                <p className="text-white/50 text-sm leading-relaxed mb-6">
                    {tri(
                        'The usual answer is a promise. Ours is an endpoint: what every faucet on this network holds against what it owes its users, published whether it flatters us or not.',
                        'A resposta de sempre é uma promessa. A nossa é um endpoint: o que cada torneira desta rede guarda contra o que ela deve aos usuários, publicado nos favoreça ou não.',
                        'La respuesta de siempre es una promesa. La nuestra es un endpoint: lo que cada grifo de esta red guarda contra lo que debe a sus usuarios, publicado nos favorezca o no.')}
                </p>

                {solvencia && (
                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                        <div className="flex flex-wrap gap-6 mb-5">
                            <div>
                                <p className="text-2xl font-black tabular-nums">{solvencia.reserve.toLocaleString('en-US')}</p>
                                <p className="text-white/40 text-[10px] uppercase tracking-[0.14em] font-bold">{tri('$CLAIM held', '$CLAIM guardado', '$CLAIM guardado')}</p>
                            </div>
                            <div>
                                <p className="text-2xl font-black tabular-nums">{solvencia.obligations.toLocaleString('en-US')}</p>
                                <p className="text-white/40 text-[10px] uppercase tracking-[0.14em] font-bold">{tri('owed to users', 'devido aos usuários', 'debido a los usuarios')}</p>
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
                    {tri('FaucetChain runs as a public testnet and settles campaign tokens on Solana',
                         'A FaucetChain roda como testnet público e liquida tokens de campanha na',
                         'FaucetChain funciona como testnet público y liquida tokens de campaña en')}
                    <strong className="text-white/50"> devnet</strong>
                    {tri('.', ' da Solana.', ' de Solana.')}{' '}
                    {tri(
                        'The tokens in the vaults above are devnet tokens: they are real on the chain and they are not money. Integrate now to be ready and to shape what this becomes — not for the value of what it pays today.',
                        'Os tokens nos cofres acima são tokens de devnet: eles são reais na cadeia e não são dinheiro. Integre agora para estar pronto e para moldar o que isto vira — não pelo valor do que ele paga hoje.',
                        'Los tokens en las bóvedas de arriba son tokens de devnet: son reales en la cadena y no son dinero. Integre ahora para estar listo y para moldear en qué se convierte esto — no por el valor de lo que paga hoy.')}
                </footer>
            </div>
        </div>
    );
};

export default ConnectYourFaucet;
