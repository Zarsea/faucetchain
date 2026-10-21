
import React from 'react';
import { SectionCard } from './SectionCard';
import { CodeBracketIcon, GlobeAltIcon, ShieldCheckIcon } from './IconComponents';
import { useLanguage } from './LanguageContext';
import { diagrams } from '../constants';
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
    const T = (en: string, pt: string) => (lang === 'en' ? en : pt);

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="animate-fadeIn">
                <h2 className="text-3xl font-bold text-brand-secondary mb-4">
                    {T('FaucetHub API', 'API do FaucetHub')}
                </h2>
                <p className="text-brand-muted mb-6 text-lg leading-relaxed">
                    {T(
                        'Two calls connect a faucet to FaucetChain: one to register and get a key, one per claim. ' +
                        'The second runs after your own payout is already recorded, so nothing you owe a user ever waits on us.',
                        'Duas chamadas conectam uma torneira à FaucetChain: uma para registrar e receber a chave, ' +
                        'uma por claim. A segunda roda depois que o seu pagamento já foi registrado, então nada que ' +
                        'você deve ao usuário espera por nós.'
                    )}
                </p>
            </div>

            {/* Antes dos endpoints de proposito: quem integra hoje costuma estar com
                um agente aberto, e entregar a integracao inteira de uma vez e mais
                curto do que o agente ler esta pagina. */}
            <div className="animate-fadeIn p-6 rounded-2xl bg-brand-card/40 border border-brand-primary/30">
                <h3 className="text-lg font-bold text-brand-secondary mb-1">
                    {T('Start with an agent', 'Comece pelo agente')}
                </h3>
                <p className="text-sm text-brand-muted leading-relaxed mb-4">
                    {T(
                        'One command installs a skill that carries this whole integration: the request shapes, ' +
                        'the webhook signature, and the four mistakes that cost your users money. Your agent ' +
                        'reads it and writes the integration against it.',
                        'Um comando instala uma skill com esta integração inteira: os formatos de requisição, ' +
                        'a assinatura dos webhooks e os quatro erros que custam dinheiro dos seus usuários. ' +
                        'Seu agente lê e escreve a integração a partir dela.'
                    )}
                </p>
                <ComandoDoAgente rotulo="Agent CLI" texto="npx skills add Zarsea/faucetchain" />
                <p className="text-[11px] text-brand-muted/80 leading-relaxed mt-3">
                    {T(
                        'Works with Claude Code, Codex and anything else that reads SKILL.md. Add -g to install it ' +
                        'for every project instead of this one. The skill ships check.py, which asserts its own ' +
                        'promises against this API — run it before you trust what it told your agent.',
                        'Funciona com Claude Code, Codex e qualquer outro que leia SKILL.md. Use -g para instalar ' +
                        'em todos os projetos em vez de um. A skill traz check.py, que confere as próprias promessas ' +
                        'contra esta API — rode antes de confiar no que ela disse ao seu agente.'
                    )}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <SectionCard
                        title={T('Step 1 — Register the faucet', 'Passo 1 — Registrar a torneira')}
                        icon={<GlobeAltIcon className="w-5 h-5" />}
                    >
                        <p className="text-sm text-brand-muted mb-4">
                            {T(
                                'The key is shown once, here and at rotation. Only its sha256 is stored, so nothing can reveal it later.',
                                'A chave aparece uma vez, aqui e na rotação. Só o sha256 dela é guardado, então nada a revela depois.'
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
                            title={T('Faucet-to-L1 synchronization', 'Sincronização Torneira-para-L1')}
                        />
                    </SectionCard>

                    <SectionCard
                        title={T('Step 2 — One call per claim', 'Passo 2 — Uma chamada por claim')}
                        icon={<CodeBracketIcon className="w-5 h-5" />}
                    >
                        <p className="text-sm text-brand-muted mb-3">
                            {T(
                                '`amount` is how much work the click represents, between 0 and 100. It is not what the user earns: ' +
                                'the network computes that from the campaign budget, the days left and how many people are taking part.',
                                '`amount` é quanto de trabalho o clique representa, entre 0 e 100. Não é o que o usuário ganha: ' +
                                'a rede calcula isso a partir do orçamento da campanha, dos dias restantes e de quantas pessoas participam.'
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
                        title={T('Step 3 — Rotate a lost key', 'Passo 3 — Rotacionar uma chave perdida')}
                        icon={<ShieldCheckIcon className="w-5 h-5" />}
                    >
                        <p className="text-sm text-brand-muted mb-3">
                            {T(
                                'There is nothing to reveal, so a lost key is replaced rather than recovered. The owning wallet signs for it.',
                                'Não há o que revelar, então uma chave perdida é substituída, não recuperada. A carteira dona assina por ela.'
                            )}
                        </p>
                        <div className="bg-brand-bg p-4 rounded-xl border border-brand-border">
                            <code className="text-xs font-mono text-brand-primary">POST /api/faucethub/regenerate-key</code>
                        </div>
                    </SectionCard>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <SectionCard
                        title={T('The two rules', 'As duas regras')}
                        icon={<ShieldCheckIcon className="w-5 h-5" />}
                    >
                        <div className="space-y-4">
                            <div className="p-3 bg-brand-primary/5 border border-brand-primary/20 rounded-xl">
                                <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-1">
                                    {T('Call it after your commit', 'Chame depois do seu commit')}
                                </h4>
                                <p className="text-[11px] text-brand-muted leading-relaxed">
                                    {T(
                                        'Your payout is recorded before FaucetChain is even looked up. A payment cannot depend on somebody else’s uptime.',
                                        'O seu pagamento é registrado antes de a FaucetChain sequer ser consultada. Um pagamento não pode depender do uptime de outro.'
                                    )}
                                </p>
                            </div>
                            <div className="p-3 bg-brand-primary/5 border border-brand-primary/20 rounded-xl">
                                <h4 className="text-[10px] font-bold text-brand-primary uppercase tracking-wider mb-1">
                                    {T('Swallow the error', 'Engula o erro')}
                                </h4>
                                <p className="text-[11px] text-brand-muted leading-relaxed">
                                    {T(
                                        'Four-second timeout, log and return. If your faucet stops paying when ours is down, the integration is wrong.',
                                        'Timeout de quatro segundos, registre e retorne. Se a sua torneira para de pagar quando a nossa cai, a integração está errada.'
                                    )}
                                </p>
                            </div>
                            <div className="p-3 bg-brand-surface border border-brand-border rounded-xl">
                                <h4 className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-1">
                                    {T('429 is not a failure', '429 não é falha')}
                                </h4>
                                <p className="text-[11px] text-brand-muted leading-relaxed">
                                    {T(
                                        'It is the five-minute per-user cooldown on this side. Treat it as “nothing to do”, not as an error to log.',
                                        'É o cooldown de cinco minutos por usuário deste lado. Trate como “nada a fazer”, não como erro para registrar.'
                                    )}
                                </p>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title={T('Full guide', 'Guia completo')} icon={<GlobeAltIcon className="w-5 h-5" />}>
                        <p className="text-[11px] text-brand-muted leading-relaxed">
                            {T(
                                'Working cURL, JavaScript, Python and PHP implementations, and the address derivation, are in ',
                                'Implementações prontas em cURL, JavaScript, Python e PHP, e a derivação de endereço, estão em '
                            )}
                            <code className="font-mono text-brand-primary">FaucetHub_Integration_Guide.md</code>.
                        </p>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
};
