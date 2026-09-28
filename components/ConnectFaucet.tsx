/**
 * Conectar uma torneira externa à FaucetChain.
 *
 * O formulário que existia no FaucetHub pedia para o operador DIGITAR o
 * endereço da carteira dona da torneira. Foi assim que a FaucetHunter acabou
 * registrada sob 0x7a9c4b1e…5a09, um endereço que ninguém controla: revelar e
 * rotacionar a chave exigem assinatura ou sessão daquela conta, então se a
 * chave vazar o dono não consegue trocá-la — só o operador do sequenciador,
 * mexendo no banco.
 *
 * Aqui a torneira nasce ligada à conta em que a pessoa está logada. Não há
 * campo de endereço porque não deve haver escolha: a conta que registra é a
 * que vai precisar mandar na chave depois.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { SectionCard } from './SectionCard';
import {
    CubeIcon, ShieldCheckIcon, SparklesIcon, BoltIcon,
    LoadingIcon, ChartBarIcon, SignalIcon,
} from './IconComponents';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { API_BASE_URL } from '../apiConfig';

interface MyFaucet {
    name: string;
    wallet_address: string;
    liquidity: number;
    status: string;
    settlements: number;
    volume_settled: number;
    registered_at: number;
}

const Step: React.FC<{ n: number; done: boolean; title: string; children: React.ReactNode }> =
    ({ n, done, title, children }) => (
    <div className="grid grid-cols-[28px_1fr] gap-4">
        <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-black font-mono flex-none ${
            done ? 'bg-brand-success text-brand-bg' : 'bg-brand-surface border border-brand-border text-brand-muted'
        }`}>
            {done ? '✓' : n}
        </div>
        <div className={done ? 'opacity-60' : ''}>
            <h4 className="text-sm font-bold text-white mb-1">{title}</h4>
            <div className="text-sm text-brand-muted leading-relaxed space-y-2">{children}</div>
        </div>
    </div>
);

const Snippet: React.FC<{ label: string; code: string }> = ({ label, code }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
        try {
            navigator.clipboard?.writeText(code).then(done, done);
        } catch { done(); }
    };
    return (
        <div className="rounded-xl overflow-hidden border border-brand-border/60 bg-brand-bg">
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-brand-border/60">
                <span className="font-mono text-[10px] text-brand-muted truncate">{label}</span>
                <button onClick={copy}
                    className="flex-none text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-brand-surface text-brand-secondary hover:text-white transition-colors">
                    {copied ? 'copiado' : 'copiar'}
                </button>
            </div>
            <pre className="p-3 overflow-x-auto"><code className="font-mono text-[11.5px] text-brand-secondary whitespace-pre">{code}</code></pre>
        </div>
    );
};

export const ConnectFaucet: React.FC = () => {
    const { isConnected, userAddress } = useAuth();
    const { lang } = useLanguage();
    const pt = lang !== 'en';

    const [mine, setMine] = useState<MyFaucet[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [freshKey, setFreshKey] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!userAddress) { setMine([]); setLoading(false); return; }
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/faucets`);
            const all: MyFaucet[] = res.ok ? await res.json() : [];
            setMine(all.filter(f => f.wallet_address?.toLowerCase() === userAddress.toLowerCase()));
        } catch {
            setMine([]);
        } finally {
            setLoading(false);
        }
    }, [userAddress]);

    useEffect(() => { load(); }, [load]);

    const register = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setBusy(true); setFreshKey(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Sem campo de endereço: a torneira nasce na conta logada, que é
                // a única que consegue revelar ou rotacionar a chave depois.
                body: JSON.stringify({ name, wallet_address: userAddress }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || (pt ? 'Não foi possível registrar.' : 'Could not register.'));
            setFreshKey(data.api_key);
            setName('');
            load();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const registered = mine.length > 0;
    const hasTraffic = mine.some(f => f.settlements > 0 || f.status === 'Ativa');

    if (!isConnected) {
        return (
            <SectionCard title={pt ? 'Conectar sua torneira' : 'Connect your faucet'} icon={<CubeIcon className="w-5 h-5 text-brand-primary" />}>
                <p className="text-sm text-brand-muted leading-relaxed max-w-2xl">
                    {pt
                        ? 'Entre com sua carteira ou e-mail primeiro. A torneira fica ligada à conta que a registra — é essa conta que vai poder ver e trocar a chave de API depois, então não dá para registrar em nome de ninguém.'
                        : 'Sign in with your wallet or email first. A faucet is bound to the account that registers it, because that account is what can reveal and rotate the API key later, so there is nobody to register on behalf of.'}
                </p>
            </SectionCard>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <SectionCard title={pt ? 'Conectar sua torneira' : 'Connect your faucet'} icon={<CubeIcon className="w-5 h-5 text-brand-primary" />}>
                <div className="space-y-6">
                    <p className="text-sm text-brand-muted leading-relaxed max-w-2xl">
                        {pt
                            ? 'Um clique na sua torneira passa a valer duas vezes: o usuário recebe o que já recebe de você, e a parte que lhe cabe do orçamento das campanhas de parceiros. Esse valor sai do bolso do patrocinador, nunca do seu.'
                            : 'A click on your faucet starts paying twice: your user gets what you already give them, plus their share of a partner campaign budget. That second amount comes from the sponsor, never from you.'}
                    </p>

                    <div className="space-y-5">
                        <Step n={1} done={registered} title={pt ? 'Registrar a torneira' : 'Register the faucet'}>
                            {registered ? (
                                <p>{pt ? 'Feito. Suas torneiras estão listadas abaixo.' : 'Done. Your faucets are listed below.'}</p>
                            ) : (
                                <>
                                    <p>
                                        {pt
                                            ? 'Ela nasce ligada a esta conta. Não há campo de endereço de propósito: quem registra é quem vai poder trocar a chave se ela vazar.'
                                            : 'It is bound to this account. There is no address field on purpose: whoever registers is who can rotate the key if it leaks.'}
                                    </p>
                                    <p className="font-mono text-[11px] text-brand-secondary break-all bg-brand-bg/60 rounded-lg px-3 py-2">
                                        {userAddress}
                                    </p>
                                    <form onSubmit={register} className="flex gap-2 flex-wrap pt-1">
                                        <input
                                            id="faucet-name"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            required
                                            placeholder={pt ? 'Nome da sua torneira' : 'Your faucet name'}
                                            className="flex-1 min-w-[200px] bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-brand-primary transition-colors"
                                        />
                                        <button type="submit" disabled={busy || !name.trim()}
                                            className="flex-none bg-brand-primary text-brand-bg font-black text-sm px-6 py-3 rounded-xl hover:bg-white transition-colors disabled:opacity-40">
                                            {busy ? '…' : (pt ? 'Registrar' : 'Register')}
                                        </button>
                                    </form>
                                    {error && <p className="text-brand-error text-sm">{error}</p>}
                                </>
                            )}
                        </Step>

                        {freshKey && (
                            <div className="rounded-xl border border-brand-success/40 bg-brand-success/5 p-4 space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-success">
                                    {pt ? 'Sua chave — mostrada uma vez só' : 'Your key — shown once'}
                                </p>
                                <Snippet label={pt ? 'guarde agora' : 'save it now'} code={freshKey} />
                                <p className="text-xs text-brand-muted leading-relaxed">
                                    {pt
                                        ? 'Quem tem essa chave distribui em seu nome. Ela não aparece de novo: para vê-la outra vez você assina com esta conta, e para trocá-la também.'
                                        : 'Whoever holds this key distributes in your name. It is not shown again: seeing it later takes a signature from this account, and so does replacing it.'}
                                </p>
                            </div>
                        )}

                        <Step n={2} done={false} title={pt ? 'Guardar a chave no seu servidor' : 'Put the key on your server'}>
                            <p>
                                {pt
                                    ? 'Fora da pasta pública, como qualquer segredo. A ponte lê as duas variáveis abaixo e fica inerte enquanto elas não existirem — de propósito, melhor desligada do que meio ligada.'
                                    : 'Outside the public folder, like any secret. The bridge reads the two variables below and stays inert until they exist — on purpose, better off than half on.'}
                            </p>
                            <Snippet label="secrets.php" code={`putenv('FAUCETCHAIN_URL=${API_BASE_URL}');\nputenv('FAUCETCHAIN_KEY=fch_…');`} />
                        </Step>

                        <Step n={3} done={false} title={pt ? 'Uma chamada, depois do seu commit' : 'One call, after your own commit'}>
                            <p>
                                {pt
                                    ? 'É a integração inteira. Depois do seu commit, com o erro engolido: se a FaucetChain estiver fora, seu usuário recebe o claim dele e ninguém fica sabendo.'
                                    : 'That is the whole integration. After your commit, with the error swallowed: if FaucetChain is down your user still gets paid and nobody finds out.'}
                            </p>
                            <Snippet label="POST /api/faucethub/microclaim" code={`curl -X POST ${API_BASE_URL}/api/faucethub/microclaim \\\n  -H "X-Api-Key: fch_…" \\\n  -H "Content-Type: application/json" \\\n  -d '{"user_wallet":"<carteira Solana do usuario>","amount":1.0}'`} />
                            <p className="text-xs">
                                {pt
                                    ? 'A resposta traz campaigns. Lista vazia é sucesso: significa que sua torneira ainda não está inscrita em campanha nenhuma. 429 é o cooldown de 5 minutos, não erro.'
                                    : 'The reply carries campaigns. An empty list is success: it means your faucet is enrolled in none yet. A 429 is the five-minute cooldown, not a failure.'}
                            </p>
                        </Step>

                        <Step n={4} done={hasTraffic} title={pt ? 'Um clique de verdade' : 'A real click'}>
                            <p>
                                {pt
                                    ? 'A partir daí a FaucetChain credita o usuário do orçamento da campanha, e o que é devido vira uma raiz de Merkle publicada na Solana — o programa recusa publicar raiz que o vault não cubra.'
                                    : 'From there FaucetChain credits the user from the campaign budget, and what is owed becomes a Merkle root published on Solana — the program refuses to publish a root its vault cannot cover.'}
                            </p>
                        </Step>
                    </div>
                </div>
            </SectionCard>

            {loading ? (
                <div className="flex items-center gap-2 text-brand-muted text-sm"><LoadingIcon className="w-4 h-4" /> …</div>
            ) : registered && (
                <SectionCard title={pt ? 'Suas torneiras' : 'Your faucets'} icon={<ShieldCheckIcon className="w-5 h-5 text-brand-success" />}>
                    <div className="space-y-3">
                        {mine.map(f => (
                            <div key={f.wallet_address} className="rounded-xl border border-brand-border/50 bg-brand-bg/40 p-4">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div>
                                        <p className="font-bold text-white">{f.name}</p>
                                        <p className="font-mono text-[11px] text-brand-muted break-all mt-0.5">{f.wallet_address}</p>
                                    </div>
                                    <span className={`flex-none text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                                        f.status === 'Ativa'
                                            ? 'text-brand-success bg-brand-success/10'
                                            : 'text-brand-muted bg-brand-surface'
                                    }`}>
                                        {f.status === 'Ativa' ? (pt ? 'recebendo cliques' : 'taking clicks') : (pt ? 'sem tráfego ainda' : 'no traffic yet')}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">{pt ? 'Liquidações' : 'Settlements'}</p>
                                        <p className="font-mono text-lg font-black text-white tabular-nums">{f.settlements}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">{pt ? 'Volume liquidado' : 'Volume settled'}</p>
                                        <p className="font-mono text-lg font-black text-white tabular-nums">{f.volume_settled.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-muted">{pt ? 'Registrada em' : 'Registered'}</p>
                                        <p className="font-mono text-sm text-brand-secondary pt-1">
                                            {new Date(f.registered_at * 1000).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <p className="text-xs text-brand-muted leading-relaxed pt-1">
                            {pt
                                ? 'Liquidação é quando você move o seu próprio $CLAIM para um usuário — é o modelo antigo e continua funcionando. As recompensas de campanha não passam por aqui: elas saem do orçamento do patrocinador e são sacadas pelo usuário contra a Solana.'
                                : 'A settlement is you moving your own $CLAIM to a user — the original model, still working. Campaign rewards do not pass through here: they come from the sponsor budget and the user withdraws them against Solana.'}
                        </p>
                    </div>
                </SectionCard>
            )}

            <SectionCard title={pt ? 'O que ainda não existe' : 'What does not exist yet'} icon={<SparklesIcon className="w-5 h-5 text-brand-muted" />}>
                <ul className="text-sm text-brand-muted leading-relaxed space-y-2 list-disc pl-5 max-w-2xl">
                    <li>
                        {pt
                            ? 'Inscrever a sua torneira numa campanha é decisão do patrocinador, não sua, e hoje passa pelo operador da rede. Uma torneira não entra sozinha no orçamento de ninguém.'
                            : 'Enrolling your faucet in a campaign is the sponsor\'s call, not yours, and today it goes through the network operator. A faucet cannot opt itself into somebody else\'s budget.'}
                    </li>
                    <li>
                        {pt
                            ? 'Não há fiança nem reputação: registrar é grátis, e por isso o patrocinador ainda não tem motivo técnico para confiar numa torneira nova.'
                            : 'There is no bond and no reputation: registering is free, which is why a sponsor has no technical reason yet to trust a new faucet.'}
                    </li>
                </ul>
            </SectionCard>
        </div>
    );
};

export default ConnectFaucet;
