import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { shortenAddress } from "../config";
import toast from "react-hot-toast";

export default function VotingDashboard() {
  const { daoContract, treasuryContract, tokenContract, isConnected, walletAddress, votingPower } = useWeb3();

  const [stats, setStats] = useState({
    totalProposals: 0,
    activeProposals: 0,
    treasuryBalance: "0",
    totalSupply: "0",
    minTokens: "0",
  });
  const [recentVotes, setRecentVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!daoContract) return setLoading(false);
      try {
        const [count, activeIds] = await Promise.all([
          daoContract.getProposalCount(),
          daoContract.getActiveProposals(),
        ]);

        let treasuryBal = "0";
        if (treasuryContract) {
          const bal = await treasuryContract.getBalance();
          treasuryBal = ethers.formatEther(bal);
        }

        let supply = "0";
        let minTok = "0";
        if (tokenContract) {
          const s = await tokenContract.totalSupply();
          supply = ethers.formatEther(s);
        }
        const min = await daoContract.minimumTokensToPropose();
        minTok = ethers.formatEther(min);

        setStats({
          totalProposals: Number(count),
          activeProposals: activeIds.length,
          treasuryBalance: treasuryBal,
          totalSupply: supply,
          minTokens: minTok,
        });

        // Fetch recent proposals for "recent votes" section
        const recent: any[] = [];
        const total = Number(count);
        for (let i = Math.max(0, total - 5); i < total; i++) {
          try {
            const p = await daoContract.getProposal(i);
            let voted = false;
            if (walletAddress) {
              voted = await daoContract.hasVotedOn(i, walletAddress);
            }
            recent.push({
              id: Number(p.id), title: p.title,
              yesVotes: ethers.formatEther(p.yesVotes),
              noVotes: ethers.formatEther(p.noVotes),
              voted,
            });
          } catch { /* skip */ }
        }
        setRecentVotes(recent.reverse());
      } catch (err) {
        console.error(err);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [daoContract, treasuryContract, tokenContract, walletAddress]);

  const STAT_CARDS = [
    { label: "Total Proposals", value: stats.totalProposals, icon: "📋", color: "from-brand-500/20 to-brand-600/10" },
    { label: "Active Now", value: stats.activeProposals, icon: "🔥", color: "from-warning/20 to-warning/5" },
    { label: "Treasury", value: `${Number(stats.treasuryBalance).toFixed(2)} ETH`, icon: "💰", color: "from-success/20 to-success/5" },
    { label: "Your Power", value: `${Number(votingPower).toLocaleString()} DAOV`, icon: "⚡", color: "from-purple-500/20 to-purple-600/10" },
  ];

  if (!isConnected) {
    return (
      <div className="glass-card p-12 text-center animate-fade-in">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-xl font-bold text-white mb-2">Voting Dashboard</h2>
        <p className="text-gray-400">Connect your wallet to view your governance dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Voting Dashboard</h1>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-6 space-y-3">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-8 w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_CARDS.map((card) => (
            <div key={card.label} className={`glass-card p-6 bg-gradient-to-br ${card.color}`}>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{card.label}</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{card.icon}</span>
                <span className="text-2xl font-bold text-white">{card.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Governance Info */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Governance Parameters</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Min. to Propose</p>
            <p className="text-white font-semibold">{Number(stats.minTokens).toLocaleString()} DAOV</p>
          </div>
          <div>
            <p className="text-gray-500">Total Supply</p>
            <p className="text-white font-semibold">{Number(stats.totalSupply).toLocaleString()} DAOV</p>
          </div>
          <div>
            <p className="text-gray-500">Voting Period</p>
            <p className="text-white font-semibold">1–30 days</p>
          </div>
          <div>
            <p className="text-gray-500">Your Address</p>
            <p className="text-brand-400 font-mono text-xs">{shortenAddress(walletAddress, 6)}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Proposals</h2>
        {recentVotes.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No proposals yet</p>
        ) : (
          <div className="space-y-3">
            {recentVotes.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3 border-b border-surface-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm font-mono">#{r.id}</span>
                  <span className="text-white font-medium">{r.title}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-success">✓ {Number(r.yesVotes).toLocaleString()}</span>
                  <span className="text-danger">✗ {Number(r.noVotes).toLocaleString()}</span>
                  {r.voted && <span className="badge bg-brand-500/15 text-brand-400 border border-brand-500/30 text-xs">Voted</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
