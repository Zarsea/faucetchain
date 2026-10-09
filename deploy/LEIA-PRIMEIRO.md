# Subir a API da FaucetChain — entrega para o DoniJR

**Prazo: 12 de outubro de 2026, 23h59 PDT.** Confirmado na fonte
(`submissionDeadline: 2026-10-13T06:59:00.000Z`).

Hoje a API roda na máquina do Zarsea atrás de um túnel ngrok. Ela caiu três
vezes só na sessão de ontem, e mesmo de pé **um juiz que abra o link no
navegador recebe a página de aviso do ngrok, não o produto** — medido: a
FaucetHunter recebe `200` porque é servidor falando com servidor, mas uma
requisição com `User-Agent` de navegador recebe o interstício. É preciso um
cabeçalho HTTP para pular, e ninguém manda cabeçalho ao clicar num link.

O que falta é um host sempre ligado com disco. Os arquivos para isso estão
nesta pasta.

---

## Por que não serverless

Foi a primeira ideia e não fecha. Quatro bloqueios, todos verificados no
código:

| O que o código faz | O que serverless dá |
|---|---|
| SQLite de 5,3 MB, **104 comandos de escrita** | disco só-leitura fora de `/tmp`, que não sobrevive entre invocações |
| `asyncio.create_task(epoch_scheduler())` dormindo 3600s | a função morre quando a resposta sai |
| WebSocket com `ConnectionManager` segurando conexões | não segura conexão |
| 5 handlers `@app.on_event("startup")` | rodam de novo a cada cold start |

O primeiro é o que mata: um livro-razão que reseta sozinho é o oposto do que
este projeto afirma ser.

**Vercel serve o explorer** (build Vite estático, e o `apiConfig.ts` já lê
`VITE_API_URL`). É só a API que precisa de outro lugar.

---

## O que está nesta pasta

- `Dockerfile` — imagem de ~200 MB, Python 3.11, sem compilador
- `entrypoint.sh` — resolve duas coisas que o container não dá de graça
- `fly.toml` — uma máquina, um volume, sempre ligada
- `.dockerignore` (na raiz) — mantém `.env`, o banco e as keypairs fora da
  imagem

Fly.io foi a escolha por volume persistente ser cidadão de primeira classe
lá. Railway serve igual. **Render no plano grátis não** — dorme por
inatividade, e o juiz pega 50 segundos de cold start.

---

## As três armadilhas

Nenhuma dá erro. Todas as três fazem o servidor subir limpo e servir coisa
errada.

### 1. O caminho do banco é relativo

`get_db_connection()` faz `sqlite3.connect('blockchain.db')` — relativo ao
**diretório de trabalho do processo**, não ao código. É por isso que o
`entrypoint.sh` faz `cd /data` e o código fica em `/app` com `PYTHONPATH`.

Errar isso: o servidor sobe, cria um banco vazio, serve zero campanhas, e
perde tudo no próximo deploy. Sem erro nenhum.

### 2. As keypairs são caminhos de arquivo, não strings

`solana_settlement.load_keypair(path)` **abre um arquivo** e lê um array JSON
de bytes. Secret manager entrega variável de ambiente.

O `entrypoint.sh` escreve as duas em `/run/keys/` (tmpfs, `umask 077`) e
aponta as variáveis para lá. Por isso os segredos se chamam
`OPERATOR_KEYPAIR_JSON` e `RELAYER_KEYPAIR_JSON`, e **não**
`SETTLEMENT_*_KEYPAIR`, que são as variáveis que o entrypoint preenche.

### 3. `/api/health` mente quando a base vetorial está fora

Ela devolve `indexer_db: "error"` sempre que `kb` é `None`, e esta imagem
deixa a base vetorial de fora de propósito — ela puxaria torch e levaria a
imagem de 200 MB para ~3 GB, para alimentar uma busca semântica que o fluxo de
liquidação nunca toca.

Por isso o health check no `fly.toml` aponta para
`/api/faucethub/faucets`, que responde 200 lendo o banco de verdade e portanto
prova que o volume está montado.

---

## O container serve a API, e só

Hoje um processo só faz as duas coisas: a API responde em `/api/*` e, no resto,
devolve o frontend de `dist/`. É por isso que o endereço do ngrok abre o
explorer no navegador.

**Depois do deploy isso se separa em dois endereços.** O `.dockerignore` deixa
`dist/` de fora da imagem de propósito — o build do frontend vai para a Vercel.
A API trata isso bem (`if os.path.isdir("dist")`, no fim do `api_server.py`):
sem a pasta, ela serve só as rotas e não quebra.

O que muda na prática:

| | Antes | Depois |
|---|---|---|
| API | ngrok → :8010 | `https://<app>.fly.dev` |
| Explorer | o mesmo endereço | a Vercel |

E o explorer precisa saber o endereço novo: é a `VITE_API_URL` no build dele,
e o domínio dele precisa estar em `ALLOWED_ORIGINS` aqui. As duas pontas, ou o
navegador toma erro de CORS.

## Os segredos

Nove variáveis. **Três são chaves privadas** e não podem aparecer em log,
imagem, ou no git.

```bash
fly secrets set \
  SOLANA_RPC_URL="..." \
  FAUCETCHAIN_RPC_URL="..." \
  PASSWORD_SALT="..." \
  SETTLEMENT_OPERATOR_TOKEN="..." \
  SETTLEMENT_CAMPAIGN_SPONSOR="..." \
  PRIVATE_KEY="..." \
  OPERATOR_KEYPAIR_JSON="$(cat /caminho/operator.json)" \
  RELAYER_KEYPAIR_JSON="$(cat /caminho/relayer.json)" \
  ALLOWED_ORIGINS="https://<o-dominio-do-explorer-na-vercel>"
```

Os valores estão no `.env` da máquina do Zarsea. Peça a ele; não estão no
repositório e não devem passar por chat.

**`ALLOWED_ORIGINS` é obrigatória e não aceita `*`.** O servidor levanta
`RuntimeError` no boot se encontrar `*` com credenciais ligadas. O padrão é
`localhost:5173`, então sem essa variável o explorer na Vercel toma erro de
CORS em tudo.

---

## O banco é estado vivo, não artefato de build

`blockchain.db` tem 5,3 MB, 39 tabelas, **6 raízes de Merkle publicadas na
devnet, 2 saques reais, e um lote (21) esperando para ser filmado**. Não é um
arquivo que se gera.

O risco aqui não é perder dados, é **divergir**: subir uma cópia e continuar
rodando a local faz os dois ledgers andarem em separado, em silêncio, e não há
como reconciliar depois.

A ordem que evita isso:

1. Zarsea **para** a API local (fecha a janela "FaucetChain - API")
2. Confere que fecha: `python reconcile.py` → `6/6 invariants hold`
3. Envia o arquivo para o volume (`fly sftp shell` ou `fly ssh console`)
4. `fly deploy`
5. Confere do lado de fora: `curl https://<app>.fly.dev/api/solana/campaigns`
   → 5 campanhas
6. A partir daí **a de produção é a única**. A local não volta a subir.

O `scripts/` tem backups datados (`blockchain.db.antes-*`) se algo der errado.

---

## Como saber que deu certo

```bash
# a API responde, lendo o banco de verdade
curl https://<app>.fly.dev/api/faucethub/faucets          # 200, 6 torneiras
curl https://<app>.fly.dev/api/solana/campaigns           # 5 campanhas

# a Solana está legível a partir do container
curl https://<app>.fly.dev/api/solana/ledger/479079       # on_chain preenchido

# e, o que o ngrok nunca deu: um NAVEGADOR recebe a API, não um aviso
curl -A "Mozilla/5.0 Chrome/131" https://<app>.fly.dev/api/faucethub/faucets
```

O último é o ponto do exercício todo.

**Depois de 1 hora de máquina no ar**, confirmar que o epoch scheduler
disparou — é a prova de que `auto_stop_machines = false` está valendo:

```bash
fly logs | grep -i epoch
```

---

## O que foi testado, e o que não

A imagem foi construída e executada em 9 de outubro, não só escrita.

| Verificação | Resultado |
|---|---|
| `docker build` | passa |
| Tamanho da imagem | **186 MB** |
| `.env` dentro da imagem | ausente |
| `blockchain.db` dentro da imagem | ausente |
| Sobe com volume montado | sim |
| `GET /api/faucethub/faucets` | **200** |
| `GET /api/solana/campaigns` | **5 campanhas, lidas do volume** |
| Keypair escrita pelo entrypoint | permissão `600`, em `tmpfs` |
| Dependências que precisam de compilador | **nenhuma** — 40 wheels, zero fonte |

**Uma coisa o teste pegou e vale você saber**, porque era uma afirmação minha
sobre chave privada: a primeira versão do entrypoint escrevia as keypairs em
`/run/keys`, dizendo que era memória. **Não é.** Dentro desta imagem, `df -T`
reporta `/run` e `/tmp` como `overlay` — a camada gravável do container, que é
disco. Só `/dev/shm` é `tmpfs`. Uma chave privada escrita no overlay toca disco
e pode sobreviver numa camada ou num snapshot.

Corrigido: as duas chaves vão para `/dev/shm/keys`, confirmado como `tmpfs` com
permissão `600`.

**O que não foi testado:** o `fly.toml` não passou pela CLI da Fly, e o deploy
em si nunca rodou. O container foi exercitado localmente, não na plataforma.

## Perguntas que só você responde

1. **Fly, Railway ou um VPS?** O `fly.toml` está pronto, mas a escolha é sua —
   o `Dockerfile` e o `entrypoint.sh` servem para os três.
2. **O explorer na Vercel sai no mesmo dia?** Se sim, o domínio dele precisa
   entrar em `ALLOWED_ORIGINS` antes, senão a primeira impressão é uma tela de
   erro de CORS.
3. **O que acontece com o túnel ngrok depois?** A FaucetHunter aponta para
   `unfrosted-ignition-ruined.ngrok-free.dev` em produção. Trocar a URL dela
   para o endereço novo é uma mudança do lado do parceiro e precisa ser
   combinada — **não desligue o túnel antes disso**, ou os claims dela param.

O item 3 é o único com risco de quebrar algo que funciona hoje.
