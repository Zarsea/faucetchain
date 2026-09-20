import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../apiConfig';
import { useAuth } from './AuthContext';
import { solvePocChallenge } from '../utils/poc';
import { signAction } from '../utils/actionSignature';import { withdrawMessage, boosterMessage } from '../utils/actionMessage';


export interface Mission { id: string; label: string; desc: string; reward: number; completed: boolean; available: boolean; }
export interface Booster { type: string; label: string; multiplier: number; remaining_seconds: number; }
export interface LeaderEntry { position: number; wallet: string; total_claims: number; total_earned: number; streak_days: number; rank_name: string; }
export interface Profile {
  wallet: string; total_claims: number; total_earned: number; streak_days: number;
  rank_tier: number; rank_name: string; rank_bonus_pct: number; rank_progress_pct: number;
  next_rank_name: string; next_rank_claims: number; claims_today: number; bonus_today: number;
  level: number; exp: number; next_level_exp: number;
  missions: Mission[]; active_boosters: Booster[]; total_multiplier: number;
}
export interface DataNode { id: number; type: 'valid' | 'corrupted'; x: number; y: number; }
export interface DailyLog { claim_date: string; claims_today: number; bonus_earned: number; }
export interface NFT { id: number; nft_id: string; name: string; type: string; description: string; acquired_at: number; }

export function useCyberDrip(walletAddress: string, faucetWallet: string) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [virtualBalance, setVirtualBalance] = useState(0);
  const [faucetReserve, setFaucetReserve] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  
  // Data Intercept Minigame states
  const [minigameActive, setMinigameActive] = useState(false);
  const [minigameTimeLeft, setMinigameTimeLeft] = useState(0);
  const [minigameScore, setMinigameScore] = useState(0);
  const [minigameNodes, setMinigameNodes] = useState<DataNode[]>([]);
  const [minigameResult, setMinigameResult] = useState<string | null>(null);
  const minigameIntervalRef = useRef<any>(null);
  const minigameSpawnerRef = useRef<any>(null);

  const [boosterCatalog, setBoosterCatalog] = useState<any[]>([]);
  const [showShop, setShowShop] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [stats, setStats] = useState<{ daily_logs: DailyLog[]; nfts: NFT[] }>({ daily_logs: [], nfts: [] });

  const wallet = walletAddress.trim().toLowerCase();
  const { authMethod } = useAuth();

  const fetchProfile = useCallback(async () => {
    if (!wallet) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/cyberdrip/profile/${wallet}`);
      if (r.ok) setProfile(await r.json());
    } catch {}
  }, [wallet]);

  const fetchBalance = useCallback(async () => {
    if (!wallet) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/balance/${wallet}`);
      if (r.ok) {
        const d = await r.json();
        const entry = d.faucets?.find((f: any) => f.faucet_wallet.toLowerCase() === faucetWallet.toLowerCase());
        setVirtualBalance(entry?.virtual_balance ?? 0);
      }
    } catch {}
  }, [wallet]);

  const fetchReserve = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/user/${faucetWallet}/balance`);
      if (r.ok) { const d = await r.json(); setFaucetReserve(d.balance || d.total_claim || 0); }
    } catch {}
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/cyberdrip/leaderboard`);
      if (r.ok) setLeaderboard(await r.json());
    } catch {}
  }, []);

  const fetchCatalog = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/cyberdrip/boosters/catalog`);
      if (r.ok) setBoosterCatalog(await r.json());
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    if (!wallet) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/cyberdrip/profile/${wallet}/stats`);
      if (r.ok) setStats(await r.json());
    } catch {}
  }, [wallet]);

  useEffect(() => {
    fetchProfile(); fetchBalance(); fetchReserve(); fetchLeaderboard(); fetchCatalog(); fetchStats();
    const iv = setInterval(() => { fetchProfile(); fetchBalance(); fetchReserve(); }, 10000);
    return () => clearInterval(iv);
  }, [wallet]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const startMinigame = () => {
    setMinigameActive(true);
    setMinigameTimeLeft(10); // 10 seconds to play
    setMinigameScore(0);
    setMinigameNodes([]);
    setMinigameResult(null);

    // Spawner
    minigameSpawnerRef.current = setInterval(() => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const isCorrupted = Math.random() < 0.3; // 30% chance of being a bad node
      const x = Math.floor(Math.random() * 85); // 0 to 85% width
      const y = Math.floor(Math.random() * 80); // 0 to 80% height

      setMinigameNodes(prev => [...prev, { id, type: isCorrupted ? 'corrupted' : 'valid', x, y }]);
      
      // Node disappears after 1.2s
      setTimeout(() => {
        setMinigameNodes(prev => prev.filter(n => n.id !== id));
      }, 1200);
    }, 600);

    // Timer
    minigameIntervalRef.current = setInterval(() => {
      setMinigameTimeLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // We need an effect to watch for time == 0 to submit with the correct state
  useEffect(() => {
    if (minigameActive && minigameTimeLeft === 0) {
      clearInterval(minigameIntervalRef.current);
      clearInterval(minigameSpawnerRef.current);
      setMinigameNodes([]);
      submitMinigame(minigameScore);
    }
  }, [minigameTimeLeft, minigameActive]);


  const clickNode = (id: number, type: 'valid' | 'corrupted') => {
    if (minigameTimeLeft === 0) return;
    setMinigameNodes(prev => prev.filter(n => n.id !== id));
    setMinigameScore(prev => prev + (type === 'valid' ? 1 : -2));
  };

  const submitMinigame = async (finalScore: number) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/cyberdrip/minigame/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, score: finalScore })
      });
      const d = await r.json();
      setMinigameResult(d.message);
      if (d.bonus > 0) { fetchBalance(); fetchProfile(); }
      setTimeout(() => setMinigameActive(false), 3000);
    } catch { setMinigameResult('Erro de conexão'); setMinigameActive(false); }
  };

  const handleClaim = async () => {
    if (!wallet) return;
    setLoading(true); setStatus(null);
    try {
      // A faucet interna não usa API key no navegador: o servidor define carteira
      // e valor, e o clique carrega a mesma Proof of Claim do /api/claim.
      const proof = await solvePocChallenge(wallet, (text) => setStatus({ text, type: 'info' }));
      const r = await fetch(`${API_BASE_URL}/api/faucethub/internal/microclaim`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_wallet: wallet, ...proof })
      });
      const d = await r.json();
      if (r.ok) {
        setStatus({ text: `+${Number(d.credited).toFixed(2)} CLAIM injetado no sistema`, type: 'success' });
        setCooldown(300);
        fetchProfile(); fetchBalance(); fetchLeaderboard();
        startMinigame(); // Start Data Intercept
      } else {
        setStatus({ text: d.detail || 'Erro', type: 'error' });
        if (r.status === 429) {
          const m = d.detail?.match(/Wait (\d+)s/);
          if (m) setCooldown(parseInt(m[1]));
        }
      }
    } catch (e: any) {
      setStatus({ text: `Erro: ${e.message}`, type: 'error' });
    } finally { setLoading(false); }
  };

  const handleWithdraw = async () => {
    if (virtualBalance < 10) { setStatus({ text: 'Mínimo 10 CLAIM para saque L1', type: 'error' }); return; }
    setLoading(true);
    try {
      const faucet = faucetWallet.trim().toLowerCase();
      const sig = await signAction(authMethod, (ts) =>
        withdrawMessage(wallet, faucet, ts));
      const r = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/withdraw`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_wallet: wallet, faucet_wallet: faucet, ...sig })
      });
      const d = await r.json();
      if (r.ok) { setStatus({ text: `Liquidação L1 OK! Tx: ${d.tx_hash?.slice(0, 16)}...`, type: 'success' }); fetchBalance(); fetchReserve(); }
      else setStatus({ text: d.detail, type: 'error' });
    } catch (e: any) { setStatus({ text: e.message, type: 'error' }); }
    finally { setLoading(false); }
  };

  const buyBooster = async (type: string) => {
    try {
      // O custo entra na frase assinada, entao quem assina ve quanto sai -- e a
      // assinatura nao serve para um booster mais caro. Vem do catalogo que o
      // servidor mandou, que e a mesma tabela que ele cobra.
      const item = boosterCatalog.find((b: any) => b.type === type);
      if (!item) throw new Error('Catalogo de boosters ainda nao carregou.');
      const sig = await signAction(authMethod, (ts) =>
        boosterMessage(wallet, type, item.cost, ts));
      const r = await fetch(`${API_BASE_URL}/api/cyberdrip/booster/buy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, booster_type: type, ...sig })
      });
      const d = await r.json();
      if (r.ok) { setStatus({ text: `${d.label} ativado! ${d.multiplier}x por ${d.duration_hours}h`, type: 'success' }); fetchProfile(); fetchBalance(); setShowShop(false); }
      else setStatus({ text: d.detail, type: 'error' });
    } catch (e: any) { setStatus({ text: e.message, type: 'error' }); }
  };

  return {
    profile, virtualBalance, faucetReserve, cooldown, loading, status, leaderboard, stats,
    minigameActive, minigameTimeLeft, minigameScore, minigameNodes, minigameResult, clickNode,
    boosterCatalog, showShop, showProfile, handleClaim, handleWithdraw, buyBooster,
    setShowShop, setShowProfile, setStatus, fetchStats
  };
}
