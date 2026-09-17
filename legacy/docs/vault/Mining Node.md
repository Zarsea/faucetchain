---
tags: [mining, node, consensus, poc]
aliases: [Minerador, Miner, AutoClaim]
---

# ⛏️ Mining Node

> **Diretório:** `mining-node/`
> **Engine:** `miner-core.js` (EventEmitter pattern)
> **CLI:** `index.js` | **GUI:** Electron (`app/`)

---

## Arquitetura

```
MinerCore (EventEmitter)
├── start()      → register → heartbeat loop + explore loop
├── stop()       → disconnect
├── Events:
│   ├── 'starting'      → info do sistema
│   ├── 'registered'    → conexão OK
│   ├── 'mining-started' → loops ativos
│   ├── 'heartbeat'     → estado atualizado
│   ├── 'block-mined'   → claim processado
│   ├── 'error'         → falha
│   └── 'stopped'       → desconectado
```

---

## Ciclo de Vida

1. **Register** → `POST /api/mining/register`
   - Envia: wallet, node_id, node_name, version
   - Recebe: config (heartbeat_interval, epoch_duration)
   - Max 3 nós por wallet (anti-Sybil)

2. **Heartbeat Loop** (a cada 30s) → `POST /api/mining/heartbeat`
   - Envia: node_id, wallet, uptime, cpu_load, memory_free
   - Recebe: total_uptime, epoch_uptime, total_earned
   - Acumula uptime para [[Epoch Reward System]]

3. **Explore Loop** (a cada 5s) → `POST /api/mining/explore`
   - Busca 1 claim pendente de [[Merit Faucet — Claiming]]
   - Se encontrar:
     - Cria novo bloco na chain
     - 80% reward → usuário (user_claims)
     - 20% fee → minerador (mining_rewards)
     - 2 transações registradas
   - Se não: retorna silenciosamente

4. **Disconnect** → `POST /api/mining/disconnect`
   - Marca nó como offline

---

## Configuração

Arquivo: `mining-node/.env`

```env
WALLET_ADDRESS=0x84da71247cbfb0737a9112de1f10dae9823fc298
API_URL=http://127.0.0.1:8000
NODE_NAME=meu-node-01
```

---

## Node ID

- Gerado automaticamente no primeiro start: `fcn-{uuid-12chars}`
- Persistido em `mining-node/.node_id`
- Usado como chave primária em `active_miners`

---

## Métricas do Sistema

O minerador coleta e envia:
- **CPU Load** — % de uso do primeiro core
- **Memory Free** — % de RAM livre
- **Uptime** — segundos desde o start

---

## Relacionamentos

- Alimenta: [[Epoch Reward System]], [[Banco de Dados — SQLite]]
- Processa: [[Merit Faucet — Claiming|Claims Pendentes]]
- Cria: Blocos na tabela `blocks`
- UI: [[Frontend — React DApp|AutoClaim Hub (MiningHub.tsx)]]

---

Voltar: [[Home]]
