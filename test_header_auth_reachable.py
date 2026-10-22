# -*- coding: utf-8 -*-
"""Uma rota que exige cabecalho nao pode ser alcancada por navegacao.

    python test_header_auth_reachable.py

Em 21/10/2026 o vinculo de conta Google nunca funcionou uma vez sequer. O
servidor exigia `X-Session-Token` em `/api/auth/google/start?link=1`, e a tela
chamava a rota com `<a href>`. Navegacao de pagina nao carrega cabecalho
nenhum: toda tentativa respondia 401, pedindo para entrar a alguem que ja
estava dentro.

Quinze checks cobriam esse fluxo e nenhum pegou, porque todos usavam o
TestClient mandando o cabecalho a mao -- coisa que o navegador faz num `fetch`
e nao pode fazer numa navegacao. Era um dublê exercitando um caminho que o
produto nao tem.

Este check nao roda o fluxo: cruza os dois lados. Para cada rota que o servidor
recusa sem cabecalho, procura no front uma navegacao ate ela.

Navegacao, porque nenhuma destas leva cabecalho:

    <a href={...}>      window.location = / .href =     location.assign(...)
    window.open(...)    <form action={...}>

`fetch` leva cabecalho e nao e apontado: e por onde essas rotas devem ser
chamadas.
"""
import io
import os
import re
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
SERVIDOR = os.path.join(RAIZ, "api_server.py")
TELAS = os.path.join(RAIZ, "components")

CABECALHOS = ("x_session_token", "x_api_key", "x_node_token", "x_operator_token")

FONTE = io.open(SERVIDOR, encoding="utf-8").read()

# Navegacao permitida, com a razao -- o mesmo acordo do OPEN_BY_DESIGN em
# test_endpoint_inventory.py: ou conserta, ou nomeia aqui e diz por que.
#
# Nomear so vale quando a rota de fato funciona sem o cabecalho naquele uso.
# Uma rota pode exigir a sessao em um ramo e nao exigir em outro, e tentar
# deduzir isso do codigo rendeu mais falso positivo que acerto: um check que
# acusa inocente e um check que alguem desliga.
NAVEGACAO_POR_DESIGN = {
    ("Header.tsx", "/api/auth/google/start"):
        "login com Google, sem link=1: este ramo nao pede sessao nenhuma e o "
        "redirecionamento de pagina inteira e justamente o desenho -- o popup "
        "exigiria connect-src aberto. So `?link=1` exige o cabecalho, e esse "
        "caminho usa fetch no PrivacySettings.",
}

# Nenhuma destas formas de ir a uma URL carrega cabecalho. A query entra na
# captura de proposito: ela decide se uma exigencia condicional e acionada.
NAVEGACAO = re.compile(
    r"""<a\s[^>]*href=\{?[`'"][^`'"]*?(?P<a>/api/[^`'"\s]+)"""
    r"""|window\.location(?:\.href)?\s*=\s*[`'"][^`'"]*?(?P<b>/api/[^`'"\s]+)"""
    r"""|location\.assign\(\s*[`'"][^`'"]*?(?P<c>/api/[^`'"\s]+)"""
    r"""|window\.open\(\s*[`'"][^`'"]*?(?P<d>/api/[^`'"\s]+)"""
    r"""|<form\s[^>]*action=\{?[`'"][^`'"]*?(?P<e>/api/[^`'"\s]+)""",
    re.S,
)


def rotas_com_cabecalho():
    """{caminho: [cabecalhos na assinatura]}."""
    achadas = {}
    for m in re.finditer(r'@app\.(?:get|post|put|patch|delete)\("([^"]+)"\)\s*\n'
                         r'(?:async\s+)?def\s+\w+\(([^)]*)\)', FONTE):
        caminho, assinatura = m.group(1), m.group(2)
        exige = [h for h in CABECALHOS if h in assinatura]
        if exige:
            achadas[caminho] = exige
    return achadas


def recusa_sem_cabecalho(caminho: str) -> bool:
    """A rota responde 401, ou chama uma guarda que responde?"""
    i = FONTE.find(f'"{caminho}"')
    if i < 0:
        return False
    fim = FONTE.find("@app.", i + 10)
    corpo = FONTE[i:fim if fim > 0 else len(FONTE)]
    return bool(re.search(r"status_code=401|require_(?:action_signature|operator|node_token)", corpo))


def main() -> int:
    duras = {}
    protegidas = rotas_com_cabecalho()
    for caminho, hs in protegidas.items():
        if recusa_sem_cabecalho(caminho):
            duras[caminho] = hs
    print(f"{len(protegidas)} rotas pedem cabecalho; {len(duras)} recusam sem ele; "
          f"{len(NAVEGACAO_POR_DESIGN)} navegacao(oes) permitida(s) por design\n")

    faltas = []
    for arquivo in sorted(f for f in os.listdir(TELAS) if f.endswith(".tsx")):
        texto = io.open(os.path.join(TELAS, arquivo), encoding="utf-8").read()
        for m in NAVEGACAO.finditer(texto):
            alvo = next((g for g in m.groups() if g and g.startswith("/api/")), None)
            if not alvo:
                continue
            sem_query = alvo.split("?")[0]
            for caminho, hs in duras.items():
                base = caminho.split("{")[0].rstrip("/")   # /api/x/{id} casa com /api/x
                if not base or not sem_query.startswith(base):
                    continue
                if (arquivo, caminho) in NAVEGACAO_POR_DESIGN:
                    continue
                linha = texto[:m.start()].count("\n") + 1
                faltas.append((arquivo, linha, alvo, caminho, hs))

    if faltas:
        print(f"{len(faltas)} navegacao(oes) ate rota que recusa sem cabecalho:\n")
        for arq, linha, alvo, caminho, hs in faltas:
            print(f"  components/{arq}:{linha}")
            print(f"    navega para {alvo}")
            print(f"    {caminho} exige {', '.join(hs)} e recusa sem ele")
            print("    navegacao nao leva cabecalho: use fetch e navegue depois,")
            print("    ou nomeie em NAVEGACAO_POR_DESIGN com a razao\n")
        return 1

    print("nenhuma navegacao ate rota protegida por cabecalho")
    return 0


if __name__ == "__main__":
    sys.exit(main())
