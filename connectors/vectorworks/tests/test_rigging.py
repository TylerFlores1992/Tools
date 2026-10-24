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


# ---- the calc research's worked examples [computed] --------------------------------------

from vwmcp.rigging import apex_from_legs, format_weight, leg_parts, parse_length, parse_weight, truss_reactions  # noqa: E402


def test_bridle_table_from_the_research():
    # S = 20, d1 = 8, beams at 100', apex 90', W = 2,000 lb -> 1,537 / 1,250 lb, H 960, 88.9 deg
    r = solve_bridle(span=20, load=2000, x=8, drop=10)
    near(r.left.tension, 1537, 1)
    near(r.right.tension, 1250, 1)
    near(r.horizontal_force, 960, 0.5)
    near(r.included_angle, 88.9, 0.1)
    # beam 2 five feet lower: 1,921 / 1,300, H 1,200, 106.0 deg
    r = solve_bridle(span=20, load=2000, x=8, drop=10, rise=-5)
    near(r.left.tension, 1921, 1)
    near(r.right.tension, 1300, 1)
    near(r.included_angle, 106.0, 0.1)
    # flat bridle: 143.1 deg, each leg 3,162 lb (well past the 120 deg rule)
    r = solve_bridle(span=30, load=2000, x=15, drop=5)
    near(r.left.tension, 3162, 1)
    near(r.included_angle, 143.1, 0.1)


def test_nccer_worked_example():
    # W 18,000 lb, S 20 ft, D1 6 ft, H 8 ft: T1 15,750. The source prints T2 as ~10,881 because it
    # rounds leg 2 to 16.12 ft; exactly, L2 = sqrt(14^2 + 8^2) = 16.1245 and T2 = 5,400 x 16.1245 / 8.
    r = solve_bridle(span=20, load=18000, x=6, drop=8)
    near(r.left.tension, 15750, 1e-6)
    near(r.right.tension, 5400 * math.sqrt(260) / 8, 1e-6)
    near(r.right.tension, 10881, 4)


def test_apex_from_fixed_legs():
    x, drop = apex_from_legs(15, 17.5, 20)
    near(x, 7.969, 0.001)
    near(drop, 12.708, 0.001)
    # legs designed by the solver land back where they were designed
    r = solve_bridle(span=20, load=1, x=8, drop=10, rise=-5)
    x, drop = apex_from_legs(r.left.length, r.right.length, 20, -5)
    near(x, 8, 1e-9)
    near(drop, 10, 1e-9)
    assert apex_from_legs(5, 5, 20) is None  # too short to meet


def test_leg_parts_never_exceed_the_length():
    pieces, total, short = leg_parts(17.6)
    assert pieces == [10.0, 5.0, 2.5] and total == 17.5
    near(short, 0.1, 1e-9)
    pieces, total, short = leg_parts(12.806)
    assert total <= 12.806 and short < 2.5


def test_two_point_truss_is_exact_statics():
    r = truss_reactions([0, 40], udl=25)  # 40 ft, 25 plf
    near(r["reactions"][0], 500, 1e-6)
    near(r["reactions"][1], 500, 1e-6)
    assert not r["estimate"]
    # point loads by the lever rule
    r = truss_reactions([0, 10], point_loads=[(2, 100)])
    near(r["reactions"][0], 80, 1e-9)
    near(r["reactions"][1], 20, 1e-9)


def test_cantilever_matches_the_formulas():
    # 30 ft span + 5 ft overhang, UDL 1,000 lb over 35 ft: R_A = w(L^2 - a^2)/2L, R_B = w(L+a)^2/2L
    w = 1000 / 35
    r = truss_reactions([0, 30], udl=w, start=0, end=35)
    near(r["reactions"][0], w * (30 ** 2 - 5 ** 2) / 60, 0.5)
    near(r["reactions"][1], w * 35 ** 2 / 60, 0.5)


@pytest.mark.parametrize("supports,coeffs", [
    ([0, 20, 40], [0.375, 1.25, 0.375]),
    ([0, 40 / 3, 80 / 3, 40], [0.4, 1.1, 1.1, 0.4]),
    ([0, 10, 20, 30, 40], [0.393, 1.143, 0.929, 1.143, 0.393]),
])
def test_continuous_truss_matches_the_textbook_coefficients(supports, coeffs):
    w = 25.0
    span = supports[1] - supports[0]
    r = truss_reactions(supports, udl=w)
    assert r["estimate"] and r["method"] == "continuous beam"
    for got, c in zip(r["reactions"], coeffs):
        near(got, c * w * span, 0.006 * w * span)
    near(sum(r["reactions"]), w * 40, 1e-6)


def test_three_points_middle_takes_more_than_a_tributary_split():
    r = truss_reactions([0, 20, 40], udl=25)
    near(r["reactions"][1], 625, 1)  # tributary area would say 500: 25% light


def test_weights_and_lengths_from_field_text():
    assert parse_weight("1,850 lb") == 1850
    near(parse_weight("500kg"), 1102.31, 0.01)
    assert parse_weight("1 ton") == 2000
    near(parse_weight("2 t"), 4409.24, 0.01)
    assert parse_weight("heavy") is None
    assert parse_weight(55, "kg") == pytest.approx(121.25, abs=0.01)
    assert format_weight(1102.31) == "1,105 lb" and format_weight(1102.31, "kg") == "500 kg"
    assert parse_length("60'", 1.0) == 720 and parse_length("12000 mm", 1.0) == pytest.approx(472.44, abs=0.01)


def test_length_cases_shared_with_the_site():
    import json
    from pathlib import Path

    here = Path(__file__).resolve().parent
    shared = here.parent.parent.parent / "src" / "tools" / "vectorworks" / "length-cases.json"
    cases = json.loads((shared if shared.exists() else here / "fixtures" / "length-cases.json").read_text())
    for c in cases:
        got = parse_length(c["input"], {"in": 1.0, "mm": 25.4}[c["units"]])
        assert (got is None) if c["expect"] is None else got == pytest.approx(c["expect"]), c["input"]
