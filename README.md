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

## Layout

| Path | What it is |
| --- | --- |
| `api_server.py` | The appchain sequencer: claims, quota, FaucetHub, settlement endpoints |
| `settlement.py` | Builds a reward batch: leaves, root and proofs |
| `publish_root.py` | Publishes a closed batch's root on Solana |
| `faucetchain/` | Anchor workspace with the settlement program |
| `components/`, `services/`, `utils/` | React explorer and faucet front end |
| `tests/` | Backend checks, each file runnable on its own with no test framework |
| `verify_chain.py` | Independent auditor of the appchain, trusting no server |
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

**Solana program** (Rust 1.89, Solana CLI 4.2, Anchor 1.2):

```bash
bash scripts/build-program.sh   # anchor build --arch v0, plus the rustup
                                # workaround the SBF toolchain needs
cd faucetchain
cargo test -p faucetchain       # unit tests plus the end-to-end flow on LiteSVM
```

Build the program with that script, not with a bare `anchor build`: Anchor 1.2
defaults to SBPF v3, and the LiteSVM runtime the tests use cannot load that ELF.

### Environment

| Variable | Used for |
| --- | --- |
| `PASSWORD_SALT` | Hashing passwords of custodial accounts |
| `INTERNAL_FAUCET_WALLET`, `INTERNAL_FAUCET_API_KEY` | The built-in faucet that pays micro-claims |
| `CLAIM_IP_HOURLY_WALLETS` | How many wallets one IP may claim for per hour (default 5) |
| `SETTLEMENT_OPERATOR_TOKEN` | Guards crediting rewards and closing batches |
| `SETTLEMENT_CAMPAIGN_SPONSOR` | The wallet that opened the campaign, for the PDA |
| `SETTLEMENT_OPERATOR_KEYPAIR` | Keypair that signs `publish_root` |
| `SOLANA_RPC_URL` | Defaults to devnet |

## Hackathon

Built for the Crypto World's Fair hackathon (Colosseum), September 14 –
October 12, 2026. FaucetChain existed as a prototype before the event;
[PRIOR_WORK.md](PRIOR_WORK.md) states exactly what, and the `pre-hackathon` tag
marks the baseline commit. Everything after it is hackathon work.

MIT licensed — see [LICENSE](LICENSE).
