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
# receipt lookup fail fast and take its "could not ask" path.
os.environ["SOLANA_RPC_URL"] = "http://127.0.0.1:1"

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


def test_relayer_refuses_a_reward_already_withdrawn(client):
    """The program would reject it anyway; the point is not to pay to find out."""
    user, batch = _settled_batch(client, 24)
    body = {"address": user.address.lower(), "batch_id": batch["batch_id"]}
    # Nothing is claimed yet, so it gets as far as needing a blockhash — and
    # says the chain is unreachable instead of raising.
    assert client.post("/api/solana/relay/prepare", json=body).status_code == 503

    original = srv._receipts_claimed
    srv._receipts_claimed = lambda chain, receipts: set(receipts)
    try:
        assert client.post("/api/solana/relay/prepare", json=body).status_code == 409
    finally:
        srv._receipts_claimed = original


def test_proofs_say_what_was_already_withdrawn(client):
    user, batch = _settled_batch(client, 25)

    # With the chain unreachable the screen is told nothing rather than a guess.
    served = client.get(f"/api/solana/proof/{user.address.lower()}").json()["proofs"][0]
    assert served["claimed"] is None, served

    original = srv._receipts_claimed
    srv._receipts_claimed = lambda chain, receipts: set(receipts)
    try:
        served = client.get(f"/api/solana/proof/{user.address.lower()}").json()["proofs"][0]
        assert served["claimed"] is True, served
    finally:
        srv._receipts_claimed = original

    srv._receipts_claimed = lambda chain, receipts: set()
    try:
        served = client.get(f"/api/solana/proof/{user.address.lower()}").json()["proofs"][0]
        assert served["claimed"] is False, served
    finally:
        srv._receipts_claimed = original


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
