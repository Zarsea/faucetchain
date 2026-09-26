# Integração FaucetHunter → FaucetChain

Tudo que a FaucetHunter precisa está nesta pasta. **Nada aqui toca a árvore dela
sozinho**: são arquivos para copiar e duas edições para aplicar à mão.

```
api/faucetchain.php        → public/api/    (novo)   a ponte
api/solana_address.php     → public/api/    (novo)   onde a carteira é salva
src/SolanaAddressCard.jsx  → src/components/(novo)   a tela
sql/001_add_solana_address.sql                       a única mudança de schema
PATCHES.md                                           as 2 edições à mão
```

Se você publica pelo `deploy_hostinger.cjs` sem rodar `npm run build`, copie os
dois `.php` **também** para `dist/api/` — `dist/` é saída do Vite e é
reconstruída a partir de `public/`.

---

## O que essa integração faz

Um clique na FaucetHunter passa a valer duas vezes: o usuário recebe o que já
recebe aí, **e** a parte que lhe cabe do orçamento das campanhas de parceiros na
FaucetChain. Esse segundo valor sai do bolso do patrocinador, nunca do seu.

```
[FaucetHunter]  usuário clica, você credita como sempre
      │
      │  depois do seu commit — seu pagamento já aconteceu
      ▼
[a ponte]       POST /api/faucethub/microclaim { user_wallet, amount }
      │
      ▼
[FaucetChain]   cada campanha inscrita credita o usuário do orçamento dela
      │
      ▼
[Solana]        uma raiz cobrindo o que é devido é publicada; o programa
                recusa raiz que o vault não cobre
      │
      ▼
[usuário]       entra com a mesma carteira e saca com prova
```

O usuário nunca precisou ter SOL para chegar até aí, e você nunca adiantou nada.

---

## Passo a passo

### 1. A coluna

```sql
ALTER TABLE `fh_users`
  ADD COLUMN `solana_address` VARCHAR(50) DEFAULT NULL AFTER `faucetpay_address`;
```

Confira: `SHOW COLUMNS FROM fh_users LIKE 'solana_address';`

### 2. As duas variáveis

Vão em **`domains/faucethunter.net/faucethunter_secrets.php`** — fora do
`public_html`, que é onde o `config.php:16` já procura os segredos desta casa:

```php
putenv('FAUCETCHAIN_URL=http://localhost:8000');
putenv('FAUCETCHAIN_KEY=fch_...');
```

A ordem funciona porque o `claim.php` dá `require` no `config.php` **antes** do
`faucetchain.php`, então o `getenv()` da ponte já encontra os valores.

**Sem as duas, a ponte não faz nada e não reclama.** É de propósito: preferimos
inerte a meio ligada.

A `FAUCETCHAIN_URL` depende de onde a FaucetChain está rodando:

| FaucetHunter roda em | FAUCETCHAIN_URL |
|---|---|
| mesma máquina (XAMPP, php -S) | `http://localhost:8000` |
| Hostinger (produção) | a URL do túnel — veja *O túnel*, abaixo |

### 3. Os arquivos

Copie os três novos. Nenhum substitui nada.

### 4. As duas edições

`PATCHES.md`. Uma é a integração (duas linhas no `claim.php`), a outra é um
bypass de autenticação no `auth.php` que vale corrigir de qualquer jeito.

### 5. A tela

```jsx
import SolanaAddressCard from './SolanaAddressCard';
...
<SolanaAddressCard />
```

Em `DashboardView.jsx` ou onde fizer sentido. Ela se vira sozinha: busca o que
está salvo, salva, remove, e mostra ao usuário **qual conta da FaucetChain**
aquela carteira alcança — antes de ele precisar acreditar em nós.

### 6. Um clique de verdade

A resposta do `claim.php` passa a trazer:

```json
"faucetchain": {
  "address": "0xbae99ba0c1c7b6f0bb64e2c11221c68ad5aecdfb",
  "campaigns": []
}
```

**`campaigns: []` é sucesso**, não erro. Significa que a FaucetHunter ainda não
está inscrita em nenhuma campanha. O que prova a integração é o `address`: ele é
derivado da carteira Solana do usuário, e é onde o prêmio vai cair quando houver
campanha.

`"faucetchain": null` significa uma destas, nesta ordem de probabilidade:
o usuário não informou carteira; as variáveis não estão definidas; a coluna não
existe; a FaucetChain não respondeu. Nenhuma delas atrapalha o claim.

---

## O túnel, se a FaucetHunter roda em produção

A FaucetChain escuta em `localhost:8000`. Para a Hostinger alcançar:

```bash
ngrok http 8000
```

E **junto**, no `.env` da FaucetChain:

```
RATE_LIMIT_TRUST_LOCALHOST=0
```

Atrás de um proxy na mesma máquina, todo chamador chega como `127.0.0.1`.
Deixar a isenção ligada desliga o rate limit para a internet inteira no exato
momento em que a API deixa de ser local.

---

## As duas regras da ponte

**Depois do commit.** O pagamento da FaucetHunter está gravado antes de a
FaucetChain ser procurada.

**Engole o erro.** Timeout de 4 segundos, falha vira linha de log. Se a
FaucetChain estiver fora, o usuário recebe o claim dele e ninguém fica sabendo.

**Teste isso de propósito:** derrube a FaucetChain e faça um claim. Se a
FaucetHunter parar de pagar, a integração está errada, e quem paga a conta é o
seu usuário. É o teste mais fácil de pular por parecer redundante, e o único que
protege você em vez de nós.

`429` não é falha: é o cooldown de 5 minutos da FaucetChain, a mesma trava que
você já tem. A ponte devolve `null` sem logar — senão o log enche de alarme
falso.

---

## Do lado da FaucetChain, já pronto

- Torneira registrada, chave emitida e testada (`microclaim 200`).
- O programa na devnet, `64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm`,
  carregando a recusa de Token-2022.
- `test_bridge_contract.py` trava os cinco campos que este PHP lê, e trava a
  derivação: `faucet_user_address()` e `/api/auth/solana` têm que chegar na
  mesma conta, ou o prêmio cai onde o usuário não alcança.

## Ainda não pronto

- **Nenhuma campanha financiada de verdade.** As catorze no banco dizem
  `funding: vault` e nenhum vault delas existe em chain nenhuma — foram abertas
  contra um ledger localnet que morreu. Inscrever a FaucetHunter numa delas
  mostraria número lastreado em nada. A campanha do demo tem que ser nova.
- Por isso `campaigns: []` é o resultado esperado hoje, e está certo assim.
