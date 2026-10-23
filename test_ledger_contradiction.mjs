// Uma tela nao pode afirmar duas coisas opostas sobre o mesmo fato.
//
// A campanha 711670 mostrava, na mesma pagina:
//
//     Collected   350,00      (lido de on_chain.paid, a Solana falando)
//     "The roots below already promise value; nobody has collected it."
//
// As duas frases liam fontes diferentes e a segunda nao sabia disso. A cadeia
// conta TODO saque; a tabela `payouts` vem de `relayer_spend`, que so ganha
// linha quando o NOSSO relayer assina e paga a taxa. Quem saca pagando a
// propria taxa liquida na Solana sem passar por este servidor.
//
// Entao a tabela vazia nunca provou que ninguem sacou. Provou que nos nao
// sacamos por ninguem -- e o texto transformava isso em "nobody has collected
// it", que para a 711670 era simplesmente falso: 350 ja tinham saido.
//
// Nenhum teste pegou porque os dois numeros estavam certos. O defeito estava
// na frase que os ligava, e frase nao tem assert. Estes checks olham o fonte.
//
// node test_ledger_contradiction.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ARQUIVO = 'components/SettlementLedger.tsx';
const fonte = readFileSync(ARQUIVO, 'utf8');

/** O bloco do ternario que decide o que dizer quando `payouts` vem vazio. */
function ramoDaTabelaVazia() {
    const marca = '!ledger?.payouts?.length ?';
    const inicio = fonte.indexOf(marca);
    assert.ok(inicio >= 0, `${ARQUIVO}: nao encontrei o ramo da tabela vazia`);
    const abre = fonte.indexOf('(', inicio + marca.length);
    assert.ok(abre > 0, `${ARQUIVO}: ternario sem parentese`);
    let nivel = 0;
    for (let i = abre; i < fonte.length; i++) {
        if (fonte[i] === '(') nivel++;
        else if (fonte[i] === ')') {
            nivel--;
            if (nivel === 0) return fonte.slice(abre, i + 1);
        }
    }
    assert.fail(`${ARQUIVO}: parenteses nao fecham no ramo da tabela vazia`);
}

const ramo = ramoDaTabelaVazia();

// ─────────────────────────────────────── o check que faltava

// A frase so pode existir depois de perguntar a cadeia. Sem isto, qualquer
// reescrita volta a afirmar ausencia de saque a partir de uma tabela vazia.
assert.ok(
    /state\.paid/.test(ramo),
    `${ARQUIVO}: o texto da tabela vazia decide sem olhar state.paid, que e ` +
    `o numero da cadeia. Foi exatamente assim que a 711670 disse "nobody has ` +
    `collected it" embaixo de "Collected 350,00".`
);

// Os tres estados sao diferentes e precisam de frases diferentes.
assert.ok(
    /!state\s*\?/.test(ramo),
    `${ARQUIVO}: falta o caso da cadeia ilegivel. Sem ela nao da para afirmar ` +
    `nem que sacaram nem que nao sacaram.`
);
assert.ok(
    /state\.paid\s*>\s*0\s*\?/.test(ramo),
    `${ARQUIVO}: falta o caso de a cadeia reportar saque sem linha no relayer, ` +
    `que e o caso da 711670.`
);

// A afirmacao antiga, chapada, nao pode voltar.
assert.ok(
    !/nobody has collected it/i.test(fonte),
    `${ARQUIVO}: a frase "nobody has collected it" voltou. Ela afirma sobre a ` +
    `cadeia inteira a partir de uma tabela que so ve o nosso relayer.`
);

// ─────────────────────────────────────── o mesmo erro um passo adiante

// Com linhas presentes, `paid_total` parece o total pago e e so a parte
// relayada. A reconciliacao tem de aparecer quando a cadeia diz mais.
assert.ok(
    /state\.paid\s*>\s*ledger\.paid_total/.test(fonte),
    `${ARQUIVO}: com a tabela cheia nada compara paid_total com o total da ` +
    `cadeia, entao a diferenca sacada por fora fica invisivel.`
);

// ─────────────────────────────────────── o rotulo

// "paid out" lido ao lado de "Collected" da cadeia sugere o mesmo numero.
assert.ok(
    /relayed/.test(fonte),
    `${ARQUIVO}: o total da tabela precisa dizer que e o relayado, nao o pago.`
);

// ─────────────────────────────────────── prova de que o check pega o defeito

{
    const antigo = `(
        <p className="text-brand-muted">
            No withdrawal has been signed on this campaign yet. The roots below
            already promise value; nobody has collected it.
        </p>
    )`;
    assert.ok(
        !/state\.paid/.test(antigo),
        'o ramo antigo nao se reproduz: ele deveria ignorar a cadeia'
    );
    assert.ok(
        /nobody has collected it/i.test(antigo),
        'o ramo antigo nao se reproduz: ele deveria conter a afirmacao chapada'
    );
}

console.log('ok  o ledger nao afirma mais ausencia de saque a partir da propria tabela');
