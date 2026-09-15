import re

def patch():
    with open('api_server.py', 'r', encoding='utf-8') as f:
        content = f.read()

    defi_code = """
# ==========================================
# CROSS-CHAIN DEFI YIELD HUB
# ==========================================

def init_defi_stakes_table():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS defi_stakes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet_address TEXT NOT NULL,
            protocol_id TEXT NOT NULL,
            staked_amount REAL NOT NULL DEFAULT 0.0,
            accumulated_yield REAL NOT NULL DEFAULT 0.0,
            last_updated INTEGER NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

init_defi_stakes_table()

MOCK_DEFI_STRATEGIES = [
    {
        "id": "lido_eth",
        "name": "Lido Staked ETH (fETH)",
        "protocol": "Lido",
        "network": "Ethereum",
        "baseApy": 3.8,
        "treasuryAllocated": 2500000,
        "tvl": 15400000,
        "risk": "Low"
    },
    {
        "id": "aave_usdc",
        "name": "Aave USDC Lending",
        "protocol": "Aave V3",
        "network": "Ethereum",
        "baseApy": 5.2,
        "treasuryAllocated": 4000000,
        "tvl": 22100000,
        "risk": "Low"
    },
    {
        "id": "curve_3pool",
        "name": "Curve 3Pool Liquidity",
        "protocol": "Curve Finance",
        "network": "Ethereum",
        "baseApy": 4.5,
        "treasuryAllocated": 1500000,
        "tvl": 9800000,
        "risk": "Medium"
    }
]

@app.get("/api/defi/strategies")
async def get_defi_strategies(wallet: str = None):
    conn = get_db_connection()
    c = conn.cursor()
    
    user_stakes = {}
    if wallet:
        c.execute("SELECT protocol_id, staked_amount, accumulated_yield FROM defi_stakes WHERE wallet_address = ?", (wallet.lower(),))
        for row in c.fetchall():
            user_stakes[row[0]] = {
                "staked": row[1],
                "yield": row[2]
            }
            
    conn.close()
    
    result = []
    for strat in MOCK_DEFI_STRATEGIES:
        s = strat.copy()
        s["userStaked"] = user_stakes.get(s["id"], {}).get("staked", 0.0)
        s["userYield"] = user_stakes.get(s["id"], {}).get("yield", 0.0)
        result.append(s)
        
    return {"strategies": result}

class DefiStakeRequest(BaseModel):
    wallet_address: str
    protocol_id: str
    amount: float

@app.post("/api/defi/stake")
async def stake_defi(req: DefiStakeRequest):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be > 0")
        
    conn = get_db_connection()
    c = conn.cursor()
    
    current_ts = int(datetime.now().timestamp())
    
    # Upsert logic
    c.execute("SELECT staked_amount FROM defi_stakes WHERE wallet_address = ? AND protocol_id = ?", (req.wallet_address.lower(), req.protocol_id))
    row = c.fetchone()
    
    if row:
        c.execute("UPDATE defi_stakes SET staked_amount = staked_amount + ?, last_updated = ? WHERE wallet_address = ? AND protocol_id = ?",
                  (req.amount, current_ts, req.wallet_address.lower(), req.protocol_id))
    else:
        c.execute("INSERT INTO defi_stakes (wallet_address, protocol_id, staked_amount, last_updated) VALUES (?, ?, ?, ?)",
                  (req.wallet_address.lower(), req.protocol_id, req.amount, current_ts))
                  
    conn.commit()
    conn.close()
    
    return {"status": "success", "message": f"Successfully staked {req.amount} $CLAIM into {req.protocol_id}"}

@app.post("/api/defi/unstake")
async def unstake_defi(req: DefiStakeRequest):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be > 0")
        
    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute("SELECT staked_amount FROM defi_stakes WHERE wallet_address = ? AND protocol_id = ?", (req.wallet_address.lower(), req.protocol_id))
    row = c.fetchone()
    
    if not row or row[0] < req.amount:
        conn.close()
        raise HTTPException(status_code=400, detail="Insufficient staked balance")
        
    current_ts = int(datetime.now().timestamp())
    new_balance = row[0] - req.amount
    
    if new_balance <= 0.0001:
        c.execute("DELETE FROM defi_stakes WHERE wallet_address = ? AND protocol_id = ?", (req.wallet_address.lower(), req.protocol_id))
    else:
        c.execute("UPDATE defi_stakes SET staked_amount = ?, last_updated = ? WHERE wallet_address = ? AND protocol_id = ?",
                  (new_balance, current_ts, req.wallet_address.lower(), req.protocol_id))
                  
    conn.commit()
    conn.close()
    
    return {"status": "success", "message": f"Successfully withdrew {req.amount} $CLAIM from {req.protocol_id}"}

def init_users_table():
"""

    new_content = content.replace("def init_users_table():", defi_code)
    
    with open('api_server.py', 'w', encoding='utf-8') as f:
        f.write(new_content)

if __name__ == '__main__':
    patch()
