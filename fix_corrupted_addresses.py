"""
Correção de dados corrompidos no banco blockchain.db
- Corrige to_address com 47 chars (0x84da...56789) para o endereço correto (42 chars)
- Remove espaços iniciais de from_address / to_address
- Corrige VAULT_ADDRESS com espaço no meio
"""
import sqlite3, re

CORRECT_USER = '0x84da71247cbfb0737a9112de1f10dae9823fc298'
BAD_USER     = '0x84da71247cbfb0737a9112de1f10dae9823fc29856789'
OLD_VAULT    = '0x5374616b696e6756 61756c74000000000000000000000000'
NEW_VAULT    = '0x537461b696e675661756c740000000000000000'

conn = sqlite3.connect('blockchain.db')
c = conn.cursor()

print("=== FIXING CORRUPTED to_address (len=47) ===")
c.execute("SELECT COUNT(*) FROM transactions WHERE to_address = ?", (BAD_USER,))
count = c.fetchone()[0]
print(f"  Found {count} transactions with corrupted to_address")
if count > 0:
    c.execute("UPDATE transactions SET to_address = ? WHERE to_address = ?", (CORRECT_USER, BAD_USER))
    print(f"  Fixed {c.rowcount} rows")

print()
print("=== FIXING from_address WITH LEADING SPACE ===")
c.execute("SELECT COUNT(*) FROM transactions WHERE from_address LIKE ' 0x%'")
count = c.fetchone()[0]
print(f"  Found {count} transactions with leading-space from_address")
if count > 0:
    # Get all unique bad ones and fix them
    c.execute("SELECT DISTINCT from_address FROM transactions WHERE from_address LIKE ' 0x%'")
    bad_froms = [r[0] for r in c.fetchall()]
    for bad in bad_froms:
        good = bad.strip()
        c.execute("UPDATE transactions SET from_address = ? WHERE from_address = ?", (good, bad))
        print(f"  Fixed '{bad}' -> '{good}' ({c.rowcount} rows)")

print()
print("=== FIXING to_address WITH LEADING SPACE ===")
c.execute("SELECT COUNT(*) FROM transactions WHERE to_address LIKE ' 0x%'")
count = c.fetchone()[0]
print(f"  Found {count} transactions with leading-space to_address")
if count > 0:
    c.execute("SELECT DISTINCT to_address FROM transactions WHERE to_address LIKE ' 0x%'")
    bad_tos = [r[0] for r in c.fetchall()]
    for bad in bad_tos:
        good = bad.strip()
        c.execute("UPDATE transactions SET to_address = ? WHERE to_address = ?", (good, bad))
        print(f"  Fixed '{bad}' -> '{good}' ({c.rowcount} rows)")

print()
print("=== FIXING OLD VAULT ADDRESS (with space) ===")
c.execute("SELECT COUNT(*) FROM transactions WHERE from_address = ? OR to_address = ?", (OLD_VAULT, OLD_VAULT))
count = c.fetchone()[0]
print(f"  Found {count} transactions with broken VAULT address")
if count > 0:
    c.execute("UPDATE transactions SET from_address = ? WHERE from_address = ?", (NEW_VAULT, OLD_VAULT))
    c.execute("UPDATE transactions SET to_address = ? WHERE to_address = ?", (NEW_VAULT, OLD_VAULT))
    print(f"  Fixed vault address")

conn.commit()

print()
print("=== VERIFICATION ===")
c.execute("SELECT SUM(value) FROM transactions WHERE to_address = ?", (CORRECT_USER,))
incoming = c.fetchone()[0] or 0
c.execute("SELECT SUM(value) FROM transactions WHERE from_address = ?", (CORRECT_USER,))
outgoing = c.fetchone()[0] or 0
print(f"  User {CORRECT_USER}")
print(f"  Incoming: {incoming:.4f}")
print(f"  Outgoing: {outgoing:.4f}")
print(f"  Net TX balance: {incoming - outgoing:.4f}")

# Check full balance
c.execute("SELECT SUM(amount) FROM user_claims WHERE user_address = ?", (CORRECT_USER,))
claims = c.fetchone()[0] or 0
c.execute("SELECT SUM(reward_amount) FROM mining_rewards WHERE wallet_address = ?", (CORRECT_USER,))
mining = c.fetchone()[0] or 0
total = claims + mining + (incoming - outgoing)
print(f"  Claims: {claims:.4f} | Mining: {mining:.4f}")
print(f"  TOTAL BALANCE: {total:.4f} $CLAIM")

conn.close()
print()
print("Done. Restart api_server to apply changes.")
