"""
FaucetChain — a partner budget dripping through a faucet, end to end.

The other demo (demo_settlement.py) proves the payout: a vault on Solana, a
Merkle root, a user withdrawing with no SOL. This one proves the half in front
of it — that clicking on a partner faucet draws down a campaign budget at a rate
the network computes rather than an operator picks.

It needs only the appchain. The drip never touches Solana; that happens later,
when a batch closes and its root is published.

    SETTLEMENT_OPERATOR_TOKEN=... python api_server.py     # in another terminal
    python scripts/demo_drip.py --api http://localhost:8010

What it shows, in order: the floor holding a new faucet's rate sane, the budget
draining as people arrive, the rate falling as it is shared, and the ceiling
refusing to promise past what was committed.
"""

import argparse
import os
import sys
import time

if sys.platform == "win32":      # the demo gets screen-recorded; cp1252 mangles it
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import requests
from eth_account import Account

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import distribution  # noqa: E402

UNIT = 10 ** 6       # six decimals, as the campaigns use


def step(n: int, text: str) -> None:
    print(f"\n[{n}] {text}")


def money(units: int) -> str:
    return f"{units / UNIT:,.4f}"


def main() -> None:
    ap = argparse.ArgumentParser(description="A campaign budget dripping through a faucet")
    ap.add_argument("--api", default=os.getenv("FAUCETCHAIN_API", "http://localhost:8010"))
    ap.add_argument("--campaign-id", type=int, default=int(time.time()) % 1_000_000)
    ap.add_argument("--users", type=int, default=12, help="how many people click")
    ap.add_argument("--budget", type=float, default=120_000, help="what the partner commits")
    ap.add_argument("--monthly-cap", type=float, default=10_000)
    args = ap.parse_args()

    api = args.api.rstrip("/")
    token = os.getenv("SETTLEMENT_OPERATOR_TOKEN")
    if not token:
        raise SystemExit("SETTLEMENT_OPERATOR_TOKEN must match the one the API was started with")
    op = {"x-operator-token": token}

    try:
        requests.get(f"{api}/api/solana/campaigns", timeout=10).raise_for_status()
    except Exception as e:
        raise SystemExit(f"The sequencer is not answering at {api}: {e}")

    # ---------------------------------------------------------------- 1
    step(1, "A faucet joins the network")
    faucet = Account.create().address.lower()
    r = requests.post(f"{api}/api/faucethub/register",
                      json={"name": "Demo Partner Faucet", "wallet_address": faucet}, timeout=30)
    r.raise_for_status()
    api_key = r.json()["api_key"]
    print(f"    faucet  {faucet}")
    print(f"    api key {api_key[:16]}… (shown once, as it should be)")

    # ---------------------------------------------------------------- 2
    step(2, "A partner project opens a campaign and commits a budget")
    sponsor = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    mint = "SysvarC1ock11111111111111111111111111111111"
    requests.post(f"{api}/api/solana/campaign",
                  json={"campaign_id": args.campaign_id, "sponsor": sponsor, "mint": mint},
                  headers=op, timeout=30).raise_for_status()
    total = int(args.budget * UNIT)
    cap = int(args.monthly_cap * UNIT)
    requests.post(f"{api}/api/solana/campaign/{args.campaign_id}/budget",
                  json={"total_budget": total, "monthly_cap": cap, "funding": "vault"},
                  headers=op, timeout=30).raise_for_status()
    print(f"    campaign {args.campaign_id}")
    print(f"    committed {money(total)} with {money(cap)} a month, funded up front")

    # ---------------------------------------------------------------- 3
    step(3, "The campaign declares where it wants to appear")
    requests.post(f"{api}/api/solana/campaign/{args.campaign_id}/faucets",
                  json={"faucets": [faucet]}, headers=op, timeout=30).raise_for_status()
    print("    enrolled this faucet — the faucet could not have enrolled itself")

    # ---------------------------------------------------------------- 4
    step(4, f"{args.users} people click, one after another")
    print(f"    the rate is computed against at least {distribution.FLOOR_USERS} users,")
    print("    so the first arrivals do not split the month between them\n")
    print(f"    {'click':>5}  {'to the user':>13}  {'to treasury':>12}   running total")

    paid_users, paid_treasury = 0, 0
    users = [Account.create().address.lower() for _ in range(args.users)]
    for i, user in enumerate(users, 1):
        resp = requests.post(f"{api}/api/faucethub/microclaim",
                             json={"user_wallet": user, "amount": 1.0},
                             headers={"X-Api-Key": api_key}, timeout=30)
        resp.raise_for_status()
        drips = resp.json().get("campaigns") or []
        if not drips:
            print(f"    {i:>5}  (nothing — the budget is spent)")
            continue
        d = drips[0]
        paid_users += d["amount"]
        paid_treasury += d["treasury"]
        if i <= 5 or i == args.users:
            print(f"    {i:>5}  {money(d['amount']):>13}  {money(d['treasury']):>12}   "
                  f"{money(paid_users + paid_treasury)}")
        elif i == 6:
            print(f"    {'…':>5}")

    # ---------------------------------------------------------------- 5
    step(5, "Where the budget stands")
    gross = paid_users + paid_treasury
    print(f"    drawn from the budget  {money(gross)}")
    if gross:
        print(f"    reached the users      {money(paid_users)}   ({paid_users / gross * 100:.0f}%)")
        print(f"    kept by the treasury   {money(paid_treasury)}   "
              f"({paid_treasury / gross * 100:.0f}%, staked rather than sold)")
        print("    The treasury's share is owed on the campaign and joins the next batch")
        print("    as one leaf, under the same root and the same reserve check as a user.")
    else:
        print("    The budget could not cover a single claim, so nothing was promised.")
        print("    Refusing here is the point: a root the vault cannot cover is rejected")
        print("    on-chain, and that rejection would cost everyone in the batch.")

    # ---------------------------------------------------------------- 6
    step(6, "What the users are owed, waiting for a batch")
    owed = requests.get(f"{api}/api/solana/ledger/{args.campaign_id}", timeout=30)
    if owed.ok:
        body = owed.json()
        print(f"    campaign {body['campaign_id']} · {len(body.get('batches', []))} batch(es) closed so far")
    print(f"    {len(users)} rewards are sitting in settlement_rewards, unbatched.")
    print("    Closing a batch turns them into one Merkle root; publishing that root")
    print("    on Solana is what makes them withdrawable. That is demo_settlement.py.")

    print("\nDone. The click drew a real budget at a rate nobody typed in,")
    print("and the treasury's share never left the network.")


if __name__ == "__main__":
    main()
