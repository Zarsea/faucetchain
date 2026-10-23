import React, { useCallback, useEffect, useState } from 'react';
import { SectionCard } from './SectionCard';
import { ArrowUpRightIcon, CubeIcon, LoadingIcon, ShieldCheckIcon } from './IconComponents';
import { API_BASE_URL } from '../apiConfig';
import { useLanguage } from './LanguageContext';

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

/** Um saque segundo a Solana, com ou sem assinatura guardada por nós. */
interface Collected {
    recipient: string;
    amount: number;
    root_index: number;
    leaf_index: number;
    signature: string | null;
    paid_at: number | null;
    relayed: boolean;
}

interface Ledger {
    campaign_id: number;
    sponsor: string;
    mint: string;
    batches: Batch[];
    payouts: Payout[];
    paid_total: number;
    paid_recipients: number;
    // Montado do bitmap de cada raiz, então cobre também quem pagou a própria
    // taxa e nunca passou pelo nosso relayer. `null` quando nenhuma raiz pôde
    // ser lida: lista vazia aqui significa "ninguém sacou", e isso só a cadeia
    // pode afirmar.
    collected: Collected[] | null;
    collected_total: number | null;
    collected_recipients: number | null;
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
    const { tri } = useLanguage();
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
                    {tri(
                        'No campaign has been registered on this sequencer yet. Once a partner funds a vault, everything it owes and everything it has paid shows up here — read from Solana, not from this server.',
                        'Nenhuma campanha foi registrada neste sequenciador ainda. Quando um parceiro financiar um cofre, tudo o que ele deve e tudo o que já pagou aparece aqui — lido da Solana, não deste servidor.',
                        'Ninguna campaña fue registrada en este secuenciador todavía. Cuando un socio financie una bóveda, todo lo que debe y todo lo que ya pagó aparece aquí — leído de Solana, no de este servidor.')}
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
                                {tri('Campaign', 'Campanha', 'Campaña')} {ledger.campaign_id}{' '}
                                {tri('pays', 'paga', 'paga')}{' '}
                                {ledger.token ? (
                                    <span className="text-brand-primary">
                                        {ledger.token.name}
                                        {ledger.token.symbol && ` (${ledger.token.symbol})`}
                                    </span>
                                ) : (
                                    <span className="text-yellow-400">
                                        {tri('an unnamed token', 'um token sem nome', 'un token sin nombre')}
                                    </span>
                                )}
                            </p>
                        )}
                        <p className="text-brand-muted mt-3 max-w-2xl leading-relaxed">
                            {tri(
                                "Every figure below comes from the campaign's accounts on Solana. The sequencer only supplies the addresses, so you can open the explorer and recompute the same numbers without trusting it.",
                                'Cada número abaixo vem das contas da campanha na Solana. O sequenciador só fornece os endereços, então dá para abrir o explorador e refazer as mesmas contas sem confiar nele.',
                                'Cada número de abajo viene de las cuentas de la campaña en Solana. El secuenciador solo aporta las direcciones, así que se puede abrir el explorador y rehacer las mismas cuentas sin confiar en él.')}
                        </p>
                        {ledger && !ledger.token && (
                            <p className="text-yellow-200/80 text-xs mt-3 max-w-2xl leading-relaxed">
                                {tri(
                                    "This mint has no Metaplex metadata, so it has no name, symbol or logo anywhere on Solana — not here, and not in the wallet of whoever receives it. Creating that metadata is the sponsor's to do; until then the address below is the only thing that identifies it.",
                                    'Este mint não tem metadados Metaplex, então não tem nome, símbolo nem logo em lugar nenhum da Solana — nem aqui, nem na carteira de quem o recebe. Criar esses metadados cabe ao patrocinador; até lá o endereço abaixo é a única coisa que o identifica.',
                                    'Este mint no tiene metadatos Metaplex, así que no tiene nombre, símbolo ni logo en ninguna parte de Solana — ni aquí, ni en la billetera de quien lo recibe. Crear esos metadatos le toca al patrocinador; hasta entonces la dirección de abajo es lo único que lo identifica.')}
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
                    {tri(
                        'Solana could not be read right now, so only what the sequencer recorded is shown below. Those numbers are a claim, not proof — come back when the chain answers.',
                        'A Solana não pôde ser lida agora, então abaixo está só o que o sequenciador registrou. Esses números são afirmação, não prova — volte quando a cadeia responder.',
                        'Solana no pudo ser leída ahora, así que abajo está solo lo que el secuenciador registró. Esos números son afirmación, no prueba — vuelva cuando la cadena responda.')}
                </div>
            )}

            {state && (
                <SectionCard title={tri('The vault', 'O cofre', 'La bóveda')}
                             icon={<ShieldCheckIcon className="w-6 h-6" />}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Figure label={tri('In the vault', 'No cofre', 'En la bóveda')}
                                value={amount(state.vault_amount)}
                                hint={tri('tokens held right now', 'tokens guardados neste instante',
                                          'tokens guardados en este instante')} />
                        <Figure label={tri('Promised', 'Prometido', 'Prometido')}
                                value={amount(outstanding)}
                                hint={tri('published and not collected', 'publicado e não sacado',
                                          'publicado y no cobrado')} />
                        <Figure label={tri('Collected', 'Sacado', 'Cobrado')}
                                value={amount(state.paid)}
                                hint={tri('withdrawn by users, read from Solana',
                                          'sacado pelos usuários, lido da Solana',
                                          'retirado por los usuarios, leído de Solana')} />
                        <Figure label={tri('Funded', 'Financiado', 'Financiado')}
                                value={amount(state.funded)}
                                hint={tri('deposited by the partner', 'depositado pelo parceiro',
                                          'depositado por el socio')} />
                    </div>
                    <div className="mt-6 space-y-2 text-sm text-brand-muted">
                        <p>
                            {tri('The vault covers what is promised', 'O cofre cobre o que foi prometido',
                                 'La bóveda cubre lo prometido')}{' '}
                            {state.vault_amount >= outstanding ? (
                                <span className="text-green-400 font-bold">
                                    — {amount(state.vault_amount)}{' '}
                                    {tri('against', 'contra', 'contra')} {amount(outstanding)}
                                </span>
                            ) : (
                                <span className="text-red-400 font-bold">
                                    — {tri('it does not:', 'não cobre:', 'no cubre:')}{' '}
                                    {amount(state.vault_amount)}{' '}
                                    {tri('against', 'contra', 'contra')} {amount(outstanding)}
                                </span>
                            )}
                            . {tri('The program enforces this before accepting any new root.',
                                   'O programa exige isso antes de aceitar qualquer raiz nova.',
                                   'El programa lo exige antes de aceptar cualquier raíz nueva.')}
                        </p>
                        <p>{state.closed
                            ? tri('This campaign is closed to new roots.',
                                  'Esta campanha está fechada para raízes novas.',
                                  'Esta campaña está cerrada a raíces nuevas.')
                            : tri('This campaign is open to new roots.',
                                  'Esta campanha está aberta para raízes novas.',
                                  'Esta campaña está abierta a raíces nuevas.')}</p>
                    </div>
                </SectionCard>
            )}

            {state && ledger && (
                <SectionCard title={tri('What each address is', 'O que é cada endereço',
                                        'Qué es cada dirección')}
                             icon={<CubeIcon className="w-6 h-6" />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Address
                            role={tri('Program', 'Programa', 'Programa')}
                            address={state.program}
                            what={tri(
                                'The Anchor program that refuses to publish a root its vault cannot cover. The guarantee lives here, not on the appchain.',
                                'O programa Anchor que recusa publicar raiz que o cofre dele não cobre. A garantia mora aqui, não na appchain.',
                                'El programa Anchor que rechaza publicar una raíz que su bóveda no cubre. La garantía vive aquí, no en la appchain.')}
                        />
                        <Address
                            role={tri('Campaign', 'Campanha', 'Campaña')}
                            address={state.address}
                            what={tri(
                                "This campaign's account. Holds what has been funded, promised and paid, and the roots published so far.",
                                'A conta desta campanha. Guarda o que foi financiado, prometido e pago, e as raízes publicadas até agora.',
                                'La cuenta de esta campaña. Guarda lo financiado, lo prometido y lo pagado, y las raíces publicadas hasta ahora.')}
                        />
                        <Address
                            role={tri('Vault', 'Cofre', 'Bóveda')}
                            address={state.vault}
                            what={tri(
                                "The token account holding the sponsor's budget. Every withdrawal is paid out of this.",
                                'A conta de token que guarda o orçamento do patrocinador. Todo saque sai daqui.',
                                'La cuenta de token que guarda el presupuesto del patrocinador. Todo retiro sale de aquí.')}
                        />
                        <Address
                            role={ledger.token
                                ? `Mint — ${ledger.token.symbol || ledger.token.name}`
                                : `Mint — ${tri('unnamed', 'sem nome', 'sin nombre')}`}
                            address={ledger.mint}
                            what={ledger.token
                                ? `${tri('The token this campaign pays:', 'O token que esta campanha paga:', 'El token que esta campaña paga:')} ${ledger.token.name}. ${tri('This is what carries value to the user; $CLAIM does not.', 'É isto que carrega valor para o usuário; $CLAIM não carrega.', 'Esto es lo que carga valor para el usuario; $CLAIM no.')}`
                                : tri(
                                    'The token this campaign pays. It carries no name on Solana, so wallets and explorers show only this address.',
                                    'O token que esta campanha paga. Ele não tem nome na Solana, então carteiras e exploradores mostram só este endereço.',
                                    'El token que esta campaña paga. No tiene nombre en Solana, así que billeteras y exploradores muestran solo esta dirección.')}
                        />
                        <Address
                            role={tri('Sponsor', 'Patrocinador', 'Patrocinador')}
                            address={ledger.sponsor}
                            what={tri(
                                'The wallet that opened the campaign and funded the vault. It can reclaim only the surplus, never a promised reward.',
                                'A carteira que abriu a campanha e financiou o cofre. Ela só pode retomar o excedente, nunca uma recompensa prometida.',
                                'La billetera que abrió la campaña y financió la bóveda. Solo puede recuperar el excedente, nunca una recompensa prometida.')}
                        />
                        <Address
                            role={tri('Operator', 'Operador', 'Operador')}
                            address={state.operator}
                            what={tri(
                                'The key allowed to publish roots for this campaign. It cannot move money, only commit to paying it.',
                                'A chave autorizada a publicar raízes desta campanha. Ela não move dinheiro, só se compromete a pagá-lo.',
                                'La clave autorizada a publicar raíces de esta campaña. No mueve dinero, solo se compromete a pagarlo.')}
                        />
                    </div>
                </SectionCard>
            )}

            <SectionCard
                title={`${tri('Collected', 'Sacados', 'Cobrados')} (${ledger?.collected?.length ?? 0})`}
                icon={<CubeIcon className="w-6 h-6" />}
            >
                <p className="text-sm text-brand-muted mb-4 max-w-3xl">
                    {tri(
                        "Who actually withdrew, rebuilt from the claimed bitmap on each published root. It counts every withdrawal Solana accepted, not only the ones this server's relayer signed. A published root says what the campaign owes; this table says what left the vault.",
                        'Quem de fato sacou, remontado do bitmap de saque de cada raiz publicada. Conta todo saque que a Solana aceitou, não só os que o relayer deste servidor assinou. Uma raiz publicada diz o que a campanha deve; esta tabela diz o que saiu do cofre.',
                        'Quién de hecho retiró, rearmado del bitmap de cobro de cada raíz publicada. Cuenta todo retiro que Solana aceptó, no solo los que firmó el relayer de este servidor. Una raíz publicada dice lo que la campaña debe; esta tabla dice lo que salió de la bóveda.')}
                </p>

                {/* Esta secao lia so `payouts`, que vem de relayer_spend e so ganha
                    linha quando o NOSSO relayer assina e paga a taxa. Quem paga a
                    propria taxa liquida na Solana sem passar por aqui, entao sumia
                    daqui -- e a campanha 711670 negava qualquer saque logo embaixo
                    de "Collected 350,00" lido da cadeia, as duas frases certas
                    sobre fontes diferentes.
                    O dado nunca faltou: o bit do leaf esta ligado na conta da raiz
                    e a arvore diz de quem ele e. `collected` cruza os dois, entao
                    a lista passa a ser completa e a assinatura vira uma COLUNA, em
                    vez de ser o que decide se a linha existe. */}
                {ledger?.collected == null ? (
                    <p className="text-brand-muted">
                        {tri(
                            'Solana could not be read just now, so who collected is an open question. This table is built from the chain, and an empty list here would be a claim this server is in no position to make.',
                            'A Solana não pôde ser lida agora, então quem sacou é pergunta em aberto. Esta tabela é montada da cadeia, e lista vazia aqui seria uma afirmação que este servidor não tem como fazer.',
                            'Solana no pudo ser leída ahora, así que quién cobró es una pregunta abierta. Esta tabla se arma de la cadena, y una lista vacía aquí sería una afirmación que este servidor no está en posición de hacer.')}
                    </p>
                ) : ledger.collected.length === 0 ? (
                    <p className="text-brand-muted">
                        {tri(
                            'Solana reports nothing collected on this campaign. The roots below promise value that is still waiting.',
                            'A Solana informa que nada foi sacado nesta campanha. As raízes abaixo prometem valor que continua esperando.',
                            'Solana informa que nada fue cobrado en esta campaña. Las raíces de abajo prometen valor que sigue esperando.')}
                    </p>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-6 mb-4 text-sm">
                            <span className="text-brand-muted">
                                {tri('collected', 'sacado', 'cobrado')}{' '}
                                <span className="text-white font-mono font-bold tabular-nums">
                                    {amount(ledger.collected_total ?? 0)}
                                </span>
                            </span>
                            <span className="text-brand-muted">
                                {tri('recipients', 'destinatários', 'destinatarios')}{' '}
                                <span className="text-white font-mono font-bold">
                                    {ledger.collected_recipients ?? 0}
                                </span>
                            </span>
                            <span className="text-brand-muted">
                                {tri('of which relayed by us', 'destes, pelo nosso relayer',
                                     'de estos, por nuestro relayer')}{' '}
                                <span className="text-white font-mono font-bold">
                                    {ledger.collected.filter((x) => x.relayed).length}
                                </span>
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[640px]">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-widest text-brand-muted">
                                        <th className="py-2 pr-4">{tri('to', 'para', 'a')}</th>
                                        <th className="py-2 pr-4 text-right">{tri('units', 'unidades', 'unidades')}</th>
                                        <th className="py-2 pr-4">{tri('root', 'raiz', 'raíz')}</th>
                                        <th className="py-2">{tri('proof we hold', 'prova que temos',
                                                                  'prueba que tenemos')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledger.collected.map((p) => (
                                        <tr
                                            key={`${p.root_index}-${p.leaf_index}`}
                                            className="border-t border-brand-border/40"
                                        >
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
                                                {p.signature ? (
                                                    <a
                                                        href={`${EXPLORER}/tx/${p.signature}?cluster=devnet`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-brand-primary hover:underline"
                                                    >
                                                        {p.signature.slice(0, 12)}… ↗
                                                    </a>
                                                ) : (
                                                    <span className="text-brand-muted">
                                                        {tri('paid their own fee — no signature here',
                                                             'pagou a própria taxa — sem assinatura aqui',
                                                             'pagó su propia comisión — sin firma aquí')}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </SectionCard>

            <SectionCard title={`${tri('Published roots', 'Raízes publicadas', 'Raíces publicadas')} (${ledger?.batches.length ?? 0})`}
                         icon={<CubeIcon className="w-6 h-6" />}>
                {!ledger || ledger.batches.length === 0 ? (
                    <p className="text-brand-muted">
                        {tri('No batch has been closed for this campaign yet.',
                             'Nenhum lote foi fechado para esta campanha ainda.',
                             'Ningún lote fue cerrado para esta campaña todavía.')}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[640px]">
                            <thead>
                                <tr className="text-brand-muted text-xs uppercase tracking-widest text-left">
                                    <th className="pb-3 pr-4 font-medium">{tri('Root', 'Raiz', 'Raíz')}</th>
                                    <th className="pb-3 pr-4 font-medium">{tri('Leaves', 'Leaves', 'Hojas')}</th>
                                    <th className="pb-3 pr-4 font-medium text-right">{tri('Promised', 'Prometido', 'Prometido')}</th>
                                    <th className="pb-3 pr-4 font-medium text-right">{tri('Collected', 'Sacado', 'Cobrado')}</th>
                                    <th className="pb-3 font-medium">{tri('On Solana', 'Na Solana', 'En Solana')}</th>
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
                                                    {tri('Transaction', 'Transação', 'Transacción')}{' '}
                                                    <ArrowUpRightIcon className="w-3 h-3" />
                                                </a>
                                            ) : (
                                                <span className="text-yellow-400/80">
                                                    {tri('not published yet', 'ainda não publicada',
                                                         'todavía no publicada')}
                                                </span>
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
