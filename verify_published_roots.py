# -*- coding: utf-8 -*-
"""Conta quantas raizes estao mesmo na Solana, e recusa acreditar no banco.

    python verify_published_roots.py              confere e imprime
    python verify_published_roots.py --fix        limpa as assinaturas falsas

Existe por causa de um erro que quase foi para a submissao. Em 4 de outubro de
2026 este projeto afirmava, na planilha de submissao e em cinco telas, "19
raizes publicadas na Solana". Sao 5. Catorze lotes tinham `published_signature`
de uma transacao que nunca existiu -- e os numeros vinham de contar linhas em
`settlement_batches`, que e o que o sequenciador acha, nao o que a cadeia tem.

**Contar assinaturas nao verifica nada.** Uma string de 88 caracteres no formato
certo e indistinguivel de uma assinatura real ate alguem perguntar para a rede.

**E `getTransaction` tambem nao basta.** A devnet poda historico: uma assinatura
legitima e antiga pode nao voltar, e tratar isso como fraude condena dado bom.
O teste decisivo e a conta: `publish_root` cria o PDA da raiz, e uma conta nao e
podada. Se o PDA existe, a raiz foi publicada, qualquer que seja a idade dela.

Por isso aqui se pergunta pelas duas coisas e so a conta decide.
"""
import argparse
import os
import sqlite3
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, RAIZ)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(RAIZ, ".env"))
except ImportError:
    pass


def main() -> int:
    p = argparse.ArgumentParser(description="Verify published roots against the chain")
    p.add_argument("--db", default=os.path.join(RAIZ, "blockchain.db"))
    p.add_argument("--rpc", default=os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com"))
    p.add_argument("--fix", action="store_true",
                   help="apaga a assinatura dos lotes cujo PDA nao existe")
    args = p.parse_args()

    import solana_settlement as chain
    from solders.pubkey import Pubkey

    pid = chain.program_id(chain.load_idl())
    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    linhas = conn.execute(
        """SELECT b.id, b.campaign_id, b.root_index, b.published_signature, s.sponsor
             FROM settlement_batches b
             JOIN settlement_campaigns s ON s.campaign_id = b.campaign_id
            WHERE b.published_signature IS NOT NULL
            ORDER BY b.id"""
    ).fetchall()

    reais, fantasmas = [], []
    for r in linhas:
        campanha = chain.campaign_pda(pid, Pubkey.from_string(r["sponsor"]), r["campaign_id"])
        raiz = chain.root_pda(pid, campanha, r["root_index"])
        contas = chain.fetch_accounts(args.rpc, [campanha, raiz])
        (reais if contas[1] is not None else fantasmas).append(
            (r["id"], r["campaign_id"], str(raiz), contas[0] is not None))

    print(f"lotes marcados como publicados: {len(linhas)}")
    print(f"  com a conta da raiz na cadeia: {len(reais)}")
    print(f"  sem conta nenhuma            : {len(fantasmas)}")

    if reais:
        print("\npublicadas de verdade:")
        for bid, cid, raiz, _ in reais:
            print(f"   lote {bid:<3} campanha {cid:<8} {raiz}")

    if fantasmas:
        print("\nassinatura gravada, nada na cadeia:")
        for bid, cid, raiz, tem_campanha in fantasmas:
            nota = "" if tem_campanha else "  (a propria campanha tambem nao existe)"
            print(f"   lote {bid:<3} campanha {cid:<8} {raiz}{nota}")

    if fantasmas and args.fix:
        for bid, _, _, _ in fantasmas:
            conn.execute(
                "UPDATE settlement_batches SET published_signature = NULL WHERE id = ?", (bid,))
        conn.commit()
        print(f"\nlimpas: {len(fantasmas)} assinatura(s). Os lotes continuam la, como fechados")
        print("e nao publicados, que e o que eles sempre foram.")
    elif fantasmas:
        print("\nrode com --fix para apagar essas assinaturas.")

    conn.close()
    # Sai com erro quando ha fantasma, para que isto sirva num CI.
    return 1 if fantasmas and not args.fix else 0


if __name__ == "__main__":
    sys.exit(main())
