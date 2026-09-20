"""
FaucetChain — reward batches for the settlement program on Solana.

The appchain keeps distributing. Every so often it closes a batch of rewards
and publishes only its Merkle root on Solana; each user withdraws by proving
their leaf is in that root.

This module builds the batch. It has to produce exactly the tree that
`programs/faucetchain/src/merkle.rs` verifies inside the program:

  leaf   = keccak256(pubkey ‖ amount u64 LE ‖ index u32 LE)
  parent = keccak256(left ‖ right), direction taken from the index bit
  an odd level duplicates its last node

(the combination rule is the one compute_merkle_root_and_proof already used in
api_server.py; only the leaf differs, because here it carries the amount)

Running `python settlement.py` executes the self-check, which includes the
fixed vector the Rust test pins as well.
"""

import datetime as _dt
from typing import Dict, List, Sequence, Tuple

from eth_hash.auto import keccak

B58_ALPHABET = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def decode_pubkey(address: str) -> bytes:
    """Base58 -> 32 bytes. Rejects anything that is not an address."""
    num = 0
    for char in address.encode():
        digit = B58_ALPHABET.find(char)
        if digit < 0:
            raise ValueError(f"Invalid base58 character in {address!r}")
        num = num * 58 + digit
    body = num.to_bytes((num.bit_length() + 7) // 8, "big")
    zeros = len(address) - len(address.lstrip("1"))
    decoded = b"\x00" * zeros + body
    if len(decoded) != 32:
        raise ValueError(f"{address!r} is not a 32-byte Solana address")
    return decoded


def leaf_hash(pubkey: bytes, amount: int, index: int) -> bytes:
    if len(pubkey) != 32:
        raise ValueError("pubkey must be 32 bytes")
    if not 0 <= amount < 2**64:
        raise ValueError("amount must fit in u64")
    if not 0 <= index < 2**32:
        raise ValueError("index must fit in u32")
    return keccak(pubkey + amount.to_bytes(8, "little") + index.to_bytes(4, "little"))


def root_and_proofs(leaves: Sequence[bytes]) -> Tuple[bytes, List[List[bytes]]]:
    """The batch root and each leaf's proof, in the order they came in."""
    if not leaves:
        raise ValueError("empty batch")
    proofs: List[List[bytes]] = [[] for _ in leaves]
    level = list(leaves)
    tracked = list(range(len(leaves)))  # where each leaf sits in the current level
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])
        for leaf_pos, node in enumerate(tracked):
            proofs[leaf_pos].append(level[node ^ 1])
        level = [keccak(level[i] + level[i + 1]) for i in range(0, len(level), 2)]
        tracked = [node // 2 for node in tracked]
    return level[0], proofs


def build_batch(rewards: Dict[str, int]) -> dict:
    """Closes a batch from {solana address: amount in base units}.

    Leaves are ordered by address, not by arrival: anyone auditing the batch
    rebuilds the same tree without knowing the order rows were written in.
    """
    entries = sorted((addr, amount) for addr, amount in rewards.items() if amount > 0)
    if not entries:
        raise ValueError("no positive reward in the batch")
    leaves = [
        leaf_hash(decode_pubkey(addr), amount, index)
        for index, (addr, amount) in enumerate(entries)
    ]
    root, proofs = root_and_proofs(leaves)
    return {
        "root": "0x" + root.hex(),
        "total_amount": sum(amount for _, amount in entries),
        "leaf_count": len(entries),
        "claims": [
            {
                "recipient": addr,
                "amount": amount,
                "leaf_index": index,
                "proof": ["0x" + sibling.hex() for sibling in proofs[index]],
            }
            for index, (addr, amount) in enumerate(entries)
        ],
    }


def verify(root: bytes, leaf: bytes, index: int, proof: Sequence[bytes]) -> bool:
    """The same check the program runs on-chain, for verifying a batch here."""
    node = leaf
    for sibling in proof:
        node = keccak(sibling + node) if index & 1 else keccak(node + sibling)
        index >>= 1
    return node == root


def action_message(action, explanation, fields, chain_id, ts) -> str:
    """One shape for every sentence a wallet asks somebody to sign.

    A wallet shows the message verbatim, so it opens with what the signature
    does and what it does not do, then lists the facts one per line. Each
    action used to invent its own pipe-separated line, which read as jargon in
    the wallet and gave five chances for the browser and the server to disagree
    about a byte -- a disagreement that surfaces as "invalid signature", miles
    from its cause. The vectors in _self_check pin every one of them.

    `fields` is a sequence of (label, value) pairs; Chain and Issued are added
    last because every action carries them.
    """
    issued = _dt.datetime.fromtimestamp(int(ts), tz=_dt.timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    lines = [f"FaucetChain: {action}", "", explanation, ""]
    lines += [f"{label}: {value}" for label, value in fields]
    lines += [f"Chain: {chain_id}", f"Issued: {issued}"]
    return "\n".join(lines)


def wallet_proof_message(user: str, solana_address: str, chain_id, ts: int) -> str:
    """The sentence the Solana wallet signs, proving it holds its own key.

    Separate from the FaucetChain signature over `link_message`: that one says
    which wallet was chosen, this one says who can spend from it.
    """
    return action_message(
        "prove you control this wallet",
        "Signing links your FaucetChain account to this Solana wallet so "
        "rewards can be paid to it. It costs nothing and authorises no "
        "transaction.",
        [("Account", user), ("Wallet", solana_address)],
        chain_id,
        ts,
    )


def claim_message(user, chain_id, ts) -> str:
    return action_message(
        "claim your rewards",
        "Signing proves this claim came from you. It costs nothing and moves "
        "no money on its own.",
        [("Account", user)],
        chain_id,
        ts,
    )


def withdraw_message(user, faucet, chain_id, ts) -> str:
    return action_message(
        "withdraw your balance",
        "Signing sends the micro-claims you have collected to the faucet "
        "below. Check that address: the transfer cannot be undone.",
        [("Account", user), ("Faucet", faucet)],
        chain_id,
        ts,
    )


def stake_message(user, amount, tier, chain_id, ts) -> str:
    return action_message(
        "stake your CLAIM",
        "Signing locks the amount below in the tier below. It stays locked "
        "until you unstake it under that tier's terms.",
        [("Account", user), ("Amount", f"{float(amount):.6f} CLAIM"), ("Tier", tier)],
        chain_id,
        ts,
    )


def unstake_message(user, position, chain_id, ts) -> str:
    return action_message(
        "close a staking position",
        "Signing closes the position below and credits its principal and "
        "yield back to your balance.",
        [("Account", user), ("Position", position)],
        chain_id,
        ts,
    )


def link_message(user, solana_address, chain_id, ts) -> str:
    return action_message(
        "link a Solana wallet",
        "Signing names the Solana wallet that should receive your rewards. "
        "The wallet signs separately to prove you hold its key.",
        [("Account", user), ("Wallet", solana_address)],
        chain_id,
        ts,
    )


def api_key_reveal_message(faucet, chain_id, ts) -> str:
    """Shown before the server hands back a faucet's API key.

    The key used to come back from a GET keyed on the faucet's wallet address,
    which is published in the faucet directory. Anyone who could read the
    directory could read the key, and the key is what authorises distributing
    in that faucet's name.
    """
    return action_message(
        "show your API key",
        "Signing shows the key your faucet uses to call FaucetChain. Whoever "
        "holds that key can distribute in your name, so it goes to the wallet "
        "that owns the faucet and to nobody else.",
        [("Faucet", faucet)],
        chain_id,
        ts,
    )


def api_key_rotate_message(faucet, chain_id, ts) -> str:
    return action_message(
        "replace your API key",
        "Signing retires the key your faucet uses now and issues a new one. "
        "The old key stops working immediately, so your faucet will fail its "
        "next call until you update it.",
        [("Faucet", faucet)],
        chain_id,
        ts,
    )


def faucetpay_link_message(faucet, faucetpay_address, chain_id, ts) -> str:
    """Names a FaucetPay account. It does not prove one.

    FaucetPay's check-address confirms an address belongs to some account; it
    says nothing about who controls that account. So this signature only
    records the claim, and the account counts as proved when a payment arrives
    from it.
    """
    return action_message(
        "link a FaucetPay account",
        "Signing names the FaucetPay account behind this faucet. It moves no "
        "money and proves nothing on its own: the account counts as yours "
        "once a payment arrives from it.",
        [("Faucet", faucet), ("FaucetPay", faucetpay_address)],
        chain_id,
        ts,
    )


def _self_check() -> None:
    # The sentence a wallet displays and the server rebuilds before checking a
    # signature. Pinned, because the browser keeps its own copy in
    # components/SolanaPayouts.tsx: one byte of drift and every link fails
    # verification, looking for all the world like a bad signature.
    import hashlib

    pinned = wallet_proof_message(
        "0x7dda72ad9ad56ce3d031ee6a62b5b94dd40c6ef3",
        "75vW4HnhtMVcLuHLh3Tm8S1BuFvLVBoLqYoRxQT3SDnE",
        "7777",
        1789618329,
    )
    digest = hashlib.sha256(pinned.encode("utf-8")).hexdigest()
    assert digest == "e48548fb093a6befddd12f6395c5b08241741b4671222a83a9c7571b83df11c0", digest

    # As tres sentencas novas: as duas da chave de API fecham a FC-01, e a
    # terceira nomeia uma conta FaucetPay sem afirmar que ela foi provada.
    FAUCET = "0x1b021998f6297936986bcc34f6fdc1cd5c82af06"
    FP_ADDR = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT"
    for builder, args, want in (
        (api_key_reveal_message, (FAUCET,),
         "69e5efc150fe3fda180dd0303c0c1dfd6445516ce9071426131e47f96e30eaf2"),
        (api_key_rotate_message, (FAUCET,),
         "bd7d160423c8c213e2422fb19c2fd0fe55aa921e9ec8b289b30cdb14a20b6fa9"),
        (faucetpay_link_message, (FAUCET, FP_ADDR),
         "6d9a0067c6b831c7eb19f84484c077d8879f9cd28ca127d991e76b3bfb39f7b2"),
    ):
        text = builder(*args, "7777", 1789618329)
        got = hashlib.sha256(text.encode("utf-8")).hexdigest()
        assert got == want, f"{builder.__name__}: {got}"

    # Fixed vector, identical to the `matches_the_backend_vector` test in
    # merkle.rs: if either side changes the tree rule, the two tests disagree.
    leaves = [
        leaf_hash(bytes([1]) * 32, 10, 0),
        leaf_hash(bytes([2]) * 32, 20, 1),
        leaf_hash(bytes([3]) * 32, 30, 2),
    ]
    root, proofs = root_and_proofs(leaves)
    assert (
        root.hex() == "e5505bf95982e54e7ec2a2066f8acc19070e81c04a52241dc8bda831734892c8"
    ), root.hex()
    for index, leaf in enumerate(leaves):
        assert verify(root, leaf, index, proofs[index]), index
        assert not verify(root, leaves[(index + 1) % 3], index, proofs[index])

    # A single leaf: the root is the leaf itself and the proof is empty.
    single = leaf_hash(bytes([7]) * 32, 5, 0)
    assert root_and_proofs([single]) == (single, [[]])

    # The whole batch has to pass the same check the program runs.
    batch = build_batch(
        {
            "11111111111111111111111111111112": 200_000_000,
            "SysvarC1ock11111111111111111111111111111111": 100_000_000,
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": 1,
        }
    )
    assert batch["total_amount"] == 300_000_001
    assert batch["leaf_count"] == 3
    root = bytes.fromhex(batch["root"][2:])
    for claim in batch["claims"]:
        leaf = leaf_hash(
            decode_pubkey(claim["recipient"]), claim["amount"], claim["leaf_index"]
        )
        proof = [bytes.fromhex(s[2:]) for s in claim["proof"]]
        assert verify(root, leaf, claim["leaf_index"], proof), claim["recipient"]
    # An inflated amount at withdrawal time does not add up to the published root.
    first = batch["claims"][0]
    forged = leaf_hash(decode_pubkey(first["recipient"]), first["amount"] + 1, 0)
    assert not verify(root, forged, 0, [bytes.fromhex(s[2:]) for s in first["proof"]])

    print("settlement.py OK")


if __name__ == "__main__":
    _self_check()
