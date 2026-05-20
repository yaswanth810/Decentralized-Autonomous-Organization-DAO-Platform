import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { getExplorerUrl } from "../config";
import toast from "react-hot-toast";

// ─── Validation Schema ──────────────────────────────────────────────

const proposalSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title must be under 100 characters"),
  description: z.string().min(50, "Description must be at least 50 characters"),
  durationInDays: z.number().min(1, "Minimum 1 day").max(30, "Maximum 30 days"),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

// ─── Component ──────────────────────────────────────────────────────

export default function CreateProposal() {
  const navigate = useNavigate();
  const { daoContract, tokenContract, isConnected, walletAddress, votingPower, chainId } = useWeb3();

  const [minTokens, setMinTokens] = useState<string>("0");
  const [hasEnoughTokens, setHasEnoughTokens] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: { title: "", description: "", durationInDays: 7 },
  });

  const watchTitle = watch("title");
  const watchDescription = watch("description");
  const watchDuration = watch("durationInDays");

  // ── Check minimum tokens ──
  useEffect(() => {
    async function checkBalance() {
      if (!daoContract || !tokenContract || !walletAddress) return;
      try {
        const min = await daoContract.minimumTokensToPropose();
        const bal = await tokenContract.balanceOf(walletAddress);
        setMinTokens(ethers.formatEther(min));
        setHasEnoughTokens(bal >= min);
      } catch {
        console.error("Failed to check token balance");
      }
    }
    checkBalance();
  }, [daoContract, tokenContract, walletAddress]);

  // ── Submit ──
  async function onSubmit(data: ProposalFormData) {
    if (!daoContract) return;

    try {
      setSubmitting(true);
      toast.loading("Creating proposal...", { id: "create" });

      const tx = await daoContract.createProposal(data.title, data.description, data.durationInDays);
      setTxHash(tx.hash);
      toast.loading("Waiting for confirmation...", { id: "create" });

      const receipt = await tx.wait();
      toast.success("Proposal created!", { id: "create" });

      // Parse the ProposalCreated event to get the new ID
      const event = receipt.logs.find((log: any) => {
        try {
          return daoContract.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "ProposalCreated";
        } catch { return false; }
      });

      if (event) {
        const parsed = daoContract.interface.parseLog({ topics: event.topics as string[], data: event.data });
        const newId = parsed?.args[0];
        navigate(`/proposal/${newId}`);
      } else {
        navigate("/");
      }
    } catch (err: any) {
      const msg = err?.reason || err?.message || "Transaction failed";
      toast.error(msg, { id: "create" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto glass-card p-12 text-center animate-fade-in">
        <div className="text-5xl mb-4">🔗</div>
        <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400">You need to connect your wallet to create a proposal.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">Create Proposal</h1>

      {/* Insufficient tokens warning */}
      {!hasEnoughTokens && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-start gap-3">
          <span className="text-danger text-xl">⚠</span>
          <div>
            <p className="text-danger font-semibold">Insufficient DAOV tokens</p>
            <p className="text-gray-400 text-sm mt-1">
              You need at least <strong>{Number(minTokens).toLocaleString()} DAOV</strong> to create a proposal.
              You currently have <strong>{Number(votingPower).toLocaleString()} DAOV</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Form / Preview */}
      <div className="flex gap-2 border-b border-surface-border pb-2">
        <button onClick={() => setPreviewMode(false)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${!previewMode ? "bg-brand-500/15 text-brand-400" : "text-gray-400 hover:text-gray-200"}`}>
          ✏️ Edit
        </button>
        <button onClick={() => setPreviewMode(true)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${previewMode ? "bg-brand-500/15 text-brand-400" : "text-gray-400 hover:text-gray-200"}`}>
          👁 Preview
        </button>
      </div>

      {/* Preview */}
      {previewMode ? (
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="badge-active">Active</span>
            <span className="text-gray-500 text-sm">Preview</span>
          </div>
          <h2 className="text-2xl font-bold text-white">{watchTitle || "Untitled Proposal"}</h2>
          <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{watchDescription || "No description yet..."}</p>
          <p className="text-sm text-gray-500">Voting duration: {watchDuration} day{watchDuration !== 1 ? "s" : ""}</p>
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 space-y-5">
          {/* Title */}
          <div>
            <div className="flex justify-between mb-2">
              <label htmlFor="title" className="text-sm font-medium text-gray-300">Title</label>
              <span className={`text-xs ${(watchTitle?.length || 0) > 90 ? "text-warning" : "text-gray-500"}`}>
                {watchTitle?.length || 0}/100
              </span>
            </div>
            <input id="title" type="text" placeholder="A clear, concise proposal title"
              className="input-field" {...register("title")} maxLength={100} />
            {errors.title && <p className="text-danger text-xs mt-1">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div>
            <div className="flex justify-between mb-2">
              <label htmlFor="description" className="text-sm font-medium text-gray-300">Description</label>
              <span className={`text-xs ${(watchDescription?.length || 0) < 50 ? "text-warning" : "text-gray-500"}`}>
                {watchDescription?.length || 0} chars (min 50)
              </span>
            </div>
            <textarea id="description" rows={6} placeholder="Describe your proposal in detail. Markdown is supported."
              className="input-field resize-y min-h-[120px]" {...register("description")} />
            {errors.description && <p className="text-danger text-xs mt-1">{errors.description.message}</p>}
          </div>

          {/* Duration Slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label htmlFor="duration" className="text-sm font-medium text-gray-300">Voting Duration</label>
              <span className="text-brand-400 font-semibold text-sm">
                {watchDuration} day{watchDuration !== 1 ? "s" : ""}
              </span>
            </div>
            <input id="duration" type="range" min={1} max={30} step={1}
              className="w-full h-2 bg-surface-overlay rounded-full appearance-none cursor-pointer accent-brand-500"
              {...register("durationInDays", { valueAsNumber: true })} />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>1 day</span><span>15 days</span><span>30 days</span>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={submitting || !hasEnoughTokens} className="btn-primary w-full" id="submit-proposal-btn">
            {submitting ? "Creating..." : "Create Proposal"}
          </button>

          {/* Tx Hash */}
          {txHash && (
            <div className="text-center text-sm">
              <a href={getExplorerUrl(chainId, "tx", txHash)} target="_blank" rel="noopener noreferrer"
                className="text-brand-400 hover:underline font-mono">
                View on Explorer →
              </a>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
