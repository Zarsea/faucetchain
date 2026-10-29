"""Aposentar uma campanha tem de parar o gotejamento dela.

Não parava. `retired_at` escondia a campanha de `/api/solana/campaigns` e não
tocava em `_campaign_quote`, então uma campanha aposentada que continuasse
inscrita numa torneira seguia creditando a cada clique.

Medido em produção em 27/10/2026, na campanha **690894**: mint
`SysvarC1ock11111111111111111111111111111111`, aposentada com o motivo gravado
no próprio banco -- *"a conta existe mas pertence a Sysvar..., nao a um
programa de token"* -- e com **1.424.854.745 unidades creditadas** a um único
usuário depois disso, num token que não existe e nunca vai pagar.

O diagnóstico estava certo desde o começo. A torneira é que nunca soube dele.

É o mesmo defeito que deixou 3.400.210.048 unidades impagáveis, visto de outro
ângulo: lá o mint entrou sem conferência (fechado em
`tests/test_campaign_mint_check.py`); aqui o erro foi encontrado, registrado, e
a conta continuou crescendo mesmo assim.

    .venv/Scripts/python.exe tests/test_retired_stops_paying.py
"""
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-retired-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")
os.environ["SETTLEMENT_OPERATOR_TOKEN"] = "token-de-teste"

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402

srv.init_settlement_tables()

CAMPANHA = 880001
TORNEIRA = "0x" + "ab" * 20
USUARIO = "0x" + "cd" * 20
PATROCINADOR = "75vW4HnhtMVcLuHLh3Tm8S1BuFvLVBoLqYoRxQT3SDnE"


def montar(aposentada: bool, motivo: str = None):
    """Campanha com orçamento folgado e uma torneira inscrita."""
    conn = srv.get_db_connection()
    try:
        c = conn.cursor()
        agora = int(time.time())
        for t in ("settlement_campaigns", "campaign_budget", "campaign_faucets",
                  "campaign_traffic", "settlement_rewards"):
            try:
                c.execute(f"DELETE FROM {t} WHERE campaign_id = ?", (CAMPANHA,))
            except Exception:
                pass
        c.execute(
            "INSERT INTO settlement_campaigns "
            "(campaign_id, sponsor, mint, registered_at, retired_at, retired_reason) "
            "VALUES (?, ?, 'M', ?, ?, ?)",
            (CAMPANHA, PATROCINADOR, agora,
             agora if aposentada else None, motivo if aposentada else None))
        c.execute(
            "INSERT INTO campaign_budget (campaign_id, total_budget, monthly_cap, "
            "spent_total, spent_month, funding) "
            "VALUES (?, ?, ?, 0, 0, 'vault')",
            (CAMPANHA, 10**12, 10**11))
        c.execute("INSERT INTO campaign_faucets (campaign_id, faucet_wallet, enrolled_at) "
                  "VALUES (?, ?, ?)", (CAMPANHA, TORNEIRA, agora))
        conn.commit()
    finally:
        conn.close()


def gotejar():
    conn = srv.get_db_connection()
    try:
        creditado, pulado = srv._campaign_drip(conn, TORNEIRA, USUARIO)
        conn.commit()
        return creditado, pulado
    finally:
        conn.close()


def creditado_no_banco():
    conn = srv.get_db_connection()
    try:
        return list(conn.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM settlement_rewards WHERE campaign_id = ?",
            (CAMPANHA,)))[0][0]
    finally:
        conn.close()


# ────────────────────────────────────────────── o defeito, pelo nome

def test_campanha_aposentada_nao_credita():
    montar(aposentada=True, motivo="a conta existe mas pertence a Sysvar, nao a um token")
    creditado, pulado = gotejar()
    assert creditado == [], (
        f"uma campanha aposentada creditou {creditado}: e assim que 690894 "
        "acumulou 1.424.854.745 unidades num mint que e o sysvar Clock")
    assert creditado_no_banco() == 0, "gravou recompensa para campanha aposentada"


def test_a_recusa_diz_que_foi_aposentadoria_e_carrega_o_motivo():
    """Recusa sem motivo manda o parceiro procurar orçamento que não secou."""
    montar(aposentada=True, motivo="mint nao e um mint")
    _, pulado = gotejar()
    assert len(pulado) == 1, f"esperava uma recusa, veio {pulado}"
    assert pulado[0]["reason"] == "retired", pulado[0]
    assert "mint" in pulado[0]["detail"], (
        "o motivo gravado na aposentadoria nao chegou a quem perguntou")


def test_aposentada_tambem_nao_aparece_pagando_na_estimativa():
    """`my-campaigns` usa a mesma funcao com write=False.

    Se a estimativa disser que paga e o claim recusar, a torneira promete ao
    usuario dela um token que nao vem -- que e o pior jeito de errar aqui.
    """
    montar(aposentada=True, motivo="aposentada")
    conn = srv.get_db_connection()
    try:
        pago, recusa = srv._campaign_quote(conn.cursor(), CAMPANHA, int(time.time()),
                                           write=False)
    finally:
        conn.close()
    assert pago is None, "a estimativa prometeu pagamento de campanha aposentada"
    assert recusa["reason"] == "retired"


# ────────────────────────────────────────────── e a campanha viva segue viva

def test_campanha_viva_continua_creditando():
    """O guarda novo nao pode parar quem esta de pe."""
    montar(aposentada=False)
    creditado, pulado = gotejar()
    assert creditado, f"campanha viva parou de pagar; recusas: {pulado}"
    assert creditado[0]["campaign_id"] == CAMPANHA
    assert creditado_no_banco() > 0, "nao gravou a recompensa da campanha viva"


if __name__ == "__main__":
    testes = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    falhas = 0
    for teste in testes:
        try:
            teste()
            print("OK    %s" % teste.__name__)
        except AssertionError as e:
            falhas += 1
            print("FAIL  %s: %s" % (teste.__name__, e))
        except Exception as e:
            falhas += 1
            print("ERRO  %s: %r" % (teste.__name__, e))
    print("\n%d/%d passed" % (len(testes) - falhas, len(testes)))
    sys.exit(1 if falhas else 0)
