# FaucetChain endpoints

Base URL: `https://www.faucetchain.com.br`

Auth is one of three, and the route decides which:

| Header | Who it proves | Used by |
|---|---|---|
| `X-API-Key` | which faucet is calling | credit, spend, refund, campaigns, settle |
| `X-Session-Token` | which user is signed in | withdraw, regenerate key |
| *(none)* | — | balance, history, stats, proof of reserve |

A route that takes no auth still answers from the real ledger. It is readable so
that anyone can check what this network claims, including your users and you.

---

## Register and keys

### `POST /api/faucethub/register`

```json
{ "name": "My Faucet", "wallet_address": "0x...", "site_url": "https://..." }
```

Returns the faucet record and an **API key, shown once**. Store it as a secret on
your server. Rate limited per IP per hour; a loop that registers repeatedly will
be refused before it fills the table.

### `GET /api/faucethub/my-key/{wallet}`
### `POST /api/faucethub/regenerate-key` — needs `X-Session-Token`

Regenerating invalidates the old key immediately. Deploy the new one first.

### `GET /api/faucethub/faucets`

Every faucet on the network. No auth. This is how your faucet becomes visible to
users browsing the hub.

---

## Crediting a claim

### `POST /api/faucethub/microclaim` — needs `X-API-Key`

```json
{
  "user_wallet": "0x...",
  "amount": 1.0,
  "campaigns": true,
  "campaign_id": null
}
```

`campaigns` and `campaign_id` are both optional, and **leaving both out is the
normal case**: the click pays $CLAIM and every campaign the user qualifies for.

| You want | Send |
|---|---|
| $CLAIM and all campaigns (default) | neither field |
| $CLAIM only, no campaign | `"campaigns": false` |
| one campaign only, no $CLAIM | `"campaign_id": 7` |

Use `campaign_id` when your faucet gives one claim per token and the user picked
which one. Use `campaigns: false` for a click that should not touch sponsor money.

### `GET /api/faucethub/my-campaigns` — needs `X-API-Key`

Which campaigns your faucet can currently pay from, and what is left in each. Read
this before showing a user a token they cannot actually earn.

---

## Reading a balance

### `GET /api/faucethub/microclaim/balance/{user_wallet}` — no auth

Returns one entry per faucet the user has a balance with, because a user's $CLAIM
is not one number: each faucet is liable for its own.

```json
{
  "user": "0x...",
  "total_pending": 40.5,
  "faucets": [
    {
      "faucet_wallet": "0x...",
      "faucet_name": "My Faucet",
      "virtual_balance": 39.0,
      "total_claimed": 58.0,
      "total_withdrawn": 0.0,
      "claim_count": 58,
      "can_withdraw": true,
      "min_withdraw": 10.0,
      "missing_to_withdraw": 0.0,
      "next_claim_at": 1792473631
    }
  ]
}
```

Read `can_withdraw` and `missing_to_withdraw` instead of comparing against 10.0
yourself. The rule belongs to the server.

### `GET /api/faucethub/microclaim/history/{user_wallet}` — no auth

Every event behind that balance: `CLAIM`, `SPEND`, `WITHDRAW`, `REFUND`,
`CONSOLIDATE`. Takes `?limit=`. Note that `CONSOLIDATE` moves a balance between
addresses and deliberately does not change `total_claimed`, because nothing new
was earned.

### `GET /api/faucethub/microclaim/stats` · `/leaderboard` · `/activity-links` — no auth

---

## Spending in your shop

### `POST /api/faucethub/microclaim/spend` — needs `X-API-Key`

```json
{
  "user_wallet": "<solana address>",
  "amount": 10.0,
  "item": "booster-24h",
  "idempotency_key": "<unique per purchase>",
  "message": "<the exact string the user signed>",
  "signature": "<their signature>",
  "sig_timestamp": 1792544175
}
```

The signed message names the faucet, the wallet, the item, the amount and that one
request. All five are checked against the request body before any balance moves, so

- a signature that does not name the amount would authorise any amount,
- one that does not name the faucet would authorise the same spend next door.

`idempotency_key` must be unique per purchase and stable across retries. Send the
same key twice and the second call returns the first result instead of charging
again, which is what you want when a network timeout leaves you unsure.

### `POST /api/faucethub/microclaim/refund` — needs `X-API-Key`

```json
{ "idempotency_key": "<the key of the spend>", "reason": "item out of stock" }
```

Refund by the key of the spend, not by amount. A refund keyed by amount refunds
the wrong purchase the first time a user buys two things at the same price.

---

## Withdrawing to Solana

### `POST /api/faucethub/microclaim/withdraw` — needs `X-Session-Token`

```json
{ "user_wallet": "0x...", "faucet_wallet": "0x...",
  "signature": null, "sig_timestamp": null }
```

This is the user's action, not yours: it is authorised by their session or their
wallet signature, never by your API key. It refuses below `MIN_WITHDRAW` (10.0)
and when the user has no linked Solana wallet.

### `GET /api/faucethub/settlements/{wallet}` — no auth

What has settled on chain for that wallet, with the Solana signatures. These are
devnet signatures; they open in any Solana explorer with `?cluster=devnet`.

### `POST /api/faucethub/settle` — needs `X-API-Key`

For a faucet settling a claim it owes directly.

---

## Reserve

### `POST /api/faucethub/reserve` — needs `X-API-Key`

Declare what you hold against what you owe.

### `GET /api/faucethub/proof-of-reserve` — no auth

What every faucet on the network owes, against what it has declared and what the
chain shows. Your users can read this about you. That is the point of it.
