// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockSpacecoinSource
/// @notice Stands in for Spacecoin's chain during the MVP. Records satellite
///         uptime status and emits the event the AI Agent / Oracle Worker
///         watches for. In production this event lives on Spacecoin itself;
///         SpaceShield only ever *reads* it, never writes to it.
contract MockSpacecoinSource {
    struct SatelliteRecord {
        bool isOnline;
        uint256 lastContact;
        uint256 confirmations;
        string location;
    }

    mapping(string => SatelliteRecord) public satellites;

    event SatelliteStatusChanged(
        string indexed satelliteId,
        bool isOnline,
        uint256 timestamp,
        string location,
        uint256 confirmations
    );

    /// @notice Called by whatever process ingests real (or simulated)
    ///         telemetry. Each call represents one more confirmation that
    ///         the reported status is accurate — this is what the AI Agent's
    ///         confirmation-count floor is checking against.
    function reportStatus(
        string calldata satelliteId,
        bool isOnline,
        string calldata location
    ) external {
        SatelliteRecord storage rec = satellites[satelliteId];

        // A status flip resets the confirmation counter; repeating the same
        // status accumulates confirmations. This mirrors "N consecutive
        // reports agree" rather than "N reports ever happened".
        if (rec.confirmations == 0 || rec.isOnline != isOnline) {
            rec.confirmations = 1;
        } else {
            rec.confirmations += 1;
        }

        rec.isOnline = isOnline;
        rec.lastContact = block.timestamp;
        rec.location = location;

        emit SatelliteStatusChanged(
            satelliteId,
            isOnline,
            block.timestamp,
            location,
            rec.confirmations
        );
    }

    function getStatus(string calldata satelliteId)
        external
        view
        returns (bool isOnline, uint256 lastContact, uint256 confirmations, string memory location)
    {
        SatelliteRecord storage rec = satellites[satelliteId];
        return (rec.isOnline, rec.lastContact, rec.confirmations, rec.location);
    }
}
