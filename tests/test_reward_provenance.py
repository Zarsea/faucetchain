"""De qual torneira veio cada crédito de campanha.

O usuário via quanto ganhou por campanha e nunca de onde. Não era limitação da
tela: `_campaign_drip` recebe `faucet_wallet` como parâmetro, grava ele na
tabela de cooldown na linha seguinte, e na recompensa escrevia só
`(campaign_id, user_address, amount, created_at)`. A procedência existia no
momento exato do crédito e era descartada ali.

O que estes checks protegem:

  - a coluna existe e o drip a preenche. É o defeito;
  - NULL significa "não registrado", não "sem origem": crédito direto do
    operador e parcela da tesouraria não têm torneira de verdade, e linha
    anterior a 23/10/2026 tem origem que ninguém anotou. A tela precisa
    distinguir isso de um nome faltando;
  - o extrato sobrevive à falta de `faucet_registry`. Nome de torneira é
    rótulo; derrubar o histórico inteiro por causa de um rótulo deixaria quem
    recebeu sem extrato.

    .venv/Scripts/python.exe tests/test_reward_provenance.py
"""
import os
import re
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-proven-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

srv.init_settlement_tables()
srv._migrar_proveniencia_da_recompensa()

cliente = TestClient(srv.app)

USUARIO = "0x" + "cd" * 20
TORNEIRA = "0x" + "fe" * 20
CARTEIRA = "75vW4HnhtMVcLuHLh3Tm8S1BuFvLVBoLqYoRxQT3SDnE"


# ─────────────────────────────────────────────────────────────── utilidades

def limpar():
    conn = srv.get_db_connection()
    try:
        for t in ("settlement_rewards", "settlement_campaigns", "faucet_registry"):
            try:
                conn.execute(f"DELETE FROM {t}")
            except Exception:
                pass
        conn.execute(
            "INSERT INTO settlement_campaigns (campaign_id, sponsor, mint, registered_at) "
            "VALUES (479079, 'S', 'M', ?)", (int(time.time()),))
        conn.commit()
    finally:
        conn.close()


def creditar(amount, faucet=None, quando=None):
    conn = srv.get_db_connection()
    try:
        agora = quando or int(time.time())
        if faucet is None:
            conn.execute(
                "INSERT INTO settlement_rewards (campaign_id, user_address, amount, created_at) "
                "VALUES (479079, ?, ?, ?)", (USUARIO, amount, agora))
        else:
            conn.execute(
                "INSERT INTO settlement_rewards "
                "(campaign_id, user_address, amount, created_at, faucet_wallet) "
                "VALUES (479079, ?, ?, ?, ?)", (USUARIO, amount, agora, faucet))
        conn.commit()
    finally:
        conn.close()


def extrato():
    r = cliente.get(f"/api/solana/history/{USUARIO}")
    assert r.status_code == 200, r.text
    return r.json()["entries"]


# ─────────────────────────────────────── o check que faltava

def test_o_drip_grava_a_torneira_que_recebeu():
    """O defeito exato: o parâmetro existia e não entrava na linha.

    Lido do fonte porque chamar `_campaign_drip` de verdade exige orçamento,
    inscrição e cooldown montados — e o que quebrou não foi nada disso, foi um
    INSERT com quatro colunas onde cabiam cinco.
    """
    fonte = open(os.path.join(ROOT, "api_server.py"), encoding="utf-8").read()
    corpo = fonte[fonte.index("def _campaign_drip"):]
    # Parar no proximo def/async def/@app, e nao so em "\ndef ": a funcao
    # seguinte e `_flush_treasury_share`, que grava a parcela da tesouraria e
    # NAO tem torneira de verdade. Capturar ela aqui reprovava o conserto certo.
    fim = min(
        (p for p in (corpo.find("\ndef ", 10), corpo.find("\nasync def ", 10),
                     corpo.find("\n@app.", 10)) if p > 0),
        default=len(corpo),
    )
    corpo = corpo[:fim]
    insercoes = re.findall(r"INSERT INTO settlement_rewards\s*\"?\s*\"?\(([^)]*)\)", corpo)
    assert insercoes, "nao achei o INSERT de recompensa dentro de _campaign_drip"
    for colunas in insercoes:
        assert "faucet_wallet" in colunas, (
            f"o drip grava a recompensa sem a torneira: ({colunas.strip()}). "
            f"Ela esta em escopo e a tabela de cooldown ao lado ja a grava.")


def test_a_coluna_existe_depois_da_migracao():
    conn = srv.get_db_connection()
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(settlement_rewards)")}
    finally:
        conn.close()
    assert "faucet_wallet" in cols


def test_a_migracao_roda_duas_vezes_sem_quebrar():
    srv._migrar_proveniencia_da_recompensa()
    srv._migrar_proveniencia_da_recompensa()


def test_o_extrato_devolve_a_torneira():
    limpar()
    creditar(1500, faucet=TORNEIRA)
    e = extrato()
    assert len(e) == 1
    assert e[0]["faucet_wallet"] == TORNEIRA
    assert e[0]["amount"] == 1500


# ─────────────────────────────────────── nulo nao e um nome faltando

def test_credito_sem_torneira_vem_nulo_e_nao_vazio():
    """Credito do operador e parcela da tesouraria nao tem torneira nenhuma."""
    limpar()
    creditar(900)
    e = extrato()
    assert e[0]["faucet_wallet"] is None, "sem torneira tem de ser nulo, nao string vazia"
    assert e[0]["faucet_name"] is None


def test_torneira_registrada_ganha_nome_e_site():
    limpar()
    conn = srv.get_db_connection()
    try:
        conn.execute(
            "INSERT INTO faucet_registry (name, wallet_address, registered_at, site_url) "
            "VALUES ('FaucetHunter', ?, ?, 'https://faucethunter.net')",
            (TORNEIRA.upper(), int(time.time())))
        conn.commit()
    finally:
        conn.close()
    creditar(10, faucet=TORNEIRA)
    e = extrato()
    assert e[0]["faucet_name"] == "FaucetHunter", "o casamento tem de ignorar caixa"
    assert e[0]["faucet_site"] == "https://faucethunter.net"


def test_torneira_sem_registro_mantem_a_carteira():
    """Sem nome a linha continua util: a carteira ja identifica a origem."""
    limpar()
    creditar(10, faucet=TORNEIRA)
    e = extrato()
    assert e[0]["faucet_wallet"] == TORNEIRA
    assert e[0]["faucet_name"] is None


# ─────────────────────────────────────── o rotulo nao derruba o extrato

def test_extrato_sobrevive_sem_a_tabela_de_nomes():
    """Juntar faucet_registry na query principal fazia a falta dela apagar tudo."""
    limpar()
    creditar(1500, faucet=TORNEIRA)
    conn = srv.get_db_connection()
    try:
        conn.execute("DROP TABLE IF EXISTS faucet_registry")
        conn.commit()
    finally:
        conn.close()
    try:
        e = extrato()
        assert len(e) == 1, "o extrato sumiu junto com a tabela de nomes"
        assert e[0]["amount"] == 1500
        assert e[0]["faucet_wallet"] == TORNEIRA
        assert e[0]["faucet_name"] is None
    finally:
        srv.init_settlement_tables()
        conn = srv.get_db_connection()
        try:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS faucet_registry ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, wallet_address TEXT, "
                "registered_at INTEGER, site_url TEXT)")
            conn.commit()
        finally:
            conn.close()


# ─────────────────────────────────────── ordem e estado

def test_o_mais_recente_vem_primeiro():
    limpar()
    agora = int(time.time())
    creditar(1, faucet=TORNEIRA, quando=agora - 100)
    creditar(2, faucet=TORNEIRA, quando=agora)
    assert [x["amount"] for x in extrato()] == [2, 1]


def test_sem_lote_o_estado_e_creditado():
    limpar()
    creditar(10, faucet=TORNEIRA)
    assert extrato()[0]["state"] == "credited"


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
