---
tags: [tracker, watchlist, address, monitoring]
aliases: [Tracker, Watchlist, Monitoramento]
---

# 📍 Address Tracker

> **Frontend:** `AddressTracker.tsx`
> **Backend:** `api_server.py` linhas ~2116-2366

---

## Funcionalidade

Watchlist de endereços com categorização e monitoramento de atividade.

---

## Categorias

| Categoria | Descrição |
|---|---|
| `user` | Usuários comuns |
| `miner` | Mineradores (auto-detectado) |
| `hub` | Hubs e contratos |
| `custom` | Categoria personalizada |

> Se o endereço é encontrado em `active_miners`, a categoria é auto-setada para `miner`.

---

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/tracker/addresses` | Listar (filtro por categoria) |
| `POST` | `/api/tracker/addresses` | Adicionar à watchlist |
| `DELETE` | `/api/tracker/addresses/{addr}` | Remover |
| `GET` | `/api/tracker/addresses/{addr}/activity` | Atividade completa |
| `GET` | `/api/tracker/summary` | Resumo por categoria |

---

## Activity Endpoint

`GET /api/tracker/addresses/{addr}/activity` retorna:
- **transactions** — Últimas TXs (from/to)
- **claims** — Claims do [[Merit Faucet — Claiming]]
- **mining_rewards** — Rewards do [[Epoch Reward System]]
- **staking_positions** — Posições do [[Staking Vault UTXO]]

---

## Enriquecimento

Ao listar endereços, o backend enriquece com dados de mineração:
- `is_miner` — Booleano
- `miner_online` — Status atual
- `miner_earned` — Total ganho
- `miner_uptime` — Uptime total
- `miner_name` — Nome do nó

---

Voltar: [[Home]]
