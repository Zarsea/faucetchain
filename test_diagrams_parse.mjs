// Analisa os 14 diagramas com o proprio mermaid, no securityLevel da tela.
//
//     node test_diagrams_parse.mjs
//
// Um erro de sintaxe num diagrama nao quebra o build nem o typecheck: aparece
// como caixa vermelha para quem abrir a pagina, que no nosso caso e um juiz.
// Nada cobria isso ate 8/10/2026, quando os sete diagramas foram reescritos
// para incluir a liquidacao na Solana.
//
// Prova de que o teste morde: trocar `flowchart TD` por `flowchart XYZ` em
// constants.ts faz este script sair com codigo 1 e nomear o diagrama.
//
// Precisa de jsdom (`npm install --no-save jsdom`); o mermaid ja e dependencia
// do projeto.
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
// navigator so tem getter no Node 22; mermaid.parse nao precisa dele.
global.DOMPurify = undefined;

const src = fs.readFileSync(path.join(RAIZ, 'constants.ts'), 'utf8');
const bloco = src.slice(src.indexOf('export const DIAGRAMS'), src.indexOf('export const POC_WEIGHT_LOGIC_CODE'));

// Extrai cada NOME: `...` do objeto.
//
// Os comentarios saem antes. Uma linha de prosa como "as funcoes tambem nao:
// `merit_points`" casa com o mesmo padrao e vira um diagrama fantasma chamado
// "nao", que falha com "No diagram type detected" -- ja aconteceu.
const semComentarios = bloco.replace(/^\s*\/\/.*$/gm, '');
const achados = [...semComentarios.matchAll(/(\w+):\s*`([\s\S]*?)`/g)].map(m => ({ nome: m[1], codigo: m[2] }));
console.log(`diagramas encontrados: ${achados.length}`);

const mermaid = (await import('mermaid')).default;
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

let ruins = 0;
for (const { nome, codigo } of achados) {
  try {
    await mermaid.parse(codigo);
    console.log(`  ok    ${nome}`);
  } catch (e) {
    ruins++;
    console.log(`  ERRO  ${nome}: ${String(e.message ?? e).split('\n')[0]}`);
  }
}
console.log(ruins ? `\n${ruins} diagrama(s) com erro de sintaxe` : '\ntodos analisam sem erro');
process.exit(ruins ? 1 : 0);
