
import React from 'react';
import './i18n';
import { Header } from './components/Header';
import { Tabs } from './components/Tabs';
import { Overview } from './components/Overview';
const CodeViewer = React.lazy(() => import('./components/CodeViewer').then(m => ({ default: m.CodeViewer })));
const Tokenomics = React.lazy(() => import('./components/Tokenomics').then(m => ({ default: m.Tokenomics })));
const Whitepaper = React.lazy(() => import('./components/Whitepaper').then(m => ({ default: m.Whitepaper })));
const NetworkStatus = React.lazy(() => import('./components/NetworkStatus').then(m => ({ default: m.NetworkStatus })));
import { Faucet } from './components/Faucet';
const ApiDocs = React.lazy(() => import('./components/ApiDocs').then(m => ({ default: m.ApiDocs })));
const GeneralArticle = React.lazy(() => import('./components/GeneralArticle').then(m => ({ default: m.GeneralArticle })));
import { LanguageProvider } from './components/LanguageContext';
import { NetworkProvider } from './components/NetworkContext';
const TechnicalSpecs = React.lazy(() => import('./components/TechnicalSpecs').then(m => ({ default: m.TechnicalSpecs })));
import { WalletExplorer } from './components/WalletExplorer';
import { AIChatAgent } from './components/AIChatAgent';
import { UserDashboard } from './components/UserDashboard';
import PrivacySettings from './components/PrivacySettings';
import { StakingVault } from './components/StakingVault';
import { BountyBoard } from './components/BountyBoard';
import { MiningHub } from './components/MiningHub';
import { AddressTracker } from './components/AddressTracker';
import { InfrastructureMonitor } from './components/InfrastructureMonitor';
import { DappsEnvironment, DappsFloatingButton } from './components/DappsEnvironment';
import { BlockViewer } from './components/BlockViewer';
import { SolanaPayouts } from './components/SolanaPayouts';
import { SettlementLedger } from './components/SettlementLedger';
import { ConnectFaucet } from './components/ConnectFaucet';

const TABS = [
    'Dashboard',
    'Solana Payouts',
    'Settlement Ledger',
    'Connect a Faucet',
    'AutoClaim Hub',
    'Address Tracker',
    'Staking Vault',
    'Bounty Board',
    'AI Agent',
    'Wallet Explorer',
    'Network Status',
    'Faucet',
    'Tokenomics',
    'Smart Contract',
    'AI Module',
    'Whitepaper',
    'Technical Specs',
    'API Docs',
    'General Article',
    'Infra Monitor',
    'Privacy',
];

const AppContent: React.FC = () => {
    const [activeTab, setActiveTab] = React.useState(TABS[0]);
    const [isDappsOpen, setIsDappsOpen] = React.useState(false);
    const [sidebarExpanded, setSidebarExpanded] = React.useState(true);

    const renderContent = () => {
        switch (activeTab) {
            case 'Dashboard':
                return <UserDashboard onNavigate={setActiveTab} />;
            case 'Solana Payouts':
                return <SolanaPayouts />;
            case 'Settlement Ledger':
                return <SettlementLedger />;
            case 'AutoClaim Hub':
                return <MiningHub />;
            case 'Address Tracker':
                return <AddressTracker onNavigate={setActiveTab} />;
            case 'Staking Vault':
                return <StakingVault />;
            case 'Bounty Board':
                return <BountyBoard />;
            case 'Overview':
                return <Overview />;
            case 'AI Agent':
                return <AIChatAgent />;
            case 'Wallet Explorer':
                return <WalletExplorer />;
            case 'General Article':
                return <GeneralArticle />;
            case 'Network Status':
                return <NetworkStatus />;
            case 'Technical Specs':
                return <TechnicalSpecs />;
            case 'Smart Contract':
                return <CodeViewer section="Smart Contract" />;
            case 'AI Module':
                return <CodeViewer section="AI Module" />;
            case 'Tokenomics':
                return <Tokenomics onNavigate={setActiveTab} />;
            case 'Whitepaper':
                return <Whitepaper />;
            case 'Connect a Faucet':
                return <ConnectFaucet />;
            case 'Faucet':
                return <Faucet />;
            case 'API Docs':
                return <ApiDocs />;
            case 'Infra Monitor':
                return <InfrastructureMonitor />;
            case 'Privacy':
                return <PrivacySettings />;
            default:
                return <UserDashboard onNavigate={setActiveTab} />;
        }
    };

    if (isDappsOpen) {
        return <DappsEnvironment onClose={() => setIsDappsOpen(false)} />;
    }

    return (
        <div className="bg-brand-bg min-h-screen text-brand-secondary relative overflow-x-hidden">
            {/* Global Fluid Background */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] liquid-bg mix-blend-screen" />
            
            {/* Sidebar Navigation */}
            <div className="relative z-[100]">
                <Tabs
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    tabs={TABS}
                    onExpandedChange={setSidebarExpanded}
                />
            </div>

            {/* Main content. The margin tracks the rail rather than staying at 72px:
                the rail is fixed and sits above this, so a stale margin let it cover
                the header logo whenever it opened. */}
            <div className={`transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] relative z-10 ml-0 ${sidebarExpanded ? 'md:ml-[240px]' : 'md:ml-[72px]'}`}>
                {/* O botao da gaveta fica fixo no topo esquerdo abaixo de `md`.
                    Sem esta faixa ele cobriria a marca do cabecalho. */}
                <div className="h-14 md:hidden" />
                <Header onNavigate={setActiveTab} />
                <main className="container mx-auto px-6 py-8 max-w-7xl">
                    <div key={activeTab} className="animate-slideUpFadeIn">
                        {/* Sem a fronteira, o primeiro clique numa tela sob demanda
                            quebra em vez de esperar o pedaco chegar. */}
                        <React.Suspense fallback={
                            <div className="flex items-center justify-center py-20">
                                <p className="text-brand-muted text-sm">Loading...</p>
                            </div>
                        }>
                            {renderContent()}
                        </React.Suspense>
                    </div>
                </main>
            </div>
            {/* Global Floating Components */}
            <div className="relative z-50">
                <DappsFloatingButton onClick={() => setIsDappsOpen(true)} />
            </div>
        </div>
    );
}

import { AuthProvider } from './components/AuthContext';

const App: React.FC = () => {
    return (
        <LanguageProvider>
            <AuthProvider>
                <NetworkProvider>
                    <AppContent />
                </NetworkProvider>
            </AuthProvider>
        </LanguageProvider>
    );
};

export default App;
