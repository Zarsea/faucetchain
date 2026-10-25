"""As metricas da tela tem de sair da tabela de blocos, nao de uma formula.

`/api/network-metrics` respondia com numeros que a propria cadeia desmentia na
mesma tela:

    block_height = max(1, total_claims + total_txs)   # nao e altura de bloco
    "networkHashrate": block_height * 12.5            # a rede nao faz hash
    "totalTransactions": total_claims + total_txs     # sempre igual a altura
    "activeConnections": nodes_online + 1             # sempre igual a nodeCount
    "avgBlockFinalizationTime": 1.2                   # constante

Medido em 25/10/2026, a tela anunciava "LATEST BLOCK #156" e "1950 TH/s"
enquanto `/api/blocks` tinha a ponta no #53. O README promete em negrito que
todo numero ali pode ser conferido sem pedir nada a ninguem, e esses nao podiam.

O que este arquivo prende:

  - cada numero bate com o que esta em `blocks`, consultado aqui de forma
    independente do endpoint;
  - o que a rede NAO mede volta `None`, nunca zero. Zero afirma que mediu;
  - `totalTransactions` deixa de ser igual a `blockHeight`, e `activeConnections`
    deixa de ser `nodeCount + 1` -- os dois empates que denunciavam a formula;
  - o intervalo entre blocos e MEDIANA. Esta rede sela em rajadas: um hiato de
    103 dias puxava a media para 7,3 dias enquanto a mediana dava 24,8 horas.

    .venv/Scripts/python.exe tests/test_network_metrics.py
"""
import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-metrics-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")
os.environ.setdefault("SETTLEMENT_OPERATOR_TOKEN", "token-de-teste")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

cliente = TestClient(srv.app)

# `current_claim_reward` conta `user_claims`, que o init do indexer nao cria.
# Ela e irrelevante para o que este arquivo mede, mas sem a tabela o endpoint
# inteiro responde 500 e todo assert abaixo falharia pelo motivo errado.
_conn = srv.get_db_connection()
_conn.execute("CREATE TABLE IF NOT EXISTS user_claims (id INTEGER PRIMARY KEY)")
_conn.commit()
_conn.close()


def semear(blocos):
    """`blocos`: lista de (height, timestamp, tx_count)."""
    conn = srv.get_db_connection()
    try:
        c = conn.cursor()
        c.execute("DELETE FROM blocks")
        for h, t, n in blocos:
            c.execute(
                "INSERT INTO blocks (height, hash, parent_hash, validator, tx_count, "
                "timestamp, gas_used, gas_limit, reward) "
                "VALUES (?, ?, ?, 'v', ?, ?, 0, 0, 0)",
                (h, f"0x{h:064x}", f"0x{h - 1:064x}", n, t))
        conn.commit()
    finally:
        conn.close()


def metricas():
    r = cliente.get("/api/network-metrics")
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text}"
    return r.json()


def da_tabela(sql):
    conn = srv.get_db_connection()
    try:
        return conn.execute(sql).fetchone()[0]
    finally:
        conn.close()


# ──────────────────────────────────── os numeros batem com a tabela de blocos

def test_altura_e_o_maior_height_e_nao_uma_soma():
    semear([(1, 1000, 3), (2, 1100, 4), (3, 1250, 5)])
    m = metricas()
    assert m["blockHeight"] == da_tabela("SELECT MAX(height) FROM blocks") == 3, m
    assert m["blockCount"] == 3


def test_transacoes_somam_tx_count_e_nao_repetem_a_altura():
    semear([(1, 1000, 3), (2, 1100, 4), (3, 1250, 5)])
    m = metricas()
    assert m["totalTransactions"] == da_tabela(
        "SELECT SUM(tx_count) FROM blocks") == 12, m
    # O empate era a assinatura da formula antiga.
    assert m["totalTransactions"] != m["blockHeight"], (
        "transacoes voltou a ser igual a altura: a formula voltou")


def test_conexoes_nao_sao_nos_mais_um():
    semear([(1, 1000, 1), (2, 1100, 1)])
    m = metricas()
    assert m["activeConnections"] == m["nodeCount"], m
    assert m["activeConnections"] != m["nodeCount"] + 1


# ──────────────────────────────────── o que nao se mede volta None, nao zero

def test_sem_hashrate_porque_a_rede_nao_faz_prova_de_trabalho():
    semear([(1, 1000, 1), (2, 1100, 1)])
    m = metricas()
    assert m["networkHashrate"] is None, (
        "hashrate voltou a ter valor; esta rede nao calcula hash nenhum")


def test_um_bloco_so_nao_da_intervalo_e_isso_e_None():
    semear([(1, 1000, 2)])
    m = metricas()
    assert m["avgBlockFinalizationTime"] is None, m
    assert m["blockHeight"] == 1
    # Zero diria "medimos e o intervalo e zero", que e outra afirmacao.
    assert m["avgBlockFinalizationTime"] != 0


def test_cadeia_vazia_nao_inventa_altura_um():
    semear([])
    m = metricas()
    assert m["blockHeight"] == 0, "o max(1, ...) voltou"
    assert m["blockCount"] == 0
    assert m["avgBlockFinalizationTime"] is None
    assert m["networkHashrate"] is None


# ──────────────────────────────────── mediana, que e o ponto do intervalo

def test_intervalo_e_mediana_e_um_hiato_nao_o_sequestra():
    """Quatro intervalos de 100s e um de 9.000.000s.

    A media daria 1.800.080s -- cinco meses e meio -- e descreveria o hiato.
    A mediana da 100s e descreve a rede.
    """
    t = 1_000_000
    blocos, altura = [(1, t, 1)], 1
    for d in (100, 100, 9_000_000, 100, 100):
        t += d
        altura += 1
        blocos.append((altura, t, 1))
    semear(blocos)
    m = metricas()
    assert m["avgBlockFinalizationTime"] == 100, (
        f"esperava a mediana 100s, veio {m['avgBlockFinalizationTime']}; "
        "se for ~1800080 a media voltou")


def test_dois_blocos_dao_o_intervalo_entre_eles():
    semear([(1, 5000, 1), (2, 5042, 1)])
    assert metricas()["avgBlockFinalizationTime"] == 42


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
