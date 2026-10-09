# The submission, field by field

Crypto World's Fair closes **23:59 PT on 12 October 2026**.

Read from the **live draft** on 3 October through Colosseum's own API, not from
the public hackathon page — the page lists nine things to prepare, the actual
form has about forty fields. An earlier version of this file was built from the
page and was materially incomplete.

**This file does not contain the submission.** The prose fields are the team's
own words and judges read them that way; a paragraph written here and pasted
there is the one shortcut that costs more than it saves. What is here is every
value the repository can prove, the question behind every field it cannot, and
nothing in between.

Everything marked **verified 3 Oct** was re-read from the chain, the live
service, or the draft itself today.

---

## What is already done

Four things the old checklist had wrong or did not know:

- **Registration is complete.** `registered: true` on Crypto World's Fair
  (**verified 3 Oct**). The checklist carried this as an open item with a
  warning that it would be missed. It was not missed.
- **The project exists** as `faucetchain`, status **draft**, owner `Zarsea`.
- **The team is three people**, all in Foz do Iguaçu, Brazil, and each one's
  background is already on their Colosseum profile: `Zarsea` (physics,
  self-taught, in faucets since 2017, building since 2022), `DoniJR` (AWS,
  DevOps, infrastructure, security, observability), `Ciumauri` (CS student,
  Solana and Rust).
- **Weekly update #1 is published**, 21 September, with a video. The checklist
  treated the weekly update as entirely undone.

The **description** is also written and holds up — it names the problem, the
mechanism, and the failure mode in one paragraph.

---

## Fields that have an answer right now

These are facts. Enter them and they are finished.

| Field | Value | |
|---|---|---|
| `repoLink` | `https://github.com/Zarsea/faucetchain` | public, branch `main`, **verified 3 Oct** |
| `chains` | Solana | already set |
| `category` | Developer Infrastructure | already set |
| `country` | Brazil | already set |
| `isSolanaMobile` | false | no mobile build exists |
| `isUniversityProject` | false | already set |
| `demoVideoPublic` | your call | currently `false`; it gates whether judges can share it |

`technologies` — everything below is in the repository today:

> Solana (devnet) · Anchor · SPL Token · Metaplex Token Metadata · Phantom ·
> FastAPI · Python · SQLite · solders / solana-py · React · TypeScript · Vite

`chainUsage` is *not* on this list, because it asks what Solana does for the
product rather than which libraries are linked. The facts it rests on, each
verifiable:

- Program `64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm`, executable under the
  BPF upgradeable loader (**verified 3 Oct**).
- **6 Merkle roots published**, across 5 campaigns: 687389 and 711670 on
  17–18 September, then 478840, 479079 and 652608 between 27 September and
  2 October (**verified 4 Oct**, and the verification matters — see below).
- The program **refuses a root its vault cannot cover** (`InsufficientReserve`).
  This is the whole reason the guarantee lives on Solana instead of here.
- Users withdraw against a proof with **no SOL of their own** — a relayer pays.
  **Two real withdrawals**, 717,526 units in all:
  `46kkEoMDU3gyW5smjGmzpmdctfqWnzAyt8ztbF61S2u2LknHWEVh4oSZvwxkhBy5SXvcfWdP2XmAQhqnhXFFXNhw`
  on 2 October (**verified 3 Oct**) and
  `2fKnxfS4T7Wrbad2ULK5xQQN9eBgb9v2X2aWVc4bkacJv3KFJhK8RkccR54dark49hyK3gwooRJzE6Wgux6eC6Qx`
  on 5 October, both `err: null`, each 85,000 lamports of fee plus 1,488,440 of
  token-account rent.

  The second one is the better screenshot: the receiving wallet holds **zero
  SOL** and got the token anyway, which is the whole argument in one frame.
  Checked the way this project learned to check — the token account exists and
  holds the balance, and accounts are not pruned (**verified 8 Oct**).

---

## Fields that need the team's words

For each one: what the repository can back, and the question that has to be
answered before the paragraph can be written honestly.

### `whatBuilding`

Backed: the description already in the draft. Reusable as the spine.

**Question:** which of the three customers does this lead with — the faucet
operator, the sponsor funding a campaign, or the person clicking? The product
serves all three and a paragraph can only open with one.

### `whyNow`

Backed: nothing. This field is about timing and the repository has no opinion
about timing.

**Questions:** what changed recently that makes this possible or necessary now?
Candidates worth checking before claiming: the cost of a Solana transaction
versus 2022, compressed state making per-user records affordable, or something
specific happening to faucet payouts. Pick the one that is actually true.

### `marketValidation`

Backed: **a faucet in production sends claims to this chain over one HTTP
call, made after its own commit.** faucethunter.net opened for testing in early
September 2026, has **five registered users**, and has paid them **more than 75
claims**.

Two qualifications, and they are not optional — a judge will find both.

**The 75 were paid by the faucet, not by us.** FaucetHunter pays through
FaucetPay, its own rail, with its own money; our FaucetPay integration proves
an identity and moves nothing (`faucetpay.py`: "No money moves through this
module"). They prove a real operator runs a real faucet and really pays. They
do not prove FaucetChain distributed anything. Presenting them as our volume is
the easiest claim here to puncture.

**Five users is small, so lead with what it does prove: the integration cost.**
A working faucet added this chain with one call, kept its own payouts, kept
custody of its own money, and stays up if we go down
(`test_partner_survives_outage.py`). That argument does not need scale to be
true, and scale would not make it truer.

**Still open, and the first thing a judge asks:** no faucet operator outside
the team has said they want this. Say it as the next milestone rather than let
it be discovered. One named outside operator is worth more than any number on
this page.

### `traction`

Backed, re-read from the ledger on 8 October: 6 published roots, 113 reward
rows, 4,262,207,812 units credited, 39 linked Solana addresses, 6 registered
faucets, 26 sealed blocks, two real withdrawals by real wallets.

Say **one** of those six faucets is a partner with its own audience — five
registered users, 75+ claims paid, running since early September. The other
five faucets are ours, for testing. "Six partner faucets" is the easiest
sentence in this submission to puncture.

And keep the two sides apart: those 113 reward rows are what **this chain**
credited. The 75 claims are what **the faucet** paid through FaucetPay. Adding
them together would be the second easiest.

**This file said 19 until 4 October, and that was wrong.** Fourteen batches
carried a `published_signature` for a transaction that does not exist on devnet
— simulation residue that counting rows in `settlement_batches` could never
catch, because a well-formed 88-character string is indistinguishable from a
real signature until something asks the network.

Checking `getTransaction` alone would not have settled it either: devnet prunes
history, so a legitimate old signature can fail to come back. What decides is
the account — `publish_root` creates the root PDA, and accounts are not pruned.
By that test 5 exist and 14 never did; for those 14 the campaign account does
not exist either. `verify_published_roots.py` runs it and exits non-zero when
the database claims more than the chain holds.

Five verifiable roots is a smaller number and a defensible one. Nineteen, told
to judges who can check, would have been the single worst thing in this
submission.

**The honest reading, which is worth getting right before a judge does it for
you:** those are *integration* numbers, not demand numbers. They prove the
machine runs end to end. They do not prove anyone wants it. Presenting them as
traction is the easiest claim in the submission to puncture; presenting them as
"the rail works, and here is who uses it" is defensible.

### `competition`

Backed: nothing yet. Copilot's project evidence would answer "who has tried
this at Colosseum before" — **the evidence routes are returning 401 today**
(see the note at the end), so this field has no research behind it yet.

**Question meanwhile:** who does a faucet operator use *today* instead of this?
FaucetPay is the obvious incumbent and the comparison is the point: it is a
custodial payout processor, this is a settlement guarantee. Name it rather than
claiming an empty field.

### `monetization`

Backed: the 80/20 split is in the code — `USER_SHARE = 80`,
`TREASURY_SHARE = 20`, and the treasury's share is staked, not sold.

**Question:** is that the business model, or is it the network's continuity
funding with the business model still to come? The draft should not imply the
first if the answer is the second.

### `teamCommitment`

**Only the three of you can answer.** Hours per week, who is full time, what
happens after the hackathon.

### `teamLocationDetails`

All three in Foz do Iguaçu, Brazil. The field wants the detail, not the
country, and the country is already set separately.

### `repoContext`

What a judge should look at first, and what to ignore. A genuinely useful
answer here, given the repository's size:

- `ARCHITECTURE.md` — the design, including what is deliberately unfinished
- `distribution.py` — the whole payout model, with a runnable self-check
- `faucetchain/programs/faucetchain/` — the Anchor program
- `PENDING.md` — what is open and who is blocked

**Question:** do you want `legacy/` and the Sepolia-era files flagged as not
part of the submission? They are in the public tree and a judge will find them.

### `additionalInfo` / `liveProductAccessInstructions`

See the next section — there is a decision to make before these can be filled.

---

## Two things that are not fields and block several

### There is no public URL for FaucetChain's own interface

`liveProductLink` and `website` are both empty, and today **nothing answers
them**. The explorer runs on `localhost:8010` behind an ngrok tunnel that
changes; there is no deployment config in the repository. What is public is the
GitHub repo, the partner's site (which is *theirs*, not ours), and devnet
explorer links.

Judges click. A submission whose product cannot be opened is relying entirely
on the videos.

**Decision needed:** deploy the frontend somewhere stable before the 12th, or
fill `liveProductAccessInstructions` with an honest "run it locally, here is
how" and accept what that costs.

### Both videos, and the logo

`pitchVideoLink`, `demoVideoLink`, `presentationLink`, `technicalDemoLink` — all
empty.

- **Pitch: aim for 2 minutes.** One Colosseum source says 2 for this hackathon
  while the page says 2–3; 2 passes either.
- **Demo: 3 minutes maximum.**
- **Both in English.** Content Guidelines 12(a)(i). The product is trilingual;
  the submission is not.
- The shot list is in [PENDING.md](PENDING.md), and every shot in it is live.

**The logo** is still unresolved: `faucethunter_banner.jpg` and
`faucethunter_square.jpg` are the *partner's* marks. Submitting a partner's logo
as the product's own invites exactly the wrong question.

---

## Fields only you can answer

`legalEntity` · `legalEntityDetails` · `investmentReceived` ·
`investmentDetails` · `currentlyFundraising` · `fundraisingDetails` ·
`liveToken` · `liveTokenDetails` · `externalContributors` · `twitterHandle` ·
`telegramHandle` · `surveyAnswers`

One worth a second look: **`liveToken`.** FHR exists on devnet with real
Metaplex metadata, and USDC and USDT are registered as settleable but pay
nothing. Whether that counts as a live token depends on what the field means by
live — and answering "yes" about a devnet token would be the wrong kind of
wrong.

`tracks` is also empty. Worth checking what tracks this hackathon offers; the
category is set but a track is not.

---

## Order of work

**By Sunday 4 October:**

1. `repoLink` — ten seconds, and it is the field a judge uses first.
2. Push `main`. Three commits are local and judges read the public tree.
3. A one-line description on the GitHub repository itself, which has none.
4. The FaucetHunter numbers, for `marketValidation`.
5. Decide the public-URL question, because the videos and two fields depend on it.
6. Logo decision.

**Then, before the 12th:**

7. The prose fields, in this order: `whatBuilding`, `traction`,
   `marketValidation`, `competition`, `whyNow`, `monetization`.
8. Film both videos in English.
9. Everything in the "only you" list.

---

## What is not verified here

Colosseum's **evidence routes returned 401 all through 3 October** —
`/search/projects` and `/faqs` both — while `/me` worked, so the draft above is
first-hand and the research is not. That costs two things: the `competition`
field has no precedent research behind it, and the hackathon's own FAQ wording
on deadlines and judging could not be re-read from source. The 23:59 PT deadline
above is from the rules read on 28 September, not re-verified today.

Worth retrying before the prose fields are written.
