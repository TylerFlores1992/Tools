"""Rigging maths. The bridle cases are the same worked examples the site's calculator is
tested against (src/tools/bridle/math.test.mts), each derived from the ETCP formula sheet."""

import math
import random

import pytest

from vwmcp.rigging import Datum, classify_department, format_ft_in, level_beam_tension, solve_bridle, stage_position


def near(a, b, tol):
    assert abs(a - b) <= tol, f"{a} != {b} ±{tol}"


def test_symmetric_bridle_707():
    r = solve_bridle(span=20, load=1000, x=10, drop=10)
    near(r.left.tension, 707.1, 0.1)
    near(r.right.tension, 707.1, 0.1)
    near(r.included_angle, 90, 1e-9)


def test_asymmetric_level_bridle_1602():
    r = solve_bridle(span=12, load=2000, x=4, drop=6)
    near(r.left.tension, 1602.5, 0.5)
    near(r.left.vertical_force, 1333.3, 0.1)
    near(r.right.vertical_force, 666.7, 0.1)
    near(r.left.length, 7.211, 0.001)


def test_inward_pull():
    r = solve_bridle(span=16, load=1200, x=8, drop=6)
    near(r.left.tension, 1000, 1e-6)
    near(r.horizontal_force, 800, 1e-6)


def test_high_low_bridle():
    r = solve_bridle(span=10, load=1000, x=4, drop=10, rise=-2)
    near(r.left.tension, 702.4, 0.2)
    near(r.right.tension, 434.8, 0.2)
    near(r.left.length, 10.77, 0.01)
    near(r.right.length, 10, 1e-9)


def test_120_degrees_each_leg_carries_the_load():
    drop = 1.0
    half = math.tan(math.pi / 3) * drop
    r = solve_bridle(span=2 * half, load=500, x=half, drop=drop)
    near(r.included_angle, 120, 1e-9)
    near(r.left.tension, 500, 1e-9)


def test_invariants_over_random_rigs():
    rnd = random.Random(7)
    for _ in range(500):
        span = 2 + rnd.random() * 60
        x = span * (0.05 + rnd.random() * 0.9)
        drop = 0.5 + rnd.random() * 30
        rise = (rnd.random() - 0.5) * drop
        load = rnd.random() * 5000
        r = solve_bridle(span, load, x, drop, rise)
        assert r.valid
        near(r.left.vertical_force + r.right.vertical_force, load, 1e-6 * max(1, load))
        near(r.left.tension * r.left.horizontal / r.left.length, r.right.tension * r.right.horizontal / r.right.length, 1e-6 * max(1, load))
        assert r.left.tension >= 0 and r.right.tension >= 0


def test_agrees_with_the_etcp_hand_formula():
    r = solve_bridle(span=21, load=500, x=9, drop=12)
    near(r.left.tension, level_beam_tension(500, r.left.length, r.right.horizontal, 21, 12), 1e-9)


@pytest.mark.parametrize("bad", [
    dict(span=10, load=100, x=0, drop=5), dict(span=10, load=100, x=10, drop=5),
    dict(span=10, load=100, x=4, drop=0), dict(span=10, load=100, x=4, drop=3, rise=-3),
    dict(span=0, load=100, x=0, drop=3),
])
def test_invalid_geometry_is_words_not_numbers(bad):
    r = solve_bridle(**bad)
    assert not r.valid and len(r.problem) > 10
    assert math.isnan(r.left.tension)
    d = r.as_dict()
    assert d["left"]["tension"] is None and d["horizontal_force"] is None  # JSON-safe


@pytest.mark.parametrize("inches,text", [
    (150.5, "12'-6 1/2\""), (144, "12'-0\""), (0.5, "1/2\""), (6.25, "6 1/4\""), (0, "0\""),
    (-18, "-1'-6\""), (11.99, "1'-0\""), (7, "7\""),
])
def test_feet_and_inches(inches, text):
    assert format_ft_in(inches) == text


def test_positions_said_like_a_rigger():
    d = Datum()  # CL/PL through 0,0, audience at the bottom of the page
    assert stage_position((144, 360), d, 1.0)["text"] == "12'-0\" SL of CL, 30'-0\" US of PL"
    assert stage_position((-30, -18), d, 1.0)["text"] == "2'-6\" SR of CL, 1'-6\" DS of PL"
    assert stage_position((0, 120), d, 1.0)["text"] == "on CL, 10'-0\" US of PL"
    # metric drawing, datum moved, stage facing the other way (audience at the top)
    m = Datum(origin=(1000.0, 0.0), upstage=(0.0, -1.0), pl_name="DSE")
    r = stage_position((1000.0 - 2500.0, -4000.0), m, 25.4, metric=True)
    assert r["text"] == "2,500 mm SL of CL, 4,000 mm US of DSE"


@pytest.mark.parametrize("names,dept", [
    (("Rigging Points",), "rigging"), (("LX-Overhead",), "lighting"), (("Lighting Positions",), "lighting"),
    (("Audio PA",), "audio"), (("Video - LED Wall",), "video"), (("Scenic",), "scenic"), (("Art Dept",), "scenic"),
    (("Stage Deck",), "staging"), (("Venue Steel",), "venue"), (("A-101 Walls",), "venue"), (("Truss",), "rigging"),
    (("Design Layer-1", "Lighting-Fixtures"), "lighting"), (("Design Layer-1", "None"), "other"),
])
def test_departments_from_names(names, dept):
    assert classify_department(*names) == dept
