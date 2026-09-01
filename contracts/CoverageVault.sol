// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CoverageVault
/// @notice SpaceShield's OWN outage-coverage program — not a model of
///         Spacecoin's payment system, and deliberately no longer claiming to
///         be one. Users lock stake here directly with SpaceShield; that
///         lock is the on-chain fact that makes them an eligible
///         subscriber. Correction history below, kept because the mistake
///         is worth not repeating.
///
///         WHAT THIS FILE USED TO CLAIM (and why it was wrong): an earlier
///         version of this contract, then named SpacecoinEscrow, claimed to
///         "model Spacecoin's real, documented payment mechanism" based on a
///         one-line description in docs.spacecoin.org
///         (usdspace-token/token-overview-and-utility) — "users lock $SPACE
///         in a smart contract, operators submit proof of service delivery,
///         the contract releases payment" — plus a confirmed SPACE token
///         address on Creditcoin. From that, it inferred a subscription
///         model: per-satellite coverage locks, an isActiveSubscriberByKey
///         read, a subscriptionStartByKey timestamp for pro-rata payout.
///
///         WHAT THE REAL CONTRACT ACTUALLY DOES: with real network access,
///         the real contract was found — verified source on Creditcoin
///         mainnet's own Blockscout, TokenPaymentEscrow, proxy at
///         0xC130F5D76f0b4Ce8FE2ceA0D2C2b8f53A39a5cd0, implementation at
///         0xDbbdB0E6853fB0092e8da4Ed1C22A109C26612c8. It is a prepaid,
///         usage-metered data-payment escrow, not a subscription contract:
///         clients deposit() SPACE into a balance; "nodes" (bytes32
///         identities, each mapped to a payout wallet via registerNode)
///         claim payment from that balance via claimBatch(receipts,
///         signatures) — EIP-712-signed Receipt{clientAddress, nodeAddress,
///         requestUUID, dataAmount, totalPrice} tuples, i.e. pay-per-byte,
///         not pay-per-month; withdrawals go through a 5-day
///         initiateWithdrawal -> executeWithdrawal timelock. There is no
///         satellite ID, no "coverage" flag, no subscription-start
///         timestamp, anywhere in it. A client can hold a healthy balance
///         while their link has been down for weeks (they just haven't been
///         billed through it), or a near-zero balance despite perfect
///         service (everything claimed promptly). Balance is not an outage
///         eligibility signal.
///
///         THE FIX: rather than force-fit SpaceShield's eligibility logic
///         onto data that doesn't mean what we needed it to mean, this
///         contract is now honestly its own thing — SpaceShield's coverage
///         product, independent of however Spacecoin bills for bandwidth.
///         The mechanics below (lock/withdraw/isActiveSubscriberByKey/
///         subscriptionStartByKey) are unchanged from before, because they
///         were always describing SpaceShield's own logic correctly — only
///         the framing and the contract's name were wrong.
///
///         ALSO REMOVED: submitServiceProof() and its event, which existed
///         only to mirror the (incorrect) documented Spacecoin mechanism
///         and was never called by any other part of this system.
///
///         STILL A REAL OPEN QUESTION: whether SpaceShield's coverage
///         product should independently integrate the real TokenPaymentEscrow
///         (e.g. requiring a minimum recent claimed-data balance as a weak
///         "still an active customer" signal) is a genuine product decision,
///         not an engineering one — see architecture.md §4.
contract CoverageVault {
    struct Lock {
        address user;
        address operator;
        uint256 amount;
        uint256 lockedAt;
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
    event CoverageWithdrawn(bytes32 indexed satelliteKey, address indexed user);

    /// @notice A user locks stake for ongoing coverage from a given
    ///         satellite/operator. This lock is the on-chain fact that
    ///         makes them a "subscriber" — no separate registration step,
    ///         no owner-gated allowlist. The stake itself is not paid out to
    ///         anyone; it is proof of an ongoing relationship, and it stays
    ///         in this vault until the subscriber withdraws it.
    function lockCoverage(string calldata satelliteId, address operator) external payable returns (bytes32 lockId) {
        require(msg.value > 0, "no payment");
        require(operator != address(0), "operator = zero address");
        bytes32 satelliteKey = keccak256(bytes(satelliteId));
        lockId = keccak256(abi.encodePacked(satelliteKey, msg.sender, block.timestamp, block.prevrandao));

        locks[lockId] = Lock({
            user: msg.sender,
            operator: operator,
            amount: msg.value,
            lockedAt: block.timestamp
        });
        if (!_activeSubscriber[satelliteKey][msg.sender]) {
            _subscriptionStart[satelliteKey][msg.sender] = block.timestamp;
        }
        _activeSubscriber[satelliteKey][msg.sender] = true;

        emit CoverageLocked(satelliteKey, msg.sender, operator, msg.value);
    }

    function withdrawCoverage(string calldata satelliteId) external {
        bytes32 satelliteKey = keccak256(bytes(satelliteId));
        require(_activeSubscriber[satelliteKey][msg.sender], "no active coverage");
        _activeSubscriber[satelliteKey][msg.sender] = false;
        emit CoverageWithdrawn(satelliteKey, msg.sender);
    }

    /// @notice The read SpaceShield actually depends on: is this address
    ///         currently an active, staked subscriber of this satellite?
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
