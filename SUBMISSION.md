# The submission, field by field

Crypto World's Fair closes **23:59 PT on 12 October 2026**. The nine fields
below are the ones the [hackathon page](https://www.colosseum.com/hackathon)
asks for, read off it on 3 October.

**This file does not contain the submission.** Four of the nine fields are
prose, and judges read prose as the team's own words — a paragraph written here
and pasted there is the one shortcut that costs more than it saves. What is
here instead is every fact the repository can prove, with the command that
proves it, and the questions only the team can answer. Write the prose from
this; do not copy it from it.

Everything marked **verified 3 Oct** was re-read from the chain or the live
service today, not from an earlier note.

---

## 1. Product name

**FaucetChain.** Settled.

The campaign-side name used with partners is *FaucetsWeb3 Liquidity Test and
Airdrop*; the appchain is FaucetChain. Pick one for the form and keep it
consistent with the videos and the logo.

## 2. Brief description

**Open — prose.** The facts it has to rest on, all verifiable:

- A **micro-distribution appchain** that credits fractions of a token per
  faucet claim, and settles the total on **Solana** through a Merkle root.
- The promise and the payment are deliberately different numbers. The chain
  credits; the Solana program pays, and **refuses a root its vault cannot
  cover** (`InsufficientReserve`).
- The partner is a **web2 faucet with real users** that already sends claims
  here over one HTTP call.

Questions to answer before writing it:

- Who is the customer in one sentence — the faucet operator, the sponsor
  funding a campaign, or the person clicking? The product serves three and the
  description can only lead with one.
- What does the sponsor buy that an airdrop does not give them?

## 3. Blockchains and tools integrated

Factual, no prose needed. Everything below is in the repository today:

| | |
|---|---|
| Chain | **Solana** — devnet, program `64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm`, executable under the BPF upgradeable loader (**verified 3 Oct**) |
| Program | **Anchor** |
| Token | **SPL Token** + **Metaplex Token Metadata** (`CreateMetadataAccountV3`, hand-built in [settlement.py](settlement.py)) |
| Wallet | **Phantom**, with a two-signature wallet link |
| Backend | **FastAPI**, SQLite, Python; `solders` / `solana-py` for chain reads |
| Frontend | **React + TypeScript**, Vite, trilingual (en/pt/es) |
| Appchain | FaucetChain, chain id 7777 — keccak256 Proof of Claim, stake-weighted sealer election |

The form also asks which **tools from the hackathon resources hub** were used.
Needs the Copilot sign-in to answer against the hub rather than from memory —
it is the one open item on this field.

## 4. Team members, backgrounds, location

**Open — only the team can fill this.** Nothing in the repository carries a
person's background, and guessing one would be a lie in a field judges check.

- How many people are on the submission?
- One or two lines of relevant background each.
- Team location, as the form words it.

## 5. Product logo or graphic

**Open.** `faucethunter_banner.jpg` and `faucethunter_square.jpg` exist in
Downloads, but they are the **partner's** marks, not FaucetChain's. Submitting
a partner's logo as the product's own is a correction waiting to happen.

Decide: a FaucetChain mark, or the partner mark with the relationship stated.

## 6. GitHub repository

[github.com/Zarsea/faucetchain](https://github.com/Zarsea/faucetchain) —
public, default branch `main` (**verified 3 Oct**). No access needs granting.

Two things a judge sees before any code:

- **The repository has no description.** One line, on the repo itself.
- **`main` here is one commit ahead of what is published.** The local
  mainnet-ceiling commit is not on GitHub yet. Judges read the public tree.

## 7. Pitch video, 2–3 minutes

**Open.** One Colosseum post says 2 minutes for this hackathon while the
hackathon page says 2–3; **shoot for 2**, which passes either rule. English —
Content Guidelines 12(a)(i).

The shot list is in [PENDING.md](PENDING.md) and is live, not mocked.

## 8. Demo video, no more than 3 minutes

**Open.** Same shot list. The two climax shots are deliberately unspent: the
refused root, and the withdrawal.

## 9. Go-to-market, demand validation, distribution

**Open — prose, and the only field starting from zero.** It is also the field
with the strongest material, which is worth knowing before writing it.

### What the chain itself proves (verified 3 Oct)

- **19 Merkle roots published on Solana devnet**, across 18 campaigns, between
  17 September and 2 October 2026. Every one carries a signature.
- **A real withdrawal by a real wallet.** Signature
  `46kkEoMDU3gyW5smjGmzpmdctfqWnzAyt8ztbF61S2u2LknHWEVh4oSZvwxkhBy5SXvcfWdP2XmAQhqnhXFFXNhw`,
  `err: null`, fee 85,000 lamports, plus 1,488,440 lamports of token-account
  rent — the first time the product's unit economics were measured instead of
  estimated.
- **A real campaign token with real metadata.** FaucetHunter Rewards (FHR),
  mint `9yWq9XiWh5Ct29VcviAsT4WoGPEVwKc4jeJVNrdMZVzg`, 6 decimals, vault funded
  with 120,000 FHR. USDC and USDT are registered as settleable; no campaign
  pays in them yet, and the submission should not imply otherwise.

### What the ledger here holds

105 reward rows, 4,185,079,573 units credited, 39 linked Solana addresses, 6
registered faucets, 26 sealed blocks. **These are integration numbers, not
demand numbers**, and presenting them as traction would be the single easiest
claim for a judge to puncture.

### The demand evidence is not in this repository

It is in **FaucetHunter's production database**, and the submission needs it
from the team:

- **How many registered users does faucethunter.net have?**
- **How many claims a day does it serve?**
- **How long has it been running?**
- **Does any other faucet operator want this** — a conversation, a waitlist, a
  "yes if"? One named operator outside the team is worth more than any number
  above.

A faucet in production sending claims to the chain is unusually strong demand
evidence. It is also *one* partner, which is the first thing a judge asks
about; answer it before they do.

### Distribution, the part with an actual answer

The distribution channel is the faucet itself, and the integration cost is the
claim worth making: **one HTTP call after the partner's own commit** — see
[FaucetHub_Integration_Guide.md](FaucetHub_Integration_Guide.md) §4. The
partner's money never moves, and the partner site stays up if this one goes
down (`test_partner_survives_outage.py`).

Open: how a second and third faucet find out about it. Nothing in the
repository answers that, and it is the question the field is really asking.

---

## What has to happen, in order

**By Sunday 4 October** — the adjustments:

1. Repository description, and push `main`.
2. Logo decision (§5).
3. Team answers (§4) and the FaucetHunter numbers (§9).
4. The remaining pre-filming items in [PENDING.md](PENDING.md).

**Then, before 12 October:**

5. Register on colosseum.com — separate from submitting, same instant, and not
   on any build list, which is how it gets missed.
6. Write the four prose fields.
7. Film both videos in English.

The gate nobody can work around: **the prose fields need the team's answers
from item 3.** Everything else can proceed in parallel.
