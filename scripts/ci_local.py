# -*- coding: utf-8 -*-
"""Roda aqui o que o CI roda la, lendo o proprio ci.yml.

    python scripts/ci_local.py [--job backend] [--listar]

Em 21/10/2026 um push quebrou o CI com uma falha que a maquina local nunca
teria mostrado: a varredura daqui rodava `tests/test_*.py`, e metade das
checagens do CI mora na raiz do repositorio -- test_endpoint_inventory.py,
test_authorization.py, test_docs_match_code.py e mais seis. Verde aqui nao
queria dizer verde la, e a diferenca so aparecia depois do push.

Uma lista escrita a mao divergiria de novo na primeira vez que alguem
acrescentasse um passo no ci.yml e esquecesse deste arquivo. Entao a lista sai
do ci.yml: o que roda aqui e exatamente o que esta la, e um passo novo entra
sozinho.

Os passos de instalacao (`pip install`, `npm ci`) sao pulados de proposito --
a maquina de quem desenvolve ja tem as dependencias, e reinstala-las a cada
rodada transformaria trinta segundos em varios minutos. Eles aparecem como
`pulado` na saida, para ninguem achar que rodaram.

O job `program` fica de fora por padrao: ele exige a toolchain da Solana e do
Rust, que nao esta nesta maquina. `--job program` tenta mesmo assim.
"""
import argparse
import os
import re
import subprocess
import sys
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLUXO = os.path.join(RAIZ, ".github", "workflows", "ci.yml")

# Instalacao de dependencia, nao checagem.
PULAR = ("pip install", "npm ci", "npm install", "bash scripts/setup-solana-toolchain.sh")

# O python do venv, quando existir: e o que tem as dependencias.
VENV = os.path.join(RAIZ, ".venv", "Scripts", "python.exe")
if not os.path.exists(VENV):
    VENV = os.path.join(RAIZ, ".venv", "bin", "python")


def passos(job: str):
    """(nome, comando) de cada `run:` do job, na ordem do arquivo.

    Le o YAML com regex em vez de pyyaml porque o ci.yml e simples e esta
    debaixo do nosso controle: uma dependencia a mais para rodar os testes e
    uma dependencia a mais que pode faltar na hora de rodar os testes.
    """
    texto = open(FLUXO, encoding="utf-8").read()
    corpo = texto.split(f"\n  {job}:", 1)
    if len(corpo) < 2:
        raise SystemExit(f"job '{job}' nao existe em {FLUXO}")
    # ate o proximo job no mesmo nivel de indentacao
    corpo = re.split(r"\n  \w[\w-]*:\n", corpo[1], 1)[0]

    achados, nome = [], None
    for bloco in re.finditer(
            r"- name: (.+?)\n\s+run: (\|?)\n?((?:\s{8,}.+\n?)+|.+)", corpo):
        nome = bloco.group(1).strip()
        bruto = bloco.group(3)
        linhas = [l.strip() for l in bruto.strip().split("\n") if l.strip()]
        for cmd in linhas:
            achados.append((nome, cmd))
    return achados


def ajustar(cmd: str) -> str:
    """O python do venv no lugar do `python` do CI."""
    if cmd.startswith("python ") and os.path.exists(VENV):
        return f'"{VENV}" ' + cmd[len("python "):]
    return cmd


def main() -> int:
    p = argparse.ArgumentParser(description="Roda localmente o que o CI roda")
    p.add_argument("--job", default="backend")
    p.add_argument("--listar", action="store_true", help="mostra e nao executa")
    args = p.parse_args()

    # O mesmo problema do outro lado: ler a saida em utf-8 nao bastou, porque
    # imprimi-la no console do Windows, que e cp1252, derrubava o proprio
    # runner na hora de mostrar o erro -- e a hora de mostrar o erro e a unica
    # que importa. `reconfigure` nao existe em todo stream, entao e opcional.
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    os.chdir(RAIZ)
    lista = passos(args.job)
    print(f"{len(lista)} comando(s) no job '{args.job}'\n")

    falhas, inicio = [], time.time()
    for nome, cmd in lista:
        rotulo = (nome[:40] + "…") if len(nome) > 41 else nome
        if args.listar:
            print(f"  {rotulo:42} {cmd}")
            continue
        if any(cmd.startswith(x) for x in PULAR):
            print(f"  {rotulo:42} pulado ({cmd.split()[0]} {cmd.split()[1]})")
            continue
        print(f"  {rotulo:42} ", end="", flush=True)
        # utf-8 com `replace`: no Windows o padrao e cp1252, que lanca
        # UnicodeDecodeError ao ler a saida destes testes -- varios imprimem
        # acentos e simbolos. Ler a saida so importa quando um passo falha, que
        # e exatamente quando a excecao apareceria e esconderia o motivo.
        r = subprocess.run(ajustar(cmd), shell=True, capture_output=True,
                           text=True, encoding="utf-8", errors="replace")
        if r.returncode == 0:
            print("ok")
        else:
            print("FALHOU")
            saida = (r.stdout or "") + (r.stderr or "")
            for linha in saida.strip().split("\n")[-8:]:
                print(f"        {linha}")
            falhas.append((nome, cmd))

    if args.listar:
        return 0
    print(f"\n{time.time() - inicio:.0f}s")
    if falhas:
        print(f"{len(falhas)} passo(s) falharam:")
        for nome, cmd in falhas:
            print(f"  - {nome}: {cmd}")
        return 1
    print(f"job '{args.job}': verde")
    return 0


if __name__ == "__main__":
    sys.exit(main())
