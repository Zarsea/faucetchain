# FaucetHub — Integration Guide for Developers
**Everything needed to connect your faucet to FaucetChain through the API.**

**Version:** 1.5 | **Updated:** 11 November 2026 | **Base URL:** `https://www.faucetchain.com.br`

> There is an agent skill in `skills/faucetchain/` that carries the same
> integration and ships `check.py`, which asserts its promises against the
> running API.

## Changes that need action on your side

Newest first. If an entry is dated after your integration went live, your
code needs the change it describes. We tell every registered faucet before
one of these reaches production.

| Date | What changed | What you do |
|---|---|---|
| 14 Nov 2026 | A **spend is paid out of your escrow**. `/microclaim/spend` now moves the amount from your escrow to your faucet wallet (`FAUCET_SPEND`, visible in the explorer), and answers `402` with `"faucet escrow does not cover this spend"` and an `escrow` field when your escrow is smaller than the purchase. A refund moves it back, and answers `402` if your wallet no longer holds the payment. | Treat a `402` whose `detail` mentions `escrow` as *your* shortfall, not the user's: do not deliver the item, top up `POST /api/faucethub/reserve`. Keep enough free balance to cover refunds of recent spends. |
| 13 Nov 2026 | **Fix to our own sample.** The solver in section 4 started at `nonce = 0`. The challenge only changes with a new block, so every click in that block found the same proof, and from the second one on it answered `400 "Proof of Claim was already used"`. | Start the nonce at a random value, as section 4 now does. |
| 11 Nov 2026 | `/microclaim` requires a **Proof of Claim**, single-use across all faucets. Without one the click answers `400`. | Have the user's browser solve the challenge and forward three fields. [Section 4](#the-proof-of-claim-step-by-step). |
| 11 Nov 2026 | A click is **priced by supply and demand**. `amount` became a ceiling; what the user got comes back as `credited`. | Show `credited`, never the `amount` you sent. [Section 4](#what-a-click-is-worth). |
| 11 Nov 2026 | The minimum withdrawal is **10 clicks at your current click value**, not a fixed 10. | Read `min_withdraw` / `can_withdraw` from the balance route instead of hard-coding 10. |
| 6 Nov 2026 | **Escrow is required.** Without it `/microclaim` answers `402`. | `POST /api/faucethub/reserve` before going live. |

---

## Contents

1. [Overview](#1-overview)
2. [Before you start](#2-before-you-start)
3. [Step 1: Register your faucet](#3-step-1-register-your-faucet)
4. [Step 2: The bridge — one call per claim](#4-step-2-the-bridge--one-call-per-claim)
5. [Step 3: Manage your API key](#5-step-3-manage-your-api-key)
6. [Step 4: Settle a withdrawal](#6-step-4-settle-a-withdrawal)
7. [Step 5: Read your history](#7-step-5-read-your-history)
8. [The architecture we recommend](#8-the-architecture-we-recommend)
9. [Complete examples](#9-complete-examples)
10. [Error codes](#10-error-codes)
11. [FAQ](#11-faq)

---

## 1. Overview

**FaucetHub** is how an outside faucet connects to FaucetChain. Registering gives
you an **API key**, and there are two different things you can do with it. They
pay out of different pockets, and confusing them is the one mistake that costs
your users money.

**The bridge (section 4).** You tell us a claim happened. Every campaign your
faucet is enrolled in pays that user out of **the sponsor's budget**, and the
amount owed is guaranteed by a Merkle root published on Solana — not by a row
in anybody's database. Nothing leaves your wallet. This is the interesting one,
it is one HTTP call, and it is what the newer sections of this guide are about.

**Settlement (section 6).** You move **your own $CLAIM** to a user who earned
it on your faucet. This is the original model and it still works exactly as it
did.

### How the bridge works

```
[Your site]     user clicks, you credit them as you always have
       |
       |  after your own commit — your payout already happened
       v
[The bridge]    POST /api/faucethub/microclaim   { user_wallet, amount, poc_* }
       |
       v
[FaucetChain]   every enrolled campaign credits that user from its budget
       |
       v
[Solana]        a root covering what is owed is published; the vault
                refuses a root it cannot cover
       |
       v
[User]          signs in with the same wallet, withdraws with a proof
```

The user never held SOL to get there, and you never fronted the money.

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
curl -X POST https://www.faucetchain.com.br/api/faucethub/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Minha Faucet", "wallet_address": "0x84da..."}'
```

### With JavaScript (fetch)

```javascript
const response = await fetch('https://www.faucetchain.com.br/api/faucethub/register', {
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

resp = requests.post('https://www.faucetchain.com.br/api/faucethub/register', json={
    'name': 'My Faucet',
    'wallet_address': '0x84da...'
})

data = resp.json()
print(f"API Key: {data['api_key']}")
# Store this somewhere safe. It is shown once.
```

> **The API key is shown once.** It appears only in the registration response. Put it somewhere safe immediately — an environment variable or a secrets manager, never the source tree. If you lose it, rotate it with the endpoint below rather than registering again.

---

## 4. Step 2: The bridge — one call per claim

This is the whole integration. One POST, after your own database commit.

### Endpoint

```
POST /api/faucethub/microclaim
```

### Required headers

| Header | Value |
|---|---|
| `X-Api-Key` | the key from step 1 |
| `Content-Type` | `application/json` |

### Body

| Field | Type | What it is |
|---|---|---|
| `user_wallet` | string | Your user's **Solana address**, or a FaucetChain `0x` address. The Solana one is the useful case — see *the derivation* below. |
| `amount` | number | The most $CLAIM you will pay for this click, `0 < amount <= 100`. The user gets the smaller of this and the click's current value (below). Campaign rewards ignore it; the network computes those from the campaign budget, the days left and how many people take part. |
| `poc_nonce` | integer | The nonce the user's browser found. Required. |
| `poc_epoch_id` | integer | `epochId` from the challenge it solved. Required. |
| `poc_parent_hash` | string | `parentHash` from the same challenge. Required. |

### A successful response (200)

```json
{
  "user_address": "0x6f9b...c41e",
  "credited": 0.42,
  "virtual_balance": 18.7,
  "next_claim_in": 300,
  "campaigns": [
    { "campaign_id": 990001, "amount": 4.82, "treasury": 1.2, "funding": "vault" }
  ],
  "campaigns_skipped": [
    { "campaign_id": 990002, "reason": "month_spent",
      "detail": "This month's allowance of 10000000 is spent; 40000000 remains for later months" }
  ]
}
```

`campaigns` is empty when your faucet is enrolled in nothing, or when no
campaign paid this click. **An empty list is not an error.**

`campaigns_skipped` is how you tell those two apart, and it was added on
3 October because you could not. Every campaign your faucet is enrolled in that
did *not* pay appears here with a `reason` your code can switch on and a
`detail` a sponsor can act on:

| `reason` | What happened |
|---|---|
| `no_budget` | Enrolled, but the sponsor has not set a budget yet |
| `window_closed` | The campaign's end date has passed |
| `budget_spent` | The whole budget is gone |
| `month_spent` | This month's allowance is gone; it resumes next month |
| `rate_rounds_to_zero` | The month's remaining budget spread over the expected clicks is under one unit. Arithmetic, not a fault — the cap or the token's decimals are too small |
| `user_share_rounds_to_zero` | The gross was 1, and the user's 80% of 1 truncates to nothing |

The last two are worth showing a sponsor rather than swallowing: a budget too
small to express one click pays nobody, and before this field existed it did so
in silence. Nothing is ever debited for a skipped campaign.

Both lists together name every campaign your faucet carries, so
`campaigns` + `campaigns_skipped` being empty really does mean the enrolment is
missing — which was previously the commonest reason an integration looked broken
when it was not.

`funding` matters if you show this on screen:

- **`vault`** — the money is there. The user can withdraw today.
- **`deferred`** — the project settles at mainnet. The user holds a *record of
  work*, not money. Do not draw these two the same way.

### The derivation, which is the actual promise

You send your user's Solana address. We derive their FaucetChain account from
it — the last 20 bytes of keccak256 over the public key — and credit that. When
that same person later signs in here with that same wallet, they land in exactly
that account, with the rewards already in it.

So nothing has to be shared between us and you beyond a public key. No user
list, no email, no token exchange, no account-linking step. We do the derivation
on this side on purpose: it is a keccak over a decoded base58 key, and a faucet
running PHP on shared hosting should not have to acquire either.

### What a click is worth

Your escrow pays your users, so your escrow sets the price. A click is worth

```
min(amount, (escrow − what you already owe) ÷ 30 days ÷ (your clicks in the last 24 h + 1))
```

With few users the click is worth the `amount` you sent. As more people click,
each click is worth less, until you add escrow. With 19,600 in free escrow and
24 clicks a day per user, the 1-CLAIM click starts to dilute at about 27 active
users. Below 0.01 the click is refused with `402` and nothing is credited.

Three consequences for your code:

- **Show `credited`, not `amount`.** A screen that says "+1 $CLAIM" while 0.42
  was credited is a promise your user will catch you breaking.
- **Read the minimum, don't hard-code it.** The minimum withdrawal is 10 clicks
  at the current value. `GET /microclaim/balance/{user}` returns `min_withdraw`,
  `can_withdraw` and `missing_to_withdraw` for each faucet.
- **Escrow cannot go below what you owe.** You can release the free part, never
  the part already promised to your users. Pay them first.

### The Proof of Claim, step by step

Every `/microclaim` carries a small proof of work, solved in your user's browser
and good for one click at one faucet. A script that calls your claim endpoint in
a loop now has to burn CPU for every click, and a proof cannot be replayed at a
second faucet.

The proof is a nonce such that

```
keccak256("FaucetChain-PoC|<chainId>|<epochId>|<parentHash>|<user_wallet>|<nonce>")
```

starts with `difficultyBits` zero bits. Expect 16 bits, about 65 thousand
hashes, and up to 19 under load. That is a second or two in a browser.

**1. Your server fetches the challenge.** Do this on your server, not in the
browser (see the CORS note in the agent skill), and fetch it when the user starts
the claim. A challenge goes stale within the hour, or sooner if the chain seals
a block.

```php
// poc_challenge.php — the browser asks you, you ask FaucetChain
header('Content-Type: application/json');
$raw = @file_get_contents(rtrim(FAUCETCHAIN_URL, '/') . '/api/poc/challenge', false,
    stream_context_create(['http' => ['timeout' => 4]]));
echo $raw !== false ? $raw : '{"error":"unavailable"}';
```

**2. The browser solves it** over the exact `user_wallet` your server will
send. A Solana address is case-sensitive: use it as it is. A `0x` address goes
in lowercase, with the `0x`.

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/js-sha3/0.9.3/sha3.min.js"></script>
<script>
async function solveClaimProof(wallet) {
  const ch = await (await fetch('/api/poc_challenge.php')).json();
  const shift = BigInt(256 - ch.difficultyBits);
  // Random start: the challenge stays the same until a new block, so a search
  // from 0 finds the same nonce every click, and a used proof is refused.
  // The start stays below 2^42, a safe integer in JS, PHP and Python.
  for (let nonce = crypto.getRandomValues(new Uint32Array(1))[0] * 1024; ; nonce++) {
    const msg = `FaucetChain-PoC|${ch.chainId}|${ch.epochId}|${ch.parentHash}|${wallet}|${nonce}`;
    if ((BigInt('0x' + keccak256(msg)) >> shift) === 0n) {
      return { poc_nonce: nonce, poc_epoch_id: ch.epochId, poc_parent_hash: ch.parentHash };
    }
    if (nonce % 5000 === 0) await new Promise(r => setTimeout(r)); // keep the page responsive
  }
}
// on the claim button: send the three fields with your own claim request
// const proof = await solveClaimProof(userSolanaAddress);
// fetch('/api/claim.php', { method: 'POST', body: JSON.stringify({ ...yourFields, ...proof }) });
</script>
```

**3. Your server forwards the three fields** with the microclaim, untouched.
It does not check them; FaucetChain does.

If the proof is missing, stale, too easy or already used, the answer is `400`
with a `detail` that says which. Your own claim has already been paid by then
(rule 1 below), so log it and move on. A rejected click does not use up the
proof; a click that was credited does.

### The rules that are not negotiable

**1. Call it after your commit.** Your user's payout must be recorded before
FaucetChain is even looked up. A payment cannot depend on somebody else's
uptime.

**2. Swallow the error.** If we are down, unreachable or slow, your user gets
their claim and nobody finds out. Give the call a short timeout — four seconds
is plenty — and let a failure log and return. **Test this by taking us offline
on purpose.** If your faucet stops paying when ours does, the integration is
wrong, and the person it costs is your user.

`429` is not a failure: it is the five-minute per-user cooldown on this side,
the same lock you almost certainly already have. Treat it as "nothing to do" and
do not log an error, or your log fills with false alarms.

`402` and `400` are not outages either: your escrow is too thin, or the proof
was refused. Log the `detail`, show the user that this click earned no $CLAIM,
and do not mark FaucetChain as offline.

**3. Show what was credited.** Read `credited` from the response. If the call
failed, the user earned nothing here, so do not show anything.

### A working PHP implementation

`dist/api/faucetchain.php` in the FaucetHunter tree is the reference: env-var
config, short timeout, swallowed errors. It was written before 11 November and
does not forward the proof yet, so add steps 5 and 6 below. The changes for a
faucet that already exists:

```php
// 1. a column for the wallet, optional — whoever leaves it empty keeps
//    using your faucet exactly as they do today
ALTER TABLE `users`
  ADD COLUMN `solana_address` VARCHAR(50) DEFAULT NULL;

// 2. fetch it wherever you load the logged-in user. An explicit SELECT
//    list will silently not have it, and the bridge then quietly does
//    nothing at all — this is the step that gets forgotten
SELECT id, email, solana_address, ... FROM users WHERE ...

// 3. in your claim handler, at the top
require_once __DIR__ . '/faucetchain.php';

// 4. and right after your commit, inside its own try, so a surprise
//    here cannot turn a committed claim into a 500
$pdo->commit();

$fc = null;
try {
    $fc = faucetchainNotifyClaim($user['solana_address'] ?? null);
} catch (Throwable $e) {
    error_log('[FaucetChain] ' . $e->getMessage());
}

// 5. take the proof from the browser's claim request and put it in the
//    microclaim body, next to user_wallet and amount
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$body = [
    'user_wallet'     => $solanaAddress,
    'amount'          => 1.0,              // a ceiling, not what the user gets
    'poc_nonce'       => (int)($in['poc_nonce'] ?? 0),
    'poc_epoch_id'    => (int)($in['poc_epoch_id'] ?? 0),
    'poc_parent_hash' => (string)($in['poc_parent_hash'] ?? ''),
];

// 6. return what was really credited, and show that number
$credited = (float)($response['credited'] ?? 0);
```

Then add `'faucetchain' => $fc` to your JSON response if you want to show the
user what the click and the campaigns paid.

### With cURL

```bash
curl -X POST https://www.faucetchain.com.br/api/faucethub/microclaim \
  -H "X-Api-Key: fch_your_key" \
  -H "Content-Type: application/json" \
  -d '{"user_wallet": "EL5Hubaf...jpPAvpkmjLzA", "amount": 1.0,
       "poc_nonce": 48213, "poc_epoch_id": 498406, "poc_parent_hash": "0x..."}'
```

### Checklist before you go live

1. Registered, API key stored as a server secret.
2. Escrow posted (`POST /api/faucethub/reserve`).
3. Users have a Solana address on file, or the bridge does nothing for them.
4. The browser solves the proof over the same `user_wallet` the server sends.
5. The microclaim runs after your commit, with a 4-second timeout, and its
   failure cannot fail your claim.
6. The screen shows `credited`, and withdrawal reads `min_withdraw`.
7. You took FaucetChain offline on purpose and your faucet kept paying.


## 5. Step 3: Manage your API key

### Read the key's usage

```
GET /api/faucethub/my-key/{wallet_address}
```

**Response:**

```json
{
    "created_at": 1717372800,
    "is_active": true,
    "last_used": 1717376400,
    "total_requests": 142,
    "total_settled": 1420.50
}
```

There is no `api_key` in that response, deliberately. It used to be there, and
since the wallet address is published in the faucet directory, reading the
directory was enough to take over any faucet on it. Counters are not a secret;
the key is.

### The key cannot be shown again

`POST /api/faucethub/reveal-key` existed until 8 October 2026 and is gone. It
returned the live key to the wallet that owned the faucet, and for that the key
had to sit in our database in plaintext — which meant one read of that database
handed over the right to distribute in the name of every faucet on it, yours
included.

We now store only its SHA-256. The key you are sent when you register, and
again when you rotate, is the only time it exists in readable form anywhere.
Put it on your server then. If you lose it, rotate.

A request to the old route returns 404.

### Rotate the key

If the key leaked, or you rotate on a schedule:

```
POST /api/faucethub/regenerate-key
Content-Type: application/json
```

```json
{
    "wallet_address": "0x84da...",
    "signature": "0x...",
    "sig_timestamp": 1717372800
}
```

Signed for the same reason, and with more at stake: unsigned, a stranger could
not only mint themselves a key for your faucet but cut *you* off in the same
call, and your faucet would start failing every request it made afterwards.

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

## 6. Step 4: Settle a withdrawal

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
curl -X POST https://www.faucetchain.com.br/api/faucethub/settle \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: fch_sua_api_key_aqui" \
  -d '{"user_wallet": "0xEnderecoDoUsuario...", "amount": 10.0}'
```

### With JavaScript (Node.js)

```javascript
const API_KEY = process.env.FAUCETHUB_API_KEY; // Nunca hardcode!

async function settleUserWithdrawal(userWallet, amount) {
    const response = await fetch('https://www.faucetchain.com.br/api/faucethub/settle', {
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
BASE_URL = 'https://www.faucetchain.com.br'

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
$baseUrl = 'https://www.faucetchain.com.br';

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

## 7. Step 5: Read your history

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

## 8. The architecture we recommend

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

## 9. Complete examples

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
FAUCETHUB_URL = os.getenv('FAUCETHUB_URL', 'https://www.faucetchain.com.br')
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

const FAUCETHUB_URL = process.env.FAUCETHUB_URL || 'https://www.faucetchain.com.br';
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

## 10. Error codes

| Code | Meaning | Usual cause |
|---|---|---|
| `400` | Bad Request | Malformed wallet address, amount <= 0, a wallet that is already registered, or on `/microclaim` a Proof of Claim that is missing, stale, too easy or already used |
| `401` | Unauthorized | API key missing, wrong, or deactivated |
| `402` | Payment Required | On `/microclaim`: your escrow is too thin, a click would be worth under 0.01. Nothing was credited |
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

## 11. FAQ

### Do I pay gas to settle?
**No.** Internal FaucetChain operations are gasless, and `/settle` charges no network fee.

### How many settlements per minute?
**100 requests per minute** per IP by default. If you need more, talk to us before you need it.

### What happens when my reserve runs out?
The settlement is refused with `400 — Insufficient reserve`. Your users keep accumulating their balance on your site; they just cannot withdraw until you top the wallet up. Watch the board and refill before you hit zero.

### Is escrow required?
Yes, since 6 November 2026, and since 11 November it also sets what a click is worth: the free part of your escrow, spread over 30 days and over your clicks of the last day, capped at the `amount` you send. Below 0.01 per click the call answers `402` and nothing is credited. Move $CLAIM into escrow with `POST /api/faucethub/reserve`. You can release escrow, but never below what you owe your users. Campaign tokens are not affected; they are covered by the campaign's vault on Solana.

### Can a user bring $CLAIM they already hold into my faucet?
Yes, since 13 November 2026, with nothing to change on your side. The user signs a deposit on FaucetChain (`POST /api/faucethub/microclaim/deposit`). The amount leaves their account, goes into your escrow, and appears in their balance at your faucet, the same balance you already read and spend with `/microclaim/spend`. Your escrow and what you owe rise by the same amount, so your coverage and your click value do not change. A deposit is only accepted into a faucet that has already credited that account, so it never lands on a user you cannot see. The history shows it as `DEPOSIT`.

### How do I top up?
Send $CLAIM to the registered address like any other transfer, or earn it through mining and staking on FaucetChain.

### Can I run more than one faucet?
Yes. Each one needs **its own wallet address**, registered separately.

### What is Proof of Reserve?
A public board listing every registered faucet with the $CLAIM balance its
wallet actually holds, read at request time. It is a real number and worth
showing — a user can decide to trust you before spending time earning.

Be precise about what it proves, though: it is a **balance**, not a solvency
check. Nothing on that board knows what you owe. A faucet with a large balance
and larger obligations looks healthy there, so do not present it to your users
as a guarantee. The guarantee in this system is the Merkle root on Solana, and
that one covers campaign rewards, not your own payouts.

### My API key leaked. What now?
Call `POST /api/faucethub/regenerate-key`, signed by the wallet that owns the faucet, right away. The old key dies instantly.

---

## Useful links

| Resource | Where |
|---|---|
| **API docs (Swagger)** | `https://www.faucetchain.com.br/docs` |
| **FaucetHub dashboard** | The "Dapps" button in the Explorer |
| **Whitepaper** | `FaucetChain_Master_WhitePaper.md` |
| **Settlement on Solana** | `ARCHITECTURE.md` — how rewards reach a Solana wallet |
| **API source** | `api_server.py` |

---

*Built by the FaucetChain core team. For support, open an issue on the repository.*
