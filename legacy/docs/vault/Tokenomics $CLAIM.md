---
tags: [tokenomics, economy, claim, supply]
aliases: [Token, $CLAIM, Economia]
---

# 💰 Tokenomics $CLAIM

> **Token:** $CLAIM
> **Tipo:** ERC-20
> **Hard Cap:** 99.000.000 tokens
> **Contrato:** [[Smart Contracts|FaucetToken_CLAIM.sol]]

---

## Fontes de Emissão

| Fonte | Mecanismo | Link |
|---|---|---|
| Merit Faucet | Claim com cooldown 1h | [[Merit Faucet — Claiming]] |
| Mining Rewards | 2.000 CLAIM/epoch (1h) | [[Epoch Reward System]] |
| Mining Fees | 20% de cada claim processado | [[Mining Node]] |
| Staking Yield | 0.5% a 10% por tier | [[Staking Vault UTXO]] |

---

## Reward Decay

A recompensa do faucet decai logaritmicamente:

```python
current_reward = max(0.5, 10.0 - math.log1p(total_claims) * 0.8)
```

- Começa em **10.0 CLAIM** por claim
- Decai suavemente com o número total de claims
- Mínimo: **0.5 CLAIM**

---

## Circulação

O supply circulante é calculado pela função `get_total_circulating_supply()`:

```python
circulating = SUM(user_claims.amount) + SUM(mining_rewards.reward_amount)
```

Verificado antes de cada claim: se `circulating + amount > 99_000_000`, o claim é rejeitado.

---

## [[Fórmula de Saldo]]

O saldo individual agrega:
- ✅ Claims (merit faucet)
- ✅ Mining rewards (epoch + fees)
- ✅ Incoming transfers
- ❌ Outgoing transfers
- ❌ Staked amounts (locked)

---

## Gas Fees

- Rede local: **0 gas** para claims
- Transfers assinados: 0 gas (sem custo real)
- Design EIP-1559: 50% burn + 50% validadores (planejado)

---

Voltar: [[Home]]
