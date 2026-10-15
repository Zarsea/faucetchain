# Plano — o repositório público do projeto

Prazo: **12 de outubro de 2026, 23h59 PDT.** Faltam quatro dias.

> **Documento datado de 8 de outubro de 2026.** Os numeros daqui ficaram para
> tras e nao devem ser copiados: o plano fala em 6 raizes, 137 commits e cinco
> usuarios. Em 14 de outubro sao **7 raizes, 175 commits e 16 carteiras**. Para
> numero atual, a fonte e o sistema; o README tem a tabela conferida. O valor
> deste arquivo e o raciocinio e a ordem de execucao, nao os valores.

Organizado a partir do briefing de execução, com uma correção que precisa ser
lida antes de qualquer etapa.

---

## Antes da Etapa 1: o briefing descreve um projeto mais atrasado do que o que existe

A tabela de status do briefing marca como "especificado" três coisas que estão
rodando, e não menciona a camada que hoje é a tese do projeto. Executá-lo como
está publicaria um repositório que **subestima** o trabalho — exatamente o
erro que o whitepaper cometia até 7 de outubro.

Conferi linha por linha contra o código:

| Componente | O briefing diz | O que o repositório mostra |
|---|---|---|
| Gateway Web2 (FaucetHunter) | Rodando, piloto fechado desde 01/09 | **Confere.** Cinco usuários, 75+ claims pagos |
| Liquidação FaucetPay, 7 ativos | Implementado | **Não.** `faucetpay.py` abre com "No money moves through this module" — ele prova identidade. Não há liquidação de 7 ativos |
| Ledger de EXP | Implementado, off-chain | **Exagero.** Existe um contador de gamificação (10 EXP por claim, `api_server.py`). Não é um subsistema de ledger |
| Ponte RPC | Especificado, em andamento | **Outra coisa existe.** Não há "ponte RPC". Há uma API HTTP em produção que a FaucetHunter chama há mais de um mês |
| Nó da cadeia | Especificado | **Está rodando.** 26 blocos selados, Proof of Claim com dificuldade variável, cota horária, nó minerador em Electron |
| Distribuição de gênese do $CLAIM | Especificado, meta Q4 2026 | **O token existe.** Teto fixo de 99.000.000, 78.077,24 já emitidos, `reconcile.py` fecha 6/6 |
| — | *não mencionada* | **Liquidação na Solana.** Programa `64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm` em devnet, **6 raízes publicadas**, 2 saques reais por carteiras reais |

A última linha é a que mais pesa. O argumento inteiro do projeto é que a
distribuição fica na appchain e a **custódia** vai para uma cadeia pública onde
qualquer um confere. Um repositório público que não menciona isso descreve um
projeto diferente, e mais fraco, do que o que existe.

**Resolver antes da Etapa 1:** reescrever a tabela de status com as linhas
acima. O resto do briefing continua valendo.

---

## Duas regras não negociáveis que colidem com fatos

As cinco regras estão certas em espírito. Duas colidem com decisões já tomadas
e publicadas, e seguir o briefing ao pé da letra criaria a contradição que ele
existe para evitar.

**"Supply: deixar como `TBD`."** O briefing diz que o número de 1 bilhão foi
corrigido e o definitivo não existe. Existe: **99.000.000**, fixo, em
`MAX_SUPPLY = 99000000.0` e na seção 4 do whitepaper, que já está público.
Publicar `TBD` ao lado de um whitepaper que diz 99M é a mesma brecha que a
regra quer fechar, só que virada do avesso.

**"Sem números inventados. Não citar contagem de usuários."** O princípio está
certo. Mas os números da FaucetHunter não são inventados, são conhecidos — e
desde 8 de outubro estão no whitepaper, na `SUBMISSION.md` e no roteiro do
pitch, com as duas ressalvas que os tornam honestos:

- Os 75 claims foram pagos **pela torneira**, via FaucetPay, com dinheiro dela.
  Não são distribuição da FaucetChain.
- Cinco usuários é pouco, e o que os cinco demonstram é o **custo de
  integração**, que não depende de escala.

A regra deveria ser reescrita como: *nenhum número sem a fonte e sem a
ressalva.* "Escala fechada e deliberadamente não divulgada" soa a evasiva para
quem já viu o whitepaper dizer cinco.

As outras três — sem histórico falso, sem código fantasma, tudo em inglês —
ficam como estão.

---

## A premissa do briefing caiu: a org não é sua

Confirmado com você em 9 de outubro, e verificado onde dava:

| | |
|---|---|
| `github.com/FaucetChain` | **não é sua** |
| `chains.my`, na Cloudflare | **não é seu** |
| `faucet-edisontkp.vercel.app` | **não é seu** |
| `Zarsea/faucetchain` | seu — 137 commits, MIT, CI verde |

O briefing abre com *"fazer com que `github.com/FaucetChain` sustente o que o
perfil do fundador afirma"*. Esse vínculo não existe: o perfil `Zarsea` está
vazio — sem nome, bio, empresa ou site — e não tem nenhuma org pública. Quem
escreveu o briefing viu uma org com o nome FaucetChain e presumiu que fosse
sua.

**Tudo que o briefing manda fazer na org está morto.** Criar
`faucetchain-protocol` lá, preencher descrição e topics, pôr README no
`FaucetWeb`, arquivar o repositório pessoal — nada disso é possível, porque
você não tem acesso de escrita a nenhum desses lugares.

### O que sobra, e é mais simples

O trabalho inteiro acontece em `Zarsea/faucetchain`, que já é o repositório que
o briefing queria construir. E uma coisa fica mais urgente do que era: **o
formulário da Colosseum está apontando para a organização de um estranho.**
Trocar esse link vale mais do que todo o resto da lista somada.

### O que não é problema de hackathon, mas é problema

Três coisas com o nome FaucetChain em público, nenhuma delas sua, e uma delas
uma org no GitHub. Isso não trava a submissão depois que o link for corrigido,
mas define o que qualquer pessoa encontra ao procurar o projeto. É assunto de
identidade e de marca, para depois do dia 12.

## Ordem de execução

O briefing já ordena por valor entregue. Mantida, com as correções acima
embutidas.

### 1. Segurança — antes de tudo

- [x] **Varredura de credenciais, feita em 8 de outubro.** Clonei o `FaucetWeb`
      e varri o histórico inteiro — 7 commits, 20 arquivos, 167 KB de blobs —
      por chaves privadas, `AKIA`, `sk-`, `ghp_`, JWT e arrays de keypair.
      Zero ocorrências, e o workflow nunca referenciou um secret. O
      `.env.production` que está versionado contém só variáveis `VITE_*`, que o
      Vite embute no bundle por construção. **Nada a rotacionar.**

      A varredura perdeu o sentido como tarefa depois, porque o repositório não
      é seu. Fica registrada porque a resposta é útil de qualquer forma: não há
      credencial sua exposta ali.

- [x] **O mesmo em `Zarsea/faucetchain`**, antes do push de 8 de outubro:
      nenhum `.env`, keypair ou credencial versionada.

Em `Zarsea/faucetchain` esta varredura já foi feita em 8 de outubro antes do
push: nenhum `.env`, keypair ou credencial versionada.

### 2. O `README.md` e o cabeçalho de `Zarsea/faucetchain`

Sozinho já transforma o link. **Antes de escrever uma linha**, dois cliques que
custam nada e são a primeira coisa que o juiz vê: o cabeçalho hoje diz
*"No description, website, or topics provided"*.

- Description: `Micro-distribution that settles on Solana. Faucets pay from a campaign vault against a Merkle root, and the program refuses a root the vault cannot cover.`
- Topics: `solana`, `anchor`, `merkle-proof`, `faucet`, `micro-payments`, `appchain`
- Website: o link público, quando existir Estrutura do briefing, na ordem dele, com a
tabela de status corrigida e **a linha da Solana incluída**.

O diagrama Mermaid: o briefing pede
`Dapp → Web2 Gateway → RPC Bridge → FaucetChain node → settlement`. O caminho
real é `torneira parceira → uma chamada HTTP → crédito na appchain → lote →
raiz de Merkle na Solana → saque contra prova`. Os sete diagramas de
`constants.ts` já foram reescritos em volta disso em 8 de outubro e podem ser
reaproveitados em vez de desenhados de novo.

Licença: escolher **MIT ou Apache-2.0** e incluir o arquivo. Apache-2.0 se
houver qualquer preocupação com patente; MIT se não houver.

### 3. `docs/architecture.md` e `docs/rpc-bridge-spec.md`

Boa parte já existe e pode ser portada em vez de escrita do zero:

- `ARCHITECTURE.md` (1.000+ linhas, com change log datado)
- `FaucetChain_Master_WhitePaper.md` seções 5 e 9
- `FaucetHub_Integration_Guide.md` — é literalmente o contrato entre gateway e
  cadeia, com idempotência e comportamento em falha já descritos

O que falta de verdade é o **modelo de Sybil enunciado honestamente**, que o
briefing pede e que hoje está espalhado entre o whitepaper (seção 8) e
`FraudAndBonusDetector.py`.

### 4. `docs/claim-token.md`

Com **99.000.000**, não `TBD`. Distribuição de gênese proporcional ao EXP
continua sendo especificação, e deve ser rotulada assim.

### 5. Esqueleto em `src/`

TypeScript, interfaces completas, métodos lançando *not implemented*,
`idempotency.ts` implementado de verdade. Cada arquivo abre dizendo qual seção
da spec implementa.

Nenhum teste que passe por estar vazio.

### 6. Resto da higiene

`CONTRIBUTING.md`, e **o seu perfil do GitHub**, que hoje está vazio: sem nome,
bio, empresa ou site. Um juiz que clique no autor de 137 commits encontra uma
página em branco. É um dos cliques mais baratos desta lista.

Nada a fazer no `FaucetWeb` nem na org — não são suas. A desambiguação já
está no topo do nosso README, que é o lugar onde ela depende só de nós.

---

## Critério de pronto

Os três do briefing, mantidos:

- [ ] Dá para entender o que o projeto é em menos de 30 segundos?
- [ ] Dá para saber o que está construído e o que não está, sem perguntar?
- [ ] O que está escrito bate exatamente com o que o formulário da Colosseum
      afirma?

E um quarto, que é onde este plano quase falhou:

- [ ] **Um juiz que leia o whitepaper e depois abra o repositório encontra os
      mesmos números?** Supply, raízes publicadas, usuários da parceira. Duas
      páginas suas que discordem num número derrubam a terceira pergunta
      sozinhas.

---

## O que este plano não resolve

- **Nenhum operador de torneira fora da equipe pediu isso.** É a primeira
  pergunta de um juiz, e nenhum repositório a responde.
- **Não há URL pública do produto.** Hoje roda em `localhost` atrás de um túnel
  ngrok. O briefing não cobre isso e a submissão pede.
- **Os dois vídeos.** Prazo igual, e o roteiro está em `ROTEIRO_VIDEOS.md`.
