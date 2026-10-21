# Atualizar — para o DoniJR

**Revisado em 21/10/2026, depois do seu deploy.** A API ficou certa. O que falta
é o **frontend**, e ele está com um defeito sério no ar.

---

## ⚠️ Urgente: o frontend precisa subir de novo

O bundle que está servindo hoje não guarda a sessão de ninguém. Um envelope de
`localStorage` chamava a si mesmo, a recursão estourava a pilha e um `catch`
vazio engolia o erro — sem nada no console, sem nada na tela.

O que isso quebra, agora, para todo usuário:

- **O Merit Faucet não funciona.** O claim sai sem token, leva 401 e o app
  desloga a pessoa na hora. Reproduzido em produção: a mensagem é
  *"Could not process the transaction: Your session has ended"*.
- **Nenhuma sessão sobrevive a um F5.**
- **A tela de privacidade não carrega**, pelo mesmo motivo.

Corrigido em `4f4f410`, com um teste que lê o fonte e falha se o envelope voltar
a não chamar o armazenamento. Está no CI.

```
Vercel → projeto do explorer → Redeploy, no commit 4f4f410 ou mais novo
```

Conferir depois: entrar como convidado, apertar F5. Se continuar logado, subiu.

> **Detalhe do build:** o rodapé da barra lateral mostra `dev` em vez do commit.
> O `git rev-parse` falhou no ambiente de build e a variável da Vercel também
> veio vazia. Não quebra nada, mas enquanto estiver assim não dá para saber pela
> tela qual versão está no ar — que é justamente para o que esse campo existe.

---

## O que já está certo

Conferido de fora: `/api/account/identities` responde **401** (existe e pede
sessão), e `/api/staking/stats` traz `epochPool: 200.0` com os pesos dos tiers.
A API está no código novo.

---

## O que o seu deploy já mudou

A maior era o **staking**. Ele pagava uma taxa por posição — 0,5% em 1 hora,
2% em 24h, 10% em 7 dias — e isso não é recompensa, é emissão proporcional ao
depósito. Quem tivesse 400.000 $CLAIM presos emitia 2.000/hora sozinho, que é a
emissão programada da rede inteira, e nada no código olhava para isso.

Agora o rendimento sai de um pool fixo de 200/hora, rateado. Depositar mais
deixou de emitir mais. O cofre estava vazio na hora da troca, então ninguém
perdeu rendimento acumulado.

Também subiram: vinculação de conta Google, painel de carteira, a skill de
integração para agentes, correções de texto em telas que afirmavam coisas que o
código não faz, e acessibilidade.

## 1. Deploy da API — ✅ feito

```bash
git pull
fly deploy -c deploy/fly.toml
```

Conferido de fora: a API está no código novo.

## 2. O backfill — rode se ainda não rodou

Daqui de fora não dá para ver se isto já rodou, e rodar de novo não faz mal:
o script escreve a diferença, então a segunda execução não escreve nada.

Há 184,5 $CLAIM de rendimento antigo que o contador de supply não enxerga. Eles
foram pagos pelo caminho velho, que gravava em `transactions`, e o contador novo
lê `staking_rewards`. Sem esta linha, `get_total_minted` subestima o supply para
sempre.

```bash
fly ssh console -a faucetchain-api
cd /app

python scripts/backfill_staking_yield.py --self-check   # banco de brinquedo, não toca no seu
python scripts/backfill_staking_yield.py --dry-run      # mostra e não escreve
python scripts/backfill_staking_yield.py                # escreve
```

Três coisas que o script já resolve sozinho, para você não precisar lembrar:

- **Acha o banco certo.** Ele usa `$DATA_DIR/blockchain.db`, que é onde o
  `entrypoint.sh` põe o ledger vivo. A imagem também carrega uma cópia velha em
  `/app` pelo `COPY . .`; apontar para ela mexeria no arquivo errado e diria que
  deu certo.
- **Rodar antes do deploy não quebra nada.** A tabela `staking_rewards` nasce no
  startup do código novo; sem ela o script avisa e sai com código 2.
- **Rodar duas vezes não soma duas vezes.** Ele escreve a diferença entre o que
  deveria estar gravado e o que já está, então a segunda execução não escreve
  nada.

---

## 3. O CORS da FaucetHunter — ✅ feito

O preflight de `faucethunter.net` responde **200**. Era 400, e era por isso que
a FaucetHunter dizia que a FaucetChain estava offline enquanto ela estava de pé.

## 4. Conferir

```bash
# o staking novo está no ar
curl -s https://www.faucetchain.com.br/api/staking/stats | grep epochPool

# a tela de privacidade existe (401 = existe e pede sessão; 404 = não subiu)
curl -s -o /dev/null -w "%{http_code}\n" https://www.faucetchain.com.br/api/account/identities

# o CORS da FaucetHunter
curl -s -i -X OPTIONS https://www.faucetchain.com.br/api/faucethub/microclaim/balance/0x0 \
  -H "Origin: https://faucethunter.net" \
  -H "Access-Control-Request-Method: GET" | head -1
```

| Comando | Esperado | Hoje |
|---|---|---|
| `epochPool` | aparece | ✅ `200.0` |
| `/api/account/identities` | **401** | ✅ 401 |
| preflight do CORS | **200** | ✅ 200 |

Os três já passam. **O que falta não é checável por `curl`**, porque mora no
navegador:

1. Abra `www.faucetchain.com.br` e entre como convidado.
2. Aperte **F5**.
3. Se continuar logado, o frontend novo subiu. Se cair para "Connect Wallet", o
   bundle velho ainda está no ar.

O mesmo teste cobre o Merit Faucet: com o bundle velho, o claim responde 401 e
desloga; com o novo, credita e a pessoa continua dentro.

E o rodapé da barra lateral passa a mostrar o commit do build em vez de `dev` —
a forma mais rápida de saber qual versão está no ar sem abrir terminal.

---

## Se alguma coisa der errado

O deploy é reversível: `fly releases -a faucetchain-api` lista as versões e
`fly deploy --image <a anterior>` volta.

O backfill escreve **uma linha** em `staking_rewards`, com `epoch_id = 0`. Para
desfazer, `DELETE FROM staking_rewards WHERE epoch_id = 0`. A distribuição normal
nunca usa o epoch 0 — ela faz `MAX(epoch_id) + 1` e começa em 1 — então essa
linha não se confunde com nenhuma outra.

O CI está verde em `12b440f`, nos dois jobs: `Sequencer and settlement` e
`Solana program`.
