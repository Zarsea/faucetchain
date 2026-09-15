---
tags: [faucet, claim, merit]
aliases: [Faucet, Claim, Merit]
---

# 🚰 Merit Faucet — Claiming

> **Frontend:** `Faucet.tsx`
> **Backend:** `POST /api/claim`
> **Cooldown:** 1 hora por carteira

---

## Fluxo Completo

```
Usuário → POST /api/claim → Cooldown Check → Fraud Check → pending_claims
                                                                 ↓
                                                      Mining Node (explore)
                                                                 ↓
                                                    user_claims + block + 2 txs
```

### 1. Submissão
- Usuário submete claim com `address`, `amount`, `block_height`, `tx_hash`
- API verifica cooldown de 1h (último claim/pending)
- [[Fraud Detector — Sentinel V3]] analisa padrões Sybil
- Se aprovado: `INSERT INTO pending_claims (status='pending')`

### 2. Processamento (pelo minerador)
- [[Mining Node]] faz `POST /api/mining/explore` a cada 5s
- Pega 1 pending claim
- Distribui: **80% para o usuário**, **20% para o minerador**
- Cria novo bloco na chain
- Move claim para `user_claims`

### 3. Confirmação
- `GET /api/claim/status/{tx_hash}` retorna `pending` ou `confirmed`

---

## Reward Decay

```python
reward = max(0.5, 10.0 - math.log1p(total_claims) * 0.8)
```

A recompensa diminui gradualmente conforme mais claims são feitos na rede.

---

## Proteções

- ⏱️ Cooldown de 1 hora por wallet
- 🛡️ [[Fraud Detector — Sentinel V3|Sybil detection]] em claims recentes
- 📊 Rate limiting por IP (100 req/min)
- 💰 Hard cap de [[Tokenomics $CLAIM|99M tokens]]

---

## Modos de Login para Claim

Via [[Fluxo de Autenticação]]:
- **MetaMask** — Assinatura EIP-191 (mais seguro)
- **Email** — Wallet custodial (bypass de assinatura)
- **Manual** — Inserir endereço (bypass de assinatura)

---

Voltar: [[Home]] | [[Tokenomics $CLAIM]]
