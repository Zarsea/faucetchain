---
tags: [staking, utxo, vault, defi]
aliases: [Staking, UTXO, Vault]
---

# 🔒 Staking Vault UTXO

> **Backend:** `api_server.py` linhas ~1142-1416
> **Frontend:** `StakingVault.tsx`
> **Contrato:** [[Smart Contracts|UTXOStakingVault.sol]]

---

## Conceito

Cada posição de staking é um **UTXO (Unspent Transaction Output)** com timelock.
O token_id é único e a posição só pode ser gasta uma vez.

---

## Tiers

| Tier | Duração | Yield (bp) | Yield Efetivo |
|---|---|---|---|
| 0 — Curto | 1 hora | 50 | 0.50% |
| 1 — Médio | 24 horas | 200 | 2.00% |
| 2 — Longo | 7 dias | 1000 | 10.00% |

---

## Fluxo: Stake

1. Verificar saldo via [[Fórmula de Saldo]]
2. Criar transação de débito: `from=user → to=VAULT_ADDRESS`
3. Criar posição UTXO em `staking_positions`
4. Saldo do usuário reduz imediatamente

**VAULT_ADDRESS:** `0x537461b696e675661756c740000000000000000`

---

## Fluxo: Unstake

1. Verificar timelock expirado
2. Marcar UTXO como `is_spent = 1`
3. Calcular yield: `deposit_amount × yield_bp / 10000`
4. Criar transação de crédito: `from=VAULT → to=user` com `value = principal + yield`
5. Saldo do usuário restaurado + yield

---

## Proteções

- ❌ Não pode unstake antes do timelock
- ❌ Não pode gastar UTXO já gasto
- ❌ Não pode fazer stake sem saldo suficiente
- ✅ Transação atômica (rollback em caso de erro)

---

## Stats Globais

`GET /api/staking/stats` retorna:
- `totalLocked` — Total travado em $CLAIM
- `activePositions` — UTXOs não gastos
- `totalYieldPaid` — Yield total pago
- `spentPositions` — UTXOs já resgatados

---

Voltar: [[Home]] | [[Tokenomics $CLAIM]]
