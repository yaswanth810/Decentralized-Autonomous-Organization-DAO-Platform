import { useState, useCallback } from "react";
import { ethers, Contract } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────────────────

export interface Proposal {
  id: number;
  title: string;
  description: string;
  proposer: string;
  deadline: number;
  yesVotes: bigint;
  noVotes: bigint;
  executed: boolean;
  cancelled: boolean;
  status: "active" | "passed" | "rejected" | "executed" | "cancelled";
}

interface TxResult {
  hash: string;
  receipt: ethers.TransactionReceipt;
}

// ─── Helpers ────────────────────────────────────────────────────────

function deriveStatus(p: { deadline: number; yesVotes: bigint; noVotes: bigint; executed: boolean; cancelled: boolean }): Proposal["status"] {
  if (p.cancelled) return "cancelled";
  if (p.executed) return "executed";
  if (Date.now() / 1000 < p.deadline) return "active";
  return p.yesVotes > p.noVotes ? "passed" : "rejected";
}

function parseContractError(err: any): string {
  // Try to extract the custom error / revert reason
  if (err?.reason) return err.reason;
  if (err?.error?.message) return err.error.message;
  if (err?.data?.message) return err.data.message;

  const msg: string = err?.message || "Transaction failed";

  // Parse common revert patterns
  const revertMatch = msg.match(/reverted with reason string '(.+?)'/);
  if (revertMatch) return revertMatch[1];

  const customErrorMatch = msg.match(/reverted with custom error '(.+?)'/);
  if (customErrorMatch) return customErrorMatch[1];

  // User rejection
  if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
    return "Transaction rejected by user";
  }

  // Truncate long metamask errors
  if (msg.length > 120) return msg.slice(0, 120) + "...";

  return msg;
}

async function estimateAndSend(contract: Contract, method: string, args: any[], toastId?: string): Promise<TxResult> {
  // Step 1: Estimate gas
  try {
    const gasEstimate = await contract[method].estimateGas(...args);
    const gasLimit = (gasEstimate * 120n) / 100n; // 20% buffer

    if (toastId) toast.loading("Sending transaction...", { id: toastId });

    // Step 2: Send with gas limit
    const tx = await contract[method](...args, { gasLimit });

    if (toastId) toast.loading(`Confirming... (${tx.hash.slice(0, 10)}...)`, { id: toastId });

    // Step 3: Wait for confirmation
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  } catch (err: any) {
    // If gas estimation fails, the tx will revert — surface the reason
    throw new Error(parseContractError(err));
  }
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useDAO() {
  const { daoContract, walletAddress } = useWeb3();

  const [loadingProposals, setLoadingProposals] = useState(false);
  const [loadingProposal, setLoadingProposal] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [votingOn, setVotingOn] = useState<number | null>(null);
  const [executing, setExecuting] = useState(false);

  // ── fetchAllProposals ──
  const fetchAllProposals = useCallback(async (): Promise<Proposal[]> => {
    if (!daoContract) return [];

    setLoadingProposals(true);
    try {
      const count = await daoContract.getProposalCount();
      const total = Number(count);
      const proposals: Proposal[] = [];

      // Batch fetch in parallel (groups of 10)
      for (let start = 0; start < total; start += 10) {
        const batch = [];
        for (let i = start; i < Math.min(start + 10, total); i++) {
          batch.push(
            daoContract.getProposal(i).then((p: any) => ({
              id: Number(p.id),
              title: p.title,
              description: p.description,
              proposer: p.proposer,
              deadline: Number(p.deadline),
              yesVotes: p.yesVotes,
              noVotes: p.noVotes,
              executed: p.executed,
              cancelled: p.cancelled,
              status: deriveStatus({
                deadline: Number(p.deadline),
                yesVotes: p.yesVotes,
                noVotes: p.noVotes,
                executed: p.executed,
                cancelled: p.cancelled,
              }),
            })).catch(() => null),
          );
        }
        const results = await Promise.all(batch);
        proposals.push(...(results.filter(Boolean) as Proposal[]));
      }

      return proposals;
    } catch (err: any) {
      toast.error(parseContractError(err));
      return [];
    } finally {
      setLoadingProposals(false);
    }
  }, [daoContract]);

  // ── fetchProposal ──
  const fetchProposal = useCallback(async (id: number): Promise<Proposal | null> => {
    if (!daoContract) return null;

    setLoadingProposal(true);
    try {
      const p = await daoContract.getProposal(id);
      return {
        id: Number(p.id),
        title: p.title,
        description: p.description,
        proposer: p.proposer,
        deadline: Number(p.deadline),
        yesVotes: p.yesVotes,
        noVotes: p.noVotes,
        executed: p.executed,
        cancelled: p.cancelled,
        status: deriveStatus({
          deadline: Number(p.deadline),
          yesVotes: p.yesVotes,
          noVotes: p.noVotes,
          executed: p.executed,
          cancelled: p.cancelled,
        }),
      };
    } catch (err: any) {
      toast.error(parseContractError(err));
      return null;
    } finally {
      setLoadingProposal(false);
    }
  }, [daoContract]);

  // ── createProposal ──
  const createProposal = useCallback(
    async (title: string, description: string, durationInDays: number): Promise<TxResult | null> => {
      if (!daoContract) {
        toast.error("DAO contract not connected");
        return null;
      }

      setCreatingProposal(true);
      try {
        const result = await estimateAndSend(
          daoContract,
          "createProposal",
          [title, description, durationInDays],
          "create-proposal",
        );
        toast.success("Proposal created!", { id: "create-proposal" });
        return result;
      } catch (err: any) {
        toast.error(err.message, { id: "create-proposal" });
        return null;
      } finally {
        setCreatingProposal(false);
      }
    },
    [daoContract],
  );

  // ── vote ──
  const vote = useCallback(
    async (proposalId: number, support: boolean): Promise<TxResult | null> => {
      if (!daoContract) {
        toast.error("DAO contract not connected");
        return null;
      }

      setVotingOn(proposalId);
      try {
        const result = await estimateAndSend(
          daoContract,
          "vote",
          [proposalId, support],
          "vote",
        );
        toast.success(support ? "Voted For ✓" : "Voted Against ✗", { id: "vote" });
        return result;
      } catch (err: any) {
        toast.error(err.message, { id: "vote" });
        return null;
      } finally {
        setVotingOn(null);
      }
    },
    [daoContract],
  );

  // ── executeProposal ──
  const executeProposal = useCallback(
    async (
      proposalId: number,
      target: string,
      value: bigint,
      data: string,
    ): Promise<TxResult | null> => {
      if (!daoContract) {
        toast.error("DAO contract not connected");
        return null;
      }

      setExecuting(true);
      try {
        const result = await estimateAndSend(
          daoContract,
          "executeProposal",
          [proposalId, target, value, data],
          "execute",
        );
        toast.success("Proposal executed!", { id: "execute" });
        return result;
      } catch (err: any) {
        toast.error(err.message, { id: "execute" });
        return null;
      } finally {
        setExecuting(false);
      }
    },
    [daoContract],
  );

  // ── hasVoted ──
  const hasVoted = useCallback(
    async (proposalId: number, address?: string): Promise<boolean> => {
      if (!daoContract) return false;
      const voter = address || walletAddress;
      if (!voter) return false;

      try {
        return await daoContract.hasVotedOn(proposalId, voter);
      } catch {
        return false;
      }
    },
    [daoContract, walletAddress],
  );

  // ── getVotingPower ──
  const getVotingPower = useCallback(
    async (address?: string): Promise<bigint> => {
      if (!daoContract) return 0n;
      // Voting power comes from the token contract — use Web3Context's tokenContract
      // but this hook focuses on DAO. Use useToken for raw balance.
      // Here we return the same thing since voting power = token balance in our design.
      const { tokenContract } = useWeb3();
      if (!tokenContract) return 0n;
      const addr = address || walletAddress;
      if (!addr) return 0n;

      try {
        return await tokenContract.balanceOf(addr);
      } catch {
        return 0n;
      }
    },
    [daoContract, walletAddress],
  );

  // ── getMinProposalTokens ──
  const getMinProposalTokens = useCallback(async (): Promise<bigint> => {
    if (!daoContract) return 0n;
    try {
      return await daoContract.minimumTokensToPropose();
    } catch {
      return 0n;
    }
  }, [daoContract]);

  // ── parseProposalCreatedEvent ──
  const parseProposalCreatedId = useCallback(
    (receipt: ethers.TransactionReceipt): number | null => {
      if (!daoContract) return null;
      for (const log of receipt.logs) {
        try {
          const parsed = daoContract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed?.name === "ProposalCreated") {
            return Number(parsed.args[0]);
          }
        } catch {
          // not our event
        }
      }
      return null;
    },
    [daoContract],
  );

  return {
    // Data fetching
    fetchAllProposals,
    fetchProposal,

    // Write operations
    createProposal,
    vote,
    executeProposal,

    // Read helpers
    hasVoted,
    getVotingPower,
    getMinProposalTokens,

    // Utilities
    parseProposalCreatedId,
    parseContractError,

    // Loading states
    loadingProposals,
    loadingProposal,
    creatingProposal,
    votingOn,
    executing,
  };
}
