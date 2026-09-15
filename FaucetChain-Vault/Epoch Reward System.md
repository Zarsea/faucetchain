---
tags: [epoch, rewards, mining, distribution]
aliases: [Epoch, Rewards, Distribuição]
---

# ⏰ Epoch Reward System

> **Duração do Epoch:** 1 hora (3600 segundos)
> **Reward por Epoch:** 2.000 $CLAIM
> **Scheduler:** Async task em `api_server.py`

---

## Como Funciona

1. O [[Backend — FastAPI Server]] inicia o `epoch_scheduler()` no startup
2. A cada **1 hora**, executa `_distribute_epoch()`
3. Seleciona todos os [[Mining Node|mineradores]] online com `epoch_uptime > 0`
4. Calcula a **share proporcional** ao uptime de cada nó
5. Distribui 2.000 CLAIM proporcionalmente
6. Reseta `epoch_uptime_seconds` para 0

---

## Fórmula de Distribuição

```python
share = node.epoch_uptime_seconds / total_epoch_uptime
reward = 2000.0 * share
```

### Exemplo com 2 mineradores:

| Nó | Epoch Uptime | Share | Reward |
|---|---|---|---|
| Node-A | 3000s | 75% | 1.500 CLAIM |
| Node-B | 1000s | 25% | 500 CLAIM |

---

## Acúmulo de Uptime

O uptime é acumulado via [[Mining Node|heartbeats]]:

```python
uptime_gained = min(time_since_last_heartbeat, heartbeat_timeout)  # max 90s
epoch_uptime_seconds += uptime_gained
total_uptime_seconds += uptime_gained
```

- Heartbeat a cada **30s**
- Timeout: **90s** (nó marcado offline se não enviar heartbeat)

---

## Dados Persistidos

Tabela `mining_rewards` no [[Banco de Dados — SQLite]]:
- `epoch_id` — Sequencial auto-incrementado
- `wallet_address` — Quem recebeu
- `node_id` — Qual nó
- `reward_amount` — Quanto recebeu
- `uptime_share` — % do epoch uptime

---

## Trigger Manual

```
POST /api/mining/distribute-epoch
```

Pode ser chamado manualmente, além do scheduler automático.

---

Voltar: [[Home]] | [[Mining Node]]
