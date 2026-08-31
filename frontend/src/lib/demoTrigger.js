// Trigger Outage — runs the REAL end-to-end pipeline in the browser, but ONLY on
// the local Hardhat chain (31337). It uses deployment.json's throwaway oracle key
// to act as the Oracle Worker: report OFFLINE telemetry until the confirmation
// floor is met, build the exact (encodedTx, merkleProof, continuityProof) triple
// oracle-worker/proofBuilder.js builds, then call verifyOutage() — which runs the
// Block Prover precompile check and, at threshold, registers a claimable
// settlement on Creditcoin. Every stage below is a real transaction/receipt, not
// a timer. On any other chain this module refuses to run.
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  encodeAbiParameters,
  parseAbiParameters,
  encodePacked,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhatLocal } from "../config/wagmi";
import { ABIS } from "./contracts";
import { LOCAL_CHAIN_ID } from "../config/networks";

export const CONFIRMATIONS_TARGET = 6;
const SPACECOIN_CHAIN_KEY = 1n; // ignored by MockBlockProver; a real chain id in prod
const CONTINUITY_PROOF = "0x01";
const OUTAGE_LOCATION = "LEO 540km · plane B";

// The four stages the modal renders (mirrors the landing simulator's shape).
export const TRIGGER_STAGES = [
  { key: "detect", num: "01", title: "AI Detection", sub: "Spacecoin telemetry" },
  { key: "prove", num: "02", title: "Proof Built", sub: "Attestcoin" },
  { key: "verify", num: "03", title: "Block Prover", sub: "Attestcoin precompile" },
  { key: "settle", num: "04", title: "Settlement", sub: "Creditcoin" },
];

export function satelliteKey(satelliteId) {
  return keccak256(toHex(satelliteId));
}

// Byte-for-byte match with oracle-worker/proofBuilder.js's encodeOutageTx.
export function encodeOutageTx({ satelliteId, isOnline, timestamp, location, confirmations }) {
  return encodeAbiParameters(parseAbiParameters("string, bool, uint256, string, uint256"), [
    satelliteId,
    isOnline,
    BigInt(timestamp),
    location,
    BigInt(confirmations),
  ]);
}

export function buildMockProof(encodedTx) {
  return { merkleProof: keccak256(encodedTx), continuityProof: CONTINUITY_PROOF };
}

export function computeOutageId({ satelliteId, blockHeight, encodedTx }) {
  return keccak256(
    encodePacked(
      ["bytes32", "uint64", "bytes"],
      [satelliteKey(satelliteId), BigInt(blockHeight), encodedTx]
    )
  );
}

export function canTrigger(chainId, network) {
  return chainId === LOCAL_CHAIN_ID && Boolean(network?.demoOracleKey);
}

/**
 * Run the pipeline. `onStage(index, patch)` is called repeatedly; patch is merged
 * into that stage's state ({ status: 'active'|'done'|'failed', note, ...detail }).
 * Resolves with a summary object; throws on failure (caller marks the stage failed).
 */
export async function runTriggerOutage({ network, chainId, onStage = () => {} }) {
  if (chainId !== LOCAL_CHAIN_ID) {
    throw new Error("Trigger Outage runs on the local Hardhat chain (31337) only.");
  }
  if (!network?.demoOracleKey) {
    throw new Error("No local demo oracle key found in deployment.json.");
  }

  const satelliteId = network.satelliteId;
  const sourceAddr = network.addresses.source;
  const ascAddr = network.addresses.asc;
  if (!sourceAddr || !ascAddr) {
    throw new Error("Local deployment is missing contract addresses — run scripts/deploy.js.");
  }

  const account = privateKeyToAccount(network.demoOracleKey);
  const transport = http(network.rpcUrl);
  const walletClient = createWalletClient({ account, chain: hardhatLocal, transport });
  const publicClient = createPublicClient({ chain: hardhatLocal, transport });

  const active = (i, patch) => onStage(i, { status: "active", ...patch });
  const done = (i, patch) => onStage(i, { status: "done", ...patch });

  // ── Stage 0 — AI detection: real reportStatus() txs drive confirmations up ──
  active(0, { note: "Reporting OFFLINE telemetry to Spacecoin source…", confirmations: 0 });
  let status;
  let confirmations = 0n;
  for (let i = 0; i < CONFIRMATIONS_TARGET; i++) {
    const hash = await walletClient.writeContract({
      address: sourceAddr,
      abi: ABIS.source,
      functionName: "reportStatus",
      args: [satelliteId, false, OUTAGE_LOCATION],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    status = await publicClient.readContract({
      address: sourceAddr,
      abi: ABIS.source,
      functionName: "getStatus",
      args: [satelliteId],
    });
    confirmations = status[2];
    active(0, {
      note: `Confirmation ${confirmations} / ${CONFIRMATIONS_TARGET}`,
      confirmations: Number(confirmations),
    });
    if (confirmations >= BigInt(CONFIRMATIONS_TARGET)) break;
  }
  const [isOnline, lastContact, confs, location] = status;
  done(0, {
    note: `${confirmations} independent confirmations · status OFFLINE`,
    confirmations: Number(confirmations),
  });

  // ── Stage 1 — Attestcoin proof construction (deterministic, no tx) ──
  active(1, { note: "Encoding outage tx + Merkle commitment…" });
  const encodedTx = encodeOutageTx({
    satelliteId,
    isOnline,
    timestamp: lastContact,
    location,
    confirmations: confs,
  });
  const { merkleProof, continuityProof } = buildMockProof(encodedTx);
  // Unique per run → fresh outageId, so re-runs never hit "already settled".
  const blockHeight = BigInt(Math.floor(Date.now() / 1000));
  const predictedOutageId = computeOutageId({ satelliteId, blockHeight, encodedTx });
  done(1, {
    note: "Merkle inclusion + continuity proof ready",
    merkleProof,
    continuityProof,
    blockHeight: blockHeight.toString(),
    outageId: predictedOutageId,
  });

  // ── Stage 2 — Block Prover verification (real verifyOutage → precompile) ──
  active(2, { note: "Submitting proof to Block Prover precompile 0x…0FD2" });
  const verifyHash = await walletClient.writeContract({
    address: ascAddr,
    abi: ABIS.asc,
    functionName: "verifyOutage",
    args: [satelliteId, SPACECOIN_CHAIN_KEY, blockHeight, encodedTx, merkleProof, continuityProof],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: verifyHash });
  if (receipt.status !== "success") throw new Error("verifyOutage transaction reverted.");
  const verifiedLogs = parseEventLogs({
    abi: ABIS.asc,
    eventName: "OutageVerified",
    logs: receipt.logs,
  });
  const outageId = verifiedLogs[0]?.args?.outageId || predictedOutageId;
  done(2, {
    note: "Proof accepted · outage finalized on-chain",
    txHash: verifyHash,
    outageId,
  });

  // ── Stage 3 — Creditcoin settlement registered (same tx, settlement side) ──
  active(3, { note: "Registering claimable settlement on Creditcoin…" });
  const registeredLogs = parseEventLogs({
    abi: ABIS.settlement,
    eventName: "OutageRegistered",
    logs: receipt.logs,
  });
  const reg = registeredLogs[0]?.args;
  done(3, {
    note: "Settlement registered — subscribers can now claim",
    txHash: verifyHash,
    outageId: reg?.outageId || outageId,
    operator: reg?.operator || null,
    windowStart: reg?.windowStart ? reg.windowStart.toString() : null,
  });

  return {
    outageId: reg?.outageId || outageId,
    blockHeight: blockHeight.toString(),
    txHash: verifyHash,
    operator: reg?.operator || null,
    confirmations: Number(confirmations),
  };
}
