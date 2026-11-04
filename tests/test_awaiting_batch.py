"""O livro publico de cada campanha mostra o que o proximo lote levaria.

Antes o credito de uma campanha so aparecia por pessoa, e o operador
descobria se havia o que liquidar fechando o lote. Aqui a previa tem de
bater com o lote que de fato fecha, piso e carteira sem vinculo incluidos.

    .venv/Scripts/python.exe tests/test_awaiting_batch.py
"""
import importlib
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(tempfile.mkdtemp(prefix="faucetchain-awaiting-"))
sys.path.insert(0, ROOT)
os.environ.setdefault("PASSWORD_SALT", "test-salt")
os.environ["SETTLEMENT_OPERATOR_TOKEN"] = "op-teste"
os.environ["SETTLEMENT_TREASURY_SOLANA"] = ""

import api_server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

importlib.reload(api_server)
api_server.init_settlement_tables()
client = TestClient(api_server.app)
op = {"X-Operator-Token": "op-teste"}
CID = 410038
SOL_A = "11111111111111111111111111111111"
SOL_B = "So11111111111111111111111111111111111111112"
FH = "0x" + "f1" * 20
now = int(time.time())

r = client.post("/api/solana/campaign", json={"campaign_id": CID, "sponsor": SOL_B, "mint": SOL_B},
                headers=op)
assert r.status_code == 200, r.text
r = client.post(f"/api/solana/campaign/{CID}/budget",
                json={"total_budget": 10**9, "monthly_cap": 10**8, "min_withdraw": 100_000},
                headers=op)
assert r.status_code == 200, r.text

conn = api_server.get_db_connection()
for user, sol in (("0x" + "a1" * 20, SOL_A), ("0x" + "b2" * 20, SOL_B)):
    conn.execute("INSERT INTO solana_links (user_address, solana_address, linked_at) VALUES (?, ?, ?)",
                 (user, sol, now))
linhas = [("0x" + "a1" * 20, 80_000), ("0x" + "a1" * 20, 80_000),   # 160.000: passa o piso
          ("0x" + "b2" * 20, 40_000),                               # abaixo do piso
          ("0x" + "c3" * 20, 90_000)]                               # sem carteira Solana
for user, valor in linhas:
    conn.execute("INSERT INTO settlement_rewards (campaign_id, user_address, amount, created_at, "
                 "faucet_wallet) VALUES (?, ?, ?, ?, ?)", (CID, user, valor, now, FH))
conn.commit()
conn.close()

prev = client.get(f"/api/solana/ledger/{CID}").json()["awaiting_batch"]
assert prev["claims"] == 4, prev
assert prev["users"] == 3, prev
assert prev["users_without_solana_wallet"] == 1, prev
assert prev["eligible_wallets"] == 1 and prev["eligible_amount"] == 160_000, prev
assert prev["below_min_wallets"] == 1, prev
assert prev["by_faucet"] == [{"faucet_wallet": FH, "claims": 4, "users": 3, "amount": 290_000}], prev

# A previa e o lote real dizem a mesma coisa.
r = client.post("/api/solana/batch", json={"campaign_id": CID}, headers=op)
assert r.status_code == 200, r.text
lote = r.json()
assert lote["total_amount"] == prev["eligible_amount"], (lote, prev)
assert lote["leaf_count"] == prev["eligible_wallets"], (lote, prev)

# Depois do lote, sobra so o que ficou retido ou sem carteira.
depois = client.get(f"/api/solana/ledger/{CID}").json()["awaiting_batch"]
assert depois["claims"] == 2 and depois["eligible_wallets"] == 0, depois

# Campanha sem nada: zeros, nao erro.
assert api_server._awaiting_batch(api_server.get_db_connection().cursor(), 999)["claims"] == 0
print("test_awaiting_batch OK")
