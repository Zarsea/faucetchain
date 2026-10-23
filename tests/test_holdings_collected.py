"""A tela de saldos oferecendo saque de dinheiro que já saiu.

Em 22/10/2026 a conta 0xb3dff5 tinha três posições sacadas na Solana, e
`/api/solana/holdings` dizia `collected: 0` nas três. O valor sacado seguia
contado em `published`, que a tela mostra como sacável, então o dono clicava
para sacar o que já estava na carteira dele e recebia "already withdrawn" do
programa, sem explicação possível na tela.

A causa não era um cálculo errado. Era a ausência de cálculo: `collected`
nascia 0 no inicializador e NENHUMA linha o incrementava. O docstring da rota
afirmava que o campo "vem do bitmap da raiz na cadeia" e nada lia bitmap
nenhum ali -- descrevia a intenção de quem escreveu, não o código.

Nenhum teste pegou porque nenhum comparou o campo com a cadeia; olhavam
`credited` e `published`, que estavam certos.

É o mesmo defeito do item aberto em 23e17e9, onde a campanha 711670 mostrava
"Collected 350,00" e "nobody has collected it" na mesma tela.

    .venv/Scripts/python.exe tests/test_holdings_collected.py
"""
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-holdings-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

srv.init_settlement_tables()

cliente = TestClient(srv.app)

USUARIO = "0x" + "ab" * 20
CARTEIRA = "75vW4HnhtMVcLuHLh3Tm8S1BuFvLVBoLqYoRxQT3SDnE"
MINT = "GfGjMY4EiTRGALCoaQV4UVYC3GvMJWkmYd8fyTrYgBHA"


# ─────────────────────────────────────────────────────────────── utilidades

def montar(lotes):
    """Monta campanha, token e recompensas.

    `lotes` é uma lista de (batch_id, amount, publicado). O valor de cada lote
    vira uma recompensa da mesma carteira, que é como a produção acumula:
    várias coletas que o fechamento do lote soma num leaf só.
    """
    conn = srv.get_db_connection()
    try:
        c = conn.cursor()
        for tabela in ("settlement_rewards", "settlement_batches",
                       "settlement_campaigns", "token_registry"):
            try:
                c.execute(f"DELETE FROM {tabela}")
            except Exception:
                pass
        agora = int(time.time())
        c.execute(
            """INSERT INTO token_registry
               (mint, cluster, name, symbol, decimals, token_program, settleable, added_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (MINT, "devnet", "FaucetsWeb3 Liquidity Test", "FWLT", 6,
             "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", 1, agora),
        )
        c.execute(
            "INSERT INTO settlement_campaigns (campaign_id, sponsor, mint, registered_at) VALUES (?,?,?,?)",
            (479079, CARTEIRA, MINT, agora),
        )
        for i, (batch_id, amount, publicado) in enumerate(lotes):
            c.execute(
                """INSERT INTO settlement_batches
                   (id, campaign_id, root_index, root, total_amount, leaf_count, created_at, published_signature)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (batch_id, 479079, i, f"0x{batch_id:064x}", amount, 1, agora,
                 f"sig{batch_id}" if publicado else None),
            )
            c.execute(
                """INSERT INTO settlement_rewards
                   (campaign_id, user_address, amount, created_at, batch_id, solana_address)
                   VALUES (?,?,?,?,?,?)""",
                (479079, USUARIO, amount, agora, batch_id, CARTEIRA),
            )
        conn.commit()
    finally:
        # Sem o finally, a primeira excecao deixa a conexao aberta e todo teste
        # seguinte morre com "database is locked", escondendo o que falhou.
        conn.close()


def saldos(claimed_por_lote):
    """Chama a rota com a cadeia respondendo `claimed_por_lote`.

    Substitui `_batches_claimed` porque o que está sob teste é o que a rota faz
    com a resposta da cadeia, não a leitura do bitmap -- essa já tem dono em
    `_mark_claimed` e exige devnet.
    """
    original = srv._batches_claimed
    srv._batches_claimed = lambda c, lotes: dict(claimed_por_lote)
    try:
        r = cliente.get(f"/api/solana/holdings/{USUARIO}")
        assert r.status_code == 200, r.text
        tokens = r.json()["tokens"]
        return tokens[0] if tokens else None
    finally:
        srv._batches_claimed = original


# ─────────────────────────────────────── o check que faltava

def test_o_que_foi_sacado_sai_de_published_e_entra_em_collected():
    """O defeito exato: três posições sacadas e `collected` em 0."""
    montar([(1, 347221, True), (2, 15424575, True), (3, 136174606, True)])
    s = saldos({1: True, 2: True, 3: True})
    assert s["collected"] == 347221 + 15424575 + 136174606, (
        f"collected={s['collected']}, era para ser a soma das tres sacadas")
    assert s["published"] == 0, (
        f"published={s['published']}: a tela ainda oferece saque do que ja saiu")


def test_sacado_e_sacavel_no_mesmo_token():
    """O caso comum: parte saiu, parte não."""
    montar([(1, 1000, True), (2, 500, True)])
    s = saldos({1: True, 2: False})
    assert s["collected"] == 1000
    assert s["published"] == 500


def test_nada_sacado_continua_tudo_sacavel():
    montar([(1, 1000, True), (2, 500, True)])
    s = saldos({1: False, 2: False})
    assert s["collected"] == 0
    assert s["published"] == 1500


# ─────────────────────────────────────── a cadeia muda, o resto não

def test_lote_sem_publicacao_nao_conta_como_sacavel():
    """Lote fechado sem raiz na cadeia é promessa, não saldo."""
    montar([(1, 1000, False)])
    s = saldos({})
    assert s["published"] == 0
    assert s["credited"] == 1000


def test_recompensa_sem_lote_e_credito():
    montar([])
    conn = srv.get_db_connection()
    conn.execute(
        """INSERT INTO settlement_rewards
           (campaign_id, user_address, amount, created_at, batch_id, solana_address)
           VALUES (?,?,?,?,NULL,?)""",
        (479079, USUARIO, 777, int(time.time()), CARTEIRA),
    )
    conn.commit()
    conn.close()
    s = saldos({})
    assert s["credited"] == 777
    assert s["published"] == 0
    assert s["collected"] == 0


# ─────────────────────────────────────── incerteza não é zero

def test_cadeia_muda_deixa_collected_nulo_em_vez_de_zero():
    """Zero significa "nao sacou". Quando nao se sabe, o campo e nulo.

    Contar silencio da cadeia como "nao sacado" e exatamente como o defeito
    original se apresentava, e repeti-lo numa falha de RPC seria pior: o erro
    apareceria so as vezes.
    """
    montar([(1, 1000, True)])
    s = saldos({})                      # cadeia nao respondeu sobre o lote 1
    assert s["collected"] is None, f"collected={s['collected']}, era para ser nulo"
    assert s["published"] == 1000


def test_um_lote_incerto_contamina_o_token_inteiro():
    """Um `collected` parcial seria lido como total e diria menos do que saiu."""
    montar([(1, 1000, True), (2, 500, True)])
    s = saldos({1: True})               # o lote 2 ficou sem resposta
    assert s["collected"] is None
    assert s["published"] == 500


# ─────────────────────────────────────── prova de que o teste pega o defeito

def test_a_rota_antiga_reprovaria_estes_checks():
    """Reproduz a classificação antiga e mostra que ela falha no primeiro check.

    Sem isto, um teste verde não distingue "consertado" de "nunca quebrou".
    """
    linhas = [(1, 347221), (2, 15424575), (3, 136174606)]
    antigo = {"credited": 0, "published": 0, "collected": 0}
    for _batch_id, amount in linhas:
        antigo["published"] += amount      # era o unico destino de lote publicado
    assert antigo["collected"] == 0, "a classificacao antiga nao se reproduz"
    assert antigo["published"] == 347221 + 15424575 + 136174606

    montar(linhas and [(b, a, True) for b, a in linhas])
    novo = saldos({1: True, 2: True, 3: True})
    assert novo["collected"] == antigo["published"], "a rota nova caiu no mesmo buraco"
    assert novo["published"] == 0


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
