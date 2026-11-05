// O chat responde a pergunta que foi feita.
//
// Em 05/11/2026 "how does settlement work?" devolvia o texto da torneira: a
// resposta anterior do proprio chat entrava na busca, a nota era a fracao de
// palavras casadas e "bot" casava dentro de "both". E toda pergunta quebrava
// antes disso, porque tps nulo chegava a um .toFixed.
//
// node test_chat_answers.mjs
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const pacote = join(process.cwd(), '.chat-test.mjs');
try {
    await build({
        entryPoints: ['components/LocalIntelligence.ts'],
        bundle: true, format: 'esm', platform: 'node',
        outfile: pacote, logLevel: 'error'
    });
    const { LocalIntelligence } = await import(pathToFileURL(pacote).href);
    // Antes da primeira medicao tps e avgGasPrice sao nulos.
    const m = { blockHeight: 12, tps: null, avgGasPrice: null, activeValidators: 0 };
    const saudacao = { lastAiMessage: "Hi. I answer from FaucetChain's own documentation. Ask how a claim becomes a payment, or how to connect a faucet." };

    const casos = [
        ['how does settlement work?', 'settlement'],
        ['como funciona a liquidação na solana?', 'settlement'],
        ['how do I withdraw?', 'withdraw'],
        ['como sacar meu saldo', 'withdraw'],
        ['how do I connect a faucet?', 'connect_faucet'],
        ['what is a campaign?', 'campaigns'],
        ['mint 100 tokens', 'faucet_request'],
        ['what is the network status?', 'status'],
        ['is there any fraud protection against bots?', 'fraud_detection'],
    ];
    for (const [pergunta, esperado] of casos) {
        const r = LocalIntelligence.processQuery(pergunta, m, saudacao);
        assert.equal(r.patternId, esperado, `"${pergunta}" caiu em ${r.patternId}`);
        assert.ok(!r.text.includes('{{'), `"${pergunta}" deixou variavel sem preencher`);
    }
    // Sem contexto, "both" nao pode virar "bot" e cair na resposta de fraude.
    assert.equal(LocalIntelligence.processQuery('both of them', m).patternId, 'help');
    console.log(`ok  ${casos.length} perguntas caem na resposta certa`);
} finally {
    rmSync(pacote, { force: true });
}
