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
   frozen against later relinking.
6. **`publish_root(index, root, total_amount, leaf_count)`** — the operator
   publishes the root. The program refuses it unless
   `vault.amount >= committed - paid + total_amount`. Proof of reserve is
   enforced here, not reported by the server.
7. **`claim_reward(leaf_index, amount, proof)`** — the user withdraws. A receipt
   PDA is created for that leaf, so a replay fails on the account already
   existing. `payer` is a separate signer from `recipient`, so a relayer covers
   the fee and the rent for a user holding no SOL.
8. **`withdraw_surplus(amount)`** — the partner takes back what the vault holds
   above `committed - paid`. A reward inside a published root was never part of
   the surplus. **`close_campaign()`** stops new roots without touching the
   vault.

## What a wallet asks you to sign

Five actions need a signature: claim, withdraw, stake, unstake and linking a
Solana wallet. A sixth sentence is signed by the Solana wallet itself. All six
share one shape, because a wallet displays the message verbatim and the person
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

Before either step, it asks the chain whether the receipt account for that leaf
already exists. If it does, the reward was collected and the program would
reject the transaction — refusing here means not paying a fee to be told so. The
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
| Campaign | `"campaign"`, sponsor, campaign_id LE | sponsor, operator, mint, funded, paid, committed, root_count, closed |
| Vault | `"vault"`, campaign | the partner's tokens, authority is the campaign |
| RewardRoot | `"root"`, campaign, index LE | root, total_amount, claimed, leaf_count, published_at |
| ClaimReceipt | `"receipt"`, reward_root, leaf_index LE | root, recipient, amount, claimed_at |

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
- `scripts/check_messages.py` — transpiles `utils/actionMessage.ts` with esbuild
  and compares all six signed sentences against the Python ones, byte for byte.
- `scripts/build-program.sh` — carries two toolchain quirks: Agave 4 refuses
  SBPF v0, so the build targets Anchor's v3 default, and `cargo-build-sbf`
  breaks when it finds its SBF toolchain already linked.

## Known gaps

These are open on purpose, not oversights:

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
  withdrawal it built, and it now checks the receipt account first so an
  already-collected reward costs nothing to refuse. What is left is volume: a
  caller with many unclaimed leaves can still make it pay for all of them at
  once, which is a spending pace question rather than a hole.

## Change log

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
