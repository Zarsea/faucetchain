
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CubeIcon,
    SparklesIcon,
    ShieldCheckIcon,
    SignalIcon,
    CreditCardIcon,
    CodeBracketIcon,
    CpuChipIcon,
    BookOpenIcon,
    DocumentTextIcon,
    ChartBarIcon,
    BoltIcon,
    WalletIcon,
    BeakerIcon,
    GlobeAltIcon
} from './IconComponents';

interface TabsProps {
    activeTab: string;
    setActiveTab: (label: string) => void;
    tabs: string[];
    /** Told when the rail widens, so the page beside it can move out of the way
     *  instead of being covered. */
    onExpandedChange?: (expanded: boolean) => void;
}

const TAB_ICONS: Record<string, React.ReactNode> = {
    'Dashboard': <ChartBarIcon className="w-5 h-5" />,
    'Block Explorer': <CubeIcon className="w-5 h-5 text-brand-primary" />,
    'Mining Hub': <CpuChipIcon className="w-5 h-5" />,
    'Address Tracker': <SignalIcon className="w-5 h-5" />,
    'Staking Vault': <CubeIcon className="w-5 h-5" />,
    'Bounty Board': <BoltIcon className="w-5 h-5" />,
    'AI Agent': <SparklesIcon className="w-5 h-5" />,
    'Wallet Explorer': <WalletIcon className="w-5 h-5" />,
    'Network Status': <SignalIcon className="w-5 h-5" />,
    'Faucet': <CreditCardIcon className="w-5 h-5" />,
    'Tokenomics': <CreditCardIcon className="w-5 h-5" />,
    'Smart Contract': <CodeBracketIcon className="w-5 h-5" />,
    'AI Module': <CpuChipIcon className="w-5 h-5" />,
    'Whitepaper': <BookOpenIcon className="w-5 h-5" />,
    'Technical Specs': <BeakerIcon className="w-5 h-5" />,
    'API Docs': <DocumentTextIcon className="w-5 h-5" />,
    'General Article': <GlobeAltIcon className="w-5 h-5" />,
    'Infra Monitor': <SignalIcon className="w-5 h-5" />,
};

export const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab, tabs, onExpandedChange }) => {
    const { t } = useTranslation();
    const [hoveredTab, setHoveredTab] = useState<string | null>(null);
    // Collapsed until the pointer arrives. It used to start false, so the rail
    // opened to 240px on load and sat on top of the header logo at x=202.
    const [isCollapsed, setIsCollapsed] = useState(true);

    const setExpanded = (expanded: boolean) => {
        setIsCollapsed(!expanded);
        onExpandedChange?.(expanded);
    };

    const getLabel = (key: string) => {
        // Removendo espaços para mapear dinamicamente para as chaves do i18n
        // Ex: "AutoClaim Hub" -> "AutoClaimHub"
        const formattedKey = key.replace(/\s+/g, '');
        return t(`tabs.${formattedKey}`, { defaultValue: key });
    };

    return (
        <nav
            className={`fixed left-0 top-0 h-screen z-[100] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                glass border-r border-brand-primary/20
                ${isCollapsed ? 'w-[72px]' : 'w-[240px]'}
            `}
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
        >
            {/* Logo / Brand */}
            <div className="px-4 py-6 border-b border-brand-border/30 flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-accent flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-primary/20">
                    <ShieldCheckIcon className="w-5 h-5 text-brand-bg" />
                </div>
                <div className={`transition-all duration-300 overflow-hidden whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                    <h1 className="text-sm font-black text-white tracking-tight leading-none">FaucetChain</h1>
                    <span className="text-[9px] font-bold text-brand-primary uppercase tracking-[0.2em]">Explorer V3</span>
                </div>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-1 scrollbar-hide">
                {tabs.map((tabKey) => {
                    const isActive = activeTab === tabKey;
                    const isHovered = hoveredTab === tabKey;
                    const icon = TAB_ICONS[tabKey] || <CubeIcon className="w-5 h-5" />;

                    return (
                        <button
                            key={tabKey}
                            onClick={() => setActiveTab(tabKey)}
                            onMouseEnter={() => setHoveredTab(tabKey)}
                            onMouseLeave={() => setHoveredTab(null)}
                            className={`
                                relative w-full flex items-center gap-3 rounded-xl transition-all duration-300 ease-out group neon-border-dynamic
                                ${isCollapsed ? 'px-3 py-3 justify-center' : 'px-3 py-2.5'}
                                ${isActive
                                    ? 'bg-brand-primary/20 text-brand-primary shadow-glow-primary'
                                    : 'text-brand-muted hover:bg-brand-primary/10 hover:text-white'
                                }
                            `}
                            title={isCollapsed ? getLabel(tabKey) : undefined}
                        >
                            {/* Active indicator bar */}
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-primary rounded-r-full shadow-[0_0_8px_rgba(var(--brand-primary-rgb),0.5)]" />
                            )}

                            {/* Icon with hover glow */}
                            <div className={`
                                relative flex-shrink-0 transition-all duration-200
                                ${isActive ? 'text-brand-primary' : ''}
                                ${isHovered && !isActive ? 'text-white scale-110' : ''}
                            `}>
                                {icon}
                                {/* Glow on hover */}
                                {(isHovered || isActive) && (
                                    <div className={`absolute inset-0 blur-md opacity-40 pointer-events-none ${isActive ? 'text-brand-primary' : 'text-white'}`}>
                                        {icon}
                                    </div>
                                )}
                            </div>

                            {/* Label */}
                            <span className={`
                                text-[13px] font-semibold whitespace-nowrap transition-all duration-300 overflow-hidden
                                ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}
                                ${isActive ? 'font-bold' : ''}
                            `}>
                                {getLabel(tabKey)}
                            </span>

                            {/* Hover tooltip when collapsed */}
                            {isCollapsed && isHovered && (
                                <div className="absolute left-full ml-3 px-3 py-1.5 bg-brand-surface border border-brand-border rounded-lg shadow-2xl whitespace-nowrap z-[100] animate-fadeIn pointer-events-none">
                                    <span className="text-xs font-bold text-white">{getLabel(tabKey)}</span>
                                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-brand-surface border-l border-b border-brand-border rotate-45" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div className={`px-4 py-4 border-t border-brand-border/30 overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulseGlow" />
                    <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest whitespace-nowrap neon-text">FaucetChain Network</span>
                </div>
            </div>
        </nav>
    );
};
