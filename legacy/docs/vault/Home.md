---
tags: [home, index]
aliases: [FaucetChain, Início]
---

# 🌐 FaucetChain — Mapa do Ecossistema

> **Blockchain Layer 1 local com consenso híbrido PoC + PoS**
> Token: **$CLAIM** | Supply Cap: **99.000.000**

---

## 🏗️ Arquitetura

| Camada | Link | Porta |
|---|---|---|
| 🖥️ Frontend | [[Frontend — React DApp]] | `:5173` |
| ⚙️ Backend | [[Backend — FastAPI Server]] | `:8000` |
| ⛏️ Minerador | [[Mining Node]] | CLI/Electron |
| 🔗 Contratos | [[Smart Contracts]] | `:8545` |
| 🧠 IA | [[Camada de IA]] | — |
| 🛡️ Segurança | [[Segurança e Anti-Fraude]] | — |

---

## 💰 Economia

- [[Tokenomics $CLAIM]]
- [[Fórmula de Saldo]]
- [[Staking Vault UTXO]]
- [[Epoch Reward System]]
- [[Bounty Board]]

---

## 📡 Rede e Dados

- [[Banco de Dados — SQLite]]
- [[API Endpoints]]
- [[WebSocket — Tempo Real]]
- [[Merkle Proofs]]

---

## 👤 Usuário

- [[Fluxo de Autenticação]]
- [[Merit Faucet — Claiming]]
- [[Transferências Assinadas]]
- [[Address Tracker]]

---

## 📊 Ferramentas

- [[Oracle Service — Chainlink]]
- [[Vector Knowledge Base]]
- [[Fraud Detector — Sentinel V3]]
- [[i18n — Multilíngue]]

---

## 📁 Arquivos Chave

| Arquivo | Descrição |
|---|---|
| `api_server.py` | Backend principal (~2553 linhas) |
| `App.tsx` | Entry point do React |
| `apiConfig.ts` | Configuração de URL centralizada |
| `blockchain.db` | Banco SQLite (~3.7 GB) |
| `miner-core.js` | Engine de mineração |
| `NetworkContext.tsx` | Estado global da rede |
| `AuthContext.tsx` | Contexto de autenticação |
