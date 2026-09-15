
import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type Language = 'en' | 'pt' | 'es';

interface LanguageContextType {
    lang: Language;
    setLang: (lang: Language) => void;
    t: any; // We use any here to allow seamless integration without breaking existing strict types
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t, i18n } = useTranslation();
    const lang = (i18n.language as Language) || 'en';

    const setLang = (newLang: Language) => {
        i18n.changeLanguage(newLang);
    };

    // Para evitar crash na tela branca: devolve o json completo para arquivos antigos
    const t_legacy = i18n.getResourceBundle(lang, 'translation') || {};

    const value = {
        lang,
        setLang,
        t: t_legacy,
        tFn: t
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
