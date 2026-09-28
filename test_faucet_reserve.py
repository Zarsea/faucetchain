# -*- coding: utf-8 -*-
"""A reserva declarada de uma torneira, e o que o painel mostra ao lado dela.

O painel de liquidez mostrava um saldo sem nada para ler contra: uma torneira
sentada em 500 $CLAIM parecia igual tendo prometido 100 ou 50.000 aos usuarios
dela. A reserva e a outra metade dessa comparacao, e vem do proprietario porque
ninguem mais sabe o numero.

O que este arquivo prende:

  1. que declarar exige assinatura da carteira que registrou a torneira -- o
     endereco dela esta no diretorio publico, entao o endereco nao pode bastar;
  2. que "nao declarada" nao e "descoberta". Uma torneira que nunca declarou
     nada nao esta inadimplente, e mostrar 0% ao lado dela seria acusa-la de
     algo que ela nao disse;
  3. que a sentenca assinada nomeia o valor e admite o limite. A assinatura nao
     tranca saldo nenhum, e quem assina precisa ler isso antes.

    python test_faucet_reserve.py
"""

import os
import shutil
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))

FAUCET = "0x" + "11" * 20


def main() -> int:
    import settlement

    # --- a aritmetica, que nao precisa de banco -------------------------
    assert settlement.reserve_coverage(500, 0) is None, "nao declarada virou descoberta"
    assert settlement.reserve_coverage(250, 1000) == 0.25
    assert settlement.reserve_coverage(1500, 1000) == 1.5, "o dobro prometido tem de se ver"
    assert settlement.reserve_coverage(-5, 1000) == 0.0, "saldo negativo virou credito"

    texto = settlement.reserve_declare_message(FAUCET, 2500.0, "7777", 1789618329)
    assert "2500.0000 $CLAIM" in texto, "quem assina nao ve quanto declara"
    assert "does not lock" in texto, "a sentenca promete custodia que nao existe"

    # --- o endpoint -----------------------------------------------------
    workdir = tempfile.mkdtemp(prefix="fcreserve-")
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    import api_server
    from fastapi.testclient import TestClient

    api_server.init_users_table()
    api_server.init_faucet_registry_table()
    api_server.init_faucet_api_keys_table()
    api_server.init_settlement_tables()   # traz a tabela sessions
    client = TestClient(api_server.app)

    r = client.post("/api/faucethub/register", json={"name": "Torneira", "wallet_address": FAUCET})
    assert r.status_code == 200, r.text

    ts = int(time.time())

    # sem assinatura: o endereco esta publico, logo nao autoriza nada
    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": FAUCET, "amount": 1.0, "sig_timestamp": ts})
    assert r.status_code == 401, f"declarou sem assinar: {r.status_code} {r.text}"

    # uma torneira que nao existe
    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": "0x" + "22" * 20, "amount": 1.0, "sig_timestamp": ts})
    assert r.status_code == 404, r.text

    # valor negativo
    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": FAUCET, "amount": -5.0, "sig_timestamp": ts})
    assert r.status_code == 400, r.text

    # --- o caminho que o demo vai usar: um dono que consegue declarar ----
    # A torneira acima nao esta em `users`, entao so uma chave privada a
    # autoriza -- e e por isso que nenhuma das seis torneiras registradas hoje
    # consegue declarar nada. Uma torneira aberta pelo painel novo fica no nome
    # da conta logada, que e custodial e assina por sessao. Este trecho prende
    # esse caminho: sem ele o teste provava que estranhos sao recusados e nao
    # que o proprietario e aceito, o que quebra ao vivo.
    DONO = "0x" + "33" * 20
    conn = api_server.get_db_connection()
    conn.execute(
        "INSERT INTO users (email, password_hash, wallet_address, created_at) VALUES (?, ?, ?, ?)",
        ("dono@exemplo.test", "x", DONO, ts))
    conn.commit()
    conn.close()
    assert api_server.is_custodial_address(DONO), "a conta do dono nao ficou custodial"

    r = client.post("/api/faucethub/register", json={"name": "Torneira do Dono", "wallet_address": DONO})
    assert r.status_code == 200, r.text

    sess = api_server.issue_session(DONO)["session_token"]
    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": DONO, "amount": 2500.0, "sig_timestamp": ts},
                    headers={"X-Session-Token": sess})
    assert r.status_code == 200, f"o proprietario nao conseguiu declarar: {r.status_code} {r.text}"
    body = r.json()
    assert body["reserve"] == 2500.0, body
    assert body["coverage"] == 0.0, f"saldo zero com reserva declarada tem de dar 0%: {body}"

    # a sessao de outra pessoa nao serve
    OUTRO = "0x" + "44" * 20
    conn = api_server.get_db_connection()
    conn.execute(
        "INSERT INTO users (email, password_hash, wallet_address, created_at) VALUES (?, ?, ?, ?)",
        ("outro@exemplo.test", "x", OUTRO, ts))
    conn.commit()
    conn.close()
    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": DONO, "amount": 1.0, "sig_timestamp": ts},
                    headers={"X-Session-Token": api_server.issue_session(OUTRO)["session_token"]})
    assert r.status_code == 401, f"a sessao de outra conta declarou pela torneira: {r.text}"

    # declarar de novo substitui, nao acumula
    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": DONO, "amount": 400.0, "sig_timestamp": ts},
                    headers={"X-Session-Token": sess})
    assert r.status_code == 200, r.text
    assert r.json()["reserve"] == 400.0, "a segunda declaracao somou em vez de substituir"

    # --- o painel expoe os tres juntos ----------------------------------
    board = client.get("/api/faucethub/faucets").json()
    assert board, "a torneira registrada nao apareceu no painel"
    for f in board:
        for campo in ("liquidity", "reserve", "coverage"):
            assert campo in f, f"o painel perdeu '{campo}': {f}"
        if f["reserve"] == 0:
            assert f["coverage"] is None, f
        else:
            assert abs(f["coverage"] - f["liquidity"] / f["reserve"]) < 1e-9, f

    # --- declarada de verdade, escrevendo como o endpoint escreve --------
    conn = api_server.get_db_connection()
    conn.execute(
        "INSERT INTO faucet_reserves (faucet_wallet, amount, declared_at) VALUES (?, ?, ?)",
        (FAUCET, 1000.0, ts))
    conn.commit()
    conn.close()

    f = client.get("/api/faucethub/faucets").json()[0]
    assert f["reserve"] == 1000.0, f
    assert f["coverage"] is not None, "declarou e a cobertura seguiu nula"
    assert f["reserve_declared_at"] == ts, f

    client.close()
    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print("test_faucet_reserve.py OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
