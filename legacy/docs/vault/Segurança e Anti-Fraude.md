---
tags: [security, fraud, sybil, sentinel]
aliases: [Segurança, Security, Anti-Fraude]
---

# 🛡️ Segurança e Anti-Fraude

> Múltiplas camadas de proteção em toda a stack.

---

## Rate Limiting

```python
RATE_LIMIT_MAX_REQUESTS = 100   # por janela
RATE_LIMIT_WINDOW = 1 minuto
```

- Localhost isento (minerador + frontend dev)
- Per-IP tracking em memória
- Mining explore: 10s min entre chamadas por node_id

---

## Input Sanitization

```python
def sanitize_input(text):
    # Remove <script> tags
    # Remove SQL injection patterns (DROP, DELETE, UNION SELECT)
    # Limita a 1000 caracteres
```

Aplicado em: queries de busca, conteúdo de documentos, títulos de bounties.

---

## Signature Verification (EIP-191)

Ver [[Transferências Assinadas]] para detalhes completos.

- Chain ID tagado na assinatura
- Nonce sequencial obrigatório
- Recuperação de endereço via `eth_account`

---

## [[Fraud Detector — Sentinel V3]]

### FraudDetector
Detecta padrões Sybil via:
1. **Análise Temporal** — Claims muito rápidos (< 60s)
2. **Uniformidade de Gas** — Gas prices idênticos em série
3. **Compressão de Padrões** — zlib compression ratio > 0.75 = repetitivo

### BonusCalculator
Calcula multiplicadores DeFi (1.0x - 2.5x):
- 30% Liquidez fornecida
- 20% Diversidade de protocolos
- 30% Volume de transações
- 20% Uptime

### SentinelV3Engine
Motor combinado:
- `audit_node()` → VERIFIED / FLAGGED / BANNED
- `absorb_chain_data()` → Indexa blocos/TXs no [[Vector Knowledge Base]]
- `get_network_health_report()` → Saúde global

---

## Anti-Sybil Mining

```python
max_nodes_per_wallet = 3    # Máximo 3 nós por carteira
heartbeat_timeout = 90       # Offline se sem heartbeat por 90s
min_heartbeat_gap = 10       # Rate limit entre heartbeats
```

---

## Audit Logging

Todos os eventos sensíveis são logados em `vector_db_audit.log`:
- `SEARCH_QUERY`, `TRANSFER`, `CLAIM_SUBMITTED`
- `FRAUD_DETECTED`, `STAKE_CREATED`, `STAKE_WITHDRAWN`
- `RATE_LIMIT_EXCEEDED`, `CLAIM_EXPLORED`

---

## Sensitive Data Filter

```python
SENSITIVE_PATTERNS = [
    r'0x[a-fA-F0-9]{64}',  # Private keys
    r'sk_...',               # API keys
    r'pk_...',               # Private keys
]
```

Bloqueio automático de documentos contendo chaves privadas no [[Vector Knowledge Base]].

---

Voltar: [[Home]]
