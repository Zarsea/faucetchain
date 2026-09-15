---
tags: [ai, gemini, sentinel, intelligence]
aliases: [IA, AI, Gemini, Sentinel AI]
---

# 🧠 Camada de IA

> A FaucetChain utiliza múltiplas camadas de inteligência artificial para diagnósticos, assistência e segurança.

---

## Arquitetura Híbrida (Frontend)

```
AIChatAgent.tsx
    → HybridIntelligence.ts
        → LocalIntelligence.ts (rule-based fallback)
        → KnowledgeBase.ts (26K linhas de knowledge embarcado)
        → geminiService.ts → Backend Sentinel API
```

### 1. LocalIntelligence.ts
- Fallback offline com regras hardcoded
- Pattern matching para perguntas frequentes
- Não requer API

### 2. KnowledgeBase.ts
- 26.000+ linhas de documentação embarcada
- Busca por keywords e categorias
- Funciona 100% offline

### 3. HybridIntelligence.ts
- Tenta API Gemini primeiro
- Se falhar, usa LocalIntelligence como fallback
- Merge de resultados quando ambos respondem

---

## Sentinel AI (Backend)

> **Endpoint:** `POST /api/ai/sentinel`
> **Modelo:** `gemini-3-flash-preview`

### Fluxo:
1. Recebe `context` + `prompt` do frontend
2. Extrai endereço `0x...` do contexto (regex)
3. Consulta dados **reais** do [[Banco de Dados — SQLite|SQLite L1]]:
   - Saldo de claims (`user_claims`)
   - Contagem de transações
   - Reputação calculada
4. Injeta dados reais no prompt para o Gemini
5. Gemini responde com contexto L1 real

```python
real_context = f"Saldo Mints: {total_claims:.2f} $CLAIM | Reputação: {reputation}% | Total TXs: {tx_count}"
```

---

## Gemini Service (Frontend)

Arquivo: `services/geminiService.ts`

### Funções:
- `explainWithGemini()` — Usa backend `/api/ai/sentinel`
- `diagnoseNetworkError()` — Diagnóstico direto via `@google/genai`
- `autonomousCodeGeneration()` — Self-healing code generation

---

## [[Vector Knowledge Base]]
- ChromaDB + SentenceTransformers
- Busca semântica sobre documentação
- Alimentada com dados da chain

---

## [[Fraud Detector — Sentinel V3]]
- Detecção de Sybil
- Cálculo de bonus para validadores
- Audit engine integrado

---

Voltar: [[Home]]
