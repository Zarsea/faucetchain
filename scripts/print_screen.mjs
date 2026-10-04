// Tira print de uma página, em resolução de retina.
//
//     node scripts/print_screen.mjs <url> <saida.png> [--viewport]
//
// Mora aqui dentro e não na scratchpad por um motivo prático: o `import` do
// playwright resolve a partir da pasta do arquivo, e um script fora do projeto
// não enxerga o node_modules dele.
//
// Duas coisas que a imagem esconde se ninguém cuidar:
//
//   **A fonte.** Sem esperar `document.fonts.ready`, o print sai com a fonte de
//   fallback — e aí a imagem mostra qualquer coisa menos o design que se queria
//   ver. Esperar o networkidle não basta: a fonte chega depois.
//
//   **O erro de console.** Uma página pode fotografar bonito e estar com o
//   script quebrado. Os erros são impressos junto do caminho do arquivo, porque
//   um print silencioso de uma página quebrada é pior que nenhum print.
//
// Requer `npm install --no-save playwright` e `npx playwright install chromium`.
import { chromium } from 'playwright';

const [url, saida, modo] = process.argv.slice(2);
if (!url || !saida) {
  console.error('uso: node scripts/print_screen.mjs <url> <saida.png> [--viewport]');
  process.exit(2);
}

const nav = await chromium.launch();
const pag = await nav.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
});

const erros = [];
pag.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
pag.on('pageerror', (e) => erros.push(String(e)));

try {
  await pag.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await pag.evaluate(() => document.fonts.ready);
  await pag.waitForTimeout(900);
  await pag.screenshot({ path: saida, fullPage: modo !== '--viewport' });
  console.log(saida);
  if (erros.length) {
    console.log('  ERROS DE CONSOLE NA PÁGINA:');
    for (const e of erros.slice(0, 5)) console.log('   ', e.slice(0, 160));
    process.exitCode = 1;
  } else {
    console.log('  sem erro de console');
  }
} finally {
  await nav.close();
}
