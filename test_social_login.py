"""Signing in through Telegram reaches an account; forging one reaches nothing.

The previous social sign-in in this project trusted the browser, so the only
test that matters is the negative one: a payload this server did not verify has
to fail, and fail before anything is written. Every refusal below is checked
against the database as well as the status code, because a 401 that still
created a row would be worse than no check at all.

    python test_social_login.py
"""

import hashlib
import hmac
import os
import shutil
import sqlite3
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
BOT_TOKEN = "123456:TEST-not-a-real-bot-token"


def main() -> int:
    workdir = tempfile.mkdtemp(prefix="fcsocial-")
    os.environ["TELEGRAM_BOT_TOKEN"] = BOT_TOKEN
    os.chdir(workdir)
    sys.path.insert(0, ROOT)

    import api_server
    import social_auth
    from fastapi.testclient import TestClient

    api_server.init_users_table()
    api_server.init_settlement_tables()   # issue_session writes to sessions
    client = TestClient(api_server.app)

    def signed(**fields):
        body = {"id": 777, "first_name": "Ada", "auth_date": int(time.time()), **fields}
        secret = hashlib.sha256(BOT_TOKEN.encode()).digest()
        body["hash"] = hmac.new(
            secret, social_auth.telegram_check_string(body).encode(), hashlib.sha256
        ).hexdigest()
        return body

    def accounts():
        conn = sqlite3.connect(os.path.join(workdir, "blockchain.db"))
        n = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        m = conn.execute("SELECT COUNT(*) FROM social_identities").fetchone()[0]
        conn.close()
        return n, m

    before = accounts()

    # --- what must not work, and must leave nothing behind -----------------
    for label, payload in (
        ("a forged hash", {**signed(), "hash": "0" * 64}),
        ("somebody else's id, same hash", {**signed(), "id": 778}),
        ("a field added after signing", {**signed(), "username": "ada"}),
        ("no hash at all", {"id": 777, "auth_date": int(time.time())}),
        ("a payload from an hour ago", signed(auth_date=int(time.time()) - 3600)),
    ):
        r = client.post("/api/auth/telegram", json={"payload": payload})
        assert r.status_code == 401, f"{label}: got {r.status_code}, {r.text[:120]}"
        assert accounts() == before, f"{label}: refused, but wrote to the database"

    # The refusal says nothing about which part failed: a caller who learns
    # that the hash was right but the date was stale learns how to get closer.
    r = client.post("/api/auth/telegram", json={"payload": {**signed(), "hash": "0" * 64}})
    body = r.text.lower()
    for leak in ("hmac", "auth_date", "bot", "expected", "check string"):
        assert leak not in body, f"the refusal named {leak!r}: {r.text}"

    # --- what must work ----------------------------------------------------
    r = client.post("/api/auth/telegram", json={"payload": signed()})
    assert r.status_code == 200, r.text
    first = r.json()
    assert first["wallet_address"].startswith("0x") and len(first["wallet_address"]) == 42
    assert first.get("session_token"), "no session issued"
    assert accounts() == (before[0] + 1, before[1] + 1), accounts()

    # Signing in again reaches the same account rather than making another.
    r = client.post("/api/auth/telegram", json={"payload": signed()})
    assert r.status_code == 200, r.text
    assert r.json()["wallet_address"] == first["wallet_address"], "same Telegram, different account"
    assert accounts() == (before[0] + 1, before[1] + 1), "a second row for the same identity"

    # The session it issued really acts as that account.
    assert api_server.session_holder(first["session_token"]) == first["wallet_address"]

    # A different Telegram user is a different account.
    r = client.post("/api/auth/telegram", json={"payload": signed(id=778)})
    assert r.status_code == 200, r.text
    assert r.json()["wallet_address"] != first["wallet_address"], "two users, one account"

    # --- and with no bot token, nothing signs in at all --------------------
    del os.environ["TELEGRAM_BOT_TOKEN"]
    r = client.post("/api/auth/telegram", json={"payload": signed()})
    assert r.status_code == 401, f"signed in with no bot token: {r.status_code}"
    os.environ["TELEGRAM_BOT_TOKEN"] = BOT_TOKEN

    client.close()
    os.chdir(ROOT)
    shutil.rmtree(workdir, ignore_errors=True)
    print("test_social_login.py OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
