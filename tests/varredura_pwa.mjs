// Confere que o aplicativo e instalavel e que o casco sobrevive sem rede.
//
// Roda contra dist/ servido em localhost: service worker exige contexto seguro,
// e localhost conta como seguro mesmo em http.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8123';
const ok = (c) => (c ? 'SIM' : 'NAO');
let falhas = 0;
const exigir = (cond, texto) => {
    if (!cond) falhas++;
    console.log(`  ${cond ? 'ok  ' : 'FALHA'}  ${texto}`);
};

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();

// 1. O manifesto chega, e com os campos que o Chrome exige para oferecer instalar.
const r = await pg.request.get(`${BASE}/manifest.json`);
const m = await r.json();
console.log('MANIFESTO');
exigir(r.status() === 200, `responde 200 (${r.status()})`);
exigir(!!m.name && !!m.short_name, `name + short_name (${m.short_name})`);
exigir(m.start_url === '/', `start_url (${m.start_url})`);
exigir(['standalone', 'fullscreen', 'minimal-ui'].includes(m.display), `display instalavel (${m.display})`);
const tam = (m.icons || []).map((i) => i.sizes);
exigir(tam.includes('192x192') && tam.includes('512x512'), `icones 192 e 512 (${tam.join(', ')})`);
exigir((m.icons || []).some((i) => i.purpose === 'maskable'), 'tem icone maskable');
for (const ic of m.icons || []) {
    const ri = await pg.request.get(BASE + ic.src);
    exigir(ri.status() === 200, `${ic.src} baixa (${ri.status()})`);
}

// 2. O service worker registra e assume o controle.
console.log('\nSERVICE WORKER');
await pg.goto(BASE, { waitUntil: 'load' });
const estado = await pg.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;        // resolve quando ativa
    return { ativo: !!reg.active, escopo: reg.scope, controlando: !!navigator.serviceWorker.controller };
});
exigir(estado.ativo, `ativo (escopo ${estado.escopo})`);

// 3. O que ele guardou. Nenhuma rota de dado vivo pode estar no cache.
await pg.reload({ waitUntil: 'networkidle' });
const guardado = await pg.evaluate(async () => {
    const nomes = await caches.keys();
    const out = [];
    for (const n of nomes) {
        const c = await caches.open(n);
        for (const req of await c.keys()) out.push(new URL(req.url).pathname);
    }
    return { nomes, out };
});
console.log('\nCACHE');
console.log(`  ${guardado.nomes.join(', ')} — ${guardado.out.length} entradas`);
exigir(guardado.out.length > 0, 'guardou o casco');
exigir(!guardado.out.some((p) => p.startsWith('/api/')), 'nenhum /api/ no cache');
exigir(!guardado.out.some((p) => p.startsWith('/ws/')), 'nenhum /ws/ no cache');

// 4. Sem rede, a tela ainda aparece. E o unico motivo de tudo isto existir.
console.log('\nSEM REDE');
await ctx.setOffline(true);
await pg.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
const vivo = await pg.evaluate(() => {
    const raiz = document.getElementById('root');
    return { html: document.documentElement.innerHTML.length, pintou: !!raiz && raiz.children.length > 0 };
});
exigir(vivo.html > 1000, `o HTML carrega offline (${vivo.html} bytes)`);
exigir(vivo.pintou, `a interface monta offline (root pintado: ${ok(vivo.pintou)})`);
await ctx.setOffline(false);

await navegador.close();
console.log(`\n${falhas === 0 ? 'TUDO PASSOU' : falhas + ' FALHA(S)'}`);
process.exit(falhas === 0 ? 0 : 1);
