"""
Desvinculação da Sepolia — Migração para Cadeia Nativa Soberana (FaucetChain)

Estratégia (Opção A — extrair e preservar histórico nativo):
  1. Constrói um banco NOVO (blockchain_native.db) a partir do blockchain.db:
     - Genesis próprio (altura 0, Chain ID 7777)
     - Blocos nativos (os que contêm txs CLAIM/MINING_FEE do /api/mining/explore)
       renumerados 1..N e RE-ENCADEADOS (hashes recalculados, parent_hash correto)
     - Transações nativas (CLAIM, MINING_FEE e transfers com block_height=0)
     - TODAS as demais tabelas de negócio copiadas integralmente
       (user_claims, mining_rewards, staking_positions, faucet_registry, etc.)
     - EXPURGO total: blocos e transações da Sepolia NÃO são copiados
  2. Sem --apply: apenas constrói e verifica (dry-run seguro).
  3. Com --apply: troca os arquivos —
       blockchain.db        -> blockchain_sepolia_backup.db  (backup integral)
       blockchain_native.db -> blockchain.db

Uso:
  python desvincular_sepolia.py           # dry-run: constrói e verifica
  python desvincular_sepolia.py --apply   # aplica o swap dos arquivos
"""

import sqlite3
import hashlib
import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('desvincular_sepolia')

SRC_DB = 'blockchain.db'
DST_DB = 'blockchain_native.db'
BACKUP_DB = 'blockchain_sepolia_backup.db'

ZERO_HASH = '0x' + '0' * 64
ZERO_ADDR = '0x' + '0' * 40
GENESIS_VALIDATOR = ZERO_ADDR

# Tabelas de cadeia — NÃO copiadas integralmente (reconstruídas/expurgadas)
CHAIN_TABLES = {'blocks', 'transactions', 'sync_state', 'epoch_roots'}


def compute_block_hash(height: int, parent_hash: str, validator: str,
                       timestamp: int, seed_tx_hash: str) -> str:
    """Mesma fórmula do /api/mining/explore em api_server.py."""
    block_data = f"{height}{parent_hash}{validator}{timestamp}{seed_tx_hash}".encode()
    return '0x' + hashlib.sha256(block_data).hexdigest()


def get_columns(conn, table):
    return [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]


def build_native_db():
    if not os.path.exists(SRC_DB):
        logger.error(f"❌ {SRC_DB} não encontrado.")
        sys.exit(1)
    if os.path.exists(DST_DB):
        logger.info(f"Removendo {DST_DB} de execução anterior...")
        os.remove(DST_DB)

    src = sqlite3.connect(f'file:{SRC_DB}?mode=ro', uri=True)
    src.row_factory = sqlite3.Row
    dst = sqlite3.connect(DST_DB)

    # ── 1. Copiar schema completo (tabelas + índices) ─────────────────────
    logger.info("Copiando schema...")
    schema_rows = src.execute(
        "SELECT type, name, sql FROM sqlite_master "
        "WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' "
        "ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END"
    ).fetchall()
    for row in schema_rows:
        dst.execute(row['sql'])
    dst.commit()

    # ── 2. Identificar blocos nativos ─────────────────────────────────────
    # Blocos nativos = blocos que contêm transações CLAIM/MINING_FEE
    # (criados pelo /api/mining/explore, enxertados na numeração da Sepolia)
    native_heights = [r[0] for r in src.execute(
        "SELECT DISTINCT block_height FROM transactions "
        "WHERE tx_type IN ('CLAIM','MINING_FEE') AND block_height > 0 "
        "ORDER BY block_height"
    ).fetchall()]
    logger.info(f"Blocos nativos identificados: {len(native_heights)}")

    # ── 3. Genesis ─────────────────────────────────────────────────────────
    if native_heights:
        first_block = src.execute(
            "SELECT timestamp FROM blocks WHERE height = ?", (native_heights[0],)
        ).fetchone()
        genesis_ts = (first_block['timestamp'] - 1) if first_block else 1750000000
    else:
        genesis_ts = 1750000000

    genesis_hash = compute_block_hash(0, ZERO_HASH, GENESIS_VALIDATOR,
                                      genesis_ts, 'faucetchain-genesis-7777')
    dst.execute(
        "INSERT INTO blocks (height, hash, parent_hash, validator, tx_count, "
        "timestamp, gas_used, gas_limit, reward) VALUES (?,?,?,?,?,?,?,?,?)",
        (0, genesis_hash, ZERO_HASH, GENESIS_VALIDATOR, 0, genesis_ts, 0, 30000000, 0.0)
    )
    logger.info(f"✅ Genesis criado: altura 0, hash {genesis_hash[:18]}...")

    # ── 4. Re-encadear blocos nativos (1..N) ──────────────────────────────
    height_map = {}   # altura antiga (Sepolia-enxertada) -> altura nativa
    parent_hash = genesis_hash
    new_height = 0
    for old_h in native_heights:
        blk = src.execute("SELECT * FROM blocks WHERE height = ?", (old_h,)).fetchone()
        if blk is None:
            logger.warning(f"⚠️ Bloco {old_h} tem txs nativas mas não existe em 'blocks' "
                           f"(provável colisão com INSERT OR IGNORE do indexer). Recriando.")
            claim_tx = src.execute(
                "SELECT * FROM transactions WHERE block_height = ? AND tx_type='CLAIM'",
                (old_h,)).fetchone()
            blk_validator = ZERO_ADDR
            blk_ts = claim_tx['timestamp'] if claim_tx else genesis_ts + 1
            blk_reward = 0.0
            blk_gas_used, blk_gas_limit, blk_txc = 21000, 30000000, 2
        else:
            blk_validator = blk['validator']
            blk_ts = blk['timestamp']
            blk_reward = blk['reward']
            blk_gas_used, blk_gas_limit, blk_txc = blk['gas_used'], blk['gas_limit'], blk['tx_count']

        # Seed do hash: a tx CLAIM do bloco (mesma semântica do explore)
        seed_row = src.execute(
            "SELECT hash FROM transactions WHERE block_height = ? AND tx_type='CLAIM' LIMIT 1",
            (old_h,)).fetchone()
        seed_tx = seed_row['hash'] if seed_row else f'native-block-{old_h}'

        new_height += 1
        new_hash = compute_block_hash(new_height, parent_hash, blk_validator, blk_ts, seed_tx)
        dst.execute(
            "INSERT INTO blocks (height, hash, parent_hash, validator, tx_count, "
            "timestamp, gas_used, gas_limit, reward) VALUES (?,?,?,?,?,?,?,?,?)",
            (new_height, new_hash, parent_hash, blk_validator, blk_txc,
             blk_ts, blk_gas_used, blk_gas_limit, blk_reward)
        )
        height_map[old_h] = new_height
        parent_hash = new_hash

    logger.info(f"✅ Cadeia nativa re-encadeada: genesis + {new_height} blocos")

    # ── 5. Copiar transações nativas (com remap de altura) ────────────────
    tx_cols = get_columns(src, 'transactions')
    bh_idx = tx_cols.index('block_height')
    placeholders = ','.join('?' * len(tx_cols))
    native_txs = src.execute(
        "SELECT * FROM transactions "
        "WHERE block_height = 0 OR tx_type IN ('CLAIM','MINING_FEE')"
    ).fetchall()
    tx_count = 0
    for tx in native_txs:
        vals = list(tx)
        old_bh = vals[bh_idx]
        vals[bh_idx] = height_map.get(old_bh, 0)  # transfers ficam em 0 (mempool-era)
        dst.execute(f"INSERT OR IGNORE INTO transactions ({','.join(tx_cols)}) "
                    f"VALUES ({placeholders})", vals)
        tx_count += 1
    logger.info(f"✅ Transações nativas copiadas: {tx_count} (Sepolia expurgada: ~10,2M)")

    # ── 6. Copiar as demais tabelas integralmente ──────────────────────────
    all_tables = [r[0] for r in src.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()]
    remap_tables = {'user_claims', 'pending_claims'}  # têm block_height a remapear

    for table in all_tables:
        if table in CHAIN_TABLES:
            continue
        cols = get_columns(src, table)
        ph = ','.join('?' * len(cols))
        rows = src.execute(f"SELECT * FROM {table}").fetchall()
        if table in remap_tables and 'block_height' in cols:
            bi = cols.index('block_height')
            for row in rows:
                vals = list(row)
                vals[bi] = height_map.get(vals[bi], 0)
                dst.execute(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({ph})", vals)
        else:
            dst.executemany(
                f"INSERT INTO {table} ({','.join(cols)}) VALUES ({ph})",
                [list(r) for r in rows])
        logger.info(f"  • {table}: {len(rows)} linhas")

    dst.commit()

    # ── 7. Verificação de integridade ──────────────────────────────────────
    logger.info("Verificando integridade da cadeia nativa...")
    chain = dst.execute(
        "SELECT height, hash, parent_hash FROM blocks ORDER BY height").fetchall()
    ok = True
    prev_hash = None
    for i, (h, hsh, ph_) in enumerate(chain):
        if h != i:
            logger.error(f"❌ Altura não contígua: esperado {i}, encontrado {h}")
            ok = False
        if i > 0 and ph_ != prev_hash:
            logger.error(f"❌ parent_hash quebrado no bloco {h}")
            ok = False
        prev_hash = hsh
    orphans = dst.execute(
        "SELECT COUNT(*) FROM transactions WHERE block_height > 0 AND block_height "
        "NOT IN (SELECT height FROM blocks)").fetchone()[0]
    if orphans:
        logger.error(f"❌ {orphans} transações órfãs (bloco inexistente)")
        ok = False
    sepolia_left = dst.execute(
        "SELECT COUNT(*) FROM blocks WHERE height > 1000000").fetchone()[0]
    if sepolia_left:
        logger.error(f"❌ Restaram {sepolia_left} blocos com altura Sepolia!")
        ok = False

    n_blocks = dst.execute("SELECT COUNT(*) FROM blocks").fetchone()[0]
    n_txs = dst.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
    size_mb = os.path.getsize(DST_DB) / 1024 / 1024
    logger.info(f"📊 Banco nativo: {n_blocks} blocos (0..{n_blocks-1}), "
                f"{n_txs} txs, {size_mb:.1f} MB")

    src.close()
    dst.close()
    return ok


def apply_swap():
    # Conexões read-only em bancos WAL deixam -wal/-shm órfãos (não podem
    # apagá-los ao fechar). Um checkpoint em modo RW limpa os resíduos.
    conn = sqlite3.connect(SRC_DB)
    conn.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    conn.close()
    for f in (f'{SRC_DB}-wal', f'{SRC_DB}-shm'):
        if os.path.exists(f):
            if os.path.getsize(f) == 0 or f.endswith('-shm'):
                os.remove(f)  # resíduo vazio de conexão anterior
            else:
                logger.error(f"❌ {f} contém dados não consolidados — "
                             f"feche o api_server antes de aplicar.")
                sys.exit(1)
    if os.path.exists(BACKUP_DB):
        logger.error(f"❌ {BACKUP_DB} já existe — remova/renomeie antes de aplicar.")
        sys.exit(1)
    os.rename(SRC_DB, BACKUP_DB)
    os.rename(DST_DB, SRC_DB)
    logger.info(f"✅ Swap concluído:")
    logger.info(f"   {BACKUP_DB}  <- banco antigo (backup integral, 3.7 GB)")
    logger.info(f"   {SRC_DB}     <- cadeia nativa soberana (genesis 0)")


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    ok = build_native_db()
    if not ok:
        logger.error("❌ Verificação falhou — swap NÃO será aplicado.")
        sys.exit(1)
    if apply:
        apply_swap()
        logger.info("🎉 FaucetChain desvinculada da Sepolia. Modo soberano ativo.")
    else:
        logger.info("✅ Dry-run concluído. blockchain_native.db construído e verificado.")
        logger.info("   Para aplicar: python desvincular_sepolia.py --apply")
