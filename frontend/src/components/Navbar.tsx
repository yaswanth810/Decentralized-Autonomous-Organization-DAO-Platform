import { Link, useLocation } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { shortenAddress } from "../config";

const NAV_LINKS = [
  { to: "/", label: "Proposals" },
  { to: "/create", label: "Create" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/faucet", label: "Get DAOV" },
];

export default function Navbar() {
  const { isConnected, walletAddress, network, connectWallet, disconnectWallet } = useWeb3();
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 border-b border-surface-border bg-surface/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Ether Authority Logo + Name */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <img
              src="/ether-authority-logo.svg"
              alt="Ether Authority"
              className="h-9 w-auto group-hover:scale-105 transition-transform duration-200"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-extrabold text-[#1a6fd4] tracking-wide">
                ETHER AUTHORITY
              </span>
              <span className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">
                DAO Platform
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => {
              const isActive = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-brand-500/15 text-brand-400"
                      : to === "/faucet"
                        ? "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
                        : "text-gray-400 hover:text-gray-200 hover:bg-surface-overlay"
                  }`}
                >
                  {to === "/faucet" ? "🪙 Get DAOV" : label}
                </Link>
              );
            })}
          </div>

          {/* Wallet + Network */}
          <div className="flex items-center gap-3">
            {isConnected && network && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-overlay border border-surface-border text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                {network.name}
              </span>
            )}

            {isConnected ? (
              <button
                onClick={disconnectWallet}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-overlay border border-surface-border text-sm font-medium text-gray-200 hover:border-brand-500/50 hover:text-brand-400 transition-all duration-200"
                id="wallet-button"
              >
                <span className="w-2 h-2 rounded-full bg-success" />
                {shortenAddress(walletAddress)}
              </button>
            ) : (
              <button
                onClick={connectWallet}
                className="btn-primary text-sm"
                id="connect-wallet-button"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
