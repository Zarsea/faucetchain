---
tags: [vector, chromadb, embeddings, knowledge]
aliases: [VectorDB, ChromaDB, Knowledge Base]
---

# 📚 Vector Knowledge Base

> **Arquivo:** `VectorKnowledgeBase.py`
> **Stack:** ChromaDB + SentenceTransformers (all-MiniLM-L6-v2)
> **Diretório:** `knowledge_db/`
> **Dimensão:** 384-dim embeddings

---

## Funcionalidades

- **Busca Semântica** — Encontra documentos por significado, não apenas keywords
- **Batch Indexing** — Adiciona múltiplos docs eficientemente
- **Blockchain Indexing** — Indexa blocos e transações automaticamente
- **Metadata Filtering** — Filtra por categoria, tipo, etc.

---

## API Endpoints

| Rota | Descrição |
|---|---|
| `POST /api/vector-search` | Busca semântica (top_k, filter) |
| `POST /api/add-document` | Adicionar documento |

Ver [[API Endpoints]]

---

## Categorias Indexadas

| Categoria | Exemplos |
|---|---|
| `consensus` | Hybrid PoC+PoS, BLS signatures |
| `validators` | Merit weight, staking requirements |
| `tokenomics` | Supply, halving, gas fees |
| `security` | Fraud detection, MEV protection |
| `faucet` | Claiming, cooldowns |
| `development` | ERC-20, Hardhat, MetaMask |
| `governance` | Voting, upgrades |
| `blockchain_data` | Blocos e TXs indexados |

---

## Seed Data

20 documentos pré-carregados sobre:
- Consenso híbrido
- Merit Weight formula
- Token supply (21M com halving)
- Fraud detection (Sentinel V3)
- Validator bonuses
- Gas fees (EIP-1559)
- Hardware requirements
- DeFi protocols

---

## Integração com Sentinel

O [[Fraud Detector — Sentinel V3|SentinelV3Engine]] pode absorver dados da chain:

```python
engine.absorb_chain_data("blockchain.db", limit=100)
# → Indexa blocos e transações como documentos semânticos
```

---

Voltar: [[Home]] | [[Camada de IA]]
