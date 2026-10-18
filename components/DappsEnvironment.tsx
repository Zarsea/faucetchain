import React, { useState, useEffect } from 'react';
import { FaucetHub } from './FaucetHub';
import { FaucetInternal } from './FaucetInternal';
import ConnectYourFaucet from './ConnectYourFaucet';

export const DappsFloatingButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            // O bounce infinito saiu. Um alvo que nunca para de se mexer e dificil
            // de acertar com o cursor, e impossivel para automacao: o Playwright
            // espera o elemento ficar estavel antes de clicar, e este nunca ficava.
            // Era a causa de "esse botao nao funciona".
            //
            // A atencao que a animacao buscava continua vindo do halo e do crescer
            // no hover, que acontecem quando o cursor ja esta la -- quando o alvo
            // ficar parado e o unico momento em que mexer ajuda.
            className="fixed bottom-5 right-5 w-16 h-16 md:bottom-12 md:right-12 md:w-24 md:h-24 z-40 bg-gradient-to-br from-brand-accent via-yellow-500 to-yellow-600 shadow-[0_0_25px_rgba(234,179,8,0.7)] flex items-center justify-center cursor-pointer hover:scale-110 hover:shadow-[0_0_40px_rgba(234,179,8,1)] transition-all duration-300"
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
        desc: 'L1 monitoring, Proof of Reserve and the faucet registry. The core console.',
        icon: '🌐',
        category: 'l1',
        tag: 'L1 Native',
        color: 'from-purple-600 to-indigo-600',
        glow: 'rgba(99,102,241,0.5)',
        available: true,
    },
    {
        id: 'faucetswap',
        title: 'FaucetSwap DEX',
        desc: 'The first native DEX. Gasless trading and liquidity.',
        icon: '💱',
        category: 'l1',
        tag: 'Coming Soon',
        color: 'from-blue-600 to-cyan-500',
        glow: 'rgba(6,182,212,0.5)',
        available: false,
    },
    {
        id: 'claimnfts',
        title: 'ClaimNFTs',
        desc: 'An on-chain marketplace for digital collectibles.',
        icon: '🖼️',
        category: 'l1',
        tag: 'Coming Soon',
        color: 'from-pink-600 to-rose-500',
        glow: 'rgba(244,63,94,0.5)',
        available: false,
    },
    {
        id: 'faucetinternal',
        title: 'CyberDrip Terminal',
        desc: 'Gamified L2 faucet. Daily missions, EXP ranking and data interception.',
        icon: '💻',
        category: 'l2',
        tag: 'L2 Live',
        color: 'from-green-500 to-emerald-600',
        glow: 'rgba(16,185,129,0.5)',
        available: true,
    },
    {
        id: 'retrodrip',
        title: 'Retro Drip L2',
        desc: 'An 8-bit throwback faucet. Farming through classic arcades and leaderboards.',
        icon: '👾',
        category: 'l2',
        tag: 'L2 Planned',
        color: 'from-yellow-500 to-orange-500',
        glow: 'rgba(245,158,11,0.5)',
        available: false,
    },
    {
        id: 'devhub',
        // O cartao dizia "construa a sua propria DApp". Isso convida quem nao
        // tem nada; o cliente desta rede e quem JA opera uma torneira e paga
        // os usuarios do proprio bolso. O titulo agora e o que a pagina
        // entrega a ele.
        title: 'Connect Your Faucet',
        desc: 'Already run a faucet? A sponsor funds the rewards. One HTTP call connects it.',
        icon: '🔌',
        category: 'dev',
        tag: 'Integration',
        color: 'from-cyan-600 to-teal-500',
        glow: 'rgba(34,211,238,0.5)',
        available: true,
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

    if (activeDapp === 'devhub') {
        return <ConnectYourFaucet onBack={() => setActiveDapp(null)} />;
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
                    <span className="hidden sm:inline-block">Network: micro-distribution rail</span>
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
                {/* Fixa em 288px, ela ocupava 74% de um telefone de 390 e empurrava o
                    catalogo para uma coluna de uma palavra por linha. No
                    telefone o mesmo conteudo vira a faixa de chips abaixo. */}
                <div className="hidden md:flex w-72 bg-black/30 backdrop-blur-2xl border-r border-white/5 flex-col pt-10 pb-6 relative z-30 shadow-2xl">
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
                        <SidebarItem id="all" label="Overview" icon="🌌" active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} />
                        <div className="pt-4 pb-2 px-4">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Infrastructure</p>
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
                            <span>Exit</span>
                        </button>
                    </div>
                </div>

                {/* App Grid Dashboard */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-14 relative z-20">
                    <div className="max-w-7xl mx-auto h-full flex flex-col">
                        
                        {/* So no telefone: marca, saida e as mesmas quatro categorias da
                            barra lateral, em linha. Quatro filtros nao justificam uma
                            gaveta -- gaveta cobraria um toque a mais para ver o que ja
                            cabe na tela. */}
                        <div className="md:hidden mb-6">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 flex-shrink-0 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                                        <span className="text-black font-black text-lg">D</span>
                                    </div>
                                    <h1 className="text-base font-bold tracking-wide text-white truncate">App Library</h1>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="flex-shrink-0 min-h-[44px] px-4 bg-white/5 active:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-gray-300"
                                >
                                    &#9167; Exit
                                </button>
                            </div>
                            {/* Rola na horizontal dentro da propria faixa, para que a
                                pagina nunca role de lado por causa dela. */}
                            <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {([['all', 'Overview'], ['l1', 'L1 Core'], ['l2', 'L2 Ecosystem'], ['dev', 'Developer Hub']] as const).map(([id, rotulo]) => (
                                    <button
                                        key={id}
                                        onClick={() => setActiveCategory(id)}
                                        className={`flex-shrink-0 min-h-[40px] px-4 rounded-full text-xs font-bold whitespace-nowrap border transition-colors
                                            ${activeCategory === id
                                                ? 'bg-yellow-400/15 border-yellow-400/40 text-yellow-300'
                                                : 'bg-white/[0.04] border-white/10 text-gray-400'}`}
                                    >
                                        {rotulo}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Header Context */}
                        <div className="mb-8 md:mb-12 animate-fadeIn" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
                            <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-3 tracking-tight">
                                {activeCategory === 'all' && 'All Apps'}
                                {activeCategory === 'l1' && 'Native L1 Infrastructure'}
                                {activeCategory === 'l2' && 'Gamified L2 Ecosystem'}
                                {activeCategory === 'dev' && 'Developer Tools'}
                            </h2>
                            <p className="text-gray-400 text-base md:text-lg font-medium max-w-2xl">
                                Pick an app to work with the native protocols and distribution hubs on the FaucetChain network.
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
