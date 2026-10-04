# -*- coding: utf-8 -*-
"""Junta o saldo preso na conta derivada ao da conta que a carteira alcanca.

    python scripts/consolidate_derived_claims.py [--wallet <solana>] [--dry-run]

Uma carteira Solana sempre deriva uma conta -- os ultimos 20 bytes do keccak256
da chave publica -- mas um vinculo explicito em `solana_links` manda nela. Quem
clica ANTES de vincular credita na derivada; quando vincula depois, passa a
entrar na vinculada, e o que foi creditado antes fica numa conta que a pessoa
nao abre mais.

Isso ja foi um defeito maior: ate 26 de setembro o caminho do microclaim
derivava enquanto /api/auth/solana honrava os vinculos, entao as duas discordavam
dentro da mesma sessao. `account_reached_by_wallet()` unificou as duas. O que
este script faz e varrer o residuo, que continua aparecendo sempre que alguem
clica antes de vincular.

Nao apaga nada: move o saldo e deixa duas linhas em microclaims_history, uma
negativa na origem e uma positiva no destino, com o motivo. Um saldo que muda de
conta sem rastro e indistinguivel de um saldo inventado.
"""
import argparse
import os
import sqlite3
import sys
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from api_server import address_from_solana_wallet

MOTIVO = "consolidado: clique anterior ao vinculo caiu na conta derivada"


def casos(conn, so_carteira=None):
    """Carteiras cuja conta derivada tem saldo e cujo vinculo aponta para outra."""
    achados = []
    q = "SELECT DISTINCT solana_address FROM solana_links"
    params = ()
    if so_carteira:
        q += " WHERE solana_address = ?"
        params = (so_carteira,)

    for (carteira,) in conn.execute(q, params).fetchall():
        try:
            derivada = address_from_solana_wallet(carteira).lower()
        except Exception:
            continue
        linha = conn.execute(
            "SELECT user_address FROM solana_links WHERE solana_address = ? ORDER BY linked_at LIMIT 1",
            (carteira,)).fetchone()
        if not linha:
            continue
        alcancada = linha[0].lower()
        if alcancada == derivada:
            continue
        presas = conn.execute(
            "SELECT faucet_wallet, virtual_balance FROM microclaims_ledger "
            "WHERE user_wallet = ? AND virtual_balance > 0", (derivada,)).fetchall()
        for faucet, saldo in presas:
            achados.append((carteira, derivada, alcancada, faucet, float(saldo)))
    return achados


def main() -> int:
    p = argparse.ArgumentParser(description="Move derived-account balances to the linked account")
    p.add_argument("--wallet", help="limita a uma carteira Solana")
    p.add_argument("--db", default=os.path.join(RAIZ, "blockchain.db"))
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    conn = sqlite3.connect(args.db)
    achados = casos(conn, args.wallet)

    if not achados:
        print("nada preso em conta derivada")
        conn.close()
        return 0

    total = 0.0
    for carteira, derivada, alcancada, faucet, saldo in achados:
        print(f"carteira {carteira}")
        print(f"   {saldo} na derivada {derivada}")
        print(f"   vai para a vinculada {alcancada}")
        print(f"   torneira de origem {faucet}")
        total += saldo
    print(f"\ntotal a mover: {total}")

    if args.dry_run:
        print("dry run: nada foi movido")
        conn.close()
        return 0

    agora = int(time.time())
    for carteira, derivada, alcancada, faucet, saldo in achados:
        # A origem zera; a linha fica, porque o historico dela e real.
        conn.execute(
            "UPDATE microclaims_ledger SET virtual_balance = 0 "
            "WHERE user_wallet = ? AND faucet_wallet = ?", (derivada, faucet))
        # O destino pode nao existir ainda nessa torneira.
        existe = conn.execute(
            "SELECT 1 FROM microclaims_ledger WHERE user_wallet = ? AND faucet_wallet = ?",
            (alcancada, faucet)).fetchone()
        if existe:
            conn.execute(
                "UPDATE microclaims_ledger SET virtual_balance = virtual_balance + ? "
                "WHERE user_wallet = ? AND faucet_wallet = ?", (saldo, alcancada, faucet))
        else:
            conn.execute(
                "INSERT INTO microclaims_ledger (faucet_wallet, user_wallet, virtual_balance, "
                "total_claimed, total_withdrawn, claim_count, last_claim_at, created_at) "
                "VALUES (?, ?, ?, ?, 0, 0, 0, ?)",
                (faucet, alcancada, saldo, saldo, agora))

        # Duas linhas, porque uma so deixaria o total do dia sem fechar.
        for conta, valor in ((derivada, -saldo), (alcancada, saldo)):
            conn.execute(
                "INSERT INTO microclaims_history (faucet_wallet, user_wallet, amount, "
                "event_type, tx_hash, timestamp) VALUES (?, ?, ?, 'CONSOLIDATE', ?, ?)",
                (faucet, conta, valor, MOTIVO, agora))

    conn.commit()

    # Reler em vez de confiar no que acabamos de escrever.
    restou = casos(conn, args.wallet)
    conn.close()
    print(f"\nmovido: {total}")
    print("restou preso:", "nada" if not restou else restou)
    return 0 if not restou else 1


if __name__ == "__main__":
    sys.exit(main())
