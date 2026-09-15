import sqlite3

conn = sqlite3.connect('blockchain.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Show full addresses involved in recent transfers
print("=== FULL ADDRESSES RECENT TXS ===")
c.execute("SELECT hash, from_address, to_address, value, timestamp FROM transactions ORDER BY timestamp DESC LIMIT 6")
rows = c.fetchall()
for r in rows:
    d = dict(r)
    print(f"hash : {d['hash']}")
    print(f"from : {d['from_address']}  (len={len(d['from_address'])})")
    print(f"to   : {d['to_address']}  (len={len(d['to_address'])})")
    print(f"value: {d['value']}")
    print()

# Show what the balance query sees for the RECIPIENT address
RECIPIENT = '0x84da71247cbfb0737a9112de1f10dae9823fc298'
print(f"=== BALANCE QUERY FOR {RECIPIENT} ===")
c.execute("SELECT SUM(value) FROM transactions WHERE to_address = ?", (RECIPIENT,))
print(f"incoming (exact match): {c.fetchone()[0]}")

c.execute("SELECT SUM(value) FROM transactions WHERE LOWER(to_address) = LOWER(?)", (RECIPIENT,))
print(f"incoming (case-insensitive): {c.fetchone()[0]}")

# Search for all addresses that start with 0x84da
c.execute("SELECT DISTINCT to_address FROM transactions WHERE to_address LIKE '0x84da%'")
rows = c.fetchall()
print()
print("=== ALL to_address STARTING WITH 0x84da ===")
for r in rows:
    addr = r[0]
    print(f"  addr: {addr}  (len={len(addr)})")

c.execute("SELECT DISTINCT from_address FROM transactions WHERE from_address LIKE '0x84da%'")
rows = c.fetchall()
print()
print("=== ALL from_address STARTING WITH 0x84da ===")
for r in rows:
    addr = r[0]
    print(f"  addr: {addr}  (len={len(addr)})")

conn.close()
