import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import toast from "react-hot-toast";

export default function Faucet() {
  const { tokenContract, isConnected, walletAddress, refreshBalance, votingPower } = useWeb3();
  const [claiming, setClaiming] = useState(false);
  const [claimAmount] = useState("500");
  const [isOwner, setIsOwner] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Check if current user is owner and if they have claimed
  useEffect(() => {
    async function checkStatus() {
      if (tokenContract && walletAddress) {
        try {
          const owner = await tokenContract.owner();
          setIsOwner(owner.toLowerCase() === walletAddress.toLowerCase());
          
          const claimed = await tokenContract.hasClaimedFaucet(walletAddress);
          setHasClaimed(claimed);
        } catch {
          setIsOwner(false);
          setHasClaimed(false);
        }
      } else {
        setIsOwner(false);
        setHasClaimed(false);
      }
    }
    checkStatus();
  }, [tokenContract, walletAddress]);

  const handleClaim = async () => {
    if (!tokenContract || !walletAddress) {
      toast.error("Connect your wallet first");
      return;
    }

    setClaiming(true);
    try {
      let tx;
      if (isOwner) {
        // Owner uses standard mint to mint exactly what they typed
        const amount = ethers.parseEther(claimAmount);
        tx = await tokenContract.mint(walletAddress, amount);
      } else {
        // Public users use the 1000 DAOV public faucet function
        tx = await tokenContract.faucetMint();
      }
      
      toast("Minting tokens...", { icon: "⏳" });
      await tx.wait();
      await refreshBalance();
      setHasClaimed(true);
      toast.success(isOwner ? `${claimAmount} DAOV tokens claimed!` : `1000 DAOV test tokens claimed successfully!`);
    } catch (err: any) {
      console.error("Claim failed:", err);
      if (err?.reason) {
        toast.error(`Claim failed: ${err.reason}`);
      } else {
        toast.error("Failed to claim tokens. Ensure you haven't claimed already.");
      }
    } finally {
      setClaiming(false);
    }
  };

  const handleTransfer = async () => {
    if (!tokenContract || !walletAddress || !recipientAddress) return;
    
    setTransferring(true);
    try {
      const amount = ethers.parseEther("500");
      const tx = await tokenContract.transfer(recipientAddress, amount);
      toast("Transferring 500 DAOV...", { icon: "⏳" });
      await tx.wait();
      await refreshBalance();
      setRecipientAddress("");
      toast.success("Successfully sent 500 DAOV to reviewer!");
    } catch (err: any) {
      console.error("Transfer failed:", err);
      toast.error("Failed to transfer tokens.");
    } finally {
      setTransferring(false);
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

        {/* Claim/Transfer Section */}
        {!isConnected ? (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm mb-3">Connect your wallet to claim tokens</p>
          </div>
        ) : isOwner ? (
          <div className="space-y-6">
            <div className="bg-surface-overlay border border-surface-border rounded-xl p-4">
              <p className="text-gray-400 text-xs mb-2">Deployer Minting (Admin Only)</p>
              <div className="flex items-center gap-4">
                <p className="text-3xl font-bold text-brand-400">{claimAmount} DAOV</p>
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="btn-primary py-2 px-6 font-bold disabled:opacity-50"
                >
                  {claiming ? "Minting..." : "Mint Tokens"}
                </button>
              </div>
            </div>

            <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">Send Tokens to Reviewer</h3>
              <p className="text-xs text-gray-400">
                Send 500 DAOV from your deployer balance to the Ether Authority reviewer's address so they can test the dApp.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Reviewer's Wallet Address (0x...)"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
                />
                <button
                  onClick={handleTransfer}
                  disabled={transferring || !recipientAddress}
                  className="bg-brand-600 hover:bg-brand-500 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:opacity-50 transition-colors"
                >
                  {transferring ? "Sending..." : "Send 500 DAOV"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface-overlay border border-surface-border rounded-xl p-6 text-center space-y-4">
            <div className="text-3xl">🎁</div>
            <h3 className="text-white font-bold">Public Faucet</h3>
            <p className="text-sm text-gray-400">
              Claim 1,000 DAOV test tokens to participate in governance proposals. You can only claim this once per wallet.
            </p>
            {hasClaimed ? (
              <div className="p-3 rounded-lg border border-success/30 bg-success/10 text-success text-sm font-bold mt-4">
                ✓ You have already claimed your 1000 DAOV tokens.
              </div>
            ) : (
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="w-full btn-primary py-3 mt-4 text-base font-bold disabled:opacity-50"
              >
                {claiming ? "Claiming..." : "Claim 1,000 DAOV"}
              </button>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="bg-brand-500/5 border border-brand-500/20 rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-semibold text-brand-400">How to get DAOV tokens:</h3>
          <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
            <li>Connect your wallet to SCAI Mainnet</li>
            <li>Click "Claim 1,000 DAOV" above to get your tokens instantly</li>
            <li>Once you have ≥100 DAOV, you can create governance proposals</li>
          </ol>
        </div>

      </div>
    </div>
  );
}
