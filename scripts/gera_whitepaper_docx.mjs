// Gera FaucetChain_WhitePaper.docx a partir do markdown que e o registro.
//
//     node scripts/gera_whitepaper_docx.mjs
//
// E um conversor, nao uma transcricao, por um motivo so: o whitepaper muda, e
// um .docx escrito a mao envelhece na primeira edicao do .md sem avisar
// ninguem. Rodar isto de novo e a unica forma de manter os dois iguais.
//
// Cobre o que o documento usa de verdade -- titulo, secoes, paragrafos,
// **negrito**, `codigo`, listas, tabelas, blocos de codigo, regua e links --
// e nada alem disso. Um construto novo no markdown aparece aqui como texto
// cru, que e visivel e portanto corrigivel, em vez de sumir em silencio.
import fs from 'node:fs';
import path from 'node:path';
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel,
  LevelFormat, Packer, PageBreak, Paragraph, ShadingType, Table, TableCell,
  TableRow, TextRun, WidthType,
} from 'docx';

const RAIZ = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
const ORIGEM = path.join(RAIZ, 'FaucetChain_Master_WhitePaper.md');
const DESTINO = path.join(RAIZ, 'FaucetChain_WhitePaper.docx');
const REPO = 'https://github.com/Zarsea/faucetchain/blob/main/';

const CORPO = 'Georgia';
const MONO = 'Consolas';
const TINTA = '1A1A1A';
const QUIETO = '5A5A5A';
const REGUA = 'D4D4D4';

// --- inline: **negrito**, `codigo`, [texto](url) -------------------------
// Uma passada so, com uma expressao que casa os tres, para nao reprocessar o
// que ja virou run -- negrito dentro de link era o caso que quebrava.
function runs(texto, base = {}) {
  const saida = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let i = 0, m;
  while ((m = re.exec(texto)) !== null) {
    if (m.index > i) saida.push(new TextRun({ text: texto.slice(i, m.index), font: CORPO, ...base }));
    if (m[1] !== undefined) {
      const alvo = m[2].startsWith('http') ? m[2] : REPO + m[2];
      saida.push(new ExternalHyperlink({
        link: alvo,
        children: [new TextRun({ text: m[1].replace(/`/g, ''), font: CORPO, style: 'Hyperlink', ...base })],
      }));
    } else if (m[3] !== undefined) {
      saida.push(new TextRun({ text: m[3], font: CORPO, bold: true, ...base }));
    } else {
      saida.push(new TextRun({ text: m[4], font: MONO, size: 19, color: '0B5394', ...base }));
    }
    i = re.lastIndex;
  }
  if (i < texto.length) saida.push(new TextRun({ text: texto.slice(i), font: CORPO, ...base }));
  return saida.length ? saida : [new TextRun({ text: '', font: CORPO })];
}

const p = (texto, extra = {}) => new Paragraph({
  children: runs(texto), spacing: { after: 160, line: 300 },
  alignment: AlignmentType.JUSTIFIED, ...extra,
});

// --- tabela ---------------------------------------------------------------
const LARGURA = 9360;                       // 6,5" em DXA, dentro das margens

function tabela(linhas) {
  const celulas = linhas.map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
  const corpo = celulas.filter(c => !c.every(x => /^-+:?$/.test(x) || x === ''));
  const colunas = Math.max(...corpo.map(c => c.length));
  const larg = Math.floor(LARGURA / colunas);
  const colunaWidths = Array(colunas).fill(larg);
  colunaWidths[colunas - 1] = LARGURA - larg * (colunas - 1);   // fecha a soma

  return new Table({
    columnWidths: colunaWidths,
    width: { size: LARGURA, type: WidthType.DXA },
    rows: corpo.map((celula, idx) => new TableRow({
      tableHeader: idx === 0,
      children: Array.from({ length: colunas }, (_, j) => new TableCell({
        width: { size: colunaWidths[j], type: WidthType.DXA },
        shading: idx === 0 ? { type: ShadingType.CLEAR, fill: 'F2F2F2' } : undefined,
        margins: { top: 90, bottom: 90, left: 120, right: 120 },
        children: [new Paragraph({
          children: runs(celula[j] ?? '', idx === 0 ? { bold: true } : {}),
          spacing: { after: 0, line: 260 },
        })],
      })),
    })),
  });
}

// --- o percurso -----------------------------------------------------------
const linhas = fs.readFileSync(ORIGEM, 'utf8').split(/\r?\n/);
const filhos = [];
let i = 0;

// O titulo e a linha de versao viram capa; o markdown os repete no topo.
while (i < linhas.length && !linhas[i].startsWith('## ')) i++;

filhos.push(
  new Paragraph({ text: '', spacing: { after: 2400 } }),
  new Paragraph({
    children: [new TextRun({ text: 'FaucetChain', font: CORPO, size: 72, bold: true, color: TINTA })],
    alignment: AlignmentType.CENTER, spacing: { after: 200 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Micro-distribution that settles on Solana', font: CORPO, size: 30, color: QUIETO })],
    alignment: AlignmentType.CENTER, spacing: { after: 1400 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Version 2.1  ·  revised 8 October 2026', font: CORPO, size: 22, color: QUIETO })],
    alignment: AlignmentType.CENTER, spacing: { after: 120 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Supersedes the March 2026 paper', font: CORPO, size: 22, color: QUIETO })],
    alignment: AlignmentType.CENTER, spacing: { after: 1200 },
  }),
  // Uma frase, um paragrafo: centralizado, o Word quebra a linha sozinho.
  // Parti-la em dois para "controlar" a quebra deixava meia frase orfa em
  // qualquer leitor com outra largura.
  new Paragraph({
    children: [new TextRun({
      text: 'Every figure in this paper was read from the chain or the ledger on the date above. '
          + 'Section 11 records what earlier versions of it got wrong.',
      font: CORPO, size: 20, color: QUIETO,
    })],
    alignment: AlignmentType.CENTER, spacing: { after: 0, line: 280 },
    indent: { left: 900, right: 900 },
  }),
  new Paragraph({ children: [new PageBreak()] }),
);

for (; i < linhas.length; i++) {
  const l = linhas[i];

  if (l.trim() === '' || l.trim() === '---') continue;

  if (l.startsWith('## ')) {
    filhos.push(new Paragraph({
      children: [new TextRun({ text: l.slice(3).trim(), font: CORPO, size: 30, bold: true, color: TINTA })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 420, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: REGUA, space: 8 } },
    }));
    continue;
  }

  if (l.startsWith('### ')) {
    filhos.push(new Paragraph({
      children: [new TextRun({ text: l.slice(4).trim(), font: CORPO, size: 24, bold: true, color: TINTA })],
      heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 140 },
    }));
    continue;
  }

  if (l.startsWith('|')) {
    const bloco = [];
    while (i < linhas.length && linhas[i].startsWith('|')) bloco.push(linhas[i++]);
    i--;
    filhos.push(tabela(bloco));
    filhos.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    continue;
  }

  if (l.startsWith('```')) {
    i++;
    const bloco = [];
    while (i < linhas.length && !linhas[i].startsWith('```')) bloco.push(linhas[i++]);
    for (const [k, c] of bloco.entries()) {
      filhos.push(new Paragraph({
        children: [new TextRun({ text: c || ' ', font: MONO, size: 19, color: '24292F' })],
        shading: { type: ShadingType.CLEAR, fill: 'F6F8FA' },
        spacing: { after: k === bloco.length - 1 ? 200 : 0, line: 260 },
        indent: { left: 240, right: 240 },
      }));
    }
    continue;
  }

  if (l.startsWith('- ')) {
    // Itens continuam em linhas indentadas; juntar antes de emitir, senao cada
    // quebra do markdown vira um marcador novo.
    let texto = l.slice(2).trim();
    while (i + 1 < linhas.length && /^\s{2,}\S/.test(linhas[i + 1])) texto += ' ' + linhas[++i].trim();
    filhos.push(new Paragraph({
      children: runs(texto), numbering: { reference: 'marcadores', level: 0 },
      spacing: { after: 120, line: 300 },
    }));
    continue;
  }

  if (/^\d+\. /.test(l)) {
    let texto = l.replace(/^\d+\.\s+/, '');
    while (i + 1 < linhas.length && /^\s{3,}\S/.test(linhas[i + 1])) texto += ' ' + linhas[++i].trim();
    filhos.push(new Paragraph({
      children: runs(texto), numbering: { reference: 'numerada', level: 0 },
      spacing: { after: 120, line: 300 },
    }));
    continue;
  }

  // Paragrafo: o markdown quebra em 80 colunas, o Word nao deve herdar isso.
  let texto = l.trim();
  while (i + 1 < linhas.length && linhas[i + 1].trim() !== ''
         && !/^(#{2,}|[-|`]|\d+\. )/.test(linhas[i + 1].trim())) {
    texto += ' ' + linhas[++i].trim();
  }
  filhos.push(p(texto));
}

const doc = new Document({
  creator: 'FaucetChain',
  title: 'FaucetChain — Micro-distribution that settles on Solana',
  description: 'Whitepaper, version 2.1',
  numbering: {
    config: [
      { reference: 'marcadores', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 460, hanging: 240 } } } }] },
      { reference: 'numerada', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 460, hanging: 240 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },           // US Letter
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      },
    },
    children: filhos,
  }],
});

const buf = await Packer.toBuffer(doc);
fs.writeFileSync(DESTINO, buf);
console.log(`escrito: ${DESTINO}`);
console.log(`  ${filhos.length} blocos, ${(buf.length / 1024).toFixed(0)} KB`);
