"""Checks for the data quirks the pipeline handles.

    python -m unittest discover -s pipeline
"""

import unittest

import pandas as pd

from build_data import classify_journeys, clean, world_to_image


class CoordinateMapping(unittest.TestCase):
    def test_readme_worked_example(self):
        # README: AmbroseValley, x=-301.45 z=-355.55 -> pixel (78, 890) on a 1024 image
        ix, iy = world_to_image("AmbroseValley", pd.Series([-301.45]), pd.Series([-355.55]))
        self.assertEqual(round(ix[0] * 1024), 78)
        self.assertEqual(round(iy[0] * 1024), 890)

    def test_origin_maps_to_bottom_left(self):
        # world origin is the bottom-left of the minimap (image y is flipped)
        ix, iy = world_to_image("Lockdown", pd.Series([-500.0]), pd.Series([-500.0]))
        self.assertAlmostEqual(ix[0], 0.0)
        self.assertAlmostEqual(iy[0], 1.0)


def raw_rows(rows):
    """Rows as they come out of the parquet: ts typed as ms, event as bytes."""
    df = pd.DataFrame(rows, columns=["user_id", "match_id", "event", "ts", "x", "y", "z", "day", "file"])
    df["ts"] = pd.to_datetime(df["ts"], unit="ms")  # parquet type is timestamp[ms]
    return df


class Cleaning(unittest.TestCase):
    def setUp(self):
        f = "u_m.nakama-0"
        self.df = clean(raw_rows([
            ("u", "m.nakama-0", b"Position", 1770727161, 1.0, 2.0, 3.0, "February_10", f),
            ("u", "m.nakama-0", b"Position", 1770727161, 1.0, 2.0, 3.0, "February_10", f),  # exact duplicate
            ("u", "m.nakama-0", b"Loot", 1770727166, 1.5, 2.0, 3.5, "February_10", f),
        ]))

    def test_event_bytes_decoded(self):
        self.assertEqual(sorted(self.df["event"]), ["Loot", "Position"])

    def test_ts_integer_is_unix_seconds(self):
        # the stored integer is seconds: 1_770_727_161 s = 2026-02-10, and samples are 5 s apart
        self.assertEqual(self.df["ts"].min(), 1770727161)
        self.assertEqual(pd.to_datetime(self.df["ts"].min(), unit="s").date().isoformat(), "2026-02-10")
        self.assertEqual(self.df["ts"].max() - self.df["ts"].min(), 5)

    def test_duplicates_dropped_and_ids_tidied(self):
        self.assertEqual(len(self.df), 2)
        self.assertEqual(self.df["match"].iloc[0], "m")
        self.assertEqual(self.df["date"].iloc[0], "2026-02-10")


class BotDetection(unittest.TestCase):
    def test_classified_by_telemetry_with_mismatch_flag(self):
        uuid = "f4e072fa-b7af-4761-b567-1d95b7ad0108"
        df = pd.DataFrame({
            "file": ["h", "b", "n"],
            "user_id": [uuid, "1440", "1429"],
            "event": ["Position", "BotPosition", "Position"],
        })
        info = classify_journeys(df)
        self.assertFalse(info.loc["h", "bot"])
        self.assertTrue(info.loc["b", "bot"])
        self.assertFalse(info.loc["n", "bot"])  # numeric ID, but human telemetry
        self.assertTrue(info.loc["n", "idMismatch"])
        self.assertFalse(info.loc["h", "idMismatch"])


if __name__ == "__main__":
    unittest.main()
