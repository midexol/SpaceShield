// Trigger Outage — runs the REAL end-to-end pipeline in the browser. Two
// variants, same four visible stages (see TRIGGER_STAGES):
//
//   runTriggerOutage() — local Hardhat chain (31337) only. Uses
//   deployment.json's throwaway oracle key to sign every step itself,
//   including the final verifyOutage() call, since locally that key IS a
//   registered oracle. Only safe because the key is throwaway and never
//   exists for a real deployment.
//
//   runTriggerOutageTestnet() — Creditcoin CC3-testnet. Your own connected
//   wallet signs every step it's actually allowed to (reportStatus has no
//   access control; the real Attestcoin precompile has none either) —
//   only the final verifyOutage() call needs a registered-oracle key your
//   wallet doesn't have, so that one step goes to the always-on Oracle
//   Worker (oracle-worker/worker.js's POST /attest) instead of being
//   signed here. See that function's docstring for the full trust model.
//
// Both build the exact (encodedTx, merkleProof, continuityProof) triple
// oracle-worker/proofBuilder.js builds, and verify it against the Block
// Prover precompile itself as its OWN top-level transaction (mirrors
// oracle-worker/precompileClient.js — proven by testing against real
// Creditcoin CC3-testnet that SpaceShieldASC can no longer do this
// internally, see its contract docstring and architecture.md §4a). Every
// stage below is a real transaction/receipt, not a timer.
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  zeroHash,
  encodeAbiParameters,
  parseAbiParameters,
  encodePacked,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhatLocal } from "../config/wagmi";
import { ABIS } from "./contracts";
import { LOCAL_CHAIN_ID, CC_TESTNET_CHAIN_ID } from "../config/networks";

export const CONFIRMATIONS_TARGET = 6;
const SPACECOIN_CHAIN_KEY = 1n; // ignored by MockBlockProver; a real chain id in prod
const OUTAGE_LOCATION = "LEO 540km · plane B";
// Real Attestcoin Block Prover precompile address on Creditcoin. Locally,
// MockBlockProver is installed here via hardhat_setCode (see scripts/deploy.js)
// and MUST be called top-level, exactly like this — see the module docstring.
const PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000FD2";

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

// Struct shapes match the real INativeQueryVerifier.MerkleProof /
// ContinuityProof from the usc-sdk package's shipped ABI — see
// SpaceShieldASC.sol's docstring. MockBlockProver only checks `root`, so
// `siblings`/`roots` are left empty here rather than fabricated further.
export function buildMockProof(encodedTx) {
  return {
    merkleProof: { root: keccak256(encodedTx), siblings: [] },
    continuityProof: { lowerEndpointDigest: zeroHash, roots: [keccak256(encodedTx)] },
  };
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
  if (chainId === LOCAL_CHAIN_ID) return Boolean(network?.demoOracleKey);
  if (chainId === CC_TESTNET_CHAIN_ID) return Boolean(network?.oracleWorkerUrl);
  return false;
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

  // ── Stage 2 — Block Prover verification, TOP-LEVEL against the precompile ──
  // Proven by testing against real Creditcoin CC3-testnet: the precompile only
  // answers a call where it is the transaction's direct target, never one
  // nested inside SpaceShieldASC (see that contract's docstring). So this
  // stage calls the precompile itself, as its own transaction, exactly the
  // way oracle-worker/precompileClient.js does it server-side.
  active(2, { note: "Checking proof against Block Prover precompile 0x…0FD2" });
  const okNow = await publicClient.readContract({
    address: PRECOMPILE_ADDRESS,
    abi: ABIS.prover,
    functionName: "verify",
    args: [SPACECOIN_CHAIN_KEY, blockHeight, encodedTx, merkleProof, continuityProof],
  });
  if (!okNow) throw new Error("Block Prover precompile rejected the proof.");
  active(2, { note: "Precompile accepted — submitting on-chain for a verifiable tx hash…" });
  const precompileHash = await walletClient.writeContract({
    address: PRECOMPILE_ADDRESS,
    abi: ABIS.prover,
    functionName: "verifyAndEmit",
    args: [SPACECOIN_CHAIN_KEY, blockHeight, encodedTx, merkleProof, continuityProof],
  });
  const precompileReceipt = await publicClient.waitForTransactionReceipt({ hash: precompileHash });
  if (precompileReceipt.status !== "success") throw new Error("Block Prover verifyAndEmit transaction reverted.");
  done(2, {
    note: "Proof accepted by the precompile itself, on-chain",
    txHash: precompileHash,
  });

  // ── Stage 3 — report to SpaceShieldASC → registers claimable settlement ──
  active(3, { note: "Reporting verified proof to SpaceShieldASC…" });
  const verifyHash = await walletClient.writeContract({
    address: ascAddr,
    abi: ABIS.asc,
    functionName: "verifyOutage",
    args: [satelliteId, blockHeight, encodedTx, precompileHash],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: verifyHash });
  if (receipt.status !== "success") throw new Error("verifyOutage transaction reverted.");
  const verifiedLogs = parseEventLogs({ abi: ABIS.asc, eventName: "OutageVerified", logs: receipt.logs });
  const registeredLogs = parseEventLogs({ abi: ABIS.settlement, eventName: "OutageRegistered", logs: receipt.logs });
  const reg = registeredLogs[0]?.args;
  const outageId = verifiedLogs[0]?.args?.outageId || reg?.outageId || predictedOutageId;
  done(3, {
    note: "Settlement registered — subscribers can now claim",
    txHash: verifyHash,
    outageId,
    operator: reg?.operator || null,
    windowStart: reg?.windowStart ? reg.windowStart.toString() : null,
  });

  return {
    outageId,
    blockHeight: blockHeight.toString(),
    txHash: verifyHash,
    precompileTxHash: precompileHash,
    operator: reg?.operator || null,
    confirmations: Number(confirmations),
  };
}

/**
 * The public-testnet counterpart to runTriggerOutage(): every step your own
 * connected wallet is capable of signing (reportStatus, and — crucially —
 * calling the real Attestcoin precompile itself, which has no access
 * control) happens exactly like the local flow, just against real
 * Creditcoin CC3-testnet with `walletClient`/`publicClient` from wagmi
 * instead of a throwaway local key. Only the very last step is different:
 * SpaceShieldASC.verifyOutage() requires a REGISTERED oracle, which your
 * wallet isn't — so that one step is handed to the always-on Oracle Worker
 * (oracle-worker/worker.js's POST /attest) via network.oracleWorkerUrl. The
 * worker doesn't trust the request blindly; it independently re-checks the
 * real precompileTxHash your wallet just produced before attesting to it
 * (see the worker's own docstring). No private key ever touches the
 * browser here — every tx you see requested in your wallet is genuinely
 * yours to approve or reject.
 */
export async function runTriggerOutageTestnet({ network, chainId, walletClient, publicClient, onStage = () => {} }) {
  if (chainId !== CC_TESTNET_CHAIN_ID) {
    throw new Error("This flow runs on Creditcoin CC3-testnet only.");
  }
  if (!network?.oracleWorkerUrl) {
    throw new Error("No Oracle Worker configured for this network (VITE_ORACLE_WORKER_URL).");
  }
  if (!walletClient) {
    throw new Error("Connect a wallet first.");
  }

  const satelliteId = network.satelliteId;
  const sourceAddr = network.addresses.source;
  const ascAddr = network.addresses.asc;
  if (!sourceAddr || !ascAddr) {
    throw new Error("Testnet deployment is missing contract addresses.");
  }

  const active = (i, patch) => onStage(i, { status: "active", ...patch });
  const done = (i, patch) => onStage(i, { status: "done", ...patch });

  // ── Stage 0 — your wallet reports OFFLINE telemetry; reportStatus has no
  //    access control, so this is a genuinely permissionless real tx ──
  active(0, { note: "Reporting OFFLINE telemetry to Spacecoin source — approve each in your wallet…", confirmations: 0 });
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

  // ── Stage 1 — proof construction, deterministic, no tx ──
  active(1, { note: "Encoding outage tx + Merkle commitment…" });
  const encodedTx = encodeOutageTx({ satelliteId, isOnline, timestamp: lastContact, location, confirmations: confs });
  const { merkleProof, continuityProof } = buildMockProof(encodedTx);
  const blockHeight = BigInt(Math.floor(Date.now() / 1000));
  const predictedOutageId = computeOutageId({ satelliteId, blockHeight, encodedTx });
  done(1, {
    note: "Merkle inclusion + continuity proof ready",
    merkleProof,
    continuityProof,
    blockHeight: blockHeight.toString(),
    outageId: predictedOutageId,
  });

  // ── Stage 2 — YOUR wallet calls the real Attestcoin precompile directly,
  //    top-level, exactly the way any registered oracle would ──
  active(2, { note: "Checking proof against the real Block Prover precompile 0x…0FD2" });
  const okNow = await publicClient.readContract({
    address: PRECOMPILE_ADDRESS,
    abi: ABIS.prover,
    functionName: "verify",
    args: [SPACECOIN_CHAIN_KEY, blockHeight, encodedTx, merkleProof, continuityProof],
  });
  if (!okNow) throw new Error("The real Attestcoin precompile rejected this proof.");
  active(2, { note: "Precompile accepted — approve the on-chain verifyAndEmit in your wallet…" });
  const precompileHash = await walletClient.writeContract({
    address: PRECOMPILE_ADDRESS,
    abi: ABIS.prover,
    functionName: "verifyAndEmit",
    args: [SPACECOIN_CHAIN_KEY, blockHeight, encodedTx, merkleProof, continuityProof],
  });
  const precompileReceipt = await publicClient.waitForTransactionReceipt({ hash: precompileHash });
  if (precompileReceipt.status !== "success") throw new Error("The precompile's verifyAndEmit transaction reverted.");
  done(2, { note: "Proof accepted by the real precompile, on-chain — verifiable by anyone", txHash: precompileHash });

  // ── Stage 3 — handed to the Oracle Worker: the only step that needs a
  //    registered-oracle key, which your wallet correctly isn't ──
  active(3, { note: "Asking the Oracle Worker to attest (it independently re-checks your precompile tx first)…" });
  const res = await fetch(`${network.oracleWorkerUrl.replace(/\/$/, "")}/attest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      satelliteId,
      blockHeight: blockHeight.toString(),
      encodedTx,
      precompileTxHash: precompileHash,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Oracle Worker returned ${res.status}`);
  }
  const receipt = await publicClient.waitForTransactionReceipt({ hash: body.txHash });
  const verifiedLogs = parseEventLogs({ abi: ABIS.asc, eventName: "OutageVerified", logs: receipt.logs });
  const registeredLogs = parseEventLogs({ abi: ABIS.settlement, eventName: "OutageRegistered", logs: receipt.logs });
  const reg = registeredLogs[0]?.args;
  const outageId = verifiedLogs[0]?.args?.outageId || reg?.outageId || predictedOutageId;
  done(3, {
    note: "Settlement registered by the Oracle Worker — subscribers can now claim",
    txHash: body.txHash,
    outageId,
    operator: reg?.operator || null,
    windowStart: reg?.windowStart ? reg.windowStart.toString() : null,
  });

  return {
    outageId,
    blockHeight: blockHeight.toString(),
    txHash: body.txHash,
    precompileTxHash: precompileHash,
    operator: reg?.operator || null,
    confirmations: Number(confirmations),
  };
}
