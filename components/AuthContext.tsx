
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

// No external EVM wallet: the only wallet the product needs is the Solana
// one, used to sign in and to receive payouts.
type AuthMethod = 'GUEST' | 'EMAIL' | 'SOLANA' | 'MANUAL' | null;

const TOKEN_KEY = 'hvm_session_token';

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
 * A session that pasted an address rather than signing in has no token, and the
 * server answers 401: that session is read-only, which is the honest outcome.
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
    const [userAddress, setUserAddress] = useState<string | null>(() => localStorage.getItem('hvm_user_address'));
    const [isConnected, setIsConnected] = useState<boolean>(() => localStorage.getItem('hvm_is_connected') === 'true');
    const [authMethod, setAuthMethod] = useState<AuthMethod>(() => localStorage.getItem('hvm_auth_method') as AuthMethod || null);

    const login = (address: string, method: AuthMethod, sessionToken?: string) => {
        setUserAddress(address);
        setIsConnected(true);
        setAuthMethod(method);
        localStorage.setItem('hvm_user_address', address);
        localStorage.setItem('hvm_is_connected', 'true');
        localStorage.setItem('hvm_auth_method', method || '');
        // Pasting an address signs nothing and gets no token, so any token left
        // from an earlier session has to go: it belongs to a different account.
        if (sessionToken) {
            localStorage.setItem(TOKEN_KEY, sessionToken);
        } else {
            localStorage.removeItem(TOKEN_KEY);
        }

        // Dispatch event for legacy compatibility if needed
        window.dispatchEvent(new CustomEvent('wallet_connected', { detail: { address, method } }));
    };

    const logout = () => {
        setUserAddress(null);
        setIsConnected(false);
        setAuthMethod(null);
        localStorage.removeItem('hvm_user_address');
        localStorage.removeItem('hvm_is_connected');
        localStorage.removeItem('hvm_auth_method');
        localStorage.removeItem(TOKEN_KEY);

        window.dispatchEvent(new CustomEvent('wallet_disconnected'));
    };

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
