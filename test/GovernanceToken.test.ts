import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("GovernanceToken (Unit Tests)", function () {
  async function deployTokenFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
    const token = await GovernanceToken.deploy(1_000_000); // 1M supply
    await token.waitForDeployment();
    return { token, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.name()).to.equal("DAOVote");
      expect(await token.symbol()).to.equal("DAOV");
    });

    it("Should mint initial supply to the deployer", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      expect(await token.balanceOf(owner.address)).to.equal(ethers.parseEther("1000000"));
    });

    it("Should set the correct owner", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should have correct MAX_SUPPLY", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.MAX_SUPPLY()).to.equal(ethers.parseEther("10000000"));
    });

    it("Should revert if initial supply exceeds MAX_SUPPLY", async function () {
      const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
      await expect(GovernanceToken.deploy(20_000_000)).to.be.revertedWithCustomError(
        GovernanceToken,
        "ExceedsMaxSupply",
      );
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("500");
      await expect(token.mint(addr1.address, amount))
        .to.emit(token, "TokensMinted")
        .withArgs(addr1.address, amount);
      expect(await token.balanceOf(addr1.address)).to.equal(amount);
    });

    it("Should reject minting from non-owner", async function () {
      const { token, addr1, addr2 } = await loadFixture(deployTokenFixture);
      await expect(
        token.connect(addr1).mint(addr2.address, ethers.parseEther("500")),
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should reject minting zero amount", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      await expect(token.mint(addr1.address, 0)).to.be.revertedWithCustomError(
        token,
        "ZeroMintAmount",
      );
    });

    it("Should reject minting to zero address", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      await expect(
        token.mint(ethers.ZeroAddress, ethers.parseEther("100")),
      ).to.be.revertedWithCustomError(token, "MintToZeroAddress");
    });

    it("Should reject minting beyond MAX_SUPPLY", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      const remaining = await token.remainingMintableSupply();
      await expect(
        token.mint(addr1.address, remaining + 1n),
      ).to.be.revertedWithCustomError(token, "ExceedsMaxSupply");
    });

    it("Should report correct remainingMintableSupply", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.remainingMintableSupply()).to.equal(ethers.parseEther("9000000"));
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      const amount = ethers.parseEther("1000");
      await token.transfer(addr1.address, amount);
      expect(await token.balanceOf(addr1.address)).to.equal(amount);
    });
  });
});
