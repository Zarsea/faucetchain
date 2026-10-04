# -*- coding: utf-8 -*-
"""Desfaz um vinculo entre uma carteira Solana e uma conta desta cadeia.

    python scripts/unlink_wallet.py --wallet <solana> --account <0x...> [--dry-run]

Uma carteira pode ter mais de um vinculo em `solana_links`, e
`account_reached_by_wallet()` usa o mais antigo. Quando um vinculo e residuo de
teste, o credito de quem clica na torneira cai numa conta que a pessoa nem abre.

Este script apaga UM vinculo, nomeado. Nao escolhe por data nem apaga "os
sobrando": a escolha de qual conta fica e de quem opera, e um script que decide
isso sozinho erra em silencio na primeira vez que a heuristica nao serve.

Antes de apagar, imprime o estado; depois, reimprime e diz para onde a carteira
passou a resolver. Sem isso o operador fica com a palavra do script em vez da
leitura do banco, e foi exatamente assim que a divergencia do contador de
mineracao passou um mes sem ser vista.
"""
import argparse
import os
import sqlite3
import sys
from datetime import datetime, UTC

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def quando(ts):
    return datetime.fromtimestamp(ts, UTC).strftime("%d/%m/%Y %H:%M UTC")


def mostra(conn, wallet):
    linhas = conn.execute(
        "SELECT user_address, linked_at FROM solana_links WHERE solana_address = ? "
        "ORDER BY linked_at", (wallet,)).fetchall()
    for i, (conta, ts) in enumerate(linhas):
        marca = "  <- e esta que a cadeia usa" if i == 0 else ""
        print(f"    {conta}  {quando(ts)}{marca}")
    if not linhas:
        print("    (nenhum)")
    return linhas


def main() -> int:
    p = argparse.ArgumentParser(description="Remove one wallet-account link")
    p.add_argument("--wallet", required=True, help="endereco Solana")
    p.add_argument("--account", required=True, help="conta 0x a desvincular")
    p.add_argument("--db", default=os.path.join(RAIZ, "blockchain.db"))
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    conta = args.account.strip().lower()
    conn = sqlite3.connect(args.db)

    print(f"carteira {args.wallet}")
    print("  vinculos agora:")
    antes = mostra(conn, args.wallet)

    if not any(c == conta for c, _ in antes):
        print(f"\n  {conta} nao esta vinculada a esta carteira; nada a fazer")
        conn.close()
        return 1
    if len(antes) == 1:
        print("\n  este e o unico vinculo. Apaga-lo deixaria a carteira sem conta,")
        print("  e o proximo claim cairia na conta derivada do endereco, que e outra.")
        print("  Se e isso mesmo que voce quer, faca pelo banco, de proposito.")
        conn.close()
        return 1

    # O que a pessoa perde de vista ao desvincular: o saldo que ficou naquela
    # conta nao vai a lugar nenhum, e precisa ser dito agora e nao depois.
    saldo = conn.execute(
        "SELECT COALESCE(SUM(virtual_balance), 0), COUNT(*) FROM microclaims_ledger "
        "WHERE user_wallet = ?", (conta,)).fetchone()
    recompensas = conn.execute(
        "SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM settlement_rewards WHERE user_address = ?",
        (conta,)).fetchone()
    print(f"\n  o que fica na {conta[:14]}...:")
    print(f"    microclaim  {saldo[0]} em {saldo[1]} linha(s)")
    print(f"    campanhas   {recompensas[1]} em {recompensas[0]} recompensa(s)")
    print("    (desvincular nao move nada disso; so muda para onde VAI o proximo claim)")

    if args.dry_run:
        print("\ndry run: nada foi apagado")
        conn.close()
        return 0

    n = conn.execute(
        "DELETE FROM solana_links WHERE solana_address = ? AND user_address = ?",
        (args.wallet, conta)).rowcount
    conn.commit()
    print(f"\n  apagado: {n} vinculo")

    print("  vinculos agora:")
    depois = mostra(conn, args.wallet)
    conn.close()

    if depois:
        print(f"\n  a carteira passa a resolver para {depois[0][0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
