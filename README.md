# FaucetChain

> **The name is shared with things this project has no part in.** A testnet
> faucet runs at `faucet.chains.my`, handing out test tokens on Solana and
> several EVM networks, with its drips served by `faucet-edisontkp.vercel.app`
> (EdisonTKP, edisontkp.com). It is published from a GitHub organisation also
> called `FaucetChain`.
>
> **None of the three belongs to this project.** Not the site, not the domain,
> not the organisation. No shared code, infrastructure, operator or control —
> only the name.
>
> This repository, `Zarsea/faucetchain`, is the FaucetChain protocol described
> below: the appchain and the Solana settlement program. It is the only
> address for it. If you searched the name and found a multi-chain testnet
> faucet, that was the other one.

Crypto faucets pay in promises. A user grinds through a hundred tasks, watches
the balance go up on a dashboard, and finds out at withdrawal time that the
operator never had the money. FaucetChain fixes the part that matters: the
payout is backed by a vault the operator cannot touch, and the user withdraws
by proving a claim, not by asking.

Two layers, each doing what it is good at:

- **The appchain** (`api_server.py`) handles distribution — thousands of tiny
  claims an hour, each one gated by a browser-side proof of work, an hourly
  emission quota, an IP cap and a Sybil detector. Micro-claims worth fractions
  of a cent do not belong in a transaction fee.
- **Solana** (`faucetchain/`) holds the money and settles it. A partner funds a
  campaign vault, the sequencer publishes the Merkle root of each reward batch,
  and any user withdraws straight from the vault with an inclusion proof. The
  program refuses a root the vault cannot cover, so the reserve is checked
  on-chain instead of reported by the server.

Partner funds never cross a bridge. They enter the vault and leave it to the
users. The only thing that moves between the layers is a 32-byte root.

## What is running, and what is not

Everything below is on **devnet**, and every number here can be checked without
asking us for anything.

| | |
|---|---|
| Live testnet | [faucetchain.com.br](https://www.faucetchain.com.br) |
| Program | [`64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm`](https://explorer.solana.com/address/64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm?cluster=devnet) |
| Settlement batches built | 22 |
| Merkle roots published on-chain | 7 |
| Wallets that have claimed | 16 |
| Claims recorded | 95 |
| $CLAIM emitted | 167,000.80 of a fixed **99,000,000** cap (`MAX_SUPPLY`) |

One batch, end to end, in case the table reads like a claim rather than a fact.
Batch 22 released 178,914,405 units against one root in two leaves. 136,174,606
went to the user. The other 42,739,799 is the treasury's leaf and is still in
the vault, because the program derives each leaf from the signer: a user key
cannot reach the treasury's share, and neither can our own backend. The 80/20
split is a number the vault enforces, not a promise the server makes.

[See the transaction.](https://explorer.solana.com/tx/5SdHzdvfMh8Y666LsvEwxT9za8ukGF1i2KFfKut14HjB9Tkj2bjfkcY54w7TnCy1DTDbCfwfherZQ74hja9bQgoe?cluster=devnet)

### The integration, stated plainly

[FaucetHunter](https://faucethunter.net) is the faucet feeding this. It is a
real faucet with real users, paying them real withdrawals through FaucetPay on
its own rail, and **it is ours** — the same person wrote both. It is a pilot,
not a third party that chose to integrate, and no external faucet has integrated
yet. We built both sides because nobody connects a settlement layer that has not
settled anything.

Two numbers get confused easily, so they are kept apart: what FaucetHunter pays
its users through FaucetPay is its own business and its own money, and what
crosses into FaucetChain is the campaign reward that follows. Only the second
one is distribution by this project.

### What is deliberately not done

Devnet, a test treasury key, small volume, and no revenue. Campaign budgets are
funded by hand rather than self-service. The supply cap is fixed in code, but
genesis distribution is still specification, not behaviour.

## How a payout happens

1. A partner opens a campaign and funds its vault (`create_campaign`,
   `fund_campaign`).
2. Users earn on the appchain: claims, missions, faucet micro-claims.
3. A user links the Solana wallet that will receive the payout, signing the
   link with their FaucetChain key (`POST /api/solana/link`).
4. The sequencer closes a batch (`POST /api/solana/batch`). Every reward from a
   linked user goes into one Merkle tree; the batch record keeps the root.
5. The operator publishes the root on Solana (`python publish_root.py`). The
   program rejects it if the vault does not cover everything already promised
   and not yet withdrawn.
6. The user reads their proof (`GET /api/solana/proof/{address}`) and calls
   `claim_reward`. The leaf's bit is set in the root's bitmap, so the same
   reward cannot be withdrawn twice. The fee payer is a separate signer, so a
   relayer can pay the fee for a user holding no SOL.

The leaf is `keccak256(recipient ‖ amount LE ‖ leaf_index LE)` and the parent is
`keccak256(left ‖ right)`, with the direction taken from the index bit and odd
levels duplicating the last node. Both implementations pin the same test vector
(`settlement.py` and `programs/faucetchain/src/merkle.rs`), so a tree built by
the backend is a tree the program accepts.

## Who can change the program

The program is deployed on devnet at
`64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm`, and its **upgrade authority is
held by the team**, at `EL5HubafFFn3XLmzXatb6vrEcwXnAPZGjpPAvpkmjLzA`. Whoever
holds that key can replace the deployed code, including the checks that guard
the vault. It outranks every other key in the system, so it is stated here
rather than left to be discovered.

It stays with the team through the hackathon, deliberately: a bug found during
judging can then be fixed instead of standing as a broken submission. It will be
revoked or moved to a multisig afterwards, before any real value is involved.

Two more things that are true today and would not be acceptable on mainnet. The
deploy payer and the upgrade authority are still the same key — two jobs that
belong to two keys; the demo funder has been split off, so running a
demonstration no longer puts the authority's key on the machine driving it. And
the network is devnet, where tokens are free, so the worst an attacker could do
with that key is break this demonstration.

## What a request has to prove

Every route that changes state needs a reason to trust its caller, and there are
four:

- **the acting wallet signs** the sentence describing the action, or a custodial
  account presents its session
- **the operator token**, for what is nobody's in particular: sealing a batch,
  distributing an epoch, writing to the knowledge base
- **a partner API key**, for a faucet acting as itself
- **a node token**, issued once when a mining node registers and carried by every
  call it makes afterwards

A route may be open only by being named in `OPEN_BY_DESIGN` inside
`test_endpoint_inventory.py`, with the reason written beside it — the four auth
routes issue the session and cannot require one, registration creates the
identity later calls authenticate against, and the relayer routes cannot redirect
a cent because the relayer only signs a withdrawal it built and verified itself.
Everything on that list is also rate-limited, which the same test checks.

The list is the argument and the test is the enforcement, so opening a route is a
decision somebody made in a diff rather than an oversight nobody noticed.

## Layout

| Path | What it is |
| --- | --- |
| `api_server.py` | The appchain sequencer: claims, quota, FaucetHub, settlement endpoints |
| `settlement.py` | Builds a reward batch: leaves, root and proofs, and every sentence a wallet signs |
| `reconcile.py` | Asks whether the books close: five invariants over the ledger, plus solvency per asset |
| `faucetpay.py` | Identity against FaucetPay. Moves no money |
| `social_auth.py` | Signing in through a platform, proved rather than announced |
| `publish_root.py` | Publishes a closed batch's root on Solana |
| `solana_settlement.py` | Instruction encoders and RPC, keyed off the built IDL |
| `faucetchain/` | Anchor workspace with the settlement program |
| `components/`, `services/`, `utils/` | React explorer and faucet front end |
| `tests/` | Backend checks, each file runnable on its own with no test framework |
| `test_endpoint_inventory.py` | Fails on any route that changes state and trusts nothing |
| `test_authorization.py` | Pins the four endpoints that used to take the caller's word |
| `test_faucetpay_identity.py` | Pins the API-key gates, and named-vs-proved for a FaucetPay account |
| `test_docs_match_code.py` | Fails when a document names a route the server does not serve |
| `test_social_login.py` | A forged Telegram payload reaches nothing, and writes nothing |
| `verify_chain.py` | Independent auditor of the appchain, trusting no server |
| `ARCHITECTURE.md` | How the two layers fit together, and what each one can and cannot do |
| `PENDING.md` | What is waiting, sorted by who is blocked |
| `FLOW.md` | The same system drawn: the two layers, a click becoming money, who may act, who seals |
| `legacy/evm/` | The EVM contracts the prototype used before the Solana layer |

## Running it

**Backend** (Python 3.11+):

```bash
pip install fastapi uvicorn eth-account eth-hash pycryptodome solders requests
python api_server.py            # http://localhost:8000, docs at /docs
python tests/test_settlement_api.py
python tests/test_security_fixes.py
```

**The checks worth running first**, because they answer questions rather than
exercise code. None needs a validator, a network or a fixture:

```bash
python reconcile.py               # do the books close, against the live database
python test_endpoint_inventory.py # is any state-changing route trusting nobody
python test_authorization.py      # are the four repaired gates still shut
python test_docs_match_code.py    # does the documentation name a route that exists
python test_social_login.py       # can a forged platform sign-in reach an account
python settlement.py              # every signed sentence, pinned by digest
python scripts/check_messages.py  # and identical in the browser, byte for byte
```

`reconcile.py` is the one to read if you only read one. It is a pure function of
a database connection, and each invariant names the numbers that broke it rather
than saying "failed". Two of them would have caught defects this project
actually shipped.

**Front end** (Node.js):

```bash
npm install
npm run dev
```

**Solana program** (Solana CLI 4.2, Anchor 1.2):

```bash
bash scripts/build-program.sh   # anchor build, plus the rustup workaround
                                # cargo-build-sbf needs on a rebuild
cd faucetchain
cargo test -p faucetchain       # unit tests plus the end-to-end flow on LiteSVM
```

**A partner budget dripping through a faucet:**

```bash
SETTLEMENT_OPERATOR_TOKEN=secret python api_server.py    # terminal 1
SETTLEMENT_OPERATOR_TOKEN=secret python scripts/demo_drip.py
```

A faucet joins, a project commits a budget and names where it wants to appear,
then people click. Each click draws from the budget at a rate the network
computes: held down by the 100-user floor while the faucet is small, falling as
more people share it, and refusing to promise past what was committed. This one
needs no validator — the drip is appchain arithmetic and only reaches Solana
when a batch closes.

**The whole payout, against a running program:**

```bash
solana-test-validator --reset                                   # terminal 1
solana program deploy faucetchain/target/deploy/faucetchain.so \
  --program-id faucetchain/target/deploy/faucetchain-keypair.json
SETTLEMENT_OPERATOR_TOKEN=secret python api_server.py           # terminal 2
SETTLEMENT_OPERATOR_TOKEN=secret \
  python scripts/demo_settlement.py --rpc http://127.0.0.1:8899 # terminal 3
```

That script is the whole product in one run: a partner faucet joins, a campaign
commits a budget and names that faucet, two people click it, and what they earn
is settled on Solana. The rewards are not inserted by an operator — they are
what the network computed a click to be worth, at a rate nobody typed in. Then
the batch closes, its root goes on-chain, and both users withdraw with the proof
the sequencer serves, holding no SOL.

Nothing in it is mocked. If the tree the backend builds were not the tree the
program verifies, it would fail. And the vault does not empty at the end: the
treasury's leaf in that batch is promised and uncollected, so the reserve check
refuses to give it back to the partner — which is the guarantee, demonstrated
rather than described.

**The same thing on devnet.** There is nothing to open — devnet is public and the
program is already deployed there, so only three things change. Point `--rpc` at it,
pass a `--funder` keypair because `requestAirdrop` is rate limited, and start the API
with a relayer key, since on devnet somebody has to really pay the fees.

```bash
SETTLEMENT_OPERATOR_TOKEN=secret SETTLEMENT_RELAYER_KEYPAIR=relayer.json \
  SOLANA_RPC_URL=https://api.devnet.solana.com python api_server.py

SETTLEMENT_OPERATOR_TOKEN=secret python scripts/demo_settlement.py \
  --rpc https://api.devnet.solana.com --funder funder.json --fund-sol 0.25
```

A full run costs roughly **0.5 SOL**, most of it rent for the mint, the vault and the
accounts the demo leaves behind. Devnet SOL is slow to collect, so iterate
against `solana-test-validator`, which is free and resets, and spend devnet only on
the run someone else is going to watch.

Keep the funder and the relayer as their own throwaway keypairs — both are in
`.gitignore`. Funding them from the upgrade authority costs one transfer and means
the key that can replace the program never has to sit on the machine running a demo.
### Environment

| Variable | Used for |
| --- | --- |
| `PASSWORD_SALT` | Only reads back pre-bcrypt password hashes, so they can be rewritten at the next login. New passwords use bcrypt, which carries its own per-row salt. Remove it once nobody is left on the old format |
| `INTERNAL_FAUCET_WALLET`, `INTERNAL_FAUCET_API_KEY` | The built-in faucet that pays micro-claims |
| `CLAIM_IP_HOURLY_WALLETS` | How many wallets one IP may claim for per hour (default 5) |
| `SETTLEMENT_OPERATOR_TOKEN` | Guards crediting rewards and closing batches |
| `SETTLEMENT_CAMPAIGN_SPONSOR` | The wallet that opened the campaign, for the PDA |
| `SETTLEMENT_OPERATOR_KEYPAIR` | Keypair that signs `publish_root` |
| `SETTLEMENT_RELAYER_KEYPAIR` | Keypair that pays the fee and the rent of a user's withdrawal |
| `SOLANA_RPC_URL` | Defaults to devnet |
| `SETTLEMENT_TREASURY_SOLANA` | Wallet that collects the treasury's share of a partner budget. Unset, the share accumulates as owed and a later batch pays it |
| `INTERNAL_SECRET` | Shared secret the indexer sends when it announces a block |
| `FAUCETHUNTER_WEBHOOK_SECRET` | Signs the webhooks sent to the partner faucet. Unset, the whole webhook path is inert: nothing is queued and nothing is sent |
| `FAUCETHUNTER_WEBHOOK_URL` | Where those webhooks go. Defaults to the partner's endpoint |
| `FAUCETHUNTER_FAUCET_WALLET` | Which faucet's events are sent. Only withdrawals by that faucet's own users leave this network |
| `RELAYER_ALERT_LOW`, `RELAYER_ALERT_CRITICAL` | When the relayer alarm fires, counted in new recipients the balance still affords, not in lamports. Defaults 500 and 100 |
| `RELAYER_CHECK_SECONDS` | How often that balance is read. Default 300 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Sign-in with Google. Unset, the button's route answers 503 and nothing else changes |
| `GOOGLE_REDIRECT_URI` | Where Google sends the browser back. Must match the console entry character for character |
| `RATE_LIMIT_TRUST_LOCALHOST` | On by default for local work. Set to `0` before exposing the API: behind a reverse proxy on the same host every caller arrives as 127.0.0.1, and the exemption would switch rate limiting off for the whole internet |
| `AUTH_HOURLY_PER_IP`, `REGISTER_HOURLY_PER_IP`, `TRACKER_HOURLY_PER_IP`, `MINING_HOURLY_PER_NODE` | Ceilings on the routes that are open by design |
| `RELAY_HOURLY_PER_ADDRESS`, `PROOF_HOURLY_PER_IP` | Ceilings on the two endpoints that cost real SOL or real CPU |
| `TELEGRAM_BOT_TOKEN` | Enables Telegram sign-in. Unset, that route refuses everything: the HMAC is keyed on this, so without it nothing can be verified |
| `SOCIAL_AUTH_MAX_AGE` | How old a platform login payload may be, in seconds (default 300). Without a ceiling one captured payload signs its holder in forever |
| `FAUCETPAY_API_KEY` | Enables linking a partner's FaucetPay account. Unset, that endpoint answers 503 rather than recording a link nobody verified |
| `FAUCETPAY_IDENTITY_CURRENCY`, `FAUCETPAY_PROOF_WINDOW`, `FAUCETPAY_PROOF_MIN`, `FAUCETPAY_PROOF_MAX` | Which currency identifies an account, how long the proof stays open, and the band its amount is drawn from |

## Hackathon

Built for the Crypto World's Fair hackathon (Colosseum), September 14 –
October 12, 2026. FaucetChain existed as a prototype before the event;
[PRIOR_WORK.md](PRIOR_WORK.md) states exactly what, and the `pre-hackathon` tag
marks the baseline commit. Everything after it is hackathon work.

MIT licensed — see [LICENSE](LICENSE).
