# Prior Work Disclosure

**Event:** Crypto World's Fair Hackathon (Colosseum), September 14 – October 12, 2026
**Baseline:** the commit tagged `pre-hackathon`

FaucetChain existed as a prototype before the hackathon. Everything in the `pre-hackathon` commit was built before September 14, 2026. Every commit after that tag is hackathon work.

## Evidence

- The repository had no commits before the baseline. Files had been staged, but no history existed.
- No project file was modified between 2026-09-14 and the baseline commit, checked by file modification time. The only exceptions are SQLite runtime files (`*.db-shm`, `*.db-wal`), which are not versioned.

## What existed before the hackathon

**Concept and documentation**
- Whitepaper in Portuguese (March 2026), FaucetHub integration guide (June 2026), maintenance and audit reports (April–July 2026), Obsidian notes in `FaucetChain-Vault/`.

**Native chain prototype** (Python, FastAPI, SQLite — `api_server.py`)
- Chain ID 7777 with its own genesis block, run by a single sequencer.
- Proof of Claim: browser-side keccak proof of work (16 bits) required for every claim.
- Hourly emission quota of 2,000 CLAIM with depletion ("hiato") and a 99,000,000 CLAIM hard cap.
- Stake-weighted sealer selection, multi-claim blocks with Merkle roots, EIP-191 signatures on claim, stake, unstake and transfer.
- Epoch root notarization (`anchor_service.py`) and an independent chain auditor (`verify_chain.py`).

**Products on top of the prototype**
- FaucetHub: faucet registration with API keys, off-chain micro-claim ledger, settlements, Proof of Reserve endpoint.
- Sentinel anti-Sybil detector (`FraudAndBonusDetector.py`) and a vector knowledge base (ChromaDB).
- Web explorer (React + Vite) and the CyberDrip gamified faucet.
- Mining node (Node.js CLI and Electron app) sending heartbeats and sealing blocks.

**Smart contracts** (Solidity, Hardhat — `contracts/`)
- FaucetToken_CLAIM, HourlyEpochManager, DAppStakingRegistry, UTXOStakingVault, YieldAccumulatorVault, HubRegistryRoots, AutoClaimDistributor, CommunityBountyBoard, CrossChainYieldRouter.
- They compile but were never called by the backend and were never deployed to a public network.

**Solana:** nothing. No Solana program, SDK integration, wallet integration or deployment existed before the hackathon.

## What is built during the hackathon

Architecture: FaucetChain stays a micro-distribution appchain; Solana becomes the settlement and liquidity layer.

- Solana program (Anchor): campaign vaults funded by partner projects, a reward-root registry and withdrawals with Merkle proofs.
- The flow that turns FaucetChain reward roots into withdrawals on Solana, with fees sponsored through Kora.
- Solana wallet support (Wallet Standard) in the explorer, replacing MetaMask and EIP-191 where claims settle on Solana.
- Security fixes to the prototype found in a code review on 2026-09-15: client-controlled claim amount, uptime rewards outside the hourly quota, unauthenticated micro-claim withdrawal, hardcoded client-side faucet key, bot resistance of the hourly quota.
- English documentation, demo and pitch.

## Housekeeping included in the baseline commit (2026-09-15)

These changes were needed to publish the repository safely and do not add functionality:

- Removed secrets and local data from version control: `.env` files, SQLite databases, vector database files, Python caches and Hardhat build output.
- Replaced a hardcoded Google API key in `test_genai.py` with an environment variable.
- Added `LICENSE` (MIT) and this file.

## Third-party code

- OpenZeppelin Contracts (MIT) in the Solidity contracts.
- Open-source dependencies declared in `package.json`, `mining-node/package.json` and `requirements-vector-db.txt`.
