"""
FaucetChain — client for the settlement program on Solana.

Everything that talks to the program goes through here. The IDL produced by the
build is the single source of the program id and of every instruction
discriminator, so an encoder here cannot drift from the program that was
actually compiled.

Argument encoding is Borsh. Every argument the program takes is fixed size, so
it is little-endian with no length prefix — except `proof`, a vector, which
carries a u32 count before its items.
"""

import base64
import json
import os
import time
from typing import List, Sequence

import requests
from solders.instruction import AccountMeta, Instruction
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import Transaction

_HERE = os.path.dirname(os.path.abspath(__file__))
# The committed copy first, the build output second: a fresh build overwrites
# the committed one, so they only differ when someone forgot to commit.
IDL_PATH = os.path.join(_HERE, "faucetchain", "idl", "faucetchain.json")
IDL_BUILD_PATH = os.path.join(_HERE, "faucetchain", "target", "idl", "faucetchain.json")

SYSTEM_PROGRAM = Pubkey.from_string("11111111111111111111111111111111")
TOKEN_PROGRAM = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
ASSOCIATED_TOKEN_PROGRAM = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")

CAMPAIGN_SEED = b"campaign"
VAULT_SEED = b"vault"
ROOT_SEED = b"root"
RECEIPT_SEED = b"receipt"


# --------------------------------------------------------------------------
# IDL
# --------------------------------------------------------------------------


def load_idl(path: str = None) -> dict:
    for candidate in ([path] if path else [IDL_PATH, IDL_BUILD_PATH]):
        try:
            with open(candidate, encoding="utf-8") as handle:
                return json.load(handle)
        except FileNotFoundError:
            continue
    raise SystemExit(f"IDL not found at {IDL_PATH}. Run scripts/build-program.sh first.")


def program_id(idl: dict) -> Pubkey:
    return Pubkey.from_string(idl["address"])


def discriminator(idl: dict, name: str) -> bytes:
    for instruction in idl["instructions"]:
        if instruction["name"] == name:
            return bytes(instruction["discriminator"])
    raise SystemExit(f"Instruction {name} is not in the IDL")


# --------------------------------------------------------------------------
# Program addresses
# --------------------------------------------------------------------------


def campaign_pda(pid: Pubkey, sponsor: Pubkey, campaign_id: int) -> Pubkey:
    return Pubkey.find_program_address(
        [CAMPAIGN_SEED, bytes(sponsor), campaign_id.to_bytes(8, "little")], pid
    )[0]


def vault_pda(pid: Pubkey, campaign: Pubkey) -> Pubkey:
    return Pubkey.find_program_address([VAULT_SEED, bytes(campaign)], pid)[0]


def root_pda(pid: Pubkey, campaign: Pubkey, index: int) -> Pubkey:
    return Pubkey.find_program_address(
        [ROOT_SEED, bytes(campaign), index.to_bytes(4, "little")], pid
    )[0]


def receipt_pda(pid: Pubkey, reward_root: Pubkey, leaf_index: int) -> Pubkey:
    return Pubkey.find_program_address(
        [RECEIPT_SEED, bytes(reward_root), leaf_index.to_bytes(4, "little")], pid
    )[0]


def associated_token_address(owner: Pubkey, mint: Pubkey) -> Pubkey:
    return Pubkey.find_program_address(
        [bytes(owner), bytes(TOKEN_PROGRAM), bytes(mint)], ASSOCIATED_TOKEN_PROGRAM
    )[0]


# --------------------------------------------------------------------------
# Instructions — account order follows the IDL
# --------------------------------------------------------------------------


def _ix(pid: Pubkey, metas: List[AccountMeta], data: bytes) -> Instruction:
    return Instruction(pid, data, metas)


def create_campaign(
    idl: dict, sponsor: Pubkey, mint: Pubkey, campaign_id: int, operator: Pubkey
) -> Instruction:
    pid = program_id(idl)
    campaign = campaign_pda(pid, sponsor, campaign_id)
    metas = [
        AccountMeta(sponsor, True, True),
        AccountMeta(campaign, False, True),
        AccountMeta(mint, False, False),
        AccountMeta(vault_pda(pid, campaign), False, True),
        AccountMeta(TOKEN_PROGRAM, False, False),
        AccountMeta(SYSTEM_PROGRAM, False, False),
    ]
    data = (
        discriminator(idl, "create_campaign")
        + campaign_id.to_bytes(8, "little")
        + bytes(operator)
    )
    return _ix(pid, metas, data)


def fund_campaign(
    idl: dict, sponsor: Pubkey, mint: Pubkey, sponsor_token_account: Pubkey,
    campaign_id: int, amount: int
) -> Instruction:
    pid = program_id(idl)
    campaign = campaign_pda(pid, sponsor, campaign_id)
    metas = [
        AccountMeta(sponsor, True, True),
        AccountMeta(campaign, False, True),
        AccountMeta(mint, False, False),
        AccountMeta(sponsor_token_account, False, True),
        AccountMeta(vault_pda(pid, campaign), False, True),
        AccountMeta(TOKEN_PROGRAM, False, False),
    ]
    data = discriminator(idl, "fund_campaign") + amount.to_bytes(8, "little")
    return _ix(pid, metas, data)


def publish_root(
    idl: dict, operator: Pubkey, sponsor: Pubkey, campaign_id: int,
    index: int, root: bytes, total_amount: int, leaf_count: int
) -> Instruction:
    if len(root) != 32:
        raise ValueError("root must be 32 bytes")
    pid = program_id(idl)
    campaign = campaign_pda(pid, sponsor, campaign_id)
    metas = [
        AccountMeta(operator, True, True),
        AccountMeta(campaign, False, True),
        AccountMeta(root_pda(pid, campaign, index), False, True),
        AccountMeta(vault_pda(pid, campaign), False, False),
        AccountMeta(SYSTEM_PROGRAM, False, False),
    ]
    data = (
        discriminator(idl, "publish_root")
        + index.to_bytes(4, "little")
        + root
        + total_amount.to_bytes(8, "little")
        + leaf_count.to_bytes(4, "little")
    )
    return _ix(pid, metas, data)


def claim_reward(
    idl: dict, recipient: Pubkey, payer: Pubkey, sponsor: Pubkey, mint: Pubkey,
    campaign_id: int, root_index: int, leaf_index: int, amount: int,
    proof: Sequence[bytes]
) -> Instruction:
    pid = program_id(idl)
    campaign = campaign_pda(pid, sponsor, campaign_id)
    reward_root = root_pda(pid, campaign, root_index)
    metas = [
        AccountMeta(recipient, True, False),
        AccountMeta(payer, True, True),
        AccountMeta(campaign, False, True),
        AccountMeta(reward_root, False, True),
        AccountMeta(receipt_pda(pid, reward_root, leaf_index), False, True),
        AccountMeta(mint, False, False),
        AccountMeta(vault_pda(pid, campaign), False, True),
        AccountMeta(associated_token_address(recipient, mint), False, True),
        AccountMeta(TOKEN_PROGRAM, False, False),
        AccountMeta(ASSOCIATED_TOKEN_PROGRAM, False, False),
        AccountMeta(SYSTEM_PROGRAM, False, False),
    ]
    data = (
        discriminator(idl, "claim_reward")
        + leaf_index.to_bytes(4, "little")
        + amount.to_bytes(8, "little")
        + len(proof).to_bytes(4, "little")
        + b"".join(proof)
    )
    return _ix(pid, metas, data)


def withdraw_surplus(
    idl: dict, sponsor: Pubkey, mint: Pubkey, sponsor_token_account: Pubkey,
    campaign_id: int, amount: int
) -> Instruction:
    pid = program_id(idl)
    campaign = campaign_pda(pid, sponsor, campaign_id)
    metas = [
        AccountMeta(sponsor, True, True),
        AccountMeta(campaign, False, True),
        AccountMeta(mint, False, False),
        AccountMeta(sponsor_token_account, False, True),
        AccountMeta(vault_pda(pid, campaign), False, True),
        AccountMeta(TOKEN_PROGRAM, False, False),
    ]
    data = discriminator(idl, "withdraw_surplus") + amount.to_bytes(8, "little")
    return _ix(pid, metas, data)


def close_campaign(idl: dict, sponsor: Pubkey, campaign_id: int) -> Instruction:
    pid = program_id(idl)
    metas = [
        AccountMeta(sponsor, True, False),
        AccountMeta(campaign_pda(pid, sponsor, campaign_id), False, True),
    ]
    return _ix(pid, metas, discriminator(idl, "close_campaign"))


# --------------------------------------------------------------------------
# RPC
# --------------------------------------------------------------------------


def default_rpc_url() -> str:
    return os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")


def load_keypair(path: str) -> Keypair:
    with open(os.path.expanduser(path), encoding="utf-8") as handle:
        return Keypair.from_bytes(bytes(json.load(handle)))


def rpc(url: str, method: str, params: list):
    response = requests.post(
        url, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=30
    )
    response.raise_for_status()
    body = response.json()
    if "error" in body:
        raise SystemExit(f"RPC {method} failed: {body['error']}")
    return body["result"]


def send_and_confirm(url: str, instructions: List[Instruction], payer: Keypair,
                     signers: Sequence[Keypair], timeout: int = 60) -> str:
    from solders.hash import Hash

    blockhash = rpc(url, "getLatestBlockhash", [{"commitment": "confirmed"}])["value"]["blockhash"]
    transaction = Transaction.new_signed_with_payer(
        instructions, payer.pubkey(), list(signers), Hash.from_string(blockhash)
    )
    raw = base64.b64encode(bytes(transaction)).decode()
    # Preflight has to run against the same commitment everything else uses.
    # On the default (finalized) bank a blockhash or an account seconds old is
    # not there yet, and the send comes back as BlockhashNotFound or
    # AccountNotFound even though both exist.
    signature = rpc(
        url,
        "sendTransaction",
        [raw, {"encoding": "base64", "preflightCommitment": "confirmed"}],
    )

    deadline = time.time() + timeout
    while time.time() < deadline:
        statuses = rpc(url, "getSignatureStatuses", [[signature], {"searchTransactionHistory": True}])
        status = statuses["value"][0]
        if status:
            if status.get("err"):
                raise SystemExit(f"Transaction {signature} failed on-chain: {status['err']}")
            if status.get("confirmationStatus") in ("confirmed", "finalized"):
                return signature
        time.sleep(1)
    raise SystemExit(f"Transaction {signature} did not confirm in {timeout}s")


def token_balance(url: str, token_account: Pubkey) -> int:
    """Base units held by a token account, 0 when the account does not exist."""
    result = rpc(url, "getTokenAccountBalance", [str(token_account), {"commitment": "confirmed"}])
    return int(result["value"]["amount"])


def _self_check() -> None:
    idl = load_idl()
    pid = program_id(idl)
    sponsor = Pubkey.from_string("11111111111111111111111111111112")
    mint = Pubkey.from_string("So11111111111111111111111111111111111111112")

    # Same seeds as the program: same input always lands on the same address,
    # and two different indexes never collide.
    campaign = campaign_pda(pid, sponsor, 7)
    assert campaign == campaign_pda(pid, sponsor, 7)
    assert campaign != campaign_pda(pid, sponsor, 8)
    assert root_pda(pid, campaign, 0) != root_pda(pid, campaign, 1)
    root0 = root_pda(pid, campaign, 0)
    assert receipt_pda(pid, root0, 0) != receipt_pda(pid, root0, 1)

    root = bytes(range(32))
    data = publish_root(idl, sponsor, sponsor, 7, 3, root, 350_000_000, 2).data
    assert len(data) == 8 + 4 + 32 + 8 + 4, len(data)
    assert data[:8] == discriminator(idl, "publish_root")
    assert data[8:12] == (3).to_bytes(4, "little")
    assert data[12:44] == root
    assert data[44:52] == (350_000_000).to_bytes(8, "little")
    assert data[52:] == (2).to_bytes(4, "little")

    # A vector argument carries its length; two siblings mean 4 + 64 bytes.
    claim = claim_reward(idl, sponsor, sponsor, sponsor, mint, 7, 0, 5, 42, [root, root])
    assert len(claim.data) == 8 + 4 + 8 + 4 + 64, len(claim.data)
    assert claim.data[20:24] == (2).to_bytes(4, "little")
    assert [m.is_signer for m in claim.accounts][:2] == [True, True]
    assert [m.is_writable for m in claim.accounts][:2] == [False, True]

    assert len(close_campaign(idl, sponsor, 7).data) == 8
    assert len(withdraw_surplus(idl, sponsor, mint, sponsor, 7, 1).data) == 16
    print("solana_settlement.py OK")


if __name__ == "__main__":
    _self_check()
