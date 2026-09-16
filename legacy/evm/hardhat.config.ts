import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";

dotenv.config();

const rpcUrl = process.env.FAUCETCHAIN_RPC_URL || "http://localhost:8545";
const privateKey = process.env.PRIVATE_KEY;

if (!privateKey || privateKey.trim().length < 64) {
  throw new Error("Missing or invalid PRIVATE_KEY in environment");
}

export default defineConfig({
  plugins: [hardhatEthers],
  solidity: {
    version: "0.8.26",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    faucetchain: {
      type: "http",
      url: rpcUrl,
      accounts: [privateKey]
    }
  }
});
