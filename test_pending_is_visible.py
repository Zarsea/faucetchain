# -*- coding: utf-8 -*-
"""Um claim resolvido e nao selado tem de aparecer, com o motivo.

Alguem gastou CPU numa prova de trabalho, o claim entrou na fila, e o painel
mostrou 0,00 sem uma palavra. A leitura natural disso e "nao registrou" --
correta sobre o que estava escrito, errada sobre o que aconteceu: o claim estava
la, parado, porque nenhum no estava online para fechar o bloco.

O servidor sabia das duas coisas o tempo todo. A fila tinha a linha e
`active_miners` tinha zero. Faltava dizer.

O que este arquivo prende e a diferenca entre tres situacoes que, na tela
antiga, eram todas 0,00:

  1. nada reivindicado  -> nao ha o que esperar
  2. na fila, com no    -> paciencia; sai sozinho
  3. na fila, sem no    -> nao sai sozinho, alguem precisa ligar uma maquina

A terceira e a que mais custa, porque e a unica em que esperar nao resolve.

    python test_pending_is_visible.py
"""

import asyncio
import os
import shutil
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
USER = "0x" + "77" * 20


def main() -> int:
    workdir = tempfile.mkdtemp(prefix="fcpending-")
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    import api_server

    api_server.init_users_table()
    api_server.init_pending_claims_table()
    api_server.init_mining_table()
    now = int(time.time())

    def saldo():
        return asyncio.run(api_server.get_user_balance(USER))

    # --- 1. nada na fila ------------------------------------------------
    b = saldo()
    assert b["pending_amount"] == 0 and b["pending_count"] == 0, b
    assert "sealers_online" in b, "a tela nao tem como saber se alguem pode selar"

    # --- 2. um claim esperando, e ninguem para selar ---------------------
    conn = api_server.get_db_connection()
    conn.execute(
        "INSERT INTO pending_claims (user_address, amount, tx_hash, block_height, "
        "timestamp, status) VALUES (?, ?, ?, ?, ?, 'pending')",
        (USER, 7.42, "0xabc", 0, now))
    conn.commit()
    conn.close()

    b = saldo()
    assert b["total_claim"] == 0, "nao selado nao e saldo"
    assert b["pending_amount"] == 7.42, b
    assert b["pending_count"] == 1, b
    assert b["sealers_online"] == 0, (
        "sem no online o painel precisa poder dizer que isto nao sai sozinho")

    # --- 3. com um no de pe, a mesma fila quer dizer outra coisa ---------
    conn = api_server.get_db_connection()
    conn.execute(
        "INSERT INTO active_miners (node_id, wallet_address, node_name, registered_at, "
        "last_heartbeat, is_online) VALUES (?, ?, ?, ?, ?, 1)",
        ("fcn-teste", "0x" + "88" * 20, "no-de-teste", now, now))
    conn.commit()
    conn.close()

    b = saldo()
    assert b["pending_amount"] == 7.42, b
    assert b["sealers_online"] == 1, (
        "com no online a mensagem muda de 'ligue uma maquina' para 'aguarde'")

    # --- 4. um no que parou de bater nao conta ---------------------------
    # Um no offline aparecendo como selador e pior do que nenhum: manda a
    # pessoa esperar por algo que nao vai acontecer.
    conn = api_server.get_db_connection()
    conn.execute("UPDATE active_miners SET last_heartbeat = ?",
                 (now - api_server.MINING_CONFIG["heartbeat_timeout"] - 60,))
    conn.commit()
    conn.close()

    b = saldo()
    assert b["sealers_online"] == 0, (
        "um no sem heartbeat ainda contava como quem pode selar: %r" % b)

    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print("test_pending_is_visible.py OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
