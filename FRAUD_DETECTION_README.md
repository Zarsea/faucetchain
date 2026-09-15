# FaucetChain Fraud Detection & Bonus System

## 🔍 Overview

The `FraudAndBonusDetector.py` module provides machine learning-based fraud detection and validator bonus calculation for the FaucetChain network.

## 📦 Components

### 1. **FraudDetector**
Detects Sybil attacks and claim farming using:
- **Temporal Analysis**: Flags claims < 60s apart
- **Gas Price Uniformity**: Detects bots using identical gas prices
- **Pattern Compression**: Uses zlib compression ratio to identify repetitive behavior

### 2. **BonusCalculator**
Calculates validator bonuses (1.0x - 2.5x) based on:
- **Liquidity Provision** (30% weight)
- **Protocol Diversity** (20% weight)
- **Transaction Volume** (30% weight)
- **Uptime** (20% weight)

### 3. **SentinelV2Engine**
Main orchestrator that:
- Audits validator nodes
- Combines fraud scores with bonus multipliers
- Generates actionable recommendations
- Produces network health reports

## 🚀 Usage

### Basic Audit
\`\`\`python
from FraudAndBonusDetector import SentinelV2Engine

engine = SentinelV2Engine()

node_data = {
    "address": "0xABC123",
    "claims": [...],
    "reputation": 1.0,
    "liquidity": 50000,
    "protocols": ["Uniswap", "Aave"],
    "volume": 100000,
    "uptime": 0.995
}

result = engine.audit_node(node_data)
print(result['status'])  # VERIFIED, FLAGGED, or BANNED
print(result['final_multiplier'])  # 0.1 to 2.5
\`\`\`

### Network Health Report
\`\`\`python
health = engine.get_network_health_report()
print(health['network_health'])  # HEALTHY or AT_RISK
\`\`\`

## 📊 Example Results

**Legitimate Validator:**
\`\`\`json
{
  "status": "VERIFIED",
  "final_multiplier": 1.8,
  "fraud_score": 0.1,
  "bonus_multiplier": 1.8,
  "recommendations": [
    "💡 Increase DeFi participation to boost rewards."
  ]
}
\`\`\`

**Suspicious Bot:**
\`\`\`json
{
  "status": "FLAGGED",
  "final_multiplier": 0.1,
  "fraud_score": 0.9,
  "bonus_multiplier": 1.0,
  "recommendations": [
    "⚠️ Suspicious activity detected. Reduce claim frequency.",
    "🔍 Under review for potential Sybil attack."
  ]
}
\`\`\`

## 🔗 Integration with Frontend

To integrate with the TypeScript frontend, you can:

1. **Run Python as a subprocess** from Node.js
2. **Use a REST API** (Flask/FastAPI wrapper)
3. **WebAssembly** (compile Python to WASM)

Example Node.js integration:
\`\`\`typescript
import { spawn } from 'child_process';

function auditNode(nodeData: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const python = spawn('python', ['FraudAndBonusDetector.py']);
    python.stdin.write(JSON.stringify(nodeData));
    python.stdin.end();
    
    let output = '';
    python.stdout.on('data', (data) => output += data);
    python.on('close', () => resolve(JSON.parse(output)));
  });
}
\`\`\`

## 🎯 Fraud Detection Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Claim Interval | < 60s | Flag |
| Gas Uniformity | 100% same (>5 claims) | Flag |
| Pattern Similarity | > 75% | Flag |
| Fraud Score | > 0.95 | Ban |
| Fraud Score | 0.8 - 0.95 | Flag |

## 💰 Bonus Tiers

| Liquidity | Score |
|-----------|-------|
| < $1k | 0.0 |
| $1k - $10k | 0.3 |
| $10k - $100k | 0.7 |
| > $100k | 1.0 |

| Protocols | Score |
|-----------|-------|
| 1 | 0.2 |
| 3 | 0.6 |
| 5+ | 1.0 |

## 🧪 Testing

Run the module directly to see example audits:
\`\`\`bash
python FraudAndBonusDetector.py
\`\`\`

This will output audit results for both a legitimate validator and a suspicious bot.
