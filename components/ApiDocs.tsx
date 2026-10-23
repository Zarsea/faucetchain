
import React from 'react';
import { SectionCard } from './SectionCard';
import { CodeBracketIcon, GlobeAltIcon, ShieldCheckIcon } from './IconComponents';
import { useLanguage } from './LanguageContext';
import { diagrams, REPO_URL } from '../constants';
import { MermaidDiagram } from './MermaidDiagram';

/** O comando de instalacao, com copia. Nao reusa o Copiavel da pagina do
 *  operador de proposito: aquela tela tem paleta propria (white/10 e cyan) e
 *  esta usa os tokens brand-*. Um componente compartilhado entre as duas
 *  carregaria as duas paletas para sempre. */
const ComandoDoAgente: React.FC<{ texto: string; rotulo: string }> = ({ texto, rotulo }) => {
    const [copiado, setCopiado] = React.useState(false);
    return (
        <div className="bg-brand-bg border border-brand-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-brand-border/60">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-muted">{rotulo}</span>
                <button
                    onClick={() => {
                        navigator.clipboard?.writeText(texto).then(
                            () => { setCopiado(true); setTimeout(() => setCopiado(false), 1600); },
                            () => undefined,   // area de transferencia bloqueada nao quebra a pagina
                        );
                    }}
                    className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-primary hover:text-brand-secondary transition-colors min-h-[44px] md:min-h-[28px] px-2"
                >
                    {copiado ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre className="px-4 py-3 overflow-x-auto text-[12px] leading-relaxed font-mono text-brand-primary">{texto}</pre>
        </div>
    );
};

export const ApiDocs: React.FC = () => {
    const { lang } = useLanguage();
    // O padrão do projeto, e com ele a limitação do projeto: quem escolhe
    // espanhol recebe português. A correção disso é maior do que esta tela.
    // `es` opcional: as 22 chamadas abaixo ainda passam duas linguas, e sem este
    // terceiro ramo todas elas devolviam PORTUGUES para quem pediu espanhol.
    // Agora devolvem ingles, que e a falta honesta. Escrever o espanhol de cada
    // uma passa a ser trabalho aditivo, uma chamada por vez.
    const T = (en: string, pt: string, es?: string) =>
        lang === 'pt' ? pt : lang === 'es' ? (es ?? en) : en;

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="animate-fadeIn">
                <h2 className="text-3xl font-bold text-brand-secondary mb-4">
                    {T('FaucetHub API', 'API do FaucetHub', 'API de FaucetHub')}
                </h2>
                <p className="text-brand-muted mb-6 text-lg leading-relaxed">
                    {T(
                        'Two calls connect a faucet to FaucetChain: one to register and get a key, one per claim. ' +
                        'The second runs after your own payout is already recorded, so nothing you owe a user ever waits on us.',
                        'Duas chamadas conectam uma torneira à FaucetChain: uma para registrar e receber a chave, ' +
                        'uma por claim. A segunda roda depois que o seu pagamento já foi registrado, então nada que ' +
                        'você deve ao usuário espera por nós.',
                        'Dos llamadas conectan un grifo a FaucetChain: una para registrar y recibir la clave, ' +
                        'una por claim. La segunda corre después de que su pago ya quedó registrado, así que nada que ' +
                        'usted debe al usuario espera por nosotros.'
                    )}
                </p>
            </div>

            {/* Antes dos endpoints de proposito: quem integra hoje costuma estar com
                um agente aberto, e entregar a integracao inteira de uma vez e mais
                curto do que o agente ler esta pagina. */}
            <div className="animate-fadeIn p-6 rounded-2xl bg-brand-card/40 border border-brand-primary/30">
                <h3 className="text-lg font-bold text-brand-secondary mb-1">
                    {T('Start with an agent', 'Comece pelo agente', 'Empiece por el agente')}
                </h3>
                <p className="text-sm text-brand-muted leading-relaxed mb-4">
                    {T(
                        'One command installs a skill that carries this whole integration: the request shapes, ' +
                        'the webhook signature, and the four mistakes that cost your users money. Your agent ' +
                        'reads it and writes the integration against it.',
                        'Um comando instala uma skill com esta integração inteira: os formatos de requisição, ' +
                        'a assinatura dos webhooks e os quatro erros que custam dinheiro dos seus usuários. ' +
                        'Seu agente lê e escreve a integração a partir dela.',
                        'Un comando instala una skill con esta integración entera: los formatos de petición, ' +
                        'la firma de los webhooks y los cuatro errores que cuestan dinero a sus usuarios. ' +
                        'Su agente la lee y escribe la integración a partir de ella.'
                    )}
                </p>
                <ComandoDoAgente rotulo="Agent CLI" texto="npx skills add Zarsea/faucetchain" />
                {/* O comando acima instala do repositorio; faltava o link para ele.
                    Quem prefere ler antes de instalar nao tinha para onde ir. */}
                <a
                    href={REPO_URL} target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-brand-primary hover:text-brand-secondary transition-colors min-h-[32px]"
                >
                    <svg viewBox="0 0 16 16" className="w-4 h-4 flex-none" fill="currentColor" aria-hidden="true">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                    </svg>
                    {T('Read the skill on GitHub', 'Ler a skill no GitHub', 'Leer la skill en GitHub')} ↗
                </a>
                <p className="text-[11px] text-brand-muted/80 leading-relaxed mt-3">
                    {T(
                        'Works with Claude Code, Codex and anything else that reads SKILL.md. Add -g to install it ' +
                        'for every project instead of this one. The skill ships check.py, which asserts its own ' +
                        'promises against this API — run it before you trust what it told your agent.',
                        'Funciona com Claude Code, Codex e qualquer outro que leia SKILL.md. Use -g para instalar ' +
                        'em todos os projetos em vez de um. A skill traz check.py, que confere as próprias promessas ' +
                        'contra esta API — rode antes de confiar no que ela disse ao seu agente.',
                        'Funciona con Claude Code, Codex y cualquier otro que lea SKILL.md. Use -g para instalarla ' +
                        'en todos los proyectos en vez de uno. La skill trae check.py, que verifica sus propias ' +
                        'promesas contra esta API — ejecútelo antes de confiar en lo que le dijo a su agente.'
                    )}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <SectionCard
                        title={T('Step 1 — Register the faucet', 'Passo 1 — Registrar a torneira', 'Paso 1 — Registrar el grifo')}
                        icon={<GlobeAltIcon className="w-5 h-5" />}
                    >
                        <p className="text-sm text-brand-muted mb-4">
                            {T(
                                'The key is shown once, here and at rotation. Only its sha256 is stored, so nothing can reveal it later.',
                                'A chave aparece uma vez, aqui e na rotação. Só o sha256 dela é guardado, então nada a revela depois.',
                                'La clave aparece una vez, aquí y en la rotación. Solo su sha256 queda guardado, así que nada la revela después.'
                            )}
                        </p>
                        <div className="bg-brand-bg p-4 rounded-xl border border-brand-border mb-6">
                            <code className="text-xs font-mono text-brand-primary">POST /api/faucethub/register</code>
                            <pre className="mt-3 text-[10px] text-brand-muted bg-brand-bg/50 p-2 rounded overflow-x-auto">
{`{
    "name": "My Faucet",
    "wallet_address": "0x84da..."
}

→ 200
{
    "status": "success",
    "api_key": "fch_a1b2c3…",   // 64 hex, shown once
    "wallet_address": "0x84da..."
}`}
                            </pre>
                        </div>
                        <MermaidDiagram
                            code={diagrams(lang).HUB_INTEGRATION_DIAGRAM}
                            title={T('Faucet-to-L1 synchronization', 'Sincronização Torneira-para-L1', 'Sincronización Grifo-a-L1')}
                        />
                    </SectionCard>

                    <SectionCard
                        title={T('Step 2 — One call per claim', 'Passo 2 — Uma chamada por claim', 'Paso 2 — Una llamada por claim')}
                        icon={<CodeBracketIcon className="w-5 h-5" />}
                    >
                        <p className="text-sm text-brand-muted mb-3">
                            {T(
                                '`amount` is how much work the click represents, between 0 and 100. It is not what the user earns: ' +
                                'the network computes that from the campaign budget, the days left and how many people are taking part.',
                                '`amount` é quanto de trabalho o clique representa, entre 0 e 100. Não é o que o usuário ganha: ' +
                                'a rede calcula isso a partir do orçamento da campanha, dos dias restantes e de quantas pessoas participam.',
                                '`amount` es cuánto trabajo representa el clic, entre 0 y 100. No es lo que el usuario gana: ' +
                                'la red lo calcula a partir del presupuesto de la campaña, de los días restantes y de cuánta gente participa.'
                            )}
                        </p>
                        <div className="bg-brand-bg p-4 rounded-xl border border-brand-border">
                            <code className="text-xs font-mono text-brand-primary">POST /api/faucethub/microclaim</code>
                            <pre className="mt-3 text-[10px] text-brand-muted bg-brand-bg/50 p-2 rounded overflow-x-auto">
{`X-Api-Key: fch_a1b2c3…
Content-Type: application/json

{
    "user_wallet": "7xKX…",   // Solana address, or a 0x FaucetChain one
    "amount": 1
}

→ 200
{
    "user_address": "0x6f9b…c41e",
    "campaigns": [
        { "campaign_id": 990001, "amount": 4.82, "treasury": 1.2, "funding": "vault" }
    ]
}`}
                            </pre>
                        </div>
                    </SectionCard>

                    <SectionCard
                        title={T('Step 3 — Rotate a lost key', 'Passo 3 — Rotacionar uma chave perdida', 'Paso 3 — Rotar una clave perdida')}
                        icon={<ShieldCheckIcon className="w-5 h-5" />}
                    >
                        <p className="text-sm text-brand-muted mb-3">
                            {T(
                                'There is nothing to reveal, so a lost key is replaced rather than recovered. The owning wallet signs for it.',
                                'Não há o que revelar, então uma chave perdida é substituída, não recuperada. A carteira dona assina por ela.',
                                'No hay nada que revelar, así que una clave perdida se reemplaza, no se recupera. La billetera dueña firma por ella.'
                            )}
                        </p>
                        <div className="bg-brand-bg p-4 rounded-xl border border-brand-border">
                            <code className="text-xs font-mono text-brand-primary">POST /api/faucethub/regenerate-key</code>
                        </div>
                    </SectionCard>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <SectionCard
                        title={T('The two rules', 'As duas regras', 'Las dos reglas')}
                        icon={<ShieldCheckIcon className="w-5 h-5" />}
                    >
                        <div className="space-y-4">
                            <div className="p-3 bg-brand-primary/5 border border-brand-primary/20 rounded-xl">
                                <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-1">
                                    {T('Call it after your commit', 'Chame depois do seu commit', 'Llámela después de su commit')}
                                </h4>
                                <p className="text-[11px] text-brand-muted leading-relaxed">
                                    {T(
                                        'Your payout is recorded before FaucetChain is even looked up. A payment cannot depend on somebody else’s uptime.',
                                        'O seu pagamento é registrado antes de a FaucetChain sequer ser consultada. Um pagamento não pode depender do uptime de outro.',
                                        'Su pago queda registrado antes de que FaucetChain sea siquiera consultada. Un pago no puede depender del uptime de otro.'
                                    )}
                                </p>
                            </div>
                            <div className="p-3 bg-brand-primary/5 border border-brand-primary/20 rounded-xl">
                                <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-1">
                                    {T('Swallow the error', 'Engula o erro', 'Tráguese el error')}
                                </h4>
                                <p className="text-[11px] text-brand-muted leading-relaxed">
                                    {T(
                                        'Four-second timeout, log and return. If your faucet stops paying when ours is down, the integration is wrong.',
                                        'Timeout de quatro segundos, registre e retorne. Se a sua torneira para de pagar quando a nossa cai, a integração está errada.',
                                        'Timeout de cuatro segundos, registre y retorne. Si su grifo deja de pagar cuando el nuestro se cae, la integración está mal.'
                                    )}
                                </p>
                            </div>
                            <div className="p-3 bg-brand-surface border border-brand-border rounded-xl">
                                <h4 className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-1">
                                    {T('429 is not a failure', '429 não é falha', '429 no es un fallo')}
                                </h4>
                                <p className="text-[11px] text-brand-muted leading-relaxed">
                                    {T(
                                        'It is the five-minute per-user cooldown on this side. Treat it as “nothing to do”, not as an error to log.',
                                        'É o cooldown de cinco minutos por usuário deste lado. Trate como “nada a fazer”, não como erro para registrar.',
                                        'Es el cooldown de cinco minutos por usuario de este lado. Trátelo como “nada que hacer”, no como un error para registrar.'
                                    )}
                                </p>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title={T('Full guide', 'Guia completo', 'Guía completa')} icon={<GlobeAltIcon className="w-5 h-5" />}>
                        <p className="text-[11px] text-brand-muted leading-relaxed">
                            {T(
                                'Working cURL, JavaScript, Python and PHP implementations, and the address derivation, are in ',
                                'Implementações prontas em cURL, JavaScript, Python e PHP, e a derivação de endereço, estão em ',
                                'Implementaciones listas en cURL, JavaScript, Python y PHP, y la derivación de dirección, están en '
                            )}
                            <code className="font-mono text-brand-primary">FaucetHub_Integration_Guide.md</code>.
                        </p>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
};
