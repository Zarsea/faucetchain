
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

type AuthMethod = 'GOOGLE' | 'EMAIL' | 'WALLET' | 'MANUAL' | null;

interface AuthContextType {
    userAddress: string | null;
    isConnected: boolean;
    authMethod: AuthMethod;
    login: (address: string, method: AuthMethod) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [userAddress, setUserAddress] = useState<string | null>(() => localStorage.getItem('hvm_user_address'));
    const [isConnected, setIsConnected] = useState<boolean>(() => localStorage.getItem('hvm_is_connected') === 'true');
    const [authMethod, setAuthMethod] = useState<AuthMethod>(() => localStorage.getItem('hvm_auth_method') as AuthMethod || null);

    const login = (address: string, method: AuthMethod) => {
        setUserAddress(address);
        setIsConnected(true);
        setAuthMethod(method);
        localStorage.setItem('hvm_user_address', address);
        localStorage.setItem('hvm_is_connected', 'true');
        localStorage.setItem('hvm_auth_method', method || '');

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
