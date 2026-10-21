import { execSync } from 'child_process';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** O commit que virou este bundle.
 *
 *  Sem isto nao ha como saber, olhando a tela, qual versao esta no ar -- e a
 *  pergunta aparece toda vez que producao fica para tras do repositorio.
 *
 *  `git rev-parse` primeiro, porque funciona na maquina de quem desenvolve e
 *  tambem no build da Vercel. A variavel da Vercel fica de reserva para o caso
 *  de um clone sem `.git`, e 'dev' para quando nao houver nenhum dos dois:
 *  uma string vazia na tela seria pior que uma honesta.
 */
function commitDoBuild(): string {
    try {
        return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
            .toString().trim();
    } catch {
        return (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'dev';
    }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      __BUILD_COMMIT__: JSON.stringify(commitDoBuild()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
