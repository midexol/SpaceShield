/**
 * Real Creditcoin CC3-testnet deployment — genuinely different from
 * scripts/deploy.js, not a copy-paste. Two things that work on a local
 * Hardhat node do NOT work on a real chain:
 *
 * 1. scripts/deploy.js pulls 8 roles (owner/operator/oracle/treasury/userA/
 *    userB/...) from ethers.getSigners(), all pre-funded automatically by
 *    Hardhat. On a real network you have exactly the accounts you've
 *    personally funded with real (or testnet-faucet) tCTC. This script
 *    defaults every role to the SAME deployer key unless you override a
 *    role with its own address via env vars — see the table below.
 *
 * 2. scripts/deploy.js installs MockBlockProver at the precompile address
 *    (0x0...0FD2) via `hardhat_setCode`, a Hardhat-network-only debug RPC
 *    method that does not exist on real nodes. There is nothing to
 *    substitute here — but that's no longer a gap for THIS script the way
 *    it once was. SpaceShieldASC.verifyOutage() does not call the
 *    precompile at all anymore (see that contract's docstring): testing
 *    against real Creditcoin CC3-testnet proved the precompile only
 *    answers a transaction where it's the direct, top-level target, never
 *    a call nested inside another contract's execution — so verification
 *    now happens off-chain, by the Oracle Worker, as its own top-level
 *    transaction (oracle-worker/precompileClient.js), and verifyOutage()
 *    just records that transaction's hash. This script deploys the
 *    contracts; running the real pipeline against them additionally needs
 *    the Oracle Worker pointed at this deployment (see README's "Run it
 *    live" section) or `scripts/check-precompile.js --network
 *    creditcoinTestnet` to exercise the precompile directly.
 *
 * Required env var:
 *   CC3_TESTNET_PRIVATE_KEY   funded deployer key (see README's
 *                             "Real testnet deployment" section for how to
 *                             fund one — that step needs a human, not this
 *                             script)
 *
 * Optional env vars (default to the deployer if unset — fine for a
 * single-key solo trial; set these if you've funded separate role wallets):
 *   CC3_OPERATOR_ADDRESS, CC3_ORACLE_ADDRESS, CC3_TREASURY_ADDRESS,
 *   CC3_SUBSCRIBER_ADDRESS
 *
 * Run: npx hardhat run scripts/deploy-testnet.js --network creditcoinTestnet
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

function loadArtifact(name) {
  const p = path.join(__dirname, "..", "artifacts-manual", `${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function main() {
  if (!process.env.CC3_TESTNET_PRIVATE_KEY) {
    throw new Error(
      "CC3_TESTNET_PRIVATE_KEY is not set. Fund a wallet with testnet tCTC first — see README.md's " +
        "'Real testnet deployment' section. This script cannot do that step for you."
    );
  }

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`Deploying to chain ${network.chainId} as ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} tCTC`);
  if (balance === 0n) {
    throw new Error(
      `${deployer.address} has 0 tCTC. Fund it from a Creditcoin CC3-testnet faucet before deploying.`
    );
  }

  const operatorAddress = process.env.CC3_OPERATOR_ADDRESS || deployer.address;
  const oracleAddress = process.env.CC3_ORACLE_ADDRESS || deployer.address;
  const treasuryAddress = process.env.CC3_TREASURY_ADDRESS || deployer.address;
  const subscriberAddress = process.env.CC3_SUBSCRIBER_ADDRESS || deployer.address;

  async function deploy(name, ...args) {
    const art = loadArtifact(name);
    const factory = new ethers.ContractFactory(art.abi, art.bytecode, deployer);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    console.log(`${name} -> ${await contract.getAddress()}`);
    return contract;
  }

  const source = await deploy("MockSpacecoinSource");
  const escrow = await deploy("CoverageVault");

  const deployerNonce = await ethers.provider.getTransactionCount(deployer.address);
  const predictedASCAddress = ethers.getCreateAddress({
    from: deployer.address,
    nonce: deployerNonce + 1, // Settlement at +0 (this call), ASC at +1
  });

  const settlement = await deploy(
    "SettlementContract",
    predictedASCAddress,
    await escrow.getAddress(),
    treasuryAddress
  );
  const asc = await deploy("SpaceShieldASC", await settlement.getAddress());

  if ((await asc.getAddress()) !== predictedASCAddress) {
    throw new Error(
      `nonce prediction drifted: predicted ${predictedASCAddress}, got ${await asc.getAddress()}. ` +
        "Someone else likely sent a transaction from this account between deploys — rerun."
    );
  }

  await (await asc.registerOperator("SAT-014", operatorAddress)).wait();
  console.log("Registered operator", operatorAddress, "for SAT-014");

  await (await asc.registerOracle(oracleAddress)).wait();
  console.log("Registered oracle", oracleAddress, "(attestation threshold defaults to 1)");

  console.log(
    "\nNOT deploying a mock at 0x0FD2 — verifyOutage() no longer calls that address at all. " +
      "The Oracle Worker verifies against it directly, top-level, as its own transaction " +
      "(see oracle-worker/precompileClient.js). Test the precompile itself with " +
      "`node scripts/check-precompile.js --network creditcoinTestnet` before assuming it works."
  );

  const deployment = {
    network: "creditcoinTestnet",
    chainId: Number(network.chainId),
    rpcUrl: hre.network.config.url,
    sourceAddress: await source.getAddress(),
    escrowAddress: await escrow.getAddress(),
    ascAddress: await asc.getAddress(),
    settlementAddress: await settlement.getAddress(),
    treasuryAddress,
    operatorAddress,
    oracleAddress,
    satelliteId: "SAT-014",
    subscriberAddress,
    deployerAddress: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "..", "deployment.testnet.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(
    "No demo oracle private key is written here (unlike deployment.json) — there is no throwaway " +
      "key on a real network. Whoever holds oracleAddress's key runs the Oracle Worker for real."
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
