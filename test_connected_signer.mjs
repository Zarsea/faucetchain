// A carteira precisa ter autorizado esta aba antes de lhe pedirem assinatura.
//
// Em 10/10/2026 o saque pedia signTransaction sem nunca conectar, e a Phantom
// respondia "The requested method and/or account has not been authorized by the
// user". O botao era liberado pelo vinculo, que o sequenciador sabe e o
// navegador nao: um F5 derruba a conexao da carteira e nao derruba o vinculo.
//
// node test_connected_signer.mjs
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// O modulo e TypeScript e importa @solana/web3.js, entao vem pelo esbuild que
// o projeto ja tem. Testar o arquivo de verdade, nao uma copia da logica.
// O pacote fica dentro do projeto porque as dependencias ficam de fora dele:
// connectedSigner nao toca em nenhuma, e empacotar o @solana/web3.js inteiro
// para testar quatro linhas custa mais do que vale. Fora do projeto, o Node
// nao resolveria os imports que sobram.
const pacote = join(process.cwd(), '.sw-test.mjs');
try {
    await build({
        entryPoints: ['utils/solanaWallet.ts'],
        bundle: true, format: 'esm', platform: 'node',
        external: ['@solana/web3.js', 'ethers'],
        outfile: pacote, logLevel: 'error'
    });
    const { connectedSigner } = await import(pathToFileURL(pacote).href);

    const carteira = (opcoes) => {
        const chamadas = [];
        return {
            chamadas,
            async connect(o) {
                chamadas.push(o?.onlyIfTrusted ? 'silencioso' : 'popup');
                if (o?.onlyIfTrusted && !opcoes.confiavel) throw new Error('not trusted');
                return { publicKey: { toString: () => opcoes.conta } };
            }
        };
    };

    // 1. Aba fria, origem ja confiavel: restaura sem incomodar o usuario.
    let p = carteira({ confiavel: true, conta: 'AAA' });
    assert.equal(await connectedSigner(p, null), 'AAA');
    assert.deepEqual(p.chamadas, ['silencioso']);

    // 2. Aba fria, origem nao confiavel: cai para o popup em vez de desistir.
    p = carteira({ confiavel: false, conta: 'BBB' });
    assert.equal(await connectedSigner(p, null), 'BBB');
    assert.deepEqual(p.chamadas, ['silencioso', 'popup']);

    // 3. Ja conectado nesta aba: nao volta a carteira a toa.
    p = carteira({ confiavel: true, conta: 'CCC' });
    assert.equal(await connectedSigner(p, 'DDD'), 'DDD');
    assert.deepEqual(p.chamadas, []);

    // 4. O ponto da regressao: nunca devolver sem ter conectado.
    p = carteira({ confiavel: true, conta: 'EEE' });
    await connectedSigner(p, null);
    assert.ok(p.chamadas.length > 0, 'devolveu signatario sem conectar -- a Phantom recusa isso');

    console.log('connectedSigner: 4 casos ok');
} finally {
    rmSync(pacote, { force: true });
}
