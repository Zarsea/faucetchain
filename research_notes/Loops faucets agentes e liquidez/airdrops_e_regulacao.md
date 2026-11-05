# Airdrops, points programs and the legal framework in Brazil (for FaucetChain / $CLAIM)

Research date: 2026-11-04. Not legal or tax advice. Every item marked [LAWYER] needs review by a Brazilian lawyer or tax adviser before FaucetChain acts on it. Most figures come from secondary sources (law-firm briefings, research blogs). Primary regulator texts were mostly not fetched in this session, so check them before relying on any figure.

## 1. Airdrop outcomes: retention, selling, price performance, and which designs helped

### Takeaway
Most recipients of large one-shot airdrops sell quickly and stop using the product. The only lasting outcomes come from real product-market fit (Hyperliquid, Jupiter) or from a small, hard-to-farm eligible cohort (Jito). Vesting, lockdrops, multiple rounds and reputation-based eligibility are the recommended fixes, but the data on how well they work is thin.

### Cited Findings
- **Academic study, 9 airdrops** (1inch, Arbitrum, Arkham, dYdX, ENS, Lido, Optimism round 1, Tornado Cash, Uniswap). The study measured the share of tokens whose first post-claim action was a sale on an exchange: Lido 65.75%, 1inch 58.67%, Optimism 48.21%, ENS 46.74%, Uniswap 43.69%, Tornado 33.71%, Arbitrum 28.64%, Arkham 19.79%, dYdX 13.56%. The median recipient made only 1-2 transfers in total. — [Messias, Yaish, Livshits, "Airdrops: Giving Money Away Is Harder Than It Seems", arXiv 2312.02752](https://arxiv.org/html/2312.02752v4)
- **Claim timing, same study:** 73% of eligible Arbitrum accounts, 77% of Lido and 87% of Arkham claimed on day 1. The authors read this as a sign of automation or farming. — [arXiv 2312.02752](https://arxiv.org/html/2312.02752v4)
- **Arbitrum case study, same study:**
  - Transactions per address fell to less than 75% of the pre-airdrop level.
  - Unique addresses stayed about 50% higher, but the authors note this metric is easy for Sybils to game.
  - Arbitrum's fee income relative to Optimism fell from 1.96x to 1.74x.
  - TVL rose more than 50% and held. It was the only lasting gain.
  - Source: [arXiv 2312.02752](https://arxiv.org/html/2312.02752v4)
- **Delphi Digital:** across the largest airdrops, 78%-94% of recipient wallets had sold most of their allocation by day 90. Delphi credits Jito's better result to an eligible cohort "small enough to avoid industrial farming". I saw this only as a post on X; the underlying report was not verified. — [Delphi Digital on X](https://x.com/Delphi_Digital/status/2062172540819427598)
- **Starknet (STRK):**
  - Retention was about 13.5%, which BlockBeats calls close to the industry average. — [BlockBeats](https://en.theblockbeats.news/news/53548)
  - STRK fell 64% from launch while circulating supply grew from 720M to 1.3B. It launched at a $1.4B market cap. — [OAK Research, Airdrops in 2025](https://oakresearch.io/en/analyses/investigations/airdrops-2025-end-or-renewal)
- **OAK Research sample of 30 large 2024 airdrops:** 15 gained value since launch and 15 lost.
  - Gainers included JUP, KMNO, HYPE, DRIFT and PURR.
  - DYM, STRK, W and TNSR each fell more than 50%. Wormhole (W) fell 73% from its all-time high.
  - OAK names product-market fit as the key retention factor. Projects now launch at lower valuations because of fears about token unlocks.
  - Source: [OAK Research](https://oakresearch.io/en/analyses/investigations/airdrops-2025-end-or-renewal)
- **Hyperliquid (HYPE):**
  - 31% of supply went to users, with no venture capital funding. It launched on 2024-11-29 and passed a $10B market cap within days. — [OAK Research](https://oakresearch.io/en/analyses/investigations/airdrops-2025-end-or-renewal)
  - Total airdrop value was reported above $7.5B by early 2025. — [Cointelegraph](https://cointelegraph.com/news/hyperliquid-token-launch-fair-crypto-airdrop)
  - Reported opening prices conflict: $2 in one source and $3.81 in another. — [ChainCatcher](https://www.chaincatcher.com/en/article/2154653), [Binance Square](https://www.binance.com/en/square/post/17818000711065)
- **Jupiter (JUP):** the January 2024 drop reached about 955k Solana wallets, and JUP was among the 2024 gainers. — [ChainCatcher](https://www.chaincatcher.com/en/article/2154653), [OAK Research](https://oakresearch.io/en/analyses/investigations/airdrops-2025-end-or-renewal)
- **EigenLayer:** one data source says 80% of EigenLayer-related sales happened in the first two weeks after distribution. This is secondary and unverified. — [CoinLaw](https://coinlaw.io/token-airdrop-statistics/)
- **Hamster Kombat (HMSTR):**
  - It listed on 2024-09-26 with more than 60B tokens airdropped to about 131M users. The price fell more than 40% in the first 24h. — [CoinGape](https://coingape.com/markets/hamster-kombat-price-prediction-hmstr-plunges-45-on-debut-whats-next)
  - ForkLog reported that it lost "nearly 260 million players" after listing. Only the headline was seen, and the base user numbers are self-reported. — [ForkLog](https://forklog.com/en/hamster-kombat-loses-nearly-260-million-players-post-listing/)
  - An unexpected forced lock-up of part of the allocation drew community backlash. — [crypto.news](https://crypto.news/red-alert-for-hamster-kombat-as-avacoin-notcoin-pixelverse-tokens-dive-post-airdrop/)
- **Notcoin (NOT):** reported to have corrected more than 80% after its airdrop. This comes from a single secondary source and is unverified. — [crypto.news](https://crypto.news/red-alert-for-hamster-kombat-as-avacoin-notcoin-pixelverse-tokens-dive-post-airdrop/)
- **Design recommendations from the academic study:**
  - Run multiple rounds and points programs (it cites Blast as an example).
  - Use lockdrops, meaning locked or vested tokens.
  - Avoid frequency-based criteria, which are easy to game with wash trading. Prefer reputation-based criteria.
  - Scale rewards to the real costs users incur, so cheap chains can't be farmed.
  - Target builders and DAOs.
  - Monitor the drop in real time.
  - Source: [arXiv 2312.02752](https://arxiv.org/html/2312.02752v4)
- **OAK on design types:**
  - Liquidity-based drops favor whales unless capped.
  - Activity-based drops favor farmers when the criteria are predictable.
  - Points and affiliate systems raised engagement but also dissatisfaction.
  - Tighter Sybil filters excluded many real users.
  - Newer drops add social or NFT criteria.
  - Source: [OAK Research](https://oakresearch.io/en/analyses/investigations/airdrops-2025-end-or-renewal)

### Inferences
- A drip with an hourly cap, which is FaucetChain's model, behaves like built-in vesting combined with activity-gating. It spreads sell pressure over time. That likely softens price impact, but by itself it doesn't create retention.
- Price retention looks driven by product and supply. HYPE combined real revenue with no VC unlocks. STRK and W combined high valuations with supply growth. For $CLAIM, the emission schedule and the circulating float relative to real demand matter more than how the airdrop is designed.
- Small, hard-to-farm cohorts (the Jito pattern) beat mass distributions on recipient quality. Mass distributions, like the Telegram tap-to-earn games, produced the worst outcomes.
- Sponsors should measure retention as "still holding or active at D30/D90". Unique addresses inflate easily, as Arbitrum showed.

### Gaps
- No primary data was found for Jito's sell-through, Blast's retention or price, or EigenLayer beyond the single "80% in 2 weeks" claim.
- The Delphi 78-94% figure has not been verified against the underlying report.
- No rigorous study was found that quantifies how much vesting or drip improves retention. The arXiv paper leaves lockdrops to future work.
- No Nansen or Kaiko airdrop study was retrieved in this session.

## 2. Airdrop distribution as a service: Galxe, Layer3, Jupiter LFG and others

### Takeaway
Quest and distribution platforms charge sponsors per campaign or per completed quest, plus the reward tokens themselves. The available figures run from about $0.50-$5 per quest up to about $10k per campaign and above. Sponsors increasingly complain that the users these platforms bring churn right away. Reliable public pricing is scarce, and most figures come from vendors or competitors.

### Cited Findings
- **Layer3:**
  - One source puts the average campaign at about $10,000, with an external audit required before launch. — [Publish0x](https://www.publish0x.com/vera-voron/where-to-hold-a-crypto-quest-to-attract-an-audience-to-the-p-xyqkvod)
  - Alea Research reports protocol contracts ranging from mid five figures for seed-stage apps to low seven figures for L1/L2 foundations. — [Alea Research, Layer3 thesis](https://alearesearch.io/theses/layer3)
- **Arbitrum STIP "BOOST" proposal (Layer3):** projected about 10,500 ARB per quest to drive 15k-25k users. These are projections from a proposal, not results. — [Arbitrum forum](https://forum.arbitrum.foundation/t/proposal-build-optimal-onboarding-for-stip-teams-boost/19114?page=2)
- **Galxe:**
  - A competitor's estimate puts it at $5-25 per acquired user, "with most churning immediately". This is biased. — [Resonance blog](https://rsnc-website.pages.dev/blog/stop-renting-engagement-start-owning-it-resonance/)
  - Galxe introduced a claiming fee charged to users, plus GalxeGold rewards. — [Mirror post on Galxe claiming fee](https://mirror.xyz/0x2D107e1e220991179dB0a68d662e1E40FfDC35E5/WPvxy3GnR4dIf8PA1__yXvYqxzoETMOM4p1D0WYanL8)
- **Retention after quests:** one vendor claims less than 5% retention after generic quest campaigns. It cites no methodology. — [Chainscore Labs](https://www.chainscorelabs.com/blog/airdrop-strategies-and-community-building/gamified-engagement-and-quests/the-future-of-community-building-is-on-chain-quests)
- **Do quests work?** Spindl's analysis is the most data-oriented treatment of quest effectiveness found. Its figures were not extracted in this session. — [Spindl, "Do Web 3 quests work?"](https://blog.spindl.xyz/p/do-web-3-quests-work)

### Inferences
- What sponsors pay for: (a) a platform fee per campaign or per completion, (b) the reward pool in their own tokens, and (c) sometimes an audit or Sybil-filtering service.
- What they demand, inferred from the criticism above: verified unique humans, on-chain actions in their own protocol (not just social tasks), and retention or holding at D7/D30. They also want CPA-style pricing and access to the user data.
- FaucetChain's drip model answers the "immediate churn" complaint directly. The pitch would be: reward released over N days, conditional on the user staying active. Report D30 holders and cost per retained user, not cost per claim.

### Gaps
- No primary information was retrieved on Jupiter LFG launchpad terms, on Magic Eden distribution deals, or on faucet partner-campaign pricing.
- Galxe's and Layer3's official sponsor price lists are not public in the sources found.

## 3. Sybil detection in airdrops

### Takeaway
The standard approach combines graph and community clustering of funding and transfer flows with behavioral clustering or ML, and increasingly adds proof-of-personhood (Human Passport, World ID). Every method produces false positives, such as heavy CEX bridgers, and projects without an appeals process simply exclude those users.

### Cited Findings
- **Trusta's open-source framework** works in two phases:
  - Phase 1 detects graph communities in asset-transfer graphs.
  - Phase 2 clusters user behavior to cut Phase 1's false positives.
  - Source: [TrustaLabs GitHub](https://github.com/TrustaLabs/Airdrop-Sybil-Identification)
- **2025 academic paper:** traditional models have precision too low for practical use, causing "numerous False Positives that can damage project reputation". Its subgraph feature-propagation LightGBM model reached recall of 0.9182, and its results were consistent with Trusta's high-risk labels. — [arXiv 2505.09313](https://arxiv.org/pdf/2505.09313)
- **LayerZero (2024):**
  - It used a self-report window and a community Sybil-hunting bounty, which disqualified tens of thousands of addresses.
  - It never disclosed its false-positive rate.
  - Power users bridging frequently from the same exchange can look like Sybils under simple heuristics.
  - These are secondary sources. — [airdropfarming.org](https://airdropfarming.org/blog/sybil-resistant-proof-of-personhood-what-works-against-airdrop-farmers-in-2026), [Node Capital](https://node.capital/blog/the-battle-against-airdrop-sybil-attacks-insights-from-layerzero-and-ether-fi-strategies/)
- **Recommendation from the academic study:** combine graph analysis with ML, accept that this is an arms race, and scale rewards so farming costs more than it pays. — [arXiv 2312.02752](https://arxiv.org/html/2312.02752v4)

### Inferences
- For FaucetChain, layer the defenses:
  1. Cheap gates: CAPTCHA or Turnstile, and rate limits.
  2. Funding-graph clustering on the appchain plus the Solana payout addresses.
  3. An optional personhood score (Human Passport, World ID) that unlocks higher drip caps, rather than being a hard requirement.
  4. An appeals process.
- Rewards released over time (drip) let you claw back or stop paying flagged clusters before the tokens are paid out. That makes false positives cheaper to fix than in a one-shot drop.
- World ID collects biometric data. Under Brazil's LGPD (Lei 13.709/2018), biometrics are "dados sensíveis" (sensitive data), so a lawyer should review consent and data-processing roles before integrating it. [LAWYER]

### Gaps
- No published false-positive rates were found for Arbitrum, Hop, Gitcoin/Human Passport or World ID.
- Human Passport's current scoring model and pricing were not retrieved.

## 4. Brazil legal framework (status as of 2026-11-04) and what FaucetChain's activities would trigger

### Takeaway
Brazil now has a full licensing regime for VASPs (PSAVs). The Banco Central (BCB) published Resolutions 519/520/521 on 2025-11-10, and they took effect on 2026-02-02. The deadline for incumbents to apply for authorization was 2026-10-30, and it has passed. Custody, exchange or intermediation of tokens for Brazilian users, including staking on users' behalf, likely requires BCB authorization. A token sale whose token works as a collective investment contract falls under the CVM, the securities regulator. Free distribution of rewards raises separate questions about promotional-prize law and tax. Nothing here is settled for a faucet model, so a lawyer is needed. [LAWYER]

### Cited Findings

**Lei 14.478/2022 (crypto legal framework)**
- Dated 2022-12-21, in force since June 2023.
- It defines "virtual asset", lists the virtual asset services that require authorization, assigns a regulator, and adds a crypto-fraud crime (art. 171-A of the Penal Code). It does not apply to tokens that are securities, which stay under the CVM.
- Decreto 11.563/2023 designated the BCB as the regulator.
- Source: [Planalto, Lei 14.478/2022](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14478.htm). This summary is from my background knowledge; the official text was not fetched in this session, so verify there.
- The listed services include: exchanging virtual assets for fiat, exchanging between virtual assets, transfer, custody or administration, and participating in services related to an issuer's offer or sale of virtual assets. The last item matters for a $CLAIM sale and for acting as a distribution channel for partner tokens. [LAWYER]

**BCB Resolutions 519, 520 and 521/2025**
- Published 2025-11-10, in force 2026-02-02. — [CSMV Advogados](https://www.csmv.com.br/boletins/o-novo-marco-regulatorio-do-banco-central-para-ativos-virtuais-analise-das-resolucoes-bcb-no-519-520-e-521-2025/), [Machado Meyer](https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/bancario-seguros-e-financeiro-ij/bcb-regulamenta-o-mercado-de-ativos-virtuais-no-brasil), [Agência Brasil](https://agenciabrasil.ebc.com.br/economia/noticia/2025-11/banco-central-estabelece-regras-para-o-mercado-de-criptoativos)
- **What each covers:**
  - 519 covers the authorization process for PSAVs (and for FX and securities brokers).
  - 520 covers how PSAVs are set up and run, plus anti-money-laundering rules.
  - 521 brings virtual-asset operations, including stablecoins, into the foreign-exchange framework.
  - Source: [Migalhas](https://www.migalhas.com.br/quentes/465702/prestadoras-de-ativos-virtuais-tem-ate-30-10-para-autorizacao-do-bc), [CSMV](https://www.csmv.com.br/boletins/o-novo-marco-regulatorio-do-banco-central-para-ativos-virtuais-analise-das-resolucoes-bcb-no-519-520-e-521-2025/)
- **Transition:**
  - PSAVs already operating had 270 days from 2026-02-02 to apply, ending 2026-10-30. Those that applied in time may keep operating until the BCB decides.
  - Those that didn't apply must stop within 30 days of the deadline (art. 88 of Res. 520), which means by about late November 2026.
  - From 2026-10-30, dealing with unauthorized PSAVs is banned.
  - Source: [Migalhas](https://www.migalhas.com.br/quentes/465702/prestadoras-de-ativos-virtuais-tem-ate-30-10-para-autorizacao-do-bc), [Bichara e Motta](https://www.bicharaemotta.com.br/regulamentacao-das-prestadoras-de-servicos-de-ativos-virtuais-entendendo-o-periodo-de-adequacao/), [CSMV](https://www.csmv.com.br/boletins/o-novo-marco-regulatorio-do-banco-central-para-ativos-virtuais-analise-das-resolucoes-bcb-no-519-520-e-521-2025/)
- **Client assets and staking:**
  - Client funds and virtual assets must be segregated, with proof of reserves and an independent audit every two years.
  - Reusing client assets is prohibited, except for staking or with qualified investors, and in both cases only with the client's express consent.
  - Source: [CSMV](https://www.csmv.com.br/boletins/o-novo-marco-regulatorio-do-banco-central-para-ativos-virtuais-analise-das-resolucoes-bcb-no-519-520-e-521-2025/)
- **Other Res. 520 prohibitions:**
  - No issuing or offering fiat-referenced tokens stabilized only by algorithms.
  - No extending credit or raising funds from the public, except through share issuance.
  - Source: [CSMV](https://www.csmv.com.br/boletins/o-novo-marco-regulatorio-do-banco-central-para-ativos-virtuais-analise-das-resolucoes-bcb-no-519-520-e-521-2025/)
- **Stablecoins and FX:**
  - Buying, selling or swapping fiat-referenced stablecoins is treated as an FX operation.
  - Operations with unauthorized counterparties are capped at US$100k each.
  - Reporting of purpose and counterparty became mandatory from 2026-05-04.
  - The Travel Rule applies to domestic transactions from Feb 2027 and to international ones from Feb 2028.
  - Source: [CSMV](https://www.csmv.com.br/boletins/o-novo-marco-regulatorio-do-banco-central-para-ativos-virtuais-analise-das-resolucoes-bcb-no-519-520-e-521-2025/)
- **DeFi:** neither the law-firm summaries nor the resolutions as summarized clearly exclude DeFi. DeFi appears only in the context of security testing. — [CSMV](https://www.csmv.com.br/boletins/o-novo-marco-regulatorio-do-banco-central-para-ativos-virtuais-analise-das-resolucoes-bcb-no-519-520-e-521-2025/)
- Further briefings: [Demarest client alert (PDF)](https://www.demarest.com.br/wp-content/uploads/2025/11/Demarest_BC_regulamenta_a_prestacao_de_servicos_de_ativos_virtuais.pdf), [Lefosse](https://lefosse.com/noticias/alerta/banco-central-regulamenta-o-uso-de-ativos-virtuais-e-o-funcionamento-das-prestadoras-de-servicos-de-ativos-virtuais/), [FBispo (2026-10-07)](https://fbispo.com.br/2026/10/07/ativos-virtuais-sob-o-banco-central/)

**CVM Parecer de Orientação 40 (2022-10-11)**
- Tokens are analyzed case by case.
- A token is a security if it digitally represents a security already listed in Lei 6.385/76, or if it is a collective investment contract (art. 2, IX), which is a Howey-like test.
- A public offer of such tokens requires prior CVM registration, or an exemption or simplified regime.
- Source: [Migalhas](https://www.migalhas.com.br/quentes/375228/cvm-emite-parecer-com-orientacoes-sobre-mercado-de-criptoativos), [Machado Meyer](https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/mercado-de-capitais-ij/orientacoes-da-cvm-para-o-mercado-de-criptoativos), [LegisWeb text](https://www.legisweb.com.br/legislacao/?id=437219)
- CVM's April 2023 Ofício Circular 04/23/CVM/SSE says receivable and fixed-income tokens can be offered under the crowdfunding regime of Resolução CVM 88/2022. — [CVM news](https://www.gov.br/cvm/pt-br/assuntos/noticias/2023/cvm-orienta-sobre-caracterizacao-de-tokens-de-recebiveis-e-de-tokens-de-renda-fixa-como-valores-mobiliarios)
- No CVM guidance specific to airdrops or staking was found.

**Taxation**
- **MP 1.303/2025 lapsed:** this provisional measure would have set a flat 17.5% rate and ended the R$35k exemption. It expired on 2025-10-08 without a vote. — [Exame](https://exame.com/future-of-money/mp-1-303-com-rejeicao-na-camara-tributacao-de-criptos-nao-vai-subir-em-2026-veja-regras-atuais/), [Seu Dinheiro](https://www.seudinheiro.com/2025/financas-pessoais/como-fica-o-imposto-de-renda-dos-investimentos-agora-que-caducou-a-mp-1-303-que-mudava-a-tributacao-julw/)
- **Current rules:**
  - Capital gains are taxed at progressive rates of 15%-22.5%.
  - Monthly sales up to R$35k on domestic platforms are exempt.
  - Source: [Exame](https://exame.com/future-of-money/mp-1-303-com-rejeicao-na-camara-tributacao-de-criptos-nao-vai-subir-em-2026-veja-regras-atuais/), [Mercado Bitcoin](https://www.mb.com.br/economia-digital/criptos/entenda-o-fim-da-mp-1303/)
- **Pending:** the government could reintroduce the content as a bill. Its status was not found. — [Exame](https://exame.com/future-of-money/mp-1-303-com-rejeicao-na-camara-tributacao-de-criptos-nao-vai-subir-em-2026-veja-regras-atuais/)
- **Lei 14.754/2023 (offshore law):**
  - Virtual assets held abroad are treated as foreign financial investments, taxed at a flat 15% annually with no monthly exemption.
  - IN RFB 2.180/2024 regulates which assets qualify.
  - Treatment of self-custody remains unclear.
  - Source: [Estratégia Concursos](https://www.estrategiaconcursos.com.br/blog/tributacao-criptoativos-brasil-2026/amp/), [Mundo Diplomático](https://omundodiplomatico.com.br/2024/03/14/entenda-a-nova-tributacao-de-investimentos-no-exterior), [CONPEDI paper](https://site.conpedi.org.br/publicacoes/5g243f3g/sv33k9ka/USu552f6S90649Vc.pdf)
- **Reporting, DeCripto:**
  - IN RFB 2.291/2025 (Nov 2025) creates DeCripto, aligned with the OECD's CARF standard. It revokes IN 1.888/2019 and IN 1.899/2019.
  - Monthly reporting and user obligations started on 2026-07-01, with the first filing in August 2026.
  - IN 1.888 still governs periods up to June 2026.
  - The tax rules themselves are unchanged.
  - Source: [Mattos Filho](https://www.mattosfilho.com.br/unico/decripto-receita-federal-ocde/), [Livecoins](https://livecoins.com.br/decripto-receita-federal-publica-nova-declaracao-que-substitui-a-in-1888-e-endurece-o-reporte-de-criptoativos/), [Contábeis](https://www.contabeis.com.br/noticias/77870/decripto-nova-declaracao-de-criptoativos-da-receita-federal/)

**Promotional prizes (Lei 5.768/1971)**
- Free distribution of prizes as part of a commercial promotion requires prior authorization from the Ministério da Fazenda.
- No source was found that applies this law to token airdrops or faucets.
- Source: [Lei 5.768/1971 (Justia)](https://brasil.justia.com/nacionales/leis/5-768-de-20-12-71/gdoc)
- **PL 2766/2025** proposes a legal definition of airdrop ("free distribution of tokens ... as a marketing strategy"). It is pending; its status is unknown. — [Câmara, PL 2766/2025](https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=2929209&filename=PL+2766%2F2025)

### Inferences: what each FaucetChain activity likely triggers [LAWYER on every point]
- **Distributing $CLAIM or partner tokens for free to self-custody wallets:**
  - If FaucetChain never holds user assets and nobody pays to participate, this is probably not a PSAV service in itself.
  - Open risks:
    - Holding user balances off-chain until withdrawal could count as custody.
    - If the drip is tied to marketing for sponsors, it could count as a "promoção comercial" (commercial promotion) under Lei 5.768.
    - Whether any element of chance (lotteries, random bonuses) is involved pushes toward Fazenda authorization.
- **Acting as a distribution channel for paid sponsors:** Lei 14.478 lists "services related to an issuer's offer or sale" of virtual assets, and the sponsor's fee could pull FaucetChain into that item. A lawyer needs to assess whether a free-distribution channel counts. Contracts should make sponsors responsible for whether their own tokens are securities.
- **Offering staking yield:**
  - Custodial staking for Brazilian users is a PSAV activity that requires BCB authorization, and reusing client assets for staking needs express consent.
  - Advertising a promised or fixed yield on $CLAIM, with the return depending on the team's efforts, risks being treated as a collective investment contract under Parecer 40, which falls under the CVM.
  - Non-custodial protocol staking on FaucetChain's own appchain, framed as validator security, is the lower-risk design.
- **Token sale of $CLAIM:**
  - If it is marketed with a return expectation that depends on the team, it is likely a collective investment contract, which requires CVM registration or an exemption such as the crowdfunding regime of Res. 88, with its own limits.
  - Taking fiat payments in Brazil adds PSAV and FX issues.
  - Res. 520 prohibits PSAVs from raising funds from the public except through share issuance.
- **Running a DEX, trading or market-making:**
  - A custodial exchange is clearly a PSAV.
  - Pure smart-contract DeFi is not clearly excluded.
  - Since 2026-10-30, Brazilian PSAVs can't deal with unauthorized providers, which affects any listing or on-ramp partnership with Brazilian exchanges.
- **Users' taxes:**
  - Brazilian users owe capital gains tax when they sell received tokens, with the R$35k monthly exemption on domestic platforms.
  - Under the offshore regime, 15% applies to assets held abroad.
  - The cost basis of airdropped tokens and the tax treatment of staking rewards are not clearly defined. A tax adviser is needed.
  - DeCripto reporting could apply to FaucetChain if it acts as an intermediary.
- **Consumer protection:** Brazil's Consumer Defense Code (CDC, Lei 8.078/1990) applies to platforms serving Brazilian consumers. That means clear terms, no misleading claims about earnings, and Portuguese-language disclosures. This is standard and comes from general knowledge, not a source retrieved in this session.

### Gaps
- The official BCB texts of Res. 519/520/521 were not fetched. Minimum capital, the list of SPSAV types and any de minimis or "self-hosted wallet" exemptions were not confirmed.
- No CVM guidance specific to airdrops or staking was found. It is unclear whether the CVM has issued anything after Parecer 40 (e.g., during 2025-2026).
- No Receita Federal ruling (Solução de Consulta) on how airdrops or staking rewards are taxed was retrieved.
- It is unconfirmed whether the Secretaria de Prêmios e Apostas (SPA) or Fazenda treats token giveaways as prizes under Lei 5.768.
- The status of a bill reviving the MP 1.303 tax changes, and of PL 2766/2025, is unknown.

## 5. US SEC stance 2025-2026, as a reference for international users

### Takeaway
Under Chair Atkins, SEC staff said in 2025 that protocol staking (May 2025) and certain liquid staking (August 2025) are not securities transactions. A 2026 interpretation, reported as joined by the CFTC, set out a token taxonomy and addressed airdrops, mining and staking. Airdrops turn on whether recipients give consideration (money, labor or other). These are staff and Commission interpretations, not statutes or rules.

### Cited Findings
- **2025-05-29 Corp Fin staff statement:**
  - Protocol staking on proof-of-stake networks (solo, self-custodial with a third party, or custodial) does not involve securities transactions.
  - Liquid staking and restaking were excluded.
  - Source: [Fenwick](https://www.fenwick.com/insights/publications/sec-staff-statement-concludes-protocol-staking-is-not-a-securities-transaction)
- **2025-08-05 staff statement on liquid staking:** staking receipt tokens are not securities when the underlying asset is not one. — [Fintech & Digital Assets blog index / Latham tracker](https://www.lw.com/en/us-crypto-policy-tracker/regulatory-developments)
- **November 2025 Atkins speech ("Project Crypto"):** previewed a token taxonomy and said most tokens trading today are not securities. — [Sidley](https://www.sidley.com/en/insights/newsupdates/2025/11/breaking-down-project-crypto-sec-chairman-atkins-outlines-next-phase-of-digital-asset-oversight), [MoFo](https://www.mofo.com/resources/insights/251119-sec-chairman-atkins-speech-on-project-crypto)
- **2026 SEC interpretation (reported around March-April 2026):**
  - Categories: digital commodities, digital collectibles, digital tools, stablecoins and digital securities.
  - Clarifies treatment of airdrops, protocol mining, protocol staking and wrapping.
  - The CFTC said it will administer the Commodity Exchange Act consistently with it.
  - Airdrop treatment depends on whether recipients provide consideration.
  - The primary text was not fetched (403), so the exact date and release number are unverified.
  - Source: [Fintech & Digital Assets (Apr 2026)](https://www.fintechanddigitalassets.com/2026/04/sec-clarifies-the-application-of-the-securities-laws-to-cryptoassets/), [IPS News](https://ipsnews.net/business/2026/03/26/what-the-sec-cftc-token-taxonomy-means-for-crypto-in-2026/), [Latham tracker](https://www.lw.com/en/us-crypto-policy-tracker/regulatory-developments)
- **Caution:** some blogs describe this as a blanket "green light" for airdrop farming. Law-firm sources describe the treatment as conditional. — [poolpartynodes (enthusiastic)](https://poolpartynodes.com/airdrops/airdrop-guides/sec-token-taxonomy-airdrops-staking-mining-not-securities-march-2026/) vs [Fintech & Digital Assets](https://www.fintechanddigitalassets.com/2026/04/sec-clarifies-the-application-of-the-securities-laws-to-cryptoassets/)

### Inferences
- In the US, faucet or airdrop rewards for real activity probably sit closer to "consideration" (labor or tasks) than a pure gift. The current SEC framework treats that as a factor to analyze, not an automatic safe harbor.
- Non-custodial protocol staking is the safest US design. A custodial yield product aimed at US users still needs a US lawyer.

### Gaps
- The exact date, release number and text of the 2026 interpretation were not verified from sec.gov.
- No airdrop-specific no-action letter was confirmed. A 2026 DePIN distribution no-action letter appears only as a headline.
- The status of US market-structure legislation (CLARITY Act) as of November 2026 was not checked.
