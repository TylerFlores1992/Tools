"""End-to-end: build_rig and the 3D tools -> job queue -> bridge -> strict fake Vectorworks."""

import asyncio
import json
import math

import pytest
from mcp.server.mcpserver.exceptions import ToolError

from vwmcp import config, rig
from vwmcp.server import build_server

S = 1 / math.sqrt(2)


def call(server, tool, /, **args):
    async def go():
        res = await server.call_tool(tool, args)
        if res.is_error:
            raise ToolError(res.content[0].text)
        return json.loads(res.content[0].text)

    return asyncio.run(go())


@pytest.fixture
def server(fake_rig):
    return build_server(config.load())


def obj(fake, uid):
    return next(o for o in fake.DOC.objects if o.uuid == uid)


def col(m, j):
    return tuple(m[i][j] for i in range(3))


def apply(m, v):
    return tuple(sum(m[i][k] * v[k] for k in range(3)) for i in range(3))


def parallel(a, b):
    return abs(abs(sum(x * y for x, y in zip(a, b))) - 1) < 1e-6


def full_cube():
    """10x10x10 box-truss cube (12" box): 4 legs, 4 floor and 4 top beams, 8 corner blocks, the
    front face's two knee braces with their four clamps, a base plate, and a kind from the future."""
    parts = []
    lo, hi = 6, 114
    for i, (x, y) in enumerate([(lo, lo), (hi, lo), (hi, hi), (lo, hi)]):
        parts.append({"id": "leg%d" % i, "kind": "truss", "role": "leg", "length": 96, "start": [x, y, 12], "end": [x, y, 108], "roll": 0})
        for z in (lo, hi):
            parts.append({"id": "c%d%d" % (i, z), "kind": "corner", "size": 12, "ways": 3, "center": [x, y, z]})
    for z, role in ((lo, "floor"), (hi, "top")):
        parts += [
            {"id": role + "F", "kind": "truss", "role": role, "length": 96, "start": [12, lo, z], "end": [108, lo, z]},
            {"id": role + "B", "kind": "truss", "role": role, "length": 96, "start": [108, hi, z], "end": [12, hi, z]},
            {"id": role + "L", "kind": "truss", "role": role, "length": 96, "start": [lo, 12, z], "end": [lo, 108, z]},
            {"id": role + "R", "kind": "truss", "role": role, "length": 96, "start": [hi, 12, z], "end": [hi, 108, z]},
        ]
    parts += [
        {"id": "pL", "kind": "pipe", "od": 1.9, "length": 48, "start": [8.88, -2, 77.18], "end": [42.82, -2, 111.12]},
        {"id": "kL1", "kind": "clamp", "type": "swivel", "at": [11, -2, 79.3], "pipeDir": [S, 0, S], "chordDir": [0, 0, 1], "normal": [0, 1, 0], "offset": 3},
        {"id": "kL2", "kind": "clamp", "type": "swivel", "at": [40.7, -2, 109], "pipeDir": [S, 0, S], "chordDir": [1, 0, 0], "normal": [0, 1, 0], "offset": 3},
        {"id": "pR", "kind": "pipe", "od": 1.9, "length": 48, "start": [111.12, -2, 77.18], "end": [77.18, -2, 111.12]},
        {"id": "kR1", "kind": "clamp", "type": "swivel", "at": [109, -2, 79.3], "pipeDir": [-S, 0, S], "chordDir": [0, 0, -1], "normal": [0, 1, 0], "offset": 3},
        {"id": "kR2", "kind": "clamp", "type": "swivel", "at": [79.3, -2, 109], "pipeDir": [S, 0, -S], "chordDir": [1, 0, 0], "normal": [0, 1, 0], "offset": 3},
        {"id": "bp0", "kind": "baseplate", "center": [6, 6, -0.25], "size": 24},
        {"id": "x1", "kind": "ratchet_strap", "from": [0, 0, 0]},
    ]
    return {"version": 1, "name": "10x10x10 cube", "units": "in",
            "series": {"id": "box12", "label": "12\" box truss", "width": 12, "height": 12, "chordOd": 2, "chordInset": 1},
            "parts": parts}


def test_new_tools_are_listed(server):
    names = {t.name for t in asyncio.run(server.list_tools())}
    assert {"set_z", "place_truss", "place_symbol_3d", "build_rig"} <= names


def test_build_rig_builds_the_cube(server, fake_rig):
    bl = full_cube()
    r = call(server, "build_rig", build_list=bl)
    assert r["built"] is True, r
    assert r["failed"] == 0 and r["placed"] == 12 + 8 + 2 + 4
    assert "missing_symbols" not in r and r["substituted"] == [] and r["warnings"] == []
    assert {s["id"] for s in r["skipped"]} == {"bp0", "x1"}
    assert next(s for s in r["skipped"] if s["id"] == "bp0")["reason"] == "no base plate symbol yet"
    parts = {p["part"]: p for p in r["parts"]}
    doc = fake_rig.DOC

    # Truss: only Straight Truss plug-ins remain (no magnets, no groups, no symbols), on "Rig".
    rig_layer = next(l for l in doc.layers if l.name == "Rig")
    on_rig = [o for o in doc.objects if o.layer is rig_layer]
    assert len(on_rig) == 26
    assert not [o for o in doc.objects if getattr(o, "parametric", None) == "MagnetObject"]
    assert not [o for o in on_rig if o.type in (11,)]
    trusses = [o for o in on_rig if getattr(o, "parametric", None) == "Straight Truss"]
    assert len(trusses) == 20

    leg = obj(fake_rig, parts["leg0"]["id"])
    assert leg.loc == pytest.approx((12, 6)) and leg.z == pytest.approx(12)
    assert leg.records["Straight Truss"]["Hanging Angle"] == "90.0"
    assert float(leg.records["Straight Truss"]["LineLength"]) == pytest.approx(96)
    back = obj(fake_rig, parts["floorB"]["id"])  # drawn right to left: built from its low end
    assert back.loc == pytest.approx((12, 114)) and back.z == pytest.approx(0)
    side = obj(fake_rig, parts["topL"]["id"])
    assert side.loc == pytest.approx((6, 12)) and side.z == pytest.approx(108)
    assert col(side.mat, 0) == pytest.approx((0, 1, 0), abs=1e-12)  # runs along +Y
    corner = obj(fake_rig, parts["c0114"]["id"])
    assert corner.loc == pytest.approx((0, 6)) and corner.z == pytest.approx(108)
    assert float(corner.records["Straight Truss"]["LineLength"]) == pytest.approx(12)

    # Clamps: both bores on their tubes, insertion exactly on `at` despite the flip offset.
    spec = {p["id"]: p for p in bl["parts"]}
    for cid, want_mirror in (("kL1", True), ("kL2", False), ("kR1", False), ("kR2", True)):
        p = spec[cid]
        o = obj(fake_rig, parts[cid]["id"])
        assert o.symbol == "Aluminium Scaffold Clamp-45 Deg"
        assert (fake_rig._det(o.mat) < 0) is want_mirror, cid
        assert parts[cid]["mirror"] is want_mirror
        assert (o.loc[0], o.loc[1], o.z) == pytest.approx(tuple(p["at"]), abs=1e-9)
        assert parallel(col(o.mat, 0), p["pipeDir"])
        assert parallel(apply(o.mat, (S, -S, 0)), p["chordDir"]), cid
        assert apply(o.mat, (0, 0, -3)) == pytest.approx(tuple(3 * n for n in p["normal"]))
        assert parts[cid]["readback"]["mirrored"] is want_mirror

    # Pipes: along their centerline, from the start.
    for pid in ("pL", "pR"):
        p = spec[pid]
        o = obj(fake_rig, parts[pid]["id"])
        assert o.symbol == "Pipe 1.5in-4ft Length" and fake_rig._det(o.mat) > 0
        assert (o.loc[0], o.loc[1], o.z) == pytest.approx(tuple(p["start"]), abs=0.01)
        end = tuple(a + 48 * d for a, d in zip((o.loc[0], o.loc[1], o.z), col(o.mat, 0)))
        assert end == pytest.approx(tuple(p["end"]), abs=0.01)


def test_undo_last_removes_the_whole_build(server, fake_rig):
    call(server, "build_rig", build_list=full_cube())
    assert len(fake_rig.DOC.objects) == 26
    call(server, "undo_last")
    assert fake_rig.DOC.objects == []


def test_a_layer_with_objects_is_refused_unless_replace(server, fake_rig):
    call(server, "build_rig", build_list=full_cube())
    with pytest.raises(ToolError, match="already has 26 objects"):
        call(server, "build_rig", build_list=full_cube())
    r = call(server, "build_rig", build_list=full_cube(), replace=True)
    assert r["built"] and r["cleared"] == 26 and len(fake_rig.DOC.objects) == 26


def test_missing_library_symbols_build_nothing_and_say_what_to_import(server, fake_rig):
    for n in [k for k in fake_rig.DOC.resources if k.startswith("Aluminium Scaffold Clamp")]:
        del fake_rig.DOC.resources[n]
    r = call(server, "build_rig", build_list=full_cube())
    assert r["built"] is False and r["missing_symbols"] == ["Aluminium Scaffold Clamp-45 Deg"]
    assert "Import these symbols" in r["how_to_fix"]
    assert fake_rig.DOC.objects == []


def test_substitutions_are_reported(server, fake_rig):
    bl = full_cube()
    next(p for p in bl["parts"] if p["id"] == "pL")["end"] = [8.88 + 40 * S, -2, 77.18 + 40 * S]  # a 40" pipe
    r = call(server, "build_rig", build_list=bl)
    assert r["built"]
    assert r["substituted"] == [{"id": "pL", "wanted": "40.00 in pipe", "used": "Pipe 1.5in-3ft Length", "difference_in": -4.0}]


def test_bad_build_lists_are_refused_in_words(server):
    bl = full_cube()
    bl["version"] = 7
    with pytest.raises(ToolError, match="version must be 1"):
        call(server, "build_rig", build_list=bl)
    with pytest.raises(ToolError, match="either build_list or design_id"):
        call(server, "build_rig")
    bl = full_cube()
    bl["series"]["id"] = "box20"
    with pytest.raises(ToolError, match="20.5"):
        call(server, "build_rig", build_list=bl)


def test_build_from_a_design_on_the_site_marks_it_built(server, fake_rig, monkeypatch):
    seen = []

    def fetch(base, token, design_id):
        seen.append(("GET", base, token, design_id))
        return {"id": design_id, "name": "Cube", "status": "approved", "buildList": full_cube()}

    def built(base, token, design_id):
        seen.append(("POST", base, token, design_id))

    monkeypatch.setattr(rig, "fetch_design", fetch)
    monkeypatch.setattr(rig, "mark_built", built)
    r = call(server, "build_rig", design_id="d42")
    assert r["built"] and r["marked_built"] is True and r["design"]["name"] == "Cube"
    assert [s[0] for s in seen] == ["GET", "POST"] and seen[0][1] == "https://tylerflores.dev"


def test_a_failed_built_notice_doesnt_fail_the_build(server, fake_rig, monkeypatch):
    monkeypatch.setattr(rig, "fetch_design", lambda b, t, i: {"id": i, "buildList": full_cube()})

    def boom(*a):
        raise rig.RigError("POST answered 500")

    monkeypatch.setattr(rig, "mark_built", boom)
    r = call(server, "build_rig", design_id="d42")
    assert r["built"] is True and r["marked_built"] is False and "500" in r["mark_built_error"]


def test_fetching_a_design_needs_a_token(server, monkeypatch):
    with pytest.raises(ToolError, match="VWMCP_RIG_TOKEN"):
        call(server, "build_rig", design_id="d42")


def test_place_truss_tool_stands_a_leg_up(server, fake_rig):
    r = call(server, "place_truss", start=[6, 6, 12], end=[6, 6, 108], series_symbol="Truss Box 12in x 12in x 8ft", layer="Rig")
    assert r["orientation"] == "vertical" and r["magnets_deleted"] == 2 and r["insertion"] == [12, 6, 12]
    o = obj(fake_rig, r["id"])
    assert o.loc == pytest.approx((12, 6)) and o.z == pytest.approx(12) and o.records["Straight Truss"]["Hanging Angle"] == "90.0"
    assert o.layer.name == "Rig"
    with pytest.raises(ToolError, match="sloped"):
        call(server, "place_truss", start=[0, 0, 0], end=[96, 0, 40])
    with pytest.raises(ToolError, match="No symbol named"):
        call(server, "place_truss", start=[0, 0, 6], end=[96, 0, 6], series_symbol="Truss Box 99in")


def test_place_symbol_3d_mirrors_a_left_handed_frame(server, fake_rig):
    r = call(server, "place_symbol_3d", symbol="Aluminium Scaffold Clamp-45 Deg", at=[1, 2, 3],
             x_axis=[1, 0, 0], z_axis=[0, 0, 1], y_axis=[0, -1, 0])
    o = obj(fake_rig, r["id"])
    assert r["mirror"] is True and fake_rig._det(o.mat) < 0
    assert (o.loc[0], o.loc[1], o.z) == pytest.approx((1, 2, 3), abs=1e-9)  # flip offset undone
    assert apply(o.mat, (0, 1, 0)) == pytest.approx((0, -1, 0))
    r2 = call(server, "place_symbol_3d", symbol="Pipe 1.5in-4ft Length", at=[0, 0, 0], x_axis=[0, 0, 1], z_axis=[1, 0, 0])
    o2 = obj(fake_rig, r2["id"])
    assert col(o2.mat, 0) == pytest.approx((0, 0, 1)) and col(o2.mat, 2) == pytest.approx((1, 0, 0))


def test_set_z_and_undo(server, fake_rig):
    r = call(server, "place_symbol_3d", symbol="Pipe 1.5in-4ft Length", at=[0, 0, 0], x_axis=[1, 0, 0], z_axis=[0, 0, 1])
    out = call(server, "set_z", ids=[r["id"]], z="9'-6\"")
    assert out["objects"][0]["z"] == pytest.approx(114) and obj(fake_rig, r["id"]).z == pytest.approx(114)
    call(server, "undo_last")
    assert obj(fake_rig, r["id"]).z == pytest.approx(0)
    line = call(server, "draw_line", start=[0, 0], end=[1, 0])
    with pytest.raises(ToolError, match="Only symbols and plug-in objects"):
        call(server, "set_z", ids=[line["id"]], z=10)
