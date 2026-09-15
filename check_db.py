import sqlite3

def run():
    conn = sqlite3.connect('blockchain.db')
    c = conn.cursor()
    c.execute("SELECT name, sql FROM sqlite_master WHERE type IN ('table', 'index')")
    for row in c.fetchall():
        print(f"[{row[0]}]\n{row[1]}\n")
    conn.close()

if __name__ == '__main__':
    run()
