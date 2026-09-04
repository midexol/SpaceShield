/**
 * Oracle Worker (PRD §4, Component 5)
 *
 * Two ways to reach the same end state (SpaceShieldASC.verifyOutage()
 * called with this worker's registered-oracle key):
 *
 *   A) POST /trigger/:satelliteId — the worker does everything itself:
 *      reads status, builds the proof, calls the precompile with its OWN
 *      signer, then attests. Used by the local demo / the AI agent
 *      (agent/monitor.py), where there's no browser wallet in the loop.
 *
 *   B) POST /attest — for the public testnet demo, where a judge's own
 *      connected wallet already did steps 1-3 for real (reportStatus,
 *      building the proof client-side, calling the real precompile's
 *      verifyAndEmit directly) — see frontend/src/lib/demoTrigger.js's
 *      testnet path. This worker is currently the ONLY registered oracle
 *      on the testnet deployment (single-key deploy, see
 *      scripts/deploy-testnet.js), so it does NOT blindly trust a
 *      caller-supplied precompileTxHash — it independently re-fetches that
 *      transaction, confirms it really called the real precompile
 *      (0x0FD2) with matching arguments, and really succeeded, before
 *      attesting to it. That's what makes this an oracle attestation
 *      rather than a rubber stamp.
 *
 * Handles retries and de-dup (an outage that's already `settled` on
 * SpaceShieldASC/SettlementContract simply reverts harmlessly, so a
 * duplicate trigger costs a failed tx, not a double-payout).
 *
 * Run standalone with: node oracle-worker/worker.js
 * Requires SPACESHIELD_RPC_URL, SOURCE_ADDRESS, ASC_ADDRESS, and
 * ORACLE_PRIVATE_KEY in env (PORT defaults to 4001, CHAIN_KEY to 1).
 */
const express = require("express");
const { ethers } = require("ethers");
const { encodeOutageTx, buildMockProof } = require("./proofBuilder");
const { verifyViaPrecompile, PRECOMPILE_ADDRESS, PRECOMPILE_ABI } = require("./precompileClient");

// Real, generated ABIs — not hand-typed fragments. A hand-typed ASC_ABI
// fragment here previously hardcoded `bytes merkleProof, bytes
// continuityProof`, silently drifted from the real struct-shaped signature
// once SpaceShieldASC.sol was corrected, and nothing would have caught it
// until a real transaction reverted. Importing the built artifact directly
// makes that drift impossible.
const SOURCE_ABI = require("../artifacts-manual/MockSpacecoinSource.json").abi;
const ASC_ABI = require("../artifacts-manual/SpaceShieldASC.json").abi;

async function handleOutageTrigger({ satelliteId, chainKey, blockHeight, provider, sourceAddress, ascAddress, signer }) {
  const source = new ethers.Contract(sourceAddress, SOURCE_ABI, provider);
  const status = await source.getStatus(satelliteId);

  if (status.isOnline) {
    throw new Error(`refusing to submit: ${satelliteId} reports online on-chain`);
  }

  const encodedTx = encodeOutageTx({
    satelliteId,
    isOnline: status.isOnline,
    timestamp: status.lastContact,
    location: status.location,
    confirmations: status.confirmations,
  });
  const { merkleProof, continuityProof } = buildMockProof(encodedTx);

  const cooldownKey = `trigger:${satelliteId}`;
  assertCooldownOk(cooldownKey);

  const { verified, precompileTxHash } = await verifyViaPrecompile(signer, {
    chainKey,
    height: blockHeight,
    encodedTransaction: encodedTx,
    merkleProof,
    continuityProof,
  });
  if (!verified) {
    throw new Error("Block Prover precompile rejected the proof — refusing to attest");
  }

  markTriggered(cooldownKey);
  const asc = new ethers.Contract(ascAddress, ASC_ABI, signer);
  const tx = await asc.verifyOutage(satelliteId, blockHeight, encodedTx, precompileTxHash);
  const receipt = await tx.wait();
  return receipt;
}

// Independently confirms a caller-supplied precompileTxHash is real before
// this worker stakes its (currently sole) oracle vote on it: the tx must
// exist, target the real precompile directly (top-level — see the module
// docstring on why that matters), call verifyAndEmit with the exact
// encodedTx being attested to, and have actually succeeded on-chain.
// Throws with a client-safe message on any mismatch.
async function assertRealPrecompileVerification(provider, { precompileTxHash, encodedTx }) {
  const tx = await provider.getTransaction(precompileTxHash);
  if (!tx) throw new Error(`no such transaction: ${precompileTxHash}`);
  if ((tx.to || "").toLowerCase() !== PRECOMPILE_ADDRESS.toLowerCase()) {
    throw new Error("precompileTxHash did not call the Block Prover precompile directly");
  }

  const iface = new ethers.Interface(PRECOMPILE_ABI);
  let decoded;
  try {
    decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
  } catch {
    throw new Error("precompileTxHash's calldata isn't a verifyAndEmit call");
  }
  if (!decoded || decoded.name !== "verifyAndEmit") {
    throw new Error("precompileTxHash did not call verifyAndEmit");
  }
  if (decoded.args.encodedTransaction !== encodedTx) {
    throw new Error("precompileTxHash's encodedTransaction does not match this outage");
  }

  const receipt = await provider.getTransactionReceipt(precompileTxHash);
  if (!receipt || receipt.status !== 1) {
    throw new Error("precompileTxHash's transaction did not succeed");
  }
}

async function handleAttest({ satelliteId, blockHeight, encodedTx, precompileTxHash, provider, ascAddress, signer }) {
  await assertRealPrecompileVerification(provider, { precompileTxHash, encodedTx });

  const cooldownKey = `attest:${satelliteId}`;
  assertCooldownOk(cooldownKey);
  const asc = new ethers.Contract(ascAddress, ASC_ABI, signer);
  const tx = await asc.verifyOutage(satelliteId, blockHeight, encodedTx, precompileTxHash);
  markTriggered(cooldownKey);
  return tx.wait();
}

// Bare-minimum abuse guard for a publicly reachable, unauthenticated,
// key-holding endpoint: one in-flight/just-finished attestation per
// satellite at a time, not a full rate limiter — this is a testnet demo,
// not production, so the goal is "can't be trivially hammered", not
// airtight throttling. Only a request that actually reaches the real
// signer starts the cooldown — a request rejected during validation
// (bad args, a failed assertRealPrecompileVerification check) must not be
// able to burn the window and block a legitimate retry right behind it.
const COOLDOWN_MS = 15_000;
const lastTriggerAt = new Map();
function assertCooldownOk(key) {
  const last = lastTriggerAt.get(key) || 0;
  const remaining = COOLDOWN_MS - (Date.now() - last);
  if (remaining > 0) throw new Error(`cooldown active, retry in ${Math.ceil(remaining / 1000)}s`);
}
function markTriggered(key) {
  lastTriggerAt.set(key, Date.now());
}

function startServer({ port, provider, signer, sourceAddress, ascAddress, defaultChainKey }) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.get("/health", (req, res) => res.json({ ok: true, signer: signer.address }));

  app.post("/trigger/:satelliteId", async (req, res) => {
    try {
      const { satelliteId } = req.params;
      const { blockHeight, chainKey } = req.body || {};
      const receipt = await handleOutageTrigger({
        satelliteId,
        chainKey: chainKey ?? defaultChainKey,
        blockHeight: blockHeight ?? 0,
        provider,
        sourceAddress,
        ascAddress,
        signer,
      });
      res.json({ ok: true, txHash: receipt.hash, blockNumber: receipt.blockNumber });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post("/attest", async (req, res) => {
    try {
      const { satelliteId, blockHeight, encodedTx, precompileTxHash } = req.body || {};
      if (!satelliteId || blockHeight === undefined || !encodedTx || !precompileTxHash) {
        throw new Error("satelliteId, blockHeight, encodedTx, and precompileTxHash are all required");
      }
      const receipt = await handleAttest({
        satelliteId,
        blockHeight,
        encodedTx,
        precompileTxHash,
        provider,
        ascAddress,
        signer,
      });
      res.json({ ok: true, txHash: receipt.hash, blockNumber: receipt.blockNumber });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.listen(port, () => console.log(`Oracle Worker listening on :${port}`));
  return app;
}

module.exports = { handleOutageTrigger, handleAttest, startServer };

if (require.main === module) {
  const provider = new ethers.JsonRpcProvider(process.env.SPACESHIELD_RPC_URL || "http://127.0.0.1:8545");
  const signer = new ethers.Wallet(process.env.ORACLE_PRIVATE_KEY, provider);
  startServer({
    port: process.env.PORT || 4001,
    provider,
    signer,
    sourceAddress: process.env.SOURCE_ADDRESS,
    ascAddress: process.env.ASC_ADDRESS,
    defaultChainKey: Number(process.env.CHAIN_KEY || 1),
  });
}
