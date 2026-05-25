import { useWeb3 } from "../context/Web3Context";
import { getExplorerUrl } from "../config";

export default function Footer() {
  const { network, chainId } = useWeb3();
  const contracts = network?.contracts;

  const links = contracts
    ? [
        { label: "Token", address: contracts.governanceToken },
        { label: "DAO", address: contracts.governanceDAO },
        { label: "TimeLock", address: contracts.timeLock },
        { label: "Treasury", address: contracts.treasury },
      ].filter((l) => l.address)
    : [];

  return (
    <footer className="border-t border-surface-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Ether Authority Branding */}
        <div className="flex flex-col items-center gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/ether-authority-logo.svg"
              alt="Ether Authority"
              className="h-7 w-auto opacity-80"
            />
            <span className="text-sm font-bold text-[#1a6fd4] tracking-wide">
              ETHER AUTHORITY
            </span>
          </div>
          <p className="text-xs text-gray-600 text-center max-w-md">
            Empowering decentralized governance through secure, transparent smart contract solutions.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 border-t border-surface-border pt-4">
          <p>© 2026 Ether Authority — DAO Governance Platform</p>

          {links.length > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-gray-600">Contracts:</span>
              {links.map(({ label, address }) => (
                <a
                  key={label}
                  href={getExplorerUrl(chainId, "address", address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-brand-400 transition-colors font-mono text-xs"
                  id={`footer-link-${label.toLowerCase()}`}
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
