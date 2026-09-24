# What is waiting, and on whom

Crypto World's Fair closes **12 October 2026, 23:59 PT**. Everything below is
sorted by who is blocked, because the most expensive item on any list is the one
waiting on somebody who does not know it is waiting.

Design questions that are open *on purpose* are not here — they live in
[ARCHITECTURE.md](ARCHITECTURE.md) under Known gaps. This file is work.

---

## Waiting on the operator

Nothing here can be done by anyone else, and most of it takes minutes.

- [ ] **A Telegram bot token.** `@BotFather` → `/newbot` → paste the token into
      `TELEGRAM_BOT_TOKEN`. Sign-in through Telegram is written, tested and
      refuses everything until this exists — the HMAC is keyed on it, so
      without it there is nothing to verify against. Free, two minutes, no
      review.
- [ ] **The bot's domain, once there is a public URL.** `@BotFather` →
      `/setdomain`. Telegram will not render the Login Widget on a domain it
      does not know, and `localhost` is not one it accepts. Blocked by the
      tunnel below.
- [ ] **A FaucetPay account and its API key** (`FAUCETPAY_API_KEY`). Phase one
      of the FaucetPay link is identity only and moves no money, but the route
      answers 503 until the key exists rather than recording a link nobody
      verified.
- [ ] **The Colosseum submission**: category and description. Recommended
      *Developer Infrastructure* — the customer is a developer integrating an
      API, which is what the category is for, and it is where this project's
      strengths are what gets judged.
- [ ] **Decide what happens to the address-login leftovers.** Three options
      with the numbers attached are written up in ARCHITECTURE.md under Known
      gaps. Whoever picks should write down which and why, there.

## Waiting on the team

- [ ] **An independent review of the Solana program** (FC-13 from the audit).
      The one item nobody who wrote it can do. `faucetchain/programs/` is about
      900 lines; the settlement flow and `claim_reward` are where it matters.

## Waiting on nobody — the main line

The objective is a judge clicking a link, watching a real faucet pay, and
checking the root on Solana without asking us anything.

- [x] **The program on public devnet**, carrying the Token-2022 refusal, read
      back off the chain to confirm it.
- [ ] **A tunnel, with the localhost exemption off.** `ngrok http 8010`, and
      `RATE_LIMIT_TRUST_LOCALHOST=0` — behind a proxy on the same host every
      caller arrives as 127.0.0.1, so leaving it on switches rate limiting off
      for the whole internet at the exact moment the API stops being local.
- [ ] **Register FaucetHunter and enrol it in a funded campaign.** The key comes
      back once. A micro-claim answering with an empty `campaigns` list means
      the enrolment is missing, which is the commonest way this looks broken.
- [ ] **Wire `claim.php` to the bridge.** `dist/api/faucetchain.php` has existed
      in the FaucetHunter tree since 19 September and nothing calls it. The call
      goes *after* `$pdo->commit()`, so the partner's own payout has already
      happened before ours is attempted.
- [ ] **Take the sequencer down on purpose** and confirm the faucet still pays.
      The one test that is about protecting the partner rather than us, and the
      one most likely to be skipped for looking redundant.
- [ ] **A real user links a Solana wallet and withdraws.** The only proof that
      matters: a click on somebody else's faucet became a token in a wallet,
      with the guarantee on chain, from a person who never held SOL.
- [ ] **Two mining nodes online during the demo.** The sealer election is real
      and currently has no participants, so the header says "Hybrid PoC-V3
      Consensus" while nothing is sealing. `mining-node/` is a Node process;
      running two makes the draw observable and recomputable from the parent
      hash.

## Sign-in, after Telegram

Telegram went first because its proof is arithmetic this server can do alone.
The other two are worth having and are more work, in this order:

- [ ] **Google.** An ID token verified against Google's rotating public keys,
      checking issuer, audience and expiry. No client secret needed for that
      flow, but a Cloud project and a consent screen are.
- [ ] **X.** A full authorisation-code exchange with PKCE, then a call to their
      API for the identity. The most moving parts of the three, and their API
      has paid tiers worth checking before committing to it.

Each one earns its own `verify_*` in `social_auth.py` and its own row in
`test_social_login.py` proving a forged payload reaches nothing and writes
nothing. Anything less is the button this project already removed once.

## Deliberately not before the deadline

Written down so they are decisions rather than things that quietly did not
happen.

- **FaucetPay phase two**, the payout rail. The design is sound and the
  reasoning is in ARCHITECTURE.md; building it half-way is worse than
  presenting it as a considered next step.
- **A per-account watchlist.** The address tracker is a shared public list with
  nothing of value attached, so the exposure is vandalism and a ceiling answers
  it. Making it per-account is a feature, not a patch.
- **Server-side minigame state.** Signing the score ended crediting a bonus to
  a wallet that never played; it does not make the score true, because the
  browser still computes it. The real fix is a game the server runs.
