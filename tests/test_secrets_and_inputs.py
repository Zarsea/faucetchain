"""Segredo legivel no banco, NaN em rota de dinheiro e URL sem esquema seguro.

    python tests/test_secrets_and_inputs.py
"""
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(tempfile.mkdtemp(prefix="faucetchain-segredos-"))
sys.path.insert(0, ROOT)
os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

HEX64 = "a" * 64
USUARIO = "0x" + "cd" * 20


def registrar_torneira(client, carteira, **extra):
    corpo = {"name": "T", "wallet_address": carteira, **extra}
    return client.post("/api/faucethub/register", json=corpo)


def main():
    with TestClient(srv.app) as client:
        for ruim in ("javascript:alert(1)", "data:text/html,x", "ftp://x.test", "https://"):
            r = registrar_torneira(client, "0x" + "e1" * 20, site_url=ruim)
            assert r.status_code == 422, (ruim, r.status_code)
        assert registrar_torneira(client, "0x" + "e1" * 20, name="x" * 101).status_code == 422

        r = registrar_torneira(client, "0x" + "ab" * 20, site_url="https://faucet.test/a")
        assert r.status_code == 200, r.text
        chave, carteira = r.json()["api_key"], r.json()["wallet_address"]
        assert registrar_torneira(client, "0x" + "ac" * 20).status_code == 200, "site_url e opcional"

        cabecalho = {"X-Api-Key": chave, "Content-Type": "application/json"}
        for valor in ("NaN", "Infinity"):
            corpo = '{"user_wallet": "%s", "amount": %s}' % (USUARIO, valor)
            for rota in ("/api/faucethub/microclaim", "/api/faucethub/settle"):
                r = client.post(rota, content=corpo, headers=cabecalho)
                assert r.status_code == 422, (rota, valor, r.status_code)
        r = client.post("/api/faucethub/microclaim", json={"user_wallet": USUARIO, "amount": 1.0},
                        headers={"X-Api-Key": chave})
        assert r.status_code == 200, r.text

        # A chave nao pode ficar legivel depois de um /settle.
        conn = srv.get_db_connection()
        conn.execute(
            "INSERT INTO transactions (hash, block_height, from_address, to_address, value, "
            "gas_price, timestamp) VALUES ('0xfund', 0, ?, ?, 100, 0, 1)",
            (srv.TREASURY_ADDRESS, carteira))
        conn.commit()
        conn.close()
        r = client.post("/api/faucethub/settle", json={"user_wallet": USUARIO, "amount": 1.0},
                        headers={"X-Api-Key": chave})
        assert r.status_code == 200, r.text
        conn = srv.get_db_connection()
        gravada = conn.execute("SELECT api_key_used FROM faucet_settlements").fetchone()[0]
        conn.close()
        assert gravada == srv._hash_token(chave)

        # O token de no segue funcionando, e o banco so guarda o hash.
        no = {"node_id": "no-1", "wallet_address": USUARIO, "node_name": "n", "version": "1"}
        token = client.post("/api/mining/register", json=no).json()["node_token"]
        conn = srv.get_db_connection()
        guardado = conn.execute("SELECT node_token FROM active_miners").fetchone()[0]
        conn.close()
        assert guardado == srv._hash_token(token)
        assert client.post("/api/mining/register", json=no).status_code == 401
        r = client.post("/api/mining/register", json=no, headers={"X-Node-Token": token})
        assert r.status_code == 200 and r.json()["node_token"] == token, r.text
        assert srv.require_node_token("no-1", token) == USUARIO

    # A migracao troca o que esta em claro, preserva rotulo e hash, e pode repetir.
    conn = srv.get_db_connection()
    conn.execute("UPDATE active_miners SET node_token = 'fch_antigo'")
    for rotulo in ("fch_chave_antiga", "L2_WITHDRAW", HEX64):
        conn.execute("INSERT INTO faucet_settlements (faucet_wallet, user_wallet, amount, tx_hash, "
                     "timestamp, api_key_used) VALUES ('a', 'b', 1, 'h', 1, ?)", (rotulo,))
    conn.commit()
    conn.close()
    srv._migrar_segredos_em_claro()
    srv._migrar_segredos_em_claro()
    conn = srv.get_db_connection()
    no_migrado = conn.execute("SELECT node_token FROM active_miners").fetchone()[0]
    valores = {r[0] for r in conn.execute("SELECT api_key_used FROM faucet_settlements")}
    conn.close()
    assert no_migrado == srv._hash_token("fch_antigo")
    assert {srv._hash_token("fch_chave_antiga"), "L2_WITHDRAW", HEX64} <= valores
    assert "fch_chave_antiga" not in valores
    print("OK")


if __name__ == "__main__":
    main()
