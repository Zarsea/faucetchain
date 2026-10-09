// Abre a URL publica como um visitante abriria, e reporta o que quebra.
//
//     node test_public_url.cjs                      # o tunel
//     URL=https://app.fly.dev node test_public_url.cjs
//
// Existe porque dois defeitos chegaram ao ar sem ninguem notar, e os dois so
// aparecem de fora:
//
//   1. O servidor entrega o frontend de `dist/`, e `dist/` so muda quando
//      alguem roda `npm run build`. Em 9 de outubro a URL publica ainda servia
//      o bundle de 2 de outubro -- uma semana de correcoes invisivel.
//
//   2. Um build que herdou `VITE_API_URL=http://localhost:8010` do `.env.local`
//      embarcou esse endereco para todo mundo. A pagina carregava do tunel e
//      chamava a maquina de quem abriu: funcionava para o unico dev com a API
//      local e mostrava 0,00 para os demais, sem erro visivel no servidor.
//
// Falha com saida nao-zero se qualquer rota /api/ responder >= 400, se o site
// abrir um dialogo de erro, ou se alguma requisicao do proprio dominio falhar.
const { chromium } = require('playwright');
const URL_ = global.URL;

const URL = process.env.URL || 'https://unfrosted-ignition-ruined.ngrok-free.dev/';
const HOST = new URL_(URL).host;

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const pg = await ctx.newPage();

  // O cabecalho so no dominio do tunel. Injeta-lo em tudo faz o Google Fonts
  // exigir preflight e falhar -- defeito do teste, nao do site.
  await pg.route(`**://${HOST}/**`, route =>
    route.continue({ headers: { ...route.request().headers(), 'ngrok-skip-browser-warning': 'true' } }));

  const dialogos = [], falhas = [], erros = [];
  pg.on('dialog', async d => { dialogos.push(d.message()); await d.dismiss(); });
  pg.on('requestfailed', r => falhas.push(`${r.failure()?.errorText} ${r.url().slice(0, 90)}`));
  pg.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 110)); });
  pg.on('response', r => {
    if (r.url().includes('/api/') && r.status() >= 400) falhas.push(`HTTP ${r.status()} ${r.url().slice(0, 90)}`);
  });

  await pg.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg.waitForTimeout(12000);

  console.log('dialogos de erro :', dialogos.length ? dialogos : 'nenhum');
  console.log('requisicoes ruins:', falhas.length ? falhas.slice(0, 6) : 'nenhuma');
  console.log('erros de console :', erros.length ? erros.slice(0, 4) : 'nenhum');

  // Para onde o bundle aponta, lido de dentro da pagina.
  const origem = await pg.evaluate(() => window.location.origin);
  console.log('origem da pagina :', origem);

  await b.close();
  const ruim = dialogos.length + falhas.length;
  console.log('');
  console.log(ruim
    ? ruim + ' problema(s) que um visitante veria'
    : 'nada que um visitante veria quebrar');
  process.exit(ruim ? 1 : 0);
})();
