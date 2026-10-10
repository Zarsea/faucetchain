
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    'API Docs': ArrowUpRightIcon
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

export const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab, tabs, onExpandedChange }) => {
    const { t } = useTranslation();
    const [hoveredTab, setHoveredTab] = useState<string | null>(null);
    // Aberta por padrão. Fechada-com-abre-no-hover escondia os vinte rótulos até
    // alguém passar o mouse, e fazia a barra pular a cada vez que o ponteiro a
    // cruzava. Quem quer a coluna estreita fecha no botão, de propósito.
    const [isCollapsed, setIsCollapsed] = useState(false);

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
    const agrupados = new Set<string>([LEAD_TAB]);
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
                onClick={() => setActiveTab(tabKey)}
                onMouseEnter={() => setHoveredTab(tabKey)}
                onMouseLeave={() => setHoveredTab(null)}
                aria-current={isActive ? 'page' : undefined}
                className={`
                    relative w-full flex items-center rounded-xl transition-colors duration-200
                    ${isCollapsed ? 'px-3 py-2.5 justify-center' : 'gap-3 pl-4 pr-3 py-2'}
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
        <nav
            aria-label="FaucetChain"
            className={`fixed left-0 top-0 h-screen z-[100] flex flex-col transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                glass border-r border-brand-border
                ${isCollapsed ? 'w-[72px]' : 'w-[240px]'}
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
                    <h1 className="text-sm font-semibold text-white tracking-tight leading-tight">FaucetChain</h1>
                    {/* A camada e o token, não a versão do explorer. A faixa de
                        status e o header, logo à direita, já dizem "micro-
                        distribution" e "settles on Solana"; dizer de novo aqui
                        punha a mesma frase três vezes na mesma tela. */}
                    <span className="text-[10px] font-medium text-brand-muted leading-tight">L1 · $CLAIM</span>
                </div>
            </div>

            {/* A barra de rolagem fina fica visível: com vinte itens o último
                grupo cai abaixo da dobra, e esconder a barra escondia junto o
                aviso de que há mais coisa embaixo. */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 [scrollbar-width:thin] [scrollbar-color:#1C2E3D_transparent]">
                {presentes.has(LEAD_TAB) && renderItem(LEAD_TAB)}

                {secoes.map((grupo) => (
                    <div key={grupo.key} className="mt-5 first:mt-3">
                        {isCollapsed ? (
                            // Sem rótulo não sobra espaço para texto; o que separa
                            // os grupos na coluna estreita é a linha.
                            <div aria-hidden="true" className="mx-3 mb-2 border-t border-brand-border/60" />
                        ) : (
                            <div className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted/70">
                                {t(`navGroups.${grupo.key}`, { defaultValue: grupo.fallback })}
                            </div>
                        )}
                        <div className="space-y-0.5">
                            {grupo.itens.map(renderItem)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Rodapé: só o controle da própria barra. O estado da rede é da
                faixa no topo da página, que já o anuncia em letra maior. */}
            <div className="border-t border-brand-border/60 px-3 py-2 flex items-center justify-end">
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
    );
};
