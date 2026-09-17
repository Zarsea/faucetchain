---
tags: [oracle, chainlink, prices, external]
aliases: [Oracle, Chainlink, Preços]
---

# 📈 Oracle Service — Chainlink

> **Arquivo:** `services/oracleService.ts`
> **Fonte:** CryptoCompare API (proxy para Chainlink feeds)
> **Cache:** 60s TTL em memória

---

## Pairs Suportados

| Par | Feed Chainlink (Mainnet) |
|---|---|
| ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` |
| BTC/USD | `0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88b` |
| BNB/USD | `0x14e613AC84a31f709eadbEF3cef7651D5C243500` |
| MATIC/USD | `0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c1a57a95` |
| LINK/USD | `0x2c1d072e956AFFC0D435Cb7AC308d97936Ed4051` |
| SOL/USD | `0x4ffC43a60e009B551865A93d232E33Fce9f01507` |

---

## Arquitetura

```
Frontend (OracleService)
    → CryptoCompare REST API (5s timeout)
    → Cache hit? Retorna cached (60s TTL)
    → Falha? Retorna mock prices (10s TTL)
```

### Funções exportadas:
- `fetchOraclePrice(pair)` — Single price with cache
- `fetchMultipleOraclePrices(pairs[])` — Batch fetch
- `clearOracleCache()` — Force refresh
- `getCachedPrices()` — Retorna cache atual

---

## Mock Fallback

Preços estáticos de emergência quando a API está indisponível:

| Par | Mock Price |
|---|---|
| ETH/USD | $3,421.50 |
| BTC/USD | $67,850.00 |
| SOL/USD | $178.60 |

Cache de mock dura apenas 10s para retry mais rápido.

---

## Uso

Usado pelo [[Frontend — React DApp|Tokenomics]] para exibir preços em tempo real.

---

Voltar: [[Home]]
