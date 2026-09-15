import os

patch_code = """

# --- EMAIL AUTHENTICATION SYSTEM ---
import hashlib
import secrets

class RegisterRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

def init_users_table():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            wallet_address TEXT UNIQUE NOT NULL,
            created_at INTEGER
        )
    ''')
    conn.commit()
    conn.close()

@app.on_event("startup")
def startup_users():
    init_users_table()

@app.post("/api/auth/register")
async def register_user(req: RegisterRequest):
    email = req.email.strip().lower()
    password = req.password
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email e senha são obrigatórios.")
        
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    # Generate custodial wallet address
    wallet_address = "0x" + secrets.token_hex(20)
    current_ts = int(datetime.now().timestamp())
    
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (email, password_hash, wallet_address, created_at) VALUES (?, ?, ?, ?)",
                  (email, password_hash, wallet_address, current_ts))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")
        
    conn.close()
    return {"status": "success", "wallet_address": wallet_address, "email": email}

@app.post("/api/auth/login")
async def login_user(req: LoginRequest):
    email = req.email.strip().lower()
    password = req.password
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT wallet_address FROM users WHERE email = ? AND password_hash = ?", (email, password_hash))
    row = c.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
        
    return {"status": "success", "wallet_address": row[0], "email": email}
# -----------------------------------
"""

with open('api_server.py', 'a', encoding='utf-8') as f:
    f.write(patch_code)

print("Backend patched with Email Auth.")
