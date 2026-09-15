import sqlite3
conn = sqlite3.connect('blockchain.db')
c = conn.cursor()
c.execute("SELECT sql FROM sqlite_master WHERE name='transactions'")
print(c.fetchone()[0])
