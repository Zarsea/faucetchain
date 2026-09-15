---
tags: [bounty, community, rewards]
aliases: [Bounties, Recompensas]
---

# 🏆 Bounty Board

> **Frontend:** `BountyBoard.tsx`
> **Backend:** `api_server.py` linhas ~1418-1698
> **Contrato:** [[Smart Contracts|CommunityBountyBoard.sol]]

---

## Estados

```
OPEN → CLAIMED → COMPLETED
                → CANCELLED (se expirado)
OPEN → CANCELLED (pelo criador)
```

---

## Fluxo

1. **Criar** — `POST /api/bounties/create`
   - Criador define título, descrição, reward, duração
   - Status: OPEN

2. **Aceitar** — `POST /api/bounties/{id}/claim`
   - Hunter aceita a bounty
   - Não pode ser o criador
   - Status: CLAIMED

3. **Aprovar** — `POST /api/bounties/{id}/approve`
   - Criador aprova o trabalho
   - Reward liberado ao hunter
   - Status: COMPLETED

4. **Cancelar** — `POST /api/bounties/{id}/cancel`
   - Criador cancela (se OPEN ou CLAIMED+expirado)
   - Reward devolvido
   - Status: CANCELLED

---

## Stats

`GET /api/bounties/stats`:
- `totalBounties`, `openBounties`, `completedBounties`
- `lockedRewards` — $CLAIM travados em bounties ativas
- `paidRewards` — $CLAIM pagos em bounties completadas

---

Voltar: [[Home]] | [[Tokenomics $CLAIM]]
