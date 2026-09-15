import sqlite3

def check_address():
    try:
        conn = sqlite3.connect('blockchain.db')
        c = conn.cursor()
        
        address = '0x84da71247cbfb0737a9112de1f10dae9823fc298'
        print(f'\n--- TRANSACTIONS FOR {address} ---')
        c.execute("SELECT * FROM transactions WHERE from_address = ? OR to_address = ?", (address, address))
        rows = c.fetchall()
        for r in rows:
            print("  ", r)
            
    except Exception as e:
        print(f"Error: {e}")
        
if __name__ == "__main__":
    check_address()
