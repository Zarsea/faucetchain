import sys
import re

with open('api_server.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
if 'from eth_account.messages import encode_defunct' not in content:
    content = content.replace('import json\n', 'import json\nfrom eth_account.messages import encode_defunct\nfrom eth_account import Account\n')

# 2. Constants
if 'CHAIN_ID =' not in content:
    content = content.replace('API_VERSION = ', 'CHAIN_ID = "7777"\nMAX_SUPPLY = 99000000.0\n\nAPI_VERSION = ')

# 3. TransferRequest
old_transfer_req = '''class TransferRequest(BaseModel):
    sender: str
    receiver: str
    amount: float'''
new_transfer_req = '''class TransferRequest(BaseModel):
    sender: str
    receiver: str
    amount: float
    nonce: int
    signature: str'''
content = content.replace(old_transfer_req, new_transfer_req)

# 4. Nonces table
old_init_table = '''        CREATE TABLE IF NOT EXISTS tracked_addresses ('''
new_init_table = '''        CREATE TABLE IF NOT EXISTS account_nonces (
            address TEXT PRIMARY KEY,
            nonce INTEGER DEFAULT 0
        )
    \'\'\')
    c.execute(\'\'\'
        CREATE TABLE IF NOT EXISTS tracked_addresses ('''
if 'account_nonces' not in content:
    content = content.replace(old_init_table, new_init_table)

# 5. /api/user/{address}/nonce endpoint
nonce_endpoint = '''
@app.get("/api/user/{address}/nonce")
async def get_user_nonce(address: str):
    addr_lower = normalize_address(address)
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT nonce FROM account_nonces WHERE address = ?", (addr_lower,))
    row = c.fetchone()
    conn.close()
    return {"address": addr_lower, "nonce": row[0] if row else 0}
'''
if '/api/user/{address}/nonce' not in content:
    content = content.replace('@app.post("/api/transfer")', nonce_endpoint + '\n@app.post("/api/transfer")')

# 6. Global supply check
supply_func = '''
async def get_total_circulating_supply():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT SUM(amount) FROM user_claims")
    claims = c.fetchone()[0] or 0.0
    c.execute("SELECT SUM(reward_amount) FROM mining_rewards")
    mining = c.fetchone()[0] or 0.0
    conn.close()
    return claims + mining
'''
if 'get_total_circulating_supply' not in content:
    content = content.replace('@app.post("/api/claim")', supply_func + '\n@app.post("/api/claim")')

with open('api_server.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Patch 1 applied')
