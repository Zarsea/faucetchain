/**
 * FaucetChain API Configuration
 * 
 * Centralizes the API base URL so it can be easily switched
 * between local development and external access (ngrok, VPS, etc.)
 * 
 * Set VITE_API_URL in .env or .env.local to override:
 *   VITE_API_URL=https://abc123.ngrok-free.app
 */

const API_BASE_URL: string = import.meta.env.VITE_API_URL
  ? (import.meta.env.VITE_API_URL as string).replace(/\/+$/, '')   // strip trailing slash
  : 'http://localhost:8000';

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
