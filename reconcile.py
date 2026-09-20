"""
FaucetChain — do the books close?

Every check here is a sentence about the ledger that must be true, written so
that a violation names the numbers rather than saying "failed". They are not
opinions about the accounting: each one is derived from the definitions
api_server already uses — `get_total_minted` for supply, and the same columns
`get_user_balance` sums — so a disagreement is a real one and not two
implementations of the same idea drifting apart.

Two of these would have caught defects this project actually shipped:

  - 777,877,877 $CLAIM locked in staking_positions by an account that had ever
    earned 6.26, against a supply of 99,000,000. Nothing ever asked whether the
    stake could exist.
  - A partner budget drained by the gross while the treasury's share of it was
    credited to nobody, so the difference went back to the partner.

Both sat in the tables for months. Neither broke a test, because no test was
looking at the books as a whole.

It is a pure function of a database connection: no clock, no network, nothing
to configure. That is what lets it run in CI against a database a test built,
and against production on demand.

    python reconcile.py                 # the live database
    python reconcile.py --db other.db
"""

import argparse
import os
import sqlite3
import sys

MAX_SUPPLY = 99_000_000.0

# Money is stored as REAL here, so sums of many rows drift in the last places.
# A cent is far below anything that matters and far above float noise.
TOLERANCE = 0.01


class Finding:
    """One broken invariant, with the numbers that broke it."""

    def __init__(self, check: str, detail: str):
        self.check = check
        self.detail = detail

    def __str__(self) -> str:
        return f"{self.check}: {self.detail}"


def _scalar(c, sql, params=()):
    c.execute(sql, params)
    row = c.fetchone()
    return (row[0] if row and row[0] is not None else 0) or 0


def total_minted(c) -> float:
    """Every $CLAIM that has ever come into existence.

    The same definition as api_server.get_total_minted: mints happen only in
    user_claims and mining_rewards. Transfers and staking move supply that
    already exists.
    """
    return (_scalar(c, "SELECT COALESCE(SUM(amount), 0) FROM user_claims")
            + _scalar(c, "SELECT COALESCE(SUM(reward_amount), 0) FROM mining_rewards"))


def supply_within_cap(c):
    """Nothing may mint past the cap the whitepaper states."""
    minted = total_minted(c)
    if minted > MAX_SUPPLY + TOLERANCE:
        return Finding(
            "supply above the cap",
            f"{minted:,.2f} minted against a cap of {MAX_SUPPLY:,.0f}",
        )
    return None


def stake_within_supply(c):
    """Nobody can lock tokens that were never created.

    This is the ghost-stake check. It reads active positions only: a voided one
    is recorded on purpose and is not a claim on anything.
    """
    try:
        staked = _scalar(
            c, "SELECT COALESCE(SUM(deposit_amount), 0) FROM staking_positions WHERE is_spent = 0")
    except sqlite3.OperationalError:
        return None  # no staking on this installation
    minted = total_minted(c)
    if staked > minted + TOLERANCE:
        return Finding(
            "more staked than exists",
            f"{staked:,.2f} locked against {minted:,.2f} ever minted",
        )
    return None


def no_negative_balances(c):
    """A balance below zero means something was spent twice.

    Balance is summed exactly as get_user_balance does it, including the
    exclusion of CLAIM and MINING_FEE rows from transactions — those mirror
    mints already counted, and counting them again doubles every claim.
    """
    try:
        addresses = [r[0] for r in c.execute(
            "SELECT user_address FROM user_claims "
            "UNION SELECT wallet_address FROM mining_rewards "
            "UNION SELECT from_address FROM transactions "
            "UNION SELECT to_address FROM transactions"
        ) if r[0]]
    except sqlite3.OperationalError:
        return None

    mirrors = "(tx_type IS NULL OR tx_type NOT IN ('CLAIM','MINING_FEE'))"
    for addr in addresses:
        balance = (
            _scalar(c, "SELECT COALESCE(SUM(amount), 0) FROM user_claims WHERE user_address = ?", (addr,))
            + _scalar(c, "SELECT COALESCE(SUM(reward_amount), 0) FROM mining_rewards WHERE wallet_address = ?", (addr,))
            + _scalar(c, f"SELECT COALESCE(SUM(value), 0) FROM transactions WHERE to_address = ? AND {mirrors}", (addr,))
            - _scalar(c, f"SELECT COALESCE(SUM(value), 0) FROM transactions WHERE from_address = ? AND {mirrors}", (addr,))
        )
        if balance < -TOLERANCE:
            return Finding("negative balance", f"{addr} holds {balance:,.4f}")
    return None


def no_claim_counted_twice(c):
    """One proof of claim, one credit.

    A duplicated tx_hash in user_claims is the same work paid for more than
    once, which the hourly quota would never notice: it counts what was minted,
    not what it was minted for.
    """
    try:
        c.execute(
            "SELECT tx_hash, COUNT(*) FROM user_claims WHERE tx_hash IS NOT NULL "
            "GROUP BY tx_hash HAVING COUNT(*) > 1 LIMIT 1")
    except sqlite3.OperationalError:
        return None
    row = c.fetchone()
    if row:
        return Finding("claim credited twice", f"{row[0]} appears {row[1]} times")
    return None


def treasury_share_is_accounted_for(c):
    """A budget that drained must have paid the treasury something.

    The drip debits the partner's budget by the gross and splits it. When the
    treasury's part is computed and credited nowhere, the budget still drains
    and withdraw_surplus hands the difference back to the partner -- which is
    exactly what happened. The check does not assume the ratio, only that the
    share exists, so changing 80/20 does not make it lie.
    """
    try:
        rows = list(c.execute(
            "SELECT campaign_id, spent_total, treasury_owed FROM campaign_budget WHERE spent_total > 0"))
    except sqlite3.OperationalError:
        return None  # campaigns not set up on this installation

    findings = []
    for campaign_id, spent, owed in rows:
        paid = _scalar(
            c,
            "SELECT COALESCE(SUM(amount), 0) FROM settlement_rewards "
            "WHERE campaign_id = ? AND user_address LIKE '0xfaucetchaintreasury%'",
            (campaign_id,),
        )
        if (owed or 0) + paid <= 0:
            users = _scalar(
                c,
                "SELECT COALESCE(SUM(amount), 0) FROM settlement_rewards "
                "WHERE campaign_id = ? AND user_address NOT LIKE '0xfaucetchaintreasury%'",
                (campaign_id,),
            )
            findings.append(Finding(
                "treasury share vanished",
                f"campaign {campaign_id} drew {spent:,.0f}, paid users {users:,.0f}, "
                f"and the treasury has nothing -- {spent - users:,.0f} unaccounted",
            ))
    return findings or None


CHECKS = (
    supply_within_cap,
    stake_within_supply,
    no_negative_balances,
    no_claim_counted_twice,
    treasury_share_is_accounted_for,
)


def reconcile(conn) -> list:
    """Every broken invariant, in the order they are checked. Empty means the
    books close.

    A check returns one Finding, a list of them, or None. The list matters: the
    treasury check used to stop at the first campaign it found, which reported
    one offender when the database held nine. A reconciliation that under-counts
    is worse than none, because it is believed.
    """
    c = conn.cursor()
    out = []
    for check in CHECKS:
        found = check(c)
        if found is None:
            continue
        out.extend(found if isinstance(found, list) else [found])
    return out


SCHEMA = (
    "CREATE TABLE user_claims (user_address TEXT, amount REAL, tx_hash TEXT)",
    "CREATE TABLE mining_rewards (wallet_address TEXT, reward_amount REAL)",
    "CREATE TABLE transactions (hash TEXT, from_address TEXT, to_address TEXT, "
    "value REAL, tx_type TEXT)",
    "CREATE TABLE staking_positions (token_id INTEGER, staker_address TEXT, "
    "deposit_amount REAL, is_spent INTEGER DEFAULT 0)",
    "CREATE TABLE campaign_budget (campaign_id INTEGER, spent_total INTEGER, "
    "treasury_owed INTEGER)",
    "CREATE TABLE settlement_rewards (campaign_id INTEGER, user_address TEXT, amount INTEGER)",
)


def _books(rows=()):
    """A small ledger in memory, so each invariant can be shown catching the
    thing it exists for rather than asserted to."""
    conn = sqlite3.connect(":memory:")
    for statement in SCHEMA:
        conn.execute(statement)
    conn.execute("INSERT INTO user_claims VALUES ('0xaa', 1000.0, '0x1')")
    for sql in rows:
        conn.execute(sql)
    return conn


def asset_solvency(rows):
    """Solvency one asset at a time, and a verdict that refuses to average.

    A reserve only answers for obligations in its own denomination. The report
    used to add every faucet's $CLAIM together, compare it against $CLAIM
    micro-claims, and publish one `systemSolvent` -- which said nothing at all
    about the campaign tokens users are actually owed, while looking like it
    had. A surplus of $CLAIM does not pay a shortfall of somebody's SPL mint,
    and no single boolean can mean both.

    `rows` are dicts with `asset`, `reserve` and `obligations`; a reserve of
    None means it could not be read, which is not the same as zero and must not
    resolve to solvent.

    Returns (rows_with_verdict, all_solvent) where all_solvent is None when any
    asset could not be evaluated: unknown is its own answer.
    """
    out, unknown, insolvent = [], False, False
    for row in rows:
        reserve, owed = row.get("reserve"), row.get("obligations") or 0
        if reserve is None:
            solvent = None
            unknown = True
        else:
            solvent = reserve + TOLERANCE >= owed
            insolvent = insolvent or not solvent
        out.append({**row, "solvent": solvent,
                    "shortfall": None if reserve is None else max(0.0, owed - reserve)})
    if insolvent:
        return out, False
    return out, (None if unknown else True)


def _self_check() -> None:
    # A ledger with one honest claim and nothing else closes.
    assert reconcile(_books()) == [], "a clean ledger was reported broken"

    # Each invariant catches the defect it was written for. The cases are the
    # real ones, scaled down: the numbers are this project's own history.
    cases = {
        "supply above the cap": (
            f"INSERT INTO mining_rewards VALUES ('0xbb', {MAX_SUPPLY * 2})",),
        "more staked than exists": (
            "INSERT INTO staking_positions VALUES (4, 'ghost@x.io', 777777777, 0)",),
        "negative balance": (
            "INSERT INTO transactions VALUES ('0xh', '0xaa', '0xbb', 5000.0, NULL)",),
        "claim credited twice": (
            "INSERT INTO user_claims VALUES ('0xaa', 1.0, '0x1')",),
        "treasury share vanished": (
            "INSERT INTO campaign_budget VALUES (710364, 3204651, 0)",
            "INSERT INTO settlement_rewards VALUES (710364, '0xuser', 2563716)"),
    }
    for expected, rows in cases.items():
        found = [f.check for f in reconcile(_books(rows))]
        assert expected in found, f"{expected!r} went unnoticed; got {found}"

    # Every offender, not the first. The live database held nine campaigns with
    # no treasury share and this reported one, which is how eight of them stayed
    # invisible through a check that was passing judgement on all of them.
    two = (
        "INSERT INTO campaign_budget VALUES (710364, 3204651, 0)",
        "INSERT INTO settlement_rewards VALUES (710364, '0xuser', 2563716)",
        "INSERT INTO campaign_budget VALUES (789356, 49999276, 0)",
        "INSERT INTO settlement_rewards VALUES (789356, '0xuser', 39999420)",
    )
    both = reconcile(_books(two))
    assert len(both) == 2, f"expected both campaigns, got {[str(f) for f in both]}"
    assert "710364" in str(both[0]) and "789356" in str(both[1])
    # The detail carries what is missing, so the repair does not have to be
    # worked out again by hand.
    assert "640,935 unaccounted" in str(both[0]), str(both[0])

    # A voided position is recorded on purpose and is not a claim on anything.
    voided = ("INSERT INTO staking_positions VALUES (4, 'ghost@x.io', 777777777, 1)",)
    assert reconcile(_books(voided)) == [], "a voided position still counted"

    # And the treasury check does not assume the ratio: any share satisfies it,
    # so changing 80/20 does not make this lie.
    paid = ("INSERT INTO campaign_budget VALUES (1, 1000, 0)",
            "INSERT INTO settlement_rewards VALUES (1, '0xfaucetchaintreasury00', 1)")
    assert reconcile(_books(paid)) == [], "a treasury that was paid was flagged"

    print(f"reconcile.py OK — {len(CHECKS)} invariants, each shown catching its case")


def main() -> None:
    ap = argparse.ArgumentParser(description="Check that the FaucetChain books close")
    ap.add_argument("--db", default=os.getenv("FAUCETCHAIN_DB", "blockchain.db"))
    ap.add_argument("--self-check", action="store_true",
                    help="prove each invariant catches its case, without a database")
    args = ap.parse_args()

    if args.self_check:
        _self_check()
        return

    if not os.path.exists(args.db):
        raise SystemExit(f"No database at {args.db}")

    conn = sqlite3.connect(args.db)
    findings = reconcile(conn)
    c = conn.cursor()
    minted = total_minted(c)
    conn.close()

    print(f"{minted:,.2f} $CLAIM minted of {MAX_SUPPLY:,.0f}\n")
    for finding in findings:
        print(f"  BROKEN  {finding}")
    if not findings:
        print(f"  {len(CHECKS)}/{len(CHECKS)} invariants hold. The books close.")
    sys.exit(1 if findings else 0)

    # Solvencia nao se soma entre ativos. Um excedente grande de $CLAIM ao lado
    # de um deficit num token de campanha era publicado como "solvente".
    rows, verdict = asset_solvency([
        {"asset": "CLAIM", "reserve": 1_000_000.0, "obligations": 10.0},
        {"asset": "So1ana...mint", "reserve": 1.0, "obligations": 500.0},
    ])
    assert verdict is False, "a shortfall in one asset was covered by another"
    assert rows[0]["solvent"] is True and rows[1]["solvent"] is False
    assert rows[1]["shortfall"] == 499.0

    # Nao conseguir ler uma reserva nao e o mesmo que ela ser zero, e nao pode
    # virar "solvente" nem "insolvente".
    rows, verdict = asset_solvency([
        {"asset": "CLAIM", "reserve": 10.0, "obligations": 1.0},
        {"asset": "unreadable", "reserve": None, "obligations": 5.0},
    ])
    assert verdict is None, f"unknown resolved to {verdict}"
    assert rows[1]["solvent"] is None and rows[1]["shortfall"] is None

    # Um deficit conhecido decide, mesmo com outro ativo ilegivel ao lado.
    _, verdict = asset_solvency([
        {"asset": "a", "reserve": 0.0, "obligations": 5.0},
        {"asset": "b", "reserve": None, "obligations": 5.0},
    ])
    assert verdict is False

    assert asset_solvency([]) == ([], True)


if __name__ == "__main__":
    main()
