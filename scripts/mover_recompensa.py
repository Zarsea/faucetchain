# -*- coding: utf-8 -*-
"""Move uma recompensa de campanha de uma conta desta cadeia para outra.

    python scripts/mover_recompensa.py --from <0x...> --to <0x...> [--campaign N] [--dry-run]

A folha do Merkle tem hash sobre `solana_address`, que este script NAO toca.
Logo a raiz publicada continua valendo e o saque continua sendo contra a mesma
carteira. O que muda e so em qual painel a recompensa aparece -- quem entra
naquela conta passa a ver o botao de saque.

Isso existe por um cruzamento que aconteceu aqui em 4 de outubro de 2026: a
carteira destinataria de um lote foi desvinculada da conta que tinha a
recompensa e vinculada a outra. O resultado e que a conta que mostra a prova e
alcancada por uma carteira que nao consegue assinar, e a carteira que assina
entra numa conta sem prova nenhuma. O saque fica impossivel pela interface sem
que nada no banco pareca errado.

Tres recusas antes de escrever:

  **Destino que a carteira nao alcanca.** E a recusa central. Mover para uma
  conta que `account_reached_by_wallet(solana_address)` nao devolve apenas
  troca o cruzamento de lado, e o operador sai achando que resolveu.

  **Destino que nao existe em `users`.** Sem linha la a conta nao emite sessao,
  entao a recompensa iria para um painel em que ninguem entra.

  **Selecao ambigua.** Se mais de uma recompensa casa, imprime todas e para.
  Um script que escolhe "a maior" ou "a mais recente" por conta propria erra em
  silencio na primeira vez que a heuristica nao serve.
"""
import argparse
import os
import shutil
import sqlite3
import sys
from datetime import datetime, UTC

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)

from api_server import account_reached_by_wallet, normalize_address


def main() -> int:
    p = argparse.ArgumentParser(description="Move a campaign reward between accounts")
    p.add_argument("--from", dest="origem", required=True)
    p.add_argument("--to", dest="destino", required=True)
    p.add_argument("--campaign", type=int, help="desempata quando ha mais de uma")
    p.add_argument("--db", default=os.path.join(RAIZ, "blockchain.db"))
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    try:
        origem = normalize_address(args.origem)
        destino = normalize_address(args.destino)
    except ValueError as e:
        raise SystemExit(f"endereco invalido: {e}")
    if origem == destino:
        raise SystemExit("origem e destino sao a mesma conta")

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row

    sql = """SELECT sr.id, sr.campaign_id, sr.amount, sr.solana_address, sr.batch_id,
                    b.published_signature
               FROM settlement_rewards sr
               LEFT JOIN settlement_batches b ON b.id = sr.batch_id
              WHERE sr.user_address = ?"""
    par = [origem]
    if args.campaign is not None:
        sql += " AND sr.campaign_id = ?"
        par.append(args.campaign)
    linhas = conn.execute(sql, par).fetchall()

    if not linhas:
        print(f"{origem} nao tem recompensa"
              + (f" na campanha {args.campaign}" if args.campaign is not None else ""))
        conn.close()
        return 1
    if len(linhas) > 1:
        print(f"{len(linhas)} recompensas casam. Escolha uma com --campaign:")
        for r in linhas:
            print(f"   campanha {r['campaign_id']}  {r['amount']}  lote {r['batch_id']}")
        conn.close()
        return 1

    r = linhas[0]
    carteira = r["solana_address"]
    print(f"recompensa {r['id']}  campanha {r['campaign_id']}  {r['amount']} unidades")
    print(f"  destinatario na folha: {carteira}")
    print(f"  lote {r['batch_id']}  "
          + ("raiz publicada" if r["published_signature"] else "sem raiz publicada"))
    if not r["published_signature"]:
        print("  ATENCAO: sem raiz na Solana nao ha prova, e mover nao faz surgir")
        print("  botao de saque nenhum. Isto resolve cruzamento, nao falta de raiz.")

    if not carteira:
        print("\n  a recompensa nao tem carteira Solana na folha.")
        print("  Sem isso nao ha saque para desbloquear.")
        conn.close()
        return 1

    # A recusa que da sentido ao script: a carteira da folha tem de alcancar o
    # destino, senao o cruzamento so muda de lado.
    alcanca, derivada, vinculos = account_reached_by_wallet(carteira)
    print(f"\n  a carteira {carteira[:10]}... entra em {alcanca}")
    if vinculos > 1:
        print(f"    (tem {vinculos} vinculos; vale o mais antigo)")
    elif vinculos == 0:
        print("    (sem vinculo; e a conta derivada do proprio endereco)")
    if alcanca != destino:
        print(f"\n  mas o destino pedido e {destino}.")
        print("  Mover para la deixaria a prova numa conta que esta carteira nao abre,")
        print("  que e o mesmo problema de antes virado do outro lado.")
        print(f"  O destino que desbloqueia o saque e {alcanca}.")
        conn.close()
        return 1

    u = conn.execute("SELECT email FROM users WHERE wallet_address = ?", (destino,)).fetchone()
    if not u:
        print(f"\n  {destino} nao esta em `users`, entao nao emite sessao.")
        conn.close()
        return 1
    print(f"  e {destino} esta em `users` ({u['email']})")

    print(f"\n  user_address: {origem}")
    print(f"             -> {destino}")
    print(f"  solana_address fica {carteira} -- a folha e a raiz nao mudam")

    if args.dry_run:
        print("\ndry run: nada foi escrito")
        conn.close()
        return 0

    copia = f"{args.db}.antes-mover-{datetime.now(UTC).strftime('%Y%m%d-%H%M%S')}"
    shutil.copy2(args.db, copia)
    print(f"\n  backup: {os.path.basename(copia)}")

    conn.execute("UPDATE settlement_rewards SET user_address = ? WHERE id = ?",
                 (destino, r["id"]))
    conn.commit()

    # Reler do banco em vez de confiar no UPDATE.
    d = conn.execute("SELECT user_address, solana_address, amount FROM settlement_rewards "
                     "WHERE id = ?", (r["id"],)).fetchone()
    conn.close()
    print(f"  movido. recompensa {r['id']} agora em {d['user_address']}")
    print(f"  destinatario segue {d['solana_address']}, {d['amount']} unidades")
    print(f"\n  Conecte a Phantom com {carteira[:10]}... e o botao Withdraw aparece.")
    return 0 if d["user_address"] == destino else 1


if __name__ == "__main__":
    sys.exit(main())
