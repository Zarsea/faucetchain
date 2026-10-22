"""O Sentinel segurando claim de quem não fez nada de errado.

Em 21/10/2026 a conta do operador recebeu "Sentinel flagged this pattern and
held the claim" depois de reivindicar direito, uma vez por hora, por semanas.

A regra comprimia uma impressão digital de valor e gasPrice e chamava
repetição de Sybil. Os dois são constantes deste sistema, não escolhas de quem
clica: todo claim de mérito paga `current_claim_reward()`, igual para todo
mundo na mesma janela de emissão, e a rota preenche `gasPrice` com 0 antes da
sequência chegar lá. A digital ainda arredondava o valor para a dezena, então
5,59 e 6,81 viravam ambos "10".

Toda sequência honesta virava `10_0|10_0|10_0|…`, comprimia perfeitamente, e o
detector lia a uniformidade da nossa própria emissão como assinatura de fraude.
Medido: um usuário legítimo cruzava o limiar de 0,75 nos vinte claims — que é
exatamente quantos a rota lê. Ninguém fiel passava de vinte.

Nenhum teste pegou porque nenhum usou um padrão legítimo real. É o que estes
checks fazem, e o primeiro deles é o que faltava:

    .venv/Scripts/python.exe tests/test_fraud_cadence.py
"""
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from FraudAndBonusDetector import FraudDetector  # noqa: E402

AGORA = int(time.time())
PREMIO = 5.592000000000005   # o que a rede pagava no dia
HORA = 3600


def legitimos(quantos, intervalo=HORA, premio=PREMIO):
    """Claims de quem usa a torneira como ela foi feita para ser usada.

    Mesmo prêmio porque o sistema paga igual; gasPrice 0 porque a rota preenche
    assim; um por hora porque a rota recusa mais que isso com 429.
    """
    return [{"amount": premio, "timestamp": AGORA - i * intervalo, "gasPrice": 0}
            for i in range(quantos)]


d = FraudDetector()


# ─────────────────────────────────────── o que faltava

def test_usuario_fiel_nunca_e_barrado():
    """O check que teria pego o defeito. A rota lê os últimos 20."""
    for n in (3, 5, 10, 20, 50, 200):
        assert not d.has_impossible_cadence(legitimos(n)), (
            f"{n} claims legítimos, um por hora, foram tratados como fraude")


def test_o_premio_ser_sempre_igual_nao_e_fraude():
    """Era exatamente isto que a regra antiga media."""
    assert not d.has_impossible_cadence(legitimos(30, premio=PREMIO))
    assert not d.has_impossible_cadence(legitimos(30, premio=6.81))
    assert not d.has_impossible_cadence(legitimos(30, premio=0.5))


def test_gasprice_zero_nao_e_fraude():
    """A rota preenche 0 em todos. Medir variação onde não há variação só
    produz falso positivo."""
    claims = legitimos(30)
    assert all(c["gasPrice"] == 0 for c in claims)
    assert not d.has_impossible_cadence(claims)


def test_valores_que_arredondam_para_a_mesma_dezena():
    """5,59 e 6,81 viravam '10' os dois. Agora o valor não entra na conta."""
    for premio in (5.59, 6.81, 9.99, 10.0, 14.9):
        assert not d.has_impossible_cadence(legitimos(25, premio=premio)), premio


# ─────────────────────────────────────── o que ainda deve barrar

def test_claims_mais_rapidos_que_o_possivel_sao_barrados():
    """A rota recusa claim com menos de uma hora. Um par separado por
    segundos é prova de que a trava foi contornada."""
    assert d.has_impossible_cadence(legitimos(5, intervalo=10))
    assert d.has_impossible_cadence(legitimos(5, intervalo=59))


def test_um_unico_par_rapido_no_meio_de_uma_historia_limpa():
    """Não basta a média: um par impossível já conta."""
    claims = legitimos(20)
    claims.append({"amount": PREMIO, "timestamp": claims[0]["timestamp"] + 5, "gasPrice": 0})
    assert d.has_impossible_cadence(claims)


def test_exatamente_no_limite_passa():
    assert not d.has_impossible_cadence(legitimos(5, intervalo=d.min_claim_interval))


def test_menos_de_tres_claims_nunca_e_padrao():
    assert not d.has_impossible_cadence(legitimos(2, intervalo=1))
    assert not d.has_impossible_cadence([])


def test_ordem_invertida_nao_inventa_intervalo_negativo():
    """A rota entrega os claims do mais novo para o mais velho."""
    claims = legitimos(5)
    assert not d.has_impossible_cadence(claims)
    assert not d.has_impossible_cadence(list(reversed(claims)))


# ─────────────────────────────────────── o nome antigo

def test_o_nome_antigo_continua_respondendo():
    """Remover de uma vez quebraria chamador fora deste repositório."""
    assert d.is_sybil_pattern(legitimos(5, intervalo=10)) is True
    assert d.is_sybil_pattern(legitimos(20)) is False


def test_a_regra_antiga_reprovaria_estes_checks():
    """Prova que os checks pegam o defeito, em vez de passar por sorte.

    Reconstrói a digital que foi removida e mostra que ela comprime a ponto de
    cruzar o limiar que existia, usando os mesmos claims honestos do primeiro
    teste.
    """
    import zlib
    claims = legitimos(20)
    digital = ''.join(f"{int(round(c['amount'], -1))}_{int(round(c['gasPrice'], 0))}|"
                      for c in claims)
    bruto = digital.encode()
    similaridade = max(0.0, 1.0 - len(zlib.compress(bruto)) / len(bruto))
    assert similaridade > 0.75, (
        f"a digital antiga comprimia a {similaridade:.3f}; o defeito não se reproduz")
    assert not d.has_impossible_cadence(claims), "a regra nova caiu no mesmo buraco"


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
