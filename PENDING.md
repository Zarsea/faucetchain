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
- [ ] **A FaucetPay API key** (`FAUCETPAY_API_KEY`). Phase one is identity only
      and calls exactly one endpoint, `checkaddress`, so **issue a v2 key scoped
      to read**. Their v2 keys carry scopes — read, send, manage, admin — and a
      read-only one cannot spend anything even if this machine is compromised.
      The route answers 503 until the key exists rather than recording a link
      nobody verified.
- [ ] **The Colosseum submission**: category and description. Recommended
      *Developer Infrastructure* — the customer is a developer integrating an
      API, which is what the category is for, and it is where this project's
      strengths are what gets judged.
- [ ] **Two environment variables on the FaucetHunter host**, and the column.
      The bridge is wired and deliberately inert until all three exist:
      `FAUCETCHAIN_URL` (the tunnel below), `FAUCETCHAIN_KEY` (the key that
      registration returns once), and `ALTER TABLE fh_users ADD COLUMN
      solana_address VARCHAR(50)`. The schema file carries the ALTER. Until
      then every claim behaves exactly as it did before, which is the point.
- [ ] **Decide what happens to the address-login leftovers.** Three options
      with the numbers attached are written up in ARCHITECTURE.md under Known
      gaps. Whoever picks should write down which and why, there.

      The *login* was closed on 24 September -- the paste-an-address field is
      out of the modal and stored sessions are evicted. That was a separate
      question and it is settled. This one is about the 1,196,254 $CLAIM
      sitting in seven addresses that are not rows in `users`, and it is still
      open.

- [ ] **Decide what happens to the wager in FaucetHunter's Battle Arena.**
      `src/components/NftBattleArenaView.jsx` keeps `wagerCoinId` state, picks a
      currency, and its own comment reads *"Wager Amount in Cents /
      Micro-fractions (No modo IA a aposta é 0 e a recompensa é fixa
      $0.001)"* — so the structure already supports both a no-stake mode against
      the AI and a real one between users.

      This is flagged because of the standing product rule: nothing here may
      lead users to bet. A PvP card match with money on it is the thing that
      rule was written to exclude, and the same rule already removed a fake
      staking screen and a browser-scored minigame bonus from FaucetChain. It is
      a decision about someone else's product, so it is the operator's to make
      and nobody has touched that file.

      Whichever way it goes, write it down: keeping it is a considered choice
      about FaucetHunter, not about FaucetChain, and the two can differ — but
      then FaucetChain should not carry that part of the card system.

## Waiting on the team

- [ ] **An independent review of the Solana program** (FC-13 from the audit).
      The one item nobody who wrote it can do. `faucetchain/programs/` is about
      900 lines; the settlement flow and `claim_reward` are where it matters.

## Waiting on nobody — the main line

The objective is a judge clicking a link, watching a real faucet pay, and
checking the root on Solana without asking us anything.

- [x] **The program on public devnet**, carrying the Token-2022 refusal, read
      back off the chain to confirm it.
- [ ] **A tunnel, with the localhost exemption off.** `ngrok http 8000`, and
      `RATE_LIMIT_TRUST_LOCALHOST=0` — behind a proxy on the same host every
      caller arrives as 127.0.0.1, so leaving it on switches rate limiting off
      for the whole internet at the exact moment the API stops being local.
- [x] **Register FaucetHunter.** Done 24 September against the local API; the
      key is the one that goes into `FAUCETCHAIN_KEY` on their host. The exact
      call the PHP makes was then made by hand: 200 with `user_address` and
      `campaigns`, the derived account matching what that wallet reaches by
      signing in, and a second immediate call answering 429.
- [ ] **Enrol it in a campaign that is funded for real — a new one.** The
      micro-claim above answered with an empty `campaigns` list, which is
      correct: FaucetHunter is enrolled in nothing.

      **Do not enrol it in one of the fourteen already in the database.** They
      all say `funding: vault`, and not one of their vaults can be read off any
      chain — the sequencer logs `could not find account` for every one, because
      they were opened against a localnet ledger that no longer exists. Enrolling
      into one would credit a reward, show a number, and be backed by nothing.
      That is precisely the failure this project exists to fix, and it would be
      this project doing it. A new campaign on devnet, with a mint and a vault
      that a judge can read, is the demo.
- [x] **Wire `claim.php` to the bridge.** Done 24 September. It needed four
      changes rather than the two the file's own comment promised -- the missing
      one was `solana_address` in the session `SELECT`, without which the call
      was a silent no-op on every claim. The bridge also moved out of
      `dist/api/`, which Vite empties on build. `test_bridge_contract.py` keeps
      the fields the PHP reads from being renamed out from under it.
- [ ] **Take the sequencer down on purpose** and confirm the faucet still pays.
      The one test that is about protecting the partner rather than us, and the
      one most likely to be skipped for looking redundant.
- [ ] **A field on FaucetHunter where the user types their Solana address.**
      The column exists and the bridge reads it; nothing yet writes it. Without
      this the integration is complete and pays nobody, which is the least
      obvious way for all of the above to look finished and be useless.
- [ ] **A real user links a Solana wallet and withdraws.** The only proof that
      matters: a click on somebody else's faucet became a token in a wallet,
      with the guarantee on chain, from a person who never held SOL.
- [ ] **Two mining nodes online during the demo.** The sealer election is real
      and currently has no participants, so the header says "Hybrid PoC-V3
      Consensus" while nothing is sealing. `mining-node/` is a Node process;
      running two makes the draw observable and recomputable from the parent
      hash.

## The consensus, now that it has been written down honestly

Modelling FaucetChain against Al-awamy et al. (2025), *Hybrid Consensus
Mechanisms in Blockchain*, produced a short list rather than a paragraph. The
survey's own Table 5 warns that stake-weighted selection centralises when few
participants hold most stake; this repository is the warning realised, so these
are ordered by that.

- [ ] **A cap on the stake term.** `select_block_sealer` weighs `1 + stake` with
      no ceiling, so the largest staker wins nearly every round. Of 935,500
      currently locked, 930,000 sat in one placeholder address. The cap is a
      line; deciding the number is the work.
- [ ] **Two mining nodes online.** With none, `select_block_sealer` returns None
      and any caller may seal — the bootstrap path. There is no consensus
      running today, and no table should say otherwise.
- [ ] **Answer the survey's Table 8 for FaucetChain** — Sybil, double-spending,
      Byzantine faults, unauthorised participation, reputation manipulation,
      each with its evidence type. Three rows are already answerable from tests
      that run: `bot_quota_attack.py` (experimental, and the answer is weak),
      `test_endpoint_inventory.py` (experimental, in CI), and the one bit per
      leaf on Solana. Two rows are honest zeroes.
- [ ] **Rename or disambiguate PoC.** In that literature PoC is Proof of Credit
      (Microchain). Ours is Proof of Claim. A reader who knows the field reads
      the header wrong, and that reader is the one worth impressing.

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

- **NFTs as compressed NFTs on Solana**, not before the deadline and worth
  doing after it. What exists today is not an NFT in either repository:
  FaucetChain's `cyberdrip_nfts` holds four rows of one badge, off chain, that
  no wallet can read and nobody can transfer; FaucetHunter has 3,914 lines of
  card-game interface with real art in `cards/`, fed by `NFT_CARDS_DATA`, a
  constant exported from a component. **Its schema has no NFT table at all**, so
  ownership does not exist even in MySQL. That is the first thing to fix, and it
  is not a chain problem.

  The fit, when the time comes, is genuinely good. A compressed NFT collection
  is a Merkle tree whose root lives on chain, with ownership proven by an
  inclusion path — the same shape as this settlement rail, which already
  batches, publishes a root and hands out proofs. The trees are **not**
  interchangeable: Bubblegum has its own leaf schema over SPL Account
  Compression, and `leaf_hash(pubkey, amount, index)` here has no asset field at
  all, because the mint is fixed on the campaign account. What transfers is the
  understanding and the operating pattern, not the code.

  Compression is also what makes it affordable: minting ordinary NFTs for a
  large number of very small users is not viable, and a faucet has no other
  kind of user. The version worth building is the one where the card is the
  receipt for the work — minted in the same batch as the claim and proven the
  same way — so the collection is a record of who was there rather than
  decoration.

- **FaucetPay phase two**, the payout rail. The design is sound and the
  reasoning is in ARCHITECTURE.md; building it half-way is worse than
  presenting it as a considered next step.
- **A per-account watchlist.** The address tracker is a shared public list with
  nothing of value attached, so the exposure is vandalism and a ceiling answers
  it. Making it per-account is a feature, not a patch.
- **Server-side minigame state.** Signing the score ended crediting a bonus to
  a wallet that never played; it does not make the score true, because the
  browser still computes it. The real fix is a game the server runs.
