# Atualizar a API — para o DoniJR

**Escrito em 21/10/2026.** Produção roda `4bfc423`; o repositório está em
`12b440f`. São **17 commits** parados, 36 arquivos, 3.260 linhas.

Conferido agora, de fora, e não pela memória: `/api/account/identities` responde
404 e `/api/staking/stats` não traz `epochPool`. As duas coisas aparecem depois
que isto subir, e servem de prova de que subiu.

---

## O que muda para quem usa

A maior é o **staking**. Hoje ele paga uma taxa por posição — 0,5% em 1 hora,
2% em 24h, 10% em 7 dias — e isso não é recompensa, é emissão proporcional ao
depósito. Quem tivesse 400.000 $CLAIM presos emitia 2.000/hora sozinho, que é a
emissão programada da rede inteira, e nada no código olhava para isso.

Depois do deploy o rendimento sai de um pool fixo de 200/hora, rateado. Depositar
mais deixa de emitir mais.

**O cofre está vazio neste momento** (`totalLocked 0`), então ninguém perde
rendimento acumulado na troca. É o melhor momento possível para subir.

O resto: vinculação de conta Google numa tela de privacidade, painel de carteira
no lugar do endereço escrito por extenso no cabeçalho, a skill de integração
para agentes, correções de texto em telas que afirmavam coisas que o código não
faz, e acessibilidade.

---

## 1. Deploy

```bash
git pull
fly deploy -c deploy/fly.toml
```

Nada de novo aqui: é o mesmo caminho de sempre, uma máquina, um volume.

---

## 2. O backfill — **depois** do deploy

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

## 3. O CORS da FaucetHunter — pendente faz dias

O preflight de `faucethunter.net` responde **400**. É por isso que a FaucetHunter
diz que a FaucetChain está offline enquanto ela está de pé: o JavaScript não
distingue preflight recusado de servidor fora do ar.

```bash
fly secrets set ALLOWED_ORIGINS="<os valores de hoje>,https://faucethunter.net,https://www.faucethunter.net" -a faucetchain-api
```

> **Atenção, e isto derruba o site se passar batido:** `fly secrets set`
> **substitui o valor inteiro**, não acrescenta. E `fly secrets list` só mostra os
> nomes, nunca os valores — por design.
>
> Se você não tiver a lista atual anotada, **me mande antes de rodar**. Mandando
> só o faucethunter, o site principal para de funcionar na hora.

---

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

| Comando | Esperado |
|---|---|
| `epochPool` | aparece (hoje não existe) |
| `/api/account/identities` | **401** (hoje é 404) |
| preflight do CORS | **200** (hoje é 400) |

E, na tela, o rodapé da barra lateral passa a mostrar o commit do build. É a
forma mais rápida de saber qual versão está no ar sem abrir terminal.

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
