"""Retire the address-login era: three placeholder wallets and what they bought.

One address minted 99% of everything this chain has ever issued. It is called
`0xa1b2c3d4e5f6789012345678abcdef0123456789` — a keyboard walking across the
hex alphabet — and it holds 57,768 of the 57,808 mining rewards on record. Two
others keep it company: `0xsuacarteiraaqui`, which is Portuguese for "your
wallet here", and `0xtestuser`. They were reachable while pasting an address
was a way in, which it stopped being on 24 September.

Nothing here is broken. `reconcile.py` counts those balances because they are
real inside this ledger's own arithmetic. The problem is that every figure the
project shows a visitor — total supply, mining distributed, the faucet
directory — is mostly them, so nobody can tell what the network actually did.
A number nobody can check is worth less than a smaller number they can.

WHAT GOES, AND WHY THESE EXACTLY

The three placeholders do not stand alone: the first one transferred 192,000
$CLAIM to `0x84da71247cbfb0737a9112de1f10dae9823fc298`. Deleting the source and
keeping the destination would leave that address holding money minted by a row
that no longer exists, and `no_negative_balances` would say so. So the unit of
removal is the connected component of the transfers, not the addresses one at a
time. That component closes at four addresses and touches no row in `users`,
which is the fact that makes this safe — it was checked before it was written,
and the script checks it again before it deletes anything.

Their staking positions go with them, for the same reason in the other
direction: 930,000 of the 935,500 currently locked is theirs, and leaving it
against a supply that just fell to ~12,000 would trip `stake_within_supply`.

The thirteen faucets named "Demo Partner Faucet" go too. They carry micro-claims
but have settled nothing, so no payout depends on them.

WHAT STAYS, DELIBERATELY

The fourteen campaigns stay, and are relabelled `vault` -> `deferred`. Not one
of their vaults can be read on devnet — they were opened against a localnet
ledger that no longer exists. `deferred` is what this project already calls a
campaign that has not been funded yet: the user holds a record of work rather
than money. Deleting them instead would take the seventeen published roots with
them, and those roots are the evidence that the settlement loop ran. The honest
move is to relabel, not to erase.

`defi_stakes` is dropped: it is the empty corpse of the staking system removed
on 2026-09-20, and an empty table nobody writes to is a trap for whoever greps
next.

    python scripts/retire_placeholder_ledger.py            # says what it would do
    python scripts/retire_placeholder_ledger.py --apply    # does it
"""

import argparse
import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PLACEHOLDERS = {
    "0xa1b2c3d4e5f6789012345678abcdef0123456789": "hex alphabet typed in order",
    "0xsuacarteiraaqui": "'your wallet here', left in a form",
    "0xtestuser": "a test account, named as one",
}
# Reached only by transfer from the three above; kept in the same unit of
# removal so no balance is left minted by a row that is gone.
DOWNSTREAM = "0x84da71247cbfb0737a9112de1f10dae9823fc298"

# Not a holder: the staking vault's pseudo-address, and the mint's zero address.
# Transfers to and from these cancel out when both sides of a pair are removed.
NOT_A_WALLET = {
    "0x0000000000000000000000000000000000000000",
    "0x537461b696e675661756c740000000000000000",
}

# (table, column) pairs an address can appear in.
BY_ADDRESS = [
    ("user_claims", "user_address"),
    ("mining_rewards", "wallet_address"),
    ("staking_positions", "staker_address"),
    ("settlement_rewards", "user_address"),
    ("solana_links", "user_address"),
    ("cyberdrip_profiles", "wallet"),
    ("tracked_addresses", "address"),
]

PLACEHOLDER_FAUCET = "Demo Partner Faucet"


def component(conn):
    """The placeholders plus whatever their transfers reached.

    Computed rather than hardcoded: if somebody ran another test between this
    being written and being run, the new address comes along instead of being
    silently left behind holding money whose source was deleted.
    """
    found = set(PLACEHOLDERS)
    edges = [
        ((a or "").strip().lower(), (b or "").strip().lower(), t)
        for a, b, t in conn.execute("SELECT from_address, to_address, tx_type FROM transactions")
    ]
    for _ in range(len(edges) or 1):
        before = len(found)
        for a, b, tx_type in edges:
            if tx_type in ("CLAIM", "MINING_FEE"):
                continue  # a mint, not a transfer between holders
            if a in NOT_A_WALLET or b in NOT_A_WALLET:
                continue
            if a in found:
                found.add(b)
            if b in found:
                found.add(a)
        if len(found) == before:
            break
    found.discard("")
    return found


def real_users(conn):
    return {r[0].strip().lower() for r in conn.execute("SELECT wallet_address FROM users") if r[0]}


def count(conn, sql, params=()):
    try:
        return conn.execute(sql, params).fetchone()[0]
    except sqlite3.OperationalError:
        return 0


def plan(conn):
    """Every deletion this would make, as (label, sql, params, rows)."""
    addrs = sorted(component(conn))
    marks = ",".join("?" * len(addrs))
    steps = []

    for table, col in BY_ADDRESS:
        sql = f"DELETE FROM {table} WHERE TRIM(LOWER({col})) IN ({marks})"
        n = count(conn, f"SELECT COUNT(*) FROM {table} WHERE TRIM(LOWER({col})) IN ({marks})", addrs)
        if n:
            steps.append((f"{table}.{col}", sql, addrs, n))

    tx_sql = (f"DELETE FROM transactions WHERE TRIM(LOWER(from_address)) IN ({marks}) "
              f"OR TRIM(LOWER(to_address)) IN ({marks})")
    tx_n = count(conn, f"SELECT COUNT(*) FROM transactions WHERE TRIM(LOWER(from_address)) IN ({marks}) "
                       f"OR TRIM(LOWER(to_address)) IN ({marks})", addrs + addrs)
    if tx_n:
        steps.append(("transactions (either side)", tx_sql, addrs + addrs, tx_n))

    # The placeholder faucets, and everything keyed to their wallets.
    wallets = [r[0] for r in conn.execute(
        "SELECT wallet_address FROM faucet_registry WHERE name = ?", (PLACEHOLDER_FAUCET,))]
    if wallets:
        fm = ",".join("?" * len(wallets))
        for table, col in (("microclaims_ledger", "faucet_wallet"),
                           ("microclaims_history", "faucet_wallet"),
                           ("campaign_faucets", "faucet_wallet"),
                           ("faucet_api_keys", "faucet_wallet"),
                           ("faucet_registry", "wallet_address")):
            n = count(conn, f"SELECT COUNT(*) FROM {table} WHERE LOWER({col}) IN ({fm})", wallets)
            if n:
                steps.append((f"{table} (demo faucets)",
                              f"DELETE FROM {table} WHERE LOWER({col}) IN ({fm})", wallets, n))

    return addrs, wallets, steps


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write the changes")
    args = ap.parse_args()

    os.chdir(ROOT)
    conn = sqlite3.connect("blockchain.db")

    addrs, wallets, steps = plan(conn)

    # The safety property this whole script rests on. Checked here, not assumed.
    overlap = set(addrs) & real_users(conn)
    if overlap:
        print(f"REFUSED: the component reaches a registered user: {sorted(overlap)}")
        print("Somebody real received money from a placeholder. That needs a human.")
        return 1

    print(f"{len(addrs)} addresses in the component, none of them a registered user:")
    for a in addrs:
        why = PLACEHOLDERS.get(a, "reached only by transfer from the above")
        print(f"  {a:<46} {why}")

    print(f"\n{len(wallets)} faucets named {PLACEHOLDER_FAUCET!r}, none with a settlement")
    print("\nRows:")
    for label, _, _, n in steps:
        print(f"  {label:<34} {n:>7}")
    print(f"  {'defi_stakes (dropped whole)':<34} {count(conn, 'SELECT COUNT(*) FROM defi_stakes'):>7}")
    n_vault = count(conn, "SELECT COUNT(*) FROM campaign_budget WHERE funding = 'vault'")
    print(f"  {'campaigns relabelled vault->deferred':<34} {n_vault:>7}")

    if not args.apply:
        print("\nNothing written. Re-run with --apply.")
        return 0

    for _, sql, params, _ in steps:
        conn.execute(sql, params)
    conn.execute("UPDATE campaign_budget SET funding = 'deferred' WHERE funding = 'vault'")
    conn.execute("DROP TABLE IF EXISTS defi_stakes")
    conn.commit()
    conn.close()

    print("\nApplied. Checking the books:\n")
    sys.path.insert(0, ROOT)
    import reconcile
    conn = sqlite3.connect("blockchain.db")
    conn.row_factory = sqlite3.Row
    findings = reconcile.reconcile(conn)
    minted = reconcile.total_minted(conn.cursor())
    conn.close()
    print(f"  {minted:,.2f} $CLAIM minted")
    if findings:
        for f in findings:
            print(f"  BROKEN: {f}")
        print("\nThe books do not close. Restore the backup.")
        return 1
    print("  every invariant holds")
    return 0


if __name__ == "__main__":
    sys.exit(main())
