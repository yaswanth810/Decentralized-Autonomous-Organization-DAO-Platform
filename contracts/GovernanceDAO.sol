// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./GovernanceToken.sol";
import "./TimeLock.sol";

/**
 * @title GovernanceDAO
 * @author DAO Platform
 * @notice The core DAO governance contract. Token holders create proposals,
 *         vote with token-weighted ballots, and execute approved proposals
 *         through a timelock delay.
 *
 * @dev Proposal lifecycle:
 *      1. createProposal() — Proposer submits with title, description, duration
 *      2. vote()           — Token holders cast For/Against during voting window
 *      3. executeProposal() — After deadline, if passed, queues through TimeLock
 *      4. TimeLock executes the actual on-chain action after the delay
 *
 *      Voting power = token balance of msg.sender at time of vote.
 *      Double-voting is prevented per proposal per address.
 */
contract GovernanceDAO is Ownable, ReentrancyGuard {
    // ─── Type Declarations ──────────────────────────────────────────

    /**
     * @notice Represents a governance proposal.
     * @param id Unique auto-incrementing identifier.
     * @param title Short human-readable title.
     * @param description Detailed proposal description or IPFS hash.
     * @param proposer Address that created the proposal.
     * @param deadline Block timestamp after which voting closes.
     * @param yesVotes Total token-weighted "For" votes.
     * @param noVotes Total token-weighted "Against" votes.
     * @param executed Whether the proposal has been sent to the TimeLock.
     * @param cancelled Whether the proposal was cancelled before deadline.
     */
    struct Proposal {
        uint256 id;
        string title;
        string description;
        address proposer;
        uint256 deadline;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
        bool cancelled;
    }

    // ─── State Variables ────────────────────────────────────────────

    /// @notice The governance token used for voting weight.
    GovernanceToken public governanceToken;

    /// @notice The timelock contract that queues and delays execution.
    TimeLock public timeLock;

    /// @notice Auto-incrementing proposal counter (next ID to assign).
    uint256 public proposalCount;

    /// @notice Minimum DAOV balance required to create a proposal (in wei).
    uint256 public minimumTokensToPropose;

    /// @notice Maximum voting duration allowed: 30 days.
    uint256 public constant MAX_VOTING_DURATION = 30 days;

    /// @notice Minimum voting duration allowed: 1 day.
    uint256 public constant MIN_VOTING_DURATION = 1 days;

    /// @notice Mapping from proposal ID to Proposal struct.
    mapping(uint256 => Proposal) public proposals;

    /// @notice Tracks whether an address has voted on a specific proposal.
    /// @dev proposalId => voter => hasVoted
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @notice Array of all proposal IDs for enumeration.
    uint256[] private _allProposalIds;

    // ─── Events ─────────────────────────────────────────────────────

    /**
     * @notice Emitted when a new proposal is created.
     * @param id The proposal's unique identifier.
     * @param proposer The address that created the proposal.
     * @param title The proposal title.
     * @param deadline The timestamp when voting closes.
     */
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        string title,
        uint256 deadline
    );

    /**
     * @notice Emitted when a vote is cast on a proposal.
     * @param proposalId The proposal being voted on.
     * @param voter The address casting the vote.
     * @param support True = For, False = Against.
     * @param weight The number of tokens backing this vote.
     */
    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );

    /**
     * @notice Emitted when a proposal is executed (queued in TimeLock).
     * @param id The executed proposal's identifier.
     * @param executor The address that triggered execution.
     */
    event ProposalExecuted(uint256 indexed id, address indexed executor);

    /**
     * @notice Emitted when a proposal is cancelled.
     * @param id The cancelled proposal's identifier.
     * @param cancelledBy The address that cancelled it.
     */
    event ProposalCancelled(uint256 indexed id, address indexed cancelledBy);

    /**
     * @notice Emitted when the minimum token threshold is updated.
     * @param oldThreshold The previous minimum.
     * @param newThreshold The new minimum.
     */
    event MinimumTokensUpdated(uint256 oldThreshold, uint256 newThreshold);

    /**
     * @notice Emitted when the TimeLock address is updated.
     * @param oldTimeLock The previous TimeLock address.
     * @param newTimeLock The new TimeLock address.
     */
    event TimeLockUpdated(address indexed oldTimeLock, address indexed newTimeLock);

    // ─── Errors ─────────────────────────────────────────────────────

    error InsufficientTokens(uint256 required, uint256 actual);
    error InvalidDuration(uint256 provided, uint256 min, uint256 max);
    error ProposalNotFound(uint256 proposalId);
    error VotingNotActive(uint256 proposalId);
    error AlreadyVoted(uint256 proposalId, address voter);
    error ZeroVotingPower(address voter);
    error ProposalNotPassed(uint256 proposalId);
    error VotingNotEnded(uint256 proposalId, uint256 deadline);
    error ProposalAlreadyExecuted(uint256 proposalId);
    error ProposalAlreadyCancelled(uint256 proposalId);
    error NotProposerOrOwner(uint256 proposalId, address caller);
    error VotingAlreadyEnded(uint256 proposalId);
    error EmptyTitle();
    error EmptyDescription();
    error ZeroAddress();

    // ─── Constructor ────────────────────────────────────────────────

    /**
     * @notice Deploys the GovernanceDAO contract.
     * @param _governanceToken Address of the deployed GovernanceToken.
     * @param _timeLock Address of the deployed TimeLock contract.
     * @param _minimumTokensToPropose Minimum DAOV balance (in wei) required
     *        to create a proposal. Example: 100e18 = 100 DAOV.
     */
    constructor(
        address _governanceToken,
        address _timeLock,
        uint256 _minimumTokensToPropose
    ) Ownable(msg.sender) {
        if (_governanceToken == address(0)) revert ZeroAddress();
        if (_timeLock == address(0)) revert ZeroAddress();

        governanceToken = GovernanceToken(_governanceToken);
        timeLock = TimeLock(payable(_timeLock));
        minimumTokensToPropose = _minimumTokensToPropose;
    }

    // ─── Proposal Management ────────────────────────────────────────

    /**
     * @notice Creates a new governance proposal.
     *
     * @param _title Short, human-readable proposal title (non-empty).
     * @param _description Full proposal description or IPFS CID (non-empty).
     * @param _durationInDays Voting window in days (1–30).
     *
     * @return proposalId The ID of the newly created proposal.
     *
     * @dev Requirements:
     *      - Caller must hold at least `minimumTokensToPropose` DAOV
     *      - Duration must be between 1 and 30 days
     *      - Title and description must be non-empty
     */
    function createProposal(
        string calldata _title,
        string calldata _description,
        uint256 _durationInDays
    ) external returns (uint256 proposalId) {
        // Validate inputs
        if (bytes(_title).length == 0) revert EmptyTitle();
        if (bytes(_description).length == 0) revert EmptyDescription();

        uint256 callerBalance = governanceToken.balanceOf(msg.sender);
        if (callerBalance < minimumTokensToPropose) {
            revert InsufficientTokens(minimumTokensToPropose, callerBalance);
        }

        uint256 durationInSeconds = _durationInDays * 1 days;
        if (durationInSeconds < MIN_VOTING_DURATION || durationInSeconds > MAX_VOTING_DURATION) {
            revert InvalidDuration(
                durationInSeconds,
                MIN_VOTING_DURATION,
                MAX_VOTING_DURATION
            );
        }

        // Create the proposal
        proposalId = proposalCount;
        proposalCount++;

        uint256 deadline = block.timestamp + durationInSeconds;

        proposals[proposalId] = Proposal({
            id: proposalId,
            title: _title,
            description: _description,
            proposer: msg.sender,
            deadline: deadline,
            yesVotes: 0,
            noVotes: 0,
            executed: false,
            cancelled: false
        });

        _allProposalIds.push(proposalId);

        emit ProposalCreated(proposalId, msg.sender, _title, deadline);
    }

    /**
     * @notice Casts a token-weighted vote on an active proposal.
     *
     * @param _proposalId The ID of the proposal to vote on.
     * @param _support True to vote For, false to vote Against.
     *
     * @dev Voting weight equals the caller's current DAOV balance.
     *      Each address can only vote once per proposal.
     *
     *      Requirements:
     *      - Proposal must exist and not be cancelled
     *      - Current time must be before the proposal deadline
     *      - Caller must not have already voted on this proposal
     *      - Caller must hold at least 1 DAOV token
     */
    function vote(uint256 _proposalId, bool _support) external {
        Proposal storage proposal = proposals[_proposalId];

        // Validate proposal exists
        if (proposal.deadline == 0) revert ProposalNotFound(_proposalId);
        if (proposal.cancelled) revert ProposalAlreadyCancelled(_proposalId);
        if (block.timestamp >= proposal.deadline) revert VotingNotActive(_proposalId);
        if (hasVoted[_proposalId][msg.sender]) revert AlreadyVoted(_proposalId, msg.sender);

        uint256 voterBalance = governanceToken.balanceOf(msg.sender);
        if (voterBalance == 0) revert ZeroVotingPower(msg.sender);

        // Record the vote
        hasVoted[_proposalId][msg.sender] = true;

        if (_support) {
            proposal.yesVotes += voterBalance;
        } else {
            proposal.noVotes += voterBalance;
        }

        emit Voted(_proposalId, msg.sender, _support, voterBalance);
    }

    /**
     * @notice Executes a passed proposal by queuing it in the TimeLock.
     *
     * @param _proposalId The ID of the proposal to execute.
     * @param _target The contract address the proposal action calls.
     * @param _value The ETH value (in wei) to send with the call.
     * @param _data The encoded function call data (abi.encodeWithSignature).
     *
     * @dev A proposal is considered "passed" when:
     *      - The voting deadline has elapsed
     *      - yesVotes > noVotes (strict majority)
     *      - It has not already been executed or cancelled
     *
     *      The actual execution is delayed by the TimeLock's minimum delay
     *      to give the community time to react.
     *
     * @custom:security Uses ReentrancyGuard to prevent re-entrancy attacks
     *         during the TimeLock queueing process.
     */
    function executeProposal(
        uint256 _proposalId,
        address _target,
        uint256 _value,
        bytes calldata _data
    ) external nonReentrant {
        Proposal storage proposal = proposals[_proposalId];

        // Validate proposal state
        if (proposal.deadline == 0) revert ProposalNotFound(_proposalId);
        if (proposal.executed) revert ProposalAlreadyExecuted(_proposalId);
        if (proposal.cancelled) revert ProposalAlreadyCancelled(_proposalId);
        if (block.timestamp < proposal.deadline) {
            revert VotingNotEnded(_proposalId, proposal.deadline);
        }
        if (proposal.yesVotes <= proposal.noVotes) {
            revert ProposalNotPassed(_proposalId);
        }

        // Mark as executed before external call (checks-effects-interactions)
        proposal.executed = true;

        // Queue through TimeLock
        uint256 eta = block.timestamp + timeLock.minDelay();
        timeLock.queueTransaction(_target, _value, _data, eta);

        emit ProposalExecuted(_proposalId, msg.sender);
    }

    /**
     * @notice Cancels a proposal. Only the original proposer or the
     *         contract owner can cancel, and only before the deadline.
     *
     * @param _proposalId The ID of the proposal to cancel.
     *
     * @dev A cancelled proposal cannot be voted on, executed, or re-activated.
     *      Cancellation is only allowed while voting is still active
     *      (before the deadline).
     */
    function cancelProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];

        if (proposal.deadline == 0) revert ProposalNotFound(_proposalId);
        if (proposal.cancelled) revert ProposalAlreadyCancelled(_proposalId);
        if (proposal.executed) revert ProposalAlreadyExecuted(_proposalId);
        if (block.timestamp >= proposal.deadline) revert VotingAlreadyEnded(_proposalId);

        if (msg.sender != proposal.proposer && msg.sender != owner()) {
            revert NotProposerOrOwner(_proposalId, msg.sender);
        }

        proposal.cancelled = true;

        emit ProposalCancelled(_proposalId, msg.sender);
    }

    // ─── View Functions ─────────────────────────────────────────────

    /**
     * @notice Returns the full details of a proposal.
     * @param _proposalId The ID of the proposal to query.
     * @return The Proposal struct with all fields.
     */
    function getProposal(uint256 _proposalId) external view returns (Proposal memory) {
        if (proposals[_proposalId].deadline == 0) revert ProposalNotFound(_proposalId);
        return proposals[_proposalId];
    }

    /**
     * @notice Returns an array of IDs for all currently active proposals.
     *         A proposal is "active" if voting is still open (deadline has
     *         not passed, not executed, not cancelled).
     *
     * @return activeIds An array of active proposal IDs.
     *
     * @dev This function iterates all proposals. For DAOs with thousands
     *      of proposals, consider off-chain indexing via events.
     */
    function getActiveProposals() external view returns (uint256[] memory) {
        uint256 activeCount = 0;

        // First pass: count active proposals
        for (uint256 i = 0; i < _allProposalIds.length; i++) {
            Proposal storage p = proposals[_allProposalIds[i]];
            if (!p.executed && !p.cancelled && block.timestamp < p.deadline) {
                activeCount++;
            }
        }

        // Second pass: populate the result array
        uint256[] memory activeIds = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < _allProposalIds.length; i++) {
            Proposal storage p = proposals[_allProposalIds[i]];
            if (!p.executed && !p.cancelled && block.timestamp < p.deadline) {
                activeIds[index] = _allProposalIds[i];
                index++;
            }
        }

        return activeIds;
    }

    /**
     * @notice Checks whether a specific address has voted on a proposal.
     * @param _proposalId The proposal ID.
     * @param _voter The address to check.
     * @return True if the address has voted, false otherwise.
     */
    function hasVotedOn(uint256 _proposalId, address _voter) external view returns (bool) {
        return hasVoted[_proposalId][_voter];
    }

    /**
     * @notice Returns the total number of proposals ever created.
     * @return The proposal count.
     */
    function getProposalCount() external view returns (uint256) {
        return proposalCount;
    }

    // ─── Admin Functions ────────────────────────────────────────────

    /**
     * @notice Updates the minimum token balance required to create proposals.
     *         Only callable by the contract owner.
     *
     * @param _newMinimum The new minimum balance in wei.
     */
    function setMinimumTokensToPropose(uint256 _newMinimum) external onlyOwner {
        uint256 oldMinimum = minimumTokensToPropose;
        minimumTokensToPropose = _newMinimum;
        emit MinimumTokensUpdated(oldMinimum, _newMinimum);
    }

    /**
     * @notice Updates the TimeLock contract address.
     *         Only callable by the contract owner.
     *
     * @param _newTimeLock The address of the new TimeLock contract.
     */
    function setTimeLock(address _newTimeLock) external onlyOwner {
        if (_newTimeLock == address(0)) revert ZeroAddress();
        address oldTimeLock = address(timeLock);
        timeLock = TimeLock(payable(_newTimeLock));
        emit TimeLockUpdated(oldTimeLock, _newTimeLock);
    }
}
