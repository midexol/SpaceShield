const { ethers } = require("ethers");

/**
 * Builds the (encodedTx, merkleProof, continuityProof) triple the ASC's
 * verifyOutage() expects. The shape of merkleProof/continuityProof below —
 * { root, siblings } and { lowerEndpointDigest, roots } — is not arbitrary:
 * it's the real INativeQueryVerifier.MerkleProof / ContinuityProof struct
 * shape from the usc-sdk package's shipped ABI, the same package
 * Creditcoin's own Proof Builder tooling uses. An earlier version of this
 * file returned flat hex strings for both, matching a guessed (and wrong)
 * flat-bytes precompile signature — see SpaceShieldASC.sol's docstring for
 * the correction. Getting the shape right here, even for a fabricated
 * proof, means the Oracle Worker's real integration point stays exactly
 * where the comment below says it is.
 *
 * PRODUCTION: this is where usc-sdk's real Proof Builder client
 * (proofProvider.service.ProofBuilder) goes — you hand it a Spacecoin tx
 * hash, it talks to Creditcoin's hosted Proof Builder service
 * (prover.cc3-testnet.creditcoin.network for testnet), and hands back a
 * real MerkleProof + ContinuityProof already in this exact shape. That
 * service does the cryptographic work; the Oracle Worker's job is just
 * retries, dedup, and formatting.
 *
 * LOCAL / TEST: there is no real Spacecoin transaction to build a proof
 * for yet (satellite telemetry is still mocked — see MockSpacecoinSource.sol),
 * so this function fabricates a proof shaped to satisfy MockBlockProver's
 * toy check (merkleProof.root == keccak256(encodedTx), no real siblings
 * needed since the mock doesn't walk the Merkle path). Swapping this
 * function's body for a real usc-sdk ProofBuilder call — once there's a
 * real Spacecoin tx to point it at — is the entire remaining migration
 * path to production; SpaceShieldASC and MockBlockProver already speak the
 * real wire format.
 */
function encodeOutageTx({ satelliteId, isOnline, timestamp, location, confirmations }) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(
    ["string", "bool", "uint256", "string", "uint256"],
    [satelliteId, isOnline, timestamp, location, confirmations]
  );
}

function buildMockProof(encodedTx) {
  const merkleProof = {
    root: ethers.keccak256(encodedTx), // toy "commitment"; no real path needed for the mock
    siblings: [],
  };
  const continuityProof = {
    lowerEndpointDigest: ethers.ZeroHash,
    roots: [ethers.keccak256(encodedTx)], // non-empty placeholder; real proof is far larger
  };
  return { merkleProof, continuityProof };
}

module.exports = { encodeOutageTx, buildMockProof };
