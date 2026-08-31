"""
Public tracking cross-check client (PRD 4, Component 2: "NORAD data /
SpaceMapper community tracking / Spacecoin's official APIs").

Hits CelesTrak's real, keyless GP data endpoint:
  https://celestrak.org/NORAD/elements/gp.php?CATNR=<id>&FORMAT=JSON

This is a genuinely independent, real public data source - not something
Spacecoin or SpaceShield controls. What it tells you is narrower than "is
this satellite's comms link up": a TLE (orbital element set) confirms the
object is still a tracked, cataloged object in orbit, and how fresh its
last-known epoch is. That's useful as a sanity check (a satellite that's
deorbited or lost from the catalog entirely is a very different failure
mode than a comms outage on an otherwise healthy satellite) but it is NOT a
substitute for a real telemetry/uptime cross-check. Treat `is_plausible()`
as "nothing here contradicts the outage report", not as independent proof
of comms status - the PRD's own pseudocode treats this source the same way
(a corroboration gate, not the source of truth).

NETWORK NOTE: celestrak.org is not reachable from every sandboxed
environment (it wasn't from the one this was built in - see README). The
client degrades gracefully: on any network failure it raises
TrackerUnavailable, and callers (agent/monitor.py) catch that and fall back
to the local fixture rather than crashing or silently treating "unreachable"
as "confirmed online".
"""

import time
from dataclasses import dataclass
from typing import Optional

import requests

CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php"
STALE_EPOCH_SECONDS = 21 * 24 * 3600  # >21 days since last published TLE looks abandoned


class TrackerUnavailable(Exception):
    """Raised when the public tracker can't be reached or returns unusable data."""


@dataclass
class TrackerResult:
    catalog_number: int
    object_name: Optional[str]
    tracked: bool          # object still appears in the public catalog
    epoch_iso: Optional[str]
    stale: bool            # last published TLE is older than STALE_EPOCH_SECONDS


class CelestrakTracker:
    def __init__(self, timeout_seconds: float = 8.0):
        self.timeout_seconds = timeout_seconds

    def fetch_status(self, catalog_number: int) -> TrackerResult:
        try:
            resp = requests.get(
                CELESTRAK_URL,
                params={"CATNR": catalog_number, "FORMAT": "JSON"},
                timeout=self.timeout_seconds,
            )
        except requests.RequestException as exc:
            raise TrackerUnavailable(f"could not reach CelesTrak: {exc}") from exc

        if not resp.ok:
            raise TrackerUnavailable(f"CelesTrak returned HTTP {resp.status_code}")

        try:
            records = resp.json()
        except ValueError as exc:
            raise TrackerUnavailable(f"CelesTrak returned non-JSON body: {exc}") from exc

        if not records:
            # Empty array = valid response, satellite just isn't in the catalog
            # (deorbited, decayed, or never launched under this catalog number).
            return TrackerResult(
                catalog_number=catalog_number,
                object_name=None,
                tracked=False,
                epoch_iso=None,
                stale=True,
            )

        rec = records[0]
        epoch_iso = rec.get("EPOCH")
        stale = self._is_stale(epoch_iso)

        return TrackerResult(
            catalog_number=catalog_number,
            object_name=rec.get("OBJECT_NAME"),
            tracked=True,
            epoch_iso=epoch_iso,
            stale=stale,
        )

    @staticmethod
    def _is_stale(epoch_iso: Optional[str]) -> bool:
        if not epoch_iso:
            return True
        try:
            # CelesTrak EPOCH format: "2026-08-20T14:03:11.123456"
            epoch_struct = time.strptime(epoch_iso.split(".")[0], "%Y-%m-%dT%H:%M:%S")
            epoch_ts = time.mktime(epoch_struct)
        except ValueError:
            return True
        return (time.time() - epoch_ts) > STALE_EPOCH_SECONDS

    def is_plausible(self, catalog_number: int) -> bool:
        """True unless the public catalog actively contradicts the satellite
        still existing/being tracked. Used as the cross-check gate."""
        result = self.fetch_status(catalog_number)
        return result.tracked and not result.stale
