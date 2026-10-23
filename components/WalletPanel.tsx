import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL } from '../apiConfig';
import { useAuth } from './AuthContext';
import { useLanguage, localeDoIdioma } from './LanguageContext';
import { TransferWidget } from './UserDashboard';
import {
    BoltIcon,
    CheckCircleIcon,
    LockClosedIcon,
    PaperAirplaneIcon,
    ShieldCheckIcon,
    SparklesIcon,
    WalletIcon,
    XMarkIcon,
} from './IconComponents';

/**
 * O painel da carteira, aberto pelo cabecalho.
 *
 * Existe por um motivo pequeno e um grande. O pequeno: o cabecalho escrevia o
 * endereco inteiro, que ocupa a largura toda, nao cabe no celular e ninguem
 * consegue copiar sem selecionar caractere a caractere. O grande: nao havia
 * lugar nenhum onde a pessoa visse quanto tem e pudesse fazer algo com isso na
 * mesma tela -- transferir morava dentro do Dashboard, tres cliques adiante.
 *
 * O saldo mostrado e `total_claim`, e isso e deliberado: e exatamente o numero
 * que `/api/transfer` confere antes de deixar gastar. Um painel que mostrasse
 * outro saldo convidaria a pessoa a tentar mandar o que ela nao pode.
 */

const T = (lang: string, en: string, pt: string) => (lang === 'pt' ? pt : en);

interface Saldo {
    total_claim: number;
    pending_amount: number;
    pending_count: number;
}

/** Duas cores estaveis tiradas do proprio endereco: o mesmo endereco, o mesmo rosto.
 *
 * Le o hexadecimal direto em vez de passar um hash rolante por cima dele. Com
 * `h = (h * 31 + c) % 360` sobre os caracteres, duas contas reais do banco
 * cairam a 4 graus uma da outra -- indistinguiveis a olho. Estes dois cortes
 * de 24 bits ja vem com entropia; o endereco ao lado continua sendo o
 * identificador de verdade, e o avatar so ajuda a reconhecer o proprio. */
function coresDoEndereco(addr: string): [string, string] {
    const inicio = parseInt(addr.slice(2, 8), 16) || 0;
    const fim = parseInt(addr.slice(-6), 16) || 0;
    const h = inicio % 360;
    const distancia = 30 + (fim % 60);
    return [`hsl(${h} 72% 56%)`, `hsl(${(h + distancia) % 360} 70% 40%)`];
}

function encurtar(addr: string): string {
    return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

const LARGURA = 352;   // 22rem
const BORDA = 12;      // folga minima ate a beira da tela

/**
 * Onde o painel cabe, em coordenadas da janela.
 *
 * Ancorar no botao com `right-0` punha o painel para fora da tela no celular:
 * o gatilho nao fica na beira direita -- o seletor de idioma vem depois dele --
 * entao alinhar as duas bordas direitas jogava a esquerda do painel para -32px,
 * e o avatar e o endereco apareciam cortados.
 *
 * O painel segue o gatilho quando ha espaco e encosta na beira quando nao ha.
 */
function posicaoDoPainel(r: DOMRect) {
    const largura = Math.min(LARGURA, window.innerWidth - BORDA * 2);
    const direita = Math.min(
        Math.max(BORDA, window.innerWidth - r.right),
        window.innerWidth - BORDA - largura,
    );
    return { top: r.bottom + 8, right: direita, largura };
}

const IconeCopiar: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const Atalho: React.FC<{
    icone: React.ReactNode; titulo: string; nota: string; onClick: () => void;
}> = ({ icone, titulo, nota, onClick }) => (
    <button
        onClick={onClick}
        className="w-full flex items-start gap-3 p-3 rounded-xl bg-brand-bg/60 border border-brand-border/50 text-left hover:border-brand-primary/50 transition-colors min-h-[44px]"
    >
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-surface border border-brand-border flex items-center justify-center text-brand-primary">
            {icone}
        </span>
        <span className="min-w-0">
            <span className="block text-sm font-bold text-brand-secondary">{titulo}</span>
            <span className="block text-[11px] text-brand-muted leading-snug">{nota}</span>
        </span>
    </button>
);

export const WalletButton: React.FC<{ onNavigate?: (aba: string) => void }> = ({ onNavigate }) => {
    const { lang } = useLanguage();
    const { isConnected, userAddress, authMethod, logout } = useAuth();
    const [aberto, setAberto] = useState(false);
    const [saldo, setSaldo] = useState<Saldo | null>(null);
    const [copiado, setCopiado] = useState(false);
    const [transferindo, setTransferindo] = useState(false);
    const [onde, setOnde] = useState<{ top: number; right: number; largura: number } | null>(null);
    const gatilhoRef = useRef<HTMLButtonElement>(null);
    const painelRef = useRef<HTMLDivElement>(null);
    const tt = (en: string, pt: string) => T(lang, en, pt);

    useLayoutEffect(() => {
        if (!aberto || !gatilhoRef.current) return;
        const medir = () => {
            if (gatilhoRef.current) setOnde(posicaoDoPainel(gatilhoRef.current.getBoundingClientRect()));
        };
        medir();
        // O cabecalho e sticky, entao rolar nao move o gatilho; redimensionar move.
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, [aberto]);

    const buscarSaldo = useCallback(async () => {
        if (!userAddress) return;
        try {
            const r = await fetch(`${API_BASE_URL}/api/user/${userAddress}/balance`);
            if (r.ok) setSaldo(await r.json());
        } catch { /* o painel mostra o que tem; saldo ausente nao quebra a tela */ }
    }, [userAddress]);

    useEffect(() => { if (aberto) buscarSaldo(); }, [aberto, buscarSaldo]);

    // Fecha ao clicar fora e no Esc. Um painel que mostra saldo e fica aberto
    // atras de outra coisa e exatamente o que ninguem quer numa tela
    // compartilhada.
    useEffect(() => {
        if (!aberto) return;
        // O painel vive num portal, fora da arvore do gatilho: os dois precisam
        // ser conferidos, senao clicar dentro do proprio painel o fecharia.
        const fora = (e: MouseEvent) => {
            const alvo = e.target as Node;
            if (gatilhoRef.current?.contains(alvo)) return;
            if (painelRef.current?.contains(alvo)) return;
            setAberto(false);
        };
        const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
        document.addEventListener('mousedown', fora);
        document.addEventListener('keydown', tecla);
        return () => {
            document.removeEventListener('mousedown', fora);
            document.removeEventListener('keydown', tecla);
        };
    }, [aberto]);

    const copiar = async () => {
        if (!userAddress) return;
        try {
            await navigator.clipboard.writeText(userAddress);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1600);
        } catch {
            // Alguns navegadores recusam a area de transferencia fora de um
            // gesto confiavel. Selecionar o texto deixa a pessoa copiar na mao
            // em vez de nao oferecer saida nenhuma.
            const alvo = document.getElementById('endereco-completo');
            if (alvo) {
                const faixa = document.createRange();
                faixa.selectNodeContents(alvo);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(faixa);
            }
        }
    };

    const ir = (aba: string) => { setAberto(false); onNavigate?.(aba); };

    if (!isConnected || !userAddress) return null;

    const [c1, c2] = coresDoEndereco(userAddress);
    const total = saldo?.total_claim ?? 0;
    const vazio = saldo !== null && total <= 0;

    return (
        <>
            <button
                ref={gatilhoRef}
                onClick={() => setAberto(v => !v)}
                aria-expanded={aberto}
                aria-haspopup="dialog"
                className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl bg-brand-bg border border-brand-border hover:border-brand-primary/60 transition-colors min-h-[40px]"
                title={tt('Open wallet', 'Abrir carteira')}
            >
                <span className="w-7 h-7 rounded-full flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }} />
                <span className="font-mono text-xs text-brand-secondary">{encurtar(userAddress)}</span>
            </button>

            {/* Num portal porque o cabecalho tem backdrop-blur, e um ancestral com
                backdrop-filter vira bloco de contencao: `position: fixed` dentro
                dele passa a medir pelo cabecalho em vez de pela janela. */}
            {aberto && onde && createPortal(
                <div
                    ref={painelRef}
                    role="dialog"
                    aria-label={tt('Wallet', 'Carteira')}
                    style={{ position: 'fixed', top: onde.top, right: onde.right, width: onde.largura }}
                    className="z-[60] rounded-2xl border border-brand-border bg-brand-card shadow-2xl overflow-y-auto max-h-[calc(100vh-5rem)]"
                >
                    <div className="p-4 border-b border-brand-border/60">
                        <div className="flex items-start justify-between gap-2">
                            <span className="w-11 h-11 rounded-full flex-shrink-0"
                                  style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }} />
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => ir('Privacy')}
                                    className="p-2 rounded-lg text-brand-muted hover:text-brand-primary hover:bg-brand-bg/60 transition-colors"
                                    title={tt('Privacy settings', 'Privacidade')}
                                >
                                    <ShieldCheckIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => { setAberto(false); logout(); }}
                                    className="p-2 rounded-lg text-brand-muted hover:text-brand-error hover:bg-brand-error/10 transition-colors"
                                    title={tt('Disconnect', 'Desconectar')}
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-brand-muted">
                            {authMethod}
                        </p>

                        {/* O endereco inteiro fica no DOM para a copia e para quem le a
                            tela, e so o recorte aparece. */}
                        <button
                            onClick={copiar}
                            className="mt-1 flex items-center gap-2 font-mono text-sm text-brand-secondary hover:text-brand-primary transition-colors min-h-[32px]"
                            title={tt('Copy full address', 'Copiar o endereço inteiro')}
                        >
                            <span aria-hidden="true">{encurtar(userAddress)}</span>
                            <span id="endereco-completo" className="sr-only">{userAddress}</span>
                            {copiado
                                ? <CheckCircleIcon className="w-4 h-4 text-brand-success" />
                                : <IconeCopiar className="w-3.5 h-3.5 opacity-70" />}
                        </button>
                        {copiado && (
                            <span className="block mt-1 text-[11px] text-brand-success">
                                {tt('Full address copied.', 'Endereço inteiro copiado.')}
                            </span>
                        )}
                    </div>

                    <div className="p-4">
                        <p className="text-3xl font-black text-brand-secondary tracking-tight tabular-nums">
                            {total.toLocaleString(localeDoIdioma(lang),
                                { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            <span className="ml-2 text-base font-bold text-brand-muted">$CLAIM</span>
                        </p>
                        {!!saldo?.pending_amount && (
                            <p className="mt-1 text-[11px] text-brand-warn">
                                {tt(
                                    `${saldo.pending_amount} more claimed, waiting for a block.`,
                                    `Mais ${saldo.pending_amount} reivindicados, esperando bloco.`
                                )}
                            </p>
                        )}
                        <p className="mt-1 text-[11px] text-brand-muted">
                            {tt('Balance on FaucetChain. Campaign tokens settle separately, on Solana.',
                                'Saldo na FaucetChain. Token de campanha liquida à parte, na Solana.')}
                        </p>

                        {vazio ? (
                            <div className="mt-4 space-y-2">
                                <p className="text-sm font-bold text-brand-secondary">
                                    {tt('Nothing here yet', 'Ainda sem saldo')}
                                </p>
                                <p className="text-[11px] text-brand-muted leading-snug mb-2">
                                    {tt('Three ways to earn $CLAIM on this network.',
                                        'Três formas de ganhar $CLAIM nesta rede.')}
                                </p>
                                <Atalho
                                    icone={<SparklesIcon className="w-4 h-4" />}
                                    titulo={tt('Merit Faucet', 'Merit Faucet')}
                                    nota={tt('Solve the proof and claim.', 'Resolva a prova e reivindique.')}
                                    onClick={() => ir('Faucet')}
                                />
                                <Atalho
                                    icone={<BoltIcon className="w-4 h-4" />}
                                    titulo={tt('Mining Hub', 'Central de Mineração')}
                                    nota={tt('Earn at the faucets on the network.',
                                             'Ganhe nas torneiras conectadas à rede.')}
                                    onClick={() => ir('Mining Hub')}
                                />
                                <Atalho
                                    icone={<WalletIcon className="w-4 h-4" />}
                                    titulo={tt('Bounty Board', 'Bounty Board')}
                                    nota={tt('Paid tasks, settled on chain.', 'Tarefas pagas, liquidadas na cadeia.')}
                                    onClick={() => ir('Bounty Board')}
                                />
                            </div>
                        ) : (
                            <div className="mt-4 space-y-2">
                                {transferindo ? (
                                    <div className="p-3 rounded-xl bg-brand-bg/60 border border-brand-border/50">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-black uppercase tracking-widest text-brand-muted">
                                                {tt('Send $CLAIM', 'Enviar $CLAIM')}
                                            </span>
                                            <button
                                                onClick={() => setTransferindo(false)}
                                                className="text-[11px] font-bold text-brand-muted hover:text-brand-secondary"
                                            >
                                                {tt('Cancel', 'Cancelar')}
                                            </button>
                                        </div>
                                        <TransferWidget
                                            userAddress={userAddress}
                                            onTransferSuccess={buscarSaldo}
                                        />
                                        <p className="mt-3 text-[10px] text-brand-muted leading-snug">
                                            {tt('A network fee comes out on top of the amount, so the whole balance never sends.',
                                                'Uma taxa de rede sai além do valor, então o saldo inteiro nunca cabe num envio.')}
                                        </p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setTransferindo(true)}
                                        className="w-full flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-brand-primary text-brand-bg text-sm font-black uppercase tracking-widest hover:bg-white transition-colors"
                                    >
                                        <PaperAirplaneIcon className="w-4 h-4" />
                                        {tt('Send', 'Transferir')}
                                    </button>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => ir('Staking Vault')}
                                        className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-brand-bg/60 border border-brand-border/50 text-xs font-bold text-brand-secondary hover:border-brand-primary/50 transition-colors"
                                    >
                                        <LockClosedIcon className="w-4 h-4" />
                                        {tt('Stake', 'Travar')}
                                    </button>
                                    <button
                                        onClick={() => ir('Solana Payouts')}
                                        className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-brand-bg/60 border border-brand-border/50 text-xs font-bold text-brand-secondary hover:border-brand-primary/50 transition-colors"
                                    >
                                        <WalletIcon className="w-4 h-4" />
                                        {tt('Withdraw', 'Sacar')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default WalletButton;
