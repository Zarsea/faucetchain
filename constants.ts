
export const DIAGRAMS = {
  en: {
    MERMAID_CODE: `
flowchart TD
    A["Event Trigger: User Activity"] --> B{"Sentinel AI Audit"}
    B -- "Valid" --> C["PoC Merit Pool"]
    B -- "Sybil" --> D["Reputation Penalty"]
    
    subgraph AdaptiveConsensus
        C --> E{"HVM-V2 Engine"}
        F["Staked CLAIM"] --> E
        G["Network Health Metrics"] --> E
    end
    
    E --> H["Final Consensus Weight"]
    H --> I["VRF Leader Election"]
    I --> J["Block Finalization"]
    `,
    HUB_INTEGRATION_DIAGRAM: `
flowchart LR
    H["Reputation Hub"] --> P["Merkle Proof"]
    P --> API["API Submission"]
    API --> S["Sentinel AI Analysis"]
    S --> L["L1 State Update"]
    L --> W["Reward Minting"]
    `,
    CLAIM_LIFECYCLE_DETAILED_CODE: `
flowchart TD
    User["User/App Activity"] --> Sub["Proof of Merit Submission"]
    
    subgraph ValidationLayer
        Sub --> Val{"V2 Validator"}
        Val --> Sentinel["AI Identity Audit"]
        Val --> Adaptive["Adaptive Weight Calculation"]
        Sentinel --> VRF["VRF Slot Selection"]
        Adaptive --> VRF
    end
    
    VRF --> Block["Block Commit"]
    Block --> Split{"60/40 Treasury Split"}
    
    Split --> Eco["Ecosystem Yield"]
    Split --> Team["Vesting"]
    `,
    MINDMAP_CODE: `
mindmap
  root((FaucetChain V3))
    Frontend (Vite/React)
      User Dashboard
        Address Tracker
        P2P Transfers
        Merit Portfolio
      AutoClaim Hub
        Web3 Login
        Staking Vault
      API Integration
        WebSocket Auto-Reconnect
        FastAPI Hooks
    Backend (FastAPI)
      Consensus Engine
        Dual PoC & PoS
        Hybrid Block Validation
      Sentinel AI V3
        Fraud Detection (Sybil)
        Rate Limiting (Per IP/Node)
      SQLite Database
        B-Tree Indexes (Optimized)
        Transactions Ledger
        Miners & Claims State
    Mining Node (Electron)
      Core Logic
        Heartbeats (Uptime)
        Epoch Rewards
      GUI Interface
        Real-time Logs
        Local Hardware Stats
    `,
    CLAIM_EVENT_DIAGRAM: `
sequenceDiagram
    participant U as "User/Node"
    participant C as "HVM-V2 Engine"
    participant S as "Sentinel AI"
    participant T as "Treasury"
    
    U->>C: Submit Verifiable Activity
    C->>S: Audit Merit Patterns
    S->>C: Return Reputation Delta
    C->>C: Calculate Hybrid Weight
    C->>T: Mint & Hedge Reward
    T->>U: Payout Merit Share
    `,
    TOKENOMICS_FLOW_CODE: `
flowchart LR
    A["Activity/Claims"] --> B{"HVM-V2 Protocol"}
    B --> C["Circulating Supply"]
    B --> D["Ecosystem Treasury"]
    D --> E["Stablecoin Yield"]
    E --> F["Treasury Reinvestment"]
    F --> B
    `,
    TREASURY_ALLOCATION_DIAGRAM: `
pie title "Macro Allocation (99M Hardcap)"
    "Proof of Work (Miners)" : 30
    "Proof of Stake (Vault)" : 30
    "Proof of Claim (Merit)" : 20
    "Core Team & Liquidity" : 20
    `
  },
  pt: {
    MERMAID_CODE: `
flowchart TD
    A["Gatilho: Atividade de Usuario"] --> B{"Auditoria IA Sentinel"}
    B -- "Valido" --> C["Pool de Merito PoC"]
    B -- "Sybil" --> D["Penalidade de Reputacao"]
    
    subgraph ModuladorAdaptativo
        C --> E{"Motor HVM-V2"}
        F["CLAIM em Stake"] --> E
        G["Metricas de Saude da Rede"] --> E
    end
    
    E --> H["Peso de Consenso Final"]
    H --> I["Eleicao de Lider VRF"]
    I --> J["Finalizacao do Bloco"]
    `,
    HUB_INTEGRATION_DIAGRAM: `
flowchart LR
    H["Hub de Reputacao"] --> P["Prova de Merkle"]
    P --> API["Submissao API"]
    API --> S["Analise IA Sentinel"]
    S --> L["Update de Estado L1"]
    L --> W["Mintagem de Recompensa"]
    `,
    CLAIM_LIFECYCLE_DETAILED_CODE: `
flowchart TD
    User["Atividade Usuario/App"] --> Sub["Submissao de Prova de Merito"]
    
    subgraph CamadaValidacao
        Sub --> Val{"V2 Validator"}
        Val --> Sentinel["Auditoria de Identidade IA"]
        Val --> Adaptive["Calculo de Peso Adaptativo"]
        Sentinel --> VRF["Selecao de Slot VRF"]
        Adaptive --> VRF
    end
    
    VRF --> Block["Commit do Bloco"]
    Block --> Split{"Divisao 60/40 Tesouro"}
    
    Split --> Eco["Yield de Ecossistema"]
    Split --> Team["Vesting"]
    `,
    CLAIM_EVENT_DIAGRAM: `
sequenceDiagram
    participant U as "Usuario/No"
    participant C as "Motor HVM-V2"
    participant S as "IA Sentinel"
    participant T as "Tesouro"
    
    U->>C: Submeter Atividade Verificavel
    C->>S: Auditar Padroes de Merito
    S->>C: Retornar Delta de Reputacao
    C->>C: Calcular Peso Hibrido
    C->>T: Mintar e Proteger Recompensa
    T->>U: Pagamento de Parcela de Merito
    `,
    TOKENOMICS_FLOW_CODE: `
flowchart LR
    A["Atividade/Claims"] --> B{"Protocolo HVM-V2"}
    B --> C["Suprimento Circulante"]
    B --> D["Tesouro do Ecossistema"]
    D --> E["Yield em Stablecoin"]
    E --> F["Reinvestimento no Tesouro"]
    F --> B
    `,
    MINDMAP_CODE: `
mindmap
  root((FaucetChain V3))
    Frontend (Vite/React)
      Dashboard do Usuario
        Address Tracker
        Transferencias P2P
        Portfolio de Merito
      AutoClaim Hub
        Login Web3
        Staking Vault
      Integracao API
        WebSocket Auto-Reconnect
        FastAPI Hooks
    Backend (FastAPI)
      Motor de Consenso
        PoC & PoS Hibrido
        Validacao de Blocos
      IA Sentinela V3
        Detecao de Fraudes
        Rate Limiting
      Banco de Dados SQLite
        Indices B-Tree (Otimizado)
        Ledger de Transacoes
        Miners e Claims
    No de Mineracao (Electron)
      Logica Principal
        Heartbeats (Uptime)
        Recompensas de Epoch
      Interface Grafica
        Logs em Tempo Real
        Status do Hardware
    `,
    TREASURY_ALLOCATION_DIAGRAM: `
pie title "Macro Alocação (Hardcap 99M)"
    "Proof of Work (Mineradores)" : 30
    "Proof of Stake (Cofre/Vault)" : 30
    "Proof of Claim (Mérito)" : 20
    "Core Team & Liquidez" : 20
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

export const SOLIDITY_CODE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FaucetChainV2Consensus {
    struct Validator { uint256 stake; uint256 merit; uint256 aiReputation; bool isEvolutionNode; }
    uint256 public alpha = 40; uint256 public beta = 40; uint256 public gamma = 20;

    function calculateVotingPower(address val) public view returns (uint256) {
        Validator memory v = validators[val];
        return (v.merit * alpha + v.stake * beta + v.aiReputation * gamma) / 100;
    }
}
`;

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
  consensus: "Adaptive Hybrid PoC+PoS"
  security_audit: "Sentinel AI Integrated"
`;

export const CORE_RUST_CODE = `
pub fn apply_block_transition(state: &mut WorldState, block: &Block, header: &BlockHeader) -> Result<(), StateError> {
    verify_vrf_proof(&header.vrf_proof, &header.proposer_pubkey)?;
    state.recalculate_adaptive_weights()?;
    Ok(())
}
`;

export const P2P_SPEC_CODE = `
pub fn create_swarm_config() -> SwarmConfig {
    let mut config = SwarmConfig::default();
    config.set_gossip_protocol(GossipProtocol::GossipsubV1_1);
    config
}
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
      desc: "L1 Hybrid Proof of Claim Consensus linked with an External PoS Yield Absorber strategy.",
      fixedSupplyTitle: "Immutable Supply Constraint",
      fixedSupplyDesc: "Fixed 99 Million CLAIM limit. Opt-in Burn only, operating natively at $0 Internal Gas Fees.",
      decayTitle: "Hourly Block Cycles",
      decayDesc: "Mining occurs hourly. If the epoch quota is exhausted, DApps stall and enter a hiatus until the next hour starts.",
      flowTitle: "PoS Yield Vault Architecture",
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
