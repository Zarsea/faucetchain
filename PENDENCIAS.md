# Pendências

Lista viva. O que foi achado e ainda não foi resolvido, com dono e o que já se
sabe sobre a causa. Item resolvido sai daqui e vira commit.

Origem desta leva: varredura das 20 seções em produção + ambiente Dapps,
14/10/2026 (`tests/varredura_ui.mjs` e `tests/varredura_dapps.mjs`), mais a
revisão do Donizete de 15/10.

---

## Em aberto

### 1. O beacon da Cloudflare, e o que ele custa — decisão do time

O Web Analytics da Cloudflare é bloqueado pelo CSP e enche o console de erro
vermelho. O Donizete já liberou `static.cloudflareinsights.com` no servidor para
calar o erro. **Em 15/10 isso não entrou no Git, e o motivo importa.**

Liberar esse host desfaz uma mitigação que existe por causa de um achado do
próprio Donizete, de 10/10: o token de sessão fica sete dias no `localStorage`,
então um XSS futuro o roubaria. A correção de raiz é cookie `HttpOnly` e continua
por fazer, porque mexe no fluxo de autenticação inteiro. O que dava para fechar
sem ela era a **saída** — roubar o token exige mandá-lo para fora, e
`connect-src 'self'` faz o navegador recusar fetch, XHR, WebSocket e beacon de
imagem para domínio de terceiro.

`tests/test_security_fixes.py` tem um teste guardando exatamente isso. Ao liberar
o domínio, ele falha com "host externo na saida" — foi escrito para pegar essa
mudança, e pegou.

As três saídas, em ordem de preferência:

1. **Desligar o Web Analytics no painel da Cloudflare.** O erro de console some,
   o CSP continua fechado, nada a decidir depois. Custo: ninguém mede acesso.
2. **Trocar o `localStorage` por cookie `HttpOnly`** e aí liberar o beacon sem
   custo. É a correção de raiz, e é trabalho de verdade.
3. **Liberar o domínio e afrouxar o teste**, registrando a troca por escrito.
   Legítimo se o time decidir que métrica de acesso vale mais que essa defesa,
   mas é uma decisão de segurança e não um ajuste de configuração.

Enquanto não houver decisão, Git e produção discordam neste ponto — o que o
Donizete levantou com razão. A escolha 1 resolve as duas coisas de uma vez.

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
