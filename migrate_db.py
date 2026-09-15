import sqlite3

conn = sqlite3.connect('blockchain.db')
conn.execute("PRAGMA journal_mode=WAL")

conn.execute('''
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

conn.execute('''
    CREATE TABLE IF NOT EXISTS user_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address TEXT NOT NULL,
        amount REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        tx_hash TEXT NOT NULL,
        block_height INTEGER NOT NULL
    )
''')

conn.commit()
print("Migration done: epoch_roots and user_claims created.")

c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
print("All tables:", [r[0] for r in c.fetchall()])
conn.close()
