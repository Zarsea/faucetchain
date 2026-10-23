
import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18nSingleton from 'i18next';

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

// ─── Formato que segue o idioma do app, e nao o do navegador ────────────────
//
// `toLocaleDateString()` sem argumento usa o locale do SISTEMA. Isso ignora o
// seletor de idioma inteiro: alguem lendo em portugues num Chrome instalado em
// ingles via 03/10 e nao tinha como saber se era 3 de outubro ou 10 de marco.
// Data ambigua nao e feiura, e informacao errada.
//
// Nos numeros o efeito e menor mas e o mesmo: 1.695 virando "1,695".
//
// Estes helpers leem `i18n.language` direto, sem hook, porque metade dos
// lugares que formatam esta fora de um componente ou dentro de um `.map` que
// nao tem `lang` por perto. Passar o idioma a trinta e nove chamadas daria o
// mesmo resultado com trinta e nove chances de esquecer uma.
//
// A troca de idioma re-renderiza o provedor e com ele a arvore, entao o
// formato acompanha sem ninguem precisar assinar nada.
const idiomaAtual = () => (i18nSingleton.language as string) || 'en';

/** `tri` para quem não pode chamar o hook.
 *
 * O `tri` do contexto é recriado a cada render do provedor, então pô-lo nas
 * dependências de um `useCallback` faz a função mudar de identidade sempre. No
 * InfrastructureMonitor isso reiniciaria o temporizador de 5 segundos a cada
 * render e a auditoria nunca rodaria — um congelamento silencioso, causado por
 * tentar traduzir.
 *
 * Esta versão lê o idioma na hora da chamada e não participa de dependência
 * nenhuma. O preço é que texto já gerado e guardado em estado continua no
 * idioma de quando foi gerado, até ser gerado de novo.
 */
export const triGlobal = (en: string, pt: string, es?: string) => {
    const l = idiomaAtual();
    return l === 'pt' ? pt : l === 'es' ? (es ?? en) : en;
};

/** Só a data: 23/10/2026, 10/23/2026 ou 23/10/2026, conforme o idioma. */
export const dataLocal = (ms: number) =>
    new Date(ms).toLocaleDateString(localeDoIdioma(idiomaAtual()));

/** Só a hora. */
export const horaLocal = (ms: number) =>
    new Date(ms).toLocaleTimeString(localeDoIdioma(idiomaAtual()));

/** Data e hora juntas. */
export const dataHoraLocal = (ms: number) =>
    new Date(ms).toLocaleString(localeDoIdioma(idiomaAtual()));

/** Número com o separador de milhar do idioma.
 *
 * Aceita nulo e devolve `undefined` porque vários lugares chamavam isto com
 * encadeamento opcional — `infra?.database.blocks?.toLocaleString()` — que
 * curto-circuita quando o dado ainda não chegou e, em JSX, não renderiza nada.
 * Exigir número aqui trocaria esse silêncio por um erro em tela toda vez que a
 * API demorasse.
 */
export const numeroLocal = (n: number | null | undefined,
                            opcoes?: Intl.NumberFormatOptions) =>
    n == null ? undefined : n.toLocaleString(localeDoIdioma(idiomaAtual()), opcoes);

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
