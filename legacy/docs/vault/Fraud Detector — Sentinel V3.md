---
tags: [fraud, sentinel, ml, detection]
aliases: [FraudDetector, Sentinel V3]
---

# 🔍 Fraud Detector — Sentinel V3

> **Arquivo:** `FraudAndBonusDetector.py`
> **Classes:** FraudDetector, BonusCalculator, SentinelV3Engine

---

## FraudDetector

Detecta padrões indicativos de **Sybil Attack** e **claim farming**.

### Indicadores:

| Check | Critério | Resultado |
|---|---|---|
| Temporal | Claims < 60s apart | 🚫 Sybil |
| Gas Uniformity | Range < 0.5 em 5+ claims | 🚫 Sybil |
| Pattern Compression | zlib ratio > 0.75 | 🚫 Sybil |

### Compression-Based Detection

```python
compressed = zlib.compress(pattern_string.encode())
ratio = len(compressed) / len(pattern_string)
similarity = 1.0 - ratio  # Alta compressão = altamente repetitivo
```

Se `similarity > 0.75` → **FLAGGED**

---

## BonusCalculator

Calcula multiplicadores para validadores baseado em atividade DeFi:

```
bonus = liquidity(30%) + protocols(20%) + volume(30%) + uptime(20%)
final = base(1.0) + bonus, max 2.5x
```

---

## SentinelV3Engine

Motor principal que combina detecção + bonus:

```python
result = engine.audit_node(node_data)
# → {status: "VERIFIED"|"FLAGGED"|"BANNED", final_multiplier, fraud_score}
```

### Chain Data Absorption
```python
engine.absorb_chain_data("blockchain.db", limit=100)
# Indexa blocos e transações no Vector Knowledge Base
```

Ver também: [[Vector Knowledge Base]], [[Camada de IA]]

---

Voltar: [[Home]] | [[Segurança e Anti-Fraude]]
