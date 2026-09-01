/**
 * Minimal bond-health monitor (PRD gap: "monitoring/alerting dashboard for
 * operators"). Not a UI - a script an ops process can run on a cron/loop
 * that prints a health line per tracked satellite and exits non-zero if
 * anything looks underfunded, so it's wireable into any alerting system
 * (cron + email, a Slack webhook, a Prometheus textfile exporter, etc.)
 * without this repo needing to pick one for you.
 *
 * SUBSCRIBER COUNTING - why it reads vault events: eligibility itself is
 * checked live and point-wise at claim time (SettlementContract.claim() ->
 * CoverageVault.isActiveSubscriberByKey), and that trust path deliberately
 * has NO enumerable subscriber list - that's the whole point of the vault
 * design (see CoverageVault.sol / architecture.md §4). This ops-side
 * script, though, needs an estimate of total *exposure* (how many
 * subscribers could claim against a given bond), so it reconstructs the
 * current active-subscriber set per satellite from CoverageVault's own
 * CoverageLocked / CoverageWithdrawn event log. That's canonical on-chain
 * data, not an off-chain snapshot, and it is NOT part of the claim trust
 * path - it only feeds this monitoring estimate.
 *
 * Run: node scripts/monitor_bonds.js
 * Requires deployment.json (written by scripts/deploy.js) in the repo root.
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts-manual");
function loadArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, `${name}.json`), "utf8"));
}

// How many outages' worth of compensation a bond should be able to survive
// before we call it healthy. A bond covering less than this many full
// payouts to every current subscriber is flagged.
const HEALTHY_OUTAGE_MULTIPLE = 3;

// Rebuild the current active-subscriber set per satelliteKey by replaying the
// escrow's coverage events in chain order: a lock adds the subscriber, a
// withdraw removes them - mirroring the escrow's own _activeSubscriber flag
// without needing an on-chain enumeration it doesn't expose.
async function activeSubscribersBySatKey(escrow) {
  const locked = await escrow.queryFilter(escrow.filters.CoverageLocked());
  const withdrawn = await escrow.queryFilter(escrow.filters.CoverageWithdrawn());
  const ordered = [
    ...locked.map((e) => ({ e, kind: "lock" })),
    ...withdrawn.map((e) => ({ e, kind: "withdraw" })),
  ].sort((a, b) => a.e.blockNumber - b.e.blockNumber || a.e.index - b.e.index);

  const bySatKey = new Map(); // satelliteKey (hex) => Set(user address)
  for (const { e, kind } of ordered) {
    const satKey = e.args.satelliteKey;
    if (!bySatKey.has(satKey)) bySatKey.set(satKey, new Set());
    const set = bySatKey.get(satKey);
    if (kind === "lock") set.add(e.args.user);
    else set.delete(e.args.user);
  }
  return bySatKey;
}

async function main() {
  const depPath = path.join(__dirname, "..", "deployment.json");
  if (!fs.existsSync(depPath)) {
    console.error("deployment.json not found — run scripts/deploy.js first.");
    process.exit(2);
  }
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));
  const provider = new ethers.JsonRpcProvider(dep.rpcUrl);

  const settlement = new ethers.Contract(dep.settlementAddress, loadArtifact("SettlementContract").abi, provider);
  const escrow = new ethers.Contract(dep.escrowAddress, loadArtifact("CoverageVault").abi, provider);
  const asc = new ethers.Contract(dep.ascAddress, loadArtifact("SpaceShieldASC").abi, provider);

  const activeBySatKey = await activeSubscribersBySatKey(escrow);

  // Discover tracked satellites from OperatorRegistered events rather than
  // requiring a hardcoded list — works for however many satellites have
  // actually been registered on this deployment.
  const registeredEvents = await asc.queryFilter(asc.filters.OperatorRegistered());
  const seen = new Set();
  let unhealthyCount = 0;

  console.log(`SpaceShield bond health — ${new Date().toISOString()}`);
  console.log("=".repeat(70));

  for (const ev of registeredEvents) {
    const satelliteId = ev.args.satelliteId;
    const operator = ev.args.operator;
    if (seen.has(satelliteId)) continue; // re-registration; last one wins in the contract, skip dupes here
    seen.add(satelliteId);

    const satKey = ethers.keccak256(ethers.toUtf8Bytes(satelliteId));
    const subscriberCount = BigInt(activeBySatKey.get(satKey)?.size ?? 0);

    const bond = await settlement.bonds(operator);
    const balance = bond.balance;
    const perUser = bond.perUserCompensation;
    const oneFullPayout = perUser * subscriberCount;
    const survivableOutages = oneFullPayout > 0n ? balance / oneFullPayout : -1n;
    const healthy = oneFullPayout === 0n || survivableOutages >= BigInt(HEALTHY_OUTAGE_MULTIPLE);

    if (!healthy) unhealthyCount++;

    console.log(
      `${healthy ? "OK  " : "WARN"}  ${satelliteId.padEnd(12)} operator=${operator}\n` +
        `        bond=${ethers.formatEther(balance)} ETH  ` +
        `subscribers=${subscriberCount}  ` +
        `per-user=${ethers.formatEther(perUser)} ETH  ` +
        `covers ~${survivableOutages < 0n ? "∞" : survivableOutages.toString()} full outage(s)` +
        (healthy ? "" : `  <- below healthy floor of ${HEALTHY_OUTAGE_MULTIPLE}`)
    );
  }

  console.log("=".repeat(70));
  if (unhealthyCount > 0) {
    console.log(`${unhealthyCount} satellite(s) below the healthy bond floor.`);
    process.exit(1);
  }
  console.log("All tracked satellites adequately bonded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
