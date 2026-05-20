import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// ─── Environment Validation ────────────────────────────────────────
// Fallback values ensure `npx hardhat compile` works without a .env,
// but real deployments MUST have a valid .env file configured.
const PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "0000000000000000000000000000000000000000000000000000000000000001"; // dummy — never use on mainnet

const ALCHEMY_AMOY_URL = process.env.ALCHEMY_AMOY_URL || "";
const ALCHEMY_SEPOLIA_URL = process.env.ALCHEMY_SEPOLIA_URL || "";
const SCAI_RPC_URL = process.env.SCAI_RPC_URL || "https://mainnet-rpc.scai.network";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

// ─── Hardhat Configuration ─────────────────────────────────────────
const config: HardhatUserConfig = {
  // ── Solidity Compiler ──────────────────────────────────────────
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      evmVersion: "paris",
    },
  },

  // ── Networks ───────────────────────────────────────────────────
  networks: {
    // Local Hardhat node (default for testing)
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: false,
    },

    // Local Hardhat node running via `npx hardhat node`
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      timeout: 60_000,
    },

    // Polygon Amoy Testnet
    polygonAmoy: {
      url: ALCHEMY_AMOY_URL,
      accounts: [`0x${PRIVATE_KEY}`],
      chainId: 80002,
      gasPrice: "auto",
      timeout: 120_000, // 2 min — testnets can be slow
      // Recommended: set confirmations for deployment reliability
    },

    // Ethereum Sepolia Testnet
    sepolia: {
      url: ALCHEMY_SEPOLIA_URL,
      accounts: [`0x${PRIVATE_KEY}`],
      chainId: 11155111,
      gasPrice: "auto",
      timeout: 120_000,
    },

    // SecureChain AI Mainnet
    scai: {
      url: SCAI_RPC_URL,
      accounts: [`0x${PRIVATE_KEY}`],
      chainId: 34,
      gasPrice: "auto",
      timeout: 120_000,
    },
  },

  // ── Contract Verification ─────────────────────────────────────
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      scai: "no-api-key-needed", // SCAI explorer may not require an API key
    },
    customChains: [
      {
        network: "scai",
        chainId: 34,
        urls: {
          apiURL: "https://explorer.securechain.ai/api",
          browserURL: "https://explorer.securechain.ai",
        },
      },
    ],
  },

  // ── Gas Reporter ───────────────────────────────────────────────
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
    outputFile: "gas-report.txt",
    noColors: true,
  },

  // ── Project Paths ──────────────────────────────────────────────
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // ── TypeChain (auto-generates TypeScript types for contracts) ──
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
