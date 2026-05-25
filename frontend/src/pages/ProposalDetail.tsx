import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { shortenAddress, getExplorerUrl } from "../config";
import toast from "react-hot-toast";

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const { daoContract, walletAddress, isConnected, chainId, votingPower } = useWeb3();

  const [proposal, setProposal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);

  const proposalId = Number(id);

  useEffect(() => {
    async function load() {
      if (!daoContract) return setLoading(false);
      try {
        const p = await daoContract.getProposal(proposalId);
        setProposal({
          id: Number(p.id), title: p.title, description: p.description,
          proposer: p.proposer, deadline: Number(p.deadline),
          yesVotes: p.yesVotes, noVotes: p.noVotes,
          executed: p.executed, cancelled: p.cancelled,
        });
        if (walletAddress) {
          const voted = await daoContract.hasVotedOn(proposalId, walletAddress);
          setHasVoted(voted);
        }
      } catch {
        toast.error("Proposal not found");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [daoContract, proposalId, walletAddress]);

  async function handleVote(support: boolean) {
    if (!daoContract) return;
    try {
      setVoting(true);
      const tx = await daoContract.vote(proposalId, support);
      toast.loading("Submitting vote...", { id: "vote" });
      await tx.wait();
      toast.success("Vote submitted!", { id: "vote" });
      setHasVoted(true);
      // Refresh
      const p = await daoContract.getProposal(proposalId);
      setProposal((prev: any) => ({ ...prev, yesVotes: p.yesVotes, noVotes: p.noVotes }));
    } catch (err: any) {
      const msg = err?.reason || err?.message || "Vote failed";
      toast.error(msg, { id: "vote" });
    } finally {
      setVoting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-4 w-48" />
        <div className="glass-card p-8 space-y-4">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Proposal not found</p>
        <Link to="/" className="btn-secondary inline-block mt-4 text-sm">← Back to proposals</Link>
      </div>
    );
  }

  const isActive = !proposal.cancelled && !proposal.executed && Date.now() / 1000 < proposal.deadline;
  const totalVotes = proposal.yesVotes + proposal.noVotes;
  const yesPercent = totalVotes > 0n ? Number((proposal.yesVotes * 100n) / totalVotes) : 0;
  const noPercent = 100 - yesPercent;
  const status = proposal.cancelled ? "cancelled" : proposal.executed ? "executed"
    : isActive ? "active" : proposal.yesVotes > proposal.noVotes ? "passed" : "rejected";
  const deadline = new Date(proposal.deadline * 1000);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-400 text-sm transition-colors">
        ← All Proposals
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className={`badge-${status}`}>
            {status}
          </span>
          <span className="text-gray-500 text-sm">#{proposal.id}</span>
        </div>
        <h1 className="text-3xl font-bold text-white">{proposal.title}</h1>
        <p className="text-gray-500 mt-2">
          Proposed by{" "}
          <a href={getExplorerUrl(chainId, "address", proposal.proposer)} target="_blank" rel="noopener noreferrer"
            className="text-brand-400 hover:underline font-mono text-sm">
            {shortenAddress(proposal.proposer)}
          </a>
          {" · "}Deadline: {deadline.toLocaleString()}
        </p>
      </div>

      {/* Description */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Description</h2>
        <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{proposal.description}</p>
      </div>

      {/* Votes */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Voting Results</h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-success">{Number(ethers.formatEther(proposal.yesVotes)).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">For ({yesPercent}%)</p>
          </div>
          <div className="bg-danger/5 border border-danger/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-danger">{Number(ethers.formatEther(proposal.noVotes)).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Against ({noPercent}%)</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-surface-overlay rounded-full overflow-hidden flex">
          <div className="bg-success rounded-l-full transition-all duration-500" style={{ width: `${yesPercent}%` }} />
          <div className="bg-danger rounded-r-full transition-all duration-500" style={{ width: `${noPercent}%` }} />
        </div>
      </div>

      {/* Vote Actions */}
      {isActive && isConnected && !hasVoted && (
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Cast Your Vote</h2>
          
          {Number(votingPower) === 0 ? (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 text-center">
              <p className="text-warning font-semibold">You have 0 DAOV tokens</p>
              <p className="text-sm text-gray-400 mt-1">You need DAOV tokens to vote.</p>
              <Link to="/faucet" className="inline-block mt-3 px-4 py-2 bg-warning/20 text-warning rounded-lg text-sm font-bold hover:bg-warning/30 transition-colors">
                Go to Faucet
              </Link>
            </div>
          ) : (
            <div className="flex gap-4">
              <button onClick={() => handleVote(true)} disabled={voting}
                className="flex-1 py-3 rounded-xl font-semibold bg-success/10 border border-success/30 text-success hover:bg-success/20 transition-all disabled:opacity-50" id="vote-yes-btn">
                {voting ? "Submitting..." : "✓ Vote For"}
              </button>
              <button onClick={() => handleVote(false)} disabled={voting}
                className="flex-1 py-3 rounded-xl font-semibold bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 transition-all disabled:opacity-50" id="vote-no-btn">
                {voting ? "Submitting..." : "✗ Vote Against"}
              </button>
            </div>
          )}
        </div>
      )}

      {hasVoted && (
        <div className="glass-card p-4 text-center text-gray-400">
          ✅ You have already voted on this proposal
        </div>
      )}

      {!isConnected && (
        <div className="glass-card p-4 text-center text-gray-400">
          Connect your wallet to vote
        </div>
      )}
    </div>
  );
}
