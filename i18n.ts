import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// ─── ENGLISH ─────────────────────────────────────────────────────────────
const resourcesEn = {
    translation: {
        header: {
            title: "FaucetChain",
        },
        navGroups: {
            settlement: "Settlement",
            earn: "Earn",
            operate: "Operate",
            explore: "Explore",
            reference: "Reference"
        },
        tabs: {
            SolanaPayouts: "Solana Payouts",
            SettlementLedger: "Settlement Ledger",
            InfraMonitor: "Infra Monitor",
            Dashboard: "Dashboard",
            ConnectaFaucet: "Connect a Faucet",
            BlockExplorer: "Block Explorer",
            AutoClaimHub: "AutoClaim Hub",
            AddressTracker: "Address Tracker",
            StakingVault: "Staking Vault",
            BountyBoard: "Bounty Board",
            Overview: "Overview",
            WalletExplorer: "Wallet Explorer",
            GeneralArticle: "Settlement Architecture",
            NetworkStatus: "Network Status",
            TechnicalSpecs: "Technical Specs",
            SmartContract: "Solana Program",
            AIModule: "Sentinel Engine",
            Simulation: "Consensus Lab",
            Tokenomics: "Tokenomics",
            Whitepaper: "Whitepaper",
            Faucet: "Merit Faucet",
            APIDocs: "FaucetHub API",
            AIAgent: "Ask Sentinel"
        },
        wallet: {
            connect: "Connect Wallet",
            searchPlaceholder: "Scan L1 Address (0x...)",
            reputation: "Sentinel Score",
            staked: "Staked Capital",
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
            pendingTitle: "Waiting to be sealed",
            pendingSealing: "Your proof was accepted and the claim is queued. A node has to close the block before it reaches your balance.",
            pendingNoSealer: "Your proof was accepted, but no node is online to seal it. The amount is safe and lands as soon as one is.",
            lockedTitle: "Locked as faucet reserve",
            lockedBody: "This is not in the balance above. It sits in the FaucetChain treasury and pays your faucet's users when they withdraw. Lower it in FaucetHub, but never below what those users are already owed.",
            claimNoPrice: "$CLAIM has no market price. It is the internal unit this network uses to measure work; what carries value to you is the campaign token, which somebody else issued.",
            p2p: "P2P Transfer",
            reputation: "Sentinel Reputation",
            reputationDesc: "Your score is based on validation frequency and node uptime.",
            myStaking: "My Staking (UTXO Vault)",
            watchedAddresses: "Watched Addresses",
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
            title: "Merit Faucet",
            desc: "Claim testnet merit to try the flow this network runs on.",
            cardTitle: "Request Merit Tokens",
            labelAddress: "L1 Wallet Address",
            btnClaim: "Mint 10.0 Merit CLAIM",
            btnProcessing: "Auditing via Sentinel...",
            txHash: "Consensus Hash:",
            testnetNote: "Test tokens on a public testnet. $CLAIM has no market price."
        },
        tokenomics: {
            title: "Yield Economics",
            desc: "How $CLAIM is emitted: a fixed 99M supply, a hard ceiling of 2,000 an hour, and a claim puzzle that gets harder as the hour's quota is spent.",
            fixedSupplyTitle: "Fixed Supply Cap",
            fixedSupplyDesc: "Hardcoded maximum limit of 99M CLAIM. Once reached, the network relies entirely on transaction fees to incentivize the nodes.",
            decayTitle: "The hour gets expensive",
            decayDesc: "There is no halving. Emission is capped at 2,000 $CLAIM an hour across the whole network, and within that hour the claim puzzle costs one more bit of work for every 25% of the quota spent, up to three. Each bit doubles the work, so the last claims of an hour cost eight times the first. Arriving early is cheap; sweeping the rest of the quota is not.",
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
            scanning: "Scanning Blockchain..."
        },
        auth: {
            title: "Access FaucetChain TestNet",
            subtitle: "Choose your test identity.",
            guest: "Continue as guest",
            email: "Sign in with Email",
            solana: "Sign in with Phantom",
            walletWaiting: "Check your wallet...",
            noWallet: "No Solana wallet found. Install Phantom to continue.",
            nativeWeb3: "Native Web3",
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
        }
    }
};

// ─── PORTUGUESE ──────────────────────────────────────────────────────────
const resourcesPt = {
    translation: {
        header: {
            title: "FaucetChain",
        },
        navGroups: {
            settlement: "Liquidação",
            earn: "Ganhar",
            operate: "Operar",
            explore: "Explorar",
            reference: "Referência"
        },
        tabs: {
            SolanaPayouts: "Pagamentos Solana",
            SettlementLedger: "Livro de Liquidação",
            InfraMonitor: "Monitor de Infra",
            Dashboard: "Painel Principal",
            ConnectaFaucet: "Conectar Torneira",
            BlockExplorer: "Explorador de Blocos",
            AutoClaimHub: "Central PoC",
            AddressTracker: "Rastreador L1",
            StakingVault: "Vault de Staking",
            BountyBoard: "Quadro de Bounties",
            Overview: "Visão Geral",
            WalletExplorer: "Explorador de Carteira",
            GeneralArticle: "Arquitetura de Liquidação",
            NetworkStatus: "Status da Rede",
            TechnicalSpecs: "Especificações Técnicas",
            SmartContract: "Programa Solana",
            AIModule: "Motor Sentinela",
            Simulation: "Lab de Consenso",
            Tokenomics: "Tokenomics",
            Whitepaper: "Whitepaper",
            Faucet: "Faucet de Mérito",
            APIDocs: "API do FaucetHub",
            AIAgent: "Perguntar ao Sentinela"
        },
        wallet: {
            connect: "Conectar Carteira",
            searchPlaceholder: "Escanear Endereço L1 (0x...)",
            reputation: "Score Sentinela",
            staked: "Capital em Stake",
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
            pendingTitle: "Aguardando selagem",
            pendingSealing: "Sua prova foi aceita e o claim esta na fila. Um no precisa fechar o bloco antes de ele chegar ao saldo.",
            pendingNoSealer: "Sua prova foi aceita, mas nenhum no esta online para selar. O valor esta guardado e entra assim que houver um.",
            lockedTitle: "Travado como reserva da torneira",
            lockedBody: "Nao esta no saldo acima. Fica na tesouraria da FaucetChain e paga os usuarios da sua torneira quando eles sacam. Da para baixar no FaucetHub, nunca abaixo do que esses usuarios ja tem a receber.",
            claimNoPrice: "$CLAIM não tem preço de mercado. É a unidade interna com que esta rede mede trabalho; o que carrega valor para você é o token da campanha, que outra pessoa emitiu.",
            p2p: "Transferência P2P",
            reputation: "Reputação Sentinel",
            reputationDesc: "Sua pontuação é baseada na frequência de validações no Merit Faucet e uptime do seu nó local.",
            myStaking: "Meu Staking (UTXO Vault)",
            watchedAddresses: "Endereços Rastreados",
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
            title: "Faucet de Mérito",
            desc: "Reivindique mérito de testnet para experimentar o fluxo que esta rede roda.",
            cardTitle: "Solicitar Tokens de Mérito",
            labelAddress: "Endereço L1",
            btnClaim: "Mintar 10.0 CLAIM de Mérito",
            btnProcessing: "Auditando via Sentinela...",
            txHash: "Hash de Consenso:",
            testnetNote: "Tokens de teste numa rede pública. O $CLAIM não tem preço de mercado."
        },
        tokenomics: {
            title: "Economia de Yield",
            desc: "Como o $CLAIM é emitido: supply fixo de 99M, teto rígido de 2.000 por hora, e um desafio de claim que encarece conforme a cota da hora é gasta.",
            fixedSupplyTitle: "Limite Fixo de Emissão",
            fixedSupplyDesc: "Limite rígido de 99M de CLAIM. Após isso, a rede dependerá inteiramente de taxas de transação para incentivar os nós.",
            decayTitle: "A hora vai encarecendo",
            decayDesc: "Não há halving. A emissão tem teto de 2.000 $CLAIM por hora para a rede inteira, e dentro dessa hora o desafio do claim custa um bit a mais de trabalho a cada 25% da cota gasta, até três. Cada bit dobra o trabalho, então os últimos claims da hora custam oito vezes os primeiros. Chegar cedo é barato; varrer o resto da cota não é.",
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
            scanning: "Analisando Blockchain..."
        },
        auth: {
            title: "Acessar FaucetChain TestNet",
            subtitle: "Escolha sua identidade de teste.",
            guest: "Entrar como convidado",
            email: "Entrar com E-mail",
            solana: "Entrar com Phantom",
            walletWaiting: "Confira sua carteira...",
            noWallet: "Nenhuma carteira Solana encontrada. Instale a Phantom para continuar.",
            nativeWeb3: "Web3 Nativo",
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
        }
    }
};

// ─── SPANISH ─────────────────────────────────────────────────────────────
const resourcesEs = {
    translation: {
        header: {
            title: "FaucetChain",
        },
        navGroups: {
            settlement: "Liquidación",
            earn: "Ganar",
            operate: "Operar",
            explore: "Explorar",
            reference: "Referencia"
        },
        tabs: {
            SolanaPayouts: "Pagos Solana",
            SettlementLedger: "Libro de Liquidación",
            InfraMonitor: "Monitor de Infra",
            ConnectaFaucet: "Conectar Faucet",
            Dashboard: "Panel Principal",
            BlockExplorer: "Explorador de Bloques",
            AutoClaimHub: "Central PoC",
            AddressTracker: "Rastreador L1",
            StakingVault: "Bóveda de Staking",
            BountyBoard: "Tablero de Bounties",
            Overview: "Visión General",
            WalletExplorer: "Explorador de Billetera",
            GeneralArticle: "Arquitectura de Liquidación",
            NetworkStatus: "Estado de la Red",
            TechnicalSpecs: "Especificaciones Técnicas",
            SmartContract: "Programa Solana",
            AIModule: "Motor Centinela",
            Simulation: "Lab de Consenso",
            Tokenomics: "Tokenomics",
            Whitepaper: "Whitepaper",
            Faucet: "Faucet de Mérito",
            APIDocs: "API de FaucetHub",
            AIAgent: "Preguntar al Centinela"
        },
        wallet: {
            connect: "Conectar Billetera",
            searchPlaceholder: "Escanear Dirección L1 (0x...)",
            reputation: "Puntaje Centinela",
            staked: "Capital en Stake",
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
            pendingTitle: "Esperando el sellado",
            pendingSealing: "Tu prueba fue aceptada y el claim esta en la cola. Un nodo debe cerrar el bloque antes de que llegue a tu saldo.",
            pendingNoSealer: "Tu prueba fue aceptada, pero ningun nodo esta en linea para sellar. El importe esta guardado y entra en cuanto haya uno.",
            lockedTitle: "Bloqueado como reserva del grifo",
            lockedBody: "No esta en el saldo de arriba. Queda en la tesoreria de FaucetChain y paga a los usuarios de tu grifo cuando retiran. Se puede bajar en FaucetHub, nunca por debajo de lo que esos usuarios ya tienen por cobrar.",
            claimNoPrice: "$CLAIM não tem preço de mercado. É a unidade interna com que esta rede mede trabalho; o que carrega valor para você é o token da campanha, que outra pessoa emitiu.",
            p2p: "Transferencia P2P",
            reputation: "Reputación Sentinel",
            reputationDesc: "Su puntuación se basa en la frecuencia de validación en el Merit Faucet y el tiempo de actividad local del nodo.",
            myStaking: "Mi Staking (UTXO Vault)",
            watchedAddresses: "Direcciones Rastreadas",
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
            title: "Faucet de Mérito",
            desc: "Reclame mérito de testnet para probar el flujo que esta red ejecuta.",
            cardTitle: "Solicitar Tokens de Mérito",
            labelAddress: "Dirección L1",
            btnClaim: "Acuñar 10.0 CLAIM de Mérito",
            btnProcessing: "Auditando vía Centinela...",
            txHash: "Hash de Consenso:",
            testnetNote: "Tokens de prueba en una red pública. El $CLAIM no tiene precio de mercado."
        },
        tokenomics: {
            title: "Economía de Yield",
            desc: "Cómo se emite el $CLAIM: un supply fijo de 99M, un techo duro de 2.000 por hora, y un desafío de claim que encarece a medida que se gasta la cuota de la hora.",
            fixedSupplyTitle: "Límite Fijo de Emisión",
            fixedSupplyDesc: "Límite codificado de 99M de CLAIM. Una vez alcanzado, la red depende completamente de las tarifas de transacción para incentivar los nodos.",
            decayTitle: "La hora se encarece",
            decayDesc: "No hay halving. La emisión tiene un techo de 2.000 $CLAIM por hora para toda la red, y dentro de esa hora el desafío del claim cuesta un bit más de trabajo por cada 25% de la cuota gastada, hasta tres. Cada bit duplica el trabajo, así que los últimos claims de una hora cuestan ocho veces los primeros. Llegar temprano es barato; barrer el resto de la cuota no lo es.",
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
            scanning: "Analizando Blockchain..."
        },
        auth: {
            title: "Acceder a FaucetChain TestNet",
            subtitle: "Elija su identidad de prueba.",
            guest: "Entrar como invitado",
            email: "Iniciar con Email",
            solana: "Entrar con Phantom",
            walletWaiting: "Revise su billetera...",
            noWallet: "No se encontró una billetera Solana. Instale Phantom para continuar.",
            nativeWeb3: "Web3 Nativo",
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
