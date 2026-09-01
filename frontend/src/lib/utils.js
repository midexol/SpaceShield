export const cardData = [
  {
    id: 1,
    idx: "01",
    location: "Spacecoin L1",
    title: "Source Chain Contract",
    subtitle: "Immutable Telemetry & Satellite Status Layer",
    description:
      "Records satellite uptime, last-contact timestamps, confirmation metrics, and active coverage areas — serving as the single source of telemetry truth that downstream protocol layers monitor.",
    color: "rgba(79, 134, 247, 0.85)",
    glow: "#4f86f7",
    iconName: "Radio",
    code: `event SatelliteStatusChanged(
  string indexed satelliteId,
  bool isOnline,
  uint256 timestamp,
  string location,
  uint256 confirmations
);`,
    badge: "Component 1 of 5",
  },
  {
    id: 2,
    idx: "02",
    location: "Off-Chain Sentinel",
    title: "AI Sentinel Agent",
    subtitle: "Dual-Source Cross-Check & Outage Detection",
    description:
      "Polls Spacecoin RPC and public NORAD CelesTrak tracking data concurrently. Only triggers proof building when both telemetry sources confirm an anomaly and clear the confirmation floor.",
    color: "rgba(226, 114, 74, 0.85)",
    glow: "#e2724a",
    iconName: "ShieldAlert",
    code: `async function checkSatellite(satId) {
  const rpcStatus = await queryRpc(satId);
  const orbitalData = await queryCelesTrak(satId);
  if (!rpcStatus.online && orbitalData.flagged) {
    await triggerOracleWorker(satId);
  }
}`,
    badge: "Component 2 of 5",
  },
  {
    id: 3,
    idx: "03",
    location: "Creditcoin L2",
    title: "Attestcoin Smart Contract (ASC)",
    subtitle: "Native 0x0FD2 Precompile Proof Verification",
    description:
      "Invokes Creditcoin's native Block Prover precompile at address 0x0FD2 to cryptographically verify state and continuity proofs in a single atomic transaction without cross-chain bridges.",
    color: "rgba(240, 171, 61, 0.85)",
    glow: "#f0ab3d",
    iconName: "Cpu",
    code: `function verifyAndRegister(bytes calldata proof) external {
  (bool success, bytes memory res) = BLOCK_PROVER.staticcall(proof);
  require(success, "Invalid Attestcoin proof");
  _registerOutage(satId, timestamp);
}`,
    badge: "Component 3 of 5",
  },
  {
    id: 4,
    idx: "04",
    location: "Creditcoin L2",
    title: "Settlement Contract & Coverage Vault",
    subtitle: "Live Coverage Checks & Pull Compensation",
    description:
      "Holds operator SLA bond deposits and verifies subscriber eligibility directly against CoverageVault at claim time, executing instant pro-rata payout transfers without snapshot trust assumptions.",
    color: "rgba(79, 134, 247, 0.85)",
    glow: "#4f86f7",
    iconName: "Coins",
    code: `function claim(uint256 outageId) external {
  bool active = vault.isActiveSubscriberByKey(satKey, msg.sender);
  uint256 payout = calculateProRata(outageId, active);
  payable(msg.sender).transfer(payout);
}`,
    badge: "Component 4 of 5",
  },
  {
    id: 5,
    idx: "05",
    location: "Off-Chain Worker",
    title: "Oracle Worker Engine",
    subtitle: "Proof Construction & M-of-N Attestation",
    description:
      "Listens for AI Agent signals, fabricates proof payloads via Proof Builder, manages retry queues, and coordinates M-of-N multi-oracle consensus before submitting final attestations.",
    color: "rgba(226, 114, 74, 0.85)",
    glow: "#e2724a",
    iconName: "Workflow",
    code: `worker.on("trigger", async (event) => {
  const proof = await proofBuilder.generate(event);
  await ascContract.submitAttestation(proof, oracleSignature);
});`,
    badge: "Component 5 of 5",
  },
];
