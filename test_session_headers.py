# -*- coding: utf-8 -*-
"""O navegador tem de mandar a sessao para toda rota que exige assinatura.

O espelho de test_endpoint_inventory.py, do outro lado do fio. Aquele garante
que nenhuma rota que muda estado confie em ninguem sem motivo; este garante que
o motivo chega.

Uma conta criada por este produto e custodial: o servidor guarda a chave, entao
ela nao assina nada, e o cabecalho X-Session-Token faz o lugar da assinatura.
Esquecer o cabecalho nao quebra nada visivelmente no codigo -- compila, o botao
aparece, o clique sai -- e o servidor responde 401 com "This account acts
through a session. Sign in again", que manda o usuario procurar problema no
login dele. Foi o que aconteceu com a declaracao de reserva no FaucetHub, e
antes dela, sem ninguem notar, com o reveal e o rotate da chave de API: nenhuma
torneira era custodial ainda, entao aquele caminho nunca tinha sido exercido.

    python test_session_headers.py
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
COMPONENTS = os.path.join(ROOT, "components")

# As rotas que passam por require_action_signature no servidor. Lidas do fonte
# em vez de listadas a mao: uma rota nova entra aqui sozinha.
def rotas_que_exigem_assinatura() -> set:
    src = open(os.path.join(ROOT, "api_server.py"), encoding="utf-8").read()
    rotas, atual = set(), None
    for linha in src.split("\n"):
        m = re.match(r'@app\.(post|put|patch|delete)\("([^"]+)"', linha.strip())
        if m:
            atual = m.group(2)
        elif atual and "require_action_signature" in linha:
            rotas.add(atual)
            atual = None
        elif linha.startswith("@app.") or (linha.startswith("def ") and atual):
            pass
    return rotas


# Chamadas que o navegador faz sem agir por ninguem: leem, ou criam algo que
# ainda nao pertence a conta nenhuma. Cada nome aqui e uma decisao, como a lista
# do inventario do servidor.
SEM_SESSAO = {
    "/api/faucethub/register": "registra uma torneira nova; o servidor ainda nao exige prova de quem registra",
}


def main() -> int:
    exigem = rotas_que_exigem_assinatura()
    assert exigem, "nenhuma rota com require_action_signature foi encontrada; o leitor quebrou"

    faltando = []
    for nome in sorted(os.listdir(COMPONENTS)):
        if not nome.endswith(".tsx"):
            continue
        caminho = os.path.join(COMPONENTS, nome)
        texto = open(caminho, encoding="utf-8").read()
        linhas = texto.split("\n")
        for i, linha in enumerate(linhas):
            if "fetch(" not in linha:
                continue
            # O prefixo mais longo que casa. Com o mais curto, uma chamada a
            # /api/bounties/create era relatada como /api/bounties/{id}/cancel,
            # e o relatorio mandava o leitor olhar o arquivo errado.
            casam = [r for r in exigem if r.split("{")[0].rstrip("/") in linha]
            rota = max(casam, key=lambda r: len(r.split("{")[0])) if casam else None
            if not rota or rota in SEM_SESSAO:
                continue
            # o corpo da chamada: ate a chave que fecha, no maximo 10 linhas
            corpo = "\n".join(linhas[i:i + 10])
            # Um GET para a mesma familia de rota nao age por ninguem:
            # /api/bounties/list casa com o prefixo de /api/bounties/{id}/cancel
            # e nao muda nada. So chamadas que mudam estado interessam aqui.
            if not re.search(r"""method:\s*['"](POST|PUT|PATCH|DELETE)['"]""", corpo):
                continue
            if "sessionHeaders()" not in corpo:
                faltando.append(f"{nome}:{i + 1}  {rota}")

    if faltando:
        print("Estas chamadas agem em nome da conta logada e nao mandam a sessao:\n")
        for f in faltando:
            print("   " + f)
        print(
            "\nEspalhe ...sessionHeaders() nos headers, ou -- se a chamada nao age\n"
            "por ninguem -- nomeie a rota em SEM_SESSAO com o motivo.\n"
        )
        return 1

    print(f"{len(exigem)} rotas exigem assinatura; toda chamada do front manda a sessao")
    return 0


if __name__ == "__main__":
    sys.exit(main())
