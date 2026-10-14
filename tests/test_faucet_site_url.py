"""O caminho de volta ate a torneira: do registro ate o card de saldo.

O painel mostrava os fundos da torneira e o usuario nao tinha como chegar la
para claimar. A tela so sabia dizer "abaixo do minimo" e parar ai, porque o
registro nunca guardou uma URL. Estes checks cobrem a volta inteira.

    .venv/Scripts/python.exe tests/test_faucet_site_url.py
"""
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-url-")
os.chdir(TMP)  # api_server abre 'blockchain.db' relativo ao cwd
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

SITE = "https://faucethunter.net"

# Um par novo por teste. O banco e o mesmo para todos, entao reusar o endereco
# faria o segundo registro bater em IntegrityError -- e o cooldown do microclaim,
# que e por par (torneira, usuario), vazaria de um teste para o seguinte.
_n = [0]


def _par():
    _n[0] += 1
    s = "%02x" % _n[0]
    return "0x" + s * 20, "0x" + "cd" + s * 19


def _torneira(client, site_url=SITE):
    """Registra uma torneira nova e devolve (api_key, torneira, usuario)."""
    torneira, usuario = _par()
    corpo = {"name": "FaucetHunter", "wallet_address": torneira}
    if site_url is not None:
        corpo["site_url"] = site_url
    r = client.post("/api/faucethub/register", json=corpo)
    assert r.status_code == 200, r.text
    return r.json()["api_key"], torneira, usuario


def _claim(client, chave, usuario, valor):
    r = client.post("/api/faucethub/microclaim",
                    json={"user_wallet": usuario, "amount": valor},
                    headers={"X-Api-Key": chave})
    assert r.status_code == 200, r.text


def _saldo(client, usuario):
    return client.get("/api/faucethub/microclaim/balance/%s" % usuario).json()["faucets"][0]


def test_a_listagem_devolve_a_url_que_foi_registrada(client):
    _, torneira, _ = _torneira(client)
    linha = [f for f in client.get("/api/faucethub/faucets").json()
             if f["wallet_address"] == torneira][0]
    assert linha["site_url"] == SITE, linha


def test_torneira_sem_url_nao_inventa_uma(client):
    _, torneira, _ = _torneira(client, site_url=None)
    linha = [f for f in client.get("/api/faucethub/faucets").json()
             if f["wallet_address"] == torneira][0]
    # None, e nao string vazia: a tela decide entre link e texto morto por isto
    assert linha["site_url"] is None, linha


def test_url_em_branco_vira_none_e_nao_string_vazia(client):
    _, torneira, _ = _torneira(client, site_url="   ")
    linha = [f for f in client.get("/api/faucethub/faucets").json()
             if f["wallet_address"] == torneira][0]
    assert linha["site_url"] is None, linha


def test_saldo_abaixo_do_minimo_diz_quanto_falta_e_para_onde_ir(client):
    chave, _, usuario = _torneira(client)
    _claim(client, chave, usuario, 1.0)

    e = _saldo(client, usuario)
    assert e["can_withdraw"] is False, e
    assert e["site_url"] == SITE, e
    # o que falta e a diferenca ate o minimo, nao o minimo
    assert abs(e["missing_to_withdraw"] - (srv.MIN_WITHDRAW_AMOUNT - 1.0)) < 1e-9, e


def test_next_claim_at_fica_um_cooldown_depois_do_ultimo_claim(client):
    chave, _, usuario = _torneira(client)
    _claim(client, chave, usuario, 1.0)

    e = _saldo(client, usuario)
    assert e["next_claim_at"] is not None, e
    falta = e["next_claim_at"] - int(time.time())
    assert 0 < falta <= srv.MICROCLAIM_COOLDOWN, falta


def test_quem_ja_pode_sacar_nao_mostra_falta(client):
    chave, _, usuario = _torneira(client)
    _claim(client, chave, usuario, srv.MIN_WITHDRAW_AMOUNT)

    e = _saldo(client, usuario)
    assert e["can_withdraw"] is True, e
    assert e["missing_to_withdraw"] == 0, e


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
    print("\n%d/%d passed (banco temporario em %s)"
          % (len(tests) - falhas, len(tests), TMP))
    sys.exit(1 if falhas else 0)
