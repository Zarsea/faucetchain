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

## Resolvido

- ~~Carga inicial de 6790ms~~ → bundle de entrada de **2210 KB para 1744 KB**,
  14/10. Sete telas passaram a carregar sob demanda, e o `recharts` (337 KB) saiu
  da primeira pintura junto com os modulos do d3 que ele puxa. O numero final em
  producao so da para medir depois do deploy: 6790ms foi medido com rede real.

- ~~Usuario novo nao encontra nenhuma torneira~~ → resolvido, 14/10. Saldo zero
  agora oferece as torneiras com link, em vez de dizer "nada pendente" e parar.

- ~~"Solana Program" renderiza em 1190ms com zero chamadas~~ e
  ~~"Tokenomics" em 1417ms~~ → **nao existiam.** Remedindo com todas as
  requisicoes visiveis, e nao so as de `/api/`: Solana Program leva **159ms** com
  1 requisicao, Tokenomics **257ms** com 8. Os chunks do Mermaid carregam na
  primeira tela que precisa deles, e na varredura original essas duas calhavam de
  estar no fim da sequencia — herdaram um custo que qualquer tela teria pago. O
  Dashboard, que na primeira medicao aparecia com 141ms, agora marca 629ms pelo
  mesmo motivo, so que invertido.

  Fica a lição, que é a mesma do WebSocket: **medicao que filtra o que observa
  mede o filtro, nao o sistema.** Contar so `/api/` escondeu exatamente o que
  causava a lentidao.

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
