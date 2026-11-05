
// Respostas escritas do chat "Ask Sentinel", escolhidas por palavra-chave.
//
// Em 05/11/2026 sairam treze entradas que descreviam o que nao existe:
// "Proof of Carrier", formulas de consenso e de peso de merito que nenhum
// codigo calcula, MetaMask, bloco de 12 s, rollup com 7 dias de desafio,
// APY de validador, slashing, bonus DeFi e um modulo de "machine learning".
// Cada resposta aqui tem de bater com o codigo; na duvida, nao responda.

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
        description: "Who are you?",
        keywords: ["who are you", "quem é você", "quem e voce", "what are you", "your name", "seu nome"],
        response: [
            "I answer questions about FaucetChain from its own documentation, here in your browser. I am a set of written answers matched to keywords, not a model, and I cannot move tokens or change the network.",
            "Eu respondo perguntas sobre a FaucetChain a partir da documentação dela, aqui no seu navegador. Sou um conjunto de respostas escritas, escolhidas por palavras-chave, não um modelo, e não consigo mover tokens nem mudar a rede."
        ]
    },
    {
        id: 'status',
        description: 'Network Status Check',
        keywords: ['status', 'height', 'block', 'tps', 'gas', 'altura', 'bloco'],
        response: [
            "The network is reporting Block #{{blockHeight}} with {{tps}} TPS. Network fees are stable at {{gasPrice}} µCLAIM.",
            "Telemetria Atual: Bloco #{{blockHeight}} confirmado. A rede opera com {{activeValidators}} validadores ativos e {{tps}} TPS."
        ]
    },

    // --- ACTIONS (FAUCET & SIMULATION) ---
    {
        id: 'faucet_request',
        description: "Asks the chat to mint",
        keywords: ["mint", "mintar", "send me tokens", "me envie tokens", "give me tokens", "cunhar"],
        action: 'MINT_TOKENS',
        response: [
            "I can't mint tokens.",
            "Eu não consigo cunhar tokens."
        ]
    },
    {
        id: 'stress_test',
        description: "Asks the chat to simulate load",
        keywords: ["stress test", "simulate congestion", "simular congestionamento", "teste de estresse", "validator drop"],
        action: 'TRIGGER_ANOMALY',
        response: [
            "I can't change the network.",
            "Eu não consigo mudar a rede."
        ]
    },

    // --- TECHNICAL CONCEPTS ---

    // --- PROTOCOL ARCHITECTURE ---
    {
        id: 'faucet_mechanics',
        description: "How the built-in Merit Faucet works",
        keywords: ["merit faucet", "built-in faucet", "torneira interna", "how to claim", "como clamar", "como fazer claim", "puzzle", "desafio"],
        response: [
            "The Merit Faucet pays test $CLAIM. Each claim carries a keccak puzzle tied to the chain tip, solved in your browser, so claims cannot be precomputed in bulk. One claim per wallet per hour, at most five wallets per IP in an hour, and the puzzle gets harder as the network's 2,000 $CLAIM hourly quota is spent.",
            "A Merit Faucet paga $CLAIM de teste. Cada claim carrega um desafio keccak amarrado à ponta da cadeia, resolvido no seu navegador, então não dá para calcular claims em massa. Um claim por carteira por hora, no máximo cinco carteiras por IP por hora, e o desafio fica mais difícil conforme a cota de 2.000 $CLAIM por hora da rede é gasta."
        ]
    },
    {
        id: 'tokenomics',
        description: 'Token Economics',
        keywords: ['token', 'tokenomics', 'supply', 'emission', 'halving', 'reward', 'recompensa'],
        response: [
            "$CLAIM has a fixed supply of 99,000,000 and nothing mints beyond it. Emission is capped per hour, not per block: the network releases at most 2,000 $CLAIM an hour across every faucet connected to it, and the claim puzzle gets harder as that hour's quota is spent. There is no halving — the hourly ceiling is the emission control. Claiming and receiving cost nothing; withdrawing to Solana costs a fee a relayer pays.",
            "O $CLAIM tem supply fixo de 99.000.000 e nada emite além disso. A emissão é limitada por hora, não por bloco: a rede libera no máximo 2.000 $CLAIM por hora somando todas as torneiras conectadas, e o desafio do claim fica mais difícil conforme a cota da hora é gasta. Não há halving — o teto horário é o controle de emissão. Claim e recebimento não custam nada; sacar para a Solana custa uma taxa que um relayer paga."
        ]
    },
    {
        id: 'security',
        description: 'Security Model',
        keywords: ['security', 'segurança', 'attack', 'ataque', '51%', 'safe', 'seguro'],
        response: [
            "Finality for anything that carries value comes from Solana, not from this chain: a batch of rewards becomes a Merkle root, the program refuses to publish a root its vault cannot cover, and a user withdraws with an inclusion proof. The native sealer election orders claim blocks and holds no money, so it is not what secures a payout.",
            "A finalidade do que carrega valor vem da Solana, não desta cadeia: um lote de recompensas vira uma raiz de Merkle, o programa recusa publicar uma raiz que o vault não cubra, e o usuário saca com prova de inclusão. A eleição do selador ordena blocos de claim e não guarda dinheiro, então não é ela que protege um pagamento."
        ]
    },
    {
        id: 'gas_fees',
        description: 'Gas and Fees',
        keywords: ['gas', 'fee', 'taxa', 'cost', 'custo', 'transaction cost'],
        response: [
            "Current network fee: {{gasPrice}} µCLAIM. Claiming and receiving cost a user nothing; this fee applies to transfers. It splits 50% to the treasury and 50% to the miner pool. Withdrawing to Solana costs a Solana transaction, and the relayer pays it.",
            "Taxa atual da rede: {{gasPrice}} µCLAIM. Clamar e receber não custam nada ao usuário; a taxa incide sobre transferências e se divide 50% tesouraria e 50% pool de mineradores. Sacar para a Solana custa uma transação, paga pelo relayer."
        ]
    },
    {
        id: 'wallet_connection',
        description: "How to sign in",
        keywords: ["connect", "conectar", "wallet", "carteira", "login", "entrar", "phantom", "sign in"],
        response: [
            "Sign in with Phantom, with Google or with an email. To withdraw a campaign reward you link a Solana wallet, because the payout lands there and only that wallet can sign for it. Claiming and receiving cost you nothing.",
            "Entre com a Phantom, com o Google ou com um e-mail. Para sacar uma recompensa de campanha você vincula uma carteira Solana, porque o pagamento cai nela e só ela consegue assinar o saque. Clamar e receber não custam nada."
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
        id: 'optimize_performance',
        description: 'Performance Optimization',
        keywords: ['optimize', 'otimizar', 'performance', 'faster', 'mais rápido', 'throughput'],
        response: [
            "Throughput here is not limited by block production: a partner faucet's clicks are credited off-chain and never queue a block, and the settlement that carries value is batched into one Solana transaction per root. The real ceiling is the hourly issuance quota of 2,000 $CLAIM and the per-user cooldown of 300 seconds, both deliberate. There is no EVM, no sharding and no state channels in this system.",
            "A vazão aqui não é limitada por produção de bloco: os cliques de uma torneira parceira são creditados fora da cadeia e nunca enfileiram bloco, e a liquidação que carrega valor vai em uma transação Solana por raiz. O teto real é a cota de emissão de 2.000 $CLAIM por hora e o cooldown de 300 segundos por usuário, ambos deliberados. Não existe EVM, sharding nem state channels neste sistema."
        ]
    },
    {
        id: 'diagnose_high_gas',
        description: 'Diagnose High Gas Prices',
        keywords: ['high gas', 'gás alto', 'expensive', 'caro', 'why expensive'],
        response: [
            "A high fee ({{gasPrice}} µCLAIM) points at congestion. Usual causes here: (1) a claim farm hammering the faucet, (2) the hourly quota emptying early, (3) a burst of transfers. The defences are the difficulty curve, the per-IP wallet cap and the quota itself.",
            "Taxa alta ({{gasPrice}} µCLAIM) indica congestionamento. Causas típicas aqui: (1) fazenda de claims, (2) cota horária esgotando cedo, (3) rajada de transferências. As defesas são a curva de dificuldade, o teto por IP e a própria cota."
        ]
    },
    {
        id: 'suggest_improvements',
        description: 'Architectural Improvements',
        keywords: ['improve', 'melhorar', 'upgrade', 'enhance', 'v3', 'future'],
        response: [
            "The work actually open: an independent review of the Solana program, which nobody who wrote it can do; deciding what $CLAIM buys, because a token with no use and no market is neither; and moving the settlement batch itself under the sealer, which today is closed by the operator rather than by whoever the draw elected. Two items came off that list: two campaigns are funded on devnet and a partner faucet draws from both, and the sealer now closes real blocks -- the queue it was elected over stopped being empty on 29 September.",
            "O trabalho realmente aberto: uma revisão independente do programa Solana, que ninguém que o escreveu pode fazer; uma campanha financiada de verdade para uma torneira parceira pagar de um vault que qualquer pessoa consegue ler; dar trabalho ao selador, que hoje é pago por presença e eleito para selar uma fila vazia; e decidir o que o $CLAIM compra, porque um token sem uso e sem mercado não é nem uma coisa nem outra."
        ]
    },

    // --- FRAUD DETECTION & ML ---
    {
        id: 'fraud_detection',
        description: "How farming is held back",
        keywords: ["fraud", "fraude", "sybil", "bot", "farm", "farming", "abuse", "abuso"],
        response: [
            "What holds farming back is arithmetic, not a classifier: one claim per wallet per hour, at most five wallets per IP in an hour, the 2,000 $CLAIM hourly ceiling, and a puzzle that costs more as the hour fills. On top of that the server refuses a claim if two of the wallet's last twenty came less than a minute apart. There is no machine learning in this path.",
            "O que segura o farm é aritmética, não um classificador: um claim por carteira por hora, no máximo cinco carteiras por IP por hora, o teto de 2.000 $CLAIM por hora e um desafio que fica mais caro conforme a hora enche. Além disso o servidor recusa o claim se dois dos últimos vinte da carteira vieram com menos de um minuto de diferença. Não há aprendizado de máquina nesse caminho."
        ]
    },

    // --- LOCAL AI CORE & NEURAL BEHAVIOR ---
    {
        id: 'local_ai_core',
        description: "How this chat works",
        keywords: ["local ai", "local core", "how do you work", "como você funciona", "offline", "sem nuvem", "llm"],
        response: [
            "This chat runs in your browser and calls no AI service. It matches your question against written answers by keyword, fills in live numbers like the block height, and when nothing matches well it searches the project documentation on the server.",
            "Este chat roda no seu navegador e não chama nenhum serviço de IA. Ele compara sua pergunta com respostas escritas por palavra-chave, preenche números ao vivo como a altura do bloco e, quando nada combina bem, busca na documentação do projeto no servidor."
        ]
    },
    {
        id: 'low_tps_diagnosis',
        description: "Why TPS reads low",
        keywords: ["low tps", "baixa tps", "tps", "throughput", "rede lenta", "slow network"],
        response: [
            "Current TPS is {{tps}}. A low number here is expected: partner faucets credit their users off this chain's blocks, and what carries value settles on Solana in one transaction per batch. TPS counts the appchain's own blocks only.",
            "A TPS atual é {{tps}}. Um número baixo aqui é esperado: as torneiras parceiras creditam seus usuários fora dos blocos desta cadeia, e o que carrega valor liquida na Solana em uma transação por lote. A TPS conta só os blocos da própria appchain."
        ]
    },
    {
        id: 'emission_schedule',
        description: 'How emission is limited (there is no halving)',
        keywords: [
            'halving',
            'halvening',
            'corte de recompensa',
            'diminui recompensa',
            'emissão',
            'emission schedule'
        ],
        response: [
            "FaucetChain has no halving. An earlier draft described one and it was never built; what limits emission is a hard ceiling of 2,000 $CLAIM an hour across the whole network, against a fixed supply of 99,000,000. Two things follow: a botnet cannot drain a day of emission in ten minutes, and the cost of attacking the network scales with time rather than with hardware. Within the hour the claim puzzle gets harder as the quota is spent, so the cheapest claims go to whoever arrives first.",
            "A FaucetChain não tem halving. Uma versão antiga do papel descrevia um e ele nunca foi construído; o que limita a emissão é um teto rígido de 2.000 $CLAIM por hora para a rede inteira, contra um supply fixo de 99.000.000. Daí saem duas coisas: uma botnet não drena a emissão de um dia em dez minutos, e o custo de atacar a rede cresce com o tempo em vez de crescer com hardware. Dentro da hora o desafio do claim fica mais difícil conforme a cota é gasta, então os claims mais baratos vão para quem chega primeiro."
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
        id: 'what_is',
        description: "What FaucetChain is",
        keywords: ["what is faucetchain", "o que é a faucetchain", "o que e a faucetchain", "what does it do", "o que faz", "faucetchain"],
        response: [
            "FaucetChain is a micro-distribution rail. Sponsors fund a campaign vault on Solana, partner faucets credit their users here for each claim, and the credits are settled on Solana in batches, where each user withdraws with their own wallet.",
            "A FaucetChain é um trilho de micro-distribuição. Patrocinadores financiam o cofre de uma campanha na Solana, torneiras parceiras creditam seus usuários aqui a cada claim, e os créditos são liquidados na Solana em lotes, onde cada usuário saca com a própria carteira."
        ]
    },
    {
        id: 'settlement',
        description: "How settlement on Solana works",
        keywords: ["settlement", "settle", "liquidação", "liquidacao", "liquidar", "solana", "merkle", "root", "raiz", "batch", "lote", "vault", "cofre"],
        response: [
            "Credits pile up on the appchain. When a batch closes, every wallet's total becomes one leaf of a Merkle tree, and its root is published to the FaucetChain program on Solana. The program refuses a root the campaign vault cannot cover, so the reserve is checked on Solana, not reported by us.",
            "Os créditos se acumulam na appchain. Quando um lote fecha, o total de cada carteira vira uma folha de uma árvore de Merkle, e a raiz é publicada no programa da FaucetChain na Solana. O programa recusa uma raiz que o cofre da campanha não cubra, então a reserva é conferida na Solana, não informada por nós."
        ]
    },
    {
        id: 'withdraw',
        description: "How to withdraw",
        keywords: ["withdraw", "saque", "sacar", "retirar", "payout", "pagamento", "receive", "receber"],
        response: [
            "After your batch's root is on Solana, open Solana Payouts, signed in. You prove your leaf is in that root and sign with your linked Solana wallet; the tokens leave the campaign vault. A receipt blocks a second withdrawal, and the relayer can pay the fee so you need no SOL. Below the campaign's minimum, your credit waits for the next batch.",
            "Depois que a raiz do seu lote está na Solana, abra Solana Payouts com login. Você prova que sua folha está naquela raiz e assina com a carteira Solana vinculada; os tokens saem do cofre da campanha. Um recibo impede um segundo saque, e o relayer pode pagar a taxa, então você não precisa de SOL. Abaixo do mínimo da campanha, seu crédito espera o próximo lote."
        ]
    },
    {
        id: 'connect_faucet',
        description: "How a partner faucet integrates",
        keywords: ["connect a faucet", "conectar torneira", "conectar uma torneira", "integrate", "integrar", "integração", "api key", "partner", "parceira", "my faucet", "minha torneira"],
        response: [
            "A faucet registers once and gets an API key, shown once. Then it makes one HTTP call per claim, after its own payout is recorded, so nothing it owes a user waits on us. Time out after four seconds and log the error instead of stopping. The FaucetHub API screen has the requests, and 'npx skills add Zarsea/faucetchain' gives your coding agent the whole integration.",
            "Uma torneira se registra uma vez e recebe uma chave de API, mostrada uma vez só. Depois faz uma chamada HTTP por claim, depois de registrar o próprio pagamento, então nada que ela deve a um usuário espera por nós. Use timeout de quatro segundos e registre o erro em vez de parar. A tela FaucetHub API tem as requisições, e 'npx skills add Zarsea/faucetchain' entrega a integração inteira ao seu agente."
        ]
    },
    {
        id: 'campaigns',
        description: "What a campaign is",
        keywords: ["campaign", "campanha", "sponsor", "patrocinador", "usdct", "adst", "agtt"],
        response: [
            "A campaign is a sponsor's token budget, held in its own vault on Solana. The sponsor sets a monthly cap and a minimum withdrawal; each claim on an enrolled faucet drips part of the budget, 80 percent to the user and 20 to the treasury.",
            "Uma campanha é o orçamento em token de um patrocinador, guardado num cofre próprio na Solana. O patrocinador define um teto mensal e um saque mínimo; cada claim numa torneira inscrita libera uma parte do orçamento, 80% para o usuário e 20% para a tesouraria."
        ]
    },
    {
        id: 'consensus',
        description: "How blocks are sealed",
        keywords: ["consensus", "consenso", "seal", "selar", "sealer", "validator", "validador", "proof of claim", "stake weight", "architecture", "arquitetura"],
        response: [
            "The appchain seals blocks by a stake-weighted draw seeded by the parent hash. A node's weight is 1 + min(stake, cap): the +1 keeps a node with no capital in the running, and the cap stops whoever locks the most from sealing every round. Nodes are paid by uptime share. Anything that carries value is final on Solana, not here.",
            "A appchain sela blocos por um sorteio ponderado por stake, com semente no hash do bloco anterior. O peso de um nó é 1 + min(stake, teto): o +1 mantém na disputa um nó sem capital, e o teto impede quem trava mais de selar toda rodada. Os nós são pagos pela fatia de tempo online. O que carrega valor tem finalidade na Solana, não aqui."
        ]
    },
    {
        id: 'governance',
        description: "Governance",
        keywords: ["governance", "governança", "governanca", "vote", "votar", "proposal", "proposta", "dao"],
        response: [
            "Governance is designed, not built. Today the operator sets parameters like the hourly ceiling and the sealer cap, and they live in the server's configuration.",
            "A governança está desenhada, não construída. Hoje o operador define parâmetros como o teto por hora e o teto do selador, e eles ficam na configuração do servidor."
        ]
    },
    {
        id: 'help',
        description: "Help / Unknown",
        keywords: ["help", "ajuda", "socorro", "options", "opções"],
        response: [
            "You can ask how settlement on Solana works, how to withdraw, how to connect a faucet, what a campaign is, how the Merit Faucet works, or the network status.",
            "Você pode perguntar como funciona a liquidação na Solana, como sacar, como conectar uma torneira, o que é uma campanha, como funciona a Merit Faucet, ou o status da rede."
        ]
    },
];
