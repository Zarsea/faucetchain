/* ============================================================================
   As 21 seções da FaucetChain, no design novo, para app.html abrir uma a uma.

   PRÉVIA. Não faz parte do app. A ordem e os nomes são os de TABS em App.tsx,
   só agrupados — vinte e uma entradas numa lista reta é uma lista que ninguém
   lê.

   `selo` diz de onde vem o dado da seção, e isso é a informação mais útil
   daqui para avaliar design:

     real   — número, endereço ou linha lido do blockchain.db / da devnet
     vazio  — a tabela existe e está VAZIA de verdade: o que está desenhado é o
              estado vazio, que é metade do trabalho de uma tela e quase sempre
              fica para depois
     ossos  — esqueleto de layout: a estrutura é a proposta, os valores são
              exemplo marcado como tal

   `cheia` aponta para a prévia de tela inteira, onde a interação de verdade
   mora. Aqui dentro as seções são layout: a casca existe para você percorrer
   as vinte e uma, não para sentir cada botão.
   ========================================================================= */
(function () {
  'use strict';

  function svg(d) {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" ' +
      'stroke="var(--muted)" stroke-width="1.7" aria-hidden="true">' + d + '</svg>';
  }

  var ICONE_VAZIO = {
    quadro: '<path d="M4 7h16M4 12h10M4 17h7"></path>',
    lupa: '<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4.3-4.3"></path>'
  };

  /* -- peças repetidas ---------------------------------------------------- */

  function kv(pares) {
    return '<div class="kv-lista">' + pares.map(function (p) {
      return '<div class="kv"><span>' + p[0] + '</span><span>' + p[1] + '</span></div>';
    }).join('') + '</div>';
  }

  function tiles(items) {
    return '<div class="grid g4">' + items.map(function (t) {
      return '<div class="card card-pad">' +
        '<p class="num" style="margin:0; font-size:26px' + (t[2] ? '; color:' + t[2] : '') + '">' + t[0] + '</p>' +
        '<p class="quieto" style="margin:6px 0 0; font-size:13px">' + t[1] + '</p>' +
      '</div>';
    }).join('') + '</div>';
  }

  function aviso(texto, ok) {
    return '<div class="aviso' + (ok ? ' aviso-ok' : '') + '" style="margin-top:20px">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--' +
      (ok ? 'success' : 'warn') + ')" stroke-width="2.2" aria-hidden="true">' +
      (ok ? '<path d="M4 12.5l5 5L20 6.5"></path>'
          : '<path d="M12 8v5M12 17h.01M10.3 3.9L2.6 17.1A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0z"></path>') +
      '</svg><span>' + texto + '</span></div>';
  }

  function vazio(icone, titulo, corpo, acao) {
    return '<div class="vazio">' +
      '<div class="vazio-icone">' + svg(icone) + '</div>' +
      '<h3>' + titulo + '</h3><p>' + corpo + '</p>' +
      (acao ? '<button class="btn btn-marca" type="button" style="margin-top:6px">' + acao + '</button>' : '') +
    '</div>';
  }

  function tabela(cabecalho, linhas, legenda) {
    return '<div class="card"><div class="tabela-box"><table>' +
      (legenda ? '<caption class="eyebrow">' + legenda + '</caption>' : '') +
      '<thead><tr>' + cabecalho.map(function (c) {
        return '<th' + (c[1] ? ' class="col-num"' : '') + '>' + c[0] + '</th>';
      }).join('') + '</tr></thead><tbody>' +
      linhas.map(function (l) {
        return '<tr>' + l.map(function (celula, i) {
          return '<td' + (cabecalho[i] && cabecalho[i][1] ? ' class="col-num"' : '') + '>' + celula + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  /* -- as seções ---------------------------------------------------------- */

  var S = [];

  // ===== VOCÊ ============================================================
  S.push({
    id: 'dashboard', nome: 'Dashboard', grupo: 'Você', selo: 'real', cheia: 'home.html',
    titulo: 'Dashboard',
    sub: 'A home de hoje. Seu saldo, o que está prometido e o que já foi pago — nunca somados no mesmo número.',
    html:
      tiles([['118.770', 'FHR creditado'], ['5.746', 'no lote em aberto'],
             ['370.305', 'já sacado', 'var(--success)'], ['7', 'dias de sequência']]) +
      '<div class="duo" style="margin-top:16px">' +
        '<div class="card card-pad duo-larga">' +
          '<p class="eyebrow">Suas campanhas</p>' +
          '<div style="margin-top:16px; display:grid; gap:12px">' +
            '<div class="card card-fundo card-pad" style="padding:16px">' +
              '<div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:center">' +
                '<span style="font-weight:600">FaucetHunter Rewards · FHR</span>' +
                '<span class="pill pill-ok" style="font-size:11px">sacado</span></div>' +
              '<p class="num" style="margin:10px 0 0; font-size:20px">370.305</p></div>' +
            '<div class="card card-fundo card-pad" style="padding:16px">' +
              '<div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:center">' +
                '<span style="font-weight:600">Campanha 479079</span>' +
                '<span class="pill pill-sol" style="font-size:11px">em raiz publicada</span></div>' +
              '<p class="num" style="margin:10px 0 0; font-size:20px">347.221</p></div>' +
            '<div class="card card-fundo card-pad" style="padding:16px">' +
              '<div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:center">' +
                '<span style="font-weight:600">Lote em aberto</span>' +
                '<span class="pill" style="font-size:11px">creditado aqui</span></div>' +
              '<p class="num quieto" style="margin:10px 0 0; font-size:20px">5.746</p></div>' +
          '</div>' +
        '</div>' +
        '<div class="card card-pad duo-estreita">' +
          '<p class="eyebrow">Sua conta</p>' +
          kv([['conta', '0x6f9b…c41e'], ['carteira', '2uVvAhL7…SVSdY'],
              ['vínculo', 'duas assinaturas'], ['sessão', 'ativa']]) +
          '<div class="cresce"></div>' +
          '<a class="btn btn-largo btn-marca" href="home.html">Abrir a home inteira</a>' +
        '</div>' +
      '</div>' +
      aviso('<strong class="firme">Creditado aqui não é pago.</strong> Os 5.746 do lote em aberto são promessa desta cadeia. Só param de depender deste servidor quando a raiz é publicada.')
  });

  S.push({
    id: 'faucet', nome: 'Faucet', grupo: 'Você', selo: 'real', cheia: 'home.html',
    titulo: 'Merit Faucet',
    sub: 'A torneira da própria rede. O navegador resolve uma prova de trabalho leve, e isso é o que separa um clique de um script.',
    html:
      '<div class="duo">' +
        '<div class="card card-pad duo-larga">' +
          '<p class="eyebrow">Prova de clique</p>' +
          '<pre class="bloco" style="margin-top:14px">keccak256("FaucetChain-PoC|7777|' +
            '<span style="color:var(--primary)">época</span>|' +
            '<span style="color:var(--primary)">hash_pai</span>|' +
            '<span style="color:var(--primary)">usuário</span>|' +
            '<span style="color:var(--primary)">nonce</span>")\n\n' +
            '→ precisa de 16 bits zero à esquerda</pre>' +
          '<p class="quieto" style="margin:16px 0 0; font-size:13px; line-height:1.6">' +
            'Leve para um telefone, caro para um laço automatizado. Não prova que é humano — prova que custou algo.</p>' +
        '</div>' +
        '<div class="card card-pad duo-estreita">' +
          '<p class="eyebrow">Por clique</p>' +
          '<p class="num" style="margin:12px 0 2px; font-size:28px">0,0736</p>' +
          '<p class="quieto" style="margin:0; font-size:12px">$CLAIM bruto</p>' +
          kv([['usuário · 80%', '0,0589'], ['selador · 20%', '0,0147'], ['intervalo', '5 min']]) +
          '<div class="cresce"></div>' +
          '<button class="btn btn-largo btn-marca" type="button">Resolver e coletar</button>' +
        '</div>' +
      '</div>' +
      tabela([['tipo', 0], ['para', 0], ['valor', 1]],
        [['CLAIM', '0x22febb1c92…', '5,936'], ['MINING_FEE', '0xb3dff5d3f8…', '1,484'],
         ['CLAIM', '0x22febb1c92…', '5,936'], ['MINING_FEE', '0xb3dff5d3f8…', '1,484']],
        'Últimas transações da cadeia')
  });

  S.push({
    id: 'autoclaim', nome: 'AutoClaim Hub', grupo: 'Você', selo: 'real',
    titulo: 'AutoClaim Hub',
    sub: 'As torneiras ligadas a esta rede e o que cada uma paga por clique.',
    html:
      '<div class="grid g3">' +
        [['FaucetHunter', 'ao vivo', 'var(--success)', '~5.746 FHR', 'Torneira web2 em produção, com usuários reais. Campanha 652608.'],
         ['Merit Faucet', 'interna', 'var(--primary)', '0,0736 $CLAIM', 'A torneira da própria rede, por prova de clique.'],
         ['FaucetRiot', 'registrada', 'var(--muted)', 'sem campanha', 'Tem chave de API e não está inscrita em campanha nenhuma.']
        ].map(function (f) {
          return '<div class="card card-pad">' +
            '<div style="display:flex; gap:10px; align-items:start; justify-content:space-between">' +
              '<span style="font-size:16px; font-weight:700">' + f[0] + '</span>' +
              '<span class="pill" style="border-color:' + f[2] + '; color:' + f[2] + '; font-size:11px">' + f[1] + '</span></div>' +
            '<p class="quieto" style="margin:12px 0 0; font-size:13px; line-height:1.55">' + f[4] + '</p>' +
            '<p class="mono" style="margin:14px 0 0; font-size:12px; color:var(--muted)">' + f[3] + '</p>' +
          '</div>';
        }).join('') +
      '</div>' +
      aviso('Seis torneiras têm registro, e três dos nomes são <span class="mono">FaucetInternal</span> ou <span class="mono">Test Faucet</span> — resto de teste que ainda aparece no diretório. Está em <span class="mono">PENDING.md</span> como decisão aberta: limpar, ramificar um banco de demonstração, ou deixar como registro honesto.')
  });

  S.push({
    id: 'staking', nome: 'Staking Vault', grupo: 'Você', selo: 'real', cheia: 'payout.html',
    titulo: 'Staking Vault',
    sub: 'A tesouraria põe a própria parte em stake. Um usuário também pode, e a posição é um recibo gasto uma vez.',
    html:
      tiles([['1', 'posição viva'], ['1.000,00', '$CLAIM em stake'], ['0,50%', 'rendimento do nível'], ['1 h', 'trava']]) +
      '<div class="card" style="margin-top:16px">' +
        '<div class="card-head"><p class="eyebrow" style="margin:0">Posição 26</p>' +
          '<span class="pill pill-ok" style="font-size:11px">ativa</span></div>' +
        '<div class="card-pad">' +
          kv([['dono', '0xb3dff5d3…d5ad5'], ['depósito', '1.000,00 $CLAIM'],
              ['nível', '0'], ['rendimento', '50 pontos-base'],
              ['trava', '3.600 s'], ['pago até agora', '0,00']]) +
          aviso('Três posições antigas estão anuladas no banco, com o motivo escrito na linha: <span class="mono">criada pelo furo de staking sem verificação de saldo (abr-jun 2026)</span>. Uma delas tinha 777.777.777 $CLAIM — mais que o teto da rede. Anular com o motivo registrado em vez de apagar é o que deixa o livro auditável.') +
        '</div>' +
        '<div class="card-foot"><button class="btn assina btn-marca" type="button" disabled>Resgatar quando a trava abrir</button></div>' +
      '</div>'
  });

  S.push({
    id: 'bounty', nome: 'Bounty Board', grupo: 'Você', selo: 'vazio',
    titulo: 'Bounty Board',
    sub: 'Recompensas abertas por quem precisa de trabalho feito, pagas em $CLAIM na entrega aprovada.',
    html:
      vazio(ICONE_VAZIO.quadro, 'Nenhuma recompensa aberta',
        'A tabela <span class="mono">bounties</span> está vazia — zero linhas, não é um erro de carregamento. Este é o estado vazio de verdade, e desenhá-lo é metade do trabalho desta tela: sem ele, quem abre a aba vê um vão e conclui que algo quebrou.',
        'Abrir a primeira recompensa') +
      '<div class="grid g2" style="margin-top:20px">' +
        '<div class="card card-pad"><p class="eyebrow">O que existe em código</p>' +
          '<p class="quieto" style="margin:12px 0 0; font-size:13px; line-height:1.6">O contrato <span class="mono">CommunityBountyBoard.sol</span> está compilado no repositório, com criar, candidatar, aprovar e cancelar. O que não existe é uma única recompensa.</p></div>' +
        '<div class="card card-pad"><p class="eyebrow">O ciclo</p>' +
          '<p class="quieto" style="margin:12px 0 0; font-size:13px; line-height:1.6">aberta → em revisão → paga, ou cancelada com reembolso. O criador não pode se candidatar à própria recompensa — isso é regra no contrato, não no front.</p></div>' +
      '</div>'
  });

  // ===== LIQUIDAÇÃO ======================================================
  S.push({
    id: 'payouts', nome: 'Solana Payouts', grupo: 'Liquidação', selo: 'real', cheia: 'payout.html',
    titulo: 'Solana Payouts',
    sub: 'Sacar contra uma prova de inclusão, sem precisar ter SOL. Um relayer assina e paga.',
    html:
      tiles([['370.305', 'sacado em 02/10', 'var(--success)'], ['1.573.440', 'lamports de custo'],
             ['95%', 'disso é rent'], ['0', 'SOL do usuário', 'var(--success)']]) +
      '<div class="duo" style="margin-top:16px">' +
        '<div class="card card-pad duo-larga"><p class="eyebrow">A conta do primeiro saque</p>' +
          kv([['taxa base', '10.000'], ['prioridade', '75.000'],
              ['rent da conta de token', '1.488.440'], ['total', '1.573.440']]) +
          '<p class="quieto" style="margin:16px 0 0; font-size:13px; line-height:1.6">O rent é cobrado uma vez por pessoa por token. O segundo saque da mesma carteira no mesmo token custa 85.000 — dezoito vezes menos. É esse número que explica por que existe mínimo de saque.</p></div>' +
        '<div class="card card-pad duo-estreita card-fundo"><p class="eyebrow">A transação</p>' +
          '<p class="mono" style="margin:12px 0 0; font-size:11px; line-height:1.55; word-break:break-all">46kkEoMDU3gyW5smjGmzpmdctfqWnzAyt8…</p>' +
          '<div class="cresce"></div>' +
          '<a class="btn btn-largo" href="https://explorer.solana.com/tx/46kkEoMDU3gyW5smjGmzpmdctfqWnzAyt8ztbF61S2u2LknHWEVh4oSZvwxkhBy5SXvcfWdP2XmAQhqnhXFFXNhw?cluster=devnet" target="_blank" rel="noopener">Ver na devnet</a></div>' +
      '</div>'
  });

  S.push({
    id: 'ledger', nome: 'Settlement Ledger', grupo: 'Liquidação', selo: 'real', cheia: 'ledger.html',
    titulo: 'Settlement Ledger',
    sub: 'Toda raiz publicada, com a assinatura que a levou à Solana. É o livro que um juiz pode conferir sem falar com a gente.',
    html:
      tabela([['lote', 1], ['campanha', 0], ['raiz', 0], ['folhas', 1], ['valor', 1], ['data', 0]],
        [['20', '652608', '<span style="color:var(--primary)">0x67788a35…</span>', '1', '370.305', '02/10'],
         ['19', '479079', '<span style="color:var(--primary)">0x8aaa6330…</span>', '1', '347.221', '01/10'],
         ['18', '478840', '<span style="color:var(--primary)">0x872ed9b4…</span>', '2', '39.998.263', '27/09'],
         ['17', '789699', '<span style="color:var(--primary)">0xf8f57058…</span>', '3', '49.999.276', '19/09'],
         ['16', '789619', '<span style="color:var(--primary)">0x9a3a139b…</span>', '3', '49.999.276', '19/09']],
        '19 raízes publicadas · 18 campanhas') +
      aviso('Um lote dos vinte nunca foi publicado. Está no banco com assinatura nula, e a tabela diria isso se ele estivesse nesta janela — o livro mostra o que não aconteceu com a mesma clareza do que aconteceu.', false) +
      '<div style="margin-top:20px"><a class="btn btn-marca" href="ledger.html">Abrir o livro com painel de detalhe</a></div>'
  });

  S.push({
    id: 'contrato', nome: 'Smart Contract', grupo: 'Liquidação', selo: 'real',
    titulo: 'Smart Contract',
    sub: 'O programa Anchor na devnet, e a instrução que faz o trabalho de garantia: a que recusa.',
    html:
      '<div class="card card-pad"><p class="eyebrow">Programa</p>' +
        kv([['endereço', '64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm'],
            ['loader', 'BPFLoaderUpgradeab1e'], ['executável', 'sim'], ['rede', 'devnet']]) +
      '</div>' +
      '<div class="grid g2" style="margin-top:16px">' +
        '<div class="card card-pad"><p class="eyebrow">Instruções</p>' +
          '<div class="kv-lista" style="margin-top:14px">' +
            ['open_campaign', 'fund_vault', 'publish_root', 'claim_reward', 'withdraw_surplus'].map(function (i) {
              return '<div class="kv"><span>' + i + '</span><span></span></div>';
            }).join('') + '</div></div>' +
        '<div class="card card-pad"><p class="eyebrow">A recusa</p>' +
          '<pre class="bloco" style="margin-top:14px"><span style="color:var(--error)">InsufficientReserve</span>\n\nvault:    120.000.000.000\npromised: 148.213.400.000\n→ raiz não publicada</pre>' +
          '<p class="quieto" style="margin:14px 0 0; font-size:13px; line-height:1.6">A raiz é recusada inteira, e ninguém do lote é pago. Parece severo e é o ponto: pagar metade de um lote seria pior.</p></div>' +
      '</div>' +
      aviso('O cofre da campanha é uma conta cujo dono é o <span class="firme">próprio programa</span>, não uma chave que alguém guarda. É a diferença entre uma garantia e uma intenção: ninguém pode pagar errado porque ninguém pode pagar.', true)
  });

  // ===== PARCEIROS =======================================================
  S.push({
    id: 'conectar', nome: 'Connect a Faucet', grupo: 'Parceiros', selo: 'real', cheia: 'doc.html',
    titulo: 'Conectar uma torneira',
    sub: 'Uma chamada HTTP depois do seu próprio commit. Seu dinheiro não se move, e se nós cairmos você continua pagando.',
    html:
      '<div class="duo">' +
        '<div class="card duo-larga">' +
          '<div class="card-head"><p class="eyebrow" style="margin:0">Registrar</p></div>' +
          '<div class="card-pad" style="display:grid; gap:16px">' +
            '<div><label class="eyebrow" for="f-nome">Nome da torneira</label>' +
              '<input class="btn" id="f-nome" type="text" value="FaucetHunter" style="width:100%; margin-top:8px; font-weight:400; cursor:text"></div>' +
            '<div><label class="eyebrow" for="f-end">Endereço na FaucetChain</label>' +
              '<input class="btn mono" id="f-end" type="text" value="0x7dda72ad9ad56ce3d031ee6a62b5b94dd40c6ef3" style="width:100%; margin-top:8px; font-weight:400; cursor:text"></div>' +
            '<button class="btn btn-marca" type="button">Gerar chave de API</button>' +
          '</div>' +
          '<div class="card-foot"><p class="eyebrow">Sua chave</p>' +
            '<p class="mono" style="margin:8px 0 0; font-size:12px; word-break:break-all">fch_69778f0c48c4f25a71d8186da491e87…</p>' +
            '<p class="quieto" style="margin:10px 0 0; font-size:12px">Mostrada uma vez. Rotacionar invalida a anterior na mesma chamada.</p></div>' +
        '</div>' +
        '<div class="card card-pad duo-estreita"><p class="eyebrow">A chamada</p>' +
          '<pre class="bloco" style="margin-top:14px"><span class="quieto">POST</span> /api/faucethub/microclaim\n<span class="quieto">X-Api-Key:</span> fch_…\n\n{ <span style="color:var(--primary)">"user_wallet"</span>: "…",\n  <span style="color:var(--primary)">"amount"</span>: 1.0 }</pre>' +
          '<div class="cresce"></div>' +
          '<a class="btn btn-largo" href="doc.html">Ler a integração inteira</a></div>' +
      '</div>' +
      aviso('A resposta traz <span class="mono">campaigns</span> e, desde 3 de outubro, <span class="mono">campaigns_skipped</span> — cada campanha que <em>não</em> pagou, com o motivo. Antes disso uma campanha sem orçamento devolvia a mesma lista vazia que uma torneira inscrita em nada, e do seu lado as duas eram indistinguíveis.', true)
  });

  S.push({
    id: 'api', nome: 'API Docs', grupo: 'Parceiros', selo: 'real', cheia: 'doc.html',
    titulo: 'API',
    sub: 'Trinta rotas documentadas, e um teste que falha se o documento citar uma que não existe.',
    html:
      tabela([['método', 0], ['rota', 0], ['para quê', 0]],
        [['<span class="quieto">POST</span>', '/api/faucethub/register', 'Registrar e receber a chave'],
         ['<span class="quieto">POST</span>', '/api/faucethub/microclaim', 'A ponte: um clique aconteceu'],
         ['<span class="quieto">POST</span>', '/api/faucethub/reserve', 'Caucionar $CLAIM na tesouraria'],
         ['<span class="quieto">GET</span>', '/api/solana/campaign/{id}', 'Orçamento e cofre da campanha'],
         ['<span class="quieto">POST</span>', '/api/solana/batch', 'Fechar o lote e calcular a raiz'],
         ['<span class="quieto">GET</span>', '/api/solana/relayer', 'Quanto o relayer já subsidiou']],
        'As seis que um parceiro usa') +
      aviso('<span class="mono">test_docs_match_code.py</span> confere as 30 rotas citadas nos documentos mantidos contra as que existem no servidor. Documentação que mente é pior que documentação que falta, e a única defesa é um teste.', true)
  });

  // ===== REDE ============================================================
  S.push({
    id: 'rede', nome: 'Network Status', grupo: 'Rede', selo: 'real', cheia: 'network.html',
    titulo: 'Network Status',
    sub: 'Blocos, seladores e emissão. Um único ponto pulsa, porque uma única coisa está acontecendo.',
    html:
      tiles([['26', 'blocos selados'], ['25', 'altura'], ['1', 'selador online', 'var(--success)'], ['7777', 'chain id']]) +
      '<div class="grid g2" style="margin-top:16px">' +
        '<div class="card card-pad"><p class="eyebrow">Emissão contra o teto</p>' +
          '<p class="num" style="margin:12px 0 2px; font-size:24px">78.077,24</p>' +
          '<p class="quieto" style="margin:0 0 14px; font-size:12px">de 99.000.000 — 0,0789%</p>' +
          '<div class="barra" style="height:6px"><i style="width:0.4%; background:var(--primary)"></i></div>' +
          '<p class="quieto" style="margin:14px 0 0; font-size:12px; line-height:1.55">A barra é quase invisível e é honesta. Desenhá-la cheia seria mentir com CSS.</p></div>' +
        '<div class="card card-pad"><p class="eyebrow">Consenso</p>' +
          kv([['prova de clique', '16 bits zero'], ['eleição do selador', 'peso por stake'],
              ['teto do peso', 'SEALER_STAKE_CAP'], ['carência', '60 s']]) +
          '<p class="quieto" style="margin:14px 0 0; font-size:12px; line-height:1.55">O nó sela blocos de verdade. A carência existe para que um selador não eleito ainda possa fechar se o eleito não aparecer.</p></div>' +
      '</div>' +
      '<div style="margin-top:20px"><a class="btn btn-marca" href="network.html">Abrir a telemetria inteira</a></div>'
  });

  S.push({
    id: 'infra', nome: 'Infra Monitor', grupo: 'Rede', selo: 'real', cheia: 'network.html',
    titulo: 'Infra Monitor',
    sub: 'Os nós, o batimento e as duas contas que não fecham.',
    html:
      '<div class="card"><div class="card-head">' +
        '<p class="eyebrow" style="margin:0">admin-miner-01</p>' +
        '<span class="pill pill-ok" style="font-size:11px">online</span></div>' +
        '<div class="card-pad">' +
          kv([['carteira', '0xb3dff5d3…d5ad5'], ['versão', '1.0.0'],
              ['épocas ativas', '696'], ['tempo de pé', '31d 9h'],
              ['CPU', '6%'], ['memória livre', '10%']]) +
        '</div></div>' +
      '<div class="card card-pad" style="margin-top:16px"><p class="eyebrow">test-node</p>' +
        '<p class="quieto" style="margin:10px 0 0; font-size:13px">Nunca mandou batimento. Registrado em abril, zero épocas, zero recompensa — e segue na lista como nó conhecido.</p></div>' +
      aviso('<strong class="firme">Dois números para a mesma coisa, e eles não batem.</strong> <span class="mono">active_miners.total_earned</span> marca 1.257.422,56 para este selador; somar <span class="mono">mining_rewards</span> do mesmo endereço dá 53.037,60 — vinte e quatro vezes menos. Esta tela mostra o livro e não o contador, porque o livro é o que paga. Qual dos dois está errado é pergunta aberta.')
  });

  S.push({
    id: 'overview', nome: 'Overview', grupo: 'Rede', selo: 'ossos',
    titulo: 'Visão geral',
    sub: 'O consenso híbrido em uma tela: de onde vem o peso de quem sela um bloco.',
    html:
      '<div class="card card-pad">' +
        '<div class="trilho">' +
          '<div class="trilho-linha" aria-hidden="true"></div>' +
          [['CLIQUE', 'Prova de clique', 'Atividade humana, 16 bits de trabalho', '1'],
           ['STAKE', 'Peso por stake', '1 + min(stake, teto)', '1'],
           ['SELO', 'Bloco selado', 'Semente = keccak do hash pai', '2']
          ].map(function (e) {
            return '<div class="estacao" data-on="' + e[3] + '">' +
              '<span class="estacao-selo">' + e[0] + '</span><div>' +
              '<p style="margin:0; font-weight:600">' + e[1] + '</p>' +
              '<p class="quieto" style="margin:4px 0 0; font-size:13px">' + e[2] + '</p></div></div>';
          }).join('') +
        '</div>' +
      '</div>' +
      aviso('Esta seção é esqueleto: a estrutura é a proposta e os rótulos vêm de <span class="mono">select_block_sealer</span>, mas não há série histórica no banco para desenhar o gráfico que a tela atual mostra.')
  });

  S.push({
    id: 'ia', nome: 'AI Module', grupo: 'Rede', selo: 'ossos',
    titulo: 'Módulo de detecção',
    sub: 'A pontuação que separa um clique de um laço automatizado, antes de ele virar dinheiro.',
    html:
      '<div class="grid g2">' +
        '<div class="card card-pad"><p class="eyebrow">Sinais</p>' +
          kv([['liquidez fornecida', '30%'], ['protocolos', '20%'],
              ['volume', '30%'], ['tempo de pé', '20%']]) +
          '<p class="quieto" style="margin:14px 0 0; font-size:12px; line-height:1.55">Pesos de <span class="mono">FraudAndBonusDetector.py</span>. Exemplo de pontuação abaixo, não caso medido.</p></div>' +
        '<div class="card card-pad"><p class="eyebrow">Veredito de exemplo</p>' +
          '<p class="num" style="margin:12px 0 2px; font-size:28px; color:var(--success)">0,82</p>' +
          '<p class="quieto" style="margin:0 0 14px; font-size:12px">válido · exemplo</p>' +
          '<div class="barra"><i style="width:82%; background:var(--success)"></i></div></div>' +
      '</div>' +
      aviso('Esqueleto. Os pesos são reais e vêm do código; a pontuação na tela é exemplo marcado como tal, porque não existe no banco uma avaliação gravada para exibir.')
  });

  // ===== EXPLORAR ========================================================
  S.push({
    id: 'wallet', nome: 'Wallet Explorer', grupo: 'Explorar', selo: 'real', cheia: 'ledger.html',
    titulo: 'Wallet Explorer',
    sub: 'Uma conta, o que ela tem e como ela chegou lá.',
    html:
      '<div class="card card-pad"><label class="eyebrow" for="w-busca">Conta ou carteira</label>' +
        '<input class="btn mono" id="w-busca" type="search" value="0xb3dff5d3f802ebba471c2498f223c52b8f7d5ad5" style="width:100%; margin-top:8px; font-weight:400; cursor:text"></div>' +
      tiles([['53.037,60', '$CLAIM de mineração'], ['42', 'recompensas'], ['1.000,00', 'em stake'], ['1', 'nó selador']]) +
      tabela([['tipo', 0], ['de', 0], ['para', 0], ['valor', 1]],
        [['MINING_FEE', '0x0000000000…', '0xb3dff5d3f8…', '1,484'],
         ['RESERVE_LOCK', '0x7dda72ad9a…', '0xfaucetchain…', '1.000,000'],
         ['MINING_FEE', '0x0000000000…', '0xb3dff5d3f8…', '1,484']],
        'Movimentos') +
      aviso('Esta conta é a que tem 68% de tudo que a rede emitiu por mineração. Sete das dez contas com saldo não são linhas em <span class="mono">users</span>: eram alcançáveis quando colar um endereço era uma forma de entrar, o que deixou de ser em 24 de setembro. Os saldos continuam aqui, e o que fazer com eles é decisão aberta.')
  });

  S.push({
    id: 'tracker', nome: 'Address Tracker', grupo: 'Explorar', selo: 'vazio',
    titulo: 'Address Tracker',
    sub: 'Uma lista pública de endereços para acompanhar.',
    html:
      '<div class="card card-pad" style="margin-bottom:20px"><label class="eyebrow" for="t-busca">Acompanhar um endereço</label>' +
        '<div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:8px">' +
          '<input class="btn mono" id="t-busca" type="search" placeholder="0x…" style="flex:999 1 260px; font-weight:400; cursor:text">' +
          '<button class="btn btn-marca" type="button" style="flex:1 1 140px">Adicionar</button></div></div>' +
      vazio(ICONE_VAZIO.lupa, 'Nenhum endereço acompanhado',
        'A tabela <span class="mono">tracked_addresses</span> está vazia — zero linhas de verdade. A lista é pública e compartilhada por todos, o que também é o motivo de ela ter um teto: a exposição aqui é vandalismo, não perda de valor.') +
      aviso('Em <span class="mono">PENDING.md</span>: tornar a lista por conta é funcionalidade, não correção. E foi aqui que uma leitura caríssima passou sem limite de taxa — <span class="mono">HOLDINGS_HOURLY_PER_IP</span> existe por causa desta tela.')
  });

  // ===== LER =============================================================
  S.push({
    id: 'whitepaper', nome: 'Whitepaper', grupo: 'Ler', selo: 'real', cheia: 'doc.html',
    titulo: 'Whitepaper',
    sub: 'O documento, em largura de leitura. Archivo em 17px, linha de 1,7.',
    html:
      '<div class="wrap-lido prosa" style="padding:0; max-width:660px">' +
        '<h3 style="margin-top:0">4. $CLAIM</h3>' +
        '<ul><li><strong>Oferta fixa: 99.000.000.</strong> Nenhum mecanismo emite além disso.</li>' +
        '<li><strong>Sem gás para o usuário.</strong> Sacar para a Solana custa taxa, e um relayer paga.</li>' +
        '<li><strong>Queima é opcional.</strong> Deflação por decreto encolhe o volume de que uma rede de distribuição depende.</li></ul>' +
        '<blockquote>O limite existe para tornar a emissão previsível e a rede cara de farmar — não para pressionar ninguém a coletar mais rápido. Essa era a razão antiga, e ela foi abandonada.</blockquote>' +
        '<p>O cofre de uma campanha é uma conta de token cuja autoridade é a própria campanha — <strong>não uma chave que alguém guarda</strong>.</p>' +
      '</div>' +
      '<div style="margin-top:24px"><a class="btn btn-marca" href="doc.html">Abrir o documento inteiro</a></div>'
  });

  S.push({
    id: 'tokenomics', nome: 'Tokenomics', grupo: 'Ler', selo: 'real', cheia: 'doc.html',
    titulo: 'Tokenomics',
    sub: 'A alocação do teto de 99 milhões, com as unidades nos rótulos.',
    html:
      '<div class="card">' +
        [['Proof of Work · mineradores', 30, 'var(--primary)'],
         ['Proof of Stake · cofre', 30, 'var(--mid)'],
         ['Proof of Claim · mérito', 20, 'var(--deep)'],
         ['Time e liquidez', 20, 'var(--muted)']
        ].map(function (f, i) {
          var m = (99 * f[1] / 100).toFixed(1).replace('.', ',');
          return '<div style="padding:18px 24px' + (i ? '; border-top:1px solid var(--card)' : '') + '">' +
            '<div style="display:flex; flex-wrap:wrap; gap:12px; align-items:baseline; justify-content:space-between; margin-bottom:10px">' +
              '<span style="font-size:15px; font-weight:600">' + f[0] + '</span>' +
              '<span class="num" style="font-size:14px">' + m + 'M <span class="quieto">(' + f[1] + '%)</span></span></div>' +
            '<div class="barra" style="height:8px"><i style="width:' + f[1] + '%; background:' + f[2] + '"></i></div></div>';
        }).join('') +
      '</div>' +
      aviso('<strong class="firme">Este rateio não está em documento nenhum.</strong> Existe só no gráfico desta tela. O whitepaper declara o teto e não diz como ele se divide — então a tela é a única fonte de uma afirmação de que 19,8M vão para time e liquidez. Ou vira política escrita, ou sai.')
  });

  S.push({
    id: 'specs', nome: 'Technical Specs', grupo: 'Ler', selo: 'real', cheia: 'doc.html',
    titulo: 'Especificações',
    sub: 'As constantes que decidem quanto um clique vale.',
    html:
      '<div class="grid g2">' +
        '<div class="card card-pad"><p class="eyebrow">Cadeia</p>' +
          kv([['chain id', '7777'], ['prova de clique', '16 bits zero'],
              ['intervalo de claim', '5 min'], ['claims por dia', '288']])+'</div>' +
        '<div class="card card-pad"><p class="eyebrow">Distribuição</p>' +
          kv([['piso de usuários', '30'], ['piso de participação', '0,01'],
              ['parte do usuário', '80%'], ['parte da tesouraria', '20%'],
              ['mínimo $CLAIM', '10,00']])+'</div>' +
      '</div>' +
      '<pre class="bloco" style="margin-top:16px">por_clique = mês_restante / dias_restantes\n             / (max(usuários, <span style="color:var(--primary)">30</span>) × 288 × participação)</pre>' +
      aviso('A participação está no <strong class="firme">divisor</strong> e tem piso de 0,01 — então tráfego ralo não baixa a recompensa, multiplica. Com os dois pisos no valor atual, uma pessoa sozinha leva 2,67 vezes o orçamento de um dia. Deliberado em devnet, primeiro item a reduzir antes da mainnet.')
  });

  S.push({
    id: 'artigo', nome: 'General Article', grupo: 'Ler', selo: 'ossos', cheia: 'doc.html',
    titulo: 'Artigo',
    sub: 'O formato de leitura longa, para texto que não é especificação.',
    html:
      '<div class="wrap-lido prosa" style="padding:0; max-width:660px">' +
        '<p style="font-size:19px; line-height:1.6">Uma torneira web2 paga micro-recompensas na base da confiança: uma linha no banco de dados de alguém. Quem clica não tem como saber se o número vai virar dinheiro.</p>' +
        '<p>Essa é a frase que o produto existe para desfazer, e ela não precisa de gráfico. O formato aqui é o de um texto que alguém lê do começo ao fim: 660 pixels de largura, Archivo em 17, e nada competindo com o parágrafo.</p>' +
        '<h3>O que muda com uma raiz</h3>' +
        '<p>Publicada, ela para de depender do servidor que a calculou. É uma mudança pequena de engenharia e inteira de natureza: a promessa passa a ser verificável por quem desconfia dela.</p>' +
      '</div>' +
      aviso('Esqueleto de formato. O texto é um exemplo curto escrito para ocupar a medida; os artigos reais estão em <span class="mono">GeneralArticle.tsx</span>.')
  });

  // ===== ASSISTENTE ======================================================
  S.push({
    id: 'agente', nome: 'AI Agent', grupo: 'Assistente', selo: 'ossos',
    titulo: 'Assistente',
    sub: 'Responde sobre esta rede a partir do que está no repositório, não de memória.',
    html:
      '<div class="card" style="display:flex; flex-direction:column; min-height:420px">' +
        '<div class="card-head"><p class="eyebrow" style="margin:0">Conversa</p>' +
          '<span class="pill" style="font-size:11px">base vetorial local</span></div>' +
        '<div class="card-pad" style="display:grid; gap:14px">' +
          '<div style="display:flex; justify-content:flex-end">' +
            '<p class="card card-fundo" style="margin:0; padding:12px 16px; max-width:70%; font-size:14px; border-color:var(--primary)">Quanto vale um clique na campanha 652608?</p></div>' +
          '<div style="display:flex; gap:12px">' +
            '<span class="avatar" style="width:32px; height:32px; font-size:11px">FC</span>' +
            '<p class="card" style="margin:0; padding:12px 16px; max-width:80%; font-size:14px; line-height:1.6">' +
              'Hoje, 19,1524 unidades brutas por clique — o usuário recebe 80% disso. ' +
              'O valor está alto porque a participação medida ontem caiu ao piso de 0,01, ' +
              'e ela está no divisor.</p></div>' +
        '</div>' +
        '<div class="cresce"></div>' +
        '<div class="card-foot" style="display:flex; flex-wrap:wrap; gap:10px">' +
          '<input class="btn" type="text" placeholder="Pergunte sobre a rede…" style="flex:999 1 240px; font-weight:400; cursor:text">' +
          '<button class="btn btn-marca" type="button" style="flex:1 1 100px">Enviar</button></div>' +
      '</div>' +
      aviso('Esqueleto de conversa. A resposta mostrada é o cálculo real de 3 de outubro, mas a conversa não está ligada a nada aqui — é o layout que está em teste.')
  });

  window.SECOES = S;
})();
