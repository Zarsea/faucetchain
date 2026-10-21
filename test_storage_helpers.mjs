// Um envelope de armazenamento precisa chamar o armazenamento.
//
// Em 21/10/2026 o `gravar` do AuthContext ficou assim:
//
//     const gravar = (chave, valor) => {
//         try { gravar(chave, valor); } catch { }
//     };
//
// Ele chamava a si mesmo. A recursao estourava a pilha, o `catch` engolia o
// RangeError, e nada nunca era escrito -- sem erro no console, sem aviso na
// tela. O efeito so aparecia dois passos adiante: a sessao nao persistia, um
// F5 deslogava, e a tela de privacidade respondia 401 porque o token nunca
// tinha sido guardado.
//
// Nenhum teste pegou porque o defeito mora exatamente onde os testes nao
// olham: dentro de um `catch` vazio, que e justamente o que existe para
// esconder excecoes. Estes checks olham o fonte.
//
// node test_storage_helpers.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ARQUIVO = 'components/AuthContext.tsx';
const fonte = readFileSync(ARQUIVO, 'utf8');

/** O corpo de `const <nome> = (...) => { ... };`, equilibrando chaves. */
function corpoDe(nome) {
    const inicio = fonte.search(new RegExp(`const ${nome}\\s*=\\s*\\(`));
    assert.ok(inicio >= 0, `${ARQUIVO}: nao encontrei o helper \`${nome}\``);
    const abre = fonte.indexOf('{', fonte.indexOf('=>', inicio));
    let nivel = 0;
    for (let i = abre; i < fonte.length; i++) {
        if (fonte[i] === '{') nivel++;
        else if (fonte[i] === '}' && --nivel === 0) return fonte.slice(abre + 1, i);
    }
    throw new Error(`${ARQUIVO}: chaves desequilibradas em \`${nome}\``);
}

// nome do helper -> o metodo de localStorage que ele tem de chamar
const ENVELOPES = {
    guardado: 'getItem',
    gravar: 'setItem',
    apagar: 'removeItem',
};

let falhas = 0;
for (const [nome, metodo] of Object.entries(ENVELOPES)) {
    const corpo = corpoDe(nome);

    // 1. chama o armazenamento de verdade
    const chama = corpo.includes(`localStorage.${metodo}(`);
    if (!chama) {
        console.log(`FALHA  \`${nome}\` nao chama localStorage.${metodo}()`);
        console.log(`       corpo: ${corpo.replace(/\s+/g, ' ').trim().slice(0, 90)}`);
        falhas++;
        continue;
    }

    // 2. e nao chama a si mesmo -- o defeito exato de 21/10
    const recursivo = new RegExp(`(^|[^.\\w])${nome}\\s*\\(`).test(corpo);
    if (recursivo) {
        console.log(`FALHA  \`${nome}\` chama a si mesmo: recursao infinita dentro de um try`);
        console.log(`       corpo: ${corpo.replace(/\s+/g, ' ').trim().slice(0, 90)}`);
        falhas++;
        continue;
    }

    console.log(`ok     \`${nome}\` -> localStorage.${metodo}()`);
}

// 3. Fora dos envelopes, ninguem toca localStorage sem protecao. Uma leitura
//    desprotegida no corpo do provider derruba a renderizacao inteira quando o
//    navegador recusa armazenamento, e a pessoa recebe uma tela branca.
const linhas = fonte.split('\n');
const soltas = [];
linhas.forEach((linha, i) => {
    if (!/localStorage\./.test(linha)) return;
    const janela = linhas.slice(Math.max(0, i - 4), i + 1).join('\n');
    if (!/try\s*\{/.test(janela)) soltas.push(`${i + 1}: ${linha.trim().slice(0, 70)}`);
});
if (soltas.length) {
    console.log(`FALHA  ${soltas.length} acesso(s) a localStorage sem try:`);
    soltas.forEach(l => console.log(`       ${ARQUIVO}:${l}`));
    falhas++;
} else {
    console.log('ok     todo acesso a localStorage esta protegido');
}

console.log(falhas ? `\n${falhas} falha(s)` : '\nenvelopes de armazenamento ok');
process.exit(falhas ? 1 : 0);
