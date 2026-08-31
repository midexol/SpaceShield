// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockBlockProver
/// @notice STAND-IN ONLY. On real Creditcoin, verification is handled by a
///         native precompile at address 0x0FD2 — there is no Solidity source
///         for it, it's part of the node client. Locally there is nothing to
///         call at that address, so this contract is deployed there instead
///         (see test/spaceshield.test.js, which uses hardhat_setCode to place
///         it at the real precompile address) purely so SpaceShieldASC's
///         call site doesn't have to change between test and production.
///
///         DO NOT deploy this to Creditcoin. On Creditcoin, delete this
///         contract entirely and call the native precompile directly — that
///         swap is the only thing that changes between this prototype and
///         the real deployment.
///
///         Verification logic here is intentionally naive: it checks that
///         the proof bytes are non-empty and that the merkle proof "commits"
///         to the encoded transaction via a simple hash check. This is
///         enough to prove the *call shape and control flow* SpaceShield
///         depends on; it is not cryptographically meaningful.
contract MockBlockProver {
    function verify(
        uint64, /* chainKey */
        uint64, /* blockHeight */
        bytes calldata encodedTx,
        bytes calldata merkleProof,
        bytes calldata continuityProof
    ) external pure returns (bool) {
        require(encodedTx.length > 0, "empty tx");
        require(continuityProof.length > 0, "empty continuity proof");

        // Toy "commitment": merkleProof must be keccak256(encodedTx).
        // A real proof builder (Creditcoin's Proof Builder service) produces
        // an actual Merkle path; this just gives the mock something to
        // reject so a malformed submission fails loudly instead of always
        // passing.
        return keccak256(merkleProof) == keccak256(abi.encodePacked(keccak256(encodedTx)));
    }
}
