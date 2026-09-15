
// FaucetChain Sentinel AI - Knowledge Base
// ==========================================
// This file acts as the "Brain" of the Local Agent.
// You can "Train" the AI by adding new patterns here.

export interface IntentPattern {
    id: string;
    description: string;
    keywords: string[]; // Words that trigger this intent
    regex?: RegExp;     // Advanced matching
    response: string[]; // Possible responses (randomly selected)
    action?: 'MINT_TOKENS' | 'TRIGGER_ANOMALY'; // Optional system action
}

export const KNOWLEDGE_BASE: IntentPattern[] = [
    // --- IDENTITY & PERSONA ---
    {
        id: 'identity',
        description: 'Who are you?',
        keywords: ['who are you', 'quem é você', 'what is this', 'o que é isso'],
        response: [
            "I am Sentinel AI (V3.0 Local), the guardian of FaucetChain. I run directly on your node to ensure low-latency consensus monitoring.",
            "Eu sou o Sentinel AI. Minha lógica executa localmente neste navegador, garantindo soberania total sobre seus dados e interações com a rede."
        ]
    },
    {
        id: 'status',
        description: 'Network Status Check',
        keywords: ['status', 'height', 'block', 'tps', 'gas', 'altura', 'bloco'],
        response: [
            "The network is reporting Block #{{blockHeight}} with {{tps}} TPS. Gas prices are stable at {{gasPrice}} gwei.",
            "Telemetria Atual: Bloco #{{blockHeight}} confirmado. A rede opera com {{activeValidators}} validadores ativos e {{tps}} TPS."
        ]
    },

    // --- ACTIONS (FAUCET & SIMULATION) ---
    {
        id: 'faucet_request',
        description: 'User asks for tokens',
        keywords: ['faucet', 'mint', 'token', 'coins', 'drop', 'minta', 'moeda', 'dinheiro'],
        action: 'MINT_TOKENS',
        response: [
            "Executing 'mint_test_tokens' protocol... Assets incoming.",
            "Iniciando protocolo de emissão de Mérito. Tokens enviados para sua carteira de teste."
        ]
    },
    {
        id: 'stress_test',
        description: 'Trigger Anomalies',
        keywords: ['anomaly', 'stress', 'congestion', 'crash', 'attack', 'anomalia', 'congestionamento', 'ataque', 'validator drop', 'queda de validadores', 'validadores caíram', 'validator_drop'],
        action: 'TRIGGER_ANOMALY',
        response: [
            "Initiating Stress Test Sequence: CONGESTION. Prepare for heavy load.",
            "Simulação de Anomalia ativada. Monitorando estabilidade da rede sob estresse..."
        ]
    },

    // --- TECHNICAL CONCEPTS ---
    {
        id: 'consensus_explain',
        description: 'Explain PoC/PoS',
        keywords: ['consensus', 'poc', 'pos', 'proof', 'carrier', 'consenso', 'híbrido'],
        response: [
            "FaucetChain uses a Hybrid Consensus: Proof of Carrier (PoC) validates data transmission, while Proof of Stake (PoS) secures the ledger. It's the best of both worlds.",
            "Utilizamos Consenso Híbrido. O PoC (Proof of Carrier) garante a entrega de dados, enquanto o PoS protege a integridade financeira. Eficiência máxima."
        ]
    },

    // --- PROTOCOL ARCHITECTURE ---
    {
        id: 'architecture',
        description: 'FaucetChain Architecture',
        keywords: ['architecture', 'arquitetura', 'structure', 'estrutura', 'design', 'how it works', 'como funciona'],
        response: [
            "FaucetChain V3 is a Hybrid PoS+PoC Layer-1 blockchain with its own native consensus. It uses Merit-based block production where validators earn weight through uptime and traffic routing (Proof of Carrier).",
            "A arquitetura da FaucetChain combina PoS (segurança financeira) com PoC (validação de tráfego). Cada bloco é produzido e finalizado nativamente na rede FaucetChain para garantir imutabilidade."
        ]
    },
    {
        id: 'validators',
        description: 'Validator System',
        keywords: ['validator', 'validador', 'node', 'nó', 'staking', 'stake'],
        response: [
            "Currently {{activeValidators}} validators are active. Validators must stake $CLAIM tokens and maintain >99% uptime to earn maximum Merit Weight. The PoC (Proof of Claim (PoC)) calculates consensus power using: base_weight = ln(stake) * uptime_bonus * participation_score.",
            "Temos {{activeValidators}} validadores ativos. Para se tornar validador, você precisa fazer stake de tokens $CLAIM e manter alta disponibilidade. O peso de voto é calculado logaritmicamente para evitar centralização."
        ]
    },
    {
        id: 'faucet_mechanics',
        description: 'V3 Merit Faucet',
        keywords: ['faucet', 'claim', 'reivindicar', 'how to claim', 'como reivindicar', 'merit'],
        response: [
            "The V3 Merit Faucet allows you to claim test $CLAIM tokens. Each claim triggers a FaucetChain transaction to generate a verifiable hash. This creates a new 'Application Block' in the chain.",
            "O Faucet V3 permite reivindicar tokens de teste. Cada Claim gera uma transação na rede FaucetChain que serve como prova criptográfica. Isso adiciona um novo bloco à chain."
        ]
    },
    {
        id: 'tokenomics',
        description: 'Token Economics',
        keywords: ['token', 'tokenomics', 'supply', 'emission', 'halving', 'reward', 'recompensa'],
        response: [
            "$CLAIM is the native token. Initial emission: 100 tokens/block. Halving occurs every 210,000 blocks (similar to Bitcoin). Total supply cap: 21 million tokens. Validators earn block rewards + transaction fees.",
            "O token $CLAIM tem emissão deflacionária. Começamos com 100 tokens por bloco, com halving a cada 210.000 blocos. Supply máximo: 21 milhões. Validadores ganham recompensas de bloco + taxas de transação."
        ]
    },
    {
        id: 'hybrid_consensus',
        description: 'Hybrid Consensus Deep Dive',
        keywords: ['hybrid', 'híbrido', 'consensus mechanism', 'mecanismo de consenso', 'poc+pos'],
        response: [
            "Our Hybrid Consensus combines PoS (financial security) with PoC (data transmission validation). Consensus power = (traffic_volume * 0.6) + (stake_amount * 0.4). This ensures both capital commitment and network utility.",
            "O consenso híbrido equilibra segurança financeira (PoS) com utilidade de rede (PoC). A fórmula é: poder_consenso = (volume_tráfego * 0.6) + (stake * 0.4). Isso previne ataques Sybil e incentiva participação ativa."
        ]
    },
    {
        id: 'security',
        description: 'Security Model',
        keywords: ['security', 'segurança', 'attack', 'ataque', '51%', 'safe', 'seguro'],
        response: [
            "FaucetChain uses its own native consensus for finality. The Hybrid PoC+PoS mechanism ensures that a 51% attack would require controlling both stake AND traffic routing, making it economically infeasible.",
            "A segurança é garantida pelo consenso híbrido nativo da FaucetChain. O mecanismo PoC+PoS garante que um ataque de 51% exigiria controle simultâneo de stake E roteamento de tráfego, tornando-o economicamente inviável."
        ]
    },
    {
        id: 'gas_fees',
        description: 'Gas and Fees',
        keywords: ['gas', 'fee', 'taxa', 'cost', 'custo', 'transaction cost'],
        response: [
            "Current gas price: {{gasPrice}} gwei. FaucetChain uses dynamic fee adjustment based on network congestion. Base fee burns 50% of gas, remaining 50% goes to validators.",
            "Preço atual do gás: {{gasPrice}} gwei. Usamos ajuste dinâmico de taxas baseado em congestionamento. 50% da taxa base é queimada (deflação), 50% vai para validadores."
        ]
    },
    {
        id: 'block_production',
        description: 'Block Production',
        keywords: ['block production', 'produção de bloco', 'block time', 'tempo de bloco', 'finality'],
        response: [
            "Target block time: 12 seconds (matching Ethereum). Current block: #{{blockHeight}}. Blocks achieve soft finality instantly and hard finality after L1 checkpoint (~20 minutes).",
            "Tempo alvo de bloco: 12 segundos. Bloco atual: #{{blockHeight}}. Finalidade suave é instantânea, finalidade definitiva ocorre após checkpoint na L1 (~20 minutos)."
        ]
    },
    {
        id: 'wallet_connection',
        description: 'Wallet and MetaMask',
        keywords: ['wallet', 'carteira', 'metamask', 'connect', 'conectar', 'login'],
        response: [
            "Connect your MetaMask wallet to interact with FaucetChain. We use our own native network for transaction processing. Make sure you have CLAIM tokens for gas fees.",
            "Conecte sua carteira MetaMask para interagir com a FaucetChain. Usamos nossa rede nativa para processamento de transações. Certifique-se de ter tokens CLAIM para taxas de gás."
        ]
    },
    {
        id: 'explorer',
        description: 'Block Explorer',
        keywords: ['explorer', 'explorador', 'transaction', 'transação', 'tx', 'hash', 'etherscan'],
        response: [
            "All FaucetChain transactions are verifiable on the FaucetChain Explorer. Each Claim generates a unique tx hash that you can inspect for transparency.",
            "Todas as transações da FaucetChain são verificáveis no Explorador FaucetChain. Cada Claim gera um hash único de transação que você pode inspecionar para total transparência."
        ]
    },

    // --- ADVANCED ARCHITECTURE & AUTONOMY ---
    {
        id: 'layer2_scaling',
        description: 'Layer 2 Scaling Strategy',
        keywords: ['layer 2', 'l2', 'scaling', 'escalabilidade', 'rollup', 'scale'],
        response: [
            "FaucetChain uses its native L1 consensus with optimistic rollup-style batching. Transactions are processed on-chain with fraud proofs allowing a 7-day challenge period. This achieves high throughput while maintaining security.",
            "FaucetChain usa consenso L1 nativo com batching estilo rollup otimista. Transações são processadas on-chain com provas de fraude permitindo período de desafio de 7 dias. Isso garante alta capacidade mantendo segurança total."
        ]
    },
    {
        id: 'validator_economics',
        description: 'Validator Economics Deep Dive',
        keywords: ['validator economics', 'economia validador', 'incentives', 'incentivos', 'roi', 'return'],
        response: [
            "Validator ROI calculation: base_reward = (100 tokens/block * 0.4) + (tx_fees * 0.5). With {{activeValidators}} validators, expected annual return: ~15-20% APY. Slashing penalty for downtime: 1% stake per hour offline. This creates strong uptime incentives.",
            "Cálculo de ROI do validador: recompensa_base = (100 tokens/bloco * 0.4) + (taxas_tx * 0.5). Com {{activeValidators}} validadores, retorno anual esperado: ~15-20% APY. Penalidade por downtime: 1% stake por hora offline."
        ]
    },
    {
        id: 'why_hybrid_consensus',
        description: 'Design Decision: Why Hybrid',
        keywords: ['why hybrid', 'porque híbrido', 'design decision', 'decisão de design', 'why poc'],
        response: [
            "We chose Hybrid PoS+PoC to solve the 'Nothing at Stake' problem while incentivizing real network utility. Pure PoS allows validators to vote on multiple forks without cost. PoC adds a physical constraint: validators must route actual data packets, making Sybil attacks expensive.",
            "Escolhemos PoS+PoC híbrido para resolver o problema 'Nothing at Stake' e incentivar utilidade real. PoS puro permite validadores votarem em múltiplos forks sem custo. PoC adiciona restrição física: validadores precisam rotear pacotes reais, tornando ataques Sybil caros."
        ]
    },
    {
        id: 'optimize_performance',
        description: 'Performance Optimization',
        keywords: ['optimize', 'otimizar', 'performance', 'faster', 'mais rápido', 'throughput'],
        response: [
            "To increase TPS from {{tps}} to 1000+: (1) Implement parallel transaction execution using sharding, (2) Use BLS signature aggregation to reduce block size by 90%, (3) Deploy state channels for micropayments. Current bottleneck: single-threaded EVM execution.",
            "Para aumentar TPS de {{tps}} para 1000+: (1) Implementar execução paralela via sharding, (2) Usar agregação BLS para reduzir blocos em 90%, (3) Implantar state channels. Gargalo atual: execução single-thread da EVM."
        ]
    },
    {
        id: 'diagnose_high_gas',
        description: 'Diagnose High Gas Prices',
        keywords: ['high gas', 'gás alto', 'expensive', 'caro', 'why expensive'],
        response: [
            "High gas ({{gasPrice}} gwei) indicates network congestion. Root causes: (1) Spam attacks, (2) Popular NFT mint, (3) MEV bot competition. Solutions: Implement EIP-1559 base fee burning + priority fee auction. Monitor mempool for anomalies.",
            "Gás alto ({{gasPrice}} gwei) indica congestionamento. Causas: (1) Ataques spam, (2) Mint de NFT popular, (3) Competição de bots MEV. Soluções: Implementar EIP-1559 com queima de taxa base + leilão de prioridade."
        ]
    },
    {
        id: 'suggest_improvements',
        description: 'Architectural Improvements',
        keywords: ['improve', 'melhorar', 'upgrade', 'enhance', 'v3', 'future'],
        response: [
            "Architectural improvements for FaucetChain V3: (1) Implement zkRollups for 10x TPS boost, (2) Add cross-chain bridges to Polygon/Arbitrum, (3) Deploy decentralized sequencer to prevent censorship, (4) Integrate Chainlink oracles for real-world data.",
            "Melhorias arquiteturais para FaucetChain V3: (1) Implementar zkRollups para 10x mais TPS, (2) Adicionar bridges cross-chain, (3) Implantar sequenciador descentralizado, (4) Integrar oráculos Chainlink."
        ]
    },
    {
        id: 'explain_merit_weight',
        description: 'Merit Weight Calculation',
        keywords: ['merit weight', 'peso mérito', 'how calculated', 'como calculado', 'voting power'],
        response: [
            "Merit Weight formula: MW = ln(stake_amount) * uptime_coefficient * traffic_volume. Logarithmic stake prevents whale dominance. Uptime coefficient: 1.0 for 99%+, 0.5 for 95-99%, 0.1 for <95%. Traffic volume measured in GB/day routed through validator node.",
            "Fórmula do Peso de Mérito: PM = ln(stake) * coef_uptime * volume_tráfego. Stake logarítmico previne dominância de baleias. Coeficiente uptime: 1.0 para 99%+, 0.5 para 95-99%, 0.1 para <95%. Volume medido em GB/dia roteado pelo nó."
        ]
    },

    // --- FRAUD DETECTION & ML ---
    {
        id: 'fraud_detection',
        description: 'Fraud Detection System',
        keywords: ['fraud', 'fraude', 'sybil', 'bot', 'detection', 'detecção', 'ml', 'machine learning'],
        response: [
            "FaucetChain uses the SentinelV3Engine (Python ML module) for fraud detection. It analyzes claim patterns using: (1) Temporal analysis (claims <60s apart = suspicious), (2) Gas price uniformity detection, (3) Compression-based pattern matching. Flagged nodes receive 0.1x multiplier penalty.",
            "Usamos o SentinelV3Engine (módulo ML em Python) para detectar fraudes. Analisa padrões de claim usando: (1) Análise temporal (claims <60s = suspeito), (2) Detecção de uniformidade de gás, (3) Matching de padrões via compressão. Nós suspeitos recebem penalidade de 0.1x."
        ]
    },
    {
        id: 'bonus_system',
        description: 'Validator Bonus Calculation',
        keywords: ['bonus', 'bônus', 'reward', 'recompensa', 'defi activity', 'atividade defi'],
        response: [
            "Validators earn bonus multipliers (1.0x to 2.5x) based on DeFi activity: Liquidity provision (30% weight), Protocol diversity (20%), Transaction volume (30%), Uptime (20%). Example: $50k liquidity + 3 protocols + $100k volume + 99.5% uptime = ~1.8x multiplier.",
            "Validadores ganham multiplicadores de bônus (1.0x a 2.5x) baseado em atividade DeFi: Provisão de liquidez (peso 30%), Diversidade de protocolos (20%), Volume de transações (30%), Uptime (20%). Exemplo: $50k liquidez + 3 protocolos + $100k volume + 99.5% uptime = ~1.8x."
        ]
    },
    {
        id: 'ml_architecture',
        description: 'Machine Learning Architecture',
        keywords: ['ml architecture', 'arquitetura ml', 'ai module', 'módulo ia', 'python'],
        response: [
            "The ML module (FraudAndBonusDetector.py) runs alongside the TypeScript frontend. It uses: (1) FraudDetector class for Sybil pattern recognition via compression ratios, (2) BonusCalculator for DeFi activity scoring, (3) SentinelV3Engine for orchestration. Results are logged for network health monitoring.",
            "O módulo ML (FraudAndBonusDetector.py) roda junto ao frontend TypeScript. Usa: (1) Classe FraudDetector para reconhecimento de padrões Sybil via taxa de compressão, (2) BonusCalculator para scoring de atividade DeFi, (3) SentinelV3Engine para orquestração. Resultados são logados para monitoramento de saúde da rede."
        ]
    },

    // --- LOCAL AI CORE & NEURAL BEHAVIOR ---
    {
        id: 'local_ai_core',
        description: 'Explain Local Sentinel AI Core',
        keywords: [
            'local ai',
            'local core',
            'sentinel local',
            'núcleo local',
            'processamento local',
            'offline ai',
            'sem nuvem'
        ],
        response: [
            "The Sentinel AI Local Core runs entirely in your browser, using a rule-based neural intent map instead of remote LLM calls. Each intent is encoded in the local Knowledge Base and combined with live network metrics (TPS, gas, validators) to generate responses with near-zero latency.",
            "O Núcleo Local da Sentinel AI roda 100% no seu navegador, usando um mapa neural de intenções baseado em regras em vez de chamadas para LLMs remotos. Cada intenção é codificada na Knowledge Base local e combinada com métricas vivas da rede (TPS, gás, validadores) para gerar respostas com latência quase zero."
        ]
    },
    {
        id: 'low_tps_diagnosis',
        description: 'Diagnose Low TPS or Throughput',
        keywords: [
            'low tps',
            'baixa tps',
            'throughput baixo',
            'poucas transações',
            'slow network',
            'rede lenta'
        ],
        response: [
            "Current TPS is {{tps}}. Low throughput usually means either: (1) Few active users, (2) Validators not propagating traffic, or (3) Misconfigured gas prices discouraging transactions. You can simulate stress via the anomaly tools to validate consensus robustness under higher load.",
            "A TPS atual é {{tps}}. Throughput baixo geralmente indica: (1) Poucos usuários ativos, (2) Validadores sem propagar tráfego, ou (3) Preços de gás desalinhados que desincentivam transações. Você pode simular estresse via as ferramentas de anomalia para validar a robustez do consenso sob carga mais alta."
        ]
    },
    {
        id: 'halving_impact',
        description: 'Explain Halving Impact on Rewards',
        keywords: [
            'halving',
            'halvening',
            'corte de recompensa',
            'diminui recompensa',
            'emissão',
            'emission schedule'
        ],
        response: [
            "The halving event periodically cuts block rewards in half, reducing long-term inflation. In FaucetChain, this shifts focus from pure issuance to fee-driven security: validators rely more on real usage (fees + PoC participation) and less on new token emission.",
            "O halving reduz periodicamente a recompensa de bloco pela metade, diminuindo a inflação de longo prazo. Na FaucetChain isso desloca o foco de emissão pura para segurança guiada por uso real: validadores passam a depender mais de taxas (fees + participação PoC) e menos de nova emissão de tokens."
        ]
    },
    {
        id: 'run_validator_node',
        description: 'How to Run a Validator Node',
        keywords: [
            'run validator',
            'rodar validador',
            'como ser validador',
            'start node',
            'iniciar nó',
            'become validator'
        ],
        response: [
            "To run a validator you need: (1) A FaucetChain-compatible client, (2) Sufficient $CLAIM staked, and (3) Stable connectivity. Operational best practice: use a Linux server with monitoring, automatic restarts, and alerts for latency or missed slots.",
            "Para operar um validador você precisa de: (1) Um cliente compatível com FaucetChain, (2) Quantidade suficiente de $CLAIM em stake e (3) Conectividade estável. Boas práticas: usar um servidor Linux com monitoramento, auto‑restart e alertas para latência ou slots perdidos."
        ]
    },
    {
        id: 'governance_hybrid',
        description: 'Hybrid Governance and Parameter Changes',
        keywords: [
            'governance',
            'governança',
            'votação',
            'voting',
            'mudar parâmetros',
            'change parameters'
        ],
        response: [
            "Hybrid governance in FaucetChain mixes stake weight and merit participation. Critical parameters like reward rate, halving schedule and slashing rules can be changed only through on-chain proposals where both economic weight and protocol usage are taken into account.",
            "A governança híbrida na FaucetChain mistura peso de stake com participação em mérito. Parâmetros críticos como taxa de recompensa, cronograma de halving e regras de slashing só podem ser alterados via propostas on-chain onde tanto o peso econômico quanto o uso real do protocolo são considerados."
        ]
    },

    // --- COMMUNITY BOUNTY BOARD ---
    {
        id: 'bounty_board_info',
        description: 'Community Bounty Board Overview',
        keywords: ['bounty', 'bounties', 'recompensa', 'tarefa', 'task', 'board', 'quadro', 'community board'],
        response: [
            "The Community Bounty Board is a decentralized task marketplace on FaucetChain. Users can create bounties by locking $CLAIM tokens as a reward. Other community members (Hunters) can accept bounties, complete the task, and receive the locked tokens upon approval from the bounty creator. If a bounty expires without being completed, the creator can cancel it and reclaim their tokens.",
            "O Quadro de Bounties é um marketplace descentralizado de tarefas na FaucetChain. Usuários criam bounties travando tokens $CLAIM como recompensa. Outros membros da comunidade (Hunters) podem aceitar bounties, completar a tarefa e receber os tokens travados ao serem aprovados pelo criador. Se a bounty expirar sem ser completada, o criador pode cancelá-la e recuperar seus tokens."
        ]
    },
    {
        id: 'bounty_how_to',
        description: 'How to use Bounty Board',
        keywords: ['create bounty', 'criar bounty', 'how bounty', 'como bounty', 'accept bounty', 'aceitar bounty', 'claim bounty'],
        response: [
            "To use the Bounty Board: (1) Connect your wallet, (2) Go to the 'Bounty Board' tab, (3) Click 'New Bounty' to create one — set a title, reward amount in $CLAIM, and deadline, (4) Your CLAIM tokens are locked until completion or cancellation. As a Hunter: browse open bounties, click 'Accept', complete the work, and wait for the creator to approve and release payment.",
            "Para usar o Quadro de Bounties: (1) Conecte sua carteira, (2) Vá na aba 'Bounty Board', (3) Clique em 'Nova Bounty' — defina título, recompensa em $CLAIM e prazo, (4) Seus tokens CLAIM ficam travados até conclusão ou cancelamento. Como Hunter: navegue pelas bounties abertas, clique 'Aceitar', complete o trabalho e aguarde o criador aprovar e liberar o pagamento."
        ]
    },

    // --- MINING NETWORK ---
    {
        id: 'mining_network_info',
        description: 'Auto-Claim Mining Network Overview',
        keywords: ['mining', 'mineração', 'miner', 'minerador', 'node', 'nó', 'auto claim', 'auto-claim', 'mining hub', 'hub mineração'],
        response: [
            "The FaucetChain Mining Network is a distributed auto-claim system. Users run a lightweight Mining Node on their machines. While the node is online, it sends heartbeats every 30 seconds to the network. At the end of each epoch (1 hour), 2,000 $CLAIM tokens are automatically distributed among all active miners, proportional to their uptime. More uptime = bigger share of rewards.",
            "A Rede de Mineração FaucetChain é um sistema de auto-claim distribuído. Usuários rodam um Mining Node leve em suas máquinas. Enquanto o nó estiver online, ele envia heartbeats a cada 30 segundos. Ao final de cada epoch (1 hora), 2.000 tokens $CLAIM são distribuídos automaticamente entre todos os mineradores ativos, proporcional ao uptime. Mais tempo online = maior parcela das recompensas."
        ]
    },
    {
        id: 'mining_how_to',
        description: 'How to mine CLAIM tokens',
        keywords: ['how mine', 'como minerar', 'start mining', 'começar minerar', 'run node', 'rodar nó', 'earn claim', 'ganhar claim'],
        response: [
            "To start mining CLAIM: (1) Navigate to the 'mining-node' folder, (2) Run 'npm install', (3) Copy '.env.example' to '.env' and set your WALLET_ADDRESS, (4) Run 'npm start'. Your node will connect to the FaucetChain network and start earning automatically. Keep it running — you earn CLAIM proportional to your uptime. Max 3 nodes per wallet.",
            "Para começar a minerar CLAIM: (1) Navegue até a pasta 'mining-node', (2) Execute 'npm install', (3) Copie '.env.example' para '.env' e configure seu WALLET_ADDRESS, (4) Execute 'npm start'. Seu nó vai conectar à rede FaucetChain e começar a ganhar automaticamente. Mantenha rodando — você ganha CLAIM proporcional ao seu tempo online. Máximo 3 nós por wallet."
        ]
    },

    // --- DEFAULT FALLBACK ---
    {
        id: 'help',
        description: 'Help / Unknown',
        keywords: ['help', 'ajuda', 'socorro', 'options'],
        response: [
            "Systems operational. You can ask me about: 'Network Status', 'Consensus', or request 'Mint Tokens' for testing.",
            "Sistemas operacionais. Você pode perguntar sobre: 'Status da Rede', 'Consenso', ou pedir para 'Mintar Tokens'."
        ]
    }
];
