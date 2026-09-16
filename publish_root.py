"""
FaucetChain — leva a raiz de um lote fechado para o programa na Solana.

O sequenciador fecha o lote (POST /api/solana/batch); este script publica a
raiz. Depois disso o pagamento não depende mais do servidor: quem tem a prova
saca direto do cofre da campanha, e o programa recusa a raiz se o cofre não
cobrir tudo que já foi prometido.

    python publish_root.py --campaign 7 --batch 3
    python publish_root.py --campaign 7 --batch 3 --dry-run
    python publish_root.py --self-check

Configuração por ambiente:
    SOLANA_RPC_URL               https://api.devnet.solana.com por padrão
    SETTLEMENT_OPERATOR_KEYPAIR  id.json que assina publish_root
    SETTLEMENT_CAMPAIGN_SPONSOR  carteira que abriu a campanha (base58)
    SETTLEMENT_OPERATOR_TOKEN    token do endpoint interno da appchain
    FAUCETCHAIN_API              http://localhost:8000 por padrão
"""

import argparse
import base64
import json
import os
import sys
import time

import requests
from solders.instruction import AccountMeta, Instruction
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import Transaction

IDL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "faucetchain",
    "target",
    "idl",
    "faucetchain.json",
)
SYSTEM_PROGRAM = Pubkey.from_string("11111111111111111111111111111111")


def load_idl() -> dict:
    """O IDL é a fonte do program id e dos discriminadores das instruções."""
    try:
        with open(IDL_PATH, encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        raise SystemExit(f"IDL não encontrado em {IDL_PATH}. Rode `anchor build` antes.")


def discriminator(idl: dict, name: str) -> bytes:
    for instruction in idl["instructions"]:
        if instruction["name"] == name:
            return bytes(instruction["discriminator"])
    raise SystemExit(f"Instrução {name} não está no IDL")


def encode_publish_root(disc: bytes, index: int, root: bytes, total_amount: int, leaf_count: int) -> bytes:
    """Borsh dos argumentos: tudo tamanho fixo, little-endian, sem prefixo."""
    if len(root) != 32:
        raise ValueError("root must be 32 bytes")
    return (
        disc
        + index.to_bytes(4, "little")
        + root
        + total_amount.to_bytes(8, "little")
        + leaf_count.to_bytes(4, "little")
    )


def campaign_pda(program_id: Pubkey, sponsor: Pubkey, campaign_id: int) -> Pubkey:
    return Pubkey.find_program_address(
        [b"campaign", bytes(sponsor), campaign_id.to_bytes(8, "little")], program_id
    )[0]


def vault_pda(program_id: Pubkey, campaign: Pubkey) -> Pubkey:
    return Pubkey.find_program_address([b"vault", bytes(campaign)], program_id)[0]


def root_pda(program_id: Pubkey, campaign: Pubkey, index: int) -> Pubkey:
    return Pubkey.find_program_address(
        [b"root", bytes(campaign), index.to_bytes(4, "little")], program_id
    )[0]


def build_instruction(idl: dict, operator: Pubkey, sponsor: Pubkey, campaign_id: int, batch: dict) -> Instruction:
    program_id = Pubkey.from_string(idl["address"])
    campaign = campaign_pda(program_id, sponsor, campaign_id)
    reward_root = root_pda(program_id, campaign, batch["root_index"])
    # Ordem das contas conforme o IDL: operator, campaign, reward_root, vault,
    # system_program.
    accounts = [
        AccountMeta(operator, is_signer=True, is_writable=True),
        AccountMeta(campaign, is_signer=False, is_writable=True),
        AccountMeta(reward_root, is_signer=False, is_writable=True),
        AccountMeta(vault_pda(program_id, campaign), is_signer=False, is_writable=False),
        AccountMeta(SYSTEM_PROGRAM, is_signer=False, is_writable=False),
    ]
    data = encode_publish_root(
        discriminator(idl, "publish_root"),
        batch["root_index"],
        bytes.fromhex(batch["root"][2:] if batch["root"].startswith("0x") else batch["root"]),
        batch["total_amount"],
        batch["leaf_count"],
    )
    return Instruction(program_id, data, accounts)


def rpc(url: str, method: str, params: list):
    response = requests.post(
        url, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=30
    )
    response.raise_for_status()
    body = response.json()
    if "error" in body:
        raise SystemExit(f"RPC {method} falhou: {body['error']}")
    return body["result"]


def send_and_confirm(url: str, transaction: Transaction) -> str:
    raw = base64.b64encode(bytes(transaction)).decode()
    signature = rpc(url, "sendTransaction", [raw, {"encoding": "base64"}])
    deadline = time.time() + 60
    while time.time() < deadline:
        statuses = rpc(url, "getSignatureStatuses", [[signature], {"searchTransactionHistory": True}])
        status = statuses["value"][0]
        if status:
            if status.get("err"):
                raise SystemExit(f"Transação {signature} falhou on-chain: {status['err']}")
            if status.get("confirmationStatus") in ("confirmed", "finalized"):
                return signature
        time.sleep(2)
    raise SystemExit(f"Transação {signature} não confirmou em 60s")


def fetch_batch(api: str, campaign_id: int, batch_id: int) -> dict:
    response = requests.get(f"{api}/api/solana/batches", params={"campaign_id": campaign_id}, timeout=30)
    response.raise_for_status()
    for batch in response.json()["batches"]:
        if batch["batch_id"] == batch_id:
            return batch
    raise SystemExit(f"Lote {batch_id} não existe na campanha {campaign_id}")


def mark_published(api: str, token: str, batch_id: int, signature: str) -> None:
    response = requests.post(
        f"{api}/api/solana/batch/{batch_id}/published",
        json={"signature": signature},
        headers={"x-operator-token": token},
        timeout=30,
    )
    response.raise_for_status()


def _self_check() -> None:
    idl = load_idl()
    disc = discriminator(idl, "publish_root")
    root = bytes(range(32))
    data = encode_publish_root(disc, 3, root, 350_000_000, 2)
    assert len(data) == 8 + 4 + 32 + 8 + 4, len(data)
    assert data[:8] == disc
    assert data[8:12] == (3).to_bytes(4, "little")
    assert data[12:44] == root
    assert data[44:52] == (350_000_000).to_bytes(8, "little")
    assert data[52:] == (2).to_bytes(4, "little")

    # PDAs: mesmas sementes do programa, então a mesma entrada dá o mesmo
    # endereço toda vez e a raiz do índice 1 não cai no lugar da do índice 0.
    program_id = Pubkey.from_string(idl["address"])
    sponsor = Pubkey.from_string("11111111111111111111111111111112")
    campaign = campaign_pda(program_id, sponsor, 7)
    assert campaign == campaign_pda(program_id, sponsor, 7)
    assert campaign != campaign_pda(program_id, sponsor, 8)
    assert root_pda(program_id, campaign, 0) != root_pda(program_id, campaign, 1)

    instruction = build_instruction(
        idl,
        Pubkey.from_string("11111111111111111111111111111112"),
        sponsor,
        7,
        {"root_index": 0, "root": "0x" + root.hex(), "total_amount": 1, "leaf_count": 1},
    )
    assert [meta.is_signer for meta in instruction.accounts] == [True, False, False, False, False]
    assert [meta.is_writable for meta in instruction.accounts] == [True, True, True, False, False]
    print("publish_root.py OK")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--campaign", type=int, help="campaign_id da campanha na Solana")
    parser.add_argument("--batch", type=int, help="batch_id devolvido por /api/solana/batch")
    parser.add_argument("--dry-run", action="store_true", help="monta a instrução e mostra, sem enviar")
    parser.add_argument("--self-check", action="store_true", help="valida a codificação e as PDAs")
    args = parser.parse_args()

    if args.self_check:
        _self_check()
        return
    if args.campaign is None or args.batch is None:
        parser.error("--campaign e --batch são obrigatórios")

    api = os.getenv("FAUCETCHAIN_API", "http://localhost:8000").rstrip("/")
    rpc_url = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")
    sponsor = os.getenv("SETTLEMENT_CAMPAIGN_SPONSOR")
    if not sponsor:
        raise SystemExit("SETTLEMENT_CAMPAIGN_SPONSOR não configurado")
    keypair_path = os.getenv(
        "SETTLEMENT_OPERATOR_KEYPAIR", os.path.expanduser("~/.config/solana/id.json")
    )
    with open(keypair_path, encoding="utf-8") as handle:
        operator = Keypair.from_bytes(bytes(json.load(handle)))

    idl = load_idl()
    batch = fetch_batch(api, args.campaign, args.batch)
    if batch["published_signature"]:
        raise SystemExit(f"Lote {args.batch} já foi publicado em {batch['published_signature']}")
    instruction = build_instruction(idl, operator.pubkey(), Pubkey.from_string(sponsor), args.campaign, batch)

    print(f"programa      {idl['address']}")
    print(f"operador      {operator.pubkey()}")
    for meta, name in zip(instruction.accounts, ("operator", "campaign", "reward_root", "vault", "system")):
        print(f"  {name:12} {meta.pubkey}")
    print(f"raiz {batch['root']} índice {batch['root_index']} "
          f"total {batch['total_amount']} folhas {batch['leaf_count']}")
    if args.dry_run:
        print(f"data (hex)    {instruction.data.hex()}")
        return

    blockhash = rpc(rpc_url, "getLatestBlockhash", [{"commitment": "confirmed"}])["value"]["blockhash"]
    from solders.hash import Hash

    transaction = Transaction.new_signed_with_payer(
        [instruction], operator.pubkey(), [operator], Hash.from_string(blockhash)
    )
    signature = send_and_confirm(rpc_url, transaction)
    print(f"publicado em {signature}")

    token = os.getenv("SETTLEMENT_OPERATOR_TOKEN")
    if token:
        mark_published(api, token, args.batch, signature)
        print("registrado no lote")
    else:
        print("SETTLEMENT_OPERATOR_TOKEN não configurado: assinatura não registrada na appchain",
              file=sys.stderr)


if __name__ == "__main__":
    main()
