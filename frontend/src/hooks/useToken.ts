import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────────────────

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useToken() {
  const { tokenContract, walletAddress, chainId, refreshBalance } = useWeb3();

  const [claiming, setClaiming] = useState(false);
  const [approving, setApproving] = useState(false);

  // ── getBalance ──
  const getBalance = useCallback(
    async (address?: string): Promise<bigint> => {
      if (!tokenContract) return 0n;
      const addr = address || walletAddress;
      if (!addr) return 0n;

      try {
        return await tokenContract.balanceOf(addr);
      } catch (err: any) {
        console.error("Failed to fetch balance:", err);
        return 0n;
      }
    },
    [tokenContract, walletAddress],
  );

  // ── getFormattedBalance ──
  const getFormattedBalance = useCallback(
    async (address?: string): Promise<string> => {
      const bal = await getBalance(address);
      return ethers.formatEther(bal);
    },
    [getBalance],
  );

  // ── getTokenInfo ──
  const getTokenInfo = useCallback(async (): Promise<TokenInfo | null> => {
    if (!tokenContract) return null;

    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply(),
      ]);
      return { name, symbol, decimals: Number(decimals), totalSupply };
    } catch {
      return null;
    }
  }, [tokenContract]);

  // ── claimTestTokens ──
  // On testnets, the deployer owns the token contract and can mint.
  // This function calls mint() if the connected wallet is the owner.
  // In production, this would be replaced by a faucet or distribution mechanism.
  const claimTestTokens = useCallback(
    async (amount: bigint = ethers.parseEther("1000")): Promise<string | null> => {
      if (!tokenContract || !walletAddress) {
        toast.error("Wallet not connected");
        return null;
      }

      // Only works on testnets
      if (chainId !== 31337 && chainId !== 80002 && chainId !== 11155111) {
        toast.error("Token claiming is only available on testnets");
        return null;
      }

      setClaiming(true);
      try {
        // Estimate gas first
        const gasEstimate = await tokenContract.mint.estimateGas(walletAddress, amount);
        const gasLimit = (gasEstimate * 120n) / 100n;

        toast.loading("Minting test tokens...", { id: "claim" });

        const tx = await tokenContract.mint(walletAddress, amount, { gasLimit });
        toast.loading("Confirming...", { id: "claim" });

        await tx.wait();

        // Refresh balance in Web3Context
        await refreshBalance();

        const formatted = Number(ethers.formatEther(amount)).toLocaleString();
        toast.success(`Claimed ${formatted} DAOV!`, { id: "claim" });

        return tx.hash;
      } catch (err: any) {
        const msg = err?.reason || err?.message || "Mint failed";

        if (msg.includes("OwnableUnauthorizedAccount")) {
          toast.error("Only the token owner can mint. Ask the deployer for tokens.", { id: "claim" });
        } else if (msg.includes("ExceedsMaxSupply")) {
          toast.error("Cannot mint — max supply reached.", { id: "claim" });
        } else if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
          toast.error("Transaction rejected", { id: "claim" });
        } else {
          toast.error(msg.length > 100 ? msg.slice(0, 100) + "..." : msg, { id: "claim" });
        }

        return null;
      } finally {
        setClaiming(false);
      }
    },
    [tokenContract, walletAddress, chainId, refreshBalance],
  );

  // ── approve ──
  const approve = useCallback(
    async (spender: string, amount: bigint): Promise<string | null> => {
      if (!tokenContract) {
        toast.error("Token contract not connected");
        return null;
      }

      setApproving(true);
      try {
        // Estimate gas
        const gasEstimate = await tokenContract.approve.estimateGas(spender, amount);
        const gasLimit = (gasEstimate * 120n) / 100n;

        toast.loading("Approving...", { id: "approve" });

        const tx = await tokenContract.approve(spender, amount, { gasLimit });
        toast.loading("Confirming approval...", { id: "approve" });

        await tx.wait();

        const formatted = Number(ethers.formatEther(amount)).toLocaleString();
        toast.success(`Approved ${formatted} DAOV`, { id: "approve" });

        return tx.hash;
      } catch (err: any) {
        const msg = err?.reason || err?.message || "Approval failed";
        if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
          toast.error("Transaction rejected", { id: "approve" });
        } else {
          toast.error(msg.length > 100 ? msg.slice(0, 100) + "..." : msg, { id: "approve" });
        }
        return null;
      } finally {
        setApproving(false);
      }
    },
    [tokenContract],
  );

  // ── getAllowance ──
  const getAllowance = useCallback(
    async (spender: string, owner?: string): Promise<bigint> => {
      if (!tokenContract) return 0n;
      const addr = owner || walletAddress;
      if (!addr) return 0n;

      try {
        return await tokenContract.allowance(addr, spender);
      } catch {
        return 0n;
      }
    },
    [tokenContract, walletAddress],
  );

  return {
    // Read
    getBalance,
    getFormattedBalance,
    getTokenInfo,
    getAllowance,

    // Write
    claimTestTokens,
    approve,

    // Loading states
    claiming,
    approving,
  };
}
