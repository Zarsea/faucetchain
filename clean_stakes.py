import sqlite3
conn = sqlite3.connect('blockchain.db')
c = conn.cursor()

c.execute("SELECT hash FROM transactions WHERE from_address = ' 0x84da71247cbfb0737a9112de1f10dae9823fc298'")
bad_txs = c.fetchall()
print(f'Deleting {len(bad_txs)} fraudulent transactions...')
c.execute("DELETE FROM transactions WHERE from_address = ' 0x84da71247cbfb0737a9112de1f10dae9823fc298'")

c.execute("SELECT token_id FROM staking_positions WHERE staker_address = ' 0x84da71247cbfb0737a9112de1f10dae9823fc298'")
bad_utxos = c.fetchall()
print(f'Deleting {len(bad_utxos)} fraudulent staking UTXOs...')
c.execute("DELETE FROM staking_positions WHERE staker_address = ' 0x84da71247cbfb0737a9112de1f10dae9823fc298'")

conn.commit()
conn.close()
print("Done.")
