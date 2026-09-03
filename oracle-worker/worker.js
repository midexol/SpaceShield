/**
 * Oracle Worker (PRD §4, Component 5)
 *
 * Listens for a trigger (here: an HTTP POST from the AI Agent — in
 * production this can equally be a direct chain-event listener), then:
 *   1. Reads the current on-chain status from MockSpacecoinSource
 *   2. Builds a proof via the Proof Builder service (mocked locally)
 *   3. Verifies that proof against the Block Prover precompile itself, as
 *      its OWN top-level transaction (see precompileClient.js — this step
 *      can no longer happen inside SpaceShieldASC; proven by testing
 *      against real Creditcoin CC3-testnet, see SpaceShieldASC.sol's
 *      docstring and architecture.md §4a)
 *   4. Only if that succeeds, reports the result to the ASC along with the
 *      precompile transaction's hash as an audit trail, which verifies +
 *      triggers settlement once enough oracles agree
 *   5. Handles retries and de-dup (an outage that's already `settled` on
 *      SpaceShieldASC/SettlementContract simply reverts harmlessly, so a
 *      duplicate trigger costs a failed tx, not a double-payout)
 *
 * Run standalone with: node oracle-worker/worker.js
 * Requires SPACESHIELD_RPC_URL, SOURCE_ADDRESS, ASC_ADDRESS, and
 * ORACLE_PRIVATE_KEY in env (PORT defaults to 4001, CHAIN_KEY to 1).
 */
const express = require("express");
const { ethers } = require("ethers");
const { encodeOutageTx, buildMockProof } = require("./proofBuilder");
const { verifyViaPrecompile } = require("./precompileClient");

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

  const asc = new ethers.Contract(ascAddress, ASC_ABI, signer);
  const tx = await asc.verifyOutage(satelliteId, blockHeight, encodedTx, precompileTxHash);
  const receipt = await tx.wait();
  return receipt;
}

function startServer({ port, provider, signer, sourceAddress, ascAddress, defaultChainKey }) {
  const app = express();
  app.use(express.json());

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

  app.listen(port, () => console.log(`Oracle Worker listening on :${port}`));
  return app;
}

module.exports = { handleOutageTrigger, startServer };

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
