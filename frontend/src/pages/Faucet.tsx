import { useState } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";

export default function Faucet() {
  const { tokenContract, isConnected, walletAddress, refreshBalance, votingPower } = useWeb3();
  const [claiming, setClaiming] = useState(false);
  const [claimAmount] = useState("500");

  const handleClaim = async () => {
    if (!tokenContract || !walletAddress) {
      toast.error("Connect your wallet first");
      return;
    }

    setClaiming(true);
    try {
      // Check if the connected wallet is the token owner (deployer)
      const owner = await tokenContract.owner();
      if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
        toast.error(
          "Only the token deployer can mint from this faucet. Ask the deployer to send you DAOV tokens.",
        );
        setClaiming(false);
        return;
      }

      const amount = ethers.parseEther(claimAmount);
      const tx = await tokenContract.mint(walletAddress, amount);
      toast("Minting tokens...", { icon: "⏳" });
      await tx.wait();
      await refreshBalance();
      toast.success(`${claimAmount} DAOV tokens claimed successfully!`);
    } catch (err: any) {
      console.error("Claim failed:", err);
      if (err?.reason) {
        toast.error(`Claim failed: ${err.reason}`);
      } else {
        toast.error("Failed to claim tokens. You may not have minting permissions.");
      }
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">🪙 Get DAOV Tokens</h1>

      <div className="glass-card p-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="text-5xl">💰</div>
          <h2 className="text-xl font-bold text-white">DAOV Token Faucet</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            You need at least <span className="text-brand-400 font-bold">100 DAOV</span> tokens to
            create a governance proposal. Use this faucet to claim test tokens.
          </p>
        </div>

        {/* Current Balance */}
        <div className="bg-surface-overlay border border-surface-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Your Balance</span>
            <span className="text-white font-bold text-lg">
              {isConnected ? `${Number(votingPower).toLocaleString()} DAOV` : "—"}
            </span>
          </div>
          {isConnected && Number(votingPower) >= 100 && (
            <p className="text-success text-xs mt-2">
              ✓ You have enough tokens to create proposals
            </p>
          )}
          {isConnected && Number(votingPower) < 100 && Number(votingPower) > 0 && (
            <p className="text-warning text-xs mt-2">
              ⚠ You need {(100 - Number(votingPower)).toFixed(0)} more DAOV to create proposals
            </p>
          )}
        </div>

        {/* Claim Section */}
        {!isConnected ? (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm mb-3">Connect your wallet to claim tokens</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-surface-overlay border border-surface-border rounded-xl p-4">
              <p className="text-gray-400 text-xs mb-2">Amount to Claim</p>
              <p className="text-3xl font-bold text-brand-400">{claimAmount} DAOV</p>
            </div>

            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full btn-primary py-3 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              id="claim-tokens-button"
            >
              {claiming ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Minting...
                </span>
              ) : (
                "🪙 Claim DAOV Tokens"
              )}
            </button>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-brand-500/5 border border-brand-500/20 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-brand-400">How to get DAOV tokens:</h3>
          <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
            <li>Connect your wallet to SCAI Mainnet (auto-prompted)</li>
            <li>If you're the deployer, click "Claim DAOV Tokens" above</li>
            <li>Otherwise, ask the DAO deployer to transfer tokens to your address</li>
            <li>Once you have ≥100 DAOV, you can create governance proposals</li>
          </ol>
        </div>

        {/* Deployer Contact */}
        <div className="bg-surface-overlay border border-surface-border rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs">
            Need tokens? Contact the DAO deployer to receive DAOV tokens at your connected address.
          </p>
          {isConnected && (
            <p className="text-brand-400 font-mono text-xs mt-2 break-all">{walletAddress}</p>
          )}
        </div>
      </div>
    </div>
  );
}
