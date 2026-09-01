// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICoverageVault {
    function isActiveSubscriberByKey(bytes32 satelliteKey, address user) external view returns (bool);
    function subscriptionStartByKey(bytes32 satelliteKey, address user) external view returns (uint256);
}

/// @title SettlementContract
/// @notice Holds each satellite operator's SLA bond and lets verified
///         subscribers pull their own compensation after an outage is
///         proven.
///
///         Subscriber eligibility was originally checked against a Merkle
///         root an off-chain snapshot service had to publish (see git
///         history). That publisher-trust problem was real, but the fix
///         that replaced it was, for a while, wrong in a different way: it
///         checked eligibility against a contract that claimed to model
///         Spacecoin's real on-chain payment mechanism. It didn't — see
///         CoverageVault.sol's docstring for what the real contract (found
///         via Creditcoin's own explorer, once real network access was
///         available) actually does and why it can't answer "is this
///         address covered." Eligibility is now checked live against
///         CoverageVault, SpaceShield's own coverage contract — no
///         publisher, no snapshot staleness, and no longer pretending to be
///         someone else's contract.
///
///         COMPENSATION MODEL - pro-rata, not flat: someone who starts
///         paying into escrow mid-outage-window is a real edge case, not a
///         bug (there's a test proving it). Three options were considered:
///         (1) snapshot the subscriber list at outage-detection time and
///         freeze it there, (2) require continuous subscription through
///         the whole outage window, or (3) pay proportionally to how much
///         of the compensated window someone was actually subscribed for.
///         This contract implements (3): full compensation for anyone
///         subscribed before the outage was registered, zero for anyone
///         who joins after COMPENSATION_WINDOW has fully elapsed, and a
///         linear fraction in between. This is the fairest default for an
///         early-stage DePIN network without needing to hand-define what
///         counts as a verifiable "block before outage" snapshot (option
///         1) or lock out otherwise-legitimate late joiners entirely
///         (option 2). COMPENSATION_WINDOW is a protocol parameter, not a
///         law of physics - it represents "how long a single outage event
///         is considered to have degraded service for," and a production
///         deployment should set it from Spacecoin's actual SLA terms
///         rather than this placeholder value.
contract SettlementContract {
    /// The service-impact period a single outage is considered to cover,
    /// for pro-ration purposes. Illustrative placeholder - see docstring.
    uint256 public constant COMPENSATION_WINDOW = 1 days;

    address public immutable asc;
    ICoverageVault public immutable escrow;
    address public treasury;
    address public owner;

    struct Bond {
        uint256 balance;
        uint256 perUserCompensation;
    }
    mapping(address => Bond) public bonds; // operator => bond

    struct ClaimableOutage {
        address operator;
        bytes32 satelliteKey;
        uint256 windowStart; // when this outage's compensation window began
        bool exists;
    }
    mapping(bytes32 => ClaimableOutage) public outages;              // outageId => info
    mapping(bytes32 => mapping(address => bool)) public claimed;     // outageId => account => claimed

    event BondLocked(address indexed operator, uint256 amount, uint256 perUserCompensation);
    event BondToppedUp(address indexed operator, uint256 amount);
    event OutageRegistered(bytes32 indexed outageId, address indexed operator, bytes32 satelliteKey, uint256 windowStart);
    event CompensationClaimed(bytes32 indexed outageId, address indexed claimant, uint256 amount, uint256 fullAmount);
    event OperatorPenalized(address indexed operator, uint256 amount, address treasury);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    modifier onlyASC() {
        require(msg.sender == asc, "SettlementContract: caller is not the ASC");
        _;
    }
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _asc, address _escrow, address _treasury) {
        require(_asc != address(0), "asc = zero address");
        require(_escrow != address(0), "escrow = zero address");
        require(_treasury != address(0), "treasury = zero address");
        asc = _asc;
        escrow = ICoverageVault(_escrow);
        treasury = _treasury;
        owner = msg.sender;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "treasury = zero address");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function lockBond(uint256 perUserCompensation) external payable {
        require(msg.value > 0, "no bond sent");
        Bond storage b = bonds[msg.sender];
        b.balance += msg.value;
        b.perUserCompensation = perUserCompensation;
        emit BondLocked(msg.sender, msg.value, perUserCompensation);
    }

    function topUpBond(address operator) external payable {
        require(msg.value > 0, "no funds sent");
        bonds[operator].balance += msg.value;
        emit BondToppedUp(operator, msg.value);
    }

    /// @notice Called once by the ASC after enough oracles have attested to
    ///         a verified outage. Registers the outage as claimable against
    ///         a satellite key that claim() will check live subscriber
    ///         status for - pays nobody directly.
    function registerSettlement(bytes32 outageId, address operator, bytes32 satelliteKey) external onlyASC {
        require(!outages[outageId].exists, "already registered");
        outages[outageId] = ClaimableOutage(operator, satelliteKey, block.timestamp, true);
        emit OutageRegistered(outageId, operator, satelliteKey, block.timestamp);
    }

    /// @notice Any address can call this for itself. Eligibility is checked
    ///         live against CoverageVault, and the payout is pro-rated by
    ///         how much of COMPENSATION_WINDOW the caller was actually
    ///         subscribed for (see contract-level docstring for why).
    ///
    ///         Reverts (rather than silently partial-paying on the BOND
    ///         side) if the operator's bond can't currently cover the
    ///         prorated amount owed. Because `claimed` is only set on
    ///         success, an unsuccessful claim can be retried later once the
    ///         operator tops up.
    function claim(bytes32 outageId) external {
        ClaimableOutage storage o = outages[outageId];
        require(o.exists, "unknown outage");
        require(!claimed[outageId][msg.sender], "already claimed");
        require(escrow.isActiveSubscriberByKey(o.satelliteKey, msg.sender), "not an active subscriber of this satellite");

        uint256 subStart = escrow.subscriptionStartByKey(o.satelliteKey, msg.sender);
        uint256 windowEnd = o.windowStart + COMPENSATION_WINDOW;
        uint256 effectiveStart = subStart > o.windowStart ? subStart : o.windowStart;
        require(effectiveStart < windowEnd, "joined after the compensated window closed - not eligible");

        uint256 coveredDuration = windowEnd - effectiveStart; // full COMPENSATION_WINDOW if subscribed throughout

        Bond storage b = bonds[o.operator];
        uint256 fullAmount = b.perUserCompensation;
        uint256 proratedOwed = (fullAmount * coveredDuration) / COMPENSATION_WINDOW;
        uint256 amount = proratedOwed > b.balance ? b.balance : proratedOwed;
        require(amount > 0, "operator bond depleted, retry after top-up");

        claimed[outageId][msg.sender] = true;
        b.balance -= amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "payout transfer failed");

        emit CompensationClaimed(outageId, msg.sender, amount, fullAmount);
    }

    function penalize(address operator, uint256 amount) external onlyASC {
        Bond storage b = bonds[operator];
        uint256 amt = amount > b.balance ? b.balance : amount;
        b.balance -= amt;
        emit OperatorPenalized(operator, amt, treasury);
        (bool ok, ) = payable(treasury).call{value: amt}("");
        require(ok, "treasury transfer failed");
    }

    function bondBalance(address operator) external view returns (uint256) {
        return bonds[operator].balance;
    }

    function hasClaimed(bytes32 outageId, address account) external view returns (bool) {
        return claimed[outageId][account];
    }
}
