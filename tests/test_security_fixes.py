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
import settlement  # noqa: E402

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


SESSIONS = {}


def custodial_account(client):
    """A real server-side account, which is what "custodial" is allowed to mean.

    These tests used to pass strings like `google_x@faucetchain.io` as the user,
    relying on is_custodial_address waving through anything that was not an 0x
    address. That hole is closed, and it was the same one the old fake Google
    button walked through.

    The session comes back with it. An account of this kind cannot sign, so the
    session is the only thing that says the caller may act as it — the address
    alone stopped being enough, which is the whole point of having one.
    """
    r = client.post("/api/auth/guest")
    assert r.status_code == 200, r.text
    body = r.json()
    SESSIONS[body["wallet_address"]] = body["session_token"]
    return body["wallet_address"]


def session(user):
    """The headers that let a custodial account act."""
    return {"X-Session-Token": SESSIONS[user]}


def test_claim_amount_is_defined_by_server(client):
    for i, fake_amount in enumerate((999999.0, -5000.0)):
        user = custodial_account(client)  # a real custodial account signs nothing
        body = {"user_address": user, "amount": fake_amount, "block_height": 0,
                "tx_hash": f"0xtest{i}", **solve_proof(client, user)}
        r = client.post("/api/claim", json=body, headers=session(user))
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
            codes.append(client.post("/api/claim", json=body, headers=session(user)).status_code)
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
    msg = settlement.withdraw_message(user, FAUCET, srv.CHAIN_ID, ts)
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


def test_the_internal_faucet_drips_like_any_other(client):
    """A campaign that names the internal faucet pays through it.

    It is a faucet on this network like any other — its own wallet, its own row
    in faucet_api_keys. It simply did not drip, so the same click paid
    differently depending on which door it came through. That is not a rule
    anybody could explain to a partner.
    """
    import os

    faucet = "0x" + "fa" * 20
    os.environ["INTERNAL_FAUCET_WALLET"] = faucet
    conn = db()
    conn.execute(
        "INSERT OR IGNORE INTO faucet_api_keys (faucet_wallet, api_key, created_at, is_active) "
        "VALUES (?, ?, 0, 1)", (faucet, "test-internal-key"))
    campaign = 90410
    conn.execute("INSERT OR REPLACE INTO settlement_campaigns (campaign_id, sponsor, mint, "
                 "registered_at) VALUES (?, ?, ?, 0)", (campaign, "S", "M"))
    conn.execute("INSERT OR REPLACE INTO campaign_budget (campaign_id, total_budget, "
                 "monthly_cap, month_key, funding) VALUES (?, ?, ?, ?, 'vault')",
                 (campaign, 120_000_000_000, 10_000_000_000, srv._month_key(int(srv._time.time()))))
    conn.execute("INSERT OR IGNORE INTO campaign_faucets (campaign_id, faucet_wallet, "
                 "enrolled_at) VALUES (?, ?, 0)", (campaign, faucet))
    conn.commit(); conn.close()

    user = "0x" + "b7" * 20
    r = client.post("/api/faucethub/internal/microclaim",
                    json={"user_wallet": user, **solve_proof(client, user)})
    assert r.status_code == 200, r.text
    dripped = r.json().get("campaigns")
    assert dripped, f"the internal faucet did not drip: {r.json()}"
    assert dripped[0]["campaign_id"] == campaign, dripped
    assert dripped[0]["amount"] > 0, dripped


def test_a_stake_larger_than_the_token_is_refused(client):
    """Between April and June the staking endpoint took any number it was
    given. One identity minted by the old browser login locked 777,877,877
    $CLAIM having ever earned 6.26, against a supply of 99,000,000.

    The balance check that closed it is the real guard. This is the second
    one, and it is worth a line by itself: a position larger than the whole
    token is nonsense whatever the balance says, and two independent reasons
    to refuse is what the first version of this endpoint lacked."""
    user = custodial_account(client)
    r = client.post("/api/staking/stake", json={
        "staker_address": user, "amount": srv.MAX_SUPPLY + 1, "tier": 0,
    }, headers=session(user))
    assert r.status_code == 400, r.text
    assert "supply" in r.json()["detail"].lower(), r.json()

    conn = db()
    n = conn.execute("SELECT COUNT(*) FROM staking_positions WHERE staker_address = ?",
                     (user,)).fetchone()[0]
    conn.close()
    assert n == 0, "a refused stake still wrote a position"


def test_a_position_larger_than_the_token_cannot_be_paid_out(client):
    """Rows written before the balance check existed are still in the table.
    Paying one would mint past MAX_SUPPLY out of a row nobody audited, so the
    payout is refused and the position is left for a person to look at."""
    user = custodial_account(client)
    conn = db()
    conn.execute(
        "INSERT INTO staking_positions (token_id, staker_address, deposit_amount, "
        "deposit_timestamp, lock_duration, yield_basis_points, tier, is_spent, yield_paid) "
        "VALUES (9901, ?, ?, 1, 0, 50, 0, 0, 0)",
        (user, srv.MAX_SUPPLY * 8))
    conn.commit(); conn.close()

    r = client.post("/api/staking/unstake", json={
        "staker_address": user, "token_id": 9901,
    }, headers=session(user))
    assert r.status_code == 400, r.text

    conn = db()
    spent = conn.execute("SELECT is_spent FROM staking_positions WHERE token_id = 9901").fetchone()[0]
    conn.close()
    assert spent == 0, "a refused payout still burned the position"


def test_claims_sealed_together_keep_the_times_they_were_made(client):
    """A block carries up to MAX_CLAIMS_PER_BLOCK claims, and sealing used to
    stamp every one of them with the moment the block closed.

    Claims made hours apart can still be sealed together — that is exactly what
    happens when a chain has been stalled and then starts again. The Sybil
    detector reads the intervals between a user's claims to decide whether they
    are claiming too fast; sealing them together showed intervals of zero, and
    the account was then blocked from claiming at all. It is a pattern no honest
    user can avoid producing, and the block a claim landed in is already
    recorded in block_height.
    """
    user = custodial_account(client)
    made = [1789600000, 1789603600, 1789610800]      # três horas de intervalo

    conn = db()
    # Earlier tests in this file spend the hour's quota; this one is about
    # timestamps, not emission, so it starts the hour clean.
    conn.execute("UPDATE hourly_epochs SET tokens_mined = 0, is_depleted = 0")
    for i, ts in enumerate(made):
        conn.execute(
            "INSERT INTO pending_claims (user_address, amount, timestamp, tx_hash, "
            "block_height, status, source_platform) VALUES (?, ?, ?, ?, 0, 'pending', 'TESTE')",
            (user, 1.0, ts, f"0xpreso{i}"))
    conn.commit(); conn.close()

    # O no e registrado de verdade agora: explore exige o token emitido ali,
    # porque um node_id viaja em todo heartbeat e nao serve como credencial.
    reg = client.post("/api/mining/register", json={
        "node_id": "fcn-selagem", "wallet_address": user,
        "node_name": "selagem", "version": "1.0.0",
    })
    assert reg.status_code == 200, reg.text
    token = reg.json()["node_token"]

    r = client.post("/api/mining/explore",
                    json={"miner_address": user, "node_id": "fcn-selagem"},
                    headers={"X-Node-Token": token})
    assert r.status_code == 200 and r.json()["explored"], r.text

    conn = db()
    sealed = sorted(row[0] for row in conn.execute(
        "SELECT timestamp FROM user_claims WHERE user_address = ?", (user,)))
    conn.close()
    assert sealed == made, f"sealing overwrote the claim times: {sealed}"

    # And so the detector sees three hours between them, not zero seconds.
    intervals = [sealed[i+1] - sealed[i] for i in range(len(sealed) - 1)]
    assert min(intervals) >= 3600, intervals


def test_a_node_that_reconnects_pays_the_wallet_it_arrives_with(client):
    """A node id lives in a file next to the miner, so the same machine
    reconnects under the same id after its payout address changes. The server
    used to keep the address it saw first: it answered "reconnected" and the
    node mined for a stranger, with nothing on screen to say so."""
    node = "fcn-test-rotacao"
    first = "0x" + "a1" * 20
    second = "0x" + "b2" * 20

    def register(wallet, token=None):
        headers = {"X-Node-Token": token} if token else {}
        return client.post("/api/mining/register", json={
            "node_id": node, "wallet_address": wallet,
            "node_name": "teste", "version": "1.0.0",
        }, headers=headers)

    first_reg = register(first)
    assert first_reg.status_code == 200
    token = first_reg.json()["node_token"]
    assert wallet_of(node) == first

    # Sem o token, reconectar sob este node_id e recusado -- que e o ponto:
    # saber o id de alguem deixou de ser suficiente para desviar o pagamento
    # dele. O resto do teste prova que o dono legitimo ainda consegue mudar.
    assert register(second).status_code == 401

    # Uptime accrued for the first address.
    conn = db()
    conn.execute("UPDATE active_miners SET epoch_uptime_seconds = 600 WHERE node_id = ?", (node,))
    conn.commit(); conn.close()

    r = register(second, token)
    assert r.status_code == 200, r.text
    assert wallet_of(node) == second, "the node kept paying the old address"

    # And the presence earned by the old address does not follow the node.
    conn = db()
    uptime = conn.execute("SELECT epoch_uptime_seconds FROM active_miners WHERE node_id = ?",
                          (node,)).fetchone()[0]
    conn.close()
    assert uptime == 0, uptime


def wallet_of(node_id):
    conn = db()
    row = conn.execute("SELECT wallet_address FROM active_miners WHERE node_id = ?",
                       (node_id,)).fetchone()
    conn.close()
    return row[0] if row else None


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
