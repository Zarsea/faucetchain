# Atualizar — para o DoniJR

**Revisado em 23/10/2026.** São **20 commits** parados desde o último deploy
(`9837b82`). Nada aqui é urgente como da outra vez: não há defeito no ar. É um
lote grande de melhorias que só existe no repositório.

Sobe os dois, **API e frontend**. A ordem não importa — explico no fim por quê.

---

## 1. A API

```bash
fly deploy -c deploy/fly.toml
```

Três coisas acontecem sozinhas quando o container sobe. Não precisa rodar nada
à mão, mas vale saber que existem, para reconhecer no log:

**Uma migração de banco.** `settlement_rewards` ganha a coluna
`faucet_wallet`, que registra de qual torneira veio cada crédito. Roda uma vez,
é idempotente, e não toca nas linhas antigas — elas ficam com `NULL`, que a tela
mostra como *"não registrado"*.

**Uma tabela nova.** `settlement_collections`, onde entram os saques vistos na
cadeia. Criada no startup.

**Um laço de fundo novo.** De 5 em 5 minutos ele lê as raízes publicadas na
Solana e anota os saques que ainda não estavam anotados. No log aparece como
`collection scan recorded N withdrawal(s)`. A primeira passagem vai gravar
bastante de uma vez, com a mesma data — é esperado, o campo se chama
`first_seen_at` justamente porque é quando o servidor viu, não quando a Solana
executou.

> Se quiser mudar o intervalo: `COLLECTION_SCAN_SECONDS` (padrão `300`).
> Não precisa configurar nada para funcionar.

**De quebra, o rebuild renova o armazenamento de certificados.** A imagem atual
é de 9 de outubro e as intermediárias comprometidas da eMudhra foram revogadas
no dia 17. Nossas chamadas de saída (RPC da Solana, API da FaucetHunter)
confiam nesse armazenamento. O `fly deploy` resolve isso de passagem.

### Depois que subir

```bash
fly ssh console -C "python scripts/backfill_staking_yield.py"
```

Idempotente, pode rodar de novo sem risco.

---

## 2. O frontend

Build e deploy normal na Vercel. Nenhuma variável nova.

O que muda para quem usa:

- **O seletor de idioma volta a oferecer espanhol.** Ele tinha sido removido em
  21/10 porque a tela entregava português com rótulo de espanhol. Agora são 22
  telas convertidas de verdade.
- **Datas e números seguem o idioma do app**, não mais o do navegador.
- **O painel do usuário ganha "De onde veio"**, com a torneira que originou cada
  crédito.
- A tela de liquidação para de dizer que ninguém sacou quando a cadeia diz que
  alguém sacou.

---

## 3. Por que a ordem não importa

O frontend novo chama uma rota que só existe na API nova
(`/api/solana/history/{address}`). Se ele subir primeiro, essa chamada falha
sozinha e a seção *"De onde veio"* simplesmente não aparece — o resto do painel
continua funcionando. Se a API subir primeiro, nada acontece até o frontend
chegar.

Então pode subir na ordem que for mais cômoda. Só não deixe um dos dois para
depois de amanhã, porque a diferença entre eles é uma seção faltando.

---

## 4. O que NÃO é com você

A **FaucetHunter está na Hostinger** e o PHP dela é do dono do projeto, não seu.
Se alguém te pedir para atualizar PHP ou mexer em painel de hospedagem, é pedido
no lugar errado — você só manda no servidor da FaucetChain.

---

## 5. Conferir que subiu

```bash
# a API responde e está na versão nova
curl -s https://www.faucetchain.com.br/api/mining/stats | head -c 200

# a rota nova existe (200 com lista, não 404)
curl -s -o /dev/null -w "%{http_code}\n" \
  https://www.faucetchain.com.br/api/solana/history/0x0000000000000000000000000000000000000000

# o laço de varredura está vivo
fly logs -a faucetchain-api | grep -i "collection scan"
```

O terceiro pode demorar até 5 minutos para aparecer depois do deploy, que é o
intervalo da primeira passagem.

---

## O que está em cada commit

Se precisar olhar antes de subir, os 20 em ordem cronológica:

| | |
|---|---|
| `4cdb7dc` | Piso do Node acima da RCE do Brotli; DOMPurify corrigido |
| `cfc0394` `557cabb` `92167ac` | Espanhol funcionando e de volta ao seletor |
| `e084648` | Tela de saldo lê a cadeia antes de oferecer saque |
| `9110eaf` `1510360` | Liquidação para de negar saque que a cadeia registrou |
| `8b09db0` | Qual torneira creditou cada recompensa, e no painel |
| `816c7fe` | Varredura que dá data aos saques (o laço novo) |
| `0d565ff` … `09cca76` | Tradução das telas restantes |
| `cc6cccf` | Data e número seguem o idioma do app |
| `68fa749` | Catraca contra texto preso numa língua só |

Todos passaram no CI: 25 checks verdes.
