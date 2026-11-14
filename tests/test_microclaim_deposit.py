"""Deposito: $CLAIM da conta do usuario para o saldo dele numa torneira.

O saque ao contrario. O que este arquivo prende:
  1. Sem a sessao do dono da conta, nada se move.
  2. Torneira que nunca creditou a conta recusa: ela nao conheceria a identidade.
  3. Nao se deposita o que nao se tem.
  4. O deposito tira da conta, poe na tesouraria, e sobe caucao e saldo na
     torneira pelo mesmo valor; a folga (que da o preco do clique) nao muda.

    python tests/test_microclaim_deposit.py
"""
import asyncio
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(tempfile.mkdtemp(prefix="faucetchain-deposito-"))
sys.path.insert(0, ROOT)
os.environ.setdefault("PASSWORD_SALT", "test-salt")

import api_server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

USUARIO = "0x" + "55" * 20
ESTRANHO = "0x" + "66" * 20
TORNEIRA = "0x" + "77" * 20
OUTRA = "0x" + "88" * 20

api_server.init_users_table()
api_server.init_faucet_registry_table()
api_server.init_faucet_api_keys_table()
api_server.init_settlement_tables()
api_server.init_microclaims_tables()
client = TestClient(api_server.app)
agora = int(time.time())

conn = api_server.get_db_connection()
conn.execute("CREATE TABLE IF NOT EXISTS transactions (hash TEXT, block_height INTEGER, "
             "from_address TEXT, to_address TEXT, value REAL, gas_price REAL, "
             "timestamp INTEGER, tx_type TEXT, source_platform TEXT)")
conn.execute("CREATE TABLE IF NOT EXISTS faucet_reserves (faucet_wallet TEXT PRIMARY KEY, "
             "amount REAL, declared_at INTEGER, signature TEXT)")
for addr in (USUARIO, ESTRANHO):
    conn.execute("INSERT INTO users (email, password_hash, wallet_address, created_at) VALUES (?, 'x', ?, ?)",
                 (addr[:8] + "@exemplo.test", addr, agora))
# o usuario minerou 50 na FaucetChain
conn.execute("INSERT INTO transactions (hash, block_height, from_address, to_address, value, gas_price, timestamp) "
             "VALUES ('0xseed', 0, '0xorigem', ?, 50.0, 0.0, ?)", (USUARIO, agora))
conn.commit()
conn.close()

for nome, w in (("Torneira", TORNEIRA), ("Outra", OUTRA)):
    r = client.post("/api/faucethub/register", json={"name": nome, "wallet_address": w})
    assert r.status_code == 200, r.text

conn = api_server.get_db_connection()
# as duas torneiras ja creditaram o usuario uma vez: e o que prova que o conhecem
for t in (TORNEIRA, OUTRA):
    conn.execute("INSERT INTO microclaims_ledger (faucet_wallet, user_wallet, virtual_balance, total_claimed, "
                 "claim_count, last_claim_at, created_at) VALUES (?, ?, 1.0, 1.0, 1, ?, ?)",
                 (t, USUARIO, agora, agora))
    conn.execute("INSERT OR REPLACE INTO faucet_reserves (faucet_wallet, amount, declared_at) VALUES (?, 100.0, ?)",
                 (t, agora))
conn.commit()
conn.close()

sess = {"X-Session-Token": api_server.issue_session(USUARIO)["session_token"]}
sess_estranho = {"X-Session-Token": api_server.issue_session(ESTRANHO)["session_token"]}
corpo = {"user_wallet": USUARIO, "faucet_wallet": TORNEIRA, "amount": 20.0, "sig_timestamp": agora}
URL = "/api/faucethub/microclaim/deposit"


def saldo(addr):
    return asyncio.run(api_server.get_user_balance(addr))["total_claim"]


def folga(t):
    conn = api_server.get_db_connection()
    try:
        return api_server.faucet_escrow(conn, t) - api_server.faucet_owed(conn, t)
    finally:
        conn.close()


# 1. sem sessao, ou com a sessao de outra conta, nada se move
assert client.post(URL, json=corpo).status_code == 401
r = client.post(URL, json=corpo, headers=sess_estranho)
assert r.status_code == 401, r.text

# 2. torneira que nunca creditou esta conta recusa
r = client.post(URL, headers=sess_estranho, json={**corpo, "user_wallet": ESTRANHO})
assert r.status_code == 400 and "does not know this account" in r.json()["detail"], r.text

# 3. nao se deposita o que nao se tem, nem zero
r = client.post(URL, headers=sess, json={**corpo, "amount": 51.0})
assert r.status_code == 400 and "Not enough free balance" in r.json()["detail"], r.text
assert client.post(URL, headers=sess, json={**corpo, "amount": 0}).status_code == 400

# 4. o deposito
folga_antes = folga(TORNEIRA)
tesouraria_antes = saldo(api_server.TREASURY_ADDRESS)
r = client.post(URL, headers=sess, json=corpo)
assert r.status_code == 200, r.text
assert r.json()["balance"] == 21.0, r.json()
assert abs(saldo(USUARIO) - 30.0) < 1e-6, "a conta nao perdeu o que depositou"
assert abs(saldo(api_server.TREASURY_ADDRESS) - tesouraria_antes - 20.0) < 1e-6, "a tesouraria nao recebeu"
assert abs(folga(TORNEIRA) - folga_antes) < 1e-6, "o deposito mexeu na folga, e com ela no preco do clique"
bal = client.get(f"/api/faucethub/microclaim/balance/{USUARIO}").json()
assert any(f["faucet_wallet"] == TORNEIRA and f["virtual_balance"] == 21.0 for f in bal["faucets"]), bal
hist = client.get(f"/api/faucethub/microclaim/history/{USUARIO}").json()
assert any(h["event_type"] == "DEPOSIT" and h["amount"] == 20.0 for h in hist), hist

# o que sobrou na conta (30) e o teto do proximo
assert client.post(URL, headers=sess, json={**corpo, "amount": 31.0}).status_code == 400

# em outra torneira: caucao e divida sobem juntas
r = client.post(URL, headers=sess, json={**corpo, "faucet_wallet": OUTRA, "amount": 5.0})
assert r.status_code == 200 and r.json()["balance"] == 6.0, r.text
conn = api_server.get_db_connection()
assert abs(api_server.faucet_escrow(conn, OUTRA) - 105.0) < 1e-6
assert abs(api_server.faucet_owed(conn, OUTRA) - 6.0) < 1e-6
conn.close()

print("ok  deposito exige o dono, a torneira conhecer a conta e saldo livre; "
      "move da conta para a tesouraria e sobe caucao e saldo juntos, sem mexer na folga")
