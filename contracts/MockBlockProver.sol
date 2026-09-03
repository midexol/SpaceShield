// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockBlockProver
/// @notice STAND-IN ONLY. On real Creditcoin, verification is handled by a
///         native precompile at address 0x0FD2 - there is no Solidity source
///         for it, it's part of the node client. Locally there is nothing to
///         call at that address, so this contract is deployed there instead
///         (see test/spaceshield.test.js, which uses hardhat_setCode to place
///         it at the real precompile address).
///
///         CORRECTION: this used to be called from inside SpaceShieldASC's
///         verifyOutage(). Testing against the real precompile on Creditcoin
///         CC3-testnet proved that doesn't work there - it only answers
///         calls where it is the transaction's direct, top-level target,
///         never a call nested inside another contract's execution (see
///         SpaceShieldASC.sol's docstring and architecture.md §4a for the
///         full elimination trail). So this mock is now called top-level
///         too, exactly the way oracle-worker/worker.js calls the real
///         precompile via usc-sdk's PrecompileBlockProver: verify() (a plain
///         eth_call, mirrors verifySingle) to check before committing to
///         gas, then verifyAndEmit() as a real mined transaction (mirrors
///         verifyAndEmitSingle) to get a genuine, independently-checkable
///         tx hash to record on SpaceShieldASC as precompileTxHash.
///
///         Both function signatures below are NOT a guess - they're the
///         real INativeQueryVerifier signatures from the usc-sdk package's
///         shipped ABI (block-prover/block_prover.json), the same one
///         Creditcoin's own Proof Builder tooling uses. Matching them
///         exactly means the calldata this mock accepts is byte-for-byte
///         what the same call would send on real Creditcoin - the only
///         thing that changes going to production is which address it
///         lands on, and who calls it (oracle-worker directly, not this
///         repo's contracts).
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

    event TransactionVerified(uint64 indexed chainKey, uint64 indexed height, uint64 transactionIndex);

    function verify(
        uint64, /* chainKey */
        uint64, /* height */
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external pure returns (bool) {
        return _check(encodedTransaction, merkleProof, continuityProof);
    }

    /// @notice Real precompile behavior per usc-sdk's own docs: submits a
    ///         state-changing transaction, reverts on failed verification,
    ///         emits TransactionVerified on success.
    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external returns (bool) {
        require(_check(encodedTransaction, merkleProof, continuityProof), "proof rejected");
        uint64 txIndex = uint64(merkleProof.siblings.length);
        emit TransactionVerified(chainKey, height, txIndex);
        return true;
    }

    function _check(
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) internal pure returns (bool) {
        require(encodedTransaction.length > 0, "empty tx");
        require(continuityProof.roots.length > 0, "empty continuity proof");

        // Toy "commitment": root must be keccak256(encodedTransaction). A
        // real proof builder produces an actual Merkle path with siblings;
        // this just gives the mock something to reject so a malformed
        // submission fails loudly instead of always passing.
        return merkleProof.root == keccak256(encodedTransaction);
    }
}
