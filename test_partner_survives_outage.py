# -*- coding: utf-8 -*-
"""Com a FaucetChain fora do ar, a torneira parceira continua pagando.

E o unico teste aqui que protege o parceiro em vez de nos, e o mais facil de
pular por parecer redundante. Ele existe porque a FaucetHunter esta em producao:
se esta rede cair e levar o claim deles junto, quem perde usuario e eles.

Tres coisas sustentam isso, e as tres sao verificadas abaixo:

  1. A ordem. `claim.php` roda `$pdo->commit()` ANTES de chamar a ponte, entao
     o usuario ja esta pago quando esta rede entra na historia. Sem essa ordem
     nada mais importa.
  2. O silencio. A ponte devolve null em cada caminho de falha -- inalcancavel,
     429, corpo ilegivel, HTTP >= 400 -- e nunca lanca.
  3. O custo. A chamada tem orcamento de 2s para conectar e 4s no total, e um
     sequenciador fora do ar precisa caber nisso.

O que este arquivo nao consegue testar e o PHP em si, que nao roda aqui. Ele
testa o contrato de que o PHP depende: a semantica de timeout do curl contra uma
porta fechada, que e exatamente o que a ponte experimenta.

    python test_partner_survives_outage.py
"""

import os
import re
import socket
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
PONTE = os.path.join(ROOT, "integration", "faucethunter", "api", "faucetchain.php")
PATCHES = os.path.join(ROOT, "integration", "faucethunter", "PATCHES.md")

CONNECT_TIMEOUT = 2      # CURLOPT_CONNECTTIMEOUT na ponte
TOTAL_TIMEOUT = 4        # CURLOPT_TIMEOUT na ponte


def porta_fechada() -> int:
    """Uma porta que ninguem escuta: o sequenciador fora do ar, do lado de ca."""
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    porta = s.getsockname()[1]
    s.close()
    return porta


def main() -> int:
    ponte = open(PONTE, encoding="utf-8").read()
    patches = open(PATCHES, encoding="utf-8").read()

    # --- 1. a ordem, que e a protecao de verdade ------------------------
    commit = patches.index("$pdo->commit();")
    chamada = patches.index("faucetchainNotifyClaim($pdo, $userId)")
    assert commit < chamada, (
        "a ponte e chamada ANTES do commit; uma queda desta rede levaria o "
        "claim do parceiro junto")
    assert "catch (Throwable" in patches[commit:chamada + 400], (
        "a chamada nao esta dentro de um try proprio no claim.php")

    # --- 2. todo caminho de falha devolve null --------------------------
    # Os quatro que a ponte distingue. Contados no fonte porque um `return`
    # trocado por um `throw` em qualquer um deles derruba o claim do parceiro,
    # e isso nao apareceria em teste nenhum deste lado.
    for trecho in ("$raw === false", "$status === 429",
                   "!is_array($body)", "$status >= 400"):
        i = ponte.index(trecho)
        corpo = ponte[i:i + 400]
        assert "return null" in corpo, f"o caminho `{trecho}` nao devolve null"
        assert "throw" not in corpo, f"o caminho `{trecho}` lanca excecao"

    # Sem endereco Solana salvo a ponte nem chama: o usuario segue web2 e o
    # claim dele nao paga o preco de uma rede que ele nao usa.
    assert "if ($solanaAddress === '')" in ponte and ponte.count("return null") >= 5

    # --- 3. os orcamentos declarados no fonte ---------------------------
    conn = int(re.search(r"CURLOPT_CONNECTTIMEOUT\s*=>\s*(\d+)", ponte).group(1))
    total = int(re.search(r"CURLOPT_TIMEOUT\s*=>\s*(\d+)", ponte).group(1))
    assert conn == CONNECT_TIMEOUT, f"connect timeout virou {conn}s"
    assert total == TOTAL_TIMEOUT, f"timeout total virou {total}s"

    # --- 4. e o que acontece de verdade contra uma porta morta ----------
    url = "http://127.0.0.1:%d/api/faucethub/microclaim" % porta_fechada()
    req = urllib.request.Request(url, data=b'{"user_wallet":"x","amount":1.0}',
                                 headers={"Content-Type": "application/json"},
                                 method="POST")
    t0 = time.time()
    try:
        urllib.request.urlopen(req, timeout=TOTAL_TIMEOUT)
        raise AssertionError("a porta deveria estar fechada")
    except (urllib.error.URLError, OSError):
        pass
    gasto = time.time() - t0
    assert gasto <= TOTAL_TIMEOUT + 0.5, (
        "a chamada gastou %.2fs, acima do orcamento de %ds; cada claim do "
        "parceiro esperaria isso" % (gasto, TOTAL_TIMEOUT))

    # O custo e real e vale dito em voz alta: enquanto esta rede estiver fora,
    # cada claim da FaucetHunter fica ate CONNECT_TIMEOUT mais lento. O usuario
    # e pago -- o commit ja aconteceu -- mas a pagina dele demora mais. Nao ha
    # circuit breaker na ponte; se um dia houver, este numero cai para zero a
    # partir da segunda tentativa.
    print("test_partner_survives_outage.py OK")
    print("  fora do ar, cada claim do parceiro custa ate %ds a mais (gastou %.2fs)"
          % (CONNECT_TIMEOUT, gasto))
    return 0


if __name__ == "__main__":
    sys.exit(main())
