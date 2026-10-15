// Service worker da FaucetChain.
//
// Existe por uma razao so: quem abre isto no celular abre numa conexao ruim, e
// uma tela branca por 4 segundos e indistinguivel de um site fora do ar.
//
// O que ele NAO faz e a parte importante. Nada de /api/ e nada de /ws/ passa
// por aqui -- este painel mostra saldo, bloco e epoca, e um saldo guardado em
// cache e pior que um saldo que demora: o usuario le um numero velho como se
// fosse o de agora. Dado vivo sempre vai na rede, e se a rede falhar ele ve a
// falha.
//
// Sobra o casco: o HTML e os arquivos que o Vite gera com hash no nome. Como o
// hash muda a cada build, cache-first neles nunca serve versao velha -- um
// arquivo antigo simplesmente deixa de ser pedido.

const CACHE = 'faucetchain-casco-v1';

// O HTML entra no cache na instalacao para que a primeira abertura offline
// tenha ao menos de onde comecar. Os assets entram conforme sao pedidos: os
// nomes deles tem hash e so o build sabe quais sao.
self.addEventListener('install', (evento) => {
    evento.waitUntil(
        caches.open(CACHE).then((cache) => cache.add(new Request('/', { cache: 'reload' })))
            .catch(() => undefined)   // sem rede na instalacao nao e motivo para falhar
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (evento) => {
    evento.waitUntil(
        caches.keys()
            .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

const ehCascoEstatico = (url) =>
    url.pathname.startsWith('/assets/') ||
    /\.(js|css|woff2?|png|svg|webp|ico)$/.test(url.pathname);

self.addEventListener('fetch', (evento) => {
    const req = evento.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;              // CDN, fontes: a rede resolve
    if (url.pathname.startsWith('/api/')) return;                 // dado vivo
    if (url.pathname.startsWith('/ws/')) return;                  // websocket

    // Navegacao: rede primeiro, para que um deploy novo chegue na hora. O cache
    // e so o plano B de quem esta sem conexao.
    if (req.mode === 'navigate') {
        evento.respondWith(
            fetch(req)
                .then((resposta) => {
                    const copia = resposta.clone();
                    caches.open(CACHE).then((cache) => cache.put('/', copia)).catch(() => undefined);
                    return resposta;
                })
                .catch(() => caches.match('/').then((r) => r || Response.error()))
        );
        return;
    }

    if (!ehCascoEstatico(url)) return;

    evento.respondWith(
        caches.match(req).then((guardado) => {
            if (guardado) return guardado;
            return fetch(req).then((resposta) => {
                // Resposta parcial ou de erro nao entra no cache: 206 nem pode
                // ser guardado, e um 404 guardado fica 404 para sempre.
                if (resposta.ok && resposta.status === 200) {
                    const copia = resposta.clone();
                    caches.open(CACHE).then((cache) => cache.put(req, copia)).catch(() => undefined);
                }
                return resposta;
            });
        })
    );
});
