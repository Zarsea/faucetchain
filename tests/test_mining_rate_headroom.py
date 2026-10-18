"""O teto de chamadas do minerador contra o que um nó honesto gasta.

Em 18/10/2026 um nó rodando normalmente levou 429 no heartbeat, apareceu
offline no painel e perdeu a época. Não era abuso: era a aritmética.

    heartbeat, a cada 30s   120/hora
    explore,   a cada 30s   120/hora
                            ---------
                            240/hora   de um nó que só faz o que deve

O teto era 300, e o balde "mining" é UM só para heartbeat, explore e
disconnect. Sessenta chamadas de folga não cobrem um reinício, uma reconexão
ou uma tentativa repetida — e quem paga é o nó honesto, que some do painel
sem ter feito nada errado.

Estes checks protegem a relação, não o número. Quem quiser baixar o teto tem
de refazer a conta acima primeiro, porque é ela que falha aqui.

    .venv/Scripts/python.exe tests/test_mining_rate_headroom.py
"""
import os
import re
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-mining-rate-")
os.chdir(TMP)
sys.path.insert(0, ROOT)

os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402

HORA = 3600


def _cadencia_do_no():
    """Os intervalos que o cliente usa de verdade, lidos do cliente.

    Codificar 30 aqui separaria o teste do nó: alguém acelera o heartbeat em
    miner-core.js, o nó passa a gastar o dobro, e este arquivo continua
    aprovando um teto que não cabe mais.
    """
    fonte = open(os.path.join(ROOT, "mining-node", "miner-core.js"),
                 encoding="utf-8").read()
    explore = re.search(r"const EXPLORE_SECONDS\s*=\s*(\d+)", fonte)
    heartbeat = re.search(r"this\.heartbeatInterval\s*=\s*(\d+)", fonte)
    assert explore and heartbeat, "não achei os intervalos em miner-core.js"
    return int(heartbeat.group(1)), int(explore.group(1))


def _gasto_honesto_por_hora():
    heartbeat, explore = _cadencia_do_no()
    return HORA // heartbeat + HORA // explore


def test_o_teto_cabe_o_trafego_honesto():
    gasto = _gasto_honesto_por_hora()
    assert srv.MINING_HOURLY_PER_NODE > gasto, (
        f"um nó honesto gasta {gasto}/hora e o teto é "
        f"{srv.MINING_HOURLY_PER_NODE}: ele leva 429 sem ter feito nada errado")


def test_sobra_folga_para_reinicio_e_reconexao():
    """Caber no limite não basta: um nó que reinicia gasta mais naquela hora,
    e é justamente quando ele não pode ser bloqueado."""
    gasto = _gasto_honesto_por_hora()
    assert srv.MINING_HOURLY_PER_NODE >= gasto * 2, (
        f"folga de só {srv.MINING_HOURLY_PER_NODE - gasto} chamadas sobre "
        f"{gasto}/hora; um reinício consome isso")


def test_o_teto_ainda_segura_um_laco_solto():
    """Folga não pode virar porta aberta. Um laço chamando de segundo em
    segundo faria 3600/hora, e isso tem de continuar sendo recusado."""
    assert srv.MINING_HOURLY_PER_NODE < HORA, (
        "com este teto, um nó chamando a cada segundo passaria inteiro")


def test_as_tres_rotas_dividem_o_mesmo_balde():
    """Se um dia forem separadas, a conta acima muda e este arquivo precisa
    mudar junto. O check existe para avisar, não para impedir."""
    fonte = open(os.path.join(ROOT, "api_server.py"), encoding="utf-8").read()
    usos = fonte.count('within_rate("mining", req.node_id, MINING_HOURLY_PER_NODE)')
    assert usos == 3, (
        f"{usos} rotas usam o balde 'mining' (eram 3: heartbeat, explore, "
        f"disconnect). Se mudou, refaça o gasto por hora deste teste")


def test_o_balde_nao_conta_a_chamada_que_recusou():
    """Senão um nó bloqueado nunca sai do bloqueio: cada tentativa recusada
    renovaria a janela, e a punição não teria fim."""
    chave = "no-de-teste"
    for _ in range(5):
        assert srv.within_rate("teste-balde", chave, 5)
    assert not srv.within_rate("teste-balde", chave, 5)
    # a recusa não pode ter entrado na lista
    assert len(srv._rate_windows["teste-balde"][chave]) == 5


if __name__ == "__main__":
    testes = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    falhas = 0
    hb, ex = _cadencia_do_no()
    print("cadência lida de miner-core.js: heartbeat %ds, explore %ds -> %d/hora"
          % (hb, ex, _gasto_honesto_por_hora()))
    print("teto configurado: %d/hora\n" % srv.MINING_HOURLY_PER_NODE)
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
