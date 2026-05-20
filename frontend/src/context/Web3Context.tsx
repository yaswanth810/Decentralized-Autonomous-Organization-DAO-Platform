import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { ethers, BrowserProvider, JsonRpcSigner, Contract } from "ethers";
import { GOVERNANCE_TOKEN_ABI, GOVERNANCE_DAO_ABI, TREASURY_ABI, TIMELOCK_ABI } from "../abi";
import { getNetwork, DEFAULT_CHAIN_ID, type NetworkConfig } from "../config";
import toast from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────────────────

export interface Web3State {
  // Wallet
  walletAddress: string;
  isConnected: boolean;
  chainId: number;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  network: NetworkConfig | null;

  // Contracts
  daoContract: Contract | null;
  tokenContract: Contract | null;
  treasuryContract: Contract | null;
  timeLockContract: Contract | null;

  // User data
  tokenBalance: bigint;
  votingPower: string;

  // Actions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
}

const Web3Context = createContext<Web3State | undefined>(undefined);

// ─── Provider Component ─────────────────────────────────────────────

export function Web3Provider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [chainId, setChainId] = useState(DEFAULT_CHAIN_ID);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [network, setNetwork] = useState<NetworkConfig | null>(null);

  const [daoContract, setDaoContract] = useState<Contract | null>(null);
  const [tokenContract, setTokenContract] = useState<Contract | null>(null);
  const [treasuryContract, setTreasuryContract] = useState<Contract | null>(null);
  const [timeLockContract, setTimeLockContract] = useState<Contract | null>(null);

  const [tokenBalance, setTokenBalance] = useState<bigint>(0n);

  // ── Initialize contracts with a signer ──
  const initContracts = useCallback(
    (signer: JsonRpcSigner, net: NetworkConfig) => {
      const { contracts } = net;
      if (contracts.governanceDAO) {
        setDaoContract(new Contract(contracts.governanceDAO, GOVERNANCE_DAO_ABI, signer));
      }
      if (contracts.governanceToken) {
        setTokenContract(new Contract(contracts.governanceToken, GOVERNANCE_TOKEN_ABI, signer));
      }
      if (contracts.treasury) {
        setTreasuryContract(new Contract(contracts.treasury, TREASURY_ABI, signer));
      }
      if (contracts.timeLock) {
        setTimeLockContract(new Contract(contracts.timeLock, TIMELOCK_ABI, signer));
      }
    },
    [],
  );

  // ── Fetch user's token balance ──
  const refreshBalance = useCallback(async () => {
    if (!tokenContract || !walletAddress) return;
    try {
      const bal = await tokenContract.balanceOf(walletAddress);
      setTokenBalance(bal);
    } catch {
      console.error("Failed to fetch token balance");
    }
  }, [tokenContract, walletAddress]);

  // ── Connect wallet ──
  const connectWallet = useCallback(async () => {
    if (typeof window.ethereum === "undefined") {
      toast.error("MetaMask is not installed. Please install it to continue.");
      return;
    }

    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      const accounts: string[] = await browserProvider.send("eth_requestAccounts", []);
      const userSigner = await browserProvider.getSigner();
      const net = await browserProvider.getNetwork();
      const currentChainId = Number(net.chainId);
      const networkConfig = getNetwork(currentChainId);

      if (!networkConfig) {
        toast.error(`Unsupported network (Chain ID: ${currentChainId}). Please switch to Polygon Amoy or Sepolia.`);
        return;
      }

      setProvider(browserProvider);
      setSigner(userSigner);
      setWalletAddress(accounts[0]);
      setIsConnected(true);
      setChainId(currentChainId);
      setNetwork(networkConfig);
      initContracts(userSigner, networkConfig);

      toast.success(`Connected to ${networkConfig.name}`);
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      toast.error(err?.message || "Failed to connect wallet");
    }
  }, [initContracts]);

  // ── Disconnect ──
  const disconnectWallet = useCallback(() => {
    setWalletAddress("");
    setIsConnected(false);
    setProvider(null);
    setSigner(null);
    setDaoContract(null);
    setTokenContract(null);
    setTreasuryContract(null);
    setTimeLockContract(null);
    setTokenBalance(0n);
    setNetwork(null);
    toast.success("Wallet disconnected");
  }, []);

  // ── Listen for wallet/chain changes ──
  useEffect(() => {
    if (typeof window.ethereum === "undefined") return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setWalletAddress(accounts[0]);
        toast("Account changed", { icon: "🔄" });
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnectWallet]);

  // ── Auto-refresh balance when contracts or address change ──
  useEffect(() => {
    if (isConnected && tokenContract && walletAddress) {
      refreshBalance();
    }
  }, [isConnected, tokenContract, walletAddress, refreshBalance]);

  const votingPower = ethers.formatEther(tokenBalance);

  return (
    <Web3Context.Provider
      value={{
        walletAddress,
        isConnected,
        chainId,
        provider,
        signer,
        network,
        daoContract,
        tokenContract,
        treasuryContract,
        timeLockContract,
        tokenBalance,
        votingPower,
        connectWallet,
        disconnectWallet,
        refreshBalance,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useWeb3(): Web3State {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
}
