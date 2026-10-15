# Pendências

Lista viva. O que foi achado e ainda não foi resolvido, com dono e o que já se
sabe sobre a causa. Item resolvido sai daqui e vira commit.

Origem desta leva: varredura das 20 seções em produção + ambiente Dapps,
14/10/2026 (`tests/varredura_ui.mjs` e `tests/varredura_dapps.mjs`), mais a
revisão do Donizete de 15/10.

---

## Em aberto

### 1. Desligar o Web Analytics da Cloudflare — Donizete

**Decidido em 15/10.** O CSP fica como está; o Web Analytics sai.

No painel da Cloudflare, em `faucetchain.com.br` → **Analytics & Logs** → **Web
Analytics**, desligar o site. Isso remove o script `beacon.min.js` que a Cloudflare
injeta na página, e com ele o erro vermelho no console.

**Por que não o contrário.** Liberar `static.cloudflareinsights.com` no CSP, como
foi feito no servidor para calar o erro, desfaz uma mitigação que existe por causa
de um achado do próprio Donizete, de 10/10: o token de sessão fica sete dias no
`localStorage`, então um XSS futuro o roubaria. A correção de raiz é cookie
`HttpOnly` e continua por fazer. O que dá para fechar sem ela é a **saída** —
roubar o token exige mandá-lo para fora, e `connect-src 'self'` faz o navegador
recusar fetch, XHR, WebSocket e beacon de imagem para domínio de terceiro.

`tests/test_security_fixes.py` guarda isso e falha com "host externo na saida" se
alguém liberar o domínio. O teste foi escrito para pegar essa mudança, e pegou.

**Conferir depois:** abrir `www.faucetchain.com.br` com o DevTools e confirmar que
não há mais erro de CSP sobre `cloudflareinsights`. Enquanto o Analytics estiver
ligado e o CSP fechado, o erro continua.

**O que se perde:** a contagem de acesso da Cloudflare. Se ela fizer falta, a
alternativa sem custo de segurança é trocar o `localStorage` por cookie `HttpOnly`
e aí liberar o beacon — correção de raiz, trabalho de verdade, e não urgente.

## Resolvido

- ~~"O WebSocket nunca conecta"~~ → resolvido 15/10, e a explicação que estava
  aqui antes estava **errada**. Ela dizia que o WebSocket nunca esteve quebrado e
  que só o meu teste falhava. Metade disso era verdade e a outra metade escondia
  uma dependência que faltava.

  O que de fato acontecia: **o `uvicorn` não serve WebSocket sozinho.** Sem
  `websockets` ou `wsproto` instalado ele sobe, responde, e recusa o upgrade. O
  `requirements.txt` trazia `uvicorn` e nenhum dos dois, então numa instalação
  limpa a rota `/ws/network` falhava sempre. No servidor funcionou porque o
  Donizete instalou a lib à mão dentro do container; aqui funcionava porque ela
  já estava no venv por outro caminho. `websockets==15.0.1` entrou no
  `requirements.txt` em 15/10.

  O meu teste também estava errado, e é por isso que eu não vi o resto: a
  Cloudflare negocia HTTP/2, e em HTTP/2 o cabeçalho `Upgrade` não existe — ele é
  ignorado, a requisição vira um GET comum, e o 404 é a resposta correta a isso.
  Depois que o Donizete corrigiu o container, rodei de novo com `--http1.1`, vi
  `101 Switching Protocols`, e **atribuí o sucesso ao meu teste consertado em vez
  da correção dele**. A conclusão "nunca esteve quebrado" nasceu de medir depois
  do conserto sem saber que houve conserto.

  Ficam duas lições, e a segunda é a cara:

  1. Teste de diagnóstico precisa ser provado contra um caso que sabidamente
     funciona, senão reprova o que está certo.
  2. **Medir depois que outra pessoa mexeu, sem saber que mexeu, faz o
     observador atribuir a si o conserto alheio** — e, pior, enterra a causa
     real. Aqui isso quase deixou uma dependência obrigatória fora do repositório.

  O comando correto, se precisar de novo:

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
