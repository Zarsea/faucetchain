"""FC-01 stays shut, and a FaucetPay account is named before it is proved.

FC-01 was two endpoints handing a faucet's API key, or a fresh one, to anyone
who knew the faucet's wallet address -- an address GET /api/faucethub/faucets
publishes. The first three tests here fail the moment either endpoint stops
asking for a signature, which is the only way that hole comes back.

The rest walks phase 1: an account is *named* by check-address, and becomes
*proved* only when a payment carrying the exact challenge amount turns up. The
two states are kept apart on purpose, because treating a named account as
proved is how you end up paying a stranger who typed someone else's address.

The server opens 'blockchain.db' by a relative path, so this runs in a
temporary directory against a database of its own and never touches yours.

    python test_faucetpay_identity.py
"""

import os
import shutil
import sqlite3
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))

FAUCET = "0x1b021998f6297936986bcc34f6fdc1cd5c82af06"
FP_ADDRESS = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT"
FP_HASH = "dev-hash-aaa"
OPERATOR = "test-operator-token"


def main() -> int:
    workdir = tempfile.mkdtemp(prefix="fcid-")
    os.environ["SETTLEMENT_OPERATOR_TOKEN"] = OPERATOR
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    import api_server
    import faucetpay
    from fastapi.testclient import TestClient

    # Only the two tables this exercises, instead of the whole startup: every
    # other subsystem would be booted to prove nothing about these endpoints.
    api_server.init_faucet_registry_table()
    api_server.init_faucet_api_keys_table()
    api_server.init_users_table()  # require_action_signature reads it

    client = TestClient(api_server.app)

    # A faucet of our own. register hands the key back once, which is fine:
    # that response goes to whoever proved they could create it.
    r = client.post("/api/faucethub/register",
                    json={"name": "Torneira de teste", "wallet_address": FAUCET})
    assert r.status_code == 200, (r.status_code, r.text)
    real_key = r.json()["api_key"]
    assert real_key

    # --- FC-01 -------------------------------------------------------------
    r = client.get(f"/api/faucethub/my-key/{FAUCET}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "api_key" not in body, f"my-key still leaks the key: {body}"
    assert "total_requests" in body, "counters should survive; only the key left"

    r = client.post("/api/faucethub/reveal-key", json={"wallet_address": FAUCET})
    assert r.status_code == 401, f"reveal-key without a signature returned {r.status_code}"
    assert real_key not in r.text

    r = client.post("/api/faucethub/regenerate-key", json={"wallet_address": FAUCET})
    assert r.status_code == 401, f"regenerate-key without a signature returned {r.status_code}"

    # And it really did not rotate: the original key still works. A refusal
    # that cut the owner off anyway would be the denial half of FC-01 surviving.
    conn = sqlite3.connect(os.path.join(workdir, "blockchain.db"))
    still = conn.execute(
        "SELECT api_key FROM faucet_api_keys WHERE faucet_wallet = ? AND is_active = 1",
        (FAUCET,),
    ).fetchone()
    conn.close()
    assert still and still[0] == real_key, "a refused regenerate must change nothing"

    # --- fase 1: nomear ----------------------------------------------------
    r = client.post("/api/faucethub/faucetpay/link",
                    json={"wallet_address": FAUCET, "faucetpay_address": FP_ADDRESS})
    assert r.status_code == 401, "naming an account is an action; it has to be signed"

    # Past the signature, so the rest of the path can be walked. Patched, not
    # bypassed: the check above is what proves the gate exists.
    api_server.require_action_signature = lambda *a, **k: None
    faucetpay.check_address = lambda address, currency=None, transport=None: FP_HASH

    r = client.post("/api/faucethub/faucetpay/link",
                    json={"wallet_address": FAUCET, "faucetpay_address": FP_ADDRESS})
    assert r.status_code == 200, r.text
    named = r.json()
    assert named["faucetpay_user_hash"] == FP_HASH
    assert named["proved"] is False, "check-address alone never proves an account"
    amount = named["proof"]["amount"]
    assert faucetpay.PROOF_AMOUNT_MIN <= amount <= faucetpay.PROOF_AMOUNT_MAX

    # Named is not proved, so the developer roll stays empty and says why.
    r = client.get("/api/faucethub/faucetpay/devs")
    assert r.status_code == 200, r.text
    roll = r.json()
    assert roll["proved"] == 0 and roll["developers"] == []
    assert roll["named_not_proved"] == 1

    # --- fase 1: provar ----------------------------------------------------
    conn = sqlite3.connect(os.path.join(workdir, "blockchain.db"))
    linked_at = conn.execute(
        "SELECT faucetpay_linked_at FROM faucet_api_keys WHERE faucet_wallet = ?",
        (FAUCET,),
    ).fetchone()[0]
    conn.close()

    good = {"user_hash": FP_HASH, "amount": amount, "timestamp": linked_at + 30}

    r = client.post("/api/faucethub/faucetpay/prove",
                    json={"wallet_address": FAUCET, "payments": [good]})
    assert r.status_code == 401, "proving is an operator action"

    op = {"X-Operator-Token": OPERATOR}
    for label, payment in (
        ("outra conta", {**good, "user_hash": "someone-else"}),
        ("valor errado", {**good, "amount": amount + 1}),
        ("fora da janela", {**good, "timestamp": linked_at - 1}),
    ):
        r = client.post("/api/faucethub/faucetpay/prove",
                        json={"wallet_address": FAUCET, "payments": [payment]},
                        headers=op)
        assert r.status_code == 400, f"{label} should not prove anything: {r.text}"

    r = client.get("/api/faucethub/faucetpay/devs")
    assert r.json()["proved"] == 0, "a failed proof must leave the account named"

    r = client.post("/api/faucethub/faucetpay/prove",
                    json={"wallet_address": FAUCET, "payments": [good]},
                    headers=op)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "proved"

    r = client.get("/api/faucethub/faucetpay/devs")
    roll = r.json()
    assert roll["proved"] == 1, roll
    assert roll["developers"][0]["dev"] == FP_HASH
    assert roll["developers"][0]["faucets"] == 1
    assert roll["named_not_proved"] == 0

    # Proving twice is not an error and does not move the date.
    when = roll["developers"][0]["proved_since"]
    r = client.post("/api/faucethub/faucetpay/prove",
                    json={"wallet_address": FAUCET, "payments": [good]},
                    headers=op)
    assert r.status_code == 200 and r.json()["proved_at"] == when, r.text

    client.close()
    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print("test_faucetpay_identity.py OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
