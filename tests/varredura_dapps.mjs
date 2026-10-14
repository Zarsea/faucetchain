/* Testa o caminho da gota Dapps ate a FaucetHub, e o que mais existe la dentro.
 *
 *   node tests/varredura_dapps.mjs [url]
 *
 * A gota nao navega: troca a tela inteira por outro componente. Entao um erro
 * aqui nao aparece na varredura da barra lateral -- e esta area ficou de fora
 * de todo teste ate agora.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'https://www.faucetchain.com.br';
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1600, height: 1000 } });

const erros = [];
let onde = 'carga';
pagina.on('pageerror', e => erros.push(`[js/${onde}] ${e.message.slice(0, 160)}`));
pagina.on('console', m => {
  if (m.type() === 'error' && !/websocket|cloudflareinsights/i.test(m.text()))
    erros.push(`[console/${onde}] ${m.text().slice(0, 160)}`);
});

await pagina.goto(BASE, { waitUntil: 'domcontentloaded' });
await pagina.waitForTimeout(3500);

// A gota
onde = 'gota';
const gota = pagina.getByText('Dapps', { exact: true }).first();
if (!(await gota.count())) {
  console.log('A GOTA NAO FOI ENCONTRADA na tela inicial');
  await navegador.close();
  process.exit(1);
}
const t1 = Date.now();
await gota.click();
await pagina.waitForTimeout(2500);
console.log(`gota abre em ${Date.now() - t1}ms`);

// O que tem dentro
onde = 'ambiente';
const titulo = await pagina.locator('h1, h2').first().innerText().catch(() => '(sem titulo)');
console.log(`ambiente: "${titulo.split('\n')[0].slice(0, 50)}"\n`);

const cats = ['Visão Geral', 'L1 Core Network', 'L2 Ecosystem', 'Developer Hub'];
console.log('categoria             blocos  indisponiveis');
console.log('-'.repeat(48));
for (const cat of cats) {
  const b = pagina.getByText(cat, { exact: true }).first();
  if (!(await b.count())) { console.log(`${cat.padEnd(22)} AUSENTE`); continue; }
  onde = cat;
  await b.click();
  await pagina.waitForTimeout(900);
  // os blocos sao cards clicaveis; os indisponiveis costumam vir opacos
  const cards = pagina.locator('[class*="cursor-pointer"], [class*="rounded"]').filter({ hasText: /\S/ });
  const n = await cards.count();
  const mortos = await pagina.locator('[class*="opacity-4"], [class*="opacity-5"], [class*="cursor-not-allowed"]').count();
  console.log(`${cat.padEnd(22)} ${String(n).padStart(5)}  ${mortos || '-'}`);
}

// O caminho que importa: chegar na FaucetHub
onde = 'faucethub';
console.log('');
await pagina.getByText('Visão Geral', { exact: true }).first().click().catch(() => {});
await pagina.waitForTimeout(700);
const bloco = pagina.getByText('FaucetHub', { exact: true }).first();
if (!(await bloco.count())) {
  console.log('O BLOCO FaucetHub NAO EXISTE no ambiente Dapps');
} else {
  const t2 = Date.now();
  await bloco.click();
  await pagina.waitForTimeout(3000);
  const ms = Date.now() - t2;
  const texto = await pagina.locator('body').innerText();
  const chegou = /faucet|torneira|liquidez|liquidity/i.test(texto);
  console.log(`bloco FaucetHub -> ${chegou ? 'ABRIU' : 'NAO ABRIU'} em ${ms}ms`);
  if (chegou) {
    // a lista de torneiras carregou?
    const temHunter = /FaucetHunter/i.test(texto);
    console.log(`lista de torneiras: ${temHunter ? 'carregou (FaucetHunter visivel)' : 'VAZIA'}`);
  }
}

console.log('\nERROS (fora websocket e cloudflare insights)');
if (!erros.length) console.log('  nenhum');
[...new Set(erros)].slice(0, 10).forEach(e => console.log('  ' + e));

await navegador.close();
