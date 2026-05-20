// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TimeLock
 * @author DAO Platform
 * @notice Enforces a mandatory time delay between a governance proposal
 *         being approved and its actual on-chain execution. This gives
 *         the community a window to review and react to passed proposals
 *         before they take effect.
 *
 * @dev Uses OpenZeppelin AccessControl for role-based permissions:
 *      - ADMIN_ROLE:    Can update the minimum delay.
 *      - PROPOSER_ROLE: Can queue and cancel transactions (GovernanceDAO).
 *      - EXECUTOR_ROLE: Can execute matured transactions.
 *
 *      Transaction lifecycle: Queue → (wait for delay) → Execute
 *                                  ↘ Cancel (before execution)
 */
contract TimeLock is AccessControl {
    // ─── Roles ──────────────────────────────────────────────────────

    /// @notice Role that can modify the minimum delay.
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Role that can queue and cancel transactions (granted to GovernanceDAO).
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");

    /// @notice Role that can execute matured transactions.
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    // ─── Type Declarations ──────────────────────────────────────────

    /**
     * @notice Represents a queued transaction awaiting execution.
     * @param target The contract address to call.
     * @param value The ETH value (in wei) to send with the call.
     * @param data The encoded function call data (abi.encodeWithSignature).
     * @param eta Earliest Timestamp of Arrival — the earliest time this
     *        transaction can be executed (block.timestamp >= eta).
     * @param queued Whether this transaction is currently in the queue.
     * @param executed Whether this transaction has been executed.
     */
    struct QueuedTransaction {
        address target;
        uint256 value;
        bytes data;
        uint256 eta;
        bool queued;
        bool executed;
    }

    // ─── State Variables ────────────────────────────────────────────

    /// @notice Minimum delay (in seconds) between queueing and execution.
    uint256 public minDelay;

    /// @notice Maximum delay allowed: 30 days.
    uint256 public constant MAX_DELAY = 30 days;

    /// @notice Grace period after ETA within which execution must occur.
    uint256 public constant GRACE_PERIOD = 14 days;

    /// @notice Auto-incrementing transaction ID counter.
    uint256 public transactionCount;

    /// @notice Mapping from transaction ID to QueuedTransaction struct.
    mapping(uint256 => QueuedTransaction) public queuedTransactions;

    // ─── Events ─────────────────────────────────────────────────────

    /**
     * @notice Emitted when a transaction is added to the queue.
     * @param txId The unique transaction identifier.
     * @param target The contract address to be called.
     * @param value The ETH value to be sent.
     * @param data The encoded function call data.
     * @param eta The earliest execution timestamp.
     */
    event Queued(
        uint256 indexed txId,
        address indexed target,
        uint256 value,
        bytes data,
        uint256 eta
    );

    /**
     * @notice Emitted when a queued transaction is executed.
     * @param txId The unique transaction identifier.
     * @param target The contract that was called.
     * @param value The ETH value that was sent.
     * @param data The function call data that was executed.
     */
    event Executed(
        uint256 indexed txId,
        address indexed target,
        uint256 value,
        bytes data
    );

    /**
     * @notice Emitted when a queued transaction is cancelled.
     * @param txId The unique transaction identifier.
     * @param cancelledBy The address that cancelled the transaction.
     */
    event Cancelled(uint256 indexed txId, address indexed cancelledBy);

    /**
     * @notice Emitted when the minimum delay is updated.
     * @param oldDelay The previous minimum delay.
     * @param newDelay The new minimum delay.
     */
    event MinDelayUpdated(uint256 oldDelay, uint256 newDelay);

    // ─── Errors ─────────────────────────────────────────────────────

    error DelayTooShort(uint256 provided, uint256 minimum);
    error DelayTooLong(uint256 provided, uint256 maximum);
    error ETANotMet(uint256 currentTime, uint256 eta);
    error TransactionExpired(uint256 currentTime, uint256 expiryTime);
    error TransactionNotQueued(uint256 txId);
    error TransactionAlreadyExecuted(uint256 txId);
    error TransactionAlreadyQueued(uint256 txId);
    error ExecutionFailed(uint256 txId);
    error InvalidTarget();
    error InvalidETA(uint256 eta, uint256 minimumETA);

    // ─── Constructor ────────────────────────────────────────────────

    /**
     * @notice Deploys the TimeLock contract with an initial minimum delay.
     * @param _minDelay The initial minimum delay in seconds.
     *        Default recommendation: 2 days (172800 seconds).
     *
     * @dev The deployer is granted ADMIN_ROLE and EXECUTOR_ROLE.
     *      The GovernanceDAO address should be granted PROPOSER_ROLE
     *      after deployment via `grantRole(PROPOSER_ROLE, daoAddress)`.
     */
    constructor(uint256 _minDelay) {
        if (_minDelay > MAX_DELAY) revert DelayTooLong(_minDelay, MAX_DELAY);

        minDelay = _minDelay;

        // Grant roles to deployer (will transfer to DAO later)
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
    }

    // ─── Transaction Management ─────────────────────────────────────

    /**
     * @notice Queues a transaction for delayed execution.
     *         Only callable by addresses with PROPOSER_ROLE (GovernanceDAO).
     *
     * @param _target The contract address to call upon execution.
     * @param _value The ETH value (in wei) to send with the call.
     * @param _data The ABI-encoded function call data.
     * @param _eta The earliest timestamp at which this transaction can
     *        be executed. Must be at least `block.timestamp + minDelay`.
     *
     * @return txId The unique ID assigned to this queued transaction.
     *
     * @dev Reverts if:
     *      - Caller does not have PROPOSER_ROLE
     *      - Target is the zero address
     *      - ETA is less than `block.timestamp + minDelay`
     */
    function queueTransaction(
        address _target,
        uint256 _value,
        bytes calldata _data,
        uint256 _eta
    ) external onlyRole(PROPOSER_ROLE) returns (uint256 txId) {
        if (_target == address(0)) revert InvalidTarget();

        uint256 minimumETA = block.timestamp + minDelay;
        if (_eta < minimumETA) revert InvalidETA(_eta, minimumETA);

        txId = transactionCount;
        transactionCount++;

        queuedTransactions[txId] = QueuedTransaction({
            target: _target,
            value: _value,
            data: _data,
            eta: _eta,
            queued: true,
            executed: false
        });

        emit Queued(txId, _target, _value, _data, _eta);
    }

    /**
     * @notice Executes a matured queued transaction.
     *         Only callable by addresses with EXECUTOR_ROLE.
     *
     * @param _txId The ID of the queued transaction to execute.
     *
     * @dev Reverts if:
     *      - Transaction is not in the queue
     *      - Transaction has already been executed
     *      - Current time is before the ETA
     *      - Current time is past the ETA + GRACE_PERIOD (expired)
     *      - The low-level call to the target fails
     *
     * @custom:security Follows checks-effects-interactions pattern.
     *         State is updated before the external call.
     */
    function executeTransaction(uint256 _txId) external onlyRole(EXECUTOR_ROLE) {
        QueuedTransaction storage txn = queuedTransactions[_txId];

        if (!txn.queued) revert TransactionNotQueued(_txId);
        if (txn.executed) revert TransactionAlreadyExecuted(_txId);
        if (block.timestamp < txn.eta) revert ETANotMet(block.timestamp, txn.eta);
        if (block.timestamp > txn.eta + GRACE_PERIOD) {
            revert TransactionExpired(block.timestamp, txn.eta + GRACE_PERIOD);
        }

        // Effects before interaction (CEI pattern)
        txn.executed = true;
        txn.queued = false;

        // Execute the transaction
        (bool success, ) = txn.target.call{value: txn.value}(txn.data);
        if (!success) revert ExecutionFailed(_txId);

        emit Executed(_txId, txn.target, txn.value, txn.data);
    }

    /**
     * @notice Cancels a queued transaction before it is executed.
     *         Only callable by addresses with PROPOSER_ROLE (GovernanceDAO).
     *
     * @param _txId The ID of the queued transaction to cancel.
     *
     * @dev A cancelled transaction cannot be re-queued or executed.
     */
    function cancelTransaction(uint256 _txId) external onlyRole(PROPOSER_ROLE) {
        QueuedTransaction storage txn = queuedTransactions[_txId];

        if (!txn.queued) revert TransactionNotQueued(_txId);
        if (txn.executed) revert TransactionAlreadyExecuted(_txId);

        txn.queued = false;

        emit Cancelled(_txId, msg.sender);
    }

    // ─── Admin Functions ────────────────────────────────────────────

    /**
     * @notice Updates the minimum delay between queueing and execution.
     *         Only callable by addresses with ADMIN_ROLE.
     *
     * @param _newDelay The new minimum delay in seconds.
     *
     * @dev The new delay must not exceed MAX_DELAY (30 days).
     *      In a fully decentralized DAO, ADMIN_ROLE should be held
     *      by the DAO itself (through a governance proposal).
     */
    function setMinDelay(uint256 _newDelay) external onlyRole(ADMIN_ROLE) {
        if (_newDelay > MAX_DELAY) revert DelayTooLong(_newDelay, MAX_DELAY);

        uint256 oldDelay = minDelay;
        minDelay = _newDelay;

        emit MinDelayUpdated(oldDelay, _newDelay);
    }

    // ─── View Functions ─────────────────────────────────────────────

    /**
     * @notice Returns the full details of a queued transaction.
     * @param _txId The transaction ID to query.
     * @return The QueuedTransaction struct.
     */
    function getTransaction(uint256 _txId) external view returns (QueuedTransaction memory) {
        return queuedTransactions[_txId];
    }

    /**
     * @notice Checks if a transaction is ready to be executed.
     * @param _txId The transaction ID to check.
     * @return True if the transaction is queued, not executed,
     *         and the current time is within the execution window.
     */
    function isTransactionReady(uint256 _txId) external view returns (bool) {
        QueuedTransaction storage txn = queuedTransactions[_txId];
        return (
            txn.queued &&
            !txn.executed &&
            block.timestamp >= txn.eta &&
            block.timestamp <= txn.eta + GRACE_PERIOD
        );
    }

    // ─── Receive ────────────────────────────────────────────────────

    /// @notice Allows the TimeLock to receive ETH (needed for ETH-value transactions).
    receive() external payable {}
}
