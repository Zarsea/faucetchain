# The three videos, and the order to shoot them

Crypto World's Fair closes **23:59 PT on 12 October 2026**. Three videos, two of
them required:

| | length | required | state |
|---|---|---|---|
| Weekly update #2 | 1 min | no | script below |
| **Pitch** | aim for 2 min | **yes** | blocked on go-to-market |
| **Demo** | ≤ 3 min | **yes** | shot list ready |

**Everything spoken is in English.** Content Guidelines 12(a)(i). The product is
trilingual; the submission is not.

Every figure in these scripts was read from the chain and the ledger on
4 October. They are listed at the end with the command that re-reads them,
because a number spoken on camera cannot be corrected later and three of them
changed this week.

---

## 1. Weekly update, 1 minute

Not required, and worth shooting anyway: it is the only artefact that shows the
team working rather than the product finished.

### What this week actually is

The honest headline is uncomfortable and it is the strongest one available:
**the project was claiming nineteen Merkle roots published on Solana, and five
exist.** Fourteen batches carried a signature for a transaction that was never
sent. We found it by auditing our own claims against the chain, corrected every
place the number appeared, and built a verifier that fails when the database
claims more than the chain holds.

A hackathon update that says "we found our own number was wrong and here is the
tool that stops it happening again" demonstrates the product's thesis better
than any feature would. The whole project exists to replace a claim with a
proof. This week it did that to itself.

The alternative spine — lead with the first withdrawal and the token metadata —
is safer and more forgettable. Pick one before filming; do not try both in sixty
seconds.

### The beats

Say these in your own words. A minute of someone reading a script sounds like a
minute of someone reading a script, and judges have heard many.

**0:00 – 0:10 · the hook.**
On screen: the Settlement Ledger, five roots.
Beat: this week we audited our own claims against Solana and found that we had
been counting rows in our database, not roots on the chain.

**0:10 – 0:25 · the finding.**
On screen: `verify_published_roots.py` running, the output listing 5 real and
14 phantom.
Beat: fourteen of nineteen never existed. Say plainly that the first check was
not enough either — devnet prunes transaction history, so a missing
transaction proves nothing. What settles it is the account: publishing a root
creates one, and accounts are not pruned.

**0:25 – 0:45 · the fix.**
On screen: the verifier exiting non-zero, then the corrected screens.
Beat: we corrected the number everywhere it appeared, including the submission
draft, and the verifier now fails the build when the database claims more than
the chain holds.

**0:45 – 1:00 · where it stands.**
On screen: the real withdrawal on the Solana explorer.
Beat: five roots, verified account by account. Two real withdrawals by real
wallets, the second into a wallet holding no SOL at all. Five live campaigns
after retiring twenty-three whose mint was not a mint. Next week: the public
URL and the demo.

### Shooting notes

- Screen recording with voice over. No talking head needed, and a talking head
  costs takes.
- The terminal output is the evidence; let it be readable. Font at 16pt or more.
- One take per beat, then cut. A single 60-second take will cost an hour.

---

## 2. Demo, 3 minutes maximum

The shot list lives in [PENDING.md](PENDING.md) and is unchanged: a real click
on faucethunter.net, the bridge answering with two funded campaigns, the
dashboard separating credited from published from withdrawn, the explorer
naming every address, the program refusing a root its vault cannot cover, and
the withdrawal.

Two things about it that matter more than the order.

**The refusal is the demo.** `InsufficientReserve` on a root the vault cannot
cover is the only shot that proves the guarantee is not ours to break. Every
happy path in every hackathon demo looks identical; a program refusing its own
operator does not.

**The last shot was spent off-camera on 5 October, and that is the lesson.**
Campaign 479079's 347,221 units were the unrehearsable take. They were
withdrawn while we were proving the Phantom path worked. The take is gone.

What replaces it: eight rewards are still unspent in published roots, across
campaigns 687389, 711670 and 478840, each against a linked wallet. **Any of
them only works on camera if you hold that wallet's private key** — a link says
which account a wallet opens, not that you control it. Check that before the
shoot, not during it.

The silver lining is real and worth filming: the 5 October withdrawal landed in
a wallet holding **zero SOL**, and the Solana explorer shows exactly that — the
account has no SOL and holds the token. One frame, the whole thesis.

Shoot the demo **before** the pitch. It is the one with a fixed script — the
software decides what happens — and watching your own demo is the fastest way
to find out what the pitch has to claim.

---

## 3. Pitch, aim for 2 minutes

One Colosseum post says 2 minutes for this hackathon while the hackathon page
says 2–3. Two passes either rule.

**This one cannot be written yet, and the reason is the point of the next
section.**

---

## Why the pitch is the go-to-market, and vice versa

A pitch video is a go-to-market argument delivered out loud. The submission
asks for both, in `marketValidation`, `traction`, `competition`, `monetization`
and `whyNow`, and they are the same four questions the pitch has to answer in
two minutes:

| the pitch must say | the field that asks it |
|---|---|
| who has this problem, and how we know | `marketValidation` |
| what exists today and who uses it | `traction` |
| what they use instead | `competition` |
| why this is the moment | `whyNow` |
| and what we get out of it | `monetization` |

Write them once. The written fields become the spoken pitch, and the pitch
read aloud exposes which field is still hand-waving — a sentence that cannot be
said in your own voice in under fifteen seconds is a sentence that is not yet
true.

### What is already answered, and verifiable

- **A faucet in production sends claims to this chain**, over one HTTP call
  after its own commit. That is unusually strong demand evidence and it should
  be said first.
- **The integration cost**, which is the distribution argument: one call, the
  partner's money never moves, and the partner stays up if we go down
  (`test_partner_survives_outage.py`).
- **The unit economics**, measured rather than estimated: 1,573,440 lamports
  per withdrawal, the same for both that have happened, 95% of it
  token-account rent and charged once per person per token. That number is why
  a withdrawal minimum exists.

### What is not answered, and only you can

Four questions, and the pitch has a hole until they have numbers:

1. How many registered users does faucethunter.net have?
2. How many claims a day does it serve?
3. How long has it been running?
4. **Has any faucet operator outside the team said they want this?**

The fourth is the one a judge asks first. One named operator outside the team
is worth more than any number above, and its absence is the obvious question
about a project whose demand evidence is a single partner.

### The trap to avoid

This ledger's own counts — 113 reward rows, 39 linked addresses, 5 roots — are
**integration** numbers. They prove the rail runs end to end. They do not prove
anyone wants it. Presenting them as traction is the easiest claim in the
submission to puncture, and "the rail works, and here is who uses it" is
defensible where "we have traction" is not.

---

## The figures, and how to re-read them

Spoken on camera, a number cannot be corrected. **Re-read 8 October:**

| figure | value | command |
|---|---|---|
| roots published, verified by account | 5 | `python verify_published_roots.py` |
| live campaigns | 5 | `GET /api/solana/campaigns` |
| withdrawals actually signed | 2, for 717,526 units | `GET /api/solana/relayer` |
| what those two cost the relayer | 3,146,880 lamports | same |
| registered faucets (one is a real partner) | 6 | `GET /api/faucethub/faucets` |
| FaucetHunter escrow vs debt | 21,079.72 against 22.00 | same |
| $CLAIM minted of the 99M cap | 78,077.24 | `python reconcile.py` |
| rewards still unspent in a published root | 8 | see the demo note below |

Re-run them the morning of the shoot. Four changed between 4 and 8 October.
