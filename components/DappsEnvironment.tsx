import React, { useState, useEffect } from 'react';
import { FaucetHub } from './FaucetHub';
import { FaucetInternal } from './FaucetInternal';

export const DappsFloatingButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className="fixed bottom-12 right-12 z-40 w-24 h-24 bg-gradient-to-br from-brand-accent via-yellow-500 to-yellow-600 shadow-[0_0_25px_rgba(234,179,8,0.7)] flex items-center justify-center cursor-pointer hover:scale-110 hover:shadow-[0_0_40px_rgba(234,179,8,1)] transition-all duration-300 animate-[bounce_3s_infinite]"
            style={{ 
                borderRadius: '0 50% 50% 50%', 
                transform: 'rotate(45deg)' 
            }}
            title="Abrir DApps Environment"
        >
            <span 
                className="text-black font-extrabold text-lg tracking-wider drop-shadow-md select-none" 
                style={{ transform: 'rotate(-45deg)' }}
            >
                Dapps
            </span>
            <div className="absolute w-full h-full rounded-full border-2 border-white/20 scale-90" style={{ borderRadius: '0 50% 50% 50%' }}></div>
        </button>
    );
};

interface DappsEnvironmentProps {
    onClose: () => void;
}

const apps = [
    {
        id: 'faucethub',
        title: 'FaucetHub',
        desc: 'Monitoramento L1, Prova de Reserva (PoR) e Registro. O santuário central.',
        icon: '🌐',
        category: 'l1',
        tag: 'Nativo L1',
        color: 'from-purple-600 to-indigo-600',
        glow: 'rgba(99,102,241,0.5)',
        available: true,
    },
    {
        id: 'faucetswap',
        title: 'FaucetSwap DEX',
        desc: 'A primeira DEX nativa. Gasless trading e liquidez.',
        icon: '💱',
        category: 'l1',
        tag: 'Em Breve',
        color: 'from-blue-600 to-cyan-500',
        glow: 'rgba(6,182,212,0.5)',
        available: false,
    },
    {
        id: 'claimnfts',
        title: 'ClaimNFTs',
        desc: 'Mercado de colecionáveis digitais on-chain.',
        icon: '🖼️',
        category: 'l1',
        tag: 'Em Breve',
        color: 'from-pink-600 to-rose-500',
        glow: 'rgba(244,63,94,0.5)',
        available: false,
    },
    {
        id: 'faucetinternal',
        title: 'CyberDrip Terminal',
        desc: 'Faucet L2 gamificada. Missões diárias, Rank de EXP e Interceptação de Dados.',
        icon: '💻',
        category: 'l2',
        tag: 'Ativo L2',
        color: 'from-green-500 to-emerald-600',
        glow: 'rgba(16,185,129,0.5)',
        available: true,
    },
    {
        id: 'retrodrip',
        title: 'Retro Drip L2',
        desc: 'Faucet nostálgica 8-bits. Farming com arcades clássicos e leaderboards.',
        icon: '👾',
        category: 'l2',
        tag: 'L2 Futuro',
        color: 'from-yellow-500 to-orange-500',
        glow: 'rgba(245,158,11,0.5)',
        available: false,
    },
    {
        id: 'casinodrip',
        title: 'Cassino Drip',
        desc: 'Aposte seus micro-claims L2 em roletas e sorteios on-chain.',
        icon: '🎲',
        category: 'l2',
        tag: 'L2 Futuro',
        color: 'from-red-600 to-rose-600',
        glow: 'rgba(225,29,72,0.5)',
        available: false,
    },
    {
        id: 'devhub',
        title: 'SDK & Deploy',
        desc: 'Crie seu próprio DApp ou Faucet L2 gamificada utilizando os recursos on-chain.',
        icon: '🛠️',
        category: 'dev',
        tag: 'Dev Tools',
        color: 'from-gray-600 to-gray-500',
        glow: 'rgba(156,163,175,0.5)',
        available: false,
    }
];

const SidebarItem: React.FC<{
    id: string; label: string; icon: string; active: boolean; onClick: () => void;
}> = ({ label, icon, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`
            w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 text-left
            ${active ? 'bg-white/10 text-white shadow-[inset_2px_0_0_#eab308]' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}
        `}
    >
        <span className="text-xl">{icon}</span>
        <span className={`font-medium ${active ? 'font-bold tracking-wide' : ''}`}>{label}</span>
    </button>
);

export const DappsEnvironment: React.FC<DappsEnvironmentProps> = ({ onClose }) => {
    const [activeDapp, setActiveDapp] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [currentTime, setCurrentTime] = useState<string>('');

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        };
        updateTime();
        const interval = setInterval(updateTime, 10000);
        return () => clearInterval(interval);
    }, []);

    if (activeDapp === 'faucethub') {
        return <FaucetHub onBack={() => setActiveDapp(null)} />;
    }

    if (activeDapp === 'faucetinternal') {
        return <FaucetInternal onBack={() => setActiveDapp(null)} />;
    }

    return (
        <div className="fixed inset-0 z-50 bg-[#02000A] text-white flex flex-col font-sans overflow-hidden animate-slideUpFadeIn">
            {/* --- Dynamic OS Background --- */}
            <div className="absolute inset-0 z-0 opacity-60 pointer-events-none">
                {/* Glowing Orbs */}
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-900/20 rounded-full blur-[120px] animate-[pulse_8s_infinite]"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-blue-900/10 rounded-full blur-[150px] animate-[pulse_12s_infinite_reverse]"></div>
                <div className="absolute top-[40%] left-[30%] w-[30vw] h-[30vw] bg-green-900/10 rounded-full blur-[100px] animate-[pulse_10s_infinite]"></div>
                
                {/* Cyber Grid Pattern */}
                <div 
                    className="absolute inset-0 opacity-[0.03]" 
                    style={{
                        backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
                        backgroundSize: '40px 40px'
                    }}
                ></div>
            </div>

            {/* --- Top OS Status Bar --- */}
            <div className="relative z-30 h-8 bg-black/40 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 text-[11px] font-medium text-gray-300 uppercase tracking-wider">
                <div className="flex items-center space-x-6">
                    <span className="font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-yellow-600 flex items-center">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                        FaucetChain OS v2.0
                    </span>
                    <span className="hidden sm:inline-block">Network: Hybrid PoC+PoS</span>
                    <span className="flex items-center">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 shadow-[0_0_5px_#22c55e]"></div> 
                        Node Sync: Optimal
                    </span>
                </div>
                <div className="flex items-center space-x-6">
                    <span className="hidden sm:inline-block">Connection: SECURE L1</span>
                    <span>{currentTime}</span>
                </div>
            </div>

            {/* --- Main Workspace --- */}
            <div className="flex-1 flex relative z-20 overflow-hidden">
                
                {/* Glassmorphic Sidebar */}
                <div className="w-72 bg-black/30 backdrop-blur-2xl border-r border-white/5 flex flex-col pt-10 pb-6 relative z-30 shadow-2xl">
                    <div className="px-8 mb-12 flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-[0_0_20px_rgba(234,179,8,0.4)]">
                            <span className="text-black font-black text-2xl">D</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-wider text-white">App Library</h1>
                            <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest mt-1">Ecosystem</p>
                        </div>
                    </div>
                    
                    <nav className="flex-1 px-4 space-y-2">
                        <SidebarItem id="all" label="Visão Geral" icon="🌌" active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} />
                        <div className="pt-4 pb-2 px-4">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Infraestrutura</p>
                        </div>
                        <SidebarItem id="l1" label="L1 Core Network" icon="⚡" active={activeCategory === 'l1'} onClick={() => setActiveCategory('l1')} />
                        <SidebarItem id="l2" label="L2 Ecosystem" icon="🎮" active={activeCategory === 'l2'} onClick={() => setActiveCategory('l2')} />
                        <SidebarItem id="dev" label="Developer Hub" icon="💻" active={activeCategory === 'dev'} onClick={() => setActiveCategory('dev')} />
                    </nav>

                    <div className="px-6 mt-auto">
                        <button 
                            onClick={onClose}
                            className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-300 flex items-center justify-center space-x-3 text-sm font-semibold text-gray-300 hover:text-white hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] group"
                        >
                            <span className="group-hover:-translate-x-1 transition-transform">⏏</span>
                            <span>Sair do Sistema</span>
                        </button>
                    </div>
                </div>

                {/* App Grid Dashboard */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-14 relative z-20">
                    <div className="max-w-7xl mx-auto h-full flex flex-col">
                        
                        {/* Header Context */}
                        <div className="mb-12 animate-fadeIn" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                            <h2 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
                                {activeCategory === 'all' && 'Todos os Aplicativos'}
                                {activeCategory === 'l1' && 'Infraestrutura L1 Nativa'}
                                {activeCategory === 'l2' && 'Ecossistema L2 Gamificado'}
                                {activeCategory === 'dev' && 'Developer Tools'}
                            </h2>
                            <p className="text-gray-400 text-lg font-medium max-w-2xl">
                                Selecione uma aplicação para interagir com os protocolos nativos e hubs de distribuição da rede FaucetChain.
                            </p>
                        </div>

                        {/* Responsive Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-20">
                            {apps.filter(a => activeCategory === 'all' || a.category === activeCategory).map((app, index) => (
                                <div 
                                    key={app.id}
                                    onClick={() => app.available && setActiveDapp(app.id)}
                                    className={`
                                        relative rounded-3xl p-7 border backdrop-blur-xl overflow-hidden group transition-all duration-500 animate-slideUpFadeIn
                                        ${app.available 
                                            ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.06] hover:border-white/30 cursor-pointer hover:-translate-y-2' 
                                            : 'bg-black/40 border-white/5 opacity-60 cursor-not-allowed grayscale-[30%]'}
                                    `}
                                    style={{
                                        animationDelay: `${0.1 + index * 0.05}s`,
                                        animationFillMode: 'both'
                                    }}
                                >
                                    {/* Hover Internal Glow Effect */}
                                    {app.available && (
                                        <div 
                                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                                            style={{ background: `radial-gradient(circle at 50% 120%, ${app.glow}, transparent 70%)` }}
                                        ></div>
                                    )}
                                    
                                    {/* Glass reflection highlight */}
                                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    
                                    {/* Icon Container */}
                                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center text-3xl mb-6 shadow-lg relative z-10 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500`}>
                                        {app.icon}
                                    </div>
                                    
                                    <h3 className="text-xl font-bold text-white mb-3 relative z-10">{app.title}</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed mb-8 relative z-10">{app.desc}</p>
                                    
                                    {/* Status Badge */}
                                    <div className="absolute bottom-6 left-7 right-7 flex items-center space-x-2 z-10">
                                        <div className={`w-2.5 h-2.5 rounded-full ${app.available ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} style={{ boxShadow: app.available ? '0 0 10px #22c55e' : 'none' }}></div>
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-gray-300">{app.tag}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
