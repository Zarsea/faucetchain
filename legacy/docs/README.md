# Legacy: documentation from before the Solana layer (archived)

These are working notes written while FaucetChain was a single EVM appchain with
Solidity contracts, before settlement moved to Solana. They are kept because
they are the honest record of how the project was thought about, and because
[../../PRIOR_WORK.md](../../PRIOR_WORK.md) has to be able to point at something
real.

**They are out of date, deliberately.** Nothing here is maintained, and where a
statement conflicts with [../../ARCHITECTURE.md](../../ARCHITECTURE.md), the
architecture document is the one that is true. Reading these to learn how
FaucetChain works today would mislead you.

| Folder | What it was |
| --- | --- |
| `vault/` | An Obsidian vault of design notes — endpoints, tokenomics, the staking UTXO model, the Solidity contracts, the AI layer |
| `fluxograma/` | One long ecosystem walkthrough, diagrams included |
| `maintenance/` | Three internal reports on structure, components and proposed improvements |

Most of it is in Portuguese, which is the other reason it is here rather than in
the root: the hackathon asks for English, and translating notes that no longer
describe the system would be work spent making a wrong document readable.

## What replaced them

- [../../ARCHITECTURE.md](../../ARCHITECTURE.md) — how the two layers fit
  together, kept current with every infrastructure change.
- [../../FaucetChain_Master_WhitePaper.md](../../FaucetChain_Master_WhitePaper.md)
  — what the project is for and how it pays for itself.
- [../../README.md](../../README.md) — what this repository holds and how to run
  it.
- [../evm/](../evm/) — the Solidity contracts themselves, archived the same way
  and for the same reason.
