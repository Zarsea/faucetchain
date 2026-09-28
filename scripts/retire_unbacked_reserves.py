# -*- coding: utf-8 -*-
"""Zera as reservas declaradas antes de a declaracao mover dinheiro.

A reserva nasceu como afirmacao assinada: o dono dizia um numero, o painel punha
o saldo do lado, e nada saia da carteira. No dia seguinte a declaracao passou a
travar de verdade -- o valor vai para a tesouraria e e de la que o usuario e
pago -- e as linhas escritas sob a regra antiga ficaram com os numeros delas.
Uma torneira aparecia com 1.000 caucionados contra uma tesouraria que tinha
zero.

Ninguem sacou, entao nada foi cunhado do nada. O unico motivo e que os valores
devidos estavam abaixo do minimo de saque.

Este script nao converte a declaracao em caucao. Converter significaria mover
$CLAIM da carteira de alguem sem a assinatura dessa pessoa, e a assinatura e a
unica coisa que autoriza mover dinheiro aqui -- a propria sentenca que o dono
assina hoje diz que o valor sai do saldo dele. Entao a linha antiga e zerada, e
quem quiser caucionar assina de novo, sob a regra que esta escrita na tela.

    python scripts/retire_unbacked_reserves.py            # so mostra
    python scripts/retire_unbacked_reserves.py --apply    # grava
"""

import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "blockchain.db")


def main() -> int:
    aplicar = "--apply" in sys.argv
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    try:
        linhas = list(conn.execute(
            "SELECT faucet_wallet, amount, declared_at FROM faucet_reserves WHERE amount > 0"))
    except sqlite3.OperationalError:
        print("nenhuma tabela faucet_reserves nesta instalacao")
        return 0

    orfas = []
    for linha in linhas:
        w = linha["faucet_wallet"]
        travou = conn.execute(
            "SELECT COALESCE(SUM(value), 0) FROM transactions "
            "WHERE from_address = ? AND tx_type = 'RESERVE_LOCK'", (w,)).fetchone()[0]
        devolveu = conn.execute(
            "SELECT COALESCE(SUM(value), 0) FROM transactions "
            "WHERE to_address = ? AND tx_type = 'RESERVE_RELEASE'", (w,)).fetchone()[0]
        real = float(travou or 0) - float(devolveu or 0)
        if abs(float(linha["amount"]) - real) > 1e-6:
            devido = conn.execute(
                "SELECT COALESCE(SUM(virtual_balance), 0) FROM microclaims_ledger "
                "WHERE faucet_wallet = ?", (w,)).fetchone()[0]
            orfas.append((w, float(linha["amount"]), real, float(devido or 0)))

    if not orfas:
        print("todas as reservas batem com o que foi transferido")
        return 0

    print("Reservas sem lastro:\n")
    for w, declarado, real, devido in orfas:
        print("  %s" % w)
        print("     mostra caucionado  %10.4f" % declarado)
        print("     transferido mesmo  %10.4f" % real)
        print("     deve aos usuarios  %10.4f" % devido)
        if devido > 0:
            print("     -> zerar deixa esta torneira descoberta na tela, que e a verdade")
        print()

    if not aplicar:
        print("Ensaio. Rode com --apply para gravar.")
        return 0

    for w, _declarado, real, _devido in orfas:
        conn.execute("UPDATE faucet_reserves SET amount = ? WHERE faucet_wallet = ?", (real, w))
    conn.commit()
    print("%d linha(s) ajustada(s) para o que a tesouraria realmente guarda." % len(orfas))
    print("Quem quiser caucionar assina de novo no FaucetHub.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
