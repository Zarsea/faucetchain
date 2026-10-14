# Pendências

Lista viva. O que foi achado e ainda não foi resolvido, com dono e o que já se
sabe sobre a causa. Item resolvido sai daqui e vira commit.

Origem desta leva: varredura das 20 seções em produção + ambiente Dapps,
14/10/2026 (`tests/varredura_ui.mjs` e `tests/varredura_dapps.mjs`).

---

## Infraestrutura — Donizete

### 1. O WebSocket nunca conecta

`wss://www.faucetchain.com.br/ws/network` devolve **404** em toda seção. As
atualizações de bloco em tempo real não funcionam, e ninguém percebe: o front
tem reconexão automática com backoff, então ele tenta para sempre em silêncio.

**O que já se sabe:** a rota existe no servidor (`@app.websocket("/ws/network")`,
`api_server.py:947`). O 404 volta com o nosso próprio CSP e HSTS no cabeçalho e
com `content-type: application/json` — ou seja, **a requisição chegou na nossa
API** e o FastAPI é que respondeu. Não é a Cloudflare bloqueando.

A leitura é que ela chegou como HTTP comum, sem `Upgrade`/`Connection` — algo na
frente removeu esses cabeçalhos. Suspeitos, nessa ordem: a configuração de
ingress do túnel Cloudflare, e o proxy reverso (se houver um) sem
`proxy_set_header Upgrade $http_upgrade` e `Connection "upgrade"` com HTTP/1.1.

**Como conferir depois de mexer:**
```bash
curl -s -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://www.faucetchain.com.br/ws/network | head -1
```
Esperado: `HTTP/1.1 101 Switching Protocols`. Hoje devolve `404`.

### 2. Cabeçalhos de segurança duplicados

`content-security-policy`, `strict-transport-security` e `referrer-policy` vêm
**duas vezes** em toda resposta.

**O que já se sabe:** o nosso middleware está registrado uma vez só
(`api_server.py:151`). A segunda cópia vem de fora — provável Transform Rules ou
Managed Headers na Cloudflare.

**Por que importa:** navegador aplica a **interseção** de CSPs múltiplos, que é
mais restritiva que qualquer uma das duas isoladamente. Hoje as duas parecem
iguais, mas no dia em que divergirem o comportamento fica difícil de explicar.

### 3. O CSP bloqueia o beacon da Cloudflare

`connect-src 'self'` barra o `static.cloudflareinsights.com/beacon.min.js`. Erro
vermelho no console de quem abrir o DevTools.

**Decisão a tomar:** ou libera o domínio no CSP, ou desliga o Web Analytics da
Cloudflare. Cosmético, mas é a primeira coisa que um avaliador técnico vê.

### 4. Gravar o `site_url` da FaucetHunter em produção

Ver `deploy/DEMANDA-link-torneira.md`, passo 2. A migração cria a coluna vazia e
as torneiras já cadastradas ficam sem botão. Sem esse `UPDATE`, o deploy não muda
nada visível.

---

## Desempenho — sem dono ainda

### 5. Carga inicial de 6790ms

É o número que mais pesa na primeira impressão e eu não investiguei a causa.
O bundle passa de 500kB (o Vite avisa no build). Candidatos: falta de
code-splitting, Tailwind via CDN, Mermaid no bundle principal.

### 6. "Solana Program" renderiza em 1190ms com zero chamadas de API

Não é rede e não é Mermaid — esse componente não tem nenhum diagrama. É
renderização pura e a causa é desconhecida. Vale um profile antes de mexer.

### 7. "Tokenomics" em 1417ms

Tem Mermaid, que compila o diagrama na thread principal. Candidato a
renderização assíncrona ou a imagem pré-renderizada.

---

## Produto

### 8. Usuário novo não encontra nenhuma torneira

`GET /api/faucethub/microclaim/balance/{wallet}` filtra `virtual_balance > 0`.
Quem chega com zero em tudo vê *"Nenhum saldo virtual pendente"* e não recebe
caminho nenhum.

O quadro público no portão (corrigido em 14/10) ajuda, mas só aparece para quem
abre a FaucetHub. A tela de saldo em si continua muda para quem tem zero.

---

## Resolvido

- ~~Diagrama principal dizia "20 para o minerador"~~ → é a tesouraria, corrigido 14/10
- ~~Diagrama principal mostrava o desafio no navegador como caminho da torneira
  parceira~~ → é o caminho da torneira interna, separado 14/10
- ~~`HUB_INTEGRATION_DIAGRAM` começava na chamada HTTP~~ → agora mostra que a
  torneira paga primeiro, no trilho dela, 14/10
- ~~O portão da FaucetHub prometia um quadro público e não mostrava nada~~ → os
  dados já estavam em memória; agora o quadro aparece, 14/10
- ~~Não havia caminho da FaucetChain de volta até a torneira~~ → `site_url` ponta
  a ponta, 14/10 (falta o deploy, item 4)
