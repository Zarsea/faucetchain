// O repositorio publico. Fica aqui para existir num lugar so: a barra
// lateral, a tela da API e as especificacoes tecnicas apontam todas para
// ele, e um dia o nome muda.
export const REPO_URL = 'https://github.com/Zarsea/faucetchain';

// Estes dois trechos mostravam codigo que nao existe.
//
// O primeiro era um `calculate_adaptive_v2_weight` em Rust, exibido com o
// titulo `consensus/src/weight_modulator.rs` -- um caminho de arquivo numa
// pasta que nunca existiu. As funcoes dentro dele tambem nao: `merit_points`,
// `sentinel_reputation`, `uptime_multiplier`. Quem procurasse o arquivo
// no GitHub nao acharia nada.
//
// O segundo mostrava uma auditoria por entropia de Shannon. Esse ja vinha
// rotulado "proposta -- nao existe no repositorio", o que era honesto e
// resolvia metade do problema.
//
// Os dois foram trocados pelo codigo que roda, com o caminho de verdade.
// Mostrar o que existe e mais forte do que descrever o que nao existe, e e a
// unica versao que sobrevive a alguem conferir.

export const POC_WEIGHT_LOGIC_CODE = `
# A node's weight in the sealer draw, as it stands in api_server.py.
#
# With no cap, weight = 1 + stake lets whoever locks the most seal almost every
# round, and that is not hypothetical: of the 935,500 actively staked in this
# database, 930,000 sat in a single wallet.
SEALER_STAKE_CAP = float(os.getenv("SEALER_STAKE_CAP", "10000"))


def sealer_weight(stake: float) -> float:
    """The "+1" guarantees a minimum chance to anyone holding no stake at all,
    so an honest node without capital still gets in. The cap stops growth
    without erasing what sits below it: stake still counts, it just stops
    buying the round.
    """
    return 1.0 + min(max(stake, 0.0), SEALER_STAKE_CAP)
`;

export const AI_REPUTATION_LOGIC_CODE = `
# The per-IP ceiling, from api_server.py. Not a model and not a score: a count.
CLAIM_IP_HOURLY_WALLETS = int(os.getenv("CLAIM_IP_HOURLY_WALLETS", "5"))


def claim_ip_allowed(client_ip: str, addr_lower: str, now_ts: int) -> bool:
    """How many distinct wallets one IP may claim for in an hour.

    Sentinel scores and filters; this limit is arithmetic, and it holds whether
    the classifier is right or wrong. It is the part that actually stops abuse,
    and it has a test that fails if it ever stops working.
    """
    seen = wallets_seen_this_hour(client_ip, now_ts)
    return addr_lower in seen or len(seen) < CLAIM_IP_HOURLY_WALLETS
`;


// The deployed settlement program, copied from
// faucetchain/programs/faucetchain/src/lib.rs. It replaced a Solidity snippet
// that described a contract this project never deployed.
export const ANCHOR_CODE = `//! FaucetChain — the settlement layer on Solana.
//!
//! The appchain keeps doing the distributing: proof of claim, the hourly quota,
//! Sentinel and micro-claims. This program holds what needs a public guarantee:
//!
//! 1. the partner's budget sits in a per-campaign vault;
//! 2. FaucetChain publishes the Merkle root of each reward batch;
//! 3. the user withdraws by proving their leaf is in that root.
//!
//! Partner funds never cross a bridge. They enter here and leave here.
pub mod constants;
pub mod error;
pub mod instructions;
pub mod merkle;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm");

#[program]
pub mod faucetchain {
    use super::*;

    /// Opens a campaign and the vault that holds its budget.
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        campaign_id: u64,
        operator: Pubkey,
    ) -> Result<()> {
        instructions::create_campaign::handle_create_campaign(ctx, campaign_id, operator)
    }

    /// The partner deposits tokens into the campaign vault.
    pub fn fund_campaign(ctx: Context<FundCampaign>, amount: u64) -> Result<()> {
        instructions::fund_campaign::handle_fund_campaign(ctx, amount)
    }

    /// FaucetChain publishes the root of a reward batch. It only goes through if
    /// the vault covers everything already promised and not yet withdrawn.
    pub fn publish_root(
        ctx: Context<PublishRoot>,
        index: u32,
        root: [u8; 32],
        total_amount: u64,
        leaf_count: u32,
    ) -> Result<()> {
        instructions::publish_root::handle_publish_root(ctx, index, root, total_amount, leaf_count)
    }

    /// Returns to the partner whatever the vault holds above what is owed.
    pub fn withdraw_surplus(ctx: Context<WithdrawSurplus>, amount: u64) -> Result<()> {
        instructions::withdraw_surplus::handle_withdraw_surplus(ctx, amount)
    }

    /// Closes the campaign: no new roots, but what was promised stays withdrawable.
    pub fn close_campaign(ctx: Context<CloseCampaign>) -> Result<()> {
        instructions::close_campaign::handle_close_campaign(ctx)
    }

    /// The user withdraws their reward with an inclusion proof for the published root.
    pub fn claim_reward(
        ctx: Context<ClaimReward>,
        leaf_index: u32,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::claim_reward::handle_claim_reward(ctx, leaf_index, amount, proof)
    }
}`;


export const PYTHON_CODE = `
import zlib
import time
from typing import List, Dict

class SentinelV2Engine:
    def audit_node(self, node_data: Dict) -> Dict:
        claim_sequence = node_data.get('claims', [])
        is_bot = self.detector.is_sybil_pattern(claim_sequence)
        reputation_score = 0.1 if is_bot else node_data.get('reputation', 1.0)
        return { "status": "FLAGGED" if is_bot else "VERIFIED", "final_multiplier": reputation_score }
`;

export const YAML_CODE = `
protocol_evolution:
  version: "devnet"
  consensus: "Proof of Claim + stake-weighted sealing"
  security_audit: "Sentinel AI Integrated"
`;

// Trechos reais do programa Anchor publicado na devnet. Aqui havia dois
// arquivos inventados -- um chamava verify_vrf_proof, o outro configurava
// Gossipsub -- e nenhum dos dois caminhos existe neste repositorio.
export const CORE_RUST_CODE = `
// Proof of reserve inside the instruction itself: a campaign cannot promise
// more than the vault covers, counting everything already published and not
// yet paid out.
let outstanding = campaign
    .committed
    .checked_sub(campaign.paid)
    .ok_or(ErrorCode::Overflow)?
    .checked_add(total_amount)
    .ok_or(ErrorCode::Overflow)?;

require!(
    ctx.accounts.vault.amount >= outstanding,
    ErrorCode::InsufficientReserve
);
`;

export const P2P_SPEC_CODE = `
// Token-2022 allows a transfer fee: the vault would be debited exactly what
// the sheet published while the recipient received less. A root that pays 98
// where it said 100 is not rounding, it is the guarantee failing quietly.
#[account(
    address = anchor_spl::token::ID @ ErrorCode::UnsupportedTokenProgram
)]
pub token_program: Interface<'info, TokenInterface>,
`;

export const TRANSLATIONS = {
  en: {
    headerTitle: "FaucetChain",
    wallet: {
      connect: "Connect Wallet",
      searchPlaceholder: "Scan L1 Address (0x...)",
      reputation: "Sentinel Score",
      staked: "Staked Capital",
      activity: "Merit Propagation",
      analysis: "Forensic AI Analysis"
    },
    tabs: {
      Overview: "Overview",
      WalletExplorer: "Architect Explorer",
      GeneralArticle: "Settlement Architecture",
      NetworkStatus: "System Pulse",
      TechnicalSpecs: "Evolution Logic",
      SmartContract: "Solana Program",
      AIModule: "Sentinel Engine",
      Simulation: "Consensus Lab",
      Tokenomics: "Yield Economics",
      Whitepaper: "Evolutionary Paper",
      Faucet: "Merit Faucet",
      APIDocs: "Hub API",
      AIAgent: "AI Agent Sentinel"
    },
    tokenomics: {
      title: "Proof of Claim Yield Logic",
      desc: "A hybrid Proof of Claim consensus, funded by staking the treasury's own capital rather than anyone else's.",
      fixedSupplyTitle: "Immutable Supply Constraint",
      fixedSupplyDesc: "Fixed 99 Million CLAIM limit. Opt-in Burn only, operating natively at $0 Internal Gas Fees.",
      decayTitle: "Hourly Block Cycles",
      decayDesc: "Mining occurs hourly. If the epoch quota is exhausted, DApps stall and enter a hiatus until the next hour starts.",
      flowTitle: "How the treasury funds rewards",
      distTitle: "DApp Staking Connection",
      ecoFundTitle: "PoS Wealth Absorber Vault",
      ecoFundDesc: "FaucetChain acts as a giant vault, locking external inflationary PoS assets and redistributing cross-chain yields back to the network."
    },
    faucet: {
      title: "Merit Faucet",
      desc: "Claim testnet merit to try the flow this network runs on.",
      cardTitle: "Request Merit Tokens",
      labelAddress: "L1 Wallet Address",
      btnClaim: "Mint 10.0 Merit CLAIM",
      btnProcessing: "Auditing via Sentinel...",
      successTitle: "Audit Passed",
      successDesc: "Merit tokens minted. Reputation index updated.",
      txHash: "Consensus Hash:",
      testnetNote: "Test tokens on a public testnet. $CLAIM has no market price."
    },
    aiChat: {
      title: "Sentinel Recursive AI",
      desc: "Neural interface for protocol architecture and cross-layer analysis.",
      placeholder: "Initialize architectural query...",
      btnSend: "Transmit",
      welcome: "Neural links established. I am Sentinel. How shall we deconstruct the protocol state today?",
      suggestions: {
        code: "Analyze State Transition Entropy",
        math: "Synthesize Adaptive Weight Dynamics",
        future: "Model L3 Hub Recursive Scaling"
      }
    }
  },
  pt: {
    headerTitle: "FaucetChain",
    wallet: {
      connect: "Conectar Carteira",
      searchPlaceholder: "Escaneamento L1 (0x...)",
      reputation: "Score Sentinela",
      staked: "Capital em Stake",
      activity: "Propagação de Mérito",
      analysis: "Análise Forense de IA"
    },
    tabs: {
      Overview: "Visão Geral",
      WalletExplorer: "Explorador Arquiteto",
      GeneralArticle: "Arquitetura de Liquidação",
      NetworkStatus: "Pulso do Sistema",
      TechnicalSpecs: "Lógica de Evolução",
      SmartContract: "Programa Solana",
      AIModule: "Motor Sentinela",
      Simulation: "Laboratório de Consenso",
      Tokenomics: "Economia de Yield",
      Whitepaper: "Paper Evolutivo",
      Faucet: "Faucet de Mérito",
      APIDocs: "API de Hubs",
      AIAgent: "IA Agente Sentinela"
    },
    tokenomics: {
      title: "Economia do Proof of Claim",
      desc: "Consenso L1 via Proof of Claim com Acumulador de Riquezas (Vault) de ativos externos.",
      fixedSupplyTitle: "Suprimento Limitado a 99M",
      fixedSupplyDesc: "Hardcap rígido de 99 Milhões de CLAIM. Zero Auto-Burn. O ecossistema suporta apenas Opt-in Burn sob Taxa $0 Interna.",
      decayTitle: "Hiato Horário do Bloco",
      decayDesc: "Extração limitada! Se a cota do bloco é esgotada, todos os DApps (torneiras) entram em período de bloqueio térmico até a nova hora.",
      flowTitle: "O Fluxo Estrangeiro de Absorção",
      distTitle: "Staking Institucional das Faucets",
      ecoFundTitle: "Vault: O Grande Ralo PoS",
      ecoFundDesc: "O protocolo absorve Tokens PoS externos depreciáveis no Vault, distribuindo um Yield multi-chain ao invés de drenar o eco-sistema local."
    },
    faucet: {
      title: "Faucet de Mérito",
      desc: "Reivindique mérito de testnet para experimentar o fluxo que esta rede roda.",
      cardTitle: "Solicitar Tokens de Mérito",
      labelAddress: "Endereço da Carteira L1",
      btnClaim: "Mintar 10.0 CLAIM de Mérito",
      btnProcessing: "Auditando via Sentinela...",
      successTitle: "Auditoria Aprovada",
      successDesc: "Tokens de mérito mintados. Índice de reputação atualizado.",
      txHash: "Hash de Consenso:",
      testnetNote: "Tokens de teste numa rede pública. O $CLAIM não tem preço de mercado."
    },
    aiChat: {
      title: "Sentinela IA Recursiva",
      desc: "Interface neural para arquitetura de protocolo e análise entre camadas.",
      placeholder: "Inicializar consulta arquitetônica...",
      btnSend: "Transmitir",
      welcome: "Links neurais estabelecidos. Eu sou o Sentinel. Como vamos desconstruir o estado do protocolo hoje?",
      suggestions: {
        code: "Analisar Entropia de Transição de Estado",
        math: "Sintetizar Dinâmica de Pesos Adaptativos",
        future: "Modelar Escala Recursiva de Hubs L3"
      }
    }
  }
};
