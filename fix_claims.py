import sqlite3

def fix_user_claims():
    conn = sqlite3.connect('blockchain.db')
    c = conn.cursor()
    
    print("=== FIXING USER CLAIMS WITH LEADING SPACES ===")
    c.execute("SELECT id, user_address FROM user_claims WHERE user_address LIKE ' %'")
    rows = c.fetchall()
    
    for row in rows:
        claim_id, bad_address = row
        good_address = bad_address.strip()
        c.execute("UPDATE user_claims SET user_address = ? WHERE id = ?", (good_address, claim_id))
        print(f"Fixed claim ID {claim_id}: '{bad_address}' -> '{good_address}'")
        
    conn.commit()
    print("Done.")
    conn.close()

if __name__ == '__main__':
    fix_user_claims()
