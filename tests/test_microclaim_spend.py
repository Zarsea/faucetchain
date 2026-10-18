"""Gasto de saldo L2 assinado pelo usuario, e o estorno dele.

A chave de API diz qual torneira esta falando. Ela nao pode dizer que o usuario
quis gastar: se vazar, quem a tiver esvazia o saldo de todo mundo. Por isso o
debito exige assinatura da carteira Solana do dono do saldo, e a frase assinada
amarra os cinco campos que importam -- torneira, carteira, item, valor e este
pedido.

O que estes checks protegem, do mais caro para o menos:

  - assinatura que nao diz o valor serve para qualquer valor, e assinatura que
    nao diz a torneira serve em qualquer torneira. Cada linha e conferida;
  - a mesma idempotency_key nunca cobra duas vezes, nem quando dois pedidos
    chegam juntos -- o debito e a linha de idempotencia estao na mesma
    transacao, e separa-los cobraria de novo em cada reenvio por timeout;
  - estornar duas vezes seria imprimir saldo;
  - gastar reduz o que a torneira deve, e portanto a divida que a prova de
    reserva mede.

    .venv/Scripts/python.exe tests/test_microclaim_spend.py
"""
import base64
import os
import secrets
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-spend-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")
os.environ.setdefault("REGISTER_HOURLY_PER_IP", "500")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from solders.keypair import Keypair  # noqa: E402

srv.init_settlement_tables()
srv._migrar_historico_para_compras()

_n = [0]


def _torneira(client):
    """Registra uma torneira e devolve (api_key, faucet_wallet)."""
    _n[0] += 1
    carteira = "0x" + ("%02x" % _n[0]) * 20
    r = client.post("/api/faucethub/register",
                    json={"name": "FaucetHunter", "wallet_address": carteira})
    assert r.status_code == 200, r.text
    return r.json()["api_key"], carteira


def _usuario():
    """Uma carteira Solana de teste, com a chave para assinar."""
    return Keypair()


def _frase(faucet, wallet, item, amount, nonce, ts):
    return "\n".join([
        srv.SPEND_HEADER,
        f"faucet: {faucet.lower()}",
        f"wallet: {wallet}",
        f"item: {item}",
        f"amount: {amount}",
        f"nonce: {nonce}",
        f"timestamp: {ts}",
    ])


def _assinar(kp, frase):
    return base64.b64encode(bytes(kp.sign_message(frase.encode("utf-8")))).decode()


def _corpo(kp, faucet, item="boost_24h", amount=10.0, nonce=None, ts=None,
           amount_enviado=None, frase_amount=None, assinante=None):
    """Monta um pedido coerente; os parametros soltos servem para quebrar um
    campo de cada vez."""
    wallet = str(kp.pubkey())
    nonce = nonce or secrets.token_hex(16)
    ts = ts or int(time.time())
    frase = _frase(faucet, wallet, item, frase_amount if frase_amount is not None else amount,
                   nonce, ts)
    return {
        "user_wallet": wallet,
        "amount": amount_enviado if amount_enviado is not None else amount,
        "item": item,
        "idempotency_key": nonce,
        "message": frase,
        "signature": _assinar(assinante or kp, frase),
        "sig_timestamp": ts,
    }


def _creditar(faucet, kp, quanto):
    """Poe saldo L2 na linha (torneira, usuario), como um claim faria."""
    conta = srv.faucet_user_address(str(kp.pubkey()))
    conn = srv.get_db_connection()
    agora = int(time.time())
    conn.execute("INSERT OR REPLACE INTO microclaims_ledger (faucet_wallet, user_wallet, "
                 "virtual_balance, total_claimed, claim_count, last_claim_at, created_at) "
                 "VALUES (?, ?, ?, ?, 1, ?, ?)",
                 (faucet, conta, quanto, quanto, agora, agora))
    conn.commit()
    conn.close()
    return conta


def _saldo(faucet, conta):
    conn = srv.get_db_connection()
    r = conn.execute("SELECT virtual_balance FROM microclaims_ledger "
                     "WHERE faucet_wallet = ? AND user_wallet = ?", (faucet, conta)).fetchone()
    conn.close()
    return float(r[0]) if r else 0.0


def _gastar(client, chave, corpo):
    return client.post("/api/faucethub/microclaim/spend", json=corpo,
                       headers={"X-Api-Key": chave})


def _estornar(client, chave, nonce, reason="delivery_failed"):
    return client.post("/api/faucethub/microclaim/refund",
                       json={"idempotency_key": nonce, "reason": reason},
                       headers={"X-Api-Key": chave})


# ------------------------------------------------------------ o caminho feliz

def test_gasto_assinado_debita_o_saldo(client):
    chave, faucet = _torneira(client)
    kp = _usuario()
    conta = _creditar(faucet, kp, 50.0)

    r = _gastar(client, chave, _corpo(kp, faucet, amount=10.0))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "spent", r.json()
    assert abs(r.json()["balance"] - 40.0) < 1e-9, r.json()
    assert abs(_saldo(faucet, conta) - 40.0) < 1e-9


def test_o_gasto_entra_no_historico_com_item_e_assinatura(client):
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 50.0)
    corpo = _corpo(kp, faucet, item="nft_card")
    _gastar(client, chave, corpo)

    conn = srv.get_db_connection()
    linha = conn.execute("SELECT * FROM microclaims_history WHERE event_type = 'SPEND' "
                         "AND tx_hash = ?", (corpo["idempotency_key"],)).fetchone()
    conn.close()
    assert linha, "o gasto nao foi registrado"
    assert linha["item"] == "nft_card", dict(linha)
    assert linha["signature"] == corpo["signature"], "a assinatura precisa ficar gravada"


# -------------------------------------------- a frase amarra o que ela promete

def test_valor_diferente_do_assinado_e_recusado(client):
    """Assinatura que nao diz o valor serve para qualquer valor."""
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 50.0)

    r = _gastar(client, chave, _corpo(kp, faucet, amount=10.0, amount_enviado=40.0))
    assert r.status_code == 401, r.text
    assert "signature" in r.json()["detail"].lower(), r.json()


def test_assinatura_de_outra_carteira_e_recusada(client):
    chave, faucet = _torneira(client)
    kp, intruso = _usuario(), _usuario()
    _creditar(faucet, kp, 50.0)

    r = _gastar(client, chave, _corpo(kp, faucet, assinante=intruso))
    assert r.status_code == 401, r.text
    assert "signature" in r.json()["detail"].lower(), r.json()


def test_assinatura_para_outra_torneira_nao_vale_aqui(client):
    """Senao a mesma assinatura gasta o saldo do usuario em qualquer torneira."""
    chave_a, faucet_a = _torneira(client)
    _, faucet_b = _torneira(client)
    kp = _usuario()
    _creditar(faucet_a, kp, 50.0)

    corpo = _corpo(kp, faucet_b)                 # assinou nomeando a torneira B
    r = _gastar(client, chave_a, corpo)          # e apresenta na A
    assert r.status_code == 401, r.text


def test_item_trocado_depois_de_assinar_e_recusado(client):
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 50.0)
    corpo = _corpo(kp, faucet, item="boost_24h")
    corpo["item"] = "nft_card"                   # o texto assinado ainda diz boost

    r = _gastar(client, chave, corpo)
    assert r.status_code == 401, r.text


def test_assinatura_velha_e_recusada(client):
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 50.0)
    velho = int(time.time()) - srv.SIGNATURE_MAX_AGE - 60

    r = _gastar(client, chave, _corpo(kp, faucet, ts=velho))
    assert r.status_code == 401, r.text


def test_endereco_0x_nao_serve_para_assinar(client):
    """Nao ha chave ed25519 contra a qual conferir um endereco 0x."""
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 50.0)
    corpo = _corpo(kp, faucet)
    corpo["user_wallet"] = "0x" + "ab" * 20

    r = _gastar(client, chave, corpo)
    assert r.status_code == 401, r.text


def test_frase_com_linhas_a_menos_e_recusada(client):
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 50.0)
    corpo = _corpo(kp, faucet)
    corpo["message"] = "\n".join(corpo["message"].split("\n")[:-1])

    r = _gastar(client, chave, corpo)
    assert r.status_code == 401, r.text


def test_o_valor_assinado_e_comparado_como_numero(client):
    """10 e 10.0000 sao o mesmo gasto; formatacao de float nao pode recusar."""
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 50.0)

    r = _gastar(client, chave, _corpo(kp, faucet, amount=10.0, frase_amount="10"))
    assert r.status_code == 200, r.text


# ------------------------------------------------------------- idempotencia

def test_a_mesma_chave_nao_cobra_duas_vezes(client):
    chave, faucet = _torneira(client)
    kp = _usuario()
    conta = _creditar(faucet, kp, 50.0)
    corpo = _corpo(kp, faucet, amount=10.0)

    a = _gastar(client, chave, corpo)
    b = _gastar(client, chave, corpo)
    assert a.status_code == 200 and b.status_code == 200, (a.text, b.text)
    assert a.json()["balance"] == b.json()["balance"], (a.json(), b.json())
    assert abs(_saldo(faucet, conta) - 40.0) < 1e-9, "cobrou duas vezes"


def test_chave_de_outra_torneira_nao_e_reusada(client):
    chave_a, faucet_a = _torneira(client)
    chave_b, faucet_b = _torneira(client)
    kp = _usuario()
    _creditar(faucet_a, kp, 50.0)
    _creditar(faucet_b, kp, 50.0)
    corpo = _corpo(kp, faucet_a)
    _gastar(client, chave_a, corpo)

    r = _gastar(client, chave_b, corpo)
    assert r.status_code == 409, r.text


# --------------------------------------------------------------- saldo curto

def test_acima_do_saldo_recusa_com_402_e_diz_o_saldo(client):
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 3.0)

    r = _gastar(client, chave, _corpo(kp, faucet, amount=10.0))
    assert r.status_code == 402, r.text
    corpo = r.json()["detail"]
    assert corpo["detail"] == "insufficient balance", corpo
    assert abs(corpo["balance"] - 3.0) < 1e-9, corpo


def test_recusa_por_saldo_nao_deixa_rastro(client):
    """Nada gasto, nada gravado: senao a chave fica queimada por um erro."""
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 3.0)
    corpo = _corpo(kp, faucet, amount=10.0)
    _gastar(client, chave, corpo)

    conn = srv.get_db_connection()
    n = conn.execute("SELECT COUNT(*) FROM microclaim_spends WHERE idempotency_key = ?",
                     (corpo["idempotency_key"],)).fetchone()[0]
    conn.close()
    assert n == 0, "a chave ficou gravada sem ter havido gasto"


# ------------------------------------------------------------------- estorno

def test_estorno_devolve_o_valor(client):
    chave, faucet = _torneira(client)
    kp = _usuario()
    conta = _creditar(faucet, kp, 50.0)
    corpo = _corpo(kp, faucet, amount=10.0)
    _gastar(client, chave, corpo)

    r = _estornar(client, chave, corpo["idempotency_key"])
    assert r.status_code == 200, r.text
    assert abs(r.json()["refunded"] - 10.0) < 1e-9, r.json()
    assert abs(_saldo(faucet, conta) - 50.0) < 1e-9


def test_estornar_duas_vezes_nao_imprime_saldo(client):
    chave, faucet = _torneira(client)
    kp = _usuario()
    conta = _creditar(faucet, kp, 50.0)
    corpo = _corpo(kp, faucet, amount=10.0)
    _gastar(client, chave, corpo)

    _estornar(client, chave, corpo["idempotency_key"])
    r = _estornar(client, chave, corpo["idempotency_key"])
    assert r.status_code == 200, r.text
    assert abs(_saldo(faucet, conta) - 50.0) < 1e-9, "o segundo estorno creditou de novo"


def test_so_a_torneira_dona_estorna(client):
    chave_a, faucet_a = _torneira(client)
    chave_b, _ = _torneira(client)
    kp = _usuario()
    _creditar(faucet_a, kp, 50.0)
    corpo = _corpo(kp, faucet_a)
    _gastar(client, chave_a, corpo)

    r = _estornar(client, chave_b, corpo["idempotency_key"])
    assert r.status_code == 403, r.text


def test_estorno_de_gasto_que_nao_existe(client):
    chave, _ = _torneira(client)
    r = _estornar(client, chave, secrets.token_hex(16))
    assert r.status_code == 404, r.text


def test_o_estorno_entra_no_historico(client):
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 50.0)
    corpo = _corpo(kp, faucet)
    _gastar(client, chave, corpo)
    _estornar(client, chave, corpo["idempotency_key"])

    conn = srv.get_db_connection()
    linha = conn.execute("SELECT * FROM microclaims_history WHERE event_type = 'REFUND' "
                         "AND tx_hash = ?", (corpo["idempotency_key"],)).fetchone()
    conn.close()
    assert linha, "o estorno nao foi registrado"


# ------------------------------------------------- o gasto mexe na divida

def test_gastar_reduz_o_que_a_torneira_deve(client):
    """O que a prova de reserva mede e isto. Se o gasto nao reduzir a divida,
    a torneira aparece devendo o que ja foi pago em item."""
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 50.0)

    conn = srv.get_db_connection()
    antes = srv.faucet_owed(conn, faucet)
    conn.close()

    _gastar(client, chave, _corpo(kp, faucet, amount=10.0))

    conn = srv.get_db_connection()
    depois = srv.faucet_owed(conn, faucet)
    conn.close()
    assert abs((antes - depois) - 10.0) < 1e-9, (antes, depois)


# ------------------------------------------------------------ portas fechadas

def test_sem_chave_de_api_nao_gasta(client):
    kp = _usuario()
    r = client.post("/api/faucethub/microclaim/spend",
                    json=_corpo(kp, "0x" + "11" * 20))
    assert r.status_code == 401, r.text


def test_chave_invalida_nao_gasta(client):
    _, faucet = _torneira(client)
    kp = _usuario()
    r = _gastar(client, "chave-que-nao-existe", _corpo(kp, faucet))
    assert r.status_code == 401, r.text


def test_valor_nao_positivo_e_recusado(client):
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 50.0)
    for valor in (0.0, -5.0):
        r = _gastar(client, chave, _corpo(kp, faucet, amount=valor))
        assert r.status_code == 400, (valor, r.text)


def test_idempotency_key_fora_do_formato_e_recusada(client):
    chave, faucet = _torneira(client)
    kp = _usuario()
    _creditar(faucet, kp, 50.0)
    corpo = _corpo(kp, faucet, nonce="curta")
    r = _gastar(client, chave, corpo)
    assert r.status_code == 400, r.text


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
            except Exception as e:
                falhas += 1
                print("ERRO  %s: %r" % (teste.__name__, e))
    print("\n%d/%d passed (banco temporario em %s)" % (len(tests) - falhas, len(tests), TMP))
    sys.exit(1 if falhas else 0)
