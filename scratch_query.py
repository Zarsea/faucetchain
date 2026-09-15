import sqlite3

conn = sqlite3.connect('blockchain.db')
cursor = conn.cursor()

# Check top balances in user_claims
print("=== Top Wallets by Total Claims ===")
cursor.execute("SELECT user_address, SUM(amount) as total FROM user_claims GROUP BY user_address ORDER BY total DESC LIMIT 10")
for r in cursor.fetchall():
    print(f"  {r[0]}: {r[1]} CLAIM")

# Check specific address
addr = "0x84da71247cbfb0737a9112de1f10dae9823fc298"
print(f"\n=== Checking {addr} ===")
cursor.execute("SELECT SUM(amount) FROM user_claims WHERE user_address = ?", (addr,))
result = cursor.fetchone()
print(f"  Total from claims: {result[0]}")

# Check transactions for this address
cursor.execute("SELECT COUNT(*) FROM transactions WHERE from_address = ? OR to_address = ?", (addr, addr))
tx_count = cursor.fetchone()
print(f"  Transaction count: {tx_count[0]}")

# Also check tracked addresses
cursor.execute("SELECT * FROM tracked_addresses LIMIT 10")
tracked = cursor.fetchall()
print(f"\n=== Tracked Addresses ({len(tracked)}) ===")
for r in tracked:
    print(f"  {r}")

conn.close()
