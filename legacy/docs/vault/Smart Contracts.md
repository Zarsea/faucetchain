---
tags: [solidity, hardhat, contracts, blockchain]
aliases: [Contratos, Solidity, Hardhat]
---

# 🔗 Smart Contracts

> **Diretório:** `contracts/`
> **Framework:** Hardhat 3 + Solidity
> **Rede Local:** `localhost:8545` (Hardhat Node)
> **Deploy Script:** `scripts/deploy.ts`

---

## 📜 8 Contratos

### 1. FaucetToken_CLAIM.sol
- **Tipo:** ERC-20 Token
- **Supply Hard Cap:** 99.000.000 $CLAIM
- **Função:** Token nativo da rede
- Conecta: [[Tokenomics $CLAIM]]

### 2. UTXOStakingVault.sol
- **Tipo:** UTXO-Based Staking
- **Tiers:** 3 (1h, 24h, 7d)
- **Timelock:** Obrigatório por tier
- Conecta: [[Staking Vault UTXO]]

### 3. YieldAccumulatorVault.sol
- **Tipo:** Yield Distribution
- **Função:** Acumula e distribui yields de staking

### 4. AutoClaimDistributor.sol
- **Tipo:** Distribuição automática
- **Função:** Distribui recompensas de claims automaticamente
- Conecta: [[Epoch Reward System]]

### 5. HourlyEpochManager.sol
- **Tipo:** Gestão de Épocas
- **Duração:** 1 hora por epoch
- **Reward:** 2.000 CLAIM/epoch (distribuído proporcionalmente)
- Conecta: [[Epoch Reward System]]

### 6. HubRegistryRoots.sol
- **Tipo:** Merkle Root Anchoring
- **Função:** Ancora raízes Merkle dos epochs on-chain
- Conecta: [[Merkle Proofs]]

### 7. CommunityBountyBoard.sol
- **Tipo:** Sistema de recompensas comunitárias
- **Estados:** OPEN → CLAIMED → COMPLETED / CANCELLED
- Conecta: [[Bounty Board]]

### 8. DAppStakingRegistry.sol
- **Tipo:** Registro de DApps
- **Função:** DApps registram stake para participar da rede

---

## Deploy

```bash
npx hardhat node                    # Inicia rede local
npx ts-node scripts/deploy.ts      # Deploy dos contratos
```

O Hardhat Node fornece 20 contas de teste com 10.000 ETH cada.

---

## Config

```typescript
// hardhat.config.ts
networks: {
  localhost: { url: "http://127.0.0.1:8545" }
}
```

---

## Relacionamentos

- Token base: [[Tokenomics $CLAIM]]
- Staking: [[Staking Vault UTXO]]
- Epochs: [[Epoch Reward System]]
- Verificação: [[Merkle Proofs]]
- Frontend: [[Frontend — React DApp|Code Viewer]]

---

Voltar: [[Home]]
