"""Devolver ao jogo o valor que um lote fechado congelou.

Fechar um lote era porta de mão única. A recompensa ganhava `batch_id`, o
fechamento seguinte só olhava `batch_id IS NULL`, e nenhum caminho limpava esse
campo. Lote fechado e nunca publicado congelava o valor dele para sempre.

Medido em 23/10/2026: 15 lotes nessa situação há 35 a 37 dias, segurando 43
recompensas que o usuário nunca conseguiria sacar. Isso é 83% de tudo o que já
foi creditado nesta rede — a ponte web2 para web3 creditando certo de um lado e
não entregando do outro.

Reabrir é seguro **exatamente porque** nada na cadeia aponta para o lote. O que
estes checks protegem são as três recusas, porque cada uma, se falhar, perde
dinheiro de alguém:

  - lote já publicado tem raiz na cadeia e pode estar sendo sacado agora;
  - raiz existindo na cadeia sem assinatura aqui é publicação não registrada,
    e a cadeia manda, não o nosso banco;
  - `root_index` nasce de `COUNT(*)`, então apagar um lote do meio faz o
    próximo fechamento reusar índice que já tem raiz publicada.

E silêncio da cadeia não é ausência: sem leitura, recusa.

    .venv/Scripts/python.exe tests/test_batch_reopen.py
"""
import os
import sys
import tempfile
import time
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-reopen-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")
os.environ["SETTLEMENT_OPERATOR_TOKEN"] = "token-de-teste"

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

srv.init_settlement_tables()
srv._migrar_proveniencia_da_recompensa()

cliente = TestClient(srv.app)
CABECALHO = {"X-Operator-Token": "token-de-teste"}

PATROCINADOR = "75vW4HnhtMVcLuHLh3Tm8S1BuFvLVBoLqYoRxQT3SDnE"
CARTEIRA = "AnaWXv2zweyi4ksi9svMV5xpJYtRhmpFbs7HCMsY1HP"
USUARIO = "0x" + "ab" * 20


# ─────────────────────────────────────────────────────────────── a cadeia falsa

def cadeia(raizes_existentes=(), falhar=False):
    """`fetch_accounts` devolve dado só para as raízes que "existem"."""
    m = types.ModuleType("solana_settlement")
    m.load_idl = lambda: {}
    m.program_id = lambda idl: "prog"
    m.campaign_pda = lambda pid, sponsor, cid: f"camp{cid}"
    m.root_pda = lambda pid, campaign, idx: f"{campaign}:raiz{idx}"
    m.default_rpc_url = lambda: "http://fake"

    def fetch_accounts(url, enderecos):
        if falhar:
            raise RuntimeError("devnet fora do ar")
        return [b"existe" if str(e) in raizes_existentes else None for e in enderecos]

    m.fetch_accounts = fetch_accounts
    return m


def montar(lotes, campanha=479079, com_campanha=True):
    """`lotes`: lista de (batch_id, root_index, assinatura_ou_None, n_recompensas).

    `com_campanha=False` deixa o lote órfão: a linha da campanha não existe.
    É o único jeito de o patrocinador faltar, porque `sponsor` é NOT NULL —
    campanha sem patrocinador não chega a existir.
    """
    conn = srv.get_db_connection()
    c = conn.cursor()
    try:
        for t in ("settlement_rewards", "settlement_batches", "settlement_campaigns"):
            try:
                c.execute(f"DELETE FROM {t}")
            except Exception:
                pass
        agora = int(time.time())
        if com_campanha:
            c.execute(
                "INSERT INTO settlement_campaigns (campaign_id, sponsor, mint, registered_at) "
                "VALUES (?, ?, 'M', ?)",
                (campanha, PATROCINADOR, agora))
        for batch_id, root_index, assinatura, n in lotes:
            c.execute(
                """INSERT INTO settlement_batches
                   (id, campaign_id, root_index, root, total_amount, leaf_count,
                    created_at, published_signature)
                   VALUES (?, ?, ?, ?, 0, ?, ?, ?)""",
                (batch_id, campanha, root_index, f"0x{batch_id:064x}", n, agora, assinatura))
            for _ in range(n):
                c.execute(
                    """INSERT INTO settlement_rewards
                       (campaign_id, user_address, amount, created_at, batch_id, solana_address)
                       VALUES (?, ?, 100, ?, ?, ?)""",
                    (campanha, USUARIO, agora, batch_id, CARTEIRA))
        conn.commit()
    finally:
        conn.close()


def reabrir(batch_id, raizes=(), falhar=False, cabecalho=CABECALHO):
    anterior = sys.modules.get("solana_settlement")
    sys.modules["solana_settlement"] = cadeia(raizes, falhar)
    try:
        return cliente.post(f"/api/solana/batch/{batch_id}/reopen", headers=cabecalho)
    finally:
        if anterior is None:
            sys.modules.pop("solana_settlement", None)
        else:
            sys.modules["solana_settlement"] = anterior


def contar(cond):
    conn = srv.get_db_connection()
    try:
        return list(conn.execute(f"SELECT COUNT(*) FROM settlement_rewards WHERE {cond}"))[0][0]
    finally:
        conn.close()


# ─────────────────────────────────────── as três recusas, que é o que importa

def test_lote_publicado_nunca_reabre():
    """Tem assinatura: a raiz está na cadeia e alguém pode estar sacando agora."""
    montar([(1, 0, "2jckAssinatura", 3)])
    r = reabrir(1)
    assert r.status_code == 409, f"HTTP {r.status_code}: {r.text}"
    assert "published" in r.json()["detail"]
    assert contar("batch_id = 1") == 3, "as recompensas foram soltas de um lote publicado"


def test_raiz_na_cadeia_sem_assinatura_aqui_tambem_recusa():
    """Alguém publicou e não registrou. A cadeia manda, não o nosso banco.

    É o check mais importante do arquivo: a ausência de assinatura no banco
    NÃO prova ausência na cadeia, e tratar as duas como a mesma coisa apagaria
    um lote cuja raiz paga gente.
    """
    montar([(1, 0, None, 3)])
    r = reabrir(1, raizes=("camp479079:raiz0",))
    assert r.status_code == 409, f"HTTP {r.status_code}: {r.text}"
    assert "already exists on chain" in r.json()["detail"]
    assert contar("batch_id = 1") == 3


def test_lote_do_meio_recusa_por_causa_do_indice():
    """`root_index` vem de COUNT(*): apagar do meio faz o próximo reusar índice."""
    montar([(1, 0, None, 2), (2, 1, "assinado", 2)])
    r = reabrir(1)
    assert r.status_code == 409, f"HTTP {r.status_code}: {r.text}"
    assert "index" in r.json()["detail"]
    assert contar("batch_id = 1") == 2


def test_cadeia_muda_recusa_com_503():
    """Silêncio não é ausência, e é a ausência que autoriza apagar."""
    montar([(1, 0, None, 3)])
    r = reabrir(1, falhar=True)
    assert r.status_code == 503, f"HTTP {r.status_code}: {r.text}"
    assert contar("batch_id = 1") == 3


# ─────────────────────────────────────── o caminho feliz

def test_lote_nao_publicado_devolve_as_recompensas():
    montar([(1, 0, None, 4)])
    r = reabrir(1)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text}"
    corpo = r.json()
    assert corpo["rewards_released"] == 4
    assert corpo["root_index_freed"] == 0
    assert contar("batch_id IS NULL") == 4, "as recompensas nao voltaram para sem-lote"
    assert contar("solana_address IS NULL") == 4, (
        "a carteira continuou carimbada; o proximo fechamento tem de reler o vinculo atual")
    conn = srv.get_db_connection()
    try:
        assert list(conn.execute("SELECT COUNT(*) FROM settlement_batches WHERE id = 1"))[0][0] == 0
    finally:
        conn.close()


def test_o_indice_liberado_volta_a_ser_usado():
    """É o ponto inteiro: o índice precisa voltar para a contagem."""
    montar([(1, 0, None, 2)])
    assert reabrir(1).status_code == 200
    conn = srv.get_db_connection()
    try:
        n = list(conn.execute(
            "SELECT COUNT(*) FROM settlement_batches WHERE campaign_id = 479079"))[0][0]
    finally:
        conn.close()
    assert n == 0, "o lote nao saiu da contagem, entao o proximo pularia o indice 0"


# ─────────────────────────────────────── guardas de acesso e de forma

def test_sem_token_de_operador_nao_passa():
    montar([(1, 0, None, 2)])
    r = reabrir(1, cabecalho={})
    assert r.status_code == 401, f"HTTP {r.status_code}"
    assert contar("batch_id = 1") == 2


def test_lote_inexistente_e_404():
    montar([])
    assert reabrir(999).status_code == 404


def test_lote_orfao_recusa_em_vez_de_adivinhar():
    """Lote cuja campanha sumiu do banco.

    Sem a campanha não há patrocinador, sem patrocinador não dá para derivar o
    endereço da raiz, e sem o endereço não dá para provar que ela não existe na
    cadeia. Recusar é a única resposta honesta: o contrário seria apagar um
    lote confiando em não ter conseguido olhar.
    """
    montar([(1, 0, None, 2)], com_campanha=False)
    r = reabrir(1)
    assert r.status_code == 409, f"HTTP {r.status_code}: {r.text}"
    assert "sponsor" in r.json()["detail"]
    assert contar("batch_id = 1") == 2, "apagou um lote sem conseguir verificar a cadeia"


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
