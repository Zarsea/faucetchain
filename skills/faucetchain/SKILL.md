---
name: faucetchain
description: |
  Connect a faucet, rewards site, or micro-payout app to FaucetChain: credit users
  off-chain $CLAIM per claim, run campaign rewards that settle on Solana, let users
  spend their balance in your shop, and receive webhooks. Use when integrating,
  debugging a FaucetHub API key, a microclaim that was refused, a withdrawal that
  never settled, a CORS failure against faucetchain.com.br, or when deciding whether
  a payout belongs on this rail at all.
license: MIT
metadata:
  version: "1.0.0"
  base_url: "https://www.faucetchain.com.br"
  network: "public testnet, settles on Solana devnet"
---

# FaucetChain integration

FaucetChain is a rail for payouts too small to put on a chain one by one. Your
faucet credits a user a fraction of a cent per claim; the rail keeps that as an
off-chain balance, and settles many of them in one Solana transaction when the
user withdraws.

**Base URL:** `https://www.faucetchain.com.br`
**Network:** public testnet. Settlement is on Solana **devnet**. Say that to your
users; tokens that arrive are devnet tokens.

## Read this before writing any code

**Two different pockets pay, and confusing them is the mistake that costs your
users real money.**

| | Pays from | Settles | Who owes it |
|---|---|---|---|
| **Your own payout** (FaucetPay, Litecoin, whatever you already do) | your wallet | your existing rail | you |
| **Campaign reward** (crosses to FaucetChain) | the campaign's funded vault | Solana, in a batch | the campaign sponsor |

They are separate balances with separate liabilities. Never add the two numbers
together on a screen, in a total, or in an export. A user who sees one number and
withdraws expecting both will find half of it missing, and the half that is
missing is the half you owe.

**$CLAIM is not money.** It is the unit this network measures work in. What
carries value to a user is the campaign token, which somebody else issued and
funded. If your UI implies $CLAIM has a price, fix the UI.

## The whole integration, if you only want the minimum

Three steps. Everything else in this skill is optional.

**1. Register once.** Keep the API key it returns; it is shown once.

```bash
curl -X POST https://www.faucetchain.com.br/api/faucethub/register \
  -H "Content-Type: application/json" \
  -d '{"name":"My Faucet","wallet_address":"0x...","site_url":"https://myfaucet.example"}'
```

**2. One call per claim**, from your server.

```bash
curl -X POST https://www.faucetchain.com.br/api/faucethub/microclaim \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $FAUCETCHAIN_KEY" \
  -d '{"user_wallet":"0x...","amount":1.0}'
```

**3. Show the user their balance.** This route needs no key, so your frontend can
read it directly.

```bash
curl https://www.faucetchain.com.br/api/faucethub/microclaim/balance/0x...
```

That is a working integration. Stop here unless you need a shop, campaigns, or
webhooks.

## The four things that break real integrations

**Call from your server, not the browser.** The API allows credentialed requests
from an allowlist of origins. Your site is not on it until somebody adds it, and
a blocked preflight answers `400`, which JavaScript cannot tell apart from the
server being down — so your site will report "FaucetChain is offline" while
FaucetChain is up and serving. Your API key must not reach a browser anyway.
Routes that take no key (`/balance`, `/history`, `/stats`) are still subject to
this; call them from your server too, or ask for your origin to be allowlisted.

**A user with no Solana wallet cannot collect.** Settlement joins a table of
linked wallets, and users without one are dropped from every batch, silently. On
this network that was 48 of 86 people who had earned campaign tokens. If your
users will ever withdraw, get them to link a wallet *before* they earn, not after,
and show the ones who have not what they are missing.

**Below the minimum, nothing settles.** `MIN_WITHDRAW` is **10.0**. The balance
route tells you `can_withdraw` and `missing_to_withdraw`; use those rather than
computing the rule yourself, because it is the server's rule and it can change.

**Spending is authorised by the user, not by your key.** Your API key says which
faucet is calling. It cannot move anybody's balance on its own — a spend carries
the user's signature over a message naming the faucet, the wallet, the item, the
amount and that one request. If your key leaks, whoever holds it gets nothing.
Build for that; do not try to work around it.

## What else the rail does

Load `reference/endpoints.md` for the full surface and exact request shapes:

- **Campaign splitting** — `campaigns` and `campaign_id` on a microclaim, when one
  click should pay only $CLAIM, or only one campaign
- **Shop** — `/microclaim/spend` and `/microclaim/refund`, with idempotency
- **Withdrawal** — `/microclaim/withdraw`, and reading `/settlements/{wallet}`
- **Reserve** — `/reserve` to declare, `/proof-of-reserve` to read what every
  faucet on the network owes against what it holds

Load `reference/webhooks.md` to receive `withdrawal.settled`, `withdrawal.failed`,
`faucet.reserve_low` and `faucet.reserve_ok`, and to verify their signature.

## When something is refused

The API answers with a `detail` string that says what to do. Show it; do not
replace it with a generic message of your own. Common ones:

| Status | What it usually means |
|---|---|
| `401` | No `X-API-Key`, or the key does not match a registered faucet |
| `400` | The address is not a valid address, or the amount is not positive |
| `429` | A rate limit. Rejected calls are not counted against you, so backing off recovers on its own |
| `400` on withdraw | Below `MIN_WITHDRAW`, or the user has no linked Solana wallet |

If a preflight fails with `400` and the body mentions the origin, that is the
CORS allowlist, not your code.

## Checking your own integration

Every number this network reports is readable without an account, which means you
can verify your integration from outside it rather than trusting your own logs:

```bash
# what the rail thinks it credited this user, per faucet
curl .../api/faucethub/microclaim/balance/{user}
# every event behind that balance
curl .../api/faucethub/microclaim/history/{user}
```

A record is not proof of a debit. To prove a spend really moved, reconcile:
`claims + refunds − spends − withdrawals` must equal `virtual_balance`. Read both
in the same breath — a claim landing between two requests looks exactly like a
bug, and reading them minutes apart will show a gap that is only your clock.
