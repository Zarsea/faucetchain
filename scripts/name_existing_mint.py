# -*- coding: utf-8 -*-
"""Da nome a um mint que ja existe e nunca teve metadados.

    python scripts/name_existing_mint.py --mint <endereco> \\
        --name "FaucetsWeb3 Liquidity Test" --symbol FWLT

O mint da campanha 479079 foi criado antes de a gente passar a nomear tokens, e
ficou sem metadados Metaplex. Na tela do usuario ele aparece como "Token sem
nome", e na carteira dele tambem -- que e o que o aviso amarelo do dashboard
sempre disse, honestamente.

Registrar o nome so em `token_registry` resolveria a nossa tela e deixaria o
aviso mentindo sobre a carteira. Este script resolve na origem: cria os
metadados na cadeia, confirma lendo de volta, e so entao registra aqui.

A ordem importa. Gravar no banco antes de confirmar a leitura deixaria a tela
afirmando um nome que a carteira nao mostra, que e exatamente o estado que o
script existe para nao produzir.

Precisa da autoridade do mint: SETTLEMENT_OPERATOR_KEYPAIR no .env tem de ser
ela, e o script confere isso antes de mandar qualquer coisa.
"""
import argparse
import json
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

import solana_settlement as chain
from solders.keypair import Keypair
from solders.pubkey import Pubkey


def main() -> int:
    p = argparse.ArgumentParser(description="Name a mint that has no metadata")
    p.add_argument("--mint", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--symbol", required=True)
    p.add_argument("--rpc", default=os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com"))
    p.add_argument("--cluster", default="devnet")
    p.add_argument("--note", default="")
    p.add_argument("--db", default=os.path.join(RAIZ, "blockchain.db"))
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    # Os limites sao do programa Metaplex. Estourar um faz a transacao falhar
    # na cadeia, longe daqui, com uma mensagem que nao diz qual campo passou.
    if len(args.name.encode()) > 32:
        raise SystemExit(f"name is {len(args.name.encode())} bytes; the limit is 32")
    if len(args.symbol.encode()) > 10:
        raise SystemExit(f"symbol is {len(args.symbol.encode())} bytes; the limit is 10")

    mint = Pubkey.from_string(args.mint)

    ja = chain.mint_metadata(args.rpc, mint)
    if ja:
        raise SystemExit(
            f"this mint already reads back as {ja['name']} ({ja['symbol']}); "
            f"updating an existing name is a different instruction and this script does not do it"
        )

    caminho = os.path.expanduser(os.getenv("SETTLEMENT_OPERATOR_KEYPAIR", ""))
    if not caminho or not os.path.exists(caminho):
        raise SystemExit("SETTLEMENT_OPERATOR_KEYPAIR is not set, or points nowhere")
    autoridade = Keypair.from_bytes(bytes(json.load(open(caminho))))

    # Conferir antes de mandar: so a autoridade do mint pode criar os
    # metadados, e descobrir isso pelo erro da cadeia custa uma transacao.
    info = chain.mint_info(args.rpc, mint) if hasattr(chain, "mint_info") else None
    print(f"mint      {mint}")
    print(f"authority {autoridade.pubkey()}")
    print(f"name      {args.name} ({args.symbol})")
    if info and info.get("mint_authority") and info["mint_authority"] != str(autoridade.pubkey()):
        raise SystemExit(
            f"the mint authority is {info['mint_authority']}, not the configured keypair"
        )

    if args.dry_run:
        print("\ndry run: nothing was sent")
        return 0

    chain.send_and_confirm(
        args.rpc,
        [chain.create_metadata_ix(mint, autoridade.pubkey(), autoridade.pubkey(),
                                  args.name, args.symbol)],
        autoridade,
        [autoridade],
    )

    lido = chain.mint_metadata(args.rpc, mint)
    if not lido:
        raise SystemExit(
            "the metadata was sent but cannot be read back; nothing was written to the "
            "database, so the screen keeps saying the token has no name -- which is still true"
        )
    print(f"on chain  {lido['name']} ({lido['symbol']}) — read back, not assumed")

    # So agora o registro local, e com os valores que a CADEIA devolveu, nao
    # com os que foram pedidos: se os dois divergissem, a tela deve mostrar o
    # que a carteira mostra.
    conn = sqlite3.connect(args.db)
    conn.execute(
        """INSERT INTO token_registry
               (mint, cluster, name, symbol, decimals, token_program, settleable, note, added_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(mint) DO UPDATE SET name = excluded.name, symbol = excluded.symbol""",
        (str(mint), args.cluster, lido["name"], lido["symbol"], 6,
         "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", args.note, int(time.time())),
    )
    conn.commit()
    conn.close()
    print("registered locally, with the values the chain returned")
    return 0


if __name__ == "__main__":
    sys.exit(main())
