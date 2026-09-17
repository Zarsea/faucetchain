# FaucetChain — Relatório Estrutural: Real vs. Simulado

> **Objetivo:** Mapear o que é real, o que é simulado e o que está ausente na FaucetChain hoje, e definir o caminho para torná-la uma verdadeira blockchain de torneiras de criptomoedas.
>
> **Data:** 12/07/2026 · **Método:** Leitura direta do código-fonte (contratos Solidity, `api_server.py` ~4.000+ linhas, `indexer_service.py`, banco `blockchain.db`, mining-node, frontend).

---

## 1. Veredito Executivo

A FaucetChain hoje **não é uma blockchain** — é um **ledger centralizado (SQLite) com fachada de blockchain**, acompanhado de um conjunto de smart contracts que funcionam como *especificação paralela*, mas **não estão conectados a nada**.

O que existe de genuinamente valioso:

- ✅ O **modelo econômico** (Proof of Claim + quota horária + hiato + stake de torneiras) é coerente e original.
- ✅ Há **criptografia real** em pontos-chave: assinaturas ECDSA nas transferências, Merkle proofs com keccak256, hash encadeado nos blocos minerados.
- ✅ A infraestrutura operacional (API, indexer, mining node Electron, Sentinel anti-fraude) funciona de verdade.

O que impede de ser uma blockchain de verdade:

- ❌ **Não há máquina de estados determinística** — o saldo é uma soma ad-hoc de 4 tabelas, com bugs de dupla contagem.
- ❌ **Não há consenso** — um único processo Python escreve no banco; não existe validação, nem réplica, nem fork choice.
- ❌ **As transferências não entram em blocos** (`block_height = 0`) — o "chain" não contém o estado que diz proteger.
- ❌ **Blocos da Sepolia e blocos nativos se misturam na mesma tabela**, quebrando a integridade conceitual da cadeia.
- ❌ **Os contratos Solidity nunca são chamados** pelo backend — hard cap de 99M, quota de 2.000/h e staking on-chain não são aplicados em lugar nenhum do sistema vivo.

**Conclusão:** o projeto está a meio caminho. A fundação (economia + infra + UX) está construída; o núcleo (ledger íntegro + consenso + verificabilidade) precisa ser construído. A Seção 6 define o roadmap em 4 fases.

---

## 2. Mapa Geral — Real × Simulado × Ausente

| Componente | Status | Evidência |
|---|---|---|
| **Token $CLAIM (ERC-20, hard cap 99M)** | 🟡 Especificado, não operante | `contracts/FaucetToken_CLAIM.sol` compila, mas nenhum endpoint do backend chama o contrato. Hard cap **não é aplicado** no ledger SQLite. |
| **HourlyEpochManager (quota 2.000/h + hiato)** | 🟡 Especificado, não operante | Contrato existe e está correto; o backend usa `HOURLY_EPOCH_STATE` — um **dicionário estático em memória** (`api_server.py:1685`) com quota de 50.000 (nem bate com o contrato) que **nunca é decrementado**. |
| **DAppStakingRegistry (passaporte de torneiras)** | 🟡 Especificado, não operante | Contrato existe. O registro real de faucets é a tabela SQLite `faucet_registry` com API keys — modelo Web2, sem stake colateral real. |
| **UTXOStakingVault (staking NFT)** | 🟡 Especificado, não operante | Contrato existe (com risco de solvência documentado). O staking real vive em `staking_positions` (SQLite), sem NFT, **sem verificação de assinatura** do staker. |
| **YieldAccumulatorVault / HubRegistryRoots** | 🟡 Especificados, não operantes | Compilam; nunca chamados. `HubRegistryRoots` é a peça mais aproveitável (ver Fase C). |
| **Indexer da Sepolia** | 🟢 Real | `indexer_service.py` indexa blocos reais via Web3 (709 blocos, 94.100 txs, alturas ~10,27M no `db_stats.json`). |
| **Transferências P2P assinadas** | 🟢 Real (criptografia) / 🔴 Off-chain | `api_server.py:1489` — verificação ECDSA real (`Account.recover_message`), Chain ID 7777, nonce sequencial, tx hash keccak determinístico. Mas a tx é gravada com `block_height = 0`: **nunca entra em bloco**. |
| **Mineração por exploração (clique → bloco)** | 🟢 Parcialmente real | `api_server.py:1882` — minerador consome claim pendente e **sela um bloco encadeado de verdade** (`parent_hash` + sha256). Mas sem prova criptográfica do claim, sem quota, sem assinatura do minerador. |
| **Merkle roots / provas por epoch** | 🟢 Real | `compute_merkle_root_and_proof` (`api_server.py:279`) com keccak256, compatível com `HubRegistryRoots.sol` e verificado client-side em `utils/merkle.ts`. |
| **Sentinel (anti-Sybil)** | 🟢 Real | `FraudAndBonusDetector.py` é chamado de verdade no `/api/claim` e bloqueia padrões Sybil. |
| **Mining Node Electron** | 🟢 Real | `mining-node/` — cliente desktop com heartbeat, registro e loop de exploração. |
| **FaucetHub + micro-claims L2** | 🟢 Real (centralizado) | Tabelas `microclaims_ledger`, settlement com API key — funciona, mas é um banco central, não L2. |
| **Epoch status / Vault yield / APY** | 🔴 Mock | Epoch: constante em memória. APY: fórmula arbitrária `min(45, max(5, 100000/staked*10))`. "Total burned": usa o pool de mineradores como proxy — não há queima. |
| **Saldos de usuários** | 🔴 Quebrado | Ver bug crítico B1 abaixo. |
| **Consenso / P2P / réplica** | ⚫ Ausente | Não existe. Um único escritor SQLite. |

Legenda: 🟢 real e funcional · 🟡 código existe mas não participa do sistema vivo · 🔴 simulado/incorreto · ⚫ inexistente

---

## 3. Bugs e Incoerências Críticas Encontradas

### B1 — Dupla contagem de saldo (crítico) — ✅ RESOLVIDO em 12/07/2026
`get_user_balance` (`api_server.py:1375`) calculava:
```
total = SUM(user_claims) + SUM(mining_rewards) + SUM(tx recebidas) − SUM(tx enviadas)
```
Mas o `/api/mining/explore` insere o **mesmo valor** em `user_claims` **e** em `transactions` (tx tipo CLAIM; idem MINING_FEE espelhado em `mining_rewards`). Cada claim explorado contava em dobro. **Resolvido**: as somas de entrada/saída agora excluem `tx_type IN ('CLAIM','MINING_FEE')` — essas linhas são espelhos on-chain dos mints, não lançamentos de saldo. Verificado numericamente nos 10 endereços com claims/mining: `saldo_antigo − saldo_novo = soma exata dos espelhos` (3 carteiras estavam infladas, uma em +80%).

### B2 — ETH da Sepolia contado como $CLAIM (crítico) — ✅ RESOLVIDO em 12/07/2026
A tabela `transactions` continha **~10,2 milhões de transações reais da Sepolia** (valores em ETH), e a mesma tabela alimentava o saldo de $CLAIM. **Resolvido pela desvinculação da Sepolia** (`desvincular_sepolia.py`): todas as txs Sepolia foram expurgadas; o banco antigo (3,7 GB) está preservado em `blockchain_sepolia_backup.db`.

### B3 — Cadeia nativa "enxertada" na Sepolia — ✅ RESOLVIDO em 12/07/2026
Blocos nativos do explore eram criados como `MAX(height)+1` continuando a numeração da Sepolia (altura ~10,35M). **Resolvido**: a cadeia nativa agora tem **genesis próprio (altura 0, Chain ID 7777)** e os 19 blocos nativos foram renumerados (1..19) e re-encadeados com hashes recalculados. O `indexer_service.py` não usa mais Web3/RPC, e o frontend não consulta mais redes externas (claim via assinatura de mensagem gasless em `Faucet.tsx`).

### B4 — Hard cap de 99M não existe no sistema vivo — ✅ RESOLVIDO em 12/07/2026
Nenhum código do backend verificava `MAX_SUPPLY`; o limite só existia no contrato Solidity (nunca chamado). **Resolvido**: constante `MAX_SUPPLY = 99_000_000` + helper `get_total_minted()` em `api_server.py`, aplicados nos dois únicos caminhos de emissão — `/api/mining/explore` (claim que excederia o cap é rejeitado permanentemente com status `rejected_max_supply`, espelhando o `require()` do `FaucetToken_CLAIM.sol`) e `_distribute_epoch` (pool da epoch limitado ao supply restante; com supply esgotado retorna `max_supply_reached`, com epsilon 1e-6 contra resíduos de float). Verificado em sandbox com supply inflado a 99M−5: claim de 10 rejeitado, epoch distribuiu exatamente os 5 finais, epoch seguinte travada — supply final cravado em 99.000.000,0000.

### B5 — Quota horária não aplicada — ✅ RESOLVIDO em 12/07/2026
O hiato ("Block Depleted") — inovação central do whitepaper — não era aplicado em nenhum caminho de emissão real; o `/api/epoch/status` era um dicionário mock (quota 50.000, nunca decrementada). **Resolvido**: tabela `hourly_epochs` + `get_hourly_epoch_state()`/`record_epoch_mint()` em `api_server.py`, espelhando o `HourlyEpochManager.sol` — `EPOCH_DURATION = 3600s`, `TOKENS_PER_HOUR = 2.000` (epoch_id = hora unix, o rollover é a própria troca de hora). O `/api/mining/explore` recusa emissão quando a quota esgota (o claim **continua pendente** e é processado na hora seguinte), declara `is_depleted` (com broadcast WebSocket `EPOCH_DEPLETED`) e contabiliza cada mint na epoch. O `/api/epoch/status` agora retorna o estado real (mantendo `isActive` para o frontend). Verificado em sandbox: contabilização (claimed 0→5), hiato com 1998/2000 + claim de 5, claim bloqueado processado após o rollover de hora, e esgotamento exato (1995+5 → minta e declara hiato a 2000/2000).

### B6 — Operações sem assinatura — ✅ RESOLVIDO em 13/07/2026
Só `/api/transfer` exigia assinatura ECDSA; claim/stake/unstake aceitavam qualquer `address` no corpo. **Resolvido**: helper `require_action_signature()` em `api_server.py` aplicado aos três endpoints — recuperação EIP-191 (`personal_sign`) com exigência de que o signatário seja o dono, janela de validade de 300s e dedup anti-replay (tabela `used_signatures`). Mensagens canônicas: `FaucetChain Claim|Stake|Unstake | chain:7777 | <addr> | … | ts:<unix>`. Contas demo/custodiais (`google_*`/`email_*`, sem chave ECDSA) são dispensadas — o servidor é o custodiante. Frontend: `Faucet.tsx` já assinava a mesma mensagem (agora enviada ao backend); `StakingVault.tsx` ganhou `signStakingAction()`. Verificado com 10/10 testes: sem assinatura→401, assinado→aceito, replay→401, assinatura de atacante→401, expirada→401, custodial→ok, stake/unstake autenticados.

### B7 — Divergências doc × código
- `UTXOStakingVault.sol`: comentário diz tiers 0.001%/0.01%/2%; código implementa 0.5%/2%/10%.
- Whitepaper: quota 2.000/h; contrato: 2.000/h; backend mock: 50.000/h.
- `setHourlyEpochManager` sem controle de acesso (janela de front-running no deploy).

---

## 4. Anatomia do que já funciona (aproveitar, não jogar fora)

O ciclo **clique → claim pendente → exploração → bloco** já existe e é o embrião correto do Proof of Claim:

```
Usuário clica (Faucet.tsx)
   → POST /api/claim            [cooldown 1h + Sentinel anti-Sybil]  ✅ real
   → pending_claims (mempool primitivo)                              ✅ real
Minerador (Electron node)
   → POST /api/mining/explore                                        ✅ real
   → sela bloco: hash = sha256(height+parent_hash+miner+ts+tx)       ✅ encadeamento real
   → recompensa 80% usuário / 20% minerador                          ✅ real
   → broadcast WebSocket BLOCK_MINED                                 ✅ real
```

Peças reutilizáveis de alta qualidade:
- **Merkle infra completa** (backend keccak + verificação client-side) — pronta para ancoragem L1.
- **Verificação de assinatura ECDSA** já implementada — basta estender aos demais endpoints.
- **Sentinel** — camada anti-Sybil que blockchains puras não têm.
- **HubRegistryRoots.sol** — o contrato certo para dar verificabilidade externa à cadeia nativa.

---

## 5. O que falta para ser uma "verdadeira blockchain de torneiras"

Uma blockchain exige, no mínimo: **(a)** estado determinístico derivado só dos blocos; **(b)** blocos válidos por regras criptográficas verificáveis por terceiros; **(c)** produção de blocos resistente a um único ator malicioso; **(d)** capacidade de qualquer um auditar a cadeia. Hoje a FaucetChain tem (a) parcial, (b) parcial, (c) ausente, (d) ausente.

| Requisito | Hoje | Necessário |
|---|---|---|
| Genesis + cadeia própria | Enxertada na Sepolia (B3) | Genesis próprio, altura 0, chain ID 7777 de ponta a ponta |
| Ledger íntegro | Soma ad-hoc com dupla contagem (B1/B2) | Tabela única de saldos, mutada **apenas** por transações incluídas em blocos |
| Todas as txs em blocos | Transfers com `block_height=0` | Mempool → bloco → estado. Sem exceções |
| Prova do clique (PoC) | Request HTTP sem prova | `claim_proof = keccak(user + epoch + parent_hash + nonce)` com dificuldade ajustável (mini-PoW no browser) |
| Quota + hiato | Mock (B5) | Aplicados na selagem do bloco, espelhando `HourlyEpochManager.sol` |
| Hard cap 99M | Inexistente no vivo (B4) | Verificado a cada mint, no selador |
| Assinaturas universais | Só transfer (B6) | Claim, stake, unstake — tudo assinado pela chave do usuário |
| Bloco assinado | Bloco anônimo | Header assinado pela chave do minerador/validador |
| Auditabilidade externa | Nenhuma | Merkle root de cada epoch ancorado na Sepolia via `HubRegistryRoots.sol` (o código já existe dos dois lados!) |
| Multi-nó / consenso | Um único escritor | Fase final: réplica + sorteio de selador ponderado por stake |

---

## 6. Roadmap de Transformação — 4 Fases

### Fase A — Integridade do Ledger (fundação, ~sem mudança de arquitetura)
> Corrigir a contabilidade antes de qualquer coisa. Sem isso, nada acima faz sentido.

1. **Separar as cadeias:** tabelas `sepolia_blocks`/`sepolia_transactions` (indexer) vs. `blocks`/`transactions` nativas com genesis próprio. Elimina B2 e B3.
2. **Ledger canônico:** tabela `balances` mutada exclusivamente pelo processamento de blocos; remover a soma ad-hoc. Elimina B1.
3. **Hard cap + quota no caminho vivo:** substituir `HOURLY_EPOCH_STATE` mock por estado real (tabela `epochs`), decrementado na selagem; travar mint ao atingir 2.000/h (hiato) e 99M (cap). Elimina B4 e B5.
4. **Assinatura em tudo:** estender a verificação ECDSA já existente para claim/stake/unstake. Elimina B6.

### Fase B — Proof of Claim real (o clique vira prova criptográfica) — ✅ IMPLEMENTADA em 13/07/2026

1. **Claim Proof no browser** ✅ — `Faucet.tsx` resolve `nonce` tal que `keccak256("FaucetChain-PoC|7777|epoch|parent_hash|user|nonce")` tenha 16 bits iniciais zero (dificuldade ajustável em `CLAIM_PROOF_DIFFICULTY_BITS`). Amarrado ao tip da cadeia → impossível pré-computar; ~1-3s de CPU por clique (anti-bot); progresso "⛏️ Explorando bloco… N hashes" no botão. Desafio servido por `GET /api/poc/challenge`.
2. **Validação no backend** ✅ — `/api/claim` recusa claims sem proof válido (dificuldade, epoch atual/anterior, parent = tip ou pai do tip); proof gravado em `pending_claims.poc_nonce/poc_hash`. Obrigatório para todas as contas, inclusive demo.
3. **Selagem estruturada** ✅ — `/api/mining/explore` agora sela blocos multi-claim (até 10, FIFO) com header `{height, parent_hash, merkle_root(claims), validator, timestamp}`; `block_hash = sha256(height+parent+sealer+ts+merkle_root)`; hard cap (B4) e quota horária/hiato (B5) aplicados por claim na seleção. Merkle root verificável client-side (leaf = keccak(utf8(tx_hash)), mesma regra de combinação da infra existente).
4. **Selador sorteado por stake** ✅ — `select_block_sealer()`: entre miners online, peso = 1 + stake ativo (`staking_positions`), semente determinística `keccak(parent_hash)` (verificável; muda a cada bloco). Quem não é o sorteado recebe `explored:false` (mining node Electron compatível — só lê `explored`/`miner_fee`). Modelo 80/20 mantido.

**Verificação:** 12/12 testes em sandbox — desafio, rejeição sem proof/nonce inválido/parent falso, 3 claims com proofs válidos (~2,6s/proof), recusa de selador não-sorteado, bloco #20 selado com 3 claims, Merkle root recomputado independentemente confere, encadeamento e header (tx_count=6, reward=1.8) corretos.

**Pendências da Fase B (próximos refinamentos):** assinatura ECDSA do selador no header do bloco; selagem por tempo (a cada T segundos) além de por demanda; endpoint de verificação de prova Merkle de claim individual.

### Fase C — Verificabilidade Externa (a ponte com o mundo real) — ✅ IMPLEMENTADA em 13/07/2026
> Deixar de exigir confiança no servidor: qualquer um audita.

1. **Notarização + ancoragem** ✅ — `anchor_service.py`: fecha epochs de blocos (`ANCHOR_EPOCH_SIZE`, default 16), computa o Merkle root (leaf = keccak(bytes32(blockHash)), compatível com `utils/merkle.ts`), **assina com EIP-191** (mensagem canônica `FaucetChain-EpochRoot|chain|epoch|start|end|leaves|root`) e grava em `epoch_roots` (colunas `signature/signer/anchor_tx`). Com `ANCHOR_RPC_URL` + `HUB_REGISTRY_ADDRESS` configurados, publica on-chain via `HubRegistryRoots.publishEpochRoot()` (web3 pronto; o deploy do contrato na chain externa é a única etapa pendente — exige chave com fundos). Modos `--loop` e `--status`. Roots expostos em `GET /api/anchor/roots`.
2. **Export para auditoria** ✅ — `GET /api/chain/export`: dump completo (blocos, txs, claims, mining rewards, hourly_epochs, epoch_roots + parâmetros do protocolo).
3. **Auditor independente** ✅ — `verify_chain.py` (só requests + eth-account + eth-hash, zero confiança no servidor): encadeamento desde o genesis, hash de todos os blocos recomputado (inclui legados e genesis), Merkle root dos blocos multi-claim (**regra canônica: folhas ordenadas lexicograficamente** — corrigida nos dois lados durante os testes), hard cap, quota horária e assinaturas do notário. **Testado**: cadeia legítima 7/7 APROVADA; cadeia adulterada (hash de claim trocado no banco) REPROVADA com o bloco fraudado apontado.
4. **Proof of Reserve real** ✅ — `GET /api/faucethub/proof-of-reserve`: por faucet registrada, reserva no ledger canônico vs obrigações pendentes (`virtual_balance` dos micro-claims), coverage ratio e veredito de solvência do sistema.
5. **Correções nos contratos** ✅ — tiers do `UTXOStakingVault` (comentário divergente), `setHourlyEpochManager` restrito ao deployer (fecha o front-running do deploy — B7), e cast `uint64` pré-existente no `AutoClaimDistributor` que quebrava o build. **6 contratos compilando** (solc 0.8.26). Pendência: segregação do pool de yield do principal no vault.

### Fase D — Descentralização (visão de longo prazo)
> De sequenciador centralizado auditável para rede de nós.

1. Evoluir o mining-node Electron de "cliente de API" para **nó completo**: mantém cópia da cadeia, valida blocos recebidos, recusa blocos inválidos.
2. Gossip de blocos entre nós (WebSocket já existe como transporte inicial).
3. Fork choice simples (cadeia válida mais longa assinada por seladores sorteados).
4. Só então: bridge $CLAIM ↔ ERC-20, DEX, DAO (Fases 4-5 do whitepaper).

**Posição intermediária honesta:** entre as Fases C e D, a FaucetChain pode operar legitimamente como **"L1 de torneiras com sequenciador centralizado e verificabilidade on-chain na Ethereum"** — modelo análogo ao de rollups em estágio inicial. É defensável publicamente, ao contrário do estado atual.

---

## 7. Decisões Estratégicas em Aberto

1. **Contratos Solidity: espec ou motor?** Ou (a) a cadeia nativa é o produto e os contratos viram apenas a âncora de verificação (recomendado — só `HubRegistryRoots` é deployado), ou (b) tudo migra para on-chain na Sepolia e o backend vira indexador (mais "blockchain", porém gas e latência matam a proposta gasless).
2. **Modelo do clique:** clique = bloco próprio (PoC puro, usuário é o minerador) vs. clique = claim no mempool + selador sorteado (híbrido PoC+PoS, mantém os mining nodes). O código atual está mais próximo do híbrido.
3. **Migração de dados:** os saldos atuais (contaminados por B1/B2) precisam de um snapshot corrigido antes do genesis do ledger canônico — decidir a regra de recomputação.

---

## 8. Resumo em uma frase

> A FaucetChain tem uma **economia original bem desenhada e uma infraestrutura operacional real**, mas seu núcleo ainda é um banco de dados central com contabilidade quebrada e contratos desconectados; o caminho para ser uma blockchain de verdade é **consertar o ledger (Fase A), transformar o clique em prova criptográfica (Fase B), ancorar a cadeia na Ethereum para auditoria pública (Fase C)** e só então descentralizar os nós (Fase D).
