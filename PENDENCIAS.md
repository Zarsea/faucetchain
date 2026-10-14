# Pendências

Lista viva. O que foi achado e ainda não foi resolvido, com dono e o que já se
sabe sobre a causa. Item resolvido sai daqui e vira commit.

Origem desta leva: varredura das 20 seções em produção + ambiente Dapps,
14/10/2026 (`tests/varredura_ui.mjs` e `tests/varredura_dapps.mjs`).

---

## Infraestrutura — Donizete

### 1. O CSP bloqueia o beacon da Cloudflare

`connect-src 'self'` barra o `static.cloudflareinsights.com/beacon.min.js`. Erro
vermelho no console de quem abrir o DevTools.

**Decisão a tomar:** ou libera o domínio no CSP, ou desliga o Web Analytics da
Cloudflare. Cosmético, mas é a primeira coisa que um avaliador técnico vê.

---

## Desempenho — sem dono ainda

### 2. Carga inicial de 6790ms

É o número que mais pesa na primeira impressão e eu não investiguei a causa.
O bundle passa de 500kB (o Vite avisa no build). Candidatos: falta de
code-splitting, Tailwind via CDN, Mermaid no bundle principal.

### 3. "Solana Program" renderiza em 1190ms com zero chamadas de API

Não é rede e não é Mermaid — esse componente não tem nenhum diagrama. É
renderização pura e a causa é desconhecida. Vale um profile antes de mexer.

### 4. "Tokenomics" em 1417ms

Tem Mermaid, que compila o diagrama na thread principal. Candidato a
renderização assíncrona ou a imagem pré-renderizada.

---

## Produto

### 5. Usuário novo não encontra nenhuma torneira

`GET /api/faucethub/microclaim/balance/{wallet}` filtra `virtual_balance > 0`.
Quem chega com zero em tudo vê *"Nenhum saldo virtual pendente"* e não recebe
caminho nenhum.

O quadro público no portão (corrigido em 14/10) ajuda, mas só aparece para quem
abre a FaucetHub. A tela de saldo em si continua muda para quem tem zero.

---

## Resolvido

- ~~Cabeçalhos de segurança duplicados~~ → Transform Rules removidas da
  Cloudflare, 14/10. CSP e HSTS voltam uma vez cada.
- ~~`site_url` da FaucetHunter vazio em produção~~ → gravado, 14/10. A API
  devolve `https://faucethunter.net` e o botão aparece.
- ~~"O WebSocket nunca conecta"~~ → **nunca esteve quebrado.** O erro era o meu
  teste: a Cloudflare negocia HTTP/2, e em HTTP/2 o cabeçalho `Upgrade` não
  existe — ele é ignorado, a requisição vira um GET comum, e o 404 é a resposta
  correta. O navegador abre WebSocket em HTTP/1.1. Com `--http1.1` o servidor
  responde `101 Switching Protocols`, e um WebSocket real abre normalmente.

  Fica a lição: **teste de diagnóstico também precisa ser testado contra um caso
  que sabidamente funciona**, senão ele reprova o que está certo. O comando
  correto, se precisar de novo:

  ```bash
  curl -s -i --http1.1 -H "Connection: Upgrade" -H "Upgrade: websocket"     -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=="     https://www.faucetchain.com.br/ws/network | head -1
  ```

- ~~Diagrama principal dizia "20 para o minerador"~~ → é a tesouraria, corrigido 14/10
- ~~Diagrama principal mostrava o desafio no navegador como caminho da torneira
  parceira~~ → é o caminho da torneira interna, separado 14/10
- ~~`HUB_INTEGRATION_DIAGRAM` começava na chamada HTTP~~ → agora mostra que a
  torneira paga primeiro, no trilho dela, 14/10
- ~~O portão da FaucetHub prometia um quadro público e não mostrava nada~~ → os
  dados já estavam em memória; agora o quadro aparece, 14/10
- ~~Não havia caminho da FaucetChain de volta até a torneira~~ → `site_url` ponta
  a ponta, 14/10 (falta o deploy, item 4)
