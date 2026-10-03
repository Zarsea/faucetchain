# -*- coding: utf-8 -*-
"""Confere as previas antes de abrir o navegador.

    python preview/check.py

Nao e um validador de HTML. E o bastante para pegar os tres defeitos que
estragam uma previa em silencio, e os tres ja aconteceram aqui:

  **Tag aberta sem fechar.** O layout desaba e o navegador nao reclama.

  **Erro de sintaxe num script inline.** Mata a pagina inteira sem nada visivel:
  os numeros ficam parados nos valores do HTML e parece que o design "nao tem
  interacao". Foi assim que um rotulo perdido no meio de uma concatenacao
  passou -- lendo eu nao vi, `node --check` viu na primeira.

  **Link para arquivo que nao existe.** Num conjunto navegavel este e o defeito
  mais provavel de todos, porque cada pagina nova entra na fita de todas as
  outras.

Os links sao procurados fora dos scripts e, separadamente, dentro deles: um
`href="' + x + '"` montado em JavaScript nao e um caminho, e tratar como se
fosse foi o primeiro falso positivo deste arquivo.
"""
import io
import os
import re
import subprocess
import sys
import tempfile
from html.parser import HTMLParser

DIR = os.path.dirname(os.path.abspath(__file__))
VAZIAS = {"area", "base", "br", "col", "embed", "hr", "img", "input",
          "link", "meta", "source", "track", "wbr"}
SCRIPT = re.compile(r"<script\b[^>]*>.*?</script>", re.S)
SCRIPT_INLINE = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.S)
LINK = re.compile(r'(?:href|src)="([^"#:]+?)"')
HTML_EM_JS = re.compile(r"""['"]([A-Za-z0-9_.\-/]+\.html)['"]""")


class Pilha(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.abertas = []
        self.erros = []

    def handle_starttag(self, tag, attrs):
        if tag not in VAZIAS:
            self.abertas.append((tag, self.getpos()[0]))

    def handle_endtag(self, tag):
        if tag in VAZIAS:
            return
        if not self.abertas:
            self.erros.append("linha %d: </%s> sem abertura" % (self.getpos()[0], tag))
            return
        topo, linha = self.abertas[-1]
        if topo == tag:
            self.abertas.pop()
        else:
            self.erros.append("linha %d: </%s> fecha, mas o aberto e <%s> da linha %d"
                              % (self.getpos()[0], tag, topo, linha))


def confere(nome):
    texto = io.open(os.path.join(DIR, nome), encoding="utf-8").read()
    problemas = []

    p = Pilha()
    p.feed(texto)
    problemas += p.erros
    problemas += ["<%s> da linha %d nunca fecha" % (t, l) for t, l in p.abertas]

    for i, m in enumerate(SCRIPT_INLINE.finditer(texto)):
        with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8",
                                         newline="\n", delete=False) as f:
            f.write(m.group(1))
            tmp = f.name
        r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
        os.unlink(tmp)
        if r.returncode:
            # O node termina a stderr com o proprio numero de versao, entao a
            # ultima linha nao e o erro. A que interessa e a do tipo de erro.
            linhas = [x.strip() for x in (r.stderr or "").splitlines() if x.strip()]
            erro = next((x for x in linhas if "Error" in x), None)
            problemas.append("script inline %d: %s" % (i, erro or (linhas[0] if linhas else "erro")))

    # Fora dos scripts: caminhos de verdade. Dentro: so os literais .html, que
    # sao os alvos de navegacao montados em codigo.
    sem_script = SCRIPT.sub("", texto)
    alvos = set(LINK.findall(sem_script))
    for m in SCRIPT_INLINE.finditer(texto):
        alvos |= set(HTML_EM_JS.findall(m.group(1)))

    for alvo in sorted(alvos):
        if not os.path.exists(os.path.join(DIR, alvo)):
            problemas.append("link morto: %s" % alvo)

    return problemas


def main():
    paginas = sorted(f for f in os.listdir(DIR) if f.endswith(".html"))
    if not paginas:
        print("nenhuma previa encontrada em", DIR)
        return 1

    falhas = 0
    for nome in paginas:
        problemas = confere(nome)
        if problemas:
            falhas += 1
            print("%-14s FALHOU" % nome)
            for x in problemas[:8]:
                print("    -", x)
        else:
            print("%-14s ok" % nome)

    print()
    print("%d previas, %d com problema" % (len(paginas), falhas))
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
