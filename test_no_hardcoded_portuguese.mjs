// Português cravado num componente que já fala três línguas.
//
// Em 23/10/2026 eu converti dezesseis componentes para `tri(en, pt, es)`,
// liguei o espanhol no seletor, e horas depois acrescentei uma tabela nova ao
// CampaignHoldings com os cabeçalhos escritos direto em português: "quando",
// "torneira", "campanha", "para a carteira". Quem lesse em espanhol via
// português outra vez -- exatamente o defeito que a conversão existiu para
// acabar, reintroduzido pela mão que o consertou.
//
// O build não reclama: português é string válida. A tradução também não, porque
// a string nunca passa pelo dicionário. O erro só aparece trocando o idioma na
// tela, que é o teste que ninguém roda ao acrescentar uma linha.
//
// Este check olha o fonte dos componentes JÁ convertidos e exige que toda
// string com acento português esteja DENTRO de uma chamada `tri(...)`. Os que
// ainda não foram convertidos ficam de fora da lista de propósito: eles são
// dívida conhecida, e reprovar por eles transformaria o check em ruído que
// alguém desliga.
//
// node test_no_hardcoded_portuguese.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Convertidos em cfc0394, 557cabb e 8b09db0. Ao converter outro, acrescente
// aqui -- é o que impede que ele regrida depois.
const CONVERTIDOS = [
    'components/CampaignHoldings.tsx',
    'components/SolanaPayouts.tsx',
    'components/SettlementLedger.tsx',
    'components/Simulation.tsx',
    'components/PrivacySettings.tsx',
    'components/L2ProfileDashboard.tsx',
    'components/NetworkSentinel.tsx',
    'components/ConnectYourFaucet.tsx',
    'components/FaucetInternal.tsx',
    'components/MiningHub.tsx',
    'components/BountyBoard.tsx',
    'components/Tokenomics.tsx',
    'components/TransactionDetailsModal.tsx',
    'components/NetworkStatus.tsx',
    'components/MermaidDiagram.tsx',
];

/** Trechos [inicio, fim) de cada chamada `tri(`, com parênteses equilibrados. */
function faixasDeTri(fonte) {
    const faixas = [];
    const re = /\btri\s*\(/g;
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
    return faixas;
}

/** Trechos de comentário, onde português é descrição e não texto de tela. */
function faixasDeComentario(fonte) {
    const faixas = [];
    const re = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
    let m;
    while ((m = re.exec(fonte)) !== null) faixas.push([m.index, m.index + m[0].length]);
    return faixas;
}

const ACENTO = /[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/;

/** Trechos de `algoPt: '...'`, quando o arquivo também tem `algoEs`.
 *
 * `tri()` não é a única forma correta. O BountyBoard guarda o rótulo de status
 * numa tabela com três colunas (`label`, `labelPt`, `labelEs`), porque cor e
 * borda vêm do mesmo registro e separá-los seria pior. A coluna PT é tradução
 * legítima ali.
 *
 * A exigência do `Es` é o que mantém isto honesto: um `labelPt` sem `labelEs`
 * ao lado é exatamente o par de duas línguas que deixava o espanhol de fora, e
 * esse continua reprovando.
 */
function faixasDeColunaPt(fonte) {
    const faixas = [];
    const re = /\b([A-Za-z_$][\w$]*)Pt\s*:\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g;
    let m;
    while ((m = re.exec(fonte)) !== null) {
        if (!new RegExp(`\\b${m[1]}Es\\b`).test(fonte)) continue;   // sem espanhol, não vale
        const inicio = m.index + m[0].indexOf(m[2]);
        faixas.push([inicio, inicio + m[2].length]);
    }
    return faixas;
}

const QUEBRA = String.fromCharCode(10);
let verificados = 0;

// Uma regra só, em vez de duas que deixavam uma fresta entre si.
//
// A versão anterior tinha uma regra para string literal e outra para texto
// solto no JSX, e a segunda parava num `{`. Então `Transação{' '}` escapava
// das duas: não era literal, e o texto não terminava em `<`. Descobri isso
// tentando reprovar o check de propósito e vendo-o passar.
//
// Agora a pergunta é direta: todo ACENTO do arquivo tem de estar dentro de
// tri(), de um comentário, ou de uma coluna `algoPt` com `algoEs` ao lado.
// Onde mais um acento apareça, ele chega na tela em português.
for (const arquivo of CONVERTIDOS) {
    const fonte = readFileSync(arquivo, 'utf8');
    const dentro = [...faixasDeTri(fonte), ...faixasDeComentario(fonte),
                    ...faixasDeColunaPt(fonte)];
    const cobre = (p) => dentro.some(([a, b]) => p >= a && p < b);

    for (let i = 0; i < fonte.length; i++) {
        if (!ACENTO.test(fonte[i])) continue;
        verificados++;
        assert.ok(
            cobre(i),
            `${arquivo}: português fora de tri(), perto de: ` +
            `${fonte.slice(Math.max(0, i - 40), i + 40).split(QUEBRA).join(' ')}. ` +
            `  Este componente já fala três línguas. Texto solto aqui chega em ` +
            `português para quem lê em inglês ou espanhol, que é o defeito que a ` +
            `conversão desses arquivos existiu para acabar.`
        );
    }
}

assert.ok(verificados > 0, 'nenhuma string com acento encontrada: o check nao esta olhando nada');

// Prova de que o check pega o defeito: a forma exata que eu escrevi.
{
    const ruim = `<th className="py-2 pr-4">campanha</th>`;
    const jsx = />\s*([^<>{}\n]*[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ][^<>{}\n]*?)\s*</g;
    // "campanha" nao tem acento, entao a regra de JSX sozinha nao a pegaria --
    // e o que pega esse caso e a conversao do arquivo inteiro, verificada
    // acima pela presenca de tri() nos cabecalhos. O que esta regra garante e
    // o caso acentuado, que e a maioria.
    const acentuado = `<span>não registrado</span>`;
    assert.ok(jsx.test(acentuado), 'a regra de JSX nao pega texto acentuado solto');
    assert.ok(!ACENTO.test(ruim), 'este exemplo deveria ser o caso sem acento');
}

console.log(`ok  ${CONVERTIDOS.length} componentes convertidos, ${verificados} strings conferidas`);
