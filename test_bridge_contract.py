"""The partner's bridge reads four fields. This is what keeps them there.

`dist/api/faucetchain.php` in the FaucetHunter tree is PHP on shared hosting
that nobody here deploys and nobody there tests. It calls one endpoint and
reads `user_address` and `campaigns`, and inside each campaign it reads
`campaign_id`, `amount` and `funding`. Rename any of those on this side and the
partner's page silently shows nothing -- no error, no 500, just a faucet that
looks like it pays and does not. So the shape is asserted here, where a rename
fails a check instead of a stranger's screen.

The second thing this pins is the derivation. The bridge sends the user's
*Solana* address, and the whole promise is that the same wallet signing in here
lands in the account the reward went to. Two code paths do that derivation. If
they ever diverge the money is in an account nobody can reach, and nothing else
in this repo would notice.

    python test_bridge_contract.py
"""

import os
import shutil
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))

# A real Phantom-shaped key, base58, 32 bytes decoded. The bridge sends exactly
# this kind of string -- not an 0x address -- because it is what a faucet has.
SOLANA_WALLET = "EL5HubafFFn3XLmzXatb6vrEcwXnAPZGjpPAvpkmjLzA"


def main() -> int:
    workdir = tempfile.mkdtemp(prefix="fcbridge-")
    os.environ["SETTLEMENT_OPERATOR_TOKEN"] = "operator-test-token"
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    import api_server
    from fastapi.testclient import TestClient

    api_server.init_users_table()
    api_server.init_settlement_tables()
    api_server.init_faucet_registry_table()
    api_server.init_faucet_api_keys_table()
    api_server.init_microclaims_tables()
    client = TestClient(api_server.app)
    operator = {"X-Operator-Token": "operator-test-token"}

    # --- the partner registers, exactly as the integration guide says -------
    r = client.post("/api/faucethub/register", json={
        "name": "FaucetHunter",
        "wallet_address": "0x" + "11" * 20,
    })
    assert r.status_code == 200, r.text
    api_key = r.json().get("api_key")
    assert api_key, f"registration returned no key: {r.text}"
    faucet = "0x" + "11" * 20

    # --- a funded campaign, enrolled in that faucet -------------------------
    campaign_id = 990001
    r = client.post("/api/solana/campaign", json={
        "campaign_id": campaign_id,
        "sponsor": SOLANA_WALLET,
        "mint": "So11111111111111111111111111111111111111112",
    }, headers=operator)
    assert r.status_code == 200, r.text

    r = client.post(f"/api/solana/campaign/{campaign_id}/budget", json={
        "total_budget": 1_000_000,
        "monthly_cap": 100_000,
        "funding": "vault",
    }, headers=operator)
    assert r.status_code == 200, r.text

    r = client.post(f"/api/solana/campaign/{campaign_id}/faucets",
                    json={"faucets": [faucet]}, headers=operator)
    assert r.status_code == 200, r.text

    # --- the call the bridge makes, byte for byte ---------------------------
    # Same header name, same two fields, same order of events: the partner has
    # already paid its own user by the time this runs.
    r = client.post("/api/faucethub/microclaim",
                    json={"user_wallet": SOLANA_WALLET, "amount": 1.0},
                    headers={"X-Api-Key": api_key})
    assert r.status_code == 200, r.text
    body = r.json()

    # The two keys the PHP reads off the top level.
    assert "user_address" in body, f"the bridge reads user_address; got {sorted(body)}"
    assert "campaigns" in body, f"the bridge reads campaigns; got {sorted(body)}"
    assert isinstance(body["campaigns"], list), "campaigns must be a list to loop over"
    assert body["campaigns"], "a funded, enrolled campaign paid nothing"

    # The three the PHP reads off each campaign, to show on the partner's page.
    paid = body["campaigns"][0]
    for field in ("campaign_id", "amount", "funding"):
        assert field in paid, f"the bridge reads {field}; got {sorted(paid)}"
    assert paid["amount"] > 0, "credited a campaign entry worth nothing"
    # 'deferred' means the user holds a record of work, not money. A partner
    # that cannot tell the two apart will show the wrong thing to its users.
    assert paid["funding"] in ("vault", "deferred"), paid["funding"]

    # --- the derivation, which is the actual promise ------------------------
    derived = api_server.address_from_solana_wallet(SOLANA_WALLET)
    assert body["user_address"] == derived, (
        f"the reward went to {body['user_address']} but that wallet signs in "
        f"as {derived} -- the user cannot reach their own money"
    )

    # And the reward row really carries that address.
    import sqlite3
    conn = sqlite3.connect(os.path.join(workdir, "blockchain.db"))
    rows = conn.execute(
        "SELECT user_address, amount FROM settlement_rewards WHERE campaign_id = ?",
        (campaign_id,),
    ).fetchall()
    conn.close()
    assert rows == [(derived, paid["amount"])], rows

    # --- 429 is the cooldown, not a failure --------------------------------
    # The bridge returns null on 429 without logging an error, because the
    # five-minute cooldown here is the same trava the partner already has. If
    # this ever became a 400 the partner's log would fill with false alarms.
    r = client.post("/api/faucethub/microclaim",
                    json={"user_wallet": SOLANA_WALLET, "amount": 1.0},
                    headers={"X-Api-Key": api_key})
    assert r.status_code == 429, f"a second immediate claim answered {r.status_code}"

    # --- and a key that is not a key reaches nothing ------------------------
    def reward_count():
        conn = sqlite3.connect(os.path.join(workdir, "blockchain.db"))
        n = conn.execute("SELECT COUNT(*) FROM settlement_rewards").fetchone()[0]
        conn.close()
        return n

    before = reward_count()
    for label, headers in (
        ("no key", {}),
        ("a made-up key", {"X-Api-Key": "fc_live_nothing"}),
    ):
        r = client.post("/api/faucethub/microclaim",
                        json={"user_wallet": SOLANA_WALLET, "amount": 1.0},
                        headers=headers)
        assert r.status_code == 401, f"{label}: got {r.status_code}"
        assert reward_count() == before, f"{label}: refused, but credited a reward"

    client.close()
    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print("test_bridge_contract.py OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
