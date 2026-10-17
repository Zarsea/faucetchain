"""Alarme do saldo do relayer.

O relayer paga a taxa e o rent de cada saque para que ninguem precise ter SOL
para receber o que ganhou. Quando ele seca, os saques param e o sintoma nao se
parece com falta de saldo -- a tela mostra erro de transacao e nada no erro diz
o que aconteceu.

O que estes checks protegem:

  - a medida e "quantos usuarios novos ainda cabem", nao lamports. Lamports
    nao dizem nada sozinhos: 0,5 SOL e muito ou pouco dependendo do rent;
  - grita na MUDANCA de estado. A mesma linha a cada cinco minutos ensina quem
    le a ignorar a linha;
  - saldo ilegivel e "unknown", nunca "ok". Chamar de ok o que nao foi medido
    e como um alarme fica calado no dia em que precisava tocar;
  - o painel e o alarme leem o MESMO numero.

    .venv/Scripts/python.exe tests/test_relayer_alarm.py
"""
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-alarme-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")
# O laco dorme antes da primeira volta; com uma hora ele nunca acorda no teste.
os.environ.setdefault("RELAYER_CHECK_SECONDS", "3600")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402

RENT = srv.TOKEN_ACCOUNT_RENT_LAMPORTS
CUSTO = RENT + srv.SOLANA_LAMPORTS_PER_SIGNATURE * 2   # um usuario novo


def preparar():
    conn = srv.get_db_connection()
    conn.execute("""CREATE TABLE IF NOT EXISTS alert_state (
                        alert_key TEXT PRIMARY KEY, state TEXT NOT NULL,
                        changed_at INTEGER NOT NULL)""")
    conn.execute("DELETE FROM alert_state")
    conn.commit()
    conn.close()


class Registro:
    """Captura o que o alarme gritou, sem ir ao arquivo de log."""

    def __init__(self):
        self.linhas = []

    def __enter__(self):
        self.antes = {n: getattr(srv.audit_logger, n) for n in ("error", "warning", "info")}
        for nivel in self.antes:
            def faz(nivel):
                return lambda msg, *a, **k: self.linhas.append((nivel, str(msg) % a if a else str(msg)))
            setattr(srv.audit_logger, nivel, faz(nivel))
        return self

    def __exit__(self, *_):
        for n, f in self.antes.items():
            setattr(srv.audit_logger, n, f)

    def niveis(self):
        return [n for n, _ in self.linhas]


def com_saldo(lamports):
    """Troca a leitura de saldo por um numero fixo."""
    def falso():
        eco = dict(_economia_base)
        cabem = (lamports // CUSTO) if lamports is not None else None
        if cabem is None:
            estado = "unknown"
        elif cabem <= srv.RELAYER_ALERT_CRITICAL:
            estado = "critical"
        elif cabem <= srv.RELAYER_ALERT_LOW:
            estado = "low"
        else:
            estado = "ok"
        eco.update({"balance_lamports": lamports, "new_recipients_affordable": cabem,
                    "alert": estado, "cost_of_next_new_recipient": CUSTO})
        return eco
    return falso


_economia_base = {
    "withdrawals": 0, "first_time_recipients": 0, "spent_lamports": 0,
    "spent_base_fee": 0, "spent_priority_fee": 0, "spent_rent": 0,
    "alert_low_below": 500, "alert_critical_below": 100,
}


def rodar(lamports):
    original = srv._relayer_economia
    srv._relayer_economia = com_saldo(lamports)
    try:
        with Registro() as reg:
            eco = srv.conferir_saldo_do_relayer()
        return eco, reg
    finally:
        srv._relayer_economia = original


# --------------------------------------------------------------- os limites

def test_saldo_folgado_nao_e_alarme():
    preparar()
    eco, reg = rodar(5000 * CUSTO)
    assert eco["alert"] == "ok", eco
    assert eco["new_recipients_affordable"] == 5000, eco


def test_abaixo_do_limite_baixo_avisa():
    preparar()
    eco, reg = rodar(300 * CUSTO)
    assert eco["alert"] == "low", eco
    assert reg.niveis() == ["warning"], reg.linhas


def test_abaixo_do_limite_critico_grita_mais_alto():
    preparar()
    eco, reg = rodar(50 * CUSTO)
    assert eco["alert"] == "critical", eco
    assert reg.niveis() == ["error"], reg.linhas


def test_a_medida_e_usuarios_e_nao_lamports():
    """Meio SOL e muito ou pouco dependendo do rent. O limite segue o rent."""
    preparar()
    eco, _ = rodar(300 * CUSTO)
    assert eco["cost_of_next_new_recipient"] == CUSTO, eco
    assert eco["new_recipients_affordable"] == 300, eco


# ------------------------------------------------- so na mudanca de estado

def test_o_mesmo_estado_nao_grita_duas_vezes():
    preparar()
    _, primeira = rodar(300 * CUSTO)
    _, segunda = rodar(300 * CUSTO)
    assert primeira.niveis() == ["warning"], primeira.linhas
    assert segunda.linhas == [], "alarme repetido vira ruido e ensina a ignorar"


def test_piorar_grita_de_novo():
    preparar()
    rodar(300 * CUSTO)                 # low
    _, reg = rodar(50 * CUSTO)         # critical
    assert reg.niveis() == ["error"], reg.linhas


def test_recompor_o_saldo_avisa_que_voltou():
    preparar()
    rodar(50 * CUSTO)                  # critical
    _, reg = rodar(5000 * CUSTO)       # ok
    assert reg.niveis() == ["info"], reg.linhas
    assert "recomposto" in reg.linhas[0][1], reg.linhas


# ------------------------------------------------------- o alarme cego

def test_saldo_ilegivel_nao_e_ok():
    """Chamar de ok o que nao foi medido e como um alarme fica calado."""
    preparar()
    eco, reg = rodar(None)
    assert eco["alert"] == "unknown", eco
    assert reg.niveis() == ["error"], reg.linhas


def test_zero_e_critico():
    preparar()
    eco, _ = rodar(0)
    assert eco["alert"] == "critical", eco
    assert eco["new_recipients_affordable"] == 0, eco


# --------------------------------------- painel e alarme leem o mesmo numero

def test_o_endpoint_devolve_o_que_o_alarme_le():
    import asyncio
    preparar()
    original = srv._relayer_economia
    srv._relayer_economia = com_saldo(300 * CUSTO)
    try:
        pelo_endpoint = asyncio.run(srv.relayer_economics())
        pelo_alarme = srv._relayer_economia()
    finally:
        srv._relayer_economia = original
    assert pelo_endpoint == pelo_alarme, (pelo_endpoint, pelo_alarme)
    assert "alert" in pelo_endpoint, pelo_endpoint


def test_a_resposta_diz_quais_sao_os_limites():
    """Quem monitora precisa saber o limite sem ler o nosso codigo."""
    preparar()
    eco, _ = rodar(5000 * CUSTO)
    assert eco["alert_low_below"] == srv.RELAYER_ALERT_LOW, eco
    assert eco["alert_critical_below"] == srv.RELAYER_ALERT_CRITICAL, eco


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
