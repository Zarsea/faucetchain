"""Claim separado por token de campanha.

A FaucetHunter da um claim por moeda, como faz com as da FaucetPay. A regra
escolhida e que cada token se ganha so pelo claim dele: o claim de moeda e o
de $CLAIM nao pagam campanha, e o claim de campanha nao paga $CLAIM.

Tres coisas aqui valem mais que as outras:

  - o cooldown de campanha e separado do cooldown do $CLAIM, senao um claim de
    moeda bloquearia o claim de token do mesmo minuto;
  - a estimativa de /api/faucethub/my-campaigns sai da mesma conta que credita
    de verdade, senao o numero que o parceiro mostra ao usuario dele diverge
    do que ele recebe;
  - uma torneira sem os campos novos continua se comportando como antes.

    .venv/Scripts/python.exe tests/test_campaign_claim.py
"""
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-campanha-")
os.chdir(TMP)  # api_server abre 'blockchain.db' relativo ao cwd
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")
# Cada teste registra uma torneira nova, e o teto de producao e 10 por hora por
# IP. Sem isto o decimo primeiro teste falha com 429 e parece bug do codigo.
os.environ.setdefault("REGISTER_HOURLY_PER_IP", "500")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

srv.init_settlement_tables()

TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

# Um par novo por teste: o banco e o mesmo para todos, e o cooldown do
# microclaim e por (torneira, usuario).
_n = [0]
_c = [600000]


def _par():
    _n[0] += 1
    s = "%02x" % _n[0]
    return "0x" + s * 20, "0x" + "ef" + s * 19


def _torneira(client):
    """Registra uma torneira nova e devolve (api_key, torneira, usuario)."""
    torneira, usuario = _par()
    r = client.post("/api/faucethub/register",
                    json={"name": "FaucetHunter", "wallet_address": torneira})
    assert r.status_code == 200, r.text
    return r.json()["api_key"], torneira, usuario


def _campanha(simbolo, decimais=6, total=50_000_000_000, teto=10_000_000_000,
              termina=None):
    """Cria campanha + token + orcamento. Devolve o campaign_id."""
    _c[0] += 1
    cid = _c[0]
    mint = "mint%s%s" % (simbolo, cid)
    agora = int(time.time())
    conn = srv.get_db_connection()
    conn.execute("INSERT INTO settlement_campaigns "
                 "(campaign_id, sponsor, mint, registered_at, min_withdraw, name) "
                 "VALUES (?, ?, ?, ?, 0, NULL)", (cid, "SPONSOR", mint, agora))
    conn.execute("INSERT INTO token_registry "
                 "(mint, cluster, name, symbol, decimals, token_program, settleable, added_at) "
                 "VALUES (?, 'devnet', ?, ?, ?, ?, 1, ?)",
                 (mint, "%s Test Token" % simbolo, simbolo, decimais, TOKEN_PROGRAM, agora))
    conn.execute("INSERT INTO campaign_budget "
                 "(campaign_id, total_budget, monthly_cap, spent_total, spent_month, "
                 " month_key, rolled_over, funding, ends_at) "
                 "VALUES (?, ?, ?, 0, 0, ?, 0, 'vault', ?)",
                 (cid, total, teto, srv._month_key(agora), termina))
    conn.commit()
    conn.close()
    return cid


def _inscrever(cid, torneira):
    conn = srv.get_db_connection()
    conn.execute("INSERT OR REPLACE INTO campaign_faucets "
                 "(campaign_id, faucet_wallet, enrolled_at) VALUES (?, ?, ?)",
                 (cid, torneira.lower(), int(time.time())))
    conn.commit()
    conn.close()


def _claim(client, chave, usuario, **extra):
    corpo = {"user_wallet": usuario, "amount": 1.0}
    corpo.update(extra)
    return client.post("/api/faucethub/microclaim", json=corpo,
                       headers={"X-Api-Key": chave})


def _minhas(client, chave):
    return client.get("/api/faucethub/my-campaigns", headers={"X-Api-Key": chave})


# --------------------------------------------------------------- my-campaigns

def test_my_campaigns_lista_as_campanhas_da_chave(client):
    chave, torneira, _ = _torneira(client)
    a = _campanha("FWLT")
    b = _campanha("FHR")
    _inscrever(a, torneira)
    _inscrever(b, torneira)

    r = _minhas(client, chave)
    assert r.status_code == 200, r.text
    simbolos = sorted(c["symbol"] for c in r.json()["campaigns"])
    assert simbolos == ["FHR", "FWLT"], r.json()


def test_my_campaigns_traz_o_que_a_torneira_precisa_para_montar_a_tela(client):
    chave, torneira, _ = _torneira(client)
    cid = _campanha("FWLT", decimais=6)
    _inscrever(cid, torneira)

    c = _minhas(client, chave).json()["campaigns"][0]
    assert c["campaign_id"] == cid, c
    assert c["decimals"] == 6, c
    assert c["funding"] == "vault", c
    assert c["cooldown_seconds"] == srv.MICROCLAIM_COOLDOWN, c
    assert c["status"] == "active", c
    assert c["per_click_estimate"] > 0, c
    # A campanha nasce sem nome proprio; o nome que o usuario reconhece e o do
    # token, e devolver None aqui deixaria a tela do parceiro sem rotulo.
    assert c["name"] == "FWLT Test Token", c


def test_my_campaigns_nao_mostra_campanha_de_outra_torneira(client):
    chave_a, torneira_a, _ = _torneira(client)
    _, torneira_b, _ = _torneira(client)
    cid = _campanha("ALHEIA")
    _inscrever(cid, torneira_b)

    assert _minhas(client, chave_a).json()["campaigns"] == []


def test_my_campaigns_diz_por_que_a_campanha_nao_paga(client):
    chave, torneira, _ = _torneira(client)
    # Janela fechada ontem: o motivo tem que chegar nomeado, nao como lista vazia.
    cid = _campanha("MORTA", termina=int(time.time()) - 86400)
    _inscrever(cid, torneira)

    c = _minhas(client, chave).json()["campaigns"][0]
    assert c["status"] == "window_closed", c
    assert c["per_click_estimate"] == 0, c
    assert c["detail"], c


def test_my_campaigns_exige_chave(client):
    assert client.get("/api/faucethub/my-campaigns").status_code == 401


def test_my_campaigns_nao_vira_o_mes_no_banco(client):
    """Consulta e leitura. Virar o mes porque alguem perguntou e efeito."""
    chave, torneira, _ = _torneira(client)
    cid = _campanha("LEITURA")
    _inscrever(cid, torneira)
    conn = srv.get_db_connection()
    conn.execute("UPDATE campaign_budget SET month_key = '1999-01' WHERE campaign_id = ?", (cid,))
    conn.commit()
    conn.close()

    _minhas(client, chave)

    conn = srv.get_db_connection()
    chave_mes = conn.execute("SELECT month_key FROM campaign_budget WHERE campaign_id = ?",
                             (cid,)).fetchone()[0]
    conn.close()
    assert chave_mes == "1999-01", chave_mes


# ------------------------------------------------------------ campaigns:false

def test_campaigns_false_paga_claim_e_nenhuma_campanha(client):
    chave, torneira, usuario = _torneira(client)
    cid = _campanha("FWLT")
    _inscrever(cid, torneira)

    r = _claim(client, chave, usuario, campaigns=False)
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["credited"] == 1.0, corpo
    assert corpo["campaigns"] == [], corpo
    # Vazia e nao ausente: o parceiro le as duas chaves do mesmo jeito.
    assert corpo["campaigns_skipped"] == [], corpo


def test_campaigns_false_nao_gasta_orcamento_da_campanha(client):
    chave, torneira, usuario = _torneira(client)
    cid = _campanha("FWLT")
    _inscrever(cid, torneira)

    _claim(client, chave, usuario, campaigns=False)

    conn = srv.get_db_connection()
    gasto = conn.execute("SELECT spent_total FROM campaign_budget WHERE campaign_id = ?",
                         (cid,)).fetchone()[0]
    conn.close()
    assert gasto == 0, gasto


# -------------------------------------------------------------- campaign_id

def test_campaign_id_paga_so_aquela_campanha(client):
    chave, torneira, usuario = _torneira(client)
    a = _campanha("FWLT")
    b = _campanha("FHR")
    _inscrever(a, torneira)
    _inscrever(b, torneira)

    r = _claim(client, chave, usuario, campaign_id=a)
    assert r.status_code == 200, r.text
    pagas = [c["campaign_id"] for c in r.json()["campaigns"]]
    assert pagas == [a], r.json()


def test_campaign_id_nao_credita_claim(client):
    chave, torneira, usuario = _torneira(client)
    cid = _campanha("FWLT")
    _inscrever(cid, torneira)

    r = _claim(client, chave, usuario, campaign_id=cid)
    assert r.json()["credited"] == 0.0, r.json()
    # e o saldo virtual nao se mexeu
    saldo = client.get("/api/faucethub/microclaim/balance/%s" % usuario).json()
    assert saldo["total_pending"] == 0, saldo


def test_campaign_id_de_campanha_nao_inscrita_da_400(client):
    chave, torneira, usuario = _torneira(client)
    cid = _campanha("ALHEIA")  # existe, mas esta torneira nao entrou nela

    r = _claim(client, chave, usuario, campaign_id=cid)
    assert r.status_code == 400, r.text
    assert "not enrolled" in r.json()["detail"], r.json()


def test_os_dois_campos_juntos_dao_400(client):
    chave, torneira, usuario = _torneira(client)
    cid = _campanha("FWLT")
    _inscrever(cid, torneira)

    r = _claim(client, chave, usuario, campaign_id=cid, campaigns=False)
    assert r.status_code == 400, r.text


def test_campaign_id_ignora_amount_invalido(client):
    """amount nao tem efeito num clique que nao paga $CLAIM."""
    chave, torneira, usuario = _torneira(client)
    cid = _campanha("FWLT")
    _inscrever(cid, torneira)

    r = _claim(client, chave, usuario, campaign_id=cid, amount=0)
    assert r.status_code == 200, r.text


# ----------------------------------------------------------------- cooldowns

def test_repetir_a_mesma_campanha_antes_do_cooldown_da_429(client):
    chave, torneira, usuario = _torneira(client)
    cid = _campanha("FWLT")
    _inscrever(cid, torneira)

    assert _claim(client, chave, usuario, campaign_id=cid).status_code == 200
    r = _claim(client, chave, usuario, campaign_id=cid)
    assert r.status_code == 429, r.text
    # com os segundos que faltam, nao so "espere"
    assert "Wait" in r.json()["detail"] and "s before" in r.json()["detail"], r.json()


def test_cooldown_de_uma_campanha_nao_bloqueia_outra(client):
    """E a razao de o cooldown ser por campanha, e nao por torneira."""
    chave, torneira, usuario = _torneira(client)
    a = _campanha("FWLT")
    b = _campanha("FHR")
    _inscrever(a, torneira)
    _inscrever(b, torneira)

    assert _claim(client, chave, usuario, campaign_id=a).status_code == 200
    assert _claim(client, chave, usuario, campaign_id=b).status_code == 200


def test_claim_de_campanha_nao_bloqueia_o_claim_de_moeda(client):
    """O claim de token e o de $CLAIM sao claims diferentes, com relogios diferentes."""
    chave, torneira, usuario = _torneira(client)
    cid = _campanha("FWLT")
    _inscrever(cid, torneira)

    assert _claim(client, chave, usuario, campaign_id=cid).status_code == 200
    assert _claim(client, chave, usuario, campaigns=False).status_code == 200


def test_campanha_sem_orcamento_nao_adianta_o_relogio(client):
    """Orcamento vazio e falta do patrocinador. A torneira merece o motivo real,
    na primeira e na segunda tentativa, nao um 429 na segunda."""
    chave, torneira, usuario = _torneira(client)
    cid = _campanha("SECA", termina=int(time.time()) - 86400)
    _inscrever(cid, torneira)

    primeira = _claim(client, chave, usuario, campaign_id=cid)
    assert primeira.status_code == 200, primeira.text
    assert primeira.json()["campaigns_skipped"][0]["reason"] == "window_closed", primeira.json()

    segunda = _claim(client, chave, usuario, campaign_id=cid)
    assert segunda.status_code == 200, segunda.text
    assert segunda.json()["campaigns_skipped"][0]["reason"] == "window_closed", segunda.json()


# ----------------------------------------------------- a conta e uma conta so

def test_a_estimativa_bate_com_o_que_o_claim_paga(client):
    """Se divergirem, quem le a divergencia e o usuario do parceiro."""
    chave, torneira, usuario = _torneira(client)
    cid = _campanha("FWLT")
    _inscrever(cid, torneira)

    estimado = _minhas(client, chave).json()["campaigns"][0]["per_click_estimate"]
    pago = _claim(client, chave, usuario, campaign_id=cid).json()["campaigns"][0]["amount"]
    assert estimado == pago, (estimado, pago)


# ----------------------------------------------- nada muda para quem nao pediu

def test_sem_os_campos_novos_o_claim_continua_pagando_os_dois(client):
    chave, torneira, usuario = _torneira(client)
    cid = _campanha("FWLT")
    _inscrever(cid, torneira)

    r = _claim(client, chave, usuario)
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["credited"] == 1.0, corpo
    assert [c["campaign_id"] for c in corpo["campaigns"]] == [cid], corpo


def test_o_claim_comum_tambem_carimba_o_relogio_da_campanha(client):
    """O carimbo mora onde o pagamento acontece, nao na porta por onde ele entrou."""
    chave, torneira, usuario = _torneira(client)
    cid = _campanha("FWLT")
    _inscrever(cid, torneira)

    assert _claim(client, chave, usuario).status_code == 200
    r = _claim(client, chave, usuario, campaign_id=cid)
    assert r.status_code == 429, r.text


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    falhas = 0
    with TestClient(srv.app) as client:
        for teste in tests:
            try:
                teste(client)
                print("OK    %s" % teste.__name__)
            except AssertionError as e:
                falhas += 1
                print("FAIL  %s: %s" % (teste.__name__, e))
            except Exception as e:  # erro de servidor conta como falha, nao como crash
                falhas += 1
                print("ERRO  %s: %r" % (teste.__name__, e))
    print("\n%d/%d passed (banco temporario em %s)"
          % (len(tests) - falhas, len(tests), TMP))
    sys.exit(1 if falhas else 0)
