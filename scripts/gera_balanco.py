# -*- coding: utf-8 -*-
"""Gera preview/balanco.html com o estado da torneira FaucetHunter.

    python scripts/gera_balanco.py

Os numeros sao lidos do banco e da cadeia no momento em que a pagina e gerada,
nunca digitados. Uma pagina de balanco com numero copiado a mao envelhece no
primeiro claim e vira a mesma coisa que ela existe para desmentir.

O rodape carrega a hora da leitura por isso: um balanco sem data e uma
afirmacao sobre um instante que ninguem sabe qual foi.
"""
import asyncio
import io
import os
import sqlite3
import sys
from datetime import datetime, UTC

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(RAIZ, ".env"))
except ImportError:
    pass

import api_server

TORNEIRA = "0x7dda72ad9ad56ce3d031ee6a62b5b94dd40c6ef3"
CONTA = "0xb3dff5d3f802ebba471c2498f223c52b8f7d5ad5"


def pt(n, casas=0):
    s = f"{n:,.{casas}f}"
    return s.replace(",", "\x00").replace(".", ",").replace("\x00", ".")


def main() -> int:
    conn = sqlite3.connect(os.path.join(RAIZ, "blockchain.db"))
    conn.row_factory = sqlite3.Row
    q = conn.execute

    reg = q("SELECT id, name FROM faucet_registry WHERE wallet_address = ?", (TORNEIRA,)).fetchone()
    chaves = q("SELECT COUNT(*), COALESCE(SUM(total_requests), 0) FROM faucet_api_keys "
               "WHERE faucet_wallet = ?", (TORNEIRA,)).fetchone()
    caucao = q("SELECT amount FROM faucet_reserves WHERE faucet_wallet = ?", (TORNEIRA,)).fetchone()
    caucao = caucao[0] if caucao else 0.0
    devedores = q("SELECT user_wallet, virtual_balance FROM microclaims_ledger "
                  "WHERE faucet_wallet = ? AND virtual_balance > 0 "
                  "ORDER BY virtual_balance DESC", (TORNEIRA,)).fetchall()
    devido = sum(d["virtual_balance"] for d in devedores)
    campanhas = [r[0] for r in q("SELECT campaign_id FROM campaign_faucets WHERE faucet_wallet = ?",
                                 (TORNEIRA,))]

    saldo = asyncio.run(api_server.get_user_balance(TORNEIRA))["total_claim"]
    recompensas = q("""SELECT sr.campaign_id, sr.amount, sr.solana_address, b.published_signature
                         FROM settlement_rewards sr
                         LEFT JOIN settlement_batches b ON b.id = sr.batch_id
                        WHERE sr.user_address = ?""", (TORNEIRA,)).fetchall()

    vivas = q("SELECT COUNT(*) FROM settlement_campaigns WHERE retired_at IS NULL").fetchone()[0]
    aposentadas = q("SELECT COUNT(*) FROM settlement_campaigns WHERE retired_at IS NOT NULL").fetchone()[0]
    raizes = q("SELECT COUNT(*) FROM settlement_batches WHERE published_signature IS NOT NULL").fetchone()[0]
    presas = q("""SELECT COALESCE(SUM(sr.amount), 0) FROM settlement_rewards sr
                    JOIN settlement_campaigns sc ON sc.campaign_id = sr.campaign_id
                   WHERE sc.retired_at IS NOT NULL""").fetchone()[0]
    conn.close()

    def linha(rotulo, valor, nota=""):
        return (f'<div class="kv"><span>{rotulo}</span>'
                f'<span>{valor}{f" <em>{nota}</em>" if nota else ""}</span></div>')

    devedores_html = "".join(
        linha(f'{d["user_wallet"][:14]}…'
              + (' <b>(ela mesma)</b>' if d["user_wallet"] == TORNEIRA else ''),
              pt(d["virtual_balance"], 1))
        for d in devedores)

    recompensas_html = "".join(
        linha(f'campanha {r["campaign_id"]}',
              pt(r["amount"]),
              "em raiz publicada" if r["published_signature"] else "creditado, sem raiz")
        for r in recompensas)

    html = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Balanço da FaucetHunter</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap">
<link rel="stylesheet" href="design.css">
<style>
  /* O rotulo nao quebra; o valor alinha a direita e a nota desce para a linha
     seguinte. Sem isto "em raiz publicada" partia no meio da palavra, que e o
     tipo de defeito que so aparece depois do print. */
  .kv {{
    display: flex; gap: 16px; align-items: baseline; justify-content: space-between;
    padding: 9px 0; border-bottom: 1px solid var(--card); font-size: 13px;
  }}
  .kv > span:first-child {{ flex: none; color: var(--muted); white-space: nowrap; }}
  .kv > span:last-child {{ text-align: right; min-width: 0; }}
  .kv em {{
    display: block; font-style: normal; color: var(--muted);
    font-size: 11px; margin-top: 2px; white-space: nowrap;
  }}
  .kv b {{ color: var(--warn); font-weight: 600; }}
</style>
</head>
<body>
<div class="wrap" style="padding-block:40px 56px; max-width:1000px">

  <p class="eyebrow">Balanço lido do banco e da cadeia</p>
  <h1 style="margin-top:12px; font-size:clamp(28px,4vw,40px); font-weight:800">
    A torneira FaucetHunter, item por item
  </h1>

  <div class="grid g4" style="margin-top:32px">
    <div class="card card-pad">
      <p class="num" style="margin:0; font-size:26px">{pt(caucao, 0)}</p>
      <p class="quieto" style="margin:6px 0 0; font-size:13px">caução na tesouraria</p>
    </div>
    <div class="card card-pad">
      <p class="num" style="margin:0; font-size:26px">{pt(devido, 1)}</p>
      <p class="quieto" style="margin:6px 0 0; font-size:13px">devido a {len(devedores)} usuários</p>
    </div>
    <div class="card card-pad">
      <p class="num" style="margin:0; font-size:26px; color:var(--success)">{int(caucao / devido) if devido else '—'}×</p>
      <p class="quieto" style="margin:6px 0 0; font-size:13px">cobertura da dívida</p>
    </div>
    <div class="card card-pad">
      <p class="num" style="margin:0; font-size:26px; color:var(--sol)">{raizes}</p>
      <p class="quieto" style="margin:6px 0 0; font-size:13px">raízes reais na Solana</p>
    </div>
  </div>

  <div class="duo" style="margin-top:20px">
    <div class="card card-pad duo-larga">
      <p class="eyebrow">Como torneira</p>
      <div style="margin-top:14px">
        {linha("registro", f'id {reg["id"]} · {reg["name"]}' if reg else "não registrada")}
        {linha("chaves de API", f'{chaves[0]}', f'{chaves[1]} requisições')}
        {linha("campanhas inscritas", ", ".join(str(c) for c in campanhas) or "nenhuma")}
      </div>
      <p class="eyebrow" style="margin-top:24px">Deve a</p>
      <div style="margin-top:14px">{devedores_html}</div>
    </div>

    <div class="card card-pad duo-estreita">
      <p class="eyebrow">Como conta de usuário</p>
      <div style="margin-top:14px">
        {linha("saldo $CLAIM livre", pt(saldo, 2))}
        {recompensas_html}
        {linha("vínculo Solana", "nenhum", "removido em 4/10")}
      </div>
      <div class="aviso" style="margin-top:18px">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2.2" aria-hidden="true">
          <path d="M12 8v5M12 17h.01M10.3 3.9L2.6 17.1A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0z"></path>
        </svg>
        <span>Sem vínculo, essa recompensa não aparece no painel de quem entra
        como <span class="mono">{CONTA[:10]}…</span>. O valor está seguro: a folha
        tem hash sobre a carteira Solana, não sobre a conta.</span>
      </div>
    </div>
  </div>

  <div class="card card-pad" style="margin-top:20px">
    <p class="eyebrow">O que a limpeza de 4 de outubro fez</p>
    <div class="grid g3" style="margin-top:16px">
      <div>
        <p class="num" style="margin:0; font-size:22px">{vivas}</p>
        <p class="quieto" style="margin:4px 0 0; font-size:12px">campanhas na lista</p>
      </div>
      <div>
        <p class="num" style="margin:0; font-size:22px; color:var(--muted)">{aposentadas}</p>
        <p class="quieto" style="margin:4px 0 0; font-size:12px">aposentadas, mint não é mint</p>
      </div>
      <div>
        <p class="num" style="margin:0; font-size:22px; color:var(--muted)">{pt(presas)}</p>
        <p class="quieto" style="margin:4px 0 0; font-size:12px">unidades nelas, nunca pagáveis</p>
      </div>
    </div>
  </div>

  <footer style="border:0; padding-block:28px 0">
    <p style="margin:0">
      Lido em {datetime.now(UTC).strftime('%d/%m/%Y %H:%M UTC')} de
      <span class="mono">blockchain.db</span> e da devnet. Gerado por
      <span class="mono">scripts/gera_balanco.py</span> — nenhum número foi digitado.
    </p>
  </footer>
</div>
</body>
</html>
"""

    destino = os.path.join(RAIZ, "preview", "balanco.html")
    io.open(destino, "w", encoding="utf-8", newline="\n").write(html)
    print(f"escrito: {destino}")
    print(f"  caucao {caucao} | devido {devido} | raizes reais {raizes}")
    print(f"  campanhas vivas {vivas} | aposentadas {aposentadas}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
