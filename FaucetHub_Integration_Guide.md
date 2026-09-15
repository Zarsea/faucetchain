# FaucetHub — Manual de Integração para Desenvolvedores
**Guia completo para conectar sua Faucet ao ecossistema FaucetChain via API.**

**Versão:** 1.0 | **Última atualização:** Junho 2026 | **Base URL:** `http://localhost:8000`

---

## 📋 Índice

1. [Visão Geral](#1-visão-geral)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Passo 1: Registrar sua Faucet](#3-passo-1-registrar-sua-faucet)
4. [Passo 2: Gerenciar sua API Key](#4-passo-2-gerenciar-sua-api-key)
5. [Passo 3: Realizar Settlements (Liquidações)](#5-passo-3-realizar-settlements-liquidações)
6. [Passo 4: Consultar Histórico](#6-passo-4-consultar-histórico)
7. [Arquitetura Recomendada (L2 Off-chain)](#7-arquitetura-recomendada-l2-off-chain)
8. [Exemplos Completos](#8-exemplos-completos)
9. [Códigos de Erro](#9-códigos-de-erro)
10. [FAQ](#10-faq)

---

## 1. Visão Geral

A **FaucetHub** é a plataforma de integração da FaucetChain que permite que qualquer desenvolvedor conecte sua torneira (faucet) ao ecossistema $CLAIM. Ao se registrar, você recebe uma **API Key** exclusiva que permite:

- **Distribuir $CLAIM** da sua carteira institucional para os usuários finais da sua Faucet.
- **Ser monitorado** no painel público de Proof of Reserve (PoR), garantindo transparência.
- **Escalar** para milhões de usuários sem sobrecarregar a blockchain (via modelo L2 off-chain).

### Como funciona o fluxo?

```
[Seu Site/App] → Claims virtuais no seu banco de dados (instantâneo, grátis)
       ↓
[Saque do Usuário] → Sua API chama POST /api/faucethub/settle
       ↓
[FaucetChain L1] → Transação real registrada na blockchain
       ↓
[Usuário] → Recebe $CLAIM na sua carteira FaucetChain
```

---

## 2. Pré-requisitos

Antes de começar, você precisa:

| Requisito | Descrição |
|---|---|
| **Carteira FaucetChain** | Um endereço `0x...` com saldo de $CLAIM para distribuição. |
| **Saldo de $CLAIM** | Sua carteira precisa ter fundos suficientes para cobrir os saques dos seus usuários. |
| **Servidor HTTP** | Seu site/app precisa ser capaz de fazer requisições HTTP (qualquer linguagem). |

> ⚠️ **Importante:** A FaucetHub valida o saldo da sua carteira em tempo real. Se sua reserva estiver insuficiente, o settlement será rejeitado.

---

## 3. Passo 1: Registrar sua Faucet

### Endpoint

```
POST /api/faucethub/register
Content-Type: application/json
```

### Body

```json
{
    "name": "Minha Faucet Incrível",
    "wallet_address": "0x84da...seu_endereco_aqui"
}
```

### Resposta de Sucesso (200)

```json
{
    "status": "success",
    "message": "Faucet registered successfully",
    "api_key": "fch_a1b2c3d4e5f6...64_caracteres_hex",
    "wallet_address": "0x84da..."
}
```

### Exemplo com cURL

```bash
curl -X POST http://localhost:8000/api/faucethub/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Minha Faucet", "wallet_address": "0x84da..."}'
```

### Exemplo com JavaScript (fetch)

```javascript
const response = await fetch('http://localhost:8000/api/faucethub/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'Minha Faucet Incrível',
        wallet_address: '0x84da...'
    })
});

const data = await response.json();
console.log('Sua API Key:', data.api_key);
// SALVE ESTA CHAVE EM LOCAL SEGURO!
```

### Exemplo com Python (requests)

```python
import requests

resp = requests.post('http://localhost:8000/api/faucethub/register', json={
    'name': 'Minha Faucet Incrível',
    'wallet_address': '0x84da...'
})

data = resp.json()
print(f"API Key: {data['api_key']}")
# SALVE ESTA CHAVE EM LOCAL SEGURO!
```

> 🔐 **ATENÇÃO:** A API Key é exibida **apenas uma vez** no momento do registro. Salve-a imediatamente em um local seguro (variável de ambiente, cofre de segredos, etc.). Se perdê-la, utilize o endpoint de rotação de chave.

---

## 4. Passo 2: Gerenciar sua API Key

### Consultar Informações da Chave

```
GET /api/faucethub/my-key/{wallet_address}
```

**Resposta:**

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

### Rotacionar Chave (Segurança)

Se sua chave for comprometida ou você desejar rotacioná-la por segurança:

```
POST /api/faucethub/regenerate-key
Content-Type: application/json
```

```json
{
    "wallet_address": "0x84da..."
}
```

**Resposta:**

```json
{
    "status": "success",
    "api_key": "fch_nova_chave_gerada...",
    "wallet_address": "0x84da..."
}
```

> A chave anterior será **desativada imediatamente**. Qualquer requisição usando a chave antiga retornará `401 Unauthorized`.

---

## 5. Passo 3: Realizar Settlements (Liquidações)

Este é o **endpoint principal** da integração. Quando um usuário da sua Faucet atinge o saldo mínimo de saque e solicita a retirada, seu servidor chama este endpoint para transferir $CLAIM da sua carteira para a carteira do usuário.

### Endpoint

```
POST /api/faucethub/settle
```

### Headers Obrigatórios

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

### Resposta de Sucesso (200)

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

### Exemplo com cURL

```bash
curl -X POST http://localhost:8000/api/faucethub/settle \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: fch_sua_api_key_aqui" \
  -d '{"user_wallet": "0xEnderecoDoUsuario...", "amount": 10.0}'
```

### Exemplo com JavaScript (Node.js)

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

### Exemplo com Python

```python
import requests
import os

API_KEY = os.environ['FAUCETHUB_API_KEY']  # Nunca hardcode!
BASE_URL = 'http://localhost:8000'

def settle_withdrawal(user_wallet: str, amount: float) -> dict:
    """Liquida um saque de $CLAIM para o usuário na FaucetChain L1."""
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

### Exemplo com PHP

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

## 6. Passo 4: Consultar Histórico

### Listar Settlements da sua Faucet

```
GET /api/faucethub/settlements/{wallet_address}?limit=50
```

**Resposta:**

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

### Consultar Liquidez (Proof of Reserve)

```
GET /api/faucethub/faucets
```

Retorna todas as Faucets com liquidez, status e volume de settlements.

---

## 7. Arquitetura Recomendada (L2 Off-chain)

Para escalar para milhões de usuários, **não** processe cada claim individual na blockchain. Use o modelo L2:

```
┌─────────────────────────────────────────────────────────┐
│                    SEU SERVIDOR (L2)                     │
│                                                         │
│  ┌─────────────┐    ┌──────────────────────────────┐    │
│  │  Usuários    │    │  Banco de Dados Local        │    │
│  │  clamam a    │───>│  (MySQL/PostgreSQL/SQLite)    │    │
│  │  cada 5 min  │    │                              │    │
│  └─────────────┘    │  user_id | balance_virtual    │    │
│                      │  user_1  | 8.50 CLAIM        │    │
│                      │  user_2  | 12.30 CLAIM       │    │
│                      └────────────┬─────────────────┘    │
│                                   │                      │
│                      Saque ≥ 10 CLAIM?                   │
│                                   │                      │
│                                   ▼                      │
│                      ┌──────────────────────┐            │
│                      │  POST /settle        │            │
│                      │  X-Api-Key: fch_...  │            │
│                      │  amount: 10.0        │────────────┼──> FaucetChain L1
│                      └──────────────────────┘            │    (Transação real)
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Fluxo Recomendado no seu Backend

```python
# Pseudocódigo — adapte para sua linguagem/framework

@app.route('/claim', methods=['POST'])
def user_claim():
    user = get_authenticated_user()
    
    # 1. Verifica cooldown (ex: 5 minutos)
    if user.last_claim > now() - timedelta(minutes=5):
        return error("Aguarde o cooldown")
    
    # 2. Adiciona saldo VIRTUAL (nenhuma transação on-chain)
    claim_amount = 0.05  # $CLAIM por claim
    user.virtual_balance += claim_amount
    user.last_claim = now()
    db.save(user)
    
    return success(f"Você clamou {claim_amount} CLAIM! Saldo: {user.virtual_balance}")


@app.route('/withdraw', methods=['POST'])
def user_withdraw():
    user = get_authenticated_user()
    wallet = request.json['wallet_address']
    
    MIN_WITHDRAW = 10.0  # Saque mínimo
    
    # 1. Verifica saldo mínimo
    if user.virtual_balance < MIN_WITHDRAW:
        return error(f"Saldo mínimo para saque: {MIN_WITHDRAW} CLAIM")
    
    # 2. Chama o FaucetHub para liquidar na L1
    amount = user.virtual_balance
    try:
        result = settle_withdrawal(wallet, amount)  # Função do Passo 3
        
        # 3. Zera o saldo virtual após sucesso
        user.virtual_balance = 0.0
        db.save(user)
        
        return success(f"Saque de {amount} CLAIM enviado! Tx: {result['tx_hash']}")
    except Exception as e:
        return error(f"Falha no saque: {str(e)}")
```

---

## 8. Exemplos Completos

### Exemplo Minimalista: Faucet em Python (Flask)

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

# Configuração
FAUCETHUB_URL = os.getenv('FAUCETHUB_URL', 'http://localhost:8000')
API_KEY = os.getenv('FAUCETHUB_API_KEY', 'fch_sua_chave_aqui')
CLAIM_AMOUNT = 0.05      # $CLAIM por claim
COOLDOWN = 300            # 5 minutos em segundos
MIN_WITHDRAW = 10.0       # Saque mínimo

# Banco de dados simplificado (em memória — use DB real em produção!)
users = {}  # { "user_id": { "balance": 0.0, "last_claim": 0 } }

@app.route('/claim', methods=['POST'])
def claim():
    user_id = request.json.get('user_id')
    if not user_id:
        return jsonify({"error": "user_id obrigatório"}), 400
    
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
        return jsonify({"error": "user_id e wallet_address obrigatórios"}), 400
    
    user = users.get(user_id)
    if not user or user["balance"] < MIN_WITHDRAW:
        return jsonify({"error": f"Saldo mínimo: {MIN_WITHDRAW} CLAIM"}), 400
    
    # Chama o FaucetHub para liquidar na L1!
    resp = requests.post(
        f'{FAUCETHUB_URL}/api/faucethub/settle',
        headers={'Content-Type': 'application/json', 'X-Api-Key': API_KEY},
        json={'user_wallet': wallet, 'amount': user["balance"]}
    )
    
    if resp.status_code != 200:
        return jsonify({"error": resp.json().get("detail", "Erro desconhecido")}), 500
    
    result = resp.json()
    user["balance"] = 0.0  # Zera após saque
    
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

### Exemplo Minimalista: Faucet em Node.js (Express)

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
    if (!user_id) return res.status(400).json({ error: 'user_id obrigatório' });

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
        return res.status(400).json({ error: 'user_id e wallet_address obrigatórios' });
    }

    const user = users.get(user_id);
    if (!user || user.balance < MIN_WITHDRAW) {
        return res.status(400).json({ error: `Saldo mínimo: ${MIN_WITHDRAW} CLAIM` });
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

## 9. Códigos de Erro

| Código | Significado | Causa Comum |
|---|---|---|
| `400` | Bad Request | Endereço de wallet inválido, amount ≤ 0, ou wallet já registrada |
| `401` | Unauthorized | API Key ausente, inválida ou desativada |
| `404` | Not Found | Wallet não registrada ou sem chave ativa |
| `429` | Too Many Requests | Rate limit excedido (máx 100 req/min) |
| `500` | Internal Error | Erro interno do servidor (reporte ao time FaucetChain) |

### Mensagens de Erro Comuns

```json
// API Key ausente
{ "detail": "Missing X-Api-Key header" }

// API Key inválida ou rotacionada
{ "detail": "Invalid or inactive API key" }

// Saldo insuficiente na carteira da Faucet
{ "detail": "Insufficient reserve. Faucet balance: 5.00, requested: 10.00" }

// Wallet já registrada
{ "detail": "Wallet address already registered" }

// Endereço inválido
{ "detail": "Invalid Ethereum address length after normalization..." }
```

---

## 10. FAQ

### Preciso pagar Gas para fazer settlements?
**Não.** A FaucetChain é gasless para operações internas. O endpoint `/settle` não cobra taxa de rede.

### Quantos settlements posso fazer por minuto?
O rate limit padrão é de **100 requisições por minuto** por IP. Para volumes maiores, entre em contato com o time FaucetChain.

### O que acontece se minha reserva acabar?
O settlement será **rejeitado** com erro `400 - Insufficient reserve`. Seus usuários continuam acumulando saldo virtual no seu site, mas não conseguirão sacar até você reabastecer a carteira.

### Como reabastecer minha carteira?
Envie $CLAIM para o endereço registrado via transferência P2P comum ou através de mineração/staking na FaucetChain.

### Posso ter mais de uma Faucet?
Sim. Cada Faucet precisa de um **endereço de carteira diferente**. Registre cada uma separadamente.

### O que é o Proof of Reserve?
É o sistema de auditoria pública da FaucetHub. Qualquer usuário pode acessar o painel e verificar se sua Faucet tem $CLAIM suficiente para honrar os pagamentos. Isso gera **confiança** e atrai mais usuários para o seu site.

### Minha API Key foi comprometida. O que faço?
Chame imediatamente `POST /api/faucethub/regenerate-key` com o endereço da sua wallet. A chave antiga será desativada instantaneamente.

---

## 🔗 Links Úteis

| Recurso | URL |
|---|---|
| **API Docs (Swagger)** | `http://localhost:8000/docs` |
| **FaucetHub Dashboard** | Acesse via botão "Dapps" no Explorer |
| **WhitePaper** | `FaucetChain_Master_WhitePaper.md` |
| **Código-fonte da API** | `api_server.py` |

---

*Desenvolvido pelo FaucetChain Core Team. Para suporte técnico, abra uma issue no repositório ou entre em contato via o AI Agent integrado ao Explorer.*
