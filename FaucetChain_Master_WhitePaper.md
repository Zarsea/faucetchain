# FaucetChain

**Micro-distribution that settles on Solana.**

Version 2 · September 2026 · supersedes the March 2026 paper

---

## 1. What this is

Faucets pay people tiny amounts for small actions. The economics only work if
each payout costs almost nothing to make, which is why every large faucet
platform ends up as a private ledger: an internal balance you are told you have,
paid out when and if the operator decides.

That arrangement has one failure mode, and it is the only one that matters. A
user can earn for weeks and discover at withdrawal that the money was never
there. No amount of uptime or good intent fixes it, because nothing about the
promise was ever checkable.

FaucetChain splits the problem in two.

| | The appchain | The Solana program |
| --- | --- | --- |
| Handles | thousands of tiny claims an hour | custody of the budget and every payout |
| Cost per action | none | one transaction, paid by a relayer |
| Can be wrong about | who earned what | nothing it was not shown a proof for |

Distribution stays fast and free where it has to be. Custody moves to a public
chain where anyone can check it. The only thing that crosses between them is a
32-byte Merkle root.

Partner funds never traverse a bridge. They enter a campaign vault on Solana and
leave it to users. There is no wrapped asset, no custodian in the middle, and no
message that mints anything if forged.

---

## 2. Proof of Claim

Blocks are not mined by burning electricity or by the largest stake. They are
produced by distribution actually happening.

A claim requires the browser to solve a small keccak puzzle before the server
will record it. That does three things: it costs a real fraction of a second per
claim, it makes automated farming cost the same as human use, and it ties block
production to the thing the network exists to do.

The difficulty is not fixed. It rises as the hourly quota is consumed, so the
cheapest claims of the hour go to whoever arrives first, and the last ones cost
the most work. A second limit caps how many distinct wallets one IP address can
claim to in an hour.

Neither of these is a deterrent in theory. Both are enforced in code and covered
by tests that fail if the limit stops working.

---

## 3. The hourly quota

The network releases at most **2,000 $CLAIM per hour** across every faucet
connected to it. When that is exhausted, claiming pauses until the next hour
begins.

The purpose is inflation control and bot resistance: a hard ceiling means a
botnet cannot drain a day's emission in ten minutes, and it makes the cost of
attacking the network scale with time rather than with hardware.

The previous version of this paper described the pause as manufacturing
scarcity and urgency for users. That was a bad reason and it has been dropped.
The limit exists to make the emission schedule predictable and the network
expensive to farm, not to pressure anyone into claiming faster.

---

## 4. $CLAIM

- **Fixed supply: 99,000,000.** No mechanism mints beyond it.
- **No gas for users.** Claiming and receiving cost nothing on the appchain.
  Withdrawing to Solana costs a transaction fee, and a relayer pays it — a user
  holding zero SOL can still collect.
- **Burning is opt-in.** No fee is destroyed automatically. Deflation by decree
  shrinks the volume a distribution network depends on, so any burn is a
  deliberate act, not a side effect of using the system.

---

## 5. Settlement on Solana

This is the part that turns a promise into something checkable.

**A campaign** is opened by a partner who wants to distribute tokens. It records
the sponsor, the operator allowed to publish roots, the mint, and running
totals. Its vault is a token account whose authority is the campaign itself —
not a key anyone holds.

**Funding** moves the partner's tokens into that vault. From that moment what
the campaign owes and what it holds are both public.

**A batch** closes periodically. Every reward earned since the last batch goes
into one Merkle tree, summed per recipient wallet, and only the root is
published on-chain.

**Proof of reserve is enforced, not reported.** The program refuses a new root
unless the vault still covers everything already promised plus everything the
new root adds:

```
vault.amount >= committed - paid + total_amount
```

A sequencer that has over-promised cannot publish. The check runs on Solana, so
it does not depend on the sequencer being honest or even being online.

**A withdrawal** proves one leaf belongs to a published root. The program
creates a receipt account for that leaf, so a second attempt fails on the
account already existing rather than on a database lookup. The fee payer is a
separate signer from the recipient, which is what lets the relayer cover both
the fee and the account rent.

**What the operator cannot do:** withdraw from a vault, pay more than the vault
covers, pay the same leaf twice, change a published root, or touch a campaign it
does not operate. The sponsor cannot do those either, and cannot take back a
token already inside a published root.

If the appchain database is lost tomorrow, every root already on Solana still
pays exactly what it promised, to exactly the wallets it was built for.

---

## 6. How FaucetChain pays for itself

A faucet needs a revenue source or it is a countdown to insolvency. Most either
sell advertising or sell the user's attention to someone worse.

FaucetChain stakes its own treasury.

The treasury holds capital and stakes it on proof-of-stake protocols, beginning
with those reachable on Solana. The yield is the network's revenue. Part returns
to the treasury to grow the base; part funds the rewards users claim.

Three things about this are deliberate:

**The capital is the company's.** Users do not deposit, do not stake, and hold
no position. They cannot lose anything, because they never had anything at
risk. What they interact with is a faucet — they claim, and they are paid.

**The risk sits with whoever chose it.** Staking carries slashing and price
risk. That belongs to the treasury that decided to take it, not to someone who
came to collect a fraction of a cent.

**It is revenue, not a promise of return.** Nothing here offers users a yield,
an APY, or a share of anything. The yield funds a budget. The budget funds
rewards. A user sees rewards.

Solana is the starting point because settlement already lives there. Extending
to other protocols is a later question, and an honest one: it adds operational
risk before it adds revenue.

---

## 7. What a user is paid in

Because settlement identifies a campaign by its mint, paying in different assets
is not an extra system — it is another campaign.

The intent is to let a user choose: **$CLAIM**, when reserves cover it, or **the
asset the treasury actually staked to earn the reward**. Someone who wants
exposure to the network takes $CLAIM. Someone who wants something liquid takes
the staked asset.

This is designed, not built. It is named here because it shapes the settlement
layer that is built, and because a paper that omitted it would be describing
half a system.

---

## 8. Sentinel

Anything that pays for clicks attracts scripts. Sentinel watches claim timing,
address clustering and per-IP behaviour, and scores accounts that look
automated.

It is a filter, not a gate. The limits that actually hold — the quota, the
difficulty curve, the IP cap, and on Solana the reserve check and the bit each
leaf owns in its root — are arithmetic, and hold whether or not a model classifies correctly.
Sentinel reduces load on those limits; it is not what makes them safe.

---

## 9. What exists, and what does not

The distinction matters more than the roadmap, so it comes first.

**Working and covered by tests**

- Proof of Claim with rising difficulty, the hourly quota, and the per-IP wallet cap
- The Solana program: campaigns, funding, root publication with the reserve
  check, Merkle-proof withdrawal, receipts against replay, surplus return,
  campaign closing
- The relayer: a user with zero SOL withdraws; the relayer signs only a
  transaction it built and verified byte for byte, and refuses five distinct
  tampering attempts
- Linking a Solana wallet, which requires a signature from that wallet, not just
  its address
- A settlement ledger read from Solana rather than from the sequencer
- The whole flow end to end against a running program, nothing mocked

**Designed, not built**

- Treasury staking as an automated operation — today it is a stated model
- The payout choice between $CLAIM and the staked asset
- A public SDK for partner faucets
- Expiry for rewards nobody ever claims

**Known limits, stated because they are real**

- A custodial account is authenticated by knowing its address. Session tokens
  are the fix and are not yet in place. This is the sharpest open item.
- One sequencer closes batches. It cannot steal — the program stops that — but
  it can stall.
- Token-2022 mints with transfer fees would break payout accounting; campaigns
  should stay on plain SPL mints until that is handled.

---

## 10. Roadmap

**Done** — Proof of Claim and the hourly economy; the appchain, its API and
explorer; anti-Sybil; the Solana settlement program with vaults, roots, proofs,
receipts and the relayer; the ledger read from chain.

**Next** — devnet deployment and a public demo campaign; session authentication
for custodial accounts; rate limits on the relayer and the proof endpoint; a
partner SDK.

**After that** — treasury staking as an operation rather than a model; the
payout choice; unclaimed-reward expiry; more than one sequencer.

**Later** — staking beyond Solana; governance over treasury parameters; opening
faucet registration without review.

Dates are deliberately absent. The previous version of this paper marked
Solidity contracts as complete that were never deployed, which is the specific
mistake this section exists to avoid.

---

## 11. What was true before, and is not now

FaucetChain began as a single EVM appchain with Solidity contracts. Those
contracts are archived in [`legacy/evm/`](legacy/evm/); they compile, the
backend never called them, and they were never deployed to a public network.
Notes from that period are in [`legacy/docs/`](legacy/docs/).

The earlier paper described that EVM design as the architecture and listed an
Ethereum bridge as the plan. Settlement is on Solana now, and there is no
bridge: value does not cross a chain boundary, only a 32-byte root does.

[`PRIOR_WORK.md`](PRIOR_WORK.md) records precisely what predates the Crypto
World's Fair hackathon and what was built during it.
[`ARCHITECTURE.md`](ARCHITECTURE.md) is the working document of record and is
updated whenever the infrastructure changes; where it and this paper disagree,
it is the one that is current.
