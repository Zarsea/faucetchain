# AI Agents in Crypto Economies: Faucets, Identity, Payments, Sybil Resistance (state as of Nov 2026)

## Faucets and onboarding designed for agents (CDP/AgentKit, Solana devnet, others), and their rate limits and anti-abuse

### Takeaway
Agent-facing faucets exist, but they are deliberately stingy. They meter per account and per address over rolling 24h windows, and the official Solana web faucet explicitly tells AI agents not to use it, pointing them to a proof-of-work faucet instead. The industry pattern is "humans get a gated web faucet; agents get metered API keys or PoW". That matches FaucetChain's separate Agent Lane.

### Cited Findings
- The Coinbase CDP Faucet API applies rate limits within a rolling 24-hour window, at both the CDP User (API account) level and the blockchain address level. One address cannot exceed the limits even if several users request funds for it — [CDP docs: Request funds on EVM test networks](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/faucets/request-funds-on-evm-test-networks)
- CDP EVM testnet amounts (Base Sepolia / Ethereum Sepolia): ETH 0.0001 per request with a 0.1 ETH cap per 24h; USDC 1 per request with a 10 USDC cap per 24h. EURC and cbBTC are also offered; Ethereum Hoodi is ETH only — [CDP docs](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/faucets/request-funds-on-evm-test-networks)
- CDP Solana devnet amounts: 0.00125 SOL per request with a 0.0125 SOL cap per rolling 24h — [CDP docs: Solana devnet faucet](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/faucets/request-funds-on-solana-devnet.md)
- AgentKit exposes a `request_faucet_funds` action that wraps the CDP faucet. Agents call it as a tool — [AgentKit TS docs](https://coinbase.github.io/cdp-agentkit-nodejs/cdp-agentkit-core/modules/actions_cdp_request_faucet_funds.html); [LangChain CDP AgentKit integration](https://python.langchain.com/docs/integrations/tools/cdp_agentkit)
- Informal user guide: AgentKit faucet failures often surface as a generic "try again later" error, so users fund wallets from elsewhere (informal, may be dated) — [Substack guide](https://0xsianliu.substack.com/p/hands-on-crypto-create-your-own-ai)
- faucet.solana.com (checked Nov 2026): "Maximum of 2 requests every 8 hours". GitHub sign-in unlocks a higher limit, and GitHub accounts are validated, so some fail verification. The page states "AI agents should not use this faucet" and directs agents to the CLI (`solana airdrop`), a local validator, or a PoW faucet (`cargo install devnet-pow`; `devnet-pow mine -d 3 --reward 0.02 ...`) — [faucet.solana.com](https://faucet.solana.com/)
- The Solana Foundation open-sourced its devnet faucet with built-in rate limiting — [GitHub solana-developers/solana-devnet-faucet](https://github.com/solana-developers/solana-devnet-faucet)
- CLI airdrop limits are not officially documented. Third-party guides cite about 2 SOL per request and about 2-5 requests per minute, often throttled at peak times (secondary, approximate) — [Eco support article](https://eco.com/support/en/articles/17593748-solana-devnet-faucet-get-devnet-sol-and-connect-to-devnet); [Metaplex docs](https://developers.metaplex.com/solana/airdrop-sol-for-development)

### Inferences
- Anti-abuse in agent faucets rests on three levers: (a) an accountable account key (CDP API key / GitHub identity), (b) per-address caps, and (c) costly work (PoW) for anonymous agents. FaucetChain's design (a $CLAIM bond per agent, a cap per owner and per address, PoW or useful work) is the stronger, stake-backed version of the same thing.
- Solana's "agents: use PoW, not the human faucet" split is the closest real precedent for an Agent Lane kept apart from human partner campaigns.
- Faucet amounts are tiny (test assets). No mainnet faucet for agents with real value was found. A mainnet agent faucet with real token value would be new territory and needs bonds rather than just rate limits.

### Gaps
- No source found for any mainnet (real-value) faucet aimed at agents.
- AgentKit-specific faucet throttling beyond the CDP API limits is undocumented.
- Not researched: other agent faucets (e.g., Alchemy or QuickNode faucets with API-key gating).

## Agent payment rails (x402, Google AP2, Stripe/Tempo MPP, Solana agent kits) and adoption numbers

### Takeaway
x402 is the de facto crypto agent-payment rail. Headline numbers are large (100M+ transactions on Base by Q1 2026; 200M+ total by June 2026), but real economic volume is small (about $28K-40K/day) and about half of transactions are judged artificial. AP2 (Google) handles authorization ("mandates") and uses x402 for stablecoin settlement. Stripe/Tempo launched MPP in March 2026. Wash activity on payment rails is the main warning for any "agent activity" metric FaucetChain rewards.

### Cited Findings
- x402 passed 100M transactions on Base by about Q1 2026 — [KuCoin news](https://www.kucoin.com/news/flash/coinbase-s-x402-protocol-surpasses-100-million-transactions-on-base); [Crypto Briefing](https://cryptobriefing.com/coinbase-x402-protocol-100m-transactions-base/)
- Over 200M x402 transactions as of June 2026 (Major Matters x402 Adoption Tracker), while "the real volume is still tiny" — [Glenbrook](https://glenbrook.com/payments_news/the-x402-foundation-activated-a-27-year-old-internet-code-200-million-transactions-later-the-real-volume-is-still-tiny/)
- Forkast (July 10, 2026):
  - Artemis Analytics estimates about 50% of x402 transactions are artificial, through self-dealing (one wallet as buyer and seller) and wash cycling of seller funds.
  - About 75.4M transactions and about $24M volume over 30 days.
  - Real daily volume of $28K-40K (Major Matters); CoinDesk reported about $28K/day.
  - Average transaction $0.32.
  - The x402 Foundation launched in April 2026 under the Linux Foundation.
  — [Forkast](https://forkast.news/half-of-x402s-transaction-volume-is-artificial-the-infrastructure-layer-keeps-building-anyway/)
- About 731K x402 transactions/day in Dec 2025, falling to about 57K/day by Feb 2026 — [BeInCrypto](https://beincrypto.com/x402-transactions-drop-in-feb)
- Solana held about 70% of monthly x402 volume as of mid-Aug 2026. Week of Aug 17, 2026: 8.7M machine-to-machine transfers, a 2026 weekly record (Token Terminal data, per secondary source) — [Crypto Briefing](https://cryptobriefing.com/solana-x402-market-share-dominance/)
- Chainalysis (reported in Portuguese press): over 87% of x402 payments in the 16 months to Sep 2026 were between $0.0001 and $0.10 — [LetsMoney](https://www.letsmoney.com.br/cripto/chainalysis-agentes-ia-pagamentos-cripto/)
- Google announced AP2 on Sep 16, 2025, as an extension of A2A and MCP, with an x402 extension built with Coinbase, the Ethereum Foundation and MetaMask for stablecoin payments — [Coinbase launch page](https://www.coinbase.com/developer-platform/discover/launches/google_x402); [Decrypt](https://decrypt.co/339752/google-reveals-ai-agent-payments-protocol-coinbase-ethereum-foundation)
- AP2 = authorization (signed user "mandates"); x402 = settlement. A 2026 setup guide says the AP2-native x402 extension is still pending and Google's samples are demos (secondary) — [CoinsDo explainer](https://www.coinsdo.com/en/blog/x402-ap2-agent-payment-protocols-explained); [Stablecoin Insider guide](https://stablecoininsider.org/how-to-set-up-ap2-x402-stablecoin-payments/)
- Stripe + Paradigm-incubated Tempo launched the Machine Payments Protocol (MPP) with Tempo mainnet on March 18, 2026. It is payment-method agnostic (stablecoins on Tempo, cards; a Visa card spec). Stripe also has the Agentic Commerce Protocol (ACP) and supports x402 — [Fortune](https://fortune.com/2026/03/18/stripe-tempo-paradigm-mpp-ai-payments-protocol/); [Decrypt](https://decrypt.co/361573/stripe-backed-tempo-network-launches-ai-agent-payments); [Crowdfund Insider](https://www.crowdfundinsider.com/2026/03/267630-stripe-backed-tempo-introduces-machine-payments-protocol). A secondary source claims 100+ launch partners and an IETF submission (unverified) — [BlockEden](https://blockeden.xyz/blog/2026/03/27/tempo-machine-payments-protocol-stripe-paradigm-ai-agent-micropayments/)
- Coinbase Agentic Wallets (launched Feb 11, 2026):
  - Per-session and per-transaction spending limits enforced at the infrastructure layer.
  - Keys held in Coinbase enclaves, never exposed to the LLM.
  - Built-in KYT screening that blocks high-risk interactions.
  - Native x402 support.
  — [Coinbase launch](https://www.coinbase.com/developer-platform/discover/launches/agentic-wallets); [CDP Agentic Wallet docs](https://docs.cdp.coinbase.com/agentic-wallet/cli/welcome)

### Inferences
- If FaucetChain rewards "agent activity" (transaction counts, payments), expect about 50% to be wash activity, as on x402. Reward verified *outcomes* (accepted bounties, sealed blocks, valid PoW), not volume.
- x402 on Solana (about 70% share) is a natural rail for agents to pay FaucetChain bond or service fees, or for bounty payouts, given the settlement already on Solana.
- Infrastructure-level spending caps and KYT (Coinbase) are the payment-side equivalent of "rate limits per owner". FaucetChain can require an agent's withdrawal address to sit behind such policy wallets, or mirror the same caps natively.

### Gaps
- No primary-source current (Q3-Q4 2026) total x402 count found. Figures conflict by date and source.
- No AP2 production adoption numbers found.
- MPP volume numbers not found.
- Solana Agent Kit (SendAI) adoption not researched in this pass.

## Agent identity and reputation standards (ERC-8004, World ID / proof of personhood vs proof of agent) and binding agents to an accountable owner

### Takeaway
ERC-8004 (Draft, created Aug 2025) is the leading on-chain agent registry: an ERC-721 identity plus reputation and validation registries, live on about 11 mainnets. It binds an agent to an owner via NFT ownership plus a signature-verified `agentWallet`. It explicitly does NOT solve Sybil resistance. World's AgentKit (Mar 2026) adds "human-backed agents" by delegating a World ID to an agent and integrating with x402. Together they map onto FaucetChain's need: identity (8004) + unique-human owner (World ID) + economic bond.

### Cited Findings
- ERC-8004 "Trustless Agents": Draft Standards Track ERC, created 2025-08-13; requires EIP-155, EIP-712, EIP-721, EIP-1271 — [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004)
- ERC-8004 registries — [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004):
  - Identity: ERC-721 + URIStorage, with an `agentURI` that points to a registration file (endpoints: A2A, MCP, ENS, DID, trust models). Optional domain proof via a `.well-known` file.
  - Reputation: signed feedback scores with tags, revocable, with responses (e.g., refunds).
  - Validation: a validator scores work 0-100. Incentives and slashing are left to the validation protocol. Named validation methods: stake-secured re-execution, zkML, TEE oracles, trusted judges.
- Owner binding in ERC-8004 — [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004):
  - The NFT owner controls the agent and can delegate to operators.
  - The reserved `agentWallet` (payment address) defaults to the owner. Changing it requires an EIP-712 / EIP-1271 signature from the new address.
  - An NFT transfer clears `agentWallet`, so it must be re-verified.
  - Payments are out of scope, but x402 payment proofs can be attached to feedback.
- ERC-8004 security considerations admit Sybil attacks can inflate reputation. The answer is public signals plus third-party reputation systems that weight or filter reviewers — [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004)
- Deployment: one SDK lists 11 supported mainnets (Ethereum, Base, Polygon, Arbitrum, Optimism, ...) — [PyPI strands-erc8004](https://pypi.org/project/strands-erc8004/). A community GitHub issue claims more than 256K agents registered on Base mainnet (unverified) — [base/skills issue #36](https://github.com/base/skills/issues/36). A per-agent explorer exists — [QuickNode ERC-8004 Explorer](https://erc-8004.quicknode.com/agents/ethereum-mainnet/23034). Third-party skills report about 100-200K gas per registration — [skillselion](https://skillselion.com/skills/bankrbot/skills/erc-8004)
- World AgentKit (beta, Mar 17, 2026):
  - Lets verified humans delegate their World ID to agents ("human-backed agents"), proving a unique human is behind an agent without revealing identity.
  - Integrates with x402, so a site can require proof-of-human, payment, or both.
  - World reports about 18M verified humans in 160+ countries. Orb verification is needed.
  — [TechCrunch](https://techcrunch.com/2026/03/17/world-launches-tool-to-verify-humans-behind-ai-shopping-agents/); [The Defiant](https://thedefiant.io/news/infrastructure/world-launches-agentkit-to-let-ai-agents-carry-proof-of-human-backing); [Forklog](https://forklog.com/en/world-unveils-agentkit-for-identity-verification-in-the-agent-internet/)
- Other identity-filter practice: Story integrated Human Passport (ex-Gitcoin Passport) before its airdrop; Monad used heavy anti-Sybil criteria, which drew community frustration over opacity — [human.tech blog](https://human.tech/blog/identity-is-the-next-battleground-for-web3-airdrops-ai-agents-and-the-return-of-digital-trust)

### Inferences
- Agent Lane binding model:
  - Register each agent as an ERC-8004-style identity (or a native equivalent on the appchain) whose owner key posts the $CLAIM bond.
  - Cap agents per owner. If the owner is World ID / Human Passport-verified, "rate limits per owner" become rate limits per unique human.
  - Slash the bond, not reputation, for abuse, because 8004 reputation itself is Sybil-able.
- The ERC-8004 rule that a transfer clears `agentWallet` is worth copying, so reputation and bonded status can't be sold silently.
- Proof-of-personhood fits the *owner*, not the agent. Requiring it for every agent defeats the lane's purpose. Requiring it per owner with N agents per owner works.

### Gaps
- No authoritative ERC-8004 registration total (8004.org / contracts repo not checked). The 256K figure is unverified.
- No data on World AgentKit adoption after launch.
- Not researched: other registries (Olas on-chain service registry NFTs, Fetch.ai Almanac, Virtuals agent NFTs) in depth.

## Agent economies and marketplaces (Virtuals, ai16z/ElizaOS, Olas, Bittensor, Fetch.ai/ASI): what incentive designs worked or failed

### Takeaway
Designs that tie emissions to verifiable, KPI-checked activity with eviction (Olas PoAA staking), or to validator-scored work with deregistration of dead subnets (Bittensor), have survived. Designs whose value rested on a speculative agent token with insider control failed (ai16z/ElizaOS token declared "dead" Aug 2026). Virtuals' aGDP metric is contested; escrowed job flow (ACP) is its sturdier answer to fake activity. Real scale is modest: Olas about 400-700 daily active agents.

### Cited Findings
- **Olas (PoAA):**
  - Rewards are "based on agent activity and performance, not just token lockup". PoAA is described as a mix of PoS and PoW.
  - Launchers (DAOs/protocols) define KPIs and deploy staking contracts, and DAO votes direct OLAS emissions to each contract.
  - Operators run agents (e.g., via the Pearl app).
  — [olas.network/staking](https://olas.network/staking); [PoAA whitepaper](https://staking.olas.network/poaa-whitepaper.pdf)
- Olas staking mechanics, from Valory repo PRs (secondary):
  - Services call `checkpoint()` periodically for liveness checks and reward calculation.
  - A service is evicted after 2 consecutive checkpoints without meeting the activity threshold.
  - Minimum staking duration is about 3 days.
  - Example programs require 100 OLAS (hobbyist) or 1,000 OLAS (pro) stakes (amounts may be outdated).
  — [trader-quickstart PR 255](https://github.com/valory-xyz/trader-quickstart/pull/255/files); [PR 339](https://github.com/valory-xyz/trader-quickstart/pull/339/files)
- Olas defines a Daily Active Agent as a multisig with at least one attributed on-chain interaction in a UTC day. Omenstrat (prediction-market agents) had 362 DAAs as of Jun 14, 2026 (30-day avg 375) — [Olas agent explorer blog](https://olas.network/blog/agent-explorer). The Olas timeline cites 599 DAAs across 9 chains at a March 31 milestone (year unclear) — [Olas timeline](https://olas.network/timeline). A third-party profile reports about 419 DAAs (7-day avg), 3,711 unique operators and about $109K Mech Marketplace turnover as of Sep 2026 (secondary) — [AI Market Watch](https://www.ai-market-watch.com/company/olas)
- **Virtuals:**
  - About $479M cumulative "agentic GDP" (aGDP), 18K+ agents and about 1.77M completed tasks as of Mar 2026 (secondary) — [BlockEden](https://blockeden.xyz/blog/2026/04/21/agdp-agent-gdp-virtuals-protocol-ai-blockchain-valuation-primitive-tvl-displacement/)
  - Forkast cites about $470M and raises an "evaluator problem" (who verifies the work an agent buyer pays for) — [Forkast](https://forkast.news/the-machine-as-buyer-virtuals-acp-and-the-evaluator-problem/)
  - The Agent Commerce Protocol (ACP) requires on-chain escrow before a job starts, presented as a guard against fabricated activity. Defenders cite about $39.5M cumulative protocol revenue as a harder metric than aGDP — [BlockEden May 2026](https://blockeden.xyz/blog/2026/05/09/virtuals-protocol-ai-economic-os-agdp-agent-platform/)
  - Fundstrat (Jun 24, 2026): ACP is the largest revenue segment, but volumes and fees moderated with the on-chain pullback — [Fundstrat Q2 update PDF](https://fundstrat.com/wp-content/uploads/2026/06/20260624-Digital-Asset-Strategy-Virtuals-Protocol-–-Growing-Agentic-GDP-Q2-Update.pdf)
- **ai16z / ElizaOS:**
  - Rebranded Jan 28, 2025, after a16z naming concerns — [Decrypt](https://decrypt.co/303244/ai-dao-ai16z-becomes-elizaos-amid-branding-confusion-concerns)
  - In Aug 2026 founder Shaw Walters declared the token "dead" after a lawsuit settlement depleted the treasury, ruling out buybacks or a replacement token. The token was down more than 97% from its peak.
  - The complaint alleged insider control of a token marketed as governing an "autonomous AI fund", and supply expansion from 1.1B to 11B during a migration (allegations, not findings). ElizaOS software development continues.
  — [Cointelegraph](https://cointelegraph.com/news/elizaos-token-record-low-founder-declares-dead); [Decrypt](https://decrypt.co/374958)
- **Bittensor:**
  - First halving Dec 2025: daily emissions 7,200 to 3,600 TAO — [The Block](https://www.theblock.co/amp/post/381638/bittensors-halving-tao-price)
  - Subnet emission share is now driven by net TAO staking flows ("Taoflow") per one source. Official docs describe a price-based formula with a miner-burn penalty shipped Jun 2026; these conflict — [FalconX](https://falconx.io/newsroom/state-of-bittensor-subnet-adoption-trends-network-mechanics-and-covenants-departure); [Bittensor emissions docs](https://www.bittensor.com/docs/concepts/emissions)
  - Subnet deregistration returned Sep 2025, with a 4-month immunity period for new subnets — [FalconX](https://falconx.io/newsroom/state-of-bittensor-subnet-adoption-trends-network-mechanics-and-covenants-departure)
  - Emissions were reportedly halted for 57 of 128 subnets on Jun 22, 2026, targeting inactive ones (single secondary source) — [OurCryptoTalk](https://ourcryptotalk.com/news/bittensor-subnet-emissions-halted-57-subnets)
  - Weight rules drop self-weights and weights set before a neuron's latest registration — [Bittensor emissions docs](https://www.bittensor.com/docs/concepts/emissions)

### Inferences
- What worked: (1) stake to participate, (2) on-chain KPI or validator check per epoch, (3) eviction or deregistration for inactivity, (4) emission budgets set per program and capped. This is essentially the Agent Lane: separate quota + bond + verifiable work. Olas' "2 missed checkpoints, then evicted" is a simple, proven liveness rule to copy.
- What failed: tokens whose value depends on narrative and insider-controlled treasuries (ai16z), and activity metrics that count gross volume (aGDP, x402 counts) without escrow or validation.
- Escrow-before-job (Virtuals ACP) maps directly to the FaucetChain bounty board: require the bounty poster's funds in escrow and a validator or acceptance step before agent payout.

### Gaps
- Fetch.ai / ASI Alliance: no current data gathered in this pass (agent counts, Almanac registry, ASI token status).
- Bittensor: no source on weight-copying mitigations (commit-reveal) found in this pass. The emission-formula conflict is unresolved.
- No official Olas current-DAA figure (live counter at olas.network/data not captured).

## Sybil resistance when participants are bots by design, and risks (airdrop farming, wash activity, separating agent and human traffic)

### Takeaway
When bots are legitimate participants, "detect the bot" no longer works. What works is making each identity cost something (a bond or stake), tying rewards to verified output (validation, escrow, PoW), and capping rewards per accountable owner, ideally a unique human. Wash activity is the dominant observed failure (about 50% of x402). Platforms separate traffic through distinct channels (Solana: human web faucet vs agent PoW/CLI) and proof-of-human gating (World AgentKit, Human Passport), not behavioral heuristics alone.

### Cited Findings
- About 50% of x402 transactions are artificial (self-dealing, wash cycling) per Artemis — [Forkast](https://forkast.news/half-of-x402s-transaction-volume-is-artificial-the-infrastructure-layer-keeps-building-anyway/)
- ERC-8004 admits reputation is Sybil-able and leaves incentives and slashing to validation protocols (stake-secured re-execution, zkML, TEE) — [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004)
- Solana's web faucet bars AI agents, gates higher limits on a validated GitHub identity, and offers PoW to agents — [faucet.solana.com](https://faucet.solana.com/)
- CDP enforces limits per account and per address, so multiple accounts can't pile onto one address — [CDP docs](https://docs.cdp.coinbase.com/api-reference/v2/rest-api/faucets/request-funds-on-evm-test-networks)
- Airdrop Sybil detection relies on graph clustering (Louvain, K-Core on transfer graphs) plus behavioral filtering, as in Trusta's framework and Arbitrum's allocation — [ethresear.ch Trusta](https://ethresear.ch/t/trusta-s-ai-and-machine-learning-framework-for-robust-sybil-resistance-in-airdrops/16828). Academic work notes the lack of ground truth makes detection hard — [arXiv 2209.04603](https://arxiv.org/pdf/2209.04603)
- Commentary (early 2026): Sybil defense has shifted from click-spamming scripts to agents that "post, trade, coordinate, and blend in" — [human.tech](https://human.tech/blog/identity-is-the-next-battleground-for-web3-airdrops-ai-agents-and-the-return-of-digital-trust). A vendor opinion claims heuristic filters lose much of their value against AI-automated behavior (opinion, not measured) — [ChainScore](https://www.chainscorelabs.com/blog/tokenomics-design-mechanics-and-incentives/sybil-resistance-and-proof-of-personhood/why-ai-generated-identities-will-break-current-sybil-defenses)
- Vendor-cited loss estimates: about 17% Sybil addresses in Optimism's second airdrop and about $6M of UNI to Sybil clusters (unverified vendor figures) — [ChainAware](https://chainaware.ai/learn/use-cases/sybil-resistant-token-distribution.html)
- Policy wallets: Coinbase Agentic Wallets enforce per-session and per-transaction caps and KYT at the infrastructure layer — [Coinbase](https://www.coinbase.com/developer-platform/discover/launches/agentic-wallets)
- Olas evicts staked agents that miss activity KPIs; Bittensor deregisters or halts emissions to inactive subnets — [Valory PR 255](https://github.com/valory-xyz/trader-quickstart/pull/255/files); [OurCryptoTalk](https://ourcryptotalk.com/news/bittensor-subnet-emissions-halted-57-subnets)

### Inferences
- Agent Lane guardrails backed by these sources:
  1. Separate channels: partner campaigns accept only human-gated claims (proof-of-personhood or existing human checks). Agent-registered addresses (bonded IDs) are excluded from partner Merkle roots by construction, not by heuristics.
  2. Bond per agent, scaled to the agent's max claimable over its unbonding period, so farming with N agents costs N bonds. Slash on wash or self-dealing bounty patterns or invalid work.
  3. Cap per owner (ideally a unique human) on agent count and on the share of the Agent Lane quota.
  4. Pay for verified output: valid PoW shares, sealed blocks, or bounties accepted by a non-affiliated poster with escrow. Never pay for raw transaction counts.
  5. Liveness eviction (Olas-style: N missed checkpoints, then evicted) for node-running agents.
  6. Graph clustering as a back-stop audit before Merkle-root publication on Solana, not as the primary defense.
- Bounty self-dealing (an owner posts a bounty and their own agent completes it) is the FaucetChain analogue of x402 self-dealing. Block owner-to-own-agent matches and require escrow from the poster.
- Future agent liquidity provision to faucets is untested by any source found. Treat it as a separate, later design that needs its own risk model.

### Gaps
- No measured data on what share of recent airdrop farming is LLM-agent-driven vs scripted bots.
- No public case study found of a faucet or appchain running a bonded "agent lane" with a separate emission quota. This appears novel.
- No source on agents providing faucet liquidity or reserves.
