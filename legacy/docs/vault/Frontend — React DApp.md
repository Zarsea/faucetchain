---
tags: [frontend, react, vite, ui]
aliases: [Frontend, DApp, Dashboard]
---

# 🖥️ Frontend — React DApp

> **Stack:** React 19 + Vite 6 + TypeScript
> **Porta:** `localhost:5173`
> **Entry:** `App.tsx` → `index.tsx` → `index.html`

---

## Providers (Contextos Globais)

O app é envolvido por 3 providers na seguinte ordem:

```
LanguageProvider → AuthProvider → NetworkProvider → AppContent
```

- [[i18n — Multilíngue]] — `LanguageContext.tsx`
- [[Fluxo de Autenticação]] — `AuthContext.tsx`
- [[WebSocket — Tempo Real]] — `NetworkContext.tsx`

---

## 📄 16 Módulos UI

| Componente | Arquivo | Conecta a |
|---|---|---|
| **UserDashboard** | `UserDashboard.tsx` | [[Fórmula de Saldo]], [[API Endpoints]] |
| **AutoClaim Hub** | `MiningHub.tsx` | [[Mining Node]], [[Epoch Reward System]] |
| **Address Tracker** | `AddressTracker.tsx` | [[Address Tracker]] |
| **Staking Vault** | `StakingVault.tsx` | [[Staking Vault UTXO]] |
| **Bounty Board** | `BountyBoard.tsx` | [[Bounty Board]] |
| **AI Chat Agent** | `AIChatAgent.tsx` | [[Camada de IA]] |
| **Wallet Explorer** | `WalletExplorer.tsx` | [[Banco de Dados — SQLite]] |
| **Network Status** | `NetworkStatus.tsx` | [[WebSocket — Tempo Real]] |
| **Merit Faucet** | `Faucet.tsx` | [[Merit Faucet — Claiming]] |
| **Tokenomics** | `Tokenomics.tsx` | [[Tokenomics $CLAIM]] |
| **Whitepaper** | `Whitepaper.tsx` | — |
| **Technical Specs** | `TechnicalSpecs.tsx` | — |
| **API Docs** | `ApiDocs.tsx` | [[API Endpoints]] |
| **Code Viewer** | `CodeViewer.tsx` | [[Smart Contracts]] |
| **General Article** | `GeneralArticle.tsx` | — |
| **Network Sentinel** | `NetworkSentinel.tsx` | [[Fraud Detector — Sentinel V3]] |

---

## Serviços Frontend

- `services/geminiService.ts` — Conecta ao [[Camada de IA|Google Gemini API]]
- `services/oracleService.ts` — [[Oracle Service — Chainlink]]
- `components/HybridIntelligence.ts` — Merge local + API
- `components/LocalIntelligence.ts` — Fallback rule-based
- `components/KnowledgeBase.ts` — 26K linhas de knowledge embarcado

---

## Configuração

- `apiConfig.ts` — URL centralizada (`VITE_API_URL` ou `localhost:8000`)
- `vite.config.ts` — Build config
- `index.css` — Design system global
- `constants.ts` — Constantes e ABIs

---

## Navegação

O sistema de tabs é controlado pelo componente `Tabs.tsx` com sidebar de 72px.

```
ml-[72px] → conteúdo principal
Tabs.tsx → ícones verticais (hover para expandir)
```

Voltar: [[Home]]
