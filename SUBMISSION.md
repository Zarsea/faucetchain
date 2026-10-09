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

**Decided 9 October: it opens with the person clicking.** The whitepaper and
the README already do, and a paragraph that contradicts them costs more than
the choice gains. The sentence to build from is theirs: someone earns for
weeks and finds out at withdrawal that the money was never there.

The cost of that choice, worth knowing while writing: the person clicking is
not who adopts and not who pays. The operator and the sponsor have to appear by
the second paragraph, or the field describes a consumer product.

Material, all verified:

- the failure mode — a private balance nobody can check
- the split — distribution on the appchain, custody on Solana, one 32-byte
  root crossing
- the refusal — `vault.amount >= committed - paid + total_amount`, enforced by
  the program, not reported by us

### `whyNow`

Backed: nothing. This field is about timing and the repository has no opinion
about timing.

**Decided 9 October: the cost of a withdrawal, measured rather than argued.**

A payout costs **1,573,440 lamports**, the same for both that have happened.
**95% of it is the one-time rent of the recipient's token account**, charged
once per person per token; the transaction fee itself is 85,000. And the fee
payer is a separate signer from the recipient, so a relayer covers both and
**somebody holding zero SOL receives the token** — which the 5 October
withdrawal demonstrates on a wallet with no SOL at all.

That is what makes a per-user on-chain record affordable for rewards worth
fractions of a cent. On a chain where each payout costs dollars, this design
does not close.

**Say it as economics, not as a trend.** Fee-payer separation is not new to
Solana, and claiming that something changed last quarter is the kind of
sentence a judge checks. What is defensible is the measurement: here is what it
costs, here is why that number is what makes it possible, and here is the
transaction. Anything beyond that is invention.

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

**Researched 9 October.** Copilot's evidence routes answered this time; the
401s of 3 October are gone. Searched winning projects across every hackathon
for faucet, micro-distribution, airdrop-with-proof and reward-settlement work.

**What a faucet operator uses today: FaucetPay.** Not a guess — it is what our
own partner uses to pay its users, and `faucetpay.py` integrates with it for
identity. It is a custodial payout processor: it holds the money and pays when
it decides. That is the comparison, and it is the whole argument. Naming the
incumbent is stronger than claiming the field is empty.

**The closest Colosseum precedent is [Torque](https://colosseum.com/projects/explore/torque)**
(Renaissance 2024, Infrastructure winner): an onchain offers protocol paying
conditional, pay-per-action rewards from an escrow contract, verified by
onchain proofs and tracked with cNFTs. Sponsor funds escrow, user performs
action, chain verifies — nearly our shape.

Where it differs, and this is the sentence the field needs: Torque pays for
*marketing actions it defines*. This settles a debt a faucet *already owes*,
and the difference lands in the program, not the distribution — ours refuses a
root the vault cannot cover, so the operator cannot promise what it does not
hold. Torque is customer acquisition; this is a solvency guarantee.

Three more worth knowing, because a judge may raise them:

- **[Ore](https://colosseum.com/projects/explore/ore)** (Renaissance 2024,
  grand prize) — smart-contract proof of work issuing personalized challenges
  so consumer hardware can mine. The nearest thing to Proof of Claim, and the
  comparison to prepare: Ore's work *is* the product; ours gates a claim so
  automated farming costs what human use costs.
- **[Zoneless](https://colosseum.com/projects/explore/zoneless)** (Frontier
  2026, public goods) — open-source payout infrastructure, a drop-in Stripe
  Connect replacement paying USDC to sellers by API. Same "payout rail behind
  an API" shape, a different customer, and no reserve check.
- **[Merit by Frankie Labs](https://colosseum.com/projects/explore/merit-by-frankie-labs)**
  (Renaissance 2024) — non-transferable on-chain points with a partner
  launchpad and API keys. The points-and-partner-API half, without settlement.

**What this research does not establish.** It covers Colosseum's own record of
*winning* projects. Non-winning entries, and everything built outside these
hackathons, are not in it. Saying "nobody has done this" would not be supported
by what was checked; saying "the closest precedents are these, and here is the
line between them" is.

### `monetization`

Backed: the 80/20 split is in the code — `USER_SHARE = 80`,
`TREASURY_SHARE = 20`, and the treasury's share is staked, not sold.

**Decided 9 October: continuity funding, with the revenue model still to
come.** The 80/20 is how a drip splits — the user's share and the treasury's.
It feeds the treasury; it is not a price anybody pays.

The revenue the whitepaper names is the treasury staking its own capital, with
the yield funding the reward budget. **Section 9 labels that "designed, not
built",** so the form has to label it the same way. A field claiming revenue
that the paper calls a model is the exact contradiction the third done-criterion
exists to catch.

What can be said without qualification: users never deposit, never stake and
hold no position, so they carry no risk — the capital and the slashing exposure
belong to whoever chose them. That is a real property of the design and it is
built.

### `teamCommitment`

**Only the three of you can answer.** Hours per week, who is full time, what
happens after the hackathon.

### `teamLocationDetails`

All three in Foz do Iguaçu, Brazil. The field wants the detail, not the
country, and the country is already set separately.

### A disambiguation to put wherever the form allows it

**The repository link is `https://github.com/Zarsea/faucetchain`,** and the
form must be changed if it says anything else.

There is a GitHub organisation called `FaucetChain`. **It is not ours.** Its
only repository publishes `faucet.chains.my`, a testnet faucet whose drips come
from `faucet-edisontkp.vercel.app`, operated by EdisonTKP. The domain is not
ours either — `chains.my` runs on a Cloudflare account we do not hold. Three
separate things carrying the name, none of them connected to this project by
code, infrastructure, operator or control.

A judge following a link to that organisation lands on a faucet giving away
test tokens on ten networks, which is not this protocol and would read as the
project being far less than the form claims. The README now opens with the same
disambiguation, because anyone searching the name finds that site before this
one.

### `repoContext`

What a judge should look at first, and what to ignore. A genuinely useful
answer here, given the repository's size:

- `ARCHITECTURE.md` — the design, including what is deliberately unfinished
- `distribution.py` — the whole payout model, with a runnable self-check
- `faucetchain/programs/faucetchain/` — the Anchor program
- `PENDING.md` — what is open and who is blocked

**`legacy/` is flagged, as of 9 October.** It and `.deps/` are marked
`linguist-vendored` in `.gitattributes`, so they no longer count toward the
language bar — a Solana project was advertising **Solidity** on its front page
because of ten archived files. The directories stay listed and browsable, and
section 11 of the whitepaper already says what they are: contracts that
compile, that the backend never called, and that were never deployed to a
public network.

Say the same thing here if a judge asks. Hiding them would contradict the
section that documents them; letting them describe the project is just as
wrong.

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

## What the judges are told to look for

Read from Colosseum's canonical FAQ on 9 October, `program=hackathon`. It
changes how two fields should be written, and raises one question this file had
not asked.

**"Insight: does the founding team have some unique insight based on their deep
understanding of the problem space? Is there a new technology, or a new trend
that creates an opportunity?"** This is the criterion `whyNow` is scored
against, and it asks for insight *or* a new technology — not necessarily a
trend. The measured cost of a withdrawal is an answer to the second half.

**"Founder + Market Fit: does the team have the right skills and experience to
succeed in this market, and why is it motivated to solve this problem?"**
Zarsea has been in faucets since 2017 and building since 2022. That is already
on the Colosseum profile and it is the strongest founder-market-fit evidence
this submission has. It should not be left sitting in a profile field.

**"Traction: does the product already have demand or revenue? If so, how
durable are its revenue and user base?"** Note the "if so" — the question
allows a no. Five users and 75 claims paid by the partner, with the
qualifications already written above, is a truthful answer to a question that
does not demand a big number.

**On the repository, the FAQ asks to see that the team "were the ones to do
this work, rather than a third party."**

Every commit in this repository since September carries
`Co-Authored-By: Claude`. That is accurate and it is visible on the GitHub
contributor list. **This file will not recommend hiding it** — rewriting that
history would contradict the one thing this project is actually about, and
section 11 of the whitepaper exists because we chose the opposite habit.

But it is better said by us than discovered by a judge. **Decide how to say
it** in `additionalInfo` or wherever the form allows: what the team designed
and decided, and what the tooling executed. The honest version is not a
weakness — the architecture decisions, the audit that found our own false root
count, and every judgement call in `PENDING.md` are the team's.

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

Colosseum's evidence routes returned 401 all through 3 October. **Retried on
9 October and they answer** — the connection reports `evidence:read`, and
`competition` above now carries real precedent research.

**The deadline is now verified from source.** Copilot's `eventDates` for
`crypto-worlds-fair` gives `submissionDeadline: 2026-10-13T06:59:00.000Z`,
which is 23:59 PDT on 12 October — exactly what this file has been carrying
since 28 September. The hackathon opened 2026-09-14T15:00Z.

Nothing in this file is now resting on an unverified date.
