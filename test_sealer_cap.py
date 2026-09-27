"""No staker may buy the block, however much it locks.

`select_block_sealer` weighed `1 + stake` with no ceiling, so the largest
staker won nearly every round. That is the centralisation Al-awamy et al.
(2025) warn about for PoS in their Table 5, and this repository was the warning
realised: of 935,500 $CLAIM locked, 930,000 sat in one placeholder address —
which would have won roughly 99.4% of every draw.

    python test_sealer_cap.py
"""

import os
import shutil
import sqlite3
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))


def main() -> int:
    workdir = tempfile.mkdtemp(prefix="fcseal-")
    os.environ.setdefault("SETTLEMENT_OPERATOR_TOKEN", "x")
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    import api_server

    cap = api_server.SEALER_STAKE_CAP
    w = api_server.sealer_weight

    # --- the weight itself ------------------------------------------------
    assert w(0) == 1.0, "a node with no stake must still be in the draw"
    assert w(-5) == 1.0, "negative stake cannot subtract from the draw"
    assert w(cap / 2) == 1.0 + cap / 2, "stake below the ceiling still counts"
    assert w(cap) == w(cap * 1000) == 1.0 + cap, "stake above the ceiling buys nothing"
    assert w(10) > w(5), "the ceiling must not flatten everyone"

    # --- what it does to the case that happened here ----------------------
    whale, small = w(930_000), w(5_500)
    got = whale / (whale + small)
    uncapped = 930_001 / (930_001 + 5_501)
    assert uncapped > 0.99, uncapped
    assert got < 0.70, (
        f"the whale still owns {got:.1%} of the draw; the ceiling is too high", cap
    )

    # --- and the election uses it -----------------------------------------
    api_server.init_users_table()
    conn = sqlite3.connect(os.path.join(workdir, "blockchain.db"))
    conn.execute("""CREATE TABLE IF NOT EXISTS active_miners (
        node_id TEXT PRIMARY KEY, wallet_address TEXT, is_online INTEGER,
        last_heartbeat INTEGER, node_token TEXT)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS staking_positions (
        token_id TEXT PRIMARY KEY, staker_address TEXT, deposit_amount REAL,
        is_spent INTEGER)""")
    now = 2_000_000_000
    rich, poor = "0x" + "a" * 40, "0x" + "b" * 40
    for i, (addr, stake) in enumerate(((rich, 930_000.0), (poor, 500.0))):
        conn.execute("INSERT INTO active_miners VALUES (?,?,1,?,?)", (f"n{i}", addr, now, "t"))
        conn.execute("INSERT INTO staking_positions VALUES (?,?,?,0)", (f"p{i}", addr, stake))
    conn.commit()

    c = conn.cursor()
    # 200 different tips, so the seed varies the way real blocks do.
    drawn = [api_server.select_block_sealer(c, "0x%064x" % n, now) for n in range(200)]
    conn.close()

    assert None not in drawn, "the draw returned nobody with miners online"
    poor_share = drawn.count(poor) / len(drawn)
    assert poor_share > 0.05, (
        f"the small node won {poor_share:.1%} of 200 draws; the ceiling is not "
        "reaching the election"
    )

    # The draw is a function of the parent hash alone: same tip, same sealer,
    # recomputable by anyone holding the chain.
    again = api_server.select_block_sealer(sqlite3.connect(
        os.path.join(workdir, "blockchain.db")).cursor(), "0x%064x" % 7, now)
    assert again == drawn[7], "the draw is not deterministic on the parent hash"

    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print(f"test_sealer_cap.py OK  (whale {uncapped:.1%} -> {got:.1%} of the draw)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
