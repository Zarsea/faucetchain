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
    'components/InfrastructureMonitor.tsx',
    'components/FaucetHub.tsx',
    'components/ApiDocs.tsx',
    'components/ClaimEventSection.tsx',
    'components/GeneralArticle.tsx',
    'components/DappsEnvironment.tsx',
    'components/CodeViewer.tsx',
    'components/MiningHub.tsx',
    'components/BountyBoard.tsx',
    'components/Tokenomics.tsx',
    'components/TransactionDetailsModal.tsx',
    'components/NetworkStatus.tsx',
    'components/MermaidDiagram.tsx',
    // Convertidos em 25/10. `ConnectFaucet` e o caso que mostrou o furo desta
    // lista: o ratchet guardava `ConnectYourFaucet`, que so vive dentro do
    // Dapps, enquanto quem esta roteado no App.tsx e este -- e este mandava
    // portugues para quem pedia espanhol, em dezoito pontos.
    'components/ConnectFaucet.tsx',
    'components/BlockViewer.tsx',
    // Os dois que a varredura por acento nunca ia alcançar: "Travado", "Valor",
    // "UTXOs Ativos", "Mineradores", "Hubs Externas" — nenhuma tem acento.
    'components/AddressTracker.tsx',
    'components/StakingVault.tsx',
];

/** Trechos [inicio, fim) de cada chamada `tri(`, com parênteses equilibrados. */
function faixasDeTri(fonte) {
    const faixas = [];
    // triGlobal conta como tri: e a mesma funcao para quem nao pode chamar o
    // hook, e o texto dentro dela esta igualmente traduzido.
    const re = /\btri(Global)?\s*\(/g;
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

/** Trechos de chamadas a um tradutor LOCAL do próprio arquivo.
 *
 * ApiDocs e WalletPanel declaram o seu: `const T = (en, pt, es?) => ...`. É a
 * mesma ideia do `tri`, com outro nome, e o texto dentro dessas chamadas está
 * igualmente traduzido.
 *
 * A exigência é que a assinatura mencione as três línguas. Um helper de duas
 * é exatamente o par que deixava o espanhol de fora, e continua reprovando.
 */
function faixasDeTradutorLocal(fonte) {
    const nomes = [];
    const decl = /const\s+([A-Za-z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*(?::[^=]*)?=>/g;
    let d;
    while ((d = decl.exec(fonte)) !== null) {
        const params = d[2];
        if (/\ben\b/.test(params) && /\bpt\b/.test(params) && /\bes\b/.test(params)) {
            nomes.push(d[1]);
        }
    }
    const faixas = [];
    for (const nome of nomes) {
        const re = new RegExp(`\\b${nome}\\s*\\(`, 'g');
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

/** O ramo `pt: { ... }` de um objeto de conteúdo que também tem `es:`.
 *
 * ClaimEventSection e GeneralArticle guardam o artigo inteiro assim, um ramo
 * por língua, porque são dezenas de campos e não frases soltas. O ramo PT só
 * é alcançado quando a língua é PT.
 *
 * Como no caso da coluna Pt, exigir o `es` é o que mantém isto honesto: um
 * objeto de dois ramos é o defeito original e continua reprovando.
 */
function faixasDeRamoPt(fonte) {
    if (!/\bes\s*:\s*\{/.test(fonte)) return [];
    const faixas = [];
    // `es` entra junto porque espanhol e português dividem os acentos: sem
    // isto o check acusaria a própria tradução que ele existe para exigir.
    const re = /\b(pt|es)\s*:\s*\{/g;
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
                    ...faixasDeColunaPt(fonte), ...faixasDeTradutorLocal(fonte),
                    ...faixasDeRamoPt(fonte)];
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

// ─────────────────────────────── português SEM acento, que o resto não pega
//
// O comentário da prova abaixo já admitia isto: "campanha" não tem acento,
// então a varredura por acento passa batido. Em 25/10 isso custou quatro telas
// — "Travado", "Valor", "UTXOs Ativos", "Mineradores", "Hubs Externas" —
// aparecendo em português para quem lia em inglês.
//
// A dificuldade é que este código nomeia variável em português: `valor`,
// `faixas`, `estimativaPorEpoch`. Uma lista de palavras varrendo o arquivo
// inteiro acusaria o código junto com a tela. Por isso esta parte olha só onde
// texto chega ao usuário: nó de texto JSX e literal de string.
const SEM_ACENTO = [
    'ativo', 'ativos', 'ativa', 'ativas', 'travado', 'travada', 'destravado',
    'aguardando', 'buscando', 'carregando', 'salvando', 'enviando', 'minerando',
    'minerador', 'mineradores', 'validador', 'validadores',
    'campanha', 'campanhas', 'torneira', 'torneiras', 'carteira', 'carteiras',
    'saldo', 'saldos', 'saque', 'saques', 'resgate', 'recompensa', 'recompensas',
    'sucesso', 'falha', 'erro', 'pendente', 'pendentes', 'externas',
    'fechado', 'fechada', 'aberto', 'aberta', 'estimativa', 'liquidacao',
];
const RE_SEM_ACENTO = new RegExp(`\\b(${SEM_ACENTO.join('|')})\\b`, 'gi');

/** Literal que é VALOR e não rótulo: comparado com `===`, `!==` ou `==`.
 *
 * `f.status === 'Ativa'` é contrato com o servidor, não texto de tela. O
 * servidor devolve "Ativa" e o componente compara; traduzir isso quebraria a
 * comparação em vez de traduzir coisa alguma. O que precisa de `tri()` é o que
 * sai do outro lado do ternário, e esse a varredura continua vendo.
 */
function faixasDeComparacao(fonte) {
    const faixas = [];
    const re = /[=!]==?\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g;
    let m;
    while ((m = re.exec(fonte)) !== null) {
        const inicio = m.index + m[0].indexOf(m[1]);
        faixas.push([inicio, inicio + m[1].length]);
    }
    return faixas;
}

/** Nó de texto JSX e literal de string: onde texto alcança a tela. */
function faixasDeTextoVisivel(fonte) {
    const faixas = [];
    for (const re of [
        />([^<>{}\n]{2,})</g,                       // texto entre tags
        /'((?:[^'\\\n]|\\.){2,})'/g,                // literal com aspas simples
        /"((?:[^"\\\n]|\\.){2,})"/g,                // literal com aspas duplas
        /`((?:[^`\\]|\\.){2,})`/g,                  // template literal
    ]) {
        let m;
        while ((m = re.exec(fonte)) !== null) {
            const inicio = m.index + m[0].indexOf(m[1]);
            faixas.push([inicio, inicio + m[1].length]);
        }
    }
    return faixas;
}

let semAcentoVerificados = 0;
for (const arquivo of CONVERTIDOS) {
    const fonte = readFileSync(arquivo, 'utf8');
    const dentro = [...faixasDeTri(fonte), ...faixasDeComentario(fonte),
                    ...faixasDeColunaPt(fonte), ...faixasDeTradutorLocal(fonte),
                    ...faixasDeRamoPt(fonte), ...faixasDeComparacao(fonte)];
    const cobre = (p) => dentro.some(([a, b]) => p >= a && p < b);
    const visivel = faixasDeTextoVisivel(fonte);
    const naTela = (p) => visivel.some(([a, b]) => p >= a && p < b);

    let m;
    RE_SEM_ACENTO.lastIndex = 0;
    while ((m = RE_SEM_ACENTO.exec(fonte)) !== null) {
        if (!naTela(m.index) || cobre(m.index)) continue;
        semAcentoVerificados++;
        assert.fail(
            `${arquivo}: "${m[1]}" é português sem acento, em texto que chega à tela, ` +
            `fora de tri(). Perto de: ` +
            `${fonte.slice(Math.max(0, m.index - 50), m.index + 50).split(QUEBRA).join(' ')}. ` +
            `  A varredura por acento não pega palavra sem acento, e foi assim que ` +
            `"Travado", "Valor" e "Mineradores" ficaram em português em quatro telas.`
        );
    }
}

// Prova de que a parte sem acento pega o defeito: o caso exato de 25/10.
{
    const ruim = `<span className="x">Travado</span>`;
    const visivel = faixasDeTextoVisivel(ruim);
    RE_SEM_ACENTO.lastIndex = 0;
    const achou = RE_SEM_ACENTO.exec(ruim);
    assert.ok(achou, 'a lista sem acento nao achou "Travado"');
    assert.ok(visivel.some(([a, b]) => achou.index >= a && achou.index < b),
              'o texto entre tags nao foi reconhecido como visivel');

    // E de que nao acusa identificador em portugues, que este codigo usa muito.
    const codigo = `const valor = calcularSaldo(campanha);`;
    const vis2 = faixasDeTextoVisivel(codigo);
    RE_SEM_ACENTO.lastIndex = 0;
    let f, falsos = 0;
    while ((f = RE_SEM_ACENTO.exec(codigo)) !== null) {
        if (vis2.some(([a, b]) => f.index >= a && f.index < b)) falsos++;
    }
    assert.equal(falsos, 0, 'a lista acusou identificador em portugues fora de string');
}

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
