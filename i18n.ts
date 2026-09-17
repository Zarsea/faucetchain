import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// ─── ENGLISH ─────────────────────────────────────────────────────────────
const resourcesEn = {
    translation: {
        header: {
            title: "FaucetChain Evolution V2",
        },
        tabs: {
            Dashboard: "Dashboard",
            BlockExplorer: "Block Explorer",
            AutoClaimHub: "AutoClaim Hub",
            AddressTracker: "Address Tracker",
            StakingVault: "Staking Vault",
            BountyBoard: "Bounty Board",
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
        wallet: {
            connect: "Connect Architect Wallet",
            searchPlaceholder: "Scan L1 Address (0x...)",
            reputation: "Sentinel V2 Score",
            staked: "Staked Capital V2",
            activity: "Merit Propagation",
            analysis: "Forensic AI Analysis",
            l1Explorer: "L1 Chain Explorer"
        },
        dashboard: {
            title: "My PoC Center",
            welcome: "Access Your Ecosystem",
            welcomeDesc: "Connect your wallet or social account to observe your merit portfolio, manage stakes and validate transactions on FaucetChain.",
            network: "Network",
            consensus: "Consensus",
            validateMerit: "Validate Merit (Faucet)",
            portfolio: "Asset Portfolio",
            nativeGas: "Native FaucetChain Gas",
            merit: "FaucetChain Merit",
            estimated: "Estimated Equivalent",
            p2p: "P2P Transfer",
            reputation: "Sentinel Reputation",
            reputationDesc: "Your score is based on validation frequency and node uptime.",
            myStaking: "My Staking (UTXO Vault)",
            watchedAddresses: "Watched Addresses",
            oracleMarket: "Real-Time Oracle Market",
            recentActivity: "Recent Ledger Activity",
            syncing: "Syncing Ledger...",
            sentinelAnalysis: "Sentinel AI Analysis"
        },
        walletExplorer: {
            title: "L1 Chain Explorer",
            desc: "Search any address to audit reputation, balances and on-chain activity on the FaucetChain ledger.",
            searchBtn: "Search",
            primaryAddress: "Primary Address",
            validator: "Validator",
            user: "User",
            totalBalance: "Total Balance",
            fromClaims: "From Claims",
            fromMining: "From Mining",
            transfersIn: "Transfers In",
            sentinelScore: "Sentinel Integrity Score",
            recentActivities: "Recent Ledger Activities",
            awaitingCommand: "Awaiting Command",
            awaitingDesc: "Input a wallet address above to initiate a deep-chain scan of the L1 ledger.",
            faucetChainNetwork: "FaucetChain Network",
            contract: "Contract"
        },
        staking: {
            vaultTitle: "UTXO Staking Vault",
            vaultDesc: "Connect your wallet to create staking positions with NFT Receipts (Synthetic UTXOs) and accumulate batch yield.",
            lockTier: "Lock Tier",
            claimAmount: "$CLAIM Amount",
            stakeBtn: "Lock",
            vaultGlobal: "Global Vault",
            tvl: "TVL",
            activeUtxos: "Active UTXOs",
            yieldPaid: "Yield Paid",
            spent: "Spent",
            statusApy: "Status APY",
            activePositions: "Active UTXO Positions (Coin Control)",
            spentPositions: "Spent UTXOs (History)",
            noUtxos: "No active UTXOs",
            createToGenerate: "Create a staking position to generate your first UTXO."
        },
        faucet: {
            title: "V2 Merit Faucet",
            desc: "Claim testnet merit to simulate participation in the HVM-V2 ecosystem.",
            cardTitle: "Request Merit Tokens",
            labelAddress: "L1 Wallet Address",
            btnClaim: "Mint 10.0 Merit CLAIM",
            btnProcessing: "Auditing via Sentinel...",
            txHash: "Consensus Hash:",
            testnetNote: "V2 test tokens are purely for architectural simulation."
        },
        tokenomics: {
            title: "Yield Economics",
            desc: "Understand the block reward mechanism, halving cycles, and the deflationary nature of the FaucetChain ecosystem.",
            fixedSupplyTitle: "Fixed Supply Cap",
            fixedSupplyDesc: "Hardcoded maximum limit of 99M CLAIM. Once reached, the network relies entirely on transaction fees to incentivize the nodes.",
            decayTitle: "Reward Halving",
            decayDesc: "Block rewards decrease by 50% every 2.1M blocks to increase scarcity over time and simulate synthetic inflation decay.",
            flowTitle: "Ecosystem Flow",
            distTitle: "Treasury Distribution",
            ecoFundTitle: "Ecosystem Fund (External Yield)",
            ecoFundDesc: "The 60% of block rewards are routed to yield-bearing vaults across other chains (DeFi) to back the value of CLAIM with real assets."
        },
        common: {
            loading: "Loading...",
            close: "Close",
            error: "Error",
            success: "Success",
            explainGemini: "Explain this with Gemini AI",
            scanning: "Scanning Blockchain..."
        },
        auth: {
            title: "Access FaucetChain TestNet",
            subtitle: "Choose your test identity.",
            guest: "Continue as guest",
            email: "Sign in with Email",
            wallet: "Connect MetaMask",
            nativeWeb3: "Native Web3",
            orPasteAddress: "Or paste your address",
            enter: "ENTER",
            emailPlaceholder: "Your Email",
            passwordPlaceholder: "Your Password",
            login: "Login",
            register: "Register",
            back: "Back",
            fillFields: "Fill all fields.",
            authError: "Authentication error",
            connError: "Connection error.",
            walletDenied: "Wallet connection failed: ",
            noMetamask: "MetaMask not detected! Please install the extension.",
            architectConnected: "Architect Connected"
        },
        widgets: {
            users: "Users",
            miners: "Miners",
            hubs: "Hubs",
            custom: "Custom",
            openTracker: "Open Address Tracker"
        },
        transfer: {
            destAddress: "Destination Address",
            amount: "Amount ($CLAIM)",
            processing: "Processing transfer...",
            connError: "Connection error with server.",
            transferBtn: "Transfer $CLAIM",
            success: "Success! TX: "
        },
        oracle: {
            badge: "Powered by Chainlink Oracle",
            querying: "Querying Oracle..."
        }
    }
};

// ─── PORTUGUESE ──────────────────────────────────────────────────────────
const resourcesPt = {
    translation: {
        header: {
            title: "FaucetChain Evolução V2",
        },
        tabs: {
            Dashboard: "Painel Principal",
            BlockExplorer: "Explorador de Blocos",
            AutoClaimHub: "Central PoC",
            AddressTracker: "Rastreador L1",
            StakingVault: "Vault de Staking",
            BountyBoard: "Quadro de Bounties",
            Overview: "Visão Geral V2",
            WalletExplorer: "Explorador L1",
            GeneralArticle: "Spec HVM-V2",
            NetworkStatus: "Pulso do Sistema",
            TechnicalSpecs: "Lógica de Evolução",
            SmartContract: "Contrato L1",
            AIModule: "Motor Sentinela",
            Simulation: "Lab de Consenso",
            Tokenomics: "Economia de Yield",
            Whitepaper: "Paper Evolutivo",
            Faucet: "Faucet de Mérito",
            APIDocs: "API de Hubs",
            AIAgent: "IA Agente Sentinela"
        },
        wallet: {
            connect: "Conectar Carteira",
            searchPlaceholder: "Escanear Endereço L1 (0x...)",
            reputation: "Score Sentinela V2",
            staked: "Capital em Stake V2",
            activity: "Propagação de Mérito",
            analysis: "Análise Forense de IA",
            l1Explorer: "Explorador de Rede L1"
        },
        dashboard: {
            title: "Minha Central PoC",
            welcome: "Acesse seu Ecossistema",
            welcomeDesc: "Conecte sua carteira ou conta social para observar seu portfólio de mérito, gerenciar stakes e validar transações na FaucetChain.",
            network: "Rede",
            consensus: "Consenso",
            validateMerit: "Validar Mérito (Faucet)",
            portfolio: "Portfólio de Ativos",
            nativeGas: "Native FaucetChain Gas",
            merit: "Mérito FaucetChain",
            estimated: "Equivalente Estimado",
            p2p: "Transferência P2P",
            reputation: "Reputação Sentinel",
            reputationDesc: "Sua pontuação é baseada na frequência de validações no Merit Faucet e uptime do seu nó local.",
            myStaking: "Meu Staking (UTXO Vault)",
            watchedAddresses: "Endereços Rastreados",
            oracleMarket: "Mercado Oracle em Tempo Real",
            recentActivity: "Atividade Recente no Ledger",
            syncing: "Sincronizando Ledger...",
            sentinelAnalysis: "Análise Sentinel AI"
        },
        walletExplorer: {
            title: "Explorador L1",
            desc: "Busque qualquer endereço para auditar reputação, saldos e atividade on-chain no ledger FaucetChain.",
            searchBtn: "Buscar",
            primaryAddress: "Endereço Principal",
            validator: "Validador",
            user: "Usuário",
            totalBalance: "Saldo Total",
            fromClaims: "De Claims",
            fromMining: "De Mineração",
            transfersIn: "Transferências",
            sentinelScore: "Score de Integridade Sentinela",
            recentActivities: "Atividades Recentes no Ledger",
            awaitingCommand: "Aguardando Comando",
            awaitingDesc: "Insira um endereço acima para iniciar um scan completo do ledger L1.",
            faucetChainNetwork: "Rede FaucetChain",
            contract: "Contrato"
        },
        staking: {
            vaultTitle: "Vault de Staking UTXO",
            vaultDesc: "Conecte sua carteira para criar posições de staking com NFT Receipts (UTXO sintéticos) e acumular yield por lote.",
            lockTier: "Nível de Bloqueio",
            claimAmount: "Quantidade $CLAIM",
            stakeBtn: "Travar",
            vaultGlobal: "Vault Global",
            tvl: "TVL",
            activeUtxos: "UTXOs Ativos",
            yieldPaid: "Yield Pago",
            spent: "Gastos",
            statusApy: "Status APY",
            activePositions: "Posições UTXO Ativas (Coin Control)",
            spentPositions: "UTXOs Gastos (Histórico)",
            noUtxos: "Nenhum UTXO ativo",
            createToGenerate: "Crie uma posição de staking ao lado para gerar seu primeiro UTXO."
        },
        faucet: {
            title: "Faucet de Mérito V2",
            desc: "Reivindique mérito de testnet para simular a participação no ecossistema HVM-V2.",
            cardTitle: "Solicitar Tokens de Mérito",
            labelAddress: "Endereço L1",
            btnClaim: "Mintar 10.0 CLAIM de Mérito",
            btnProcessing: "Auditando via Sentinela...",
            txHash: "Hash de Consenso:",
            testnetNote: "Tokens de teste V2 são puramente para simulação arquitetônica."
        },
        tokenomics: {
            title: "Economia de Yield",
            desc: "Entenda o mecanismo de recompensas de bloco, os ciclos de halving e a natureza deflacionária do ecossistema FaucetChain.",
            fixedSupplyTitle: "Limite Fixo de Emissão",
            fixedSupplyDesc: "Limite rígido de 99M de CLAIM. Após isso, a rede dependerá inteiramente de taxas de transação para incentivar os nós.",
            decayTitle: "Halving de Recompensa",
            decayDesc: "As recompensas por bloco diminuem 50% a cada 2.1M de blocos para aumentar a escassez e simular a queda sintética de inflação.",
            flowTitle: "Fluxo do Ecossistema",
            distTitle: "Distribuição da Tesouraria",
            ecoFundTitle: "Fundo de Ecossistema (Yield Externo)",
            ecoFundDesc: "60% das recompensas de bloco são direcionadas para vaults com rendimento em outras redes (DeFi) para lastrear o valor do CLAIM."
        },
        common: {
            loading: "Carregando...",
            close: "Fechar",
            error: "Erro",
            success: "Sucesso",
            explainGemini: "Explique isso com IA Gemini",
            scanning: "Analisando Blockchain..."
        },
        auth: {
            title: "Acessar FaucetChain TestNet",
            subtitle: "Escolha sua identidade de teste.",
            guest: "Entrar como convidado",
            email: "Entrar com E-mail",
            wallet: "Conectar MetaMask",
            nativeWeb3: "Web3 Nativo",
            orPasteAddress: "Ou cole seu endereço",
            enter: "ENTRAR",
            emailPlaceholder: "Seu E-mail",
            passwordPlaceholder: "Sua Senha",
            login: "Login",
            register: "Cadastrar",
            back: "Voltar",
            fillFields: "Preencha todos os campos.",
            authError: "Erro na autenticação",
            connError: "Erro de conexão.",
            walletDenied: "Falha ao conectar Carteira: ",
            noMetamask: "MetaMask não detectado! Por favor instale a extensão.",
            architectConnected: "Arquiteto Conectado"
        },
        widgets: {
            users: "Usuários",
            miners: "Miners",
            hubs: "Hubs",
            custom: "Custom",
            openTracker: "Abrir Address Tracker"
        },
        transfer: {
            destAddress: "Endereço de Destino",
            amount: "Quantidade ($CLAIM)",
            processing: "Processando transferência...",
            connError: "Erro de conexão com o servidor.",
            transferBtn: "Transferir $CLAIM",
            success: "Sucesso! TX: "
        },
        oracle: {
            badge: "Powered by Chainlink Oracle",
            querying: "Consultando Oracle..."
        }
    }
};

// ─── SPANISH ─────────────────────────────────────────────────────────────
const resourcesEs = {
    translation: {
        header: {
            title: "FaucetChain Evolución V2",
        },
        tabs: {
            Dashboard: "Panel Principal",
            BlockExplorer: "Explorador de Bloques",
            AutoClaimHub: "Central PoC",
            AddressTracker: "Rastreador L1",
            StakingVault: "Bóveda de Staking",
            BountyBoard: "Tablero de Bounties",
            Overview: "Visión General V2",
            WalletExplorer: "Explorador L1",
            GeneralArticle: "Espec HVM-V2",
            NetworkStatus: "Pulso del Sistema",
            TechnicalSpecs: "Lógica de Evolución",
            SmartContract: "Contrato L1",
            AIModule: "Motor Centinela",
            Simulation: "Lab de Consenso",
            Tokenomics: "Economía de Yield",
            Whitepaper: "Papel Evolutivo",
            Faucet: "Faucet de Mérito",
            APIDocs: "API de Hubs",
            AIAgent: "IA Agente Centinela"
        },
        wallet: {
            connect: "Conectar Billetera",
            searchPlaceholder: "Escanear Dirección L1 (0x...)",
            reputation: "Puntaje Centinela V2",
            staked: "Capital en Stake V2",
            activity: "Propagación de Mérito",
            analysis: "Análisis Forense de IA",
            l1Explorer: "Explorador de Red L1"
        },
        dashboard: {
            title: "Mi Centro PoC",
            welcome: "Accede a tu Ecosistema",
            welcomeDesc: "Conecte su billetera o cuenta social para observar su portafolio de mérito, administrar stakes y validar transacciones en FaucetChain.",
            network: "Red",
            consensus: "Consenso",
            validateMerit: "Validar Mérito (Faucet)",
            portfolio: "Portafolio de Activos",
            nativeGas: "Native FaucetChain Gas",
            merit: "Mérito FaucetChain",
            estimated: "Equivalente Estimado",
            p2p: "Transferencia P2P",
            reputation: "Reputación Sentinel",
            reputationDesc: "Su puntuación se basa en la frecuencia de validación en el Merit Faucet y el tiempo de actividad local del nodo.",
            myStaking: "Mi Staking (UTXO Vault)",
            watchedAddresses: "Direcciones Rastreadas",
            oracleMarket: "Mercado Oracle en Tiempo Real",
            recentActivity: "Actividad Reciente en Ledger",
            syncing: "Sincronizando Ledger...",
            sentinelAnalysis: "Análisis Sentinel AI"
        },
        walletExplorer: {
            title: "Explorador L1",
            desc: "Busque cualquier dirección para auditar reputación, saldos y actividad on-chain en el ledger FaucetChain.",
            searchBtn: "Buscar",
            primaryAddress: "Dirección Principal",
            validator: "Validador",
            user: "Usuario",
            totalBalance: "Saldo Total",
            fromClaims: "De Reclamos",
            fromMining: "De Minería",
            transfersIn: "Transferencias",
            sentinelScore: "Puntaje de Integridad Centinela",
            recentActivities: "Actividades Recientes en Ledger",
            awaitingCommand: "Esperando Comando",
            awaitingDesc: "Ingrese una dirección arriba para iniciar un escaneo completo del ledger L1.",
            faucetChainNetwork: "Red FaucetChain",
            contract: "Contrato"
        },
        staking: {
            vaultTitle: "Bóveda de Staking UTXO",
            vaultDesc: "Conecte su billetera para crear posiciones de staking con NFT Receipts (UTXO sintéticos) y acumular rendimiento por lote.",
            lockTier: "Nivel de Bloqueo",
            claimAmount: "Cantidad $CLAIM",
            stakeBtn: "Bloquear",
            vaultGlobal: "Bóveda Global",
            tvl: "TVL",
            activeUtxos: "UTXOs Activos",
            yieldPaid: "Rendimiento Pagado",
            spent: "Gastados",
            statusApy: "Estado APY",
            activePositions: "Posiciones UTXO Activas (Coin Control)",
            spentPositions: "UTXOs Gastados (Historial)",
            noUtxos: "Ningún UTXO activo",
            createToGenerate: "Cree una posición de staking para generar su primer UTXO."
        },
        faucet: {
            title: "Faucet de Mérito V2",
            desc: "Reclame mérito de testnet para simular la participación en el ecosistema HVM-V2.",
            cardTitle: "Solicitar Tokens de Mérito",
            labelAddress: "Dirección L1",
            btnClaim: "Acuñar 10.0 CLAIM de Mérito",
            btnProcessing: "Auditando vía Centinela...",
            txHash: "Hash de Consenso:",
            testnetNote: "Los tokens de prueba V2 son puramente para simulación arquitectónica."
        },
        tokenomics: {
            title: "Economía de Yield",
            desc: "Comprenda el mecanismo de recompensas por bloque, los ciclos de halving y la naturaleza deflacionaria del ecosistema FaucetChain.",
            fixedSupplyTitle: "Límite Fijo de Emisión",
            fixedSupplyDesc: "Límite codificado de 99M de CLAIM. Una vez alcanzado, la red depende completamente de las tarifas de transacción para incentivar los nodos.",
            decayTitle: "Halving de Recompensa",
            decayDesc: "Las recompensas por bloque se reducen un 50% cada 2.1M de bloques para aumentar la escasez y simular una inflación sintética en declive.",
            flowTitle: "Flujo del Ecosistema",
            distTitle: "Distribución del Tesoro",
            ecoFundTitle: "Fondo de Ecosistema (Rendimiento Externo)",
            ecoFundDesc: "El 60% de las recompensas por bloque se envían a bóvedas de rendimiento en otras redes (DeFi) para respaldar el valor de CLAIM."
        },
        common: {
            loading: "Cargando...",
            close: "Cerrar",
            error: "Error",
            success: "Éxito",
            explainGemini: "Explica esto con IA Gemini",
            scanning: "Analizando Blockchain..."
        },
        auth: {
            title: "Acceder a FaucetChain TestNet",
            subtitle: "Elija su identidad de prueba.",
            guest: "Entrar como invitado",
            email: "Iniciar con Email",
            wallet: "Conectar MetaMask",
            nativeWeb3: "Web3 Nativo",
            orPasteAddress: "O pegue su dirección",
            enter: "ENTRAR",
            emailPlaceholder: "Su Email",
            passwordPlaceholder: "Su Contraseña",
            login: "Iniciar Sesión",
            register: "Registrarse",
            back: "Volver",
            fillFields: "Llene todos los campos.",
            authError: "Error de autenticación",
            connError: "Error de conexión.",
            walletDenied: "Fallo al conectar billetera: ",
            noMetamask: "¡MetaMask no detectado! Por favor instale la extensión.",
            architectConnected: "Arquitecto Conectado"
        },
        widgets: {
            users: "Usuarios",
            miners: "Mineros",
            hubs: "Nodos",
            custom: "Custom",
            openTracker: "Abrir Address Tracker"
        },
        transfer: {
            destAddress: "Dirección de Destino",
            amount: "Cantidad ($CLAIM)",
            processing: "Procesando transferencia...",
            connError: "Error de conexión con el servidor.",
            transferBtn: "Transferir $CLAIM",
            success: "¡Éxito! TX: "
        },
        oracle: {
            badge: "Powered by Chainlink Oracle",
            querying: "Consultando Oracle..."
        }
    }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: resourcesEn,
      pt: resourcesPt,
      es: resourcesEs
    },
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
