import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { shortenAddress } from "../config";
import toast from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────────────────

interface Proposal {
  id: number;
  title: string;
  description: string;
  proposer: string;
  deadline: number;
  yesVotes: bigint;
  noVotes: bigint;
  executed: boolean;
  cancelled: boolean;
}

type FilterTab = "all" | "active" | "passed" | "rejected" | "executed";
type SortOption = "newest" | "ending-soon" | "most-votes";

// ─── Helpers ────────────────────────────────────────────────────────

function getStatus(p: Proposal): string {
  if (p.cancelled) return "cancelled";
  if (p.executed) return "executed";
  if (Date.now() / 1000 < p.deadline) return "active";
  return p.yesVotes > p.noVotes ? "passed" : "rejected";
}

function getCountdown(deadline: number): string {
  const diff = deadline - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

const BADGE_CLASSES: Record<string, string> = {
  active: "badge-active",
  passed: "badge-passed",
  rejected: "badge-rejected",
  executed: "badge-executed",
  cancelled: "badge bg-gray-500/15 text-gray-400 border border-gray-500/30",
};

// ─── Skeleton ───────────────────────────────────────────────────────

function ProposalSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4 animate-fade-in">
      <div className="flex justify-between">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-6 w-20" />
      </div>
      <div className="skeleton h-4 w-32" />
      <div className="flex gap-8">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-4 w-24" />
      </div>
      <div className="skeleton h-2 w-full rounded-full" />
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────

export default function ProposalList() {
  const { daoContract, isConnected, votingPower } = useWeb3();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortOption>("newest");

  // ── Fetch proposals ──
  useEffect(() => {
    async function fetchProposals() {
      if (!daoContract) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const count = await daoContract.getProposalCount();
        const total = Number(count);
        const fetched: Proposal[] = [];

        for (let i = 0; i < total; i++) {
          try {
            const p = await daoContract.getProposal(i);
            fetched.push({
              id: Number(p.id),
              title: p.title,
              description: p.description,
              proposer: p.proposer,
              deadline: Number(p.deadline),
              yesVotes: p.yesVotes,
              noVotes: p.noVotes,
              executed: p.executed,
              cancelled: p.cancelled,
            });
          } catch {
            // skip invalid proposals
          }
        }

        setProposals(fetched);
      } catch (err: any) {
        console.error("Failed to fetch proposals:", err);
        toast.error("Failed to load proposals");
      } finally {
        setLoading(false);
      }
    }

    fetchProposals();
  }, [daoContract]);

  // ── Filter + Sort ──
  const filteredProposals = useMemo(() => {
    let result = [...proposals];

    if (filter !== "all") {
      result = result.filter((p) => getStatus(p) === filter);
    }

    switch (sort) {
      case "newest":
        result.sort((a, b) => b.id - a.id);
        break;
      case "ending-soon":
        result.sort((a, b) => a.deadline - b.deadline);
        break;
      case "most-votes":
        result.sort((a, b) => {
          const totalB = b.yesVotes + b.noVotes;
          const totalA = a.yesVotes + a.noVotes;
          return totalB > totalA ? 1 : totalB < totalA ? -1 : 0;
        });
        break;
    }

    return result;
  }, [proposals, filter, sort]);

  const FILTERS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "passed", label: "Passed" },
    { key: "rejected", label: "Rejected" },
    { key: "executed", label: "Executed" },
  ];

  const SORTS: { key: SortOption; label: string }[] = [
    { key: "newest", label: "Newest" },
    { key: "ending-soon", label: "Ending Soon" },
    { key: "most-votes", label: "Most Votes" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Voting Power Banner ── */}
      {isConnected && (
        <div className="glass-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center">
              <span className="text-brand-400 text-lg">⚡</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Your Voting Power</p>
              <p className="text-xl font-bold text-white">
                {Number(votingPower).toLocaleString()} <span className="text-sm text-gray-400 font-normal">DAOV</span>
              </p>
            </div>
          </div>
          <Link to="/create" className="btn-primary text-sm" id="create-proposal-btn">
            + New Proposal
          </Link>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Governance Proposals</h1>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="input-field w-auto text-sm py-2"
          id="sort-select"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filter === f.key
                ? "bg-brand-500/15 text-brand-400 border border-brand-500/30"
                : "text-gray-400 hover:text-gray-200 hover:bg-surface-overlay border border-transparent"
            }`}
            id={`filter-${f.key}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Loading Skeletons ── */}
      {loading && (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <ProposalSkeleton key={i} />
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && filteredProposals.length === 0 && (
        <div className="glass-card p-12 text-center">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No proposals found</h3>
          <p className="text-gray-500 mb-6">
            {filter !== "all" ? `No ${filter} proposals yet.` : "Be the first to create a governance proposal."}
          </p>
          {isConnected && (
            <Link to="/create" className="btn-primary inline-block text-sm">
              Create Proposal
            </Link>
          )}
        </div>
      )}

      {/* ── Proposal Cards ── */}
      {!loading && filteredProposals.length > 0 && (
        <div className="grid gap-4">
          {filteredProposals.map((p) => {
            const status = getStatus(p);
            const totalVotes = p.yesVotes + p.noVotes;
            const yesPercent = totalVotes > 0n ? Number((p.yesVotes * 100n) / totalVotes) : 0;

            return (
              <Link
                key={p.id}
                to={`/proposal/${p.id}`}
                className="glass-card p-6 block group"
                id={`proposal-card-${p.id}`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white group-hover:text-brand-400 transition-colors truncate">
                      {p.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      by {shortenAddress(p.proposer)} · #{p.id}
                    </p>
                  </div>
                  <span className={BADGE_CLASSES[status] || "badge"}>
                    {status}
                  </span>
                </div>

                {/* Vote bar */}
                <div className="flex items-center gap-4 text-sm mb-3">
                  <span className="text-success">
                    ✓ {Number(ethers.formatEther(p.yesVotes)).toLocaleString()}
                  </span>
                  <span className="text-danger">
                    ✗ {Number(ethers.formatEther(p.noVotes)).toLocaleString()}
                  </span>
                  <span className="text-gray-500 ml-auto">
                    {status === "active" ? getCountdown(p.deadline) : new Date(p.deadline * 1000).toLocaleDateString()}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-success to-emerald-400 rounded-full transition-all duration-500"
                    style={{ width: `${yesPercent}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
