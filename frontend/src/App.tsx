import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Web3Provider } from "./context/Web3Context";
import Layout from "./components/Layout";
import ProposalList from "./pages/ProposalList";
import ProposalDetail from "./pages/ProposalDetail";
import CreateProposal from "./pages/CreateProposal";
import VotingDashboard from "./pages/VotingDashboard";
import Faucet from "./pages/Faucet";

function NotFound() {
  return (
    <div className="glass-card p-12 text-center animate-fade-in">
      <div className="text-6xl mb-4">🔍</div>
      <h2 className="text-2xl font-bold text-white mb-2">Page Not Found</h2>
      <p className="text-gray-400 mb-6">The page you're looking for doesn't exist.</p>
      <a href="/" className="btn-primary inline-block">
        Go to Proposals
      </a>
    </div>
  );
}

function App() {
  return (
    <Web3Provider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#161822",
            color: "#e5e7eb",
            border: "1px solid #2a2d3e",
            borderRadius: "12px",
          },
          success: { iconTheme: { primary: "#22c55e", secondary: "#161822" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#161822" } },
        }}
      />
      <Layout>
        <Routes>
          <Route path="/" element={<ProposalList />} />
          <Route path="/proposal/:id" element={<ProposalDetail />} />
          <Route path="/create" element={<CreateProposal />} />
          <Route path="/dashboard" element={<VotingDashboard />} />
          <Route path="/faucet" element={<Faucet />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </Web3Provider>
  );
}

export default App;
