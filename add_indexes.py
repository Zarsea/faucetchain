import sqlite3

def run():
    print("Connecting to DB...")
    conn = sqlite3.connect('blockchain.db')
    c = conn.cursor()
    
    print("Creating index on transactions(from_address)...")
    c.execute("CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON transactions(from_address)")
    
    print("Creating index on transactions(to_address)...")
    c.execute("CREATE INDEX IF NOT EXISTS idx_transactions_to_address ON transactions(to_address)")
    
    print("Creating index on transactions(timestamp)...")
    c.execute("CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC)")
    
    print("Creating index on user_claims(user_address)...")
    c.execute("CREATE INDEX IF NOT EXISTS idx_user_claims_user_address ON user_claims(user_address)")
    
    print("Creating index on active_miners(wallet_address)...")
    c.execute("CREATE INDEX IF NOT EXISTS idx_active_miners_wallet_address ON active_miners(wallet_address)")
    
    conn.commit()
    conn.close()
    print("Indexes created successfully!")

if __name__ == '__main__':
    run()
