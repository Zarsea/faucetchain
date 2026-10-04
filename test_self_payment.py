# -*- coding: utf-8 -*-
"""Uma torneira que e seu proprio usuario nao pode sacar de si mesma.

Nao e regra de politica, e aritmetica. O saque grava uma transferencia de
`pagador` para `user_wallet`, e get_user_balance soma o que entra e subtrai o
que sai. Com o mesmo endereco nos dois lados as pontas se cancelam: o saldo
virtual e zerado, total_withdrawn cresce, e o saldo em $CLAIM nao se move.

Medido em 4 de outubro antes do conserto, com uma torneira que tinha 500 de
saldo livre e 12 de divida consigo mesma:

    saque:   200 OK   paid_from "faucet balance"   amount 12.0
    saldo antes 500.0   depois 500.0
    virtual 12.0 -> 0   sacado 12.0

Doze $CLAIM deixaram de existir, com HTTP 200 em cima. Este arquivo existe para
que isso nao volte, e prende tres coisas:

  **A recusa acontece.** E com 400, nao com 500: e entrada invalida, nao falha
  do servidor.

  **A recusa nao retem nada.** O que a torneira deve a si mesma ja esta no saldo
  dela -- nao ha transferencia a fazer. A mensagem diz isso, porque "recusado"
  sem explicacao parece dinheiro preso.

  **Nada foi consumido.** O saldo virtual continua intacto depois da recusa. Um
  conserto que recusasse DEPOIS de zerar o livro seria pior que o defeito.

E a quarta, que e a que da sentido as outras: entre enderecos diferentes o saque
continua funcionando e creditando de verdade.

    python test_self_payment.py
"""

import asyncio
import os
import shutil
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
TORNEIRA = "0x" + "7d" * 20
OUTRO = "0x" + "b3" * 20


def main() -> int:
    workdir = tempfile.mkdtemp(prefix="fcauto-")
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    os.environ["SETTLEMENT_OPERATOR_TOKEN"] = "op-teste"
    import api_server
    import importlib
    importlib.reload(api_server)
    from fastapi.testclient import TestClient

    for init in (api_server.init_users_table, api_server.init_settlement_tables,
                 api_server.init_faucet_registry_table, api_server.init_faucet_api_keys_table,
                 api_server.init_microclaims_tables):
        init()

    agora = int(time.time())
    conn = api_server.get_db_connection()
    conn.execute("CREATE TABLE IF NOT EXISTS transactions (hash TEXT, block_height INTEGER, "
                 "from_address TEXT, to_address TEXT, value REAL, gas_price REAL, "
                 "timestamp INTEGER, tx_type TEXT, source_platform TEXT)")
    for addr, email in ((TORNEIRA, "torneira@exemplo.test"), (OUTRO, "outro@exemplo.test")):
        conn.execute("INSERT INTO users (email, password_hash, wallet_address, created_at) "
                     "VALUES (?, ?, ?, ?)", (email, "x", addr, agora))
    # Saldo livre na torneira, para que a recusa nao possa ser confundida com
    # falta de fundos.
    conn.execute("INSERT INTO transactions (hash, block_height, from_address, to_address, "
                 "value, gas_price, timestamp, tx_type) VALUES ('0xseed', 0, '0x0', ?, 500.0, 0, ?, 'TRANSFER')",
                 (TORNEIRA, agora))
    conn.commit()
    conn.close()

    client = TestClient(api_server.app)
    chave = client.post("/api/faucethub/register", json={
        "name": "FaucetHunter", "wallet_address": TORNEIRA}).json()["api_key"]

    def acumula(quem, quantos):
        for _ in range(quantos):
            conn = api_server.get_db_connection()
            conn.execute("UPDATE microclaims_ledger SET last_claim_at = 0 WHERE user_wallet = ?", (quem,))
            conn.commit()
            conn.close()
            r = client.post("/api/faucethub/microclaim",
                            json={"user_wallet": quem, "amount": 1.0},
                            headers={"X-Api-Key": chave})
            assert r.status_code == 200, r.text

    def virtual(quem):
        conn = api_server.get_db_connection()
        linha = conn.execute(
            "SELECT virtual_balance, total_withdrawn FROM microclaims_ledger "
            "WHERE user_wallet = ? AND faucet_wallet = ?", (quem, TORNEIRA)).fetchone()
        conn.close()
        return (linha[0], linha[1]) if linha else (0.0, 0.0)

    def saca(quem):
        return client.post("/api/faucethub/microclaim/withdraw",
                           json={"user_wallet": quem, "faucet_wallet": TORNEIRA,
                                 "sig_timestamp": int(time.time())},
                           headers={"X-Session-Token": api_server.issue_session(quem)["session_token"]})

    # --- a torneira acumula divida consigo mesma -------------------------
    acumula(TORNEIRA, 12)
    saldo_antes = asyncio.run(api_server.get_user_balance(TORNEIRA))["total_claim"]
    assert virtual(TORNEIRA)[0] == 12.0, virtual(TORNEIRA)

    # --- e a recusa ------------------------------------------------------
    r = saca(TORNEIRA)
    assert r.status_code == 400, (
        "a torneira sacou de si mesma: %s %s" % (r.status_code, r.text[:200]))
    assert "itself" in r.text, "a recusa precisa dizer por que: %s" % r.text
    assert "already in" in r.text, (
        "a recusa precisa dizer que o valor ja esta no saldo, senao parece dinheiro preso: %s" % r.text)

    # --- e nao consumiu nada ---------------------------------------------
    virt, sacado = virtual(TORNEIRA)
    assert virt == 12.0, "a recusa comeu o saldo virtual: %s" % virt
    assert sacado == 0.0, "a recusa contabilizou um saque que nao houve: %s" % sacado
    saldo_depois = asyncio.run(api_server.get_user_balance(TORNEIRA))["total_claim"]
    assert saldo_depois == saldo_antes, (saldo_antes, saldo_depois)

    # --- entre enderecos diferentes continua funcionando, e creditando ----
    # Sem isto a guarda poderia ter quebrado o saque inteiro e o teste acima
    # passaria do mesmo jeito.
    acumula(OUTRO, 12)
    antes_outro = asyncio.run(api_server.get_user_balance(OUTRO))["total_claim"]
    r = saca(OUTRO)
    assert r.status_code == 200, r.text
    assert r.json()["amount"] == 12.0, r.json()
    depois_outro = asyncio.run(api_server.get_user_balance(OUTRO))["total_claim"]
    assert abs((depois_outro - antes_outro) - 12.0) < 1e-9, (
        "o saque entre enderecos diferentes nao creditou: %s -> %s" % (antes_outro, depois_outro))
    assert virtual(OUTRO) == (0.0, 12.0), virtual(OUTRO)

    client.close()
    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print("test_self_payment.py OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
