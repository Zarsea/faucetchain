import React, { useState, useEffect } from 'react';
import { useCyberDrip } from './useCyberDrip';
import { L2ProfileDashboard } from './L2ProfileDashboard';
import { useAuth } from './AuthContext';

const FAUCET_CREATOR_WALLET = "0x84da71247cbfb0737a9112de1f10dae9823fc298";

const RANK_COLORS: Record<number, string> = {
  0: 'text-gray-500 border-gray-500/40 bg-gray-500/10', 
  1: 'text-blue-400 border-blue-500/40 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.5)]', 
  2: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.5)]', 
  3: 'text-purple-400 border-purple-500/40 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.6)]', 
  4: 'text-rose-400 border-rose-500/40 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.6)]', 
  5: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10 shadow-[0_0_25px_rgba(234,179,8,0.7)]',
};

const RANK_GRADIENTS: Record<number, string> = {
  0: 'from-gray-600 to-gray-500', 1: 'from-blue-600 to-blue-400', 2: 'from-cyan-600 to-cyan-400',
  3: 'from-purple-600 to-purple-400', 4: 'from-rose-600 to-rose-400', 5: 'from-yellow-600 to-yellow-400'
};

interface Props { onBack: () => void; }

export const FaucetInternal: React.FC<Props> = ({ onBack }) => {
  const { userAddress } = useAuth();
  const drip = useCyberDrip(userAddress || "", FAUCET_CREATOR_WALLET);
  const p = drip.profile;
  const tier = p?.rank_tier ?? 0;
  const rankStyle = RANK_COLORS[tier] || RANK_COLORS[0];
  const rankGrad = RANK_GRADIENTS[tier] || RANK_GRADIENTS[0];

  const [currentTime, setCurrentTime] = useState<string>('');
  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#02000A] text-green-500 font-mono overflow-hidden animate-slideUpFadeIn flex flex-col">
      {/* --- Dynamic Hacker Background --- */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-green-900/10 rounded-full blur-[150px] animate-[pulse_8s_infinite]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-pink-900/10 rounded-full blur-[150px] animate-[pulse_12s_infinite_reverse]"></div>
        
        {/* Scanline Grid */}
        <div 
          className="absolute inset-0 opacity-20" 
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.1) 2px, rgba(0,255,65,0.1) 4px), linear-gradient(90deg, rgba(0,255,65,0.05) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 20px 20px'
          }}
        ></div>
      </div>

      {/* --- Terminal OS Header --- */}
      <div className="relative z-30 h-16 bg-black/60 backdrop-blur-2xl border-b border-green-500/20 flex items-center justify-between px-6 shadow-[0_4px_30px_rgba(0,255,65,0.1)]">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-black border border-green-500/50 rounded flex items-center justify-center text-xl shadow-[inset_0_0_10px_rgba(0,255,65,0.5)]">
            <span className="animate-pulse">_</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-green-400 tracking-[0.2em] uppercase text-shadow-glow">CyberDrip Terminal</h1>
            <p className="text-[10px] text-green-600 uppercase tracking-widest">L2 Gamified Faucet Engine • Root Access</p>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          {p && (
            <div className={`px-3 py-1 rounded border text-[10px] font-bold uppercase tracking-widest flex items-center space-x-2 ${rankStyle}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
              <span>{p.rank_name}</span>
            </div>
          )}
          <span className="text-green-600 text-xs tracking-widest">{currentTime}</span>
          <button 
            onClick={onBack}
            className="px-4 py-2 bg-black border border-green-500/50 text-green-400 rounded hover:bg-green-900/30 hover:border-green-400 transition-all font-bold text-xs tracking-widest uppercase flex items-center space-x-2"
          >
            <span>&larr; Exit</span>
          </button>
        </div>
      </div>

      {/* --- Main Dashboard Area --- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 relative z-20">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Stats Row HUD */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'SALDO L2 (VIRTUAL)', value: drip.virtualBalance.toFixed(2), unit: 'CLAIM', color: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-950/20' },
              { label: 'RESERVA L1 (TREASURY)', value: drip.faucetReserve.toLocaleString(), unit: 'CLAIM', color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-950/20' },
              { label: 'DAILY STREAK', value: p?.streak_days ?? 0, unit: 'DIAS', color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-950/20' },
              { label: 'TOTAL EARNED', value: (p?.total_earned ?? 0).toFixed(1), unit: 'CLAIM', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-950/20' },
            ].map((s, i) => (
              <div key={i} className={`p-4 rounded-xl border backdrop-blur-md flex flex-col items-center justify-center relative overflow-hidden group ${s.bg} ${s.border}`}>
                <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <p className={`text-[9px] font-bold tracking-[0.2em] mb-1 opacity-70 ${s.color}`}>{s.label}</p>
                <p className={`text-3xl font-black ${s.color} drop-shadow-md`}>{s.value}</p>
                <p className="text-[10px] text-gray-500 font-bold mt-1">{s.unit}</p>
              </div>
            ))}
          </div>

          {/* Rank Progress Bar */}
          {p && (
            <div className="bg-black/60 border border-white/10 rounded-xl p-5 backdrop-blur-md">
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs font-bold tracking-widest uppercase ${RANK_COLORS[tier].split(' ')[0]}`}>
                  Rank: {p.rank_name} <span className="text-gray-500">(Tier {tier})</span>
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">
                  {p.total_claims} / {p.next_rank_claims} Claims &rarr; <span className="text-gray-200">{p.next_rank_name}</span>
                </span>
              </div>
              <div className="h-2 bg-gray-900 rounded-full overflow-hidden border border-white/5 relative">
                <div 
                  className={`h-full bg-gradient-to-r ${rankGrad} transition-all duration-1000 ease-out`}
                  style={{ width: `${p.rank_progress_pct}%`, boxShadow: `0 0 10px var(--tw-gradient-to)` }}
                />
              </div>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-2 flex justify-between">
                <span>Rank Bonus: +{p.rank_bonus_pct}% EXP/Drop</span>
                <span>Experience Points: {p.exp} EXP</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Col: Drip Engine & Daily Ops */}
            <div className="lg:col-span-5 space-y-6 flex flex-col">
              
              {/* Drip Engine Card */}
              <div className="bg-black/60 border border-green-500/30 rounded-xl p-6 backdrop-blur-md relative overflow-hidden flex-1">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-bl-full blur-2xl"></div>
                <h2 className="text-sm font-black text-green-400 tracking-[0.2em] mb-6 flex items-center">
                  <span className="w-2 h-2 bg-green-500 mr-2 animate-pulse"></span>
                  DRIP ENGINE
                </h2>

                <div className="mb-5">
                  <label className="text-[10px] font-bold text-green-600 tracking-widest uppercase block mb-2">Target Wallet</label>
                  <input 
                    type="text" 
                    value={userAddress || "CONNECT WALLET FIRST"} 
                    readOnly
                    className="w-full bg-black/50 border border-green-500/40 rounded-lg px-4 py-3 text-green-400 text-xs font-mono outline-none cursor-not-allowed opacity-80"
                  />
                </div>

                {drip.status && (
                  <div className={`p-3 rounded-lg mb-5 text-xs border backdrop-blur-sm ${drip.status.type === 'success' ? 'bg-green-900/20 border-green-500/40 text-green-400' : 'bg-red-900/20 border-red-500/40 text-red-400'}`}>
                    {drip.status.text}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <button 
                    onClick={drip.handleClaim} 
                    disabled={drip.loading || drip.cooldown > 0} 
                    className={`py-4 rounded-xl border font-bold text-xs tracking-widest uppercase transition-all ${
                      drip.cooldown > 0 
                        ? 'bg-gray-900/50 border-gray-800 text-gray-600 cursor-not-allowed' 
                        : 'bg-green-900/30 border-green-500 text-green-400 hover:bg-green-800/50 hover:shadow-[0_0_20px_rgba(0,255,65,0.4)]'
                    }`}
                  >
                    {drip.loading ? 'Processing...' : drip.cooldown > 0 ? `Wait ${drip.cooldown}s` : 'Execute Drip'}
                  </button>
                  
                  <button 
                    onClick={drip.handleWithdraw} 
                    disabled={drip.loading || drip.virtualBalance < 10} 
                    className={`py-4 rounded-xl border font-bold text-xs tracking-widest uppercase transition-all ${
                      drip.virtualBalance >= 10 
                        ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400 hover:bg-cyan-800/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]' 
                        : 'bg-gray-900/50 border-gray-800 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    Withdraw L1
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => drip.setShowProfile(true)} 
                    className="py-3 rounded-xl bg-black border border-white/10 text-gray-300 font-bold text-[10px] tracking-widest uppercase hover:bg-white/5 hover:border-white/30 transition-all flex items-center justify-center space-x-2"
                  >
                    <span>👤 L2 Profile</span>
                  </button>
                  <button 
                    onClick={() => drip.setShowShop(true)} 
                    className="py-3 rounded-xl bg-black border border-pink-500/30 text-pink-400 font-bold text-[10px] tracking-widest uppercase hover:bg-pink-900/20 hover:border-pink-500 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)] transition-all flex items-center justify-center space-x-2"
                  >
                    <span>🛒 Booster Shop</span>
                  </button>
                </div>

                {p?.active_boosters && p.active_boosters.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <p className="text-[9px] font-bold text-purple-500 uppercase tracking-widest mb-2 border-b border-purple-500/20 pb-1">Active Augmentations</p>
                    {p.active_boosters.map((b, i) => (
                      <div key={i} className="flex justify-between items-center bg-purple-900/20 border border-purple-500/30 rounded-lg p-2 px-3 text-[10px] text-purple-300">
                        <span className="font-bold flex items-center"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2 animate-pulse"></span> {b.label} ({b.multiplier}x)</span>
                        <span className="font-mono">{Math.floor(b.remaining_seconds / 60)}m left</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Missions Card */}
              <div className="bg-black/60 border border-orange-500/30 rounded-xl p-6 backdrop-blur-md">
                <h2 className="text-sm font-black text-orange-400 tracking-[0.2em] mb-4 flex items-center">
                  <span className="w-2 h-2 bg-orange-500 mr-2 animate-pulse"></span>
                  DAILY OPS
                </h2>
                <div className="space-y-3">
                  {(p?.missions ?? []).map(m => (
                    <div key={m.id} className={`p-3 rounded-lg border flex justify-between items-center transition-colors ${m.completed ? 'bg-green-900/10 border-green-500/30' : 'bg-black/40 border-white/5'}`}>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] ${m.completed ? 'text-green-400' : 'text-gray-500'}`}>{m.completed ? '☑' : '☐'}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${m.completed ? 'text-green-400' : 'text-gray-300'}`}>{m.label}</span>
                        </div>
                        <p className="text-[9px] text-gray-500 mt-1 ml-4">{m.desc}</p>
                      </div>
                      <span className={`text-[10px] font-bold ${m.completed ? 'text-green-400' : 'text-orange-500'}`}>+{m.reward}</span>
                    </div>
                  ))}
                </div>
                {p && <p className="text-[9px] text-center text-gray-500 uppercase tracking-widest mt-4">Bonus Acumulado: <span className="text-white">+{p.bonus_today.toFixed(2)} CLAIM</span></p>}
              </div>

            </div>

            {/* Right Col: Minigame & Leaderboard */}
            <div className="lg:col-span-7 space-y-6 flex flex-col">
              
              {/* Data Intercept Minigame */}
              {drip.minigameActive && (
                <div className="bg-black/80 border border-pink-500/40 rounded-xl p-6 backdrop-blur-md shadow-[0_0_30px_rgba(244,63,94,0.1)] relative">
                  <div className="flex justify-between items-center mb-4 border-b border-pink-500/20 pb-3">
                    <div>
                      <h2 className="text-sm font-black text-pink-400 tracking-[0.2em] flex items-center">
                        <span className="w-2 h-2 bg-pink-500 mr-2 animate-ping"></span>
                        DATA INTERCEPT
                      </h2>
                      <p className="text-[9px] text-pink-600 uppercase tracking-widest mt-1">Isolamento de Pacotes Críticos</p>
                    </div>
                    <div className={`text-3xl font-black tracking-widest ${drip.minigameTimeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-green-400'}`}>
                      00:{drip.minigameTimeLeft.toString().padStart(2, '0')}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">SCORE ATUAL</p>
                      <p className="text-2xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">{drip.minigameScore}</p>
                    </div>
                    <p className="text-[9px] text-gray-400 max-w-[200px] text-right">
                      Colete dados (<span className="text-green-400 font-bold">Verde</span>). Evite malwares (<span className="text-red-500 font-bold">Vermelho</span>). O multiplicador será aplicado no DRIP.
                    </p>
                  </div>
                  
                  <div className="relative w-full h-[280px] bg-[#050011] border border-pink-500/20 rounded-xl overflow-hidden cursor-crosshair">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,65,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.05)_1px,transparent_1px)]" style={{ backgroundSize: '20px 20px' }}></div>
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.4),transparent_70%)] pointer-events-none"></div>

                    {!drip.minigameResult ? drip.minigameNodes.map(n => (
                      <button 
                        key={n.id} 
                        onClick={() => drip.clickNode(n.id, n.type)} 
                        className={`absolute w-10 h-10 rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 flex items-center justify-center ${
                          n.type === 'valid' 
                            ? 'bg-green-500/20 border-green-400 shadow-[0_0_20px_rgba(0,255,65,0.6)]' 
                            : 'bg-red-500/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                        }`}
                        style={{ left: `${n.x}%`, top: `${n.y}%` }}
                      >
                        <div className={`w-3 h-3 rounded-full ${n.type === 'valid' ? 'bg-green-400' : 'bg-red-500'}`}></div>
                      </button>
                    )) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
                        <h3 className={`text-3xl font-black mb-2 tracking-widest ${drip.minigameScore > 0 ? 'text-green-400' : 'text-red-500'}`}>TEMPO ESGOTADO</h3>
                        <p className="text-sm text-white font-bold px-6 py-2 border border-white/20 rounded-lg bg-white/5">{drip.minigameResult}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Leaderboard */}
              <div className="bg-black/60 border border-purple-500/30 rounded-xl p-6 backdrop-blur-md flex-1">
                <h2 className="text-sm font-black text-purple-400 tracking-[0.2em] mb-4 flex items-center">
                  <span className="w-2 h-2 bg-purple-500 mr-2 animate-pulse"></span>
                  GLOBAL RANKING
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-purple-500/20">
                        {['Rank', 'Identidade', 'Total Farmado', 'Streak', 'Nível'].map(h => (
                          <th key={h} className="pb-3 text-[9px] font-bold text-purple-500 uppercase tracking-widest px-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {drip.leaderboard.map(e => (
                        <tr key={e.position} className="hover:bg-white/[0.02] transition-colors">
                          <td className={`py-3 px-2 font-black ${e.position <= 3 ? 'text-yellow-400' : 'text-gray-500'}`}>
                            {e.position <= 3 ? ['🥇','🥈','🥉'][e.position-1] : `#${e.position}`}
                          </td>
                          <td className="py-3 px-2 text-gray-300 font-mono text-[10px]">{e.wallet.slice(0,8)}...{e.wallet.slice(-4)}</td>
                          <td className="py-3 px-2 text-green-400 font-bold text-xs">{e.total_earned.toFixed(2)}</td>
                          <td className="py-3 px-2 text-orange-400 text-xs font-bold">🔥 {e.streak_days}</td>
                          <td className="py-3 px-2">
                            <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${RANK_COLORS[e.position <= 5 ? Math.min(e.position, 5) : 0]}`}>
                              {e.rank_name}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {drip.leaderboard.length === 0 && (
                        <tr><td colSpan={5} className="py-8 text-center text-gray-600 text-xs italic">Aguardando registros na rede...</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* --- Modals --- */}
      {drip.showProfile && <L2ProfileDashboard drip={drip} onClose={() => drip.setShowProfile(false)} />}
      
      {drip.showShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => drip.setShowShop(false)}></div>
          <div className="relative w-full max-w-lg bg-black/90 border border-pink-500/40 rounded-2xl p-8 shadow-[0_0_50px_rgba(244,63,94,0.15)] animate-slideUpFadeIn overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-pink-500/10 rounded-bl-full blur-2xl pointer-events-none"></div>
            
            <h2 className="text-xl font-black text-pink-400 tracking-[0.2em] mb-2 uppercase">Booster Shop</h2>
            <p className="text-[10px] text-gray-400 mb-6 leading-relaxed">
              Adquira módulos de amplificação temporária. Tokens gastos possuem mecânica deflacionária: <span className="text-pink-400 font-bold">30-50% são queimados</span> permanentemente do suprimento L1.
            </p>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
              {drip.boosterCatalog.map((b: any) => (
                <div key={b.type} className="p-4 bg-pink-950/10 border border-pink-500/20 rounded-xl flex items-center justify-between hover:bg-pink-900/20 transition-colors group">
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1 group-hover:text-pink-300 transition-colors">{b.label}</h3>
                    <p className="text-[10px] text-gray-500 mb-2">{b.desc}</p>
                    <div className="flex items-center space-x-3 text-[9px] font-bold">
                      <span className="text-green-400">{b.multiplier}x BOOST</span>
                      <span className="text-cyan-400">{b.duration_h}h DUR.</span>
                      <span className="text-orange-400">🔥 {(b.burn_pct*100).toFixed(0)}% BURN</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => drip.buyBooster(b.type)}
                    className="px-4 py-2 bg-pink-900/30 border border-pink-500 text-pink-400 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-pink-500 hover:text-white hover:shadow-[0_0_15px_rgba(244,63,94,0.5)] transition-all whitespace-nowrap ml-4"
                  >
                    {b.cost} CLAIM
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={() => drip.setShowShop(false)}
              className="w-full mt-6 py-3 border border-white/10 text-gray-400 rounded-xl hover:bg-white/5 hover:text-white transition-colors text-[10px] font-bold tracking-widest uppercase"
            >
              FECHAR TERMINAL
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
