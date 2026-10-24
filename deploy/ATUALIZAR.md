# Atualizar — para o DoniJR

**23/10/2026.** 21 commits parados desde o último deploy (`9837b82`).
Nada quebrado no ar: é um lote de melhorias que só existe no repositório.

Sobe os dois. A ordem não importa.

---

## Checklist

- [ ] **1. API**

  ```bash
  fly deploy -c deploy/fly.toml
  ```

- [ ] **2. Frontend**

  Build e deploy normal na Vercel. Nenhuma variável nova.

- [ ] **3. Backfill do staking** — só se ainda não tiver rodado

  ```bash
  fly ssh console -C "python scripts/backfill_staking_yield.py --dry-run"
  ```

  Se disser que não há nada a fazer, está feito, pula. Se listar valores, roda
  de novo sem o `--dry-run`. É idempotente nos dois casos.

- [ ] **4. Conferir**

  ```bash
  # a rota nova existe (200, não 404)
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://www.faucetchain.com.br/api/solana/history/0x0000000000000000000000000000000000000000

  # o laço novo está vivo (pode levar 5 min para aparecer)
  fly logs -a faucetchain-api | grep -i "collection scan"
  ```

---

## O que sobe sozinho com a API

Não precisa rodar nada. É para você reconhecer no log, não estranhar:

| | |
|---|---|
| **Migração** | `settlement_rewards` ganha a coluna `faucet_wallet`. Roda uma vez. Linhas antigas ficam `NULL`, e a tela mostra "não registrado". |
| **Tabela nova** | `settlement_collections`, criada no startup. |
| **Laço novo** | De 5 em 5 min lê as raízes na Solana e anota saques novos. Log: `collection scan recorded N withdrawal(s)`. |

**A primeira passagem do laço grava muita coisa de uma vez, com a mesma data.**
Parece errado e não é: o campo chama `first_seen_at` porque registra quando o
servidor viu, não quando a Solana executou.

Intervalo configurável em `COLLECTION_SCAN_SECONDS` (padrão `300`). Não precisa
mexer.

---

## Por que o rebuild importa além do código

A imagem no ar é de 9 de outubro. As intermediárias comprometidas da eMudhra
foram revogadas no dia 17, e nossas chamadas de saída confiam no armazenamento
de certificados que está dentro da imagem. O `fly deploy` renova isso de
passagem.

---

## Por que a ordem não importa

O frontend novo chama uma rota que só existe na API nova
(`/api/solana/history/{address}`). Se ele subir antes, essa chamada falha
sozinha e a seção "De onde veio" não aparece. O resto do painel funciona. Se a
API subir antes, nada acontece até o frontend chegar.

---

## O que muda para quem usa

- **O seletor de idioma volta a oferecer espanhol.** 22 telas convertidas.
- **Datas e números seguem o idioma do app**, não o do navegador.
- **Painel do usuário ganha "De onde veio"**, com a torneira de cada crédito.
- A tela de liquidação para de dizer que ninguém sacou quando a cadeia diz que
  alguém sacou.
- Node atualizado contra a RCE do Brotli; DOMPurify corrigido.

CI verde nos 25 checks.
