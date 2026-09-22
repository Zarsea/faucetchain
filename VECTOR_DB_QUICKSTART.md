# FaucetChain Vector DB - Quick Start Guide

## 🚀 Phase 1: Prototype (COMPLETED ✅)

### Installation

```bash
# Install Python dependencies
pip install -r requirements-vector-db.txt
```

### Testing the Vector Database

```bash
# Test semantic search (standalone)
python VectorKnowledgeBase.py
```

**Expected Output:**
```
✅ Seeded 20 documents to knowledge base
📊 Stats: {'total_documents': 20, 'embedding_dimension': 384, 'model': 'all-MiniLM-L6-v2'}

=== TESTING SEMANTIC SEARCH ===

Query: 'How does consensus work?'
  [1] Score: 0.892
      Category: consensus
      Content: FaucetChain uses Hybrid PoS+PoC...
```

### Starting the API Server

```bash
# Start FastAPI server
python api_server.py
```

Server will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs (Swagger UI)

### API Endpoints

#### 1. Search Documents
```bash
curl -X POST http://localhost:8000/api/vector-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does consensus work?",
    "top_k": 3
  }'
```

#### 2. Add Document

Writing needs the operator token. What goes in here is what the in-app
assistant later repeats as fact, so an open write is a way to put words in its
mouth.

```bash
curl -X POST http://localhost:8000/api/add-document \
  -H "Content-Type: application/json" \
  -H "X-Operator-Token: $SETTLEMENT_OPERATOR_TOKEN" \
  -d '{
    "content": "New information about FaucetChain...",
    "metadata": {"category": "general"}
  }'
```

### Frontend Integration

Update `AIChatAgent.tsx` to use the API:

```typescript
const handleSendMessage = async (userMsg: string) => {
    setIsThinking(true);
    
    try {
        const response = await fetch('http://localhost:8000/api/vector-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: userMsg, top_k: 3 })
        });
        
        const results = await response.json();
        
        if (results.length > 0) {
            const aiMsg = {
                id: Date.now().toString(),
                text: results[0].content,
                sender: 'ai',
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, aiMsg]);
        }
    } catch (error) {
        console.error('Vector search failed:', error);
    } finally {
        setIsThinking(false);
    }
};
```

## 📊 Current Status

- ✅ **VectorKnowledgeBase.py**: Implemented with ChromaDB
- ✅ **20 Seed Documents**: Covering all FaucetChain topics
- ✅ **FastAPI Server**: REST API with CORS support
- ✅ **Semantic Search**: Working with 384-dim embeddings

## 🎯 Next Steps (Phase 2)

1. Connect `HybridIntelligence.ts` to API
2. Implement query caching
3. Add UI for search results visualization
4. Deploy to production environment

## 📝 Document Categories

The 20 seed documents cover:
- Consensus (4 docs)
- Validators (3 docs)
- Security (3 docs)
- Economics (2 docs)
- Scaling (2 docs)
- DeFi (2 docs)
- Development (1 doc)
- Governance (1 doc)
- Privacy (1 doc)
- Infrastructure (1 doc)

## 🔧 Troubleshooting

**Issue**: `ModuleNotFoundError: No module named 'sentence_transformers'`
**Solution**: Run `pip install -r requirements-vector-db.txt`

**Issue**: API returns 503 "Knowledge base not initialized"
**Solution**: Wait for startup to complete (first run downloads model ~80MB)

**Issue**: CORS errors from frontend
**Solution**: Ensure `http://localhost:5173` is in CORS origins (already configured)
