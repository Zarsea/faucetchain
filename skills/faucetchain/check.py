# -*- coding: utf-8 -*-
"""Confere se o que esta skill promete ainda e o que a API faz.

    python skills/faucetchain/check.py [--base https://www.faucetchain.com.br]

Documentacao que ninguem roda apodrece em silencio. O guia anterior deste
projeto anunciava `base URL: localhost:8000` meses depois do deploy, e nada
falhou -- porque nada conferia. Estes checks falham.

Nao escrevem nada: so rotas de leitura, mais duas que provam que as de escrita
recusam sem chave. Da para rodar contra producao sem medo.
"""
import argparse
import json
import sys
import urllib.error
import urllib.request

UA = "faucetchain-skill-check/1.0"
falhas = []


def pedir(base, rota, metodo="GET", corpo=None, cabecalhos=None):
    req = urllib.request.Request(
        base + rota, method=metodo,
        data=json.dumps(corpo).encode() if corpo is not None else None,
        headers={"User-Agent": UA, **({"Content-Type": "application/json"} if corpo else {}),
                 **(cabecalhos or {})})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"null")
        except Exception:
            return e.code, None
    except Exception as e:
        return 0, str(e)


def checar(nome, condicao, detalhe=""):
    print(("  ok    " if condicao else "  FALHA ") + nome + ("" if condicao else f"  -- {detalhe}"))
    if not condicao:
        falhas.append(nome)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="https://www.faucetchain.com.br")
    p.add_argument("--wallet", default="0xb3dff5d3f802ebba471c2498f223c52b8f7d5ad5",
                   help="uma carteira com historico, para conferir o formato")
    args = p.parse_args()
    base = args.base.rstrip("/")
    print(f"conferindo {base}\n")

    # ── leitura sem autenticacao, como a skill afirma ──────────────────────
    s, d = pedir(base, "/api/faucethub/faucets")
    checar("/faucets responde sem chave", s == 200 and isinstance(d, list), f"status {s}")

    s, d = pedir(base, f"/api/faucethub/microclaim/balance/{args.wallet}")
    checar("/microclaim/balance responde sem chave", s == 200, f"status {s}")
    if s == 200 and isinstance(d, dict):
        checar("balance traz 'faucets'", "faucets" in d, list(d)[:6])
        linha = (d.get("faucets") or [{}])[0]
        for campo in ("virtual_balance", "can_withdraw", "min_withdraw", "missing_to_withdraw"):
            checar(f"balance traz '{campo}'", campo in linha, list(linha)[:8])
        checar("min_withdraw continua 10.0", linha.get("min_withdraw") == 10.0,
               linha.get("min_withdraw"))

    s, d = pedir(base, f"/api/faucethub/microclaim/history/{args.wallet}?limit=5")
    checar("/microclaim/history responde sem chave", s == 200 and isinstance(d, list), f"status {s}")
    if isinstance(d, list) and d:
        for campo in ("event_type", "amount", "faucet_wallet", "timestamp"):
            checar(f"history traz '{campo}'", campo in d[0], list(d[0])[:8])

    s, _ = pedir(base, "/api/faucethub/microclaim/stats")
    checar("/microclaim/stats responde sem chave", s == 200, f"status {s}")

    s, _ = pedir(base, "/api/faucethub/proof-of-reserve")
    checar("/proof-of-reserve responde sem chave", s == 200, f"status {s}")

    # ── escrita sem chave tem de ser recusada ─────────────────────────────
    s, _ = pedir(base, "/api/faucethub/microclaim", "POST",
                 {"user_wallet": "0x" + "00" * 20, "amount": 0.0001})
    checar("/microclaim recusa sem X-API-Key", s in (401, 403), f"status {s}")

    s, _ = pedir(base, "/api/faucethub/microclaim/spend", "POST",
                 {"user_wallet": "x", "amount": 1.0, "item": "x",
                  "idempotency_key": "x", "message": "x", "signature": "x",
                  "sig_timestamp": 0})
    checar("/microclaim/spend recusa sem X-API-Key", s in (401, 403, 422), f"status {s}")

    print()
    if falhas:
        print(f"{len(falhas)} promessa(s) da skill nao batem com a API:")
        for f in falhas:
            print("  -", f)
        print("\nAtualize SKILL.md e reference/endpoints.md antes de publicar.")
        return 1
    print("a skill bate com a API.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
