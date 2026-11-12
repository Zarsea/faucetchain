"""Caucao obrigatoria, clique por oferta x demanda e prova de clique.

Ate 06/11/2026 a caucao era voluntaria. Em 11/11 o clique deixou de ter preco
fixo: vale 1/30 da folga da caucao dividido pelos cliques do ultimo dia, com
teto 1, e precisa trazer um Claim Proof que nao pode ser usado duas vezes.
O saque minimo acompanha o clique (10 cliques ao valor de agora).

    .venv/Scripts/python.exe tests/test_faucet_escrow_required.py
"""
import importlib
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(tempfile.mkdtemp(prefix="faucetchain-caucao-"))
sys.path.insert(0, ROOT)
os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()  # a tabela blocks, que o desafio da prova le

import api_server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

importlib.reload(api_server)
api_server.CLAIM_PROOF_DIFFICULTY_BITS = 4  # a regra e a mesma; so o teste fica rapido
api_server.CLAIM_PROOF_MAX_EXTRA_BITS = 0


def caucionar(torneira, valor):
    conn = api_server.get_db_connection()
    conn.execute("INSERT OR REPLACE INTO faucet_reserves (faucet_wallet, amount, declared_at) VALUES (?, ?, ?)",
                 (torneira, valor, int(time.time())))
    conn.commit()
    conn.close()


with TestClient(api_server.app) as client:
    def registrar(byte):
        carteira = "0x" + byte * 20
        r = client.post("/api/faucethub/register", json={"name": "T" + byte, "wallet_address": carteira})
        assert r.status_code == 200, r.text
        return carteira, {"X-Api-Key": r.json()["api_key"]}

    def resolver(usuario):
        d = client.get("/api/poc/challenge").json()
        nonce = 0
        while True:
            h = api_server.keccak256(api_server.poc_message(d["epochId"], d["parentHash"], usuario, nonce).encode())
            if int.from_bytes(h, "big") >> (256 - d["difficultyBits"]) == 0:
                return {"poc_nonce": nonce, "poc_epoch_id": d["epochId"], "poc_parent_hash": d["parentHash"]}
            nonce += 1

    def clique(chave, usuario, valor=1.0, prova=None):
        corpo = {"user_wallet": usuario, "amount": valor, "campaigns": False}
        corpo.update(prova if prova is not None else resolver(usuario))
        return client.post("/api/faucethub/microclaim", headers=chave, json=corpo)

    T1, K1 = registrar("7d")
    T2, K2 = registrar("8e")
    A, B = "0x" + "a1" * 20, "0x" + "b2" * 20

    # 1. Sem prova, nada e creditado, mesmo com caucao.
    caucionar(T1, 3000)
    r = client.post("/api/faucethub/microclaim", headers=K1,
                    json={"user_wallet": A, "amount": 1, "campaigns": False})
    assert r.status_code == 400 and "Proof of Claim" in r.json()["detail"], r.text

    # 2. Sem caucao, o clique vale zero: 402, e nada vira divida.
    r = clique(K2, A)
    assert r.status_code == 402 and "escrow" in r.json()["detail"], r.text
    assert api_server.faucet_owed(api_server.get_db_connection(), T2) == 0

    # 3. Poucos usuarios: folga 3000 / 30 dias = 100 por dia, um clique no dia,
    #    o clique bate no teto e paga o que a torneira pediu.
    r = clique(K1, A)
    assert r.status_code == 200 and r.json()["credited"] == 1.0, r.text

    # 4. A mesma prova nao paga duas vezes, nem em outra torneira.
    caucionar(T2, 3000)
    prova = resolver(B)
    assert clique(K2, B, prova=prova).status_code == 200
    r = clique(K1, B, prova=prova)
    assert r.status_code == 400 and "already used" in r.json()["detail"], r.text

    # 5. Demanda dilui: com 199 cliques no ultimo dia, o proximo vale
    #    (3000 - divida) / 30 / 200 ~= 0,5, e nao o 1 pedido.
    conn = api_server.get_db_connection()
    agora = int(time.time())
    conn.executemany("INSERT INTO microclaims_history (faucet_wallet, user_wallet, amount, event_type, timestamp) "
                     "VALUES (?, ?, 0, 'CLAIM', ?)", [(T1, "0x" + "c3" * 20, agora - 60)] * 198)
    conn.commit()
    devido = api_server.faucet_owed(conn, T1)
    conn.close()
    esperado = (3000 - devido) / 30 / 200
    r = clique(K1, "0x" + "d4" * 20)
    assert r.status_code == 200 and abs(r.json()["credited"] - esperado) < 1e-6, (r.text, esperado)

    # 6. O saque minimo acompanha o clique: 10 cliques ao valor de agora.
    bal = client.get(f"/api/faucethub/microclaim/balance/{A}").json()["faucets"][0]
    conn = api_server.get_db_connection()
    cot = api_server.click_quote(conn, T1, int(time.time()))
    conn.close()
    assert abs(bal["min_withdraw"] - 10 * cot) < 1e-6 and bal["min_withdraw"] < 10, bal

    # 7. Abaixo do piso de 0,01 o clique e recusado: folga 2 / 30 / 201 cliques.
    caucionar(T1, api_server.faucet_owed(api_server.get_db_connection(), T1) + 2)
    r = clique(K1, "0x" + "e5" * 20)
    assert r.status_code == 402 and "too thin" in r.json()["detail"], r.text
    # Retirar caucao abaixo do que se deve aos usuarios: test_faucet_reserve.py, regra 2.

print("ok  prova obrigatoria e de uso unico; clique cheio com poucos usuarios, diluido com muitos; "
      "402 sem caucao ou abaixo do piso; saque minimo acompanha o clique")
