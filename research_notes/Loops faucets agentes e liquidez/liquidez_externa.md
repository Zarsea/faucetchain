# External liquidity for an early-stage appchain token ($CLAIM) with a Solana focus

Research date: 2026-11-04. Most sources are search-result pages (official docs where available). Vendor blogs (market makers, listing agencies) are flagged as such. Nothing here is investment advice. It describes mechanisms and evidence only.

## 1. Bringing an appchain token to Solana: SPL representation, bridging vs native mint, wrapped-asset risks

### Takeaway
Three options exist: (a) a bridge-wrapped SPL that is a claim on $CLAIM locked on the appchain, (b) a native SPL mint with Solana as the canonical ledger (the appchain then holds the mirror), or (c) a burn-and-mint / hub-and-spoke framework such as Wormhole NTT. Wrapped assets carry bridge-custody risk. The canonical case is the Wormhole exploit of Feb 2022, where 120k unbacked wETH were minted on Solana and its peg broke. A small project without a third-party bridge will most likely run its own mint authority or relayer, which makes that key the single point of trust.

### Cited Findings
- Wormhole Native Token Transfers (NTT) supports two models, burn-and-mint and hub-and-spoke, and works with SPL tokens on Solana. — [Wormhole NTT overview](https://wormhole.com/docs/products/native-token-transfers/overview)
- With burn-and-mint on Solana, the SPL mint authority must be moved to a PDA controlled by the NTT program, or to an SPL multisig. Hub-and-spoke with Solana as the hub skips this step. By default, inbound transfers to Solana need a manual relay or redeem transaction unless automatic relaying is set up. — [Wormhole: deploy NTT to Solana](https://wormhole.com/docs/products/token-transfers/native-token-transfers/guides/deploy-to-solana)
- Per the docs, NTT v2.0.0+ on Solana supports SPL tokens with transfer hooks, which is a Token-2022 feature. — [Wormhole NTT Solana deploy guide](https://wormhole.com/docs/build/transfers/native-token-transfers/deployment-process/deploy-to-solana) (version details should be checked against the current release)
- Wormhole exploit (Feb 2, 2022): a code flaw let an attacker mint 120,000 wETH on Solana without locking ETH, about $320M lost. It disrupted wETH's peg on Solana and the projects using it. Jump Crypto replenished the 120k ETH to restore 1:1 backing. — [Decrypt](https://decrypt.co/91962/crypto-bridge-wormhole-replenished-after-hack-320m-ethereum); [Blockworks](https://blockworks.co/news/in-second-largest-defi-hack-ever-blockchain-bridge-loses-320m-ether)
- My search did not surface good primary coverage of the 2023 Multichain collapse. It only found a separate 2022 Multichain router exploit of about $3M. — see [Decrypt coverage list](https://decrypt.co/92709/jump-crypto-wormhole-defi?amp=1) (gap noted below)

### Inferences
- FaucetChain's existing partner-campaign vaults are "classic SPL only." A Solana representation of $CLAIM minted under the classic SPL Token program (not Token-2022) would therefore plug straight into the existing Merkle-vault payout path. A Token-2022 mint with transfer hooks would not, without vault changes.
- If $CLAIM is "native" on the appchain and Solana holds a wrapped copy, the SPL supply is only as safe as the lock or escrow plus whoever signs the mint. The Wormhole case shows the failure mode: unbacked mints break the peg for everyone, including LP pools.
- A defensible minimum: publish a proof-of-reserve that ties SPL supply to the amount locked on the appchain, put the mint authority behind a multisig, and keep a fixed or declared cap on bridged supply. The cap fits naturally with the existing 2,000 $CLAIM/hour emission cap.
- An alternative is to make Solana the canonical supply (native SPL mint) and treat appchain $CLAIM as the mirror. This removes "wrapped" perception on the trading venue but moves bridge risk onto the appchain side.

### Gaps
- No verified current (2026) cost of running NTT (relayer fees, audit) for a small team.
- No primary source retrieved on the 2023 Multichain collapse or depeg magnitudes of Multichain-wrapped assets.
- Whether a custom bridge (no third party) is perceived as more or less trustworthy by Solana traders: no data found.

## 2. Liquidity bootstrapping on Solana: venues, mechanisms, costs, post-incentive outcomes

### Takeaway
Pool creation on Solana is cheap in protocol fees (Raydium CPMM about 0.15 SOL plus rent). The real cost is the paired capital (SOL/USDC) and the protocol's own tokens put at risk. Launch-specific tools such as Meteora alpha vault, fee schedulers and bonding curves (DBC, pump.fun) aim to reduce sniping and price shock. Evidence on liquidity retention after incentives end is mixed. Large drawdowns (40%+) are common, and some programs leave net gains.

### Cited Findings
**Raydium**
- CPMM (and AMM v4) pool creation: 0.15 SOL protocol fee plus about 0.042 SOL rent, about 0.19 SOL total, non-refundable. One page header shows a different figure (0.0614 SOL) that conflicts with its own breakdown. — [Raydium pool fees](https://docs.raydium.io/raydium/for-liquidity-providers/pool-fees); [Raydium protocol fees](https://docs.raydium.io/raydium/protocol/protocol-fees)
- The fee is the `create_pool_fee` on each AmmConfig (example 150000000 lamports = 0.15 SOL). A user-flow page budgets about 0.2 SOL including token accounts and priority fees. — [Raydium: how to set CPMM fees](https://docs.raydium.io/raydium/build/tips-and-gotchas/how-to-set-cpmm-fees); [Raydium create CPMM pool flow](https://docs.raydium.io/user-flows/create-cpmm-pool)

**Meteora**
- DLMM Launch Pools: concentrated liquidity in zero-slippage bins with dynamic fees that average about 6–7% for launch pools. In a permissionless setup with Alpha Vault, only SOL or USDC is accepted as quote. — [Meteora DLMM launch pool overview (search snippet; the direct URL returned 404 on fetch)](https://docs.meteora.ag/product-overview/dlmm-overview/dlmm-launch-pool-overview); [Meteora dynamic fees](https://docs.meteora.ag/product-overview/dlmm-overview/dynamic-fees)
- Alpha Vault buys from the pool before the activation slot. Pro-rata mode gives every depositor the same price, and excess deposits above the buy cap can be withdrawn. FCFS caps total deposits. — [Meteora Alpha Vault](https://docs.meteora.ag/meteoras-anti-sniper-suite-a.s.s./meteoras-anti-sniper-suite/alpha-vault)
- The anti-sniper fee scheduler on DAMM v2 frontend pools defaults to an exponential curve: 50% at trading start, falling every minute for 120 minutes to 0.25%. Docs conflict on whether Alpha Vault is live for DAMM v2 or "coming soon." — [Meteora Anti-Sniper Suite](https://docs.meteora.ag/product-overview/meteoras-anti-sniper-suite); [DAMM v2 overview](https://docs.meteora.ag/product-overview/damm-v2-overview)
- Dynamic Bonding Curve (DBC): a launchpad "partner" creates a config key (curve up to 16 segments, fees, migration target DAMM v1 or v2). A keeper auto-migrates once the quote reserve hits the threshold (one page lists a 750 USD minimum quote for some configs). At least 10% of liquidity must be locked at day one after migration. The partner gets 80% of bonding-phase fees by default. — [Meteora DBC](https://docs.meteora.ag/overview/products/dbc/what-is-dbc); [DBC developer guide](https://docs.meteora.ag/developer-guide/guides/dbc/introduction)

**Pump.fun / bonding curves**
- PumpSwap launched in March 2025. Graduated tokens migrate there instead of Raydium, and the 6 SOL migration fee was removed. — [The Block](https://www.theblock.co/post/347360/pump-fun-launches-dex-called-pumpswap-to-instantly-migrate-graduated-tokens)
- Graduation rate: historically about 1–2% of launches (0.92% in summer 2025, just over 1% in a Jan 2026 day). After BOOST incentive changes, one day hit 6.7% (a single-day figure). Market-cap thresholds are reported inconsistently, from about $30K to $100K depending on SOL price and date. — [Solana Compass](https://solanacompass.com/news/pumpfun-launched-42000-tokens-in-one-day-fewer-than-2-will-ever-reach-a-dex); [The Block, Jul 2026](https://theblock.co/post/409815/pump-fun-token-graduation-rate-jumps-boost-changes-launch-incentives); [Bitquery](https://docs.bitquery.io/docs/examples/Solana/pump-fun-to-pump-swap)
- About 20% of migration liquidity was previously locked permanently in the PumpSwap pool on graduation. — [The Block, Jul 2026](https://theblock.co/post/409815/pump-fun-token-graduation-rate-jumps-boost-changes-launch-incentives)

**LBPs**
- An LBP is a weighted AMM whose weights shift over time (for example 99/1 to 1/99), producing a declining-price sale. The owner sets weights and times and can pause swaps. — [Balancer LBP docs](https://docs.balancer.fi/concepts/pools/liquidity-bootstrapping.html)
- Fjord Foundry builds on Balancer LBP contracts and lists Solana among supported chains. Reported fees are a 2% swap fee plus a 3% fee on funds raised, from a single secondary source and unverified. — [Bitbond Fjord review](https://www.bitbond.com/resources/fjord-foundry-launchpad-review)

**What happens after incentives end**
- Uniswap: TVL fell 40%+ right after rewards ended but stayed above pre-program levels (about $1.7B vs about $0.5B). — [Uniswap gov forum (Forse)](https://gov.uniswap.org/t/introducing-the-uniswap-incentive-analysis-terminal-by-forse/25409)
- Blockworks Research meta-analysis: mixed results. Some pools kept TVL and volume, others were inconclusive or showed no lasting effect. — [Blockworks Research: Meta-Analysis on Incentive Programs](https://app.blockworksresearch.com/research/incentives)
- Stable pairs on Scroll and Blast saw substantial outflows shortly after incentives ended. Curve on Optimism reportedly kept TVL. — [HackMD analysis](https://hackmd.io/@up7iSjmpT9W0kGTZ2ylr7g/rkQq_Lgpye); [Optimism gov forum](https://gov.optimism.io/t/draft-gf-phase-1-proposal-curve/3089/34)
- A widely repeated "Gauntlet 2023" stat ("70–80% of LM programs retain <5% TVL") appears only in blog posts, with conflicting figures. I could not verify it against a primary source. — e.g. [Chainscore blog](https://www.chainscorelabs.com/blog/venture-capital-trends-in-web3/sector-specific-vc-strategies/why-liquidity-mining-strategies-are-failing-defi-vcs) (unverified)

### Inferences
- Pool creation fees are trivial. The binding constraint is the quote-side capital (SOL/USDC). Without it, a CPMM pool is thin, and any external buyer or seller moves price a lot.
- A one-sided DLMM pool (only $CLAIM deposited, price discovered as buyers come in) needs no quote capital. It is the structure used in the LIBRA case (section 6), so it carries reputational baggage unless LP is locked and disclosed.
- DBC or a bonding curve with a mandatory LP lock at graduation (DBC requires at least 10%) is the most "rug-resistant by construction" path available off the shelf. It also gives a fee stream to the configurer (the partner gets 80% of bonding fees by default).
- A pump.fun-style launch puts $CLAIM among memecoins with 1–2% graduation odds. This conflicts with FaucetChain's utility positioning.

### Gaps
- No primary data found on typical minimum pool depth for "healthy" small-cap Solana tokens (Kaiko small-cap depth reports were not retrieved).
- Orca Whirlpool creation costs and current Meteora DLMM pool-creation rent were not retrieved.
- No Solana-specific LBP outcome dataset found.

## 3. Staking as a liquidity source: single-sided, ve-tokenomics, liquid staking, real vs emission yield

### Takeaway
Staking locks supply, which reduces sell pressure, but it does not by itself create external buy-side liquidity. Emission-funded yield attracts mercenary capital that leaves when yield drops. ve-models (Curve, Velodrome) steer emissions toward pools and have created bribe markets, but most of the evidence is secondary. OlympusDAO shows that very high staking yield can cannibalize the mechanism that was meant to build liquidity.

### Cited Findings
- veCRV: lock CRV for up to 4 years to get voting power over emissions, fee revenue and boosts. This produced the "Curve Wars" (about late 2020 to mid-2022). — [Tokenomics.com on veCRV](https://tokenomics.com/articles/curve-tokenomics-the-vecrv-model-that-defined-defi-value-accrual); [DEXTools ve-tokenomics](https://www.dextools.io/tutorials/what-is-ve-tokenomics-vote-escrow-gauges)
- Velodrome (ve(3,3)): voters receive 100% of fees and bribes from the pools they vote for. — [Velodrome tokenomics docs](https://velodrome-docs.pages.dev/tokenomics)
- Claims that $1 of bribes bought at least $1.50 of CRV emissions, that Curve votes "follow bribes" (Lloyd, O'Broin & Harrigan 2023), and that Balancer abandoned ve in 2025 appear in secondary sources only and are unverified. — [Spark glossary: vote escrow](https://www.spark.money/glossary/vote-escrow); [Chainscore](https://www.chainscorelabs.com/blog/tokenomics-design-mechanics-and-incentives/governance-token-design/the-future-of-vetokenomics-beyond-simple-lockups)
- Olympus: staking APY was so high it undercut demand for bonds, the mechanism that bought POL. OHM fell about 80% to 90%+ from its ATH (figures vary by date). Leveraged OHM positions cascaded, with about $150M in liquidations in a month. Treasury backing (about $30/OHM at peak) did not hold the price. — [The Defiant](https://thedefiant.io/news/defi/olympus-under-fire); [The Block, Jan 2022](https://www.theblock.co/news/defi/2022-01-18-olympusdaos-slide-continues-ohm-down-90-from-all-time-high-130597); [Decrypt](https://decrypt.co/90524/olympusdao-ohm-token-tanks-profit-taking-liquidations)
- Mercenary capital: Uniswap lost 40%+ TVL when rewards ended (see section 2). — [Uniswap gov forum](https://gov.uniswap.org/t/introducing-the-uniswap-incentive-analysis-terminal-by-forse/25409)

### Inferences
- FaucetChain's existing epoch-reward staking is emission yield (paid from the 2,000/hour cap). Once $CLAIM is tradable, any APY quoted in $CLAIM is only "real" if paid from external revenue, such as partner campaign fees in SOL/USDC or SPL.
- A lower-risk adaptation of ve-style mechanics: let PoS stake weight, or lock duration, direct a share of hourly emission to an external Solana LP gauge. This rewards LPs who provide quote-side capital rather than just stakers.
- Liquid staking (an LST for staked $CLAIM) adds a second token, and it only adds liquidity if the LST itself has a market. That is premature at zero external market (inference, no source found on LSTs for pre-market tokens).
- Because staked nodes seal blocks, a sudden unstake to sell externally also weakens consensus security. Unbonding periods matter twice.

### Gaps
- No primary study quantifying retention of single-sided staking deposits after APY cuts.
- No Solana-native ve-system data (for example, Meteora or Orca gauges) retrieved.

## 4. Trading: CEX vs DEX for small caps, market makers, wash trading, costs

### Takeaway
For a token with no market, DEX on Solana is the zero-gatekeeper route, and CEX listings for small caps are costly and come bundled with liquidity and marketing obligations. Market-maker loan-plus-call-option deals hand 1–5% of supply to the MM and can quietly cost millions at success. Retainer models (about $2K–$25K/month for small caps per vendors) keep more control. Wash trading has been prosecuted (FBI Operation Token Mirrors, 2024 and 2026).

### Cited Findings
- Loan plus call option: the project lends about 1–5% of supply for 12–24 months, and the MM holds calls at tranche strikes. The option is the MM's main return. — [Tokenomist glossary](https://tokenomist.ai/learn/glossary-term/loan-and-call-option-market-making); [Arrakis founder's guide (Apr 2025)](https://arrakis.finance/blog/the-founders-guide-cex-dex-market-makers)
- Vendor pricing: retainers cost $2K–$250K/month. The loan model "suits larger projects ($50M+ FDV)." Worked example: a 3% loan with calls at $0.50 on a $1.50 token at $100M FDV costs about $3M in "free" market making. This is a vendor illustration. — [QBT Labs pricing guide](https://qbtlabs-website.pages.dev/blog/crypto-market-making-pricing-guide)
- Flowdesk, which sells retainers, says loan models reduce issuer control, and the MM may use loaned tokens to its own benefit. — [Flowdesk: selecting MM model](https://flowdesk.co/insights/how-projects-can-select-the-right-market-making-model)
- Cointelegraph: MM token-loan deals are a "death spiral" for smaller projects. — [Cointelegraph Magazine](https://cointelegraph.com/magazine/market-maker-deals-quietly-killing-crypto-projects)
- CEX listing costs (vendor blogs, conflicting): Tier 2 runs $20K–$300K (others say $50K–$200K or $100K–$800K). Small exchanges run $5K–$25K, or free in exchange for volume guarantees or marketing. Small-cap all-in 12-month cost including MM is about $70K–$130K. Small-cap MM costs about $5K–$25K/month. Tier 2 often requires a marketing allocation plus USDT and token liquidity. — [crypto.news](https://crypto.news/how-cex-listings-work-what-they-cost/); [Coin360](https://coin360.com/learn/exchanges-listing-fees-an-overview); [OpenLiquid](https://openliquid.pages.dev/blog/best-cex-for-small-cap-tokens/); [Outlier Ventures](https://outlierventures.io/article/token-listing-strategy-cex-vs-dex/)
- Operation Token Mirrors (Oct 2024): the FBI created a token (NexFundAI). ZM Quant, CLS Global and MyTrade allegedly offered to wash trade it and about 60 other tokens. Gotbit was charged with wash trading for clients from 2018 to 2024, and the SEC called it "on-demand market manipulation." In Mar 2026, the NDCA announced indictments of 10 foreign nationals across Gotbit, Vortex, Antier and Contrarian. Defendant counts vary across reports. — [Decrypt](https://decrypt.co/285503/feds-charge-gotbit-others-market-manipulation); [TRM Labs](https://www.trmlabs.com/resources/blog/ten-fraudsters-from-four-financial-services-firms-charged-in-different-cryptocurrency-market-manipulation-schemes-out-of-northern-district-of-california)

### Inferences
- With no price and no external holders, a CEX would mostly be paying for an empty order book. DEX-first lets organic volume (faucet users selling or buying) establish a track record that later CEX applications require.
- Any MM offering "volume" packages to a tiny token is functionally a wash-trading offer, and is now an enforcement target. Retainer plus transparent KPIs (spread and depth, not volume) is the safer structure.
- The faucet itself creates a structural sell-side: users who farm $CLAIM for free and can now sell. Any MM or pool must absorb this persistent flow, and its size is roughly bounded by the 2,000/hour emission (up to 48k $CLAIM/day).

### Gaps
- No neutral (non-vendor) survey of small-cap MM or listing costs found.
- Kaiko depth/spread benchmarks for sub-$10M tokens were not retrieved.

## 5. Revenue-backed models: fees to buy back or back the token

### Takeaway
Solana's largest apps route sizeable revenue shares into open-market buybacks: Pump.fun about 100% of daily revenue, Raydium 12% of swap fees, Jupiter 50% of certain revenue. These are the reference examples of "real-yield" demand. For FaucetChain, partner campaign fees paid in SOL/USDC or SPL are the analogous external revenue source. Olympus shows that treasury "backing" alone does not floor price.

### Cited Findings
- Raydium: 12% of swap fees go to RAY buybacks, plus 25% of LaunchLab fees. Cumulative buybacks passed $190M by Jul 2025, about 25% of circulating supply. — [The Block](https://www.theblock.co/news/defi/2025-07-17-solana-dex-raydiums-cumulative-token-buybacks-surpass-190-million-363090)
- Jupiter: 50% of fees to JUP buybacks (announced 2025). DefiLlama frames it as 50% of perps revenue, about 12.5% of total fees, varying by product. Buybacks were reportedly above $100M/yr. — [The Block](https://www.theblock.co/amp/post/337071/jupiter-spikes-40-as-founder-says-50-of-fees-will-go-to-token-buybacks); [Cointelegraph](https://cointelegraph.com/news/jupiter-buybacks-top-100m-annually-research); [DefiLlama holders revenue](https://defillama.com/holders-revenue/chain/solana)
- Pump.fun: close to 100% of daily revenue goes to PUMP buybacks. Cumulative spend was about $323M (about 28.8% of circulating supply) by Mar 2026. 2025 revenue was about $664M. Figures come from aggregator summaries and should be verified. — [Blocmates buybacks 2025](https://www.blocmates.com/articles/top-projects-with-buybacks-2025-edition); [Gate buyback guide](https://www.gate.com/news/detail/15429331)
- Olympus: backing of about $30/OHM at peak did not prevent a collapse to single digits. — [The Defiant](https://thedefiant.io/news/defi/olympus-under-fire)

### Inferences
- A simple, legible design: a fixed % of every partner-campaign deposit (in SOL/USDC or the sponsor's SPL) goes to a treasury that buys $CLAIM on the Solana pool on a schedule. That is TWAP buying via a public wallet, which also deepens POL if the bought $CLAIM is paired back into LP. This links an existing B2B revenue stream to external demand without new emissions.
- Buybacks only matter relative to sell-side flow. If partner fees are small relative to faucet emission sold, the buyback is cosmetic. That ratio is the key metric to publish.
- The treasury escrow already locking faucet $CLAIM reserves could be disclosed as non-circulating, improving supply transparency (circulating vs locked).

### Gaps
- No examples found of small (sub-$5M cap) projects with revenue-funded buybacks and measured price impact.
- Legal treatment of buybacks (securities-law exposure) was not researched.

## 6. Failure cases: launching liquidity too early, rug perception, collapse

### Takeaway
LIBRA (Feb 2025, Solana/Meteora) is the reference case. Single-sided liquidity that insiders controlled was pulled as price rose, about $107M was extracted, and Meteora's co-founder resigned. Olympus is the reference case for reflexive POL/staking collapse. The common lessons are unlocked insider-controlled LP, opaque allocations, and yields or valuations unsupported by real demand.

### Cited Findings
- LIBRA: liquidity sat in a one-sided Meteora pool. Eight deployer-linked wallets cashed out about $107M (others say >$110M including token-sale proceeds), with liquidity removed at higher price points. Hayden Davis (Kelsier) admitted insiders sniped the launch. Meteora co-founder Ben Chow resigned, saying the team only advised on liquidity. A class action was reported against Kelsier, KIP and Meteora (Mar 2025, single source). — [Nansen research](https://research.nansen.ai/articles/1792); [The Block](https://theblock.co/post/341412/meteora-co-founder-ben-chow-resigns-amid-libra-scandal); [Cointelegraph](https://cointelegraph.com/news/libra-token-insider-trading-javier-milei-scandal); [Fintelegram](https://fintelegram.com/financial-analyst-update-libra-token-scandal-and-new-york-lawsuit/)
- Olympus collapse and liquidation cascade (see section 3). OlympusDAO owned 99.99% of OHM-DAI liquidity, so POL concentrated risk rather than diversifying it. — [Kerman Kohli, Demystifying OlympusDAO](https://kermankohli.substack.com/p/demystifying-olympusdao-7b5)
- Wormhole wETH depeg (see section 1) shows how bridged-asset failure hits every pool holding that asset. — [Blockworks](https://blockworks.co/news/in-second-largest-defi-hack-ever-blockchain-bridge-loses-320m-ether)
- Wash-trading-for-hire firms targeted tiny tokens (see section 4). — [Decrypt](https://decrypt.co/285503/feds-charge-gotbit-others-market-manipulation)

### Inferences
- Lessons that map to FaucetChain:
  - Lock or burn the LP tokens of the protocol's pool, or use DBC's mandatory lock, and publish the lock.
  - Never use a pure one-sided pool controlled by the team without a lock (LIBRA pattern).
  - Disclose treasury, escrow and bridge mint authorities.
  - Avoid launching with a high emission-funded APY that the market can sell into.
  - Let the market discover price from a low initial FDV rather than seeding at an arbitrary high valuation.
- "Too early" here specifically means opening an external market before there is any non-emission demand (partner fees, utility sinks). With faucet emission continuously creating sellers, early price discovery will skew downward unless sinks or buybacks exist.

### Gaps
- No systematic dataset found on the share of small Solana tokens that lose more than 90% within X days of launch (outside pump.fun graduation stats).
- No postmortem found of a faucet/airdrop-farming token specifically, where farmers dumped on first liquidity, though this is a commonly reported pattern.
