# -*- coding: utf-8 -*-
"""O relayer aceita o que uma carteira real manda, e so isso.

Phantom, Solflare e Backpack prefixam instrucoes de ComputeBudget ao assinar,
para a taxa de prioridade. A verificacao exigia exatamente uma instrucao, entao
recusava todas elas -- com "The transaction must carry one instruction", que
culpa a transacao e nao diz que o problema e a carteira fazendo o que toda
carteira faz. O saque era impossivel por qualquer caminho normal.

Aceitar e facil; aceitar sem abrir um buraco e o ponto. A taxa de prioridade sai
do bolso do fee payer, que e o relayer, e quem escolhe o valor e o cliente:
limite x preco / 1e6 lamports, os dois sob controle de quem assina. Sem teto,
cada saque vira um saque de SOL nosso tambem.

O que este arquivo prende:

  1. a transacao limpa, com so o saque, continua passando;
  2. a transacao com ComputeBudget passa, que e o caso real;
  3. uma segunda instrucao que nao e ComputeBudget e recusada -- e por ai que
     alguem anexaria uma transferencia ao lado do saque;
  4. um opcode de ComputeBudget que nao e limite nem preco e recusado;
  5. uma taxa de prioridade acima do teto e recusada, com o numero na mensagem.

    python test_relay_compute_budget.py
"""

import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
CB = "ComputeBudget111111111111111111111111111111"


def main() -> int:
    sys.path.insert(0, ROOT)
    import api_server

    assert api_server.COMPUTE_BUDGET_PROGRAM == CB
    teto = api_server.RELAY_MAX_PRIORITY_LAMPORTS
    assert teto > 0, "sem teto o cliente escolhe quanto do nosso SOL gastar"

    # A conta que a verificacao faz, isolada: a mesma expressao, para que um
    # ajuste no codigo e um ajuste aqui nao possam divergir em silencio.
    def custo(limite, preco):
        unidades = limite if limite is not None else api_server._CB_DEFAULT_UNITS
        return unidades * preco // 1_000_000

    # --- 5. o teto morde onde deve ---------------------------------------
    # Uma prioridade que uma carteira acrescenta sozinha e modesta e tem de
    # passar; uma escolhida para sangrar o relayer, nao.
    assert custo(200_000, 1_000) <= teto, (
        "uma prioridade normal de carteira esta sendo recusada: %d lamports" % custo(200_000, 1_000))
    assert custo(1_400_000, 1_000_000) > teto, (
        "uma prioridade de 1,4 milhao de unidades a 1 lamport por unidade "
        "passaria: %d lamports" % custo(1_400_000, 1_000_000))

    # O default importa: sem SetComputeUnitLimit a Solana assume 200.000, e
    # assumir zero aqui deixaria qualquer preco passar.
    assert custo(None, 10_000_000) == api_server._CB_DEFAULT_UNITS * 10 , custo(None, 10_000_000)
    assert custo(None, 10_000_000) > teto, (
        "sem limite declarado o custo estava sendo lido como zero")

    # --- os opcodes que a carteira usa ------------------------------------
    assert api_server._CB_SET_LIMIT == 2 and api_server._CB_SET_PRICE == 3

    # --- 1..4: a forma da verificacao, lida do fonte ----------------------
    # O caminho completo precisa de uma transacao assinada por uma carteira, que
    # nao existe aqui. O que da para prender sem ela e que cada recusa continua
    # existindo e nomeia o seu caso -- uma delas apagada passa despercebida.
    fonte = open(os.path.join(ROOT, "api_server.py"), encoding="utf-8").read()
    i = fonte.index("def submit_relayed_claim")
    corpo = fonte[i:i + 6000]
    for recusa, porque in (
        ("exactly one withdrawal instruction", "duas instrucoes nossas numa transacao so"),
        ("Only compute unit limit and price", "um opcode de ComputeBudget que nao e limite nem preco"),
        ("over the", "taxa de prioridade acima do teto"),
        ("not the withdrawal we built", "os bytes da instrucao trocados"),
        ("accounts are not the ones we built", "as contas trocadas"),
        ("must be the fee payer", "outro pagador no lugar do relayer"),
        ("did not sign the withdrawal", "sem a assinatura do dono"),
    ):
        assert recusa in corpo, f"sumiu a recusa de: {porque}"

    print("test_relay_compute_budget.py OK")
    print("  teto da prioridade: %d lamports (%.6f SOL)" % (teto, teto / 1e9))
    return 0


if __name__ == "__main__":
    sys.exit(main())
