---
tags: [backend, fastapi, python, api]
aliases: [Backend, API Server, FastAPI]
---

# ⚙️ Backend — FastAPI Server

> **Arquivo:** `api_server.py` (~2553 linhas)
> **Stack:** FastAPI + Uvicorn + SQLite
> **Porta:** `localhost:8000`
> **Docs:** `localhost:8000/docs` (Swagger UI)

---

## Startup Events

Na inicialização, o servidor:

1. Carrega [[Vector Knowledge Base]] (ChromaDB + SentenceTransformers)
2. Carrega [[Fraud Detector — Sentinel V3]]
3. Inicializa tabelas no [[Banco de Dados — SQLite]]
4. Inicia o [[Epoch Reward System|Epoch Scheduler]] (async task)
5. Configura CORS (`ALLOWED_ORIGINS`)

---

## Módulos Principais

### Core Network
- `GET /api/health` — Health check
- `GET /api/blocks` — Blocos recentes
- `GET /api/tx/{hash}` — Detalhes de transação
- `GET /api/network-metrics` — Métricas da rede
- [[WebSocket — Tempo Real]] — `WS /ws/network`

Detalhes completos: [[API Endpoints]]

---

### Sistemas Integrados

| Sistema | Seção no código | Link |
|---|---|---|
| Merit Faucet | Linhas ~954-1018 | [[Merit Faucet — Claiming]] |
| Mining Network | Linhas ~1700-2110 | [[Mining Node]], [[Epoch Reward System]] |
| Staking Vault | Linhas ~1142-1416 | [[Staking Vault UTXO]] |
| Bounty Board | Linhas ~1418-1698 | [[Bounty Board]] |
| Address Tracker | Linhas ~2116-2366 | [[Address Tracker]] |
| Auth System | Linhas ~2400-2473 | [[Fluxo de Autenticação]] |
| Sentinel AI | Linhas ~2476-2548 | [[Camada de IA]] |
| Transfers | Linhas ~725-795 | [[Transferências Assinadas]] |
| Merkle Proofs | Linhas ~520-623 | [[Merkle Proofs]] |

---

## Segurança Integrada

- **Rate Limiting** — 100 req/min por IP (localhost isento)
- **Input Sanitization** — Anti SQL injection + XSS
- **Audit Logging** — Todos os eventos em `vector_db_audit.log`
- **Fraud Detection** — [[Fraud Detector — Sentinel V3]]
- **Signature Verification** — EIP-191 em [[Transferências Assinadas]]

Detalhes: [[Segurança e Anti-Fraude]]

---

## Frontend Serving

Se a pasta `dist/` existir, o servidor serve o frontend buildado:
```python
app.mount("/assets", StaticFiles(directory="dist/assets"))
# Catch-all → dist/index.html (SPA fallback)
```

---

Voltar: [[Home]]
