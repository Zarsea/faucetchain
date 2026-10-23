// Data formatada com o idioma do navegador, não com o do app.
//
// `new Date(x).toLocaleDateString()` sem argumento usa o locale do SISTEMA.
// Isso ignora o seletor de idioma inteiro: alguém lendo em português num
// Chrome instalado em inglês via 03/10 e não tinha como saber se era 3 de
// outubro ou 10 de março. Data ambígua não é feiura, é informação errada.
//
// Nos números o efeito é menor e o mesmo: 1.695 virando "1,695".
//
// Apareceu três vezes em três consertos separados — CampaignHoldings,
// PrivacySettings, FaucetInternal — antes de alguém varrer o projeto e achar
// 42. Esse é o padrão que este check existe para quebrar: um defeito que
// custa uma descoberta nova a cada tela em vez de uma só.
//
// node test_locale_do_app.mjs
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = 'components';

// Onde os helpers moram: é o único arquivo que pode chamar o Intl diretamente.
const DONO = 'LanguageContext.tsx';

const SEM_ARGUMENTO = /\.toLocale(Date|Time)?String\(\s*\)/g;

const arquivos = readdirSync(PASTA).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
assert.ok(arquivos.length > 10, `${PASTA}: li ${arquivos.length} arquivos, esperava bem mais`);

const achados = [];
for (const nome of arquivos) {
    if (nome === DONO) continue;
    const fonte = readFileSync(join(PASTA, nome), 'utf8');
    let m;
    SEM_ARGUMENTO.lastIndex = 0;
    while ((m = SEM_ARGUMENTO.exec(fonte)) !== null) {
        const linha = fonte.slice(0, m.index).split(String.fromCharCode(10)).length;
        achados.push(`${PASTA}/${nome}:${linha}  ${m[0]}`);
    }
}

assert.deepEqual(
    achados, [],
    `formatação seguindo o navegador em vez do idioma do app:\n  ` +
    achados.join(String.fromCharCode(10) + '  ') +
    `\n  Use dataLocal / horaLocal / dataHoraLocal / numeroLocal de ` +
    `./LanguageContext, que leem o idioma escolhido na tela.`
);

// Os helpers precisam existir e passar o locale adiante, senão este check
// passa a proteger uma indireção que não faz nada.
const dono = readFileSync(join(PASTA, DONO), 'utf8');
for (const nome of ['dataLocal', 'horaLocal', 'dataHoraLocal', 'numeroLocal']) {
    assert.ok(
        new RegExp(`export const ${nome}\\b`).test(dono),
        `${DONO}: falta o helper ${nome}`
    );
}
assert.ok(
    (dono.match(/localeDoIdioma\(idiomaAtual\(\)\)/g) || []).length >= 4,
    `${DONO}: algum helper não está passando o locale do app adiante`
);

console.log(`ok  ${arquivos.length - 1} arquivos sem formatação presa ao navegador`);
