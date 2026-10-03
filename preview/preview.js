/* ============================================================================
   FaucetChain — os comportamentos compartilhados das prévias.

   PRÉVIA. Não faz parte do app. O que mora aqui é só o que mais de uma tela
   usa; lógica de uma tela só fica na própria tela.

   Nada aqui busca rede. As prévias abrem de file:// e precisam funcionar
   offline, então todo dado é literal no HTML da tela.
   ========================================================================= */
(function () {
  'use strict';

  var PV = {};

  /* -- formato brasileiro, um lugar só ----------------------------------- */
  PV.pt = function (n, casas) {
    return n.toLocaleString('pt-BR', casas != null
      ? { minimumFractionDigits: casas, maximumFractionDigits: casas }
      : undefined);
  };

  /* -- remontar uma animação ---------------------------------------------
     Tirar e repor a classe não basta: o navegador agrupa as duas mudanças no
     mesmo quadro e a animação nunca reinicia. Ler offsetWidth no meio força o
     recálculo, que é o que faz o segundo clique acender de novo. */
  PV.repete = function (el, classe) {
    if (!el) return;
    el.classList.remove(classe);
    void el.offsetWidth;
    el.classList.add(classe);
  };

  /* -- modo calmo ---------------------------------------------------------
     Desliga todo movimento. O prefers-reduced-motion do sistema já desliga;
     isto é para quem quer decidir agora, e para avaliar a tela sem animação. */
  PV.calma = function () {
    var b = document.getElementById('calma');
    if (!b) return;
    b.addEventListener('click', function () {
      var ligado = document.body.classList.toggle('calma');
      b.setAttribute('aria-pressed', ligado ? 'true' : 'false');
      b.textContent = ligado ? 'Movimento' : 'Modo calmo';
    });
  };

  /* -- sustentar para assinar --------------------------------------------
     Qualquer elemento com data-hold vira um botão de sustentar: ele enche
     enquanto pressionado e só dispara o evento 'sustentado' se completar.
     Setecentos milissegundos por omissão — curto para não irritar, longo para
     não acontecer por engano. Ações que movem dinheiro usam isto.

         <button class="btn assina" data-hold data-hold-ms="700">
           <span class="assina-fill" data-hold-fill></span>
           <span>Sustente para publicar</span>
         </button>

         botao.addEventListener('sustentado', ...)                        */
  PV.sustentar = function (el) {
    var fill = el.querySelector('[data-hold-fill]');
    var total = parseInt(el.getAttribute('data-hold-ms'), 10) || 700;
    var passo = 48;
    var pressao = 0;
    var timer = null;

    function pinta() { if (fill) fill.style.width = pressao + '%'; }

    function para() { if (timer) { clearInterval(timer); timer = null; } }

    function segura() {
      if (el.disabled || timer) return;
      timer = setInterval(function () {
        pressao += 100 * passo / total;
        if (pressao >= 100) {
          para();
          pressao = 0;
          pinta();
          el.dispatchEvent(new CustomEvent('sustentado', { bubbles: true }));
        } else {
          pinta();
        }
      }, passo);
    }

    function solta() { para(); if (pressao !== 0) { pressao = 0; pinta(); } }

    el.addEventListener('mousedown', segura);
    el.addEventListener('touchstart', function (e) { e.preventDefault(); segura(); }, { passive: false });
    ['mouseup', 'mouseleave', 'touchend', 'touchcancel', 'blur'].forEach(function (ev) {
      el.addEventListener(ev, solta);
    });
    // Teclado: sem isto o botão existe e não funciona para quem não usa mouse.
    el.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); segura(); }
    });
    el.addEventListener('keyup', solta);
    pinta();
  };

  /* -- a torneira ---------------------------------------------------------
     O nível sobe porque o tempo está passando de verdade. No clique ele
     esvazia, a gota cai, e o valor só muda DEPOIS dela chegar: a ordem é a
     emoção — vê-se o valor chegar em vez de aparecer. */
  PV.torneira = function (opcoes) {
    var botao = document.getElementById('torneira');
    if (!botao) return null;

    var nivelEl = document.getElementById('nivel');
    var efeitos = document.getElementById('efeitos');
    var estado = document.getElementById('t-estado');
    var acao = document.getElementById('t-acao');
    var nota = document.getElementById('t-nota');

    var premio = opcoes.premio;
    var minutos = opcoes.minutos || 3;
    var nivel = 100;

    function pinta() {
      var pronta = nivel >= 100;
      nivelEl.style.height = nivel + '%';
      botao.disabled = !pronta;
      botao.dataset.pronta = pronta ? '1' : '0';
      estado.textContent = pronta ? 'pronto' : 'enchendo';
      acao.textContent = pronta ? 'Coletar' : Math.ceil((100 - nivel) * minutos / 100) + ' min';
      nota.textContent = pronta ? '~' + PV.pt(premio) + ' FHR' : nivel + '%';
      nota.style.color = pronta ? 'var(--primary)' : 'var(--muted)';
      botao.setAttribute('aria-label', pronta
        ? 'Coletar agora, cerca de ' + PV.pt(premio) + ' FHR'
        : 'Aguardando a torneira encher, ' + nivel + ' por cento');
    }

    setInterval(function () {
      if (nivel < 100) { nivel = Math.min(100, nivel + 4); pinta(); }
    }, 1000);

    botao.addEventListener('click', function () {
      if (nivel < 100) return;
      nivel = 0;
      pinta();

      if (efeitos) {
        efeitos.innerHTML = '<span class="anel is-anel"></span><span class="gota is-pinga"></span>';
        setTimeout(function () { efeitos.innerHTML = ''; }, 1000);
      }
      setTimeout(function () { opcoes.aoChegar(premio); }, 560);
    });

    pinta();
    return { pinta: pinta };
  };

  /* -- recibo de crédito, usado em mais de uma tela ----------------------- */
  PV.recibo = function (el, valor, moeda, nota) {
    el.hidden = false;
    el.className = 'aviso aviso-ok is-entra';
    el.innerHTML =
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--success)" ' +
      'stroke-width="2.4" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"></path></svg>' +
      '<span><strong class="firme">+' + PV.pt(valor) + ' ' + moeda + '</strong> ' + nota + '</span>';
  };

  /* -- arranque ----------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    PV.calma();
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-hold]'),
      function (el) { PV.sustentar(el); }
    );
  });

  window.PV = PV;
})();
