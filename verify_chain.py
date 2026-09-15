"""
FaucetChain — Auditor Independente da Cadeia (Fase C)

Verifica a cadeia nativa SEM confiar no servidor, a partir do dump público
de /api/chain/export. Qualquer pessoa pode rodar:

  python verify_chain.py                          # audita http://localhost:8000
  python verify_chain.py https://host:porta       # audita um hub remoto
  python verify_chain.py export.json              # audita um dump salvo

Verificações:
  1. Encadeamento: alturas contíguas desde o genesis (0) e parent_hash correto
  2. Hash de cada bloco: sha256(height|parent|validator|ts|merkle_root)
     (blocos legados usam o tx hash do claim como seed; genesis usa seed fixo)
  3. Merkle root dos blocos multi-claim confere com os claims do bloco
  4. Hard cap: total emitido <= 99.000.000 $CLAIM
  5. Quota horária: emissão de claims <= 2.000 $CLAIM por hora
  6. Roots de epoch notarizados: Merkle recomputado + assinatura EIP-191 do notário

Dependências do auditor: requests, eth-account, eth-hash
"""

import sys
import json
import hashlib
from collections import defaultdict

# Consoles Windows (cp1252) não suportam os emojis do relatório
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_hash.auto import keccak

GENESIS_SEED = "faucetchain-genesis-7777"
failures = []
checks = 0


def check(name, cond, detail=""):
    global checks
    checks += 1
    status = "PASS" if cond else "FAIL"
    print(f"{status} | {name}" + (f" | {detail}" if detail else ""))
    if not cond:
        failures.append(name)


def hex_to_bytes32(h):
    h = h[2:] if h.startswith("0x") else h
    return bytes.fromhex(h.zfill(64))


def merkle_utf8(items):
    """Merkle dos claims de um bloco: leaf = keccak(utf8(tx_hash)),
    folhas ordenadas lexicograficamente (regra canônica da FaucetChain)."""
    if not items:
        return "0x" + "0" * 64
    level = [keccak(i.encode()) for i in sorted(items)]
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])
        level = [keccak(level[i] + level[i + 1]) for i in range(0, len(level), 2)]
    return "0x" + level[0].hex()


def merkle_bytes32(hashes):
    """Merkle dos blocos de um epoch: leaf = keccak(bytes32(blockHash))."""
    level = [keccak(hex_to_bytes32(h)) for h in hashes]
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])
        level = [keccak(level[i] + level[i + 1]) for i in range(0, len(level), 2)]
    return "0x" + level[0].hex()


def load_export(source):
    if source.startswith("http"):
        import requests
        return requests.get(f"{source.rstrip('/')}/api/chain/export", timeout=60).json()
    with open(source, encoding="utf-8") as f:
        return json.load(f)


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    data = load_export(source)
    meta = data["meta"]
    blocks = data["blocks"]
    txs = data["transactions"]
    claims = data["user_claims"]
    mining = data["mining_rewards"]
    roots = data.get("epoch_roots", [])

    print(f"Auditando cadeia {meta['chainId']} — tip: bloco {meta['tipHeight']}, "
          f"{len(blocks)} blocos, {len(txs)} txs\n")

    # ── 1. Encadeamento ──────────────────────────────────────────────────
    heights_ok = all(b["height"] == i for i, b in enumerate(blocks))
    check("1a. alturas contíguas desde o genesis (0)", heights_ok)
    chain_ok = all(blocks[i]["parent_hash"] == blocks[i - 1]["hash"] for i in range(1, len(blocks)))
    check("1b. parent_hash encadeado em toda a cadeia", chain_ok)

    # claims por bloco (na ordem de persistência do export)
    claims_by_block = defaultdict(list)
    for t in txs:
        if t.get("tx_type") == "CLAIM":
            claims_by_block[t["block_height"]].append(t["hash"])

    # ── 2+3. Hash e Merkle root de cada bloco ────────────────────────────
    bad_hash, bad_merkle = [], []
    for b in blocks:
        h = b["height"]
        if h == 0:
            seed = GENESIS_SEED
        elif b.get("merkle_root"):
            recomputed = merkle_utf8(claims_by_block.get(h, []))
            if recomputed != b["merkle_root"]:
                bad_merkle.append(h)
            seed = b["merkle_root"]
        else:
            # bloco legado (pré-Fase B): seed = tx hash do claim único
            cl = claims_by_block.get(h, [])
            seed = cl[0] if cl else None
        if seed is not None:
            expected = "0x" + hashlib.sha256(
                f"{h}{b['parent_hash']}{b['validator']}{b['timestamp']}{seed}".encode()
            ).hexdigest()
            if expected != b["hash"]:
                bad_hash.append(h)
    check("2. hash de todos os blocos recomputado confere", not bad_hash,
          f"{len(blocks)} blocos" + (f" — inválidos: {bad_hash[:5]}" if bad_hash else ""))
    check("3. merkle_root dos blocos multi-claim confere", not bad_merkle,
          (f"inválidos: {bad_merkle[:5]}" if bad_merkle else "todos conferem"))

    # ── 4. Hard cap ──────────────────────────────────────────────────────
    total_minted = sum(cl["amount"] for cl in claims) + sum(m["reward_amount"] for m in mining)
    check("4. hard cap: total emitido <= 99.000.000", total_minted <= meta["maxSupply"] + 1e-6,
          f"emitido: {total_minted:,.4f} $CLAIM")

    # ── 5. Quota horária (mints de claims) ───────────────────────────────
    per_hour = defaultdict(float)
    for cl in claims:
        per_hour[cl["timestamp"] // meta["epochDuration"]] += cl["amount"] / 0.80  # mint total do claim
    violations = {h: v for h, v in per_hour.items() if v > meta["tokensPerHour"] + 1e-6}
    check("5. quota horária respeitada em todas as horas", not violations,
          f"{len(per_hour)} horas com emissão" + (f" — violações: {violations}" if violations else ""))

    # ── 6. Roots notarizados ─────────────────────────────────────────────
    verified_roots = 0
    bad_roots = []
    for r in roots:
        if not r.get("signature"):
            continue
        rng = [b["hash"] for b in blocks if r["start_height"] <= b["height"] <= r["end_height"]]
        recomputed = merkle_bytes32(rng) if len(rng) == r["leaf_count"] else None
        msg = (f"FaucetChain-EpochRoot|{meta['chainId']}|{r['epoch_id']}|{r['start_height']}|"
               f"{r['end_height']}|{r['leaf_count']}|{r['root']}")
        try:
            signer = Account.recover_message(encode_defunct(text=msg), signature=r["signature"]).lower()
        except Exception:
            signer = None
        if recomputed == r["root"] and signer == r.get("signer"):
            verified_roots += 1
        else:
            bad_roots.append(r["epoch_id"])
    check("6. roots de epoch: merkle + assinatura do notário", not bad_roots,
          f"{verified_roots} root(s) verificados" + (f" — inválidos: {bad_roots}" if bad_roots else ""))

    print()
    if failures:
        print(f"❌ AUDITORIA REPROVADA: {len(failures)}/{checks} verificações falharam: {failures}")
        sys.exit(1)
    print(f"✅ AUDITORIA APROVADA: {checks}/{checks} verificações passaram. "
          f"A cadeia é íntegra e verificável sem confiar no servidor.")


if __name__ == "__main__":
    main()
