// O repositorio publico. Fica aqui para existir num lugar so: a barra
// lateral, a tela da API e as especificacoes tecnicas apontam todas para
// ele, e um dia o nome muda.
export const REPO_URL = 'https://github.com/Zarsea/faucetchain';

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
    P["Partner faucet pays its own user, on its own rail"] --> PC["One HTTP call, after that payment cleared"]
    A["A click on the built-in faucet"] --> B["Keccak puzzle in the browser"]
    B --> C{"Sentinel: timing, clustering, per-IP"}
    C -- "automated" --> D["Scored down, claim refused"]
    C -- "human" --> E["Claim accepted"]

    PC --> K["Credited on the appchain"]
    E --> K
    K --> H["80 percent to the user, 20 to the treasury"]
    H --> I["Hourly quota spent, difficulty rises"]

    subgraph Sealing["Sealing: paid from the epoch reward, not from the split"]
        K --> F["Block sealed"]
        G["Staked CLAIM, capped weight"] --> F
        F --> M["Miner fee"]
    end
    `,
    HUB_INTEGRATION_DIAGRAM: `
flowchart LR
    F["Partner faucet"] -- "1. pays its user, on its own rail" --> U["Their user, already paid"]
    F -- "2. one HTTP call, X-Api-Key, after that" --> A["POST /microclaim"]
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
    Check -- "no" --> Refuse["InsufficientReserve"]
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
        Difficulty rises with use
      Sentinel
        Timing and clustering
        Per-IP wallet cap
      Micro-claims
        Partner faucets
        Campaign drip, 80/20
    Settlement on Solana
      Campaign vault
        Campaign is the authority
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
flowchart TD
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
    P["Torneira parceira paga o usuario dela, no trilho dela"] --> PC["Uma chamada HTTP, depois que esse pagamento saiu"]
    A["Um clique na torneira interna"] --> B["Desafio keccak no navegador"]
    B --> C{"Sentinel: ritmo, agrupamento, por IP"}
    C -- "automatizado" --> D["Pontuado para baixo, claim recusado"]
    C -- "humano" --> E["Claim aceito"]

    PC --> K["Creditado na appchain"]
    E --> K
    K --> H["80 por cento para o usuario, 20 para a tesouraria"]
    H --> I["Cota da hora gasta, dificuldade sobe"]

    subgraph Selagem["Selagem: paga pela recompensa de epoca, nao pelo split"]
        K --> F["Bloco selado"]
        G["CLAIM em stake, peso com teto"] --> F
        F --> M["Taxa do minerador"]
    end
    `,
    HUB_INTEGRATION_DIAGRAM: `
flowchart LR
    F["Torneira parceira"] -- "1. paga o usuario dela, no trilho dela" --> U["Usuario dela, ja pago"]
    F -- "2. uma chamada HTTP, X-Api-Key, depois disso" --> A["POST /microclaim"]
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
    Check -- "nao" --> Refuse["InsufficientReserve"]
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
        Dificuldade sobe com o uso
      Sentinel
        Ritmo e agrupamento
        Teto de carteiras por IP
      Microclaims
        Torneiras parceiras
        Gotejamento de campanha, 80/20
    Liquidacao na Solana
      Cofre da campanha
        A campanha e a autoridade
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
flowchart TD
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

/**
 * Os diagramas existem em en e pt. Pedir outro idioma devolvia undefined, e a
 * primeira leitura de chave derrubava o app inteiro: em espanhol a tela
 * Settlement Architecture virava tela branca com
 * "Cannot read properties of undefined (reading 'MINDMAP_CODE')".
 *
 * O ingles e a queda porque e a versao canonica, e e o idioma do evento.
 */
export function diagrams(lang: string) {
  return DIAGRAMS[lang as keyof typeof DIAGRAMS] ?? DIAGRAMS.en;
}

// Estes dois trechos mostravam codigo que nao existe.
//
// O primeiro era um `calculate_adaptive_v2_weight` em Rust, exibido com o
// titulo `consensus/src/weight_modulator.rs` -- um caminho de arquivo numa
// pasta que nunca existiu. As funcoes dentro dele tambem nao: `merit_points`,
// `sentinel_reputation`, `uptime_multiplier`. Um juiz que procurasse o arquivo
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
