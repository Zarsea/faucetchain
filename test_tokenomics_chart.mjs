// A pizza de alocação precisa dizer em tokens, não só em fatia.
//
// O rótulo `"Proof of Claim (Merit)" : 20` é lido como 20% pelo renderizador e
// como "vinte milhões" por quem olha -- inclusive pelo operador deste projeto,
// que foi exatamente como isto apareceu em 3 de outubro. Vinte por cento de 99M
// é 19,8M, então as duas leituras divergem por três ordens de grandeza num
// número que fala de dinheiro, numa tela que um juiz abre.
//
// Duas coisas são presas aqui, e as duas são fáceis de desfazer sem perceber:
//
//   **A sintaxe.** `%%` é comentário no mermaid, então um `%` dentro do rótulo
//   é uma aposta razoável de que algo quebra. Não quebra -- mas quem conferiu
//   foi este arquivo, com o parser que o renderizador usa, e não um palpite.
//
//   **As unidades.** Cada fatia tem de carregar o valor absoluto. Tirá-las
//   devolve a ambiguidade que custou esta conversa.
//
// O parser standalone cobre as gramáticas langium (pie entre elas). Fluxogramas
// usam o parser jison antigo e não passam por aqui; isto não é um teste de
// todos os diagramas, só das pizzas.
//
//     node test_tokenomics_chart.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = import.meta.dirname;
const parserPath = path.join(raiz, 'node_modules/@mermaid-js/parser/dist/mermaid-parser.core.mjs');

if (!fs.existsSync(parserPath)) {
  console.log('test_tokenomics_chart.mjs PULADO (sem @mermaid-js/parser; rode npm install)');
  process.exit(0);
}

const { parse } = await import(pathToFileURL(parserPath).href);
const src = fs.readFileSync(path.join(raiz, 'constants.ts'), 'utf8');

// Toda pizza do arquivo, em qualquer idioma -- não só a de alocação.
const pizzas = [...src.matchAll(/`\s*(pie[\s\S]*?)`/g)].map((m) => m[1].trim());
assert.ok(pizzas.length >= 2, `esperava as pizzas en e pt, achei ${pizzas.length}`);

for (const [i, grafico] of pizzas.entries()) {
  const r = await parse('pie', grafico);   // lança se a sintaxe quebrou
  assert.ok(r.sections.length > 0, `pizza ${i + 1} sem fatias`);

  for (const s of r.sections) {
    // 29.7M, 19,8M -- ponto ou vírgula, porque o pt usa vírgula decimal.
    assert.match(
      s.label,
      /\d+[.,]\d+M/,
      `a fatia "${s.label}" (valor ${s.value}) não diz quantos tokens são. ` +
        `Um leitor entende o ${s.value} como ${s.value} milhões; ` +
        `${s.value}% de 99M é ${((99 * s.value) / 100).toFixed(1)}M.`,
    );
  }

  const soma = r.sections.reduce((a, s) => a + s.value, 0);
  assert.equal(soma, 100, `as fatias da pizza ${i + 1} somam ${soma}, não 100`);
}

console.log(`test_tokenomics_chart.mjs OK (${pizzas.length} pizzas, rótulos com unidade)`);
