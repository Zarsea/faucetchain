import os

def patch_header():
    with open('components/Header.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add imports
    content = content.replace(
        "import { useAuth } from './AuthContext';",
        "import { useAuth } from './AuthContext';\nimport { API_BASE_URL } from '../apiConfig';"
    )

    # 2. Add state
    content = content.replace(
        "const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);",
        "const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);\n    const [authModalView, setAuthModalView] = useState<'MAIN' | 'EMAIL'>('MAIN');\n    const [emailInput, setEmailInput] = useState('');\n    const [passwordInput, setPasswordInput] = useState('');\n    const [authError, setAuthError] = useState('');"
    )

    # 3. Handle EMAIL connect differently
    content = content.replace(
        """    const handleConnect = async (method: 'GOOGLE' | 'EMAIL' | 'WALLET') => {
        if (method === 'WALLET') {""",
        """    const handleEmailAuth = async (action: 'login' | 'register') => {
        setAuthError('');
        if (!emailInput || !passwordInput) {
            setAuthError('Preencha todos os campos.');
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
                setAuthError(data.detail || 'Erro na autenticação');
                return;
            }
            login(data.wallet_address, 'EMAIL');
            setIsAuthModalOpen(false);
            setAuthModalView('MAIN');
        } catch (error) {
            setAuthError('Erro de conexão.');
        }
    };

    const handleConnect = async (method: 'GOOGLE' | 'EMAIL' | 'WALLET') => {
        if (method === 'EMAIL') {
            setAuthModalView('EMAIL');
            return;
        }
        if (method === 'WALLET') {"""
    )

    # Remove the mock logic for EMAIL from the bottom
    content = content.replace(
        """            const demoAddress = method === 'GOOGLE'
                ? `google_${Math.random().toString(36).substring(7)}@faucetchain.io`
                : `email_${Math.random().toString(36).substring(7)}@faucetchain.io`;""",
        """            const demoAddress = `google_${Math.random().toString(36).substring(7)}@faucetchain.io`;"""
    )

    # 4. Replace modal content
    modal_content = """
                        <div className="text-center mb-8">
                            <CubeIcon className="w-12 h-12 text-brand-primary mx-auto mb-4" />
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Acessar FaucetChain TestNet</h3>
                            <p className="text-brand-muted text-sm mt-2">Escolha sua identidade de teste.</p>
                        </div>

                        {authModalView === 'MAIN' ? (
                            <div className="space-y-4">
                                <button
                                    onClick={() => handleConnect('GOOGLE')}
                                    className="w-full flex items-center justify-center gap-4 bg-white text-brand-bg p-4 rounded-2xl font-bold hover:bg-brand-secondary transition-all"
                                >
                                    <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="w-5 h-5" alt="Google" />
                                    Entrar com Google
                                </button>
                                <button
                                    onClick={() => handleConnect('EMAIL')}
                                    className="w-full flex items-center justify-center gap-4 bg-brand-surface border border-brand-border p-4 rounded-2xl font-bold text-white hover:border-brand-primary transition-all"
                                >
                                    <GlobeAltIcon className="w-5 h-5 text-brand-primary" />
                                    Entrar com E-mail
                                </button>
                                <div className="flex items-center gap-4 py-2">
                                    <div className="h-px flex-1 bg-brand-border"></div>
                                    <span className="text-[10px] font-black text-brand-muted uppercase">Web3 Nativo</span>
                                    <div className="h-px flex-1 bg-brand-border"></div>
                                </div>
                                <button
                                    onClick={() => handleConnect('WALLET')}
                                    className="w-full flex items-center justify-center gap-4 bg-brand-primary/10 border border-brand-primary/30 p-4 rounded-2xl font-bold text-brand-primary hover:bg-brand-primary hover:text-brand-bg transition-all"
                                >
                                    <WalletIcon className="w-5 h-5" />
                                    Conectar MetaMask
                                </button>
                                
                                <div className="flex items-center gap-4 py-2">
                                    <div className="h-px flex-1 bg-brand-border"></div>
                                    <span className="text-[10px] font-black text-brand-muted uppercase">Ou cole seu endereço</span>
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
                                        ENTRAR
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {authError && <div className="p-3 bg-brand-error/20 text-brand-error text-sm rounded-xl text-center border border-brand-error/30">{authError}</div>}
                                <input 
                                    type="email" 
                                    placeholder="Seu E-mail" 
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-sm text-white focus:border-brand-primary outline-none transition-all"
                                />
                                <input 
                                    type="password" 
                                    placeholder="Sua Senha" 
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-3 text-sm text-white focus:border-brand-primary outline-none transition-all"
                                />
                                <div className="flex gap-4 mt-4">
                                    <button
                                        onClick={() => handleEmailAuth('login')}
                                        className="flex-1 bg-brand-surface border border-brand-border px-4 py-3 rounded-xl font-bold text-white hover:border-brand-primary transition-all"
                                    >
                                        Login
                                    </button>
                                    <button
                                        onClick={() => handleEmailAuth('register')}
                                        className="flex-1 bg-brand-primary text-brand-bg px-4 py-3 rounded-xl font-bold hover:bg-white transition-all shadow-glow-primary"
                                    >
                                        Cadastrar
                                    </button>
                                </div>
                                <button
                                    onClick={() => { setAuthModalView('MAIN'); setAuthError(''); }}
                                    className="w-full text-brand-muted text-xs font-bold hover:text-white mt-2 transition-all uppercase tracking-widest"
                                >
                                    Voltar
                                </button>
                            </div>
                        )}
"""

    old_modal_content = """
                        <div className="text-center mb-8">
                            <CubeIcon className="w-12 h-12 text-brand-primary mx-auto mb-4" />
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Acessar FaucetChain TestNet</h3>
                            <p className="text-brand-muted text-sm mt-2">Escolha sua identidade de teste.</p>
                        </div>

                        <div className="space-y-4">
                            <button
                                onClick={() => handleConnect('GOOGLE')}
                                className="w-full flex items-center justify-center gap-4 bg-white text-brand-bg p-4 rounded-2xl font-bold hover:bg-brand-secondary transition-all"
                            >
                                <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" className="w-5 h-5" alt="Google" />
                                Entrar com Google
                            </button>
                            <button
                                onClick={() => handleConnect('EMAIL')}
                                className="w-full flex items-center justify-center gap-4 bg-brand-surface border border-brand-border p-4 rounded-2xl font-bold text-white hover:border-brand-primary transition-all"
                            >
                                <GlobeAltIcon className="w-5 h-5 text-brand-primary" />
                                Criar conta com E-mail
                            </button>
                            <div className="flex items-center gap-4 py-2">
                                <div className="h-px flex-1 bg-brand-border"></div>
                                <span className="text-[10px] font-black text-brand-muted uppercase">Web3 Nativo</span>
                                <div className="h-px flex-1 bg-brand-border"></div>
                            </div>
                            <button
                                onClick={() => handleConnect('WALLET')}
                                className="w-full flex items-center justify-center gap-4 bg-brand-primary/10 border border-brand-primary/30 p-4 rounded-2xl font-bold text-brand-primary hover:bg-brand-primary hover:text-brand-bg transition-all"
                            >
                                <WalletIcon className="w-5 h-5" />
                                Conectar MetaMask
                            </button>
                            
                            <div className="flex items-center gap-4 py-2">
                                <div className="h-px flex-1 bg-brand-border"></div>
                                <span className="text-[10px] font-black text-brand-muted uppercase">Ou cole seu endereço</span>
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
                                    ENTRAR
                                </button>
                            </div>
                        </div>
"""
    
    content = content.replace(old_modal_content.strip(), modal_content.strip())
    
    # reset modal state on close
    content = content.replace(
        "onClick={() => setIsAuthModalOpen(false)}",
        "onClick={() => { setIsAuthModalOpen(false); setAuthModalView('MAIN'); setAuthError(''); }}"
    )

    with open('components/Header.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

    print("Header.tsx patched successfully.")

if __name__ == '__main__':
    patch_header()
