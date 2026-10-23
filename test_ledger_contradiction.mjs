// Uma tela nao pode afirmar duas coisas opostas sobre o mesmo fato.
//
// A campanha 711670 mostrava, na mesma pagina:
//
//     Collected   350,00      (lido de on_chain.paid, a Solana falando)
//     "The roots below already promise value; <negativa de qualquer saque>"
//
// As duas frases liam fontes diferentes e a segunda nao sabia disso. A cadeia
// conta TODO saque; a tabela vinha de `relayer_spend`, que so ganha linha
// quando o NOSSO relayer assina e paga a taxa. Quem saca pagando a propria
// taxa liquida na Solana sem passar por este servidor.
//
// A primeira correcao so ajustou o texto. A definitiva trocou a FONTE: a
// secao passou a ser montada do bitmap de cada raiz publicada, entao ela ve
// todo saque e a assinatura virou uma coluna, em vez de ser o que decide se a
// linha existe.
//
// Nenhum teste pegou porque os dois numeros estavam certos. O defeito estava
// na frase que os ligava, e frase nao tem assert. Estes checks olham o fonte.
//
// node test_ledger_contradiction.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ARQUIVO = 'components/SettlementLedger.tsx';
const fonte = readFileSync(ARQUIVO, 'utf8');

// A secao tem de comecar perguntando se a cadeia foi lida. Enquanto ela
// decidir por uma tabela nossa, volta a negar saque que a Solana registrou.
assert.ok(
    fonte.includes('ledger?.collected == null ?'),
    `${ARQUIVO}: a secao de saques nao comeca perguntando se a cadeia respondeu.`
);

// ─────────────────────────────────────── a fonte

// A lista tem de vir da cadeia. `payouts` so enxerga o nosso relayer.
assert.ok(
    /ledger\.collected\.map/.test(fonte),
    `${ARQUIVO}: as linhas nao saem de ledger.collected. Se saem de payouts, ` +
    `quem pagou a propria taxa some da tela outra vez.`
);
assert.ok(
    !/ledger\.payouts\.map/.test(fonte),
    `${ARQUIVO}: ainda ha uma tabela montada sobre payouts, que e parcial por ` +
    `construcao.`
);

// ─────────────────────────────────────── silencio nao e ausencia

// `null` (cadeia muda) e `[]` (cadeia disse que ninguem sacou) sao fatos
// diferentes e precisam de frases diferentes. Juntar os dois foi o defeito.
assert.ok(
    /collected\.length === 0/.test(fonte),
    `${ARQUIVO}: nada separa "a cadeia nao respondeu" de "a cadeia disse que ` +
    `ninguem sacou". Lista vazia vira negativa, que e como 711670 mentiu.`
);

// A afirmacao chapada nao pode voltar em nenhuma forma.
assert.ok(
    !/nobody has collected/i.test(fonte),
    `${ARQUIVO}: voltou uma negativa de saque que nao depende da cadeia.`
);

// ─────────────────────────────────────── a assinatura e coluna, nao filtro

// Sem assinatura o saque continua real; a celula explica, a linha fica.
assert.ok(
    /p\.signature \?/.test(fonte),
    `${ARQUIVO}: a assinatura precisa ser uma coluna condicional. Se ela ` +
    `filtrar a linha, o saque sem relayer desaparece de novo.`
);
assert.ok(
    /paid their own fee/.test(fonte),
    `${ARQUIVO}: falta dizer, na linha sem assinatura, por que ela nao tem uma.`
);

// ─────────────────────────────────────── prova de que o check pega o defeito

{
    // A secao antiga, montada sobre payouts e negando saque quando ela vinha
    // vazia. Se este bloco passasse nos checks acima, eles nao provariam nada.
    const antigo = `
        {!ledger?.payouts?.length ? (
            <p>No withdrawal has been signed on this campaign yet. The roots below
               already promise value; nobody has collected it.</p>
        ) : (
            <tbody>{ledger.payouts.map((p) => (<tr key={p.signature} />))}</tbody>
        )}`;
    assert.ok(
        !/ledger\?\.collected == null \?/.test(antigo),
        'a secao antiga nao se reproduz: ela deveria ignorar a cadeia'
    );
    assert.ok(
        /ledger\.payouts\.map/.test(antigo),
        'a secao antiga nao se reproduz: ela deveria montar sobre payouts'
    );
    assert.ok(
        /nobody has collected/i.test(antigo),
        'a secao antiga nao se reproduz: ela deveria negar o saque'
    );
}

console.log('ok  a secao de saques le a cadeia, e a assinatura e coluna e nao filtro');
