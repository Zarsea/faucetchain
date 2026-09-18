
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaucetChainSolanaMark, WalletIcon, XMarkIcon, GlobeAltIcon, CubeIcon } from './IconComponents';
import { useLanguage } from './LanguageContext';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../apiConfig';
import { solanaProvider, encodeSignature, accountFromWallet } from '../utils/solanaWallet';
import { walletProofMessage } from '../utils/actionMessage';

export const Header: React.FC = () => {
    const { tFn: t, lang, setLang } = useLanguage();
    const { isConnected, userAddress, authMethod, login, logout } = useAuth();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isGuestLoading, setIsGuestLoading] = useState(false);
    const [isWalletLoading, setIsWalletLoading] = useState(false);
    const [authModalView, setAuthModalView] = useState<'MAIN' | 'EMAIL'>('MAIN');
    const [emailInput, setEmailInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState('');

    const toggleLang = () => {
        const nextLang = lang === 'en' ? 'pt' : lang === 'pt' ? 'es' : 'en';
        setLang(nextLang);
    };

    const handleEmailAuth = async (action: 'login' | 'register') => {
        setAuthError('');
        if (!emailInput || !passwordInput) {
            setAuthError(t('auth.fillFields'));
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailInput, password: passwordInput })
            });
            const data = await res.json();
            if (!res.ok) {
                setAuthError(data.detail || t('auth.authError'));
                return;
            }
            login(data.wallet_address, 'EMAIL');
            setIsAuthModalOpen(false);
            setAuthModalView('MAIN');
        } catch (error) {
            setAuthError(t('auth.connError'));
        }
    };

    // Only accounts this server holds the key for. Connecting an external EVM
    // wallet was removed: payouts settle on Solana, and the only wallet the
    // product needs is the Solana one, linked from the payouts screen.
    const handleConnect = async (method: 'GUEST' | 'EMAIL') => {
        if (method === 'EMAIL') {
            setAuthModalView('EMAIL');
            return;
        }
        {
            // A guest account is created by the server, not invented here. The
            // browser used to mint its own identity, which the API then trusted
            // without a signature because it did not look like an address.
            setIsGuestLoading(true);
            try {
                const res = await fetch(`${API_BASE_URL}/api/auth/guest`, { method: 'POST' });
                if (!res.ok) throw new Error(String(res.status));
                const data = await res.json();
                login(data.wallet_address, 'GUEST');
                setIsAuthModalOpen(false);
            } catch {
                setAuthError(t('auth.connError'));
                setAuthModalView('MAIN');
            } finally {
                setIsGuestLoading(false);
            }
        }
    };

    // The wallet is the account: its address is derived from the public key the
    // same way the server derives it, so the same Phantom reaches the same
    // account anywhere, with no password to lose.
    //
    // The sentence signed here is the one that already links a wallet, unchanged.
    // It names the account and the wallet, and since the account comes from the
    // wallet, signing it says exactly what is about to happen.
    const handleSolanaConnect = async () => {
        setAuthError('');
        const wallet = solanaProvider();
        if (!wallet) {
            setAuthError(t('auth.noWallet'));
            return;
        }
        setIsWalletLoading(true);
        try {
            const { publicKey } = await wallet.connect();
            const solanaAddress = publicKey.toString();
            const derived = accountFromWallet(solanaAddress);

            const sigTimestamp = Math.floor(Date.now() / 1000);
            const sentence = walletProofMessage(derived, solanaAddress, sigTimestamp);
            const signed = await wallet.signMessage(new TextEncoder().encode(sentence), 'utf8');

            const res = await fetch(`${API_BASE_URL}/api/auth/solana`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    solana_address: solanaAddress,
                    signature: encodeSignature(signed.signature),
                    sig_timestamp: sigTimestamp,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setAuthError(data.detail || t('auth.authError'));
                return;
            }
            login(data.wallet_address, 'SOLANA');
            setIsAuthModalOpen(false);
        } catch (error) {
            // Declining the signature in the wallet lands here, and is not an error
            // worth shouting about.
            setAuthError(t('auth.walletDenied') + (error instanceof Error ? error.message : ''));
        } finally {
            setIsWalletLoading(false);
        }
    };

    const handleDisconnect = () => {
        logout();
    };

    return (
        <header className="glass border-b border-brand-primary/30 sticky top-0 z-50">
            <div className="bg-brand-primary/20 py-1.5 px-4 text-center border-b border-brand-primary/40 neon-border-dynamic">
                <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em] flex items-center justify-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-ping"></span>
                    PoC-V3 Public TestNet Active • Epoch 0 Initialization
                </p>
            </div>
            <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <FaucetChainSolanaMark className="w-10 h-10 drop-shadow-[0_0_8px_rgba(0,180,255,0.8)] hover:scale-105 transition-transform" />
                    <div>
                        <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center drop-shadow-lg">
                            <span className="text-white">FAUCET</span>
                            <span className="text-brand-primary">CHAIN</span>
                        </h1>
                        <div className="hidden md:flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest drop-shadow-md">Hybrid PoC-V3 Consensus</span>
                            {/* Where the money actually lands. Solana's own colours, used
                                only for settlement, so the badge means something. */}
                            <span className="settle-chip inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-[9px] font-black uppercase tracking-widest">
                                <span className="w-1.5 h-1.5 rounded-full bg-sol-green settle-pulse"></span>
                                Settles on Solana · devnet
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {isConnected ? (
                        <div className="flex items-center gap-3">
                            <div className="hidden lg:flex flex-col items-end">
                                <span className="text-[9px] font-black text-brand-muted uppercase">{t('auth.architectConnected')} ({authMethod})</span>
                                <span className="text-xs font-mono text-brand-primary">{userAddress}</span>
                            </div>
                            <button
                                onClick={handleDisconnect}
                                className="p-2 bg-brand-bg border border-brand-border rounded-xl text-brand-error hover:bg-brand-error/10 transition-all"
                                title="Desconectar"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAuthModalOpen(true)}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 bg-brand-primary text-brand-bg hover:bg-white hover:shadow-glow-primary hover:scale-105 active:scale-95 border border-brand-primary/50"
                        >
                            <WalletIcon className="w-4 h-4" />
                            {t('wallet.connect')}
                        </button>
                    )}

                    <button
                        onClick={toggleLang}
                        className="px-3 py-2 rounded-xl border border-brand-border text-xs font-black text-brand-muted hover:border-brand-primary hover:text-brand-primary transition-all uppercase"
                    >
                        {lang}
                    </button>
                </div>
            </div>

            {/* Through a portal, not inline: this <header> carries `glass`, whose
                backdrop-filter makes it the containing block for any fixed
                descendant. Left here, `inset-0` resolved against the 107px
                header instead of the viewport, and centring pushed the panel
                238px above the top edge. The portal also escapes the z-10
                stacking context App.tsx wraps the header in. */}
            {isAuthModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
                    <div className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm" onClick={() => { setIsAuthModalOpen(false); setAuthModalView('MAIN'); setAuthError(''); }}></div>
                    <div className="relative glass border border-brand-primary/30 rounded-[2rem] p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleIn">
                        <button onClick={() => { setIsAuthModalOpen(false); setAuthModalView('MAIN'); setAuthError(''); }} className="absolute top-6 right-6 text-brand-muted hover:text-white">
                            <XMarkIcon className="w-6 h-6" />
                        </button>

                        <div className="text-center mb-8">
                            <CubeIcon className="w-12 h-12 text-brand-primary mx-auto mb-4" />
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{t('auth.title')}</h3>
                            <p className="text-brand-muted text-sm mt-2">{t('auth.subtitle')}</p>
                        </div>

                        {authModalView === 'MAIN' ? (
                            <div className="space-y-4">
                                {/* The guest button can fail too, so the banner cannot live
                                    only in the email view where it started. */}
                                {authError && <div className="p-3 bg-brand-error/20 text-brand-error text-sm rounded-xl text-center border border-brand-error/30">{authError}</div>}
                                <button
                                    onClick={handleSolanaConnect}
                                    disabled={isWalletLoading}
                                    className="w-full flex items-center justify-center gap-4 bg-brand-surface border border-brand-accent/40 p-4 rounded-2xl font-bold text-white hover:border-brand-accent transition-all disabled:opacity-40"
                                >
                                    <FaucetChainSolanaMark className="w-5 h-5" />
                                    {isWalletLoading ? t('auth.walletWaiting') : t('auth.solana')}
                                </button>
                                <button
                                    onClick={() => handleConnect('GUEST')}
                                    disabled={isGuestLoading}
                                    className="w-full flex items-center justify-center gap-4 bg-brand-surface border border-brand-border p-4 rounded-2xl font-bold text-white hover:border-brand-primary transition-all disabled:opacity-40"
                                >
                                    <CubeIcon className="w-5 h-5 text-brand-primary" />
                                    {isGuestLoading ? '...' : t('auth.guest')}
                                </button>
                                <button
                                    onClick={() => handleConnect('EMAIL')}
                                    className="w-full flex items-center justify-center gap-4 bg-brand-surface border border-brand-border p-4 rounded-2xl font-bold text-white hover:border-brand-primary transition-all"
                                >
                                    <GlobeAltIcon className="w-5 h-5 text-brand-primary" />
                                    {t('auth.email')}
                                </button>
                                <div className="flex items-center gap-4 py-2">
                                    <div className="h-px flex-1 bg-brand-border"></div>
                                    <span className="text-[10px] font-black text-brand-muted uppercase">{t('auth.orPasteAddress')}</span>
                                    <div className="h-px flex-1 bg-brand-border"></div>
                                </div>
                                
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="0x..." 
                                        className="flex-1 bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-sm text-white focus:border-brand-primary outline-none transition-all"
                                        id="manualAddressInput"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = (e.target as HTMLInputElement).value;
                                                if (val) {
                                                    login(val, 'MANUAL');
                                                    setIsAuthModalOpen(false);
                                                }
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            const val = (document.getElementById('manualAddressInput') as HTMLInputElement).value;
                                            if (val) {
                                                login(val, 'MANUAL');
                                                setIsAuthModalOpen(false);
                                            }
                                        }}
                                        className="bg-brand-surface border border-brand-border px-4 py-3 rounded-xl font-bold text-brand-primary hover:bg-brand-primary hover:text-brand-bg transition-all"
                                    >
                                        {t('auth.enter')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {authError && <div className="p-3 bg-brand-error/20 text-brand-error text-sm rounded-xl text-center border border-brand-error/30">{authError}</div>}
                                <input 
                                    type="email" 
                                    placeholder={t('auth.emailPlaceholder')} 
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-sm text-white focus:border-brand-primary outline-none transition-all"
                                />
                                <input 
                                    type="password" 
                                    placeholder={t('auth.passwordPlaceholder')} 
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-sm text-white focus:border-brand-primary outline-none transition-all"
                                />
                                <div className="flex gap-4 mt-4">
                                    <button
                                        onClick={() => handleEmailAuth('login')}
                                        className="flex-1 bg-brand-surface border border-brand-border px-4 py-3 rounded-xl font-bold text-white hover:border-brand-primary transition-all"
                                    >
                                        {t('auth.login')}
                                    </button>
                                    <button
                                        onClick={() => handleEmailAuth('register')}
                                        className="flex-1 bg-brand-primary text-brand-bg px-4 py-3 rounded-xl font-bold hover:bg-white transition-all shadow-glow-primary"
                                    >
                                        {t('auth.register')}
                                    </button>
                                </div>
                                <button
                                    onClick={() => { setAuthModalView('MAIN'); setAuthError(''); }}
                                    className="w-full text-brand-muted text-xs font-bold hover:text-white mt-2 transition-all uppercase tracking-widest"
                                >
                                    {t('auth.back')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </header>
    );
};
