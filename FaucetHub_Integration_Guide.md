# FaucetHub — Integration Guide for Developers
**Everything needed to connect your faucet to FaucetChain through the API.**

**Version:** 1.1 | **Updated:** September 2026 | **Base URL:** `http://localhost:8000`

---

## Contents

1. [Overview](#1-overview)
2. [Before you start](#2-before-you-start)
3. [Step 1: Register your faucet](#3-step-1-register-your-faucet)
4. [Step 2: Manage your API key](#4-step-2-manage-your-api-key)
5. [Step 3: Settle a withdrawal](#5-step-3-settle-a-withdrawal)
6. [Step 4: Read your history](#6-step-4-read-your-history)
7. [The architecture we recommend](#7-the-architecture-we-recommend)
8. [Complete examples](#8-complete-examples)
9. [Error codes](#9-error-codes)
10. [FAQ](#10-faq)

---

## 1. Overview

**FaucetHub** is how an outside faucet connects to FaucetChain. Registering gives you an **API key**, and with it you can:

- **Distribute $CLAIM** from your own wallet to the people using your faucet.
- **Be audited in public** on the Proof of Reserve board, so users can see you can pay before they earn.
- **Serve millions of claims** without putting each one on a chain — see the off-chain model in section 7.

### How the flow works

```
[Your site or app]  -> virtual claims in your own database (instant, free)
       ↓
[User withdraws]    -> your server calls POST /api/faucethub/settle
       ↓
[FaucetChain L1]    -> one real transaction is recorded
       ↓
[User]              -> receives $CLAIM in their FaucetChain wallet
```

---

## 2. Before you start

Three things:

| What | Why |
|---|---|
| **A FaucetChain wallet** | A `0x...` address holding the $CLAIM you will hand out. |
| **Enough $CLAIM in it** | Your reserve has to cover what your users withdraw. |
| **A server that can make HTTP calls** | Any language. There is no SDK to install. |

> **The reserve is checked, not trusted.** FaucetHub reads your wallet balance at the moment you settle. If it does not cover the amount, the settlement is refused — which is the same guarantee your users get from the public board.

---

## 3. Step 1: Register your faucet

### Endpoint

```
POST /api/faucethub/register
Content-Type: application/json
```

### Body

```json
{
    "name": "My Faucet",
    "wallet_address": "0x84da...seu_endereco_aqui"
}
```

### A successful response (200)

```json
{
    "status": "success",
    "message": "Faucet registered successfully",
    "api_key": "fch_a1b2c3d4e5f6...64_caracteres_hex",
    "wallet_address": "0x84da..."
}
```

### With cURL

```bash
curl -X POST http://localhost:8000/api/faucethub/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Minha Faucet", "wallet_address": "0x84da..."}'
```

### With JavaScript (fetch)

```javascript
const response = await fetch('http://localhost:8000/api/faucethub/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'My Faucet',
        wallet_address: '0x84da...'
    })
});

const data = await response.json();
console.log('Your API key:', data.api_key);
// Store this somewhere safe. It is shown once.
```

### With Python (requests)

```python
import requests

resp = requests.post('http://localhost:8000/api/faucethub/register', json={
    'name': 'My Faucet',
    'wallet_address': '0x84da...'
})

data = resp.json()
print(f"API Key: {data['api_key']}")
# Store this somewhere safe. It is shown once.
```

> **The API key is shown once.** It appears only in the registration response. Put it somewhere safe immediately — an environment variable or a secrets manager, never the source tree. If you lose it, rotate it with the endpoint below rather than registering again.

---

## 4. Step 2: Manage your API key

### Read the key's details

```
GET /api/faucethub/my-key/{wallet_address}
```

**Response:**

```json
{
    "api_key": "fch_a1b2c3...",
    "created_at": 1717372800,
    "is_active": true,
    "last_used": 1717376400,
    "total_requests": 142,
    "total_settled": 1420.50
}
```

### Rotate the key

If the key leaked, or you rotate on a schedule:

```
POST /api/faucethub/regenerate-key
Content-Type: application/json
```

```json
{
    "wallet_address": "0x84da..."
}
```

**Response:**

```json
{
    "status": "success",
    "api_key": "fch_nova_chave_gerada...",
    "wallet_address": "0x84da..."
}
```

> The previous key stops working **immediately**. Any request still using it gets `401 Unauthorized`, so roll the new one out before you rotate.

---

## 5. Step 3: Settle a withdrawal

This is the endpoint the integration exists for. When someone on your faucet asks to withdraw, your server calls it, and $CLAIM moves from your wallet to theirs.

### Endpoint

```
POST /api/faucethub/settle
```

### Required headers

```
Content-Type: application/json
X-Api-Key: fch_sua_api_key_aqui
```

### Body

```json
{
    "user_wallet": "0xEnderecoDoUsuario...",
    "amount": 10.0
}
```

### A successful response (200)

```json
{
    "status": "success",
    "tx_hash": "0xabc123...hash_da_transacao",
    "from": "0x84da...sua_carteira",
    "to": "0xEnderecoDoUsuario...",
    "amount": 10.0,
    "timestamp": 1717376400
}
```

### With cURL

```bash
curl -X POST http://localhost:8000/api/faucethub/settle \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: fch_sua_api_key_aqui" \
  -d '{"user_wallet": "0xEnderecoDoUsuario...", "amount": 10.0}'
```

### With JavaScript (Node.js)

```javascript
const API_KEY = process.env.FAUCETHUB_API_KEY; // Nunca hardcode!

async function settleUserWithdrawal(userWallet, amount) {
    const response = await fetch('http://localhost:8000/api/faucethub/settle', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': API_KEY
        },
        body: JSON.stringify({
            user_wallet: userWallet,
            amount: amount
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Settlement failed: ${error.detail}`);
    }

    const result = await response.json();
    console.log(`✅ Settlement OK! Tx: ${result.tx_hash}`);
    return result;
}

// Uso:
await settleUserWithdrawal('0xEnderecoDoUsuario...', 10.0);
```

### With Python

```python
import requests
import os

API_KEY = os.environ['FAUCETHUB_API_KEY']  # Nunca hardcode!
BASE_URL = 'http://localhost:8000'

def settle_withdrawal(user_wallet: str, amount: float) -> dict:
    """Settle a $CLAIM withdrawal for one user on FaucetChain L1."""
    resp = requests.post(
        f'{BASE_URL}/api/faucethub/settle',
        headers={
            'Content-Type': 'application/json',
            'X-Api-Key': API_KEY
        },
        json={
            'user_wallet': user_wallet,
            'amount': amount
        }
    )
    
    if resp.status_code != 200:
        raise Exception(f"Settlement failed: {resp.json()['detail']}")
    
    result = resp.json()
    print(f"✅ Settlement OK! Tx: {result['tx_hash']}")
    return result

# Uso:
settle_withdrawal('0xEnderecoDoUsuario...', 10.0)
```

### With PHP

```php
<?php
$apiKey = getenv('FAUCETHUB_API_KEY');
$baseUrl = 'http://localhost:8000';

function settleWithdrawal($userWallet, $amount) {
    global $apiKey, $baseUrl;
    
    $ch = curl_init("$baseUrl/api/faucethub/settle");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            "X-Api-Key: $apiKey"
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'user_wallet' => $userWallet,
            'amount' => $amount
        ])
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $data = json_decode($response, true);
    
    if ($httpCode !== 200) {
        throw new Exception("Settlement failed: " . $data['detail']);
    }
    
    echo "✅ Settlement OK! Tx: " . $data['tx_hash'] . "\n";
    return $data;
}

// Uso:
settleWithdrawal('0xEnderecoDoUsuario...', 10.0);
?>
```

---

## 6. Step 4: Read your history

### List your settlements

```
GET /api/faucethub/settlements/{wallet_address}?limit=50
```

**Response:**

```json
[
    {
        "faucet_wallet": "0x84da...",
        "user_wallet": "0xUser1...",
        "amount": 10.0,
        "tx_hash": "0xabc...",
        "timestamp": 1717376400
    },
    {
        "faucet_wallet": "0x84da...",
        "user_wallet": "0xUser2...",
        "amount": 5.5,
        "tx_hash": "0xdef...",
        "timestamp": 1717373000
    }
]
```

### Check liquidity (Proof of Reserve)

```
GET /api/faucethub/faucets
```

Returns every registered faucet with its liquidity, status and settlement volume — the same data the public board shows.

---

## 7. The architecture we recommend

To serve a lot of users, **do not** put every individual claim on a chain. Keep them in your own database and settle only what leaves:

```
YOUR SERVER (L2) — nothing here touches a chain

  Users claim every few minutes
        |
        v
  Your own database            user_1    8.50 CLAIM
  (MySQL / Postgres / SQLite)  user_2   12.30 CLAIM
        |
        |  a balance reaches your minimum, say 10 CLAIM
        v
  POST /api/faucethub/settle
  X-Api-Key: fch_...
  amount: 10.0
        |
        v
FAUCETCHAIN L1 — one real transaction, for the withdrawal only
```

### What your backend should do

```python
# Pseudocode. Adapt it to your language and framework.

@app.route('/claim', methods=['POST'])
def user_claim():
    user = get_authenticated_user()
    
    # 1. Verifica cooldown (ex: 5 minutos)
    if user.last_claim > now() - timedelta(minutes=5):
        return error("Aguarde o cooldown")
    
    # 2. Add to the VIRTUAL balance. Nothing goes on-chain here.
    claim_amount = 0.05  # $CLAIM por claim
    user.virtual_balance += claim_amount
    user.last_claim = now()
    db.save(user)
    
    return success(f"You claimed {claim_amount} CLAIM. Balance: {user.virtual_balance}")


@app.route('/withdraw', methods=['POST'])
def user_withdraw():
    user = get_authenticated_user()
    wallet = request.json['wallet_address']
    
    MIN_WITHDRAW = 10.0  # your minimum withdrawal
    
    # 1. Check the minimum
    if user.virtual_balance < MIN_WITHDRAW:
        return error(f"Minimum withdrawal is {MIN_WITHDRAW} CLAIM")
    
    # 2. Ask FaucetHub to settle it on L1
    amount = user.virtual_balance
    try:
        result = settle_withdrawal(wallet, amount)  # the function from step 3
        
        # 3. Only now clear the virtual balance
        user.virtual_balance = 0.0
        db.save(user)
        
        return success(f"Saque de {amount} CLAIM enviado! Tx: {result['tx_hash']}")
    except Exception as e:
        return error(f"Falha no saque: {str(e)}")
```

---

## 8. Complete examples

### A minimal faucet in Python (Flask)

```python
"""
Faucet minimalista integrada ao FaucetHub.
Instale: pip install flask requests
Execute: python mini_faucet.py
"""
from flask import Flask, request, jsonify
import requests
import time
import os

app = Flask(__name__)

# Configuration
FAUCETHUB_URL = os.getenv('FAUCETHUB_URL', 'http://localhost:8000')
API_KEY = os.getenv('FAUCETHUB_API_KEY', 'fch_sua_chave_aqui')
CLAIM_AMOUNT = 0.05      # $CLAIM por claim
COOLDOWN = 300            # 5 minutos em segundos
MIN_WITHDRAW = 10.0       # your minimum withdrawal

# A toy store, in memory. Use a real database in production.
users = {}  # { "user_id": { "balance": 0.0, "last_claim": 0 } }

@app.route('/claim', methods=['POST'])
def claim():
    user_id = request.json.get('user_id')
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    
    if user_id not in users:
        users[user_id] = {"balance": 0.0, "last_claim": 0}
    
    user = users[user_id]
    now = int(time.time())
    
    if now - user["last_claim"] < COOLDOWN:
        remaining = COOLDOWN - (now - user["last_claim"])
        return jsonify({"error": f"Cooldown ativo. Aguarde {remaining}s"}), 429
    
    user["balance"] += CLAIM_AMOUNT
    user["last_claim"] = now
    
    return jsonify({
        "status": "success",
        "claimed": CLAIM_AMOUNT,
        "balance": user["balance"]
    })

@app.route('/withdraw', methods=['POST'])
def withdraw():
    user_id = request.json.get('user_id')
    wallet = request.json.get('wallet_address')
    
    if not user_id or not wallet:
        return jsonify({"error": "user_id and wallet_address are required"}), 400
    
    user = users.get(user_id)
    if not user or user["balance"] < MIN_WITHDRAW:
        return jsonify({"error": f"Minimum is {MIN_WITHDRAW} CLAIM"}), 400
    
    # Ask FaucetHub to settle it on L1
    resp = requests.post(
        f'{FAUCETHUB_URL}/api/faucethub/settle',
        headers={'Content-Type': 'application/json', 'X-Api-Key': API_KEY},
        json={'user_wallet': wallet, 'amount': user["balance"]}
    )
    
    if resp.status_code != 200:
        return jsonify({"error": resp.json().get("detail", "Unknown error")}), 500
    
    result = resp.json()
    user["balance"] = 0.0  # cleared only after a successful settle
    
    return jsonify({
        "status": "success",
        "tx_hash": result["tx_hash"],
        "amount": result["amount"]
    })

@app.route('/balance', methods=['GET'])
def balance():
    user_id = request.args.get('user_id')
    user = users.get(user_id, {"balance": 0.0})
    return jsonify({"balance": user["balance"]})

if __name__ == '__main__':
    app.run(port=3001, debug=True)
```

### A minimal faucet in Node.js (Express)

```javascript
/**
 * Faucet minimalista integrada ao FaucetHub.
 * Instale: npm install express
 * Execute: FAUCETHUB_API_KEY=fch_... node mini_faucet.js
 */
const express = require('express');
const app = express();
app.use(express.json());

const FAUCETHUB_URL = process.env.FAUCETHUB_URL || 'http://localhost:8000';
const API_KEY = process.env.FAUCETHUB_API_KEY || 'fch_sua_chave_aqui';
const CLAIM_AMOUNT = 0.05;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos
const MIN_WITHDRAW = 10.0;

const users = new Map();

app.post('/claim', (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    if (!users.has(user_id)) {
        users.set(user_id, { balance: 0, lastClaim: 0 });
    }

    const user = users.get(user_id);
    const now = Date.now();

    if (now - user.lastClaim < COOLDOWN_MS) {
        const remaining = Math.ceil((COOLDOWN_MS - (now - user.lastClaim)) / 1000);
        return res.status(429).json({ error: `Cooldown ativo. Aguarde ${remaining}s` });
    }

    user.balance += CLAIM_AMOUNT;
    user.lastClaim = now;

    res.json({ status: 'success', claimed: CLAIM_AMOUNT, balance: user.balance });
});

app.post('/withdraw', async (req, res) => {
    const { user_id, wallet_address } = req.body;
    if (!user_id || !wallet_address) {
        return res.status(400).json({ error: 'user_id and wallet_address are required' });
    }

    const user = users.get(user_id);
    if (!user || user.balance < MIN_WITHDRAW) {
        return res.status(400).json({ error: `Minimum is ${MIN_WITHDRAW} CLAIM` });
    }

    try {
        const response = await fetch(`${FAUCETHUB_URL}/api/faucethub/settle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
            body: JSON.stringify({ user_wallet: wallet_address, amount: user.balance })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.detail);

        user.balance = 0;
        res.json({ status: 'success', tx_hash: result.tx_hash, amount: result.amount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3001, () => console.log('🚰 Mini Faucet rodando em http://localhost:3001'));
```

---

## 9. Error codes

| Code | Meaning | Usual cause |
|---|---|---|
| `400` | Bad Request | Malformed wallet address, amount <= 0, or a wallet that is already registered |
| `401` | Unauthorized | API key missing, wrong, or deactivated |
| `404` | Not Found | Wallet not registered, or it has no active key |
| `429` | Too Many Requests | Rate limit exceeded (100 requests per minute) |
| `500` | Internal Error | Something broke on our side — please report it |

### Common error messages

```json
// API Key ausente
{ "detail": "Missing X-Api-Key header" }

// API key is wrong, or was rotated
{ "detail": "Invalid or inactive API key" }

// The faucet wallet cannot cover it
{ "detail": "Insufficient reserve. Faucet balance: 5.00, requested: 10.00" }

// That wallet is already registered
{ "detail": "Wallet address already registered" }

// Malformed address
{ "detail": "Invalid Ethereum address length after normalization..." }
```

---

## 10. FAQ

### Do I pay gas to settle?
**No.** Internal FaucetChain operations are gasless, and `/settle` charges no network fee.

### How many settlements per minute?
**100 requests per minute** per IP by default. If you need more, talk to us before you need it.

### What happens when my reserve runs out?
The settlement is refused with `400 — Insufficient reserve`. Your users keep accumulating their balance on your site; they just cannot withdraw until you top the wallet up. Watch the board and refill before you hit zero.

### How do I top up?
Send $CLAIM to the registered address like any other transfer, or earn it through mining and staking on FaucetChain.

### Can I run more than one faucet?
Yes. Each one needs **its own wallet address**, registered separately.

### What is Proof of Reserve?
A public audit board. Anyone can check whether your faucet holds enough $CLAIM to honour what it owes. It is there so a user can decide to trust you before spending time earning — which is worth more to you than it costs.

### My API key leaked. What now?
Call `POST /api/faucethub/regenerate-key` with your wallet address right away. The old key dies instantly.

---

## Useful links

| Resource | Where |
|---|---|
| **API docs (Swagger)** | `http://localhost:8000/docs` |
| **FaucetHub dashboard** | The "Dapps" button in the Explorer |
| **Whitepaper** | `FaucetChain_Master_WhitePaper.md` |
| **Settlement on Solana** | `ARCHITECTURE.md` — how rewards reach a Solana wallet |
| **API source** | `api_server.py` |

---

*Built by the FaucetChain core team. For support, open an issue on the repository.*
