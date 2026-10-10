# O deploy subiu com o banco vazio — como corrigir

**Para o DoniJR. 10/10/2026.**

`www.faucetchain.com.br` está no ar, o TLS está certo e **o frontend é o
correto** — o bundle servido é byte a byte o mesmo que o do repositório, e o
logo novo chegou. Isso tudo está bom e não precisa mexer.

O problema é um só: **o `blockchain.db` não chegou ao volume**, e o
`entrypoint.sh` criou um vazio no lugar.

---

## Como eu sei

Cinco rotas, todas de fora:

```
GET  /api/faucethub/faucets    →  []
GET  /api/solana/campaigns     →  {"campaigns":[]}
GET  /api/solana/batches       →  {"batches":[]}
GET  /api/solana/tokens        →  {"tokens":[]}
POST /api/solana/relay/prepare →  "No reward for this address in that batch"
```

O banco de verdade tem **22 lotes, 28 campanhas e 120 recompensas**.

Isto é exatamente o caso que o `LEIA-PRIMEIRO.md` descreve na seção *"O banco é
estado vivo, não artefato de build"*: o servidor sobe limpo, responde 200 em
tudo, e **não dá erro nenhum**. É por isso que passa despercebido.

No log do teu boot deve haver esta linha, que o `entrypoint.sh` imprime:

```
WARNING: /data/blockchain.db does not exist.
         The server will create an empty ledger and serve nothing.
```

---

## A correção

O arquivo tem **5.476.352 bytes**. Confere a integridade depois de copiar:

```
sha256  fd616f9165b6499666e0b4b596fab47bef8f8475358847d33710ec13df953ae6
```

O destino é o diretório que o `entrypoint.sh` usa como working directory —
`$DATA_DIR`, que por padrão é `/data`. O `get_db_connection()` chama
`sqlite3.connect('blockchain.db')` com caminho **relativo**, então é o working
directory que decide onde o banco vive. Tem que ser um volume que sobrevive a
restart, não a camada de escrita do container.

### Docker na tua máquina (é o teu caso)

```bash
# onde o volume esta montado
docker ps
docker inspect <container> --format '{{json .Mounts}}'
```

Se aparecer uma pasta do host no `Source` (algo como
`-v /home/voce/faucetchain/data:/data`), **o caminho mais simples é copiar
direto nessa pasta**, com o container parado:

```bash
docker stop <container>
rm -f /caminho/do/host/blockchain.db-wal /caminho/do/host/blockchain.db-shm
cp blockchain.db /caminho/do/host/blockchain.db
docker start <container>
```

Se for volume nomeado do Docker, sem pasta do host:

```bash
docker stop <container>
docker cp blockchain.db <container>:/data/blockchain.db
docker start <container>
docker exec <container> sha256sum /data/blockchain.db
```

**Para o container antes de copiar.** Trocar o arquivo embaixo de um SQLite
aberto deixa o processo lendo um banco que já não existe, e o que ele escrever
depois vai para lugar nenhum.

### Se não estiver em Docker, e sim python direto

O banco vai na pasta de onde o `uvicorn` foi iniciado — `get_db_connection()`
usa caminho **relativo**. Para o processo, copia o arquivo por cima, sobe de
novo.

### Se um dia for Fly.io

```bash
fly sftp shell -a <app>
put /caminho/local/blockchain.db /data/blockchain.db
fly ssh console -a <app> -C "sha256sum /data/blockchain.db"
fly apps restart <app>
```

**Cuidado com os arquivos ao lado.** Se existirem `blockchain.db-wal` ou
`blockchain.db-shm` no destino, apaga os dois junto com o banco velho antes de
copiar o novo. Um WAL órfão de outro banco corrompe a leitura.

---

## Tem um segundo problema, menor

```
GET /api/solana/relayer  →  "balance_lamports": null
```

Esse campo é lido da Solana. `null` significa que a leitura falhou, e pode ser
uma de três coisas:

1. `SETTLEMENT_RELAYER_KEYPAIR` não está apontando para um arquivo válido
2. `solders` não instalou na imagem
3. o RPC não está acessível de dentro do container

O código engole a exceção, então de fora não dá para distinguir. **No teu log
tem a resposta**, nesta linha:

```
Could not read the relayer balance: <motivo>
```

Manda o `<motivo>` que eu digo qual das três é. Lembrando que o
`entrypoint.sh` só define `SETTLEMENT_RELAYER_KEYPAIR` se
`RELAYER_KEYPAIR_JSON` estiver presente — se o secret não foi definido, a
variável simplesmente não existe e nada avisa.

---

## Como saber que deu certo

```bash
curl https://www.faucetchain.com.br/api/faucethub/faucets     # lista, nao []
curl https://www.faucetchain.com.br/api/solana/campaigns      # 5 campanhas
curl https://www.faucetchain.com.br/api/solana/batches        # 22 lotes
curl https://www.faucetchain.com.br/api/solana/relayer        # balance_lamports com numero
```

A quarta é a que diz se o segundo problema foi junto.

E uma que vale a pena, porque prova que a Solana é legível de dentro do
container:

```bash
curl https://www.faucetchain.com.br/api/solana/ledger/652608
```

Tem que vir `"on_chain"` preenchido, com `root_count: 2`. Se vier nulo, o
container não está conseguindo ler a devnet.

---

## O notebook é o risco maior, e não é sobre hoje

Isto não é crítica ao que foi feito: subiu rápido, o domínio está certo e o
TLS funciona. É sobre o que acontece depois que a gente fechar o laptop.

O `LEIA-PRIMEIRO.md` começa dizendo por que esta entrega existe: *"a API roda na
máquina do Zarsea atrás de um túnel ngrok. Ela caiu três vezes."* Trocamos um
notebook com ngrok por outro notebook com Cloudflare. O túnel ficou melhor; a
máquina embaixo dele continua sendo um notebook.

Os juízes abrem o link quando quiserem, inclusive de madrugada e inclusive
depois do prazo. Se o notebook dormir, perder o wi-fi, atualizar o Windows ou
só fechar, o que eles veem é uma página morta — e nada avisa ninguém.

**O mínimo, se for ficar no notebook:**

- desligar suspensão e hibernação, inclusive ao fechar a tampa
- manter na tomada e no cabo de rede, não no wi-fi
- subir o container com `--restart unless-stopped`
- o túnel da Cloudflare como serviço (`cloudflared service install`), não como
  comando numa janela aberta
- desligar reinício automático por atualização do sistema

**O que resolve de vez:** o `Dockerfile` e o `fly.toml` nesta pasta foram
escritos para isso. A imagem é a mesma que já está rodando aí; é `fly launch`
com o `fly.toml` existente, os sete secrets, e subir o banco. Quem já
containerizou faz em menos de meia hora, e aí o link não depende de ninguém
estar acordado.

---

## Até lá, ninguém usa o site

Enquanto o banco vazio estiver no ar, **toda escrita que acontecer nele se
perde** quando o arquivo certo for colocado por cima — e os dois ledgers passam
a divergir sem alarme. Se alguém se cadastrar, reivindicar ou sacar agora, esse
registro some.

Se não der para corrigir já, é melhor derrubar o app do que deixá-lo
aceitando escrita.
