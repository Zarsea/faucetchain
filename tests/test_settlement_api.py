"""Checks on the Solana settlement layer: wallet link, batch and proof.

What matters here is that the published root and the proof served are the ones
the program verifies on-chain (faucetchain/programs/faucetchain).

    .venv/Scripts/python.exe tests/test_settlement_api.py
"""
import base64
import json
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-settlement-")
os.chdir(TMP)  # api_server and indexer_service open 'blockchain.db' relative to cwd
sys.path.insert(0, ROOT)

OPERATOR_TOKEN = "op_" + "7" * 32
os.environ["SETTLEMENT_OPERATOR_TOKEN"] = OPERATOR_TOKEN
os.environ["PASSWORD_SALT"] = "test-salt"

# The relayer needs a key before api_server reads its environment. These checks
# never reach the network: every one of them is refused before the send.
from solders.keypair import Keypair  # noqa: E402

RELAYER = Keypair()
RELAYER_PATH = os.path.join(TMP, "relayer.json")
with open(RELAYER_PATH, "w", encoding="utf-8") as _handle:
    json.dump(list(bytes(RELAYER)), _handle)
os.environ["SETTLEMENT_RELAYER_KEYPAIR"] = RELAYER_PATH
# Nothing here talks to a chain. Pointing the RPC at a dead port makes the
# reward-root lookup fail fast and take its "could not ask" path.
os.environ["SOLANA_RPC_URL"] = "http://127.0.0.1:1"
# The treasury collects its share like any other recipient, so it needs a
# wallet. api_server reads this at import time, hence here.
TREASURY_KEY = Keypair.from_seed(bytes([44] * 32))
os.environ["SETTLEMENT_TREASURY_SOLANA"] = str(TREASURY_KEY.pubkey())

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
import settlement  # noqa: E402

srv.HAS_VECTOR_DB = False  # do not load ChromaDB or the model in tests

from eth_account import Account  # noqa: E402
from eth_account.messages import encode_defunct  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

OP = {"x-operator-token": OPERATOR_TOKEN}
# Real Solana addresses, only so the base58 is a valid 32 bytes.
# Real keypairs, from fixed seeds so the addresses -- and therefore the leaf
# order in every tree below -- stay the same on each run. Linking now demands a
# signature from the wallet itself, which a well-known address cannot give.
KEY_A = Keypair.from_seed(bytes([11] * 32))
KEY_B = Keypair.from_seed(bytes([22] * 32))
WALLET_A = str(KEY_A.pubkey())
WALLET_B = str(KEY_B.pubkey())
WALLETS = {WALLET_A: KEY_A, WALLET_B: KEY_B}  # WALLET_C joins below
KEY_C = Keypair.from_seed(bytes([33] * 32))
WALLET_C = str(KEY_C.pubkey())
WALLETS[WALLET_C] = KEY_C


def link_body(account, solana_address, ts=None):
    ts = ts or int(time.time())
    user = account.address.lower()
    message = settlement.link_message(user, solana_address, srv.CHAIN_ID, ts)
    signature = Account.sign_message(encode_defunct(text=message), private_key=account.key).signature.hex()
    if not signature.startswith("0x"):
        signature = "0x" + signature
    body = {
        "address": user,
        "solana_address": solana_address,
        "signature": signature,
        "sig_timestamp": ts,
    }
    # The wallet proves it holds its own key. Unknown addresses (the malformed
    # ones a test feeds on purpose) are rejected before this is ever read.
    key = WALLETS.get(solana_address)
    if key is not None:
        body["solana_signature"] = solana_proof(key, user, solana_address, ts)
        body["solana_sig_timestamp"] = ts
    return body


def solana_proof(key, user, solana_address, ts):
    message = settlement.wallet_proof_message(user, solana_address, srv.CHAIN_ID, ts)
    return base64.b64encode(bytes(key.sign_message(message.encode("utf-8")))).decode()


def test_the_relayer_and_the_proofs_have_a_pace(client):
    """Neither endpoint had a ceiling, and both cost something real.

    The relayer pays SOL for every withdrawal it signs, so a caller holding
    many unclaimed leaves could make it pay for all of them at once. The proof
    endpoint reads Solana on each call, so anyone at all could make the
    sequencer read the chain in a loop. Neither is a hole; both are a rate.
    """
    user, batch = _settled_batch(client, 41)
    body = {"address": user.address.lower(), "batch_id": batch["batch_id"]}

    original = srv.RELAY_HOURLY_PER_ADDRESS
    srv.RELAY_HOURLY_PER_ADDRESS = 2
    srv._rate_windows.clear()
    try:
        codes = [client.post("/api/solana/relay/prepare", json=body).status_code
                 for _ in range(3)]
        # 503 is the chain being unreachable in these tests, which is how far
        # the first two get. The third never reaches the chain at all.
        assert codes == [503, 503, 429], codes

        # A different account has its own ceiling: one caller cannot lock out
        # everybody by spending their own.
        other, other_batch = _settled_batch(client, 42, wallet=WALLET_B)
        r = client.post("/api/solana/relay/prepare", json={
            "address": other.address.lower(), "batch_id": other_batch["batch_id"]})
        assert r.status_code == 503, r.text
    finally:
        srv.RELAY_HOURLY_PER_ADDRESS = original
        srv._rate_windows.clear()

    original = srv.PROOF_HOURLY_PER_IP
    srv.PROOF_HOURLY_PER_IP = 3
    srv._rate_windows.clear()
    try:
        codes = [client.get(f"/api/solana/proof/{user.address.lower()}").status_code
                 for _ in range(4)]
        assert codes == [200, 200, 200, 429], codes
    finally:
        srv.PROOF_HOURLY_PER_IP = original
        srv._rate_windows.clear()


def test_a_transfer_needs_the_session_and_not_a_private_key(client):
    """The transfer screen asked for a private key, and no account has one.

    A guest address is twenty random bytes from secrets.token_hex; a
    wallet-derived one is keccak over a public key. No private key produces
    either, so the form could not work for anybody — while teaching the exact
    habit phishing depends on, and writing the key to localStorage in the clear.
    """
    sender = client.post("/api/auth/guest").json()
    receiver = client.post("/api/auth/guest").json()
    body = {"sender": sender["wallet_address"], "receiver": receiver["wallet_address"],
            "amount": 1.0, "nonce": 1}

    # No session: the address alone is not enough here either.
    assert client.post("/api/transfer", json=body).status_code == 401

    # Somebody else's session does not open this account.
    other = client.post("/api/auth/guest").json()["session_token"]
    assert client.post("/api/transfer", json=body,
                       headers={"X-Session-Token": other}).status_code == 401

    # The holder gets past the proof. An empty account then fails on balance,
    # which is the next check and the one that should be deciding.
    r = client.post("/api/transfer", json=body,
                    headers={"X-Session-Token": sender["session_token"]})
    assert r.status_code == 400, r.text
    assert "aldo" in r.json()["detail"], r.json()


def test_knowing_a_custodial_address_is_not_enough_to_act_as_it(client):
    """The sharpest hole this project had.

    An account whose key the server holds cannot sign, so the signature check
    used to return immediately for it — proving nothing. An address is public
    by design: it is printed on screen, it appears in the explorer, it is what
    you hand someone to be paid. It was never a secret and could not serve as
    one, yet it was the only thing standing between a stranger and the account.

    Linking is the attack worth showing rather than the withdrawal. It moves no
    money on the way through, and afterwards every reward that account earns is
    paid to the thief's wallet.
    """
    guest = client.post("/api/auth/guest").json()
    victim = guest["wallet_address"]
    assert guest.get("session_token"), guest

    thief_wallet = str(KEY_A.pubkey())
    ts = int(time.time())
    steal = {
        "address": victim,
        "solana_address": thief_wallet,
        # The thief holds this wallet and can prove it. That was never the
        # problem: the question is what lets them speak for the victim.
        "solana_signature": solana_proof(KEY_A, victim, thief_wallet, ts),
        "solana_sig_timestamp": ts,
    }

    r = client.post("/api/solana/link", json=steal)
    assert r.status_code == 401, f"the address alone still works: {r.text}"

    # A session belonging to somebody else does not help either.
    other = client.post("/api/auth/guest").json()["session_token"]
    r = client.post("/api/solana/link", json=steal,
                    headers={"X-Session-Token": other})
    assert r.status_code == 401, f"another account's session worked: {r.text}"

    # Nothing was linked while all that was being refused.
    conn = srv.get_db_connection()
    linked = conn.execute("SELECT 1 FROM solana_links WHERE user_address = ?",
                          (victim,)).fetchone()
    conn.close()
    assert linked is None, "a refused link still wrote a row"

    # The account holder, with their own session, can.
    r = client.post("/api/solana/link", json=steal,
                    headers={"X-Session-Token": guest["session_token"]})
    assert r.status_code == 200, r.text


def test_a_session_expires(client):
    """A token that outlives its welcome is a password that never rotates."""
    guest = client.post("/api/auth/guest").json()
    token = guest["session_token"]
    assert srv.session_holder(token) == guest["wallet_address"]

    conn = srv.get_db_connection()
    conn.execute("UPDATE sessions SET expires_at = ? WHERE address = ?",
                 (int(time.time()) - 1, guest["wallet_address"]))
    conn.commit()
    conn.close()
    assert srv.session_holder(token) is None, "an expired session still opened"


def test_the_session_table_holds_no_usable_token(client):
    """Hashed, for the same reason a password table is: a copy of this table
    should not be a set of live sessions."""
    token = client.post("/api/auth/guest").json()["session_token"]
    conn = srv.get_db_connection()
    rows = [r[0] for r in conn.execute("SELECT token_hash FROM sessions").fetchall()]
    conn.close()
    assert token not in rows, "the token itself is stored"
    assert srv._hash_token(token) in rows


def test_a_phantom_wallet_creates_its_own_account(client):
    """The wallet is the account.

    Its address is derived from the public key, so the same Phantom reaches the
    same account on any machine: nothing to store, no password to lose, no
    recovery flow to build. The link is written at sign-up too, because an
    account that earns a reward it cannot be paid is worse than no account.
    """
    key = Keypair.from_seed(bytes([55] * 32))
    wallet = str(key.pubkey())
    expected = srv.address_from_solana_wallet(wallet)

    ts = int(time.time())
    body = {
        "solana_address": wallet,
        "signature": solana_proof(key, expected, wallet, ts),
        "sig_timestamp": ts,
    }
    r = client.post("/api/auth/solana", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["wallet_address"] == expected, r.json()

    # Signing in again reaches the same account rather than making another.
    ts2 = int(time.time())
    again = client.post("/api/auth/solana", json={
        "solana_address": wallet,
        "signature": solana_proof(key, expected, wallet, ts2),
        "sig_timestamp": ts2,
    })
    assert again.status_code == 200, again.text
    assert again.json()["wallet_address"] == expected

    conn = srv.get_db_connection()
    users = conn.execute("SELECT COUNT(*) FROM users WHERE wallet_address = ?",
                         (expected,)).fetchone()[0]
    link = conn.execute("SELECT solana_address FROM solana_links WHERE user_address = ?",
                        (expected,)).fetchone()
    conn.close()
    assert users == 1, users
    assert link and link[0] == wallet, link


def test_signing_in_reaches_the_account_the_wallet_is_already_linked_to(client):
    """Someone who linked Phantom from the payouts screen and later signs in with
    it expects the balance they earned, not an empty account that happens to
    share their key."""
    key = Keypair.from_seed(bytes([66] * 32))
    wallet = str(key.pubkey())
    WALLETS[wallet] = key

    older = Account.create()
    assert client.post("/api/solana/link",
                       json=link_body(older, wallet)).status_code == 200

    ts = int(time.time())
    # The proof names the existing account, which is what the browser is told to
    # sign for; a proof naming the derived account is for a different account and
    # must not open this one.
    r = client.post("/api/auth/solana", json={
        "solana_address": wallet,
        "signature": solana_proof(key, older.address.lower(), wallet, ts),
        "sig_timestamp": ts,
    })
    assert r.status_code == 200, r.text
    assert r.json()["wallet_address"] == older.address.lower(), r.json()
    assert r.json()["wallet_address"] != srv.address_from_solana_wallet(wallet)


def test_the_browser_is_told_which_account_to_sign_for(client):
    """The sentence names the account, so the browser has to know which one
    before it signs. Signing the wrong one produces a valid signature over the
    wrong words, which the server can only read as a forgery — this lookup is
    what stops that."""
    fresh = Keypair.from_seed(bytes([101] * 32))
    wallet = str(fresh.pubkey())
    r = client.get(f"/api/auth/solana/{wallet}")
    assert r.status_code == 200, r.text
    assert r.json() == {"account": srv.address_from_solana_wallet(wallet),
                        "existing": False}, r.json()

    # Once the wallet is linked somewhere, that is the answer instead.
    linked = Keypair.from_seed(bytes([102] * 32))
    wallet2 = str(linked.pubkey())
    WALLETS[wallet2] = linked
    account = Account.create()
    assert client.post("/api/solana/link",
                       json=link_body(account, wallet2)).status_code == 200
    body = client.get(f"/api/auth/solana/{wallet2}").json()
    assert body == {"account": account.address.lower(), "existing": True}, body

    assert client.get("/api/auth/solana/not-a-wallet").status_code == 400


def test_signing_in_needs_the_wallet_key(client):
    """Knowing an address is not holding it."""
    key = Keypair.from_seed(bytes([77] * 32))
    wallet = str(key.pubkey())
    derived = srv.address_from_solana_wallet(wallet)
    ts = int(time.time())

    assert client.post("/api/auth/solana", json={
        "solana_address": wallet, "signature": "", "sig_timestamp": ts,
    }).status_code == 401

    # A signature from a different wallet over the same sentence.
    impostor = Keypair.from_seed(bytes([88] * 32))
    assert client.post("/api/auth/solana", json={
        "solana_address": wallet,
        "signature": solana_proof(impostor, derived, wallet, ts),
        "sig_timestamp": ts,
    }).status_code == 401

    # And nothing was created on the way out.
    conn = srv.get_db_connection()
    rows = conn.execute("SELECT COUNT(*) FROM users WHERE wallet_address = ?",
                        (derived,)).fetchone()[0]
    conn.close()
    assert rows == 0, rows


def test_link_requires_a_real_solana_address(client):
    account = Account.create()
    body = link_body(account, "not-a-wallet")
    assert client.post("/api/solana/link", json=body).status_code == 400
    # valid base58 but too short to be a public key
    body = link_body(account, "11111111111111111111111111111")
    assert client.post("/api/solana/link", json=body).status_code == 400


def test_link_requires_the_owner_signature(client):
    account = Account.create()
    body = link_body(account, WALLET_A)

    unsigned = dict(body, signature=None, sig_timestamp=None)
    assert client.post("/api/solana/link", json=unsigned).status_code == 401

    stolen = dict(body, address=Account.create().address.lower())
    assert client.post("/api/solana/link", json=stolen).status_code == 401

    expired = link_body(account, WALLET_A, ts=int(time.time()) - srv.SIGNATURE_MAX_AGE - 60)
    assert client.post("/api/solana/link", json=expired).status_code == 401

    assert client.post("/api/solana/link", json=body).status_code == 200
    linked = client.get(f"/api/solana/link/{account.address.lower()}").json()
    assert linked["solana_address"] == WALLET_A


def test_link_requires_the_wallet_to_prove_it_holds_the_key(client):
    """Naming a wallet is not owning it.

    The FaucetChain signature says who chose the address. Only a signature from
    the wallet says who can spend from it, and once a root is published the leaf
    pays that address forever -- a typo has no undo.
    """
    # A fresh FaucetChain account per case on purpose: reusing one would reuse
    # its EIP-191 signature, and the replay dedup would answer 401 before the
    # wallet proof is ever read -- the test would pass while proving nothing.
    def case():
        account = Account.create()
        return link_body(account, WALLET_A), account.address.lower()

    body, user = case()
    no_proof = dict(body)
    no_proof.pop("solana_signature")
    assert client.post("/api/solana/link", json=no_proof).status_code == 401

    # signed by a wallet that is not the one being linked
    body, user = case()
    wrong = dict(body, solana_signature=solana_proof(KEY_B, user, WALLET_A, body["sig_timestamp"]))
    assert client.post("/api/solana/link", json=wrong).status_code == 401

    # the right key, but attesting to a different address than the one sent
    body, user = case()
    mismatched = dict(
        body, solana_signature=solana_proof(KEY_A, user, WALLET_B, body["sig_timestamp"])
    )
    assert client.post("/api/solana/link", json=mismatched).status_code == 401

    # the right key, but the proof is older than the window allows
    body, user = case()
    stale_ts = int(time.time()) - srv.SIGNATURE_MAX_AGE - 60
    stale = dict(
        body,
        solana_signature=solana_proof(KEY_A, user, WALLET_A, stale_ts),
        solana_sig_timestamp=stale_ts,
    )
    assert client.post("/api/solana/link", json=stale).status_code == 401

    body, user = case()
    garbage = dict(body, solana_signature="not base64 at all!!")
    assert client.post("/api/solana/link", json=garbage).status_code == 400

    body, user = case()
    assert client.post("/api/solana/link", json=body).status_code == 200


def test_a_click_on_a_partner_faucet_drips_the_campaign_budget(client):
    """The join: one click pays twice.

    Until this existed, a micro-claim credited $CLAIM and stopped, while the
    rewards on Solana only appeared because the demo inserted them by hand.
    """
    import distribution

    faucet = "0x" + "c1" * 20
    reg = client.post("/api/faucethub/register",
                      json={"name": "Partner Faucet", "wallet_address": faucet})
    assert reg.status_code == 200, reg.text
    api_key = reg.json()["api_key"]

    campaign = 90210
    assert client.post("/api/solana/campaign",
                       json={"campaign_id": campaign, "sponsor": WALLET_C, "mint": WALLET_B},
                       headers=OP).status_code == 200

    budget, cap = 120_000_000_000, 10_000_000_000      # 120k and 10k, six decimals
    assert client.post(f"/api/solana/campaign/{campaign}/budget",
                       json={"total_budget": budget, "monthly_cap": cap, "funding": "vault"},
                       headers=OP).status_code == 200
    assert client.post(f"/api/solana/campaign/{campaign}/faucets",
                       json={"faucets": [faucet]}, headers=OP).status_code == 200

    user = Account.create().address.lower()
    r = client.post("/api/faucethub/microclaim",
                    json={"user_wallet": user, "amount": 1.0},
                    headers={"X-Api-Key": api_key})
    assert r.status_code == 200, r.text

    dripped = r.json().get("campaigns") or []
    assert len(dripped) == 1, dripped
    assert dripped[0]["campaign_id"] == campaign

    # The user gets 80%, the treasury 20% — the cut that funds continuity.
    gross = dripped[0]["amount"] + dripped[0]["treasury"]
    user_share, treasury_share = distribution.split(gross)
    assert (dripped[0]["amount"], dripped[0]["treasury"]) == (user_share, treasury_share), dripped[0]
    # 80/20, give or take the rounding that integer division owes
    assert abs(dripped[0]["amount"] / gross - 0.80) < 0.0001, dripped[0]

    # It reached the ledger the batch is built from.
    conn = srv.get_db_connection()
    row = conn.execute(
        "SELECT amount FROM settlement_rewards WHERE campaign_id = ? AND user_address = ?",
        (campaign, user)).fetchone()
    assert row and row[0] == dripped[0]["amount"], row

    # And the budget was debited by the gross, not by the user's share.
    spent = conn.execute("SELECT spent_total, spent_month FROM campaign_budget WHERE campaign_id = ?",
                         (campaign,)).fetchone()
    conn.close()
    assert spent[0] == gross and spent[1] == gross, spent


def test_the_treasury_share_reaches_the_batch_instead_of_the_partner(client):
    """The 20% used to be computed, returned in the response and credited to no
    one.

    That was not merely a missing record. The root published on-chain carried
    only the users' 80%, so `committed` grew by 80 while the appchain debited
    100 — and withdraw_surplus, which reads surplus as anything the vault holds
    above committed minus paid, let the partner take the difference back. The
    treasury's share was returned to the partner who was supposed to pay it.

    The fix makes the treasury an ordinary recipient: one leaf per batch, the
    same root, the same proof. This test is the arithmetic that says the two
    books now agree.
    """
    faucet = "0x" + "d4" * 20
    api_key = client.post("/api/faucethub/register",
                          json={"name": "Treasury Faucet", "wallet_address": faucet}
                          ).json()["api_key"]

    campaign = 90310
    assert client.post("/api/solana/campaign",
                       json={"campaign_id": campaign, "sponsor": WALLET_C, "mint": WALLET_B},
                       headers=OP).status_code == 200
    assert client.post(f"/api/solana/campaign/{campaign}/budget",
                       json={"total_budget": 120_000_000_000, "monthly_cap": 10_000_000_000},
                       headers=OP).status_code == 200
    assert client.post(f"/api/solana/campaign/{campaign}/faucets",
                       json={"faucets": [faucet]}, headers=OP).status_code == 200

    # Two people click, each collecting to their own wallet. A leaf belongs to a
    # wallet rather than to a claim, so two users on one wallet would share one
    # leaf — which is why they get different ones here.
    gross = owed = 0
    for wallet in (WALLET_A, WALLET_B):
        user = Account.create()
        assert client.post("/api/solana/link",
                           json=link_body(user, wallet)).status_code == 200
        drip = client.post("/api/faucethub/microclaim",
                           json={"user_wallet": user.address.lower(), "amount": 1.0},
                           headers={"X-Api-Key": api_key}).json()["campaigns"][0]
        gross += drip["amount"] + drip["treasury"]
        owed += drip["treasury"]
    assert owed > 0

    conn = srv.get_db_connection()
    recorded = conn.execute(
        "SELECT spent_total, treasury_owed FROM campaign_budget WHERE campaign_id = ?",
        (campaign,)).fetchone()
    conn.close()
    # The budget drains by the gross, and the treasury's part of it is now a debt
    # on the campaign rather than a number in an HTTP response.
    assert recorded[0] == gross, recorded
    assert recorded[1] == owed, recorded

    batch = client.post("/api/solana/batch", json={"campaign_id": campaign},
                        headers=OP).json()

    # Here is the point: the root now promises everything the budget was
    # debited for. Before this, it promised 80% of it and the rest went home
    # with the partner.
    assert batch["total_amount"] == gross, batch
    assert batch["leaf_count"] == 3, batch     # two wallets and the treasury

    conn = srv.get_db_connection()
    leaf = conn.execute(
        "SELECT amount, solana_address FROM settlement_rewards "
        "WHERE campaign_id = ? AND user_address = ?",
        (campaign, srv.TREASURY_ADDRESS)).fetchone()
    left = conn.execute("SELECT treasury_owed FROM campaign_budget WHERE campaign_id = ?",
                        (campaign,)).fetchone()[0]
    conn.close()
    assert leaf and leaf[0] == owed, leaf
    assert leaf[1] == str(TREASURY_KEY.pubkey()), leaf
    # Paid out once, not on every batch from now on.
    assert left == 0, left


def test_the_budget_is_a_ceiling_not_a_suggestion(client):
    """A root the vault cannot cover is refused on-chain, and that refusal costs
    everyone in the batch. So the budget stops the credit, not the publish."""
    faucet = "0x" + "c2" * 20
    api_key = client.post("/api/faucethub/register",
                          json={"name": "Nearly Empty", "wallet_address": faucet}).json()["api_key"]
    campaign = 90211
    client.post("/api/solana/campaign",
                json={"campaign_id": campaign, "sponsor": WALLET_C, "mint": WALLET_B}, headers=OP)
    # A budget so small that one claim would exhaust it many times over
    client.post(f"/api/solana/campaign/{campaign}/budget",
                json={"total_budget": 10, "monthly_cap": 10, "funding": "vault"}, headers=OP)
    client.post(f"/api/solana/campaign/{campaign}/faucets",
                json={"faucets": [faucet]}, headers=OP)

    total = 0
    for _ in range(5):
        user = Account.create().address.lower()
        r = client.post("/api/faucethub/microclaim", json={"user_wallet": user, "amount": 1.0},
                        headers={"X-Api-Key": api_key})
        assert r.status_code == 200, r.text
        for d in (r.json().get("campaigns") or []):
            total += d["amount"] + d["treasury"]

    conn = srv.get_db_connection()
    spent = conn.execute("SELECT spent_total, total_budget FROM campaign_budget WHERE campaign_id = ?",
                         (campaign,)).fetchone()
    conn.close()
    assert spent[0] <= spent[1], spent          # never past what was committed
    assert total <= 10, total


def test_a_faucet_cannot_enrol_itself_in_someone_elses_budget(client):
    """The campaign declares where it appears. A faucet does not opt in."""
    faucet = "0x" + "c3" * 20
    client.post("/api/faucethub/register", json={"name": "Opportunist", "wallet_address": faucet})
    campaign = 90212
    client.post("/api/solana/campaign",
                json={"campaign_id": campaign, "sponsor": WALLET_C, "mint": WALLET_B}, headers=OP)

    # No operator token: the enrolment is refused
    assert client.post(f"/api/solana/campaign/{campaign}/faucets",
                       json={"faucets": [faucet]}).status_code == 401
    # And a wallet that is not a registered faucet cannot be enrolled at all
    assert client.post(f"/api/solana/campaign/{campaign}/faucets",
                       json={"faucets": ["0x" + "ff" * 20]}, headers=OP).status_code == 400


def test_only_the_operator_credits_and_closes(client):
    reward = {"campaign_id": 1, "address": "0x" + "ab" * 20, "amount": 10}
    assert client.post("/api/solana/reward", json=reward).status_code == 401
    assert client.post("/api/solana/reward", json=reward, headers={"x-operator-token": "wrong"}).status_code == 401
    assert client.post("/api/solana/batch", json={"campaign_id": 1}).status_code == 401


def test_batch_root_and_proofs_match_the_program_tree(client):
    campaign = 7
    alice, bob = Account.create(), Account.create()
    for account, wallet in ((alice, WALLET_A), (bob, WALLET_B)):
        assert client.post("/api/solana/link", json=link_body(account, wallet)).status_code == 200

    # Alice is paid in two instalments: the batch sums per wallet before the tree.
    for address, amount in (
        (alice.address.lower(), 200_000_000),
        (alice.address.lower(), 50_000_000),
        (bob.address.lower(), 100_000_000),
    ):
        body = {"campaign_id": campaign, "address": address, "amount": amount}
        assert client.post("/api/solana/reward", json=body, headers=OP).status_code == 200

    # A reward for someone with no linked wallet stays out and waits for the next batch.
    orphan = {"campaign_id": campaign, "address": "0x" + "cc" * 20, "amount": 999}
    assert client.post("/api/solana/reward", json=orphan, headers=OP).status_code == 200

    batch = client.post("/api/solana/batch", json={"campaign_id": campaign}, headers=OP).json()
    assert batch["root_index"] == 0
    assert batch["leaf_count"] == 2
    assert batch["total_amount"] == 350_000_000
    expected = settlement.build_batch({WALLET_A: 250_000_000, WALLET_B: 100_000_000})
    assert batch["root"] == expected["root"]

    # Every proof served has to pass the same check the program runs.
    root = bytes.fromhex(batch["root"][2:])
    for account, wallet, amount in ((alice, WALLET_A, 250_000_000), (bob, WALLET_B, 100_000_000)):
        served = client.get(f"/api/solana/proof/{account.address.lower()}").json()
        assert served["solana_address"] == wallet
        proof = served["proofs"][0]
        assert proof["amount"] == amount and proof["root"] == batch["root"]
        leaf = settlement.leaf_hash(settlement.decode_pubkey(wallet), amount, proof["leaf_index"])
        assert settlement.verify(root, leaf, proof["leaf_index"], [bytes.fromhex(s[2:]) for s in proof["proof"]])

    # A closed batch does not go out twice.
    assert client.post("/api/solana/batch", json={"campaign_id": campaign}, headers=OP).status_code == 400


def test_second_batch_only_carries_new_rewards(client):
    campaign = 8
    carol = Account.create()
    assert client.post("/api/solana/link", json=link_body(carol, WALLET_C)).status_code == 200

    def credit(amount):
        body = {"campaign_id": campaign, "address": carol.address.lower(), "amount": amount}
        assert client.post("/api/solana/reward", json=body, headers=OP).status_code == 200

    credit(1_000)
    first = client.post("/api/solana/batch", json={"campaign_id": campaign}, headers=OP).json()
    credit(2_500)
    second = client.post("/api/solana/batch", json={"campaign_id": campaign}, headers=OP).json()

    assert (first["root_index"], first["total_amount"]) == (0, 1_000)
    assert (second["root_index"], second["total_amount"]) == (1, 2_500)
    assert first["root"] != second["root"]

    # Both proofs stay valid: each root pays only its own batch.
    proofs = client.get(f"/api/solana/proof/{carol.address.lower()}").json()["proofs"]
    assert sorted(p["amount"] for p in proofs) == [1_000, 2_500]
    for proof in proofs:
        leaf = settlement.leaf_hash(settlement.decode_pubkey(WALLET_C), proof["amount"], proof["leaf_index"])
        assert settlement.verify(
            bytes.fromhex(proof["root"][2:]),
            leaf,
            proof["leaf_index"],
            [bytes.fromhex(s[2:]) for s in proof["proof"]],
        )

    # The signature of the transaction that published the root is recorded.
    signature = "5" * 88
    marked = client.post(
        f"/api/solana/batch/{first['batch_id']}/published", json={"signature": signature}, headers=OP
    )
    assert marked.status_code == 200
    listed = client.get(f"/api/solana/batches?campaign_id={campaign}").json()["batches"]
    assert {b["root_index"]: b["published_signature"] for b in listed} == {0: signature, 1: None}


def test_a_relink_does_not_move_a_published_reward(client):
    """A closed root pays the wallet it was built for, whatever happens later."""
    campaign = 9
    dave = Account.create()
    assert client.post("/api/solana/link", json=link_body(dave, WALLET_A)).status_code == 200
    body = {"campaign_id": campaign, "address": dave.address.lower(), "amount": 4_000}
    assert client.post("/api/solana/reward", json=body, headers=OP).status_code == 200
    batch = client.post("/api/solana/batch", json={"campaign_id": campaign}, headers=OP).json()

    # Dave moves to another wallet after the root is already committed.
    assert client.post("/api/solana/link", json=link_body(dave, WALLET_B)).status_code == 200

    proofs = client.get(f"/api/solana/proof/{dave.address.lower()}").json()["proofs"]
    settled = [p for p in proofs if p["batch_id"] == batch["batch_id"]]
    assert len(settled) == 1, proofs
    assert settled[0]["recipient"] == WALLET_A, settled[0]
    leaf = settlement.leaf_hash(
        settlement.decode_pubkey(WALLET_A), settled[0]["amount"], settled[0]["leaf_index"]
    )
    assert settlement.verify(
        bytes.fromhex(batch["root"][2:]),
        leaf,
        settled[0]["leaf_index"],
        [bytes.fromhex(s[2:]) for s in settled[0]["proof"]],
    )


def _settled_batch(client, campaign, wallet=WALLET_A):
    """A user with a closed batch, ready to withdraw."""
    user = Account.create()
    assert client.post("/api/solana/link", json=link_body(user, wallet)).status_code == 200
    body = {"campaign_id": campaign, "address": user.address.lower(), "amount": 7_000}
    assert client.post("/api/solana/reward", json=body, headers=OP).status_code == 200
    assert client.post(
        "/api/solana/campaign",
        json={"campaign_id": campaign, "sponsor": WALLET_C, "mint": WALLET_B},
        headers=OP,
    ).status_code == 200
    batch = client.post("/api/solana/batch", json={"campaign_id": campaign}, headers=OP).json()
    return user, batch


def _unsigned_claim(client, user, batch):
    """What the relayer would build, without ever asking it to sign."""
    import solana_settlement as chain
    from solders.hash import Hash
    from solders.message import Message
    from solders.pubkey import Pubkey
    from solders.transaction import Transaction

    proof = client.get(f"/api/solana/proof/{user.address.lower()}").json()["proofs"][0]
    instruction = chain.claim_reward(
        chain.load_idl(),
        Pubkey.from_string(WALLET_A),
        RELAYER.pubkey(),
        Pubkey.from_string(WALLET_C),
        Pubkey.from_string(WALLET_B),
        batch["campaign_id"],
        batch["root_index"],
        proof["leaf_index"],
        proof["amount"],
        [bytes.fromhex(s[2:]) for s in proof["proof"]],
    )
    blockhash = Hash.from_string("11111111111111111111111111111111")
    message = Message.new_with_blockhash([instruction], RELAYER.pubkey(), blockhash)
    return instruction, Transaction.new_unsigned(message)


def _submit(client, user, batch, transaction):
    return client.post(
        "/api/solana/relay/submit",
        json={
            "address": user.address.lower(),
            "batch_id": batch["batch_id"],
            "transaction": base64.b64encode(bytes(transaction)).decode(),
        },
    )


def test_relayer_refuses_what_it_did_not_build(client):
    from solders.instruction import AccountMeta, Instruction
    from solders.hash import Hash
    from solders.message import Message
    from solders.transaction import Transaction

    import solana_settlement as chain

    user, batch = _settled_batch(client, 20)
    expected, _ = _unsigned_claim(client, user, batch)
    blockhash = Hash.from_string("11111111111111111111111111111111")

    # Draining the relayer with a plain transfer it never authored.
    drain = Instruction(
        chain.SYSTEM_PROGRAM,
        (2).to_bytes(4, "little") + (5_000_000_000).to_bytes(8, "little"),
        [AccountMeta(RELAYER.pubkey(), True, True), AccountMeta(chain.SYSTEM_PROGRAM, False, True)],
    )
    forged = Transaction.new_unsigned(
        Message.new_with_blockhash([drain], RELAYER.pubkey(), blockhash)
    )
    assert _submit(client, user, batch, forged).status_code == 400

    # Same instruction, one byte of the amount changed.
    tampered_data = bytearray(bytes(expected.data))
    tampered_data[12] ^= 0xFF
    tampered = Instruction(expected.program_id, bytes(tampered_data), expected.accounts)
    assert _submit(
        client, user, batch,
        Transaction.new_unsigned(Message.new_with_blockhash([tampered], RELAYER.pubkey(), blockhash)),
    ).status_code == 400

    # The withdrawal, plus a second instruction smuggled in behind it.
    two = Transaction.new_unsigned(
        Message.new_with_blockhash([expected, drain], RELAYER.pubkey(), blockhash)
    )
    assert _submit(client, user, batch, two).status_code == 400

    # Not a transaction at all.
    assert client.post(
        "/api/solana/relay/submit",
        json={"address": user.address.lower(), "batch_id": batch["batch_id"], "transaction": "bm9wZQ=="},
    ).status_code == 400


def test_relayer_refuses_an_unsigned_withdrawal(client):
    """The right instruction is still not enough: the owner has to sign."""
    user, batch = _settled_batch(client, 21)
    _, unsigned = _unsigned_claim(client, user, batch)
    assert _submit(client, user, batch, unsigned).status_code == 400


def test_relayer_refuses_a_batch_that_is_not_yours(client):
    mine, my_batch = _settled_batch(client, 22)
    stranger = Account.create()
    assert client.post("/api/solana/link", json=link_body(stranger, WALLET_B)).status_code == 200
    _, unsigned = _unsigned_claim(client, mine, my_batch)
    response = client.post(
        "/api/solana/relay/submit",
        json={
            "address": stranger.address.lower(),
            "batch_id": my_batch["batch_id"],
            "transaction": base64.b64encode(bytes(unsigned)).decode(),
        },
    )
    assert response.status_code == 404, response.text


def test_relayer_needs_the_campaign_registered(client):
    user = Account.create()
    assert client.post("/api/solana/link", json=link_body(user, WALLET_A)).status_code == 200
    body = {"campaign_id": 23, "address": user.address.lower(), "amount": 500}
    assert client.post("/api/solana/reward", json=body, headers=OP).status_code == 200
    batch = client.post("/api/solana/batch", json={"campaign_id": 23}, headers=OP).json()
    response = client.post(
        "/api/solana/relay/prepare",
        json={"address": user.address.lower(), "batch_id": batch["batch_id"]},
    )
    assert response.status_code == 409, response.text


def _bitmaps(roots, claimed: bool):
    """Answer as the chain would: every leaf of every root claimed, or none.

    Returning real bytes rather than a verdict keeps the bit arithmetic in
    solana_settlement.leaf_claimed under test instead of stubbing it out.
    """
    import solana_settlement as chain

    fill = 0xFF if claimed else 0x00
    return {r: bytes(chain.REWARD_ROOT_BITS_OFFSET) + bytes([fill] * 8) for r in roots}


def test_relayer_refuses_a_reward_already_withdrawn(client):
    """The program would reject it anyway; the point is not to pay to find out."""
    user, batch = _settled_batch(client, 24)
    body = {"address": user.address.lower(), "batch_id": batch["batch_id"]}
    # Nothing is claimed yet, so it gets as far as needing a blockhash — and
    # says the chain is unreachable instead of raising.
    assert client.post("/api/solana/relay/prepare", json=body).status_code == 503

    original = srv._root_bitmaps
    srv._root_bitmaps = lambda chain, roots: _bitmaps(roots, True)
    try:
        assert client.post("/api/solana/relay/prepare", json=body).status_code == 409
    finally:
        srv._root_bitmaps = original


def test_proofs_say_what_was_already_withdrawn(client):
    user, batch = _settled_batch(client, 25)

    # With the chain unreachable the screen is told nothing rather than a guess.
    served = client.get(f"/api/solana/proof/{user.address.lower()}").json()["proofs"][0]
    assert served["claimed"] is None, served

    original = srv._root_bitmaps
    srv._root_bitmaps = lambda chain, roots: _bitmaps(roots, True)
    try:
        served = client.get(f"/api/solana/proof/{user.address.lower()}").json()["proofs"][0]
        assert served["claimed"] is True, served
    finally:
        srv._root_bitmaps = original

    srv._root_bitmaps = lambda chain, roots: _bitmaps(roots, False)
    try:
        served = client.get(f"/api/solana/proof/{user.address.lower()}").json()["proofs"][0]
        assert served["claimed"] is False, served
    finally:
        srv._root_bitmaps = original


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
