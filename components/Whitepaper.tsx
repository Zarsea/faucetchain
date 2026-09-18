
import React from 'react';
import { SectionCard } from './SectionCard';
import { MermaidDiagram } from './MermaidDiagram';
import {
    DocumentTextIcon,
    CpuChipIcon,
    ShieldCheckIcon,
    CreditCardIcon,
    SignalIcon,
    CubeIcon,
    SparklesIcon,
    ChartBarIcon,
    BookOpenIcon,
    BeakerIcon
} from './IconComponents';
import { useLanguage } from './LanguageContext';

const TableRow: React.FC<{ cells: string[]; header?: boolean }> = ({ cells, header }) => (
    <tr className={header ? 'border-b border-brand-border/60' : 'border-b border-brand-border/20 hover:bg-brand-bg/40 transition-colors'}>
        {cells.map((cell, i) => header ? (
            <th key={i} className="px-4 py-3 text-left text-[10px] font-black text-brand-muted uppercase tracking-widest">{cell}</th>
        ) : (
            <td key={i} className="px-4 py-3 text-sm text-brand-secondary">{cell}</td>
        ))}
    </tr>
);

const Quote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="border-l-4 border-brand-primary/50 pl-4 py-2 my-4 bg-brand-primary/5 rounded-r-lg">
        <p className="text-brand-secondary/80 italic text-sm leading-relaxed">{children}</p>
    </div>
);

const FormulaBlock: React.FC<{ title: string; formula: string; desc: string }> = ({ title, formula, desc }) => (
    <div className="bg-brand-bg/60 border border-brand-border/40 rounded-xl p-5 my-4 group hover:border-brand-primary/30 transition-colors">
        <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest block mb-2">{title}</span>
        <code className="text-lg font-mono font-bold text-brand-primary block mb-2">{formula}</code>
        <p className="text-xs text-brand-muted leading-relaxed">{desc}</p>
    </div>
);

const CONSENSUS_DIAGRAM = `
flowchart TD
    A["User Activity / Claim"] --> B{"Sentinel AI Audit"}
    B -- "Valid" --> C["PoC Merit Pool"]
    B -- "Sybil Detected" --> D["Reputation Penalty 0.1x"]

    subgraph SEAL["Sealer selection"]
        C --> E{"weight = 1 + active stake"}
        F["Staked $CLAIM (PoS)"] --> E
    end

    E --> H["Weights for this round"]
    H --> I["Deterministic draw, seeded by parent hash"]
    I --> J["Block Finalization"]
    J --> K["L1 FaucetChain Consensus"]
`;

const TOKEN_FLOW_DIAGRAM = `
flowchart LR
    subgraph Emission["Token Emission"]
        Epoch["Hourly quota — 2,000/hr"] --> Mint["Claim recorded"]
        Mint --> User["User Wallet"]
    end

    subgraph Usage["Token Utility"]
        User --> Stake["UTXO Staking Vault"]
        User --> DApp["Faucet Registry (10K stake)"]
        User --> Bounty["Bounty Board"]
        User --> Burn["Voluntary Burn"]
    end

    subgraph Rewards["Yield Flow"]
        Stake --> Yield["Tier Yield (0.5-10%)"]
        Yield --> User
    end
`;

const EPOCH_DIAGRAM = `
sequenceDiagram
    participant U as User/Faucet
    participant EM as Hourly quota
    participant DR as Faucet registry
    participant CT as $CLAIM ledger

    U->>EM: Claim submitted (wallet, amount)
    EM->>DR: Is this faucet authorised?
    DR-->>EM: true (stake >= 10K)

    EM->>EM: Check epoch quota (2000/hr)
    alt Quota available
        EM->>CT: credit(wallet, amount)
        CT-->>U: $CLAIM minted
    else Quota depleted
        EM-->>U: HIATO — Wait next hour
    end
`;

const UTXO_DIAGRAM = `
flowchart LR
    subgraph Deposit["Stake (Create UTXO)"]
        U["User"] --> |"$CLAIM"| V["Staking Vault"]
        V --> NFT["Position Receipt"]
        NFT --> |"Metadata"| Meta["Amount + Tier + Timelock"]
    end

    subgraph Tiers["Lock Tiers"]
        T0["Tier 0: 1h → 0.5%"]
        T1["Tier 1: 24h → 2%"]
        T2["Tier 2: 7d → 10%"]
    end

    subgraph Withdraw["Unstake (Spend UTXO)"]
        NFT --> |"After timelock"| Burn["Spend position"]
        Burn --> Pay["Principal + Yield"]
        Pay --> U
    end
`;

const SECURITY_DIAGRAM = `
flowchart TD
    subgraph FraudDetection["Sentinel V3 Fraud Detection"]
        Input["Claim Sequence"] --> T["Temporal Analysis"]
        Input --> G["Timing Uniformity Check"]
        Input --> C["Compression Pattern Match"]
        T --> Score{"Fraud Score"}
        G --> Score
        C --> Score
    end

    Score -- "> 0.8" --> Flagged["FLAGGED / BANNED"]
    Score -- "< 0.8" --> Verified["VERIFIED"]
    Verified --> Bonus["DeFi Bonus Calculator"]
    Bonus --> Final["Final Multiplier (1.0x-2.5x)"]
    Flagged --> Penalty["0.1x Multiplier"]
`;

export const Whitepaper: React.FC = () => {
    const { lang } = useLanguage();

    return (
        <div className="space-y-8 animate-fadeIn pb-20">
            {/* Title Header */}
            <div className="text-center space-y-6 py-8">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-primary/10 border border-brand-primary/30 rounded-full text-brand-primary text-[10px] font-black uppercase tracking-[0.3em]">
                    <BookOpenIcon className="w-3 h-3" /> Technical Whitepaper V4.0
                </div>
                <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-none">
                    FaucetChain Protocol
                </h1>
                <p className="text-xl text-brand-muted max-w-3xl mx-auto leading-relaxed">
                    A hybrid Proof-of-Claim and Proof-of-Stake appchain for micro-distribution,
                    settling every payout against a Merkle root published on Solana
                </p>
                <div className="flex flex-wrap justify-center gap-4 text-xs text-brand-muted">
                    <span className="px-3 py-1 bg-brand-surface rounded-full border border-brand-border">Version 4.0</span>
                    <span className="px-3 py-1 bg-brand-surface rounded-full border border-brand-border">September 2026</span>
                    <span className="px-3 py-1 bg-brand-surface rounded-full border border-brand-border">Settles on Solana</span>
                </div>
            </div>

            {/* TABLE OF CONTENTS */}
            <SectionCard title="Table of Contents" icon={<DocumentTextIcon className="w-5 h-5" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {[
                        '1. Abstract',
                        '2. Introduction & Motivation',
                        '3. Hybrid Consensus Mechanism',
                        '4. Proof of Claim (PoC)',
                        '5. Choosing who seals the block',
                        '6. Epoch-Based Token Emission',
                        '7. Tokenomics ($CLAIM)',
                        '8. UTXO Staking Vault',
                        '9. Security & Sentinel AI',
                        '10. Network Architecture',
                        '11. The Settlement Program on Solana',
                        '12. Governance — designed, not built',
                        '13. Roadmap',
                        '14. Conclusion',
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-brand-bg/40 transition-colors group cursor-default">
                            <div className="w-6 h-6 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-[10px] font-black text-brand-primary group-hover:bg-brand-primary/20 transition-colors">
                                {i + 1}
                            </div>
                            <span className="text-sm text-brand-secondary group-hover:text-white transition-colors">{item.replace(/^\d+\.\s*/, '')}</span>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* 1. ABSTRACT */}
            <SectionCard title="1. Abstract" icon={<DocumentTextIcon className="w-5 h-5" />}>
                <p className="text-brand-muted leading-relaxed">
                    This paper introduces <strong className="text-brand-secondary">FaucetChain</strong>, a high-throughput
                    Layer-1 blockchain designed to address the persistent challenges of centralization, energy waste, and
                    inequitable wealth distribution that plague existing consensus mechanisms. Our core innovation is a
                    <strong className="text-brand-secondary"> hybrid Proof-of-Claim (PoC) + Proof-of-Stake (PoS)</strong> consensus
                    model, augmented by an AI-driven fraud detection and incentive layer called <strong className="text-brand-secondary">Sentinel AI</strong>.
                </p>
                <p className="text-brand-muted leading-relaxed mt-4">
                    The protocol introduces several key primitives: (1) a <strong className="text-brand-secondary">stake-weighted sealer draw</strong> that
                    any node can reproduce from the parent block hash; (2) an <strong className="text-brand-secondary">Hourly Epoch Manager</strong> that
                    controls token emission with built-in scarcity via quota-based "hiatus" mechanics; (3) a novel <strong className="text-brand-secondary">UTXO-style
                    Staking Vault</strong> that issues an individually tracked receipt for each staking position, enabling granular control over
                    timelocks and yield; and (4) a <strong className="text-brand-secondary">Community Bounty Board</strong> for decentralized
                    task coordination with escrow-protected rewards.
                </p>
                <Quote>
                    FaucetChain establishes a paradigm where network influence is earned through genuine participation,
                    not merely purchased through capital accumulation.
                </Quote>
            </SectionCard>

            {/* 2. INTRODUCTION */}
            <SectionCard title="2. Introduction & Motivation" icon={<DocumentTextIcon className="w-5 h-5" />}>
                <p className="text-brand-muted leading-relaxed">
                    The blockchain landscape faces a fundamental tension: mechanisms that achieve decentralization and security
                    often sacrifice scalability and fairness. <strong className="text-brand-secondary">Proof-of-Work (PoW)</strong>, while
                    battle-tested, concentrates power in entities capable of deploying massive computational resources.
                    <strong className="text-brand-secondary"> Proof-of-Stake (PoS)</strong> improves energy efficiency but replaces computational
                    barriers with financial ones — the wealthiest participants gain disproportionate influence through a
                    "the rich get richer" dynamic.
                </p>
                <p className="text-brand-muted leading-relaxed mt-4">
                    FaucetChain proposes a third path: a <strong className="text-brand-secondary">meritocratic consensus</strong> where network
                    influence is a function of both verifiable contribution and economic commitment. By combining PoC (which
                    rewards genuine network participation) with PoS (which ensures economic alignment), FaucetChain creates an
                    environment where new participants can build meaningful influence through active contribution, while
                    established participants maintain security through staking.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    {[
                        { label: 'Problem', desc: 'PoW wastes energy. PoS concentrates wealth. Both exclude small participants.', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
                        { label: 'Insight', desc: 'Genuine network participation is a measurable, Sybil-resistant signal of commitment.', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
                        { label: 'Solution', desc: 'Hybrid PoC+PoS with AI modulation — earn influence through merit, secure it with stake.', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
                    ].map((item, i) => (
                        <div key={i} className={`p-5 rounded-xl border ${item.border} ${item.bg}`}>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${item.color}`}>{item.label}</span>
                            <p className="text-sm text-brand-secondary mt-2 leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* 3. HYBRID CONSENSUS */}
            <SectionCard title="3. Hybrid Consensus Mechanism" icon={<CpuChipIcon className="w-5 h-5" />}>
                <p className="text-brand-muted leading-relaxed">
                    FaucetChain's consensus mechanism operates on a three-pillar architecture where a validator's influence
                    is determined by a composite score reflecting their historical merit contributions (PoC), their staked
                    capital (PoS), and an AI-driven integrity assessment (Sentinel).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 mb-6">
                    {[
                        { title: 'Proof of Claim (PoC)', weight: '40%', desc: 'Validators accumulate merit through verifiable claims: data provision, transaction routing, uptime consistency, and ecosystem participation.', icon: <SparklesIcon className="w-8 h-8 text-brand-accent" /> },
                        { title: 'Proof of Stake (PoS)', weight: '40%', desc: 'Validators lock $CLAIM tokens as collateral, ensuring economic alignment. A logarithmic function prevents whale dominance.', icon: <ShieldCheckIcon className="w-8 h-8 text-brand-primary" /> },
                        { title: 'AI Sentinel Modulator', weight: '20%', desc: 'The Sentinel AI analyzes behavioral patterns to detect Sybil attacks and reward constructive DeFi activity with bonus multipliers (1.0x–2.5x).', icon: <CpuChipIcon className="w-8 h-8 text-green-400" /> },
                    ].map((pillar, i) => (
                        <div key={i} className="glass border border-brand-border/50 rounded-2xl p-6 text-center hover:border-brand-primary/30 transition-colors">
                            <div className="flex justify-center mb-4">{pillar.icon}</div>
                            <h4 className="text-lg font-black text-brand-secondary tracking-tight">{pillar.title}</h4>
                            <span className="text-2xl font-black text-brand-primary font-mono">{pillar.weight}</span>
                            <p className="text-xs text-brand-muted mt-3 leading-relaxed">{pillar.desc}</p>
                        </div>
                    ))}
                </div>
                <MermaidDiagram
                    code={CONSENSUS_DIAGRAM}
                    title="Consensus Pipeline"
                    icon={<CpuChipIcon className="w-5 h-5" />}
                    prompt="Explain the full consensus pipeline from user activity to block finalization in FaucetChain."
                />
            </SectionCard>

            {/* 4. PROOF OF CLAIM */}
            <SectionCard title="4. Proof of Claim (PoC)" icon={<SparklesIcon className="w-5 h-5" />}>
                <p className="text-brand-muted leading-relaxed">
                    Proof of Claim (PoC) is FaucetChain's novel consensus primitive. Unlike Proof-of-Work
                    which proves computational effort, or Proof-of-Stake which proves capital commitment, PoC proves
                    <strong className="text-brand-secondary"> verifiable network participation</strong>. Validators earn
                    merit weight by performing actions that materially benefit the network.
                </p>
                <div className="mt-6">
                    <h4 className="text-sm font-black text-brand-secondary uppercase tracking-wider mb-3">Merit-Earning Actions</h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead><TableRow cells={['Action', 'Merit Points', 'Verification Method', 'Cooldown']} header /></thead>
                            <tbody>
                                <TableRow cells={['Faucet Claim (tx hash)', '10 pts/claim', 'FaucetChain tx verification', '1 hour']} />
                                <TableRow cells={['Data Traffic Routing', '1 pt/GB', 'Proof of Carrier measurement', 'Continuous']} />
                                <TableRow cells={['Uptime Maintenance', '5 pts/hour', 'Heartbeat monitoring', 'Per epoch']} />
                                <TableRow cells={['DeFi Participation', '2 pts/interaction', 'On-chain activity scoring', 'Per protocol']} />
                                <TableRow cells={['Bounty Completion', '20 pts/bounty', 'Creator approval', 'Per task']} />
                            </tbody>
                        </table>
                    </div>
                </div>
                <FormulaBlock
                    title="Merit Weight Formula"
                    formula="MW = ln(stake) × uptime_coefficient × traffic_volume × ai_reputation"
                    desc="Logarithmic stake prevents whale dominance. Uptime coefficient: 1.0 for ≥99%, 0.5 for 95-99%, 0.1 for <95%. Traffic measured in GB/day."
                />
            </SectionCard>

            {/* 5. SEALER SELECTION */}
            <SectionCard title="5. Choosing who seals the block" icon={<CpuChipIcon className="w-5 h-5" />}>
                <p className="text-brand-muted leading-relaxed">
                    Each round picks one sealer from the miners currently online, weighted by stake.
                    The draw is <strong className="text-brand-secondary">deterministic and reproducible</strong>: it is
                    seeded by the hash of the parent block, so every node computes the same winner
                    from data it already has, and nobody has to take the sequencer's word for it.
                </p>
                <FormulaBlock
                    title="Weight, and the seed that picks among them"
                    formula="weight = 1 + active_stake   ·   seed = keccak256(parent_hash)"
                    desc="The +1 keeps a node with no stake in the draw rather than excluding it. Active stake counts unspent staking positions only. Because the seed is the parent hash, the round changes with every block and cannot be reused."
                />
                <p className="text-brand-muted leading-relaxed mt-4">
                    Two things this is <strong className="text-brand-secondary">not</strong>, stated because
                    the earlier version of this paper claimed both. It is not a verifiable random
                    function: there is no secret key and no proof, only a public hash anyone can
                    recompute — a different property, and for this purpose a useful one. And the
                    weight does not yet blend merit or a Sentinel score; it is linear in stake.
                    Weighting those in is designed, not built, and sits in the roadmap rather than
                    here.
                </p>
            </SectionCard>

            {/* 6. EPOCH EMISSION */}
            <SectionCard title="6. Epoch-Based Token Emission" icon={<CubeIcon className="w-5 h-5" />}>
                <p className="text-brand-muted leading-relaxed">
                    FaucetChain implements a unique <strong className="text-brand-secondary">Hourly Epoch System</strong> for
                    token emission control. Unlike continuous emission models, each hour constitutes an "epoch" with a
                    fixed quota of mintable tokens. The ceiling is there to cap emission and make the network expensive to farm, not to hurry anyone along.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 mb-6">
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-brand-secondary uppercase tracking-wider">Emission Parameters</h4>
                        <div className="space-y-3">
                            {[
                                { param: 'Epoch Duration', value: '1 hour' },
                                { param: 'Tokens Per Epoch', value: '2,000 $CLAIM' },
                                { param: 'Halving Interval', value: '2,100,000 blocks — planned' },
                                { param: 'Initial Block Reward', value: '500 $CLAIM — planned' },
                                { param: 'Treasury Split', value: '60% Ecosystem / 40% Team — policy' },
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-brand-bg/40 rounded-lg border border-brand-border/30">
                                    <span className="text-xs text-brand-muted font-bold uppercase">{item.param}</span>
                                    <span className="text-sm font-mono font-bold text-brand-primary">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-brand-secondary uppercase tracking-wider mb-4">Hiatus Mechanism</h4>
                        <p className="text-brand-muted text-sm leading-relaxed">
                            When an epoch's quota is fully consumed, the system enters a <strong className="text-brand-secondary">"hiatus"</strong> state.
                            During hiatus, no new tokens can be minted until the next hourly epoch begins. This serves
                            multiple purposes:
                        </p>
                        <ul className="list-disc list-inside space-y-2 mt-3 text-sm text-brand-muted">
                            <li>Caps what a botnet can drain in one burst</li>
                            <li>Makes the emission schedule predictable</li>
                            <li>Makes farming cost time rather than hardware</li>
                        </ul>
                    </div>
                </div>
                <MermaidDiagram
                    code={EPOCH_DIAGRAM}
                    title="Claim & Emission Sequence"
                    icon={<CubeIcon className="w-5 h-5" />}
                    prompt="Walk through the complete token minting sequence from user claim to $CLAIM emission, including the hiatus mechanism."
                />
            </SectionCard>

            {/* 7. TOKENOMICS */}
            <SectionCard title="7. Tokenomics ($CLAIM)" icon={<CreditCardIcon className="w-5 h-5" />}>
                <p className="text-brand-muted leading-relaxed">
                    The native token <strong className="text-brand-secondary">$CLAIM</strong> serves as the fundamental unit of value
                    within the FaucetChain ecosystem. Its design follows a deflationary model inspired by Bitcoin's scarcity
                    principles while incorporating modern DeFi utility.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
                    {[
                        { label: 'Max Supply', value: '99,000,000', sub: '$CLAIM' },
                        { label: 'Initial Reward', value: '500', sub: '$CLAIM/block' },
                        { label: 'Halving', value: '2.1M', sub: 'blocks' },
                        { label: 'Gas Burn', value: '50%', sub: 'of base fee' },
                    ].map((s, i) => (
                        <div key={i} className="text-center p-5 bg-brand-bg/40 rounded-xl border border-brand-border/30 hover:border-brand-primary/30 transition-colors">
                            <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest block mb-1">{s.label}</span>
                            <span className="text-2xl font-black text-brand-primary font-mono">{s.value}</span>
                            <span className="text-xs text-brand-muted block mt-1">{s.sub}</span>
                        </div>
                    ))}
                </div>
                <h4 className="text-sm font-black text-brand-secondary uppercase tracking-wider mb-3">Token Utility</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead><TableRow cells={['Function', 'Mechanism', 'Effect']} header /></thead>
                        <tbody>
                            <TableRow cells={['Staking', 'Lock in UTXO Vault (3 tiers)', 'Earn 0.5-10% yield + consensus weight']} />
                            <TableRow cells={['DApp Registration', 'Stake 10,000 CLAIM', 'Authorize faucet for minting access']} />
                            <TableRow cells={['Governance', 'Weight = stake × merit', 'Vote on protocol parameters']} />
                            <TableRow cells={['Transaction Fees', 'Dynamic, set by the appchain', '50% treasury, 50% miner pool']} />
                            <TableRow cells={['Bounty Escrow', 'Held by the Bounty Board until approval', 'Incentivize community tasks']} />
                            <TableRow cells={['Voluntary Burn', 'Opt-in burn function', 'Deflationary pressure + gamification']} />
                        </tbody>
                    </table>
                </div>
                <MermaidDiagram
                    code={TOKEN_FLOW_DIAGRAM}
                    title="Token Flow Architecture"
                    icon={<CreditCardIcon className="w-5 h-5" />}
                    prompt="Trace the lifecycle of a $CLAIM token from emission through all possible uses in the ecosystem."
                />
            </SectionCard>

            {/* 8. UTXO STAKING */}
            <SectionCard title="8. UTXO Staking Vault" icon={<CubeIcon className="w-5 h-5" />}>
                <p className="text-brand-muted leading-relaxed">
                    FaucetChain uses a <strong className="text-brand-secondary">UTXO-style staking model</strong>, borrowing
                    from Bitcoin's Unspent Transaction Outputs rather than from a running account balance.
                    Each deposit creates a <strong className="text-brand-secondary">position with its own id</strong> — a
                    synthetic UTXO, tracked individually and spent exactly once when it is closed.
                    Positions are records on the appchain, not tokens on another chain.
                </p>
                <Quote>
                    Unlike traditional account-based staking where all deposits are pooled, UTXO staking allows users to
                    manage each position independently — like individual coins in a physical wallet.
                </Quote>
                <h4 className="text-sm font-black text-brand-secondary uppercase tracking-wider mb-3 mt-4">Staking Tiers</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead><TableRow cells={['Tier', 'Lock Duration', 'Yield (Basis Points)', 'Annual Equivalent', 'Use Case']} header /></thead>
                        <tbody>
                            <TableRow cells={['Tier 0', '1 hour', '50 bp (0.50%)', '~4,380% APY', 'Quick liquidity, testing']} />
                            <TableRow cells={['Tier 1', '24 hours', '200 bp (2.00%)', '~730% APY', 'Daily yield farming']} />
                            <TableRow cells={['Tier 2', '7 days', '1000 bp (10.00%)', '~521% APY', 'Long-term commitment']} />
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-brand-muted mt-2 italic">* APY figures are theoretical maximums assuming continuous compounding at PoC rates. Actual yields depend on vault liquidity.</p>
                <MermaidDiagram
                    code={UTXO_DIAGRAM}
                    title="UTXO Staking Lifecycle"
                    icon={<CubeIcon className="w-5 h-5" />}
                    prompt="Explain how the UTXO staking vault works, comparing it to both Bitcoin UTXOs and traditional account-based staking."
                />
            </SectionCard>

            {/* 9. SECURITY */}
            <SectionCard title="9. Security & Sentinel AI" icon={<ShieldCheckIcon className="w-5 h-5" />}>
                <p className="text-brand-muted leading-relaxed">
                    FaucetChain's security model operates at three layers: <strong className="text-brand-secondary">economic security</strong> (PoS
                    slashing), <strong className="text-brand-secondary">behavioral security</strong> (Sentinel AI fraud detection),
                    and <strong className="text-brand-secondary">cryptographic security</strong> (L1 anchoring via Merkle proofs).
                </p>

                <h4 className="text-sm font-black text-brand-secondary uppercase tracking-wider mt-6 mb-3">9.1 Sentinel V3 Engine</h4>
                <p className="text-brand-muted leading-relaxed text-sm">
                    The Sentinel AI is an ML-powered module that operates locally on each node, performing real-time
                    behavioral analysis. It consists of three detection modules:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
                    {[
                        { title: 'Temporal Analysis', desc: 'Detects claims occurring < 60 seconds apart, indicative of automated farming.' },
                        { title: 'Timing Uniformity', desc: 'Flags accounts whose claim intervals vary by less than a human plausibly can, across 5+ claims.' },
                        { title: 'Compression Matching', desc: 'Uses zlib compression ratios to detect repetitive behavioral fingerprints.' },
                    ].map((mod, i) => (
                        <div key={i} className="p-4 bg-brand-bg/40 rounded-xl border border-brand-border/30">
                            <h5 className="text-xs font-black text-brand-secondary uppercase tracking-wider">{mod.title}</h5>
                            <p className="text-xs text-brand-muted mt-2 leading-relaxed">{mod.desc}</p>
                        </div>
                    ))}
                </div>
                <MermaidDiagram
                    code={SECURITY_DIAGRAM}
                    title="Fraud Detection Pipeline"
                    icon={<ShieldCheckIcon className="w-5 h-5" />}
                    prompt="Explain how FaucetChain's Sentinel AI detects and penalizes Sybil attacks using the three-module fraud detection system."
                />

                <h4 className="text-sm font-black text-brand-secondary uppercase tracking-wider mt-6 mb-3">9.2 L1 Anchoring & Merkle Proofs</h4>
                <p className="text-brand-muted leading-relaxed text-sm">
                    Application blocks are periodically finalized through the <strong className="text-brand-secondary">FaucetChain Native Consensus</strong> mechanism.
                    Each epoch generates a <strong className="text-brand-secondary">Keccak-256 Merkle root</strong> from its constituent block hashes.
                    Any user can verify block inclusion by requesting a Merkle proof from the API and validating it against the
                    on-chain root — ensuring data integrity without trusting the hub operator.
                </p>

                <h4 className="text-sm font-black text-brand-secondary uppercase tracking-wider mt-6 mb-3">9.3 Unified Slashing</h4>
                <p className="text-brand-muted leading-relaxed text-sm">
                    Malicious actions trigger penalties affecting <em>both</em> staked capital and accumulated merit weight:
                </p>
                <div className="overflow-x-auto mt-3">
                    <table className="w-full text-left">
                        <thead><TableRow cells={['Violation', 'Stake Penalty', 'Merit Penalty', 'Duration']} header /></thead>
                        <tbody>
                            <TableRow cells={['Downtime (> 1hr)', '1% stake/hour', '-50 merit pts/hour', 'Until recovery']} />
                            <TableRow cells={['Sybil Detection', '10% stake', 'Reset to 0', '24 hours']} />
                            <TableRow cells={['Double-Signing', '100% stake (ban)', 'Permanent ban', 'Permanent']} />
                        </tbody>
                    </table>
                </div>
            </SectionCard>

            {/* 10. NETWORK ARCHITECTURE */}
            <SectionCard title="10. Network Architecture" icon={<SignalIcon className="w-5 h-5" />}>
                <p className="text-brand-muted leading-relaxed">
                    FaucetChain's infrastructure follows a modular, layered architecture with clear separation of concerns:
                </p>
                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left">
                        <thead><TableRow cells={['Layer', 'Components', 'Technology', 'Role']} header /></thead>
                        <tbody>
                            <TableRow cells={['Distribution', 'FaucetChain appchain (PoC + PoS)', 'Python, FastAPI, SQLite', 'Claims, hourly quota, anti-Sybil — free and fast']} />
                            <TableRow cells={['Settlement', 'Anchor program on Solana', 'Rust, Anchor, SPL Token', 'Custody, proof of reserve, every payout']} />
                            <TableRow cells={['Bridge between them', 'One 32-byte Merkle root', 'keccak256, identical on both sides', 'Carries a promise, never carries value']} />
                            <TableRow cells={['Native Chain', 'indexer_service.py', 'Python, SQLite', 'Sovereign chain (genesis 0, no external sync)']} />
                            <TableRow cells={['API Gateway', 'api_server.py (FastAPI)', 'Python, WebSocket, REST', 'Data serving & coordination']} />
                            <TableRow cells={['AI Engine', 'Sentinel V3, Vector KB', 'Python, ChromaDB, ML', 'Fraud detection & knowledge']} />
                            <TableRow cells={['Frontend', 'React, TypeScript', 'Vite, @solana/web3.js, Recharts', 'User interface & Solana wallet']} />
                        </tbody>
                    </table>
                </div>
                <FormulaBlock
                    title="What each layer costs a user"
                    formula="Claiming: 0 · Receiving: 0 · Withdrawing to Solana: one transaction, paid by the relayer"
                    desc="A user who earned fractions of a cent holds no SOL. claim_reward takes the fee payer as a signer separate from the recipient, so the relayer covers both the fee and the account rent."
                />
            </SectionCard>

            {/* 11. THE SOLANA SETTLEMENT PROGRAM */}
            <SectionCard title="11. The Settlement Program on Solana" icon={<CubeIcon className="w-5 h-5" />}>
                <p className="text-brand-muted leading-relaxed mb-4">
                    Custody of every partner budget lives in one Anchor program on Solana, at{' '}
                    <code className="text-brand-primary text-xs">64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm</code>.
                    It exposes six instructions, and refuses anything it was not shown a proof for.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead><TableRow cells={['Instruction', 'What it does', 'What it refuses']} header /></thead>
                        <tbody>
                            <TableRow cells={['create_campaign', 'Opens a campaign: sponsor, operator, mint, vault, and the sponsor’s ceiling on pace', 'A vault whose authority is anyone but the campaign itself']} />
                            <TableRow cells={['fund_campaign', "Moves the partner's tokens into the vault", 'Debiting any account but the sponsor’s own']} />
                            <TableRow cells={['publish_root', 'Anchors one Merkle root for a batch of rewards', 'Any root the vault does not cover — proof of reserve — or that outruns the period the sponsor set']} />
                            <TableRow cells={['claim_reward', 'Pays one leaf against a published root', 'A second attempt: the leaf’s bit is already set']} />
                            <TableRow cells={['withdraw_surplus', 'Returns what was never promised to the sponsor', 'Touching a token inside a published root']} />
                            <TableRow cells={['close_campaign', 'Stops new roots without touching the vault', 'Anyone who is not the sponsor']} />
                        </tbody>
                    </table>
                </div>
                <p className="text-brand-muted leading-relaxed mt-4">
                    Every account it owns is a PDA — campaign, vault and reward root —
                    so nothing depends on a key somebody has to keep safe. The reserve check runs
                    on-chain before a root is accepted, which is what makes solvency a fact rather
                    than a report:
                </p>
                <FormulaBlock
                    title="Proof of Reserve, enforced at publication"
                    formula="vault.amount >= committed - paid + total_amount"
                    desc="A sequencer that has over-promised cannot publish. The check does not depend on the sequencer being honest, or even being online."
                />
            </SectionCard>

            {/* 12. GOVERNANCE */}
            <SectionCard title="12. Governance — designed, not built" icon={<ChartBarIcon className="w-5 h-5" />}>
                <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 text-[10px] font-black uppercase tracking-widest">
                    Not implemented yet
                </div>
                <p className="text-brand-muted leading-relaxed">
                    Nothing in this section runs today: there is no proposal route, no vote table and
                    no screen. It is here because it shapes decisions already being made, and because
                    a paper that quietly omitted it would be describing half a plan. The model below
                    is what FaucetChain intends — <strong className="text-brand-secondary">hybrid governance</strong> that
                    mirrors the consensus philosophy, where decisions need both economic weight and
                    meritorious participation:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="p-5 bg-brand-bg/40 rounded-xl border border-brand-border/30">
                        <h5 className="text-xs font-black text-brand-secondary uppercase tracking-wider mb-2">Standard Proposals</h5>
                        <p className="text-xs text-brand-muted leading-relaxed">
                            Require <strong className="text-brand-secondary">66% supermajority</strong> of combined stake + merit weight.
                            Voting period: 7 days. Covers parameter changes, treasury allocations, and new supported tokens.
                        </p>
                    </div>
                    <div className="p-5 bg-brand-bg/40 rounded-xl border border-brand-border/30">
                        <h5 className="text-xs font-black text-brand-secondary uppercase tracking-wider mb-2">Emergency Proposals</h5>
                        <p className="text-xs text-brand-muted leading-relaxed">
                            Require <strong className="text-brand-secondary">80% consensus</strong> for fast-track execution within 24 hours.
                            Reserved for critical security patches, bug fixes, and slashing parameter adjustments.
                        </p>
                    </div>
                </div>
                <h4 className="text-sm font-black text-brand-secondary uppercase tracking-wider mt-6 mb-3">Governable Parameters</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead><TableRow cells={['Parameter', 'Current Value', 'Governance Scope']} header /></thead>
                        <tbody>
                            <TableRow cells={['Epoch Quota', '2,000 CLAIM/hour', 'Adjustable ±50%']} />
                            <TableRow cells={['Halving Interval', '2.1M blocks', 'Requires 80% consensus']} />
                            <TableRow cells={['Min DApp Stake', '10,000 CLAIM', 'Adjustable ±30%']} />
                            <TableRow cells={['UTXO Vault Tiers', '3 tiers (1h/24h/7d)', 'New tiers can be added']} />
                            <TableRow cells={['Slashing Rates', '1-100% stake', 'Emergency governance only']} />
                            <TableRow cells={['Sentinel Thresholds', '0.75 Sybil / 60s min interval', 'Standard proposals']} />
                        </tbody>
                    </table>
                </div>
            </SectionCard>

            {/* 13. ROADMAP */}
            <SectionCard title="13. Roadmap" icon={<BeakerIcon className="w-5 h-5" />}>
                <div className="space-y-6 mt-2">
                    {[
                        { phase: 'Phase 1 — Distribution', status: 'COMPLETED', items: ['Proof of Claim with rising difficulty', 'Hourly quota of 2,000 $CLAIM', 'Per-IP wallet cap', 'Block indexer service', 'Explorer and appchain API'] },
                        { phase: 'Phase 2 — Intelligence', status: 'COMPLETED', items: ['Sentinel AI engine', 'Vector Knowledge Base (ChromaDB)', 'Fraud detection pipeline', 'Faucet staking registry'] },
                        { phase: 'Phase 3 — Settlement on Solana', status: 'CURRENT', items: ['Campaign vaults and reward roots on Solana', 'Proof of reserve enforced before a root is accepted', 'Merkle-proof withdrawal, replay stopped by one bit per leaf', 'Relayer: withdraw holding zero SOL', 'Wallet ownership proved by signature', 'Ledger read from the chain, not from the server'] },
                        { phase: 'Phase 4 — Hardening', status: 'NEXT', items: ['Devnet deployment and a public demo campaign', 'Session authentication for custodial accounts', 'Rate limits on the relayer and the proof endpoint', 'Partner SDK for external faucets'] },
                        { phase: 'Phase 5 — Treasury', status: 'PLANNED', items: ['Treasury staking as an operation, not a model', 'Payout choice: $CLAIM or the staked asset', 'Expiry for rewards nobody claims', 'More than one sequencer', 'Independent security audit'] },
                    ].map((phase, i) => (
                        <div key={i} className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                                    phase.status === 'COMPLETED' ? 'bg-green-400 border-green-400' :
                                    phase.status === 'CURRENT' ? 'bg-brand-primary border-brand-primary animate-pulse' :
                                    'bg-transparent border-brand-muted'
                                }`} />
                                {i < 4 && <div className="w-0.5 h-full bg-brand-border/30 mt-1" />}
                            </div>
                            <div className="flex-1 pb-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <h4 className="text-sm font-black text-brand-secondary">{phase.phase}</h4>
                                    {/* No quarter labels: the previous roadmap dated Solidity milestones
                                        as shipped that were never deployed. Order is honest, dates were not. */}
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                        phase.status === 'COMPLETED' ? 'text-green-400 bg-green-500/10 border border-green-500/20' :
                                        phase.status === 'CURRENT' ? 'text-brand-primary bg-brand-primary/10 border border-brand-primary/20' :
                                        'text-brand-muted bg-brand-surface border border-brand-border'
                                    }`}>{phase.status}</span>
                                </div>
                                <ul className="space-y-1">
                                    {phase.items.map((item, j) => (
                                        <li key={j} className="text-xs text-brand-muted flex items-center gap-2">
                                            <span className={phase.status === 'COMPLETED' ? 'text-green-400' : 'text-brand-muted/50'}>
                                                {phase.status === 'COMPLETED' ? '✓' : '○'}
                                            </span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* 14. CONCLUSION */}
            <SectionCard title="14. Conclusion" icon={<DocumentTextIcon className="w-5 h-5" />}>
                <p className="text-brand-muted leading-relaxed">
                    FaucetChain represents a fundamental rethinking of blockchain consensus — one where network influence
                    is earned through genuine participation rather than merely purchased through capital accumulation.
                    By combining <strong className="text-brand-secondary">Proof of Claim</strong> with <strong className="text-brand-secondary">Proof of Stake</strong> and
                    modulating the result with <strong className="text-brand-secondary">AI-driven behavioral analysis</strong>, the protocol creates
                    an environment that is simultaneously secure, fair, and performant.
                </p>
                <p className="text-brand-muted leading-relaxed mt-4">
                    <strong className="text-brand-secondary">UTXO-style staking</strong> brings the granular asset management
                    of Bitcoin to positions that are spent exactly once, while the <strong className="text-brand-secondary">Hourly Epoch
                    System</strong> ensures controlled, predictable monetary policy. Together, these innovations establish
                    FaucetChain as a platform designed not just for the current state of blockchain technology, but for
                    the decentralized economies of tomorrow.
                </p>
                <Quote>
                    In a world where most blockchains reward capital, FaucetChain rewards contribution.
                    This is the foundation of meritocratic decentralization.
                </Quote>

                <div className="mt-8 p-6 bg-gradient-to-r from-brand-primary/5 to-brand-accent/5 rounded-2xl border border-brand-primary/20 text-center">
                    <p className="text-xs font-black text-brand-muted uppercase tracking-[0.2em] mb-2">Contact & Resources</p>
                    <p className="text-sm text-brand-secondary">
                        Testnet Explorer • API Docs • Anchor Program Source • AI Sentinel Dashboard
                    </p>
                    <p className="text-xs text-brand-muted mt-2">
                        © 2026 FaucetChain Protocol. Licensed under MIT.
                    </p>
                </div>
            </SectionCard>
        </div>
    );
};
