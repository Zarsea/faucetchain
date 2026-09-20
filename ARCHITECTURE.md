# Architecture

The document of record for how FaucetChain is put together. It is updated
whenever the infrastructure changes — the log at the bottom says when and why.

## Two layers, one root between them

FaucetChain used to be a single appchain that both distributed rewards and
promised to pay them. The promise was the weak half: a user could earn a balance
for weeks and find out at withdrawal that the operator never held the money.

The Solana integration splits those jobs.

| | The appchain (`api_server.py`) | The Solana program (`faucetchain/`) |
| --- | --- | --- |
| Runs | one sequencer, FastAPI + SQLite, chain id 7777 | Solana, program `64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm` |
| Handles | thousands of tiny claims an hour, proof of claim, hourly quota, IP caps, Sybil detection | custody of the partner's budget and every payout |
| Cost per action | none | a transaction, paid by a relayer |
| Can be wrong about | who earned what | nothing that moves money it was not shown a proof for |

The only thing that crosses between them is a 32-byte Merkle root. Partner funds
never traverse a bridge: they enter the campaign vault and leave it to users.
There is no wrapped asset, no custodian in the middle, and no message that, if
forged, mints anything.

## The payout, step by step

1. **`create_campaign(campaign_id, operator)`** — a partner opens a campaign.
   The campaign PDA records the sponsor, the operator allowed to publish roots,
   the mint, and the running totals. A vault token account is created with the
   campaign PDA as its authority.
2. **`fund_campaign(amount)`** — the partner moves tokens into the vault. Only
   the sponsor's own token account is debited.
3. Users earn on the appchain. Rewards owed in a campaign are rows in
   `settlement_rewards`, credited through `POST /api/solana/reward` by the
   operator.
4. A user links the Solana wallet that will receive the payout
   (`POST /api/solana/link`). This takes **two** signatures over two different
   sentences: the FaucetChain key signs `Link Solana` under the same EIP-191
   scheme every other action uses, saying which wallet was chosen, and the
   Solana wallet signs a second, different sentence with ed25519, saying who
   holds its key. Neither signature can stand in for the other, and the
   wallet proof carries its own timestamp — a custodial account signs no EIP-191
   message at all and would otherwise arrive with none.

   That second sentence is written to be read, not parsed, because the wallet
   shows it verbatim to whoever is approving it:

   ```
   FaucetChain: prove you control this wallet

   Signing links your FaucetChain account to this Solana wallet so rewards can
   be paid to it. It costs nothing and authorises no transaction.

   Account: 0x...
   Wallet: ...
   Chain: 7777
   Issued: 2026-09-17T04:12:09Z
   ```

   Both sentences come from the shared builders described below.
5. **`POST /api/solana/batch`** closes a batch: every unbatched reward from a
   user with a linked wallet goes into one Merkle tree, summed per wallet. The
   wallet each reward was built for is written onto the row, so the batch is
   frozen against later relinking. Whatever the treasury is owed on that
   campaign joins as one more leaf — one per batch, not one per click — so it
   travels under the same root, the same proof and the same reserve check as any
   user's reward.
6. **`publish_root(index, root, total_amount, leaf_count)`** — the operator
   publishes the root. The program refuses it unless
   `vault.amount >= committed - paid + total_amount`. Proof of reserve is
   enforced here, not reported by the server. A second refusal covers pace:
   the reserve check proves the vault can pay but says nothing about how fast,
   so one root could promise everything the vault holds and still pass. If the
   sponsor set a period ceiling, `total_amount` must fit inside what that
   period has left.
7. **`claim_reward(leaf_index, amount, proof)`** — the user withdraws. The
   leaf's bit is set in the root's bitmap, so a replay fails on a bit that is
   already set. `payer` is a separate signer from `recipient`, so a relayer
   covers the fee for a user holding no SOL.
8. **`withdraw_surplus(amount)`** — the partner takes back what the vault holds
   above `committed - paid`. A reward inside a published root was never part of
   the surplus. **`close_campaign()`** stops new roots without touching the
   vault.

## What a wallet asks you to sign

Eight actions need a signature: claim, withdraw, stake, unstake, linking a
Solana wallet, showing a faucet's API key, rotating one, and naming a FaucetPay
account. A ninth sentence is signed by the Solana wallet itself. All nine share
one shape, because a wallet displays the message verbatim and the person
approving it deserves to know what they are agreeing to:

```
FaucetChain: <what this does>

<one plain sentence on what signing does, and what it does not do>

<Label>: <value>          one per fact
Chain: 7777
Issued: 2026-09-17T04:12:09Z
```

Each action used to build its own pipe-separated line at the call site, which
read as jargon in the wallet and gave five separate chances for the browser and
the server to disagree about a byte.

That disagreement is the danger worth designing against: the signature then
verifies against a different sentence, and the server answers *invalid
signature*, which sends you hunting through keys and encodings instead of
looking at a missing space. No ordinary test catches it, because each side is
self-consistent.

So there is one builder per side — `settlement.py` and `utils/actionMessage.ts`
— and two guards. `settlement.py`'s self-check pins the sha256 of the wallet
proof sentence. `scripts/check_messages.py` transpiles the real TypeScript with
the esbuild the frontend already ships, runs it, and compares all six sentences
against the Python ones byte for byte.

## The relayer

A user who earned fractions of a cent does not hold SOL, and telling them to buy
some before they can collect defeats the point. `claim_reward` therefore takes
the fee payer as a signer separate from the recipient, and the sequencer runs
the service that signs as that payer.

It only ever signs a transaction it built itself:

1. `POST /api/solana/relay/prepare` returns the unsigned withdrawal, with the
   relayer already in the fee payer slot.
2. The user's wallet adds their signature. Nothing else about the transaction
   is theirs to change.
3. `POST /api/solana/relay/submit` rebuilds what it expects — one instruction,
   for this program, this data, these accounts, this fee payer — and compares
   byte for byte before adding its own signature.

Before either step, it reads the reward root and tests that leaf's bit. If it is
set, the reward was collected and the program would reject the transaction —
refusing here means not paying a fee to be told so. The
same answer is what tells the screen a reward reads as collected. When the chain
cannot be reached the withdrawal goes through anyway: the program is the real
guard, so an unreachable RPC costs a wasted fee at worst and must not stop
anyone from collecting.

So the relayer's key cannot be turned into a general-purpose payer: a forged
instruction, a tampered amount, a second instruction smuggled behind the
withdrawal, an unsigned transaction and a batch belonging to someone else are
each refused before anything is sent. Those five refusals are tests, not
claims.

## The tree

Both sides build the same tree or nothing works:

```
leaf   = keccak256(recipient_pubkey ‖ amount u64 LE ‖ leaf_index u32 LE)
parent = keccak256(left ‖ right)      direction from the index bit
odd level duplicates its last node
```

The combination rule is the one `compute_merkle_root_and_proof` already used in
`api_server.py`; only the leaf is new, because it carries the amount. The Rust
(`programs/faucetchain/src/merkle.rs`) and Python (`settlement.py`)
implementations each pin the same fixed vector in their own tests, so a change
to either rule breaks both test suites rather than breaking withdrawals in
production.

Leaves are ordered by recipient address, not by insertion, so anyone auditing a
batch rebuilds the same tree without knowing the order rows were written in.

## Addresses

Every account the program owns is a PDA, so nothing depends on a key someone
has to keep.

| Account | Seeds | Holds |
| --- | --- | --- |
| Campaign | `"campaign"`, sponsor, campaign_id LE | sponsor, operator, mint, funded, paid, committed, root_count, closed, period ceiling (cap, length, start, spent) |
| Vault | `"vault"`, campaign | the partner's tokens, authority is the campaign |
| RewardRoot | `"root"`, campaign, index LE | root, total_amount, claimed, leaf_count, published_at, one bit per leaf |

## What the operator can and cannot do

The operator key signs `publish_root`. It is the sharpest thing in the system,
so it is worth being exact about its blast radius.

**It can**: publish a root that pays anyone it likes, up to the reserve the
vault covers. A compromised operator key can therefore redirect rewards that
have not been published yet.

**It cannot**: withdraw from the vault, pay more than the vault covers, pay the
same leaf twice, change a root once published, or touch a campaign it is not the
operator of. The sponsor cannot do any of those either, and cannot take back a
token already inside a published root.

Every limit above holds only while the deployed code is the code described here,
and the upgrade authority is what decides that. Whoever holds it can replace the
program, including the checks that guard the vault — it outranks the operator
key by a wide margin. **Decided 2026-09-16: it stays with the team through the
event, so a bug found during judging can be fixed, and the README says plainly
that it will be revoked or moved to a multisig afterwards.** An authority that
is documented can be reasoned about; one that is quietly held cannot.

Nothing about that has to be taken on faith. `GET /api/solana/ledger/{id}`
reads the campaign account, its vault and every published root straight from
Solana and returns what they say — the sequencer only supplies the addresses,
which are derived from public seeds. When the chain cannot be read the endpoint
says so instead of falling back to its own numbers, and the screen says the
figures are a claim rather than proof.

The appchain database is not a trust boundary for money. If it is lost or
tampered with, the roots already on Solana still pay exactly what they promised,
to exactly the wallets they were built for — the proofs can be rebuilt from the
chain and any copy of the reward rows.

## Who is allowed to act without signing

Every action that moves value passes `require_action_signature`, which demands
an EIP-191 signature from the wallet that owns the acting address. One group is
exempt: **custodial accounts**, whose keys this server holds, created by
`/api/auth/register` or `/api/auth/guest`. They are rows in `users` with a real
`0x` address, and the exemption is sound because the server is the signer.

Membership in that group is decided by `is_custodial_address`, and it is a trust
boundary rather than a convenience. It answers True only for an address found in
`users`. Anything that is not a well-formed address answers **False** — not an
account at all. It used to answer True, which meant sending a string in place of
an address skipped every check; the fake "Sign in with Google" button minted
exactly such strings in the browser. A regression test now sends an invented
identity and a well-formed address nobody registered, and expects 401 from both.

## Data on the appchain

| Table | Purpose |
| --- | --- |
| `settlement_campaigns` | campaign_id -> sponsor and mint, so one sequencer can serve several partners |
| `solana_links` | FaucetChain account -> Solana wallet, one row per user |
| `settlement_rewards` | campaign, user, amount, batch_id, and the wallet the batch was built for |
| `settlement_batches` | campaign, root_index, root, totals, and the signature that published it |

A closed batch is immutable, so the tree rebuilt for a proof request is cached.
Only a tree that matched its published root is ever cached: serving a proof from
a different tree would make a user spend a fee on a transaction the program
rejects.

## Tooling

- `settlement.py` — builds a batch: leaves, root, proofs. No dependencies beyond
  keccak.
- `solana_settlement.py` — every instruction encoder and the RPC plumbing, keyed
  off the IDL the build emits, so a client cannot drift from the compiled
  program.
- `publish_root.py` — the operator's command for step 6.
- `scripts/demo_settlement.py` — the whole flow against a running program;
  nothing mocked.
- `scripts/demo_drip.py` — the half in front of it: a partner budget draining
  through a faucet as people click. Appchain only, so it needs no validator.
- `reconcile.py` — five sentences about the ledger that must be true, checked
  against the same definitions api_server uses. Runs on a live database, and in
  CI as a self-check where each invariant is shown catching the defect it was
  written for. The API suite ends by reconciling the database it just built.
- `scripts/check_messages.py` — transpiles `utils/actionMessage.ts` with esbuild
  and compares all six signed sentences against the Python ones, byte for byte.
- `scripts/build-program.sh` — carries two toolchain quirks: Agave 4 refuses
  SBPF v0, so the build targets Anchor's v3 default, and `cargo-build-sbf`
  breaks when it finds its SBF toolchain already linked.

## Known gaps

These are open on purpose, not oversights:

- **A custodial account has no per-request authentication.** Since external
  wallets were dropped as a login method, every account is custodial, and
  `require_action_signature` waves those through because the server holds their
  key. But nothing proves the caller *is* that account: knowing the address is
  enough. Demonstrated against a running server — a withdrawal posted for
  somebody else's guest account, to a faucet address of the caller's choosing,
  passed authentication and stopped only at the balance check. The fix is a
  session token issued by `/api/auth/guest`, `/register` and `/login`, and
  required on every balance-moving route. **This is the sharpest open item in
  the system.**

- **Unclaimed rewards sit in the vault forever.** `withdraw_surplus` cannot
  touch them, by design. **Decided 2026-09-16: a claim deadline goes in the
  whitepaper now, the on-chain expiry after the event.** Writing the policy
  first is deliberate — the answer is what gets asked about, and shipping an
  expiry path would mean reopening the one part that is already proven end to
  end.
- **Token-2022 mints with a transfer fee would break the accounting.** The vault
  would deliver less than the leaf promises while `paid` records the full
  amount. Campaigns should be restricted to plain SPL mints until this is
  handled.
- **The proof endpoint has no rate limit.** The cache removes the repeated cost,
  but the first request on a large batch still costs real CPU — about 0.7s for
  ten thousand leaves.
- **The relayer has no rate limit.** It refuses to sign anything but a
  withdrawal it built, and it checks the leaf's bit first so an
  already-collected reward costs nothing to refuse. What is left is volume: a
  caller with many unclaimed leaves can still make it pay for all of them at
  once, which is a spending pace question rather than a hole.

## How a partner budget is dripped

A partner project funds a campaign and the budget is spread through the faucets
on the network instead of dropped at once. An airdrop is a single event, which
is why people farm it and leave; a drip is a reason to come back. The same click
pays twice — `$CLAIM` for the work, and the partner's token from their budget.

`distribution.py` holds the arithmetic and nothing else: no database, no clock
beyond what the caller passes. Three rules carry it.

**The floor.** The rate is computed against at least 100 users however few are
present. Without it a new faucet with five users hands each a fifth of the
month, which ruins the partner and draws anyone farming an empty faucet.

**The rollover.** What a month does not spend joins the next. A budget that
expires pushes an operator to inflate clicks on the last day.

**The ceiling binds at credit time, not at publication.** The program refuses a
root the vault cannot cover, and a refused root pays nobody in the batch. So
`credit()` never returns more than the budget still holds.

Participation — the share of possible claims people actually make — is measured
from yesterday's traffic rather than assumed, because a campaign whose users
claim twice a day and one whose users claim hourly cannot share a constant.

Enrolment belongs to the campaign: `POST /api/solana/campaign/{id}/faucets`
declares where it wants to appear. A faucet cannot opt itself into somebody
else's budget.

**A funded campaign and a deferred one are different things.** `funding` is
either `vault`, meaning the money is already there and withdrawable, or
`deferred`, meaning the project settles at mainnet and the user holds a record
of work rather than money. The second is the failure mode this project exists to
fix, so the two must never be presented alike.

## The FaucetPay link, and what it is not

A partner faucet's developer can name the FaucetPay account behind their
faucet. `faucetpay.check_address` asks FaucetPay whether a payout address
belongs to a registered account and gets back that account's **user hash** —
which is the join key nothing here had before. Twenty-three API keys said
nothing about how many people stood behind them; a hash groups them.

The link has two states, and collapsing them would be the whole bug:

- **Named.** check-address recognised the address. That is all it means.
  Anybody can type anybody's payout address, so a named account proves nothing
  and pays nobody.
- **Proved.** A payment arrived from that account carrying an amount nothing
  else had open, inside the window. FaucetPay has no escrow and no delegated
  authorisation, so an incoming payment is the one thing a third party cannot
  forge. `faucetpay_proved_at` is null until then, and `/faucetpay/devs` counts
  only proved accounts, reporting the named ones separately.

Two things this deliberately does not do:

- **It never holds a developer's FaucetPay API key.** That key is a bearer
  credential with no scope and no spending limit: it would drain their whole
  balance, in every currency, to any address. If FaucetChain ever pays out
  through FaucetPay, it pays from an account of its own.
- **A FaucetPay balance is never a proof of funds.** `/balance` is read with
  our own key, so publishing it is a self-report, and the balance is neither
  segregated nor encumbered — it can be spent a second after it is shown. The
  guarantee stays where it can be checked by someone else: the root on Solana,
  which the vault refuses to publish if it cannot cover it.

The one seam not yet run against the live service is the incoming payment.
FaucetPay takes money in through merchant checkout, whose callback is not wired
here, so `/faucetpay/prove` takes the observed payments from the operator and
runs the same `match_proof` the callback will call. Wiring it later changes who
supplies the list and nothing else.

## Change log

**2026-09-20 — an API key stopped being public.** `GET /api/faucethub/my-key`
returned a faucet's live API key to anyone who knew its wallet address, and
`GET /api/faucethub/faucets` publishes that address; `POST /regenerate-key`
issued a fresh one on the same terms, cutting the real owner off in the
process. Both now go through `require_action_signature`, the key moved to
`POST /reveal-key` so it never sits in a URL, and `my-key` returns counters
only. `test_faucetpay_identity.py` fails if either gate is removed. Phase one
of the FaucetPay work lands with it: identity, and not a cent of movement.


**2026-09-18 — a click draws the campaign budget.** `distribution.py` prices a
claim from the budget, the days left, the active users and measured
participation, with the 100-user floor and month rollover. `_campaign_drip`
credits every campaign the faucet is enrolled in, splitting 80/20 between the
user and the treasury, which stakes its share rather than selling it. The two
halves that had never met — micro-claims on the appchain, rewards on Solana —
are now joined at the click.


**2026-09-17 — the documentation stopped saying Solidity.** A sweep found the
EVM story surviving in places a reader meets before any markdown file: the
in-app whitepaper called the stack "Solidity ^0.8.24, OpenZeppelin" and listed
seven contracts; the L1 Contract tab showed a Solidity snippet as the core
protocol logic; the staking screen claimed each deposit mints an ERC-721; the AI
assistant's system prompt named Solidity as the architecture it advises on. All
now describe the two layers that exist. The master whitepaper was rewritten in
English, including how the network pays for itself. Fifteen EVM-era documents
moved to `legacy/docs/`, and seven stray build logs that had been committed by
accident were deleted.


**2026-09-17 — one way in, and it is not a wallet.** Connecting an external EVM
wallet was removed as a login method: payouts settle on Solana, so the only
wallet the product needs is the Solana one, linked from the payouts screen.
Guest and email remain. The consequence is recorded above: with no wallet
logins, every account is custodial, and custodial accounts are authenticated by
nothing more than knowing their address.


**2026-09-17 — one shape for every signed sentence.** Claim, withdraw, stake,
unstake and link now use the same readable format the wallet proof already had,
built by `settlement.py` and mirrored in `utils/actionMessage.ts`.
`scripts/check_messages.py` runs the real TypeScript against the real Python and
compares all six byte for byte, because drift between them surfaces as "invalid
signature" far from its cause.


**2026-09-17 — login stops inventing identities.** The Google button never spoke
to Google or to this server; it minted `google_<random>@faucetchain.io` in the
browser, and because that is not an address, every signature check was skipped.
It is now "Continue as guest", backed by `POST /api/auth/guest`, which creates a
real custodial account. `is_custodial_address` no longer trusts malformed input,
and two security tests that had been leaning on that hole now open real guest
accounts instead. `PASSWORD_SALT` is read from `.env`, which the server never
loaded, so account creation had been failing with a 500. The login modal also
moved into a portal: it lived inside the `glass` header, whose `backdrop-filter`
made it the containing block for fixed positioning, so the modal opened 238px
above the top of the screen.

**2026-09-16 — the wallet proves itself.** Linking now needs an ed25519
signature from the Solana wallet, not just the user's word that it is theirs.
This closes the gap that used to head the list below: a reward inside a
published root pays the address on its leaf and nothing can redirect it, so an
address entered wrong was money burned with no undo. Verification uses
`solders`, already a dependency, and the signature travels base64 so the browser
needs no base58 library. Six refusals are under test — no proof, the wrong
wallet's key, the right key attesting to a different address, an expired proof,
malformed bytes, and the accepted case.

**2026-09-16 — four decisions that were open.** Wallet ownership will be proved
by a signature from the Solana wallet, not just declared. A claim deadline for
unclaimed rewards is written as policy now and enforced on-chain after the
event. The upgrade authority stays with the team through the event and the
README says so. The demo runs on a test mint the team controls on devnet, so the
script does not depend on a third party answering in time.

**2026-09-16 — the ledger.** `GET /api/solana/ledger/{campaign_id}` decodes the
campaign, vault and reward-root accounts from Solana, so what a campaign holds,
owes and has paid can be read from the chain rather than from this server. The
Settlement Ledger screen shows it, with every address linking to the explorer.

**2026-09-18 — an address stops being a password.** The sharpest hole this
project had, and it was one line: `require_action_signature` returned
immediately for an account whose key this server holds, because such an
account cannot sign. That meant it proved nothing at all.

An address is public by design. It is printed on screen, it is in the
explorer, it is the thing you hand somebody so they can pay you. It was never
a secret and could not serve as one — yet it was everything standing between
a stranger and five actions: claiming, staking, unstaking, withdrawing, and
linking the wallet that receives payouts. The last is the worst of them. It
moves nothing on the way through, and afterwards every reward that account
earns is paid to somebody else.

Those accounts now act through a session. `POST /api/auth/guest`, `/login`,
`/register` and `/solana` each return a token, which travels in
`X-Session-Token` and is checked against the address acting. The token is
stored hashed, for the same reason a password table stores hashes: a copy of
the table should not be a set of live sessions. Sessions expire after a week
and expired rows are swept when the next one is issued.

A session that pasted an address rather than signing in still has no token,
and now gets a 401 that says so. That session is read-only, which it always
was in intent.

Two security tests broke on this, and broke for the right reason: they were
leaning on the hole to act as custodial accounts without proof. They hold
sessions now.

**2026-09-18 — sign in with a Solana wallet.** The access modal offered a guest
account and an email, both of which this server holds the keys to. A wallet is
now the third way in, and the only one where the account belongs to the person
rather than to us.

The FaucetChain address is derived from the public key — the last 20 bytes of
keccak256 over it, the way Ethereum derives an address from one — so the wallet
is the account. The same Phantom reaches the same account on any machine, with
no password to lose and no recovery flow to build.

The sentence signed at sign-in is `wallet_proof_message`, unchanged: it already
names an account and a wallet, and here the account comes from the wallet, so
it says exactly what happens. No new vocabulary, and nothing new for a reader
to understand before signing. `scripts/check_messages.py` now also compares the
derivation across the two languages, because a disagreement there fails exactly
like a mismatched sentence: the browser signs for one account and the server
checks another, and the error mentions signatures while the cause is arithmetic.

The browser asks `GET /api/auth/solana/{wallet}` which account it is signing for
before it signs. It cannot derive the answer: a wallet already linked somewhere
signs in there instead, and the sentence names the account, so signing the wrong
one produces a valid signature over the wrong words — which the server can only
read as a forgery. A rejected wallet proof is now an audit line carrying the
sentence the server built, because that failure is otherwise invisible from
either side.

A wallet already linked to some other account signs in to **that** account, not
to its derived one. Someone who linked Phantom from the payouts screen and
later signs in with it expects the balance they earned.

The link is written at sign-up, which removes a step that could be skipped: an
account used to be created with no wallet, and a reward earned before the visit
to the payouts screen had nowhere to go.

**2026-09-18 — a library stops raising SystemExit.** The Settlement Ledger
screen showed only "Failed to fetch", which is the browser saying nothing
useful. Two defects stacked into that.

`solana_settlement` is a library before it is a script, and it raised
`SystemExit` on a failed RPC. That reads well from a command line, but
`SystemExit` derives from `BaseException`, so the `except Exception` written
into the ledger endpoint precisely to degrade gracefully never fired. Reading a
campaign whose vault does not exist on the current chain — an ordinary thing
after switching between devnet and a local validator — became an unhandled 500.
The server already carried three `except SystemExit` patches, which were the
symptom. It now raises `ChainError`, an ordinary exception, and the patches are
gone; the two scripts that want a one-line exit convert it themselves.

The second defect hid the first: an unhandled exception skips the CORS
middleware, so the response carried no `Access-Control-Allow-Origin` and the
browser refused to read it. Any 500 looked identical to a network outage from
the screen. A global handler now turns an unhandled exception into an ordinary
JSON response, which the middleware then decorates.

**2026-09-18 — the treasury collects, and the sponsor sets a pace.** Two gaps
between what the design promised and what the code did.

The treasury's 20% was computed on every drip, returned in the API response
and credited to nobody. That was worse than an omission: the root carried only
the users' 80%, so `committed` grew by 80 while the appchain debited 100, and
`withdraw_surplus` — which reads surplus as whatever the vault holds above
`committed - paid` — let the partner take the difference back. The share meant
to fund continuity was returned to the partner who was supposed to pay it. The
treasury is now an ordinary recipient: `campaign_budget.treasury_owed`
accumulates it and one leaf per batch pays it, to the wallet in
`SETTLEMENT_TREASURY_SOLANA`, in the partner's token because that share is
staked rather than sold. With the leaf inside, the on-chain `committed` and the
off-chain `spent_total` agree for the first time.

The ratio stays in the sequencer rather than the program, deliberately: it is a
product number that may vary, and compiling it in would make every adjustment
an upgrade of the deployed code. If it should ever be fixed, the place for it
is a `user_share_bps` on the Campaign, set by the sponsor — by whoever put the
money in — and checked at publication.

The monthly cap was a SQLite row only this server could see, so a compromised
sequencer could publish one root draining the whole vault and the reserve check
would pass, because the vault did cover it. The Campaign now carries a period
ceiling the **sponsor** sets at `create_campaign`: `period_cap` over a rolling
`period_len`, zero on either meaning no ceiling. It is a rolling window and not
a calendar month because the program has a clock, not a calendar. It bounds the
blast radius to one period, which the sponsor can then stop with
`close_campaign` — already theirs, and it blocks new roots without touching
what is already promised.

The ceiling is a backstop, not the distribution policy: it must sit at or above
the sequencer's own monthly cap with rollover included, because a ceiling set
below the policy refuses an honest root, and a refused root pays nobody in the
batch.

**2026-09-18 — one bit instead of one account per withdrawal.** A withdrawal
used to create a `ClaimReceipt` PDA, and that account existing was the record
that the leaf had been paid. It cost 0.001118 SOL in rent, charged to the
relayer — on a network whose premise is claims worth fractions of a cent, the
receipt for a payment cost more than the payment, and a batch of ten thousand
leaves needed 11.18 SOL. `RewardRoot` now carries one bit per leaf, sized from
`leaf_count` when the root is published: the same batch costs 0.0070 SOL. The
withdrawal carries one account fewer, and the sequencer reads one account per
batch rather than one per leaf. The bitmap is what caps a batch at
`MAX_LEAVES_PER_BATCH` (8192, or 1024 bytes, inside the 10240-byte limit on an
account created through a CPI), which in turn caps a proof at 13 levels. A
busier campaign closes more batches rather than larger ones.

**2026-09-16 — the receipt check.** The relayer asks whether a leaf's receipt
account exists before signing, so a reward already collected is refused without
paying for the rejection, and `GET /api/solana/proof/{address}` carries a
`claimed` flag the screen uses. An unreachable RPC is now a 503 with a reason
rather than a stack trace.

**2026-09-16 — the relayer.** `POST /api/solana/relay/prepare` and
`/submit` let a user withdraw holding no SOL, with the sequencer signing as fee
payer for a transaction it built and verified. Campaigns are now registered in
`settlement_campaigns` with their sponsor and mint, which is what a withdrawal
needs to be built and what lets one sequencer serve more than one partner. The
IDL is committed at `faucetchain/idl/faucetchain.json` and rewritten by every
build, so clients encode against the program that was actually compiled.

**2026-09-16 — the Solana settlement layer.** Campaign vaults, reward roots and
Merkle-proof withdrawals on Solana; the appchain keeps distribution. Added
`withdraw_surplus` and `close_campaign` so funding a campaign is not a one-way
door. Batches now freeze the recipient wallet at close, after a relink was found
to cut a user off from a reward a published root already owed them. Build target
settled on SBPF v3 after Agave 4 refused a v0 binary at deploy.

**2026-09-15 — pre-hackathon hardening.** Server-side claim amounts, hourly
quota enforcement, difficulty that rises with quota use, an IP cap on wallets,
signed micro-claim withdrawals. The gambling DApp was removed from the product.
The EVM contracts moved to `legacy/`.
