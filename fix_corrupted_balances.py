import sqlite3
import hashlib

def keccak256_mock(data):
    # Just use sha256 for a unique hash since we don't have eth_hash readily available
    return hashlib.sha256(data).hexdigest()

def fix_db():
    conn = sqlite3.connect('blockchain.db')
    c = conn.cursor()
    
    address = '0x84da71247cbfb0737a9112de1f10dae9823fc298'
    vault = '0x537461b696e675661756c740000000000000000'
    
    print("=== FIXING CORRUPTED BALANCES ===")
    
    # 1. DELETE fraudulent Token ID 7
    c.execute("DELETE FROM staking_positions WHERE token_id = 7 AND staker_address = ?", (address,))
    print(f"Deleted fraudulent Token ID 7: {c.rowcount} rows affected.")
    
    # 2. Add missing OUTGOING transactions for Token ID 5 (500.0) and Token ID 6 (140,000.0)
    # Check if they already exist
    c.execute("SELECT * FROM transactions WHERE from_address = ? AND to_address = ? AND value = 500.0", (address, vault))
    if not c.fetchone():
        ts_5 = 1779165932
        hash_5 = "0x" + keccak256_mock((address + "stake" + str(500.0) + str(ts_5)).encode())
        c.execute('''
            INSERT INTO transactions (hash, block_height, from_address, to_address, value, gas_price, timestamp)
            VALUES (?, 0, ?, ?, ?, 0, ?)
        ''', (hash_5, address, vault, 500.0, ts_5))
        print("Inserted missing outgoing TX for Token ID 5 (500.0).")
    else:
        print("TX for Token ID 5 already exists.")

    c.execute("SELECT * FROM transactions WHERE from_address = ? AND to_address = ? AND value = 140000.0", (address, vault))
    if not c.fetchone():
        ts_6 = 1779165958
        hash_6 = "0x" + keccak256_mock((address + "stake" + str(140000.0) + str(ts_6)).encode())
        c.execute('''
            INSERT INTO transactions (hash, block_height, from_address, to_address, value, gas_price, timestamp)
            VALUES (?, 0, ?, ?, ?, 0, ?)
        ''', (hash_6, address, vault, 140000.0, ts_6))
        print("Inserted missing outgoing TX for Token ID 6 (140000.0).")
    else:
        print("TX for Token ID 6 already exists.")

    conn.commit()
    
    # VERIFY
    c.execute("SELECT SUM(amount) FROM user_claims WHERE user_address = ?", (address,))
    claims = c.fetchone()[0] or 0.0
    c.execute("SELECT SUM(reward_amount) FROM mining_rewards WHERE wallet_address = ?", (address,))
    mining = c.fetchone()[0] or 0.0
    c.execute("SELECT SUM(value) FROM transactions WHERE to_address = ?", (address,))
    incoming = c.fetchone()[0] or 0.0
    c.execute("SELECT SUM(value) FROM transactions WHERE from_address = ?", (address,))
    outgoing = c.fetchone()[0] or 0.0
    
    total = claims + mining + incoming - outgoing
    
    print(f"\n=== VERIFICATION FOR {address} ===")
    print(f"Claims: {claims}")
    print(f"Mining: {mining}")
    print(f"Incoming: {incoming}")
    print(f"Outgoing: {outgoing}")
    print(f"New Total Balance: {total}")
    
    conn.close()

if __name__ == '__main__':
    fix_db()
