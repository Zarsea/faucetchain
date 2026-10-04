# -*- coding: utf-8 -*-
"""Vincula uma carteira Solana a uma conta desta cadeia, pelo lado do operador.

    python scripts/link_wallet.py --wallet <solana> --account <0x...> [--dry-run]

A rota /api/solana/link exige duas assinaturas: uma provando quem escolheu a
carteira, outra provando quem tem a chave dela. Isso e certo e deve continuar
assim para qualquer usuario.

Este script passa por fora disso, e por isso existe so para um caso: o operador
precisa entrar numa conta a que ele ja tem acesso por outro meio e que nao
consegue assinar pelo lado da cadeia -- uma conta de convidado, cuja senha foi
gerada e nao guardada. Usar isto para vincular a carteira de outra pessoa seria
dar a conta dela para quem rodou o comando.

Tres recusas antes de escrever, todas por motivos que ja morderam aqui:

  **Carteira que ja tem vinculo.** `account_reached_by_wallet` usa o MAIS
  ANTIGO, entao um vinculo novo numa carteira ja vinculada nao muda nada e
  parece que o comando falhou em silencio.

  **Conta que nao existe em `users`.** Sem linha la, a sessao nao e emitida e a
  pessoa vincula uma carteira a uma conta em que nao consegue entrar.

  **Conta que e uma torneira registrada.** Nao impede -- avisa. Desde 4 de
  outubro o saque de si para si e recusado, entao isso deixou de destruir
  dinheiro; mas continua sendo uma mistura de papeis que vale ser dita em voz
  alta antes, e nao descoberta depois.
"""
import argparse
import os
import sqlite3
import sys
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from api_server import address_from_solana_wallet, normalize_address


def main() -> int:
    p = argparse.ArgumentParser(description="Link a Solana wallet to an account")
    p.add_argument("--wallet", required=True)
    p.add_argument("--account", required=True)
    p.add_argument("--db", default=os.path.join(RAIZ, "blockchain.db"))
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    try:
        conta = normalize_address(args.account)
    except ValueError as e:
        raise SystemExit(f"conta invalida: {e}")

    try:
        derivada = address_from_solana_wallet(args.wallet)
    except Exception as e:
        raise SystemExit(f"carteira Solana invalida: {e}")

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row

    ja = conn.execute(
        "SELECT user_address, linked_at FROM solana_links WHERE solana_address = ? ORDER BY linked_at",
        (args.wallet,)).fetchall()
    if ja:
        print(f"a carteira {args.wallet} ja tem {len(ja)} vinculo(s):")
        for r in ja:
            print(f"   {r['user_address']}")
        print("\nO mais antigo e o que vale, entao um vinculo novo aqui nao mudaria nada.")
        print("Use outra carteira, ou desvincule antes com scripts/unlink_wallet.py.")
        conn.close()
        return 1

    u = conn.execute("SELECT email FROM users WHERE wallet_address = ?", (conta,)).fetchone()
    if not u:
        print(f"a conta {conta} nao esta em `users`.")
        print("Sem isso ela nao emite sessao, e a carteira vincularia a uma conta")
        print("em que ninguem consegue entrar.")
        conn.close()
        return 1

    torneira = conn.execute(
        "SELECT name FROM faucet_registry WHERE wallet_address = ?", (conta,)).fetchone()

    print(f"carteira {args.wallet}")
    print(f"  deriva para {derivada}")
    print(f"  vai vincular a {conta}  ({u['email']})")
    if torneira:
        print(f"\n  ATENCAO: {conta[:14]}… tambem e a torneira registrada \"{torneira['name']}\".")
        print("  A conta passa a ser usuaria da propria torneira. Desde 4 de outubro o")
        print("  saque de si para si e recusado, entao isso nao destroi mais dinheiro --")
        print("  mas o que ela deve a si mesma fica insacavel, porque ja esta no saldo dela.")

    if args.dry_run:
        print("\ndry run: nada foi escrito")
        conn.close()
        return 0

    agora = int(time.time())
    conn.execute(
        "INSERT INTO solana_links (user_address, solana_address, linked_at) VALUES (?, ?, ?)",
        (conta, args.wallet, agora))
    conn.commit()

    # Reler pela mesma funcao que o servidor usa, em vez de confiar no INSERT.
    confere = conn.execute(
        "SELECT user_address FROM solana_links WHERE solana_address = ? ORDER BY linked_at LIMIT 1",
        (args.wallet,)).fetchone()
    conn.close()
    print(f"\n  vinculado. a carteira passa a entrar em {confere['user_address']}")
    return 0 if confere["user_address"] == conta else 1


if __name__ == "__main__":
    sys.exit(main())
