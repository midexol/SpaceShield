"""
Tests the CelesTrak client's parsing/decision logic without touching the
real network. celestrak.org isn't in this sandbox's allowlist (see
README), so instead of a live call, requests.get is monkeypatched to
return a response shaped exactly like CelesTrak's real documented OMM JSON
schema (https://celestrak.org/NORAD/documentation/gp-data-formats.php).

This proves the parsing/decision logic is correct; it does not prove the
live HTTP call itself works, since that can only be verified somewhere
with open egress to celestrak.org.

Run: python3 -m pytest agent/test_public_tracker.py -v
     (or: python3 agent/test_public_tracker.py)
"""
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent))
from public_tracker import CelestrakTracker, TrackerUnavailable  # noqa: E402


def fresh_epoch_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%S.000000", time.gmtime(time.time() - 3600))


def stale_epoch_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%S.000000", time.gmtime(time.time() - 40 * 24 * 3600))


def make_response(status_code=200, json_body=None, raise_json_error=False):
    resp = MagicMock()
    resp.ok = 200 <= status_code < 300
    resp.status_code = status_code
    if raise_json_error:
        resp.json.side_effect = ValueError("not json")
    else:
        resp.json.return_value = json_body
    return resp


class TestCelestrakTracker(unittest.TestCase):
    def setUp(self):
        self.tracker = CelestrakTracker()

    @patch("public_tracker.requests.get")
    def test_tracked_and_fresh_is_plausible(self, mock_get):
        mock_get.return_value = make_response(json_body=[{
            "OBJECT_NAME": "ISS (ZARYA)",
            "OBJECT_ID": "1998-067A",
            "EPOCH": fresh_epoch_iso(),
            "NORAD_CAT_ID": 25544,
        }])
        result = self.tracker.fetch_status(25544)
        self.assertTrue(result.tracked)
        self.assertFalse(result.stale)
        self.assertEqual(result.object_name, "ISS (ZARYA)")
        self.assertTrue(self.tracker.is_plausible(25544))

        # confirms we hit the real documented endpoint shape
        called_url = mock_get.call_args[0][0]
        called_params = mock_get.call_args[1]["params"]
        self.assertEqual(called_url, "https://celestrak.org/NORAD/elements/gp.php")
        self.assertEqual(called_params, {"CATNR": 25544, "FORMAT": "JSON"})

    @patch("public_tracker.requests.get")
    def test_stale_epoch_is_not_plausible(self, mock_get):
        mock_get.return_value = make_response(json_body=[{
            "OBJECT_NAME": "DEAD-SAT",
            "EPOCH": stale_epoch_iso(),
            "NORAD_CAT_ID": 99999,
        }])
        result = self.tracker.fetch_status(99999)
        self.assertTrue(result.tracked)
        self.assertTrue(result.stale)
        self.assertFalse(self.tracker.is_plausible(99999))

    @patch("public_tracker.requests.get")
    def test_empty_catalog_response_means_untracked(self, mock_get):
        mock_get.return_value = make_response(json_body=[])
        result = self.tracker.fetch_status(1)
        self.assertFalse(result.tracked)
        self.assertFalse(self.tracker.is_plausible(1))

    @patch("public_tracker.requests.get")
    def test_http_error_raises_tracker_unavailable(self, mock_get):
        mock_get.return_value = make_response(status_code=503, json_body=None)
        with self.assertRaises(TrackerUnavailable):
            self.tracker.fetch_status(25544)

    @patch("public_tracker.requests.get")
    def test_malformed_json_raises_tracker_unavailable(self, mock_get):
        mock_get.return_value = make_response(raise_json_error=True)
        with self.assertRaises(TrackerUnavailable):
            self.tracker.fetch_status(25544)

    @patch("public_tracker.requests.get")
    def test_network_exception_raises_tracker_unavailable(self, mock_get):
        import requests
        mock_get.side_effect = requests.ConnectionError("Host not in allowlist")
        with self.assertRaises(TrackerUnavailable):
            self.tracker.fetch_status(25544)


if __name__ == "__main__":
    unittest.main()
