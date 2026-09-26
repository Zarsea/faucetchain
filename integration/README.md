# Construir uma ponte para a FaucetChain

Esta pasta guarda o que foi aprendido ligando torneiras de verdade. Não é o guia
final para outros devs — é o material dele, escrito enquanto ainda dói, porque
lição anotada depois vira slogan.

```
faucethunter/     a primeira ponte, completa e em produção desde 26/09/2026
```

O guia de API está em [`../FaucetHub_Integration_Guide.md`](../FaucetHub_Integration_Guide.md),
seção 4. Aqui fica o que aquele documento não sabe dizer: o que dá errado.

---

## O formato de uma ponte

Uma torneira se liga à FaucetChain com **uma chamada HTTP**, depois do commit
dela, engolindo o próprio erro. Só isso. Tudo o mais nesta pasta existe para que
essa chamada não minta.

```
[torneira]   usuário clica, você credita como sempre
     │
     │  depois do SEU commit — seu pagamento já aconteceu
     ▼
POST /api/faucethub/microclaim   { user_wallet, amount }
     │
     ▼
[FaucetChain]  cada campanha inscrita credita do orçamento dela
     │
     ▼
[Solana]   raiz cobrindo o que é devido; o programa recusa raiz sem lastro
```

## As duas regras que não se negociam

**Depois do commit.** O pagamento da torneira tem que estar gravado antes de a
FaucetChain ser procurada. Um pagamento não pode depender do tempo de vida de
outra pessoa.

**Engole o erro.** Timeout curto, falha vira linha de log. E **teste isso de
propósito**: derrube a FaucetChain e faça um claim. Se a torneira parar de
pagar, a ponte está errada, e quem paga a conta é o usuário dela.

Na FaucetHunter esse teste passou: com a URL apontando para um endereço morto, o
claim creditou em 421 ms e respondeu `"faucetchain": null`.

---

## O que deu errado na primeira ponte

Tudo aqui aconteceu de verdade, entre 19 e 26 de setembro de 2026.

### O arquivo estava numa pasta que o build apaga

A ponte ficou sete dias em `dist/api/` sem ninguém chamar. `dist/` é saída do
Vite: o próximo `npm run build` apagaria o arquivo com o `claim.php` ainda
chamando a função — erro fatal dentro de um caminho de pagamento.

**Para a sua ponte:** o arquivo vai na pasta que o build *lê*, não na que ele
escreve.

### O SELECT explícito que não trazia a coluna

A primeira versão pedia que o `claim.php` passasse `$user['solana_address']`.
Só que `getAuthenticatedUser()` lista as colunas uma a uma, e aquela não estava
lá. A ponte seria chamada em todo claim e não faria absolutamente nada — sem
erro, sem log, sem recompensa.

**A correção virou regra:** a ponte busca o endereço sozinha, a partir do id do
usuário. Menos uma coisa para o integrador esquecer, e o `db.php` não precisa
ser tocado.

### O bug que se disfarçava de comportamento previsto

`solana_address.php` usava `FAUCETCHAIN_URL` sem dar `require` no arquivo onde a
constante é definida. A função de resolver a conta devolvia `null` sempre.

O que fez esse durar: **eu tinha escrito um caminho de fail-open para "FaucetChain
fora do ar"**, que devolve `null` também. O bug caía exatamente no ramo que eu
tinha desenhado para ser silencioso.

**Para a sua ponte:** todo caminho de fail-open precisa de um jeito de
distinguir *"a outra casa não respondeu"* de *"eu não perguntei"*. Log diferente,
no mínimo.

### Endpoint que faz rede sem teto

O endpoint de salvar a carteira consulta a FaucetChain a cada chamada. Foi para
produção sem limite de requisições — um laço o transformaria em amplificador
contra a outra casa. Ganhou `requireRateLimit($pdo, 'solana', 20, 600)`.

### O sistema de estilo que eu não conferi

A tela foi escrita com Tailwind. **A FaucetHunter não usa Tailwind.** Apareceu
sem estilo nenhum em produção.

Eu tinha lido as convenções de rede do frontend delas — `fetch`, cabeçalho de
sessão, o gerenciador de sessão — e não olhei o estilo, com um componente usando
`style={{…}}` inline aberto na tela.

**Para a sua ponte:** conferir o sistema de estilo é a primeira coisa, não a
última.

### Sem a trava de acesso direto

Os outros arquivos internos da FaucetHunter respondem 403 quando abertos pela
URL. A ponte não tinha. Ganhou.

---

## O que a FaucetChain devolve, e o que fazer com isso

### `campaigns: []` é sucesso

Significa que a torneira não está inscrita em nenhuma campanha, ou que todas
estão sem orçamento no mês. **Não trate como erro.** É a resposta mais comum de
uma integração nova e é o jeito mais fácil de concluir que está quebrada quando
não está.

### `429` é o cooldown, não falha

Cinco minutos por usuário, a mesma trava que a sua torneira provavelmente já
tem. Devolva `null` sem logar, senão o log enche de alarme falso.

### `account` pode não ser `derived`

`GET /api/auth/solana/{carteira}` devolve:

```json
{ "account": "0x…", "existing": true, "derived": "0x…", "links": 2 }
```

- **`derived`** — o que a chave pública produz sozinha, keccak256 dos últimos 20
  bytes. Aritmética pública: qualquer um calcula.
- **`account`** — onde essa carteira **de fato** entra. Normalmente igual ao
  derivado. Diferente quando alguém já vinculou a carteira a outra conta por
  assinatura, e aí é lá que o prêmio cai.

Isso é deliberado: quem ligou a Phantom pela tela de saques não deve acordar
numa conta diferente. Mas **o usuário precisa ver**, e não descobrir na hora do
saque. `derived` está na resposta justamente para você comparar sem
reimplementar keccak sobre base58.

`links` acima de 1 é pior: mais de uma conta reivindica a mesma carteira, o
vínculo mais antigo vence. É resíduo, não estado para confiar — avise e mande
conferir.

A FaucetHunter encontrou isso em produção no primeiro dia. Por isso o aviso
existe.

---

## O ambiente da torneira muda o que a ponte pode assumir

Mapeado na FaucetHunter, e cada item é uma pergunta a fazer na próxima:

- **Existe fallback sem banco?** Na FaucetHunter não existe mais: sem MySQL, as
  rotas respondem 503. Se existir, a ponte roda nos dois caminhos ou em nenhum.
- **O que o claim já exige antes de chegar na ponte?** Ali: sessão, Turnstile,
  fingerprint de navegador e anti multi-conta. A ponte só vê claims que passaram
  por tudo isso — o que muda o que ela precisa desconfiar.
- **De onde vem o IP do visitante?** Ali, de `CF-Connecting-IP` e **só** quando a
  conexão chega de um IP do Cloudflare; `X-Forwarded-For` é ignorado. Ponte que
  assume o cabeçalho errado mede a coisa errada.
- **Onde ficam os segredos?** Ali, num arquivo fora do `public_html` que faz
  `putenv()`. A ordem do `require` importa: o carregador de config tem que vir
  antes da ponte, senão `getenv()` volta vazio e ela fica inerte sem reclamar.

---

## Do lado da FaucetChain

- `test_bridge_contract.py` trava os cinco campos que o PHP lê e a derivação:
  `faucet_user_address()` e `/api/auth/solana` têm que chegar na mesma conta, ou
  o prêmio cai onde o usuário não alcança.
- Registrar a torneira devolve a chave **uma vez**.
- O programa na devnet: `64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm`.

## Ainda não resolvido

- **Nenhuma campanha financiada de verdade.** As catorze no banco dizem
  `funding: vault` e nenhum vault delas existe em chain nenhuma. Por isso
  `campaigns: []` é o resultado certo hoje.
- **O guia para outros devs** ainda não existe como documento próprio. Este
  arquivo é a matéria-prima dele.
