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
   (`POST /api/solana/link`), signing the link with the same EIP-191 scheme
   every other FaucetChain action uses.
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

The appchain database is not a trust boundary for money. If it is lost or
tampered with, the roots already on Solana still pay exactly what they promised,
to exactly the wallets they were built for — the proofs can be rebuilt from the
chain and any copy of the reward rows.

## Data on the appchain

| Table | Purpose |
| --- | --- |
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
- `scripts/build-program.sh` — carries two toolchain quirks: Agave 4 refuses
  SBPF v0, so the build targets Anchor's v3 default, and `cargo-build-sbf`
  breaks when it finds its SBF toolchain already linked.

## Known gaps

These are open on purpose, not oversights:

- **Wallet ownership is declared, not proved.** `POST /api/solana/link` accepts
  the address the user names, signed with their FaucetChain key. That proves who
  chose the wallet, not who controls it. A typo or a stolen session sends a
  reward to a wallet the user cannot reach, and after the root is published
  there is no way back.
- **Unclaimed rewards sit in the vault forever.** `withdraw_surplus` cannot
  touch them, by design. Whether they should expire back to the partner is a
  product decision nobody has made.
- **Token-2022 mints with a transfer fee would break the accounting.** The vault
  would deliver less than the leaf promises while `paid` records the full
  amount. Campaigns should be restricted to plain SPL mints until this is
  handled.
- **The proof endpoint has no rate limit.** The cache removes the repeated cost,
  but the first request on a large batch still costs real CPU — about 0.7s for
  ten thousand leaves.

## Change log

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
