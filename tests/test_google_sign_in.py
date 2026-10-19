"""Criar conta e entrar com Google, pelo fluxo de código.

A doutrina do social_auth.py é que nome de provedor não é prova. O Telegram
responde a isso com um HMAC que este servidor refaz sozinho. O Google responde
de outro jeito: o navegador volta carregando um código de uso único, e é ESTE
servidor que troca esse código com o Google por TLS. O que chega veio do
Google para nós, numa conexão que abrimos — nunca esteve na mão do navegador.

Por isso é redirecionamento e não o botão popup. O popup exige o script do
Google na página e `connect-src` aberto para accounts.google.com, e com o
token de sessão no localStorage é `connect-src 'self'` que impede um XSS de
mandá-lo para fora.

O que estes checks protegem:

  - `state` é de uso único. Assinado-mas-repetível deixaria a mesma volta ser
    jogada duas vezes;
  - uma volta sem `state` conhecido não cria conta nenhuma;
  - a identidade é o `sub`, nunca o e-mail: e-mail de conta Google muda, e
    quem herdasse um endereço reciclado herdaria a conta junto;
  - o mesmo Google alcança a mesma conta na segunda vez, em vez de criar
    outra;
  - erro vira redirecionamento de volta para a aplicação, não um JSON de 401
    no meio do caminho.

    .venv/Scripts/python.exe tests/test_google_sign_in.py
"""
import base64
import json
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-google-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")
CID = "cliente-de-teste.apps.googleusercontent.com"
os.environ["GOOGLE_CLIENT_ID"] = CID
os.environ["GOOGLE_CLIENT_SECRET"] = "segredo-de-teste"
os.environ["GOOGLE_REDIRECT_URI"] = "https://teste.local/api/auth/google/callback"

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
import social_auth  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

srv.init_google_states_table()

_n = [0]


def _jwt(claims):
    cab = base64.urlsafe_b64encode(b'{"alg":"RS256"}').decode().rstrip("=")
    corpo = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    return f"{cab}.{corpo}.assinatura-que-este-fluxo-nao-confere"


def _claims(sub="1089", **extra):
    base = {"iss": "https://accounts.google.com", "aud": CID, "sub": sub,
            "exp": int(time.time()) + 600, "email": f"u{sub}@example.com",
            "email_verified": True}
    base.update(extra)
    return base


class GoogleFalso:
    """Substitui o token endpoint. Guarda o que foi enviado, para conferir."""

    def __init__(self, resposta):
        self.resposta = resposta
        self.pedidos = []

    def __call__(self, url, campos):
        self.pedidos.append(campos)
        if isinstance(self.resposta, Exception):
            raise self.resposta
        return self.resposta


def _com_google(resposta):
    """Instala o dublê e devolve ele."""
    falso = GoogleFalso(resposta)
    srv.social_auth._post_form = falso
    return falso


def _restaurar():
    import importlib
    importlib.reload(social_auth)


def _iniciar(client):
    """Faz /start e devolve o state que foi para o Google."""
    r = client.get("/api/auth/google/start", follow_redirects=False)
    assert r.status_code == 302, r.text
    from urllib.parse import urlparse, parse_qs
    q = parse_qs(urlparse(r.headers["location"]).query)
    return q["state"][0], r.headers["location"]


def _voltar(client, state, code="codigo-de-teste"):
    return client.get(f"/api/auth/google/callback?code={code}&state={state}",
                      follow_redirects=False)


def _fragmento(resposta):
    from urllib.parse import parse_qs
    local = resposta.headers.get("location", "")
    return parse_qs(local.split("#", 1)[1]) if "#" in local else {}


# ------------------------------------------------------------------- a ida

def test_a_ida_manda_para_o_google_com_os_campos_certos(client):
    _, destino = _iniciar(client)
    assert destino.startswith("https://accounts.google.com/o/oauth2/v2/auth?"), destino
    for pedaco in ("response_type=code", "scope=openid+email", "prompt=select_account",
                   "client_id=cliente-de-teste"):
        assert pedaco in destino, (pedaco, destino)


def test_cada_ida_tem_um_state_proprio(client):
    a, _ = _iniciar(client)
    b, _ = _iniciar(client)
    assert a != b, "dois logins com o mesmo state"


def test_sem_credencial_a_ida_recusa_em_vez_de_quebrar(client):
    guardado = os.environ.pop("GOOGLE_CLIENT_ID")
    try:
        r = client.get("/api/auth/google/start", follow_redirects=False)
        assert r.status_code == 503, r.status_code
    finally:
        os.environ["GOOGLE_CLIENT_ID"] = guardado


# ----------------------------------------------------------------- a volta

def test_a_volta_cria_a_conta_e_devolve_sessao(client):
    state, _ = _iniciar(client)
    _com_google({"id_token": _jwt(_claims(sub="2001"))})
    r = _voltar(client, state)

    assert r.status_code == 302, r.text
    f = _fragmento(r)
    assert f.get("google") == ["ok"], f
    assert f["address"][0].startswith("0x"), f
    assert f["session_token"][0], f
    # e a sessao vale: o servidor reconhece quem e
    assert srv.session_holder(f["session_token"][0]) == f["address"][0]


def test_o_mesmo_google_alcanca_a_mesma_conta(client):
    enderecos = []
    for _ in range(2):
        state, _ = _iniciar(client)
        _com_google({"id_token": _jwt(_claims(sub="3001"))})
        enderecos.append(_fragmento(_voltar(client, state))["address"][0])
    assert enderecos[0] == enderecos[1], enderecos


def test_googles_diferentes_nao_colidem(client):
    enderecos = []
    for sub in ("4001", "4002"):
        state, _ = _iniciar(client)
        _com_google({"id_token": _jwt(_claims(sub=sub))})
        enderecos.append(_fragmento(_voltar(client, state))["address"][0])
    assert enderecos[0] != enderecos[1], enderecos


def test_a_identidade_e_o_sub_e_nao_o_email(client):
    """E-mail de conta Google muda; quem herdasse um endereço reciclado
    herdaria a conta junto."""
    state, _ = _iniciar(client)
    _com_google({"id_token": _jwt(_claims(sub="5001", email="antigo@example.com"))})
    primeiro = _fragmento(_voltar(client, state))["address"][0]

    state, _ = _iniciar(client)
    _com_google({"id_token": _jwt(_claims(sub="5001", email="novo@example.com"))})
    segundo = _fragmento(_voltar(client, state))["address"][0]
    assert primeiro == segundo, "trocar de e-mail mudou a conta"


# -------------------------------------------------------------- o state

def test_o_state_e_de_uso_unico(client):
    state, _ = _iniciar(client)
    _com_google({"id_token": _jwt(_claims(sub="6001"))})
    primeiro = _voltar(client, state)
    assert _fragmento(primeiro).get("google") == ["ok"]

    segundo = _voltar(client, state)
    assert _fragmento(segundo).get("google") == ["expired"], _fragmento(segundo)


def test_volta_com_state_desconhecido_nao_cria_conta(client):
    falso = _com_google({"id_token": _jwt(_claims(sub="7001"))})
    r = _voltar(client, "state-que-ninguem-emitiu")
    assert _fragmento(r).get("google") == ["expired"], _fragmento(r)
    assert falso.pedidos == [], "trocou o código sem reconhecer a volta"


def test_state_vencido_e_recusado(client):
    state, _ = _iniciar(client)
    conn = srv.get_db_connection()
    conn.execute("UPDATE google_states SET created_at = ? WHERE state = ?",
                 (int(time.time()) - srv.GOOGLE_STATE_TTL - 10, state))
    conn.commit()
    conn.close()

    _com_google({"id_token": _jwt(_claims(sub="8001"))})
    assert _fragmento(_voltar(client, state)).get("google") == ["expired"]


# ------------------------------------------------- o que o Google devolve

def test_token_para_outro_cliente_e_recusado(client):
    state, _ = _iniciar(client)
    _com_google({"id_token": _jwt(_claims(sub="9001", aud="outro.apps.googleusercontent.com"))})
    assert _fragmento(_voltar(client, state)).get("google") == ["failed"]


def test_emissor_trocado_e_recusado(client):
    state, _ = _iniciar(client)
    _com_google({"id_token": _jwt(_claims(sub="9002", iss="https://accounts.evil.test"))})
    assert _fragmento(_voltar(client, state)).get("google") == ["failed"]


def test_token_expirado_e_recusado(client):
    state, _ = _iniciar(client)
    _com_google({"id_token": _jwt(_claims(sub="9003", exp=int(time.time()) - 5))})
    assert _fragmento(_voltar(client, state)).get("google") == ["failed"]


def test_codigo_ja_usado_nao_vira_conta(client):
    state, _ = _iniciar(client)
    _com_google({"error": "invalid_grant"})
    assert _fragmento(_voltar(client, state)).get("google") == ["failed"]


# ------------------------------------------------------ a volta é amigável

def test_cancelar_no_google_volta_para_a_aplicacao(client):
    r = client.get("/api/auth/google/callback?error=access_denied",
                   follow_redirects=False)
    assert r.status_code == 302, r.status_code
    assert _fragmento(r).get("google") == ["cancelled"], _fragmento(r)


def test_erro_nunca_vira_json_de_api(client):
    """Quem clicou em entrar espera voltar para o site, não para um 401."""
    for alvo in ("/api/auth/google/callback",
                 "/api/auth/google/callback?error=access_denied",
                 "/api/auth/google/callback?code=x&state=inexistente"):
        r = client.get(alvo, follow_redirects=False)
        assert r.status_code == 302, (alvo, r.status_code)
        assert r.headers["location"].startswith("/#"), (alvo, r.headers["location"])


if __name__ == "__main__":
    testes = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    falhas = 0
    with TestClient(srv.app) as client:
        for teste in testes:
            try:
                teste(client)
                print("OK    %s" % teste.__name__)
            except AssertionError as e:
                falhas += 1
                print("FAIL  %s: %s" % (teste.__name__, e))
            except Exception as e:
                falhas += 1
                print("ERRO  %s: %r" % (teste.__name__, e))
    print("\n%d/%d passed (banco temporario em %s)" % (len(testes) - falhas, len(testes), TMP))
    sys.exit(1 if falhas else 0)
