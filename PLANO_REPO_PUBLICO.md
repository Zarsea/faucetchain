# Plano — o repositório público na org FaucetChain

Prazo: **12 de outubro de 2026, 23h59 PDT.** Faltam quatro dias.

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

## Decisão prévia: **não** consolidar na org — revertida em 9 de outubro

O briefing manda mover o conteúdo para `github.com/FaucetChain`, e eu
concordei com isso em 8 de outubro. **Estava errado, e o motivo só apareceu ao
abrir o site que a org publica.**

O único repositório da org, `FaucetWeb`, tem um `public/CNAME` apontando para
`faucet.chains.my`, e o GitHub Pages publica ali uma torneira de testnet. Essa
torneira não distribui nada por conta própria: o `.env.production` aponta
`VITE_FAUCET_API` para `https://faucet-edisontkp.vercel.app`, que **não é
nosso**. O cabeçalho daquele site diz, em HTML:

```html
<header class="brand">
  <span class="mark">FaucetChain</span>
  <a class="host" href="https://edisontkp.com">EdisonTKP</a>
</header>
```

Um terceiro opera uma torneira de testnet multi-chain sob o nome FaucetChain,
e um site da nossa org, no nosso domínio, serve a interface dela chamando a
API dela. Para quem visita, parece que nós operamos aquilo.

Três consequências, em ordem de urgência:

1. **O link do formulário da Colosseum aponta para a org.** Um juiz que clique
   não encontra este projeto; encontra uma torneira que dá tokens de teste em
   dez redes. Trocar o link é a ação mais valiosa desta lista inteira.
2. **`faucet.chains.my` depende de um estranho.** Se ele desligar ou mudar a
   API, o site quebra — no nosso domínio, com a nossa marca.
3. **O nome está em uso por outro.** Isso é questão de identidade e não trava a
   hackathon, mas quem pesquisar "FaucetChain" vai achar aquilo.

**Recomendação revertida:** manter `Zarsea/faucetchain` como o endereço
oficial e apontar o formulário para lá. Não mover nada para a org enquanto o
nome dela servir o produto de outra pessoa. O repositório pessoal tem 137
commits, licença MIT, CI verde e toda a documentação — ele já é o repositório
que o briefing queria construir.

## Ordem de execução

O briefing já ordena por valor entregue. Mantida, com as correções acima
embutidas.

### 1. Segurança — antes de tudo

- [ ] Varrer `FaucetWeb` **e o histórico dele** por `.env`, chaves e credenciais
      do FaucetPay. `git log -p | grep` não basta: usar busca no histórico
      completo.
- [ ] Se achar qualquer credencial, **rotacionar antes** de qualquer outra
      etapa. Remover do histórico não a torna segura; ela já esteve pública.
- [ ] `.gitignore` de Node/TypeScript no repo novo.

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

`CONTRIBUTING.md`. **Nada de descrição e topics na org** enquanto o nome dela
servir o produto de outra pessoa.

O `FaucetWeb` já tem um README de 21 linhas, e ele é honesto — diz que o repo é
build-only e que não há chave privada ali. O que falta nele é a única frase que
importa agora: que os airdrops saem de uma API de terceiro, e que aquele site
não é a FaucetChain deste whitepaper. **Ou isso, ou despublicar a página** até
depois do prazo.

---

## Critério de pronto

Os três do briefing, mantidos:

- [ ] Dá para entender o que o projeto é em menos de 30 segundos?
- [ ] Dá para saber o que está construído e o que não está, sem perguntar?
- [ ] O que está escrito bate exatamente com o que o formulário da Colosseum
      afirma?

E um quarto, que é onde este plano quase falhou:

- [ ] **Um juiz que leia o whitepaper e depois abra o repositório encontra os
      mesmos números?** Supply, raízes publicadas, usuários da parceira. Se a
      org disser `TBD` e o whitepaper disser 99M, a terceira pergunta já falhou.

---

## O que este plano não resolve

- **Nenhum operador de torneira fora da equipe pediu isso.** É a primeira
  pergunta de um juiz, e nenhum repositório a responde.
- **Não há URL pública do produto.** Hoje roda em `localhost` atrás de um túnel
  ngrok. O briefing não cobre isso e a submissão pede.
- **Os dois vídeos.** Prazo igual, e o roteiro está em `ROTEIRO_VIDEOS.md`.
