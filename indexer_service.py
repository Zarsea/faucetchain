"""
FaucetChain — Native Chain Service (Modo Soberano)

A FaucetChain foi desvinculada da Sepolia: o banco de produção misturava
mais de 10 milhões de transações reais da Sepolia, em ETH, com os saldos de
$CLAIM. Elas foram expurgadas de uma vez, e o que sobrou foi renumerado e
re-encadeado a partir de um genesis próprio (altura 0, Chain ID 7777).

Não há mais indexação de blockchain externa: os blocos são gerados
nativamente pelo api_server.py (/api/mining/explore).

Este módulo permanece apenas para:
  - Inicializar o schema das tabelas de cadeia em instalações novas
  - Servir de ponto de extensão para futuras tarefas de manutenção da
    cadeia nativa (recálculo de epoch roots, compactação, etc.)
"""

import sqlite3
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('indexer.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('native_chain')

DB_PATH = "blockchain.db"


def init_db():
    """Cria o schema das tabelas de cadeia caso não existam (instalação nova)."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # WAL para concorrência com o api_server
    c.execute("PRAGMA journal_mode=WAL")

    c.execute('''
        CREATE TABLE IF NOT EXISTS blocks (
            height INTEGER PRIMARY KEY,
            hash TEXT UNIQUE,
            parent_hash TEXT,
            validator TEXT,
            tx_count INTEGER,
            timestamp INTEGER,
            gas_used INTEGER,
            gas_limit INTEGER,
            reward REAL
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            hash TEXT PRIMARY KEY,
            block_height INTEGER,
            from_address TEXT,
            to_address TEXT,
            value REAL,
            gas_price INTEGER,
            timestamp INTEGER,
            -- Written by the sealing path in api_server.py. Without them a fresh
            -- install accepts claims and then cannot seal a single block.
            tx_type TEXT,
            source_platform TEXT,
            FOREIGN KEY(block_height) REFERENCES blocks(height)
        )
    ''')

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    logger.info("🚀 FaucetChain — Modo Soberano Nativo")
    logger.info("⛓️  Cadeia própria (genesis altura 0, Chain ID 7777).")
    logger.info("✅ Blocos são gerados nativamente pelo api_server (/api/mining/explore).")
    logger.info("ℹ️  Nenhuma sincronização externa é necessária — serviço encerrado.")
