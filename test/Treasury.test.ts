import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Treasury (Unit Tests)", function () {
  async function deployTreasuryFixture() {
    const [owner, timeLockSigner, addr1, addr2] = await ethers.getSigners();

    // Deploy a real GovernanceToken for token tests
    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
    const token = await GovernanceToken.deploy(1_000_000);
    await token.waitForDeployment();

    // Deploy Treasury with timeLockSigner as the authorized TimeLock
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(timeLockSigner.address);
    await treasury.waitForDeployment();

    return { treasury, token, owner, timeLockSigner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should set the correct timeLock address", async function () {
      const { treasury, timeLockSigner } = await loadFixture(deployTreasuryFixture);
      expect(await treasury.timeLock()).to.equal(timeLockSigner.address);
    });

    it("Should start with zero balance", async function () {
      const { treasury } = await loadFixture(deployTreasuryFixture);
      expect(await treasury.getBalance()).to.equal(0);
    });

    it("Should revert if timeLock is zero address", async function () {
      const Treasury = await ethers.getContractFactory("Treasury");
      await expect(Treasury.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        Treasury,
        "ZeroAddress",
      );
    });
  });

  describe("ETH Deposits", function () {
    it("Should accept ETH via receive()", async function () {
      const { treasury, addr1 } = await loadFixture(deployTreasuryFixture);
      const amount = ethers.parseEther("1.0");

      await expect(
        addr1.sendTransaction({ to: await treasury.getAddress(), value: amount }),
      )
        .to.emit(treasury, "ETHDeposited")
        .withArgs(addr1.address, amount);

      expect(await treasury.getBalance()).to.equal(amount);
    });
  });

  describe("ETH Withdrawals", function () {
    it("Should allow timeLock to withdraw ETH", async function () {
      const { treasury, timeLockSigner, addr1 } = await loadFixture(deployTreasuryFixture);
      const depositAmount = ethers.parseEther("5.0");
      const withdrawAmount = ethers.parseEther("2.0");

      // Fund treasury
      await addr1.sendTransaction({ to: await treasury.getAddress(), value: depositAmount });

      const balBefore = await ethers.provider.getBalance(addr1.address);
      await expect(treasury.connect(timeLockSigner).withdrawETH(addr1.address, withdrawAmount))
        .to.emit(treasury, "ETHWithdrawn")
        .withArgs(addr1.address, withdrawAmount);

      expect(await treasury.getBalance()).to.equal(depositAmount - withdrawAmount);
    });

    it("Should reject withdrawal from non-timeLock", async function () {
      const { treasury, addr1 } = await loadFixture(deployTreasuryFixture);
      await addr1.sendTransaction({ to: await treasury.getAddress(), value: ethers.parseEther("1") });

      await expect(
        treasury.connect(addr1).withdrawETH(addr1.address, ethers.parseEther("0.5")),
      ).to.be.revertedWithCustomError(treasury, "OnlyTimeLock");
    });

    it("Should reject withdrawal exceeding balance", async function () {
      const { treasury, timeLockSigner, addr1 } = await loadFixture(deployTreasuryFixture);
      await addr1.sendTransaction({ to: await treasury.getAddress(), value: ethers.parseEther("1") });

      await expect(
        treasury.connect(timeLockSigner).withdrawETH(addr1.address, ethers.parseEther("5")),
      ).to.be.revertedWithCustomError(treasury, "InsufficientETHBalance");
    });
  });

  describe("Token Operations", function () {
    it("Should accept and withdraw ERC-20 tokens", async function () {
      const { treasury, token, timeLockSigner, owner, addr1 } =
        await loadFixture(deployTreasuryFixture);

      const treasuryAddr = await treasury.getAddress();
      const amount = ethers.parseEther("1000");

      // Deposit tokens
      await token.approve(treasuryAddr, amount);
      await expect(treasury.depositToken(await token.getAddress(), amount))
        .to.emit(treasury, "TokenDeposited");

      expect(await treasury.getTokenBalance(await token.getAddress())).to.equal(amount);

      // Withdraw tokens (as timeLock)
      await expect(
        treasury.connect(timeLockSigner).withdrawToken(await token.getAddress(), addr1.address, amount),
      )
        .to.emit(treasury, "TokenWithdrawn")
        .withArgs(await token.getAddress(), addr1.address, amount);

      expect(await token.balanceOf(addr1.address)).to.equal(amount);
    });
  });

  describe("Admin", function () {
    it("Owner can update timeLock address", async function () {
      const { treasury, timeLockSigner, addr1 } = await loadFixture(deployTreasuryFixture);

      await expect(treasury.updateTimeLock(addr1.address))
        .to.emit(treasury, "TimeLockUpdated")
        .withArgs(timeLockSigner.address, addr1.address);

      expect(await treasury.timeLock()).to.equal(addr1.address);
    });

    it("Non-owner cannot update timeLock", async function () {
      const { treasury, addr1 } = await loadFixture(deployTreasuryFixture);
      await expect(
        treasury.connect(addr1).updateTimeLock(addr1.address),
      ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
    });
  });
});
