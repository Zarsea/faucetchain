
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REPO_URL } from '../constants';
import {
    ArrowPathIcon,
    ArrowUpRightIcon,
    BeakerIcon,
    BoltIcon,
    BookOpenIcon,
    ChartBarIcon,
    ChartPieIcon,
    CheckCircleIcon,
    CodeBracketIcon,
    CpuChipIcon,
    CreditCardIcon,
    CubeIcon,
    DocumentTextIcon,
    GlobeAltIcon,
    InformationCircleIcon,
    MagnifyingGlassPlusIcon,
    LockClosedIcon,
    ShieldCheckIcon,
    SignalIcon,
    SparklesIcon,
    WalletIcon
} from './IconComponents';

interface TabsProps {
    activeTab: string;
    setActiveTab: (label: string) => void;
    tabs: string[];
    /** Told when the rail widens, so the page beside it can move out of the way
     *  instead of being covered. */
    onExpandedChange?: (expanded: boolean) => void;
}

type IconComponent = React.FC<{ className?: string }>;

/** Um ícone por tela, e nenhum repetido: antes CubeIcon aparecia em três itens,
 *  SignalIcon em três e CreditCardIcon em dois, com um quarto cubo servindo de
 *  fallback — o que fazia a coluna inteira parecer a mesma coisa vinte vezes.
 *  A cor fica fora daqui: quem decide a cor é o estado do botão, não o mapa. */
const TAB_ICONS: Record<string, IconComponent> = {
    'Dashboard': ChartBarIcon,
    'Solana Payouts': CreditCardIcon,
    'Settlement Ledger': CheckCircleIcon,
    'Faucet': BoltIcon,
    'AutoClaim Hub': ArrowPathIcon,
    'Bounty Board': SparklesIcon,
    'Connect a Faucet': ShieldCheckIcon,
    'Staking Vault': CubeIcon,
    'AI Agent': CpuChipIcon,
    'Wallet Explorer': WalletIcon,
    'Address Tracker': MagnifyingGlassPlusIcon,
    'Network Status': SignalIcon,
    'Infra Monitor': GlobeAltIcon,
    'Whitepaper': BookOpenIcon,
    'General Article': InformationCircleIcon,
    'Tokenomics': ChartPieIcon,
    'Smart Contract': CodeBracketIcon,
    'AI Module': BeakerIcon,
    'Technical Specs': DocumentTextIcon,
    'API Docs': ArrowUpRightIcon,
    'Privacy': LockClosedIcon
};

/** A ordem de leitura da barra. O App continua dono de QUAIS telas existem; isto
 *  é dono de COMO elas se leem — dinheiro liquidando primeiro, documentação por
 *  último. Uma tela que não esteja listada aqui cai no último grupo, então
 *  acrescentar uma entrada em TABS nunca a faz desaparecer da navegação. */
const GROUPS: { key: string; fallback: string; tabs: string[] }[] = [
    { key: 'settlement', fallback: 'Settlement', tabs: ['Solana Payouts', 'Settlement Ledger'] },
    { key: 'earn', fallback: 'Earn', tabs: ['Faucet', 'AutoClaim Hub', 'Bounty Board'] },
    { key: 'operate', fallback: 'Operate', tabs: ['Connect a Faucet', 'Staking Vault', 'AI Agent'] },
    { key: 'explore', fallback: 'Explore', tabs: ['Wallet Explorer', 'Address Tracker', 'Network Status', 'Infra Monitor'] },
    { key: 'reference', fallback: 'Reference', tabs: ['Whitepaper', 'General Article', 'Tokenomics', 'Smart Contract', 'AI Module', 'Technical Specs', 'API Docs'] }
];

/** O Dashboard não entra em grupo: é a tela de entrada, e dar um rótulo de seção
 *  a um único item é enfeite, não informação. */
const LEAD_TAB = 'Dashboard';

/** Telas que existem mas nao aparecem na barra.
 *
 *  Privacy nao e uma area da rede, e a conta de quem esta olhando: abre pelo
 *  painel da carteira, no canto superior, que e onde a pessoa ja vai quando
 *  quer mexer na propria conta. Continua sendo uma aba de verdade -- o
 *  `setActiveTab('Privacy')` do painel a renderiza igual; o que sai e so o
 *  item do menu.
 *
 *  O conjunto tambem serve de guarda: sem ele a tela cairia em `restantes` e
 *  voltaria para a barra dentro de um grupo "Other", que e pior que estar no
 *  rodape, porque ninguem escolheu aquele lugar. */
const FORA_DA_BARRA = new Set<string>(['Privacy']);

/** Em que grupo uma tela mora. Devolve undefined para o Dashboard e para
 *  qualquer tela que ainda nao foi classificada. */
const grupoDe = (tab: string) => GROUPS.find((g) => g.tabs.includes(tab))?.key;

export const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab, tabs, onExpandedChange }) => {
    const { t } = useTranslation();
    const [hoveredTab, setHoveredTab] = useState<string | null>(null);
    // Aberta por padrão. Fechada-com-abre-no-hover escondia os vinte rótulos até
    // alguém passar o mouse, e fazia a barra pular a cada vez que o ponteiro a
    // cruzava. Quem quer a coluna estreita fecha no botão, de propósito.
    const [isCollapsed, setIsCollapsed] = useState(false);
    // A barra e fixa e tem 240px. Num telefone de 390 isso e 62% da tela, e o
    // conteudo ficava nos 150 que sobravam -- texto quebrando numa palavra por
    // linha. Abaixo de `md` ela vira gaveta: fora da tela por padrao, por cima
    // do conteudo quando aberta, e fecha ao escolher um item, porque gaveta que
    // fica aberta depois da escolha esconde justamente o que a pessoa foi ver.
    const [gavetaAberta, setGavetaAberta] = useState(false);
    // Vinte itens abertos de uma vez davam 967px de lista. Num notebook de 768
    // isso escondia 331px -- o grupo Reference inteiro, sem nada na tela dizendo
    // que ele existia. Fechado, cada grupo mostra quantas telas tem dentro, o
    // que diz mais em uma linha do que sete linhas abaixo da dobra.
    const [abertos, setAbertos] = useState<Set<string>>(() => {
        const chave = grupoDe(activeTab);
        return new Set(chave ? [chave] : []);
    });

    // Navegacao vinda de fora da barra (um link do Dashboard, por exemplo) abre
    // o grupo de destino. Sem isto a barra passa a mentir sobre onde a pessoa
    // esta: item ativo escondido dentro de uma secao fechada.
    useEffect(() => {
        const chave = grupoDe(activeTab);
        if (!chave) return;
        setAbertos((antes) => (antes.has(chave) ? antes : new Set(antes).add(chave)));
    }, [activeTab]);

    const alternarGrupo = (chave: string) => setAbertos((antes) => {
        const proximo = new Set(antes);
        proximo.has(chave) ? proximo.delete(chave) : proximo.add(chave);
        return proximo;
    });

    const toggle = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        onExpandedChange?.(!next);
    };

    const getLabel = (key: string) => {
        // Removendo espaços para mapear dinamicamente para as chaves do i18n
        // Ex: "AutoClaim Hub" -> "AutoClaimHub"
        const formattedKey = key.replace(/\s+/g, '');
        return t(`tabs.${formattedKey}`, { defaultValue: key });
    };

    // As seções são montadas a partir do que o App entregou, preservando a ordem
    // de leitura acima e varrendo o resto para o fim.
    const presentes = new Set(tabs);
    const agrupados = new Set<string>([LEAD_TAB, ...FORA_DA_BARRA]);
    const secoes = GROUPS.map((grupo) => {
        const itens = grupo.tabs.filter((tab) => presentes.has(tab));
        itens.forEach((tab) => agrupados.add(tab));
        return { ...grupo, itens };
    }).filter((grupo) => grupo.itens.length > 0);
    const restantes = tabs.filter((tab) => !agrupados.has(tab));
    if (restantes.length > 0) {
        secoes.push({ key: 'other', fallback: 'Other', tabs: restantes, itens: restantes });
    }

    const renderItem = (tabKey: string) => {
        const isActive = activeTab === tabKey;
        const isHovered = hoveredTab === tabKey;
        const Icon = TAB_ICONS[tabKey] || CubeIcon;

        return (
            <button
                key={tabKey}
                onClick={() => { setActiveTab(tabKey); setGavetaAberta(false); }}
                onMouseEnter={() => setHoveredTab(tabKey)}
                onMouseLeave={() => setHoveredTab(null)}
                aria-current={isActive ? 'page' : undefined}
                className={`
                    relative w-full flex items-center rounded-xl transition-colors duration-200
                    ${isCollapsed ? 'px-3 py-2.5 justify-center' : 'gap-3 pl-4 pr-3 py-2 min-h-[44px] md:min-h-0'}
                    ${isActive
                        ? 'bg-brand-primary/15 text-white'
                        : 'text-brand-muted hover:bg-white/[0.04] hover:text-brand-secondary'
                    }
                `}
                title={isCollapsed ? getLabel(tabKey) : undefined}
            >
                {/* O único movimento autoral da barra: a marca ativa cresce do
                    centro em vez de aparecer pronta. 160ms, uma curva só. */}
                <span
                    aria-hidden="true"
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-brand-primary
                        transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
                        ${isActive ? 'scale-y-100' : 'scale-y-0'}
                    `}
                />

                {/* Um ícone, não dois. O desfoque duplicado atrás de cada ícone
                    era decoração que engrossava o traço e borrava a forma. */}
                <Icon
                    className={`w-[18px] h-[18px] flex-shrink-0 transition-colors duration-200
                        ${isActive ? 'text-brand-primary' : isHovered ? 'text-brand-secondary' : 'text-brand-muted'}
                    `}
                />

                <span className={`
                    text-[13px] whitespace-nowrap overflow-hidden transition-all duration-300
                    ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
                    ${isActive ? 'font-semibold' : 'font-medium'}
                `}>
                    {getLabel(tabKey)}
                </span>

                {isCollapsed && isHovered && (
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-brand-card border border-brand-border rounded-lg shadow-lift whitespace-nowrap z-[100] animate-fadeIn pointer-events-none">
                        <span className="text-xs font-semibold text-white">{getLabel(tabKey)}</span>
                    </span>
                )}
            </button>
        );
    };

    return (
        <>
            {/* So no telefone: o botao que abre, e o fundo que fecha ao tocar fora. */}
            <button
                onClick={() => setGavetaAberta(true)}
                aria-label="Open menu"
                className={`md:hidden fixed top-3 left-3 z-[110] w-11 h-11 rounded-xl
                    glass border border-brand-border flex items-center justify-center
                    text-brand-secondary active:scale-95 transition
                    ${gavetaAberta ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
                <span className="block w-5 space-y-[5px]">
                    <span className="block h-[2px] bg-current rounded" />
                    <span className="block h-[2px] bg-current rounded" />
                    <span className="block h-[2px] bg-current rounded" />
                </span>
            </button>

            {gavetaAberta && (
                <div
                    onClick={() => setGavetaAberta(false)}
                    className="md:hidden fixed inset-0 z-[99] bg-black/60 backdrop-blur-sm"
                />
            )}

        <nav
            aria-label="FaucetChain"
            className={`fixed left-0 top-0 h-screen z-[100] flex flex-col
                transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                glass border-r border-brand-border
                ${isCollapsed ? 'w-[72px]' : 'w-[240px]'}
                ${gavetaAberta ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
            `}
        >
            {/* Marca */}
            <div className={`px-4 py-5 border-b border-brand-border/60 flex items-center overflow-hidden ${isCollapsed ? 'justify-center px-0' : 'gap-3'}`}>
                {/* A mesma marca do cabecalho. Duas marcas diferentes a 240px
                    uma da outra -- uma gota com elo ali, uma gota sem elo aqui
                    -- lem como dois produtos. A animacao do SVG anterior se
                    perde; a coerencia vale mais que ela. */}
                <img src="/faucetchain-mark.png" alt="FaucetChain"
                     width={18} height={32}
                     className="h-8 w-auto flex-shrink-0" />
                <div className={`min-w-0 transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                    <div className="text-sm font-semibold text-white tracking-tight leading-tight">FaucetChain</div>
                    {/* A camada e o token, não a versão do explorer. A faixa de
                        status e o header, logo à direita, já dizem "micro-
                        distribution" e "settles on Solana"; dizer de novo aqui
                        punha a mesma frase três vezes na mesma tela. */}
                    <span className="text-[10px] font-medium text-brand-muted leading-tight">L1 · $CLAIM</span>
                </div>
            </div>

            {/* A rolagem fina continua aqui para quem abre varios grupos de
                uma vez. Em repouso a lista cabe inteira em qualquer tela. */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 [scrollbar-width:thin] [scrollbar-color:#1C2E3D_transparent]">
                {presentes.has(LEAD_TAB) && renderItem(LEAD_TAB)}

                {secoes.map((grupo) => {
                    // Na coluna estreita nao ha o que dobrar: sao vinte icones e
                    // nenhum rotulo, e esconde-los atras de um clique invisivel
                    // deixaria a barra sem navegacao nenhuma.
                    const aberto = isCollapsed || abertos.has(grupo.key);
                    const temAtiva = grupo.itens.includes(activeTab);
                    return (
                        <div key={grupo.key} className="mt-3 first:mt-2">
                            {isCollapsed ? (
                                // Sem rótulo não sobra espaço para texto; o que separa
                                // os grupos na coluna estreita é a linha.
                                <div aria-hidden="true" className="mx-3 mb-2 border-t border-brand-border/60" />
                            ) : (
                                <button
                                    onClick={() => alternarGrupo(grupo.key)}
                                    aria-expanded={aberto}
                                    className={`w-full flex items-center gap-2 px-4 rounded-lg
                                        min-h-[44px] md:min-h-0 md:py-1.5
                                        text-[10px] font-semibold uppercase tracking-[0.14em]
                                        transition-colors hover:bg-white/[0.03] hover:text-brand-secondary
                                        ${temAtiva ? 'text-brand-primary/90' : 'text-brand-muted/70'}`}
                                >
                                    <span className="flex-1 text-left">
                                        {t(`navGroups.${grupo.key}`, { defaultValue: grupo.fallback })}
                                    </span>
                                    {/* A contagem só aparece fechado. Aberto, os itens
                                        estão à vista e o número viraria ruído. */}
                                    {!aberto && (
                                        <span className="tabular font-bold text-brand-muted/60">{grupo.itens.length}</span>
                                    )}
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="currentColor"
                                         className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${aberto ? 'rotate-90' : ''}`}
                                         aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            )}
                            {aberto && (
                                <div className="space-y-0.5 mt-0.5">
                                    {grupo.itens.map(renderItem)}
                                </div>
                            )}
                        </div>
                    );
                })}

            </div>

            {/* Rodapé: só o controle da própria barra. O estado da rede é da
                faixa no topo da página, que já o anuncia em letra maior. */}
            {/* Escondido no telefone: encolher para 72px dentro de uma gaveta
                nao serve para nada -- a gaveta ja sai inteira da tela. */}
            <div className="hidden md:flex border-t border-brand-border/60 px-3 py-2 items-center justify-between gap-2">
                {/* O repositorio, e o commit que virou este bundle.
                    Este produto e a vitrine de um repositorio publico, e ate
                    agora nao havia um unico link para ele em lugar nenhum da
                    interface -- quem abrisse a tela nao tinha como chegar ao
                    codigo. O commit ao lado responde a outra pergunta que
                    aparecia toda vez: qual versao e esta. */}
                {!isCollapsed && (
                    <a
                        href={REPO_URL} target="_blank" rel="noopener noreferrer"
                        className="min-w-0 flex items-center gap-1.5 text-[10px] font-mono text-brand-muted hover:text-brand-primary transition-colors"
                        title="Zarsea/faucetchain"
                    >
                        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 flex-none" fill="currentColor" aria-hidden="true">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                        </svg>
                        <span className="truncate">{__BUILD_COMMIT__}</span>
                    </a>
                )}
                <button
                    onClick={toggle}
                    aria-expanded={!isCollapsed}
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                    className={`flex-shrink-0 p-2 rounded-lg text-brand-muted hover:text-brand-secondary hover:bg-white/[0.04] transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
                >
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round"
                              d={isCollapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
                    </svg>
                </button>
            </div>
        </nav>
        </>
    );
};
