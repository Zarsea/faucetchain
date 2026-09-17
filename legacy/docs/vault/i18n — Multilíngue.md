---
tags: [i18n, language, translation, localization]
aliases: [Tradução, Idiomas, Localização]
---

# 🌍 i18n — Multilíngue

> **Arquivo:** `i18n.ts` (~23K linhas)
> **Stack:** i18next + react-i18next
> **Idiomas:** Português (PT-BR), English (EN), Español (ES)

---

## Configuração

```typescript
// LanguageContext.tsx
<LanguageProvider>  // Wrapper mais externo
    <AuthProvider>
        <NetworkProvider>
            <AppContent />
```

---

## Uso nos Componentes

```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
return <h1>{t('dashboard.title')}</h1>;
```

---

## Troca de Idioma

Via `Header.tsx` — Seletor de idioma com bandeiras.

Suporte completo em:
- [[Frontend — React DApp|UserDashboard]]
- [[Staking Vault UTXO|StakingVault]]
- [[Frontend — React DApp|Tokenomics]]
- E todos os demais componentes

---

Voltar: [[Home]] | [[Frontend — React DApp]]
