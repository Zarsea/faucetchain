"""As mensagens de erro da API, que são o que o usuário lê quando algo falha.

Em 19/10/2026 um claim recusado disse "Transaction rejected by PoC Manager."
O PoC não tinha nada a ver: a tela jogava fora o motivo do servidor e escrevia
essa frase para qualquer recusa que não fosse 429 — e um 429 virava "cooldown
de 1 hora" mesmo quando era o teto de carteiras por IP.

Consertar isso trouxe à tona 39 mensagens em português que agora chegam na
tela. A varredura de DOM não as tinha pego, e não tinha como: caminho de erro
não renderiza em operação normal.

O que estes checks protegem:

  - mensagem que chega ao usuário está em inglês. A submissão é em inglês e o
    público é global;
  - cada recusa do claim tem motivo próprio. "Falhou" não diz a ninguém o que
    fazer, e as cinco recusas dessa rota pedem cinco ações diferentes;
  - o motivo não some: o servidor responde com `detail`, que é de onde a tela
    tira o que mostrar.

    .venv/Scripts/python.exe tests/test_error_messages.py
"""
import io
import os
import re
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-erros-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

FONTE = io.open(os.path.join(ROOT, "api_server.py"), encoding="utf-8").read()

# Palavras que só aparecem numa frase em português. Nomes de variável como
# `minimo` ou `retidos` ficam de fora de propósito: eles vivem dentro de
# mensagens que já estão em inglês, e bani-los seria renomear código para
# satisfazer um teste de texto.
PT = re.compile(
    r"[ãõçáàâéêíóôúÃÕÇÁÀÂÉÊÍÓÔÚ]|\b(nao|não|sao|são|voce|você|carteira|torneira|"
    r"saldo|limite|ativa|atividade|suspeita|bloqueado|invalido|inválido|endereco|"
    r"endereço|usuario|usuário|sessao|sessão|tentativas|aguarde|falha|erro|"
    r"insuficiente|obrigatório|obrigatorio|encontrada|encontrado)\b", re.I)


def _detalhes_no_fonte():
    """Todo `detail=` literal do servidor, com a linha onde está."""
    for m in re.finditer(r'detail\s*=\s*\(?\s*\n?\s*(f?)(["\'])(.*?)\2', FONTE, re.S):
        yield FONTE[:m.start()].count("\n") + 1, m.group(3)


def test_nenhuma_mensagem_de_erro_em_portugues():
    """Esta submissão é em inglês e o público é global. Um erro em português é
    a única parte do produto que fala outra língua — e só aparece na hora em
    que a pessoa já está confusa."""
    ruins = [(l, t) for l, t in _detalhes_no_fonte() if PT.search(t)]
    assert not ruins, "mensagens em português:\n" + "\n".join(
        f"  api_server.py:{l}  {t[:88]}" for l, t in ruins)


def test_as_recusas_do_claim_tem_motivos_diferentes():
    """Cinco recusas que pedem cinco ações diferentes não podem dizer a mesma
    coisa. Era isso que a tela fazia, e foi o que trouxe este arquivo."""
    inicio = FONTE.index('@app.post("/api/claim")')
    trecho = FONTE[inicio:inicio + 6000]
    motivos = {t for _, t in _detalhes_no_fonte()
               if t in trecho}
    assert len(motivos) >= 4, f"só {len(motivos)} motivos distintos: {motivos}"


def test_cada_recusa_diz_o_que_aconteceu(client):
    """Resposta de erro sem `detail` deixa a tela sem nada para mostrar."""
    r = client.post("/api/claim", json={"user_address": "nao-e-endereco",
                                        "block_height": 1, "tx_hash": "0x0"})
    assert r.status_code >= 400, r.status_code
    corpo = r.json()
    assert "detail" in corpo, corpo
    assert str(corpo["detail"]).strip(), "detail vazio"


def test_o_motivo_e_texto_que_da_para_mostrar(client):
    """detail precisa ser string ou algo com mensagem dentro — a tela escreve
    o que vier ali."""
    r = client.post("/api/claim", json={"user_address": "0x" + "ab" * 20,
                                        "block_height": 1, "tx_hash": "0x0"})
    d = r.json().get("detail")
    assert isinstance(d, (str, dict, list)), type(d)
    if isinstance(d, str):
        assert len(d) > 8, d


def test_a_tela_do_faucet_nao_inventa_mais_o_motivo():
    """O conserto do lado do navegador, preso aqui para não voltar."""
    tela = io.open(os.path.join(ROOT, "components", "Faucet.tsx"),
                   encoding="utf-8").read()
    # O que importa é o que a tela LANÇA, não o que ela menciona: o comentário
    # que explica este conserto cita a frase antiga, e deve poder citar.
    lancadas = re.findall(r"throw new Error\((['\"`])(.*?)\1", tela)
    assert not any("PoC Manager" in t for _, t in lancadas), \
        "a frase que nomeava o PoC para qualquer falha voltou a ser lançada"
    assert "corpo?.detail" in tela or "corpo.detail" in tela, \
        "a tela precisa ler o motivo que o servidor mandou"


if __name__ == "__main__":
    import inspect
    testes = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    falhas = 0
    with TestClient(srv.app) as client:
        for teste in testes:
            try:
                teste(client) if inspect.signature(teste).parameters else teste()
                print("OK    %s" % teste.__name__)
            except AssertionError as e:
                falhas += 1
                print("FAIL  %s: %s" % (teste.__name__, e))
            except Exception as e:
                falhas += 1
                print("ERRO  %s: %r" % (teste.__name__, e))
    print("\n%d/%d passed" % (len(testes) - falhas, len(testes)))
    sys.exit(1 if falhas else 0)
