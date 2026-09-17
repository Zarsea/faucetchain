---
tags: [api, endpoints, rest, http]
aliases: [API, Endpoints, Rotas]
---

# 📡 API Endpoints

> Servidor: [[Backend — FastAPI Server]]
> Base URL: `http://localhost:8000`
> Swagger Docs: `http://localhost:8000/docs`

---

## Core

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/blocks` | Blocos recentes (limit=20) |
| `GET` | `/api/tx/{hash}` | Detalhes de transação |
| `GET` | `/api/network-metrics` | Métricas completas |
| `WS` | `/ws/network` | [[WebSocket — Tempo Real]] |

---

## Faucet & Claims → [[Merit Faucet — Claiming]]

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/claim` | Submeter claim (cooldown 1h) |
| `GET` | `/api/claim/status/{hash}` | Status: pending/confirmed |
| `GET` | `/api/user/{addr}/claims` | Histórico de claims |
| `GET` | `/api/user/{addr}/balance` | [[Fórmula de Saldo]] |

---

## Transfers → [[Transferências Assinadas]]

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/transfer` | Transferir $CLAIM (assinado EIP-191) |
| `GET` | `/api/user/{addr}/nonce` | Nonce atual |
| `GET` | `/api/address/{addr}/transactions` | Histórico de TXs |

---

## Mining → [[Mining Node]]

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/mining/register` | Registrar nó |
| `POST` | `/api/mining/heartbeat` | Heartbeat (30s) |
| `POST` | `/api/mining/explore` | Explorar claims pendentes |
| `POST` | `/api/mining/disconnect` | Desconectar |
| `POST` | `/api/mining/distribute-epoch` | Trigger manual de epoch |
| `GET` | `/api/mining/stats` | Stats globais |
| `GET` | `/api/mining/leaderboard` | Ranking |
| `GET` | `/api/mining/node/{addr}` | Info dos nós |
| `GET` | `/api/mining/rewards/{addr}` | Histórico de rewards |

---

## Staking → [[Staking Vault UTXO]]

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/staking/stake` | Criar posição UTXO |
| `POST` | `/api/staking/unstake` | Resgatar (após timelock) |
| `GET` | `/api/staking/positions/{addr}` | Posições do usuário |
| `GET` | `/api/staking/stats` | Stats globais |

---

## Bounties → [[Bounty Board]]

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/bounties/create` | Criar bounty |
| `POST` | `/api/bounties/{id}/claim` | Aceitar bounty |
| `POST` | `/api/bounties/{id}/approve` | Aprovar (creator) |
| `POST` | `/api/bounties/{id}/cancel` | Cancelar |
| `GET` | `/api/bounties/list` | Listar (filtro por status) |
| `GET` | `/api/bounties/user/{addr}` | Por usuário |
| `GET` | `/api/bounties/stats` | Estatísticas |

---

## Tracker → [[Address Tracker]]

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/tracker/addresses` | Listar watchlist |
| `POST` | `/api/tracker/addresses` | Adicionar |
| `DELETE` | `/api/tracker/addresses/{addr}` | Remover |
| `GET` | `/api/tracker/addresses/{addr}/activity` | Atividade completa |
| `GET` | `/api/tracker/summary` | Resumo por categoria |

---

## Auth → [[Fluxo de Autenticação]]

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/register` | Registro (email → wallet custodial) |
| `POST` | `/api/auth/login` | Login (email + senha) |

---

## AI & Knowledge → [[Camada de IA]]

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/ai/sentinel` | Sentinel AI (Gemini + dados L1) |
| `POST` | `/api/vector-search` | Busca semântica ChromaDB |
| `POST` | `/api/add-document` | Adicionar doc ao knowledge base |

---

## Merkle → [[Merkle Proofs]]

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/epoch/{id}/root` | Merkle root do epoch |
| `GET` | `/api/blocks/{height}/merkle-proof` | Prova de inclusão |

---

## L1 V3 State

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/epoch/status` | Status do epoch atual |
| `GET` | `/api/vault/yield` | Yield do vault externo |
| `GET` | `/api/faucets/staked` | DApps com stake |

---

Voltar: [[Home]]
