# -*- coding: utf-8 -*-
"""A caucao de uma torneira: quem tranca, quanto, e quem paga o saque.

A reserva era uma frase assinada. O dono dizia um numero, o painel punha o saldo
real do lado, e nada impedia o dono de gastar esse saldo no dia seguinte -- uma
torneira com 100% de cobertura e uma sem nada eram a mesma torneira com digitacao
diferente. Agora o valor sai da carteira e vai para a tesouraria, e e de la que o
usuario e pago.

Mover o dinheiro e o isolamento: nao existe um segundo livro de "quanto esta
travado" que possa divergir do saldo. O que este arquivo prende sao as tres
regras que sustentam isso, e cada uma existe porque quebra-la tem uma vitima:

  1. Nao se caucao o que nao se tem. Sem isto a tesouraria mostraria garantia
     que nunca entrou nela.
  2. Nao se destrava abaixo do que se deve. Sem isto o dono retira a garantia
     na vespera do saque e o usuario fica com um numero na tela.
  3. O saque sai da caucao antes do saldo livre, e a caucao encolhe. Sem a
     segunda metade a tesouraria pagaria e a torneira seguiria exibindo a
     garantia inteira, que e a mesma mentira de antes com outro nome.

    python test_faucet_reserve.py
"""

import os
import shutil
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))

FAUCET = "0x" + "11" * 20      # torneira sem dono que assine
DONO = "0x" + "33" * 20        # torneira aberta pelo painel, conta custodial
OUTRO = "0x" + "44" * 20
USUARIO = "0x" + "55" * 20


def main() -> int:
    import settlement

    # --- a aritmetica, que nao precisa de banco -------------------------
    assert settlement.reserve_coverage(500, 0) is None, "sem divida virou descoberta"
    assert settlement.reserve_coverage(250, 1000) == 0.25
    assert settlement.reserve_coverage(1500, 1000) == 1.5, "o dobro caucionado tem de se ver"
    assert settlement.reserve_coverage(0, 2) == 0.0, "deve e nao caucionou: 0%, nao None"

    texto = settlement.reserve_declare_message(FAUCET, 2500.0, "7777", 1789618329)
    assert "2500.0000 $CLAIM" in texto, "quem assina nao ve quanto tranca"
    assert "stop being able to spend it" in texto, (
        "a sentenca nao avisa que o dinheiro sai da carteira; ela dizia o "
        "contrario quando a reserva ainda era so uma frase"
    )

    # --- o endpoint -----------------------------------------------------
    workdir = tempfile.mkdtemp(prefix="fcreserve-")
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    import api_server
    from fastapi.testclient import TestClient

    api_server.init_users_table()
    api_server.init_faucet_registry_table()
    api_server.init_faucet_api_keys_table()
    api_server.init_settlement_tables()     # traz a tabela sessions
    api_server.init_microclaims_tables()
    client = TestClient(api_server.app)
    ts = int(time.time())

    conn = api_server.get_db_connection()
    conn.execute("CREATE TABLE IF NOT EXISTS transactions (hash TEXT, block_height INTEGER, "
                 "from_address TEXT, to_address TEXT, value REAL, gas_price REAL, "
                 "timestamp INTEGER, tx_type TEXT, source_platform TEXT)")
    for addr, email in ((DONO, "dono@exemplo.test"), (OUTRO, "outro@exemplo.test"),
                        (USUARIO, "usuario@exemplo.test")):
        conn.execute("INSERT INTO users (email, password_hash, wallet_address, created_at) "
                     "VALUES (?, ?, ?, ?)", (email, "x", addr, ts))
    conn.commit()
    conn.close()
    assert api_server.is_custodial_address(DONO), "a conta do dono nao ficou custodial"

    for nome, w in (("Sem Dono", FAUCET), ("Torneira do Dono", DONO)):
        r = client.post("/api/faucethub/register", json={"name": nome, "wallet_address": w})
        assert r.status_code == 200, r.text

    sess = api_server.issue_session(DONO)["session_token"]
    dono_hdr = {"X-Session-Token": sess}

    # --- quem pode declarar ---------------------------------------------
    # sem assinatura: o endereco esta no diretorio publico e nao autoriza nada
    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": FAUCET, "amount": 1.0, "sig_timestamp": ts})
    assert r.status_code == 401, f"trancou sem assinar: {r.status_code} {r.text}"

    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": "0x" + "22" * 20, "amount": 1.0, "sig_timestamp": ts})
    assert r.status_code == 404, r.text

    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": DONO, "amount": -5.0, "sig_timestamp": ts},
                    headers=dono_hdr)
    assert r.status_code == 400, r.text

    # a sessao de outra conta nao serve
    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": DONO, "amount": 1.0, "sig_timestamp": ts},
                    headers={"X-Session-Token": api_server.issue_session(OUTRO)["session_token"]})
    assert r.status_code == 401, f"a sessao de outra conta trancou pela torneira: {r.text}"

    # --- regra 1: nao se tranca o que nao se tem -------------------------
    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": DONO, "amount": 100.0, "sig_timestamp": ts},
                    headers=dono_hdr)
    assert r.status_code == 400, f"caucionou 100 com saldo zero: {r.text}"
    assert "free balance" in r.text.lower(), r.text

    # a torneira ganha saldo, como um no ganharia
    conn = api_server.get_db_connection()
    conn.execute("INSERT INTO transactions (hash, block_height, from_address, to_address, "
                 "value, gas_price, timestamp) VALUES (?, 0, ?, ?, ?, 0.0, ?)",
                 ("0xseed", "0xorigem", DONO, 500.0, ts))
    conn.commit()
    conn.close()

    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": DONO, "amount": 100.0, "sig_timestamp": ts},
                    headers=dono_hdr)
    assert r.status_code == 200, r.text
    assert r.json()["locked"] == 100.0, r.json()

    # o isolamento: o saldo caiu pelos 100 que foram para a tesouraria
    livre = (await_sync(api_server.get_user_balance(DONO)))["total_claim"]
    assert abs(livre - 400.0) < 1e-6, f"o saldo nao ficou isolado da caucao: {livre}"
    tesouraria = (await_sync(api_server.get_user_balance(api_server.TREASURY_ADDRESS)))["total_claim"]
    assert abs(tesouraria - 100.0) < 1e-6, f"a tesouraria nao recebeu: {tesouraria}"

    # --- regra 2: nao se destrava abaixo do que se deve ------------------
    conn = api_server.get_db_connection()
    conn.execute("INSERT INTO microclaims_ledger (faucet_wallet, user_wallet, virtual_balance, "
                 "total_claimed, claim_count, last_claim_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                 (DONO, USUARIO, 30.0, 30.0, 30, ts - 400, ts))
    conn.commit()
    conn.close()

    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": DONO, "amount": 10.0, "sig_timestamp": ts},
                    headers=dono_hdr)
    assert r.status_code == 400, f"destravou abaixo da divida: {r.text}"
    assert "owes" in r.text.lower() and "30" in r.text, r.text

    # ate a divida, pode
    r = client.post("/api/faucethub/reserve",
                    json={"wallet_address": DONO, "amount": 30.0, "sig_timestamp": ts},
                    headers=dono_hdr)
    assert r.status_code == 200, r.text
    assert r.json()["coverage"] == 1.0, r.json()

    # --- o painel mostra divida, caucao e cobertura ----------------------
    board = {f["wallet_address"]: f for f in client.get("/api/faucethub/faucets").json()}
    d = board[DONO]
    assert d["owed"] == 30.0, d
    assert d["reserve"] == 30.0, d
    assert d["coverage"] == 1.0, d
    sem = board[FAUCET]
    assert sem["owed"] == 0.0 and sem["coverage"] is None, (
        "torneira sem divida aparecendo como descoberta: %r" % sem)

    # --- regra 3: o saque sai da caucao e a caucao encolhe ---------------
    r = client.post("/api/faucethub/microclaim/withdraw",
                    json={"user_wallet": USUARIO, "faucet_wallet": DONO, "sig_timestamp": ts},
                    headers={"X-Session-Token": api_server.issue_session(USUARIO)["session_token"]})
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["paid_from"] == "escrow", f"o saque nao saiu da caucao: {corpo}"
    assert corpo["from"] == api_server.TREASURY_ADDRESS, corpo
    assert corpo["amount"] == 30.0, corpo

    conn = api_server.get_db_connection()
    restou = api_server.faucet_escrow(conn, DONO)
    devendo = api_server.faucet_owed(conn, DONO)
    conn.close()
    assert abs(restou) < 1e-9, f"a caucao gasta nao encolheu: {restou}"
    assert abs(devendo) < 1e-9, f"a divida nao zerou: {devendo}"

    recebido = (await_sync(api_server.get_user_balance(USUARIO)))["total_claim"]
    assert abs(recebido - 30.0) < 1e-6, f"o usuario nao recebeu: {recebido}"

    client.close()
    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print("test_faucet_reserve.py OK")
    return 0


def await_sync(coro):
    """get_user_balance e async e este teste nao roda dentro de um loop."""
    import asyncio
    return asyncio.get_event_loop().run_until_complete(coro)


if __name__ == "__main__":
    import asyncio
    asyncio.set_event_loop(asyncio.new_event_loop())
    sys.exit(main())
