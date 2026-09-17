---
tags: [merkle, proof, verification, cryptography]
aliases: [Merkle, Proofs, Verificação]
---

# 🌳 Merkle Proofs

> **Backend:** `api_server.py` linhas ~134-623
> **Contrato:** [[Smart Contracts|HubRegistryRoots.sol]]

---

## Conceito

Provas criptográficas de inclusão de blocos em epochs da chain.

```
leafHash = keccak256(bytes32(blockHash))
parent = keccak256(left || right)
```

---

## Endpoints

### Epoch Root
```
GET /api/epoch/{epoch_id}/root?epoch_size=128
```
- Calcula Merkle root de todos os blocos no epoch
- Cache em tabela `epoch_roots`

### Block Proof
```
GET /api/blocks/{height}/merkle-proof?epoch_size=128
```
Retorna:
- `blockHash` — Hash do bloco
- `leafHash` — keccak256(blockHash)
- `root` — Merkle root do epoch
- `siblings` — Array de siblings para verificação
- `index` — Posição da folha na árvore

---

## Verificação

O Explorer pode verificar a prova recalculando:

```
Dado: leafHash, siblings[], index
Para cada sibling:
  if index é par: hash = keccak256(current || sibling)
  if index é ímpar: hash = keccak256(sibling || current)
  index = index / 2
Se hash final == root → VERIFICADO ✅
```

---

## Anchoring On-Chain

O contrato `HubRegistryRoots.sol` armazena os Merkle roots on-chain para verificação permanente e imutável.

---

Voltar: [[Home]] | [[Smart Contracts]]
