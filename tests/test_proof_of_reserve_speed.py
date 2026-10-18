"""A prova de reserva: a rota mais cara, e a que decide se alguem confia.

Lia 28 campanhas em serie, cada uma consultando a Solana: 29 segundos medidos
em producao. Um juiz ou um operador abre essa pagina uma vez para decidir se
confia, e meio minuto de tela parada responde essa pergunta sozinho.

O que estes checks protegem:

  - a ordem das linhas nao muda entre visitas. E uma tabela de solvencia:
    linha trocando de lugar faz desconfiar do documento inteiro;
  - o limite de concorrencia existe. Vinte e oito chamadas de RPC de uma vez e
    como se toma rate limit, que troca "lento" por "errado";
  - o cache serve a mesma resposta, e generatedAt continua sendo a hora do
    CALCULO. Prova de reserva que mente sobre a propria idade e pior que lenta.

    .venv/Scripts/python.exe tests/test_proof_of_reserve_speed.py
"""
import asyncio
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-prova-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402

srv.init_settlement_tables()
srv.init_faucet_registry_table()
srv.init_microclaims_tables()

N = 24          # campanhas de mentira
ATRASO = 0.05   # o que cada leitura de cadeia custaria


def semear():
    conn = srv.get_db_connection()
    agora = int(time.time())
    for i in range(N):
        conn.execute("INSERT OR REPLACE INTO settlement_campaigns "
                     "(campaign_id, sponsor, mint, registered_at, min_withdraw) "
                     "VALUES (?, 'SPONSOR', ?, ?, 0)", (900000 + i, "mint%03d" % i, agora))
    conn.commit()
    conn.close()


class LeituraFalsa:
    """Substitui a leitura de cadeia por uma espera, e conta as simultaneas."""

    def __init__(self):
        self.agora = 0
        self.pico = 0
        self.chamadas = 0

    async def __call__(self, campaign_id):
        self.chamadas += 1
        self.agora += 1
        self.pico = max(self.pico, self.agora)
        try:
            await asyncio.sleep(ATRASO)
            return {"on_chain": {"committed": 10, "paid": 4, "vault_amount": 100,
                                 "vault": "V%s" % campaign_id}}
        finally:
            self.agora -= 1


def medir():
    """Roda a rota com a leitura falsa. Devolve (resposta, segundos, espiao)."""
    espiao = LeituraFalsa()
    original = srv.get_campaign_ledger
    srv.get_campaign_ledger = espiao
    srv._prova_cache["dados"] = None          # cache frio
    try:
        t0 = time.time()
        r = asyncio.run(srv.proof_of_reserve())
        return r, time.time() - t0, espiao
    finally:
        srv.get_campaign_ledger = original


def test_as_campanhas_sao_lidas_em_paralelo():
    semear()
    _, segundos, espiao = medir()
    serie = espiao.chamadas * ATRASO
    assert espiao.chamadas >= N, espiao.chamadas
    # Em serie seriam chamadas*ATRASO; com oito por vez, cerca de um oitavo.
    assert segundos < serie / 2, f"{segundos:.2f}s para o que em serie custaria {serie:.2f}s"


def test_ha_um_teto_de_leituras_simultaneas():
    """Sem teto, 28 chamadas de uma vez no RPC viram rate limit."""
    semear()
    _, _, espiao = medir()
    assert espiao.pico <= srv._PROVA_POR_VEZ, f"pico de {espiao.pico} leituras simultaneas"
    assert espiao.pico > 1, "nao esta paralelo coisa nenhuma"


def test_a_ordem_das_linhas_nao_muda_entre_visitas():
    semear()
    a, _, _ = medir()
    b, _, _ = medir()
    assert [r["asset"] for r in a["assets"]] == [r["asset"] for r in b["assets"]]


def test_o_cache_evita_recalcular():
    semear()
    medir()                                   # aquece
    espiao = LeituraFalsa()
    original = srv.get_campaign_ledger
    srv.get_campaign_ledger = espiao
    try:
        asyncio.run(srv.proof_of_reserve())
    finally:
        srv.get_campaign_ledger = original
    assert espiao.chamadas == 0, f"recalculou {espiao.chamadas} campanhas com cache quente"


def test_o_cache_nao_mente_sobre_a_idade():
    """generatedAt e a hora do calculo, nao a da resposta."""
    semear()
    primeira, _, _ = medir()
    time.sleep(1.1)
    segunda = asyncio.run(srv.proof_of_reserve())
    assert segunda["generatedAt"] == primeira["generatedAt"], (
        "a resposta cacheada precisa dizer quando foi calculada")


def test_a_resposta_mantem_a_forma_que_os_clientes_leem():
    semear()
    r, _, _ = medir()
    for chave in ("generatedAt", "assets", "solventPerAsset", "allSolvent"):
        assert chave in r, chave
    claim = [a for a in r["assets"] if a["asset"] == "CLAIM"]
    assert claim, "a linha do CLAIM sumiu"
    assert "faucets" in claim[0], claim[0].keys()


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
