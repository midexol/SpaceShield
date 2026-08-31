"""
AI Agent (PRD 4, Component 2)

Polls Spacecoin's on-chain status (via MockSpacecoinSource locally, the real
Spacecoin RPC in production) and cross-checks it against an independent
public tracking source before ever triggering a settlement. Its entire job
is: detect, cross-check, and gate on confirmation count. It never decides
compensation amounts and never touches the Attestcoin or Settlement
contracts directly - it hands off to the Oracle Worker over HTTP, which is
the only thing allowed to submit proofs.

Run: python agent/monitor.py --satellite SAT-014
Requires: pip install web3 requests
"""

import argparse
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import requests
from web3 import Web3

from public_tracker import CelestrakTracker, TrackerUnavailable

SOURCE_ABI = json.loads("""
[
  {"inputs":[{"internalType":"string","name":"satelliteId","type":"string"}],
   "name":"getStatus","outputs":[
     {"internalType":"bool","name":"isOnline","type":"bool"},
     {"internalType":"uint256","name":"lastContact","type":"uint256"},
     {"internalType":"uint256","name":"confirmations","type":"uint256"},
     {"internalType":"string","name":"location","type":"string"}
   ],"stateMutability":"view","type":"function"}
]
""")

CONFIRMATION_FLOOR = 5  # PRD: "confirmations > 5" gate against false positives
POLL_INTERVAL_SECONDS = 4


@dataclass
class SatelliteStatus:
    is_online: bool
    last_contact: int
    confirmations: int
    location: str


class SatelliteMonitor:
    """Mirrors the PRD's SatelliteMonitor pseudocode, made runnable."""

    def __init__(self, rpc_url: str, source_address: str, oracle_worker_url: str,
                 norad_mock_path: Path, confirmation_floor: int = CONFIRMATION_FLOOR,
                 tracker_mode: str = "auto", satellite_catalog_path: Optional[Path] = None):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.source = self.w3.eth.contract(address=source_address, abi=SOURCE_ABI)
        self.oracle_worker_url = oracle_worker_url
        self.confirmation_floor = confirmation_floor
        self.norad_mock_path = norad_mock_path
        self._already_triggered: set[str] = set()  # per-run de-dup; the contracts also de-dup

        # tracker_mode: "live" = always hit CelesTrak, error if unreachable.
        #               "fixture" = always use the local JSON fixture.
        #               "auto" (default) = try live, fall back to fixture on
        #               any network failure, logging that it fell back.
        self.tracker_mode = tracker_mode
        self.tracker = CelestrakTracker()
        catalog_path = satellite_catalog_path or (Path(__file__).parent / "satellite_catalog.json")
        self.satellite_catalog = {}
        if catalog_path.exists():
            self.satellite_catalog = {
                k: v for k, v in json.loads(catalog_path.read_text()).items()
                if not k.startswith("_")
            }

    def query_spacecoin_rpc(self, satellite_id: str) -> SatelliteStatus:
        is_online, last_contact, confirmations, location = self.source.functions.getStatus(
            satellite_id
        ).call()
        return SatelliteStatus(is_online, last_contact, confirmations, location)

    def verify_norad(self, satellite_id: str) -> bool:
        """
        Independent cross-check source (PRD: "NORAD data / SpaceMapper
        community tracking / Spacecoin's official APIs"). Tries a real live
        query against CelesTrak's public catalog first; if that's
        unreachable (as it is in some sandboxed environments - see README)
        or the satellite has no catalog mapping, falls back to a local JSON
        fixture so the agent still runs deterministically offline.

        Returns True if this source also reports the satellite online /
        plausibly operational.
        """
        if self.tracker_mode in ("live", "auto"):
            catnr = self.satellite_catalog.get(satellite_id)
            if catnr is not None:
                try:
                    plausible = self.tracker.is_plausible(catnr)
                    print(f"[agent] live CelesTrak check for {satellite_id} "
                          f"(catnr {catnr}): plausible={plausible}")
                    return plausible
                except TrackerUnavailable as exc:
                    if self.tracker_mode == "live":
                        raise
                    print(f"[agent] CelesTrak unreachable ({exc}) — "
                          f"falling back to local fixture")
            elif self.tracker_mode == "live":
                raise TrackerUnavailable(f"no catalog mapping for {satellite_id}")

        return self._verify_via_fixture(satellite_id)

    def _verify_via_fixture(self, satellite_id: str) -> bool:
        if not self.norad_mock_path.exists():
            raise FileNotFoundError(
                f"public tracking fixture not found: {self.norad_mock_path}"
            )
        data = json.loads(self.norad_mock_path.read_text())
        return bool(data.get(satellite_id, {}).get("is_online", True))

    def detect_outage(self, satellite_id: str) -> bool:
        """Returns True and fires the Oracle Worker trigger iff every gate passes."""
        status = self.query_spacecoin_rpc(satellite_id)
        public_online = self.verify_norad(satellite_id)

        if status.is_online:
            return False  # nothing to do, satellite is up per the source chain

        if public_online:
            # Source chain says offline, independent tracker disagrees.
            # This is exactly the false-positive case the cross-check exists
            # to catch - do not trigger.
            print(f"[agent] {satellite_id}: source=OFFLINE but public tracker=ONLINE — "
                  f"withholding trigger, sources disagree")
            return False

        if status.confirmations <= self.confirmation_floor:
            print(f"[agent] {satellite_id}: OFFLINE but only {status.confirmations} "
                  f"confirmations (floor={self.confirmation_floor}) — waiting for more")
            return False

        if satellite_id in self._already_triggered:
            return False

        print(f"[agent] {satellite_id}: OFFLINE, cross-checked, "
              f"{status.confirmations} confirmations — triggering Oracle Worker")
        self._trigger_oracle_worker(satellite_id, status)
        self._already_triggered.add(satellite_id)
        return True

    def _trigger_oracle_worker(self, satellite_id: str, status: SatelliteStatus):
        resp = requests.post(
            f"{self.oracle_worker_url}/trigger/{satellite_id}",
            json={"blockHeight": self.w3.eth.block_number},
            timeout=10,
        )
        if resp.ok:
            print(f"[agent] oracle worker accepted trigger: {resp.json()}")
        else:
            print(f"[agent] oracle worker rejected trigger: {resp.status_code} {resp.text}")

    def run_forever(self, satellite_id: str):
        print(f"[agent] watching {satellite_id} every {POLL_INTERVAL_SECONDS}s")
        while True:
            try:
                self.detect_outage(satellite_id)
            except Exception as exc:  # keep the loop alive; log and continue
                print(f"[agent] error checking {satellite_id}: {exc}")
            time.sleep(POLL_INTERVAL_SECONDS)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--satellite", default="SAT-014")
    parser.add_argument("--rpc-url", default="http://127.0.0.1:8545")
    parser.add_argument("--source-address", required=True)
    parser.add_argument("--oracle-worker-url", default="http://127.0.0.1:4001")
    parser.add_argument("--norad-mock", default=str(Path(__file__).parent / "mock_norad.json"))
    parser.add_argument("--tracker-mode", choices=["auto", "live", "fixture"], default="auto",
                         help="auto: try live CelesTrak, fall back to fixture (default). "
                              "live: require CelesTrak, error if unreachable. "
                              "fixture: never touch the network.")
    parser.add_argument("--once", action="store_true", help="check once and exit instead of polling")
    args = parser.parse_args()

    monitor = SatelliteMonitor(
        rpc_url=args.rpc_url,
        source_address=args.source_address,
        oracle_worker_url=args.oracle_worker_url,
        norad_mock_path=Path(args.norad_mock),
        tracker_mode=args.tracker_mode,
    )

    if args.once:
        monitor.detect_outage(args.satellite)
    else:
        monitor.run_forever(args.satellite)


if __name__ == "__main__":
    main()
