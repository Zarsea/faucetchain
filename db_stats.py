import sqlite3
import json

def analyze():
    conn = sqlite3.connect('blockchain.db')
    c = conn.cursor()
    
    stats = {}
    
    # 1. Blocks
    try:
        c.execute("SELECT COUNT(*), MIN(height), MAX(height), MIN(timestamp), MAX(timestamp) FROM blocks")
        blocks_count, min_height, max_height, min_block_ts, max_block_ts = c.fetchone()
        stats["blocks"] = {
            "count": blocks_count,
            "min_height": min_height,
            "max_height": max_height,
            "min_timestamp": min_block_ts,
            "max_timestamp": max_block_ts
        }
    except Exception as e:
        stats["blocks"] = {"error": str(e)}
    
    # 2. Transactions
    try:
        c.execute("SELECT COUNT(*), SUM(value), MIN(timestamp), MAX(timestamp) FROM transactions")
        tx_count, total_value, min_tx_ts, max_tx_ts = c.fetchone()
        stats["transactions"] = {
            "count": tx_count,
            "total_value": total_value,
            "min_timestamp": min_tx_ts,
            "max_timestamp": max_tx_ts
        }
    except Exception as e:
        stats["transactions"] = {"error": str(e)}
    
    # 3. Unique Addresses
    try:
        c.execute('''
            SELECT COUNT(DISTINCT address) FROM (
                SELECT from_address as address FROM transactions
                UNION
                SELECT to_address as address FROM transactions WHERE to_address IS NOT NULL
            )
        ''')
        stats["unique_addresses"] = c.fetchone()[0]
    except Exception as e:
        stats["unique_addresses"] = {"error": str(e)}
    
    # 4. Sync State
    try:
        c.execute("SELECT * FROM sync_state")
        stats["sync_state"] = dict(c.fetchall())
    except Exception as e:
        stats["sync_state"] = {"error": str(e)}
    
    # 5. Epoch Roots
    try:
        c.execute("SELECT COUNT(*), MIN(epoch_id), MAX(epoch_id) FROM epoch_roots")
        er_count, min_epoch, max_epoch = c.fetchone()
        stats["epoch_roots"] = {
            "count": er_count,
            "min_epoch_id": min_epoch,
            "max_epoch_id": max_epoch
        }
    except Exception as e:
        stats["epoch_roots"] = {"error": str(e)}
        
    with open('db_stats.json', 'w') as f:
        json.dump(stats, f, indent=2)
    conn.close()

if __name__ == '__main__':
    analyze()
