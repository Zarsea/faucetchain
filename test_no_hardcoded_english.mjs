// Inglês cravado numa tela que deveria falar três línguas.
//
// O espelho de test_no_hardcoded_portuguese.mjs. Aquele pergunta se português
// alcança quem não lê português; este pergunta se alguma frase está presa numa
// língua só, qualquer que seja. Em 23/10/2026 eram 96 trechos em 19 arquivos,
// e a maioria estava em arquivos que eu havia dado por convertidos.
//
// O erro que torna este check necessário: a conversão foi feita procurando
// ternários `lang === …` e trocando cada um. Texto cravado direto no JSX nunca
// foi condicional, então nenhuma busca pelo ternário o encontrava, e o arquivo
// parecia pronto. BlockViewer ainda mostra "Status do Epoch" ao lado de "Live
// Block Explorer" por causa disso.
//
// É uma CATRACA, não uma proibição. A linha de base está em
// baseline_english.json e o check falha quando um arquivo PIORA. Quando um
// arquivo melhora, ele diz para baixar a base — é assim que o número desce e
// não volta a subir.
//
// node test_no_hardcoded_english.mjs            verifica
// node test_no_hardcoded_english.mjs --gravar   regrava a linha de base
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = 'components';
const BASE = 'baseline_english.json';

// Sem texto de tela: ícones SVG e o próprio contexto de idioma.
const PULAR = new Set(['IconComponents.tsx', 'LanguageContext.tsx']);

/** Trechos equilibrados a partir de cada `nome(`. */
function faixasDeChamada(fonte, nomes) {
    const faixas = [];
    for (const nome of nomes) {
        const re = new RegExp(`\\b${nome.replace(/\$/g, '\\$')}\\s*\\(`, 'g');
        let m;
        while ((m = re.exec(fonte)) !== null) {
            let nivel = 0;
            for (let i = m.index + m[0].length - 1; i < fonte.length; i++) {
                if (fonte[i] === '(') nivel++;
                else if (fonte[i] === ')') {
                    nivel--;
                    if (nivel === 0) { faixas.push([m.index, i + 1]); break; }
                }
            }
        }
    }
    return faixas;
}

function faixasDeComentario(fonte) {
    const faixas = [];
    const re = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
    let m;
    while ((m = re.exec(fonte)) !== null) faixas.push([m.index, m.index + m[0].length]);
    return faixas;
}

/** Ramos `en: { … }`, `pt: { … }`, `es: { … }` de um objeto de conteúdo. */
function faixasDeRamo(fonte) {
    const faixas = [];
    const re = /\b(en|pt|es)\s*:\s*\{/g;
    let m;
    while ((m = re.exec(fonte)) !== null) {
        let nivel = 0;
        for (let i = m.index + m[0].length - 1; i < fonte.length; i++) {
            if (fonte[i] === '{') nivel++;
            else if (fonte[i] === '}') {
                nivel--;
                if (nivel === 0) { faixas.push([m.index, i + 1]); break; }
            }
        }
    }
    return faixas;
}

/** Nomes de tradutor válidos neste arquivo: os globais e os locais de 3 línguas. */
function tradutores(fonte) {
    const nomes = new Set(['tri', 'triGlobal', 't']);
    const decl = /const\s+([A-Za-z_$][\w$]*)\s*=\s*\(([^)]*)\)/g;
    let d;
    while ((d = decl.exec(fonte)) !== null) {
        const p = d[2];
        if (/\ben\b/.test(p) && /\bpt\b/.test(p)) nomes.add(d[1]);
    }
    return nomes;
}

/** Frases de tela que não estão dentro de nenhum tradutor. */
export function achadosDe(fonte) {
    const dentro = [
        ...faixasDeChamada(fonte, tradutores(fonte)),
        ...faixasDeComentario(fonte),
        ...faixasDeRamo(fonte),
    ];
    const coberto = (p) => dentro.some(([a, b]) => p >= a && p < b);

    const achados = [];
    // Texto solto entre tags: três palavras ou mais, começando em maiúscula.
    const jsx = />\s*([A-Z][a-z]+(?: [A-Za-zÀ-ÿ,'’&-]+){2,}[.?!]?)\s*</g;
    let m;
    while ((m = jsx.exec(fonte)) !== null) {
        if (!coberto(m.index + m[0].indexOf(m[1]))) achados.push(m[1]);
    }
    // Atributos que o leitor vê.
    const attr = /(?:placeholder|title|aria-label)="([A-Z][^"]{10,})"/g;
    while ((m = attr.exec(fonte)) !== null) {
        if (!coberto(m.index + m[0].indexOf(m[1]))) achados.push(m[1]);
    }
    return achados;
}

const atual = {};
for (const nome of readdirSync(PASTA).sort()) {
    if (!nome.endsWith('.tsx') || PULAR.has(nome)) continue;
    const achados = achadosDe(readFileSync(join(PASTA, nome), 'utf8'));
    if (achados.length) atual[nome] = achados.length;
}

const soma = (o) => Object.values(o).reduce((a, b) => a + b, 0);

if (process.argv.includes('--gravar')) {
    writeFileSync(BASE, JSON.stringify(atual, null, 2) + String.fromCharCode(10));
    console.log(`linha de base regravada: ${soma(atual)} trechos em ${Object.keys(atual).length} arquivos`);
    process.exit(0);
}

assert.ok(existsSync(BASE), `${BASE} não existe. Rode com --gravar uma vez.`);
const base = JSON.parse(readFileSync(BASE, 'utf8'));

const pioraram = [];
const melhoraram = [];
for (const nome of new Set([...Object.keys(atual), ...Object.keys(base)])) {
    const a = atual[nome] ?? 0;
    const b = base[nome] ?? 0;
    if (a > b) pioraram.push(`${nome}: ${b} -> ${a}`);
    else if (a < b) melhoraram.push(`${nome}: ${b} -> ${a}`);
}

assert.deepEqual(
    pioraram, [],
    `texto de tela novo preso numa língua só:${String.fromCharCode(10)}  ` +
    pioraram.join(String.fromCharCode(10) + '  ') +
    `${String.fromCharCode(10)}  Envolva em tri('inglês', 'português', 'espanhol'). ` +
    `Esta é uma catraca: o número pode descer, nunca subir.`
);

if (melhoraram.length) {
    console.log('melhorou — rode com --gravar para firmar:');
    for (const x of melhoraram) console.log('  ' + x);
}
console.log(`ok  ${soma(atual)} trechos restantes em ${Object.keys(atual).length} arquivos (base: ${soma(base)})`);
