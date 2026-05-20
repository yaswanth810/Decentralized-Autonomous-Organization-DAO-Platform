import { Link, useLocation } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { shortenAddress } from "../config";

const NAV_LINKS = [
  { to: "/", label: "Proposals" },
  { to: "/create", label: "Create" },
  { to: "/dashboard", label: "Dashboard" },
];

export default function Navbar() {
  const { isConnected, walletAddress, network, connectWallet, disconnectWallet } = useWeb3();
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 border-b border-surface-border bg-surface/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:shadow-brand-500/40 transition-shadow">
              <span className="text-white font-bold text-sm">⟠</span>
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
              DAO Gov
            </span>
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
                      : "text-gray-400 hover:text-gray-200 hover:bg-surface-overlay"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Wallet Button */}
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
              <button onClick={connectWallet} className="btn-primary text-sm" id="connect-wallet-button">
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
