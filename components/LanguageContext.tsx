
import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type Language = 'en' | 'pt' | 'es';

interface LanguageContextType {
    lang: Language;
    setLang: (lang: Language) => void;
    t: any; // We use any here to allow seamless integration without breaking existing strict types
    tri: (en: string, pt: string, es?: string) => string;
    locale: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// `lang === 'pt' ? 'pt-BR' : 'en-US'` estava copiado em quatro arquivos, e os
// quatro mandavam o espanhol para o formato americano: 1.695 virava "1,695".
// Exportado solto porque quem formata numero costuma ser funcao de modulo, fora
// do componente, onde nao da para chamar o hook.
export const localeDoIdioma = (lang: string) =>
    lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t, i18n } = useTranslation();
    const lang = (i18n.language as Language) || 'en';

    const setLang = (newLang: Language) => {
        i18n.changeLanguage(newLang);
    };

    // Para evitar crash na tela branca: devolve o json completo para arquivos antigos
    const t_legacy = i18n.getResourceBundle(lang, 'translation') || {};

    // O espanhol saiu do seletor em 21/10/2026 porque dezesseis componentes
    // escolhiam texto com `lang === 'pt' ? a : b`, e um ternario binario nao tem
    // terceiro ramo: quem pedisse ES recebia portugues achando que era espanhol.
    //
    // `tri` e esse mesmo ternario com o ramo que faltava. Converter uma chamada
    // custa uma linha e nao inventa chave nenhuma.
    //
    // `es` e opcional de proposito, para a conversao poder ser feita aos poucos:
    // uma chamada ja convertida mas ainda sem espanhol cai no INGLES, que e
    // exatamente o que acontecia antes dela. O que nunca mais acontece e
    // devolver portugues no lugar do espanhol, que era a mentira silenciosa.
    const tri = (en: string, pt: string, es?: string) =>
        lang === 'pt' ? pt : lang === 'es' ? (es ?? en) : en;

    // Mesma historia para numero e data, via o helper exportado acima.
    const locale = localeDoIdioma(lang);

    const value = {
        lang,
        setLang,
        t: t_legacy,
        tFn: t,
        tri,
        locale
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
