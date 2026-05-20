import { run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";

/**
 * Re-verify contracts on the block explorer.
 *
 * Usage:
 *   npx hardhat run scripts/verify.ts --network polygonAmoy
 *   npx hardhat run scripts/verify.ts --network sepolia
 *
 * This script reads from deployments/<network>.json which is
 * created by the deploy.ts script.
 */

// ─── Configuration (must match deploy.ts) ───────────────────────────

const CONSTRUCTOR_ARGS = {
  GovernanceToken: [1_000_000],
  TimeLock: [2 * 24 * 60 * 60], // 2 days
  // Treasury and GovernanceDAO args are filled from the deployment file
};

// ─── Helpers ────────────────────────────────────────────────────────

async function verifyContract(
  name: string,
  address: string,
  args: any[],
) {
  console.log(`\n🔍 Verifying ${name} at ${address}...`);
  console.log(`   Args: [${args.map((a) => String(a)).join(", ")}]`);

  try {
    await run("verify:verify", {
      address,
      constructorArguments: args,
    });
    console.log(`   ✅ ${name} verified successfully`);
    return true;
  } catch (err: any) {
    if (
      err.message.includes("Already Verified") ||
      err.message.includes("already verified")
    ) {
      console.log(`   ✅ ${name} is already verified`);
      return true;
    }

    console.error(`   ❌ ${name} verification failed:`);
    console.error(`      ${err.message}`);
    console.log(`\n   Manual command:`);
    console.log(
      `   npx hardhat verify --network ${network.name} ${address} ${args.join(" ")}`,
    );
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const networkName = network.name;

  if (networkName === "hardhat" || networkName === "localhost") {
    console.error("❌ Verification is not available on local networks.");
    console.error("   Use: npx hardhat run scripts/verify.ts --network polygonAmoy");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("  🔍 DAO Governance Platform — Contract Verification");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Network: ${networkName} (Chain ID: ${network.config.chainId})`);

  // Load deployment file
  const deploymentPath = path.join(__dirname, "..", "deployments", `${networkName}.json`);

  if (!fs.existsSync(deploymentPath)) {
    console.error(`\n❌ Deployment file not found: ${deploymentPath}`);
    console.error("   Run the deploy script first:");
    console.error(`   npx hardhat run scripts/deploy.ts --network ${networkName}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const contracts = deployment.contracts;

  console.log(`  Deployed: ${deployment.timestamp}`);
  console.log("");

  // Verify each contract
  const results: Record<string, boolean> = {};

  // 1. GovernanceToken
  if (contracts.GovernanceToken) {
    results.GovernanceToken = await verifyContract(
      "GovernanceToken",
      contracts.GovernanceToken,
      CONSTRUCTOR_ARGS.GovernanceToken,
    );
  }

  // 2. TimeLock
  if (contracts.TimeLock) {
    results.TimeLock = await verifyContract(
      "TimeLock",
      contracts.TimeLock,
      CONSTRUCTOR_ARGS.TimeLock,
    );
  }

  // 3. Treasury (arg = TimeLock address)
  if (contracts.Treasury && contracts.TimeLock) {
    results.Treasury = await verifyContract(
      "Treasury",
      contracts.Treasury,
      [contracts.TimeLock],
    );
  }

  // 4. GovernanceDAO (args = Token, TimeLock, minTokens)
  if (contracts.GovernanceDAO && contracts.GovernanceToken && contracts.TimeLock) {
    const minTokens = ethers.parseEther("100").toString();
    results.GovernanceDAO = await verifyContract(
      "GovernanceDAO",
      contracts.GovernanceDAO,
      [contracts.GovernanceToken, contracts.TimeLock, minTokens],
    );
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Verification Summary");
  console.log("═══════════════════════════════════════════════════════");

  let allPassed = true;
  for (const [name, passed] of Object.entries(results)) {
    const icon = passed ? "✅" : "❌";
    console.log(`  ${icon} ${name}`);
    if (!passed) allPassed = false;
  }

  console.log("");

  if (allPassed) {
    console.log("  🎉 All contracts verified successfully!");
  } else {
    console.log("  ⚠️  Some verifications failed. Check the output above.");
    console.log("     You can re-run this script after waiting a few minutes.");
  }

  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error("\n❌ Verification script failed:\n", error);
  process.exitCode = 1;
});
