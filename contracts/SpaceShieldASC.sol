// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISettlementContract {
    function registerSettlement(bytes32 outageId, address operator, bytes32 satelliteKey) external;
}

/// @dev The REAL Block Prover precompile interface - not a guess. Pulled
///      directly from the usc-sdk package's shipped ABI
///      (block-prover/block_prover.json, interface name
///      INativeQueryVerifier), the same package Creditcoin's own Proof
///      Builder tooling uses. An earlier version of this file guessed a
///      flat verify(uint64,uint64,bytes,bytes,bytes) signature with raw
///      bytes standing in for the proofs; the real precompile takes
///      structured MerkleProof/ContinuityProof tuples, not opaque bytes.
///      That guess would have reverted against the real precompile on
///      every call.
interface INativeQueryVerifier {
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
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external view returns (bool);
}

/// @title SpaceShieldASC (Attestcoin Smart Contract)
/// @notice Verifies a Spacecoin outage event's inclusion + continuity proof
///         via the Block Prover precompile, then registers a claimable
///         settlement once enough independent oracles agree.
///
///         Oracle decentralization: earlier versions let any single Oracle
///         Worker key finalize a settlement off one proof submission - one
///         compromised or malicious key could trigger payouts (for a real
///         outage, since the precompile still has to accept the proof, but
///         *when* and repeatedly could still be griefed). This version
///         requires `attestationThreshold` distinct registered oracle
///         addresses to each independently call verifyOutage() with a
///         proof for the same outageId before it's registered for
///         settlement - no single oracle operator can finalize alone once
///         the threshold is above 1.
///
///         Note on scope: this contract still verifies the OUTAGE ITSELF
///         via the Attestcoin precompile - that's a genuinely separate
///         question from subscriber verification, which lives in
///         CoverageVault (see SettlementContract.sol's docstring). An
///         outage is a physical/telemetry fact that still needs some form
///         of external attestation onto the chain regardless of whether
///         Spacecoin's payment layer is same-chain or cross-chain; that
///         part of the design is unchanged and still an open question
///         worth revisiting once Spacecoin's actual outage-reporting
///         mechanism (not just its payment mechanism) is confirmed.
contract SpaceShieldASC {
    /// Native Block Prover precompile address on Creditcoin.
    /// Locally, MockBlockProver is deployed at this exact address via
    /// hardhat_setCode so this address never has to change between test
    /// and production — see test/spaceshield.test.js.
    address public constant BLOCK_PROVER_PRECOMPILE = 0x0000000000000000000000000000000000000FD2;

    ISettlementContract public immutable settlement;
    address public owner;

    // operator authorized to receive verified-outage settlements for a given satellite
    mapping(bytes32 => address) public satelliteOperator; // keccak256(satelliteId) => operator

    mapping(address => bool) public isOracle;
    address[] public oracles;
    uint256 public attestationThreshold = 1; // default: single-oracle, matches earlier behavior

    mapping(bytes32 => mapping(address => bool)) public hasAttested; // outageId => oracle => attested
    mapping(bytes32 => uint256) public attestationCount;             // outageId => distinct attesting oracles
    mapping(bytes32 => bool) public finalized;                       // outageId => settlement registered

    event OutageVerified(bytes32 indexed outageId, string satelliteId, uint64 blockHeight);
    event OperatorRegistered(string satelliteId, address operator);
    event OracleAttested(bytes32 indexed outageId, address indexed oracle, uint256 attestationCount);
    event OracleRegistered(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event AttestationThresholdChanged(uint256 previous, uint256 current);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address settlementContract) {
        require(settlementContract != address(0), "settlement = zero address");
        settlement = ISettlementContract(settlementContract);
        owner = msg.sender;
    }

    function registerOperator(string calldata satelliteId, address operator) external onlyOwner {
        satelliteOperator[keccak256(bytes(satelliteId))] = operator;
        emit OperatorRegistered(satelliteId, operator);
    }

    function registerOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "oracle = zero address");
        require(!isOracle[oracle], "already registered");
        isOracle[oracle] = true;
        oracles.push(oracle);
        emit OracleRegistered(oracle);
    }

    function removeOracle(address oracle) external onlyOwner {
        require(isOracle[oracle], "not an oracle");
        isOracle[oracle] = false;
        for (uint256 i = 0; i < oracles.length; i++) {
            if (oracles[i] == oracle) {
                oracles[i] = oracles[oracles.length - 1];
                oracles.pop();
                break;
            }
        }
        emit OracleRemoved(oracle);
    }

    function setAttestationThreshold(uint256 threshold) external onlyOwner {
        require(threshold >= 1, "threshold must be >= 1");
        emit AttestationThresholdChanged(attestationThreshold, threshold);
        attestationThreshold = threshold;
    }

    function oracleCount() external view returns (uint256) {
        return oracles.length;
    }

    /// @notice Called by a registered Oracle Worker once it has a proof in
    ///         hand. chainKey/blockHeight/encodedTx/merkleProof/
    ///         continuityProof match INativeQueryVerifier.verify's real,
    ///         confirmed signature (see the interface docstring above).
    ///
    ///         Each call is independently proof-checked against the
    ///         precompile (cheap: it's a native call, not re-verification
    ///         of prior submissions). Once `attestationThreshold` distinct
    ///         oracles have each successfully verified the same outage, the
    ///         settlement is registered as claimable exactly once.
    ///
    ///         Returns true iff THIS call was the one that crossed the
    ///         threshold and finalized the settlement.
    function verifyOutage(
        string calldata satelliteId,
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTx,
        INativeQueryVerifier.MerkleProof calldata merkleProof,
        INativeQueryVerifier.ContinuityProof calldata continuityProof
    ) external returns (bool finalizedNow) {
        require(isOracle[msg.sender], "caller is not a registered oracle");

        bytes32 satKey = keccak256(bytes(satelliteId));
        address operator = satelliteOperator[satKey];
        require(operator != address(0), "satellite not registered");

        bytes32 outageId = keccak256(abi.encodePacked(satKey, blockHeight, encodedTx));
        require(!finalized[outageId], "already settled");

        // The precompile call. This is the trust-minimized step in the
        // flow — it verifies the outage transaction was really included in
        // a Spacecoin block, and that the block itself is part of a
        // continuous, unforked chain, without SpaceShield's own contracts
        // ever reading Spacecoin state directly. Each attesting oracle
        // performs this check independently. abi.encodeCall (not a manual
        // signature string) so the compiler checks the argument types
        // against INativeQueryVerifier.verify's real signature for us.
        (bool ok, bytes memory result) = BLOCK_PROVER_PRECOMPILE.call(
            abi.encodeCall(
                INativeQueryVerifier.verify,
                (chainKey, blockHeight, encodedTx, merkleProof, continuityProof)
            )
        );
        require(ok, "precompile call failed");
        require(abi.decode(result, (bool)), "proof rejected");

        if (!hasAttested[outageId][msg.sender]) {
            hasAttested[outageId][msg.sender] = true;
            attestationCount[outageId] += 1;
            emit OracleAttested(outageId, msg.sender, attestationCount[outageId]);
        }

        if (attestationCount[outageId] < attestationThreshold) {
            return false;
        }

        finalized[outageId] = true;
        emit OutageVerified(outageId, satelliteId, blockHeight);

        settlement.registerSettlement(outageId, operator, satKey);
        return true;
    }
}
