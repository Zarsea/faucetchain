# FaucetChain

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
   `claim_reward`. A receipt account is created for that leaf, so the same
   reward cannot be withdrawn twice. The fee payer is a separate signer, so a
   relayer can pay the fee and the rent for a user holding no SOL.

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

## Layout

| Path | What it is |
| --- | --- |
| `api_server.py` | The appchain sequencer: claims, quota, FaucetHub, settlement endpoints |
| `settlement.py` | Builds a reward batch: leaves, root and proofs |
| `publish_root.py` | Publishes a closed batch's root on Solana |
| `solana_settlement.py` | Instruction encoders and RPC, keyed off the built IDL |
| `faucetchain/` | Anchor workspace with the settlement program |
| `components/`, `services/`, `utils/` | React explorer and faucet front end |
| `tests/` | Backend checks, each file runnable on its own with no test framework |
| `verify_chain.py` | Independent auditor of the appchain, trusting no server |
| `ARCHITECTURE.md` | How the two layers fit together, and what each one can and cannot do |
| `legacy/evm/` | The EVM contracts the prototype used before the Solana layer |

## Running it

**Backend** (Python 3.11+):

```bash
pip install fastapi uvicorn eth-account eth-hash pycryptodome solders requests
python api_server.py            # http://localhost:8000, docs at /docs
python tests/test_settlement_api.py
python tests/test_security_fixes.py
```

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

That script opens a campaign, funds a vault, links two wallets, closes a batch,
publishes its root on-chain and has both users withdraw with the proof the
sequencer serves — while holding no SOL. Nothing in it is mocked: if the tree
the backend builds were not the tree the program verifies, it would fail.

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
receipt accounts the demo leaves behind. Devnet SOL is slow to collect, so iterate
against `solana-test-validator`, which is free and resets, and spend devnet only on
the run someone else is going to watch.

Keep the funder and the relayer as their own throwaway keypairs — both are in
`.gitignore`. Funding them from the upgrade authority costs one transfer and means
the key that can replace the program never has to sit on the machine running a demo.
### Environment

| Variable | Used for |
| --- | --- |
| `PASSWORD_SALT` | Hashing passwords of custodial accounts |
| `INTERNAL_FAUCET_WALLET`, `INTERNAL_FAUCET_API_KEY` | The built-in faucet that pays micro-claims |
| `CLAIM_IP_HOURLY_WALLETS` | How many wallets one IP may claim for per hour (default 5) |
| `SETTLEMENT_OPERATOR_TOKEN` | Guards crediting rewards and closing batches |
| `SETTLEMENT_CAMPAIGN_SPONSOR` | The wallet that opened the campaign, for the PDA |
| `SETTLEMENT_OPERATOR_KEYPAIR` | Keypair that signs `publish_root` |
| `SETTLEMENT_RELAYER_KEYPAIR` | Keypair that pays the fee and the rent of a user's withdrawal |
| `SOLANA_RPC_URL` | Defaults to devnet |

## Hackathon

Built for the Crypto World's Fair hackathon (Colosseum), September 14 –
October 12, 2026. FaucetChain existed as a prototype before the event;
[PRIOR_WORK.md](PRIOR_WORK.md) states exactly what, and the `pre-hackathon` tag
marks the baseline commit. Everything after it is hackathon work.

MIT licensed — see [LICENSE](LICENSE).
