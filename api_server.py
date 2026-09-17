from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, Header
import time as _time
import os
import sys
import asyncio

# Force UTF-8 output on Windows (prevents cp1252 emoji crash)
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    os.environ['PYTHONIOENCODING'] = 'utf-8'

# Read .env before anything asks for a secret. Values already in the real
# environment win, so a deployment overrides the file rather than fighting it.
try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:  # the appchain still starts; PASSWORD_SALT must then be exported
    pass

import settlement  # the sentences wallets sign live here, shared with the browser
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Optional, Dict
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import uvicorn
import re
import json
import math
import secrets
from eth_account.messages import encode_defunct
from eth_account import Account
import logging
import sqlite3
from typing import Tuple
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

CHAIN_ID = "7777"
MAX_SUPPLY = 99000000.0
PASSWORD_MIN_LENGTH = 8

# ===========================
# LOGGING CONFIGURATION
# ===========================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('vector_db_audit.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
audit_logger = logging.getLogger('audit')

try:
    from VectorKnowledgeBase import VectorKnowledgeBase, seed_knowledge_base
    HAS_VECTOR_DB = True
except ImportError:
    HAS_VECTOR_DB = False
    print("⚠️ VectorKnowledgeBase dependencies missing. Knowledge base features disabled.")

try:
    from FraudAndBonusDetector import FraudDetector
    _fraud_detector = FraudDetector()
    HAS_FRAUD_DETECTOR = True
except ImportError:
    HAS_FRAUD_DETECTOR = False
    _fraud_detector = None
    print("⚠️ FraudDetector not available. Fraud detection disabled.")

app = FastAPI(
    title="FaucetChain Vector Knowledge API",
    description="Semantic search API for FaucetChain documentation (Secured)",
    version="2.0.0"
)

# CORS for frontend integration
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

if "*" in ALLOWED_ORIGINS:
    raise RuntimeError("ALLOWED_ORIGINS cannot contain '*' when credentials are enabled")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Vector DB
kb = None

def init_epoch_roots_table():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS epoch_roots (
            epoch_id INTEGER NOT NULL,
            epoch_size INTEGER NOT NULL,
            start_height INTEGER NOT NULL,
            end_height INTEGER NOT NULL,
            root TEXT NOT NULL,
            leaf_count INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY(epoch_id, epoch_size)
        )
    ''')
    conn.commit()
    conn.commit()
    conn.close()

def init_pending_claims_table():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS pending_claims (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_address TEXT NOT NULL,
            amount REAL NOT NULL,
            timestamp INTEGER NOT NULL,
            tx_hash TEXT NOT NULL,
            block_height INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            source_platform TEXT DEFAULT 'WEB3'
        )
    ''')
    # Fase B (Proof of Claim): colunas do proof em bancos pré-existentes
    for col, decl in (("poc_nonce", "INTEGER"), ("poc_hash", "TEXT")):
        try:
            c.execute(f"ALTER TABLE pending_claims ADD COLUMN {col} {decl}")
        except sqlite3.OperationalError:
            pass  # coluna já existe
    conn.commit()
    conn.close()

def init_user_claims_table():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_claims (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_address TEXT NOT NULL,
            amount REAL NOT NULL,
            timestamp INTEGER NOT NULL,
            tx_hash TEXT NOT NULL,
            block_height INTEGER NOT NULL,
            source_platform TEXT DEFAULT 'WEB3'
        )
    ''')
    conn.commit()
    conn.close()

def init_faucet_registry_table():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS faucet_registry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            wallet_address TEXT NOT NULL UNIQUE,
            registered_at INTEGER NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def init_faucet_api_keys_table():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS faucet_api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            faucet_wallet TEXT NOT NULL,
            api_key TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            last_used INTEGER,
            total_requests INTEGER NOT NULL DEFAULT 0,
            total_settled REAL NOT NULL DEFAULT 0.0,
            FOREIGN KEY (faucet_wallet) REFERENCES faucet_registry(wallet_address)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS faucet_settlements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            faucet_wallet TEXT NOT NULL,
            user_wallet TEXT NOT NULL,
            amount REAL NOT NULL,
            tx_hash TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            api_key_used TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def init_microclaims_tables():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS microclaims_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            faucet_wallet TEXT NOT NULL,
            user_wallet TEXT NOT NULL,
            virtual_balance REAL NOT NULL DEFAULT 0.0,
            total_claimed REAL NOT NULL DEFAULT 0.0,
            total_withdrawn REAL NOT NULL DEFAULT 0.0,
            claim_count INTEGER NOT NULL DEFAULT 0,
            last_claim_at INTEGER,
            created_at INTEGER NOT NULL,
            UNIQUE(faucet_wallet, user_wallet)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS microclaims_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            faucet_wallet TEXT NOT NULL,
            user_wallet TEXT NOT NULL,
            amount REAL NOT NULL,
            event_type TEXT NOT NULL,
            tx_hash TEXT,
            timestamp INTEGER NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def init_internal_faucet():
    conn = get_db_connection()
    c = conn.cursor()
    wallet = os.getenv("INTERNAL_FAUCET_WALLET")
    key = os.getenv("INTERNAL_FAUCET_API_KEY")
    if not wallet or not key:
        conn.close()
        audit_logger.warning("Internal faucet bootstrap skipped: INTERNAL_FAUCET_WALLET or INTERNAL_FAUCET_API_KEY not configured")
        return
    try:
        timestamp = int(_time.time())
        c.execute("INSERT OR IGNORE INTO faucet_registry (name, wallet_address, registered_at) VALUES (?, ?, ?)",
                  ("FaucetInternal", wallet, timestamp))
        c.execute("SELECT id FROM faucet_api_keys WHERE api_key = ?", (key,))
        if not c.fetchone():
            c.execute("INSERT INTO faucet_api_keys (faucet_wallet, api_key, created_at, is_active) VALUES (?, ?, ?, 1)",
                      (wallet, key, timestamp))
        conn.commit()
    except Exception as e:
        print(f"⚠️ Failed to init internal faucet: {e}")
    finally:
        conn.close()

def generate_api_key() -> str:
    """Generate a secure FaucetHub API key with prefix fch_"""
    return f"fch_{secrets.token_hex(32)}"

def keccak256(data: bytes) -> bytes:
    """
    Keccak-256 compatible com Solidity keccak256.
    Requer uma dependencia:
    - eth-hash (recomendado) ou
    - pycryptodome (Crypto.Hash.keccak)
    """
    try:
        from eth_hash.auto import keccak  # type: ignore
        return keccak(data)
    except Exception:
        try:
            from Crypto.Hash import keccak as keccaklib  # type: ignore
            k = keccaklib.new(digest_bits=256)
            k.update(data)
            return k.digest()
        except Exception as e:
            raise HTTPException(
                status_code=501,
                detail="Keccak dependency missing. Install 'eth-hash' or 'pycryptodome' to enable Merkle proofs."
            ) from e

def _hex_to_bytes32(h: str) -> bytes:
    if h.startswith("0x"):
        h = h[2:]
    b = bytes.fromhex(h)
    if len(b) != 32:
        raise HTTPException(status_code=400, detail="Expected 32-byte hex (bytes32)")
    return b

def _leaf_hash_from_block_hash(block_hash_hex: str) -> bytes:
    # leafHash = keccak256(bytes32(blockHash))
    leaf = _hex_to_bytes32(block_hash_hex)
    return keccak256(leaf)

def compute_merkle_root_and_proof(block_hashes_hex: List[str], index: int) -> Tuple[str, List[str], str]:
    """
    Merkle tree:
    - leafHash = keccak256(bytes32(blockHash))
    - parent = keccak256(left || right)
    - if odd number of nodes at any level: duplicate last
    Returns: (rootHex, siblingsHex[], leafHashHex)
    """
    if index < 0 or index >= len(block_hashes_hex):
        raise HTTPException(status_code=400, detail="Index out of range")
    level = [_leaf_hash_from_block_hash(h) for h in block_hashes_hex]
    leaf_hash = level[index]
    proof: List[bytes] = []
    idx = index
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])
        sibling = level[idx ^ 1]
        proof.append(sibling)
        # build next level
        next_level: List[bytes] = []
        for i in range(0, len(level), 2):
            next_level.append(keccak256(level[i] + level[i + 1]))
        level = next_level
        idx //= 2
    root = level[0]
    return "0x" + root.hex(), ["0x" + p.hex() for p in proof], "0x" + leaf_hash.hex()


def claims_merkle_root(tx_hashes: List[str]) -> str:
    """Merkle root dos claims de um bloco (Fase B).

    - folhas ORDENADAS lexicograficamente por tx_hash — regra canônica que
      torna o root independente da ordem de persistência/consulta (o auditor
      externo recomputa sem precisar conhecer a ordem de inserção)
    - leaf = keccak256(utf8(tx_hash))  — robusto a hashes de qualquer formato
    - parent = keccak256(left || right); nível ímpar duplica o último
    (mesma regra de combinação do compute_merkle_root_and_proof)
    """
    if not tx_hashes:
        return "0x" + "0" * 64
    level = [keccak256(h.encode()) for h in sorted(tx_hashes)]
    while len(level) > 1:
        if len(level) % 2 == 1:
            level.append(level[-1])
        level = [keccak256(level[i] + level[i + 1]) for i in range(0, len(level), 2)]
    return "0x" + level[0].hex()


def init_blocks_merkle_column():
    """Fase B: coluna merkle_root no header dos blocos (bancos pré-existentes)."""
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute("ALTER TABLE blocks ADD COLUMN merkle_root TEXT")
    except sqlite3.OperationalError:
        pass  # coluna já existe
    conn.commit()
    conn.close()


@app.on_event("startup")
async def startup_event():
    """Initialize the knowledge base on startup (gracefully)."""
    global kb
    if HAS_VECTOR_DB:
        try:
            kb = VectorKnowledgeBase()
            stats = kb.get_stats()
            if stats['total_documents'] == 0:
                print("Database empty, seeding with initial documents...")
                kb = seed_knowledge_base()
            else:
                print(f"Loaded existing database with {stats['total_documents']} documents")
        except Exception as e:
            print(f"Failed to initialize knowledge base: {e}")
            kb = None
    else:
        print("Knowledge base disabled (dependencies missing)")

    # Merkle / epoch roots storage
    try:
        init_epoch_roots_table()
    except Exception as e:
        print(f"⚠️ Failed to init epoch_roots table: {e}")

    # Fase B: header do bloco com Merkle root dos claims
    try:
        init_blocks_merkle_column()
    except Exception as e:
        print(f"⚠️ Failed to init blocks.merkle_root column: {e}")

    try:
        init_user_claims_table()
    except Exception as e:
        print(f"⚠️ Failed to init user_claims table: {e}")

    try:
        init_pending_claims_table()
    except Exception as e:
        print(f"⚠️ Failed to init pending_claims table: {e}")

    try:
        init_faucet_registry_table()
    except Exception as e:
        print(f"⚠️ Failed to init faucet_registry table: {e}")

    try:
        init_faucet_api_keys_table()
    except Exception as e:
        print(f"⚠️ Failed to init faucet_api_keys table: {e}")

    try:
        init_microclaims_tables()
    except Exception as e:
        print(f"⚠️ Failed to init microclaims tables: {e}")

    try:
        init_internal_faucet()
    except Exception as e:
        print(f"⚠️ Failed to init internal faucet: {e}")

# Rate Limiting Storage (in-memory, use Redis in production)
rate_limit_storage = defaultdict(list)
RATE_LIMIT_MAX_REQUESTS = 100  # Max requests per window
RATE_LIMIT_WINDOW = timedelta(minutes=1)  # Time window

# Explore rate limiting (per node_id, in-memory)
explore_last_call: Dict[str, float] = {}
EXPLORE_MIN_INTERVAL = 10  # minimum seconds between explore calls per node

# Sensitive data patterns to filter
SENSITIVE_PATTERNS = [
    r'0x[a-fA-F0-9]{64}',  # Private keys
    r'[a-zA-Z0-9]{64,}',   # Long hex strings (potential keys)
    r'sk_[a-zA-Z0-9]{32,}', # API keys
    r'pk_[a-zA-Z0-9]{32,}', # Private keys
]


# ===========================
# SECURITY UTILITIES
# ===========================

def sanitize_input(text: str) -> str:
    """
    Sanitize user input to prevent injection attacks.
    - Remove SQL injection patterns
    - Remove script tags
    - Limit length
    """
    if not text:
        return ""
    
    # Remove potential script tags
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE | re.DOTALL)
    
    # Remove SQL injection patterns
    sql_patterns = [r';\s*DROP', r';\s*DELETE', r';\s*INSERT', r'UNION\s+SELECT']
    for pattern in sql_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    
    # Limit length to prevent DoS
    max_length = 1000
    if len(text) > max_length:
        text = text[:max_length]
    
    return text.strip()

def check_rate_limit(client_ip: str) -> bool:
    """
    Check if client has exceeded rate limit.
    Returns True if allowed, False if rate limited.
    Localhost is exempt since mining node and frontend share the same IP in dev.
    """
    # Exempt localhost/loopback — mining endpoints have their own per-node rate limits
    if client_ip in ("127.0.0.1", "::1", "localhost"):
        return True

    now = datetime.now()
    
    # Clean old requests outside the window
    rate_limit_storage[client_ip] = [
        req_time for req_time in rate_limit_storage[client_ip]
        if now - req_time < RATE_LIMIT_WINDOW
    ]
    
    # Check if under limit
    if len(rate_limit_storage[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    
    # Add current request
    rate_limit_storage[client_ip].append(now)
    return True

def audit_log(event_type: str, client_ip: str, data: Dict):
    """Log security-relevant events for audit trail."""
    audit_logger.info(json.dumps({
        "timestamp": datetime.now().isoformat(),
        "event": event_type,
        "client_ip": client_ip,
        "data": data
    }))

def contains_sensitive_data(text: str) -> bool:
    """Check if text contains sensitive data patterns."""
    for pattern in SENSITIVE_PATTERNS:
        if re.search(pattern, text):
            return True
    return False

# ===========================
# WEBSOCKET MANAGER
# ===========================

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        audit_logger.info(f"New WebSocket connection. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            audit_logger.info(f"WebSocket disconnected. Active: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                audit_logger.error(f"Error broadcasting to WS: {e}")

manager = ConnectionManager()

# ===========================
# DATABASE UTILITIES
# ===========================

def get_db_connection():
    conn = sqlite3.connect('blockchain.db')
    conn.execute("PRAGMA journal_mode=WAL")
    conn.row_factory = sqlite3.Row
    return conn

# ===========================
# PYDANTIC MODELS
# ===========================

class BlockInfo(BaseModel):
    height: int
    hash: str
    validator: str
    tx_count: int
    timestamp: int
    reward: float

class TransactionInfo(BaseModel):
    hash: str
    block_height: int
    from_address: str
    to_address: Optional[str]
    value: float
    timestamp: int

class SearchQuery(BaseModel):
    query: str
    top_k: int = 3
    filter_category: Optional[str] = None
    
    @validator('query')
    def validate_query(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Query cannot be empty')
        if len(v) > 1000:
            raise ValueError('Query too long (max 1000 chars)')
        return sanitize_input(v)
    
    @validator('top_k')
    def validate_top_k(cls, v):
        if v < 1 or v > 10:
            raise ValueError('top_k must be between 1 and 10')
        return v

class SearchResult(BaseModel):
    id: str
    content: str
    metadata: Dict
    score: float

class AddDocumentRequest(BaseModel):
    content: str
    metadata: Optional[Dict] = None
    doc_id: Optional[str] = None
    
    @validator('content')
    def validate_content(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Content cannot be empty')
        if contains_sensitive_data(v):
            raise ValueError('Content contains sensitive data (private keys, etc.)')
        return sanitize_input(v)

# Update existing startup to include DB initialization if needed
@app.get("/api/health")
async def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "service": "FaucetChain Vector Knowledge API",
        "version": "1.1.0",
        "indexer_db": "active" if kb else "error"
    }

@app.post("/api/vector-search", response_model=List[SearchResult])
async def vector_search(query: SearchQuery, request: Request):
    """Semantic search endpoint with security features."""
    client_ip = request.client.host
    if not check_rate_limit(client_ip):
        audit_log("RATE_LIMIT_EXCEEDED", client_ip, {"query": query.query[:100]})
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    audit_log("SEARCH_QUERY", client_ip, {"query": query.query[:200]})
    if not kb:
        raise HTTPException(status_code=503, detail="Knowledge base not initialized")
    
    try:
        filter_metadata = {"category": query.filter_category} if query.filter_category else None
        results = kb.search(query.query, top_k=query.top_k, filter_metadata=filter_metadata)
        return results
    except Exception as e:
        audit_log("SEARCH_ERROR", client_ip, {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/add-document")
async def add_document(doc: AddDocumentRequest, request: Request):
    """Add a new document to the knowledge base."""
    if not HAS_VECTOR_DB:
        raise HTTPException(status_code=501, detail="Vector DB not available")
        
    client_ip = request.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    if not kb:
        raise HTTPException(status_code=503, detail="Knowledge base not initialized")
    
    try:
        doc_id = kb.add_document(doc.content, doc.metadata, doc.doc_id)
        return {"status": "success", "doc_id": doc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/network")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, wait for anything (we don't expect client messages)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/api/internal/notify-block")
async def notify_block(payload: dict, request: Request):
    """Internal endpoint for indexer to notify API of new blocks."""
    expected_secret = os.getenv("INTERNAL_SECRET")
    if not expected_secret:
        raise HTTPException(status_code=500, detail="Internal secret not configured")
    if request.headers.get("X-Internal-Secret") != expected_secret:
        raise HTTPException(status_code=403, detail="Unauthorized internal call")
    try:
        # Trigger broadcast to all UI clients
        await manager.broadcast({
            "type": "NEW_BLOCK",
            "data": payload
        })
        return {"status": "broadcasted"}
    except Exception as e:
        audit_log("NOTIFY_ERROR", "internal", {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

# [REMOVED] Duplicate /api/blocks endpoint — kept the version at line ~670 which uses user_claims + transactions

@app.get("/api/address/{address}/transactions", response_model=List[TransactionInfo])
def get_address_transactions(address: str, limit: int = 50):
    """Get real transaction history for an address."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        try:
            c.execute('''
                SELECT * FROM transactions 
                WHERE from_address = ? OR to_address = ? 
                ORDER BY timestamp DESC LIMIT ?
            ''', (address.strip().lower(), address.strip().lower(), limit))
            rows = c.fetchall()
        except sqlite3.OperationalError:
            rows = []
            
        conn.close()
        
        return [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class FaucetRegisterRequest(BaseModel):
    name: str
    wallet_address: str

@app.post("/api/faucethub/register")
async def register_faucet(req: FaucetRegisterRequest, request: Request):
    try:
        wallet_lower = normalize_address(req.wallet_address)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    conn = get_db_connection()
    c = conn.cursor()
    api_key = generate_api_key()
    try:
        timestamp = int(datetime.now().timestamp())
        c.execute('''
            INSERT INTO faucet_registry (name, wallet_address, registered_at)
            VALUES (?, ?, ?)
        ''', (req.name, wallet_lower, timestamp))
        c.execute('''
            INSERT INTO faucet_api_keys (faucet_wallet, api_key, created_at)
            VALUES (?, ?, ?)
        ''', (wallet_lower, api_key, timestamp))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Wallet address already registered")
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    
    conn.close()
    return {
        "status": "success",
        "message": "Faucet registered successfully",
        "api_key": api_key,
        "wallet_address": wallet_lower
    }

@app.get("/api/faucethub/faucets")
async def get_faucets():
    conn = get_db_connection()
    c = conn.cursor()
    
    try:
        c.execute("SELECT name, wallet_address, registered_at FROM faucet_registry ORDER BY registered_at DESC")
        faucets = c.fetchall()
    except sqlite3.OperationalError:
        conn.close()
        return []

    result = []
    current_time = int(datetime.now().timestamp())
    
    for row in faucets:
        wallet = row["wallet_address"]
        balance_info = await get_user_balance(wallet)
        
        c.execute("SELECT COUNT(*) FROM transactions WHERE from_address = ? AND timestamp > ?", (wallet, current_time - 3600))
        tx_count = c.fetchone()[0]
        
        # Check settlement count
        try:
            c.execute("SELECT COUNT(*), COALESCE(SUM(amount),0) FROM faucet_settlements WHERE faucet_wallet = ?", (wallet,))
            settle_row = c.fetchone()
            settle_count = settle_row[0]
            settle_volume = settle_row[1]
        except sqlite3.OperationalError:
            settle_count = 0
            settle_volume = 0.0
        
        status = "Ativa" if tx_count > 0 else "Hiato"
        
        result.append({
            "name": row["name"],
            "wallet_address": wallet,
            "liquidity": balance_info["total_claim"],
            "status": status,
            "recent_txs": tx_count,
            "settlements": settle_count,
            "volume_settled": round(settle_volume, 4),
            "registered_at": row["registered_at"]
        })
        
    conn.close()
    return result

@app.get("/api/faucethub/my-key/{wallet}")
async def get_my_api_key(wallet: str):
    """Retrieve the active API key info for a registered faucet wallet."""
    try:
        wallet_lower = normalize_address(wallet)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        SELECT api_key, created_at, is_active, last_used, total_requests, total_settled
        FROM faucet_api_keys WHERE faucet_wallet = ? AND is_active = 1
    ''', (wallet_lower,))
    row = c.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="No active API key found for this wallet")
    
    return {
        "api_key": row["api_key"],
        "created_at": row["created_at"],
        "is_active": bool(row["is_active"]),
        "last_used": row["last_used"],
        "total_requests": row["total_requests"],
        "total_settled": row["total_settled"]
    }

class RegenerateKeyRequest(BaseModel):
    wallet_address: str

@app.post("/api/faucethub/regenerate-key")
async def regenerate_api_key(req: RegenerateKeyRequest):
    """Deactivate old key and generate a new one for a registered faucet."""
    try:
        wallet_lower = normalize_address(req.wallet_address)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    conn = get_db_connection()
    c = conn.cursor()
    
    # Check faucet exists
    c.execute("SELECT id FROM faucet_registry WHERE wallet_address = ?", (wallet_lower,))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Faucet not registered")
    
    # Deactivate all old keys
    c.execute("UPDATE faucet_api_keys SET is_active = 0 WHERE faucet_wallet = ?", (wallet_lower,))
    
    # Generate new key
    new_key = generate_api_key()
    timestamp = int(datetime.now().timestamp())
    c.execute('''
        INSERT INTO faucet_api_keys (faucet_wallet, api_key, created_at)
        VALUES (?, ?, ?)
    ''', (wallet_lower, new_key, timestamp))
    conn.commit()
    conn.close()
    
    return {"status": "success", "api_key": new_key, "wallet_address": wallet_lower}

class SettlementRequest(BaseModel):
    user_wallet: str
    amount: float

@app.post("/api/faucethub/settle")
async def settle_claim(req: SettlementRequest, x_api_key: Optional[str] = Header(None)):
    """
    Core settlement endpoint. A registered Faucet uses its API key to transfer
    $CLAIM from its institutional wallet to a user's wallet on L1.
    This is the bridge between the off-chain L2 micro-claims and the on-chain L1.
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-Api-Key header")
    
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    # Authenticate via API Key
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        SELECT faucet_wallet FROM faucet_api_keys
        WHERE api_key = ? AND is_active = 1
    ''', (x_api_key,))
    key_row = c.fetchone()
    
    if not key_row:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    
    faucet_wallet = key_row["faucet_wallet"]
    
    # Validate user wallet
    try:
        user_lower = normalize_address(req.user_wallet)
    except ValueError as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Invalid user wallet: {e}")
    
    # Check faucet has sufficient balance
    balance_info = await get_user_balance(faucet_wallet)
    if balance_info["total_claim"] < req.amount:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient reserve. Faucet balance: {balance_info['total_claim']}, requested: {req.amount}"
        )
    
    # Execute L1 settlement transaction
    timestamp = int(datetime.now().timestamp())
    payload_str = f"SETTLE:{timestamp}:{faucet_wallet}:{user_lower}:{req.amount}"
    tx_hash = "0x" + keccak256(payload_str.encode()).hex()
    
    try:
        c.execute('''
            INSERT INTO transactions (hash, block_height, from_address, to_address, value, gas_price, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (tx_hash, 0, faucet_wallet, user_lower, req.amount, 0.0, timestamp))
        
        # Log settlement
        c.execute('''
            INSERT INTO faucet_settlements (faucet_wallet, user_wallet, amount, tx_hash, timestamp, api_key_used)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (faucet_wallet, user_lower, req.amount, tx_hash, timestamp, x_api_key))
        
        # Update API key stats
        c.execute('''
            UPDATE faucet_api_keys
            SET total_requests = total_requests + 1,
                total_settled = total_settled + ?,
                last_used = ?
            WHERE api_key = ?
        ''', (req.amount, timestamp, x_api_key))
        
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Settlement failed: {e}")
    
    conn.close()
    
    audit_logger.info(f"SETTLEMENT: {faucet_wallet} -> {user_lower} | {req.amount} CLAIM | tx={tx_hash}")
    
    return {
        "status": "success",
        "tx_hash": tx_hash,
        "from": faucet_wallet,
        "to": user_lower,
        "amount": req.amount,
        "timestamp": timestamp
    }

@app.get("/api/faucethub/settlements/{wallet}")
async def get_settlements(wallet: str, limit: int = 50):
    """Get settlement history for a faucet or user wallet."""
    try:
        wallet_lower = normalize_address(wallet)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute('''
            SELECT faucet_wallet, user_wallet, amount, tx_hash, timestamp
            FROM faucet_settlements
            WHERE faucet_wallet = ? OR user_wallet = ?
            ORDER BY timestamp DESC LIMIT ?
        ''', (wallet_lower, wallet_lower, limit))
        rows = c.fetchall()
    except sqlite3.OperationalError:
        rows = []
    
    conn.close()
    return [dict(row) for row in rows]

# ===========================
# LEDGER L2 MICRO-CLAIMS
# ===========================

MICROCLAIM_COOLDOWN = 300  # 5 minutes between claims
MIN_WITHDRAW_AMOUNT = 10.0  # Minimum $CLAIM to withdraw to L1

class MicroClaimRequest(BaseModel):
    user_wallet: str
    amount: float

@app.post("/api/faucethub/microclaim")
async def credit_microclaim(req: MicroClaimRequest, x_api_key: Optional[str] = Header(None)):
    """
    L2 Micro-Claim: A registered Faucet credits virtual $CLAIM to a user's
    off-chain balance. No L1 transaction occurs. Instant and gasless.
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-Api-Key header")
    
    if req.amount <= 0 or req.amount > 100:
        raise HTTPException(status_code=400, detail="Amount must be between 0 and 100")
    
    # Authenticate
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT faucet_wallet FROM faucet_api_keys WHERE api_key = ? AND is_active = 1', (x_api_key,))
    key_row = c.fetchone()
    if not key_row:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    
    faucet_wallet = key_row["faucet_wallet"]

    try:
        user_lower = normalize_address(req.user_wallet)
    except ValueError as e:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Invalid user wallet: {e}")

    try:
        result = _credit_microclaim(conn, faucet_wallet, user_lower, req.amount)
        conn.execute('''
            UPDATE faucet_api_keys SET total_requests = total_requests + 1, last_used = ?
            WHERE api_key = ?
        ''', (int(datetime.now().timestamp()), x_api_key))
        conn.commit()
    finally:
        conn.close()
    return result


def _credit_microclaim(conn, faucet_wallet: str, user_lower: str, amount: float) -> dict:
    """Credita saldo virtual L2 (cooldown por usuário e faucet). Não fecha a conexão."""
    c = conn.cursor()
    now = int(datetime.now().timestamp())

    # Check cooldown per user per faucet
    c.execute('''
        SELECT last_claim_at FROM microclaims_ledger
        WHERE faucet_wallet = ? AND user_wallet = ?
    ''', (faucet_wallet, user_lower))
    ledger_row = c.fetchone()
    
    if ledger_row and ledger_row["last_claim_at"]:
        elapsed = now - ledger_row["last_claim_at"]
        if elapsed < MICROCLAIM_COOLDOWN:
            remaining = MICROCLAIM_COOLDOWN - elapsed
            raise HTTPException(
                status_code=429,
                detail=f"Cooldown active. Wait {remaining}s before next claim."
            )

    # Upsert the ledger entry
    if ledger_row:
        c.execute('''
            UPDATE microclaims_ledger
            SET virtual_balance = virtual_balance + ?,
                total_claimed = total_claimed + ?,
                claim_count = claim_count + 1,
                last_claim_at = ?
            WHERE faucet_wallet = ? AND user_wallet = ?
        ''', (amount, amount, now, faucet_wallet, user_lower))
    else:
        c.execute('''
            INSERT INTO microclaims_ledger
            (faucet_wallet, user_wallet, virtual_balance, total_claimed, claim_count, last_claim_at, created_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
        ''', (faucet_wallet, user_lower, amount, amount, now, now))

    # Log claim event
    c.execute('''
        INSERT INTO microclaims_history (faucet_wallet, user_wallet, amount, event_type, timestamp)
        VALUES (?, ?, ?, 'CLAIM', ?)
    ''', (faucet_wallet, user_lower, amount, now))

    conn.commit()

    # Read updated balance
    c.execute('SELECT virtual_balance, total_claimed, claim_count FROM microclaims_ledger WHERE faucet_wallet = ? AND user_wallet = ?',
              (faucet_wallet, user_lower))
    updated = c.fetchone()

    return {
        "status": "success",
        "faucet": faucet_wallet,
        "user": user_lower,
        "credited": amount,
        "virtual_balance": updated["virtual_balance"],
        "total_claimed": updated["total_claimed"],
        "claim_count": updated["claim_count"],
        "next_claim_in": MICROCLAIM_COOLDOWN
    }


INTERNAL_MICROCLAIM_AMOUNT = 0.5  # $CLAIM por micro-claim da faucet interna (CyberDrip)

class InternalMicroClaimRequest(BaseModel):
    user_wallet: str
    poc_nonce: Optional[int] = None
    poc_epoch_id: Optional[int] = None
    poc_parent_hash: Optional[str] = None

@app.post("/api/faucethub/internal/microclaim")
async def internal_microclaim(req: InternalMicroClaimRequest, request: Request):
    """Micro-claim da faucet interna (CyberDrip) sem API key no navegador.

    A carteira da faucet vem do servidor (INTERNAL_FAUCET_WALLET), o valor é
    fixo e o clique precisa trazer Claim Proof, como no /api/claim.
    """
    if not check_rate_limit(request.client.host):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    faucet_wallet = (os.getenv("INTERNAL_FAUCET_WALLET") or "").strip().lower()
    if not faucet_wallet:
        raise HTTPException(status_code=503, detail="Internal faucet not configured")
    try:
        user_lower = normalize_address(req.user_wallet)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid user wallet: {e}")

    now_ts = int(datetime.now().timestamp())
    if not claim_ip_allowed(request.client.host, user_lower, now_ts):
        raise HTTPException(
            status_code=429,
            detail=f"Limite de {CLAIM_IP_HOURLY_WALLETS} carteiras por hora neste IP."
        )

    conn = get_db_connection()
    try:
        verify_claim_proof(conn.cursor(), user_lower, req.poc_epoch_id, req.poc_parent_hash,
                           req.poc_nonce, now_ts)
        result = _credit_microclaim(conn, faucet_wallet, user_lower, INTERNAL_MICROCLAIM_AMOUNT)
    finally:
        conn.close()

    await record_cyberdrip_claim(CyberDripClaimEvent(wallet=user_lower, amount=INTERNAL_MICROCLAIM_AMOUNT))
    return result

@app.get("/api/faucethub/microclaim/balance/{user_wallet}")
async def get_microclaim_balance(user_wallet: str):
    """
    Returns all virtual balances a user has across all connected Faucets.
    This is the user's "pending withdrawals" view.
    """
    try:
        user_lower = normalize_address(user_wallet)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute('''
            SELECT ml.faucet_wallet, ml.virtual_balance, ml.total_claimed,
                   ml.total_withdrawn, ml.claim_count, ml.last_claim_at,
                   fr.name as faucet_name
            FROM microclaims_ledger ml
            LEFT JOIN faucet_registry fr ON ml.faucet_wallet = fr.wallet_address
            WHERE ml.user_wallet = ? AND ml.virtual_balance > 0
            ORDER BY ml.virtual_balance DESC
        ''', (user_lower,))
        rows = c.fetchall()
    except sqlite3.OperationalError:
        rows = []
    
    result = []
    total_pending = 0.0
    for row in rows:
        balance = row["virtual_balance"]
        total_pending += balance
        result.append({
            "faucet_wallet": row["faucet_wallet"],
            "faucet_name": row["faucet_name"] or "Unknown",
            "virtual_balance": round(balance, 4),
            "total_claimed": round(row["total_claimed"], 4),
            "total_withdrawn": round(row["total_withdrawn"], 4),
            "claim_count": row["claim_count"],
            "can_withdraw": balance >= MIN_WITHDRAW_AMOUNT,
            "min_withdraw": MIN_WITHDRAW_AMOUNT
        })
    
    conn.close()
    return {
        "user": user_lower,
        "total_pending": round(total_pending, 4),
        "faucets": result
    }

class MicroClaimWithdrawRequest(BaseModel):
    user_wallet: str
    faucet_wallet: str
    signature: Optional[str] = None
    sig_timestamp: Optional[int] = None

@app.post("/api/faucethub/microclaim/withdraw")
async def withdraw_microclaim(req: MicroClaimWithdrawRequest):
    """
    L2 -> L1 Withdrawal: Converts virtual balance into a real on-chain
    settlement transaction. The faucet's institutional wallet sends $CLAIM
    to the user on Layer 1.
    """
    try:
        user_lower = normalize_address(req.user_wallet)
        faucet_lower = normalize_address(req.faucet_wallet)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Só o dono decide quando sacar (antes, qualquer um disparava o saque).
    require_action_signature(
        user_lower,
        settlement.withdraw_message(user_lower, faucet_lower, CHAIN_ID, req.sig_timestamp or 0),
        req.signature, req.sig_timestamp
    )

    conn = get_db_connection()
    c = conn.cursor()
    
    # Check virtual balance
    c.execute('''
        SELECT virtual_balance FROM microclaims_ledger
        WHERE faucet_wallet = ? AND user_wallet = ?
    ''', (faucet_lower, user_lower))
    row = c.fetchone()
    
    if not row or row["virtual_balance"] < MIN_WITHDRAW_AMOUNT:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Minimum withdrawal is {MIN_WITHDRAW_AMOUNT} CLAIM. Current balance: {row['virtual_balance'] if row else 0}"
        )
    
    withdraw_amount = row["virtual_balance"]
    
    # Check faucet has real L1 reserve
    balance_info = await get_user_balance(faucet_lower)
    if balance_info["total_claim"] < withdraw_amount:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Faucet reserve insufficient. Reserve: {balance_info['total_claim']}, needed: {withdraw_amount}"
        )
    
    # Execute L1 settlement
    timestamp = int(datetime.now().timestamp())
    payload_str = f"L2WITHDRAW:{timestamp}:{faucet_lower}:{user_lower}:{withdraw_amount}"
    tx_hash = "0x" + keccak256(payload_str.encode()).hex()
    
    try:
        # L1 transaction
        c.execute('''
            INSERT INTO transactions (hash, block_height, from_address, to_address, value, gas_price, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (tx_hash, 0, faucet_lower, user_lower, withdraw_amount, 0.0, timestamp))
        
        # Settlement log
        c.execute('''
            INSERT INTO faucet_settlements (faucet_wallet, user_wallet, amount, tx_hash, timestamp, api_key_used)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (faucet_lower, user_lower, withdraw_amount, tx_hash, timestamp, 'L2_WITHDRAW'))
        
        # Zero out virtual balance, update totals
        c.execute('''
            UPDATE microclaims_ledger
            SET virtual_balance = 0.0,
                total_withdrawn = total_withdrawn + ?
            WHERE faucet_wallet = ? AND user_wallet = ?
        ''', (withdraw_amount, faucet_lower, user_lower))
        
        # History log
        c.execute('''
            INSERT INTO microclaims_history (faucet_wallet, user_wallet, amount, event_type, tx_hash, timestamp)
            VALUES (?, ?, ?, 'WITHDRAW', ?, ?)
        ''', (faucet_lower, user_lower, withdraw_amount, tx_hash, timestamp))
        
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Withdrawal failed: {e}")
    
    conn.close()
    
    audit_logger.info(f"L2_WITHDRAW: {faucet_lower} -> {user_lower} | {withdraw_amount} CLAIM | tx={tx_hash}")
    
    return {
        "status": "success",
        "tx_hash": tx_hash,
        "from": faucet_lower,
        "to": user_lower,
        "amount": withdraw_amount,
        "timestamp": timestamp,
        "layer": "L1"
    }

@app.get("/api/faucethub/microclaim/history/{user_wallet}")
async def get_microclaim_history(user_wallet: str, limit: int = 50):
    """Get micro-claim history (claims + withdrawals) for a user."""
    try:
        user_lower = normalize_address(user_wallet)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute('''
            SELECT mh.faucet_wallet, mh.user_wallet, mh.amount, mh.event_type,
                   mh.tx_hash, mh.timestamp, fr.name as faucet_name
            FROM microclaims_history mh
            LEFT JOIN faucet_registry fr ON mh.faucet_wallet = fr.wallet_address
            WHERE mh.user_wallet = ?
            ORDER BY mh.timestamp DESC LIMIT ?
        ''', (user_lower, limit))
        rows = c.fetchall()
    except sqlite3.OperationalError:
        rows = []
    
    conn.close()
    return [dict(row) for row in rows]

@app.get("/api/faucethub/microclaim/stats")
async def get_microclaim_stats():
    """Global L2 micro-claims statistics for the FaucetHub dashboard."""
    conn = get_db_connection()
    c = conn.cursor()
    
    stats = {
        "total_users": 0,
        "total_virtual_balance": 0.0,
        "total_claimed_all_time": 0.0,
        "total_withdrawn_all_time": 0.0,
        "total_claims_count": 0
    }
    
    try:
        c.execute('SELECT COUNT(DISTINCT user_wallet) FROM microclaims_ledger')
        stats["total_users"] = c.fetchone()[0]
        
        c.execute('SELECT COALESCE(SUM(virtual_balance),0), COALESCE(SUM(total_claimed),0), COALESCE(SUM(total_withdrawn),0), COALESCE(SUM(claim_count),0) FROM microclaims_ledger')
        row = c.fetchone()
        stats["total_virtual_balance"] = round(row[0], 4)
        stats["total_claimed_all_time"] = round(row[1], 4)
        stats["total_withdrawn_all_time"] = round(row[2], 4)
        stats["total_claims_count"] = row[3]
    except sqlite3.OperationalError:
        pass
    
    conn.close()
    return stats


@app.get("/api/faucethub/microclaim/leaderboard")
async def get_microclaim_leaderboard(limit: int = 10):
    """Get L2 leaderboard (top claiming wallets) with their favorite faucets."""
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute('''
            SELECT ml.user_wallet, ml.faucet_wallet, ml.total_claimed, ml.claim_count, fr.name as faucet_name
            FROM microclaims_ledger ml
            LEFT JOIN faucet_registry fr ON ml.faucet_wallet = fr.wallet_address
            ORDER BY ml.total_claimed DESC LIMIT ?
        ''', (limit,))
        rows = c.fetchall()
    except Exception as e:
        print(f"Leaderboard query failed: {e}")
        rows = []
    conn.close()
    return [dict(row) for row in rows]


@app.get("/api/faucethub/microclaim/activity-links")
async def get_microclaim_activity_links(limit: int = 20):
    """Get recent micro-claim activities showing user wallet, amount, and faucet source."""
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute('''
            SELECT mh.faucet_wallet, mh.user_wallet, mh.amount, mh.event_type, mh.timestamp, fr.name as faucet_name
            FROM microclaims_history mh
            LEFT JOIN faucet_registry fr ON mh.faucet_wallet = fr.wallet_address
            ORDER BY mh.timestamp DESC LIMIT ?
        ''', (limit,))
        rows = c.fetchall()
    except Exception as e:
        print(f"Activity query failed: {e}")
        rows = []
    conn.close()
    return [dict(row) for row in rows]


# [REMOVED] Duplicate /api/network-metrics endpoint — kept the version at line ~710 with mining/staking data


@app.get("/api/epoch/{epoch_id}/root")
async def get_epoch_root(epoch_id: int, epoch_size: int = 128):
    """
    Retorna o Merkle root do epoch (range de blocos) baseado nos hashes dos blocos.
    leafHash = keccak(bytes32(blockHash))
    parent = keccak(left||right)
    """
    try:
        if epoch_size <= 0 or epoch_size > 4096:
            raise HTTPException(status_code=400, detail="Invalid epoch_size")

        start_height = epoch_id * epoch_size
        end_height = start_height + epoch_size - 1

        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT height, hash FROM blocks WHERE height BETWEEN ? AND ? ORDER BY height ASC", (start_height, end_height))
        rows = c.fetchall()

        if not rows:
            conn.close()
            raise HTTPException(status_code=404, detail="Epoch not found (no blocks indexed)")

        block_hashes = [row["hash"] for row in rows]
        root_hex, _, _ = compute_merkle_root_and_proof(block_hashes, 0)

        leaf_count = len(block_hashes)
        updated_at = int(datetime.now().timestamp())

        # upsert cache
        c.execute('''
            INSERT OR REPLACE INTO epoch_roots (epoch_id, epoch_size, start_height, end_height, root, leaf_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (epoch_id, epoch_size, start_height, start_height + leaf_count - 1, root_hex, leaf_count, updated_at))
        conn.commit()
        conn.close()

        return {
            "epochId": epoch_id,
            "epochSize": epoch_size,
            "startHeight": start_height,
            "endHeight": start_height + leaf_count - 1,
            "leafCount": leaf_count,
            "root": root_hex,
            "updatedAt": updated_at
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/blocks/{height}/merkle-proof")
async def get_block_merkle_proof(height: int, epoch_size: int = 128):
    """
    Retorna prova de inclusão Merkle para um bloco (leaf = blockHash) no epoch.
    O Explorer pode recomputar a raiz e comparar com a raiz ancorada on-chain (HubRegistryRoots).
    """
    try:
        if epoch_size <= 0 or epoch_size > 4096:
            raise HTTPException(status_code=400, detail="Invalid epoch_size")

        epoch_id = height // epoch_size
        start_height = epoch_id * epoch_size
        end_height = start_height + epoch_size - 1

        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT height, hash FROM blocks WHERE height BETWEEN ? AND ? ORDER BY height ASC", (start_height, end_height))
        rows = c.fetchall()
        if not rows:
            conn.close()
            raise HTTPException(status_code=404, detail="Epoch not found (no blocks indexed)")

        block_hashes = [row["hash"] for row in rows]
        # locate index by height
        index = None
        for i, row in enumerate(rows):
            if int(row["height"]) == height:
                index = i
                break
        if index is None:
            conn.close()
            raise HTTPException(status_code=404, detail="Block not found in indexed epoch")

        root_hex, siblings_hex, leaf_hash_hex = compute_merkle_root_and_proof(block_hashes, index)
        conn.close()

        return {
            "height": height,
            "blockHash": block_hashes[index],
            "epochId": epoch_id,
            "epochSize": epoch_size,
            "startHeight": start_height,
            "endHeight": start_height + len(block_hashes) - 1,
            "index": index,
            "leafHash": leaf_hash_hex,
            "root": root_hex,
            "siblings": siblings_hex
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.get("/api/user/{address}/balance")
async def get_user_balance(address: str):
    """Retorna o saldo agregado de $CLAIM para um usuário (merit faucet + mining rewards)."""
    conn = get_db_connection()
    c = conn.cursor()
    addr_lower = address.strip().lower()

    # Merit Faucet Claims
    claims_total = 0.0
    try:
        c.execute("SELECT SUM(amount) FROM user_claims WHERE user_address = ?", (addr_lower,))
        res_claims = c.fetchone()[0]
        claims_total = res_claims if res_claims else 0.0
    except sqlite3.OperationalError:
        pass

    # Mining Rewards
    mining_total = 0.0
    try:
        c.execute("SELECT SUM(reward_amount) FROM mining_rewards WHERE wallet_address = ?", (addr_lower,))
        res_mining = c.fetchone()[0]
        mining_total = res_mining if res_mining else 0.0
    except sqlite3.OperationalError:
        pass

    # Staking Yields
    # The yield_paid is already included in incoming_total when unstaking.
    yields_total = 0.0
    try:
        pass
    except sqlite3.OperationalError:
        pass

    # Incoming transfers
    # NOTA (fix B1 — dupla contagem): as txs com tx_type CLAIM/MINING_FEE são
    # apenas ESPELHOS on-chain dos mints já contabilizados em user_claims e
    # mining_rewards pelo /api/mining/explore. Excluí-las aqui evita contar
    # o mesmo valor duas vezes. Transfers, settlements, microclaims e staking
    # existem somente em 'transactions' e continuam contados normalmente.
    incoming_total = 0.0
    try:
        c.execute('''
            SELECT SUM(value) FROM transactions
            WHERE to_address = ?
              AND (tx_type IS NULL OR tx_type NOT IN ('CLAIM','MINING_FEE'))
        ''', (addr_lower,))
        res_in = c.fetchone()[0]
        incoming_total = res_in if res_in else 0.0
    except sqlite3.OperationalError:
        pass

    # Outgoing transfers (mesma exclusão dos espelhos de mint, por simetria)
    outgoing_total = 0.0
    try:
        c.execute('''
            SELECT SUM(value) FROM transactions
            WHERE from_address = ?
              AND (tx_type IS NULL OR tx_type NOT IN ('CLAIM','MINING_FEE'))
        ''', (addr_lower,))
        res_out = c.fetchone()[0]
        outgoing_total = res_out if res_out else 0.0
    except sqlite3.OperationalError:
        pass

    # Note: yields_total is kept at 0 because it's included in incoming_total
    total_claim = claims_total + mining_total + incoming_total - outgoing_total

    conn.close()
    return {
        "address": addr_lower,
        "claims_total": claims_total,
        "mining_total": mining_total,
        "yields_total": yields_total,
        "incoming_total": incoming_total,
        "outgoing_total": outgoing_total,
        "total_claim": round(total_claim, 4)
    }

class TransferRequest(BaseModel):
    sender: str
    receiver: str
    amount: float
    nonce: int
    signature: str

def normalize_address(addr: str) -> str:
    """Normalize an Ethereum address: strip whitespace, enforce 0x prefix,
    keep only hex chars after prefix, enforce 42-char length."""
    addr = addr.strip().lower()
    # Remove any whitespace embedded inside the string
    addr = ''.join(addr.split())
    # Ensure 0x prefix
    if not addr.startswith('0x'):
        addr = '0x' + addr
    # Keep only hex characters after 0x
    import re
    hex_part = re.sub(r'[^0-9a-f]', '', addr[2:])
    # Ethereum addresses are 40 hex chars (42 with 0x)
    if len(hex_part) != 40:
        raise ValueError(f"Invalid Ethereum address length after normalization: 0x{hex_part} ({len(hex_part)} hex chars, expected 40)")
    return '0x' + hex_part



@app.get("/api/user/{address}/nonce")
async def get_user_nonce(address: str):
    addr_lower = normalize_address(address)
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT nonce FROM account_nonces WHERE address = ?", (addr_lower,))
    row = c.fetchone()
    conn.close()
    return {"address": addr_lower, "nonce": row[0] if row else 0}

TREASURY_ADDRESS = "0xfaucetchaintreasury00000000000000000000"
MINER_POOL_ADDRESS = "0xminerrewardpool00000000000000000000000"

# Hard cap (fix B4): MAX_SUPPLY (constante no topo do arquivo) espelha o
# FaucetToken_CLAIM.sol. Nenhum caminho de emissão pode ultrapassá-lo.

def current_claim_reward(c) -> float:
    """Recompensa por claim, definida só pelo servidor.

    Começa em 10 $CLAIM e decai com o número de claims já explorados (mínimo 0,5).
    O valor enviado pelo cliente é ignorado: antes, qualquer amount era aceito,
    inclusive negativo ou do tamanho da quota inteira da hora.
    """
    c.execute("SELECT COUNT(*) FROM user_claims")
    total_claims = c.fetchone()[0]
    return round(max(0.5, 10.0 - math.log1p(total_claims) * 0.8), 2)


def get_total_minted(c) -> float:
    """Total de $CLAIM já emitido (equivalente ao totalSupply() on-chain).

    Mints acontecem exclusivamente em user_claims (claims explorados) e
    mining_rewards (taxas de exploração + recompensas de uptime por epoch).
    Transfers/settlements/staking apenas movem supply existente.
    """
    c.execute("SELECT COALESCE(SUM(amount), 0) FROM user_claims")
    claims = c.fetchone()[0]
    c.execute("SELECT COALESCE(SUM(reward_amount), 0) FROM mining_rewards")
    mining = c.fetchone()[0]
    return claims + mining


# ── Epoch horária (fix B5) — espelha o HourlyEpochManager.sol ────────────────
EPOCH_DURATION = 3600           # 1 hora (EPOCH_DURATION do contrato)
TOKENS_PER_HOUR = 2_000.0       # quota global de emissão/hora (TOKENS_PER_HOUR do contrato)


def get_hourly_epoch_state(c, now_ts: int = None):
    """Retorna (epoch_id, tokens_mined, is_depleted) da epoch horária corrente.

    epoch_id = hora unix (timestamp // 3600): determinístico e alinhado ao
    relógio — a troca de hora É o rollover, sem estado extra para manter.
    """
    if now_ts is None:
        now_ts = int(_time.time())
    epoch_id = now_ts // EPOCH_DURATION
    c.execute('''
        CREATE TABLE IF NOT EXISTS hourly_epochs (
            epoch_id INTEGER PRIMARY KEY,
            tokens_mined REAL NOT NULL DEFAULT 0,
            is_depleted INTEGER NOT NULL DEFAULT 0,
            started_at INTEGER
        )
    ''')
    c.execute("SELECT tokens_mined, is_depleted FROM hourly_epochs WHERE epoch_id = ?", (epoch_id,))
    row = c.fetchone()
    if row is None:
        return epoch_id, 0.0, False
    return epoch_id, row[0], bool(row[1])


def record_epoch_mint(c, epoch_id: int, amount: float):
    """Acumula a emissão na epoch corrente e declara o hiato ao esgotar a quota."""
    c.execute('''
        INSERT INTO hourly_epochs (epoch_id, tokens_mined, started_at)
        VALUES (?, ?, ?)
        ON CONFLICT(epoch_id) DO UPDATE SET tokens_mined = tokens_mined + excluded.tokens_mined
    ''', (epoch_id, amount, epoch_id * EPOCH_DURATION))
    c.execute('''
        UPDATE hourly_epochs SET is_depleted = 1
        WHERE epoch_id = ? AND tokens_mined >= ? - 1e-6
    ''', (epoch_id, TOKENS_PER_HOUR))


# ── Assinaturas de ação (fix B6) ─────────────────────────────────────────────
# Claim, stake e unstake movimentam saldo — exigem assinatura ECDSA do dono
# (EIP-191 personal_sign), como o /api/transfer já exigia. Contas demo/custodiais
# (google_/email_) não têm chave: o servidor é o custodiante e a assinatura é
# dispensada apenas para elas.
SIGNATURE_MAX_AGE = 300  # validade (s) de uma assinatura de ação


def is_custodial_address(addr: str) -> bool:
    """True for accounts this server holds the key of, so they sign nothing.

    Anything that is not an address at all answers False, not True. It used to
    answer True, which meant a caller could skip every signature check simply by
    sending something that was not an address -- and the old "Sign in with
    Google" button did exactly that by accident, minting identities like
    `google_x7f2a@faucetchain.io` in the browser. A malformed address is not a
    trusted account; it is not an account.
    """
    addr_lower = addr.strip().lower()
    if not re.fullmatch(r'0x[0-9a-fA-F]{40}', addr_lower):
        return False
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT 1 FROM users WHERE wallet_address = ?", (addr_lower,))
    row = c.fetchone()
    conn.close()
    return bool(row)


def require_action_signature(address: str, message: str, signature, sig_timestamp):
    """Demands the EIP-191 signature of the wallet that owns `address`.

    - Recovers the signer and requires it to be the address acting
    - A validity window (SIGNATURE_MAX_AGE) against a late replay
    - Dedup in used_signatures against an immediate one
    Custodial accounts pass straight through: the server holds their key.
    Raises HTTPException(401) on failure.
    """
    addr_lower = address.strip().lower()
    if is_custodial_address(addr_lower):
        return  # custodial: the server holds this account's key

    if not signature or not sig_timestamp:
        # The server cannot tell a read-only session from a wallet that simply
        # sent nothing -- both arrive as a valid address with no signature -- so
        # the message has to be useful in either case.
        raise HTTPException(
            status_code=401,
            detail=(
                "This action has to be signed by the wallet that owns the address. "
                "If you signed in by pasting an address, that session is read-only: "
                "connect the wallet itself, or sign in with email, to act."
            ),
        )

    now_ts = int(_time.time())
    if abs(now_ts - int(sig_timestamp)) > SIGNATURE_MAX_AGE:
        raise HTTPException(status_code=401, detail="That signature expired. Sign again.")

    try:
        recovered = Account.recover_message(
            encode_defunct(text=message), signature=signature
        ).lower()
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"That signature is invalid or corrupted: {e}")

    if recovered != addr_lower:
        raise HTTPException(status_code=401, detail="That signature is from a different address than the one acting.")

    sig_hash = "0x" + keccak256(signature.encode()).hex()
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute('''
            CREATE TABLE IF NOT EXISTS used_signatures (
                sig_hash TEXT PRIMARY KEY,
                used_at INTEGER NOT NULL
            )
        ''')
        c.execute("SELECT 1 FROM used_signatures WHERE sig_hash = ?", (sig_hash,))
        if c.fetchone():
            raise HTTPException(status_code=401, detail="That signature was already used.")
        c.execute("INSERT INTO used_signatures (sig_hash, used_at) VALUES (?, ?)", (sig_hash, now_ts))
        # Hygiene: rows past the window cannot be replayed any more
        c.execute("DELETE FROM used_signatures WHERE used_at < ?", (now_ts - 2 * SIGNATURE_MAX_AGE,))
        conn.commit()
    finally:
        conn.close()


# ── Proof of Claim (Fase B) ──────────────────────────────────────────────────
# O clique vira uma prova criptográfica: o browser resolve um nonce tal que
#   keccak256("FaucetChain-PoC|<chain>|<epoch>|<parent_hash>|<user>|<nonce>")
# tenha CLAIM_PROOF_DIFFICULTY_BITS bits iniciais em zero.
# Amarrado ao parent_hash (tip da cadeia) → impossível pré-computar em massa;
# custo de ~0.5-2s de CPU por claim → o "trabalho" do clique (anti-bot).
CLAIM_PROOF_DIFFICULTY_BITS = 16   # ~65k hashes em média (ajustável)
CLAIM_PROOF_MAX_EXTRA_BITS = 3     # +1 bit (o dobro de trabalho) a cada 25% da quota
POC_MESSAGE_PREFIX = "FaucetChain-PoC"

# Limite de carteiras novas por IP por hora. Medido em tests/bot_quota_attack.py:
# um núcleo resolve provas de sobra para esvaziar a quota da hora sozinho, então
# a prova, isolada, não segura um bot — ela só encarece cada clique.
# Estado em memória do processo: reiniciar o servidor zera a janela. Vira tabela
# se precisar sobreviver a restart ou rodar em mais de um processo.
CLAIM_IP_HOURLY_WALLETS = int(os.getenv("CLAIM_IP_HOURLY_WALLETS", "5"))
claim_ip_wallets = defaultdict(dict)   # ip -> {endereço: timestamp}


def current_difficulty_bits(c, now_ts: int = None) -> int:
    """Dificuldade da prova do clique, que sobe conforme a quota da hora é consumida.

    Quem chega cedo na hora paga o custo base; quem tenta varrer o resto da quota
    paga o dobro a cada degrau de 25%.
    """
    _, tokens_mined, _ = get_hourly_epoch_state(c, now_ts)
    used = (tokens_mined / TOKENS_PER_HOUR) if TOKENS_PER_HOUR else 0.0
    extra = min(CLAIM_PROOF_MAX_EXTRA_BITS, max(0, int(used * 4)))
    return CLAIM_PROOF_DIFFICULTY_BITS + extra


def claim_ip_allowed(client_ip: str, addr_lower: str, now_ts: int) -> bool:
    """False quando o IP já usou carteiras demais na última hora.

    Não impede um bot com muitos IPs, mas transforma "criar carteira" num custo.
    """
    seen = claim_ip_wallets[client_ip]
    for addr, ts in list(seen.items()):
        if now_ts - ts > 3600:
            del seen[addr]
    if addr_lower not in seen and len(seen) >= CLAIM_IP_HOURLY_WALLETS:
        return False
    seen[addr_lower] = now_ts
    return True


def get_chain_tip(c):
    """Retorna (height, hash, parent_hash) do bloco mais alto da cadeia nativa."""
    c.execute("SELECT height, hash, parent_hash FROM blocks ORDER BY height DESC LIMIT 1")
    row = c.fetchone()
    if row is None:
        return 0, "0x" + "0" * 64, "0x" + "0" * 64
    return row[0], row[1], row[2]


def poc_message(epoch_id: int, parent_hash: str, user_addr: str, nonce: int) -> str:
    return f"{POC_MESSAGE_PREFIX}|{CHAIN_ID}|{epoch_id}|{parent_hash}|{user_addr}|{nonce}"


def verify_claim_proof(c, user_addr: str, poc_epoch_id, poc_parent_hash, poc_nonce, now_ts: int):
    """Valida o Claim Proof. Lança HTTPException(400) em falha.

    - epoch do proof deve ser a hora atual (ou a anterior, tolerância de rollover)
    - parent_hash deve ser o tip atual (ou o pai do tip, tolerância de corrida
      com uma selagem que aconteceu entre o desafio e o submit)
    - keccak256 da mensagem deve ter CLAIM_PROOF_DIFFICULTY_BITS bits zero
    """
    if poc_nonce is None or poc_epoch_id is None or not poc_parent_hash:
        raise HTTPException(status_code=400, detail="Claim Proof obrigatório (Proof of Claim). Obtenha o desafio em /api/poc/challenge.")

    current_epoch = now_ts // EPOCH_DURATION
    if poc_epoch_id not in (current_epoch, current_epoch - 1):
        raise HTTPException(status_code=400, detail="Claim Proof de epoch expirada. Resolva um novo desafio.")

    tip_height, tip_hash, tip_parent = get_chain_tip(c)
    if poc_parent_hash not in (tip_hash, tip_parent):
        raise HTTPException(status_code=400, detail="Claim Proof desatualizado (a cadeia avançou). Resolva um novo desafio.")

    # 1 bit de tolerância: a dificuldade pode ter subido entre o desafio e o envio
    required_bits = max(CLAIM_PROOF_DIFFICULTY_BITS, current_difficulty_bits(c, now_ts) - 1)
    digest = keccak256(poc_message(poc_epoch_id, poc_parent_hash, user_addr, int(poc_nonce)).encode())
    if int.from_bytes(digest, 'big') >> (256 - required_bits) != 0:
        raise HTTPException(status_code=400, detail="Claim Proof inválido: dificuldade não atingida.")

    return "0x" + digest.hex()


# ── Selagem de blocos (Fase B) ───────────────────────────────────────────────
MAX_CLAIMS_PER_BLOCK = 10  # claims agrupados por bloco na selagem


def select_block_sealer(c, parent_hash: str, now_ts: int):
    """Sorteio determinístico do selador da rodada, ponderado por stake (PoS).

    - Elegíveis: mineradores online (heartbeat dentro do timeout)
    - Peso = 1 + stake ativo do wallet (staking_positions não gastas) —
      o "+1" garante chance mínima a nós sem stake
    - Seed = keccak256(parent_hash): determinístico e verificável por qualquer
      nó; muda a cada bloco selado (a rodada é o próprio tip)
    Retorna o wallet sorteado, ou None se não há mineradores online
    registrados (bootstrap: qualquer chamador pode selar).
    """
    timeout = MINING_CONFIG["heartbeat_timeout"]
    c.execute('''
        SELECT DISTINCT wallet_address FROM active_miners
        WHERE is_online = 1 AND last_heartbeat >= ?
        ORDER BY wallet_address
    ''', (now_ts - timeout,))
    miners = [r[0] for r in c.fetchall()]
    if not miners:
        return None

    weights = []
    for m in miners:
        try:
            c.execute(
                "SELECT COALESCE(SUM(deposit_amount), 0) FROM staking_positions "
                "WHERE staker_address = ? AND is_spent = 0", (m,))
            stake = c.fetchone()[0]
        except sqlite3.OperationalError:
            stake = 0.0
        weights.append(1.0 + stake)

    total = sum(weights)
    seed = int.from_bytes(keccak256(parent_hash.encode()), 'big')
    r = (seed % 10**12) / 10**12 * total
    acc = 0.0
    for m, w in zip(miners, weights):
        acc += w
        if r < acc:
            return m
    return miners[-1]

def calculate_dynamic_fee() -> float:
    """
    Calcula a taxa de transferência dinamicamente para manter o equilíbrio econômico do $CLAIM.
    Inicialmente fixada em 0.1, mas projetada para escalar inversamente ao valor da rede.
    Se a rede cresce muito/ativo valoriza, a taxa reduz. Se desvaloriza, a taxa aumenta.
    """
    base_fee = 0.1
    # Implementação futura: buscar oracle price ou metricas de TVL on-chain
    return base_fee


@app.post("/api/transfer")
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
        raise HTTPException(status_code=401, detail=f"That signature is invalid or corrupted: {e}")

    # 3. Check balance including dynamic fee
    fee = calculate_dynamic_fee()
    total_deduction = req.amount + fee
    
    balance_info = await get_user_balance(sender_lower)
    if balance_info["total_claim"] < total_deduction:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente. Necessário: {total_deduction} (inclui taxa de {fee})")

    # 4. Generate deterministic Tx Hash including Chain ID and Nonce
    tx_hash = "0x" + keccak256(payload_str.encode()).hex()
    timestamp = int(datetime.now().timestamp())

    try:
        # Transferência principal
        c.execute('''
            INSERT INTO transactions (hash, block_height, from_address, to_address, value, gas_price, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (tx_hash, 0, sender_lower, receiver_lower, req.amount, fee, timestamp))
        
        # Divisão da Taxa (50% Tesouraria, 50% Pool de Mineradores)
        half_fee = round(fee / 2, 4)
        
        c.execute('''
            INSERT INTO transactions (hash, block_height, from_address, to_address, value, gas_price, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (tx_hash + "_treasury", 0, sender_lower, TREASURY_ADDRESS, half_fee, 0, timestamp))
        
        c.execute('''
            INSERT INTO transactions (hash, block_height, from_address, to_address, value, gas_price, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (tx_hash + "_minerpool", 0, sender_lower, MINER_POOL_ADDRESS, half_fee, 0, timestamp))
        
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
    await manager.broadcast({"type": "TRANSFER_EXECUTED", "data": {"from": sender_lower[:10] + "...", "to": receiver_lower[:10] + "...", "amount": req.amount, "timestamp": timestamp}})

    return {"status": "success", "tx_hash": tx_hash}

# ===========================
# FASE C — VERIFICABILIDADE EXTERNA
# ===========================

@app.get("/api/chain/export")
async def export_chain():
    """Exporta a cadeia nativa completa para auditoria independente.

    Qualquer pessoa pode baixar este dump e verificar com verify_chain.py:
    encadeamento de hashes, Merkle roots dos blocos, hard cap, quota horária
    e assinaturas do notário — sem confiar no servidor.
    """
    conn = get_db_connection()
    c = conn.cursor()

    def rows(query, params=()):
        c.execute(query, params)
        return [dict(r) for r in c.fetchall()]

    export = {
        "meta": {
            "chainId": CHAIN_ID,
            "maxSupply": MAX_SUPPLY,
            "tokensPerHour": TOKENS_PER_HOUR,
            "epochDuration": EPOCH_DURATION,
            "claimProofDifficultyBits": CLAIM_PROOF_DIFFICULTY_BITS,
            "exportedAt": int(datetime.now().timestamp()),
        },
        "blocks": rows("SELECT * FROM blocks ORDER BY height"),
        "transactions": rows("SELECT * FROM transactions ORDER BY timestamp"),
        "user_claims": rows("SELECT * FROM user_claims ORDER BY timestamp"),
        "mining_rewards": rows("SELECT epoch_id, wallet_address, reward_amount, distributed_at FROM mining_rewards ORDER BY distributed_at"),
        "hourly_epochs": rows("SELECT * FROM hourly_epochs ORDER BY epoch_id") if _table_exists(c, "hourly_epochs") else [],
        "epoch_roots": rows("SELECT * FROM epoch_roots ORDER BY epoch_id") if _table_exists(c, "epoch_roots") else [],
    }
    conn.close()
    export["meta"]["tipHeight"] = export["blocks"][-1]["height"] if export["blocks"] else -1
    return export


def _table_exists(c, name: str) -> bool:
    c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,))
    return c.fetchone() is not None


@app.get("/api/anchor/roots")
async def get_anchor_roots():
    """Roots de epoch notarizados (assinados pelo notário; ancorados on-chain
    quando configurado). Verificáveis por terceiros via assinatura EIP-191 da
    mensagem canônica FaucetChain-EpochRoot|chain|epoch|start|end|leaves|root."""
    conn = get_db_connection()
    c = conn.cursor()
    if not _table_exists(c, "epoch_roots"):
        conn.close()
        return {"roots": []}
    try:
        c.execute('''
            SELECT epoch_id, epoch_size, start_height, end_height, root, leaf_count,
                   updated_at, signature, signer, anchor_tx
            FROM epoch_roots ORDER BY epoch_id
        ''')
        roots = [dict(r) for r in c.fetchall()]
    except sqlite3.OperationalError:
        # colunas de notarização ainda não criadas (anchor_service nunca rodou)
        c.execute("SELECT epoch_id, epoch_size, start_height, end_height, root, leaf_count, updated_at FROM epoch_roots ORDER BY epoch_id")
        roots = [dict(r) for r in c.fetchall()]
    conn.close()
    return {
        "messageTemplate": f"FaucetChain-EpochRoot|{CHAIN_ID}|<epochId>|<startHeight>|<endHeight>|<leafCount>|<root>",
        "roots": roots
    }


@app.get("/api/faucethub/proof-of-reserve")
async def proof_of_reserve():
    """Proof of Reserve REAL (Fase C): para cada faucet registrada, confronta
    a reserva no ledger canônico com as obrigações pendentes (virtual_balance
    dos micro-claims ainda não sacados). Solvente = reserva >= obrigações."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT name, wallet_address FROM faucet_registry")
    faucets = [dict(r) for r in c.fetchall()]
    conn.close()

    report = []
    total_reserves = 0.0
    total_obligations = 0.0
    for f in faucets:
        wallet = f["wallet_address"].strip().lower()
        balance_info = await get_user_balance(wallet)
        reserve = balance_info["total_claim"]

        conn = get_db_connection()
        c = conn.cursor()
        c.execute(
            "SELECT COALESCE(SUM(virtual_balance), 0) FROM microclaims_ledger WHERE faucet_wallet = ?",
            (wallet,))
        obligations = c.fetchone()[0]
        conn.close()

        ratio = (reserve / obligations) if obligations > 0 else None
        total_reserves += reserve
        total_obligations += obligations
        report.append({
            "name": f["name"],
            "wallet": wallet,
            "reserve": round(reserve, 6),
            "obligations": round(obligations, 6),
            "coverageRatio": round(ratio, 4) if ratio is not None else None,
            "solvent": reserve + 1e-9 >= obligations,
        })

    return {
        "generatedAt": int(datetime.now().timestamp()),
        "totalReserves": round(total_reserves, 6),
        "totalObligations": round(total_obligations, 6),
        "systemSolvent": all(f["solvent"] for f in report) if report else True,
        "faucets": report,
    }


# ===========================
# NETWORK BLOCKS & METRICS (required by frontend NetworkContext)
# ===========================

@app.get("/api/blocks")
async def get_blocks(limit: int = 20):
    """Return recent forged blocks."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT height, hash, validator, tx_count, timestamp, reward FROM blocks ORDER BY height DESC LIMIT ?", (limit,))
    blocks = [dict(r) for r in c.fetchall()]
    conn.close()
    
    # Format for UI
    result = []
    for b in blocks:
        result.append({
            "height": b["height"],
            "hash": b["hash"],
            "validator": b["validator"][:16] + "..." if b["validator"] else "Genesis",
            "txs": b["tx_count"],
            "timestamp": b["timestamp"] * 1000,
            "reward": b["reward"]
        })
    return result

@app.get("/api/tx/{tx_hash}")
async def get_transaction(tx_hash: str):
    """Return transaction details from unified ledger."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        SELECT t.hash, t.block_height, t.from_address, t.to_address, t.value, t.timestamp, t.tx_type, t.source_platform, b.hash as block_hash, b.validator
        FROM transactions t
        LEFT JOIN blocks b ON t.block_height = b.height
        WHERE t.hash = ?
    ''', (tx_hash,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Transação não encontrada ou ainda pendente.")
    return dict(row)


@app.get("/api/network-metrics")
async def get_network_metrics():
    """Return network metrics for the frontend dashboard."""
    conn = get_db_connection()
    c = conn.cursor()

    # Block height = total claims (each claim mines a block)
    c.execute("SELECT COUNT(*) FROM user_claims")
    total_claims = c.fetchone()[0]

    # Also count transactions
    total_txs = 0
    try:
        c.execute("SELECT COUNT(*) FROM transactions")
        total_txs = c.fetchone()[0]
    except Exception:
        pass

    block_height = max(1, total_claims + total_txs)

    current_reward = current_claim_reward(c)

    # Mining nodes online
    nodes_online = 0
    try:
        c.execute("SELECT COUNT(*) FROM active_miners WHERE is_online = 1")
        nodes_online = c.fetchone()[0]
    except Exception:
        pass

    # Total staked
    total_staked = 0
    try:
        c.execute("SELECT SUM(deposit_amount) FROM staking_positions WHERE is_spent = 0")
        res = c.fetchone()[0]
        total_staked = res if res else 0
    except Exception:
        pass

    conn.close()

    return {
        "blockHeight": block_height,
        "activeValidators": max(1, nodes_online),
        "totalStaked": total_staked,
        "tps": round(total_claims / max(1, (block_height * 30)) * 100, 2),
        "avgGasPrice": 0,
        "networkHashrate": block_height * 12.5,
        "totalTransactions": total_claims + total_txs,
        "activeConnections": nodes_online + 1,
        "nodeCount": nodes_online + 1,
        "avgBlockFinalizationTime": 1.2,
        "currentReward": current_reward
    }


# ===========================
# FAUCETCHAIN L1 V3 MOCK STATE
# ===========================
STAKED_DAPPS = [
    {"name": "Merit Faucet L1", "staked": 100000},
    {"name": "CryptoDrop L2", "staked": 25000}
]

@app.get("/api/epoch/status")
async def get_epoch_status():
    """Estado REAL da epoch horária (fix B5) — antes era um mock estático.

    Mantém o campo `isActive` consumido pelo frontend (Faucet, NetworkStatus,
    BlockViewer) e expõe os dados reais da quota/hiato.
    """
    conn = get_db_connection()
    c = conn.cursor()
    now_ts = int(datetime.now().timestamp())
    epoch_id, tokens_mined, is_depleted = get_hourly_epoch_state(c, now_ts)
    conn.commit()  # persiste o CREATE TABLE lazy, se ocorreu
    conn.close()
    return {
        "isActive": not is_depleted,
        "epochId": epoch_id,
        "currentQuota": TOKENS_PER_HOUR,
        "claimed": round(tokens_mined, 6),
        "remaining": round(max(0.0, TOKENS_PER_HOUR - tokens_mined), 6),
        "isDepleted": is_depleted,
        "timeRemaining": (epoch_id + 1) * EPOCH_DURATION - now_ts
    }

@app.get("/api/vault/yield")
async def get_vault_yield():
    try:
        treasury_info = await get_user_balance(TREASURY_ADDRESS)
        circulating = await get_total_circulating_supply()
        
        conn = get_db_connection()
        c = conn.cursor()
        
        # Calculate Total Staked
        total_staked = 0
        try:
            c.execute("SELECT SUM(deposit_amount) FROM staking_positions WHERE is_spent = 0")
            res = c.fetchone()[0]
            total_staked = res if res else 0
        except Exception:
            pass
            
        # Calculate Total Burned (Using Miner Pool as proxy for deflationary mechanics)
        miner_info = await get_user_balance(MINER_POOL_ADDRESS)
        total_burned = miner_info["total_claim"]
        
        conn.close()
        
        # Calculate dynamic APY
        apy = 14.5
        if total_staked > 0:
            apy = min(45.0, max(5.0, (100000 / total_staked) * 10))

        return {
            "totalExternalValue": treasury_info["total_claim"],
            "yieldGenerated": treasury_info["incoming_total"],
            "circulatingSupply": circulating,
            "totalBurned": total_burned,
            "stakingApy": round(apy, 1),
            "assets": [
                {"symbol": "TREASURY_CLAIM", "amount": treasury_info["total_claim"]}
            ]
        }
    except Exception as e:
        print(f"Vault yield error: {e}")
        return {
            "totalExternalValue": 0,
            "yieldGenerated": 0,
            "circulatingSupply": 0,
            "totalBurned": 0,
            "stakingApy": 14.5,
            "assets": []
        }

@app.get("/api/tokenomics/distribution")
async def get_tokenomics_distribution():
    conn = get_db_connection()
    c = conn.cursor()
    
    # PoC Extracted
    c.execute("SELECT SUM(amount) FROM user_claims")
    res = c.fetchone()
    poc_extracted = res[0] if res and res[0] else 0.0
    
    # PoW + PoS Extracted
    c.execute("SELECT SUM(reward_amount) FROM mining_rewards")
    res = c.fetchone()
    node_extracted = res[0] if res and res[0] else 0.0
    
    conn.close()
    
    treasury_info = await get_user_balance(TREASURY_ADDRESS)
    treasury_extracted = treasury_info["total_claim"]
    
    return {
        "poc": {
            "extracted": poc_extracted,
            "limit": 19800000,
            "label": "Proof of Claim (PoC)"
        },
        "mining": {
            "extracted": node_extracted,
            "limit": 59400000,
            "label": "Node Rewards (PoW + PoS)"
        },
        "treasury": {
            "extracted": treasury_extracted,
            "limit": 19800000,
            "label": "Ecosystem Treasury"
        }
    }

@app.get("/api/faucets/staked")
async def get_staked_dapps():
    return {"dapps": STAKED_DAPPS}

class ClaimRequest(BaseModel):
    user_address: str
    amount: Optional[float] = None  # ignorado: o valor vem de current_claim_reward()
    block_height: int
    tx_hash: str
    source_platform: Optional[str] = 'WEB3'
    # fix B6: assinatura da ação (obrigatória para carteiras Web3)
    signature: Optional[str] = None
    sig_timestamp: Optional[int] = None
    # Fase B: Claim Proof (Proof of Claim) — obrigatório para todos
    poc_nonce: Optional[int] = None
    poc_epoch_id: Optional[int] = None
    poc_parent_hash: Optional[str] = None


@app.get("/api/poc/challenge")
async def get_poc_challenge():
    """Desafio do Proof of Claim: o browser resolve um nonce tal que
    keccak256(POC_MESSAGE) tenha `difficultyBits` bits iniciais em zero."""
    conn = get_db_connection()
    c = conn.cursor()
    now_ts = int(datetime.now().timestamp())
    tip_height, tip_hash, _ = get_chain_tip(c)
    bits = current_difficulty_bits(c, now_ts)
    conn.commit()  # persiste o CREATE TABLE lazy da epoch horária, se ocorreu
    conn.close()
    return {
        "chainId": CHAIN_ID,
        "epochId": now_ts // EPOCH_DURATION,
        "parentHash": tip_hash,
        "tipHeight": tip_height,
        "difficultyBits": bits,
        "messageTemplate": f"{POC_MESSAGE_PREFIX}|{CHAIN_ID}|<epochId>|<parentHash>|<userAddress>|<nonce>"
    }


async def get_total_circulating_supply():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT SUM(amount) FROM user_claims")
    claims = c.fetchone()[0] or 0.0
    c.execute("SELECT SUM(reward_amount) FROM mining_rewards")
    mining = c.fetchone()[0] or 0.0
    conn.close()
    return claims + mining

@app.post("/api/claim")
async def submit_claim(req: ClaimRequest, request: Request):
    client_ip = request.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    addr_lower = req.user_address.strip().lower()

    # ── Autenticação da ação (fix B6) ──
    # A mensagem assinada é a mesma que o Faucet.tsx constrói no clique.
    require_action_signature(
        addr_lower,
        settlement.claim_message(addr_lower, CHAIN_ID, req.sig_timestamp or 0),
        req.signature, req.sig_timestamp
    )

    conn = get_db_connection()
    c = conn.cursor()

    # ── Proof of Claim (Fase B): o clique tem que vir com trabalho provado ──
    # Vale para TODAS as contas (inclusive demo): é anti-bot, não identidade.
    try:
        poc_hash = verify_claim_proof(
            c, addr_lower, req.poc_epoch_id, req.poc_parent_hash,
            req.poc_nonce, int(datetime.now().timestamp())
        )
    except HTTPException:
        conn.close()
        raise

    # Fazenda de carteiras: a prova encarece o clique, mas não impede criar
    # endereços novos. O teto por IP é a segunda camada (tests/bot_quota_attack.py).
    if not claim_ip_allowed(client_ip, addr_lower, int(datetime.now().timestamp())):
        conn.close()
        audit_log("IP_WALLET_CAP", client_ip, {"address": addr_lower, "cap": CLAIM_IP_HOURLY_WALLETS})
        raise HTTPException(
            status_code=429,
            detail=f"Limite de {CLAIM_IP_HOURLY_WALLETS} carteiras por hora neste IP."
        )

    # Cooldown check
    c.execute('''
        SELECT MAX(timestamp) FROM (
            SELECT timestamp FROM user_claims WHERE user_address = ?
            UNION ALL
            SELECT timestamp FROM pending_claims WHERE user_address = ?
        )
    ''', (addr_lower, addr_lower))
    row = c.fetchone()
    last_claim_ts = row[0] if row else None
    
    current_ts = int(datetime.now().timestamp())
    
    if last_claim_ts is not None and current_ts - last_claim_ts < 3600:
        conn.close()
        raise HTTPException(status_code=429, detail="Cooldown de 1 hora ativo para esta carteira.")

    # Fraud detection: check recent claim patterns
    if HAS_FRAUD_DETECTOR and _fraud_detector:
        c.execute("SELECT amount, timestamp FROM user_claims WHERE user_address = ? ORDER BY timestamp DESC LIMIT 20", (addr_lower,))
        recent_claims = [{"amount": r[0], "timestamp": r[1], "gasPrice": 0} for r in c.fetchall()]
        if len(recent_claims) >= 3 and _fraud_detector.is_sybil_pattern(recent_claims):
            conn.close()
            audit_log("FRAUD_DETECTED", client_ip, {"address": addr_lower, "pattern": "sybil"})
            raise HTTPException(status_code=403, detail="Atividade suspeita detectada. Claim bloqueado pelo Sentinel.")

    amount = current_claim_reward(c)
    c.execute('''
        INSERT INTO pending_claims (user_address, amount, timestamp, tx_hash, block_height, status, source_platform, poc_nonce, poc_hash)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    ''', (addr_lower, amount, current_ts, req.tx_hash, req.block_height, req.source_platform, req.poc_nonce, poc_hash))
    conn.commit()
    conn.close()

    audit_log("CLAIM_SUBMITTED", client_ip, {"address": addr_lower, "amount": amount, "tx_hash": req.tx_hash})
    await manager.broadcast({"type": "CLAIM_SUBMITTED", "data": {"address": addr_lower[:10] + "...", "amount": amount, "timestamp": current_ts}})
    return {"status": "pending", "tx_hash": req.tx_hash, "amount": amount, "timestamp": current_ts}

@app.get("/api/claim/status/{tx_hash}")
async def get_claim_status(tx_hash: str):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT status FROM pending_claims WHERE tx_hash = ?", (tx_hash,))
    row = c.fetchone()
    if row:
        status = row[0]
        conn.close()
        return {"tx_hash": tx_hash, "status": status}
    
    # Check if confirmed
    c.execute("SELECT 1 FROM user_claims WHERE tx_hash = ?", (tx_hash,))
    row = c.fetchone()
    conn.close()
    if row:
         return {"tx_hash": tx_hash, "status": "confirmed"}
         
    raise HTTPException(status_code=404, detail="Claim not found")

class ExploreRequest(BaseModel):
    miner_address: str
    node_id: str = None

@app.post("/api/mining/explore")
async def mining_explore(req: ExploreRequest, request: Request):
    """
    Miner exploring the network. Grabs 1 pending claim to validate.
    If no pending claims, returns immediately (uptime rewarded by epoch scheduler).
    """
    node_id = req.node_id or 'unknown'
    now_ts = _time.time()

    # Rate limit per node_id
    last_call = explore_last_call.get(node_id, 0)
    if now_ts - last_call < EXPLORE_MIN_INTERVAL:
        raise HTTPException(status_code=429, detail=f"Explore rate limited. Wait {EXPLORE_MIN_INTERVAL}s between calls.")
    explore_last_call[node_id] = now_ts

    conn = get_db_connection()
    c = conn.cursor()
    miner_addr = req.miner_address.strip().lower()
    current_ts = int(datetime.now().timestamp())
    
    c.execute("SELECT * FROM pending_claims WHERE status = 'pending' ORDER BY timestamp ASC LIMIT ?", (MAX_CLAIMS_PER_BLOCK,))
    pendings = [dict(r) for r in c.fetchall()]

    if pendings:
        try:
            # ── Sorteio do selador (Fase B-3): PoS ponderado por stake ──
            # A rodada é o tip atual; a semente (keccak do parent_hash) é
            # determinística e verificável. Se o chamador não é o sorteado,
            # não sela nada nesta rodada.
            tip_height, tip_hash, _tip_parent = get_chain_tip(c)
            sealer = select_block_sealer(c, tip_hash, current_ts)
            if sealer is not None and sealer != miner_addr:
                conn.close()
                return {
                    "explored": False,
                    "miner_fee": 0,
                    "sealer": sealer,
                    "message": f"Rodada do selador {sealer[:10]}... (sorteio ponderado por stake). Aguarde a proxima rodada."
                }

            # ── Seleção FIFO dos claims que entram no bloco ──
            # Por claim: hard cap (B4) rejeita permanentemente; quota horária
            # (B5) interrompe a seleção (hiato) preservando a ordem FIFO.
            total_minted = get_total_minted(c)
            epoch_id_hr, tokens_mined_hr, depleted_hr = get_hourly_epoch_state(c, current_ts)

            accepted = []
            accepted_sum = 0.0
            quota_blocked = False
            for p in pendings:
                if total_minted + accepted_sum + p['amount'] > MAX_SUPPLY:
                    c.execute("UPDATE pending_claims SET status = 'rejected_max_supply' WHERE id = ?", (p['id'],))
                    audit_log("MAX_SUPPLY_REACHED", request.client.host, {
                        "claim_tx": p['tx_hash'], "amount": p['amount'],
                        "total_minted": total_minted + accepted_sum, "max_supply": MAX_SUPPLY
                    })
                    continue
                if depleted_hr or tokens_mined_hr + accepted_sum + p['amount'] > TOKENS_PER_HOUR + 1e-6:
                    quota_blocked = True
                    break  # FIFO: não pula claims; o restante espera a próxima hora
                accepted.append(p)
                accepted_sum += p['amount']

            if not accepted:
                if quota_blocked:
                    # HIATO (fix B5): nada mintado, claims continuam pendentes
                    if not depleted_hr:
                        c.execute("UPDATE hourly_epochs SET is_depleted = 1 WHERE epoch_id = ?", (epoch_id_hr,))
                        audit_log("EPOCH_DEPLETED", request.client.host, {
                            "epoch_id": epoch_id_hr, "tokens_mined": tokens_mined_hr,
                            "quota": TOKENS_PER_HOUR
                        })
                        await manager.broadcast({"type": "EPOCH_DEPLETED", "data": {
                            "epochId": epoch_id_hr, "claimed": round(tokens_mined_hr, 4)
                        }})
                    conn.commit()
                    conn.close()
                    next_epoch_in = (epoch_id_hr + 1) * EPOCH_DURATION - current_ts
                    return {
                        "explored": False,
                        "miner_fee": 0,
                        "message": (
                            f"Bloco horario esgotado ({tokens_mined_hr:.2f}/{TOKENS_PER_HOUR:.0f} $CLAIM). "
                            f"Hiato ativo — proxima epoch em {next_epoch_in}s."
                        )
                    }
                # todos rejeitados pelo hard cap
                conn.commit()
                conn.close()
                return {
                    "explored": False,
                    "miner_fee": 0,
                    "message": f"Max supply de {MAX_SUPPLY:,.0f} $CLAIM atingido. Claims rejeitados."
                }

            # ── Selagem do bloco (Fase B-2): header com Merkle root dos claims ──
            import hashlib

            new_block_height = tip_height + 1
            parent_hash = tip_hash
            merkle_root = claims_merkle_root([p['tx_hash'] for p in accepted])

            block_data = f"{new_block_height}{parent_hash}{miner_addr}{current_ts}{merkle_root}".encode()
            block_hash = "0x" + hashlib.sha256(block_data).hexdigest()

            total_miner_fee = 0.0

            c.execute('''
                INSERT INTO blocks (height, hash, parent_hash, validator, tx_count, timestamp, gas_used, gas_limit, reward, merkle_root)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (new_block_height, block_hash, parent_hash, miner_addr, 2 * len(accepted),
                  current_ts, 21000 * len(accepted), 30000000, 0.0, merkle_root))

            # Sequential epoch_id (um por bloco selado)
            c.execute("SELECT COALESCE(MAX(epoch_id), 0) + 1 FROM mining_rewards")
            epoch_id = c.fetchone()[0]

            for p in accepted:
                # Split reward: 80% to user, 20% to miner
                user_reward = p['amount'] * 0.80
                miner_fee = p['amount'] * 0.20
                total_miner_fee += miner_fee

                c.execute('''
                    INSERT INTO user_claims (user_address, amount, timestamp, tx_hash, block_height, source_platform)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (p['user_address'], user_reward, current_ts, p['tx_hash'], new_block_height, p.get('source_platform', 'WEB3')))

                c.execute('''
                    INSERT INTO transactions (hash, block_height, from_address, to_address, value, gas_price, timestamp, tx_type, source_platform)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (p['tx_hash'], new_block_height, '0x0000000000000000000000000000000000000000', p['user_address'], user_reward, 0, current_ts, 'CLAIM', p.get('source_platform', 'WEB3')))

                c.execute('''
                    INSERT INTO mining_rewards (epoch_id, wallet_address, node_id, reward_amount, uptime_share, distributed_at)
                    VALUES (?, ?, ?, ?, 0.0, ?)
                ''', (epoch_id, miner_addr, node_id, miner_fee, current_ts))

                miner_tx_hash = "0x" + hashlib.sha256(f"{p['tx_hash']}_miner_{miner_addr}".encode()).hexdigest()
                c.execute('''
                    INSERT INTO transactions (hash, block_height, from_address, to_address, value, gas_price, timestamp, tx_type, source_platform)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (miner_tx_hash, new_block_height, '0x0000000000000000000000000000000000000000', miner_addr, miner_fee, 0, current_ts, 'MINING_FEE', 'WEB3'))

                c.execute("DELETE FROM pending_claims WHERE id = ?", (p['id'],))

            # Recompensa do bloco = soma das taxas do selador
            c.execute("UPDATE blocks SET reward = ? WHERE height = ?", (total_miner_fee, new_block_height))
            c.execute("UPDATE active_miners SET total_earned = total_earned + ? WHERE node_id = ?", (total_miner_fee, node_id))

            # Contabiliza a emissão na quota da epoch horária (fix B5)
            record_epoch_mint(c, epoch_id_hr, accepted_sum)

            conn.commit()
            conn.close()
            audit_log("BLOCK_SEALED", request.client.host, {
                "miner": miner_addr, "height": new_block_height, "claims": len(accepted),
                "merkle_root": merkle_root, "total_fee": total_miner_fee
            })
            await manager.broadcast({"type": "BLOCK_MINED", "data": {
                "height": new_block_height, "miner": miner_addr[:10] + "...",
                "fee": total_miner_fee, "claims": len(accepted),
                "merkleRoot": merkle_root, "timestamp": current_ts
            }})
            return {
                "explored": True,
                "block_height": new_block_height,
                "merkle_root": merkle_root,
                "claims_processed": [p['tx_hash'] for p in accepted],
                "claim_processed": accepted[0]['tx_hash'],  # compat com clientes antigos
                "miner_fee": total_miner_fee,
                "message": f"Bloco #{new_block_height} selado com {len(accepted)} claim(s)."
            }
        except Exception as e:
            conn.close()
            raise HTTPException(status_code=400, detail=str(e))
    else:
        # No pending claims — uptime is rewarded by epoch scheduler, not here
        conn.close()
        return {
            "explored": False,
            "miner_fee": 0,
            "message": "No pending claims. Uptime tracked via heartbeat."
        }

@app.get("/api/user/{address}/claims")
def get_user_claims(address: str):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT * FROM user_claims WHERE user_address = ? ORDER BY timestamp DESC", (address.strip().lower(),))
        rows = c.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================
# UTXO STAKING VAULT (Mock)
# ===========================

TIER_CONFIG = {
    0: {"duration_seconds": 3600,    "yield_bp": 50,   "label": "1 Hora"},
    1: {"duration_seconds": 86400,   "yield_bp": 200,  "label": "24 Horas"},
    2: {"duration_seconds": 604800,  "yield_bp": 1000, "label": "7 Dias"},
}

def init_staking_positions_table():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS staking_positions (
            token_id INTEGER PRIMARY KEY AUTOINCREMENT,
            staker_address TEXT NOT NULL,
            deposit_amount REAL NOT NULL,
            deposit_timestamp INTEGER NOT NULL,
            lock_duration INTEGER NOT NULL,
            yield_basis_points INTEGER NOT NULL,
            tier INTEGER NOT NULL,
            is_spent INTEGER DEFAULT 0,
            spent_timestamp INTEGER DEFAULT NULL,
            yield_paid REAL DEFAULT 0
        )
    ''')
    conn.commit()
    conn.close()

# Ensure table is created on startup
@app.on_event("startup")
async def startup_staking():
    try:
        init_staking_positions_table()
    except Exception as e:
        print(f"⚠️ Failed to init staking_positions table: {e}")

class StakeRequest(BaseModel):
    staker_address: str
    amount: float
    tier: int
    # fix B6: assinatura da ação (obrigatória para carteiras Web3)
    signature: Optional[str] = None
    sig_timestamp: Optional[int] = None

class UnstakeRequest(BaseModel):
    staker_address: str
    token_id: int
    # fix B6: assinatura da ação (obrigatória para carteiras Web3)
    signature: Optional[str] = None
    sig_timestamp: Optional[int] = None

@app.get("/api/staking/positions/{address}")
async def get_staking_positions(address: str):
    """Get all UTXO staking positions for a user."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute(
            "SELECT * FROM staking_positions WHERE staker_address = ? ORDER BY deposit_timestamp DESC",
            (address.strip().lower(),)
        )
        rows = c.fetchall()
        conn.close()

        import time as _time
        now = int(_time.time())
        positions = []
        for row in rows:
            r = dict(row)
            unlock_time = r["deposit_timestamp"] + r["lock_duration"]
            r["unlock_time"] = unlock_time
            r["is_unlocked"] = now >= unlock_time
            r["estimated_yield"] = round(r["deposit_amount"] * r["yield_basis_points"] / 10000, 4)
            r["time_remaining"] = max(0, unlock_time - now)
            r["progress_pct"] = min(100, round((now - r["deposit_timestamp"]) / max(1, r["lock_duration"]) * 100, 1))
            positions.append(r)
        return positions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/staking/stake")
async def create_stake(req: StakeRequest, request: Request):
    """Create a new UTXO staking position.

    CRITICAL: This operation MUST debit the staker's balance atomically.
    Failure to do so allows infinite staking without consuming $CLAIM,
    which would break the consensus economy and the total supply integrity.
    """
    client_ip = request.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    if req.tier not in TIER_CONFIG:
        raise HTTPException(status_code=400, detail="Tier inválido. Use 0, 1 ou 2.")
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount deve ser > 0")

    staker_lower = req.staker_address.strip().lower()

    # ── STEP 0: Autenticação da ação (fix B6) ──────────────────────────────
    # Mensagem canônica: amount com 6 casas (toFixed(6) no frontend).
    require_action_signature(
        staker_lower,
        settlement.stake_message(staker_lower, req.amount, req.tier, CHAIN_ID, req.sig_timestamp or 0),
        req.signature, req.sig_timestamp
    )

    # ── STEP 1: Verify the user has sufficient balance BEFORE staking ──────
    balance_info = await get_user_balance(staker_lower)
    available = balance_info["total_claim"]
    if available < req.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo insuficiente. Disponível: {available:.4f} $CLAIM, solicitado: {req.amount:.4f} $CLAIM."
        )

    tier = TIER_CONFIG[req.tier]
    current_ts = int(datetime.now().timestamp())

    # ── STEP 2: Atomically debit balance + create staking position ─────────
    conn = get_db_connection()
    c = conn.cursor()
    try:
        # Debit: record as an outgoing transaction from staker to a
        # virtual "STAKING_VAULT" address so the balance formula
        # (claims + mining + yield + incoming - outgoing) reflects the lock.
        VAULT_ADDRESS = "0x537461b696e675661756c740000000000000000"
        stake_tx_hash = "0x" + keccak256(
            (staker_lower + "stake" + str(req.amount) + str(current_ts)).encode()
        ).hex()

        c.execute('''
            INSERT INTO transactions
                (hash, block_height, from_address, to_address, value, gas_price, timestamp)
            VALUES (?, 0, ?, ?, ?, 0, ?)
        ''', (stake_tx_hash, staker_lower, VAULT_ADDRESS, req.amount, current_ts))

        # Create the staking UTXO position
        c.execute('''
            INSERT INTO staking_positions
                (staker_address, deposit_amount, deposit_timestamp, lock_duration,
                 yield_basis_points, tier)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            staker_lower,
            req.amount,
            current_ts,
            tier["duration_seconds"],
            tier["yield_bp"],
            req.tier
        ))
        token_id = c.lastrowid
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Erro ao criar stake: {e}")
    finally:
        conn.close()

    audit_log("STAKE_CREATED", client_ip, {
        "address": staker_lower, "amount": req.amount,
        "tier": req.tier, "token_id": token_id,
        "tx_hash": stake_tx_hash, "balance_before": available
    })
    await manager.broadcast({"type": "STAKE_ACTION", "data": {"action": "stake", "address": staker_lower[:10] + "...", "amount": req.amount, "tier": req.tier, "timestamp": current_ts}})
    return {
        "status": "success",
        "token_id": token_id,
        "tier_label": tier["label"],
        "unlock_time": current_ts + tier["duration_seconds"],
        "estimated_yield": round(req.amount * tier["yield_bp"] / 10000, 4),
        "balance_debited": req.amount,
        "tx_hash": stake_tx_hash
    }


@app.post("/api/staking/unstake")
async def unstake_position(req: UnstakeRequest):
    """Spend (burn) a UTXO staking position and credit principal + yield back.

    CRITICAL: After spending the UTXO, the principal AND yield MUST be credited
    back as an incoming transfer so the user's balance is restored correctly.
    Without this, tokens would be permanently lost on unstake.
    """
    staker_lower = req.staker_address.strip().lower()

    # ── Autenticação da ação (fix B6) ──
    require_action_signature(
        staker_lower,
        settlement.unstake_message(staker_lower, req.token_id, CHAIN_ID, req.sig_timestamp or 0),
        req.signature, req.sig_timestamp
    )

    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "SELECT * FROM staking_positions WHERE token_id = ? AND staker_address = ?",
        (req.token_id, staker_lower)
    )
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Posição UTXO não encontrada")

    pos = dict(row)
    if pos["is_spent"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Este UTXO já foi gasto")

    current_ts = int(datetime.now().timestamp())
    unlock_time = pos["deposit_timestamp"] + pos["lock_duration"]
    if current_ts < unlock_time:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Timelock ativo. Desbloqueia em {unlock_time - current_ts}s")

    yield_paid = round(pos["deposit_amount"] * pos["yield_basis_points"] / 10000, 4)
    payout = round(pos["deposit_amount"] + yield_paid, 4)

    # ── STEP 1: Mark UTXO as spent ──────────────────────────────────────────
    VAULT_ADDRESS = "0x537461b696e675661756c740000000000000000"
    try:
        c.execute('''
            UPDATE staking_positions
            SET is_spent = 1, spent_timestamp = ?, yield_paid = ?
            WHERE token_id = ?
        ''', (current_ts, yield_paid, req.token_id))

        # ── STEP 2: Credit principal + yield back as incoming transaction ────
        # The vault sends back to the staker: this restores balance via
        # the (incoming - outgoing) calculation in get_user_balance.
        unstake_tx_hash = "0x" + keccak256(
            (staker_lower + "unstake" + str(req.token_id) + str(current_ts)).encode()
        ).hex()

        c.execute('''
            INSERT INTO transactions
                (hash, block_height, from_address, to_address, value, gas_price, timestamp)
            VALUES (?, 0, ?, ?, ?, 0, ?)
        ''', (unstake_tx_hash, VAULT_ADDRESS, staker_lower, payout, current_ts))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Erro ao processar unstake: {e}")
    finally:
        conn.close()

    audit_log("STAKE_WITHDRAWN", "system", {
        "address": staker_lower, "token_id": req.token_id,
        "principal": pos["deposit_amount"], "yield_paid": yield_paid,
        "total_payout": payout, "tx_hash": unstake_tx_hash
    })

    return {
        "status": "success",
        "token_id": req.token_id,
        "principal": pos["deposit_amount"],
        "yield_paid": yield_paid,
        "total_payout": payout,
        "tx_hash": unstake_tx_hash
    }


@app.get("/api/staking/stats")
async def get_staking_stats():
    """Global staking vault statistics."""
    try:
        conn = get_db_connection()
        c = conn.cursor()

        c.execute("SELECT COALESCE(SUM(deposit_amount), 0) FROM staking_positions WHERE is_spent = 0")
        total_locked = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM staking_positions WHERE is_spent = 0")
        active_count = c.fetchone()[0]

        c.execute("SELECT COALESCE(SUM(yield_paid), 0) FROM staking_positions WHERE is_spent = 1")
        total_yield = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM staking_positions WHERE is_spent = 1")
        spent_count = c.fetchone()[0]

        conn.close()

        return {
            "totalLocked": round(total_locked, 4),
            "activePositions": active_count,
            "totalYieldPaid": round(total_yield, 4),
            "spentPositions": spent_count,
            "tiers": {str(k): v for k, v in TIER_CONFIG.items()}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/vault/yield")
async def get_vault_yield():
    """Exposes the FaucetChain Treasury Vault and Miner Pool balances for transparency."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # Calculate Treasury Balance
        c.execute("SELECT COALESCE(SUM(value), 0) FROM transactions WHERE to_address = ?", (TREASURY_ADDRESS,))
        treasury_in = c.fetchone()[0]
        
        # Calculate Miner Pool Balance
        c.execute("SELECT COALESCE(SUM(value), 0) FROM transactions WHERE to_address = ?", (MINER_POOL_ADDRESS,))
        miner_in = c.fetchone()[0]
        
        conn.close()
        
        return {
            "totalExternalValue": treasury_in, # In a real scenario, this would be cross-chain TVL. We use treasury balance here.
            "assets": [
                {"symbol": "TREASURY_CLAIM", "amount": round(treasury_in, 4)},
                {"symbol": "MINER_POOL", "amount": round(miner_in, 4)}
            ],
            "yieldGenerated": round(treasury_in + miner_in, 4), # Total fees collected
            "apy": 12.5 # Mock simulated APY based on network activity
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===========================
# COMMUNITY BOUNTY BOARD
# ===========================

def init_bounties_table():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS bounties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            creator_address TEXT NOT NULL,
            hunter_address TEXT DEFAULT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            reward REAL NOT NULL,
            created_at INTEGER NOT NULL,
            deadline INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'OPEN',
            completed_at INTEGER DEFAULT NULL
        )
    ''')
    conn.commit()
    conn.close()

@app.on_event("startup")
async def startup_bounties():
    try:
        init_bounties_table()
    except Exception as e:
        print(f"⚠️ Failed to init bounties table: {e}")


class CreateBountyRequest(BaseModel):
    creator_address: str
    title: str
    description: str = ""
    reward: float
    duration_hours: int = 24

class ClaimBountyRequest(BaseModel):
    hunter_address: str

class ApproveBountyRequest(BaseModel):
    creator_address: str


@app.post("/api/bounties/create")
async def create_bounty(req: CreateBountyRequest, request: Request):
    """Create a new bounty, locking CLAIM as reward."""
    client_ip = request.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    if req.reward <= 0:
        raise HTTPException(status_code=400, detail="Recompensa deve ser > 0")
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Título obrigatório")
    if req.duration_hours < 1:
        raise HTTPException(status_code=400, detail="Duração mínima: 1 hora")

    current_ts = int(datetime.now().timestamp())
    deadline = current_ts + (req.duration_hours * 3600)

    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        INSERT INTO bounties (creator_address, title, description, reward, created_at, deadline, status)
        VALUES (?, ?, ?, ?, ?, ?, 'OPEN')
    ''', (
        req.creator_address.strip().lower(),
        sanitize_input(req.title),
        sanitize_input(req.description),
        req.reward,
        current_ts,
        deadline
    ))
    bounty_id = c.lastrowid
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "bounty_id": bounty_id,
        "deadline": deadline,
        "reward": req.reward
    }


@app.get("/api/bounties/list")
def list_bounties(status: Optional[str] = None, limit: int = 50):
    """List bounties, optionally filtered by status."""
    conn = get_db_connection()
    c = conn.cursor()

    if status:
        c.execute("SELECT * FROM bounties WHERE status = ? ORDER BY created_at DESC LIMIT ?", (status.upper(), limit))
    else:
        c.execute("SELECT * FROM bounties ORDER BY created_at DESC LIMIT ?", (limit,))

    rows = c.fetchall()
    conn.close()

    current_ts = int(datetime.now().timestamp())
    result = []
    for row in rows:
        r = dict(row)
        r["is_expired"] = current_ts > r["deadline"]
        r["time_remaining"] = max(0, r["deadline"] - current_ts)
        result.append(r)

    return result


@app.post("/api/bounties/{bounty_id}/claim")
async def claim_bounty(bounty_id: int, req: ClaimBountyRequest):
    """Hunter claims (accepts) a bounty."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM bounties WHERE id = ?", (bounty_id,))
    row = c.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Bounty não encontrada")

    bounty = dict(row)
    if bounty["status"] != "OPEN":
        conn.close()
        raise HTTPException(status_code=400, detail="Bounty não está aberta")

    current_ts = int(datetime.now().timestamp())
    if current_ts > bounty["deadline"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Bounty expirada")

    if req.hunter_address.strip().lower() == bounty["creator_address"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Criador não pode se auto-candidatar")

    c.execute(
        "UPDATE bounties SET hunter_address = ?, status = 'CLAIMED' WHERE id = ?",
        (req.hunter_address.strip().lower(), bounty_id)
    )
    conn.commit()
    conn.close()

    return {"status": "success", "bounty_id": bounty_id, "hunter": req.hunter_address}


@app.post("/api/bounties/{bounty_id}/approve")
async def approve_bounty(bounty_id: int, req: ApproveBountyRequest):
    """Creator approves the hunter's work and releases the reward."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM bounties WHERE id = ?", (bounty_id,))
    row = c.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Bounty não encontrada")

    bounty = dict(row)
    if req.creator_address.strip().lower() != bounty["creator_address"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Apenas o criador pode aprovar")
    if bounty["status"] != "CLAIMED":
        conn.close()
        raise HTTPException(status_code=400, detail="Bounty não está em revisão")

    current_ts = int(datetime.now().timestamp())
    c.execute(
        "UPDATE bounties SET status = 'COMPLETED', completed_at = ? WHERE id = ?",
        (current_ts, bounty_id)
    )
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "bounty_id": bounty_id,
        "reward_paid": bounty["reward"],
        "hunter": bounty["hunter_address"]
    }


@app.post("/api/bounties/{bounty_id}/cancel")
async def cancel_bounty(bounty_id: int, req: ApproveBountyRequest):
    """Creator cancels an expired bounty and reclaims the reward."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM bounties WHERE id = ?", (bounty_id,))
    row = c.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Bounty não encontrada")

    bounty = dict(row)
    if req.creator_address.strip().lower() != bounty["creator_address"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Apenas o criador pode cancelar")

    current_ts = int(datetime.now().timestamp())
    is_open = bounty["status"] == "OPEN"
    is_claimed_expired = bounty["status"] == "CLAIMED" and current_ts > bounty["deadline"]

    if not (is_open or is_claimed_expired):
        conn.close()
        raise HTTPException(status_code=400, detail="Cancelamento não permitido neste estado")

    c.execute(
        "UPDATE bounties SET status = 'CANCELLED', completed_at = ? WHERE id = ?",
        (current_ts, bounty_id)
    )
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "bounty_id": bounty_id,
        "refund": bounty["reward"]
    }


@app.get("/api/bounties/user/{address}")
async def get_user_bounties(address: str):
    """Get all bounties created by or assigned to a user."""
    conn = get_db_connection()
    c = conn.cursor()
    addr = address.strip().lower()
    c.execute(
        "SELECT * FROM bounties WHERE creator_address = ? OR hunter_address = ? ORDER BY created_at DESC",
        (addr, addr)
    )
    rows = c.fetchall()
    conn.close()

    current_ts = int(datetime.now().timestamp())
    result = []
    for row in rows:
        r = dict(row)
        r["is_expired"] = current_ts > r["deadline"]
        r["time_remaining"] = max(0, r["deadline"] - current_ts)
        r["role"] = "creator" if r["creator_address"] == addr else "hunter"
        result.append(r)

    return result


@app.get("/api/bounties/stats")
async def get_bounty_stats():
    """Global bounty board statistics."""
    try:
        conn = get_db_connection()
        c = conn.cursor()

        c.execute("SELECT COUNT(*) FROM bounties")
        total = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM bounties WHERE status = 'OPEN'")
        open_count = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM bounties WHERE status = 'COMPLETED'")
        completed = c.fetchone()[0]

        c.execute("SELECT COALESCE(SUM(reward), 0) FROM bounties WHERE status = 'OPEN' OR status = 'CLAIMED'")
        locked_rewards = c.fetchone()[0]

        c.execute("SELECT COALESCE(SUM(reward), 0) FROM bounties WHERE status = 'COMPLETED'")
        paid_rewards = c.fetchone()[0]

        conn.close()

        return {
            "totalBounties": total,
            "openBounties": open_count,
            "completedBounties": completed,
            "lockedRewards": round(locked_rewards, 4),
            "paidRewards": round(paid_rewards, 4)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================
# MINING NETWORK — AUTO-CLAIM
# ===========================

MINING_CONFIG = {
    "heartbeat_interval": 30,       # seconds between heartbeats
    "heartbeat_timeout": 90,        # seconds before node is considered offline
    "min_heartbeat_gap": 10,        # rate limit: min seconds between heartbeats
    "max_nodes_per_wallet": 3,      # anti-Sybil: max nodes per wallet
    "epoch_reward": 1695.0,         # CLAIM distributed per epoch (28.25/min * 60)
    "epoch_duration": 3600,         # 1 hour in seconds
}

def init_mining_table():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS active_miners (
            node_id TEXT PRIMARY KEY,
            wallet_address TEXT NOT NULL,
            node_name TEXT DEFAULT 'unnamed',
            registered_at INTEGER NOT NULL,
            last_heartbeat INTEGER NOT NULL,
            total_uptime_seconds INTEGER DEFAULT 0,
            epoch_uptime_seconds INTEGER DEFAULT 0,
            total_earned REAL DEFAULT 0,
            epochs_active INTEGER DEFAULT 0,
            is_online INTEGER DEFAULT 1,
            cpu_load REAL DEFAULT 0,
            memory_free REAL DEFAULT 0,
            version TEXT DEFAULT '1.0.0'
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS mining_rewards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            epoch_id INTEGER NOT NULL,
            wallet_address TEXT NOT NULL,
            node_id TEXT NOT NULL,
            reward_amount REAL NOT NULL,
            uptime_share REAL NOT NULL,
            distributed_at INTEGER NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

@app.on_event("startup")
async def startup_mining():
    try:
        init_mining_table()
    except Exception as e:
        print(f"⚠️ Failed to init mining tables: {e}")
    # Launch automatic epoch reward distribution scheduler
    asyncio.create_task(epoch_scheduler())
    print(f"⏰ Epoch scheduler started — auto-distribute every {MINING_CONFIG['epoch_duration']}s")


class MiningRegisterRequest(BaseModel):
    wallet_address: str
    node_id: str
    node_name: str = "unnamed"
    version: str = "1.0.0"

class HeartbeatRequest(BaseModel):
    node_id: str
    wallet_address: str
    uptime_seconds: int = 0
    cpu_load: float = 0.0
    memory_free: float = 0.0

class DisconnectRequest(BaseModel):
    node_id: str
    wallet_address: str


@app.post("/api/mining/register")
async def register_miner(req: MiningRegisterRequest, request: Request):
    """Register a new mining node on the network."""
    client_ip = request.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    conn = get_db_connection()
    c = conn.cursor()

    # Check max nodes per wallet
    c.execute(
        "SELECT COUNT(*) FROM active_miners WHERE wallet_address = ?",
        (req.wallet_address.strip().lower(),)
    )
    node_count = c.fetchone()[0]
    if node_count >= MINING_CONFIG["max_nodes_per_wallet"]:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Máximo de {MINING_CONFIG['max_nodes_per_wallet']} nós por wallet")

    # Check if node_id already exists
    c.execute("SELECT node_id FROM active_miners WHERE node_id = ?", (req.node_id,))
    if c.fetchone():
        # Reconnect existing node
        current_ts = int(datetime.now().timestamp())
        c.execute(
            "UPDATE active_miners SET is_online = 1, last_heartbeat = ?, version = ? WHERE node_id = ?",
            (current_ts, req.version, req.node_id)
        )
        conn.commit()
        conn.close()
        return {"status": "reconnected", "node_id": req.node_id}

    current_ts = int(datetime.now().timestamp())
    c.execute('''
        INSERT INTO active_miners (node_id, wallet_address, node_name, registered_at, last_heartbeat, is_online, version)
        VALUES (?, ?, ?, ?, ?, 1, ?)
    ''', (req.node_id, req.wallet_address.strip().lower(), req.node_name, current_ts, current_ts, req.version))
    conn.commit()
    conn.close()

    return {
        "status": "registered",
        "node_id": req.node_id,
        "wallet": req.wallet_address,
        "config": {
            "heartbeat_interval": MINING_CONFIG["heartbeat_interval"],
            "epoch_duration": MINING_CONFIG["epoch_duration"],
            "epoch_reward": MINING_CONFIG["epoch_reward"]
        }
    }


@app.post("/api/mining/heartbeat")
async def mining_heartbeat(req: HeartbeatRequest):
    """Process a heartbeat from a mining node — proof of presence."""
    conn = get_db_connection()
    c = conn.cursor()

    c.execute("SELECT * FROM active_miners WHERE node_id = ?", (req.node_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Nó não registrado. Execute /api/mining/register primeiro.")

    node = dict(row)
    current_ts = int(datetime.now().timestamp())

    # Rate limit: min gap between heartbeats
    time_since_last = current_ts - node["last_heartbeat"]
    if time_since_last < MINING_CONFIG["min_heartbeat_gap"]:
        conn.close()
        raise HTTPException(status_code=429, detail=f"Rate limit: aguarde {MINING_CONFIG['min_heartbeat_gap']}s entre heartbeats")

    # Calculate uptime gained since last heartbeat (capped at timeout)
    uptime_gained = min(time_since_last, MINING_CONFIG["heartbeat_timeout"])

    c.execute('''
        UPDATE active_miners SET
            last_heartbeat = ?,
            is_online = 1,
            total_uptime_seconds = total_uptime_seconds + ?,
            epoch_uptime_seconds = epoch_uptime_seconds + ?,
            cpu_load = ?,
            memory_free = ?
        WHERE node_id = ?
    ''', (current_ts, uptime_gained, uptime_gained, req.cpu_load, req.memory_free, req.node_id))
    conn.commit()

    # Fetch updated data
    c.execute("SELECT total_uptime_seconds, epoch_uptime_seconds, total_earned, epochs_active FROM active_miners WHERE node_id = ?", (req.node_id,))
    updated = dict(c.fetchone())
    conn.close()

    await manager.broadcast({"type": "MINER_HEARTBEAT", "data": {"node_id": req.node_id[:12], "uptime_gained": uptime_gained, "timestamp": current_ts}})
    return {
        "status": "alive",
        "node_id": req.node_id,
        "uptime_gained": uptime_gained,
        "total_uptime": updated["total_uptime_seconds"],
        "epoch_uptime": updated["epoch_uptime_seconds"],
        "total_earned": updated["total_earned"],
        "epochs_active": updated["epochs_active"],
        "next_heartbeat_in": MINING_CONFIG["heartbeat_interval"]
    }


@app.post("/api/mining/disconnect")
async def disconnect_miner(req: DisconnectRequest):
    """Gracefully disconnect a mining node."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE active_miners SET is_online = 0 WHERE node_id = ? AND wallet_address = ?",
              (req.node_id, req.wallet_address.strip().lower()))
    conn.commit()
    conn.close()
    return {"status": "disconnected", "node_id": req.node_id}


@app.get("/api/mining/stats")
async def get_mining_stats():
    """Global mining network statistics."""
    conn = get_db_connection()
    c = conn.cursor()
    current_ts = int(datetime.now().timestamp())
    timeout = MINING_CONFIG["heartbeat_timeout"]

    # Mark stale nodes as offline
    c.execute("UPDATE active_miners SET is_online = 0 WHERE last_heartbeat < ?", (current_ts - timeout,))
    conn.commit()

    c.execute("SELECT COUNT(*) FROM active_miners WHERE is_online = 1")
    online = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM active_miners")
    total_registered = c.fetchone()[0]

    c.execute("SELECT COALESCE(SUM(total_earned), 0) FROM active_miners")
    total_distributed = c.fetchone()[0]

    c.execute("SELECT COALESCE(SUM(epoch_uptime_seconds), 0) FROM active_miners WHERE is_online = 1")
    total_epoch_uptime = c.fetchone()[0]

    c.execute("SELECT COALESCE(AVG(cpu_load), 0) FROM active_miners WHERE is_online = 1")
    avg_cpu = c.fetchone()[0]

    # Epoch info
    c.execute("SELECT MAX(epoch_id) FROM mining_rewards")
    row = c.fetchone()
    last_epoch = row[0] if row[0] else 0

    conn.close()

    # Estimated reward per node per hour
    reward_per_node = round(MINING_CONFIG["epoch_reward"] / max(online, 1), 4)

    return {
        "nodesOnline": online,
        "totalRegistered": total_registered,
        "totalDistributed": round(total_distributed, 4),
        "epochReward": MINING_CONFIG["epoch_reward"],
        "estimatedRewardPerNode": reward_per_node,
        "lastEpochId": last_epoch,
        "avgCpuLoad": round(avg_cpu, 2),
        "heartbeatInterval": MINING_CONFIG["heartbeat_interval"],
        "epochDuration": MINING_CONFIG["epoch_duration"]
    }


@app.get("/api/mining/leaderboard")
async def get_mining_leaderboard(limit: int = 20):
    """Top miners by total earned CLAIM."""
    conn = get_db_connection()
    c = conn.cursor()
    current_ts = int(datetime.now().timestamp())
    timeout = MINING_CONFIG["heartbeat_timeout"]

    c.execute('''
        SELECT wallet_address, node_name, total_uptime_seconds, total_earned, epochs_active,
               is_online, last_heartbeat, registered_at
        FROM active_miners
        ORDER BY total_earned DESC
        LIMIT ?
    ''', (limit,))
    rows = c.fetchall()
    conn.close()

    result = []
    for i, row in enumerate(rows):
        r = dict(row)
        r["rank"] = i + 1
        r["is_online"] = bool(r["is_online"] and (current_ts - r["last_heartbeat"]) < timeout)
        r["uptime_hours"] = round(r["total_uptime_seconds"] / 3600, 2)
        result.append(r)

    return result


@app.get("/api/mining/node/{address}")
async def get_node_info(address: str):
    """Get all nodes for a specific wallet address."""
    conn = get_db_connection()
    c = conn.cursor()
    current_ts = int(datetime.now().timestamp())
    timeout = MINING_CONFIG["heartbeat_timeout"]

    c.execute(
        "SELECT * FROM active_miners WHERE wallet_address = ? ORDER BY registered_at DESC",
        (address.strip().lower(),)
    )
    rows = c.fetchall()
    conn.close()

    if not rows:
        raise HTTPException(status_code=404, detail="Nenhum nó encontrado para esta wallet")

    result = []
    for row in rows:
        r = dict(row)
        r["is_online"] = bool(r["is_online"] and (current_ts - r["last_heartbeat"]) < timeout)
        r["uptime_hours"] = round(r["total_uptime_seconds"] / 3600, 2)
        r["epoch_uptime_minutes"] = round(r["epoch_uptime_seconds"] / 60, 2)
        result.append(r)

    return result


async def _distribute_epoch():
    """Core epoch distribution logic — reusable by scheduler and manual endpoint."""
    conn = get_db_connection()
    c = conn.cursor()
    current_ts = int(datetime.now().timestamp())
    timeout = MINING_CONFIG["heartbeat_timeout"]

    # Get all nodes with epoch uptime > 0
    c.execute('''
        SELECT node_id, wallet_address, epoch_uptime_seconds
        FROM active_miners
        WHERE epoch_uptime_seconds > 0 AND is_online = 1 AND last_heartbeat >= ?
    ''', (current_ts - timeout,))
    active_nodes = [dict(r) for r in c.fetchall()]

    if not active_nodes:
        conn.close()
        return {"status": "no_active_miners", "distributed": 0}

    # ── Hard cap (fix B4): o pool da epoch nunca ultrapassa o supply restante ──
    # Epsilon de 1e-6 absorve resíduos de ponto flutuante das somas de mint,
    # evitando epochs fantasma que "distribuem" 0.0.
    remaining_supply = MAX_SUPPLY - get_total_minted(c)
    if remaining_supply <= 1e-6:
        conn.close()
        return {"status": "max_supply_reached", "distributed": 0}

    # A recompensa de uptime também é emissão: entra na quota global da hora,
    # como os claims. Antes ela era somada por fora e a emissão real passava
    # de TOKENS_PER_HOUR.
    epoch_id_hr, tokens_mined_hr, depleted_hr = get_hourly_epoch_state(c, current_ts)
    remaining_hour = TOKENS_PER_HOUR - tokens_mined_hr
    if depleted_hr or remaining_hour <= 1e-6:
        conn.commit()
        conn.close()
        return {"status": "hourly_quota_depleted", "distributed": 0}
    epoch_pool = min(MINING_CONFIG["epoch_reward"], remaining_supply, remaining_hour)

    # Calculate total epoch uptime
    total_epoch_uptime = sum(n["epoch_uptime_seconds"] for n in active_nodes)

    # Get new epoch ID
    c.execute("SELECT COALESCE(MAX(epoch_id), 0) + 1 FROM mining_rewards")
    epoch_id = c.fetchone()[0]

    total_paid = 0.0
    rewards = []

    for node in active_nodes:
        share = node["epoch_uptime_seconds"] / total_epoch_uptime
        # arredonda para baixo: a soma nunca passa do pool (e da quota)
        reward = math.floor(epoch_pool * share * 1e6) / 1e6
        total_paid += reward

        # Record reward
        c.execute('''
            INSERT INTO mining_rewards (epoch_id, wallet_address, node_id, reward_amount, uptime_share, distributed_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (epoch_id, node["wallet_address"], node["node_id"], reward, round(share * 100, 2), current_ts))

        # Update miner stats
        c.execute('''
            UPDATE active_miners SET
                total_earned = total_earned + ?,
                epochs_active = epochs_active + 1,
                epoch_uptime_seconds = 0
            WHERE node_id = ?
        ''', (reward, node["node_id"]))

        rewards.append({
            "wallet": node["wallet_address"],
            "node_id": node["node_id"],
            "reward": reward,
            "share_pct": round(share * 100, 2)
        })

    record_epoch_mint(c, epoch_id_hr, total_paid)
    conn.commit()
    conn.close()

    return {
        "status": "distributed",
        "epoch_id": epoch_id,
        "total_distributed": round(total_paid, 4),
        "active_miners": len(active_nodes),
        "rewards": rewards
    }


async def epoch_scheduler():
    """Background task: auto-distribute epoch rewards every epoch_duration seconds."""
    epoch_duration = MINING_CONFIG["epoch_duration"]
    logging.info(f"⏰ Epoch scheduler waiting {epoch_duration}s for first epoch...")
    await asyncio.sleep(epoch_duration)
    while True:
        try:
            result = await _distribute_epoch()
            if result["status"] == "distributed":
                logging.info(
                    f"⛏️ Epoch #{result['epoch_id']} distributed: "
                    f"{result['total_distributed']} CLAIM to {result['active_miners']} miners"
                )
            else:
                logging.info(f"⛏️ Epoch skipped: {result['status']}")
        except Exception as e:
            logging.error(f"❌ Epoch distribution error: {e}")
        await asyncio.sleep(epoch_duration)


@app.post("/api/mining/distribute-epoch")
async def distribute_epoch_rewards():
    """Manually trigger epoch distribution (also runs automatically every hour)."""
    return await _distribute_epoch()


@app.get("/api/mining/rewards/{address}")
def get_mining_rewards(address: str, limit: int = 50):
    """Get reward history for a wallet."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        SELECT epoch_id, node_id, reward_amount, uptime_share, distributed_at
        FROM mining_rewards
        WHERE wallet_address = ?
        ORDER BY distributed_at DESC
        LIMIT ?
    ''', (address.strip().lower(), limit))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

# [REMOVED] Duplicate /api/mining/stats — kept the version with stale-node marking at line ~1600
# [REMOVED] Duplicate /api/mining/leaderboard — kept the version with timeout checking at line ~1650


# ===========================
# ADDRESS TRACKER / WATCHLIST
# ===========================

def init_tracked_addresses_table():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS account_nonces (
            address TEXT PRIMARY KEY,
            nonce INTEGER DEFAULT 0
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS tracked_addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL UNIQUE,
            label TEXT DEFAULT '',
            category TEXT NOT NULL DEFAULT 'custom',
            notes TEXT DEFAULT '',
            added_at INTEGER NOT NULL,
            last_checked INTEGER DEFAULT 0,
            tx_count INTEGER DEFAULT 0,
            last_balance REAL DEFAULT 0
        )
    ''')
    conn.commit()
    conn.close()

@app.on_event("startup")
async def startup_tracker():
    try:
        init_tracked_addresses_table()
    except Exception as e:
        print(f"⚠️ Failed to init tracked_addresses table: {e}")


class AddTrackedAddressRequest(BaseModel):
    address: str
    label: str = ""
    category: str = "custom"
    notes: str = ""


@app.get("/api/tracker/addresses")
def list_tracked_addresses(category: Optional[str] = None):
    """List all tracked addresses, optionally filtered by category."""
    conn = get_db_connection()
    c = conn.cursor()
    current_ts = int(datetime.now().timestamp())

    if category:
        c.execute(
            "SELECT * FROM tracked_addresses WHERE category = ? ORDER BY added_at DESC",
            (category.lower(),)
        )
    else:
        c.execute("SELECT * FROM tracked_addresses ORDER BY added_at DESC")

    rows = [dict(r) for r in c.fetchall()]

    # Enrich with miner status
    for row in rows:
        addr = row["address"].lower()
        c.execute(
            "SELECT is_online, total_earned, total_uptime_seconds, node_name FROM active_miners WHERE wallet_address = ? LIMIT 1",
            (addr,)
        )
        miner = c.fetchone()
        if miner:
            m = dict(miner)
            row["is_miner"] = True
            row["miner_online"] = bool(m["is_online"])
            row["miner_earned"] = m["total_earned"]
            row["miner_uptime"] = m["total_uptime_seconds"]
            row["miner_name"] = m["node_name"]
        else:
            row["is_miner"] = False

        # Get tx count from transactions table
        c.execute(
            "SELECT COUNT(*) FROM transactions WHERE from_address = ? OR to_address = ?",
            (addr, addr)
        )
        row["tx_count"] = c.fetchone()[0]

    conn.close()
    return rows


@app.post("/api/tracker/addresses")
async def add_tracked_address(req: AddTrackedAddressRequest, request: Request):
    """Add an address to the watchlist."""
    client_ip = request.client.host
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    addr = req.address.strip().lower()
    if not addr.startswith("0x") or len(addr) < 10:
        raise HTTPException(status_code=400, detail="Endereço inválido")

    category = req.category.lower().strip()
    if category not in ("user", "miner", "hub", "custom"):
        category = "custom"

    # Auto-detect miner
    conn = get_db_connection()
    c = conn.cursor()

    c.execute("SELECT node_id FROM active_miners WHERE wallet_address = ?", (addr,))
    if c.fetchone() and category == "custom":
        category = "miner"

    current_ts = int(datetime.now().timestamp())

    try:
        c.execute('''
            INSERT INTO tracked_addresses (address, label, category, notes, added_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (addr, req.label, category, req.notes, current_ts))
        conn.commit()
        new_id = c.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Endereço já está sendo rastreado")

    conn.close()

    return {
        "status": "added",
        "id": new_id,
        "address": addr,
        "category": category,
        "label": req.label
    }


@app.delete("/api/tracker/addresses/{address}")
async def remove_tracked_address(address: str):
    """Remove an address from the watchlist."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM tracked_addresses WHERE address = ?", (address.strip().lower(),))
    deleted = c.rowcount
    conn.commit()
    conn.close()

    if deleted == 0:
        raise HTTPException(status_code=404, detail="Endereço não encontrado na watchlist")

    return {"status": "removed", "address": address.strip().lower()}


@app.get("/api/tracker/addresses/{address}/activity")
async def get_tracked_address_activity(address: str, limit: int = 30):
    """Get aggregated activity for a tracked address."""
    addr = address.strip().lower()
    conn = get_db_connection()
    c = conn.cursor()

    # Transactions
    c.execute('''
        SELECT hash, block_height, from_address, to_address, value, timestamp
        FROM transactions
        WHERE from_address = ? OR to_address = ?
        ORDER BY timestamp DESC LIMIT ?
    ''', (addr, addr, limit))
    txs = [dict(r) for r in c.fetchall()]

    # Claims
    c.execute('''
        SELECT tx_hash, amount, timestamp, block_height
        FROM user_claims
        WHERE user_address = ?
        ORDER BY timestamp DESC LIMIT ?
    ''', (addr, limit))
    claims = [dict(r) for r in c.fetchall()]

    # Mining rewards
    c.execute('''
        SELECT epoch_id, reward_amount, uptime_share, distributed_at
        FROM mining_rewards
        WHERE wallet_address = ?
        ORDER BY distributed_at DESC LIMIT ?
    ''', (addr, limit))
    rewards = [dict(r) for r in c.fetchall()]

    # Staking positions
    c.execute('''
        SELECT token_id, deposit_amount, deposit_timestamp, tier, is_spent, yield_paid
        FROM staking_positions
        WHERE staker_address = ?
        ORDER BY deposit_timestamp DESC LIMIT ?
    ''', (addr, limit))
    stakes = [dict(r) for r in c.fetchall()]

    conn.close()

    return {
        "address": addr,
        "transactions": txs,
        "claims": claims,
        "mining_rewards": rewards,
        "staking_positions": stakes,
        "total_txs": len(txs),
        "total_claims": len(claims),
        "total_mining_rewards": len(rewards)
    }


@app.get("/api/tracker/summary")
async def get_tracker_summary():
    """Category summary for all tracked addresses."""
    conn = get_db_connection()
    c = conn.cursor()

    c.execute("SELECT COUNT(*) FROM tracked_addresses")
    total = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM tracked_addresses WHERE category = 'user'")
    users = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM tracked_addresses WHERE category = 'miner'")
    miners = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM tracked_addresses WHERE category = 'hub'")
    hubs = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM tracked_addresses WHERE category = 'custom'")
    custom = c.fetchone()[0]

    # Last activity across all tracked
    c.execute("""
        SELECT t.address, MAX(tx.timestamp) as last_ts
        FROM tracked_addresses t
        LEFT JOIN transactions tx ON tx.from_address = t.address OR tx.to_address = t.address
        GROUP BY t.address
        ORDER BY last_ts DESC LIMIT 1
    """)
    row = c.fetchone()
    last_activity = dict(row) if row else None

    conn.close()

    return {
        "total": total,
        "users": users,
        "miners": miners,
        "hubs": hubs,
        "custom": custom,
        "last_activity": last_activity
    }


_server_start_time = _time.time()

@app.get("/api/infrastructure/status")
async def get_infrastructure_status():
    """Consolidated infrastructure health endpoint for the live monitor dashboard."""
    conn = get_db_connection()
    c = conn.cursor()
    current_ts = int(datetime.now().timestamp())
    result = {}

    # --- API ---
    result["api"] = {
        "status": "online",
        "uptime_seconds": int(_time.time() - _server_start_time),
        "websocket_connections": len(manager.active_connections),
        "vector_db": "active" if kb else "inactive",
        "fraud_detector": "active" if HAS_FRAUD_DETECTOR else "inactive",
    }

    # --- Mining ---
    try:
        timeout = MINING_CONFIG.get("heartbeat_timeout", 120)
        c.execute("UPDATE active_miners SET is_online = 0 WHERE last_heartbeat < ?", (current_ts - timeout,))
        conn.commit()
        c.execute("SELECT COUNT(*) FROM active_miners WHERE is_online = 1")
        nodes_online = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM active_miners")
        nodes_total = c.fetchone()[0]
        c.execute("SELECT COALESCE(SUM(total_earned), 0) FROM active_miners")
        total_mined = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM pending_claims WHERE status = 'pending'")
        pending = c.fetchone()[0]
        c.execute("SELECT MAX(last_heartbeat) FROM active_miners WHERE is_online = 1")
        last_hb = c.fetchone()[0]
        result["mining"] = {
            "status": "online" if nodes_online > 0 else "idle",
            "nodes_online": nodes_online,
            "nodes_total": nodes_total,
            "total_mined": round(total_mined, 4),
            "pending_claims": pending,
            "last_heartbeat": last_hb or 0,
        }
    except Exception:
        result["mining"] = {"status": "error", "nodes_online": 0, "nodes_total": 0, "total_mined": 0, "pending_claims": 0, "last_heartbeat": 0}

    # --- Staking ---
    try:
        c.execute("SELECT COUNT(*), COALESCE(SUM(deposit_amount), 0) FROM staking_positions WHERE is_spent = 0")
        row = c.fetchone()
        active_positions = row[0]
        total_locked = row[1] or 0
        c.execute("SELECT MAX(deposit_timestamp) FROM staking_positions")
        last_stake = c.fetchone()[0]
        result["staking"] = {
            "status": "online" if active_positions > 0 else "idle",
            "active_positions": active_positions,
            "total_locked": round(total_locked, 4),
            "last_action": last_stake or 0,
        }
    except Exception:
        result["staking"] = {"status": "error", "active_positions": 0, "total_locked": 0, "last_action": 0}

    # --- Bounty ---
    try:
        c.execute("SELECT COUNT(*) FROM bounties WHERE status = 'OPEN'")
        open_bounties = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM bounties WHERE status = 'CLAIMED'")
        claimed = c.fetchone()[0]
        c.execute("SELECT COALESCE(SUM(reward), 0) FROM bounties WHERE status = 'COMPLETED'")
        distributed = c.fetchone()[0]
        result["bounty"] = {
            "status": "online",
            "open_bounties": open_bounties,
            "claimed_pending": claimed,
            "total_distributed": round(distributed or 0, 4),
        }
    except Exception:
        result["bounty"] = {"status": "idle", "open_bounties": 0, "claimed_pending": 0, "total_distributed": 0}

    # --- Sentinel AI ---
    result["sentinel"] = {
        "status": "active" if HAS_FRAUD_DETECTOR else "disabled",
        "vector_db_docs": 0,
    }
    if kb:
        try:
            stats = kb.get_stats()
            result["sentinel"]["vector_db_docs"] = stats.get("total_documents", 0)
        except Exception:
            pass

    # --- Database ---
    try:
        c.execute("SELECT COUNT(*) FROM blocks")
        block_count = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM transactions")
        tx_count = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM user_claims")
        claims_count = c.fetchone()[0]
        db_size_bytes = os.path.getsize("blockchain.db") if os.path.exists("blockchain.db") else 0
        result["database"] = {
            "status": "online",
            "blocks": block_count,
            "transactions": tx_count,
            "claims": claims_count,
            "size_mb": round(db_size_bytes / (1024 * 1024), 1),
        }
    except Exception:
        result["database"] = {"status": "error", "blocks": 0, "transactions": 0, "claims": 0, "size_mb": 0}

    # --- WebSocket ---
    result["websocket"] = {
        "status": "online",
        "active_connections": len(manager.active_connections),
    }

    conn.close()
    result["timestamp"] = current_ts
    return result


# ===========================
# CYBERDRIP TERMINAL — GAMIFIED FAUCET ENGINE
# ===========================

def init_cyberdrip_tables():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS cyberdrip_profiles (
            wallet TEXT PRIMARY KEY,
            total_claims INTEGER NOT NULL DEFAULT 0,
            total_earned REAL NOT NULL DEFAULT 0.0,
            streak_days INTEGER NOT NULL DEFAULT 0,
            last_claim_date TEXT,
            rank_tier INTEGER NOT NULL DEFAULT 0,
            exp REAL NOT NULL DEFAULT 0.0,
            created_at INTEGER NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS cyberdrip_nfts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet TEXT NOT NULL,
            nft_id TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            acquired_at INTEGER NOT NULL,
            UNIQUE(wallet, nft_id)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS cyberdrip_missions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet TEXT NOT NULL,
            mission_id TEXT NOT NULL,
            completed_at INTEGER NOT NULL,
            reward REAL NOT NULL,
            UNIQUE(wallet, mission_id, completed_at)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS cyberdrip_daily_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet TEXT NOT NULL,
            claim_date TEXT NOT NULL,
            claims_today INTEGER NOT NULL DEFAULT 0,
            bonus_earned REAL NOT NULL DEFAULT 0.0,
            UNIQUE(wallet, claim_date)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS cyberdrip_boosters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet TEXT NOT NULL,
            booster_type TEXT NOT NULL,
            multiplier REAL NOT NULL DEFAULT 1.0,
            activated_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            cost REAL NOT NULL DEFAULT 0.0,
            burned REAL NOT NULL DEFAULT 0.0,
            treasury REAL NOT NULL DEFAULT 0.0
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS cyberdrip_hackgrid_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wallet TEXT NOT NULL,
            solved INTEGER NOT NULL DEFAULT 0,
            bonus REAL NOT NULL DEFAULT 0.0,
            timestamp INTEGER NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

# Init on startup
@app.on_event("startup")
async def startup_cyberdrip():
    try:
        init_cyberdrip_tables()
        print("✅ CyberDrip Terminal tables initialized")
    except Exception as e:
        print(f"⚠️ Failed to init CyberDrip tables: {e}")

RANK_TIERS = [
    {"tier": 0, "name": "ROOKIE",            "min_claims": 0,    "bonus_pct": 0},
    {"tier": 1, "name": "NETRUNNER",          "min_claims": 10,   "bonus_pct": 5},
    {"tier": 2, "name": "CIPHER",             "min_claims": 50,   "bonus_pct": 10},
    {"tier": 3, "name": "PHANTOM",            "min_claims": 150,  "bonus_pct": 15},
    {"tier": 4, "name": "ZERO_DAY",           "min_claims": 500,  "bonus_pct": 20},
    {"tier": 5, "name": "SHADOW_ARCHITECT",   "min_claims": 1000, "bonus_pct": 25},
]

MISSION_DEFS = {
    "FIRST_DRIP":   {"label": "Primeiro Drip do Dia",       "reward": 0.25, "desc": "Faça seu primeiro claim hoje"},
    "TRIPLE_TAP":   {"label": "Triple Tap",                 "reward": 0.50, "desc": "Faça 3 claims em um dia"},
    "STREAK_3":     {"label": "Streak de 3 Dias",           "reward": 1.00, "desc": "Mantenha 3 dias consecutivos"},
    "STREAK_7":     {"label": "Streak Semanal",             "reward": 3.00, "desc": "Mantenha 7 dias consecutivos"},
    "STREAK_30":    {"label": "Streak Lendário",            "reward": 15.00,"desc": "Mantenha 30 dias consecutivos"},
}

BOOSTER_CATALOG = {
    "OVERCLOCK":    {"cost": 5.0,   "duration_h": 1,   "multiplier": 2.0, "burn_pct": 0.30, "treasury_pct": 0.70, "label": "Overclock",      "desc": "Claims 2x por 1 hora"},
    "NEURAL_LINK":  {"cost": 15.0,  "duration_h": 6,   "multiplier": 2.0, "burn_pct": 0.40, "treasury_pct": 0.60, "label": "Neural Link",    "desc": "Claims 2x + Cooldown -50% por 6h"},
    "QUANTUM_SURGE":{"cost": 50.0,  "duration_h": 24,  "multiplier": 3.0, "burn_pct": 0.50, "treasury_pct": 0.50, "label": "Quantum Surge",  "desc": "Claims 3x + Mini-game 2x por 24h"},
    "DARK_PROTOCOL": {"cost": 200.0, "duration_h": 168, "multiplier": 5.0, "burn_pct": 0.50, "treasury_pct": 0.50, "label": "Dark Protocol",  "desc": "Claims 5x + Rank XP 2x por 7 dias"},
}

def _calc_rank_tier(total_claims: int) -> int:
    tier = 0
    for r in RANK_TIERS:
        if total_claims >= r["min_claims"]:
            tier = r["tier"]
    return tier

def _today_str():
    return datetime.now().strftime("%Y-%m-%d")

# --- Profile Endpoint ---

@app.get("/api/cyberdrip/profile/{wallet}")
async def get_cyberdrip_profile(wallet: str):
    wallet_lower = wallet.strip().lower()
    # Sem isso, cada tecla digitada no campo de endereço criava um perfil ("0", "0x", "0x7"...)
    if not re.fullmatch(r"0x[0-9a-f]{40}", wallet_lower):
        raise HTTPException(status_code=400, detail="Invalid wallet address")
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM cyberdrip_profiles WHERE wallet = ?", (wallet_lower,))
    row = c.fetchone()

    if not row:
        # Create fresh profile
        now_ts = int(_time.time())
        c.execute("INSERT INTO cyberdrip_profiles (wallet, created_at) VALUES (?, ?)", (wallet_lower, now_ts))
        
        # Auto-mint First Contact NFT
        c.execute("""
            INSERT OR IGNORE INTO cyberdrip_nfts (wallet, nft_id, name, type, description, acquired_at) 
            VALUES (?, ?, ?, ?, ?, ?)
        """, (wallet_lower, "FIRST_CONTACT", "Primeiro Contato L2", "HOLDER", "O registro inicial na sub-rede gamificada.", now_ts))
        
        conn.commit()
        profile = {
            "wallet": wallet_lower,
            "total_claims": 0, "total_earned": 0.0,
            "streak_days": 0, "last_claim_date": None,
            "rank_tier": 0, "exp": 0.0, "created_at": now_ts
        }
    else:
        profile = dict(row)

    # Compute rank & exp info
    tier = _calc_rank_tier(profile["total_claims"])
    rank_info = RANK_TIERS[tier]
    exp = profile.get("exp", 0.0)
    level = int(exp // 100) + 1

    # Today's daily log
    today = _today_str()
    c.execute("SELECT claims_today, bonus_earned FROM cyberdrip_daily_log WHERE wallet = ? AND claim_date = ?",
              (wallet_lower, today))
    daily_row = c.fetchone()
    claims_today = daily_row["claims_today"] if daily_row else 0
    bonus_today = daily_row["bonus_earned"] if daily_row else 0.0

    # Completed missions today
    day_start = int(datetime.strptime(today, "%Y-%m-%d").timestamp())
    day_end = day_start + 86400
    c.execute("SELECT mission_id FROM cyberdrip_missions WHERE wallet = ? AND completed_at >= ? AND completed_at < ?",
              (wallet_lower, day_start, day_end))
    completed_missions = [r["mission_id"] for r in c.fetchall()]

    # Available missions
    missions = []
    for mid, mdef in MISSION_DEFS.items():
        completed = mid in completed_missions
        available = True
        if mid == "FIRST_DRIP" and claims_today >= 1 and not completed:
            available = True  # can complete when first claim happens
        if mid == "TRIPLE_TAP" and claims_today < 3:
            available = True
        if mid.startswith("STREAK_"):
            needed = int(mid.split("_")[1])
            available = profile["streak_days"] >= needed or completed
        missions.append({
            "id": mid,
            "label": mdef["label"],
            "desc": mdef["desc"],
            "reward": mdef["reward"],
            "completed": completed,
            "available": available
        })

    # Active boosters
    now_ts = int(_time.time())
    c.execute("SELECT * FROM cyberdrip_boosters WHERE wallet = ? AND expires_at > ?", (wallet_lower, now_ts))
    active_boosters = []
    total_multiplier = 1.0
    for b in c.fetchall():
        remaining = b["expires_at"] - now_ts
        binfo = BOOSTER_CATALOG.get(b["booster_type"], {})
        active_boosters.append({
            "type": b["booster_type"],
            "label": binfo.get("label", b["booster_type"]),
            "multiplier": b["multiplier"],
            "remaining_seconds": remaining,
            "expires_at": b["expires_at"]
        })
        total_multiplier = max(total_multiplier, b["multiplier"])

    # Next rank progress
    next_tier = min(tier + 1, len(RANK_TIERS) - 1)
    next_rank = RANK_TIERS[next_tier]
    progress_pct = 100 if tier == next_tier else round(
        (profile["total_claims"] - rank_info["min_claims"]) /
        max(1, (next_rank["min_claims"] - rank_info["min_claims"])) * 100, 1
    )

    conn.close()
    return {
        **profile,
        "level": level,
        "exp": exp,
        "next_level_exp": level * 100,
        "rank_name": rank_info["name"],
        "rank_bonus_pct": rank_info["bonus_pct"],
        "rank_progress_pct": min(progress_pct, 100),
        "next_rank_name": next_rank["name"],
        "next_rank_claims": next_rank["min_claims"],
        "claims_today": claims_today,
        "bonus_today": bonus_today,
        "missions": missions,
        "completed_missions_today": completed_missions,
        "active_boosters": active_boosters,
        "total_multiplier": total_multiplier
    }


# --- Record a claim and auto-complete missions ---

class CyberDripClaimEvent(BaseModel):
    wallet: str
    amount: float

async def record_cyberdrip_claim(req: CyberDripClaimEvent):
    """Atualiza perfil, streak e missões após cada micro-claim da faucet interna.

    Chamado só pelo servidor (/api/faucethub/internal/microclaim). Antes era uma
    rota pública que aceitava qualquer amount vindo do navegador.
    """
    wallet_lower = req.wallet.strip().lower()
    now_ts = int(_time.time())
    today = _today_str()

    conn = get_db_connection()
    c = conn.cursor()

    # Ensure profile exists
    c.execute("SELECT * FROM cyberdrip_profiles WHERE wallet = ?", (wallet_lower,))
    profile_row = c.fetchone()
    if not profile_row:
        c.execute("INSERT INTO cyberdrip_profiles (wallet, created_at) VALUES (?, ?)", (wallet_lower, now_ts))
        conn.commit()
        c.execute("SELECT * FROM cyberdrip_profiles WHERE wallet = ?", (wallet_lower,))
        profile_row = c.fetchone()
    profile = dict(profile_row)

    # Update daily log
    c.execute("SELECT * FROM cyberdrip_daily_log WHERE wallet = ? AND claim_date = ?", (wallet_lower, today))
    daily = c.fetchone()
    if daily:
        new_count = daily["claims_today"] + 1
        c.execute("UPDATE cyberdrip_daily_log SET claims_today = ? WHERE wallet = ? AND claim_date = ?",
                  (new_count, wallet_lower, today))
    else:
        new_count = 1
        c.execute("INSERT INTO cyberdrip_daily_log (wallet, claim_date, claims_today, bonus_earned) VALUES (?, ?, 1, 0.0)",
                  (wallet_lower, today))

    # Update streak
    last_claim_date = profile["last_claim_date"]
    streak = profile["streak_days"]
    if last_claim_date:
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        if last_claim_date == yesterday:
            streak += 1  # consecutive day
        elif last_claim_date == today:
            pass  # same day, no change
        else:
            streak = 1  # streak broken, restart
    else:
        streak = 1

    new_total = profile["total_claims"] + 1
    new_earned = profile["total_earned"] + req.amount
    new_tier = _calc_rank_tier(new_total)
    new_exp = profile.get("exp", 0.0) + 10.0  # 10 EXP per claim

    c.execute("""
        UPDATE cyberdrip_profiles
        SET total_claims = ?, total_earned = ?, streak_days = ?, last_claim_date = ?, rank_tier = ?, exp = ?
        WHERE wallet = ?
    """, (new_total, new_earned, streak, today, new_tier, new_exp, wallet_lower))

    # Auto-complete missions
    completed_rewards = []
    day_start = int(datetime.strptime(today, "%Y-%m-%d").timestamp())
    day_end = day_start + 86400

    def already_completed(mid):
        c.execute("SELECT id FROM cyberdrip_missions WHERE wallet = ? AND mission_id = ? AND completed_at >= ? AND completed_at < ?",
                  (wallet_lower, mid, day_start, day_end))
        return c.fetchone() is not None

    # FIRST_DRIP: first claim today
    if new_count == 1 and not already_completed("FIRST_DRIP"):
        reward = MISSION_DEFS["FIRST_DRIP"]["reward"]
        c.execute("INSERT INTO cyberdrip_missions (wallet, mission_id, completed_at, reward) VALUES (?, ?, ?, ?)",
                  (wallet_lower, "FIRST_DRIP", now_ts, reward))
        completed_rewards.append({"mission": "FIRST_DRIP", "reward": reward})

    # TRIPLE_TAP: 3 claims today
    if new_count >= 3 and not already_completed("TRIPLE_TAP"):
        reward = MISSION_DEFS["TRIPLE_TAP"]["reward"]
        c.execute("INSERT INTO cyberdrip_missions (wallet, mission_id, completed_at, reward) VALUES (?, ?, ?, ?)",
                  (wallet_lower, "TRIPLE_TAP", now_ts, reward))
        completed_rewards.append({"mission": "TRIPLE_TAP", "reward": reward})

    # Streak missions
    for streak_key in ["STREAK_3", "STREAK_7", "STREAK_30"]:
        needed = int(streak_key.split("_")[1])
        if streak >= needed and not already_completed(streak_key):
            reward = MISSION_DEFS[streak_key]["reward"]
            c.execute("INSERT INTO cyberdrip_missions (wallet, mission_id, completed_at, reward) VALUES (?, ?, ?, ?)",
                      (wallet_lower, streak_key, now_ts, reward))
            completed_rewards.append({"mission": streak_key, "reward": reward})

    # Credit mission bonus to daily log
    total_bonus = sum(r["reward"] for r in completed_rewards)
    if total_bonus > 0:
        c.execute("UPDATE cyberdrip_daily_log SET bonus_earned = bonus_earned + ? WHERE wallet = ? AND claim_date = ?",
                  (total_bonus, wallet_lower, today))

    conn.commit()
    conn.close()

    return {
        "status": "ok",
        "total_claims": new_total,
        "streak_days": streak,
        "rank_tier": new_tier,
        "exp_earned": 10.0,
        "rank_name": RANK_TIERS[new_tier]["name"],
        "missions_completed": completed_rewards,
        "bonus_earned": total_bonus
    }


# --- Leaderboard ---

@app.get("/api/cyberdrip/leaderboard")
async def get_cyberdrip_leaderboard(limit: int = 10):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""
        SELECT wallet, total_claims, total_earned, streak_days, rank_tier
        FROM cyberdrip_profiles
        ORDER BY total_earned DESC
        LIMIT ?
    """, (min(limit, 50),))
    rows = c.fetchall()
    conn.close()

    result = []
    for i, row in enumerate(rows):
        tier = row["rank_tier"]
        result.append({
            "position": i + 1,
            "wallet": row["wallet"],
            "total_claims": row["total_claims"],
            "total_earned": round(row["total_earned"], 2),
            "streak_days": row["streak_days"],
            "rank_tier": tier,
            "rank_name": RANK_TIERS[tier]["name"] if tier < len(RANK_TIERS) else "UNKNOWN"
        })
    return result


# --- Data Intercept mini-game verification ---

class MinigameVerify(BaseModel):
    wallet: str
    score: int

@app.post("/api/cyberdrip/minigame/verify")
async def verify_minigame(req: MinigameVerify):
    """
    Verify Data Intercept (Whack-a-mole) solution.
    The frontend calculates the score (valid hits - corrupted hits).
    We award bonus based on the score. Max score ~ 15.
    """
    wallet_lower = req.wallet.strip().lower()
    now_ts = int(_time.time())

    # Rate limit: max 1 game per 60 seconds
    conn = get_db_connection()
    c = conn.cursor()
    # We still use the cyberdrip_hackgrid_log table to keep it simple, just storing score in 'solved'
    c.execute("SELECT timestamp FROM cyberdrip_hackgrid_log WHERE wallet = ? ORDER BY timestamp DESC LIMIT 1",
              (wallet_lower,))
    last = c.fetchone()
    if last and (now_ts - last["timestamp"]) < 60:
        conn.close()
        raise HTTPException(status_code=429, detail="Minigame cooldown: 60s entre tentativas")

    score = max(0, req.score)
    
    # Calculate bonus: 0.05 CLAIM per point, max 0.75 CLAIM
    bonus = min(0.75, round(score * 0.05, 2))

    # Check for active booster multiplier on minigame
    c.execute("SELECT multiplier, booster_type FROM cyberdrip_boosters WHERE wallet = ? AND expires_at > ?",
              (wallet_lower, now_ts))
    for b in c.fetchall():
        if b["booster_type"] == "QUANTUM_SURGE":
            bonus = round(bonus * 2.0, 2)
            break

    c.execute("INSERT INTO cyberdrip_hackgrid_log (wallet, solved, bonus, timestamp) VALUES (?, ?, ?, ?)",
              (wallet_lower, score, bonus, now_ts))
              
    exp_earned = score * 2.0
    if exp_earned > 0:
        c.execute("UPDATE cyberdrip_profiles SET exp = exp + ? WHERE wallet = ?", (exp_earned, wallet_lower))
        
    conn.commit()
    conn.close()

    return {
        "score": score,
        "bonus": bonus,
        "exp_earned": exp_earned,
        "message": f"+{bonus} CLAIM interceptado!" if bonus > 0 else "Nenhum dado capturado. Tente novamente após o cooldown."
    }

# --- Profile Stats (Histogram and NFTs) ---

@app.get("/api/cyberdrip/profile/{wallet}/stats")
async def get_cyberdrip_stats(wallet: str):
    wallet_lower = wallet.strip().lower()
    conn = get_db_connection()
    c = conn.cursor()
    
    # Histogram (last 30 days)
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    c.execute("SELECT claim_date, claims_today, bonus_earned FROM cyberdrip_daily_log WHERE wallet = ? AND claim_date >= ? ORDER BY claim_date ASC",
              (wallet_lower, thirty_days_ago))
    daily_logs = [dict(row) for row in c.fetchall()]
    
    # NFTs
    c.execute("SELECT * FROM cyberdrip_nfts WHERE wallet = ? ORDER BY acquired_at DESC", (wallet_lower,))
    nfts = [dict(row) for row in c.fetchall()]
    
    conn.close()
    
    return {
        "daily_logs": daily_logs,
        "nfts": nfts
    }



# --- Booster Shop ---

class BoosterBuyRequest(BaseModel):
    wallet: str
    booster_type: str

@app.post("/api/cyberdrip/booster/buy")
async def buy_booster(req: BoosterBuyRequest):
    """Buy a booster — debit CLAIM from L2 virtual balance, apply burn + treasury split."""
    wallet_lower = req.wallet.strip().lower()
    btype = req.booster_type.upper()

    if btype not in BOOSTER_CATALOG:
        raise HTTPException(status_code=400, detail=f"Booster desconhecido: {btype}")

    catalog = BOOSTER_CATALOG[btype]
    cost = catalog["cost"]
    now_ts = int(_time.time())

    conn = get_db_connection()
    c = conn.cursor()

    # Check if already has active booster of this type
    c.execute("SELECT id FROM cyberdrip_boosters WHERE wallet = ? AND booster_type = ? AND expires_at > ?",
              (wallet_lower, btype, now_ts))
    if c.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Você já possui este booster ativo!")

    # Check user's L2 virtual balance from microclaims_ledger (FaucetInternal)
    FAUCET_WALLET = "0x84da71247cbfb0737a9112de1f10dae9823fc298"
    c.execute("SELECT virtual_balance FROM microclaims_ledger WHERE faucet_wallet = ? AND user_wallet = ?",
              (FAUCET_WALLET, wallet_lower))
    ledger_row = c.fetchone()
    current_balance = ledger_row["virtual_balance"] if ledger_row else 0.0

    if current_balance < cost:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente! Necessário: {cost} CLAIM, Disponível: {current_balance:.2f} CLAIM")

    # Debit balance
    new_balance = current_balance - cost
    c.execute("UPDATE microclaims_ledger SET virtual_balance = ? WHERE faucet_wallet = ? AND user_wallet = ?",
              (new_balance, FAUCET_WALLET, wallet_lower))

    # Calculate burn and treasury split
    burned = round(cost * catalog["burn_pct"], 4)
    treasury = round(cost * catalog["treasury_pct"], 4)

    # Insert booster
    expires_at = now_ts + (catalog["duration_h"] * 3600)
    c.execute("""
        INSERT INTO cyberdrip_boosters (wallet, booster_type, multiplier, activated_at, expires_at, cost, burned, treasury)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (wallet_lower, btype, catalog["multiplier"], now_ts, expires_at, cost, burned, treasury))

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "booster": btype,
        "label": catalog["label"],
        "multiplier": catalog["multiplier"],
        "duration_hours": catalog["duration_h"],
        "expires_at": expires_at,
        "cost_paid": cost,
        "burned": burned,
        "treasury_funded": treasury,
        "new_balance": round(new_balance, 2)
    }

# --- Booster Catalog (public) ---

@app.get("/api/cyberdrip/boosters/catalog")
async def get_booster_catalog():
    return [{"type": k, **v} for k, v in BOOSTER_CATALOG.items()]


# --- EMAIL AUTHENTICATION SYSTEM ---
import hashlib
import secrets
import hmac

class RegisterRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str


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

def hash_password(password: str) -> str:
    salt = os.getenv("PASSWORD_SALT")
    if not salt:
        raise RuntimeError("PASSWORD_SALT is not configured")
    return hmac.new(salt.encode(), password.encode(), hashlib.sha256).hexdigest()

@app.post("/api/auth/register")
async def register_user(req: RegisterRequest):
    email = req.email.strip().lower()
    password = req.password
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are both required.")
    if len(password) < PASSWORD_MIN_LENGTH:
        raise HTTPException(status_code=400, detail=f"The password needs at least {PASSWORD_MIN_LENGTH} characters.")
        
    password_hash = hash_password(password)
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
        raise HTTPException(status_code=400, detail="That email is already registered.")
        
    conn.close()
    return {"status": "success", "wallet_address": wallet_address, "email": email}

@app.post("/api/auth/guest")
async def create_guest_account():
    """A one-click account whose key this server holds.

    This replaces a button labelled "Sign in with Google" that spoke neither to
    Google nor to this server: it minted an identity in the browser. Since that
    identity was not an 0x address, is_custodial_address waved it through and
    every signature check was skipped. A guest is now a real row here, with a
    real custodial address, trusted exactly as much as an email account is.
    """
    wallet_address = "0x" + secrets.token_hex(20)
    email = f"guest_{secrets.token_hex(8)}@guest.faucetchain.local"
    # The column cannot be null and no one should be able to sign in to a guest
    # account later, so it holds the hash of a secret nobody was told.
    password_hash = hash_password(secrets.token_hex(32))

    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute(
            "INSERT INTO users (email, password_hash, wallet_address, created_at) VALUES (?, ?, ?, ?)",
            (email, password_hash, wallet_address, int(datetime.now().timestamp())),
        )
        conn.commit()
    finally:
        conn.close()
    return {"status": "success", "wallet_address": wallet_address, "guest": True}


@app.post("/api/auth/login")
async def login_user(req: LoginRequest):
    email = req.email.strip().lower()
    password = req.password
    password_hash = hash_password(password)
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT wallet_address FROM users WHERE email = ? AND password_hash = ?", (email, password_hash))
    row = c.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
        
    return {"status": "success", "wallet_address": row[0], "email": email}

# -----------------------------------
# SENTINEL AI - CEREBRO CENTRALIZADO L1
# -----------------------------------
try:
    from google import genai
except ImportError:
    pass # SerA instalado via requirements

class AISentinelRequest(BaseModel):
    context: str
    prompt: str

@app.post("/api/ai/sentinel")
async def ai_sentinel_inference(req: AISentinelRequest):
    """
    Motor AvanA§ado de IA da FaucetChain que injeta dados do SQLite (L1)
    para o Google Gemini, criando um contexto massivamente superior.
    """
    import re
    
    real_context = ""
    # Tenta extrair carteira do contexto ("EndereA§o: 0x...")
    match = re.search(r"0x[a-fA-F0-9]{40}", req.context)
    if match:
        user_address = match.group(0).lower()
        conn = get_db_connection()
        c = conn.cursor()
        
        try:
            c.execute("SELECT IFNULL(SUM(amount), 0) FROM user_claims WHERE user_address = ?", (user_address,))
            row = c.fetchone()
            total_claims = row[0] if row else 0
            
            c.execute("SELECT COUNT(*) FROM transactions WHERE from_address = ? OR to_address = ?", (user_address, user_address))
            row = c.fetchone()
            tx_count = row[0] if row else 0
            
            # Was: reputation = min(100, 75 + tx_count), shown to the user as
            # "Sentinel-audited reputation". Sentinel never saw it -- anyone
            # with no activity scored 75%. Report what is actually counted.
            real_context = (
                f"\n[LEDGER L1] Claimed: {total_claims:.2f} $CLAIM | "
                f"Transactions recorded: {tx_count}\n"
            )
        except Exception:
            pass
        finally:
            conn.close()
    
    # Configurar o CA©rebro GenAI (Gemini) usando a key do test_genai ou variavel de ambiente
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")
    
    try:
        client = genai.Client(api_key=api_key)
        
        full_prompt = f"""
        VOCAŠ A‰ A SENTINEL AI - CA‰REBRO ON-CHAIN DA FAUCETCHAIN L1.
        
        CONTEXTO ATUAL DE TELA:
        {req.context}
        {real_context}
        
        DCAVIDA DO USUARIO:
        {req.prompt}
        
        Aja como um Arquiteto e GuardiA£o da Rede. Use OS DADOS REAIS L1 (se disponA-veis acima) na sua anAilise.
        Responda de forma direta e tA©cnica.
        """
        
        # Testado na infraestrutura local do usuario (test_genai)
        response = client.models.generate_content(
            model="gemini-3-flash-preview", 
            contents=full_prompt
        )
        return {"insight": response.text}
        
    except Exception as e:
        print(f"GenAI Sentinel Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro de Conexão com o Cérebro IA Sentinel: {str(e)}")

# --- Settlement on Solana ---------------------------------------------------
# The appchain keeps distributing; the partner's budget sits in a vault on
# Solana and only leaves it against a Merkle root published by this sequencer
# (the program lives in faucetchain/programs/faucetchain). Here we close the
# batch and serve the proof a user presents to the program to withdraw.


SETTLEMENT_OPERATOR_TOKEN = os.getenv("SETTLEMENT_OPERATOR_TOKEN")


def init_settlement_tables():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS solana_links (
            user_address TEXT PRIMARY KEY,
            solana_address TEXT NOT NULL,
            linked_at INTEGER NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS settlement_campaigns (
            campaign_id INTEGER PRIMARY KEY,
            sponsor TEXT NOT NULL,
            mint TEXT NOT NULL,
            registered_at INTEGER NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS settlement_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            root_index INTEGER NOT NULL,
            root TEXT NOT NULL,
            total_amount INTEGER NOT NULL,
            leaf_count INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            published_signature TEXT,
            UNIQUE (campaign_id, root_index)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS settlement_rewards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            user_address TEXT NOT NULL,
            amount INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            batch_id INTEGER REFERENCES settlement_batches(id),
            solana_address TEXT
        )
    ''')
    try:
        c.execute("ALTER TABLE settlement_rewards ADD COLUMN solana_address TEXT")
    except sqlite3.OperationalError:
        pass  # column already there
    conn.commit()
    conn.close()


@app.on_event("startup")
def startup_settlement():
    init_settlement_tables()


def require_operator(token: Optional[str]) -> None:
    """Crediting a reward and closing a batch are the sequencer's, not a user's."""
    if not SETTLEMENT_OPERATOR_TOKEN:
        raise HTTPException(status_code=503, detail="SETTLEMENT_OPERATOR_TOKEN is not configured")
    if not token or not hmac.compare_digest(token, SETTLEMENT_OPERATOR_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid operator token")


def _batch_rewards(c, batch_id: int) -> Dict[str, int]:
    """A batch's rewards, summed per Solana wallet.

    Reads the address written onto the row when the batch closed, never the
    user's current link. A root on Solana pays the wallet it was built for, so
    someone who relinks afterwards must still be able to withdraw the reward
    that root already promised.
    """
    c.execute(
        """SELECT solana_address, SUM(amount)
             FROM settlement_rewards
            WHERE batch_id = ? AND solana_address IS NOT NULL
            GROUP BY solana_address""",
        (batch_id,),
    )
    return {row[0]: int(row[1]) for row in c.fetchall()}


# Rebuilding a tree costs real CPU — about 0.7s for ten thousand leaves — and
# every proof request pays it. A closed batch never changes, so the rebuilt
# tree is cached; only a tree that matched its published root is ever stored.
_batch_trees: Dict[int, dict] = {}


def _batch_tree(c, batch_id: int, published_root: str):
    cached = _batch_trees.get(batch_id)
    if cached is not None:
        return cached
    rebuilt = settlement.build_batch(_batch_rewards(c, batch_id))
    if rebuilt["root"] != published_root:
        return None
    if len(_batch_trees) >= 256:
        _batch_trees.clear()
    _batch_trees[batch_id] = rebuilt
    return rebuilt


class CampaignRegisterRequest(BaseModel):
    campaign_id: int
    sponsor: str
    mint: str


@app.post("/api/solana/campaign")
async def register_campaign(
    req: CampaignRegisterRequest, x_operator_token: Optional[str] = Header(None)
):
    """Records the campaign that was opened on Solana.

    The sponsor and the mint are what a withdrawal needs to be built: the
    campaign address is derived from the sponsor, and the tokens come from that
    mint. Keeping them here is what lets one sequencer serve more than one
    partner.
    """
    require_operator(x_operator_token)
    for name, value in (("sponsor", req.sponsor), ("mint", req.mint)):
        try:
            settlement.decode_pubkey(value.strip())
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"{name}: {e}")

    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """INSERT INTO settlement_campaigns (campaign_id, sponsor, mint, registered_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(campaign_id) DO UPDATE SET sponsor = excluded.sponsor,
                                                  mint = excluded.mint""",
        (req.campaign_id, req.sponsor.strip(), req.mint.strip(), int(_time.time())),
    )
    conn.commit()
    conn.close()
    return {"status": "registered", "campaign_id": req.campaign_id}


@app.get("/api/solana/campaigns")
async def list_campaigns():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "SELECT campaign_id, sponsor, mint, registered_at FROM settlement_campaigns ORDER BY campaign_id"
    )
    rows = c.fetchall()
    conn.close()
    return {
        "campaigns": [
            {"campaign_id": r[0], "sponsor": r[1], "mint": r[2], "registered_at": r[3]}
            for r in rows
        ]
    }


class SolanaLinkRequest(BaseModel):
    address: str
    solana_address: str
    signature: Optional[str] = None
    sig_timestamp: Optional[int] = None
    solana_signature: Optional[str] = None
    solana_sig_timestamp: Optional[int] = None


def require_solana_ownership(
    solana_address: str, message: str, signature: Optional[str], sig_timestamp: Optional[int]
):
    """Proves the user controls the Solana wallet, not merely that they named it.

    The FaucetChain signature says who chose the wallet. This one says who holds
    its key. Both matter: a reward inside a published root pays the address on
    the leaf and nothing can redirect it afterwards, so a wallet named by typo
    is money burned.

    `signature` is the raw 64-byte ed25519 signature, base64 encoded -- the same
    encoding the relayer already uses for transactions, so the browser needs no
    base58 library.
    """
    if not signature:
        raise HTTPException(
            status_code=401,
            detail="Sign the link with the Solana wallet as well, to prove you control it.",
        )
    import base64

    # Its own timestamp, not the FaucetChain one: a custodial account signs no
    # EIP-191 message at all and would arrive here with none.
    if not sig_timestamp:
        raise HTTPException(status_code=401, detail="Missing timestamp on the wallet proof")
    if abs(int(_time.time()) - int(sig_timestamp)) > SIGNATURE_MAX_AGE:
        raise HTTPException(status_code=401, detail="The wallet proof expired. Sign again.")

    try:
        from solders.pubkey import Pubkey
        from solders.signature import Signature
    except ImportError:
        raise HTTPException(status_code=503, detail="solders is not installed on the sequencer")

    try:
        raw = base64.b64decode(signature, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed Solana signature")
    if len(raw) != 64:
        raise HTTPException(status_code=400, detail="A Solana signature is 64 bytes")

    try:
        parsed = Signature.from_bytes(raw)
        owner = Pubkey.from_string(solana_address)
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed Solana signature")

    if not parsed.verify(owner, message.encode("utf-8")):
        raise HTTPException(
            status_code=401,
            detail="That signature does not come from the wallet being linked.",
        )


@app.post("/api/solana/link")
async def link_solana_wallet(req: SolanaLinkRequest):
    """Links a FaucetChain account to the wallet that will withdraw on Solana."""
    user = req.address.strip().lower()
    if not re.fullmatch(r"0x[0-9a-f]{40}", user):
        raise HTTPException(status_code=400, detail="Invalid FaucetChain address")
    solana_address = req.solana_address.strip()
    try:
        settlement.decode_pubkey(solana_address)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    require_action_signature(
        user,
        settlement.link_message(user, solana_address, CHAIN_ID, req.sig_timestamp or 0),
        req.signature,
        req.sig_timestamp,
    )
    # A second, separate proof: the first says who chose this wallet, this one
    # says who holds its key. A different verb so neither signature can stand in
    # for the other.
    require_solana_ownership(
        solana_address,
        settlement.wallet_proof_message(
            user, solana_address, CHAIN_ID, req.solana_sig_timestamp or 0
        ),
        req.solana_signature,
        req.solana_sig_timestamp,
    )

    conn = get_db_connection()
    c = conn.cursor()
    # Changing the wallet only affects future batches: a batch already closed
    # has its root on Solana and cannot change who it pays.
    c.execute(
        """INSERT INTO solana_links (user_address, solana_address, linked_at)
           VALUES (?, ?, ?)
           ON CONFLICT(user_address) DO UPDATE SET solana_address = excluded.solana_address,
                                                   linked_at = excluded.linked_at""",
        (user, solana_address, int(_time.time())),
    )
    conn.commit()
    conn.close()
    return {"status": "linked", "address": user, "solana_address": solana_address}


@app.get("/api/solana/link/{address}")
async def get_solana_link(address: str):
    user = address.strip().lower()
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT solana_address, linked_at FROM solana_links WHERE user_address = ?", (user,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="No Solana wallet linked to this address")
    return {"address": user, "solana_address": row[0], "linked_at": row[1]}


class RewardCreditRequest(BaseModel):
    campaign_id: int
    address: str
    amount: int


@app.post("/api/solana/reward")
async def credit_settlement_reward(
    req: RewardCreditRequest, x_operator_token: Optional[str] = Header(None)
):
    """Records a reward owed in the campaign. It becomes money in the next batch."""
    require_operator(x_operator_token)
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    user = req.address.strip().lower()
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO settlement_rewards (campaign_id, user_address, amount, created_at) VALUES (?, ?, ?, ?)",
        (req.campaign_id, user, req.amount, int(_time.time())),
    )
    conn.commit()
    conn.close()
    return {"status": "credited", "campaign_id": req.campaign_id, "address": user, "amount": req.amount}


class CloseBatchRequest(BaseModel):
    campaign_id: int


@app.post("/api/solana/batch")
async def close_settlement_batch(
    req: CloseBatchRequest, x_operator_token: Optional[str] = Header(None)
):
    """Closes the batch: the root that comes out of here is the one the program gets."""
    require_operator(x_operator_token)
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        """SELECT r.id, l.solana_address, r.amount
             FROM settlement_rewards r
             JOIN solana_links l ON l.user_address = r.user_address
            WHERE r.campaign_id = ? AND r.batch_id IS NULL""",
        (req.campaign_id,),
    )
    pending = c.fetchall()
    if not pending:
        conn.close()
        raise HTTPException(status_code=400, detail="Nothing to settle in this campaign")

    rewards: Dict[str, int] = defaultdict(int)
    for _, solana_address, amount in pending:
        rewards[solana_address] += int(amount)
    batch = settlement.build_batch(rewards)

    c.execute("SELECT COUNT(*) FROM settlement_batches WHERE campaign_id = ?", (req.campaign_id,))
    root_index = c.fetchone()[0]
    c.execute(
        """INSERT INTO settlement_batches
               (campaign_id, root_index, root, total_amount, leaf_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            req.campaign_id,
            root_index,
            batch["root"],
            batch["total_amount"],
            batch["leaf_count"],
            int(_time.time()),
        ),
    )
    batch_id = c.lastrowid
    # The wallet each reward was built for is written onto the row: the root is
    # about to be published, and from here on it pays that wallet whatever the
    # user links later.
    c.executemany(
        "UPDATE settlement_rewards SET batch_id = ?, solana_address = ? WHERE id = ?",
        [(batch_id, row[1], row[0]) for row in pending],
    )
    conn.commit()
    conn.close()
    return {
        "status": "closed",
        "batch_id": batch_id,
        "campaign_id": req.campaign_id,
        "root_index": root_index,
        "root": batch["root"],
        "total_amount": batch["total_amount"],
        "leaf_count": batch["leaf_count"],
    }


class BatchPublishedRequest(BaseModel):
    signature: str


@app.post("/api/solana/batch/{batch_id}/published")
async def mark_batch_published(
    batch_id: int, req: BatchPublishedRequest, x_operator_token: Optional[str] = Header(None)
):
    """Stores the transaction that took the root to Solana, for auditing."""
    require_operator(x_operator_token)
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "UPDATE settlement_batches SET published_signature = ? WHERE id = ?",
        (req.signature.strip(), batch_id),
    )
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Batch not found")
    conn.commit()
    conn.close()
    return {"status": "published", "batch_id": batch_id, "signature": req.signature.strip()}


@app.get("/api/solana/batches")
async def list_settlement_batches(campaign_id: Optional[int] = None, limit: int = 50):
    conn = get_db_connection()
    c = conn.cursor()
    query = """SELECT id, campaign_id, root_index, root, total_amount, leaf_count,
                      created_at, published_signature
                 FROM settlement_batches"""
    params: list = []
    if campaign_id is not None:
        query += " WHERE campaign_id = ?"
        params.append(campaign_id)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(max(1, min(limit, 200)))
    c.execute(query, params)
    rows = c.fetchall()
    conn.close()
    return {
        "batches": [
            {
                "batch_id": row[0],
                "campaign_id": row[1],
                "root_index": row[2],
                "root": row[3],
                "total_amount": row[4],
                "leaf_count": row[5],
                "created_at": row[6],
                "published_signature": row[7],
            }
            for row in rows
        ]
    }


@app.get("/api/solana/ledger/{campaign_id}")
async def get_campaign_ledger(campaign_id: int):
    """What Solana says about a campaign, not what this server says.

    The vault balance, the totals on the campaign account and every published
    root come from the chain. The sequencer only supplies the addresses, so
    anyone can recompute the same view without asking it anything.
    """
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "SELECT sponsor, mint FROM settlement_campaigns WHERE campaign_id = ?", (campaign_id,)
    )
    registered = c.fetchone()
    c.execute(
        """SELECT root_index, root, total_amount, leaf_count, created_at, published_signature
             FROM settlement_batches WHERE campaign_id = ? ORDER BY root_index""",
        (campaign_id,),
    )
    batches = c.fetchall()
    conn.close()
    if not registered:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} is not registered here")

    off_chain = [
        {
            "root_index": row[0],
            "root": row[1],
            "total_amount": row[2],
            "leaf_count": row[3],
            "created_at": row[4],
            "published_signature": row[5],
        }
        for row in batches
    ]
    result = {
        "campaign_id": campaign_id,
        "sponsor": registered[0],
        "mint": registered[1],
        "batches": off_chain,
        "on_chain": None,
    }

    try:
        import solana_settlement as chain

        idl = chain.load_idl()
    except (ImportError, SystemExit):
        return result

    from solders.pubkey import Pubkey

    pid = chain.program_id(idl)
    campaign = chain.campaign_pda(pid, Pubkey.from_string(registered[0]), campaign_id)
    vault = chain.vault_pda(pid, campaign)
    roots = [chain.root_pda(pid, campaign, item["root_index"]) for item in off_chain]

    try:
        rpc_url = chain.default_rpc_url()
        accounts = chain.fetch_accounts(rpc_url, [campaign] + roots)
        vault_amount = chain.token_balance(rpc_url, vault)
    except Exception as e:
        # The page says the chain could not be read, rather than quietly
        # falling back to numbers this server made up.
        audit_logger.warning(f"Could not read campaign {campaign_id} from Solana: {e}")
        return result

    if accounts[0] is None:
        return result

    state = chain.decode_campaign(accounts[0])
    state["vault"] = str(vault)
    state["vault_amount"] = vault_amount
    state["address"] = str(campaign)
    for item, data, address in zip(off_chain, accounts[1:], roots):
        item["address"] = str(address)
        item["on_chain"] = chain.decode_reward_root(data) if data else None
    result["on_chain"] = state
    return result


@app.get("/api/solana/proof/{address}")
async def get_settlement_proofs(address: str):
    """A user's proofs, one per batch they were part of."""
    user = address.strip().lower()
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT solana_address FROM solana_links WHERE user_address = ?", (user,))
    link = c.fetchone()
    if not link:
        conn.close()
        raise HTTPException(status_code=404, detail="No Solana wallet linked to this address")
    solana_address = link[0]

    # MIN() only picks the value out of the group: every row a user has in one
    # batch carries the wallet that batch was built for.
    c.execute(
        """SELECT b.id, b.campaign_id, b.root_index, b.root, b.published_signature,
                  MIN(r.solana_address)
             FROM settlement_batches b
             JOIN settlement_rewards r ON r.batch_id = b.id
            WHERE r.user_address = ? AND r.solana_address IS NOT NULL
            GROUP BY b.id
            ORDER BY b.id DESC""",
        (user,),
    )
    batches = c.fetchall()

    proofs = []
    for batch_id, campaign_id, root_index, root, signature, paid_to in batches:
        rebuilt = _batch_tree(c, batch_id, root)
        if rebuilt is None:
            # The published root is the truth; serving a proof from a different
            # tree would make the user spend a fee on a transaction the program
            # rejects.
            audit_logger.error(f"Settlement batch {batch_id} no longer rebuilds to its published root")
            continue
        claim = next((x for x in rebuilt["claims"] if x["recipient"] == paid_to), None)
        if claim:
            proofs.append(
                {
                    "batch_id": batch_id,
                    "campaign_id": campaign_id,
                    "root_index": root_index,
                    "root": root,
                    "published_signature": signature,
                    "claimed": None,
                    **claim,
                }
            )
    _mark_claimed(c, proofs)
    conn.close()
    return {"address": user, "solana_address": solana_address, "proofs": proofs}


def _mark_claimed(c, proofs: list) -> None:
    """Says which of these rewards have already been withdrawn.

    A user who reloads the page should see what they collected, not a button
    that fails. It stays None when the chain cannot be asked, so the screen says
    nothing rather than something wrong.
    """
    if not proofs:
        return
    try:
        import solana_settlement as chain

        idl = chain.load_idl()
    except (ImportError, SystemExit):
        return

    from solders.pubkey import Pubkey

    pid = chain.program_id(idl)
    receipts = {}
    for proof in proofs:
        c.execute(
            "SELECT sponsor FROM settlement_campaigns WHERE campaign_id = ?", (proof["campaign_id"],)
        )
        row = c.fetchone()
        if not row:
            continue
        campaign = chain.campaign_pda(pid, Pubkey.from_string(row[0]), proof["campaign_id"])
        reward_root = chain.root_pda(pid, campaign, proof["root_index"])
        receipts[proof["batch_id"]] = str(
            chain.receipt_pda(pid, reward_root, proof["leaf_index"])
        )

    claimed = _receipts_claimed(chain, sorted(set(receipts.values())))
    if claimed is None:
        return
    for proof in proofs:
        address = receipts.get(proof["batch_id"])
        if address:
            proof["claimed"] = address in claimed


# --- The relayer -------------------------------------------------------------
# A user who earned fractions of a cent does not hold SOL, and asking them to
# buy some to collect a reward defeats the whole thing. The program already
# takes the fee payer as a signer separate from the recipient; this is the
# service that signs as that payer.
#
# It only ever signs a transaction it built itself. The client gets an unsigned
# withdrawal, adds the recipient's signature, and sends it back; before adding
# its own, the relayer rebuilds what it expects byte for byte and refuses
# anything else. So a caller cannot get the relayer's key to pay for a
# transaction of their choosing.

SETTLEMENT_RELAYER_KEYPAIR = os.getenv("SETTLEMENT_RELAYER_KEYPAIR")


def _relayer():
    if not SETTLEMENT_RELAYER_KEYPAIR:
        raise HTTPException(status_code=503, detail="SETTLEMENT_RELAYER_KEYPAIR is not configured")
    try:
        import solana_settlement as chain  # optional: the appchain runs without it
    except ImportError:
        raise HTTPException(status_code=503, detail="solders is not installed on the sequencer")
    return chain, chain.load_keypair(SETTLEMENT_RELAYER_KEYPAIR)


def _rpc_or_503(chain, method: str, params: list):
    """An unreachable chain is a 503 with a reason, not a stack trace."""
    try:
        return chain.rpc(chain.default_rpc_url(), method, params)
    except SystemExit as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Solana is unreachable: {e}")


def _receipts_claimed(chain, receipts: List[str]) -> Optional[set]:
    """Which of these receipt accounts already exist on Solana.

    A receipt exists once its leaf has been withdrawn, and the program refuses
    the second attempt. Asking first is what stops the relayer from paying the
    fee to find that out. Returns None when the chain cannot be reached: the
    program is still the real guard, so an unreachable RPC costs a wasted fee
    at worst and must not block anyone's withdrawal.
    """
    if not receipts:
        return set()
    try:
        accounts = chain.rpc(
            chain.default_rpc_url(),
            "getMultipleAccounts",
            [receipts, {"commitment": "confirmed", "encoding": "base64"}],
        )["value"]
    except Exception as e:
        audit_logger.warning(f"Could not read receipt accounts, letting the withdrawal through: {e}")
        return None
    return {address for address, account in zip(receipts, accounts) if account}


def _claim_instruction(c, chain, relayer, user: str, batch_id: int):
    """The one withdrawal this user can make from this batch, and nothing else."""
    c.execute(
        """SELECT b.campaign_id, b.root_index, b.root, MIN(r.solana_address)
             FROM settlement_batches b
             JOIN settlement_rewards r ON r.batch_id = b.id
            WHERE b.id = ? AND r.user_address = ? AND r.solana_address IS NOT NULL
            GROUP BY b.id""",
        (batch_id, user),
    )
    row = c.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No reward for this address in that batch")
    campaign_id, root_index, root, paid_to = row

    c.execute(
        "SELECT sponsor, mint FROM settlement_campaigns WHERE campaign_id = ?", (campaign_id,)
    )
    campaign = c.fetchone()
    if not campaign:
        raise HTTPException(
            status_code=409, detail=f"Campaign {campaign_id} was never registered on this sequencer"
        )

    rebuilt = _batch_tree(c, batch_id, root)
    if rebuilt is None:
        raise HTTPException(status_code=409, detail="Batch no longer rebuilds to its published root")
    claim = next((x for x in rebuilt["claims"] if x["recipient"] == paid_to), None)
    if claim is None:
        raise HTTPException(status_code=404, detail="No leaf for this wallet in that batch")

    from solders.pubkey import Pubkey

    instruction = chain.claim_reward(
        chain.load_idl(),
        Pubkey.from_string(paid_to),
        relayer.pubkey(),
        Pubkey.from_string(campaign[0]),
        Pubkey.from_string(campaign[1]),
        campaign_id,
        root_index,
        claim["leaf_index"],
        claim["amount"],
        [bytes.fromhex(s[2:]) for s in claim["proof"]],
    )

    # Account 4 is the receipt, per the IDL. If it is already there the leaf was
    # withdrawn, and signing would only pay for a transaction the program
    # rejects.
    receipt = str(instruction.accounts[4].pubkey)
    if _receipts_claimed(chain, [receipt]) == {receipt}:
        raise HTTPException(status_code=409, detail="That reward has already been withdrawn")

    return instruction, claim, paid_to


class RelayPrepareRequest(BaseModel):
    address: str
    batch_id: int


@app.post("/api/solana/relay/prepare")
async def prepare_relayed_claim(req: RelayPrepareRequest):
    """Builds the withdrawal. The user only has to sign it."""
    chain, relayer = _relayer()
    conn = get_db_connection()
    c = conn.cursor()
    try:
        instruction, claim, paid_to = _claim_instruction(
            c, chain, relayer, req.address.strip().lower(), req.batch_id
        )
    finally:
        conn.close()

    import base64

    from solders.hash import Hash
    from solders.message import Message
    from solders.transaction import Transaction

    blockhash = _rpc_or_503(chain, "getLatestBlockhash", [{"commitment": "confirmed"}])["value"]["blockhash"]
    message = Message.new_with_blockhash(
        [instruction], relayer.pubkey(), Hash.from_string(blockhash)
    )
    return {
        "transaction": base64.b64encode(bytes(Transaction.new_unsigned(message))).decode(),
        "recipient": paid_to,
        "amount": claim["amount"],
        "leaf_index": claim["leaf_index"],
        "fee_payer": str(relayer.pubkey()),
    }


class RelaySubmitRequest(BaseModel):
    address: str
    batch_id: int
    transaction: str


@app.post("/api/solana/relay/submit")
async def submit_relayed_claim(req: RelaySubmitRequest):
    """Signs as fee payer and sends — but only the withdrawal we built."""
    chain, relayer = _relayer()
    conn = get_db_connection()
    c = conn.cursor()
    try:
        expected, claim, _ = _claim_instruction(
            c, chain, relayer, req.address.strip().lower(), req.batch_id
        )
    finally:
        conn.close()

    import base64

    from solders.transaction import Transaction

    try:
        transaction = Transaction.from_bytes(base64.b64decode(req.transaction))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Not a Solana transaction: {e}")

    message = transaction.message
    keys = message.account_keys
    if len(message.instructions) != 1:
        raise HTTPException(status_code=400, detail="The transaction must carry one instruction")
    compiled = message.instructions[0]
    if keys[0] != relayer.pubkey():
        raise HTTPException(status_code=400, detail="The relayer must be the fee payer")
    if keys[compiled.program_id_index] != expected.program_id:
        raise HTTPException(status_code=400, detail="That instruction is not for the settlement program")
    if bytes(compiled.data) != bytes(expected.data):
        raise HTTPException(status_code=400, detail="The instruction is not the withdrawal we built")
    if [keys[i] for i in compiled.accounts] != [meta.pubkey for meta in expected.accounts]:
        raise HTTPException(status_code=400, detail="The accounts are not the ones we built")

    transaction.partial_sign([relayer], message.recent_blockhash)
    try:
        transaction.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="The recipient did not sign the withdrawal")

    signature = _rpc_or_503(
        chain,
        "sendTransaction",
        [
            base64.b64encode(bytes(transaction)).decode(),
            {"encoding": "base64", "preflightCommitment": "confirmed"},
        ],
    )
    audit_logger.info(f"Relayed withdrawal of {claim['amount']} in batch {req.batch_id}: {signature}")
    return {"signature": signature, "amount": claim["amount"]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# --- Frontend Serving (Must be at the bottom) ---
if os.path.isdir("dist"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
            
        file_path = f"dist/{full_path}"
        if os.path.isfile(file_path) and not os.path.isdir(file_path):
            return FileResponse(file_path)
            
        return FileResponse("dist/index.html")

if __name__ == "__main__":
    import sqlite3 
    import uvicorn
    print("[*] Starting FaucetChain Vector Knowledge API...")
    print("[>] API will be available at: http://localhost:8000")
    print("[>] Docs available at: http://localhost:8000/docs")
    
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )
