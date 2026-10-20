"""Vincular e desvincular o Google numa conta que já existe.

Entrar com Google cria conta. Isto é outra coisa: a pessoa já tem conta aqui,
e escolhe prender o Google a ela. É escolha, não passo de fluxo — por isso
mora numa tela de privacidade e não solta no meio de outra coisa.

As três regras que doem se estiverem erradas:

  - vincular exige a sessão da conta alvo. Sem isso, qualquer um prende o
    próprio Google numa conta alheia e passa a entrar nela;
  - um Google já preso a OUTRA conta não é movido em silêncio. Mover tiraria a
    entrada daquela conta e daria o acesso a esta;
  - desligar a última porta de entrada tranca a pessoa do lado de fora para
    sempre. Não há recuperação de senha para uma conta de que ninguém tem
    segunda chave.

    .venv/Scripts/python.exe tests/test_google_link.py
"""
import base64
import json
import os
import sys
import tempfile
import time
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-vinculo-")
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
from fastapi.testclient import TestClient  # noqa: E402

srv.init_google_states_table()
srv._migrar_google_states()

_n = [0]


def conta(com_senha=True):
    """Uma conta que já existe. Com senha, ela tem duas portas depois do
    vínculo — que é o caso normal e o que permite desvincular."""
    _n[0] += 1
    endereco = "0x" + ("%02x" % _n[0]) * 20
    conn = srv.get_db_connection()
    conn.execute("INSERT OR IGNORE INTO users (email, password_hash, wallet_address, "
                 "created_at) VALUES (?, ?, ?, ?)",
                 (f"u{_n[0]}@local", "hash-de-senha" if com_senha else "!",
                  endereco, int(time.time())))
    conn.commit()
    conn.close()
    return endereco, srv.issue_session(endereco)["session_token"]


def jwt(sub):
    c = {"iss": "https://accounts.google.com", "aud": CID, "sub": sub,
         "exp": int(time.time()) + 600, "email": f"u{sub}@example.com",
         "email_verified": True}
    cab = base64.urlsafe_b64encode(b'{"alg":"RS256"}').decode().rstrip("=")
    corpo = base64.urlsafe_b64encode(json.dumps(c).encode()).decode().rstrip("=")
    return f"{cab}.{corpo}.nao-conferida-neste-fluxo"


def google_responde(sub):
    srv.social_auth._post_form = lambda url, campos: {"id_token": jwt(sub)}


def iniciar_vinculo(client, token):
    r = client.get("/api/auth/google/start?link=1",
                   headers={"X-Session-Token": token}, follow_redirects=False)
    assert r.status_code == 302, r.text
    return parse_qs(urlparse(r.headers["location"]).query)["state"][0]


def voltar(client, state, code="cod"):
    r = client.get(f"/api/auth/google/callback?code={code}&state={state}",
                   follow_redirects=False)
    local = r.headers.get("location", "")
    return parse_qs(local.split("#", 1)[1]) if "#" in local else {}


def identidades(client, token):
    return client.get("/api/account/identities",
                      headers={"X-Session-Token": token}).json()


# --------------------------------------------------------------- vincular

def test_vincular_prende_o_google_a_conta_que_pediu(client):
    endereco, token = conta()
    google_responde("10001")
    assert voltar(client, iniciar_vinculo(client, token)).get("google") == ["linked"]

    d = identidades(client, token)
    assert d["google"]["linked"] is True, d
    assert "google" in d["sign_in_methods"], d


def test_vincular_sem_sessao_e_recusado(client):
    """Senão qualquer um prende o próprio Google numa conta alheia."""
    r = client.get("/api/auth/google/start?link=1", follow_redirects=False)
    assert r.status_code == 401, r.status_code


def test_sessao_invalida_nao_vincula(client):
    r = client.get("/api/auth/google/start?link=1",
                   headers={"X-Session-Token": "nao-existe"}, follow_redirects=False)
    assert r.status_code == 401, r.status_code


def test_vincular_de_novo_o_mesmo_google_nao_duplica(client):
    endereco, token = conta()
    google_responde("10002")
    voltar(client, iniciar_vinculo(client, token))
    segunda = voltar(client, iniciar_vinculo(client, token))
    assert segunda.get("google") == ["already_linked"], segunda
    assert identidades(client, token)["sign_in_methods"].count("google") == 1


def test_google_de_outra_conta_nao_e_movido(client):
    """Mover tiraria a entrada da outra conta e daria o acesso a esta."""
    _, token_a = conta()
    _, token_b = conta()
    google_responde("10003")
    voltar(client, iniciar_vinculo(client, token_a))

    resposta = voltar(client, iniciar_vinculo(client, token_b))
    assert resposta.get("google") == ["taken"], resposta
    # a primeira continua com o dela
    assert identidades(client, token_a)["google"]["linked"] is True
    assert identidades(client, token_b)["google"]["linked"] is False


def test_o_vinculo_nao_cria_conta_nova(client):
    endereco, token = conta()
    antes = srv.get_db_connection().execute("SELECT COUNT(*) FROM users").fetchone()[0]
    google_responde("10004")
    voltar(client, iniciar_vinculo(client, token))
    depois = srv.get_db_connection().execute("SELECT COUNT(*) FROM users").fetchone()[0]
    assert antes == depois, (antes, depois)


def test_entrar_com_o_google_vinculado_cai_na_conta_certa(client):
    """É o ponto do vínculo: o Google passa a alcançar ESTA conta."""
    endereco, token = conta()
    google_responde("10005")
    voltar(client, iniciar_vinculo(client, token))

    # agora um login comum, sem link=1
    r = client.get("/api/auth/google/start", follow_redirects=False)
    state = parse_qs(urlparse(r.headers["location"]).query)["state"][0]
    f = voltar(client, state)
    assert f.get("google") == ["ok"], f
    assert f["address"][0] == endereco, (f["address"][0], endereco)


# ------------------------------------------------------------ desvincular

def test_desvincular_funciona_quando_ha_outra_porta(client):
    endereco, token = conta(com_senha=True)
    google_responde("10006")
    voltar(client, iniciar_vinculo(client, token))

    r = client.delete("/api/auth/google/link", headers={"X-Session-Token": token})
    assert r.status_code == 200, r.text
    assert identidades(client, token)["google"]["linked"] is False


def test_desvincular_a_ultima_porta_e_recusado(client):
    """Não há recuperação de senha para uma conta de que ninguém tem segunda
    chave. Obedecer aqui trancaria a pessoa para sempre."""
    endereco, token = conta(com_senha=False)
    google_responde("10007")
    voltar(client, iniciar_vinculo(client, token))

    d = identidades(client, token)
    assert d["google"]["can_unlink"] is False, d

    r = client.delete("/api/auth/google/link", headers={"X-Session-Token": token})
    assert r.status_code == 409, r.text
    assert "only way" in r.json()["detail"].lower(), r.json()
    assert identidades(client, token)["google"]["linked"] is True, "desvinculou mesmo assim"


def test_desvincular_sem_vinculo_responde_404(client):
    _, token = conta()
    r = client.delete("/api/auth/google/link", headers={"X-Session-Token": token})
    assert r.status_code == 404, r.text


def test_desvincular_sem_sessao_e_recusado(client):
    assert client.delete("/api/auth/google/link").status_code == 401


def test_desvincular_nao_mexe_na_conta_dos_outros(client):
    _, token_a = conta()
    _, token_b = conta()
    google_responde("10008")
    voltar(client, iniciar_vinculo(client, token_a))
    google_responde("10009")
    voltar(client, iniciar_vinculo(client, token_b))

    client.delete("/api/auth/google/link", headers={"X-Session-Token": token_a})
    assert identidades(client, token_b)["google"]["linked"] is True


# ------------------------------------------------------------ privacidade

def test_identidades_so_falam_da_propria_conta(client):
    """Deixar consultar o alheio viraria um diretório de quem usa Google aqui
    — o oposto do que uma tela de privacidade constrói."""
    assert client.get("/api/account/identities").status_code == 401
    assert client.get("/api/account/identities",
                      headers={"X-Session-Token": "inventado"}).status_code == 401


def test_a_resposta_nao_entrega_o_identificador_do_google(client):
    """A tela precisa saber SE está vinculado, não qual é o sub."""
    endereco, token = conta()
    google_responde("10010")
    voltar(client, iniciar_vinculo(client, token))

    bruto = client.get("/api/account/identities",
                       headers={"X-Session-Token": token}).text
    assert "10010" not in bruto, bruto


def test_o_email_real_nao_e_guardado(client):
    """A tela diz que o e-mail não é armazenado. Isto é o que torna a frase
    verdadeira."""
    endereco, token = conta()
    google_responde("10011")
    voltar(client, iniciar_vinculo(client, token))

    conn = srv.get_db_connection()
    linha = conn.execute("SELECT email FROM users WHERE wallet_address = ?",
                         (endereco,)).fetchone()
    conn.close()
    assert "@example.com" not in (linha["email"] or ""), linha["email"]


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
