"""Webhooks da FaucetChain para a torneira parceira.

O que estes checks protegem, em ordem de quanto doi quando quebra:

  - a assinatura e sobre os bytes exatos que viajam. Assinar um dicionario e
    serializar de novo na hora do envio da 401 do outro lado sem ninguem
    entender por que;
  - a reentrega mantem o MESMO event_id, para o outro lado saber que e o mesmo
    evento e responder "duplicate" em vez de creditar duas vezes;
  - as esperas sao 1 min, 5 min, 30 min, 2 h e 12 h, e depois disso o evento e
    abandonado -- mas fica no banco com o motivo;
  - so saem eventos dos usuarios da torneira parceira, nao da rede inteira;
  - reserve_low / reserve_ok saem na mudanca de estado, nao a cada conferida.

    .venv/Scripts/python.exe tests/test_webhooks.py
"""
import asyncio
import hashlib
import hmac
import json
import os
import sys
import tempfile
import time
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-webhook-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")
os.environ.setdefault("REGISTER_HOURLY_PER_IP", "500")
# O laco de fundo dorme antes da primeira volta; com uma hora de tick ele nunca
# acorda durante o teste e nenhuma requisicao de verdade sai daqui.
os.environ.setdefault("WEBHOOK_TICK_SECONDS", "3600")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
import webhooks  # noqa: E402

srv.init_settlement_tables()
# Estas tabelas nascem no startup da aplicacao, e estes checks nao sobem a
# aplicacao: chamam as funcoes direto. Sem isto o erro que aparece e
# "no such table", que parece bug do codigo e e falta do arranjo.
srv.init_faucet_registry_table()
srv.init_faucet_api_keys_table()
srv.init_microclaims_tables()

# Segredo de mentira, de proposito. O real vive no .env da producao e em
# lugar nenhum deste repositorio, que e publico -- um HMAC nao liga para o
# valor, so para os dois lados usarem o mesmo.
SEGREDO = "segredo-de-teste-nao-use-em-lugar-nenhum"
TORNEIRA = "0x7dda72ad9ad56ce3d031ee6a62b5b94dd40c6ef3"
URL = "https://exemplo.invalido/webhook"

_n = [0]


def ligar(torneira=TORNEIRA):
    os.environ["FAUCETHUNTER_WEBHOOK_SECRET"] = SEGREDO
    os.environ["FAUCETHUNTER_WEBHOOK_URL"] = URL
    os.environ["FAUCETHUNTER_FAUCET_WALLET"] = torneira


def desligar():
    for k in ("FAUCETHUNTER_WEBHOOK_SECRET", "FAUCETHUNTER_WEBHOOK_URL",
              "FAUCETHUNTER_FAUCET_WALLET"):
        os.environ.pop(k, None)


def conexao():
    return srv.get_db_connection()


def limpar_fila():
    conn = conexao()
    conn.execute("DELETE FROM webhook_queue")
    conn.execute("DELETE FROM faucet_reserve_state")
    conn.commit()
    conn.close()


def fila():
    conn = conexao()
    linhas = [dict(r) for r in conn.execute("SELECT * FROM webhook_queue ORDER BY id")]
    conn.close()
    return linhas


def usuario_novo(torneira=TORNEIRA, com_solana=True, com_livro=True):
    """Cria um usuario, opcionalmente ligado a uma carteira Solana."""
    _n[0] += 1
    conta = "0x" + ("%02x" % _n[0]) * 20
    conn = conexao()
    if com_solana:
        conn.execute("INSERT OR REPLACE INTO solana_links (user_address, solana_address, linked_at) "
                     "VALUES (?, ?, ?)", (conta, "SOL" + conta[-8:], int(time.time())))
    if com_livro:
        conn.execute("INSERT OR REPLACE INTO microclaims_ledger "
                     "(faucet_wallet, user_wallet, virtual_balance, total_claimed, "
                     " claim_count, last_claim_at, created_at) VALUES (?, ?, 0, 0, 1, ?, ?)",
                     (torneira, conta, int(time.time()), int(time.time())))
    conn.commit()
    conn.close()
    return conta


class ClienteFalso:
    """Resposta por chamada: um status, ou uma excecao para simular queda."""

    def __init__(self, *respostas):
        self.respostas = list(respostas)
        self.chamadas = []

    async def post(self, url, content=None, headers=None, timeout=None):
        self.chamadas.append({"url": url, "content": content, "headers": dict(headers or {})})
        r = self.respostas.pop(0) if self.respostas else 200
        if isinstance(r, Exception):
            raise r
        return types.SimpleNamespace(status_code=r, text="")


def drenar(cliente, agora=None):
    conn = conexao()
    try:
        return asyncio.run(webhooks.drenar(conn, cliente, agora))
    finally:
        conn.close()


def enfileirar(tipo, dados):
    conn = conexao()
    try:
        eid = webhooks.enfileirar(conn, tipo, dados)
        conn.commit()
        return eid
    finally:
        conn.close()


# ----------------------------------------------------------------- assinatura

def test_a_assinatura_e_sobre_os_bytes_exatos_que_viajam():
    ligar()
    limpar_fila()
    enfileirar("ping", {})
    cli = ClienteFalso(200)
    drenar(cli)

    c = cli.chamadas[0]
    ts = c["headers"]["X-FaucetChain-Timestamp"]
    esperado = "sha256=" + hmac.new(SEGREDO.encode(),
                                    ts.encode() + b"." + c["content"],
                                    hashlib.sha256).hexdigest()
    assert c["headers"]["X-FaucetChain-Signature"] == esperado, c["headers"]


def test_o_corpo_enviado_e_json_com_type_e_data():
    ligar()
    limpar_fila()
    enfileirar("faucet.reserve_low", {"owed": 29.0})
    cli = ClienteFalso(200)
    drenar(cli)

    corpo = json.loads(cli.chamadas[0]["content"])
    assert corpo == {"type": "faucet.reserve_low", "data": {"owed": 29.0}}, corpo


def test_os_tres_cabecalhos_obrigatorios_vao_juntos():
    ligar()
    limpar_fila()
    enfileirar("ping", {})
    cli = ClienteFalso(200)
    drenar(cli)

    h = cli.chamadas[0]["headers"]
    for nome in ("X-FaucetChain-Event-Id", "X-FaucetChain-Timestamp",
                 "X-FaucetChain-Signature"):
        assert h.get(nome), (nome, h)
    assert h["Content-Type"] == "application/json", h


# ------------------------------------------------------------- fila e esperas

def test_evento_entregue_nao_volta_na_proxima_rodada():
    ligar()
    limpar_fila()
    enfileirar("ping", {})
    assert drenar(ClienteFalso(200)) == (1, 0)

    cli = ClienteFalso(200)
    drenar(cli)
    assert cli.chamadas == [], cli.chamadas
    assert fila()[0]["delivered_at"] is not None


def test_as_esperas_sao_1min_5min_30min_2h_e_12h():
    ligar()
    limpar_fila()
    enfileirar("ping", {})
    t = int(time.time())
    vistas = []
    for _ in range(5):
        drenar(ClienteFalso(500), agora=t)
        linha = fila()[0]
        vistas.append(linha["next_attempt_at"] - t)
        t = linha["next_attempt_at"]
    assert vistas == [60, 300, 1800, 7200, 43200], vistas


def test_o_evento_e_abandonado_depois_da_ultima_espera():
    ligar()
    limpar_fila()
    enfileirar("ping", {})
    t = int(time.time())
    for _ in range(6):  # 1 tentativa + 5 reentregas
        drenar(ClienteFalso(500), agora=t)
        linha = fila()[0]
        t = max(t, linha["next_attempt_at"])

    linha = fila()[0]
    assert linha["abandoned_at"] is not None, linha
    assert linha["attempts"] == 6, linha
    # abandonado nao e apagado: o motivo fica gravado
    assert linha["last_status"] == "500", linha


def test_abandonado_nao_e_tentado_de_novo():
    ligar()
    limpar_fila()
    enfileirar("ping", {})
    t = int(time.time())
    for _ in range(6):
        drenar(ClienteFalso(500), agora=t)
        t = max(t, fila()[0]["next_attempt_at"])

    cli = ClienteFalso(200)
    drenar(cli, agora=t + 999_999)
    assert cli.chamadas == [], cli.chamadas


def test_queda_de_rede_conta_como_falha_e_nao_derruba_o_laco():
    ligar()
    limpar_fila()
    enfileirar("ping", {})
    assert drenar(ClienteFalso(ConnectionError("sem rota"))) == (0, 1)
    assert "ConnectionError" in fila()[0]["last_status"], fila()[0]


def test_reentrega_mantem_o_event_id_e_os_bytes():
    ligar()
    limpar_fila()
    eid = enfileirar("withdrawal.settled", {"amount": 10.0})

    agora = int(time.time())
    cli = ClienteFalso(503, 200)
    drenar(cli, agora=agora)
    drenar(cli, agora=agora + 60)

    assert len(cli.chamadas) == 2, cli.chamadas
    a, b = cli.chamadas
    assert a["headers"]["X-FaucetChain-Event-Id"] == eid
    assert b["headers"]["X-FaucetChain-Event-Id"] == eid, "reenvio tem que levar o mesmo id"
    assert a["content"] == b["content"], "os bytes nao podem mudar entre tentativas"


def test_o_timestamp_assinado_e_a_hora_real_do_envio():
    """E nao a hora logica do agendador.

    O outro lado recusa fora de +-300s. Se a assinatura levasse o `agora` que
    governa a fila -- que num reenvio agendado esta no passado, e num teste
    pode estar em qualquer lugar -- todo evento reentregue voltaria 401, e o
    log so diria "assinatura invalida".
    """
    ligar()
    limpar_fila()
    enfileirar("ping", {})
    antes = int(time.time())
    # Uma reentrega agendada ha muito tempo, processada com a hora logica
    # tambem no passado: exatamente o caso em que os dois relogios divergem.
    conn = conexao()
    conn.execute("UPDATE webhook_queue SET next_attempt_at = ?", (antes - 20_000,))
    conn.commit()
    conn.close()

    cli = ClienteFalso(200)
    drenar(cli, agora=antes - 10_000)
    depois = int(time.time())

    enviado = int(cli.chamadas[0]["headers"]["X-FaucetChain-Timestamp"])
    assert antes <= enviado <= depois, (antes, enviado, depois)

    # e a assinatura fecha com esse timestamp, nao com o outro
    esperado = "sha256=" + hmac.new(SEGREDO.encode(),
                                    str(enviado).encode() + b"." + cli.chamadas[0]["content"],
                                    hashlib.sha256).hexdigest()
    assert cli.chamadas[0]["headers"]["X-FaucetChain-Signature"] == esperado


def test_sem_segredo_nada_e_enfileirado():
    desligar()
    limpar_fila()
    assert enfileirar("ping", {}) is None
    assert fila() == []
    ligar()


# ------------------------------------------------------- de quem e o evento

def test_withdrawal_settled_leva_o_que_a_parceira_espera():
    ligar()
    limpar_fila()
    conta = usuario_novo()
    srv._avisar_saque("withdrawal.settled", TORNEIRA, conta, 10.0, "CLAIM", "0xabc")

    corpo = json.loads(fila()[0]["body"])
    assert corpo["type"] == "withdrawal.settled", corpo
    d = corpo["data"]
    assert d["account"] == conta, d
    assert d["solana_address"], d
    assert d["amount"] == 10.0, d        # unidades legiveis
    assert d["token"] == "CLAIM", d
    assert d["tx_hash"] == "0xabc", d
    assert d["faucet_wallet"] == TORNEIRA, d


def test_saque_de_outra_torneira_nao_vira_evento():
    ligar()
    limpar_fila()
    outra = "0x" + "99" * 20
    conta = usuario_novo(torneira=outra)
    srv._avisar_saque("withdrawal.settled", outra, conta, 10.0, "CLAIM", "0xabc")
    assert fila() == [], fila()


def test_usuario_sem_carteira_solana_nao_vira_evento():
    """solana_address e obrigatorio do outro lado: sem ele o evento chega inutil."""
    ligar()
    limpar_fila()
    conta = usuario_novo(com_solana=False)
    srv._avisar_saque("withdrawal.settled", TORNEIRA, conta, 10.0, "CLAIM", "0xabc")
    assert fila() == [], fila()


def test_withdrawal_failed_leva_o_motivo():
    ligar()
    limpar_fila()
    conta = usuario_novo()
    srv._avisar_saque("withdrawal.failed", TORNEIRA, conta, 10.0, "CLAIM", "",
                      reason="Faucet reserve insufficient")

    d = json.loads(fila()[0]["body"])["data"]
    assert d["reason"] == "Faucet reserve insufficient", d


def test_saque_de_token_converte_para_unidades_legiveis():
    ligar()
    limpar_fila()
    conta = usuario_novo()
    mint = "mintTesteWebhook"
    conn = conexao()
    conn.execute("INSERT OR REPLACE INTO token_registry (mint, cluster, name, symbol, "
                 "decimals, token_program, settleable, added_at) "
                 "VALUES (?, 'devnet', 'FWLT Test', 'FWLT', 6, 'Tokenkeg', 1, ?)",
                 (mint, int(time.time())))
    sol = conn.execute("SELECT solana_address FROM solana_links WHERE user_address = ?",
                       (conta,)).fetchone()[0]
    conn.commit()
    conn.close()

    srv._avisar_saque_de_token("sigABC", sol, mint, 12_500_000)

    d = json.loads(fila()[0]["body"])["data"]
    assert d["amount"] == 12.5, d     # 12_500_000 com 6 casas
    assert d["token"] == "FWLT", d
    assert d["account"] == conta, d


# -------------------------------------------------------------- reserva

def _reserva(devido, caucao, livre):
    """Monta divida, caucao e saldo livre da torneira parceira."""
    conn = conexao()
    conn.execute("DELETE FROM microclaims_ledger WHERE faucet_wallet = ?", (TORNEIRA,))
    conn.execute("INSERT INTO microclaims_ledger (faucet_wallet, user_wallet, virtual_balance, "
                 "total_claimed, claim_count, last_claim_at, created_at) "
                 "VALUES (?, '0xdevedor', ?, ?, 1, ?, ?)",
                 (TORNEIRA, devido, devido, int(time.time()), int(time.time())))
    try:
        conn.execute("INSERT OR REPLACE INTO faucet_reserves (faucet_wallet, amount, declared_at) "
                     "VALUES (?, ?, ?)", (TORNEIRA, caucao, int(time.time())))
    except Exception:
        pass
    conn.commit()
    conn.close()

    async def saldo_falso(_):
        return {"total_claim": livre}
    srv.get_user_balance = saldo_falso


def test_reserva_descoberta_avisa_uma_vez_e_nao_toda_volta():
    ligar()
    limpar_fila()
    original = srv.get_user_balance
    try:
        _reserva(devido=100.0, caucao=0.0, livre=5.0)
        asyncio.run(srv._conferir_reserva_da_parceira())
        assert [json.loads(l["body"])["type"] for l in fila()] == ["faucet.reserve_low"], fila()

        asyncio.run(srv._conferir_reserva_da_parceira())
        assert len(fila()) == 1, "segundo aviso do mesmo estado nao pode sair"
    finally:
        srv.get_user_balance = original


def test_reserva_que_volta_a_cobrir_manda_reserve_ok():
    ligar()
    limpar_fila()
    original = srv.get_user_balance
    try:
        _reserva(devido=100.0, caucao=0.0, livre=5.0)
        asyncio.run(srv._conferir_reserva_da_parceira())
        _reserva(devido=100.0, caucao=0.0, livre=500.0)
        asyncio.run(srv._conferir_reserva_da_parceira())

        tipos = [json.loads(l["body"])["type"] for l in fila()]
        assert tipos == ["faucet.reserve_low", "faucet.reserve_ok"], tipos
    finally:
        srv.get_user_balance = original


def test_sem_divida_nao_ha_descoberto():
    ligar()
    limpar_fila()
    original = srv.get_user_balance
    try:
        _reserva(devido=0.0, caucao=0.0, livre=0.0)
        asyncio.run(srv._conferir_reserva_da_parceira())
        assert fila() == [], "torneira sem divida nao esta descoberta"
    finally:
        srv.get_user_balance = original


def test_a_caucao_conta_junto_com_o_saldo_livre():
    """O saque paga da caucao primeiro e do saldo livre depois. A conta do
    aviso tem que ser a mesma do pagamento."""
    ligar()
    limpar_fila()
    original = srv.get_user_balance
    try:
        # 60 de caucao + 50 livres cobrem os 100 devidos
        _reserva(devido=100.0, caucao=60.0, livre=50.0)
        asyncio.run(srv._conferir_reserva_da_parceira())
        assert fila() == [], fila()
    finally:
        srv.get_user_balance = original


if __name__ == "__main__":
    testes = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    falhas = 0
    conn = conexao()
    webhooks.criar_tabelas(conn)
    conn.commit()
    conn.close()
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
