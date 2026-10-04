# -*- coding: utf-8 -*-
"""Tira da lista as campanhas que nao podem pagar ninguem.

    python scripts/retire_dead_campaigns.py [--dry-run] [--revive <id>]

Nove das vinte e oito campanhas registradas tem patrocinador
`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` -- que e o endereco do programa de
Token -- e mint `SysvarC1ock11111111111111111111111111111111`, que e o sysvar de
relogio. Nenhum dos dois e patrocinador ou mint; sao enderecos de sistema que
sobraram de teste. A campanha existe na tabela e nao pode pagar nada.

O criterio NAO e essa lista de enderecos. E a cadeia: um mint de verdade e uma
conta cujo dono e o programa de Token e cujos dados descompactam como mint. Uma
lista fixa de enderecos ruins envelhece e erra na primeira vez que o entulho tem
um formato novo; perguntar para a Solana nao envelhece.

Aposentar nao apaga. A campanha continua respondendo em
/api/solana/ledger/{id} e volta a aparecer com include_retired=1. Apagar uma
campanha que ja pagou alguem arrancaria o contexto de uma recompensa que
continua existindo -- e tres dessas tem recompensas creditadas.

--revive desfaz, porque uma decisao que nao se desfaz nao e uma decisao, e um
RPC fora do ar nao pode condenar campanha nenhuma.
"""
import argparse
import os
import sqlite3
import sys
import time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(RAIZ, ".env"))
except ImportError:
    pass

TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"


def mint_real(rpc, endereco):
    """(e_mint, motivo). None no primeiro quando a leitura falhou."""
    import requests
    try:
        r = requests.post(rpc, json={
            "jsonrpc": "2.0", "id": 1, "method": "getAccountInfo",
            "params": [endereco, {"encoding": "jsonParsed"}],
        }, timeout=20)
        v = r.json().get("result", {}).get("value")
    except Exception as e:
        return None, f"a leitura da Solana falhou: {e}"

    if v is None:
        return False, "nao existe conta nenhuma neste endereco na Solana"
    dono = v.get("owner")
    if dono not in (TOKEN_PROGRAM, TOKEN_2022):
        return False, f"a conta existe mas pertence a {dono}, nao a um programa de token"
    tipo = (v.get("data") or {}).get("parsed", {}).get("type")
    if tipo != "mint":
        return False, f"a conta pertence ao programa de token mas e do tipo {tipo!r}, nao mint"
    return True, "mint valido"


def main() -> int:
    p = argparse.ArgumentParser(description="Retire campaigns whose mint is not a mint")
    p.add_argument("--db", default=os.path.join(RAIZ, "blockchain.db"))
    p.add_argument("--rpc", default=os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com"))
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--revive", type=int, help="desaposenta uma campanha pelo id")
    args = p.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row

    # As colunas nascem na migracao que o servidor roda ao subir. Um script que
    # depende delas e so pede que existam fica refem da ordem em que as coisas
    # sao executadas, e falha com "no such column" num banco que esta correto.
    for coluna in ("retired_at INTEGER", "retired_reason TEXT"):
        try:
            conn.execute(f"ALTER TABLE settlement_campaigns ADD COLUMN {coluna}")
        except sqlite3.OperationalError:
            pass  # ja existe
    conn.commit()

    if args.revive:
        n = conn.execute(
            "UPDATE settlement_campaigns SET retired_at = NULL, retired_reason = NULL "
            "WHERE campaign_id = ?", (args.revive,)).rowcount
        conn.commit()
        conn.close()
        print(f"campanha {args.revive}: {n} linha desaposentada")
        return 0 if n else 1

    linhas = conn.execute(
        "SELECT campaign_id, mint, retired_at FROM settlement_campaigns ORDER BY campaign_id"
    ).fetchall()

    aposentar, ilegivel = [], []
    vistos = {}
    for r in linhas:
        if r["retired_at"]:
            continue
        if r["mint"] not in vistos:
            vistos[r["mint"]] = mint_real(args.rpc, r["mint"])
        ok, motivo = vistos[r["mint"]]
        if ok is None:
            ilegivel.append((r["campaign_id"], motivo))
        elif not ok:
            aposentar.append((r["campaign_id"], r["mint"], motivo))

    if ilegivel:
        # Nao condenar por silencio da rede. Uma campanha viva cujo RPC caiu
        # some da lista para sempre se este script confundir as duas coisas.
        print("nao deu para ler estas, e elas ficam como estao:")
        for cid, motivo in ilegivel:
            print(f"   {cid}: {motivo}")
        print()

    if not aposentar:
        print("nenhuma campanha para aposentar")
        conn.close()
        return 0

    for cid, mint, motivo in aposentar:
        rec = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM settlement_rewards WHERE campaign_id = ?",
            (cid,)).fetchone()
        print(f"{cid}  mint {mint[:16]}…")
        print(f"   {motivo}")
        print(f"   tem {rec[0]} recompensa(s) creditada(s), {rec[1]} unidades — preservadas")

    print(f"\ntotal: {len(aposentar)} campanha(s)")
    if args.dry_run:
        print("dry run: nada foi aposentado")
        conn.close()
        return 0

    agora = int(time.time())
    for cid, mint, motivo in aposentar:
        conn.execute(
            "UPDATE settlement_campaigns SET retired_at = ?, retired_reason = ? WHERE campaign_id = ?",
            (agora, motivo, cid))
    conn.commit()

    restam = conn.execute(
        "SELECT COUNT(*) FROM settlement_campaigns WHERE retired_at IS NULL").fetchone()[0]
    conn.close()
    print(f"\naposentadas: {len(aposentar)}")
    print(f"a lista passa a mostrar {restam} campanha(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
