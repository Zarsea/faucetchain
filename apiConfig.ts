/**
 * FaucetChain API Configuration
 * 
 * Centralizes the API base URL so it can be easily switched
 * between local development and external access (ngrok, VPS, etc.)
 * 
 * Set VITE_API_URL in .env or .env.local to override:
 *   VITE_API_URL=https://abc123.ngrok-free.app
 */

// Without VITE_API_URL, talk to whatever origin served this page.
//
// It used to fall back to `http://localhost:8000`, and a build that inherited
// `VITE_API_URL=http://localhost:8010` from `.env.local` shipped that address
// to everybody. The page then loaded from the tunnel and called the visitor's
// own machine: it worked for the one developer running the API locally and
// showed zeros to everyone else, including through CORS, because the tunnel's
// origin is not in ALLOWED_ORIGINS. Nothing errored loudly; balances just read
// 0.00.
//
// `window.location.origin` makes that impossible. The API serves this bundle
// (see the bottom of api_server.py), so same origin is the right answer for
// ngrok, for Fly, and for localhost alike, and it survives the URL changing
// without a rebuild.
//
// Set VITE_API_URL only when the frontend is served from somewhere the API is
// not — the Vercel + Fly split. Then it must be absolute, and the API's
// ALLOWED_ORIGINS must name the frontend's domain.
const API_BASE_URL: string = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL as string).replace(/\/+$/, '')   // strip trailing slash
  : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8010');

const WS_BASE_URL: string = API_BASE_URL.replace(/^http/, 'ws');

// Patch global do fetch para Ngrok: Ignora a página de aviso HTML que bloqueia o CORS
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    let [resource, config] = args;
    if (!config) config = {};
    if (!config.headers) config.headers = {};
    
    // Adiciona bypass do Ngrok para requisições na API via cookies de sessão
    if (typeof resource === 'string' && resource.includes('ngrok-free')) {
        config.credentials = 'include';
        if (config.headers instanceof Headers) {
            config.headers.append('ngrok-skip-browser-warning', 'true');
        } else {
            (config.headers as Record<string, string>)['ngrok-skip-browser-warning'] = 'true';
        }
    }
    
    return originalFetch(resource, config);
  };
}

export { API_BASE_URL, WS_BASE_URL };
