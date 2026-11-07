"""Rig Planner build-list math (vwmcp.rig): frames, clamps, truss insertion, pipes, validation."""

import itertools
import math

import pytest

from vwmcp import rig

S = 1 / math.sqrt(2)
LIB = set(rig.CLAMP_SYMBOLS.values()) | {
    "Truss Box 12in x 12in x 8ft", "Truss Box 12in x 12in x 10ft",
    "Pipe 1.5in-4ft Length", "Pipe 1.5in-5ft Length", "Pipe 1.5in-2ft-6in Length", "Pipe 1.5in-1ft-6in Length",
}


def approx_v(a, b, tol=1e-6):
    return all(abs(x - y) < tol for x, y in zip(a, b))


def apply(rows, p):
    return tuple(sum(rows[i][j] * p[j] for j in range(3)) for i in range(3))


# ---- frames and Euler angles ----------------------------------------------------------------


@pytest.mark.parametrize("a,b,c", [(0, 0, 0), (30, 0, 0), (0, 45, 0), (0, 0, 90), (10, 20, 30), (-120, 60, 170), (90, -45, 30)])
def test_euler_round_trips(a, b, c):
    rows = rig.rot_xyz(a, b, c)
    back = rig.rot_xyz(*rig.euler_xyz(rows))
    for i, j in itertools.product(range(3), range(3)):
        assert back[i][j] == pytest.approx(rows[i][j], abs=1e-9)


def test_euler_gimbal_lock_still_reproduces_the_matrix():
    for b in (90, -90):
        rows = rig.rot_xyz(25, b, 40)
        back = rig.rot_xyz(*rig.euler_xyz(rows))
        for i, j in itertools.product(range(3), range(3)):
            assert back[i][j] == pytest.approx(rows[i][j], abs=1e-9)


def test_rot_xyz_is_right_handed_about_world_axes():
    assert approx_v(apply(rig.rot_xyz(0, 0, 90), (1, 0, 0)), (0, 1, 0))  # Z: X -> Y
    assert approx_v(apply(rig.rot_xyz(90, 0, 0), (0, 1, 0)), (0, 0, 1))  # X: Y -> Z
    assert approx_v(apply(rig.rot_xyz(0, 90, 0), (0, 0, 1)), (1, 0, 0))  # Y: Z -> X
    # X first, then Y (about the WORLD axes): (0,1,0) -X90-> (0,0,1) -Y90-> (1,0,0)
    assert approx_v(apply(rig.rot_xyz(90, 90, 0), (0, 1, 0)), (1, 0, 0))


def test_frame_squares_z_to_x_and_is_right_handed():
    f = rig.frame_from_axes((1, 0, 0), (0.2, 0, 1))
    assert approx_v(f.z, (0, 0, 1)) and approx_v(f.y, (0, 1, 0)) and not f.mirrored
    assert rig.det3(f.x, f.y, f.z) == pytest.approx(1)


def test_left_handed_y_means_mirrored():
    assert rig.frame_from_axes((1, 0, 0), (0, 0, 1), y_axis=(0, -1, 0)).mirrored
    assert not rig.frame_from_axes((1, 0, 0), (0, 0, 1), y_axis=(0, 1, 0)).mirrored
    assert rig.frame_from_axes((1, 0, 0), (0, 0, 1), mirror=True).mirrored
    # A mirrored frame puts the symbol's local +Y on the given (left-handed) y axis.
    f = rig.frame_from_axes((1, 0, 0), (0, 0, 1), y_axis=(0, -1, 0))
    assert approx_v(f.local_to_world((0, 1, 0)), (0, -1, 0))


def test_parallel_axes_are_refused():
    with pytest.raises(rig.RigError, match="parallel"):
        rig.frame_from_axes((1, 0, 0), (2, 0, 0))


# ---- clamps ---------------------------------------------------------------------------------


def test_cube_front_face_leg_clamp_is_mirrored():
    # TL leg brace clamp at [11,-2,79.3] on the 10x10x10 cube.
    ch = rig.choose_clamp((S, 0, S), (0, 0, 1), (0, 1, 0), LIB)
    assert ch["symbol"] == "Aluminium Scaffold Clamp-45 Deg"
    assert ch["mirrored"] is True and ch["exact"]
    assert ch["angle_needed"] == pytest.approx(45)


def test_cube_front_face_top_clamp_is_not_mirrored():
    # TL top-chord clamp at [40.7,-2,109].
    ch = rig.choose_clamp((S, 0, S), (1, 0, 0), (0, 1, 0), LIB)
    assert ch["symbol"] == "Aluminium Scaffold Clamp-45 Deg" and ch["mirrored"] is False


@pytest.mark.parametrize("ps,cs", [(1, -1), (-1, 1), (-1, -1)])
def test_clamp_choice_ignores_the_sign_of_the_tube_axes(ps, cs):
    for chord, want in (((0, 0, 1), True), ((1, 0, 0), False)):
        ch = rig.choose_clamp((ps * S, 0, ps * S), tuple(cs * c for c in chord), (0, 1, 0), LIB)
        assert ch["mirrored"] is want


@pytest.mark.parametrize("pipe,chord,normal,at", [
    ((S, 0, S), (0, 0, 1), (0, 1, 0), (11, -2, 79.3)),
    ((S, 0, S), (1, 0, 0), (0, 1, 0), (40.7, -2, 109)),
    ((0, S, S), (0, 0, 1), (1, 0, 0), (-2, 11, 79.3)),
    ((0, -S, S), (0, 1, 0), (-1, 0, 0), (122, 40, 109)),
])
def test_clamp_frame_puts_both_bores_on_their_tubes(pipe, chord, normal, at):
    ch = rig.choose_clamp(pipe, chord, normal, LIB)
    f = ch["frame"]
    # Upper bore (local X through the origin) runs along the pipe.
    assert abs(abs(rig.dot(f.local_to_world((1, 0, 0)), pipe)) - 1) < 1e-9
    # Lower bore: along (1,-1,0)/sqrt2 at local z = -3 -> on the chord, 3" along the normal.
    lower_dir = f.local_to_world((S, -S, 0))
    assert abs(abs(rig.dot(lower_dir, chord)) - 1) < 1e-9
    lower_pt = rig.add(at, f.local_to_world((0, 0, -3)))
    assert approx_v(lower_pt, rig.add(at, rig.mul(normal, 3)))


def test_clamp_angle_picks_the_nearest_variant_and_says_so():
    a = math.radians(50)
    ch = rig.choose_clamp((math.cos(a), 0, math.sin(a)), (1, 0, 0), (0, 1, 0), LIB)
    assert ch["angle_used"] == 45 and not ch["exact"]
    b = math.radians(62)
    assert rig.choose_clamp((math.cos(b), 0, math.sin(b)), (1, 0, 0), (0, 1, 0), LIB)["angle_used"] == 60
    # Square tubes: the 90 clamp, never mirrored.
    sq = rig.choose_clamp((0, 0, 1), (1, 0, 0), (0, 1, 0), LIB)
    assert sq["symbol"] == "Aluminium Scaffold Clamp-90deg" and not sq["mirrored"]
    # Only what the file has.
    only45 = rig.choose_clamp((0, 0, 1), (1, 0, 0), (0, 1, 0), {"Aluminium Scaffold Clamp-45 Deg"})
    assert only45["angle_used"] == 45


def test_clamp_tubes_must_be_square_to_the_normal():
    with pytest.raises(rig.RigError, match="square to normal"):
        rig.choose_clamp((S, S, 0), (1, 0, 0), (0, 1, 0), LIB)


# ---- truss ----------------------------------------------------------------------------------


def test_vertical_leg_cancels_the_hanging_angle_pivot():
    pl = rig.truss_placement([6, 6, 12], [6, 6, 108], 12, 12)
    assert pl["insertion"] == [12, 6, 12]
    assert pl["hanging_angle"] == 90 and pl["length"] == pytest.approx(96) and pl["rotation"] == 0
    # Drawn top-down, same result.
    assert rig.truss_placement([6, 6, 108], [6, 6, 12], 12, 12)["insertion"] == [12, 6, 12]


def test_horizontal_truss_sits_on_its_bottom_face():
    pl = rig.truss_placement([12, 6, 6], [108, 6, 6], 12, 12)
    assert pl["insertion"] == [12, 6, 0] and pl["rotation"] == 0 and pl["hanging_angle"] == 0
    back = rig.truss_placement([108, 6, 6], [12, 6, 6], 12, 12)
    assert back["insertion"] == [12, 6, 0]
    y = rig.truss_placement([6, 12, 114], [6, 108, 114], 12, 12)
    assert y["insertion"] == [6, 12, 108] and y["rotation"] == 90 and y["length"] == pytest.approx(96)


def test_corner_block_is_a_one_foot_section_centered_on_the_block():
    pl = rig.corner_placement([6, 6, 6], 12, 12, 12)
    assert pl["insertion"] == [0, 6, 0] and pl["length"] == pytest.approx(12) and pl["rotation"] == 0


@pytest.mark.parametrize("start,end,match", [
    ([0, 0, 0], [96, 0, 50], "sloped"),
    ([0, 0, 0], [60, 60, 0], "angle in plan"),
    ([0, 0, 0], [0, 0, 0], "same point"),
])
def test_unsupported_truss_is_refused_clearly(start, end, match):
    with pytest.raises(rig.RigError, match=match):
        rig.truss_placement(start, end, 12, 12)


def test_roll_must_be_square():
    assert rig.truss_placement([0, 0, 6], [96, 0, 6], 12, 12, roll=90)["insertion"] == [0, 0, 0]
    with pytest.raises(rig.RigError, match="roll"):
        rig.truss_placement([0, 0, 6], [96, 0, 6], 12, 12, roll=45)


def test_series_symbols():
    assert rig.truss_symbol_candidates("box12")[0] == "Truss Box 12in x 12in x 10ft"
    with pytest.raises(rig.RigError, match="box20"):
        rig.truss_symbol_candidates("box20")


# ---- pipes ----------------------------------------------------------------------------------


def test_pipe_choice_exact_or_nearest():
    assert rig.choose_pipe(48, LIB) == {"symbol": "Pipe 1.5in-4ft Length", "length": 48.0, "exact": True, "difference": 0.0}
    near = rig.choose_pipe(48.0 - 0.01, LIB)
    assert near["exact"] and near["symbol"] == "Pipe 1.5in-4ft Length"
    assert rig.choose_pipe(31, LIB)["symbol"] == "Pipe 1.5in-2ft-6in Length"
    ch = rig.choose_pipe(54, LIB)  # halfway between 4 and 5 ft: the longer one
    assert ch["symbol"] == "Pipe 1.5in-5ft Length" and not ch["exact"] and ch["difference"] == 6
    assert rig.pipe_lengths(LIB)[18] == "Pipe 1.5in-1ft-6in Length"


def test_pipe_frame_points_along_the_pipe():
    f, s, e, L = rig.pipe_frame([8.88, -2, 77.18], [42.82, -2, 111.12])
    assert L == pytest.approx(48, abs=0.01)
    assert approx_v(f.x, (S, 0, S), 1e-3) and not f.mirrored
    fv, *_ = rig.pipe_frame([0, 0, 0], [0, 0, 48])  # plumb pipe: still a valid frame
    assert approx_v(fv.x, (0, 0, 1))


# ---- build lists ----------------------------------------------------------------------------


def cube():
    """The 10x10x10 cube's front-left corner: a leg, a floor beam, a top beam, corner blocks,
    one knee-brace pipe and its two clamps (numbers from docs/RIG.md)."""
    return {
        "version": 1, "name": "cube corner", "units": "in",
        "series": {"id": "box12", "label": "12\" box", "width": 12, "height": 12, "chordOd": 2, "chordInset": 1},
        "parts": [
            {"id": "t1", "kind": "truss", "role": "floor", "length": 96, "start": [12, 6, 6], "end": [108, 6, 6], "roll": 0},
            {"id": "t2", "kind": "truss", "role": "leg", "length": 96, "start": [6, 6, 12], "end": [6, 6, 108], "roll": 0},
            {"id": "t3", "kind": "truss", "role": "top", "length": 96, "start": [12, 6, 114], "end": [108, 6, 114], "roll": 0},
            {"id": "c1", "kind": "corner", "size": 12, "ways": 3, "center": [6, 6, 6]},
            {"id": "c2", "kind": "corner", "size": 12, "ways": 3, "center": [6, 6, 114]},
            {"id": "p1", "kind": "pipe", "od": 1.9, "length": 48, "start": [8.88, -2, 77.18], "end": [42.82, -2, 111.12]},
            {"id": "k1", "kind": "clamp", "type": "swivel", "at": [11, -2, 79.3], "pipeDir": [S, 0, S], "chordDir": [0, 0, 1], "normal": [0, 1, 0], "offset": 3},
            {"id": "k2", "kind": "clamp", "type": "swivel", "at": [40.7, -2, 109], "pipeDir": [S, 0, S], "chordDir": [1, 0, 0], "normal": [0, 1, 0], "offset": 3},
            {"id": "b1", "kind": "baseplate", "center": [6, 6, -0.25], "size": 24},
        ],
    }


def test_valid_build_list_has_no_problems():
    assert rig.validate_build_list(cube()) == []


def test_validation_says_what_is_wrong():
    bl = cube()
    bl["version"] = 2
    bl["parts"][1]["id"] = "t1"
    bl["parts"][2]["start"] = [1, 2]
    del bl["parts"][3]["size"]
    errs = " | ".join(rig.validate_build_list(bl))
    assert "version must be 1" in errs and "'t1' is used twice" in errs and "t3.start" in errs and "c1.size" in errs
    assert rig.validate_build_list("nope") == ["the build list must be a JSON object"]


def test_plan_builds_the_cube_corner_and_skips_the_base_plate():
    plan = rig.plan_build(cube(), LIB)
    assert plan.missing_symbols == [] and plan.substituted == [] and plan.warnings == []
    by_id = {s["id"]: s for s in plan.steps}
    assert by_id["t2"]["insertion"] == [12, 6, 12] and by_id["t2"]["hanging_angle"] == 90
    assert by_id["t1"]["symbol"] == "Truss Box 12in x 12in x 10ft"
    assert by_id["c1"]["length"] == 12 and by_id["c1"]["insertion"] == [0, 6, 0]
    assert by_id["k1"]["mirror"] is True and by_id["k2"]["mirror"] is False
    assert by_id["p1"]["symbol"] == "Pipe 1.5in-4ft Length"
    assert plan.skipped == [{"id": "b1", "kind": "baseplate", "reason": "no base plate symbol yet"}]


def test_plan_skips_unknown_kinds_without_failing():
    bl = cube()
    bl["parts"].append({"id": "x1", "kind": "spansetsling", "at": [0, 0, 0]})
    plan = rig.plan_build(bl, LIB)
    assert {"id": "x1", "kind": "spansetsling", "reason": "part kind 'spansetsling' isn't built by this connector yet"} in plan.skipped
    assert rig.validate_build_list(bl) == []


def test_plan_lists_missing_library_symbols():
    plan = rig.plan_build(cube(), {"Pipe 1.5in-4ft Length"})
    assert "Truss Box 12in x 12in x 8ft" in plan.missing_symbols
    assert "Aluminium Scaffold Clamp-45 Deg" in plan.missing_symbols


def test_plan_reports_substituted_pipe_lengths():
    bl = cube()
    bl["parts"][5]["end"] = [8.88 + 30, -2, 77.18]  # a 30" pipe
    plan = rig.plan_build(bl, LIB - {"Pipe 1.5in-2ft-6in Length"})
    assert plan.substituted == [{"id": "p1", "wanted": "30.00 in pipe", "used": "Pipe 1.5in-1ft-6in Length", "difference_in": -12.0}]
    step = next(s for s in plan.steps if s["id"] == "p1")
    assert step["at"] == pytest.approx([8.88 + 6, -2, 77.18])  # the 18" pipe is centered on the 30" span


def test_unsupported_series_is_refused():
    bl = cube()
    bl["series"]["id"] = "box20"
    with pytest.raises(rig.RigError, match="20.5"):
        rig.plan_build(bl, LIB)


def test_design_ids_are_checked_before_building_a_url():
    assert rig.design_url("https://tylerflores.dev/", "abc-123") == "https://tylerflores.dev/api/rig/designs/abc-123"
    with pytest.raises(rig.RigError):
        rig.design_url("https://tylerflores.dev", "../admin")
