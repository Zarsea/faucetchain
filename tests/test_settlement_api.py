"""Checks da camada de liquidação na Solana: vínculo de carteira, lote e prova.

O que importa aqui é que a raiz publicada e a prova servida sejam as mesmas
que o programa verifica on-chain (faucetchain/programs/faucetchain).

    .venv/Scripts/python.exe tests/test_settlement_api.py
"""
import os
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="faucetchain-settlement-")
os.chdir(TMP)  # api_server e indexer_service abrem 'blockchain.db' relativo ao cwd
sys.path.insert(0, ROOT)

OPERATOR_TOKEN = "op_" + "7" * 32
os.environ["SETTLEMENT_OPERATOR_TOKEN"] = OPERATOR_TOKEN
os.environ["PASSWORD_SALT"] = "test-salt"

import indexer_service  # noqa: E402

indexer_service.init_db()

import api_server as srv  # noqa: E402
import settlement  # noqa: E402

srv.HAS_VECTOR_DB = False  # não carrega ChromaDB/modelo nos testes

from eth_account import Account  # noqa: E402
from eth_account.messages import encode_defunct  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

OP = {"x-operator-token": OPERATOR_TOKEN}
# Endereços reais da Solana, só para ter base58 de 32 bytes válido.
WALLET_A = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
WALLET_B = "SysvarC1ock11111111111111111111111111111111"
WALLET_C = "11111111111111111111111111111112"


def link_body(account, solana_address, ts=None):
    ts = ts or int(time.time())
    user = account.address.lower()
    message = f"FaucetChain Link Solana | chain:{srv.CHAIN_ID} | {user} | {solana_address} | ts:{ts}"
    signature = Account.sign_message(encode_defunct(text=message), private_key=account.key).signature.hex()
    if not signature.startswith("0x"):
        signature = "0x" + signature
    return {
        "address": user,
        "solana_address": solana_address,
        "signature": signature,
        "sig_timestamp": ts,
    }


def test_link_requires_a_real_solana_address(client):
    account = Account.create()
    body = link_body(account, "not-a-wallet")
    assert client.post("/api/solana/link", json=body).status_code == 400
    # base58 válido mas curto demais para ser uma chave pública
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

    # Alice recebe em duas parcelas: o lote soma por carteira antes da árvore.
    for address, amount in (
        (alice.address.lower(), 200_000_000),
        (alice.address.lower(), 50_000_000),
        (bob.address.lower(), 100_000_000),
    ):
        body = {"campaign_id": campaign, "address": address, "amount": amount}
        assert client.post("/api/solana/reward", json=body, headers=OP).status_code == 200

    # Prêmio de quem não ligou carteira fica de fora e espera o próximo lote.
    orphan = {"campaign_id": campaign, "address": "0x" + "cc" * 20, "amount": 999}
    assert client.post("/api/solana/reward", json=orphan, headers=OP).status_code == 200

    batch = client.post("/api/solana/batch", json={"campaign_id": campaign}, headers=OP).json()
    assert batch["root_index"] == 0
    assert batch["leaf_count"] == 2
    assert batch["total_amount"] == 350_000_000
    expected = settlement.build_batch({WALLET_A: 250_000_000, WALLET_B: 100_000_000})
    assert batch["root"] == expected["root"]

    # Cada prova servida tem que passar na mesma verificação do programa.
    root = bytes.fromhex(batch["root"][2:])
    for account, wallet, amount in ((alice, WALLET_A, 250_000_000), (bob, WALLET_B, 100_000_000)):
        served = client.get(f"/api/solana/proof/{account.address.lower()}").json()
        assert served["solana_address"] == wallet
        proof = served["proofs"][0]
        assert proof["amount"] == amount and proof["root"] == batch["root"]
        leaf = settlement.leaf_hash(settlement.decode_pubkey(wallet), amount, proof["leaf_index"])
        assert settlement.verify(root, leaf, proof["leaf_index"], [bytes.fromhex(s[2:]) for s in proof["proof"]])

    # Lote fechado não sai duas vezes.
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

    # As duas provas continuam válidas: cada raiz paga só o seu lote.
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

    # A assinatura da transação que publicou a raiz fica registrada.
    signature = "5" * 88
    marked = client.post(
        f"/api/solana/batch/{first['batch_id']}/published", json={"signature": signature}, headers=OP
    )
    assert marked.status_code == 200
    listed = client.get(f"/api/solana/batches?campaign_id={campaign}").json()["batches"]
    assert {b["root_index"]: b["published_signature"] for b in listed} == {0: signature, 1: None}


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
                print(f"FALHA {test.__name__}: {e}")
    print(f"\n{len(tests) - failures}/{len(tests)} passaram (banco temporário em {TMP})")
    sys.exit(1 if failures else 0)
