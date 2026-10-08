# What is waiting, and on whom

Crypto World's Fair closes **12 October 2026, 23:59 PT**. Everything below is
sorted by who is blocked, because the most expensive item on any list is the one
waiting on somebody who does not know it is waiting.

Design questions that are open *on purpose* are not here — they live in
[ARCHITECTURE.md](ARCHITECTURE.md) under Known gaps. This file is work.

---

## The submission itself

Read off colosseum.com on 28 September. The rules PDF carries the deadline; the
lengths come from the hackathon page and the Colosseum workshop write-up.

The field-by-field worksheet lives in [SUBMISSION.md](SUBMISSION.md): what the
repository can prove for each field, with the proof re-verified, and the
questions only the team can answer. This list stays the schedule; that one is
the content.

- [x] **Register on colosseum.com.** **Already done** — the account reads
      `registered: true` on Crypto World's Fair, read from Colosseum's own API
      on 3 October. This entry warned that it would be missed because it was on
      no build list; it was not missed, and carrying it as open was the error.
- [ ] **Pitch video, 2—3 minutes.** The first thing judges watch, and what
      decides whether a project is shortlisted. One Colosseum post says the
      limit is 2 minutes for this hackathon while the hackathon page says 2—3;
      **shoot for 2**, because a 2-minute pitch passes either rule and
      exceeding the limit is on their own list of what sinks a submission.
- [ ] **Demo video, no more than 3 minutes.** How the product works.
- [ ] **Everything in English.** Content Guidelines 12(a)(i) of the rules. The
      product is trilingual; the submission is not.
- [ ] **Go-to-market, demand validation, distribution.** In the draft these
      are the separate fields `marketValidation`, `traction`, `competition`,
      `monetization`, `whyNow` and `whatBuilding`, all empty. The demand
      evidence is unusually strong and should be said plainly: a faucet in
      production, with real users, already sends claims to this chain. What is
      *not* evidence of demand is this ledger's own counts — they prove the
      rail runs, which is a different claim and an easier one to puncture.

- [ ] **Nothing public opens the product.** `liveProductLink` and `website` are
      both empty and nothing in the repository answers them: the explorer runs
      on localhost behind a tunnel that changes, and there is no deployment
      config. Judges click. Either the frontend goes somewhere stable before the
      12th, or the submission rests entirely on the two videos.
- [x] **Weekly 1-minute update video.** **Update #1 was published on 21
      September** with a video attached, which this list did not know. Further
      ones stay optional and are still the first thing to drop.
- [x] **Public GitHub repo.** `Zarsea/faucetchain` is public, so no access
      needs granting to hackathon@colosseum.com.
- [ ] **The draft's own fields.** Read from the live draft on 3 October:
      name, description, chains, category and country are **already filled**;
      about twenty-five fields are not, and the public hackathon page does not
      list most of them. [SUBMISSION.md](SUBMISSION.md) has them one by one.
      The team's three backgrounds are already on their Colosseum profiles.

Os três roteiros, com tempos e falas, estão em [ROTEIRO_VIDEOS.md](ROTEIRO_VIDEOS.md).
Esta lista continua sendo a ordem de filmagem do demo; aquele arquivo diz o que
se fala por cima dela, e por que o pitch não pode ser escrito antes do
go-to-market.

### The shot list, in the order it should be filmed

Everything below is live and was exercised on 29 September, except the last
two, which are the climax and are deliberately unspent.

1. **A real click on faucethunter.net.** Production, real users, not a mock.
2. **The bridge answers with two funded campaigns at once** — 479079 and
   652608 — each drawing from a vault a judge can read. One click, two
   sponsors, budgets draining independently. This is the thesis in one
   response body.
3. **The user's dashboard shows the campaign tokens**, separated into credited
   here / in a root on Solana / withdrawn, so promise and payment are never the
   same number.
4. **The explorer screen names every address** — program, campaign, vault,
   mint, sponsor, operator — each linking to Solana devnet.
5. **Publish a root whose vault cannot cover it, and let the program refuse.**
   `InsufficientReserve`. More convincing than any happy path, and the whole
   reason the guarantee lives on Solana rather than here.
6. **Close the batch, publish the real root, withdraw.** Campaign 479079 has
   one reward of 347,221 units loaded against a linked Solana wallet and has
   never been settled. Spending it off-camera wastes the only unrehearsed
   take.

---

## The security audit of 29 September

Nine categories were checked against the code and, where possible, against the
running server. Four came back clean: SQL injection (everything is
parameterised), secrets in the frontend (only `VITE_API_URL` reaches the
bundle), SSRF (no user-controlled URL reaches a server-side fetch) and prompt
injection (there is no LLM on the server, and the document write is
operator-guarded).

Nine findings came out of it. Eight are below; the ninth is a product
decision rather than a repair, so it sits under *Waiting on the operator*.
Full report, with the probes that produced each one:
https://claude.ai/artifact/38Bgae5GPZTKDCboHSq5aV

### High

- [x] **Behind the tunnel every caller shares one rate-limit bucket.** ngrok
      delivers over loopback, so `request.client.host` is `127.0.0.1` for every
      visitor on the internet. `X-Forwarded-For` is read nowhere — zero
      occurrences — and uvicorn is not started with `proxy_headers`.

      With `RATE_LIMIT_TRUST_LOCALHOST=0` the limit does apply, which looks
      right and produces the worst of both: one abuser exhausts the quota for
      everybody, so the limit is a denial-of-service amplifier rather than a
      defence. And the per-IP ceilings become global —
      `CLAIM_IP_HOURLY_WALLETS` is five wallets an hour for the whole internet,
      `AUTH_HOURLY_PER_IP` thirty login attempts an hour for the planet.

      Fix: `--proxy-headers --forwarded-allow-ips=127.0.0.1`, trusting only the
      local proxy so nobody forges their own IP by sending the header. Worth a
      test proving two different IPs get two different buckets.

### Medium

- [x] **Close `/docs`, `/redoc` and `/openapi.json` in production.** All three
      answer 200. The schema publishes 99 routes, fifteen sensitive ones by
      name, and every authentication header the API expects —
      `X-Operator-Token`, `X-Api-Key`, `X-Session-Token`, `X-Node-Token`. The
      routes stay guarded; what is given away is the reconnaissance.
      `FastAPI(docs_url=None, redoc_url=None, openapi_url=None)`, kept on in
      development by an environment variable.
- [x] **Replace the password hash.** **Done 8 October.** It was
      `hmac.new(salt, password, sha256)`: one round of a deliberately fast
      function, a *global* salt, no work factor, and two accounts with the same
      password storing byte-identical hashes.

      Now bcrypt, which generates and embeds a salt per row. Login had to be
      rewritten with it, because `WHERE password_hash = ?` only works while the
      same password always produces the same hash. `verify_password` returns
      `(matches, needs_rewrite)` and the old format is rewritten in place at
      login, with the password in hand — there is no batch migration, since a
      legacy hash cannot be converted without it.

      A sha256+base64 pre-hash feeds bcrypt: the installed bcrypt 5.0 *refuses*
      a password over 72 bytes rather than truncating, so without it a long
      password was a 500 at registration. `test_password_hashing.py` pins all
      six properties, including that a legacy hash still opens the account.

      This was the only finding whose damage is permanent: a leaked key is
      rotated, a leaked password is the one that person uses elsewhere.
- [x] **Pace `GET /api/solana/holdings/{address}`.** Forty of forty requests
      succeeded. Four-table JOIN per call, no `check_rate_limit`, no
      `within_rate`. Written on 29 September and never paced.
      `test_endpoint_inventory.py` did not catch it because it audits
      authorisation on state-changing routes and this is a GET — so the
      inventory is worth extending to expensive reads, or the next heavy GET
      walks in through the same door.

### Found on 1 October, by the calendar

- [x] **A campaign whose rate rounds below two units pays nothing, silently.**
      **Closed 3 October, and wider than written here.** The loop had *six*
      silent exits, not one — no budget, window closed, budget spent, month
      spent, gross rounds to zero, user's share rounds to zero — and all six
      return the same `campaigns: []`. Fixing only the sixth would have left
      five mute. `_campaign_drip` now returns `(credited, skipped)`, every skip
      carries a machine-readable `reason` and a sponsor-readable `detail`, and
      the bridge answers with `campaigns_skipped` beside the unchanged
      `campaigns` list — unchanged because FaucetHunter reads it in production.
      [test_silent_skip.py](test_silent_skip.py) pins all six, computes its
      budgets from today's date so it cannot rot by calendar the way the last
      one did, and asserts nothing is debited for a skipped campaign. Partner
      guide at 1.3. The original finding is kept below, because the reasoning
      is why the fix is shaped this way.

      The per-click gross is
      `month_left / days_left_in_month / (100 * 288 * 0.10)`, truncated to an
      integer, and the user gets 80% of that, truncated again. So a gross of 1
      splits into 0 for the user and 1 for the treasury, the code hits
      `if to_user <= 0: continue`, and the campaign vanishes from the reply.

      Nothing is debited — the `continue` happens before the write, which is
      the one mercy here — but the `campaigns` list comes back empty, and the
      bridge cannot tell that from "this faucet is enrolled in nothing". A
      sponsor would see no payouts and no reason.

      It surfaced because `test_bridge_contract.py` passed every day of
      September and failed on 1 October. Its budget was 100,000 a month; with
      two days left in September the rate was 17, and with 31 days left in
      October it was 1. The test now uses production-scale numbers and says why,
      so nobody shrinks them back.

      The three live campaigns are unaffected: at today's rates they pay 44,802
      and 179,211 units per click. The floor only bites small budgets, which is
      exactly where a first-time sponsor would start.

      Deliberately not fixed before filming: changing payout arithmetic the week
      of a recording trades a known defect for an unknown one. Worth doing right
      after.

### Low

- [x] **Stop returning the exception to the client.** The global handler sends
      `{"detail": f"{type(exc).__name__}: {exc}"}`, plus seventeen sites with
      `500, detail=str(e)`. It fired during this session: a database missing the
      indexer's table answered `OperationalError('no such table: transactions')`
      to whoever asked. The hand-written messages in this codebase are good; the
      problem is the unforeseen ones. Log the full `repr`, return an incident id.
- [x] **`securityLevel: 'strict'` on Mermaid.** `'loose'` with
      `htmlLabels: true` allows HTML and click handlers in labels, and the
      output goes to `dangerouslySetInnerHTML`. Not exploitable today — every
      diagram comes from the `DIAGRAMS` constant and the AI chat renders its
      reply as a React child, which escapes — but it is a loaded gun aimed at
      the first diagram that comes from data. One word.
- [x] **`POST /api/internal/notify-block` answers 500 when unconfigured.**
      `INTERNAL_SECRET` is not in `.env`, so the route refuses, which is the
      safe behaviour with the wrong code. 503 is the one that means the
      capability is not available.
- [x] **Decide whether API keys stay readable.** **Decided and done
      8 October: they are not.** The column holds `sha256` now and is named
      `api_key_hash`, because `api_key` with a hash inside is the kind of lie
      in a schema that costs someone a day a year from now. sha256 and not
      bcrypt: the key is `fch_` plus 32 random bytes, so there is no dictionary
      to try, and the lookup has to stay indexed — the same choice
      `_hash_token` makes for sessions.

      `POST /api/faucethub/reveal-key` is gone with the plaintext it depended
      on, along with its button in the panel and its section in
      [FaucetHub_Integration_Guide.md](FaucetHub_Integration_Guide.md). The key
      appears once at creation and once at rotation, which is what the panel
      already promised.

      Every key already in the wild keeps working, because an arriving key is
      hashed before the lookup. Verified against all 13 rows before and after
      the migration, and against the running server with the partner's real
      key.

---

## Waiting on the operator

Nothing here can be done by anyone else, and most of it takes minutes.

- [ ] **The 30/30/20/20 token allocation has no document behind it.** It exists
      in exactly one place: the pie chart in `constants.ts`, which the Tokenomics
      page renders. The whitepaper states the 99,000,000 hardcap and says nothing
      about how it is divided, so the chart is the sole source of a claim that
      **19.8M $CLAIM goes to the core team and liquidity** — a number a judge
      will read as a commitment and ask about.

      Found on 3 October, by the chart being misread: asked what gives access to
      "the treasury with 20M $CLAIM", the answer was that no such balance exists.
      The treasury address holds **1,000 $CLAIM**, all of it one faucet's escrow,
      and `0xfaucetchaintreasury...` is not a keypair at all — it is not even
      valid hex. The 20 was the pie slice.

      The labels now carry the token amounts, and
      [test_tokenomics_chart.mjs](test_tokenomics_chart.mjs) fails if anyone
      removes them. **That fixes the misreading, not the claim.** Either the
      allocation goes in the whitepaper as policy, or it comes off the page
      before the submission. Deciding to leave it is also an answer — but it
      should be a decision, because right now the product's own tokenomics page
      promises something no document supports.

- [ ] **`active_miners.total_earned` shows 24 times what the ledger holds, and
      the cause is two defects stacked.** The sealer `admin-miner-01` reads
      1,257,422.56 on the Infra Monitor and Network Status screens; summing
      `mining_rewards` for the wallet beside it gives 53,037.60. Diagnosed
      3 October against the two database backups in the repository root, which
      is what turned a wrong number into an explanation.

      **The cleanup of 24 September deleted the rewards and left the counter.**
      `blockchain.db.antes-limpeza-20260924-185201` holds **57,808**
      `mining_rewards` rows summing 1,207,967.65, against a counter of
      1,204,384.96 — the two agreed to within one partial epoch. The current
      database holds **69** rows summing 77,983.05, and the counter simply
      carried on from its pre-cleanup value. So `total_earned` is a faithful
      record of a ledger that no longer exists.

      **And the counter belongs to the node, not to the wallet.** Every write is
      `UPDATE active_miners SET total_earned = total_earned + ? WHERE node_id = ?`
      (api_server.py:3583 and :4846). Node `fcn-923037b4-ba0` kept its row, its
      name and its April registration while its wallet changed from
      `0x7dda72ad9ad5…` to `0xb3dff5d3f802…`, and the earnings followed the
      node. `0x7dda72ad9ad5…` is FaucetHunter's address — the faucet that posted
      the 1,000 $CLAIM escrow — so a faucet's mining history now displays
      against somebody else's wallet.

      Keying lifetime output to the node is defensible on its own; printing it
      next to a wallet address is what makes it read as a claim about that
      wallet. Three ways out, and this is a decision: reset the counter to match
      the ledger and accept that history before 24 September is gone; drop the
      column and compute from `mining_rewards` every time, which cannot drift
      because there is nothing to drift from; or keep it and label it as the
      node's lifetime, not the wallet's.

      The design previews already take the third-party-safe route: `network.html`
      shows the ledger figure and says on screen that the two disagree. The app
      still shows the counter.

- [ ] **The program's keypair lives where `cargo clean` deletes it.**
      `faucetchain/target/deploy/faucetchain-keypair.json` is the keypair for
      `64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm` — verified by deriving its
      pubkey on 3 October, not assumed from the filename. It sits inside
      `target/`, which `faucetchain/.gitignore` ignores, so it exists in exactly
      one place on one machine and in no backup.

      `cargo clean` is the most routine command in Rust and it destroys that
      file. Losing it means the program at that address can never be upgraded
      or redeployed again — and the address is in the whitepaper, in all 19
      published roots, in every explorer link, and in the submission draft.
      Nothing warns anybody: the directory looks like build output because it
      is build output, with one secret in it.

      **It must not be committed** — it is a private key, and the repository is
      public. What it needs is a copy somewhere durable and private: the
      RyusGero backup, a password manager, anywhere that is not a build
      directory. Whoever does it should also decide whether the upgrade
      authority should stay on this keypair at all, or move to a multisig
      before mainnet.

      Found while clearing 7.9 GB of build output on 3 October. The cleanup
      spared it because only `target/debug` was removed, which was luck about
      which subdirectory, not a decision about the key.

- [ ] **An API key works without a faucet registration.** Two keys have been
      used with no row in `faucet_registry` behind them: `0x7a9c4b1e8f3d…`,
      nine requests and enrolled in campaign 479079, and `0xb3dff5d3f802…`,
      one request. Neither owes any user anything, so retiring them costs
      nobody — measured 4 October, zero owed to zero users each.

      Reported from the FaucetHunter side as "three duplicate FaucetHunter
      registrations". That is not what the data says: `faucet_registry` holds
      exactly one FaucetHunter, `0x7dda72ad9ad5…`, and `/api/faucethub/faucets`
      reads only that table, so it cannot list three. The real shape is a key
      that outlives, or precedes, the registration it was issued for — which is
      more interesting, because such a faucet can post claims and never appear
      in the directory a user reads.

      Decide whether a key without a registration should keep working. Revoking
      `0x7a9c4b1e…` needs care: it is enrolled in a live campaign and has been
      used nine times.

- [ ] **The read ceiling on holdings is per IP, and every partner user shares
      one.** `HOLDINGS_HOURLY_PER_IP` is 120/h, and FaucetHunter's users all
      arrive through one tunnel, so the whole partner shares one allowance.
      FaucetHunter caches each user's answer for two minutes, which is what has
      kept it under the ceiling so far.

      It should be per API key: the key is what identifies a partner, and an IP
      identifies a tunnel. Worth doing before the partner's user base grows.

      One suspicion worth recording rather than asserting: this may already be
      biting. The partner reported `/api/solana/holdings` as empty for an
      account that in fact has four rewards worth 24.8M across both campaigns —
      verified 4 October by running the query. A 429 that a client treats as
      "no data" would look exactly like that.

- [x] **Decide whether the identity link is public.** **Decided and done
      8 October: it is not.** `GET /api/solana/link/{address}` now requires the
      session of the account it describes, and the browser sends it. The ledger
      stays public; the bridge between the two identities does not. What
      follows is the reasoning that produced that decision.

      `GET /api/solana/link/{address}` answered for any address with no
      authentication, returning the Solana wallet behind a FaucetChain account.
      The forward direction is public by construction — the account is keccak
      of the wallet, so anyone holding a wallet computes it. The reverse is
      infeasible to compute, and this endpoint hands it over. Together with
      `/holdings` and `/microclaim/balance`, which also answer about any
      address, it profiles an account: what it earned, from which faucets, in
      which campaigns, and which Solana wallet it points at.

      Public balances are consistent with a public ledger and I would defend
      them. Correlating the two identities is a different thing, and it should
      be a decision somebody made rather than something that happened. If it is
      meant to be public, say so on the screen where people link. If not, that
      endpoint needs a session, and the owner always has one.

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
- [x] **A tunnel, with the localhost exemption off.** Done. `ngrok http 8010`
      against the reserved domain, and `RATE_LIMIT_TRUST_LOCALHOST=0` has been in
      `.env` since 18 September — behind a proxy on the same host every
      caller arrives as 127.0.0.1, so leaving it on would switch rate limiting
      off for the whole internet at the exact moment the API stops being local.

      It was true and unticked for ten days, which is its own small lesson: an
      unticked box costs somebody a re-check every time they read the list, and
      this one got re-checked on the day the deadline was being counted.
- [x] **Register FaucetHunter.** Done 24 September against the local API; the
      key is the one that goes into `FAUCETCHAIN_KEY` on their host. The exact
      call the PHP makes was then made by hand: 200 with `user_address` and
      `campaigns`, the derived account matching what that wallet reaches by
      signing in, and a second immediate call answering 429.
- [x] **Enrol it in a campaign that is funded for real — a new one.** Done 28
      September: campaign 479079, vault holding 50,000 tokens on devnet,
      enrolled in `0x7dda72ad...d40c6ef3` — the registration the bridge
      actually calls.

      It had been enrolled in `0x7a9c4b1e...5a09`, a registration the bridge
      stopped using, so every claim for days credited $CLAIM and drew nothing
      from any sponsor. Both halves looked finished — the faucet registered and
      paying, the campaign funded and readable on chain — and the row between
      them named an address neither side used. Nothing errored, because an empty
      `campaigns` list is the correct answer for a faucet enrolled in nothing.

      The exact call the PHP makes now answers
      `campaigns: [{campaign_id: 479079, amount: 694384, funding: "vault"}]`.

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
- [x] **Take the sequencer down on purpose** and confirm the faucet still pays.
      Done 1 October. The partner is protected, and the protection is the
      ordering: `claim.php` commits before it calls the bridge, so the user is
      paid whatever happens next. Every failure path in the bridge returns null
      and none of them throws, and `claim.php` wraps the call in its own catch
      anyway.

      `test_partner_survives_outage.py` pins all three — the ordering read out
      of PATCHES.md, the four failure paths read out of the bridge, and the
      timeout budget measured against a dead port. It is the only test here that
      protects somebody else.

      **It also found a sentence that was not true.** The AI corpus claimed the
      bridge had "a circuit breaker that stops trying while FaucetChain is
      unreachable, so a claim on its side is paid in milliseconds". There is no
      circuit breaker in `faucetchain.php` — no cache, no backoff, no mention.
      Measured with the sequencer stopped on purpose: **2.01 seconds per call,
      against 0.005 with it running.** The user is still paid; their page is
      just slower, on every claim, for as long as the outage lasts. The corpus
      now says the measured number.

- [ ] **Give the bridge a circuit breaker.** Six lines of core PHP: a file whose
      mtime is touched on failure, skipped entirely while it is fresh. It would
      take the partner's cost from 2 seconds on every claim to 2 seconds on the
      first one. Not written yet because PHP does not run on this machine, and
      untested PHP going into somebody else's production is how you repay a
      favour badly. Worth doing with them watching, not alone.
- [ ] **A field on FaucetHunter where the user types their Solana address.**
      The column exists and the bridge reads it; nothing yet writes it. Without
      this the integration is complete and pays nobody, which is the least
      obvious way for all of the above to look finished and be useless.
- [x] **Publish a root for a live partner campaign.** Done 1 October.
      Campaign 479079, batch 19, root
      `0x8aaa6330eea37d1411de38bb2051d89438dd3a5a0421d072638df518ed9532d4`,
      one leaf, 347,221 units, signature
      `4z4MWkBG94UWSZDaYo5i77FTQ4krBg3qmUJ4pTA3xpZ7E262pKVx5qz8od4kb9nkkXBPjYFMCvp3vszgGBbBGLvW`.

      Read back off devnet rather than from our own books: the root account
      `6KhrZLcdFwCENDnqvyRLNRHMHNG4suajjSrfMzTmaV9W` holds 109 bytes, the
      campaign now reads `committed=347221 paid=0 root_count=1`, and the vault
      still holds its 50,000. The reward no longer depends on this server —
      whoever holds the proof withdraws straight from the vault.

      Two things turned up on the way, neither fatal and both worth knowing.

- [x] **`publish_root.py` does not load `.env`.** Done 3 October, with the
      same block `api_server.py` uses, so the real environment still overrides
      the file and a missing `dotenv` does not stop the script. Verified by
      importing it and reading the three variables back.

- [ ] **The treasury's share still does not become a leaf.** Campaign 479079
      owes the treasury 607,504 units and batch 19 went out with a single leaf.
      The cause is narrower than the known gap suggests: `_flush_treasury_share`
      returns early on `SETTLEMENT_TREASURY_SOLANA`, which is absent from
      `.env` — but the treasury's `solana_links` row **does** exist, written by
      an earlier run. The code reads the variable, not the book, so the debt
      sits there while the address it needs is already in the database.

      Same shape as the 9,999,566 units stranded on campaign 478840. Setting
      the variable would flush both on the next batch, which is why it should be
      done deliberately and not in passing.

- [x] **A real user links a Solana wallet and withdraws.** Done 1 October.
      A click on faucethunter.net became 0.370305 FaucetHunter Rewards in
      `2uVvAhL7...SVSdY`, through a root the program would have refused had the
      vault not covered it. On chain afterwards: `paid=370305`,
      `committed=370305`, and a second attempt answers *That reward has already
      been withdrawn*.

      The arc is closed: web2 click, campaign draw, Merkle leaf, published root,
      withdrawal, with the guarantee on Solana the whole way and the user never
      holding SOL.

- [ ] **Decide the withdrawal minimum from the cost, now that there is one.**
      That withdrawal cost the relayer 1,573,440 lamports, read off the chain
      rather than estimated:

      | rent for the token account | 1,488,440 | **95%** |
      | priority fee (the wallet's choice) | 75,000 | 4.8% |
      | base fee, two signatures | 10,000 | 0.6% |

      The fee everyone quotes when they say Solana is cheap is 0.6% of it. The
      rent is the bill, and it is **once per user per token** — so the cost of
      serving people scales with new wallets, not with clicks. A thousand clicks
      from one person cost 0.0015 SOL; one click from a thousand people costs
      1.5 SOL.

      At 0.7954 SOL the relayer can serve 530 more first-time recipients and
      then stops. At $200 a SOL that is $0.30 each, against a reward of 0.37
      units of a token with no market price.

      `GET /api/solana/relayer` reports this from `relayer_spend`, which the
      withdrawal path now writes before sending; the three parts are
      deterministic at signing time, so none of it is a guess. The 1 October
      withdrawal was backfilled from the chain.

      What is open is a product decision, not a repair: **what minimum makes
      sense when delivery costs $0.30 a head?** `MIN_WITHDRAW_AMOUNT` is 10.0
      and governs $CLAIM; campaign tokens have no minimum at all, which is how a
      0.37-unit reward ended up costing more to deliver than it plausibly
      carries. Note the rent is a deposit rather than a cost — it unlocks if the
      account is ever closed, which in practice nobody does.

- [ ] **A real user links a Solana wallet and withdraws.** Everything the
      machines can do is done, verified 1 October against the published root:
      the proof endpoint returns leaf 0 of root `0x8aaa6330...` for 347,221
      units, the chain's own bitmap says it is unclaimed, and the relayer builds
      the transaction and offers to pay the fee from
      `8G3hqGyHZLHLUQhmRayMR3bZ6kiXSGhUo7gAAEu8pa3w`, which holds 0.797 SOL.

      What is left cannot be done here, and that is the design working: the
      withdrawal needs a signature from `75vW4Hnh...QT3SDnE`, and nobody on this
      machine holds that key — not the operator keypair, not the relayer, not
      the one in WSL. It lives in somebody's Phantom. One signature on the
      payouts screen finishes it.

- [ ] **A real user links a Solana wallet and withdraws.** The only proof that
      matters: a click on somebody else's faucet became a token in a wallet,
      with the guarantee on chain, from a person who never held SOL.
- [x] **Two mining nodes online.** Done 27 September, and it taught more than
      it delivered. The node was asking for 840 calls an hour against a ceiling
      of 300 and swallowing the 429s as success, so it printed MINING while the
      server had it offline. Explore now runs every 30s and a 429 is an error
      the operator sees. `NODE_ID_FILE` and `NODE_TOKEN_FILE` let a second node
      share a machine without colliding on `.node_id`.

      **The draw is real and it decides nothing.** The election is recomputable
      from the parent hash, it has two participants, and the queue it elects
      somebody to seal has been empty since 18 September. Only the browser Proof
      of Claim creates blocks; the partner bridge credits off-chain by design.
      The mining screen says all of this now, including the 99.98/0.02 split
      that one staked node and one unstaked node actually produce.

      **Balancing the stake to make that chart look better was refused.** With
      11,934 $CLAIM in existence it would have meant minting some so a graph
      read 50/50, which is the same staging this repository spent a week
      removing.
- [ ] **Two mining nodes online during the demo.** The sealer election is real
      and currently has no participants. The header said "Hybrid PoC-V3
      Consensus" while nothing was sealing; on 27 September it started saying
      Micro-Distribution Rail, which is what runs. `mining-node/` is a Node process;
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

## The sealer, after the deadline

Modelling against Al-awamy et al. (2025) said the unit of work here is a human
gesture rather than a machine's. Running two nodes said something narrower and
more uncomfortable: the sealer does no work at all.

- [ ] **Give the sealer the settlement batch.** It now seals blocks of merit
      claims: the draw over the parent hash decides who may close the block and
      refuses everyone else for 60 seconds, and block 24 was sealed that way on
      29 September with a freshly proved claim inside. What it still does not
      touch is the batch that carries value -- closing it and publishing its
      root are the operator's, and that is the asymmetry worth closing.

      It remains paid for presence: the epoch reward is split by uptime, not by
      blocks sealed. Both are true, and saying only the first described a system
      emptier than the one that runs.

      The original note, kept because it was accurate for eleven days: it is
      paid for presence and elected to seal a queue that is
      empty. If the elected node closed the settlement batch and published its
      root, the election would decide who does the one thing this network
      actually does, and the reward would be for work rather than for having a
      tab open. That is a design change, not a tuning change, and it is the
      honest answer to why the draw feels ceremonial.
- [ ] **Revisit the stake ceiling once nodes exist to measure.**
      `SEALER_STAKE_CAP = 10000` is a guess, and with the real distribution —
      one node at 5,500 and one at 0 — it does not bind at all. No curve fixes
      that: a ceiling of 100 still gives 99.02%, and `1 + sqrt(stake)` gives
      98.69%. One staker against one non-staker is lopsided under any
      stake-weighted rule, because that is what stake weighting means.
      Decentralisation comes from several nodes with comparable stake, and the
      number should be chosen from what those nodes hold.

## Before mainnet

Not work for the deadline. A **gate**: the numbers below are deliberately
generous because this is a simulator on devnet, where a reward small enough to
be prudent is also small enough to be invisible on camera. Every one of them is
wrong for real money, and none of them will announce itself.

Decided 2 October, with the exposure measured rather than estimated.

- [ ] **What happens when the 99M cap is reached.** Today: nothing graceful.
      `distribute_epoch_rewards` returns `max_supply_reached` and uptime
      rewards simply stop. At the current constant pool of 1,695 $CLAIM an hour
      that is 14,848,200 a year, so the cap arrives in about 6.7 years and the
      network falls off a cliff on an ordinary Tuesday.

      This is the question the halving was trying to answer, and the halving
      was never built — it only existed as a chart in `Tokenomics.tsx`, three
      contradictory numbers in `i18n.ts`, `KnowledgeBase.ts` and
      `Whitepaper.tsx`, and nowhere in the server. All of that was removed on
      8 October rather than implemented, because changing an emission schedule
      four days before a deadline is a worse idea than admitting there isn't
      one.

      The real options, for after the hackathon: a decay on the hourly ceiling
      so emission asymptotes instead of stopping; or fees and treasury yield
      taking over as the subsidy falls, which is what the whitepaper already
      implies by funding rewards from staking rather than from issuance. The
      second fits what is already built. Neither is decided.

- [ ] **`FLOOR_USERS`, now 30, back to 100 or higher.** The rate is divided by
      whichever is larger, the real number of active users or this floor. At 30
      a nearly empty campaign pays 0.6173 per click instead of 0.1852.
- [ ] **`PARTICIPATION_FLOOR`, now 0.01, raised toward
      `DEFAULT_PARTICIPATION`.** This one is the trap. Participation is
      measured, and it sits in the *divisor*, so thin traffic does not lower
      the rate — it multiplies it. On 2 October the previous day held one click
      by one user, participation measured 0.0035, clamped to 0.01, and the rate
      came out **ten times** the figure the default would have given. The
      measurement is honest; the floor is what turns an unmeasurable sample
      into a tenfold multiplier.
- [ ] **The monthly caps, now 40,000 FHR on 652608 and 10,000 on 479079.**
      Raised on 2 October for the demonstration. Note that `month_budget`
      adds the rollover on top: 652608 carries 19,993 unspent from September,
      so the allowance in force is 59,993, not 40,000.
- [ ] **`min_withdraw`, 5,000,000 on both campaigns, re-priced.** Five units at
      six decimals is a guess at a token with no market. Delivery costs
      1,488,440 lamports of rent the first time a person touches a token; the
      minimum has to clear that in whatever the token is actually worth.

- [ ] **The Merkle tree has no domain separation between a leaf and an internal
      node.** Found 3 October by the Trail of Bits Solana scanner's sweep, as an
      observation outside its six patterns. Nothing prefixes a leaf with `0x00`
      and a node with `0x01`, so `verify_proof` on its own accepts an internal
      node handed in as a leaf — demonstrated, and now pinned by
      `an_internal_node_passes_as_a_leaf` in `merkle.rs`.

      **It is not exploitable today**, and the reason matters more than the
      fact: `claim_reward` computes the leaf from the signer, the amount and the
      index rather than accepting one, so forging a claim needs a 44-byte keccak
      preimage matching a 32-byte node. The safety lives in
      [claim_reward.rs](faucetchain/programs/faucetchain/src/instructions/claim_reward.rs),
      not in the tree — which means any future instruction that takes a leaf as
      an argument reopens it in full, and no constraint elsewhere would catch
      that.

      Why it is a mainnet gate and not a fix: a prefix changes every root,
      including the **19 already published**. Campaign 479079 has 347,221 units
      sitting in a published root that a real wallet can withdraw today; change
      the hash and that proof stops verifying. On devnet the roots are
      disposable, so the right moment is the migration, with the appchain's
      `leaf_hash` in settlement.py moving in the same commit and a version field
      on `RewardRoot` if old roots must stay claimable.

**What the three multiply to, today.** One person, clicking the maximum 288
times, on a campaign with nobody else in it and traffic thin enough to hold
participation at its floor, takes **2.67 times the entire day's allowance** —
`distribution.py` pins that figure in `_self_check`, so it fails loudly if
either floor moves. At the 100-user floor and the default participation the
same person takes 10%. The floor exists to stop one visitor walking off with a
fifth of the month; at these settings it no longer does, and that is a choice
that makes sense on devnet and nowhere else.

---

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
