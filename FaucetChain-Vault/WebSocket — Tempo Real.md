---
tags: [websocket, realtime, blocks]
aliases: [WebSocket, WS, Tempo Real]
---

# 🔌 WebSocket — Tempo Real

> **Endpoint:** `ws://localhost:8000/ws/network`
> **Manager:** `ConnectionManager` em `api_server.py`
> **Frontend:** `NetworkContext.tsx`

---

## Arquitetura

```
Indexer/Mining → POST /api/internal/notify-block
                        ↓
              ConnectionManager.broadcast()
                        ↓
              WebSocket → Todos os clientes conectados
                        ↓
              NetworkContext.tsx → fetchNetworkData()
                        ↓
              UI atualiza métricas e blocos
```

---

## Servidor (Backend)

```python
class ConnectionManager:
    active_connections: List[WebSocket]
    
    async connect(websocket)     # Aceita e adiciona
    def disconnect(websocket)    # Remove
    async broadcast(message)     # Envia para todos
```

### Notify Block (Internal)
```
POST /api/internal/notify-block
Header: X-Internal-Secret: faucetchain-internal-2026
Body: { height, hash, tx_count }
```

---

## Cliente (Frontend)

`NetworkContext.tsx` implementa:
- **Auto-reconnect** com exponential backoff
- Delay inicial: 1s, máximo: 30s
- Reset do delay ao conectar com sucesso
- Cleanup no unmount do componente

```typescript
socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'NEW_BLOCK') {
        fetchNetworkData();  // Refresh completo
    }
};
```

---

## Mensagens

| Tipo | Direção | Dados |
|---|---|---|
| `NEW_BLOCK` | Server → Client | `{ height, hash, tx_count }` |

---

Voltar: [[Home]] | [[Backend — FastAPI Server]]
