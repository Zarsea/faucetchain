
import React from 'react';
import './i18n';
import { Header } from './components/Header';
import { Tabs } from './components/Tabs';
import { Overview } from './components/Overview';
import { CodeViewer } from './components/CodeViewer';
import { Tokenomics } from './components/Tokenomics';
import { Whitepaper } from './components/Whitepaper';
import { NetworkStatus } from './components/NetworkStatus';
import { Faucet } from './components/Faucet';
import { ApiDocs } from './components/ApiDocs';
import { GeneralArticle } from './components/GeneralArticle';
import { LanguageProvider } from './components/LanguageContext';
import { NetworkProvider } from './components/NetworkContext';
import { TechnicalSpecs } from './components/TechnicalSpecs';
import { WalletExplorer } from './components/WalletExplorer';
import { AIChatAgent } from './components/AIChatAgent';
import { UserDashboard } from './components/UserDashboard';
import { StakingVault } from './components/StakingVault';
import { BountyBoard } from './components/BountyBoard';
import { MiningHub } from './components/MiningHub';
import { AddressTracker } from './components/AddressTracker';
import { InfrastructureMonitor } from './components/InfrastructureMonitor';
import { DappsEnvironment, DappsFloatingButton } from './components/DappsEnvironment';
import { BlockViewer } from './components/BlockViewer';

const TABS = [
    'Dashboard',
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
];

const AppContent: React.FC = () => {
    const [activeTab, setActiveTab] = React.useState(TABS[0]);
    const [isDappsOpen, setIsDappsOpen] = React.useState(false);

    const renderContent = () => {
        switch (activeTab) {
            case 'Dashboard':
                return <UserDashboard onNavigate={setActiveTab} />;
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
            case 'Faucet':
                return <Faucet />;
            case 'API Docs':
                return <ApiDocs />;
            case 'Infra Monitor':
                return <InfrastructureMonitor />;
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
                <Tabs activeTab={activeTab} setActiveTab={setActiveTab} tabs={TABS} />
            </div>

            {/* Main Content Area — shifts right to clear sidebar */}
            <div className="ml-[72px] transition-all duration-300 relative z-10">
                <Header />
                <main className="container mx-auto px-6 py-8 max-w-7xl">
                    <div key={activeTab} className="animate-slideUpFadeIn">
                        {renderContent()}
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
