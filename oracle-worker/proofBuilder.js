const { ethers } = require("ethers");

/**
 * Builds the (encodedTx, merkleProof, continuityProof) triple the ASC's
 * verifyOutage() expects.
 *
 * PRODUCTION: this is where @gluwa/usc-sdk's Proof Builder client goes —
 * you hand it a Spacecoin tx hash + block height, it talks to Creditcoin's
 * hosted Proof Builder service, and hands back a real Merkle inclusion
 * proof plus a chain-continuity proof. That service does the cryptographic
 * work; the Oracle Worker's job is just retries, dedup, and formatting
 * (PRD §4, Component 5).
 *
 * LOCAL / TEST: there is no real Spacecoin testnet or Proof Builder service
 * reachable from this sandbox, so this function fabricates a proof shaped
 * to satisfy MockBlockProver's toy check (merkleProof == keccak256(encodedTx)).
 * Swapping this function's body for a real usc-sdk call is the entire
 * migration path to production — nothing else in the Oracle Worker or ASC
 * needs to change.
 */
function encodeOutageTx({ satelliteId, isOnline, timestamp, location, confirmations }) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(
    ["string", "bool", "uint256", "string", "uint256"],
    [satelliteId, isOnline, timestamp, location, confirmations]
  );
}

function buildMockProof(encodedTx) {
  const merkleProof = ethers.keccak256(encodedTx); // toy "commitment"
  const continuityProof = "0x01"; // non-empty placeholder; real proof is far larger
  return { merkleProof, continuityProof };
}

module.exports = { encodeOutageTx, buildMockProof };
