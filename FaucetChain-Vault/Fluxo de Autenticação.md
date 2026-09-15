---
tags: [auth, login, metamask, email]
aliases: [Auth, Login, Autenticação]
---

# 🔐 Fluxo de Autenticação

> **Frontend:** `AuthContext.tsx`
> **Backend:** `POST /api/auth/register`, `POST /api/auth/login`

---

## 3 Métodos de Login

### 1. 🦊 MetaMask (Web3)
```
Connect Wallet → EIP-191 Sign Message → setUser(address)
```
- Mais seguro
- Necessário para [[Transferências Assinadas]]
- Endereço real da wallet do usuário

### 2. 📧 Email (Custodial)
```
POST /api/auth/register {email, password}
→ Gera wallet custodial: "0x" + random 20 bytes
→ INSERT users (email, password_hash, wallet_address)
```
- Password hash: SHA-256
- Wallet gerada automaticamente
- Não requer MetaMask instalado

### 3. 📝 Manual
```
Input field → setUser(typed_address)
```
- Bypass total de assinatura
- Útil para testes
- Sem verificação de propriedade

---

## AuthContext.tsx

```typescript
interface AuthContext {
    user: { address: string } | null;
    loginMethod: 'metamask' | 'email' | 'manual';
    setUser(address: string): void;
    logout(): void;
}
```

Providers chain:
```
LanguageProvider → AuthProvider → NetworkProvider → App
```

---

## Tabela `users`

| Coluna | Tipo | Descrição |
|---|---|---|
| `email` | TEXT UNIQUE | Email do usuário |
| `password_hash` | TEXT | SHA-256 da senha |
| `wallet_address` | TEXT UNIQUE | Wallet custodial gerada |
| `created_at` | INTEGER | Timestamp de criação |

Ver [[Banco de Dados — SQLite]]

---

Voltar: [[Home]]
