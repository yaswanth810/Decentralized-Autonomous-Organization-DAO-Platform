// ─── Network Configuration ─────────────────────────────────────────
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  contracts: {
    governanceToken: string;
    governanceDAO: string;
    timeLock: string;
    treasury: string;
  };
}

export const NETWORKS: Record<number, NetworkConfig> = {
  31337: {
    chainId: 31337,
    name: "Localhost",
    rpcUrl: "http://127.0.0.1:8545",
    blockExplorerUrl: "",
    contracts: {
      governanceToken: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      governanceDAO: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      timeLock: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      treasury: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    },
  },
  80002: {
    chainId: 80002,
    name: "Polygon Amoy",
    rpcUrl: `https://polygon-amoy.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY || ""}`,
    blockExplorerUrl: "https://amoy.polygonscan.com",
    contracts: {
      governanceToken: import.meta.env.VITE_GOVERNANCE_TOKEN_ADDRESS || "",
      governanceDAO: import.meta.env.VITE_GOVERNOR_ADDRESS || "",
      timeLock: import.meta.env.VITE_TIMELOCK_ADDRESS || "",
      treasury: import.meta.env.VITE_TREASURY_ADDRESS || "",
    },
  },
  11155111: {
    chainId: 11155111,
    name: "Sepolia",
    rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY || ""}`,
    blockExplorerUrl: "https://sepolia.etherscan.io",
    contracts: {
      governanceToken: import.meta.env.VITE_GOVERNANCE_TOKEN_ADDRESS || "",
      governanceDAO: import.meta.env.VITE_GOVERNOR_ADDRESS || "",
      timeLock: import.meta.env.VITE_TIMELOCK_ADDRESS || "",
      treasury: import.meta.env.VITE_TREASURY_ADDRESS || "",
    },
  },
  34: {
    chainId: 34,
    name: "SCAI Mainnet",
    rpcUrl: "https://mainnet-rpc.scai.network",
    blockExplorerUrl: "https://explorer.securechain.ai",
    contracts: {
      governanceToken: import.meta.env.VITE_GOVERNANCE_TOKEN_ADDRESS || "",
      governanceDAO: import.meta.env.VITE_GOVERNOR_ADDRESS || "",
      timeLock: import.meta.env.VITE_TIMELOCK_ADDRESS || "",
      treasury: import.meta.env.VITE_TREASURY_ADDRESS || "",
    },
  },
};

export const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 34);

export function getNetwork(chainId: number): NetworkConfig | undefined {
  return NETWORKS[chainId];
}

export function getExplorerUrl(chainId: number, type: "tx" | "address", hash: string): string {
  const network = NETWORKS[chainId];
  if (!network?.blockExplorerUrl) return "";
  return `${network.blockExplorerUrl}/${type}/${hash}`;
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
