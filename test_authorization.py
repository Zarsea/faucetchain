"""Endpoints that move value refuse a caller who has not proved who they are.

Each of these took an address out of the request body and acted on it. An
address is public by design, so supplying one proved nothing -- and in the
bounty case the server even ran a check that compared the address the caller
sent against the address on the record, which is a comparison of a value with
itself.

What the four had in common is that the missing check was invisible in the
response: the call succeeded, and the damage showed up in somebody else's
balance. That is why the assertions here are on the refusal and on the
database being untouched, not on an error message.

    python test_authorization.py
"""

import os
import shutil
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))

SOMEBODY = "0x7dda72ad9ad56ce3d031ee6a62b5b94dd40c6ef3"
OPERATOR = "test-operator-token"


def main() -> int:
    workdir = tempfile.mkdtemp(prefix="fcauth-")
    os.environ["SETTLEMENT_OPERATOR_TOKEN"] = OPERATOR
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    import api_server
    from fastapi.testclient import TestClient

    # require_action_signature reads `users` to tell a custodial account from a
    # wallet. Nothing else here touches the database, because every one of these
    # refusals happens before the first query -- which is the point.
    api_server.init_users_table()
    client = TestClient(api_server.app)

    unsigned = [
        (
            "FC-02 spend somebody else's balance on a booster",
            "/api/cyberdrip/booster/buy",
            {"wallet": SOMEBODY, "booster_type": "OVERCLOCK"},
        ),
        (
            "FC-07 put somebody else's name on a bounty",
            "/api/bounties/1/claim",
            {"hunter_address": SOMEBODY},
        ),
        (
            "FC-07 release a bounty reward as its creator",
            "/api/bounties/1/approve",
            {"creator_address": SOMEBODY},
        ),
    ]
    for label, path, body in unsigned:
        r = client.post(path, json=body)
        assert r.status_code == 401, f"{label}: got {r.status_code}, body {r.text[:200]}"

    # FC-05 is an operator action rather than a user one: it mints the epoch's
    # rewards for every online miner, so a signature from any one account would
    # be the wrong kind of permission.
    r = client.post("/api/mining/distribute-epoch")
    assert r.status_code == 401, f"FC-05: got {r.status_code}, body {r.text[:200]}"

    # A wrong token is refused the same as none. compare_digest, not ==.
    r = client.post("/api/mining/distribute-epoch",
                    headers={"X-Operator-Token": OPERATOR + "x"})
    assert r.status_code == 401, f"FC-05 wrong token: got {r.status_code}"

    # The booster refusal must not have been a lucky 400 from the catalog: an
    # unknown booster is a 400, a known one without a signature is a 401. If
    # those two ever swap, the gate moved behind the catalog lookup and an
    # unsigned call with a valid booster would go through.
    r = client.post("/api/cyberdrip/booster/buy",
                    json={"wallet": SOMEBODY, "booster_type": "NOT_A_BOOSTER"})
    assert r.status_code == 400, f"unknown booster should be 400, got {r.status_code}"

    client.close()
    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print("test_authorization.py OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
