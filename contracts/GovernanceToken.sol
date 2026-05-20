// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GovernanceToken
 * @author DAO Platform
 * @notice ERC-20 governance token that determines voting power in the DAO.
 *         Each token held equals one unit of voting weight. Token holders
 *         use their balance at the time of voting to cast weighted votes
 *         on governance proposals.
 *
 * @dev Built on OpenZeppelin v5 contracts:
 *      - ERC20 for standard fungible token functionality
 *      - ERC20Permit for gasless approvals (EIP-2612)
 *      - Ownable for access-controlled minting
 *
 *      The `_update` hook is overridden as an extension point for future
 *      snapshot or checkpoint logic without requiring redeployment.
 */
contract GovernanceToken is ERC20, ERC20Permit, Ownable {
    // ─── Constants ──────────────────────────────────────────────────

    /// @notice Maximum supply cap: 10 million DAOV tokens.
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10 ** 18;

    // ─── Events ─────────────────────────────────────────────────────

    /// @notice Emitted when new tokens are minted by the owner.
    /// @param to The recipient address.
    /// @param amount The number of tokens minted (in wei).
    event TokensMinted(address indexed to, uint256 amount);

    // ─── Errors ─────────────────────────────────────────────────────

    /// @notice Thrown when minting would exceed MAX_SUPPLY.
    error ExceedsMaxSupply(uint256 requested, uint256 available);

    /// @notice Thrown when minting zero tokens.
    error ZeroMintAmount();

    /// @notice Thrown when minting to the zero address.
    error MintToZeroAddress();

    // ─── Constructor ────────────────────────────────────────────────

    /**
     * @notice Deploys the GovernanceToken and mints the initial supply
     *         to the deployer address.
     * @param initialSupply The number of tokens (in whole units, not wei)
     *        to mint to the deployer. Example: pass 1_000_000 to mint
     *        1 million DAOV.
     *
     * @dev The deployer becomes the contract owner and can mint additional
     *      tokens up to MAX_SUPPLY. Ownership should be transferred to the
     *      DAO's TimeLock contract after initial distribution.
     */
    constructor(
        uint256 initialSupply
    ) ERC20("DAOVote", "DAOV") ERC20Permit("DAOVote") Ownable(msg.sender) {
        uint256 mintAmount = initialSupply * 10 ** decimals();
        if (mintAmount > MAX_SUPPLY) {
            revert ExceedsMaxSupply(mintAmount, MAX_SUPPLY);
        }
        _mint(msg.sender, mintAmount);
    }

    // ─── External Functions ─────────────────────────────────────────

    /**
     * @notice Mints new governance tokens to a specified address.
     *         Only callable by the contract owner (initially the deployer,
     *         later the TimeLock).
     *
     * @param to The address to receive the newly minted tokens.
     * @param amount The number of tokens to mint (in wei, i.e., 18 decimals).
     *
     * @dev Reverts if:
     *      - Caller is not the owner
     *      - `to` is the zero address
     *      - `amount` is zero
     *      - Minting would exceed MAX_SUPPLY
     *
     * @custom:security The owner should be the TimeLock contract so that
     *         minting can only occur through a passed governance proposal.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert MintToZeroAddress();
        if (amount == 0) revert ZeroMintAmount();
        if (totalSupply() + amount > MAX_SUPPLY) {
            revert ExceedsMaxSupply(amount, MAX_SUPPLY - totalSupply());
        }

        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Returns the number of tokens still available to be minted
     *         before hitting the MAX_SUPPLY cap.
     * @return The remaining mintable supply in wei.
     */
    function remainingMintableSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    // ─── Internal Overrides ─────────────────────────────────────────

    /**
     * @notice Internal hook called on every token transfer, mint, and burn.
     *
     * @param from The sender address (address(0) for mints).
     * @param to The recipient address (address(0) for burns).
     * @param value The amount of tokens being transferred.
     *
     * @dev This override is an intentional extension point. Future upgrades
     *      can add snapshot/checkpoint logic here (e.g., recording balances
     *      at specific block numbers for vote-weight lookups) without
     *      requiring contract redeployment.
     *
     *      Currently delegates to the parent ERC20._update implementation.
     */
    function _update(address from, address to, uint256 value) internal override(ERC20) {
        super._update(from, to, value);

        // Future: Add snapshot/checkpoint logic here.
        // Example: _writeCheckpoint(from, to, value);
    }
}
