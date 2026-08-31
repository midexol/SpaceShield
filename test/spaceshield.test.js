const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { encodeOutageTx, buildMockProof } = require("../oracle-worker/proofBuilder");

const PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000FD2";
const CONFIRMATION_FLOOR = 5;

const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts-manual");
function loadArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, `${name}.json`), "utf8"));
}
async function getFactory(name, signer) {
  const art = loadArtifact(name);
  return new ethers.ContractFactory(art.abi, art.bytecode, signer);
}

function agentShouldTrigger({ isOnline, confirmations }, publicTrackerOnline) {
  if (isOnline) return false;
  if (publicTrackerOnline) return false;
  if (confirmations <= CONFIRMATION_FLOOR) return false;
  return true;
}

async function reportOutage(source, satelliteId) {
  for (let i = 0; i < CONFIRMATION_FLOOR + 1; i++) {
    await source.reportStatus(satelliteId, false, "Cross River, NG");
  }
  return source.getStatus(satelliteId);
}

function buildEncodedTx(status, satelliteId) {
  return encodeOutageTx({
    satelliteId,
    isOnline: status.isOnline,
    timestamp: status.lastContact,
    location: status.location,
    confirmations: status.confirmations,
  });
}

function computeOutageId(satelliteId, blockHeight, encodedTx) {
  const satKey = ethers.keccak256(ethers.toUtf8Bytes(satelliteId));
  return ethers.keccak256(
    ethers.solidityPacked(["bytes32", "uint64", "bytes"], [satKey, blockHeight, encodedTx])
  );
}

describe("SpaceShield — end-to-end settlement pipeline", function () {
  let source, escrow, asc, settlement;
  let owner, operator, oracle1, oracle2, treasury, userA, userB, strangerUser;
  const SATELLITE_ID = "SAT-014";
  const PER_USER_COMPENSATION = ethers.parseEther("0.01");

  beforeEach(async function () {
    [owner, operator, oracle1, oracle2, treasury, userA, userB, strangerUser] = await ethers.getSigners();

    const Source = await getFactory("MockSpacecoinSource", owner);
    source = await Source.deploy();

    const Escrow = await getFactory("SpacecoinEscrow", owner);
    escrow = await Escrow.deploy();

    const Prover = await getFactory("MockBlockProver", owner);
    const proverDeployment = await Prover.deploy();
    await proverDeployment.waitForDeployment();
    const proverRuntimeCode = await ethers.provider.getCode(await proverDeployment.getAddress());
    await network.provider.send("hardhat_setCode", [PRECOMPILE_ADDRESS, proverRuntimeCode]);

    const deployerAddress = await owner.getAddress();
    const currentNonce = await ethers.provider.getTransactionCount(deployerAddress);
    const predictedASCAddress = ethers.getCreateAddress({
      from: deployerAddress,
      nonce: currentNonce + 1, // Settlement, then ASC
    });

    const Settlement = await getFactory("SettlementContract", owner);
    settlement = await Settlement.deploy(
      predictedASCAddress,
      await escrow.getAddress(),
      await treasury.getAddress()
    );
    await settlement.waitForDeployment();

    const ASC = await getFactory("SpaceShieldASC", owner);
    asc = await ASC.deploy(await settlement.getAddress());
    await asc.waitForDeployment();
    expect(await asc.getAddress()).to.equal(predictedASCAddress);

    await asc.connect(owner).registerOperator(SATELLITE_ID, await operator.getAddress());
    await asc.connect(owner).registerOracle(await oracle1.getAddress());

    // userA becomes a real subscriber by paying into escrow - no snapshot,
    // no allowlist, just the same on-chain fact Spacecoin itself records.
    await escrow.connect(userA).lockCoverage(SATELLITE_ID, await operator.getAddress(), {
      value: ethers.parseEther("0.1"),
    });
  });

  it("runs outage -> cross-check -> proof -> verify -> register -> live-checked claim end to end", async function () {
    await settlement.connect(operator).lockBond(PER_USER_COMPENSATION, { value: ethers.parseEther("1.0") });

    const status = await reportOutage(source, SATELLITE_ID);
    expect(status.isOnline).to.equal(false);
    expect(
      agentShouldTrigger({ isOnline: status.isOnline, confirmations: status.confirmations }, false)
    ).to.equal(true);

    const encodedTx = buildEncodedTx(status, SATELLITE_ID);
    const { merkleProof, continuityProof } = buildMockProof(encodedTx);

    const tx = await asc
      .connect(oracle1)
      .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);
    const receipt = await tx.wait();

    await expect(tx).to.emit(asc, "OutageVerified");
    await expect(tx).to.emit(settlement, "OutageRegistered");

    const outageId = computeOutageId(SATELLITE_ID, Number(status.lastContact), encodedTx);

    expect(await escrow.isActiveSubscriber(SATELLITE_ID, await userA.getAddress())).to.equal(true);

    const balBefore = await ethers.provider.getBalance(await userA.getAddress());
    const claimTx = await settlement.connect(userA).claim(outageId);
    const claimReceipt = await claimTx.wait();
    const gasCost = claimReceipt.gasUsed * claimReceipt.gasPrice;
    const balAfter = await ethers.provider.getBalance(await userA.getAddress());

    expect(balAfter - balBefore + gasCost).to.equal(PER_USER_COMPENSATION);
    expect(await settlement.hasClaimed(outageId, await userA.getAddress())).to.equal(true);
    expect(await settlement.bondBalance(await operator.getAddress())).to.equal(
      ethers.parseEther("1.0") - PER_USER_COMPENSATION
    );

    console.log(
      `      settlement registered in block ${receipt.blockNumber}, gas: ${receipt.gasUsed.toString()}; ` +
        `claim gas: ${claimReceipt.gasUsed.toString()} (live escrow read, no proof construction needed)`
    );
  });

  it("someone who never paid into escrow cannot claim, even with a valid outageId", async function () {
    await settlement.connect(operator).lockBond(PER_USER_COMPENSATION, { value: ethers.parseEther("1.0") });
    const status = await reportOutage(source, SATELLITE_ID);
    const encodedTx = buildEncodedTx(status, SATELLITE_ID);
    const { merkleProof, continuityProof } = buildMockProof(encodedTx);

    await asc
      .connect(oracle1)
      .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);
    const outageId = computeOutageId(SATELLITE_ID, Number(status.lastContact), encodedTx);

    expect(await escrow.isActiveSubscriber(SATELLITE_ID, await strangerUser.getAddress())).to.equal(false);
    await expect(settlement.connect(strangerUser).claim(outageId)).to.be.revertedWith(
      "not an active subscriber of this satellite"
    );
  });

  it("a subscriber who withdraws coverage before claiming loses eligibility (live check, not a stale snapshot)", async function () {
    await settlement.connect(operator).lockBond(PER_USER_COMPENSATION, { value: ethers.parseEther("1.0") });
    const status = await reportOutage(source, SATELLITE_ID);
    const encodedTx = buildEncodedTx(status, SATELLITE_ID);
    const { merkleProof, continuityProof } = buildMockProof(encodedTx);
    await asc
      .connect(oracle1)
      .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);
    const outageId = computeOutageId(SATELLITE_ID, Number(status.lastContact), encodedTx);

    await escrow.connect(userA).withdrawCoverage(SATELLITE_ID);

    await expect(settlement.connect(userA).claim(outageId)).to.be.revertedWith(
      "not an active subscriber of this satellite"
    );
  });

  it("a new subscriber who pays into escrow AFTER the outage is registered gets a pro-rated (not full) payout", async function () {
    // This is the resolution to the previously-flagged "post-outage joiner"
    // edge case: instead of paying them the full amount (or nothing), they
    // get compensated proportionally to how much of COMPENSATION_WINDOW
    // they were actually subscribed for. See SettlementContract's
    // docstring for why pro-rata was chosen over the alternatives.
    await settlement.connect(operator).lockBond(PER_USER_COMPENSATION, { value: ethers.parseEther("1.0") });
    const status = await reportOutage(source, SATELLITE_ID);
    const encodedTx = buildEncodedTx(status, SATELLITE_ID);
    const { merkleProof, continuityProof } = buildMockProof(encodedTx);
    const tx = await asc
      .connect(oracle1)
      .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);
    await tx.wait();
    const outageId = computeOutageId(SATELLITE_ID, Number(status.lastContact), encodedTx);

    // Advance time to halfway through the compensation window, then have
    // userB join.
    const ONE_DAY = 24 * 60 * 60;
    await network.provider.send("evm_increaseTime", [ONE_DAY / 2]);
    await network.provider.send("evm_mine");

    await escrow.connect(userB).lockCoverage(SATELLITE_ID, await operator.getAddress(), {
      value: ethers.parseEther("0.1"),
    });

    const balBefore = await ethers.provider.getBalance(await userB.getAddress());
    const claimTx = await settlement.connect(userB).claim(outageId);
    const receipt = await claimTx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const balAfter = await ethers.provider.getBalance(await userB.getAddress());
    const received = balAfter - balBefore + gasCost;

    // Should be roughly half of full compensation (subscribed for ~half
    // the window), strictly less than full and strictly more than zero.
    expect(received).to.be.lessThan(PER_USER_COMPENSATION);
    expect(received).to.be.greaterThan(0n);
    expect(received).to.be.closeTo(PER_USER_COMPENSATION / 2n, PER_USER_COMPENSATION / 20n); // within 5%

    // userA, subscribed since before the outage, still gets FULL compensation.
    const fullClaimTx = await settlement.connect(userA).claim(outageId);
    const fullReceipt = await fullClaimTx.wait();
    // (checked via event rather than balance math for clarity)
    const events = await settlement.queryFilter(settlement.filters.CompensationClaimed(), fullReceipt.blockNumber);
    const userAEvent = events.find((e) => e.args.claimant === userA.address);
    expect(userAEvent.args.amount).to.equal(PER_USER_COMPENSATION);
    expect(userAEvent.args.fullAmount).to.equal(PER_USER_COMPENSATION);
  });

  it("someone who joins after the compensation window has fully elapsed is not eligible at all", async function () {
    await settlement.connect(operator).lockBond(PER_USER_COMPENSATION, { value: ethers.parseEther("1.0") });
    const status = await reportOutage(source, SATELLITE_ID);
    const encodedTx = buildEncodedTx(status, SATELLITE_ID);
    const { merkleProof, continuityProof } = buildMockProof(encodedTx);
    await asc
      .connect(oracle1)
      .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);
    const outageId = computeOutageId(SATELLITE_ID, Number(status.lastContact), encodedTx);

    const TWO_DAYS = 2 * 24 * 60 * 60;
    await network.provider.send("evm_increaseTime", [TWO_DAYS]);
    await network.provider.send("evm_mine");

    await escrow.connect(userB).lockCoverage(SATELLITE_ID, await operator.getAddress(), {
      value: ethers.parseEther("0.1"),
    });

    await expect(settlement.connect(userB).claim(outageId)).to.be.revertedWith(
      "joined after the compensated window closed - not eligible"
    );
  });

  it("the same subscriber cannot claim twice", async function () {
    await settlement.connect(operator).lockBond(PER_USER_COMPENSATION, { value: ethers.parseEther("1.0") });
    const status = await reportOutage(source, SATELLITE_ID);
    const encodedTx = buildEncodedTx(status, SATELLITE_ID);
    const { merkleProof, continuityProof } = buildMockProof(encodedTx);
    await asc
      .connect(oracle1)
      .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);
    const outageId = computeOutageId(SATELLITE_ID, Number(status.lastContact), encodedTx);

    await settlement.connect(userA).claim(outageId);
    await expect(settlement.connect(userA).claim(outageId)).to.be.revertedWith("already claimed");
  });

  it("refuses to re-register the same outage for settlement", async function () {
    const status = await reportOutage(source, SATELLITE_ID);
    const encodedTx = buildEncodedTx(status, SATELLITE_ID);
    const { merkleProof, continuityProof } = buildMockProof(encodedTx);

    await asc
      .connect(oracle1)
      .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);

    await expect(
      asc
        .connect(oracle1)
        .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof)
    ).to.be.revertedWith("already settled");
  });

  it("rejects a malformed proof", async function () {
    const status = await reportOutage(source, SATELLITE_ID);
    const encodedTx = buildEncodedTx(status, SATELLITE_ID);
    const forgedMerkleProof = ethers.keccak256(ethers.toUtf8Bytes("not the real tx"));

    await expect(
      asc
        .connect(oracle1)
        .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, forgedMerkleProof, "0x01")
    ).to.be.revertedWith("proof rejected");
  });

  it("rejects verifyOutage from an unregistered oracle", async function () {
    const status = await reportOutage(source, SATELLITE_ID);
    const encodedTx = buildEncodedTx(status, SATELLITE_ID);
    const { merkleProof, continuityProof } = buildMockProof(encodedTx);

    await expect(
      asc
        .connect(strangerUser)
        .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof)
    ).to.be.revertedWith("caller is not a registered oracle");
  });

  it("agent withholds trigger when public tracker disagrees (false-positive guard)", async function () {
    const status = await reportOutage(source, SATELLITE_ID);
    expect(
      agentShouldTrigger({ isOnline: status.isOnline, confirmations: status.confirmations }, true)
    ).to.equal(false);
  });

  it("agent withholds trigger below the confirmation floor", async function () {
    await source.reportStatus(SATELLITE_ID, false, "Cross River, NG");
    const status = await source.getStatus(SATELLITE_ID);
    expect(
      agentShouldTrigger({ isOnline: status.isOnline, confirmations: status.confirmations }, false)
    ).to.equal(false);
  });

  it("a depleted bond makes claim() revert, and it becomes claimable again after a top-up", async function () {
    await settlement.connect(operator).lockBond(PER_USER_COMPENSATION, { value: PER_USER_COMPENSATION });
    const status = await reportOutage(source, SATELLITE_ID);
    const encodedTx = buildEncodedTx(status, SATELLITE_ID);
    const { merkleProof, continuityProof } = buildMockProof(encodedTx);
    await asc
      .connect(oracle1)
      .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);
    const outageId = computeOutageId(SATELLITE_ID, Number(status.lastContact), encodedTx);

    await escrow.connect(userB).lockCoverage(SATELLITE_ID, await operator.getAddress(), {
      value: ethers.parseEther("0.1"),
    });

    await settlement.connect(userA).claim(outageId); // drains the bond
    await expect(settlement.connect(userB).claim(outageId)).to.be.revertedWith(
      "operator bond depleted, retry after top-up"
    );

    await settlement.connect(operator).topUpBond(await operator.getAddress(), {
      value: PER_USER_COMPENSATION,
    });
    await expect(settlement.connect(userB).claim(outageId)).to.not.be.reverted;
  });

  it("penalize() moves funds to the treasury, not just out of the bond", async function () {
    const Settlement = await getFactory("SettlementContract", owner);
    const directSettlement = await Settlement.deploy(
      await owner.getAddress(), // stand-in ASC so we can call penalize() directly in this unit-level test
      await escrow.getAddress(),
      await treasury.getAddress()
    );
    await directSettlement.waitForDeployment();
    await directSettlement.connect(operator).lockBond(PER_USER_COMPENSATION, { value: ethers.parseEther("0.2") });

    const treasuryBefore = await ethers.provider.getBalance(await treasury.getAddress());
    await directSettlement.connect(owner).penalize(await operator.getAddress(), ethers.parseEther("0.05"));
    const treasuryAfter = await ethers.provider.getBalance(await treasury.getAddress());

    expect(treasuryAfter - treasuryBefore).to.equal(ethers.parseEther("0.05"));
    expect(await directSettlement.bondBalance(await operator.getAddress())).to.equal(ethers.parseEther("0.15"));
  });

  describe("multi-oracle attestation threshold", function () {
    beforeEach(async function () {
      await asc.connect(owner).registerOracle(await oracle2.getAddress());
      await asc.connect(owner).setAttestationThreshold(2);
    });

    it("does not finalize on a single oracle's attestation once threshold is 2", async function () {
      const status = await reportOutage(source, SATELLITE_ID);
      const encodedTx = buildEncodedTx(status, SATELLITE_ID);
      const { merkleProof, continuityProof } = buildMockProof(encodedTx);

      const tx1 = await asc
        .connect(oracle1)
        .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);
      await expect(tx1).to.emit(asc, "OracleAttested");
      await expect(tx1).to.not.emit(asc, "OutageVerified");
      await expect(tx1).to.not.emit(settlement, "OutageRegistered");

      const outageId = computeOutageId(SATELLITE_ID, Number(status.lastContact), encodedTx);
      expect(await asc.attestationCount(outageId)).to.equal(1);
      expect(await asc.finalized(outageId)).to.equal(false);
    });

    it("finalizes once a second, distinct oracle attests", async function () {
      await settlement.connect(operator).lockBond(PER_USER_COMPENSATION, { value: ethers.parseEther("1.0") });
      const status = await reportOutage(source, SATELLITE_ID);
      const encodedTx = buildEncodedTx(status, SATELLITE_ID);
      const { merkleProof, continuityProof } = buildMockProof(encodedTx);

      await asc
        .connect(oracle1)
        .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);
      const tx2 = await asc
        .connect(oracle2)
        .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);

      await expect(tx2).to.emit(asc, "OutageVerified");
      await expect(tx2).to.emit(settlement, "OutageRegistered");

      const outageId = computeOutageId(SATELLITE_ID, Number(status.lastContact), encodedTx);
      expect(await asc.finalized(outageId)).to.equal(true);
      await expect(settlement.connect(userA).claim(outageId)).to.not.be.reverted;
    });

    it("the same oracle attesting twice does not count as two attestations", async function () {
      const status = await reportOutage(source, SATELLITE_ID);
      const encodedTx = buildEncodedTx(status, SATELLITE_ID);
      const { merkleProof, continuityProof } = buildMockProof(encodedTx);
      const outageId = computeOutageId(SATELLITE_ID, Number(status.lastContact), encodedTx);

      await asc
        .connect(oracle1)
        .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);
      await asc
        .connect(oracle1)
        .verifyOutage(SATELLITE_ID, 1, Number(status.lastContact), encodedTx, merkleProof, continuityProof);

      expect(await asc.attestationCount(outageId)).to.equal(1);
      expect(await asc.finalized(outageId)).to.equal(false);
    });
  });
});
