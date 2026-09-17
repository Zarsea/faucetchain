---
tags: [transfer, signature, security, nonce]
aliases: [Transfer, Transferência, EIP-191]
---

# ✍️ Transferências Assinadas

> **Endpoint:** `POST /api/transfer`
> **Segurança:** EIP-191 + Chain ID + Nonce sequencial

---

## Payload Assinado

```
"{CHAIN_ID}:{nonce}:{sender}:{receiver}:{amount}"
```

Exemplo: `"999:1:0xabc...:0xdef...:100.0"`

---

## Fluxo

1. **Obter Nonce** — `GET /api/user/{addr}/nonce`
2. **Construir payload** — `{CHAIN_ID}:{nonce+1}:{from}:{to}:{amount}`
3. **Assinar com MetaMask** — `personal_sign` (EIP-191)
4. **Enviar** — `POST /api/transfer` com `{sender, receiver, amount, nonce, signature}`

---

## Validações (Backend)

```python
# 1. Nonce sequencial
if req.nonce != current_nonce + 1:
    raise "Invalid Nonce"

# 2. Verificação de assinatura
message = encode_defunct(text=payload_str)
recovered_addr = Account.recover_message(message, signature=req.signature)
if recovered_addr != sender:
    raise "Signature mismatch"

# 3. Saldo suficiente
balance = get_user_balance(sender)
if balance < amount:
    raise "Insufficient balance"

# 4. Hash determinístico
tx_hash = keccak256(payload_str)
```

---

## Proteções

| Ataque | Proteção |
|---|---|
| Replay Attack | Chain ID + Nonce sequencial |
| Falsificação | EIP-191 signature verification |
| Double Spend | Nonce incremento atômico |
| Saldo negativo | Balance check pré-transfer |

---

## Tabelas Envolvidas

- `account_nonces` — Controle de nonce por endereço
- `transactions` — Registro da transferência
- Ver [[Banco de Dados — SQLite]]

---

Voltar: [[Home]] | [[Segurança e Anti-Fraude]]
