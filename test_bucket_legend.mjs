// O título do gráfico tem de dizer o tamanho do balde que o eixo desenha.
//
// A tela de Network Status trazia uma tabela fixa de faixa para palavra:
//
//     const FAIXA_LEGENDA = { '4h': '10 minutes', ..., 'all': 'day' };
//
// e a resposta da API já mandava `bucket_seconds`, que o componente buscava e
// descartava. Em `all` as duas discordam, porque o backend faz o balde crescer
// com o histórico -- `passo = 86400 * (dias // 60 + 1)` passados 60 dias. Com
// cinco meses de blocos o eixo desenhava baldes de três dias enquanto o título
// dizia "by day". Foi assim que apareceu, em 24/10/2026.
//
// O que este arquivo prende são duas coisas distintas:
//
//   **A conversão.** 259200 segundos tem de virar "3 dias", não "dia". É o
//   caso que estava errado em produção, e o único que uma tabela fixa não
//   consegue acertar, porque o número não existia quando ela foi escrita.
//
//   **A origem.** O componente tem de ler `bucket_seconds` da resposta. Uma
//   tabela de faixa para duração escrita aqui de novo volta a mentir no dia em
//   que o histórico crescer, e passaria em qualquer teste que só olhasse a
//   conversão.
//
//     node test_bucket_legend.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { transform } from 'esbuild';

const raiz = import.meta.dirname;
const alvo = path.join(raiz, 'components', 'NetworkStatus.tsx');
const src = fs.readFileSync(alvo, 'utf8');

// ─────────────────────────────────────────── a função real, não uma cópia dela

const m = src.match(/export const legendaDoBalde =([\s\S]*?\n};)/);
assert.ok(m, 'legendaDoBalde sumiu de NetworkStatus.tsx');

const { code } = await transform(`const legendaDoBalde =${m[1]}\nexport { legendaDoBalde };`, {
    loader: 'ts',
    format: 'esm',
});
const { legendaDoBalde } = await import(
    'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);

// `tri` devolvendo cada idioma, para provar que os três chegam traduzidos e que
// o espanhol não cai no inglês por omissão.
const en = (a) => a;
const pt = (_a, b) => b;
const es = (_a, _b, c) => c ?? _a;

const casos = [
    // segundos,  en,            pt,             es
    [600, '10 minutes', '10 minutos', '10 minutos'],
    [3600, 'hour', 'hora', 'hora'],
    [21600, '6 hours', '6 horas', '6 horas'],
    [86400, 'day', 'dia', 'día'],
    // Os que a tabela fixa errava: o backend só os produz depois de 60 dias de
    // histórico, então nenhum deles cabia numa tabela escrita antes.
    [172800, '2 days', '2 dias', '2 días'],
    [259200, '3 days', '3 dias', '3 días'],
    [604800, '7 days', '7 dias', '7 días'],
];

let falhas = 0;
for (const [seg, e, p, s] of casos) {
    for (const [nome, tri, esperado] of [['en', en, e], ['pt', pt, p], ['es', es, s]]) {
        const obtido = legendaDoBalde(seg, tri);
        if (obtido !== esperado) {
            falhas++;
            console.log(`FAIL  ${seg}s ${nome}: esperava ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
        }
    }
}
if (!falhas) console.log(`OK    ${casos.length} tamanhos de balde nos tres idiomas`);

// Sem balde não há o que descrever, e o título cai para a forma sem sufixo em
// vez de inventar uma unidade.
for (const vazio of [null, undefined, 0, -1]) {
    const r = legendaDoBalde(vazio, en);
    if (r !== '') {
        falhas++;
        console.log(`FAIL  ${JSON.stringify(vazio)}: esperava string vazia, veio ${JSON.stringify(r)}`);
    }
}
if (!falhas) console.log('OK    balde ausente devolve vazio em vez de unidade inventada');

// ─────────────────────────────────── a origem: o número vem da resposta da API

if (!/bucket_seconds/.test(src)) {
    falhas++;
    console.log('FAIL  NetworkStatus.tsx nao le bucket_seconds; o titulo voltou a adivinhar');
} else {
    console.log('OK    o tamanho do balde e lido de bucket_seconds');
}

// Uma tabela nova de faixa para duração. Procura um objeto que use as chaves de
// faixa e cite uma unidade de tempo do lado -- que é a forma exata do bug.
const tabela = /['"](?:4h|24h|7d|30d|all)['"]\s*:\s*['"][^'"]*(?:minute|hour|day|minuto|hora|dia|día)/i;
if (tabela.test(src)) {
    falhas++;
    console.log('FAIL  voltou uma tabela fixa de faixa para duracao; use bucket_seconds');
} else {
    console.log('OK    nenhuma tabela fixa de faixa para duracao');
}

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);
