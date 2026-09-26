/**
 * FaucetHunter × FaucetChain — onde o usuário informa a carteira Solana.
 *
 * Arquivo NOVO. Copie para `src/components/`. Não edita nada que já existe.
 *
 * Estilo inline, como o resto da FaucetHunter (ver UserNftVault.jsx). A primeira
 * versão deste arquivo usava Tailwind e a tela apareceu sem estilo nenhum em
 * produção: a FaucetHunter não usa Tailwind. Se você está portando isto para
 * outra torneira, confira o sistema de estilo da casa antes de copiar.
 *
 * Como usar:
 *
 *     import SolanaAddressCard from './SolanaAddressCard';
 *     ...
 *     <SolanaAddressCard />
 */
import React, { useCallback, useEffect, useState } from 'react';
import { authSessionManager } from '../utils/authSessionManager';

const ENDPOINT = '/api/solana_address.php';

const C = {
  edge: 'rgba(255,255,255,0.10)',
  sunk: 'rgba(255,255,255,0.04)',
  ink: '#E8ECF1',
  soft: 'rgba(232,236,241,0.62)',
  faint: 'rgba(232,236,241,0.38)',
  good: '#34D399',
  goodBg: 'rgba(52,211,153,0.10)',
  warn: '#FBBF24',
  warnBg: 'rgba(251,191,36,0.10)',
  bad: '#F87171',
};

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
  const [linked, setLinked] = useState(null);   // {account, derived, links}
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const absorb = (data) => {
    setSaved(data.solana_address || null);
    setAddress(data.solana_address || '');
    setAccount(data.faucetchain_account || null);
    setLinked(data.already_linked || null);
  };

  const load = useCallback(async () => {
    try {
      absorb(await call({ action: 'get' }));
    } catch (e) {
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
      absorb(data);
      setNote(data.message || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setStatus('idle');
    }
  };

  if (status === 'loading') return null;

  const busy = status === 'saving';

  return (
    <div style={{ border: `1px solid ${C.edge}`, borderRadius: 16, background: C.sunk, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.ink }}>
            Recompensas de campanha (FaucetChain)
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.55, color: C.soft }}>
            Projetos da rede Solana patrocinam campanhas e pagam quem usa esta
            torneira. Informe sua carteira Solana para receber — o valor sai do
            orçamento do patrocinador, não do seu saldo aqui.
          </p>
        </div>
        {saved && (
          <span style={{
            flex: 'none', fontSize: 10, fontWeight: 800, letterSpacing: '.08em',
            textTransform: 'uppercase', color: C.good, background: C.goodBg,
            border: `1px solid ${C.good}44`, borderRadius: 999, padding: '4px 10px',
          }}>Ativo</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <input
          id="fc-solana-address"
          type="text"
          value={address}
          onChange={(e) => { setAddress(e.target.value.trim()); setError(''); setNote(''); }}
          placeholder="Cole o endereço da sua carteira (Phantom, Solflare…)"
          spellCheck={false}
          autoComplete="off"
          style={{
            flex: '1 1 260px', minWidth: 0, borderRadius: 12,
            border: `1px solid ${C.edge}`, background: 'rgba(0,0,0,0.28)',
            padding: '12px 14px', fontFamily: 'ui-monospace, monospace',
            fontSize: 13, color: C.ink, outline: 'none',
          }}
        />
        <button
          onClick={() => save(address)}
          disabled={busy || address === (saved || '')}
          style={{
            flex: 'none', borderRadius: 12, border: 'none', padding: '12px 20px',
            fontSize: 13.5, fontWeight: 700, color: '#08131A', background: C.good,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy || address === (saved || '') ? 0.4 : 1,
          }}
        >
          {busy ? 'Salvando…' : saved ? 'Atualizar' : 'Salvar'}
        </button>
      </div>

      {error && <p style={{ margin: '12px 0 0', fontSize: 13, color: C.bad }}>{error}</p>}
      {note && !error && <p style={{ margin: '12px 0 0', fontSize: 13, color: C.good }}>{note}</p>}

      {/* Esta carteira já alcança uma conta que não é a derivada dela. É o
          comportamento correto da FaucetChain, mas o usuário tem que saber
          agora, e não na hora do saque. */}
      {linked && (
        <div style={{
          marginTop: 14, borderRadius: 12, padding: '12px 14px',
          background: C.warnBg, border: `1px solid ${C.warn}44`,
        }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: C.warn }}>
            Esta carteira já estava vinculada
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55, color: C.soft }}>
            Alguém já ligou esta carteira a uma conta da FaucetChain antes, por
            assinatura. Suas recompensas vão para <strong style={{ color: C.ink }}>essa</strong> conta
            {' '}(<span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{linked.account}</span>),
            e não para a que esta chave produziria sozinha
            {' '}(<span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{linked.derived}</span>).
            {linked.links > 1 && ' Há mais de um vínculo para esta carteira; vale checar antes de sacar.'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.faint }}>
            Se a conta acima é sua, está tudo certo — entre na FaucetChain com
            esta mesma carteira. Se não reconhece, use outra carteira aqui.
          </p>
        </div>
      )}

      {/* Mostrar ONDE o prêmio cai, antes de a pessoa precisar acreditar em nós. */}
      {account && !linked && (
        <p style={{ margin: '12px 0 0', fontSize: 12.5, color: C.faint, wordBreak: 'break-all' }}>
          Sua conta na FaucetChain:{' '}
          <span style={{ fontFamily: 'ui-monospace, monospace', color: C.soft }}>{account}</span>
          {' — '}entre lá com esta mesma carteira e ela é sua.
        </p>
      )}

      {saved && (
        <button
          onClick={() => save('')}
          disabled={busy}
          style={{
            marginTop: 12, background: 'none', border: 'none', padding: 0,
            fontSize: 12.5, fontWeight: 600, color: C.faint,
            textDecoration: 'underline', textUnderlineOffset: 4,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          Remover carteira
        </button>
      )}

      <p style={{ margin: '16px 0 0', fontSize: 12, lineHeight: 1.6, color: C.faint }}>
        Opcional. Sem carteira informada, nada muda para você: seus claims e
        saques pela FaucetPay continuam exatamente como são hoje.
      </p>
    </div>
  );
}
