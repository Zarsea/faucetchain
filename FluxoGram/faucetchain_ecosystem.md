# 🌐 FaucetChain — Fluxograma do Ecossistema Completo

## Visão Geral da Arquitetura

A FaucetChain é uma blockchain Layer 1 local com consenso híbrido **PoC + PoS** (Proof of Claim + Proof of Stake). O ecossistema é composto por **4 camadas principais**:

| Camada | Tecnologia | Porta |
|---|---|---|
| 🖥️ Frontend (DApp) | React + Vite | `:5173` |
| ⚙️ Backend API | FastAPI + Uvicorn | `:8000` |
| ⛏️ Mining Node | Node.js CLI/Electron | — |
| 🔗 Smart Contracts | Solidity (Hardhat) | `:8545` |

---

## 1. Arquitetura de Serviços (Macro)

```mermaid
graph TB
    subgraph "👤 Usuário"
        Browser["🌐 Navegador"]
        MetaMask["🦊 MetaMask"]
    end

    subgraph "🖥️ Frontend — React/Vite :5173"
        App["App.tsx"]
        AuthCtx["AuthContext"]
        NetCtx["NetworkContext"]
        LangCtx["LanguageContext"]

        subgraph "📄 16 Módulos UI"
            Dashboard["UserDashboard"]
            MiningHub["AutoClaim Hub"]
            Tracker["Address Tracker"]
            Staking["Staking Vault"]
            Bounty["Bounty Board"]
            Faucet["Merit Faucet"]
            Explorer["Wallet Explorer"]
            NetStatus["Network Status"]
            AIAgent["AI Chat Agent"]
            Tokenomics["Tokenomics"]
            Whitepaper["Whitepaper"]
            TechSpecs["Technical Specs"]
            ApiDocs["API Docs"]
            CodeViewer["Code Viewer"]
            Article["General Article"]
            Sentinel["Network Sentinel"]
        end
    end

    subgraph "⚙️ Backend — FastAPI :8000"
        API["api_server.py<br/>2553 linhas"]
        SQLite["blockchain.db<br/>~3.7 GB"]
        VectorDB["ChromaDB<br/>knowledge_db/"]
        FraudEngine["FraudDetector<br/>Sentinel V3"]
        EpochSched["Epoch Scheduler<br/>Async Task"]
        WSManager["WebSocket<br/>Manager"]
    end

    subgraph "⛏️ Mining Node"
        MinerCore["miner-core.js"]
        MinerCLI["index.js<br/>CLI Interface"]
        ElectronApp["Electron GUI<br/>app/"]
    end

    subgraph "🔗 Hardhat Node :8545"
        HHNode["Hardhat Network"]
        Contracts["8 Smart Contracts"]
    end

    subgraph "🌍 Serviços Externos"
        Gemini["Google Gemini AI"]
        CryptoCompare["CryptoCompare API"]
        HuggingFace["HuggingFace<br/>SentenceTransformers"]
    end

    Browser --> App
    MetaMask --> App
    App --> API
    App --> WSManager
    MinerCLI --> API
    MinerCore --> MinerCLI
    ElectronApp --> MinerCore
    API --> SQLite
    API --> VectorDB
    API --> FraudEngine
    API --> Gemini
    App --> CryptoCompare
    VectorDB --> HuggingFace
    EpochSched --> SQLite
    WSManager --> Browser
```

---

## 2. Fluxo de Dados Completo

```mermaid
flowchart LR
    subgraph "ENTRADA"
        U["👤 Usuário"]
        M["⛏️ Minerador"]
    end

    subgraph "PROCESSAMENTO"
        direction TB
        CLAIM["POST /api/claim"]
        EXPLORE["POST /api/mining/explore"]
        HEARTBEAT["POST /api/mining/heartbeat"]
        TRANSFER["POST /api/transfer"]
        STAKE["POST /api/staking/stake"]
        UNSTAKE["POST /api/staking/unstake"]
        BOUNTY_C["POST /api/bounties/create"]
    end

    subgraph "VALIDAÇÃO"
        RateLimit["Rate Limiter"]
        Nonce["Nonce Check"]
        Sig["Signature Verify"]
        Balance["Balance Check"]
        Fraud["Fraud Detector"]
        Cooldown["Cooldown 1h"]
    end

    subgraph "PERSISTÊNCIA"
        DB[("blockchain.db")]
        Tables["blocks | transactions<br/>user_claims | pending_claims<br/>mining_rewards | active_miners<br/>staking_positions | bounties<br/>tracked_addresses | users<br/>account_nonces | epoch_roots"]
    end

    subgraph "SAÍDA"
        WS["WebSocket Broadcast"]
        REST["REST Response"]
        EPOCH["Epoch Rewards<br/>2000 CLAIM/h"]
    end

    U --> CLAIM & TRANSFER & STAKE & UNSTAKE & BOUNTY_C
    M --> EXPLORE & HEARTBEAT

    CLAIM --> Cooldown --> Fraud --> DB
    TRANSFER --> Nonce --> Sig --> Balance --> DB
    STAKE --> Balance --> DB
    EXPLORE --> DB
    HEARTBEAT --> RateLimit --> DB

    DB --> Tables
    DB --> WS --> U
    DB --> REST --> U
    DB --> EPOCH --> M
```

---

## 3. Ciclo de Vida do Consenso (PoC + PoS)

```mermaid
sequenceDiagram
    participant U as 👤 Usuário
    participant API as ⚙️ FastAPI
    participant DB as 💾 SQLite
    participant Miner as ⛏️ Mining Node
    participant Sched as ⏰ Epoch Scheduler

    Note over U,Sched: === FASE 1: CLAIM (Proof of Claim) ===
    U->>API: POST /api/claim (address, amount)
    API->>DB: Cooldown check (1h)
    API->>DB: Fraud Detection (Sybil patterns)
    API->>DB: INSERT pending_claims (status=pending)
    API-->>U: {status: "pending", tx_hash}

    Note over U,Sched: === FASE 2: MINERAÇÃO (Explore) ===
    loop A cada 5 segundos
        Miner->>API: POST /api/mining/explore
        API->>DB: SELECT pending_claims LIMIT 1
        alt Claim Pendente Encontrado
            API->>DB: Cria bloco (blocks table)
            API->>DB: 80% reward → user_claims
            API->>DB: 20% fee → mining_rewards
            API->>DB: INSERT transactions (2x)
            API->>DB: DELETE pending_claims
            API-->>Miner: {explored: true, miner_fee}
        else Sem Claims Pendentes
            API-->>Miner: {explored: false}
        end
    end

    Note over U,Sched: === FASE 3: HEARTBEAT (Proof of Stake/Presence) ===
    loop A cada 30 segundos
        Miner->>API: POST /api/mining/heartbeat
        API->>DB: UPDATE uptime, cpu, memory
        API-->>Miner: {total_uptime, total_earned}
    end

    Note over U,Sched: === FASE 4: EPOCH DISTRIBUTION ===
    loop A cada 1 hora
        Sched->>DB: SELECT active_miners (online, uptime > 0)
        Sched->>DB: Calcula share proporcional ao uptime
        Sched->>DB: INSERT mining_rewards (2000 CLAIM total)
        Sched->>DB: UPDATE total_earned, reset epoch_uptime
    end
```

---

## 4. Estrutura do Banco de Dados

```mermaid
erDiagram
    blocks {
        int height PK
        text hash UK
        text parent_hash
        text validator
        int tx_count
        int timestamp
        int gas_used
        int gas_limit
        real reward
    }

    transactions {
        text hash PK
        int block_height FK
        text from_address
        text to_address
        real value
        int gas_price
        int timestamp
        text tx_type
        text source_platform
    }

    user_claims {
        int id PK
        text user_address
        real amount
        int timestamp
        text tx_hash
        int block_height
        text source_platform
    }

    pending_claims {
        int id PK
        text user_address
        real amount
        int timestamp
        text tx_hash
        int block_height
        text status
        text source_platform
    }

    active_miners {
        text node_id PK
        text wallet_address
        text node_name
        int registered_at
        int last_heartbeat
        int total_uptime_seconds
        int epoch_uptime_seconds
        real total_earned
        int epochs_active
        int is_online
        real cpu_load
        real memory_free
    }

    mining_rewards {
        int id PK
        int epoch_id
        text wallet_address
        text node_id
        real reward_amount
        real uptime_share
        int distributed_at
    }

    staking_positions {
        int token_id PK
        text staker_address
        real deposit_amount
        int deposit_timestamp
        int lock_duration
        int yield_basis_points
        int tier
        int is_spent
        int spent_timestamp
        real yield_paid
    }

    bounties {
        int id PK
        text creator_address
        text hunter_address
        text title
        text description
        real reward
        int created_at
        int deadline
        text status
        int completed_at
    }

    users {
        int id PK
        text email UK
        text password_hash
        text wallet_address UK
        int created_at
    }

    tracked_addresses {
        int id PK
        text address UK
        text label
        text category
        text notes
        int added_at
    }

    account_nonces {
        text address PK
        int nonce
    }

    epoch_roots {
        int epoch_id PK
        int epoch_size PK
        int start_height
        int end_height
        text root
        int leaf_count
        int updated_at
    }

    blocks ||--o{ transactions : "contém"
    transactions }o--|| user_claims : "referencia"
    active_miners ||--o{ mining_rewards : "ganha"
    staking_positions }o--|| transactions : "debita/credita"
```

---

## 5. Smart Contracts (Solidity — Hardhat :8545)

```mermaid
graph TB
    subgraph "📜 8 Contratos Solidity"
        Token["FaucetToken_CLAIM.sol<br/>ERC-20 Token<br/>Supply: 99M hard cap"]
        Vault["UTXOStakingVault.sol<br/>UTXO-Based Staking<br/>3 Tiers com Timelock"]
        Yield["YieldAccumulatorVault.sol<br/>Yield Distribution"]
        AutoClaim["AutoClaimDistributor.sol<br/>Distribuição Automática"]
        Epoch["HourlyEpochManager.sol<br/>Gestão de Épocas 1h"]
        Registry["HubRegistryRoots.sol<br/>Merkle Root Anchoring"]
        Bounty["CommunityBountyBoard.sol<br/>Sistema de Recompensas"]
        DApp["DAppStakingRegistry.sol<br/>Registro de DApps"]
    end

    Token --> Vault
    Token --> AutoClaim
    Vault --> Yield
    AutoClaim --> Epoch
    Epoch --> Registry
    Token --> Bounty
    DApp --> Vault

    style Token fill:#f9a825,stroke:#f57f17,color:#000
    style Vault fill:#4fc3f7,stroke:#0288d1,color:#000
    style Registry fill:#ce93d8,stroke:#7b1fa2,color:#000
```

---

## 6. Camada de IA e Segurança

```mermaid
graph LR
    subgraph "🧠 Inteligência Artificial"
        GeminiBackend["Gemini API<br/>(Backend Python)"]
        GeminiFrontend["Gemini GenAI<br/>(Frontend TS)"]
        OracleService["Oracle Service<br/>CryptoCompare"]
        LocalAI["LocalIntelligence.ts<br/>Rule-Based Fallback"]
        HybridAI["HybridIntelligence.ts<br/>Local + API Merge"]
        KnowledgeBase["KnowledgeBase.ts<br/>26K lines, Embedded"]
    end

    subgraph "🛡️ Segurança"
        FraudDetect["FraudDetector<br/>Sybil Pattern Analysis"]
        BonusCalc["BonusCalculator<br/>DeFi Multiplier"]
        SentinelV3["SentinelV3Engine<br/>Audit + Absorb Chain"]
        VectorDB["ChromaDB<br/>Semantic Search"]
        RateLimit["Rate Limiting<br/>100 req/min"]
        InputSanit["Input Sanitization<br/>SQL + XSS"]
        SigVerify["EIP-191 Signature<br/>Verification"]
        NonceReplay["Nonce + Chain ID<br/>Replay Protection"]
    end

    GeminiBackend --> SentinelV3
    GeminiFrontend --> HybridAI
    HybridAI --> LocalAI
    HybridAI --> KnowledgeBase
    OracleService --> GeminiFrontend
    SentinelV3 --> FraudDetect
    SentinelV3 --> BonusCalc
    SentinelV3 --> VectorDB
    RateLimit --> InputSanit --> SigVerify --> NonceReplay
```

---

## 7. Mapa Completo de API Endpoints

### Core
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/blocks` | Blocos recentes |
| `GET` | `/api/tx/{hash}` | Detalhes de transação |
| `GET` | `/api/network-metrics` | Métricas da rede |
| `WS` | `/ws/network` | Blocos em tempo real |

### Faucet & Claims
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/claim` | Submeter claim |
| `GET` | `/api/claim/status/{hash}` | Status do claim |
| `GET` | `/api/user/{addr}/claims` | Histórico de claims |
| `GET` | `/api/user/{addr}/balance` | Saldo agregado |

### Transfers (Assinado)
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/transfer` | Transferir $CLAIM (assinado) |
| `GET` | `/api/user/{addr}/nonce` | Nonce atual |
| `GET` | `/api/address/{addr}/transactions` | Histórico TXs |

### Mining
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/mining/register` | Registrar nó |
| `POST` | `/api/mining/heartbeat` | Heartbeat |
| `POST` | `/api/mining/explore` | Explorar claims pendentes |
| `POST` | `/api/mining/disconnect` | Desconectar nó |
| `POST` | `/api/mining/distribute-epoch` | Distribuir epoch manual |
| `GET` | `/api/mining/stats` | Estatísticas globais |
| `GET` | `/api/mining/leaderboard` | Top mineradores |
| `GET` | `/api/mining/node/{addr}` | Info do nó |
| `GET` | `/api/mining/rewards/{addr}` | Rewards do minerador |

### Staking Vault
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/staking/stake` | Criar posição UTXO |
| `POST` | `/api/staking/unstake` | Resgatar UTXO |
| `GET` | `/api/staking/positions/{addr}` | Posições do usuário |
| `GET` | `/api/staking/stats` | Stats do vault |

### Bounty Board
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/bounties/create` | Criar bounty |
| `POST` | `/api/bounties/{id}/claim` | Aceitar bounty |
| `POST` | `/api/bounties/{id}/approve` | Aprovar bounty |
| `POST` | `/api/bounties/{id}/cancel` | Cancelar bounty |
| `GET` | `/api/bounties/list` | Listar bounties |
| `GET` | `/api/bounties/user/{addr}` | Bounties do usuário |
| `GET` | `/api/bounties/stats` | Stats do board |

### Address Tracker
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/tracker/addresses` | Listar watchlist |
| `POST` | `/api/tracker/addresses` | Adicionar endereço |
| `DELETE` | `/api/tracker/addresses/{addr}` | Remover endereço |
| `GET` | `/api/tracker/addresses/{addr}/activity` | Atividade completa |
| `GET` | `/api/tracker/summary` | Resumo por categoria |

### Auth
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/register` | Registro (email + wallet custodial) |
| `POST` | `/api/auth/login` | Login |

### AI & Knowledge
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/ai/sentinel` | Sentinel AI (Gemini + L1 Data) |
| `POST` | `/api/vector-search` | Busca semântica |
| `POST` | `/api/add-document` | Adicionar documento ao KB |

### Merkle Proofs
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/epoch/{id}/root` | Merkle root do epoch |
| `GET` | `/api/blocks/{height}/merkle-proof` | Prova de inclusão |

### L1 V3 State
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/epoch/status` | Status do epoch atual |
| `GET` | `/api/vault/yield` | Yield do vault externo |
| `GET` | `/api/faucets/staked` | DApps com stake |

---

## 8. Fluxo de Autenticação

```mermaid
flowchart TB
    User["👤 Usuário"]
    
    User --> Choice{Método de Login}
    
    Choice -->|MetaMask| MM["🦊 Connect Wallet"]
    MM --> EIP191["EIP-191 Sign Message"]
    EIP191 --> AuthCtx["AuthContext<br/>setUser(address)"]
    
    Choice -->|Email| Register["📧 /api/auth/register"]
    Register --> CustodialWallet["Gera Wallet Custodial<br/>0x + random 20 bytes"]
    CustodialWallet --> AuthCtx
    
    Choice -->|Manual| Manual["📝 Inserir Endereço"]
    Manual --> AuthCtx
    
    AuthCtx --> Dashboard["🏠 UserDashboard"]
    Dashboard --> AllFeatures["Todas as funcionalidades<br/>Claim, Stake, Transfer, etc."]
```

---

## 9. Fórmula de Saldo

```
Balance = claims_total + mining_total + incoming_transfers - outgoing_transfers
```

Onde:
- **claims_total** = `SUM(user_claims.amount)` — Merit Faucet claims
- **mining_total** = `SUM(mining_rewards.reward_amount)` — Epoch rewards
- **incoming_transfers** = `SUM(transactions.value) WHERE to_address = user` — Inclui unstake payouts
- **outgoing_transfers** = `SUM(transactions.value) WHERE from_address = user` — Inclui stake locks

> [!IMPORTANT]
> O staking debita via `transactions` (from=user, to=VAULT) e credita no unstake (from=VAULT, to=user), mantendo o saldo integrado sem duplicação.

---

## 10. Tiers de Staking

| Tier | Duração | Yield (Basis Points) | Yield Efetivo |
|---|---|---|---|
| 0 — Curto | 1 hora | 50 bp | 0.50% |
| 1 — Médio | 24 horas | 200 bp | 2.00% |
| 2 — Longo | 7 dias | 1000 bp | 10.00% |

---

## 11. Stack Tecnológico Resumido

```mermaid
mindmap
  root((FaucetChain))
    Frontend
      React 19
      Vite 6
      TypeScript
      Recharts
      Mermaid.js
      i18next (PT/EN/ES)
      ethers.js
    Backend
      FastAPI
      Uvicorn
      SQLite (WAL mode)
      Pydantic
      eth-account
    IA
      Google Gemini 3
      ChromaDB
      SentenceTransformers
      Fraud Detector ML
    Blockchain
      Hardhat 3
      Solidity
      ERC-20
      UTXO Staking
      Merkle Trees
    Mining
      Node.js
      Electron
      EventEmitter
      Heartbeat/Epoch
    Oracle
      CryptoCompare API
      60s Cache TTL
      Mock Fallback
```
