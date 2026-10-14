/* Varre todas as secoes da FaucetChain em producao e diz o que esta quebrado
 * ou lento, e por que.
 *
 *   node tests/varredura_ui.mjs [url]
 *
 * Clica cada item da barra lateral pelo indice, nao pelo rotulo: os rotulos vem
 * do i18n e mudam com o idioma, entao casar por texto quebraria em portugues.
 *
 * Para cada secao registra: tempo ate a tela parar de mudar, erros de console,
 * requisicoes que falharam, e quais chamadas de API foram as lentas -- a
 * pergunta nao e so "esta lento", e "lento por causa de que".
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'https://www.faucetchain.com.br';
const LENTO = 1500;   // ms: acima disto a chamada entra no relatorio

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1600, height: 1000 } });

let atual = 'carregando';
const erros = [];        // {secao, tipo, texto}
const chamadas = [];     // {secao, url, ms, status}

pagina.on('pageerror', e => erros.push({ secao: atual, tipo: 'js', texto: e.message }));
pagina.on('console', m => {
  if (m.type() === 'error') erros.push({ secao: atual, tipo: 'console', texto: m.text().slice(0, 200) });
});
pagina.on('requestfailed', r =>
  erros.push({ secao: atual, tipo: 'rede', texto: `${r.failure()?.errorText} ${r.url().slice(0, 120)}` }));
pagina.on('response', async r => {
  const t = r.request().timing();
  const ms = t && t.responseEnd > 0 ? Math.round(t.responseEnd) : null;
  if (r.url().includes('/api/')) {
    chamadas.push({ secao: atual, url: r.url().replace(BASE, '').slice(0, 70), ms, status: r.status() });
  }
});

const t0 = Date.now();
await pagina.goto(BASE, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(3000);
console.log(`carga inicial: ${Date.now() - t0}ms\n`);

// A barra lateral: pega os botoes uma vez e guarda os rotulos.
const botoes = pagina.locator('nav button, aside button').filter({ hasText: /\S/ });
const total = await botoes.count();
const rotulos = [];
for (let i = 0; i < total; i++) {
  rotulos.push((await botoes.nth(i).innerText()).trim().split('\n')[0].slice(0, 28));
}
console.log(`${total} botoes na barra lateral\n`);
console.log('secao                          ms   api  erros');
console.log('-'.repeat(58));

const resumo = [];
for (let i = 0; i < total; i++) {
  const nome = rotulos[i] || `#${i}`;
  if (/esconde|idioma|^EN$|^PT$/i.test(nome)) continue;

  atual = nome;
  const antesErros = erros.length;
  const antesChamadas = chamadas.length;
  const t = Date.now();
  try {
    await botoes.nth(i).click({ timeout: 8000 });
    // espera a rede sossegar; se nao sossegar em 12s, isso ja e o achado
    await pagina.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  } catch (e) {
    erros.push({ secao: nome, tipo: 'clique', texto: String(e).slice(0, 120) });
  }
  const ms = Date.now() - t;
  const nErros = erros.length - antesErros;
  const nApi = chamadas.length - antesChamadas;
  resumo.push({ nome, ms, nApi, nErros });
  console.log(`${nome.padEnd(28)} ${String(ms).padStart(5)}  ${String(nApi).padStart(3)}  ${nErros || ''}`);
}

console.log('\n' + '='.repeat(58));
console.log('SECOES MAIS LENTAS');
resumo.sort((a, b) => b.ms - a.ms).slice(0, 6)
  .forEach(s => console.log(`  ${String(s.ms).padStart(6)}ms  ${s.nome}  (${s.nApi} chamadas)`));

console.log('\nCHAMADAS DE API LENTAS (>' + LENTO + 'ms)');
const lentas = chamadas.filter(c => c.ms && c.ms > LENTO).sort((a, b) => b.ms - a.ms);
if (!lentas.length) console.log('  nenhuma');
lentas.slice(0, 12).forEach(c =>
  console.log(`  ${String(c.ms).padStart(6)}ms  ${String(c.status).padStart(3)}  ${c.url}   [${c.secao}]`));

console.log('\nAPI COM ERRO (status >= 400)');
const ruins = chamadas.filter(c => c.status >= 400);
if (!ruins.length) console.log('  nenhuma');
[...new Map(ruins.map(c => [c.url + c.status, c])).values()].slice(0, 15)
  .forEach(c => console.log(`  ${c.status}  ${c.url}   [${c.secao}]`));

console.log('\nERROS POR SECAO');
if (!erros.length) console.log('  nenhum');
const porSecao = {};
erros.forEach(e => { (porSecao[e.secao] ||= []).push(e); });
for (const [secao, lista] of Object.entries(porSecao)) {
  console.log(`\n  ${secao}  (${lista.length})`);
  [...new Map(lista.map(e => [e.texto.slice(0, 80), e])).values()].slice(0, 4)
    .forEach(e => console.log(`    [${e.tipo}] ${e.texto.slice(0, 150)}`));
}

await navegador.close();
