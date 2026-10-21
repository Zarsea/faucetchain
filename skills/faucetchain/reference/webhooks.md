# Webhooks

FaucetChain calls your endpoint when something happens that you cannot see by
polling cheaply: a settlement landing on Solana, a settlement failing, your
reserve crossing below what you owe.

Ask the operator to set your URL and a shared secret. The secret never travels in
a request; it is what you verify signatures with.

## Events

| Event | When | What to do |
|---|---|---|
| `withdrawal.settled` | a user's balance reached Solana | mark it paid on your side; the payload carries the signature |
| `withdrawal.failed` | coverage was short, or the settlement errored | do not retry it yourself; check your reserve |
| `faucet.reserve_low` | escrow + free balance fell below what you owe | fund the vault; withdrawals are about to fail |
| `faucet.reserve_ok` | it recovered | clear the alarm you raised |

The two reserve events fire **on a change of state, not on every check**. You will
not get one per minute while you are low, and you should not treat silence as
recovery — wait for `reserve_ok`.

## Verifying the signature

Three headers arrive with every call:

```
X-FaucetChain-Event-Id:   <stable id for this event>
X-FaucetChain-Timestamp:  <unix seconds, as a string>
X-FaucetChain-Signature:  sha256=<hex>
```

The signature is an HMAC-SHA256 over the exact bytes `{timestamp}.{body}`:

```python
import hmac, hashlib

def valido(segredo: str, timestamp: str, corpo: bytes, assinatura: str) -> bool:
    esperado = "sha256=" + hmac.new(
        segredo.encode(), timestamp.encode() + b"." + corpo, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(esperado, assinatura)
```

```javascript
const crypto = require('crypto');

function valido(segredo, timestamp, corpo, assinatura) {
    const esperado = 'sha256=' + crypto
        .createHmac('sha256', segredo)
        .update(timestamp + '.' + corpo)
        .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(assinatura));
}
```

Three rules that matter more than they look:

**Sign the raw bytes, not the parsed object.** Re-serialising JSON reorders keys
and changes spacing, and the signature stops matching for reasons that look like
a FaucetChain bug and are not. Read the body as bytes before any parser touches
it.

**Compare in constant time.** `hmac.compare_digest` in Python,
`crypto.timingSafeEqual` in Node. A plain `==` on a signature leaks how much of
it was right.

**Check the timestamp.** It is the real send time, so a replayed call carries an
old one. Reject anything older than a few minutes.

## Retries and idempotency

A call that does not get a `2xx` is retried with growing waits:

```
60s · 5min · 30min · 2h · 12h
```

After the last one it is given up on. So your endpoint must be idempotent: the
same `X-FaucetChain-Event-Id` can arrive more than once, and processing it twice
must not pay a user twice. Store the id, and return `200` immediately for one you
have already handled.

Answer fast and do the work afterwards. An endpoint that settles its own database
before responding will time out under load, and a timeout is a retry.
