import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../apiConfig';
import { useAuth, sessionHeaders } from './AuthContext';
import { signAction } from '../utils/actionSignature';import { withdrawMessage, depositMessage, apiKeyRotateMessage, reserveDeclareMessage } from '../utils/actionMessage';
import { dataHoraLocal, dataLocal, numeroLocal, useLanguage } from './LanguageContext';
import {
    ArrowPathIcon, BoltIcon, ChartBarIcon, CheckCircleIcon, CodeBracketIcon, FaucetChainLogoIcon,
    GlobeAltIcon, LockClosedIcon, MagnifyingGlassPlusIcon, ShieldCheckIcon, SignalIcon,
} from './IconComponents';


interface FaucetHubProps {
    onBack: () => void;
}

interface FaucetData {
    name: string;
    wallet_address: string;
    liquidity: number;
    // A reserva que o proprietario declarou, assinada, e quanto do saldo real
    // a cobre. `coverage` e null quando nada foi declarado: nao declarada nao e
    // a mesma coisa que descoberta, e mostrar 0% acusaria a torneira de algo
    // que ela nunca disse.
    reserve: number;               // caucionado na tesouraria
    reserve_declared_at: number | null;
    owed: number;                  // o que a torneira deve aos usuarios, medido
    coverage: number | null;       // caucao / divida; null quando nao se deve nada
    status: string;
    site_url: string | null;       // null quando a torneira nao cadastrou site
    recent_txs: number;
    settlements: number;
    volume_settled: number;
    registered_at: number;
}

// Sem `api_key`: o my-key devolvia a chave a quem soubesse o endereco da
// torneira, e o endereco esta no diretorio publico. Desde 8/10/2026 o servidor
// guarda so o hash, entao nenhuma rota devolve a chave -- ela aparece uma vez
// no registro e uma vez na rotacao.
interface ApiKeyInfo {
    created_at: number;
    is_active: boolean;
    last_used: number | null;
    total_requests: number;
    total_settled: number;
}

interface L2Stats {
    total_users: number;
    total_virtual_balance: number;
    total_claimed_all_time: number;
    total_withdrawn_all_time: number;
    total_claims_count: number;
}

interface L2UserBalance {
    faucet_wallet: string;
    faucet_name: string;
    virtual_balance: number;
    total_claimed: number;
    total_withdrawn: number;
    claim_count: number;
    can_withdraw: boolean;
    min_withdraw: number;
    site_url: string | null;
    missing_to_withdraw: number;
    next_claim_at: number | null;
}

interface L2BalanceResponse {
    user: string;
    total_pending: number;
    faucets: L2UserBalance[];
}

export const FaucetHub: React.FC<FaucetHubProps> = ({ onBack }) => {
    const { tri } = useLanguage();
    const { authMethod, isConnected, userAddress } = useAuth();
    const [faucets, setFaucets] = useState<FaucetData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRegister, setShowRegister] = useState(false);
    const [newName, setNewName] = useState("");
    const [newWallet, setNewWallet] = useState("");
    const [registerError, setRegisterError] = useState("");
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [selectedFaucet, setSelectedFaucet] = useState<string | null>(null);
    // A reserva vem do servidor. Este painel mostrava "100%" escrito no
    // codigo, sob a frase "Todas as reservas verificadas on-chain" -- numa tela
    // chamada Proof of Reserve. Nada era lido, e o numero nao podia estar
    // errado porque nao era medido.
    const [por, setPor] = useState<any | null>(null);
    const [keyInfo, setKeyInfo] = useState<ApiKeyInfo | null>(null);
    // Fica so nesta tela, ate trocar de torneira. Nao vai para o estado global
    // nem para o storage: uma chave na aba aberta ja e exposicao suficiente.
    // Guarda a chave que a rotacao acabou de devolver, para mostra-la uma vez.
    const [revealedKey, setRevealedKey] = useState<string | null>(null);
    const [keyError, setKeyError] = useState<string>("");
    const [keyLoading, setKeyLoading] = useState(false);
    const [keyCopied, setKeyCopied] = useState(false);
    const [reserveInput, setReserveInput] = useState("");
    const [reserveError, setReserveError] = useState("");
    const [reserveSaving, setReserveSaving] = useState(false);
    
    // L2 Ledger state
    const [l2Stats, setL2Stats] = useState<L2Stats | null>(null);
    const [l2LookupWallet, setL2LookupWallet] = useState("");
    const [l2Balances, setL2Balances] = useState<L2BalanceResponse | null>(null);
    const [l2Loading, setL2Loading] = useState(false);
    const [l2WithdrawStatus, setL2WithdrawStatus] = useState<string | null>(null);

    // "Tem alguém mexendo agora?" — lido pela enquete de 10 segundos antes de
    // substituir o estado da lista. É uma ref e não um estado de propósito: o
    // intervalo é criado uma vez, no mount, e uma closure sobre um useState
    // enxergaria para sempre o valor do primeiro render.
    const ocupadoRef = React.useRef(false);
    ocupadoRef.current =
        showRegister ||          // formulário de registro aberto
        reserveSaving ||         // assinando uma trava de caução
        keyLoading ||            // revelando ou rotacionando chave
        l2Loading ||             // consultando saldo
        revealedKey !== null ||  // chave na tela: recarregar a faria sumir
        selectedFaucet !== null; // cartão aberto, com formulário dentro

    // Leaderboard & Activity Links state
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [activityLinks, setActivityLinks] = useState<any[]>([]);

    const fetchFaucets = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/faucets`);
            if (res.ok) {
                const data = await res.json();
                setFaucets(data);
            }
        } catch (e) {
            console.error("Failed to fetch faucets", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchL2Stats = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/stats`);
            if (res.ok) setL2Stats(await res.json());
        } catch (e) { console.error("Failed to fetch L2 stats", e); }
    };

    const fetchLeaderboard = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/leaderboard`);
            if (res.ok) {
                const data = await res.json();
                setLeaderboard(data || []);
            }
        } catch (e) { console.error("Failed to fetch leaderboard", e); }
    };

    const fetchActivityLinks = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/activity-links`);
            if (res.ok) {
                const data = await res.json();
                setActivityLinks(data || []);
            }
        } catch (e) { console.error("Failed to fetch activity links", e); }
    };

    useEffect(() => {
        fetchFaucets();
        fetchProofOfReserve();
        fetchL2Stats();
        fetchLeaderboard();
        fetchActivityLinks();
        // A cada 10 segundos este painel refazia quatro chamadas e substituía o
        // estado inteiro da lista. O efeito do lado de quem clica é um botão que
        // "demora" ou "não funciona": o re-render chega no meio da interação e
        // leva junto o foco, o que estava digitado e o cartão aberto.
        //
        // Duas pausas, e as duas são sobre não atropelar quem está ali:
        //
        //   Enquanto houver algo em curso -- uma assinatura, um formulário
        //   aberto, uma chave sendo revelada -- a enquete espera. O painel só
        //   se atualiza sozinho quando ninguém está mexendo nele.
        //
        //   Com a aba escondida não há ninguém para ver a atualização, e
        //   continuar pedindo é gastar o teto de leitura por nada.
        const interval = setInterval(() => {
            if (document.hidden) return;
            if (ocupadoRef.current) return;
            fetchFaucets();
            fetchL2Stats();
            fetchLeaderboard();
            fetchActivityLinks();
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    const lookupL2Balance = async () => {
        if (!l2LookupWallet.trim()) return;
        setL2Loading(true);
        setL2Balances(null);
        setL2WithdrawStatus(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/balance/${l2LookupWallet.trim()}`);
            if (res.ok) setL2Balances(await res.json());
            else { const err = await res.json(); setL2WithdrawStatus(err.detail || "Error"); }
        } catch (e) { console.error(e); }
        finally { setL2Loading(false); }
    };

    const handleL2Withdraw = async (faucetWallet: string) => {
        setL2WithdrawStatus(null);
        try {
            // O saque exige a assinatura do dono da carteira consultada.
            const user = l2LookupWallet.trim().toLowerCase();
            const faucet = faucetWallet.trim().toLowerCase();
            const sig = await signAction(authMethod, (ts) =>
                withdrawMessage(user, faucet, ts));
            const res = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/withdraw`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...sessionHeaders() },
                body: JSON.stringify({ user_wallet: user, faucet_wallet: faucet, ...sig })
            });
            const data = await res.json();
            if (res.ok) {
                setL2WithdrawStatus(`✅ Withdrawn to L1. Tx: ${data.tx_hash.slice(0, 18)}...`);
                lookupL2Balance(); // Refresh
                fetchFaucets();
                fetchL2Stats();
                fetchLeaderboard();
                fetchActivityLinks();
            } else {
                setL2WithdrawStatus(`❌ ${data.detail}`);
            }
        } catch (e: any) { setL2WithdrawStatus(`❌ ${e.message}`); }
    };

    // O saque ao contrario: $CLAIM da conta para o saldo nesta torneira, para gastar la.
    const handleL2Deposit = async (faucetWallet: string) => {
        setL2WithdrawStatus(null);
        const raw = window.prompt(tri('How much $CLAIM to deposit into this faucet?',
            'Quanto $CLAIM depositar nesta torneira?', '¿Cuánto $CLAIM depositar en este faucet?'));
        const amount = Number((raw || '').replace(',', '.'));
        if (!raw || !Number.isFinite(amount) || amount <= 0) return;
        try {
            const user = l2LookupWallet.trim().toLowerCase();
            const faucet = faucetWallet.trim().toLowerCase();
            const sig = await signAction(authMethod, (ts) => depositMessage(user, faucet, amount, ts));
            const res = await fetch(`${API_BASE_URL}/api/faucethub/microclaim/deposit`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...sessionHeaders() },
                body: JSON.stringify({ user_wallet: user, faucet_wallet: faucet, amount, ...sig })
            });
            const data = await res.json();
            if (res.ok) {
                setL2WithdrawStatus(`✅ ${tri('Deposited', 'Depositado', 'Depositado')} ${data.amount} CLAIM`);
                lookupL2Balance();
            } else {
                setL2WithdrawStatus(`❌ ${data.detail}`);
            }
        } catch (e: any) { setL2WithdrawStatus(`❌ ${e.message}`); }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegisterError("");
        setGeneratedKey(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName, wallet_address: newWallet })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Registration failed");
            
            setGeneratedKey(data.api_key);
            fetchFaucets();
        } catch (e: any) {
            setRegisterError(e.message);
        }
    };

    const fetchProofOfReserve = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/proof-of-reserve`);
            setPor(res.ok ? await res.json() : null);
        } catch (e) {
            setPor(null);
        }
    };

    const fetchKeyInfo = async (wallet: string) => {
        setKeyLoading(true);
        setKeyInfo(null);
        setRevealedKey(null);
        setKeyError("");
        try {
            const res = await fetch(`${API_BASE_URL}/api/faucethub/my-key/${wallet}`);
            if (res.ok) {
                const data = await res.json();
                setKeyInfo(data);
            }
        } catch (e) {
            console.error("Failed to fetch key info", e);
        } finally {
            setKeyLoading(false);
        }
    };

    // handleRevealKey saiu em 8/10/2026 junto com o endpoint. O servidor guarda
    // so o sha256 da chave, entao nao existe mais o que revelar -- quem perdeu
    // a dela rotaciona, logo abaixo.

    const handleRegenerateKey = async (wallet: string) => {
        setKeyError("");
        try {
            const faucet = wallet.trim().toLowerCase();
            const sig = await signAction(authMethod, (ts) => apiKeyRotateMessage(faucet, ts));
            const res = await fetch(`${API_BASE_URL}/api/faucethub/regenerate-key`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...sessionHeaders() },
                body: JSON.stringify({ wallet_address: faucet, ...sig })
            });
            const data = await res.json();
            // A chave nova aparece uma vez, aqui. A anterior morreu nesta chamada,
            // entao a torneira falha a proxima chamada ate ser atualizada.
            if (res.ok) setRevealedKey(data.api_key);
            else setKeyError(data.detail || "Could not rotate the key.");
        } catch (e: any) {
            setKeyError(e.message);
        }
    };

    // A reserva que a torneira diz estar guardando. O painel mostrava um saldo
    // sem escala: 500 $CLAIM parecia igual tendo prometido 100 ou 50.000. So o
    // proprietario sabe o numero, entao ele assina -- e a assinatura nao tranca
    // nada, o que a propria sentenca diz a quem assina.
    // `valor` existe para os atalhos de soltar: eles chamavam setReserveInput e
    // esta funcao na mesma linha, e ela lia o campo ainda com o valor velho.
    const handleDeclareReserve = async (wallet: string, valor?: string) => {
        setReserveError("");
        const amount = parseFloat((valor ?? reserveInput).replace(",", "."));
        if (!isFinite(amount) || amount < 0) {
            setReserveError("Enter a value of 0 or more.");
            return;
        }
        setReserveSaving(true);
        try {
            const faucet = wallet.trim().toLowerCase();
            const sig = await signAction(authMethod, (ts) => reserveDeclareMessage(faucet, amount, ts));
            const res = await fetch(`${API_BASE_URL}/api/faucethub/reserve`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...sessionHeaders() },
                body: JSON.stringify({ wallet_address: faucet, amount, ...sig })
            });
            const data = await res.json();
            if (res.ok) {
                setReserveInput("");
                await fetchFaucets();
            } else {
                setReserveError(data.detail || "Nao foi possivel declarar a reserva.");
            }
        } catch (e: any) {
            setReserveError(e.message);
        } finally {
            setReserveSaving(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setKeyCopied(true);
        setTimeout(() => setKeyCopied(false), 2000);
    };

// Cobertura é razão, não porcentagem, e tratá-la como porcentagem produziu
// "105399% caucionado" numa tela que um parceiro lê. Acima de dez vezes a
// dívida a porcentagem deixa de informar: o que importa é a ordem de grandeza,
// e "1.053×" diz isso numa olhada. Abaixo de dez, a porcentagem é a leitura
// natural -- 80% coberto é uma frase que se entende.
// Quanto falta do cooldown de 300s, ou vazio se ja liberou. Devolve texto
// porque e so isso que o card precisa -- numero cru aqui viraria formatacao
// repetida em tres lugares.
const cooldownRestante = (next: number | null): string => {
    if (!next) return '';
    const s = next - Math.floor(Date.now() / 1000);
    if (s <= 0) return '';
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};

const formataCobertura = (c: number): string =>
    c >= 10
        ? `${c.toLocaleString(undefined, { maximumFractionDigits: 0 })}×`
        : `${(c * 100).toFixed(0)}%`;

    const totalLiquidity = faucets.reduce((acc, f) => acc + f.liquidity, 0);
    // Somar saldos e chamar o total de "reservas" era a mesma confusao de
    // sempre. Reserva e o que a torneira declarou; saldo e o que ela tem. Os
    // dois juntos dizem algo; um sozinho, com o nome do outro, nao diz nada.
    const totalDeclared = faucets.reduce((acc, f) => acc + f.reserve, 0);
    const declaredCount = faucets.filter(f => f.reserve > 0).length;
    const shortCount = faucets.filter(f => f.coverage !== null && f.coverage < 1).length;
    const totalOwed = faucets.reduce((acc, f) => acc + f.owed, 0);
    const activeCount = faucets.filter(f => f.status === "Ativa").length;

    // "Ativa" e "Hiato" sao valores que a API devolve, e a API e publica: um
    // parceiro pode estar lendo exatamente essas palavras. Entao o valor nao
    // muda -- a tela e que traduz, e a comparacao acima continua contra o que
    // o servidor manda de verdade.
    const statusEmIngles = (valor: string) =>
        valor === 'Ativa' ? 'Active' : valor === 'Hiato' ? 'Idle' : valor;
    const totalSettlements = faucets.reduce((acc, f) => acc + f.settlements, 0);

    // Map layout: faucets on the left (L2), users on the right (L1 recipients).
    const MAP_FAUCET_X = 92;
    const MAP_USER_X = 408;
    const mapY = (idx: number, count: number) => (count <= 1 ? 150 : 50 + idx * (200 / (count - 1)));

    const renderFaucetNodes = () => {
        const uniqueFaucets = Array.from(new Set(activityLinks.map(l => l.faucet_wallet.toLowerCase())));
        if (uniqueFaucets.length === 0) {
            uniqueFaucets.push("0x84da71247cbfb0737a9112de1f10dae9823fc298");
        }

        return uniqueFaucets.slice(0, 4).map((wallet, idx, arr) => {
            const y = mapY(idx, arr.length);
            const x = MAP_FAUCET_X;
            const faucetInfo = faucets.find(f => f.wallet_address.toLowerCase() === wallet) || { name: "Faucet L2" };
            const isSelected = selectedFaucet?.toLowerCase() === wallet;
            const hue = walletHue(String(wallet));

            return (
                <g key={`faucet-${wallet}`} className="cursor-pointer" onClick={() => setSelectedFaucet(wallet)}>
                    <circle cx={x} cy={y} r="15" fill="#0C1620"
                        stroke={isSelected ? "#2B9FE8" : `hsl(${hue} 60% 55%)`} strokeWidth={isSelected ? 2.5 : 1.5} />
                    <circle cx={x} cy={y} r="5" fill={`hsl(${hue} 65% 58%)`} />
                    <text x={x} y={y - 22} fontSize="9" fontWeight="600" fill="#D6E0F6" textAnchor="middle">
                        {faucetInfo.name}
                    </text>
                </g>
            );
        });
    };

    const renderUserNodes = () => {
        const uniqueUsers: string[] = Array.from(new Set(activityLinks.map((l: any) => String(l?.user_wallet || "").toLowerCase())));
        if (uniqueUsers.length === 0) {
            return (
                <g key="no-user">
                    <circle cx={MAP_USER_X} cy="150" r="11" fill="#070F16" stroke="#1C2E3D" strokeWidth="1.5" strokeDasharray="3 3" />
                    <text x={MAP_USER_X - 18} y="154" fontSize="9" fill="#6B8299" textAnchor="end">
                        {tri('Waiting for claims...', 'Aguardando claims...', 'Esperando claims...')}
                    </text>
                </g>
            );
        }

        return uniqueUsers.slice(0, 4).map((wallet, idx, arr) => {
            const y = mapY(idx, arr.length);
            const x = MAP_USER_X;

            return (
                <g key={`user-${wallet}`}>
                    <circle cx={x} cy={y} r="11" fill="#070F16" stroke="#9945FF" strokeWidth="1.5" />
                    <circle cx={x} cy={y} r="3.5" fill="#14F195" />
                    <text x={x + 18} y={y + 3} fontSize="9" fontFamily="'JetBrains Mono', monospace" fill="#D6E0F6" textAnchor="start">
                        {String(wallet).slice(0, 6)}…{String(wallet).slice(-4)}
                    </text>
                </g>
            );
        });
    };

    const renderActivityPaths = () => {
        const uniqueFaucets = Array.from(new Set(activityLinks.map(l => l.faucet_wallet.toLowerCase())));
        if (uniqueFaucets.length === 0) uniqueFaucets.push("0x84da71247cbfb0737a9112de1f10dae9823fc298");
        const uniqueUsers = Array.from(new Set(activityLinks.map(l => l.user_wallet.toLowerCase())));
        const shownFaucets = uniqueFaucets.slice(0, 4);
        const shownUsers = uniqueUsers.slice(0, 4);

        return activityLinks.slice(0, 6).map((link, idx) => {
            const fIdx = shownFaucets.indexOf(link.faucet_wallet.toLowerCase());
            const uIdx = shownUsers.indexOf(link.user_wallet.toLowerCase());
            if (fIdx === -1 || uIdx === -1) return null;

            const fx = MAP_FAUCET_X + 15, fy = mapY(fIdx, shownFaucets.length);
            const ux = MAP_USER_X - 11, uy = mapY(uIdx, shownUsers.length);
            const d = `M ${fx} ${fy} C ${(fx + ux) / 2} ${fy}, ${(fx + ux) / 2} ${uy}, ${ux} ${uy}`;

            // The pulse travels only because a real claim connects these two.
            return (
                <g key={`path-${idx}`}>
                    <path d={d} fill="none" stroke="url(#settleGrad)" strokeWidth="1.5" strokeOpacity="0.55" />
                    <circle r="2.5" fill="#14F195" className="motion-reduce:hidden">
                        <animateMotion dur={`${2.4 + idx * 0.45}s`} repeatCount="indefinite" path={d} />
                    </circle>
                </g>
            );
        });
    };

    // ---- shared look -------------------------------------------------------
    // One surface, one border, one radius. Elevation comes from the panel
    // sitting on the page ground, not from glow.
    const panel = "rounded-2xl border border-brand-border bg-brand-surface";
    const panelHead = "flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-brand-border";
    const h2 = "flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em] text-brand-secondary";
    const label = "text-[11px] font-medium uppercase tracking-[0.12em] text-brand-muted";
    const well = "rounded-xl border border-brand-border bg-brand-bg p-3";
    const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";
    const btn = `inline-flex items-center justify-center gap-2 min-h-[36px] px-3.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${focusRing}`;
    const btnGhost = `${btn} border-brand-border bg-brand-card text-brand-secondary hover:border-brand-primary/60 hover:text-white`;
    const btnPrimary = `${btn} border-brand-primary bg-brand-deep text-white hover:bg-brand-primary`;
    const btnDanger = `${btn} border-brand-error/40 bg-brand-error/10 text-red-300 hover:bg-brand-error/20`;
    const field = "w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2.5 text-sm text-brand-secondary placeholder:text-brand-muted/80 focus:outline-none focus:border-brand-primary";
    const claimLink = `inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-brand-primary/40 text-brand-primary hover:bg-brand-primary/10 whitespace-nowrap ${focusRing}`;
    const fmt2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const networkCoverage = totalOwed > 0 ? totalDeclared / totalOwed : null;

    // Sem conta conectada o painel não abre.
    //
    // Nada aqui é segredo — a lista de torneiras é um quadro de transparência,
    // e as ações que movem dinheiro já exigem assinatura, uma por uma. O que o
    // portão resolve é outra coisa: este é o console de quem opera uma
    // torneira, com chave de API, caução e saque, e abri-lo para um visitante
    // anônimo convida a mexer onde não se tem o que mexer. Um botão que só
    // pode falhar é pior que um botão ausente.
    //
    // O portão é da tela, não dos dados, e vale dizer qual é qual: as rotas de
    // leitura seguem públicas de propósito. `/api/faucethub/faucets` é o quadro
    // que qualquer um deve poder auditar, e o start-local.ps1 a usa para saber
    // se o servidor subiu. Fechá-las esconderia o que o produto existe para
    // mostrar, sem proteger nada que já não esteja protegido por assinatura.
    if (!isConnected || !userAddress) {
        return (
            <div className="fixed inset-0 z-50 bg-brand-bg text-brand-secondary flex items-center justify-center font-sans p-4 sm:p-6 selection:bg-brand-primary/30">
                <div className={`max-w-2xl w-full ${panel} p-6 sm:p-10 max-h-[92vh] overflow-y-auto custom-scrollbar shadow-lift-lg`}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl border border-brand-border bg-brand-bg flex items-center justify-center">
                            <LockClosedIcon className="w-6 h-6 text-brand-primary" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-[-0.02em] text-brand-secondary">
                            FaucetHub Core
                        </h2>
                    </div>
                    <p className="text-brand-secondary/85 mt-5 leading-relaxed max-w-[60ch]">
                        {tri(
                            'This is the console for whoever runs a faucet: API key, reserve and payout. Sign in to open it. Every action here is signed by the wallet that owns the faucet, and without an account there is nothing to sign.',
                            'Este é o console de quem opera uma torneira: chave de API, reserva e pagamento. Entre para abrir. Toda ação aqui é assinada pela carteira dona da torneira, e sem conta não há o que assinar.',
                            'Esta es la consola de quien opera un grifo: clave de API, reserva y pago. Inicie sesión para abrirla. Toda acción aquí la firma la billetera dueña del grifo, y sin cuenta no hay qué firmar.')}
                    </p>
                    <p className="text-brand-muted text-sm mt-3 leading-relaxed max-w-[60ch]">
                        {tri(
                            "The faucet board below stays public, with each one's balance, debt and coverage. It is there to be audited, and auditing asks for no login.",
                            'O quadro de torneiras abaixo continua público, com saldo, dívida e cobertura de cada uma. Ele existe para ser auditado, e auditar não pede login.',
                            'El tablero de grifos de abajo sigue público, con saldo, deuda y cobertura de cada uno. Existe para ser auditado, y auditar no pide inicio de sesión.')}
                    </p>
                    <button onClick={onBack} className={`mt-6 ${btnGhost}`}>
                        ← Back
                    </button>

                    {/* O paragrafo acima promete que o quadro continua publico. Ele ja
                        estava carregado em memoria -- as cinco chamadas de leitura
                        rodam no mount, antes deste portao -- e mesmo assim a tela so
                        mostrava a parede. Prometer uma coisa e entregar outra e pior
                        que nao prometer. */}
                    {faucets.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-brand-border">
                            <p className={`${label} mb-3`}>
                                Public board · {faucets.length} faucets
                            </p>
                            <div className="divide-y divide-brand-border border border-brand-border rounded-xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
                                {faucets.map((f, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-brand-bg">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <WalletIdenticon address={f.wallet_address} size={28} />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-brand-secondary text-sm truncate">{f.name}</h4>
                                                    {f.site_url && (
                                                        <a href={f.site_url} target="_blank" rel="noopener noreferrer" className={claimLink}>
                                                            claim →
                                                        </a>
                                                    )}
                                                </div>
                                                <p className="text-brand-muted text-[11px] mt-0.5">
                                                    {f.coverage === null
                                                        ? 'nothing owed yet'
                                                        : `owes ${f.owed.toLocaleString(undefined, {maximumFractionDigits: 2})} · ${formataCobertura(f.coverage)} covered`}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="font-mono tabular-nums text-brand-secondary text-xs whitespace-nowrap">
                                            {f.liquidity.toLocaleString(undefined, {maximumFractionDigits: 2})} <span className="text-brand-muted">CLAIM</span>
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const selected = selectedFaucet
        ? faucets.find(x => x.wallet_address.toLowerCase() === selectedFaucet.toLowerCase())
        : undefined;
    const porAssets: any[] = (por && por.assets) || [];

    return (
        <div className="fixed inset-0 z-50 bg-brand-bg text-brand-secondary flex flex-col font-sans overflow-hidden animate-slideUpFadeIn selection:bg-brand-primary/30">
            {/* --- Header: who you are on-chain, and the way out --- */}
            <header className="relative z-30 bg-brand-bg/90 backdrop-blur-md border-b border-brand-border">
                <div className="max-w-7xl mx-auto h-16 px-4 sm:px-8 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <FaucetChainLogoIcon className="w-9 h-9 flex-none" />
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-lg font-bold tracking-[-0.02em] text-brand-secondary leading-tight">FaucetHub Core</h1>
                            <p className="text-[11px] text-brand-muted tracking-wide truncate">L1 Infrastructure • Proof of Reserve</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="hidden sm:flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-full border border-brand-border bg-brand-surface" title={userAddress}>
                            <WalletIdenticon address={userAddress} size={24} round />
                            <span className="font-mono text-xs text-brand-secondary">{shortAddr(userAddress)}</span>
                        </div>
                        <button onClick={onBack} className={btnGhost}>
                            &larr; Exit
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">

                    {/* Ledger band: four readings of the same book, side by side. */}
                    <section className={`${panel} grid grid-cols-2 lg:grid-cols-4 [&>*]:border-brand-border`}>
                        <div className="p-5 border-b lg:border-b-0 border-r">
                            <p className={label}>Faucets connected</p>
                            <p className="mt-2 font-mono tabular-nums text-3xl font-semibold text-brand-secondary tracking-[-0.03em]">
                                {loading ? "…" : faucets.length}
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-brand-muted">
                                <LiveDot on={activeCount > 0} /> {activeCount} active
                            </p>
                        </div>
                        <div className="p-5 border-b lg:border-b-0 lg:border-r">
                            {/* Dizia "Proof of Reserve (PoR)" sobre a soma dos saldos, com o
                                rotulo "$CLAIM em reservas". Nada era provado e nada era uma
                                reserva: era o saldo das torneiras somado. Agora o cartao mostra
                                o saldo, e a reserva declarada aparece ao lado como o que e. */}
                            <p className={label}>Faucet balances</p>
                            <p className="mt-2 font-mono tabular-nums text-3xl font-semibold text-brand-secondary tracking-[-0.03em]">
                                {loading ? "…" : fmt2(totalLiquidity)}
                            </p>
                            <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                                $CLAIM free · {totalDeclared.toLocaleString(undefined, {maximumFractionDigits: 0})} escrowed by {declaredCount} · {totalOwed.toLocaleString(undefined, {maximumFractionDigits: 2})} owed
                            </p>
                            <CoverageBar coverage={networkCoverage} className="mt-3" />
                            {shortCount > 0 && (
                                <p className="text-brand-warn text-xs mt-2">
                                    {shortCount} {shortCount === 1 ? "faucet owes" : "faucets owe"} more than {shortCount === 1 ? "it escrowed" : "they escrowed"}
                                </p>
                            )}
                        </div>
                        <div className="p-5 border-r">
                            <p className={label}>Settlements (L1)</p>
                            <p className="mt-2 font-mono tabular-nums text-3xl font-semibold text-brand-secondary tracking-[-0.03em]">
                                {loading ? "…" : totalSettlements}
                            </p>
                            <p className="mt-1 text-xs text-brand-muted">On-chain settlements</p>
                        </div>
                        <div className="p-5">
                            <p className={label}>Active API keys</p>
                            <p className="mt-2 font-mono tabular-nums text-3xl font-semibold text-brand-secondary tracking-[-0.03em]">
                                {loading ? "…" : faucets.length}
                            </p>
                            <p className="mt-1 text-xs text-brand-muted">Connected integrations</p>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Monitoramento de Torneiras */}
                        <section className={`${panel} flex flex-col min-h-[480px] min-w-0`}>
                            <div className={panelHead}>
                                <h2 className={h2}>
                                    <SignalIcon className="w-[18px] h-[18px] text-brand-primary" /> Web3 monitoring
                                </h2>
                                <button
                                    onClick={() => { setShowRegister(!showRegister); setGeneratedKey(null); }}
                                    className={showRegister ? btnGhost : btnPrimary}
                                >
                                    {showRegister ? "Hide" : "+ Register new"}
                                </button>
                            </div>

                            {showRegister && (
                                <div className="mx-5 sm:mx-6 mt-5 rounded-xl border border-brand-primary/40 bg-brand-bg p-5">
                                    {!generatedKey ? (
                                        <form onSubmit={handleRegister}>
                                            <h3 className="font-semibold text-brand-secondary mb-3 text-sm">Register a faucet (DApp)</h3>
                                            <div className="space-y-3">
                                                <input
                                                    id="faucethub-register-name"
                                                    type="text" placeholder={tri('Faucet name', 'Nome da torneira', 'Nombre del grifo')} value={newName}
                                                    onChange={e => setNewName(e.target.value)}
                                                    className={field}
                                                    required
                                                />
                                                <input
                                                    id="faucethub-register-wallet"
                                                    type="text" placeholder={tri('Wallet address (0x...)', 'Endereço da carteira (0x...)',
                                                                                 'Dirección de la billetera (0x...)')} value={newWallet}
                                                    onChange={e => setNewWallet(e.target.value)}
                                                    className={`${field} font-mono`}
                                                    required
                                                />
                                                {registerError && <p className="text-red-300 text-xs">{registerError}</p>}
                                                <button type="submit" className={`${btnPrimary} w-full min-h-[40px] text-sm`}>
                                                    {tri('Link to FaucetHub', 'Vincular ao FaucetHub',
                                                         'Vincular a FaucetHub')}
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <CheckCircleIcon className="w-5 h-5 text-brand-success" />
                                                <h3 className="font-semibold text-brand-success text-sm">Faucet registered</h3>
                                            </div>
                                            <p className="text-brand-secondary/80 text-xs">Your API key is ready. Store it somewhere safe: it will not be shown again.</p>
                                            <div className={`${well} flex items-center justify-between gap-2`}>
                                                <code className="text-brand-success text-xs font-mono break-all flex-1">{generatedKey}</code>
                                                <button onClick={() => copyToClipboard(generatedKey)} className={`${btnGhost} flex-shrink-0`}>
                                                    {keyCopied ? "✓ Copied" : "Copy"}
                                                </button>
                                            </div>
                                            <div className={`${well} text-xs space-y-2`}>
                                                <p className="font-semibold text-brand-secondary">How to integrate:</p>
                                                <code className="block font-mono text-[11px] leading-relaxed text-brand-secondary/90">
                                                    <span className="text-brand-primary">POST</span> /api/faucethub/settle<br/>
                                                    <span className="text-brand-muted">Header:</span> X-Api-Key: {generatedKey.slice(0, 20)}...<br/>
                                                    <span className="text-brand-muted">Body:</span> {`{"user_wallet": "0x...", "amount": 10.0}`}
                                                </code>
                                            </div>
                                            <button
                                                onClick={() => { setShowRegister(false); setGeneratedKey(null); setNewName(""); setNewWallet(""); }}
                                                className={`${btnGhost} w-full min-h-[40px] text-sm`}
                                            >
                                                Close
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-2">
                                {loading && !faucets.length && <p className="text-brand-muted text-sm text-center py-8">Reading network activity...</p>}
                                {!loading && faucets.length === 0 && (
                                    <p className="text-brand-muted text-sm text-center py-8">No faucet registered yet.</p>
                                )}
                                {faucets.map((faucet, idx) => {
                                    const isSel = selectedFaucet === faucet.wallet_address;
                                    const pick = () => { setSelectedFaucet(faucet.wallet_address); fetchKeyInfo(faucet.wallet_address); };
                                    return (
                                        <div
                                            key={idx}
                                            role="button"
                                            tabIndex={0}
                                            aria-pressed={isSel}
                                            onClick={pick}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
                                            className={`group flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer ${focusRing} ${
                                                isSel
                                                    ? 'bg-brand-primary/[0.07] border-brand-primary/70'
                                                    : 'bg-brand-bg border-brand-border hover:border-brand-primary/40'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <WalletIdenticon address={faucet.wallet_address} size={40} />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <h4 className="font-semibold text-brand-secondary text-sm truncate">{faucet.name}</h4>
                                                        {/* stopPropagation porque o card inteiro seleciona a torneira:
                                                            sem isto, abrir o site tambem trocaria a selecao por baixo. */}
                                                        {faucet.site_url && (
                                                            <a
                                                                href={faucet.site_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                onKeyDown={(e) => e.stopPropagation()}
                                                                className={claimLink}
                                                            >
                                                                claim →
                                                            </a>
                                                        )}
                                                    </div>
                                                    <p className="font-mono text-[11px] text-brand-muted mt-0.5">{shortAddr(faucet.wallet_address)}</p>
                                                    <p className="flex items-center gap-1.5 text-[11px] mt-0.5">
                                                        <LiveDot on={faucet.status === 'Ativa'} />
                                                        <span className={faucet.status === 'Ativa' ? 'text-brand-success font-medium' : 'text-brand-warn font-medium'}>
                                                            {statusEmIngles(faucet.status)}
                                                        </span>
                                                        <span className="text-brand-muted">· {faucet.settlements} settlements</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right flex-none w-[42%] max-w-[190px]">
                                                <p className="font-mono tabular-nums text-brand-secondary font-semibold text-sm">
                                                    {fmt2(faucet.liquidity)} <span className="text-brand-muted font-normal text-xs">CLAIM</span>
                                                </p>
                                                {/* Sem declaracao nao ha cobertura a mostrar, e inventar 0%
                                                    acusaria a torneira de nao honrar algo que nunca prometeu. */}
                                                {faucet.coverage === null ? (
                                                    <p className="text-brand-muted text-[11px] mt-0.5">nothing owed yet</p>
                                                ) : (
                                                    <p className={`text-[11px] font-medium mt-0.5 ${faucet.coverage >= 1 ? 'text-brand-success' : 'text-brand-warn'}`}>
                                                        owes {faucet.owed.toLocaleString(undefined, {maximumFractionDigits: 2})} · {formataCobertura(faucet.coverage)} escrowed
                                                    </p>
                                                )}
                                                <CoverageBar coverage={faucet.coverage} className="mt-1.5 ml-auto" />
                                                <p className="text-brand-muted text-[11px] mt-1 font-mono tabular-nums">{faucet.recent_txs} Txs/hr</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Right Panel: API Key Management + PoR */}
                        <div className="space-y-6 min-w-0">
                            {/* API Key Management Panel */}
                            <section className={panel}>
                                <div className={panelHead}>
                                    <h2 className={h2}>
                                        <CodeBracketIcon className="w-[18px] h-[18px] text-brand-primary" /> API Key Management
                                    </h2>
                                    {selected && (
                                        <span className="flex items-center gap-2 text-xs text-brand-muted min-w-0">
                                            <WalletIdenticon address={selected.wallet_address} size={20} round />
                                            <span className="truncate">{selected.name}</span>
                                        </span>
                                    )}
                                </div>
                                <div className="p-5 sm:p-6">
                                    {!selectedFaucet && (
                                        <div className="text-center py-6">
                                            <p className="text-brand-muted text-sm">Pick a faucet on the left to manage its API key</p>
                                        </div>
                                    )}

                                    {selectedFaucet && keyLoading && (
                                        <div className="text-center py-6">
                                            <p className="text-brand-muted text-sm animate-pulse">Loading…</p>
                                        </div>
                                    )}

                                    {selectedFaucet && !keyLoading && keyInfo && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className={label}>API key</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider border ${keyInfo.is_active ? 'text-brand-success border-brand-success/40 bg-brand-success/10' : 'text-red-300 border-brand-error/40 bg-brand-error/10'}`}>
                                                    {keyInfo.is_active ? "ACTIVE" : "INACTIVE"}
                                                </span>
                                            </div>

                                            {revealedKey ? (
                                                <div className={`${well} flex items-center justify-between gap-2`}>
                                                    <code className="text-brand-success text-[11px] font-mono break-all flex-1">
                                                        {revealedKey.slice(0, 12)}{"•".repeat(20)}{revealedKey.slice(-8)}
                                                    </code>
                                                    <button onClick={() => copyToClipboard(revealedKey)} className={`${btnGhost} flex-shrink-0`}>
                                                        {keyCopied ? "✓" : "Copy"}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className={well}>
                                                    <p className="text-brand-secondary/85 text-xs leading-relaxed">
                                                        {tri(
                                                            "The key cannot be shown again. Only its hash is kept here, so that reading the database does not hand anyone the right to distribute on this faucet's behalf.",
                                                            'A chave não pode ser mostrada de novo. Só o hash dela fica guardado aqui, para que ler o banco não entregue a ninguém o direito de distribuir no lugar desta torneira.',
                                                            'La clave no puede mostrarse de nuevo. Solo su hash queda guardado aquí, para que leer la base no entregue a nadie el derecho de distribuir en nombre de este grifo.')}
                                                    </p>
                                                    <p className="text-brand-muted text-[11px] mt-2 leading-relaxed">
                                                        {tri(
                                                            'Lost yours? Rotate below: the new one is shown once, and the previous one dies in the same call.',
                                                            'Perdeu a sua? Gire abaixo: a nova aparece uma vez, e a anterior morre na mesma chamada.',
                                                            '¿Perdió la suya? Rótela abajo: la nueva aparece una vez, y la anterior muere en la misma llamada.')}
                                                    </p>
                                                </div>
                                            )}

                                            {keyError && (
                                                <p className="text-red-300 text-xs">{keyError}</p>
                                            )}

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className={well}>
                                                    <p className={label}>Requests</p>
                                                    <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-brand-secondary">{keyInfo.total_requests}</p>
                                                </div>
                                                <div className={well}>
                                                    <p className={label}>Volume settled</p>
                                                    <p className="mt-1 font-mono tabular-nums text-xl font-semibold text-brand-secondary">{numeroLocal(keyInfo.total_settled)} <span className="text-xs font-normal text-brand-muted">CLAIM</span></p>
                                                </div>
                                            </div>

                                            {keyInfo.last_used && (
                                                <p className="text-brand-muted text-[11px]">
                                                    Last used: <span className="font-mono">{dataHoraLocal(keyInfo.last_used * 1000)}</span>
                                                </p>
                                            )}

                                            <button onClick={() => handleRegenerateKey(selectedFaucet)} className={`${btnDanger} w-full`}>
                                                <ArrowPathIcon className="w-4 h-4" /> Rotate key (kills the current one)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Declaracao de reserva: a outra metade do numero do painel */}
                            {selected && (() => {
                                const f = selected;
                                return (
                                    <section className={panel}>
                                        <div className={panelHead}>
                                            <h2 className={h2}>
                                                <LockClosedIcon className="w-[18px] h-[18px] text-brand-primary" />
                                                {tri('Escrowed reserve', 'Reserva em caução', 'Reserva en garantía')}
                                            </h2>
                                        </div>
                                        <div className="p-5 sm:p-6">
                                            <p className="text-brand-secondary/80 text-xs mb-4 leading-relaxed">
                                                {tri(
                                                    "Signing moves this amount from the faucet's balance into the FaucetChain treasury, and that is where your users are paid from when they withdraw. You stop being able to spend it. You can lower it later, never below what users already have coming.",
                                                    'Assinar move este valor do saldo da torneira para a tesouraria da FaucetChain, e é de lá que seus usuários são pagos quando sacam. Você deixa de poder gastá-lo. Dá para baixar depois, nunca abaixo do que os usuários já têm a receber.',
                                                    'Firmar mueve este monto del saldo del grifo a la tesorería de FaucetChain, y de allí se paga a sus usuarios cuando retiran. Usted deja de poder gastarlo. Se puede bajar después, nunca por debajo de lo que los usuarios ya tienen por cobrar.')}
                                            </p>

                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div className={well}>
                                                    <p className={label}>Free</p>
                                                    <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-brand-secondary">
                                                        {f.liquidity.toLocaleString(undefined, {maximumFractionDigits: 2})}
                                                    </p>
                                                </div>
                                                <div className={well}>
                                                    <p className={label}>Escrowed</p>
                                                    <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-brand-secondary">
                                                        {f.reserve > 0 ? f.reserve.toLocaleString(undefined, {maximumFractionDigits: 2}) : "—"}
                                                    </p>
                                                </div>
                                                <div className={`${well} col-span-2`}>
                                                    <p className={label}>{tri('Owed to users', 'Devido aos usuários', 'Adeudado a los usuarios')}</p>
                                                    <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-brand-secondary">
                                                        {f.owed.toLocaleString(undefined, {maximumFractionDigits: 4})}
                                                        <span className="font-sans text-[11px] font-normal text-brand-muted ml-2">
                                                            measured in the ledger, not declared
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>

                                            {f.coverage !== null && (
                                                <div className="mb-4">
                                                    <CoverageBar coverage={f.coverage} wide />
                                                    <p className={`text-xs mt-2 leading-relaxed ${f.coverage >= 1 ? 'text-brand-success' : 'text-brand-warn'}`}>
                                                        {f.coverage >= 1
                                                            ? `Covered: the escrow covers ${formataCobertura(f.coverage)} of what you owe.`
                                                            : `Short: the escrow covers ${formataCobertura(f.coverage)} of what you owe; the rest comes out of the free balance at withdrawal, if there is any.`}
                                                        {f.reserve_declared_at && ` Escrowed on ${dataLocal(f.reserve_declared_at * 1000)}.`}
                                                    </p>
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                <input
                                                    id="faucethub-reserve"
                                                    type="number"
                                                    min="0"
                                                    step="0.0001"
                                                    value={reserveInput}
                                                    onChange={(e) => setReserveInput(e.target.value)}
                                                    placeholder={f.reserve > 0 ? String(f.reserve) : "0.0000"}
                                                    className={`${field} flex-1 font-mono tabular-nums`}
                                                />
                                                <button
                                                    onClick={() => handleDeclareReserve(f.wallet_address)}
                                                    disabled={reserveSaving || reserveInput.trim() === ""}
                                                    className={btnPrimary}
                                                >
                                                    {reserveSaving ? "Assinando..." : "Travar"}
                                                </button>
                                            </div>

                                            {/* Destravar sempre existiu no servidor: a rota recebe o valor TOTAL
                                                que fica travado, então mandar menos libera a diferença. O que não
                                                existia era o caminho na tela, e sem ele a caução parecia porta de
                                                mão única — que é o contrário do que ela é.

                                                Os dois atalhos cobrem o que se quer de verdade: soltar o que
                                                sobra acima da dívida, ou soltar tudo. Qualquer outro valor se
                                                digita no campo acima e se trava normalmente. Eles passam o valor
                                                direto: antes punham no campo e liam o campo na mesma chamada,
                                                que ainda tinha o valor velho, e o botão nunca soltava nada. */}
                                            {f.reserve > 0 && (
                                                <div className="mt-4">
                                                    <p className={`${label} mb-2`}>
                                                        {tri('RELEASE', 'DESTRAVAR', 'LIBERAR')}
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            onClick={() => handleDeclareReserve(f.wallet_address, String(Math.max(f.owed, 0)))}
                                                            disabled={reserveSaving || f.reserve <= f.owed}
                                                            title={f.reserve <= f.owed
                                                                ? "No surplus: the reserve already equals or sits below the debt."
                                                                : undefined}
                                                            className={`${btnGhost} flex-col items-start py-2`}
                                                        >
                                                            {tri('Release the surplus', 'Soltar o excedente',
                                                                 'Soltar el excedente')}
                                                            <span className="block text-[10px] font-normal text-brand-muted font-mono">
                                                                {Math.max(f.reserve - f.owed, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} livres
                                                            </span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeclareReserve(f.wallet_address, "0")}
                                                            disabled={reserveSaving || f.owed > 0}
                                                            title={f.owed > 0
                                                                ? `Not possible: this faucet owes ${f.owed} to its users, and the reserve does not go below the debt.`
                                                                : undefined}
                                                            className={`${btnGhost} flex-col items-start py-2`}
                                                        >
                                                            {tri('Release all', 'Soltar tudo', 'Soltar todo')}
                                                            <span className="block text-[10px] font-normal text-brand-muted">
                                                                {f.owed > 0 ? "blocked by debt" : "nothing owed"}
                                                            </span>
                                                        </button>
                                                    </div>
                                                    <p className="text-brand-muted text-[11px] mt-2 leading-relaxed">
                                                        Releasing returns the amount to the faucet's free balance. The
                                                        server refuses to go below what users already have coming — the
                                                        rule is its own, not this button's, and it holds even if this
                                                        screen is wrong.
                                                    </p>
                                                </div>
                                            )}
                                            {reserveError && <p className="text-red-300 text-xs mt-2">{reserveError}</p>}
                                            <p className="text-brand-muted text-[11px] mt-3 leading-relaxed">
                                                {tri(
                                                    'The escrowed amount leaves your balance and shows on your dashboard as unavailable. What does not exist yet: faucet reputation, and any warning to a user when the escrow does not cover what they are owed.',
                                                    'O valor em caução sai do seu saldo e aparece no seu painel como indisponível. O que ainda não existe: reputação de torneira, e qualquer aviso ao usuário quando a caução não cobre o que ele tem a receber.',
                                                    'El monto en garantía sale de su saldo y aparece en su panel como no disponible. Lo que todavía no existe: reputación de grifo, y cualquier aviso al usuario cuando la garantía no cubre lo que tiene por cobrar.')}
                                            </p>
                                        </div>
                                    </section>
                                );
                            })()}

                            {/* Proof of Reserve */}
                            <section className={panel}>
                                <div className={panelHead}>
                                    {/* Chamava-se "Proof of Reserve (PoR)". Continua honesto -- le
                                        /api/faucethub/proof-of-reserve, uma linha por ativo, com
                                        allSolvent nulo quando alguma nao pode ser lida -- mas ao lado do
                                        painel "Reserva declarada" os dois nomes se confundiam, e medem
                                        coisas diferentes: aqui e o que a rede deve, por ativo; la e o que
                                        uma torneira diz guardar. O rotulo agora diz qual dos dois e. */}
                                    <h2 className={h2}>
                                        <ShieldCheckIcon className="w-[18px] h-[18px] text-brand-primary" /> Network solvency, by asset
                                    </h2>
                                </div>
                                <div className="p-5 sm:p-6">
                                    {/* The verdict, then one block per asset: the strip is the
                                        proof read left to right, coloured by what each block said. */}
                                    <div className="flex items-end justify-between gap-4">
                                        <div>
                                            <p className={label}>Solvency by asset</p>
                                            <p className={`mt-1 text-3xl font-bold tracking-[-0.03em] ${
                                                !por ? 'text-brand-muted'
                                                : por.allSolvent === true ? 'text-brand-success'
                                                : por.allSolvent === false ? 'text-red-300'
                                                : 'text-brand-warn'}`}>
                                                {!por ? "—"
                                                    : por.allSolvent === true ? "OK"
                                                    : por.allSolvent === false ? "SHORT"
                                                    : "PARTIAL"}
                                            </p>
                                        </div>
                                        <p className="font-mono tabular-nums text-xs text-brand-muted">
                                            {porAssets.filter(a => a.solvent === true).length}/{porAssets.length} covered
                                        </p>
                                    </div>
                                    {porAssets.length > 0 && (
                                        <div className="mt-3 flex gap-1" aria-hidden="true">
                                            {porAssets.map((a: any, i: number) => (
                                                <span key={i}
                                                    className={`h-2 flex-1 rounded-sm origin-left motion-safe:animate-blockIn ${
                                                        a.solvent === true ? 'bg-brand-success'
                                                        : a.solvent === false ? 'bg-brand-error'
                                                        : 'bg-brand-warn/70'}`}
                                                    style={{ animationDelay: `${i * 70}ms` }} />
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-brand-muted text-xs mt-3 leading-relaxed">
                                        {!por ? 'No reading from the server.'
                                            : por.allSolvent === null
                                                ? 'One or more assets could not be read. Not knowing is not the same as being covered.'
                                                : `${porAssets.length} asset(s). Each reserve answers only for the debt in its own currency.`}
                                    </p>

                                    {porAssets.length > 0 && (
                                        <div className="mt-4 divide-y divide-brand-border border border-brand-border rounded-xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
                                            {porAssets.map((a: any) => (
                                                <div key={`${a.asset}-${a.campaignId ?? 'claim'}`}
                                                     className="flex items-center justify-between gap-3 px-3 py-2.5 bg-brand-bg">
                                                    <div className="min-w-0">
                                                        <p className="font-mono text-xs font-semibold text-brand-secondary truncate">
                                                            {a.asset === 'CLAIM' ? '$CLAIM' : `${a.asset.slice(0, 6)}…${a.asset.slice(-4)}`}
                                                        </p>
                                                        <p className="flex items-center gap-1.5 text-[11px] text-brand-muted mt-0.5">
                                                            {a.verifiedOnChain ? (
                                                                <>
                                                                    <span className="w-2 h-2 rounded-full bg-gradient-to-br from-sol-purple to-sol-green flex-none" />
                                                                    <span className="text-brand-secondary/90">read from Solana</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="w-2 h-2 rounded-full border border-brand-muted flex-none" />
                                                                    <span>sequencer's ledger</span>
                                                                </>
                                                            )}
                                                            {a.obligations != null && <span className="font-mono">· owes {numeroLocal(Number(a.obligations))}</span>}
                                                        </p>
                                                    </div>
                                                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${
                                                        a.solvent === true ? 'text-brand-success border-brand-success/40 bg-brand-success/10'
                                                        : a.solvent === false ? 'text-red-300 border-brand-error/40 bg-brand-error/10'
                                                        : 'text-brand-warn border-brand-warn/40 bg-brand-warn/10'
                                                    }`}>
                                                        {a.solvent === true ? 'covered' : a.solvent === false ? `short ${numeroLocal(Number(a.shortfall))}` : 'not read'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        onClick={() => { fetchFaucets(); fetchProofOfReserve(); }}
                                        className={`${btnGhost} w-full mt-4 min-h-[40px]`}
                                    >
                                        <ArrowPathIcon className="w-4 h-4" />
                                        {tri('Reload reserves', 'Reler reservas', 'Releer reservas')}
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* L2 Micro-Claims Ledger */}
                    <section className={panel}>
                        <div className={panelHead}>
                            <h2 className={h2}>
                                <BoltIcon className="w-[18px] h-[18px] text-brand-primary" /> Ledger L2 — Micro-Claims Off-Chain
                            </h2>
                            <span className="px-2.5 py-1 rounded-full border border-brand-border text-[10px] font-semibold tracking-[0.12em] text-brand-muted">LAYER 2</span>
                        </div>

                        <div className="p-5 sm:p-6">
                            {/* L2 Global Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-5 rounded-xl border border-brand-border overflow-hidden mb-6 bg-brand-bg">
                                {[
                                    { k: 'L2 users', v: l2Stats?.total_users ?? "..." },
                                    { k: 'Virtual balance', v: numeroLocal(l2Stats?.total_virtual_balance) ?? "..." },
                                    { k: 'Total claims', v: numeroLocal(l2Stats?.total_claims_count) ?? "..." },
                                    { k: 'Distributed on L2', v: numeroLocal(l2Stats?.total_claimed_all_time) ?? "..." },
                                    { k: 'Withdrawn → L1', v: numeroLocal(l2Stats?.total_withdrawn_all_time) ?? "...", ok: true },
                                ].map((s, i) => (
                                    <div key={i} className="p-3.5 border-brand-border border-b md:border-b-0 [&:not(:last-child)]:border-r">
                                        <p className={label}>{s.k}</p>
                                        <p className={`mt-1 font-mono tabular-nums text-lg font-semibold ${s.ok ? 'text-brand-success' : 'text-brand-secondary'}`}>{s.v}</p>
                                    </div>
                                ))}
                            </div>

                            {/* User Lookup */}
                            <div className="rounded-xl border border-brand-border bg-brand-bg p-4 sm:p-5">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-secondary mb-3">
                                    <MagnifyingGlassPlusIcon className="w-4 h-4 text-brand-primary" />
                                    {tri("Look up a user's virtual balance",
                                         'Consultar o saldo virtual de um usuário',
                                         'Consultar el saldo virtual de un usuario')}
                                </h3>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <input
                                        id="faucethub-l2-lookup"
                                        type="text"
                                        placeholder={tri('User wallet address (0x...)',
                                                         'Endereço da carteira do usuário (0x...)',
                                                         'Dirección de la billetera del usuario (0x...)')}
                                        value={l2LookupWallet}
                                        onChange={e => setL2LookupWallet(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') lookupL2Balance(); }}
                                        className={`${field} flex-1 font-mono`}
                                    />
                                    <button onClick={lookupL2Balance} className={`${btnPrimary} min-h-[42px] px-5 text-sm`}>
                                        Consultar
                                    </button>
                                </div>

                                {l2Loading && <p className="text-brand-muted text-sm mt-4 animate-pulse">Consultando ledger...</p>}

                                {l2WithdrawStatus && (
                                    <p className={`text-sm mt-3 ${l2WithdrawStatus.startsWith('✅') ? 'text-brand-success' : 'text-red-300'}`}>
                                        {l2WithdrawStatus}
                                    </p>
                                )}

                                {l2Balances && !l2Loading && (
                                    <div className="mt-5 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="flex items-center gap-2 text-brand-muted text-xs">
                                                User:
                                                <WalletIdenticon address={l2Balances.user} size={18} round />
                                                <code className="text-brand-secondary font-mono">{l2Balances.user.slice(0, 10)}...{l2Balances.user.slice(-6)}</code>
                                            </p>
                                            <p className="text-brand-secondary font-semibold text-sm">Total pending: <span className="font-mono tabular-nums">{numeroLocal(l2Balances.total_pending)}</span> CLAIM</p>
                                        </div>

                                        {/* Saldo zero era um beco: a tela dizia que nao havia nada
                                            e parava ai, justamente para quem acabou de chegar e e
                                            quem mais precisa de direcao. As torneiras ja estao
                                            carregadas na memoria desta tela; so faltava oferece-las. */}
                                        {l2Balances.faucets.length === 0 && (
                                            <div className="py-5 text-center">
                                                <p className="text-brand-muted text-sm">
                                                    {tri(
                                                        'Nothing here yet. Claim on any faucet below and the balance shows up here.',
                                                        'Nada aqui ainda. Faça claim em qualquer torneira abaixo e o saldo aparece aqui.',
                                                        'Nada aquí todavía. Haga claim en cualquier grifo de abajo y el saldo aparece aquí.')}
                                                </p>
                                                {faucets.filter(f => f.site_url).length > 0 && (
                                                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                                                        {faucets.filter(f => f.site_url).map((f, i) => (
                                                            <a key={i} href={f.site_url!} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                                                                <WalletIdenticon address={f.wallet_address} size={18} round />
                                                                {f.name} &rarr;
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {l2Balances.faucets.map((entry, idx) => (
                                            <div key={idx} className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-brand-border bg-brand-surface">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <WalletIdenticon address={entry.faucet_wallet} size={36} />
                                                    <div className="min-w-0">
                                                        <h4 className="font-semibold text-brand-secondary text-sm truncate">{entry.faucet_name}</h4>
                                                        <p className="text-brand-muted text-[11px] font-mono">{entry.claim_count} claims | withdrawn: {numeroLocal(entry.total_withdrawn)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 ml-auto">
                                                    <button onClick={() => handleL2Deposit(entry.faucet_wallet)} className={btnGhost}>
                                                        {tri('Deposit', 'Depositar', 'Depositar')}
                                                    </button>
                                                    <div className="text-right">
                                                        <p className="text-brand-secondary font-semibold text-sm font-mono tabular-nums">{numeroLocal(entry.virtual_balance)} <span className="text-brand-muted font-normal text-xs">CLAIM</span></p>
                                                        <p className="text-brand-muted text-[11px]">
                                                            {entry.can_withdraw
                                                                ? `Min: ${entry.min_withdraw}`
                                                                : `${numeroLocal(entry.missing_to_withdraw)} short of the minimum`}
                                                        </p>
                                                    </div>
                                                    {/* Quando nao da para sacar, o caminho e claimar mais -- e e
                                                        la que o botao leva. Antes a tela dizia "abaixo do minimo"
                                                        e terminava a conversa. */}
                                                    {entry.can_withdraw ? (
                                                        <button
                                                            onClick={() => handleL2Withdraw(entry.faucet_wallet)}
                                                            className={`${btn} border-brand-success/50 bg-brand-success/15 text-brand-success hover:bg-brand-success/25`}
                                                        >
                                                            Withdraw → L1
                                                        </button>
                                                    ) : entry.site_url ? (
                                                        <a href={entry.site_url} target="_blank" rel="noopener noreferrer" className={`${btnGhost} whitespace-nowrap`}>
                                                            {cooldownRestante(entry.next_claim_at)
                                                                ? `${tri('Unlocks in', 'Libera em', 'Se libera en')} ${cooldownRestante(entry.next_claim_at)}`
                                                                : `${tri('Claim on', 'Claimar em', 'Hacer claim en')} ${entry.faucet_name} →`}
                                                        </a>
                                                    ) : (
                                                        <span className={`${btn} border-brand-border text-brand-muted cursor-default`}>
                                                            {tri('Below minimum', 'Abaixo do mínimo',
                                                                 'Por debajo del mínimo')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* New Dynamic Infrastructure & Loyalty Section */}
                    <section className={panel}>
                        <div className={panelHead}>
                            <div>
                                <h2 className={h2}>
                                    <GlobeAltIcon className="w-[18px] h-[18px] text-brand-primary" /> L2 loyalty and traffic monitor
                                </h2>
                                <p className="text-xs text-brand-muted mt-1">Physical network connections and user loyalty ranking</p>
                            </div>
                            <button onClick={() => { fetchLeaderboard(); fetchActivityLinks(); }} className={btnGhost}>
                                <ArrowPathIcon className="w-4 h-4" /> Refresh map
                            </button>
                        </div>

                        <div className="p-5 sm:p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {/* Leaderboard / Competividade */}
                            <div className="space-y-3 min-w-0">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-secondary">
                                    <ChartBarIcon className="w-4 h-4 text-brand-primary" /> Ranking de Acumuladores L2
                                </h3>
                                <div className="overflow-x-auto custom-scrollbar border border-brand-border rounded-xl bg-brand-bg">
                                    <table className="w-full text-left text-xs">
                                        <thead className="border-b border-brand-border">
                                            <tr className="text-brand-muted">
                                                <th className="px-4 py-3 font-medium uppercase tracking-[0.1em] text-[10px]">Rank</th>
                                                <th className="px-4 py-3 font-medium uppercase tracking-[0.1em] text-[10px]">{tri('User', 'Usuário', 'Usuario')}</th>
                                                <th className="px-4 py-3 font-medium uppercase tracking-[0.1em] text-[10px]">{tri('Main faucet', 'Torneira principal',
                                                                               'Grifo principal')}</th>
                                                <th className="px-4 py-3 font-medium uppercase tracking-[0.1em] text-[10px] text-right">Claims</th>
                                                <th className="px-4 py-3 font-medium uppercase tracking-[0.1em] text-[10px] text-right">{tri('Total farmed', 'Total farmado',
                                                                                          'Total farmeado')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-brand-border">
                                            {leaderboard.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-8 text-center text-brand-muted">
                                                        {tri('No user registered in the ledger.',
                                                             'Nenhum usuário registrado no livro-razão.',
                                                             'Ningún usuario registrado en el libro mayor.')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                leaderboard.map((user, idx) => {
                                                    const tier = user.claim_count >= 10
                                                        ? { label: "Lord", style: "text-sol-purple border-sol-purple/50" }
                                                        : user.claim_count >= 5
                                                        ? { label: "Elite", style: "text-brand-primary border-brand-primary/50" }
                                                        : { label: "Farmer", style: "text-brand-muted border-brand-border" };

                                                    return (
                                                        <tr key={idx} className="hover:bg-brand-primary/[0.04] transition-colors">
                                                            <td className="px-4 py-3">
                                                                <span className={`inline-flex w-6 h-6 items-center justify-center rounded-md font-mono text-[11px] font-semibold ${idx < 3 ? 'bg-brand-primary/15 text-brand-primary' : 'text-brand-muted'}`}>
                                                                    {idx + 1}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="flex items-center gap-2 font-mono text-brand-secondary whitespace-nowrap">
                                                                    <WalletIdenticon address={user.user_wallet} size={18} round />
                                                                    {user.user_wallet.slice(0, 8)}...{user.user_wallet.slice(-4)}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <button
                                                                    onClick={() => setSelectedFaucet(user.faucet_wallet)}
                                                                    className={`text-brand-primary hover:underline underline-offset-2 font-medium text-left rounded ${focusRing}`}
                                                                    title={tri('Click to highlight it in the monitor',
                                                                               'Clique para destacá-la no monitor',
                                                                               'Haga clic para destacarlo en el monitor')}
                                                                >
                                                                    {user.faucet_name
                                                                        || tri('Unknown faucet', 'Torneira desconhecida',
                                                                               'Grifo desconocido')}
                                                                </button>
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-mono tabular-nums text-brand-secondary">
                                                                {user.claim_count}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <span className="font-mono tabular-nums font-semibold text-brand-secondary whitespace-nowrap">{user.total_claimed.toFixed(2)} CLAIM</span>
                                                                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${tier.style}`}>
                                                                        {tier.label}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* SVG Interactive Traffic Map */}
                            <div className="space-y-3 flex flex-col min-w-0">
                                <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-secondary">
                                    <GlobeAltIcon className="w-4 h-4 text-brand-primary" /> Traffic and connection map, L2 &rarr; L1
                                </h3>
                                <div className="flex-1 min-h-[300px] border border-brand-border rounded-xl bg-brand-bg relative overflow-hidden flex items-center justify-center p-4">
                                    <div className="absolute top-3 left-4 right-4 flex justify-between text-[10px] font-medium uppercase tracking-[0.12em] text-brand-muted pointer-events-none">
                                        <span>Faucets · L2</span>
                                        <span>Wallets · L1</span>
                                    </div>
                                    {/* SVG Canvas */}
                                    <svg className="w-full h-full min-h-[280px]" viewBox="0 0 500 300" role="img"
                                         aria-label={tri('Recent claims, from each faucet to the wallet that received them',
                                                         'Claims recentes, de cada torneira até a carteira que recebeu',
                                                         'Claims recientes, de cada grifo a la billetera que los recibió')}>
                                        <defs>
                                            <linearGradient id="settleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#2B9FE8" />
                                                <stop offset="100%" stopColor="#9945FF" />
                                            </linearGradient>
                                        </defs>

                                        {/* Render active link paths first (below nodes) */}
                                        {renderActivityPaths()}

                                        {/* Render Left Side: Faucets */}
                                        {renderFaucetNodes()}

                                        {/* Render Right Side: Recent Users */}
                                        {renderUserNodes()}
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
};

// ---- small on-chain primitives ----------------------------------------------

const shortAddr = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

// FNV-1a over the address: the same wallet always gets the same hue and the
// same pattern, on every screen, with no network call.
const walletHash = (addr: string): number => {
    let h = 0x811c9dc5;
    const s = (addr || '').toLowerCase();
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
};
const walletHue = (addr: string) => walletHash(addr) % 360;

/** A 5x5 mirrored identicon derived from the address. Recognising a wallet by
 *  its shape is how people read addresses on-chain; the hex alone is not. */
const WalletIdenticon: React.FC<{ address: string; size?: number; round?: boolean }> = ({ address, size = 32, round }) => {
    const h = walletHash(address);
    const hue = h % 360;
    const cells: React.ReactElement[] = [];
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
            const bit = (h >>> ((row * 3 + col) % 30)) & 1;
            if (!bit) continue;
            const fill = `hsl(${hue} 62% ${(row + col) % 2 ? 52 : 62}%)`;
            cells.push(<rect key={`${row}-${col}`} x={col + 1} y={row + 1} width="1" height="1" fill={fill} />);
            if (col < 2) cells.push(<rect key={`${row}-${col}m`} x={5 - col} y={row + 1} width="1" height="1" fill={fill} />);
        }
    }
    return (
        <svg width={size} height={size} viewBox="0 0 7 7" aria-hidden="true" shapeRendering="crispEdges"
             className={`flex-none border border-brand-border ${round ? 'rounded-full' : 'rounded-lg'}`}
             style={{ background: `hsl(${hue} 35% 12%)` }}>
            {cells}
        </svg>
    );
};

/** Pulses only when the thing it marks is live. */
const LiveDot: React.FC<{ on: boolean }> = ({ on }) => (
    <span className="relative inline-flex w-2 h-2 flex-none">
        {on && <span className="absolute inset-0 rounded-full bg-brand-success opacity-60 motion-safe:animate-ping" />}
        <span className={`relative inline-flex w-2 h-2 rounded-full ${on ? 'bg-brand-success' : 'bg-brand-muted'}`} />
    </span>
);

/** Escrow against debt. Full and green when covered, amber when short, an
 *  empty dashed track when nothing is owed, because that is not "0% covered". */
const CoverageBar: React.FC<{ coverage: number | null; className?: string; wide?: boolean }> = ({ coverage, className = '', wide }) => {
    const { tri } = useLanguage();
    if (coverage === null) {
        return <div className={`${wide ? 'h-2 w-full' : 'h-1 w-full max-w-[140px]'} rounded-full border border-dashed border-brand-border ${className}`} />;
    }
    const pct = Math.min(Math.max(coverage, 0), 1) * 100;
    return (
        <div className={`${wide ? 'h-2 w-full' : 'h-1 w-full max-w-[140px]'} rounded-full bg-brand-card overflow-hidden ${className}`}
             role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}
             aria-label={tri('Escrow coverage', 'Cobertura da caução', 'Cobertura de la garantía')}>
            <div className={`h-full rounded-full ${coverage >= 1 ? 'bg-brand-success' : 'bg-brand-warn'}`} style={{ width: `${pct}%` }} />
        </div>
    );
};
