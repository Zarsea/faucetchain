# -*- coding: utf-8 -*-
"""O que a troca de HMAC-SHA256 por bcrypt tinha de fechar.

    python test_password_hashing.py

Cada teste aqui corresponde a uma frase da auditoria de 29 de setembro. Sem
eles a troca "funciona" -- da para entrar -- e mesmo assim deixa passar os dois
defeitos que motivaram a troca, porque nenhum dos dois aparece no login.
"""
import os
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, RAIZ)

os.environ.setdefault("PASSWORD_SALT", "salt-de-teste")

from api_server import hash_password, verify_password, _legacy_hash


def a_senha_certa_entra_e_a_errada_nao():
    h = hash_password("correia-cavalo-bateria-grampo")
    assert verify_password("correia-cavalo-bateria-grampo", h) == (True, False)
    assert verify_password("correia-cavalo-bateria-gramp", h) == (False, False)


def duas_contas_com_a_mesma_senha_guardam_hashes_diferentes():
    """O defeito do salt global, e o que o login jamais revelaria.

    Com PASSWORD_SALT unico, duas pessoas com a mesma senha guardavam o mesmo
    hash -- dava para ler quem compartilha senha sem quebrar nada.
    """
    a = hash_password("a-mesma-senha")
    b = hash_password("a-mesma-senha")
    assert a != b, "salt por usuario nao esta sendo gerado"
    assert verify_password("a-mesma-senha", a)[0]
    assert verify_password("a-mesma-senha", b)[0]


def o_hash_e_lento_de_proposito():
    """SHA-256 e rapido, e era esse o problema.

    bcrypt com o custo padrao leva dezenas de milissegundos. Nao fixo um numero
    porque ele depende da maquina; fixo que nao e instantaneo, que e a unica
    propriedade que importa contra uma GPU.
    """
    import time
    t = time.perf_counter()
    hash_password("qualquer-uma")
    decorrido = time.perf_counter() - t
    assert decorrido > 0.01, f"hash levou {decorrido*1000:.1f}ms -- rapido demais"


def uma_senha_acima_de_72_bytes_funciona():
    """bcrypt nao aceita senha acima de 72 bytes.

    O bcrypt 5.0 levanta ValueError, entao sem o sha256 antes isto seria um 500
    no registro -- conferido: `bcrypt.hashpw` com 80 bytes levanta
    "password cannot be longer than 72 bytes". As versoes antigas truncavam em
    silencio, e ai as duas senhas abaixo abririam a conta uma da outra.
    """
    base = "x" * 72
    h = hash_password(base + "primeira")
    assert verify_password(base + "primeira", h)[0]
    assert not verify_password(base + "segunda", h)[0]


def o_hash_antigo_ainda_entra_e_pede_para_ser_reescrito():
    """Quem nao reentrou ainda tem o hash velho no banco.

    Se este teste quebrar, todo mundo que nao fez login desde a troca fica
    trancado para fora.
    """
    velho = _legacy_hash("senha-de-antes")
    assert velho is not None
    assert verify_password("senha-de-antes", velho) == (True, True)
    assert verify_password("outra-coisa", velho) == (False, False)


def o_reescrito_vira_bcrypt_e_para_de_pedir():
    velho = _legacy_hash("senha-de-antes")
    confere, precisa = verify_password("senha-de-antes", velho)
    assert (confere, precisa) == (True, True)
    novo = hash_password("senha-de-antes")
    assert novo.startswith("$2"), novo[:4]
    assert verify_password("senha-de-antes", novo) == (True, False)


if __name__ == "__main__":
    testes = [v for k, v in sorted(globals().items())
              if callable(v) and not k.startswith("_") and v.__module__ == "__main__"]
    for t in testes:
        t()
        print(f"  ok  {t.__name__.replace('_', ' ')}")
    print(f"\n{len(testes)} passaram.")
