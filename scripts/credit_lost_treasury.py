"""Credits the treasury share that three campaigns drew and never recorded.

`_campaign_drip` debits a partner's budget by the gross and splits it: the user
gets their part as a reward leaf, the treasury's part accrues in
`campaign_budget.treasury_owed` until a batch flushes it into a leaf of its own.
Before `treasury_owed` existed, the split was computed, returned in the API
response, and credited to nobody. The budget drained by the gross anyway, so
`withdraw_surplus` would have handed the difference back to the partner -- money
the partner had already spent.

Three campaigns are in that state. The amount is not assumed from the 80/20
ratio; it is read out of the ledger as

    spent_total - (rewards already paid to users)

which on the campaigns that *did* record their share reproduces the recorded
number exactly. That is the check that makes the arithmetic trustworthy, and
this script runs it before touching anything.

Crediting `treasury_owed` puts the money back into the existing pipeline rather
than hand-writing a leaf: the next batch flushes it like any other. It spends
nothing new, because the budget was already debited by the gross.

    python scripts/credit_lost_treasury.py            # shows, changes nothing
    python scripts/credit_lost_treasury.py --apply    # writes
"""

import argparse
import os
import sqlite3
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

USERS = (
    "SELECT COALESCE(SUM(amount), 0) FROM settlement_rewards "
    "WHERE campaign_id = ? AND user_address NOT LIKE '0xfaucetchaintreasury%'"
)
TREASURY = (
    "SELECT COALESCE(SUM(amount), 0) FROM settlement_rewards "
    "WHERE campaign_id = ? AND user_address LIKE '0xfaucetchaintreasury%'"
)


def survey(conn):
    """Every campaign whose treasury share is recorded nowhere, and how much.

    A campaign whose share was already flushed into a leaf has `treasury_owed`
    back at zero and is *not* broken -- reading the column alone would condemn
    it. Both places have to be looked at, which is the whole reason this
    returns a survey instead of a list of ids.
    """
    c = conn.cursor()
    owing, healthy = [], []
    # Materialised, and the inner reads get their own cursor: running a query on
    # the cursor being iterated silently ends the iteration after one row.
    budgets = c.execute(
        "SELECT campaign_id, spent_total, treasury_owed FROM campaign_budget "
        "WHERE spent_total > 0 ORDER BY campaign_id"
    ).fetchall()
    c = conn.cursor()
    for cid, spent, owed in budgets:
        c.execute(USERS, (cid,))
        users = c.fetchone()[0] or 0
        c.execute(TREASURY, (cid,))
        paid = c.fetchone()[0] or 0
        recorded = (owed or 0) + paid
        missing = (spent - users) - recorded
        if recorded <= 0 and missing > 0:
            owing.append((cid, spent, users, missing))
        elif recorded > 0:
            healthy.append((cid, recorded, spent - users))
    return owing, healthy


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.path.join(ROOT, "blockchain.db"))
    ap.add_argument("--apply", action="store_true", help="write the credits")
    args = ap.parse_args()

    conn = sqlite3.connect(args.db)
    owing, healthy = survey(conn)

    # The campaigns that did record a share are the control group: if
    # spent - users does not reproduce what they recorded, the formula is wrong
    # and nothing here should be written.
    for cid, recorded, derived in healthy:
        if recorded != derived:
            print(
                f"REFUSING: campaign {cid} recorded {recorded:,} but the ledger "
                f"derives {derived:,}. The formula does not hold on a campaign "
                f"that is known good, so it cannot be trusted on a broken one."
            )
            return 2
    if healthy:
        print(f"formula agrees with all {len(healthy)} campaigns that recorded a share")

    if not owing:
        print("nothing to credit")
        return 0

    total = sum(row[3] for row in owing)
    print(f"\n{'campaign':>10} {'drew':>14} {'paid users':>14} {'to credit':>12}")
    for cid, spent, users, missing in owing:
        print(f"{cid:>10} {spent:>14,} {users:>14,} {missing:>12,}")
    print(f"{'':>10} {'':>14} {'total':>14} {total:>12,} $CLAIM")

    if not args.apply:
        print("\nnothing written. Re-run with --apply to credit these.")
        return 0

    c = conn.cursor()
    for cid, _spent, _users, missing in owing:
        c.execute(
            "UPDATE campaign_budget SET treasury_owed = treasury_owed + ? "
            "WHERE campaign_id = ?",
            (missing, cid),
        )
    conn.commit()

    still, _ = survey(conn)
    if still:
        print(f"\nFAILED: {len(still)} campaigns still owing after the write")
        return 1
    print(f"\ncredited {total:,} $CLAIM across {len(owing)} campaigns")
    print("the next batch flushes it into a leaf like any other share")
    return 0


if __name__ == "__main__":
    sys.exit(main())
