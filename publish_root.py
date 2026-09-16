"""
FaucetChain — take a closed batch's root to the program on Solana.

The sequencer closes the batch (POST /api/solana/batch); this script publishes
its root. From then on the payout no longer depends on the server: whoever
holds a proof withdraws straight from the campaign vault, and the program
refuses the root outright if the vault does not cover everything already
promised and not yet withdrawn.

    python publish_root.py --campaign 7 --batch 3
    python publish_root.py --campaign 7 --batch 3 --dry-run

Environment:
    SOLANA_RPC_URL               devnet by default
    SETTLEMENT_OPERATOR_KEYPAIR  keypair that signs publish_root
    SETTLEMENT_CAMPAIGN_SPONSOR  wallet that opened the campaign (base58)
    SETTLEMENT_OPERATOR_TOKEN    token for the appchain's operator endpoints
    FAUCETCHAIN_API              http://localhost:8000 by default
"""

import argparse
import os
import sys

import requests
from solders.pubkey import Pubkey

import solana_settlement as chain


def fetch_batch(api: str, campaign_id: int, batch_id: int) -> dict:
    response = requests.get(
        f"{api}/api/solana/batches", params={"campaign_id": campaign_id}, timeout=30
    )
    response.raise_for_status()
    for batch in response.json()["batches"]:
        if batch["batch_id"] == batch_id:
            return batch
    raise SystemExit(f"Batch {batch_id} does not exist in campaign {campaign_id}")


def mark_published(api: str, token: str, batch_id: int, signature: str) -> None:
    response = requests.post(
        f"{api}/api/solana/batch/{batch_id}/published",
        json={"signature": signature},
        headers={"x-operator-token": token},
        timeout=30,
    )
    response.raise_for_status()


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish a reward root on Solana")
    parser.add_argument("--campaign", type=int, required=True, help="campaign_id on Solana")
    parser.add_argument("--batch", type=int, required=True, help="batch_id from /api/solana/batch")
    parser.add_argument("--dry-run", action="store_true", help="build and show, without sending")
    args = parser.parse_args()

    api = os.getenv("FAUCETCHAIN_API", "http://localhost:8000").rstrip("/")
    rpc_url = chain.default_rpc_url()
    sponsor = os.getenv("SETTLEMENT_CAMPAIGN_SPONSOR")
    if not sponsor:
        raise SystemExit("SETTLEMENT_CAMPAIGN_SPONSOR is not set")
    operator = chain.load_keypair(
        os.getenv("SETTLEMENT_OPERATOR_KEYPAIR", "~/.config/solana/id.json")
    )

    idl = chain.load_idl()
    batch = fetch_batch(api, args.campaign, args.batch)
    if batch["published_signature"]:
        raise SystemExit(f"Batch {args.batch} was already published in {batch['published_signature']}")

    root = bytes.fromhex(batch["root"].removeprefix("0x"))
    instruction = chain.publish_root(
        idl,
        operator.pubkey(),
        Pubkey.from_string(sponsor),
        args.campaign,
        batch["root_index"],
        root,
        batch["total_amount"],
        batch["leaf_count"],
    )

    print(f"program   {idl['address']}")
    print(f"operator  {operator.pubkey()}")
    for meta, name in zip(instruction.accounts, ("operator", "campaign", "root", "vault", "system")):
        print(f"  {name:9} {meta.pubkey}")
    print(f"root {batch['root']} index {batch['root_index']} "
          f"total {batch['total_amount']} leaves {batch['leaf_count']}")
    if args.dry_run:
        print(f"data      {instruction.data.hex()}")
        return

    signature = chain.send_and_confirm(rpc_url, [instruction], operator, [operator])
    print(f"published in {signature}")

    token = os.getenv("SETTLEMENT_OPERATOR_TOKEN")
    if token:
        mark_published(api, token, args.batch, signature)
        print("recorded on the batch")
    else:
        print("SETTLEMENT_OPERATOR_TOKEN is not set: signature not recorded on the appchain",
              file=sys.stderr)


if __name__ == "__main__":
    main()
