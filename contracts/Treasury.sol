// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Treasury
 * @author DAO Platform
 * @notice Holds ETH and ERC-20 tokens on behalf of the DAO. Funds can
 *         only be withdrawn through governance proposals that pass voting
 *         and survive the TimeLock delay.
 *
 * @dev The TimeLock contract is the only authorized caller for withdrawal
 *      functions. The DAO (owner) can update the TimeLock address if needed.
 *
 *      Fund flow:
 *        Anyone → deposit ETH/tokens → Treasury
 *        Governance proposal → TimeLock delay → Treasury.withdraw*()
 */
contract Treasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State Variables ────────────────────────────────────────────

    /// @notice The TimeLock contract address — the only caller authorized
    ///         to execute withdrawals.
    address public timeLock;

    // ─── Events ─────────────────────────────────────────────────────

    /**
     * @notice Emitted when ETH is deposited into the treasury.
     * @param sender The depositor's address.
     * @param amount The amount of ETH deposited (in wei).
     */
    event ETHDeposited(address indexed sender, uint256 amount);

    /**
     * @notice Emitted when ETH is withdrawn from the treasury.
     * @param to The recipient's address.
     * @param amount The amount of ETH withdrawn (in wei).
     */
    event ETHWithdrawn(address indexed to, uint256 amount);

    /**
     * @notice Emitted when ERC-20 tokens are deposited into the treasury.
     * @param token The token contract address.
     * @param sender The depositor's address.
     * @param amount The amount of tokens deposited.
     */
    event TokenDeposited(address indexed token, address indexed sender, uint256 amount);

    /**
     * @notice Emitted when ERC-20 tokens are withdrawn from the treasury.
     * @param token The token contract address.
     * @param to The recipient's address.
     * @param amount The amount of tokens withdrawn.
     */
    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Emitted when the authorized TimeLock address is updated.
     * @param oldTimeLock The previous TimeLock address.
     * @param newTimeLock The new TimeLock address.
     */
    event TimeLockUpdated(address indexed oldTimeLock, address indexed newTimeLock);

    // ─── Errors ─────────────────────────────────────────────────────

    /// @notice Thrown when a non-TimeLock address calls a restricted function.
    error OnlyTimeLock(address caller, address expected);

    /// @notice Thrown when a zero address is provided.
    error ZeroAddress();

    /// @notice Thrown when a zero amount is provided.
    error ZeroAmount();

    /// @notice Thrown when the treasury has insufficient ETH balance.
    error InsufficientETHBalance(uint256 requested, uint256 available);

    /// @notice Thrown when the ETH transfer fails.
    error ETHTransferFailed();

    // ─── Modifiers ──────────────────────────────────────────────────

    /**
     * @notice Restricts function access to the TimeLock contract only.
     * @dev This ensures withdrawals can only happen through the
     *      governance pipeline (proposal → vote → timelock → execute).
     */
    modifier onlyTimeLock() {
        if (msg.sender != timeLock) {
            revert OnlyTimeLock(msg.sender, timeLock);
        }
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────

    /**
     * @notice Deploys the Treasury contract.
     * @param _timeLock The address of the TimeLock contract that is
     *        authorized to execute withdrawals.
     *
     * @dev The deployer becomes the owner (for updating the TimeLock
     *      address). Ownership should be transferred to the DAO/TimeLock
     *      for full decentralization.
     */
    constructor(address _timeLock) Ownable(msg.sender) {
        if (_timeLock == address(0)) revert ZeroAddress();
        timeLock = _timeLock;
    }

    // ─── Deposit Functions ──────────────────────────────────────────

    /**
     * @notice Accepts ETH deposits sent directly to the contract.
     * @dev Emits {ETHDeposited} for every ETH transfer received.
     */
    receive() external payable {
        emit ETHDeposited(msg.sender, msg.value);
    }

    /**
     * @notice Deposits ERC-20 tokens into the treasury.
     *         The caller must have approved the treasury to spend the tokens.
     *
     * @param _token The ERC-20 token contract address.
     * @param _amount The number of tokens to deposit.
     *
     * @dev Uses SafeERC20.safeTransferFrom for compatibility with
     *      tokens that don't return a bool on transfer.
     */
    function depositToken(address _token, uint256 _amount) external {
        if (_token == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        emit TokenDeposited(_token, msg.sender, _amount);
    }

    // ─── Withdrawal Functions (TimeLock only) ───────────────────────

    /**
     * @notice Withdraws ETH from the treasury to a specified address.
     *         Only callable by the TimeLock contract.
     *
     * @param _to The recipient address.
     * @param _amount The amount of ETH to withdraw (in wei).
     *
     * @dev This function is the target of governance proposals that
     *      request ETH from the treasury. The call chain is:
     *      GovernanceDAO.executeProposal() → TimeLock.executeTransaction()
     *      → Treasury.withdrawETH()
     *
     * @custom:security Uses ReentrancyGuard and checks-effects-interactions.
     */
    function withdrawETH(
        address payable _to,
        uint256 _amount
    ) external onlyTimeLock nonReentrant {
        if (_to == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();
        if (address(this).balance < _amount) {
            revert InsufficientETHBalance(_amount, address(this).balance);
        }

        (bool success, ) = _to.call{value: _amount}("");
        if (!success) revert ETHTransferFailed();

        emit ETHWithdrawn(_to, _amount);
    }

    /**
     * @notice Withdraws ERC-20 tokens from the treasury.
     *         Only callable by the TimeLock contract.
     *
     * @param _token The ERC-20 token contract address.
     * @param _to The recipient address.
     * @param _amount The number of tokens to withdraw.
     *
     * @dev Uses SafeERC20.safeTransfer for safe token transfers.
     */
    function withdrawToken(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyTimeLock nonReentrant {
        if (_token == address(0)) revert ZeroAddress();
        if (_to == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();

        IERC20(_token).safeTransfer(_to, _amount);

        emit TokenWithdrawn(_token, _to, _amount);
    }

    // ─── View Functions ─────────────────────────────────────────────

    /**
     * @notice Returns the ETH balance held by the treasury.
     * @return The ETH balance in wei.
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Returns the balance of a specific ERC-20 token held
     *         by the treasury.
     * @param _token The ERC-20 token contract address.
     * @return The token balance.
     */
    function getTokenBalance(address _token) external view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    // ─── Admin Functions ────────────────────────────────────────────

    /**
     * @notice Updates the authorized TimeLock contract address.
     *         Only callable by the contract owner (DAO).
     *
     * @param _newTimeLock The new TimeLock contract address.
     *
     * @dev In a fully decentralized setup, the owner should be the
     *      TimeLock itself, so even this update requires a governance
     *      proposal to pass.
     */
    function updateTimeLock(address _newTimeLock) external onlyOwner {
        if (_newTimeLock == address(0)) revert ZeroAddress();

        address oldTimeLock = timeLock;
        timeLock = _newTimeLock;

        emit TimeLockUpdated(oldTimeLock, _newTimeLock);
    }
}
