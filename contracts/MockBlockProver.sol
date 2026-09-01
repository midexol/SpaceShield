// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockBlockProver
/// @notice STAND-IN ONLY. On real Creditcoin, verification is handled by a
///         native precompile at address 0x0FD2 - there is no Solidity source
///         for it, it's part of the node client. Locally there is nothing to
///         call at that address, so this contract is deployed there instead
///         (see test/spaceshield.test.js, which uses hardhat_setCode to place
///         it at the real precompile address) purely so SpaceShieldASC's
///         call site doesn't have to change between test and production.
///
///         The verify() signature below is NOT a guess - it's the real
///         INativeQueryVerifier.verify signature from the usc-sdk package
///         (published as the "usc-sdk" scoped npm package under the gluwa
///         org), the same one Creditcoin's own Proof Builder tooling uses.
///         Its shipped ABI lives at block-prover/block_prover.json inside
///         that package. Matching it exactly
///         means SpaceShieldASC's calldata is byte-for-byte what it would
///         send on real Creditcoin — the only thing that changes going to
///         production is which address that calldata lands on.
///
///         DO NOT deploy this to Creditcoin. On Creditcoin, delete this
///         contract entirely — 0x0FD2 already has the real precompile.
///
///         Verification logic here is intentionally naive: it checks that
///         the proof's root "commits" to the encoded transaction via a
///         simple hash check, and that a continuity proof was actually
///         supplied. This is enough to prove the *call shape and control
///         flow* SpaceShield depends on; it is not cryptographically
///         meaningful — a real Merkle path is not being walked here.
contract MockBlockProver {
    struct MerkleProofEntry {
        bytes32 hash;
        bool isLeft;
    }
    struct MerkleProof {
        bytes32 root;
        MerkleProofEntry[] siblings;
    }
    struct ContinuityProof {
        bytes32 lowerEndpointDigest;
        bytes32[] roots;
    }

    function verify(
        uint64, /* chainKey */
        uint64, /* height */
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external pure returns (bool) {
        require(encodedTransaction.length > 0, "empty tx");
        require(continuityProof.roots.length > 0, "empty continuity proof");

        // Toy "commitment": root must be keccak256(encodedTransaction). A
        // real proof builder produces an actual Merkle path with siblings;
        // this just gives the mock something to reject so a malformed
        // submission fails loudly instead of always passing.
        return merkleProof.root == keccak256(encodedTransaction);
    }
}
