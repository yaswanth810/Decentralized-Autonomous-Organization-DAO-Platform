/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOVERNANCE_TOKEN_ADDRESS: string;
  readonly VITE_GOVERNOR_ADDRESS: string;
  readonly VITE_TIMELOCK_ADDRESS: string;
  readonly VITE_TREASURY_ADDRESS: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_ALCHEMY_API_KEY: string;
  readonly VITE_IPFS_GATEWAY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// MetaMask window.ethereum type
interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on: (event: string, handler: (...args: any[]) => void) => void;
    removeListener: (event: string, handler: (...args: any[]) => void) => void;
  };
}
