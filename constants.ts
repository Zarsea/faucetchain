// Os sete diagramas foram reescritos em 8/10/2026. Os anteriores desenhavam o
// design pre-Solana: "VRF Leader Election" e "VRF Slot Selection", que nao
// existem em codigo nenhum; "Stablecoin Yield", que tambem nao; e, acima de
// tudo, nenhum deles mencionava a liquidacao na Solana -- o cofre, a raiz de
// Merkle, o saque contra prova. O ANCHOR_CODE logo abaixo mostrava o programa
// como codigo, e nenhuma figura o desenhava.
//
// O que veio de la e verdade e continua: Sentinel (SentinelV3Engine) e o peso
// do stake na selagem (sealer_weight, com teto).
export const DIAGRAMS = {
  en: {
    MERMAID_CODE: `
flowchart TD
    A["A click on a partner faucet"] --> B["Keccak puzzle in the browser"]
    B --> C{"Sentinel: timing, clustering, per-IP"}
    C -- "automated" --> D["Scored down, claim refused"]
    C -- "human" --> E["Claim accepted"]

    subgraph Sealing
        E --> F["Block sealed"]
        G["Staked CLAIM, capped weight"] --> F
    end

    F --> H["80 percent to the user, 20 to the miner"]
    H --> I["Hourly quota spent, difficulty rises"]
    `,
    HUB_INTEGRATION_DIAGRAM: `
flowchart LR
    F["Partner faucet"] -- "one HTTP call, X-Api-Key" --> A["POST /microclaim"]
    A --> C["Credited on the appchain"]
    C --> B["Batch closes: Merkle tree"]
    B --> R["Root published on Solana"]
    R --> W["User withdraws against a proof"]
    `,
    CLAIM_LIFECYCLE_DETAILED_CODE: `
flowchart TD
    User["User clicks on the faucet"] --> Credit["Credited here, free and instant"]

    subgraph OnTheAppchain
        Credit --> Drip["Campaign drip: 80 percent user, 20 treasury"]
        Drip --> Batch["Batch closes, one Merkle tree"]
    end

    Batch --> Check{"Does the vault cover what is promised?"}
    Check -- "no" --> Refuse["InsufficientReserve: root refused"]
    Check -- "yes" --> Root["Root published on Solana"]

    subgraph OnSolana
        Root --> Proof["User proves their leaf"]
        Proof --> Receipt["Receipt account blocks a second withdrawal"]
        Receipt --> Pay["Relayer pays the fee and the rent"]
    end

    Pay --> Wallet["Tokens in the user wallet"]
    `,
    MINDMAP_CODE: `
mindmap
  root((FaucetChain))
    Appchain
      Proof of Claim
        Keccak puzzle in the browser
        Hourly quota of 2000 CLAIM
        Difficulty rises as it is spent
      Sentinel
        Timing and clustering
        Per-IP wallet cap
      Micro-claims
        Partner faucets over one HTTP call
        Campaign drip, 80/20
    Settlement on Solana
      Campaign vault
        Authority is the campaign, not a key
      Merkle root per batch
        Reserve check before publishing
      Withdrawal
        Proof of one leaf
        Receipt against replay
        Relayer pays the fee
    Treasury
      Stakes its own capital
      Funds the reward budget
      Users never deposit
    `,
    CLAIM_EVENT_DIAGRAM: `
sequenceDiagram
    participant U as "User"
    participant F as "Partner faucet"
    participant A as "FaucetChain"
    participant S as "Solana"

    U->>F: Completes the task
    F->>A: One HTTP call, after its own commit
    A->>A: Credits the user and the campaign share
    A->>S: Publishes the batch root
    S->>S: Refuses it if the vault cannot cover
    U->>A: Asks for the proof of their leaf
    U->>S: Withdraws, signing with their wallet
    S->>U: Tokens, with the relayer paying the fee
    `,
    TOKENOMICS_FLOW_CODE: `
flowchart LR
    Q["Hourly ceiling of 2000 CLAIM"] --> C["Claims across every faucet"]
    C --> U["80 percent to the user"]
    C --> T["20 percent to the treasury"]
    T --> S["Treasury stakes its own capital: a model, not yet an operation"]
    S --> B["Yield funds the reward budget"]
    B --> C
    `,
    TREASURY_ALLOCATION_DIAGRAM: `
pie title "Proposed split of the 99M cap, not yet committed"
    "Proof of Work, miners: 30" : 30
    "Proof of Stake, vault: 30" : 30
    "Proof of Claim, merit: 20" : 20
    "Core team and liquidity: 20" : 20
    `
  },
  pt: {
    MERMAID_CODE: `
flowchart TD
    A["Um clique numa torneira parceira"] --> B["Desafio keccak no navegador"]
    B --> C{"Sentinel: ritmo, agrupamento, por IP"}
    C -- "automatizado" --> D["Pontuado para baixo, claim recusado"]
    C -- "humano" --> E["Claim aceito"]

    subgraph Selagem
        E --> F["Bloco selado"]
        G["CLAIM em stake, peso com teto"] --> F
    end

    F --> H["80 por cento para o usuario, 20 para o minerador"]
    H --> I["Cota da hora gasta, dificuldade sobe"]
    `,
    HUB_INTEGRATION_DIAGRAM: `
flowchart LR
    F["Torneira parceira"] -- "uma chamada HTTP, X-Api-Key" --> A["POST /microclaim"]
    A --> C["Creditado na appchain"]
    C --> B["Lote fecha: arvore de Merkle"]
    B --> R["Raiz publicada na Solana"]
    R --> W["Usuario saca contra uma prova"]
    `,
    CLAIM_LIFECYCLE_DETAILED_CODE: `
flowchart TD
    User["Usuario clica na torneira"] --> Credit["Creditado aqui, gratis e na hora"]

    subgraph NaAppchain
        Credit --> Drip["Gotejamento da campanha: 80 por cento usuario, 20 tesouraria"]
        Drip --> Batch["Lote fecha, uma arvore de Merkle"]
    end

    Batch --> Check{"O cofre cobre o que foi prometido?"}
    Check -- "nao" --> Refuse["InsufficientReserve: raiz recusada"]
    Check -- "sim" --> Root["Raiz publicada na Solana"]

    subgraph NaSolana
        Root --> Proof["Usuario prova a folha dele"]
        Proof --> Receipt["Recibo impede um segundo saque"]
        Receipt --> Pay["Relayer paga a taxa e o aluguel"]
    end

    Pay --> Wallet["Tokens na carteira do usuario"]
    `,
    MINDMAP_CODE: `
mindmap
  root((FaucetChain))
    Appchain
      Proof of Claim
        Desafio keccak no navegador
        Cota horaria de 2000 CLAIM
        Dificuldade sobe conforme e gasta
      Sentinel
        Ritmo e agrupamento
        Teto de carteiras por IP
      Microclaims
        Torneiras parceiras por uma chamada HTTP
        Gotejamento de campanha, 80/20
    Liquidacao na Solana
      Cofre da campanha
        A autoridade e a campanha, nao uma chave
      Raiz de Merkle por lote
        Prova de reserva antes de publicar
      Saque
        Prova de uma folha
        Recibo contra repeticao
        Relayer paga a taxa
    Tesouraria
      Stakeia capital proprio
      Financia o orcamento de recompensa
      Usuario nunca deposita
    `,
    CLAIM_EVENT_DIAGRAM: `
sequenceDiagram
    participant U as "Usuario"
    participant F as "Torneira parceira"
    participant A as "FaucetChain"
    participant S as "Solana"

    U->>F: Cumpre a tarefa
    F->>A: Uma chamada HTTP, depois do commit dela
    A->>A: Credita o usuario e a parte da campanha
    A->>S: Publica a raiz do lote
    S->>S: Recusa se o cofre nao cobrir
    U->>A: Pede a prova da folha dele
    U->>S: Saca, assinando com a carteira
    S->>U: Tokens, com o relayer pagando a taxa
    `,
    TOKENOMICS_FLOW_CODE: `
flowchart LR
    Q["Teto horario de 2000 CLAIM"] --> C["Claims em todas as torneiras"]
    C --> U["80 por cento para o usuario"]
    C --> T["20 por cento para a tesouraria"]
    T --> S["A tesouraria stakeia capital proprio: modelo, ainda nao operacao"]
    S --> B["O rendimento financia o orcamento"]
    B --> C
    `,
    TREASURY_ALLOCATION_DIAGRAM: `
pie title "Divisao proposta do teto de 99M, ainda nao decidida"
    "Proof of Work, mineradores: 30" : 30
    "Proof of Stake, cofre: 30" : 30
    "Proof of Claim, merito: 20" : 20
    "Core team e liquidez: 20" : 20
    `
  }
};

export const POC_WEIGHT_LOGIC_CODE = `
/// Evolução HVM-V2: Cálculo de Peso Adaptativo
pub fn calculate_adaptive_v2_weight(node: &Node, network_health: f64) -> f64 {
    let (alpha, beta, gamma) = if network_health < 0.6 {
        (0.20, 0.70, 0.10) 
    } else {
        (0.60, 0.20, 0.20) 
    };
    let merit_score = node.merit_points * alpha;
    let stake_score = node.staked_balance * beta;
    let ai_trust = node.sentinel_reputation * gamma;
    (merit_score + stake_score + ai_trust) * node.uptime_multiplier()
}
`;

export const AI_REPUTATION_LOGIC_CODE = `
# Motor IA Sentinel V2 - Auditoria de Entropia de Grafo
def sentinel_v2_audit(node_id, behavioral_history):
    entropy = calculate_shannon_entropy(behavioral_history)
    if entropy < ENTROPY_THRESHOLD:
        return 0.1 
    return 1.0 + (entropy * 0.2) 
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
  version: "2.0.0-HVM"
  consensus: "Proof of Claim + stake-weighted sealing"
  security_audit: "Sentinel AI Integrated"
`;

// Trechos reais do programa Anchor publicado na devnet. Aqui havia dois
// arquivos inventados -- um chamava verify_vrf_proof, o outro configurava
// Gossipsub -- e nenhum dos dois caminhos existe neste repositorio.
export const CORE_RUST_CODE = `
// Prova de reserva dentro da propria instrucao: uma campanha nao pode
// prometer mais do que o vault cobre, contando tudo que ja foi publicado
// e ainda nao foi pago.
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
// Token-2022 aceita taxa de transferencia: o vault seria debitado
// exatamente o que a folha publicou enquanto o destinatario recebia
// menos. Uma raiz que paga 98 onde disse 100 nao e arredondamento,
// e a garantia falhando em silencio.
#[account(
    address = anchor_spl::token::ID @ ErrorCode::UnsupportedTokenProgram
)]
pub token_program: Interface<'info, TokenInterface>,
`;

export const TRANSLATIONS = {
  en: {
    headerTitle: "FaucetChain Evolution V2",
    wallet: {
      connect: "Connect Architect Wallet",
      searchPlaceholder: "Scan L1 Address (0x...)",
      reputation: "Sentinel V2 Score",
      staked: "Staked Capital V2",
      activity: "Merit Propagation",
      analysis: "Forensic AI Analysis"
    },
    tabs: {
      Overview: "V2 Overview",
      WalletExplorer: "Architect Explorer",
      GeneralArticle: "HVM-V2 Spec",
      NetworkStatus: "System Pulse",
      TechnicalSpecs: "Evolution Logic",
      SmartContract: "L1 Contract",
      AIModule: "Sentinel Engine",
      Simulation: "Consensus Lab",
      Tokenomics: "Yield Economics",
      Whitepaper: "Evolutionary Paper",
      Faucet: "Merit Faucet",
      APIDocs: "Hub API",
      AIAgent: "AI Agent Sentinel"
    },
    tokenomics: {
      title: "HVM-V3 PoC Yield Logic",
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
      title: "V2 Merit Faucet",
      desc: "Claim testnet merit to simulate participation in the HVM-V2 ecosystem.",
      cardTitle: "Request Merit Tokens",
      labelAddress: "L1 Wallet Address",
      btnClaim: "Mint 10.0 Merit CLAIM",
      btnProcessing: "Auditing via Sentinel...",
      successTitle: "Audit Passed",
      successDesc: "Merit tokens minted. Reputation index updated.",
      txHash: "Consensus Hash:",
      testnetNote: "V2 test tokens are purely for architectural simulation."
    },
    aiChat: {
      title: "Sentinel Recursive AI",
      desc: "Neural interface for protocol architecture and cross-layer analysis.",
      placeholder: "Initialize architectural query...",
      btnSend: "Transmit",
      welcome: "Neural links established. I am the Sentinel V2 Recursive Intelligence. How shall we deconstruct the protocol state today?",
      suggestions: {
        code: "Analyze State Transition Entropy",
        math: "Synthesize Adaptive Weight Dynamics",
        future: "Model L3 Hub Recursive Scaling"
      }
    }
  },
  pt: {
    headerTitle: "FaucetChain Evolução V2",
    wallet: {
      connect: "Conectar Carteira Arquiteto",
      searchPlaceholder: "Escaneamento L1 (0x...)",
      reputation: "Score Sentinela V2",
      staked: "Capital em Stake V2",
      activity: "Propagação de Mérito",
      analysis: "Análise Forense de IA"
    },
    tabs: {
      Overview: "Visão Geral V2",
      WalletExplorer: "Explorador Arquiteto",
      GeneralArticle: "Spec HVM-V2",
      NetworkStatus: "Pulso do Sistema",
      TechnicalSpecs: "Lógica de Evolução",
      SmartContract: "Contrato L1",
      AIModule: "Motor Sentinela",
      Simulation: "Laboratório de Consenso",
      Tokenomics: "Economia de Yield",
      Whitepaper: "Paper Evolutivo",
      Faucet: "Faucet de Mérito",
      APIDocs: "API de Hubs",
      AIAgent: "IA Agente Sentinela"
    },
    tokenomics: {
      title: "Economia HVM-V3 PoC",
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
      title: "Faucet de Mérito V2",
      desc: "Reivindique mérito de testnet para simular a participação no ecossistema HVM-V2.",
      cardTitle: "Solicitar Tokens de Mérito",
      labelAddress: "Endereço da Carteira L1",
      btnClaim: "Mintar 10.0 CLAIM de Mérito",
      btnProcessing: "Auditando via Sentinela...",
      successTitle: "Auditoria Aprovada",
      successDesc: "Tokens de mérito mintados. Índice de reputação atualizado.",
      txHash: "Hash de Consenso:",
      testnetNote: "Tokens de teste V2 são puramente para simulação arquitetônica."
    },
    aiChat: {
      title: "Sentinela IA Recursiva",
      desc: "Interface neural para arquitetura de protocolo e análise entre camadas.",
      placeholder: "Inicializar consulta arquitetônica...",
      btnSend: "Transmitir",
      welcome: "Links neurais estabelecidos. Eu sou a Inteligência Recursiva Sentinela V2. Como vamos desconstruir o estado do protocolo hoje?",
      suggestions: {
        code: "Analisar Entropia de Transição de Estado",
        math: "Sintetizar Dinâmica de Pesos Adaptativos",
        future: "Modelar Escala Recursiva de Hubs L3"
      }
    }
  }
};
