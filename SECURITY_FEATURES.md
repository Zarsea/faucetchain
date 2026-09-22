# FaucetChain Vector DB - Security Features

> **Scope: the knowledge base, not the chain.** This file covers the vector
> store behind the in-app assistant — input sanitization, rate limits, audit
> logging. The file name is broader than the contents, so it is worth saying
> plainly.
>
> The chain's security model is a different thing and lives in two places:
> [ARCHITECTURE.md](ARCHITECTURE.md) explains what a request has to prove and
> who may act without signing, and `test_endpoint_inventory.py` enforces it —
> it walks every route the app declares and fails on any that changes state and
> trusts nobody. A route is allowed to be open only by being named there with
> its reason.

## 🔒 Implemented Security Measures

### 1. **Input Sanitization**

**Purpose:** Prevent injection attacks (SQL, XSS, etc.)

**Implementation:**
```python
def sanitize_input(text: str) -> str:
    # Remove script tags
    text = re.sub(r'<script[^>]*>.*?</script>', '', text)
    
    # Remove SQL injection patterns
    sql_patterns = [r';\s*DROP', r';\s*DELETE', r'UNION\s+SELECT']
    for pattern in sql_patterns:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    
    # Limit length (max 1000 chars)
    return text[:1000].strip()
```

**Applied to:**
- All search queries
- Document content
- Metadata fields

---

### 2. **Rate Limiting**

**Purpose:** Prevent DoS attacks and abuse

**Configuration:**
- **Limit:** 100 requests per minute per IP
- **Window:** 60 seconds rolling window
- **Storage:** In-memory (use Redis for production)

**Response when exceeded:**
```json
{
  "status_code": 429,
  "detail": "Rate limit exceeded. Maximum 100 requests per minute."
}
```

**Implementation:**
```python
def check_rate_limit(client_ip: str) -> bool:
    now = datetime.now()
    # Clean old requests
    rate_limit_storage[client_ip] = [
        req_time for req_time in rate_limit_storage[client_ip]
        if now - req_time < RATE_LIMIT_WINDOW
    ]
    # Check limit
    return len(rate_limit_storage[client_ip]) < RATE_LIMIT_MAX_REQUESTS
```

---

### 3. **Audit Logging**

**Purpose:** Track all queries for security analysis and compliance

**Log Format:**
```json
{
  "timestamp": "2026-02-15T02:18:58.123456",
  "event": "SEARCH_QUERY",
  "client_ip": "127.0.0.1",
  "data": {
    "query": "How does consensus work?",
    "top_k": 3,
    "filter": "consensus"
  }
}
```

**Logged Events:**
- `SEARCH_QUERY` - Every search request
- `SEARCH_SUCCESS` - Successful searches with result count
- `SEARCH_ERROR` - Failed searches with error details
- `ADD_DOCUMENT` - Document additions
- `RATE_LIMIT_EXCEEDED` - Rate limit violations

**Log File:** `vector_db_audit.log`

**Analysis Example:**
```bash
# Find all rate limit violations
grep "RATE_LIMIT_EXCEEDED" vector_db_audit.log

# Count queries per IP
grep "SEARCH_QUERY" vector_db_audit.log | jq -r '.client_ip' | sort | uniq -c
```

---

### 4. **Privacy Protection**

**Purpose:** Prevent indexing of sensitive data

**Blocked Patterns:**
- Private keys: `0x[a-fA-F0-9]{64}`
- API keys: `sk_[a-zA-Z0-9]{32,}`
- Long hex strings: `[a-zA-Z0-9]{64,}`

**Validation:**
```python
def contains_sensitive_data(text: str) -> bool:
    for pattern in SENSITIVE_PATTERNS:
        if re.search(pattern, text):
            return True
    return False
```

**Response when detected:**
```json
{
  "status_code": 422,
  "detail": "Content contains sensitive data (private keys, etc.)"
}
```

---

## 🛡️ Additional Security Recommendations

### Production Deployment

1. **Use HTTPS Only**
   ```python
   # In production, enforce HTTPS
   from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
   app.add_middleware(HTTPSRedirectMiddleware)
   ```

2. **API Key Authentication**
   ```python
   from fastapi.security import APIKeyHeader
   
   api_key_header = APIKeyHeader(name="X-API-Key")
   
   @app.post("/api/vector-search")
   async def vector_search(api_key: str = Depends(api_key_header)):
       if api_key not in VALID_API_KEYS:
           raise HTTPException(status_code=403, detail="Invalid API key")
   ```

3. **Use Redis for Rate Limiting**
   ```python
   import redis
   
   redis_client = redis.Redis(host='localhost', port=6379)
   
   def check_rate_limit(client_ip: str) -> bool:
       key = f"rate_limit:{client_ip}"
       count = redis_client.incr(key)
       if count == 1:
           redis_client.expire(key, 60)  # 60 second window
       return count <= RATE_LIMIT_MAX_REQUESTS
   ```

4. **Database Encryption at Rest**
   ```bash
   # Encrypt ChromaDB directory
   cryptsetup luksFormat /dev/sdb1
   cryptsetup open /dev/sdb1 encrypted_db
   mount /dev/mapper/encrypted_db /path/to/knowledge_db
   ```

5. **Network Isolation**
   ```yaml
   # Docker Compose example
   services:
     vector-api:
       networks:
         - internal
       ports:
         - "8000:8000"
     
     frontend:
       networks:
         - internal
         - public
   ```

---

## 📊 Security Monitoring

### Real-time Alerts

Set up alerts for suspicious activity:

```python
# Example: Alert on high rate limit violations
def check_suspicious_activity():
    violations = count_rate_limit_violations_last_hour()
    if violations > 100:
        send_alert("High rate limit violations detected")
```

### Metrics to Track

1. **Rate Limit Violations per Hour**
2. **Failed Authentication Attempts**
3. **Sensitive Data Detection Triggers**
4. **Average Query Response Time**
5. **Unique IPs per Day**

---

## 🧪 Security Testing

### Test Rate Limiting
```bash
# Bash script to test rate limit
for i in {1..150}; do
  curl -X POST http://localhost:8000/api/vector-search \
    -H "Content-Type: application/json" \
    -d '{"query": "test"}' &
done
wait
```

### Test Input Sanitization
```bash
# Try SQL injection
curl -X POST http://localhost:8000/api/vector-search \
  -H "Content-Type: application/json" \
  -d '{"query": "test; DROP TABLE users;"}'

# Try XSS
curl -X POST http://localhost:8000/api/vector-search \
  -H "Content-Type: application/json" \
  -d '{"query": "<script>alert(1)</script>"}'
```

### Test Sensitive Data Detection
```bash
# Try to index a private key
curl -X POST http://localhost:8000/api/add-document \
  -H "Content-Type: application/json" \
  -d '{
    "content": "My private key is 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  }'
```

---

## ✅ Security Checklist

- [x] Input sanitization implemented
- [x] Rate limiting active (100 req/min)
- [x] Audit logging enabled
- [x] Sensitive data filtering
- [x] CORS properly configured
- [ ] HTTPS enforced (production only)
- [x] Writes require the operator token (`POST /api/add-document`) — what goes
      into the knowledge base is what the assistant later repeats as fact, so an
      open write is a way to put words in its mouth
- [x] Reads are open but rate limited (`POST /api/vector-search`) — a POST
      because the query rides in the body; it reads and returns
- [ ] Redis for distributed rate limiting (production)
- [ ] Database encryption at rest (production)
- [ ] Security monitoring dashboard (future)

---

## 📞 Incident Response

If you detect a security incident:

1. **Check audit logs:** `tail -f vector_db_audit.log`
2. **Identify attacker IP:** `grep "RATE_LIMIT_EXCEEDED" vector_db_audit.log | jq -r '.client_ip' | sort | uniq`
3. **Block IP temporarily:** Add to firewall rules
4. **Review all queries from that IP:** `grep "client_ip\":\"X.X.X.X" vector_db_audit.log`
5. **Report to security team**
