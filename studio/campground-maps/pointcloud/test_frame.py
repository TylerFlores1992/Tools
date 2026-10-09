"""ground.py's pure parts (frame.py). No packages, no network:

    python3 -I studio/campground-maps/pointcloud/test_frame.py
"""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import frame as FR

BBOX = [-77.421895, 38.59653, -77.414303, 38.602271]   # ridb-233379, Oak Ridge
FRAME = {"x": -330.7, "y": -318.6, "w": 661.4, "h": 637.2}


class Projection(unittest.TestCase):
    def test_corners(self):
        # The bbox's west-north corner is the frame's top-left; east-south its bottom-right (y is south).
        self.assertEqual(FR.to_map(BBOX[0], BBOX[3], BBOX, FRAME), (FRAME["x"], FRAME["y"]))
        x, y = FR.to_map(BBOX[2], BBOX[1], BBOX, FRAME)
        self.assertAlmostEqual(x, FRAME["x"] + FRAME["w"], places=6)
        self.assertAlmostEqual(y, FRAME["y"] + FRAME["h"], places=6)

    def test_linear_and_inverse(self):
        lon, lat = FR.to_degrees(12.5, -40.0, BBOX, FRAME)
        x, y = FR.to_map(lon, lat, BBOX, FRAME)
        self.assertAlmostEqual(x, 12.5, places=6)
        self.assertAlmostEqual(y, -40.0, places=6)
        # Halfway in degrees is halfway in metres (linear, as aerial-grid.mjs).
        x, y = FR.to_map((BBOX[0] + BBOX[2]) / 2, (BBOX[1] + BBOX[3]) / 2, BBOX, FRAME)
        self.assertAlmostEqual(x, FRAME["x"] + FRAME["w"] / 2, places=6)
        self.assertAlmostEqual(y, FRAME["y"] + FRAME["h"] / 2, places=6)

    def test_margin_box(self):
        w, s, e, n = FR.frame_box_degrees(BBOX, FRAME, 40)
        self.assertLess(w, BBOX[0]); self.assertLess(s, BBOX[1]); self.assertGreater(e, BBOX[2]); self.assertGreater(n, BBOX[3])
        self.assertEqual(FR.frame_box_degrees(BBOX, FRAME, 0), [BBOX[0], BBOX[1], BBOX[2], BBOX[3]])

    def test_mercator_round_trip(self):
        x, y = FR.merc(-77.4, 38.6)
        lon, lat = FR.merc_inv(x, y)
        self.assertAlmostEqual(lon, -77.4, places=9)
        self.assertAlmostEqual(lat, 38.6, places=9)
        self.assertAlmostEqual(FR.merc(0, 0)[1], 0, places=6)


class Grid(unittest.TestCase):
    def test_covers_exactly_the_frame(self):
        g = FR.grid(FRAME, 0.5, 40)
        self.assertEqual(g["W"], 1323)  # ceil(661.4 / 0.5)
        self.assertAlmostEqual(g["W"] * g["rx"], FRAME["w"], places=9)
        self.assertAlmostEqual(g["H"] * g["ry"], FRAME["h"], places=9)
        # The frame starts exactly `mx` cells in from the margin grid's edge.
        self.assertAlmostEqual(g["x0"] + g["mx"] * g["rx"], FRAME["x"], places=9)
        self.assertAlmostEqual(g["y0"] + g["my"] * g["ry"], FRAME["y"], places=9)
        self.assertGreaterEqual(g["mx"] * g["rx"], 40)
        self.assertEqual(g["GW"], g["W"] + 2 * g["mx"])
        self.assertLessEqual(g["rx"], 0.5); self.assertGreater(g["rx"], 0.499)

    def test_res_coarsens_only_for_huge_frames(self):
        self.assertEqual(FR.pick_res(FRAME, 40), 0.5)
        big = {"x": 0, "y": 0, "w": 3000, "h": 3000}
        r = FR.pick_res(big, 40)
        self.assertGreater(r, 0.5)
        self.assertLessEqual((3080 / r) * (3080 / r), 9_000_001)


class Ept(unittest.TestCase):
    ROOT = [0, 0, 0, 1024, 1024, 1024]

    def test_node_box(self):
        self.assertEqual(FR.node_box(self.ROOT, "0-0-0-0"), self.ROOT)
        self.assertEqual(FR.node_box(self.ROOT, "2-3-1-0"), [768, 256, 0, 1024, 512, 256])

    def test_overlap_and_cover(self):
        n = FR.node_box(self.ROOT, "1-0-0-0")  # 0..512 in x and y
        self.assertTrue(FR.overlaps_xy(n, [500, 500, 600, 600]))
        self.assertFalse(FR.overlaps_xy(n, [512, 0, 600, 100]))  # touching is not overlapping
        self.assertTrue(FR.covers_xy(self.ROOT, [10, 10, 20, 20]))
        self.assertFalse(FR.covers_xy(self.ROOT, [1000, 10, 1030, 20]))

    def test_names(self):
        names = ["VA_NorthernVA_1_B22", "VA_FEMA_NorthCounties_2011", "USGS_LPC_AR_Ouachita_B5_2016_LAS_2018", "WA_ColumbiaValley_1_2018"]
        self.assertEqual(FR.ept_name("VA_NorthernVA_1_B22", names), "VA_NorthernVA_1_B22")
        self.assertEqual(FR.ept_name("VA_FEMA_NORTHCOUNTIES_2011", names), "VA_FEMA_NorthCounties_2011")
        self.assertEqual(FR.ept_name("AR_Ouachita_B5_2016", names), "USGS_LPC_AR_Ouachita_B5_2016_LAS_2018")
        self.assertIsNone(FR.ept_name("WA_ColumbiaValley_4_2018", names))  # the bucket lags: unit 4 isn't there


class Choice(unittest.TestCase):
    def test_newest_good_covering_survey_first(self):
        units = [
            {"name": "old-dense", "end": "2016-03-01", "ql": "QL 1", "cover": 1.0},
            {"name": "new-dense", "end": "2024-12-28", "ql": "QL 1", "cover": 1.0},
            {"name": "newest-sparse", "end": "2025-06-01", "ql": "QL 3", "cover": 1.0},
            {"name": "newest-partial", "end": "2026-01-01", "ql": "QL 1", "cover": 0.3},
            {"name": "no-date-good", "end": "", "ql": "QL 2", "cover": 1.0},
            {"name": "unknown-ql", "end": "2025-01-01", "ql": "Other", "bytesPerM2": 40, "cover": 1.0},
        ]
        order = [u["name"] for u in FR.rank_units(units)]
        self.assertEqual(order[:3], ["unknown-ql", "new-dense", "old-dense"])  # 40 B/m² ~ 5 pts/m²: good
        self.assertEqual(order[3], "no-date-good")
        self.assertEqual(order[4], "newest-sparse")
        self.assertEqual(order[-1], "newest-partial")

    def test_cover_share(self):
        bbox = [0, 0, 1, 1]
        self.assertEqual(FR.cover_share([[-1, -1, 2, 2]], bbox), 1.0)
        self.assertAlmostEqual(FR.cover_share([[-1, -1, 0.5, 2]], bbox), 0.5)
        self.assertEqual(FR.cover_share([], bbox), 0.0)


class Disk(unittest.TestCase):
    def test_three_gigabytes_must_stay_free(self):
        self.assertTrue(FR.disk_ok(3_000_000_000))
        self.assertFalse(FR.disk_ok(2_999_999_999))
        self.assertFalse(FR.disk_ok(3_500_000_000, need_bytes=600_000_000))
        self.assertTrue(FR.disk_ok(9_000_000_000, need_bytes=1_000_000_000))


if __name__ == "__main__":
    unittest.main(verbosity=1)
