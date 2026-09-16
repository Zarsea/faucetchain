# Legacy: EVM contracts (archived)

These Solidity contracts and the Hardhat setup were written before the Crypto
World's Fair Hackathon (see [../../PRIOR_WORK.md](../../PRIOR_WORK.md)). They
compile, but the backend never called them and they were never deployed to a
public network.

They stay here as the written form of the protocol rules, not as part of the
product:

| Contract | Rule it states |
|---|---|
| `FaucetToken_CLAIM.sol` | 99,000,000 hard cap, minting restricted to the epoch manager, opt-in burn |
| `HourlyEpochManager.sol` | 2,000 CLAIM per hour, depletion ("hiato") until the next hour |
| `DAppStakingRegistry.sol` | a faucet needs 10,000 CLAIM staked to be authorized |
| `UTXOStakingVault.sol` | staking positions as NFTs with timelock tiers |
| `HubRegistryRoots.sol` | epoch Merkle roots anchored on an external chain |
| `AutoClaimDistributor.sol` | epoch rewards split by node uptime |
| `CommunityBountyBoard.sol` | bounties with escrowed rewards |
| `YieldAccumulatorVault.sol`, `CrossChainYieldRouter.sol` | treasury yield ideas, never implemented |

`anchor_service.py` is the notary that published those Merkle roots to an EVM
chain. On Solana the same job belongs to the program's root registry.

The live rules now run in `api_server.py` (hourly quota, hard cap, cooldown,
proof of claim) and, from this hackathon on, in the Solana program.

To compile the archive again, from the repository root:

```bash
npx hardhat --config legacy/evm/hardhat.config.ts compile
```

It needs `PRIVATE_KEY` in the environment, and the source path may need
adjusting since the config moved.
