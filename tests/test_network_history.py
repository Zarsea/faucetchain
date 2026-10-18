"""A história da rede por faixa de tempo.

Os dois gráficos da tela Network Status nunca estiveram ligados em nada: o
volume era um array de vinte e quatro zeros declarado dentro do componente, e
o TPS era o mesmo array com o valor atual escrito só no último balde — o
espeto na ponta direita. O comentário do código dizia isso de si mesmo.

O que estes checks protegem:

  - balde vazio vem com ZERO, não ausente. Série com buraco faz o gráfico
    ligar dois instantes distantes como se fossem vizinhos, e a forma que ele
    desenha vira mentira sobre a densidade;
  - balde de um dia ou mais leva data no rótulo. Trinta colunas escritas
    "00:00" não dizem que dia é nenhuma delas;
  - "all" começa no primeiro bloco, e um carimbo corrompido não pode esticar
    a faixa por décadas e achatar o resto contra o eixo;
  - o número de colunas é exato: 24h dá 24, não 25.

    .venv/Scripts/python.exe tests/test_network_history.py
"""
import asyncio
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-historia-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402

# A coluna merkle_root nasce numa migracao que so roda no arranque da
# aplicacao; sem ela, inserir um bloco aqui falha por um motivo que nao
# tem nada a ver com o que este arquivo testa.
srv.init_blocks_merkle_column()


def limpar():
    conn = srv.get_db_connection()
    conn.execute("DELETE FROM blocks")
    conn.commit()
    conn.close()


def bloco(altura, quando, txs=1):
    conn = srv.get_db_connection()
    conn.execute(
        "INSERT OR REPLACE INTO blocks (height, hash, parent_hash, validator, "
        "tx_count, timestamp, gas_used, gas_limit, reward, merkle_root) "
        "VALUES (?, ?, '0x0', 'v', ?, ?, 0, 0, 0, '0x0')",
        (altura, "0x%064x" % altura, txs, int(quando)))
    conn.commit()
    conn.close()


def historia(faixa):
    return asyncio.run(srv.network_history(faixa))


# ------------------------------------------------------- forma das faixas

def test_cada_faixa_tem_o_numero_de_colunas_que_promete():
    limpar()
    for faixa, esperado in (("4h", 24), ("24h", 24), ("7d", 28), ("30d", 30)):
        d = historia(faixa)
        assert len(d["points"]) == esperado, (faixa, len(d["points"]))


def test_o_balde_de_24h_tem_uma_hora():
    limpar()
    assert historia("24h")["bucket_seconds"] == 3600
    assert historia("4h")["bucket_seconds"] == 600
    assert historia("30d")["bucket_seconds"] == 86400


def test_faixa_desconhecida_e_recusada():
    from fastapi import HTTPException
    try:
        historia("1ano")
    except HTTPException as e:
        assert e.status_code == 400, e.status_code
        return
    assert False, "faixa inválida passou"


# ------------------------------------------------- o vazio é zero, não buraco

def test_balde_sem_bloco_vem_com_zero():
    limpar()
    d = historia("24h")
    assert len(d["points"]) == 24
    assert all(p["txs"] == 0 and p["blocks"] == 0 for p in d["points"]), d["points"][:3]
    # e todos os rótulos existem: série com buraco desenha densidade errada
    assert all(p["label"] for p in d["points"])


def test_o_bloco_cai_no_balde_da_hora_dele():
    limpar()
    agora = int(time.time())
    tres_horas = agora - 3 * 3600
    bloco(1, tres_horas, txs=7)

    d = historia("24h")
    comdado = [p for p in d["points"] if p["txs"]]
    assert len(comdado) == 1, [p for p in d["points"] if p["txs"]]
    assert comdado[0]["txs"] == 7, comdado
    # no balde certo: entre 2 e 4 horas atrás
    distancia = agora - comdado[0]["t"]
    assert 2 * 3600 <= distancia <= 4 * 3600, distancia


def test_varios_blocos_na_mesma_hora_somam():
    limpar()
    quando = int(time.time()) - 3600
    bloco(1, quando, txs=3)
    bloco(2, quando + 60, txs=4)

    comdado = [p for p in historia("24h")["points"] if p["txs"]]
    assert len(comdado) == 1, comdado
    assert comdado[0]["txs"] == 7, comdado
    assert comdado[0]["blocks"] == 2, comdado


# ---------------------------------------------------------------- rótulos

def test_balde_de_um_dia_leva_data_no_rotulo():
    """Trinta colunas escritas 00:00 não dizem que dia é nenhuma delas."""
    limpar()
    import re
    for faixa in ("30d", "all"):
        d = historia(faixa)
        assert all(re.match(r"\d{2}/\d{2}", p["label"]) for p in d["points"]), \
            (faixa, d["points"][0]["label"])


def test_balde_curto_leva_hora_no_rotulo():
    limpar()
    import re
    d = historia("4h")
    assert all(re.fullmatch(r"\d{2}:\d{2}", p["label"]) for p in d["points"]), \
        d["points"][0]["label"]


# ------------------------------------------------------------------- all

def test_all_comeca_no_primeiro_bloco():
    limpar()
    agora = int(time.time())
    bloco(1, agora - 40 * 86400, txs=2)
    bloco(2, agora - 2 * 86400, txs=5)

    d = historia("all")
    assert d["total_txs"] == 7, d["total_txs"]
    # a faixa cobre o primeiro bloco
    assert d["from"] <= agora - 40 * 86400, (d["from"], agora - 40 * 86400)


def test_carimbo_corrompido_nao_estica_a_faixa():
    """Um registro com timestamp 0 esticaria 'all' por décadas e achataria
    todo o resto contra o eixo."""
    limpar()
    agora = int(time.time())
    bloco(1, 0, txs=99)                    # lixo
    bloco(2, agora - 3 * 86400, txs=4)

    d = historia("all")
    assert d["from"] >= srv.NETWORK_EPOCH_FLOOR, d["from"]
    assert d["total_txs"] == 4, "o bloco corrompido entrou na conta"


def test_all_engrossa_o_balde_quando_a_rede_fica_velha():
    """Um dia por coluna fica ilegível depois de alguns meses."""
    limpar()
    agora = int(time.time())
    bloco(1, agora - 300 * 86400, txs=1)
    bloco(2, agora - 86400, txs=1)

    d = historia("all")
    assert d["bucket_seconds"] > 86400, d["bucket_seconds"]
    assert len(d["points"]) < 120, f"{len(d['points'])} colunas é ilegível"


# ------------------------------------------------------------------ tps

def test_o_tps_e_medido_nao_estimado():
    """Transações do balde divididas pelos segundos dele. A tela dizia
    'estimated history' sobre números que não vinham de lugar nenhum."""
    limpar()
    bloco(1, int(time.time()) - 1800, txs=360)

    d = historia("24h")
    pago = [p for p in d["points"] if p["txs"]][0]
    assert abs(pago["tps"] - 360 / 3600) < 1e-6, (pago["tps"], 360 / 3600)


def test_os_totais_batem_com_a_soma_das_colunas():
    limpar()
    agora = int(time.time())
    bloco(1, agora - 3600, txs=3)
    bloco(2, agora - 7200, txs=4)

    d = historia("24h")
    assert d["total_txs"] == sum(p["txs"] for p in d["points"]) == 7
    assert d["total_blocks"] == sum(p["blocks"] for p in d["points"]) == 2


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
    print("\n%d/%d passed (banco temporario em %s)" % (len(testes) - falhas, len(testes), TMP))
    sys.exit(1 if falhas else 0)
