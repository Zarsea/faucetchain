# Agent Lane — proposta

**Status: proposta, nada disto está implementado.** Registrado em 2026-11-04.
Quando uma parte for construída, ela sai daqui e entra no ARCHITECTURE.md.

Um protocolo paralelo dentro da FaucetChain para agentes de IA ganharem $CLAIM
pelos mesmos três caminhos (PoW, PoS, PoC), sem competir com os humanos.

## Por que uma faixa separada

`tests/bot_quota_attack.py` já mediu o problema (comentário em
`api_server.py`, junto de `CLAIM_IP_HOURLY_WALLETS`): um núcleo resolve provas
de sobra para esvaziar sozinho a quota da hora. A prova encarece o clique, não
segura um bot. Agentes no mesmo fluxo dos humanos esgotariam a torneira humana.

## Estrutura

1. **Quota dividida.** `TOKENS_PER_HOUR` (hoje 2.000) vira duas fatias, por
   exemplo 85% humanos / 15% agentes, configurável. A emissão total não muda.
   Cada fatia com sua própria escada em `current_difficulty_bits`.
2. **Identidade.** O agente registra como um nó (`mining/register` + node
   token), sempre amarrado a uma conta dona com sessão. Limite de agentes por
   dono. Caução em $CLAIM travada no tesouro pelo mesmo caminho do
   `RESERVE_LOCK`, perdida em caso de fraude.
3. **Três caminhos para ganhar $CLAIM:**

   | Caminho | O que o agente faz | Base existente |
   | --- | --- | --- |
   | PoW | resolve desafios de PoC com dificuldade maior (ex.: 20+ bits) | `verify_claim_proof`, `poc_message` |
   | PoS | trava $CLAIM e roda nó selador; ganha por epoch | `select_block_sealer`, `sealer_weight`, `SEALER_STAKE_CAP` |
   | PoC de trabalho útil | bounties verificáveis: conferir reservas, rodar `reconcile`, testar integrações, checar mint de campanha on-chain | BountyBoard |

4. **Atividade real, rotulada.** Claims da faixa de agentes passam pela selagem
   normal e produzem blocos. O explorer separa humanos e agentes — misturar seria
   a mesma encenação que este repositório passou semanas removendo.
5. **Liquidez para as torneiras (fase seguinte).** Agentes travam $CLAIM como
   reserva de faucets e recebem taxa sobre os claims que essa reserva cobre. O
   escrow existe; falta a remuneração.

## Regra que vem antes de tudo

**Agentes não recebem de campanhas de parceiros**, salvo campanha que opte
explicitamente (ex.: `audience = agents`). O parceiro paga pela atenção de
pessoas; drip para bot é fraude contra ele. A trava fica no servidor: claim
feito com node token não entra em `_campaign_drip`.

## Valor do $CLAIM

A emissão tem teto por hora. Falta demanda, ou seja, onde gastar ou travar:
caução de agente, stake de selador, reserva de faucet, boosters, publicação de
bounty. Valor externo entra pelas campanhas de parceiros (tokens reais); o
$CLAIM é a reputação e o acesso a elas.

## Pré-requisitos (do próprio ARCHITECTURE.md, Known gaps)

1. Conta custodial sem autenticação por requisição — o item mais crítico, e
   agentes automatizados o expõem mais.
2. 1.196.254 $CLAIM em sete endereços inalcançáveis: a economia nova começaria
   com o supply distorcido.
3. Registro de campanha não valida o mint on-chain.
4. `PARTICIPATION_FLOOR` (BEFORE_MAINNET.md).
