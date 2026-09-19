"""
Void the staking positions that a closed defect created.

Between April and June 2026 the staking endpoint accepted any amount without
checking the staker had it. Two identities minted in the browser by the old
"Sign in with Google" button used that: `google_bp9avk@faucetchain.io` locked
777,877,877 $CLAIM having ever earned 6.26, against a token whose whole supply
is 99,000,000.

Both holes are closed. `is_custodial_address` stopped trusting anything that is
not an address, so those identities can no longer authenticate at all, and the
positions are frozen rather than dangerous. But they still sit in the table,
counted by `SUM(deposit_amount)` wherever stake is weighed.

This marks them spent and records why. It pays nothing: there is nothing to
pay back, since nothing was ever deposited. The rows stay, because a project
that keeps a defect log should be able to show the evidence rather than a gap.

    python scripts/void_ghost_stake.py            # says what it would do
    python scripts/void_ghost_stake.py --apply    # does it
"""

import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import api_server as srv  # noqa: E402

REASON = "criada pelo furo de staking sem verificacao de saldo (abr-jun 2026)"


def ghosts(c):
    """Positions from an identity that cannot be an address.

    The test is deliberately narrow: an identity with an '@' in it was never a
    wallet, so it came from the browser inventing one. A 0x address that also
    over-staked is a judgement call for a person, not for this script.
    """
    c.execute(
        "SELECT token_id, staker_address, deposit_amount FROM staking_positions "
        "WHERE is_spent = 0 AND staker_address LIKE '%@%' ORDER BY token_id"
    )
    return c.fetchall()


def main() -> None:
    ap = argparse.ArgumentParser(description="Void stake created by a defect")
    ap.add_argument("--apply", action="store_true", help="write the change")
    args = ap.parse_args()

    conn = srv.get_db_connection()
    c = conn.cursor()
    # api_server adds this on start-up, but a repair script should not need the
    # server to have booted first.
    try:
        c.execute("ALTER TABLE staking_positions ADD COLUMN voided_reason TEXT")
    except Exception:
        pass  # already there

    rows = ghosts(c)
    if not rows:
        print("Nothing to void.")
        conn.close()
        return

    total = sum(r[2] for r in rows)
    print(f"{len(rows)} position(s), {total:,.0f} $CLAIM — against a supply of "
          f"{srv.MAX_SUPPLY:,.0f}:\n")
    for token_id, staker, amount in rows:
        c.execute(
            "SELECT COALESCE(SUM(amount), 0) FROM user_claims WHERE user_address = ?",
            (staker,),
        )
        earned = c.fetchone()[0]
        print(f"  #{token_id:<4} {amount:>15,.0f} staked   {earned:>10,.2f} ever earned   {staker}")

    if not args.apply:
        print("\nDry run. Pass --apply to write it.")
        conn.close()
        return

    now = int(srv._time.time())
    for token_id, staker, amount in rows:
        # is_spent takes it out of every weight and sum; voided_reason keeps it
        # from reading as a withdrawal that happened. No payout is credited.
        c.execute(
            "UPDATE staking_positions SET is_spent = 1, spent_timestamp = ?, "
            "yield_paid = 0, voided_reason = ? WHERE token_id = ?",
            (now, REASON, token_id),
        )
        srv.audit_log("STAKE_VOIDED", "-", {
            "token_id": token_id, "staker": staker, "amount": amount, "reason": REASON,
        })
    conn.commit()

    c.execute("SELECT COALESCE(SUM(deposit_amount), 0) FROM staking_positions WHERE is_spent = 0")
    print(f"\nVoided. Active stake is now {c.fetchone()[0]:,.0f} $CLAIM.")
    conn.close()


if __name__ == "__main__":
    main()
