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
/// @notice Registers a claimable settlement once enough independent oracles
///         agree an outage's Attestcoin proof was verified.
///
///         CORRECTION (tested against real Creditcoin CC3-testnet, not
///         guessed): earlier versions of this contract called the Block
///         Prover precompile (0x0FD2) DIRECTLY from inside verifyOutage() -
///         a contract-to-precompile call nested inside this contract's own
///         execution. That does not work on real Creditcoin. Proven by
///         elimination, not assumption: usc-sdk's own official client,
///         calling the precompile top-level (as the transaction's direct
///         target), reached real verification logic and got a specific,
///         correct rejection of a fake proof ("Merkle proof validation
///         failed"). The identical call nested inside this contract -
///         tried both as `.call` and `.staticcall`, matching the ABI's
///         declared `view` mutability - failed at the call boundary every
///         time, never reaching verification logic at all. The precompile
///         only answers calls where it is the transaction's direct target.
///         A contract cannot call it internally. Full elimination trail:
///         architecture.md §4a; reproduce with `scripts/check-precompile.js`.
///
///         WHAT CHANGED: verification of the Attestcoin proof itself now
///         happens OFF-CHAIN, by each oracle, as its own top-level
///         transaction against the real precompile (usc-sdk's
///         `verifyAndEmit`, which emits `TransactionVerified` on success -
///         see oracle-worker/worker.js). Oracles then report that result
///         here. This contract can no longer re-verify the proof math
///         itself - that's a real, honest reduction in what's checked
///         on-chain, not a cosmetic rename. `precompileTxHash` is recorded
///         per attestation (see OracleAttested) purely as an audit trail:
///         anyone can independently confirm off-chain that the named
///         transaction really did call 0x0FD2 and really did succeed. It
///         is NOT cryptographically checked by this contract - Solidity
///         has no way to inspect an arbitrary prior transaction's receipt.
///
///         Oracle decentralization carries more of the trust load under
///         this model, which is why it already existed rather than being
///         added in response: `attestationThreshold` distinct registered
///         oracle addresses must each independently report the same
///         outageId before settlement registers - no single oracle can
///         finalize alone once the threshold is above 1. A dishonest
///         oracle can now claim a precompile call succeeded without this
///         contract catching the lie directly; independent multi-oracle
///         agreement plus the public audit trail (verify precompileTxHash
///         yourself) is the mitigation, not on-chain re-verification.
///
///         Note on scope: an outage is still a physical/telemetry fact
///         that needs external attestation onto the chain regardless of
///         whether Spacecoin's payment layer is same-chain or cross-chain;
///         that part of the design is unchanged and still an open
///         question - see architecture.md §3.
contract SpaceShieldASC {

    /// @dev Reference only - the real Block Prover precompile address on
    ///      Creditcoin. This contract does NOT call it (see docstring
    ///      above for why that doesn't work); it's kept here as a public,
    ///      on-chain-readable pointer so oracle-worker/worker.js and
    ///      anyone auditing this contract can confirm which address the
    ///      off-chain `precompileTxHash` values are supposed to target,
    ///      without having to trust a hardcoded address in JS alone.
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
    event OracleAttested(
        bytes32 indexed outageId,
        address indexed oracle,
        uint256 attestationCount,
        bytes32 precompileTxHash
    );
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

    /// @notice Called by a registered Oracle Worker AFTER it has already
    ///         independently verified the outage against the real
    ///         Attestcoin precompile itself, off-chain, as its own
    ///         top-level transaction (see the contract-level docstring for
    ///         why that call can't happen from inside this function
    ///         anymore). `precompileTxHash` is that transaction's hash -
    ///         recorded for public auditability, not checked cryptographically
    ///         by this contract.
    ///
    ///         Once `attestationThreshold` distinct oracles have each
    ///         independently reported the same outageId, the settlement is
    ///         registered as claimable exactly once. Returns true iff THIS
    ///         call was the one that crossed the threshold.
    function verifyOutage(
        string calldata satelliteId,
        uint64 blockHeight,
        bytes calldata encodedTx,
        bytes32 precompileTxHash
    ) external returns (bool finalizedNow) {
        require(isOracle[msg.sender], "caller is not a registered oracle");
        require(precompileTxHash != bytes32(0), "no precompile verification tx hash provided");

        bytes32 satKey = keccak256(bytes(satelliteId));
        address operator = satelliteOperator[satKey];
        require(operator != address(0), "satellite not registered");

        bytes32 outageId = keccak256(abi.encodePacked(satKey, blockHeight, encodedTx));
        require(!finalized[outageId], "already settled");

        if (!hasAttested[outageId][msg.sender]) {
            hasAttested[outageId][msg.sender] = true;
            attestationCount[outageId] += 1;
            emit OracleAttested(outageId, msg.sender, attestationCount[outageId], precompileTxHash);
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
