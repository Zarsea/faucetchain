/**
 * FaucetHunter × FaucetChain — onde o usuário informa a carteira Solana.
 *
 * Arquivo NOVO. Copie para `src/components/`. Não edita nada que já existe.
 *
 * Este é o elo que faltava: a coluna existe e a ponte lê, mas até aqui nada
 * escrevia nela. Sem esta tela a integração fica completa e não paga ninguém.
 *
 * Como usar (em DashboardView.jsx, ou onde fizer sentido):
 *
 *     import SolanaAddressCard from './SolanaAddressCard';
 *     ...
 *     <SolanaAddressCard />
 *
 * Sem estilo de biblioteca nenhuma: só Tailwind, que o projeto já usa.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { authSessionManager } from '../utils/authSessionManager';

const ENDPOINT = '/api/solana_address.php';

async function call(payload) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': authSessionManager.getSessionTokenRaw(),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Não foi possível completar agora.');
  return data;
}

export default function SolanaAddressCard() {
  const [address, setAddress] = useState('');
  const [saved, setSaved] = useState(null);
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | idle | saving
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await call({ action: 'get' });
      setSaved(data.solana_address || null);
      setAddress(data.solana_address || '');
      setAccount(data.faucetchain_account || null);
    } catch (e) {
      // Não logado, ou a coluna ainda não existe. Nenhum dos dois é motivo
      // para esta tela gritar com o usuário.
      setSaved(null);
    } finally {
      setStatus('idle');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (value) => {
    setError(''); setNote(''); setStatus('saving');
    try {
      const data = await call({ action: 'save', solana_address: value });
      setSaved(data.solana_address || null);
      setAddress(data.solana_address || '');
      setAccount(data.faucetchain_account || null);
      setNote(data.message || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setStatus('idle');
    }
  };

  if (status === 'loading') return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white">Recompensas de campanha</h3>
          <p className="mt-1 text-sm text-white/60">
            Projetos da rede Solana patrocinam campanhas e pagam quem usa esta
            torneira. Informe sua carteira Solana para receber — o valor sai do
            orçamento do patrocinador, não do seu saldo aqui.
          </p>
        </div>
        {saved && (
          <span className="shrink-0 rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            Ativo
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          id="fc-solana-address"
          type="text"
          value={address}
          onChange={(e) => { setAddress(e.target.value.trim()); setError(''); setNote(''); }}
          placeholder="Cole o endereço da sua carteira (Phantom, Solflare…)"
          spellCheck={false}
          autoComplete="off"
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm text-white outline-none transition focus:border-emerald-400/60"
        />
        <button
          onClick={() => save(address)}
          disabled={status === 'saving' || address === (saved || '')}
          className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'saving' ? 'Salvando…' : saved ? 'Atualizar' : 'Salvar'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {note && !error && <p className="mt-3 text-sm text-emerald-300">{note}</p>}

      {/* O ponto que faz a pessoa confiar: mostrar ONDE o prêmio cai, antes de
          ela precisar acreditar em nós. A mesma carteira entra na FaucetChain
          e chega nessa conta. */}
      {account && (
        <p className="mt-3 break-all text-xs text-white/40">
          Sua conta na FaucetChain: <span className="font-mono text-white/70">{account}</span>
          {' — '}entre lá com esta mesma carteira e ela é sua.
        </p>
      )}

      {saved && (
        <button
          onClick={() => save('')}
          disabled={status === 'saving'}
          className="mt-3 text-xs font-semibold text-white/40 underline underline-offset-4 transition hover:text-white/70"
        >
          Remover carteira
        </button>
      )}

      <p className="mt-4 text-xs leading-relaxed text-white/35">
        Opcional. Sem carteira informada, nada muda para você: seus claims e
        saques pela FaucetPay continuam exatamente como são hoje.
      </p>
    </div>
  );
}
