# -*- coding: utf-8 -*-
"""Junta registracoes duplicadas de uma torneira, sem apagar o que ela deve.

A FaucetHunter acabou registrada tres vezes. A primeira foi aberta digitando um
endereco cuja chave ninguem tem, entao ela nao consegue nem rotacionar a propria
chave de API; a segunda ficou na carteira do no; a terceira e a que a ponte
chama hoje, e e a que tem caucao na tesouraria e campanhas matriculadas.

As duas velhas devem $CLAIM a usuarios de verdade. Aposentar uma torneira
apagando a divida dela e a coisa errada duas vezes: o usuario clicou e ganhou,
e o painel passaria a mostrar uma rede que deve menos do que deve. Entao a
divida muda de torneira junto -- e na torneira viva ela fica atras de uma
caucao, que e mais do que ela tinha antes.

Colisao acontece: um usuario que clicou nas duas registracoes tem linha em cada,
e a chave (faucet_wallet, user_wallet) e unica. As duas linhas viram uma, com os
totais somados e o cooldown mais recente das duas, que e o conservador -- o
frouxo daria um claim de graca a quem acabou de clicar.

    python scripts/merge_faucet_registrations.py                # so mostra
    python scripts/merge_faucet_registrations.py --apply        # grava
"""

import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "blockchain.db")

VIVA = "0x7dda72ad9ad56ce3d031ee6a62b5b94dd40c6ef3"
APOSENTAR = (
    "0x7a9c4b1e8f3d6a2c5b0e9f4d7a1c8b3e6f2d5a09",
    "0xb3dff5d3f802ebba471c2498f223c52b8f7d5ad5",
)


def main() -> int:
    aplicar = "--apply" in sys.argv
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    viva = c.execute("SELECT name FROM faucet_registry WHERE wallet_address = ?", (VIVA,)).fetchone()
    if not viva:
        print("A torneira de destino nao esta registrada. Nada a fazer.")
        return 1

    print("destino: %s  (%s)\n" % (VIVA, viva["name"]))

    # O ensaio tem de prever o efeito das proprias linhas anteriores. Um usuario
    # que clicou nas duas registracoes velhas aparece em ambas: a primeira muda
    # de torneira, e a segunda ja encontra a linha la e funde. Sem este conjunto
    # o ensaio anunciava duas mudancas e o --apply fazia uma mudanca e uma fusao,
    # que e um ensaio dizendo uma coisa e o comando fazendo outra.
    ja_na_viva = {r[0] for r in c.execute(
        "SELECT user_wallet FROM microclaims_ledger WHERE faucet_wallet = ?", (VIVA,))}

    movidas = fundidas = 0
    total = 0.0
    for velha in APOSENTAR:
        reg = c.execute("SELECT name FROM faucet_registry WHERE wallet_address = ?", (velha,)).fetchone()
        if not reg:
            print("%s  ja nao esta no diretorio" % velha[:22])
            continue

        linhas = list(c.execute(
            "SELECT * FROM microclaims_ledger WHERE faucet_wallet = ?", (velha,)))
        devido = sum(r["virtual_balance"] for r in linhas)
        total += devido
        print("%s  (%s)" % (velha[:22], reg["name"]))
        print("   %d usuario(s), devendo %.2f $CLAIM" % (len(linhas), devido))

        for r in linhas:
            existente = c.execute(
                "SELECT * FROM microclaims_ledger WHERE faucet_wallet = ? AND user_wallet = ?",
                (VIVA, r["user_wallet"])).fetchone()
            if existente is None and r["user_wallet"] in ja_na_viva:
                # Movida por uma iteracao anterior deste mesmo ensaio.
                existente = {"virtual_balance": 0.0}
            ja_na_viva.add(r["user_wallet"])
            if existente:
                fundidas += 1
                print("      %s  %.2f  -> funde com %.2f que ja existe"
                      % (r["user_wallet"][:16], r["virtual_balance"], existente["virtual_balance"]))
                if aplicar:
                    c.execute(
                        """UPDATE microclaims_ledger
                              SET virtual_balance = virtual_balance + ?,
                                  total_claimed   = total_claimed + ?,
                                  total_withdrawn = total_withdrawn + ?,
                                  claim_count     = claim_count + ?,
                                  last_claim_at   = MAX(COALESCE(last_claim_at, 0), ?)
                            WHERE faucet_wallet = ? AND user_wallet = ?""",
                        (r["virtual_balance"], r["total_claimed"], r["total_withdrawn"],
                         r["claim_count"], r["last_claim_at"] or 0, VIVA, r["user_wallet"]))
                    c.execute("DELETE FROM microclaims_ledger WHERE id = ?", (r["id"],))
            else:
                movidas += 1
                print("      %s  %.2f  -> muda de torneira"
                      % (r["user_wallet"][:16], r["virtual_balance"]))
                if aplicar:
                    c.execute("UPDATE microclaims_ledger SET faucet_wallet = ? WHERE id = ?",
                              (VIVA, r["id"]))

        if aplicar:
            # O historico segue a divida, senao o extrato do usuario aponta para
            # uma torneira que o diretorio nao lista mais.
            c.execute("UPDATE microclaims_history SET faucet_wallet = ? WHERE faucet_wallet = ?",
                      (VIVA, velha))
            c.execute("UPDATE faucet_api_keys SET is_active = 0 WHERE faucet_wallet = ?", (velha,))
            c.execute("DELETE FROM faucet_registry WHERE wallet_address = ?", (velha,))
        print()

    print("%d linha(s) mudam de torneira, %d se fundem, %.2f $CLAIM no total." %
          (movidas, fundidas, total))

    if aplicar:
        conn.commit()
        caucao = c.execute("SELECT COALESCE(SUM(amount),0) FROM faucet_reserves WHERE faucet_wallet = ?",
                           (VIVA,)).fetchone()[0]
        devendo = c.execute("SELECT COALESCE(SUM(virtual_balance),0) FROM microclaims_ledger WHERE faucet_wallet = ?",
                            (VIVA,)).fetchone()[0]
        print("\nFeito. A torneira viva deve %.2f e tem %.2f caucionados." % (devendo, caucao))
        if caucao + 1e-9 < devendo:
            print("AVISO: a caucao nao cobre a divida herdada. Trave mais no FaucetHub.")
        print("As chaves de API das aposentadas foram desativadas: se alguma ainda")
        print("estiver num arquivo de configuracao em producao, aquele claim passa a")
        print("responder 401 em vez de creditar numa torneira que nao existe mais.")
    else:
        print("\nEnsaio. Rode com --apply para gravar.")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
