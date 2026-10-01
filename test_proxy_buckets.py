# -*- coding: utf-8 -*-
"""Atras de um proxy, cada visitante precisa do proprio contador.

Sem isto o tunel entrega tudo pelo loopback, o servidor ve 127.0.0.1 em cada
requisicao, e o teto por minuto e de todo mundo junto: um abusador sozinho
derruba o servico para os outros, e os tetos por IP viram tetos globais. A conta
nao e teorica -- um explorer aberto ja faz cerca de 120 chamadas por minuto com
os proprios intervalos, contra um teto de 100.

Ler X-Forwarded-For na mao seria pior do que nao ler: qualquer um manda esse
cabecalho e escolhe o proprio balde. Quem faz a coisa certa e o
ProxyHeadersMiddleware do uvicorn, que so honra o cabecalho quando a conexao TCP
veio de um proxy nomeado. As duas metades sao prendidas aqui, porque uma sem a
outra e pior do que nenhuma:

  1. com o proxy confiavel, dois visitantes recebem contadores diferentes;
  2. sem ele, o cabecalho e ignorado e as chamadas caem todas num balde so.

    python test_proxy_buckets.py
"""

import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
ALVO = "/api/solana/holdings/0x" + "11" * 20
IPS = ("203.0.113.10", "198.51.100.20")


def contadores(app, peer) -> dict:
    """Quantas chamadas cada chave de rate limit acumulou."""
    from fastapi.testclient import TestClient
    import api_server

    api_server._rate_windows.clear()
    # O cliente se apresenta como `peer`: e o endereco TCP que o middleware
    # compara com a lista de confiaveis antes de olhar o cabecalho.
    with TestClient(app, client=(peer, 50000)) as client:
        for ip in IPS:
            for _ in range(3):
                client.get(ALVO, headers={"X-Forwarded-For": ip})
    return {k: len(v) for k, v in api_server._rate_windows["holdings"].items()}


def main() -> int:
    sys.path.insert(0, ROOT)
    import api_server
    from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

    # holdings pacea por IP. Foi o endpoint que a auditoria achou sem teto
    # nenhum -- 40 de 40 rajadas passaram -- entao este teste cobre a correcao
    # do teto e a do proxy de uma vez.
    atras_do_proxy = ProxyHeadersMiddleware(api_server.app, trusted_hosts="127.0.0.1")

    com = contadores(atras_do_proxy, "127.0.0.1")
    assert set(com) == set(IPS), (
        "os IPs encaminhados nao viraram contadores proprios: %r" % com)
    assert all(n == 3 for n in com.values()), com

    # O mesmo cabecalho, vindo de quem nao e o proxy: ignorado. Sem isto
    # qualquer um escolheria o proprio balde mandando X-Forwarded-For, que e
    # trocar um problema por um pior.
    forjado = contadores(atras_do_proxy, "203.0.113.99")
    assert not (set(forjado) & set(IPS)), (
        "o cabecalho foi obedecido vindo de fora do proxy: %r" % forjado)
    assert sum(forjado.values()) == 6, (
        "as seis chamadas tinham de cair num balde so: %r" % forjado)

    # E sem middleware nenhum, que e como o servidor rodou ate hoje.
    sem = contadores(api_server.app, "127.0.0.1")
    assert not (set(sem) & set(IPS)), sem
    assert sum(sem.values()) == 6, sem

    print("test_proxy_buckets.py OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
