import { ethers, run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ─── Configuration ──────────────────────────────────────────────────

const CONFIG = {
  INITIAL_TOKEN_SUPPLY: 1_000_000, // 1M DAOV (constructor handles decimals)
  TIMELOCK_MIN_DELAY: 2 * 24 * 60 * 60, // 2 days in seconds
  MIN_TOKENS_TO_PROPOSE: ethers.parseEther("100"), // 100 DAOV
  VERIFY_CONTRACTS: true,
  VERIFY_DELAY_MS: 30_000, // Wait 30s before verifying (block explorer indexing)
};

// ─── Helpers ────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(msg);
}

function separator() {
  console.log("───────────────────────────────────────────────────────");
}

async function waitForBlocks(n: number) {
  log(`   ⏳ Waiting for ${n} block confirmations...`);
  await new Promise((resolve) => setTimeout(resolve, n * 2000));
}

async function verifyContract(address: string, constructorArgs: any[], contractName: string) {
  if (!CONFIG.VERIFY_CONTRACTS) return;
  if (network.name === "hardhat" || network.name === "localhost") return;

  try {
    log(`   🔍 Verifying ${contractName}...`);
    await run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
    });
    log(`   ✅ ${contractName} verified on block explorer`);
  } catch (err: any) {
    if (err.message.includes("Already Verified") || err.message.includes("already verified")) {
      log(`   ✅ ${contractName} already verified`);
    } else {
      log(`   ⚠️  ${contractName} verification failed: ${err.message}`);
      log(`      Run: npx hardhat verify --network ${network.name} ${address} ${constructorArgs.join(" ")}`);
    }
  }
}

function saveDeployment(addresses: Record<string, string>, networkName: string) {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deployment = {
    network: networkName,
    chainId: network.config.chainId,
    timestamp: new Date().toISOString(),
    contracts: addresses,
  };

  const filePath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(deployment, null, 2));
  log(`\n   📄 Addresses saved to: deployments/${networkName}.json`);
}

// ─── Main Deployment ────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const networkName = network.name;

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  🏛️  DAO Governance Platform — Deployment Script");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network:    ${networkName} (Chain ID: ${network.config.chainId})`);
  console.log(`  Deployer:   ${deployer.address}`);
  console.log(`  Balance:    ${ethers.formatEther(balance)} ETH`);
  separator();

  if (balance === 0n) {
    throw new Error("Deployer has 0 ETH. Fund the wallet before deploying.");
  }

  const addresses: Record<string, string> = {};

  // ─── Step 1: Deploy GovernanceToken ───────────────────────────
  log("\n📦 [1/6] Deploying GovernanceToken (DAOV)...");
  log(`   Initial supply: ${CONFIG.INITIAL_TOKEN_SUPPLY.toLocaleString()} DAOV`);

  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const token = await GovernanceToken.deploy(CONFIG.INITIAL_TOKEN_SUPPLY);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  addresses.GovernanceToken = tokenAddress;

  log(`   ✅ GovernanceToken deployed at: ${tokenAddress}`);
  log(`   ✅ ${CONFIG.INITIAL_TOKEN_SUPPLY.toLocaleString()} DAOV minted to deployer`);

  // ─── Step 2: Deploy TimeLock ──────────────────────────────────
  log("\n📦 [2/6] Deploying TimeLock...");
  log(`   Min delay: ${CONFIG.TIMELOCK_MIN_DELAY / 86400} days (${CONFIG.TIMELOCK_MIN_DELAY}s)`);

  const TimeLock = await ethers.getContractFactory("TimeLock");
  const timeLock = await TimeLock.deploy(CONFIG.TIMELOCK_MIN_DELAY);
  await timeLock.waitForDeployment();
  const timeLockAddress = await timeLock.getAddress();
  addresses.TimeLock = timeLockAddress;

  log(`   ✅ TimeLock deployed at: ${timeLockAddress}`);

  // ─── Step 3: Deploy Treasury ──────────────────────────────────
  log("\n📦 [3/6] Deploying Treasury...");
  log(`   Owner (TimeLock): ${timeLockAddress}`);

  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(timeLockAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  addresses.Treasury = treasuryAddress;

  log(`   ✅ Treasury deployed at: ${treasuryAddress}`);

  // ─── Step 4: Deploy GovernanceDAO ─────────────────────────────
  log("\n📦 [4/6] Deploying GovernanceDAO...");
  log(`   Token:     ${tokenAddress}`);
  log(`   TimeLock:  ${timeLockAddress}`);
  log(`   Min tokens to propose: ${ethers.formatEther(CONFIG.MIN_TOKENS_TO_PROPOSE)} DAOV`);

  const GovernanceDAO = await ethers.getContractFactory("GovernanceDAO");
  const dao = await GovernanceDAO.deploy(
    tokenAddress,
    timeLockAddress,
    CONFIG.MIN_TOKENS_TO_PROPOSE,
  );
  await dao.waitForDeployment();
  const daoAddress = await dao.getAddress();
  addresses.GovernanceDAO = daoAddress;

  log(`   ✅ GovernanceDAO deployed at: ${daoAddress}`);

  // ─── Step 5: Configure Roles ──────────────────────────────────
  log("\n🔧 [5/6] Configuring TimeLock roles...");

  const PROPOSER_ROLE = await timeLock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timeLock.EXECUTOR_ROLE();
  const ADMIN_ROLE = await timeLock.ADMIN_ROLE();
  const DEFAULT_ADMIN_ROLE = await timeLock.DEFAULT_ADMIN_ROLE();

  // Grant PROPOSER_ROLE to GovernanceDAO
  const tx1 = await timeLock.grantRole(PROPOSER_ROLE, daoAddress);
  await tx1.wait();
  log("   ✅ PROPOSER_ROLE → GovernanceDAO");

  // Grant EXECUTOR_ROLE to deployer (for initial setup; can be expanded)
  // Deployer already has it from TimeLock constructor, but let's be explicit
  log("   ✅ EXECUTOR_ROLE → Deployer (from constructor)");

  // Grant ADMIN_ROLE to GovernanceDAO (so DAO can change delay via proposals)
  const tx2 = await timeLock.grantRole(ADMIN_ROLE, daoAddress);
  await tx2.wait();
  log("   ✅ ADMIN_ROLE → GovernanceDAO");

  // NOTE: In production, you'd also:
  // - timeLock.revokeRole(ADMIN_ROLE, deployer.address)
  // - timeLock.revokeRole(DEFAULT_ADMIN_ROLE, deployer.address)
  // We keep deployer as admin during testnet for flexibility.
  log("   ⚠️  Deployer retains ADMIN for testnet flexibility");
  log("      (Revoke in production for full decentralization)");

  // ─── Step 6: Verify Token Balance ─────────────────────────────
  log("\n📊 [6/6] Verifying deployment state...");

  const deployerBalance = await token.balanceOf(deployer.address);
  log(`   Token balance: ${ethers.formatEther(deployerBalance)} DAOV`);

  const treasuryBal = await ethers.provider.getBalance(treasuryAddress);
  log(`   Treasury ETH:  ${ethers.formatEther(treasuryBal)} ETH`);

  const hasProposer = await timeLock.hasRole(PROPOSER_ROLE, daoAddress);
  log(`   DAO has PROPOSER_ROLE: ${hasProposer}`);

  // ─── Save Deployment ──────────────────────────────────────────
  saveDeployment(addresses, networkName);

  // ─── Contract Verification ────────────────────────────────────
  if (CONFIG.VERIFY_CONTRACTS && networkName !== "hardhat" && networkName !== "localhost") {
    log("\n🔍 Starting contract verification...");
    log(`   Waiting ${CONFIG.VERIFY_DELAY_MS / 1000}s for block explorer indexing...`);
    await new Promise((r) => setTimeout(r, CONFIG.VERIFY_DELAY_MS));

    await verifyContract(tokenAddress, [CONFIG.INITIAL_TOKEN_SUPPLY], "GovernanceToken");
    await verifyContract(timeLockAddress, [CONFIG.TIMELOCK_MIN_DELAY], "TimeLock");
    await verifyContract(treasuryAddress, [timeLockAddress], "Treasury");
    await verifyContract(daoAddress, [
      tokenAddress,
      timeLockAddress,
      CONFIG.MIN_TOKENS_TO_PROPOSE.toString(),
    ], "GovernanceDAO");
  }

  // ─── Summary ──────────────────────────────────────────────────
  const finalBalance = await ethers.provider.getBalance(deployer.address);
  const gasUsed = balance - finalBalance;

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  🎉 Deployment Complete!");
  console.log("═══════════════════════════════════════════════════════");
  console.log("");
  console.log("  ┌──────────────────┬──────────────────────────────────────────────┐");
  console.log("  │ Contract         │ Address                                      │");
  console.log("  ├──────────────────┼──────────────────────────────────────────────┤");
  console.log(`  │ GovernanceToken  │ ${tokenAddress} │`);
  console.log(`  │ TimeLock         │ ${timeLockAddress} │`);
  console.log(`  │ Treasury         │ ${treasuryAddress} │`);
  console.log(`  │ GovernanceDAO    │ ${daoAddress} │`);
  console.log("  └──────────────────┴──────────────────────────────────────────────┘");
  console.log("");
  console.log(`  Gas used:  ${ethers.formatEther(gasUsed)} ETH`);
  console.log(`  Remaining: ${ethers.formatEther(finalBalance)} ETH`);
  console.log("");
  console.log("  📝 Next steps:");
  console.log("     1. Copy addresses to your frontend .env file");
  console.log("     2. Distribute DAOV tokens to DAO members");
  console.log("     3. Fund the Treasury with ETH");
  console.log("     4. Create your first governance proposal!");
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error("\n❌ Deployment failed:\n", error);
  process.exitCode = 1;
});
