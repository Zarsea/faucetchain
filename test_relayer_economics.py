# -*- coding: utf-8 -*-
"""O subsidio do relayer, medido em vez de descrito.

A documentacao dizia que o relayer paga a taxa e o rent para que ninguem precise
ter SOL para receber o que ganhou, e que o custo disso nao era cobrado de
ninguem nem medido. A segunda metade deixou de ser verdade quando o primeiro
saque real aconteceu e a conta ficou visivel:

    taxa cobrada         85.000 lamports
    relayer gastou    1.573.440 lamports
    diferenca         1.488.440  = o rent de uma conta de token

Noventa e cinco por cento do custo e rent. A taxa, que e o numero que todo mundo
cita quando fala de Solana, e 0,6%.

Isso muda uma decisao de produto: o rent e uma vez por usuario por token e, a
precos de 2026, custa mais do que muitas recompensas individuais valem. Atender
mais gente nao escala com o volume de cliques, escala com o numero de carteiras
novas -- e so a segunda conta importa.

O que este arquivo prende e a aritmetica, nao o preco. Se alguem trocar a conta
por uma estimativa, ou somar errado, o teste cai.

    python test_relayer_economics.py
"""

import os
import shutil
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))

# Os numeros do saque de 1 de outubro, lidos da devnet e nao estimados.
TAXA_COBRADA = 85_000
GASTO_TOTAL = 1_573_440
RENT_REAL = 1_488_440


def main() -> int:
    sys.path.insert(0, ROOT)
    import api_server

    # --- a aritmetica que o endpoint usa --------------------------------
    assert api_server.SOLANA_LAMPORTS_PER_SIGNATURE == 5_000, (
        "a taxa por assinatura na Solana e fixa em 5.000 lamports")
    assert api_server.TOKEN_ACCOUNT_RENT_LAMPORTS == RENT_REAL, (
        "o rent configurado nao e o que a cadeia cobrou: %d contra %d"
        % (api_server.TOKEN_ACCOUNT_RENT_LAMPORTS, RENT_REAL))

    # O saque real fecha: duas assinaturas de taxa base, a prioridade que a
    # carteira escolheu, e o rent. Se esta soma nao bater, a medicao esta
    # descrevendo outra transacao.
    base = api_server.SOLANA_LAMPORTS_PER_SIGNATURE * 2
    prioridade = TAXA_COBRADA - base
    assert base + prioridade + RENT_REAL == GASTO_TOTAL, (
        "a decomposicao nao fecha com o que a cadeia debitou")

    # E a parte que decide: o rent domina de longe.
    assert RENT_REAL / GASTO_TOTAL > 0.9, (
        "se o rent deixar de dominar, a conta de escala muda de forma")

    # --- o endpoint ------------------------------------------------------
    workdir = tempfile.mkdtemp(prefix="fcrelay-")
    os.chdir(workdir)
    api_server.init_settlement_tables()
    api_server.init_faucet_api_keys_table()

    import asyncio
    d = asyncio.run(api_server.relayer_economics())

    for campo in ("withdrawals", "first_time_recipients", "spent_lamports",
                  "spent_rent", "cost_of_next_new_recipient",
                  "new_recipients_affordable"):
        assert campo in d, f"o endpoint perdeu '{campo}'"

    # Um livro vazio nao inventa gasto.
    assert d["withdrawals"] == 0 and d["spent_lamports"] == 0, d

    # O custo do proximo novato e a soma que importa para planejar: rent mais
    # as duas assinaturas. Sem o rent aqui o numero seria 150 vezes otimista.
    assert d["cost_of_next_new_recipient"] == RENT_REAL + 2 * 5_000, d

    # --- com um saque gravado -------------------------------------------
    conn = api_server.get_db_connection()
    conn.execute(
        "INSERT INTO relayer_spend (signature, batch_id, recipient, mint, amount, "
        "base_fee, priority_fee, rent_lamports, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ("sig-teste", 1, "2uVv", "mint", 370305, base, prioridade, RENT_REAL, int(time.time())))
    conn.commit()
    conn.close()

    d = asyncio.run(api_server.relayer_economics())
    assert d["withdrawals"] == 1, d
    assert d["first_time_recipients"] == 1, (
        "um saque que pagou rent e, por definicao, de alguem que nunca recebeu "
        "este token: %r" % d)
    assert d["spent_lamports"] == GASTO_TOTAL, d
    assert d["spent_rent"] == RENT_REAL, d

    # Um segundo saque para quem ja tem conta nao paga rent de novo. Confundir
    # isso faz a projecao de custo crescer com os cliques em vez de com as
    # pessoas, e sao coisas muito diferentes.
    conn = api_server.get_db_connection()
    conn.execute(
        "INSERT INTO relayer_spend (signature, batch_id, recipient, mint, amount, "
        "base_fee, priority_fee, rent_lamports, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        ("sig-teste-2", 2, "2uVv", "mint", 1000, base, 0, 0, int(time.time())))
    conn.commit()
    conn.close()

    d = asyncio.run(api_server.relayer_economics())
    assert d["withdrawals"] == 2, d
    assert d["first_time_recipients"] == 1, (
        "o segundo saque do mesmo usuario foi contado como novo: %r" % d)
    assert d["spent_lamports"] == GASTO_TOTAL + base, d

    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print("test_relayer_economics.py OK")
    print("  rent e %.0f%% do custo de um usuario novo" % (100 * RENT_REAL / GASTO_TOTAL))
    return 0


if __name__ == "__main__":
    sys.exit(main())
