"""Open a funded campaign on devnet and enrol a real partner faucet in it.

`demo_settlement.py` proves the whole path and then tears it down: the partner
reclaims the surplus and the vault ends at zero. That is right for a demo and
useless for a live faucet, which needs a campaign that still has money in it
when somebody clicks tomorrow.

This opens one and stops. No users, no batch, no withdrawal -- those happen for
real, from the partner's own traffic.

    SETTLEMENT_OPERATOR_TOKEN=... python scripts/open_partner_campaign.py \
        --faucet 0x7a9c... --rpc https://api.devnet.solana.com \
        --api http://localhost:8010 --funder path/to/id.json

The mint is created here, so the campaign token is a real SPL mint with a real
supply and a real vault -- not the placeholder pubkeys the fourteen inherited
campaigns carry, where the "mint" is the Clock sysvar.
"""

import argparse
import os
import sys
import time

import requests
from solders.keypair import Keypair

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import solana_settlement as chain  # noqa: E402
from demo_settlement import (  # noqa: E402
    DECIMALS, MINT_LEN, TOKEN_ACCOUNT_LEN, UNIT,
    create_account_ix, initialize_mint_ix, initialize_token_account_ix, mint_to_ix,
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--faucet", required=True, help="the faucet wallet already registered here")
    ap.add_argument("--rpc", default="https://api.devnet.solana.com")
    ap.add_argument("--api", default=os.getenv("FAUCETCHAIN_API", "http://localhost:8010"))
    ap.add_argument("--funder", required=True, help="keypair with devnet SOL; it becomes the sponsor")
    ap.add_argument("--campaign-id", type=int, default=int(time.time()) % 1_000_000)
    ap.add_argument("--supply", type=float, default=100_000.0, help="tokens minted to the sponsor")
    ap.add_argument("--fund", type=float, default=50_000.0, help="tokens moved into the vault")
    ap.add_argument("--total-budget", type=float, default=50_000.0)
    ap.add_argument("--monthly-cap", type=float, default=5_000.0)
    # Sem nome o mint nasce anonimo, e anonimo ele aparece na carteira de quem
    # o recebe -- so o endereco base58, sem simbolo e sem logo. O nome mora numa
    # conta do Metaplex que ninguem e obrigado a criar, e por isso quase todo
    # token de hackathon fica sem.
    ap.add_argument("--token-name", help="name on Solana, up to 32 bytes; omit and the mint stays unnamed")
    ap.add_argument("--token-symbol", help="ticker, up to 10 bytes; required with --token-name")
    args = ap.parse_args()

    if bool(args.token_name) != bool(args.token_symbol):
        raise SystemExit("--token-name and --token-symbol go together, or neither")

    token = os.getenv("SETTLEMENT_OPERATOR_TOKEN")
    if not token:
        raise SystemExit("SETTLEMENT_OPERATOR_TOKEN must match the one the API was started with")

    api = args.api.rstrip("/")
    idl = chain.load_idl()
    pid = chain.program_id(idl)
    sponsor = chain.load_keypair(args.funder)

    print(f"sponsor  {sponsor.pubkey()}")
    print(f"campaign {args.campaign_id}")

    # --- the token -------------------------------------------------------
    mint, sponsor_tokens = Keypair(), Keypair()
    mint_rent = chain.rpc(args.rpc, "getMinimumBalanceForRentExemption", [MINT_LEN])
    acct_rent = chain.rpc(args.rpc, "getMinimumBalanceForRentExemption", [TOKEN_ACCOUNT_LEN])
    chain.send_and_confirm(
        args.rpc,
        [
            create_account_ix(sponsor.pubkey(), mint.pubkey(), mint_rent, MINT_LEN, chain.TOKEN_PROGRAM),
            initialize_mint_ix(mint.pubkey(), sponsor.pubkey(), DECIMALS),
            create_account_ix(sponsor.pubkey(), sponsor_tokens.pubkey(), acct_rent,
                              TOKEN_ACCOUNT_LEN, chain.TOKEN_PROGRAM),
            initialize_token_account_ix(sponsor_tokens.pubkey(), mint.pubkey(), sponsor.pubkey()),
            mint_to_ix(mint.pubkey(), sponsor_tokens.pubkey(), sponsor.pubkey(),
                       int(args.supply * UNIT)),
        ],
        sponsor,
        [sponsor, mint, sponsor_tokens],
    )
    print(f"mint     {mint.pubkey()} — {args.supply:,.0f} tokens minted")

    # O nome, numa transacao a parte de proposito: se ela falhar, o mint e o
    # supply continuam de pe e da para tentar de novo sem refazer nada.
    if args.token_name:
        chain.send_and_confirm(
            args.rpc,
            [chain.create_metadata_ix(mint.pubkey(), sponsor.pubkey(), sponsor.pubkey(),
                                      args.token_name, args.token_symbol)],
            sponsor,
            [sponsor],
        )
        lido = chain.mint_metadata(args.rpc, mint.pubkey())
        if not lido:
            raise SystemExit("metadata was sent but cannot be read back; stopping before the campaign")
        print(f"named    {lido['name']} ({lido['symbol']}) — read back off the chain")

    # --- the campaign and its vault --------------------------------------
    campaign = chain.campaign_pda(pid, sponsor.pubkey(), args.campaign_id)
    vault = chain.vault_pda(pid, campaign)
    chain.send_and_confirm(
        args.rpc,
        [
            chain.create_campaign(
                idl, sponsor.pubkey(), mint.pubkey(), args.campaign_id, sponsor.pubkey(),
                period_cap=int(args.monthly_cap * UNIT),
                period_len=chain.PERIOD_30_DAYS,
            ),
            chain.fund_campaign(idl, sponsor.pubkey(), mint.pubkey(), sponsor_tokens.pubkey(),
                                args.campaign_id, int(args.fund * UNIT)),
        ],
        sponsor,
        [sponsor],
    )
    print(f"campaign {campaign}")
    print(f"vault    {vault} holds {chain.token_balance(args.rpc, vault) / UNIT:,.2f}")

    # --- tell the sequencer ----------------------------------------------
    h = {"x-operator-token": token}
    requests.post(f"{api}/api/solana/campaign", json={
        "campaign_id": args.campaign_id,
        "sponsor": str(sponsor.pubkey()),
        "mint": str(mint.pubkey()),
    }, headers=h, timeout=30).raise_for_status()

    requests.post(f"{api}/api/solana/campaign/{args.campaign_id}/budget", json={
        "total_budget": int(args.total_budget * UNIT),
        "monthly_cap": int(args.monthly_cap * UNIT),
        # 'vault' is a claim about money, and here it is true: the vault above
        # holds it and the program refuses a root it cannot cover.
        "funding": "vault",
    }, headers=h, timeout=30).raise_for_status()

    r = requests.post(f"{api}/api/solana/campaign/{args.campaign_id}/faucets",
                      json={"faucets": [args.faucet]}, headers=h, timeout=30)
    r.raise_for_status()
    print(f"enrolled {args.faucet}")

    print()
    print("Done. The next click on that faucet drips from a vault that exists.")
    if args.token_name:
        print(f"  token       {args.token_name} ({args.token_symbol})")
    print(f"  campaign_id {args.campaign_id}")
    print(f"  mint        {mint.pubkey()}")
    print(f"  vault       {vault}")


if __name__ == "__main__":
    main()
