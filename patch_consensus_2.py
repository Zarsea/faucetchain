import sys
import re

with open('api_server.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update transfer_claim
old_transfer = '''@app.post("/api/transfer")
async def transfer_claim(req: TransferRequest, request: Request):
    client_ip = request.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    try:
        sender_lower = normalize_address(req.sender)
        receiver_lower = normalize_address(req.receiver)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Endereço inválido: {e}")

    # Check balance
    balance_info = await get_user_balance(sender_lower)
    if balance_info["total_claim"] < req.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    conn = get_db_connection()
    c = conn.cursor()

    tx_hash = "0x" + keccak256((sender_lower + receiver_lower + str(req.amount) + str(_time.time())).encode()).hex()
    timestamp = int(datetime.now().timestamp())

    c.execute(\'\'\'
        INSERT INTO transactions (hash, block_height, from_address, to_address, value, gas_price, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    \'\'\', (tx_hash, 0, sender_lower, receiver_lower, req.amount, 0, timestamp))

    conn.commit()
    conn.close()

    audit_log("TRANSFER", client_ip, {"from": sender_lower, "to": receiver_lower, "amount": req.amount, "tx_hash": tx_hash})

    return {"status": "success", "tx_hash": tx_hash}'''

new_transfer = '''@app.post("/api/transfer")
async def transfer_claim(req: TransferRequest, request: Request):
    client_ip = request.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    try:
        sender_lower = normalize_address(req.sender)
        receiver_lower = normalize_address(req.receiver)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Endereço inválido: {e}")

    conn = get_db_connection()
    c = conn.cursor()

    # 1. Nonce Check
    c.execute("SELECT nonce FROM account_nonces WHERE address = ?", (sender_lower,))
    row = c.fetchone()
    current_nonce = row[0] if row else 0
    
    if req.nonce != current_nonce + 1:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Invalid Nonce. Expected {current_nonce + 1}, got {req.nonce}")

    # 2. Signature Verification
    payload_str = f"{CHAIN_ID}:{req.nonce}:{sender_lower}:{receiver_lower}:{req.amount}"
    try:
        message = encode_defunct(text=payload_str)
        recovered_addr = Account.recover_message(message, signature=req.signature).lower()
        if recovered_addr != sender_lower:
            raise ValueError("Signature mismatch")
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=401, detail=f"Assinatura inválida ou corrompida: {e}")

    # 3. Check balance
    balance_info = await get_user_balance(sender_lower)
    if balance_info["total_claim"] < req.amount:
        conn.close()
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # 4. Generate deterministic Tx Hash including Chain ID and Nonce
    tx_hash = "0x" + keccak256(payload_str.encode()).hex()
    timestamp = int(datetime.now().timestamp())

    try:
        c.execute(\'\'\'
            INSERT INTO transactions (hash, block_height, from_address, to_address, value, gas_price, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        \'\'\', (tx_hash, 0, sender_lower, receiver_lower, req.amount, 0, timestamp))
        
        # Increment Nonce
        if row:
            c.execute("UPDATE account_nonces SET nonce = ? WHERE address = ?", (req.nonce, sender_lower))
        else:
            c.execute("INSERT INTO account_nonces (address, nonce) VALUES (?, ?)", (sender_lower, req.nonce))
            
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

    audit_log("TRANSFER", client_ip, {"from": sender_lower, "to": receiver_lower, "amount": req.amount, "tx_hash": tx_hash, "nonce": req.nonce})

    return {"status": "success", "tx_hash": tx_hash}'''

if 'payload_str = f"{CHAIN_ID}' not in content:
    content = content.replace(old_transfer, new_transfer)

# 2. Update claim max supply
old_claim_insert = '''    c.execute(\'\'\'
        INSERT INTO pending_claims (user_address, amount, timestamp, tx_hash, block_height)
        VALUES (?, ?, ?, ?, ?)
    \'\'\', (addr_lower, req.amount, current_ts, tx_hash, 0))'''

new_claim_insert = '''    # Hard Cap Check
    total_supply = await get_total_circulating_supply()
    if total_supply + req.amount > MAX_SUPPLY:
        conn.close()
        raise HTTPException(status_code=403, detail="Maximum Supply Reached. Faucet minting is locked.")

    c.execute(\'\'\'
        INSERT INTO pending_claims (user_address, amount, timestamp, tx_hash, block_height)
        VALUES (?, ?, ?, ?, ?)
    \'\'\', (addr_lower, req.amount, current_ts, tx_hash, 0))'''

if 'Maximum Supply Reached. Faucet minting is locked.' not in content:
    content = content.replace(old_claim_insert, new_claim_insert)

# 3. Update mining max supply
old_mining_dist = '''    total_paid = 0
    rewards = []
    
    for node in active_nodes:'''

new_mining_dist = '''    total_paid = 0
    rewards = []
    
    # Hard Cap Check
    total_supply = await get_total_circulating_supply()
    if total_supply + total_reward > MAX_SUPPLY:
        conn.close()
        return {"status": "hard_cap_reached", "distributed": 0}
        
    for node in active_nodes:'''

if 'status": "hard_cap_reached"' not in content:
    content = content.replace(old_mining_dist, new_mining_dist)

with open('api_server.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Patch 2 applied')
