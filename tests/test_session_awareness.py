"""A aplicação saber se a sessão dela ainda vale.

Em 19/10/2026 alguém tentou criar uma bounty e levou "This account acts
through a session. Sign in again: knowing the address is not enough, and never
was." A tela dizia que ele estava logado. O servidor discordava.

Os dois lados estavam errados de jeitos diferentes:

  - a aplicação se declarava logada por achar três strings no localStorage, e
    não tinha como perguntar se o token ainda valia — não existia rota para
    isso;
  - a mensagem era uma nota de quem consertou a falha original, deixada no
    lugar onde o usuário a leria. Ela explica uma decisão de arquitetura para
    quem lê log de segurança, e não diz nada que a pessoa possa fazer.

O que estes checks protegem:

  - a rota diz de quem é o token, ou 401, e nunca distingue vencido de
    inventado — a diferença só interessa a quem está adivinhando;
  - a mensagem de sessão morta diz o que fazer;
  - conta custodial sem sessão continua sendo recusada. O conserto é de
    comunicação, não de permissão.

    .venv/Scripts/python.exe tests/test_session_awareness.py
"""
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-sessao-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

_n = [0]


def conta_custodial():
    """Um endereço cuja chave o servidor guarda, como um convidado.

    É a linha em `users` que define isso — não o formato do endereço. Sem ela,
    require_action_signature cobra assinatura de carteira e o teste mede outro
    caminho.
    """
    _n[0] += 1
    endereco = "0x" + ("%02x" % _n[0]) * 20
    conn = srv.get_db_connection()
    conn.execute("INSERT OR IGNORE INTO users (email, password_hash, wallet_address, "
                 "created_at) VALUES (?, '!', ?, ?)",
                 (f"teste{_n[0]}@local", endereco, int(time.time())))
    conn.commit()
    conn.close()
    return endereco


def sessao(endereco):
    return srv.issue_session(endereco)["session_token"]


# ----------------------------------------------------------- a rota nova

def test_a_rota_diz_de_quem_e_o_token(client):
    endereco = conta_custodial()
    r = client.get("/api/auth/session", headers={"X-Session-Token": sessao(endereco)})
    assert r.status_code == 200, r.text
    assert r.json()["address"] == endereco, r.json()
    assert r.json()["expires_at"] > int(time.time()), r.json()


def test_sem_token_responde_401(client):
    assert client.get("/api/auth/session").status_code == 401


def test_token_inventado_responde_401(client):
    r = client.get("/api/auth/session", headers={"X-Session-Token": "nao-existe"})
    assert r.status_code == 401, r.text


def test_vencido_e_inventado_respondem_igual(client):
    """A diferença só interessa a quem está tentando adivinhar."""
    endereco = conta_custodial()
    token = sessao(endereco)
    conn = srv.get_db_connection()
    conn.execute("UPDATE sessions SET expires_at = ? WHERE token_hash = ?",
                 (int(time.time()) - 10, srv._hash_token(token)))
    conn.commit()
    conn.close()

    vencido = client.get("/api/auth/session", headers={"X-Session-Token": token})
    inventado = client.get("/api/auth/session", headers={"X-Session-Token": "abc"})
    assert vencido.status_code == inventado.status_code == 401
    assert vencido.json()["detail"] == inventado.json()["detail"], (
        vencido.json(), inventado.json())


def test_a_rota_nao_prolonga_a_sessao(client):
    """Conferir não é usar. Senão uma aba aberta renova sozinha para sempre."""
    endereco = conta_custodial()
    token = sessao(endereco)
    primeiro = client.get("/api/auth/session",
                          headers={"X-Session-Token": token}).json()["expires_at"]
    time.sleep(1.1)
    segundo = client.get("/api/auth/session",
                         headers={"X-Session-Token": token}).json()["expires_at"]
    assert primeiro == segundo, (primeiro, segundo)


# ------------------------------------------------------------- a mensagem

def test_a_mensagem_diz_o_que_fazer():
    """Antes ela explicava uma decisão de arquitetura para quem só queria
    continuar o que estava fazendo."""
    from fastapi import HTTPException
    try:
        srv.require_action_signature(conta_custodial(), "msg", None, None, None)
    except HTTPException as e:
        texto = str(e.detail).lower()
        assert e.status_code == 401, e.status_code
        assert "sign in again" in texto, e.detail
        assert "never was" not in texto, "a nota de quem consertou voltou para a tela"
        return
    assert False, "conta custodial sem sessão passou"


# ------------------------------------------ a permissão não foi afrouxada

def test_conta_custodial_sem_sessao_continua_recusada():
    from fastapi import HTTPException
    try:
        srv.require_action_signature(conta_custodial(), "msg", None, None, "token-errado")
        assert False, "passou sem sessão válida"
    except HTTPException as e:
        assert e.status_code == 401


def test_a_sessao_certa_passa():
    endereco = conta_custodial()
    # não levanta: é esse o contrato
    srv.require_action_signature(endereco, "msg", None, None, sessao(endereco))


def test_sessao_de_outra_conta_nao_serve():
    from fastapi import HTTPException
    alheia = sessao(conta_custodial())
    try:
        srv.require_action_signature(conta_custodial(), "msg", None, None, alheia)
        assert False, "a sessão de outra conta passou"
    except HTTPException as e:
        assert e.status_code == 401


if __name__ == "__main__":
    testes = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    import inspect
    falhas = 0
    with TestClient(srv.app) as client:
        for teste in testes:
            try:
                if inspect.signature(teste).parameters:
                    teste(client)
                else:
                    teste()
                print("OK    %s" % teste.__name__)
            except AssertionError as e:
                falhas += 1
                print("FAIL  %s: %s" % (teste.__name__, e))
            except Exception as e:
                falhas += 1
                print("ERRO  %s: %r" % (teste.__name__, e))
    print("\n%d/%d passed (banco temporario em %s)" % (len(testes) - falhas, len(testes), TMP))
    sys.exit(1 if falhas else 0)
