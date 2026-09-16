import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  console.log("Starting FaucetChain V3 Deployment on FaucetChain Network...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer ? deployer.address : "No Signer (Mock/Local)");

  // 1. Deploy FaucetToken_CLAIM
  console.log("\n1. Deploying FaucetToken_CLAIM...");
  const FaucetToken = await ethers.getContractFactory("FaucetToken_CLAIM");
  const claimToken = await FaucetToken.deploy();
  await claimToken.waitForDeployment();
  const claimAddress = await claimToken.getAddress();
  console.log(`✅ FaucetToken_CLAIM deployed to: ${claimAddress}`);

  // 2. Deploy DAppStakingRegistry
  console.log("\n2. Deploying DAppStakingRegistry...");
  const StakingRegistry = await ethers.getContractFactory("DAppStakingRegistry");
  const registry = await StakingRegistry.deploy(claimAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`✅ DAppStakingRegistry deployed to: ${registryAddress}`);

  // 3. Deploy HourlyEpochManager
  console.log("\n3. Deploying HourlyEpochManager...");
  const EpochManager = await ethers.getContractFactory("HourlyEpochManager");
  const epochManager = await EpochManager.deploy(registryAddress, claimAddress);
  await epochManager.waitForDeployment();
  const epochManagerAddress = await epochManager.getAddress();
  console.log(`✅ HourlyEpochManager deployed to: ${epochManagerAddress}`);

  // Configure Token to accept HourlyEpochManager as its minter (The PoC engine)
  console.log("\n-> Setting HourlyEpochManager on Token...");
  // Use connected signer context to set manager
  await claimToken.setHourlyEpochManager(epochManagerAddress);
  console.log("✅ HourlyEpochManager hooked to FaucetToken_CLAIM.");

  // 4. Deploy YieldAccumulatorVault
  console.log("\n4. Deploying YieldAccumulatorVault...");
  const Vault = await ethers.getContractFactory("YieldAccumulatorVault");
  const treasuryAddress = deployer ? deployer.address : "0x0000000000000000000000000000000000000000";
  const vault = await Vault.deploy(treasuryAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`✅ YieldAccumulatorVault deployed to: ${vaultAddress}`);

  // 5. Deploy UTXOStakingVault
  console.log("\n5. Deploying UTXOStakingVault...");
  const UTXOVault = await ethers.getContractFactory("UTXOStakingVault");
  const utxoVault = await UTXOVault.deploy(claimAddress);
  await utxoVault.waitForDeployment();
  const utxoVaultAddress = await utxoVault.getAddress();
  console.log(`✅ UTXOStakingVault deployed to: ${utxoVaultAddress}`);

  console.log("\n🚀 Deployment Complete! Update VITE variables in FaucetChain Frontend!");
  console.log(`-----------------------------------------------`);
  console.log(`VITE_L1_CLAIM_TOKEN_ADDRESS=${claimAddress}`);
  console.log(`VITE_L1_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`VITE_L1_EPOCH_MANAGER_ADDRESS=${epochManagerAddress}`);
  console.log(`VITE_L1_YIELD_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`VITE_L1_UTXO_STAKING_VAULT_ADDRESS=${utxoVaultAddress}`);
  console.log(`-----------------------------------------------`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
