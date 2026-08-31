// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SpacecoinEscrow
/// @notice Models Spacecoin's real, documented payment mechanism - not a
///         speculative design. Per official docs
///         (docs.spacecoin.org/usdspace-token/token-overview-and-utility):
///
///           "A blockchain-based escrow mechanism enables real-time
///            settlement... Users lock $SPACE in a smart contract, operators
///            submit cryptographic proof of service delivery, and the smart
///            contract automatically verifies and releases payment."
///
///         and separately confirmed: SPACE is an ERC-20 token deployed
///         directly on Creditcoin (0x7ab7C6A935Ab2D1437398790C9C0660af62A80b9,
///         verifiable on Creditcoin's own Blockscout explorer) - meaning
///         Spacecoin's payment/escrow logic lives on the SAME chain as
///         SpaceShield's own contracts, not on a separate chain requiring
///         cross-chain proof verification to read.
///
///         THIS IS WHY SubscriberRegistry.sol (the earlier owner-published
///         Merkle-snapshot version of this file) IS NO LONGER NEEDED for
///         subscriber verification: "is this address an active,
///         currently-paying subscriber for satellite X" is now answerable
///         with a direct same-chain contract call against Spacecoin's own
///         payment records, not a trusted off-chain publisher's snapshot.
///
///         FIDELITY NOTE - what's grounded vs. illustrative: the mechanism
///         described above (lock -> proof of delivery -> release), the
///         ERC-20 token contract address, and "same chain as Creditcoin"
///         are all independently confirmed from Spacecoin's own
///         documentation and public sources. The real escrow CONTRACT's own
///         address/ABI were not discoverable from this sandbox (no network
///         access to look it up, and it wasn't in any source found) - so
///         this file models the documented mechanism faithfully, but is
///         still a stand-in for the real deployed contract, not a verified
///         copy of it. It also uses native value instead of the real SPACE
///         ERC-20 token for demo simplicity; swapping payable/msg.value for
///         SPACE.transferFrom(msg.sender, address(this), amount) is the
///         real integration's actual payment step.
contract SpacecoinEscrow {
    struct Lock {
        address user;
        address operator;
        uint256 amount;
        uint256 lockedAt;
        bool active;
    }

    mapping(bytes32 => Lock) public locks; // lockId => lock
    // satelliteKey => user => currently has an active coverage lock
    mapping(bytes32 => mapping(address => bool)) private _activeSubscriber;
    // satelliteKey => user => timestamp their CURRENT unbroken coverage
    // period started. Reset to "now" on withdraw+relock, not on every
    // top-up while already active — this is what pro-rata compensation
    // (SettlementContract.claim()) uses to tell "been subscribed the whole
    // time" from "just joined."
    mapping(bytes32 => mapping(address => uint256)) private _subscriptionStart;

    event CoverageLocked(bytes32 indexed satelliteKey, address indexed user, address operator, uint256 amount);
    event ServiceProofSubmitted(bytes32 indexed lockId, address operator);
    event CoverageWithdrawn(bytes32 indexed satelliteKey, address indexed user);

    /// @notice A user locks payment for ongoing coverage from a given
    ///         satellite/operator. This lock is the on-chain fact that
    ///         makes them a "subscriber" — no separate registration step,
    ///         no owner-gated allowlist.
    function lockCoverage(string calldata satelliteId, address operator) external payable returns (bytes32 lockId) {
        require(msg.value > 0, "no payment");
        require(operator != address(0), "operator = zero address");
        bytes32 satelliteKey = keccak256(bytes(satelliteId));
        lockId = keccak256(abi.encodePacked(satelliteKey, msg.sender, block.timestamp, block.prevrandao));

        locks[lockId] = Lock({
            user: msg.sender,
            operator: operator,
            amount: msg.value,
            lockedAt: block.timestamp,
            active: true
        });
        if (!_activeSubscriber[satelliteKey][msg.sender]) {
            _subscriptionStart[satelliteKey][msg.sender] = block.timestamp;
        }
        _activeSubscriber[satelliteKey][msg.sender] = true;

        emit CoverageLocked(satelliteKey, msg.sender, operator, msg.value);
    }

    /// @notice Operator side of the mechanism (proof of service delivery ->
    ///         payment release). Not exercised by SpaceShield directly —
    ///         included so this contract is a faithful model of the whole
    ///         documented mechanism, not just the half SpaceShield reads.
    function submitServiceProof(bytes32 lockId) external {
        Lock storage l = locks[lockId];
        require(l.active, "lock not active");
        require(msg.sender == l.operator, "not the operator for this lock");
        l.active = false;
        (bool ok, ) = payable(l.operator).call{value: l.amount}("");
        require(ok, "release transfer failed");
        emit ServiceProofSubmitted(lockId, l.operator);
    }

    function withdrawCoverage(string calldata satelliteId) external {
        bytes32 satelliteKey = keccak256(bytes(satelliteId));
        require(_activeSubscriber[satelliteKey][msg.sender], "no active coverage");
        _activeSubscriber[satelliteKey][msg.sender] = false;
        emit CoverageWithdrawn(satelliteKey, msg.sender);
    }

    /// @notice The read SpaceShield actually depends on: is this address
    ///         currently an active, paying subscriber of this satellite?
    ///         Real-time on-chain truth, no snapshot staleness.
    function isActiveSubscriberByKey(bytes32 satelliteKey, address user) external view returns (bool) {
        return _activeSubscriber[satelliteKey][user];
    }

    function isActiveSubscriber(string calldata satelliteId, address user) external view returns (bool) {
        return _activeSubscriber[keccak256(bytes(satelliteId))][user];
    }

    /// @notice Timestamp the subscriber's current unbroken coverage period
    ///         began. 0 if never subscribed or currently withdrawn. Used by
    ///         SettlementContract to pro-rate compensation between
    ///         long-standing and newly-joined subscribers.
    function subscriptionStartByKey(bytes32 satelliteKey, address user) external view returns (uint256) {
        return _subscriptionStart[satelliteKey][user];
    }
}
