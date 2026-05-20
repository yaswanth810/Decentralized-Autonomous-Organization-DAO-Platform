// Minimal ABIs — only the functions the frontend calls.
// These are manually extracted to keep the bundle small.

export const GOVERNANCE_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

export const GOVERNANCE_DAO_ABI = [
  // Read
  "function proposalCount() view returns (uint256)",
  "function minimumTokensToPropose() view returns (uint256)",
  "function getProposal(uint256 proposalId) view returns (tuple(uint256 id, string title, string description, address proposer, uint256 deadline, uint256 yesVotes, uint256 noVotes, bool executed, bool cancelled))",
  "function getActiveProposals() view returns (uint256[])",
  "function hasVotedOn(uint256 proposalId, address voter) view returns (bool)",
  "function getProposalCount() view returns (uint256)",
  // Write
  "function createProposal(string title, string description, uint256 durationInDays) returns (uint256)",
  "function vote(uint256 proposalId, bool support)",
  "function executeProposal(uint256 proposalId, address target, uint256 value, bytes data)",
  "function cancelProposal(uint256 proposalId)",
  // Events
  "event ProposalCreated(uint256 indexed id, address indexed proposer, string title, uint256 deadline)",
  "event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight)",
  "event ProposalExecuted(uint256 indexed id, address indexed executor)",
  "event ProposalCancelled(uint256 indexed id, address indexed cancelledBy)",
];

export const TREASURY_ABI = [
  "function getBalance() view returns (uint256)",
  "function getTokenBalance(address token) view returns (uint256)",
  "function timeLock() view returns (address)",
  "event ETHDeposited(address indexed sender, uint256 amount)",
  "event ETHWithdrawn(address indexed to, uint256 amount)",
];

export const TIMELOCK_ABI = [
  "function minDelay() view returns (uint256)",
  "function transactionCount() view returns (uint256)",
  "function isTransactionReady(uint256 txId) view returns (bool)",
  "function getTransaction(uint256 txId) view returns (tuple(address target, uint256 value, bytes data, uint256 eta, bool queued, bool executed))",
  "function executeTransaction(uint256 txId)",
  "event Queued(uint256 indexed txId, address indexed target, uint256 value, bytes data, uint256 eta)",
  "event Executed(uint256 indexed txId, address indexed target, uint256 value, bytes data)",
];
