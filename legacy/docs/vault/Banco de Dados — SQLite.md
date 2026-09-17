---
tags: [database, sqlite, schema, data]
aliases: [SQLite, Database, DB]
---

# 💾 Banco de Dados — SQLite

> **Arquivo:** `blockchain.db` (~3.7 GB)
> **Modo:** WAL (Write-Ahead Logging) para concorrência
> **Conexão:** `sqlite3.connect('blockchain.db')`

---

## 12 Tabelas

### blocks
| Coluna | Tipo | Descrição |
|---|---|---|
| `height` | INTEGER PK | Altura do bloco |
| `hash` | TEXT UNIQUE | Hash SHA-256 do bloco |
| `parent_hash` | TEXT | Hash do bloco anterior |
| `validator` | TEXT | Endereço do minerador |
| `tx_count` | INTEGER | Quantidade de TXs |
| `timestamp` | INTEGER | Unix timestamp |
| `gas_used` | INTEGER | Gas utilizado |
| `gas_limit` | INTEGER | Gas limit |
| `reward` | REAL | Recompensa do bloco |

Criado por: [[Mining Node]] (explore), `indexer_service.py`

---

### transactions
| Coluna | Tipo | Descrição |
|---|---|---|
| `hash` | TEXT PK | Hash da transação |
| `block_height` | INTEGER FK | Ref → blocks |
| `from_address` | TEXT | Remetente |
| `to_address` | TEXT | Destinatário |
| `value` | REAL | Valor em $CLAIM |
| `gas_price` | INTEGER | Preço do gas |
| `timestamp` | INTEGER | Unix timestamp |
| `tx_type` | TEXT | CLAIM, MINING_FEE, TRANSFER |
| `source_platform` | TEXT | WEB3, API |

Usada por: [[Fórmula de Saldo]], [[Transferências Assinadas]], [[Staking Vault UTXO]]

---

### user_claims
Claims confirmados do [[Merit Faucet — Claiming]].
- `user_address`, `amount`, `timestamp`, `tx_hash`, `block_height`, `source_platform`

### pending_claims
Claims aguardando processamento pelo [[Mining Node]].
- Status: `pending` → processado pelo explore → movido para `user_claims`

### active_miners
Nós de mineração registrados. Ver [[Mining Node]].
- `node_id` PK, `wallet_address`, `total_uptime_seconds`, `epoch_uptime_seconds`, `total_earned`, `is_online`

### mining_rewards
Histórico de recompensas distribuídas pelo [[Epoch Reward System]].
- `epoch_id`, `wallet_address`, `node_id`, `reward_amount`, `uptime_share`

### staking_positions
Posições UTXO do [[Staking Vault UTXO]].
- `token_id` PK, `staker_address`, `deposit_amount`, `tier`, `is_spent`, `yield_paid`

### bounties
Recompensas comunitárias do [[Bounty Board]].
- Status: OPEN → CLAIMED → COMPLETED / CANCELLED

### users
Sistema de autenticação. Ver [[Fluxo de Autenticação]].
- `email` UNIQUE, `password_hash` (SHA-256), `wallet_address` (custodial)

### tracked_addresses
Watchlist do [[Address Tracker]].
- `address` UNIQUE, `label`, `category` (user/miner/hub/custom)

### account_nonces
Proteção contra replay. Ver [[Transferências Assinadas]].
- `address` PK, `nonce` (sequencial)

### epoch_roots
Cache de raízes Merkle. Ver [[Merkle Proofs]].
- `epoch_id` + `epoch_size` = PK composta

---

## Índices Importantes

Índices criados em `add_indexes.py` para otimizar queries no DB de 3.7 GB:
- `transactions(from_address)`, `transactions(to_address)`, `transactions(timestamp)`
- `user_claims(user_address)`
- `mining_rewards(wallet_address)`

---

Voltar: [[Home]]
