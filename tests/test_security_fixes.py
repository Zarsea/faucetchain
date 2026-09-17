"""Checks das correções de segurança do api_server.py (Crypto World's Fair, set/2026).

Roda contra um banco temporário, sem tocar no blockchain.db do projeto:

    .venv/Scripts/python.exe tests/test_security_fixes.py
"""
import asyncio
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-test-")
os.chdir(TMP)  # api_server e indexer_service abrem 'blockchain.db' relativo ao cwd
sys.path.insert(0, ROOT)

FAUCET = "0x" + "fa" * 20
os.environ["INTERNAL_FAUCET_WALLET"] = FAUCET
os.environ["INTERNAL_FAUCET_API_KEY"] = "fch_test_" + "0" * 32
os.environ.setdefault("PASSWORD_SALT", "test-salt")

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402

srv.HAS_VECTOR_DB = False  # não carrega ChromaDB/modelo nos testes

from eth_account import Account  # noqa: E402
from eth_account.messages import encode_defunct  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def solve_proof(client, user):
    ch = client.get("/api/poc/challenge").json()
    bits, nonce = ch["difficultyBits"], 0
    while True:
        digest = srv.keccak256(srv.poc_message(ch["epochId"], ch["parentHash"], user, nonce).encode())
        if int.from_bytes(digest, "big") >> (256 - bits) == 0:
            return {"poc_nonce": nonce, "poc_epoch_id": ch["epochId"], "poc_parent_hash": ch["parentHash"]}
        nonce += 1


def db():
    return srv.get_db_connection()


def custodial_account(client):
    """A real server-side account, which is what "custodial" is allowed to mean.

    These tests used to pass strings like `google_x@faucetchain.io` as the user,
    relying on is_custodial_address waving through anything that was not an 0x
    address. That hole is closed, and it was the same one the old fake Google
    button walked through.
    """
    r = client.post("/api/auth/guest")
    assert r.status_code == 200, r.text
    return r.json()["wallet_address"]


def test_claim_amount_is_defined_by_server(client):
    for i, fake_amount in enumerate((999999.0, -5000.0)):
        user = custodial_account(client)  # a real custodial account signs nothing
        body = {"user_address": user, "amount": fake_amount, "block_height": 0,
                "tx_hash": f"0xtest{i}", **solve_proof(client, user)}
        r = client.post("/api/claim", json=body)
        assert r.status_code == 200, r.text
        conn = db()
        stored = conn.execute("SELECT amount FROM pending_claims WHERE tx_hash = ?", (f"0xtest{i}",)).fetchone()[0]
        expected = srv.current_claim_reward(conn.cursor())
        conn.close()
        assert stored == expected == r.json()["amount"], (stored, expected)


def test_a_made_up_identity_cannot_skip_the_signature(client):
    """Not being an address used to mean being trusted.

    is_custodial_address answered True for anything that did not match
    0x[0-9a-f]{40}, so a caller who sent a string instead of an address skipped
    every signature check. The old "Sign in with Google" button minted exactly
    such a string in the browser, which is how the hole stayed invisible.
    """
    invented = "google_x7f2a@faucetchain.io"
    body = {"user_address": invented, "block_height": 0, "tx_hash": "0xmadeup",
            **solve_proof(client, invented)}
    assert client.post("/api/claim", json=body).status_code == 401

    # and a well-formed address nobody registered is still not custodial either
    stranger = "0x" + "ab" * 20
    body = {"user_address": stranger, "block_height": 0, "tx_hash": "0xstranger",
            **solve_proof(client, stranger)}
    assert client.post("/api/claim", json=body).status_code == 401


def test_difficulty_rises_with_quota_usage(client):
    base = srv.CLAIM_PROOF_DIFFICULTY_BITS
    assert client.get("/api/poc/challenge").json()["difficultyBits"] == base

    now = int(time.time())
    conn = db()
    c = conn.cursor()
    epoch_id, _, _ = srv.get_hourly_epoch_state(c, now)
    srv.record_epoch_mint(c, epoch_id, srv.TOKENS_PER_HOUR * 0.6)  # 60% da hora consumida
    conn.commit()
    conn.close()
    assert client.get("/api/poc/challenge").json()["difficultyBits"] == base + 2

    conn = db()
    conn.execute("DELETE FROM hourly_epochs WHERE epoch_id = ?", (epoch_id,))
    conn.commit()
    conn.close()
    assert client.get("/api/poc/challenge").json()["difficultyBits"] == base


def test_ip_cap_blocks_wallet_farm(client):
    srv.claim_ip_wallets.clear()
    original_cap = srv.CLAIM_IP_HOURLY_WALLETS
    srv.CLAIM_IP_HOURLY_WALLETS = 3
    try:
        codes = []
        for i in range(4):
            user = custodial_account(client)
            body = {"user_address": user, "block_height": 0,
                    "tx_hash": f"0xfarm{i}", **solve_proof(client, user)}
            codes.append(client.post("/api/claim", json=body).status_code)
        assert codes == [200, 200, 200, 429], codes
    finally:
        srv.CLAIM_IP_HOURLY_WALLETS = original_cap
        srv.claim_ip_wallets.clear()


def test_uptime_rewards_count_in_hourly_quota(client):
    now = int(time.time())
    conn = db()
    c = conn.cursor()
    epoch_id, _, _ = srv.get_hourly_epoch_state(c, now)
    srv.record_epoch_mint(c, epoch_id, srv.TOKENS_PER_HOUR - 10)  # sobram 10 na hora
    c.execute("INSERT INTO active_miners (node_id, wallet_address, registered_at, last_heartbeat, epoch_uptime_seconds, is_online) "
              "VALUES ('node-test', '0x" + "ab" * 20 + "', ?, ?, 600, 1)", (now, now))
    conn.commit()
    conn.close()

    first = asyncio.run(srv._distribute_epoch())
    assert first["status"] == "distributed", first
    assert first["total_distributed"] <= 10 + 1e-9, first

    conn = db()
    _, mined, depleted = srv.get_hourly_epoch_state(conn.cursor(), now)
    conn.execute("UPDATE active_miners SET epoch_uptime_seconds = 600, last_heartbeat = ? WHERE node_id = 'node-test'", (now,))
    conn.commit()
    conn.close()
    assert mined <= srv.TOKENS_PER_HOUR + 1e-6 and depleted, (mined, depleted)

    second = asyncio.run(srv._distribute_epoch())
    assert second == {"status": "hourly_quota_depleted", "distributed": 0}, second


def test_microclaim_withdraw_requires_owner_signature(client):
    acct = Account.create()
    user = acct.address.lower()
    conn = db()
    conn.execute("INSERT INTO microclaims_ledger (faucet_wallet, user_wallet, virtual_balance, total_claimed, claim_count, last_claim_at, created_at) "
                 "VALUES (?, ?, 20, 20, 1, 0, 0)", (FAUCET, user))
    conn.commit()
    conn.close()

    r = client.post("/api/faucethub/microclaim/withdraw", json={"user_wallet": user, "faucet_wallet": FAUCET})
    assert r.status_code == 401, r.text

    ts = int(time.time())
    msg = f"FaucetChain Withdraw | chain:{srv.CHAIN_ID} | {user} | {FAUCET} | ts:{ts}"
    sig = Account.sign_message(encode_defunct(text=msg), acct.key).signature.hex()
    body = {"user_wallet": user, "faucet_wallet": FAUCET, "signature": sig, "sig_timestamp": ts}
    r = client.post("/api/faucethub/microclaim/withdraw", json=body)
    # passou da autenticação; a faucet de teste não tem reserva L1
    assert r.status_code == 400 and "reserve" in r.json()["detail"].lower(), r.text

    attacker = Account.create()
    forged = Account.sign_message(encode_defunct(text=msg), attacker.key).signature.hex()
    r = client.post("/api/faucethub/microclaim/withdraw", json={**body, "signature": forged})
    assert r.status_code == 401, r.text

    r = client.post("/api/faucethub/microclaim/withdraw", json=body)  # replay
    assert r.status_code == 401, r.text


def test_internal_microclaim_needs_proof_and_fixes_amount(client):
    user = Account.create().address.lower()
    r = client.post("/api/faucethub/internal/microclaim", json={"user_wallet": user})
    assert r.status_code == 400, r.text

    r = client.post("/api/faucethub/internal/microclaim",
                    json={"user_wallet": user, "amount": 100, **solve_proof(client, user)})
    assert r.status_code == 200, r.text
    assert r.json()["credited"] == srv.INTERNAL_MICROCLAIM_AMOUNT

    r = client.post("/api/faucethub/internal/microclaim", json={"user_wallet": user, **solve_proof(client, user)})
    assert r.status_code == 429, r.text

    conn = db()
    claims = conn.execute("SELECT total_claims FROM cyberdrip_profiles WHERE wallet = ?", (user,)).fetchone()[0]
    conn.close()
    assert claims == 1, claims

    assert client.post("/api/cyberdrip/record-claim", json={"wallet": user, "amount": 999}).status_code in (404, 405)
    with open(os.path.join(ROOT, "components", "useCyberDrip.ts"), encoding="utf-8") as f:
        assert "fch_" not in f.read(), "API key voltou para o frontend"


def test_cyberdrip_profile_rejects_partial_addresses(client):
    for partial in ("0", "0x", "0x7", "0x77"):
        assert client.get(f"/api/cyberdrip/profile/{partial}").status_code == 400
    conn = db()
    created = conn.execute("SELECT COUNT(*) FROM cyberdrip_profiles WHERE length(wallet) < 42").fetchone()[0]
    conn.close()
    assert created == 0, created
    assert client.get("/api/cyberdrip/profile/0x" + "cd" * 20).status_code == 200


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    failures = 0
    with TestClient(srv.app) as client:
        for test in tests:
            try:
                test(client)
                print(f"OK    {test.__name__}")
            except AssertionError as e:
                failures += 1
                print(f"FAIL  {test.__name__}: {e}")
    print(f"\n{len(tests) - failures}/{len(tests)} passed (temporary database in {TMP})")
    sys.exit(1 if failures else 0)
