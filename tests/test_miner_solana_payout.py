"""Um no registrado com endereco Solana paga a conta que a carteira alcanca.

Antes o cadastro so fazia .lower(). Base58 diferencia maiusculas, entao a
recompensa caia numa conta que nenhuma carteira consegue abrir.

    .venv/Scripts/python.exe tests/test_miner_solana_payout.py
"""
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(tempfile.mkdtemp(prefix="faucetchain-miner-payout-"))
sys.path.insert(0, ROOT)
os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402

srv.init_settlement_tables()

SOL = "So11111111111111111111111111111111111111112"

conta = srv.miner_payout_address(SOL)
assert conta == srv.faucet_user_address(SOL), conta
assert conta.startswith("0x") and len(conta) == 42, conta
assert conta != SOL.lower()

# Carteira vinculada antes a outra conta: o no paga a vinculada, como o login.
conn = srv.get_db_connection()
conn.execute("INSERT INTO solana_links (user_address, solana_address, linked_at) VALUES (?, ?, 1)",
             ("0x" + "ab" * 20, SOL))
conn.commit()
conn.close()
assert srv.miner_payout_address(SOL) == "0x" + "ab" * 20

# O que nao e Solana continua como sempre foi.
assert srv.miner_payout_address(" 0xABCDEF0123456789abcdef0123456789ABCDEF01 ") == \
    "0xabcdef0123456789abcdef0123456789abcdef01"
assert srv.miner_payout_address("NoMe-Qualquer") == "nome-qualquer"
print("test_miner_solana_payout OK")
