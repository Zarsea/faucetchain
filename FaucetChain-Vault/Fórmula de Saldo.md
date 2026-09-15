---
tags: [balance, formula, economy]
aliases: [Saldo, Balance]
---

# 📊 Fórmula de Saldo

> **Endpoint:** `GET /api/user/{address}/balance`
> **Localização:** `api_server.py` → `get_user_balance()`

---

## Fórmula

```
Balance = claims_total + mining_total + incoming_transfers - outgoing_transfers
```

| Componente | Fonte | Tabela |
|---|---|---|
| `claims_total` | [[Merit Faucet — Claiming]] | `SUM(user_claims.amount)` |
| `mining_total` | [[Epoch Reward System]] + fees | `SUM(mining_rewards.reward_amount)` |
| `incoming_transfers` | Recebidos + unstake payouts | `SUM(transactions.value) WHERE to_address = user` |
| `outgoing_transfers` | Enviados + stake locks | `SUM(transactions.value) WHERE from_address = user` |

---

## Como o Staking Afeta o Saldo

### Ao fazer Stake:
```
INSERT transactions (from=user, to=VAULT_ADDRESS, value=amount)
→ outgoing_transfers ↑ → balance ↓
```

### Ao fazer Unstake:
```
INSERT transactions (from=VAULT_ADDRESS, to=user, value=principal+yield)
→ incoming_transfers ↑ → balance ↑
```

**VAULT_ADDRESS:** `0x537461b696e675661756c740000000000000000`

Ver: [[Staking Vault UTXO]]

---

## Resposta da API

```json
{
  "address": "0x84da...",
  "claims_total": 500.0,
  "mining_total": 2000.0,
  "yields_total": 0,
  "incoming_total": 150.0,
  "outgoing_total": 100.0,
  "total_claim": 2550.0
}
```

> ⚠️ `yields_total` é mantido em 0 porque já está incluído em `incoming_total` via transação de unstake.

---

Voltar: [[Home]] | [[Tokenomics $CLAIM]]
