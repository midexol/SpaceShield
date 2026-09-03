const { ethers } = require("ethers");

/**
 * Shared client for calling the Attestcoin Block Prover as a TOP-LEVEL
 * transaction — the only way it answers. Proven by elimination against
 * real Creditcoin CC3-testnet: a call nested inside another contract's
 * execution (SpaceShieldASC.verifyOutage() used to do this internally)
 * fails at the call boundary every time, `.call` or `.staticcall`,
 * regardless of ABI correctness; the identical call made top-level, as
 * the transaction's direct target, reaches real verification logic. See
 * SpaceShieldASC.sol's contract docstring and architecture.md §4a for the
 * full trail, and scripts/check-precompile.js to reproduce it.
 *
 * PRODUCTION: swap PRECOMPILE_ABI/PRECOMPILE_ADDRESS usage below for
 * usc-sdk's own `blockProver.PrecompileBlockProver` class
 * (verifySingle/verifyAndEmitSingle) — same address, same wire format,
 * official client instead of this hand-rolled one. This file exists
 * separately (rather than just always using the SDK) so the exact same
 * call pattern can run against MockBlockProver locally, where the SDK's
 * real-network-shaped client isn't the point — the call SHAPE is.
 */
const PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000000FD2";

const PRECOMPILE_ABI = [
  "function verify(uint64 chainKey, uint64 height, bytes encodedTransaction, tuple(bytes32 root, tuple(bytes32 hash, bool isLeft)[] siblings) merkleProof, tuple(bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof) view returns (bool)",
  "function verifyAndEmit(uint64 chainKey, uint64 height, bytes encodedTransaction, tuple(bytes32 root, tuple(bytes32 hash, bool isLeft)[] siblings) merkleProof, tuple(bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof) returns (bool)",
  "event TransactionVerified(uint64 indexed chainKey, uint64 indexed height, uint64 transactionIndex)",
];

/**
 * Verifies a proof against the Block Prover precompile, top-level, in two
 * steps: a free eth_call first (so a bad proof never costs gas), then —
 * only if that succeeds — a real mined transaction so there's a genuine,
 * independently-checkable tx hash to record on SpaceShieldASC as
 * `precompileTxHash`. Returns `{ verified: false }` on rejection (caller
 * should NOT call SpaceShieldASC.verifyOutage in that case — there is
 * nothing valid to attest to); returns `{ verified: true, precompileTxHash }`
 * on success.
 */
async function verifyViaPrecompile(signer, { chainKey, height, encodedTransaction, merkleProof, continuityProof }) {
  const prover = new ethers.Contract(PRECOMPILE_ADDRESS, PRECOMPILE_ABI, signer);

  const ok = await prover.verify(chainKey, height, encodedTransaction, merkleProof, continuityProof);
  if (!ok) {
    return { verified: false, precompileTxHash: null };
  }

  const tx = await prover.verifyAndEmit(chainKey, height, encodedTransaction, merkleProof, continuityProof);
  const receipt = await tx.wait();
  return { verified: true, precompileTxHash: receipt.hash, receipt };
}

module.exports = { verifyViaPrecompile, PRECOMPILE_ADDRESS, PRECOMPILE_ABI };
