
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { API_BASE_URL } from '../apiConfig';

// No external EVM wallet: the only wallet the product needs is the Solana
// one, used to sign in and to receive payouts.
type AuthMethod = 'GUEST' | 'EMAIL' | 'SOLANA' | 'GOOGLE' | null;

const TOKEN_KEY = 'hvm_session_token';
const ADDRESS_KEY = 'hvm_user_address';
const CONNECTED_KEY = 'hvm_is_connected';
const METHOD_KEY = 'hvm_auth_method';

// Pasting an address stopped being a way in on 24 September. Removing the field
// does not remove the sessions it already created: those live in this browser
// and restore themselves on the next load, so the door would still be open for
// everyone who had already walked through it. They are evicted here, once, at
// import -- before any component reads the stored state.
try {
    if (localStorage.getItem(METHOD_KEY) === 'MANUAL') {
        [ADDRESS_KEY, CONNECTED_KEY, METHOD_KEY, TOKEN_KEY].forEach(k => localStorage.removeItem(k));
    }
} catch {
    // Storage blocked or private browsing: nothing was stored, nothing to evict.
}

interface AuthContextType {
    userAddress: string | null;
    isConnected: boolean;
    authMethod: AuthMethod;
    login: (address: string, method: AuthMethod, sessionToken?: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * The header that proves the caller may act as the signed-in account.
 *
 * An account whose key the server holds cannot sign an action, and its address
 * is public — printed on screen, visible in the explorer, handed out to be paid.
 * The session is what stands in for a signature. Spread this into the headers of
 * any request that acts on the account's behalf.
 *
 * A session with no token gets a 401 from the server, which is the honest
 * outcome: it can look, not act.
 */
export function sessionHeaders(): Record<string, string> {
    try {
        const token = localStorage.getItem(TOKEN_KEY);
        return token ? { 'X-Session-Token': token } : {};
    } catch {
        // Private browsing, or storage blocked. Nothing to send.
        return {};
    }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [userAddress, setUserAddress] = useState<string | null>(() => localStorage.getItem(ADDRESS_KEY));
    const [isConnected, setIsConnected] = useState<boolean>(() => localStorage.getItem(CONNECTED_KEY) === 'true');
    const [authMethod, setAuthMethod] = useState<AuthMethod>(() => localStorage.getItem(METHOD_KEY) as AuthMethod || null);

    const login = (address: string, method: AuthMethod, sessionToken?: string) => {
        setUserAddress(address);
        setIsConnected(true);
        setAuthMethod(method);
        localStorage.setItem(ADDRESS_KEY, address);
        localStorage.setItem(CONNECTED_KEY, 'true');
        localStorage.setItem(METHOD_KEY, method || '');
        // A method that issues no token has to clear any token left from an
        // earlier session: it belongs to a different account.
        if (sessionToken) {
            localStorage.setItem(TOKEN_KEY, sessionToken);
        } else {
            localStorage.removeItem(TOKEN_KEY);
        }

        // Dispatch event for legacy compatibility if needed
        window.dispatchEvent(new CustomEvent('wallet_connected', { detail: { address, method } }));
    };

    // A sessao expira em sete dias do lado do servidor, e ate hoje a
    // aplicacao nao tinha como saber disso. Ela se declarava logada por achar
    // tres strings no localStorage, e a pessoa so descobria o contrario quando
    // uma acao falhava -- parecendo bug, porque a tela dizia que ela estava
    // dentro.
    //
    // Conferir ao montar e barato e resolve o caso comum: quem volta no dia
    // seguinte ve "entrar" em vez de ver um botao que nao funciona.
    useEffect(() => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return;
        let vivo = true;
        fetch(`${API_BASE_URL}/api/auth/session`, { headers: { 'X-Session-Token': token } })
            .then(r => { if (vivo && r.status === 401) sair(); })
            // Rede fora do ar nao e sessao invalida. Derrubar o login porque o
            // wifi caiu seria trocar um incomodo por outro pior.
            .catch(() => {});
        return () => { vivo = false; };
    }, []);

    // Expirar no meio do uso tambem acontece, e aí nenhuma conferencia no
    // arranque pega. Quem percebe primeiro e a chamada que levou 401, e ela
    // avisa por aqui.
    useEffect(() => {
        const aoCair = () => sair();
        window.addEventListener('session_expired', aoCair);
        return () => window.removeEventListener('session_expired', aoCair);
    }, []);

    const sair = () => {
        setUserAddress(null);
        setIsConnected(false);
        setAuthMethod(null);
        localStorage.removeItem(ADDRESS_KEY);
        localStorage.removeItem(CONNECTED_KEY);
        localStorage.removeItem(METHOD_KEY);
        localStorage.removeItem(TOKEN_KEY);

        window.dispatchEvent(new CustomEvent('wallet_disconnected'));
    };

    const logout = sair;

    return (
        <AuthContext.Provider value={{ userAddress, isConnected, authMethod, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
