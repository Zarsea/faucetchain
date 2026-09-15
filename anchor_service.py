"""
FaucetChain — Anchor Service / Notário (Fase C: Verificabilidade Externa)

Transforma a cadeia nativa em uma cadeia AUDITÁVEL publicamente:
  1. Fecha epochs de blocos (ANCHOR_EPOCH_SIZE blocos por epoch)
  2. Computa o Merkle root do epoch (leaf = keccak(bytes32(blockHash)),
     parent = keccak(left||right) — mesma regra do api_server e do
     verificador client-side em utils/merkle.ts)
  3. ASSINA o root com a chave do notário (PRIVATE_KEY do .env, EIP-191) —
     qualquer pessoa verifica a assinatura sem confiar no servidor
  4. Se configurado, ANCORA on-chain via HubRegistryRoots.publishEpochRoot():
       ANCHOR_RPC_URL          — RPC da chain externa (ex.: Sepolia)
       HUB_REGISTRY_ADDRESS    — endereço do HubRegistryRoots deployado
     (sem essas vars, opera em modo "notário local": computa + assina)

Uso:
  python anchor_service.py            # one-shot: ancora epochs fechados pendentes
  python anchor_service.py --loop     # roda continuamente (checa a cada 60s)
  python anchor_service.py --status   # mostra estado dos roots notarizados
"""

import os
import sys
import time
import json
import sqlite3
import logging

from dotenv import load_dotenv
from eth_account import Account
from eth_account.messages import encode_defunct

try:
    from eth_hash.auto import keccak as _keccak

    def keccak256(data: bytes) -> bytes:
        return _keccak(data)
except ImportError:
    from Crypto.Hash import keccak as _k

    def keccak256(data: bytes) -> bytes:
        h = _k.new(digest_bits=256)
        h.update(data)
        return h.digest()

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('anchor')

DB_PATH = "blockchain.db"
CHAIN_ID = "7777"
ANCHOR_EPOCH_SIZE = int(os.getenv("ANCHOR_EPOCH_SIZE", "16"))  # blocos por epoch de ancoragem
HUB_ID_SEED = "faucetchain-hub-1"

PRIVATE_KEY = os.getenv("PRIVATE_KEY")
ANCHOR_RPC_URL = os.getenv("ANCHOR_RPC_URL")
HUB_REGISTRY_ADDRESS = os.getenv("HUB_REGISTRY_ADDRESS")

HUB_REGISTRY_ABI = json.loads('''[
  {"inputs":[{"internalType":"bytes32","name":"hubId","type":"bytes32"},
             {"internalType":"string","name":"apiBaseUrl","type":"string"},
             {"internalType":"bytes","name":"pubKey","type":"bytes"},
             {"internalType":"string","name":"metadataURI","type":"string"}],
   "name":"registerHub","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"hubId","type":"bytes32"},
             {"internalType":"uint64","name":"epochId","type":"uint64"},
             {"internalType":"uint64","name":"startHeight","type":"uint64"},
             {"internalType":"uint64","name":"endHeight","type":"uint64"},
             {"internalType":"uint64","name":"leafCount","type":"uint64"},
             {"internalType":"bytes32","name":"root","type":"bytes32"}],
   "name":"publishEpochRoot","outputs":[],"stateMutability":"nonpayable","type":"function"}
]''')


# ── Merkle (mesma regra do api_server.compute_merkle_root_and_proof) ─────────

def _hex_to_bytes32(h: str) -> bytes:
    h = h[2:] if h.startswith("0x") else h
    return bytes.fromhex(h.zfill(64))


def merkle_root_of_block_hashes(block_hashes):
    level = [keccak256(_hex_to_bytes32(h)) for h in block_hashes]
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])
        level = [keccak256(level[i] + level[i + 1]) for i in range(0, len(level), 2)]
    return "0x" + level[0].hex()


# ── Notarização ───────────────────────────────────────────────────────────────

def root_message(epoch_id, start_h, end_h, leaf_count, root):
    """Mensagem canônica assinada pelo notário (verificável por terceiros)."""
    return f"FaucetChain-EpochRoot|{CHAIN_ID}|{epoch_id}|{start_h}|{end_h}|{leaf_count}|{root}"


def ensure_columns(c):
    for col in ("signature TEXT", "signer TEXT", "anchor_tx TEXT"):
        try:
            c.execute(f"ALTER TABLE epoch_roots ADD COLUMN {col}")
        except sqlite3.OperationalError:
            pass


def notarize_pending_epochs():
    """Computa, assina e (se configurado) ancora todos os epochs fechados."""
    if not PRIVATE_KEY:
        logger.error("❌ PRIVATE_KEY ausente no .env — o notário precisa de uma chave.")
        sys.exit(1)
    notary = Account.from_key(PRIVATE_KEY)

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS epoch_roots (
            epoch_id INTEGER NOT NULL,
            epoch_size INTEGER NOT NULL,
            start_height INTEGER NOT NULL,
            end_height INTEGER NOT NULL,
            root TEXT NOT NULL,
            leaf_count INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY(epoch_id, epoch_size)
        )
    ''')
    ensure_columns(c)

    c.execute("SELECT COALESCE(MAX(height), -1) FROM blocks")
    tip = c.fetchone()[0]
    if tip < 0:
        logger.info("Cadeia vazia — nada a ancorar.")
        conn.close()
        return []

    # Epochs FECHADOS: todos os blocos [e*S, (e+1)*S - 1] existem
    last_closed_epoch = (tip + 1) // ANCHOR_EPOCH_SIZE - 1
    anchored = []
    for epoch_id in range(0, last_closed_epoch + 1):
        c.execute(
            "SELECT signature FROM epoch_roots WHERE epoch_id = ? AND epoch_size = ?",
            (epoch_id, ANCHOR_EPOCH_SIZE))
        row = c.fetchone()
        if row and row[0]:
            continue  # já notarizado

        start_h = epoch_id * ANCHOR_EPOCH_SIZE
        end_h = start_h + ANCHOR_EPOCH_SIZE - 1
        c.execute(
            "SELECT hash FROM blocks WHERE height BETWEEN ? AND ? ORDER BY height",
            (start_h, end_h))
        hashes = [r[0] for r in c.fetchall()]
        if len(hashes) != ANCHOR_EPOCH_SIZE:
            logger.warning(f"⚠️ Epoch {epoch_id} incompleto ({len(hashes)}/{ANCHOR_EPOCH_SIZE} blocos) — pulado.")
            continue

        root = merkle_root_of_block_hashes(hashes)
        msg = root_message(epoch_id, start_h, end_h, len(hashes), root)
        signature = notary.sign_message(encode_defunct(text=msg)).signature.hex()
        if not signature.startswith("0x"):
            signature = "0x" + signature

        anchor_tx = publish_onchain(epoch_id, start_h, end_h, len(hashes), root)

        c.execute('''
            INSERT INTO epoch_roots (epoch_id, epoch_size, start_height, end_height, root, leaf_count, updated_at, signature, signer, anchor_tx)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(epoch_id, epoch_size) DO UPDATE SET
                root = excluded.root, signature = excluded.signature,
                signer = excluded.signer, anchor_tx = excluded.anchor_tx,
                updated_at = excluded.updated_at
        ''', (epoch_id, ANCHOR_EPOCH_SIZE, start_h, end_h, root, len(hashes),
              int(time.time()), signature, notary.address.lower(), anchor_tx))
        conn.commit()

        status = f"on-chain tx {anchor_tx[:18]}..." if anchor_tx else "notário local (sem ancoragem on-chain configurada)"
        logger.info(f"✅ Epoch {epoch_id} [blocos {start_h}-{end_h}] root {root[:18]}... assinado — {status}")
        anchored.append({"epoch_id": epoch_id, "root": root, "anchor_tx": anchor_tx})

    conn.close()
    return anchored


def publish_onchain(epoch_id, start_h, end_h, leaf_count, root):
    """Publica o root no HubRegistryRoots (se ANCHOR_RPC_URL + HUB_REGISTRY_ADDRESS)."""
    if not (ANCHOR_RPC_URL and HUB_REGISTRY_ADDRESS):
        return None
    try:
        from web3 import Web3
        w3 = Web3(Web3.HTTPProvider(ANCHOR_RPC_URL))
        acct = Account.from_key(PRIVATE_KEY)
        contract = w3.eth.contract(address=Web3.to_checksum_address(HUB_REGISTRY_ADDRESS), abi=HUB_REGISTRY_ABI)
        hub_id = keccak256(HUB_ID_SEED.encode())
        tx = contract.functions.publishEpochRoot(
            hub_id, epoch_id, start_h, end_h, leaf_count, _hex_to_bytes32(root)
        ).build_transaction({
            "from": acct.address,
            "nonce": w3.eth.get_transaction_count(acct.address),
            "gas": 200_000,
            "gasPrice": w3.eth.gas_price,
        })
        signed = acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return "0x" + tx_hash.hex().removeprefix("0x")
    except Exception as e:
        logger.warning(f"⚠️ Falha na ancoragem on-chain do epoch {epoch_id}: {e} — root permanece assinado localmente.")
        return None


def show_status():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    ensure_columns(c)
    c.execute("SELECT COALESCE(MAX(height), -1) FROM blocks")
    tip = c.fetchone()[0]
    c.execute('''
        SELECT epoch_id, start_height, end_height, root, signer, anchor_tx
        FROM epoch_roots WHERE epoch_size = ? ORDER BY epoch_id
    ''', (ANCHOR_EPOCH_SIZE,))
    rows = c.fetchall()
    conn.close()
    print(f"Tip da cadeia: bloco {tip} | epoch size: {ANCHOR_EPOCH_SIZE}")
    print(f"Roots notarizados: {len(rows)}")
    for r in rows:
        anchor = r[5][:18] + "..." if r[5] else "local"
        print(f"  epoch {r[0]} [{r[1]}-{r[2]}] root={r[3][:18]}... signer={str(r[4])[:12]}... anchor={anchor}")


if __name__ == "__main__":
    if "--status" in sys.argv:
        show_status()
    elif "--loop" in sys.argv:
        logger.info(f"🔁 Notário em loop (epoch size {ANCHOR_EPOCH_SIZE}, checagem a cada 60s)")
        while True:
            try:
                notarize_pending_epochs()
            except Exception as e:
                logger.error(f"Erro no ciclo de ancoragem: {e}")
            time.sleep(60)
    else:
        res = notarize_pending_epochs()
        logger.info(f"Concluído: {len(res)} epoch(s) notarizados nesta execução.")
