"""Quem sacou, montado da cadeia em vez da nossa tabela de assinaturas.

A campanha 711670 tinha 350 pagos segundo a Solana e ZERO linhas em
`relayer_spend`, porque essa tabela so ganha linha quando o nosso relayer
assina e paga a taxa. Quem saca pagando a propria taxa liquida na cadeia sem
passar por este servidor, e sumia da tela de liquidacao.

O dado nunca faltou. O bit do leaf esta ligado na conta da raiz, e a arvore
reconstruida diz de quem e aquele leaf e quanto vale. Faltava cruzar os dois.

`_collected_from_chain` faz esse cruzamento. Estes checks protegem o que ele
promete, em ordem de quanto dói errar:

  - um saque sem assinatura nossa aparece assim mesmo. Era o buraco;
  - nenhuma raiz legivel devolve None, nao lista vazia. Lista vazia ja foi
    lida como "ninguem sacou" uma vez e nao pode voltar a ser;
  - leaf nao sacado nao entra, e lote nao publicado nao conta.

    .venv/Scripts/python.exe tests/test_ledger_collected.py
"""
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-ledger-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402

ANA = "AnaWXv2zweyi4ksi9svMV5xpJYtRhmpFbs7HCMsY1HP"
BENTO = "BentoRsha1wxNDUxvy6Pk2nGgykSxoczgr4eqZL8VwP"


# ─────────────────────────────────────────────────────────────── utilidades

class CadeiaFalsa:
    """`leaf_claimed` lendo um conjunto, no lugar de bytes de uma conta devnet.

    Os bytes reais sao testados onde moram, em solana_settlement; aqui o que
    esta sob teste e o cruzamento entre bit, arvore e assinatura.
    """

    def __init__(self, sacados_por_raiz):
        self.sacados = sacados_por_raiz

    def leaf_claimed(self, data, leaf_index):
        return leaf_index in self.sacados.get(data, set())


def arvore_de(claims):
    return {"claims": claims}


def folha(recipient, amount, leaf_index):
    return {"recipient": recipient, "amount": amount, "leaf_index": leaf_index}


def lote(batch_id, root_index, publicado=True):
    return {
        "batch_id": batch_id,
        "root_index": root_index,
        "root": f"0x{batch_id:064x}",
        "published_signature": f"sig{batch_id}" if publicado else None,
    }


def rodar(lotes, dados, arvores, sacados_por_raiz, pagamentos=()):
    """Chama a funcao com `_batch_tree` trocada pelas arvores dadas."""
    original = srv._batch_tree
    srv._batch_tree = lambda c, batch_id, root: arvores.get(batch_id)
    try:
        return srv._collected_from_chain(
            None, CadeiaFalsa(sacados_por_raiz), lotes, dados, list(pagamentos)
        )
    finally:
        srv._batch_tree = original


# ─────────────────────────────────────── o check que faltava

def test_saque_sem_assinatura_nossa_aparece():
    """O buraco da 711670: a cadeia sabia, a tela nao mostrava."""
    r = rodar(
        [lote(1, 0)],
        ["raiz0"],
        {1: arvore_de([folha(ANA, 350_000_000, 0)])},
        {"raiz0": {0}},
        pagamentos=[],                      # nenhuma linha em relayer_spend
    )
    assert r is not None, "nenhuma raiz lida, e havia uma"
    assert len(r) == 1, f"esperava um saque, veio {len(r)}"
    assert r[0]["recipient"] == ANA
    assert r[0]["amount"] == 350_000_000
    assert r[0]["relayed"] is False, "sem assinatura nossa nao quer dizer sem saque"
    assert r[0]["signature"] is None


def test_assinatura_nossa_e_anexada_quando_existe():
    pago = {"root_index": 0, "recipient": ANA, "signature": "2jck", "paid_at": 123}
    r = rodar(
        [lote(1, 0)],
        ["raiz0"],
        {1: arvore_de([folha(ANA, 500, 0)])},
        {"raiz0": {0}},
        pagamentos=[pago],
    )
    assert r[0]["relayed"] is True
    assert r[0]["signature"] == "2jck"
    assert r[0]["paid_at"] == 123


def test_os_dois_caminhos_na_mesma_raiz():
    """O caso realista: um sacou pelo relayer, outro pagou a propria taxa."""
    pago = {"root_index": 0, "recipient": ANA, "signature": "2jck", "paid_at": 1}
    r = rodar(
        [lote(1, 0)],
        ["raiz0"],
        {1: arvore_de([folha(ANA, 100, 0), folha(BENTO, 250, 1)])},
        {"raiz0": {0, 1}},
        pagamentos=[pago],
    )
    assert len(r) == 2
    por_dono = {x["recipient"]: x for x in r}
    assert por_dono[ANA]["relayed"] is True
    assert por_dono[BENTO]["relayed"] is False
    assert sum(x["amount"] for x in r) == 350


# ─────────────────────────────────────── o que nao pode entrar

def test_leaf_nao_sacado_fica_de_fora():
    r = rodar(
        [lote(1, 0)],
        ["raiz0"],
        {1: arvore_de([folha(ANA, 100, 0), folha(BENTO, 250, 1)])},
        {"raiz0": {1}},                     # so o Bento sacou
    )
    assert [x["recipient"] for x in r] == [BENTO]


def test_lote_nao_publicado_nao_conta():
    """Sem raiz na cadeia nao ha bit para ler, logo nao ha o que afirmar."""
    r = rodar(
        [lote(1, 0, publicado=False)],
        ["raiz0"],
        {1: arvore_de([folha(ANA, 100, 0)])},
        {"raiz0": {0}},
    )
    assert r is None, "um lote nao publicado nao torna a resposta conhecida"


def test_conta_ausente_na_cadeia_e_pulada():
    r = rodar([lote(1, 0)], [None], {1: arvore_de([folha(ANA, 100, 0)])}, {})
    assert r is None


# ─────────────────────────────────────── silencio nao e ausencia

def test_nenhuma_raiz_legivel_devolve_none_e_nao_lista_vazia():
    """Lista vazia significa "ninguem sacou". Isso so a cadeia pode dizer."""
    r = rodar([lote(1, 0)], [None], {}, {})
    assert r is None, "lista vazia aqui vira 'ninguem sacou' na tela"


def test_raiz_legivel_sem_saque_devolve_lista_vazia():
    """A afirmacao de que ninguem sacou e valida quando a cadeia respondeu."""
    r = rodar(
        [lote(1, 0)],
        ["raiz0"],
        {1: arvore_de([folha(ANA, 100, 0)])},
        {"raiz0": set()},                   # raiz lida, nenhum bit ligado
    )
    assert r == [], f"esperava lista vazia, veio {r}"


def test_arvore_que_nao_reconstroi_nao_derruba_as_outras():
    """Uma raiz sem atribuicao possivel sai; o resto continua valendo."""
    r = rodar(
        [lote(1, 0), lote(2, 1)],
        ["raiz0", "raiz1"],
        {2: arvore_de([folha(BENTO, 70, 0)])},   # o lote 1 nao reconstroi
        {"raiz0": {0}, "raiz1": {0}},
    )
    assert r is not None
    assert [x["recipient"] for x in r] == [BENTO]


# ─────────────────────────────────────── prova de que o teste pega o defeito

def test_a_tela_antiga_reprovaria_este_conjunto():
    """A fonte antiga era so `relayer_spend`, e para a 711670 ela era vazia."""
    pagamentos = []                          # o que relayer_spend tinha
    antigo = [p["recipient"] for p in pagamentos]
    assert antigo == [], "o estado antigo nao se reproduz"

    novo = rodar(
        [lote(1, 0)],
        ["raiz0"],
        {1: arvore_de([folha(ANA, 350_000_000, 0)])},
        {"raiz0": {0}},
        pagamentos=pagamentos,
    )
    assert [x["recipient"] for x in novo] == [ANA], "a fonte nova caiu no mesmo buraco"


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
