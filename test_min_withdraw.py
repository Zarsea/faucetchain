# -*- coding: utf-8 -*-
"""O minimo de saque por campanha retem, nao recusa.

A recompensa de 1 de outubro foi 0,370305 unidades e custou 1.573.440 lamports
para entregar -- 95% rent, uma vez por pessoa por token. Token de campanha nao
tinha minimo, entao qualquer valor saia, inclusive um que vale menos que a
propria entrega.

O desenho tem duas decisoes que valem ser preservadas, e as duas sao prendidas
aqui porque as duas sao faceis de desfazer sem perceber:

  **Por campanha, nao global.** Um token de 6 casas valendo centavos e outro
  valendo dezenas pedem minimos diferentes. Esta casa conhece o custo em SOL e
  nao conhece o preco do token; um padrao global seria chutar essa metade.

  **Retem, nao recusa.** Quem nao alcanca continua com as linhas em aberto e
  acumula para o lote seguinte, como o saldo de $CLAIM espera os 10. Se o lote
  marcasse essas linhas como pagas, a pessoa ficaria com uma recompensa gasta
  que folha nenhuma paga -- dinheiro sumindo em silencio, que e exatamente a
  falha que este projeto existe para nao cometer.

    python test_min_withdraw.py
"""

import asyncio
import os
import shutil
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
SOL_A = "11111111111111111111111111111111"          # tres destinatarios distintos
SOL_B = "So11111111111111111111111111111111111111112"
SOL_C = "SysvarC1ock11111111111111111111111111111111"


def main() -> int:
    workdir = tempfile.mkdtemp(prefix="fcminwd-")
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    import api_server
    from fastapi.testclient import TestClient

    os.environ["SETTLEMENT_OPERATOR_TOKEN"] = "op-teste"
    import importlib
    importlib.reload(api_server)

    api_server.init_settlement_tables()
    client = TestClient(api_server.app)
    op = {"X-Operator-Token": "op-teste"}
    now = int(time.time())
    CID = 4242

    r = client.post("/api/solana/campaign", json={
        "campaign_id": CID, "sponsor": SOL_B, "mint": SOL_B}, headers=op)
    assert r.status_code == 200, r.text

    # --- o padrao e zero: nada muda para campanha nenhuma ---------------
    conn = api_server.get_db_connection()
    m = conn.execute("SELECT min_withdraw FROM settlement_campaigns WHERE campaign_id = ?",
                     (CID,)).fetchone()[0]
    conn.close()
    assert m == 0, "o padrao tem de ser zero, senao este commit muda campanhas existentes"

    # --- tres pessoas, valores diferentes -------------------------------
    conn = api_server.get_db_connection()
    for addr, user, valor in ((SOL_A, "0x" + "a1" * 20, 1_000_000),
                              (SOL_B, "0x" + "b2" * 20, 50_000),
                              (SOL_C, "0x" + "c3" * 20, 30_000)):
        conn.execute("INSERT INTO solana_links (user_address, solana_address, linked_at) "
                     "VALUES (?, ?, ?)", (user, addr, now))
        conn.execute("INSERT INTO settlement_rewards (campaign_id, user_address, amount, created_at) "
                     "VALUES (?, ?, ?, ?)", (CID, user, valor, now))
    conn.commit()
    conn.close()

    # --- com minimo de 100.000, dois ficam de fora ----------------------
    r = client.post(f"/api/solana/campaign/{CID}/budget", json={
        "total_budget": 10_000_000, "monthly_cap": 1_000_000,
        "funding": "vault", "min_withdraw": 100_000}, headers=op)
    assert r.status_code == 200, r.text

    r = client.post("/api/solana/batch", json={"campaign_id": CID}, headers=op)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["leaf_count"] == 1, f"so quem alcancou devia entrar: {b}"
    assert b["total_amount"] == 1_000_000, b
    assert b["held_back_recipients"] == 2, (
        "o lote precisa dizer quantos ficaram de fora: %r" % b)
    assert b["held_back_amount"] == 80_000, b
    assert b["min_withdraw"] == 100_000, b

    # --- e as linhas retidas continuam em aberto ------------------------
    # Esta e a asserção que importa. Marcadas como pagas, elas seriam dinheiro
    # que o sistema acha que entregou e nenhuma folha paga.
    conn = api_server.get_db_connection()
    # tuple(): a conexao usa sqlite3.Row, que nao compara com tupla.
    em_aberto = tuple(conn.execute(
        "SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM settlement_rewards "
        "WHERE campaign_id = ? AND batch_id IS NULL", (CID,)).fetchone())
    conn.close()
    assert em_aberto == (2, 80_000), (
        "as recompensas retidas sairam do livro em vez de acumular: %r" % (em_aberto,))

    # --- acumulando, a pessoa atravessa o corte -------------------------
    conn = api_server.get_db_connection()
    conn.execute("INSERT INTO settlement_rewards (campaign_id, user_address, amount, created_at) "
                 "VALUES (?, ?, ?, ?)", (CID, "0x" + "b2" * 20, 60_000, now))
    conn.commit()
    conn.close()

    r = client.post("/api/solana/batch", json={"campaign_id": CID}, headers=op)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["leaf_count"] == 1 and b["total_amount"] == 110_000, (
        "quem cruzou o minimo somando dois creditos devia entrar: %r" % b)
    assert b["held_back_recipients"] == 1, b

    # --- com tudo abaixo do corte, o lote recusa e explica --------------
    r = client.post("/api/solana/batch", json={"campaign_id": CID}, headers=op)
    assert r.status_code == 400, r.text
    assert "minimum" in r.text and "accruing" in r.text, (
        "a recusa precisa dizer que o valor continua acumulando: %s" % r.text)

    client.close()
    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print("test_min_withdraw.py OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
