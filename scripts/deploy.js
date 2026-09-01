const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000FD2";
const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts-manual");

function loadArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, `${name}.json`), "utf8"));
}

async function main() {
  const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Hardhat node's well-known default dev keys (test-only, printed by
  // `npx hardhat node` on startup — never use these for anything real).
  const DEV_KEYS = [
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  ];

  const owner = new ethers.Wallet(DEV_KEYS[0], provider);
  const operator = new ethers.Wallet(DEV_KEYS[1], provider);
  const oracle1 = new ethers.Wallet(DEV_KEYS[2], provider);
  const treasury = new ethers.Wallet(DEV_KEYS[3], provider);
  const userA = new ethers.Wallet(DEV_KEYS[4], provider);

  console.log("Deploying with owner:", owner.address);

  let ownerNonceCounter = await provider.getTransactionCount(owner.address, "pending");

  async function deploy(name, signer, ...args) {
    const art = loadArtifact(name);
    const factory = new ethers.ContractFactory(art.abi, art.bytecode, signer);
    const overrides = signer.address === owner.address ? { nonce: ownerNonceCounter++ } : {};
    const contract = await factory.deploy(...args, overrides);
    await contract.waitForDeployment();
    console.log(`${name} -> ${await contract.getAddress()}`);
    return contract;
  }

  const source = await deploy("MockSpacecoinSource", owner);
  const escrow = await deploy("CoverageVault", owner);

  // Place MockBlockProver bytecode at the real precompile address.
  const proverArt = loadArtifact("MockBlockProver");
  const proverFactory = new ethers.ContractFactory(proverArt.abi, proverArt.bytecode, owner);
  const proverDeployment = await proverFactory.deploy({ nonce: ownerNonceCounter++ });
  await proverDeployment.waitForDeployment();
  const runtimeCode = await provider.getCode(await proverDeployment.getAddress());
  await provider.send("hardhat_setCode", [PRECOMPILE_ADDRESS, runtimeCode]);
  console.log("MockBlockProver installed at precompile address", PRECOMPILE_ADDRESS);

  const predictedASCAddress = ethers.getCreateAddress({
    from: owner.address,
    nonce: ownerNonceCounter + 1, // Settlement at +0, ASC at +1
  });

  const settlement = await deploy(
    "SettlementContract",
    owner,
    predictedASCAddress,
    await escrow.getAddress(),
    treasury.address
  );
  const asc = await deploy("SpaceShieldASC", owner, await settlement.getAddress());

  if ((await asc.getAddress()) !== predictedASCAddress) {
    throw new Error(
      `nonce prediction drifted: predicted ${predictedASCAddress}, got ${await asc.getAddress()}`
    );
  }

  await (
    await asc.connect(owner).registerOperator("SAT-014", operator.address, { nonce: ownerNonceCounter++ })
  ).wait();
  console.log("Registered operator", operator.address, "for SAT-014");

  await (
    await asc.connect(owner).registerOracle(oracle1.address, { nonce: ownerNonceCounter++ })
  ).wait();
  console.log("Registered oracle", oracle1.address, "(attestation threshold defaults to 1)");

  // userA locks coverage stake in SpaceShield's own CoverageVault to become
  // a real, on-chain, live-verifiable subscriber of SAT-014 - no snapshot,
  // no publisher, no allowlist. This IS the subscription.
  await (
    await escrow.connect(userA).lockCoverage("SAT-014", operator.address, {
      value: ethers.parseEther("0.1"),
    })
  ).wait();
  console.log("userA locked coverage stake in CoverageVault for SAT-014 (this makes them a real subscriber)");

  await (
    await settlement.connect(operator).lockBond(ethers.parseEther("0.01"), {
      value: ethers.parseEther("1.0"),
    })
  ).wait();
  console.log("Bond locked: 1.0 ETH @ 0.01 ETH/user");

  const deployment = {
    rpcUrl: RPC_URL,
    sourceAddress: await source.getAddress(),
    escrowAddress: await escrow.getAddress(),
    ascAddress: await asc.getAddress(),
    settlementAddress: await settlement.getAddress(),
    treasuryAddress: treasury.address,
    oraclePrivateKey: oracle1.privateKey,
    satelliteId: "SAT-014",
    subscriberAddress: userA.address,
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "deployment.json"),
    JSON.stringify(deployment, null, 2)
  );
  console.log("\nWrote deployment.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
