"""Bounty trava saldo de verdade (SEC-013).

Ate 06/11/2026 a criacao dizia "locking CLAIM" e nao debitava nada, e a
aprovacao respondia reward_paid sem pagar. Aqui: sem saldo nao cria, criar
debita, aprovar credita o cacador uma vez so, cancelar devolve, e a bounty
antiga (sem trava) nao vira dinheiro do nada.

    .venv/Scripts/python.exe tests/test_bounty_escrow.py
"""
import importlib
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(tempfile.mkdtemp(prefix="faucetchain-bounty-"))
sys.path.insert(0, ROOT)
os.environ.setdefault("PASSWORD_SALT", "test-salt")

import api_server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

importlib.reload(api_server)
api_server.init_microclaims_tables()
api_server.init_bounties_table()
# A assinatura tem teste proprio; aqui so interessa o dinheiro.
api_server.require_action_signature = lambda *a, **k: None
client = TestClient(api_server.app)

CRIADOR, CACADOR = "0x" + "a1" * 20, "0x" + "b2" * 20
FW = api_server.FAUCET_INTERNAL_WALLET
now = int(time.time())


def saldo(w):
    conn = api_server.get_db_connection()
    row = conn.execute("SELECT virtual_balance FROM microclaims_ledger WHERE faucet_wallet = ? "
                       "AND user_wallet = ?", (FW, w)).fetchone()
    conn.close()
    return row[0] if row else 0.0


def criar(reward):
    return client.post("/api/bounties/create", json={"creator_address": CRIADOR, "title": "t",
                                                     "reward": reward})


conn = api_server.get_db_connection()
conn.execute("INSERT INTO microclaims_ledger (faucet_wallet, user_wallet, virtual_balance, created_at) "
             "VALUES (?, ?, 100, ?)", (FW, CRIADOR, now))
conn.commit()
conn.close()

# Sem saldo nao cria.
r = criar(150)
assert r.status_code == 400, r.text
assert saldo(CRIADOR) == 100

# Criar debita.
r = criar(60)
assert r.status_code == 200, r.text
bid = r.json()["bounty_id"]
assert saldo(CRIADOR) == 40

# Aprovar credita o cacador, uma vez so.
assert client.post(f"/api/bounties/{bid}/claim", json={"hunter_address": CACADOR}).status_code == 200
r = client.post(f"/api/bounties/{bid}/approve", json={"creator_address": CRIADOR})
assert r.status_code == 200 and r.json()["reward_paid"] == 60, r.text
assert saldo(CACADOR) == 60
assert client.post(f"/api/bounties/{bid}/approve", json={"creator_address": CRIADOR}).status_code == 400
assert saldo(CACADOR) == 60

# Cancelar devolve, uma vez so.
bid2 = criar(30).json()["bounty_id"]
assert saldo(CRIADOR) == 10
r = client.post(f"/api/bounties/{bid2}/cancel", json={"creator_address": CRIADOR})
assert r.status_code == 200 and r.json()["refund"] == 30, r.text
assert saldo(CRIADOR) == 40
assert client.post(f"/api/bounties/{bid2}/cancel", json={"creator_address": CRIADOR}).status_code == 400
assert saldo(CRIADOR) == 40

# Bounty de antes da correcao (locked=0): aprovar nao inventa pagamento.
conn = api_server.get_db_connection()
cur = conn.execute("INSERT INTO bounties (creator_address, hunter_address, title, reward, created_at, "
                   "deadline, status) VALUES (?, ?, 'velha', 500, ?, ?, 'CLAIMED')",
                   (CRIADOR, CACADOR, now, now + 3600))
velha = cur.lastrowid
conn.commit()
conn.close()
r = client.post(f"/api/bounties/{velha}/approve", json={"creator_address": CRIADOR})
assert r.status_code == 200 and r.json()["reward_paid"] == 0, r.text
assert saldo(CACADOR) == 60

st = client.get("/api/bounties/stats").json()
assert st["lockedRewards"] == 0 and st["paidRewards"] == 60, st
print("ok  bounty debita, paga uma vez, devolve, e a antiga nao paga")
