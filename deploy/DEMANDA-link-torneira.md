# Demanda: caminho de volta até a torneira

**Para:** Donizete
**O que é:** uma coluna nova no banco, duas telas que passam a ter link, e um
`UPDATE` que você precisa rodar à mão.
**Risco:** baixo. Nada é removido, nada muda de formato. Se a coluna ficar vazia,
a tela volta a se comportar exatamente como hoje.

---

## O problema que isso resolve

O painel mostrava os fundos da FaucetHunter e o usuário não tinha como chegar lá.
Pior: no card de saldo, quando o valor estava abaixo do mínimo de saque, a tela
escrevia **"Abaixo do mín."** e encerrava a conversa — o usuário descobria que não
podia sacar e não descobria o que fazer a respeito.

A causa é simples: `faucet_registry` guardava `name`, `wallet_address` e
`registered_at`. Nunca guardou uma URL. Não existia o dado para montar o link.

---

## O que muda

**Banco:** uma coluna `site_url TEXT` em `faucet_registry`. A migração roda sozinha
no start (padrão `ALTER TABLE` dentro de `try`, igual às outras do arquivo).

**API:** `site_url` passa a ser aceito em `POST /api/faucethub/register` e devolvido
em `GET /api/faucethub/faucets`. O endpoint de saldo
(`GET /api/faucethub/microclaim/balance/{wallet}`) ganha três campos:

```
site_url              para onde mandar o usuário
missing_to_withdraw   quanto falta até o mínimo (não o mínimo)
next_claim_at         quando o cooldown de 300s libera
```

**Tela:** o card de saldo passa a ter três estados em vez de um:

```
pode sacar         [ Sacar → L1 ]
em cooldown        [ Libera em 3m12s ]
abaixo do mínimo   [ Claimar em FaucetHunter → ]  + "Faltam 8,5 para sacar"
```

E a lista de torneiras ganha um botão `claimar →` ao lado do nome.

Torneira sem `site_url` continua mostrando o texto morto de antes. Isso é
proposital: link quebrado é pior que link nenhum.

---

## Passo a passo

### 1. Puxar e subir

```bash
cd <diretório do projeto>
git pull
docker compose build
docker compose up -d
```

A migração da coluna acontece sozinha quando a API sobe. Não precisa rodar nada.

### 2. ⚠ Gravar a URL da FaucetHunter — este é o passo que não é automático

A migração **cria a coluna vazia**. As torneiras já cadastradas ficam com
`site_url = NULL` e **continuam sem botão**. Sem este passo, o deploy não muda
nada visível e vai parecer que não funcionou.

```bash
docker compose exec <serviço-da-api> sqlite3 blockchain.db \
  "UPDATE faucet_registry SET site_url = 'https://faucethunter.net' WHERE name = 'FaucetHunter';"
```

Se o container não tiver `sqlite3`, dá para fazer por Python:

```bash
docker compose exec <serviço-da-api> python -c \
  "import sqlite3;c=sqlite3.connect('blockchain.db');c.execute(\"UPDATE faucet_registry SET site_url='https://faucethunter.net' WHERE name='FaucetHunter'\");c.commit();print('linhas:',c.total_changes)"
```

Tem que imprimir `linhas: 1`.

### 3. Conferir

```bash
curl -s https://www.faucetchain.com.br/api/faucethub/faucets | grep -o '"site_url":"[^"]*"'
```

Esperado: pelo menos um `"site_url":"https://faucethunter.net"`.

Se vier só `"site_url":null`, o passo 2 não pegou.

---

## Se der errado

Nada aqui é destrutivo. Para voltar ao estado anterior basta subir o commit antigo:
a coluna fica no banco sem incomodar ninguém, e as telas param de usá-la.

Para desligar o botão sem fazer rollback de código, é só esvaziar a coluna:

```sql
UPDATE faucet_registry SET site_url = NULL;
```

A tela volta a mostrar "Abaixo do mín." como hoje.

---

## O que foi testado aqui antes de mandar

```
tests/test_security_fixes.py    17/17   (nenhuma regressão de segurança)
tests/test_faucet_site_url.py    6/6    (o caminho novo, ponta a ponta)
npx tsc --noEmit                 limpo
npx vite build                   ok, 20.9s
```

O teste novo cobre inclusive o caso de URL em branco virar `NULL` em vez de string
vazia — era por aí que um link quebrado entraria na tela.
