"""A head rigger's day against the fake show (dev/fake_vs.py, seed_show): survey what arrived,
set the datum and the venue's limits, read the point list, check it, change something, see
what changed. Plus the situations: referenced files, DWG import, wrong scale, groups, walls."""

import asyncio
import json

import pytest
from mcp.server.mcpserver.exceptions import ToolError

from vwmcp import config
from vwmcp.server import build_server


def call(server, tool, /, **args):
    async def go():
        res = await server.call_tool(tool, args)
        if res.is_error:
            raise ToolError(res.content[0].text)
        return json.loads(res.content[0].text)

    return asyncio.run(go())


@pytest.fixture
def server(fake_show):
    return build_server(config.load())


def obj(server, name):
    return next(o for o in call(server, "list_objects", limit=500, include_geometry=True)["objects"] if o["name"] == name)


# ---- 1. what arrived ------------------------------------------------------------------------


def test_survey_tells_sources_departments_and_plugins(server):
    sv = call(server, "survey_drawing")
    assert sv["counts"]["referenced"] == 2  # PA-L and PA-R come from the audio file
    assert sv["counts"]["viewport"] == 1  # the LED wall shows through a local viewport
    depts = {l["name"]: l["dept"] for l in sv["layers"]}
    assert depts["Venue Steel"] == "venue" and depts["Rigging"] == "rigging" and depts["Lighting"] == "lighting"
    assert depts["Scenic"] == "scenic" and depts["Audio (referenced)"] == "audio" and depts["Video"] == "video"
    plugins = {p["name"]: p for p in sv["plugins"]}
    assert plugins["Hoist"]["kind"] == "hoist" and plugins["Hoist"]["count"] == 5
    assert "Hoist ID" in plugins["Hoist"]["fields"]  # real field names, discovered not assumed
    vps = {v["name"]: v for v in sv["viewports"]}
    assert vps["Audio from Spring Tour - Audio.vwx"]["referenced"] is True
    assert vps["Video layout"]["referenced"] is False
    assert any("referenced files" in s for s in sv["situation"])
    assert any("No datum" in s for s in sv["situation"])


def test_groups_walls_and_heights_are_read(server):
    header = obj(server, "Header")
    assert header["geometry"]["kind"] == "group" and len(header["geometry"]["parts"]) == 3
    wall = obj(server, "Back of house wall")
    assert wall["geometry"]["kind"] == "wall" and wall["geometry"]["thickness"] == 4.0 and wall["z_max"] == 96.0
    flat = obj(server, "Flat 1")
    assert flat["z_min"] == pytest.approx(0) and flat["z_max"] == pytest.approx(288)  # 3D: 0 to 24'
    rig = call(server, "get_rigging")
    hoist = next(o for o in rig["objects"] if o["kind"] == "hoist")
    assert hoist["z"] == 600.0 and hoist["fields"]["Capacity"] == "2000 lb"


def test_referenced_objects_are_read_only(server):
    pa = obj(server, "PA-L")
    assert pa["source"] == "referenced"
    with pytest.raises(ToolError, match="referenced file"):
        call(server, "move_objects", ids=[pa["id"]], dx=12, dy=0)
    led = obj(server, "LED Wall")
    assert led["source"] == "viewport"
    with pytest.raises(ToolError, match="read-only"):
        call(server, "delete_objects", ids=[led["id"]])


# ---- 2. datum, departments, limits ------------------------------------------------------------


def test_reference_lines_and_datum(server):
    found = {c["name"] for c in call(server, "find_reference_lines")["candidates"]}
    assert {"CL", "PL"} <= found
    call(server, "set_datum", origin=[0, 0], upstage="up", cl_name="CL", pl_name="PL")
    hoist5 = next(o for o in call(server, "get_rigging")["objects"] if o.get("fields", {}).get("Hoist ID") == "5")
    w = call(server, "where_is", target=hoist5["id"])
    assert w["text"] == "12'-6\" SL of CL, 30'-0\" US of PL"
    assert call(server, "where_is", target=["-6'", "1'"])["text"] == "6'-0\" SR of CL, 1'-0\" US of PL"


def test_department_overrides_stick(server):
    call(server, "set_departments", mapping={"layer:Stage Deck": "scenic"})
    d = call(server, "survey_drawing")
    assert next(l for l in d["layers"] if l["name"] == "Stage Deck")["dept"] == "scenic"
    with pytest.raises(ToolError, match="Department must be one of"):
        call(server, "set_departments", mapping={"layer:Stage Deck": "catering"})


# ---- 3. the point list -------------------------------------------------------------------------


@pytest.fixture
def rigged(server):
    call(server, "set_datum", origin=[0, 0], upstage="up")
    call(server, "set_limits", values={"weight_unit": "lb", "point_limit": 1500, "total_limit": 60000, "high_steel": "60'",
                                       "truss_weight_per_ft": 8, "cable_allowance_per_ft": 2, "dynamic_factor": 1.2})
    return server


def rows_by_point(rep):
    return {r["point"]: r for r in rep["points"]}


def test_two_pick_truss_is_statics_and_three_pick_truss_is_an_estimate(rigged):
    rep = call(rigged, "rigging_report", save_csv=False)
    p = rows_by_point(rep)
    # LX2: 30' truss on picks at -12'-6" / +12'-6", four 55 lb fixtures symmetric, 10 lb/ft -> each takes half
    lx2 = 4 * 55 + 10 * 30
    assert p["4"]["load_source"] == "statics" and p["4"]["load"] == pytest.approx(lx2 / 2, rel=1e-3)
    assert p["4"]["point_load"] == pytest.approx(lx2 / 2 + 116, rel=1e-3)  # plus the hoist body
    # LX1: three picks -> estimate, flagged for verification
    assert p["2"]["load_source"] == "estimate"
    assert any("continuous-beam estimate" in c["text"] for c in rep["checks"])
    assert p["2"]["load"] > p["1"]["load"]  # the middle pick takes more than a tributary split


def test_dead_hangs_bridles_and_beam_totals(rigged):
    rep = call(rigged, "rigging_report", save_csv=False)
    p = rows_by_point(rep)
    assert p["1"]["steel"] == {"type": "dead hang", "beams": ["Beam A"]}
    br = p["4"]["steel"]
    assert br["type"] == "bridle" and br["beams"] == ["Beam A", "Beam B"]
    # beams 10' either side, high steel 60', hook at 50': legs sqrt(10^2 + 10^2) = 14'-1 11/16", 90 degrees
    assert br["bridle"]["angle"] == pytest.approx(90, abs=1e-6)
    assert br["bridle"]["leg_a_text"] == "14'-1 11/16\""
    assert br["bridle"]["tension_a"] == pytest.approx(p["4"]["point_load"] / 2 ** 0.5, rel=1e-6)
    beams = {b["beam"]: b["total"] for b in rep["beams"]}
    assert beams["Beam B"] == pytest.approx(p["4"]["point_load"] / 2 + p["5"]["point_load"] / 2, rel=1e-6)


def test_limits_and_checks_in_words(rigged):
    call(rigged, "set_limits", values={"point_limit": 400})
    rep = call(rigged, "rigging_report", save_csv=False)
    over = [c for c in rep["checks"] if c["severity"] == "danger" and "per point" in c["text"]]
    assert over and all(c["ids"] for c in over)
    assert rep["checks"][0]["severity"] == "danger"  # worst first
    assert rep["summary"]["danger"] >= len(over)


def test_hoist_rating_with_dynamic_factor(rigged):
    call(rigged, "set_limits", values={"dynamic_factor": 6.0})
    rep = call(rigged, "rigging_report", save_csv=False)
    assert any("over the 2,000 lb hoist rating" in c["text"] for c in rep["checks"])


def test_referenced_loads_appear_as_their_own_points(rigged):
    rep = call(rigged, "rigging_report", save_csv=False)
    p = rows_by_point(rep)
    assert p["PA-L"]["load"] == 1850 and p["PA-L"]["source"] == "referenced"
    assert "from a referenced file" in p["PA-L"]["notes"]
    # both beams are upstage of the PA: no bridle is possible, and the report says why
    assert p["PA-L"]["steel"]["type"] == "no steel"
    assert any("steel on one side only" in c["text"] and p["PA-L"]["id"] in c["ids"] for c in rep["checks"])


def test_markout_walks_rows_without_doubling_back(rigged):
    rep = call(rigged, "rigging_report", save_csv=False)
    mk = rep["markout"]
    assert [m["n"] for m in mk] == list(range(1, len(mk) + 1))
    first_row = [m["point"] for m in mk[:2]]
    assert set(first_row) == {"PA-L", "PA-R"}  # downstage-most first
    lx1 = [m["point"] for m in mk if m["point"] in ("1", "2", "3")]
    assert lx1 in (["1", "2", "3"], ["3", "2", "1"])  # one sweep across the row
    assert any(m["updown"] == "20'-0\" US" for m in mk)


def test_csv_and_revisions(rigged, fake_show):
    rep = call(rigged, "rigging_report", save_csv=True)
    text = open(rep["csv_path"], encoding="utf-8").read()
    assert text.splitlines()[0].startswith("Point,Kind,Position,X,Y,Hook Z")
    assert "dead hang (Beam A)" in text
    call(rigged, "save_rigging_revision", label="Advance v1")
    hoist1 = rows_by_point(rep)["1"]["id"]
    call(rigged, "move_objects", ids=[hoist1], dx="2'", dy=0)
    again = call(rigged, "rigging_report", save_csv=False)
    assert again["changes_since"] == "Advance v1"
    assert [m["point"] for m in again["changes"]["moved"]] == ["1"]


# ---- 4. the situations ------------------------------------------------------------------------


def test_dwg_import_reports_what_arrived(server, tmp_path):
    dwg = tmp_path / "venue.dwg"
    dwg.write_bytes(b"AC1032")
    r = call(server, "import_dwg", path=str(dwg))
    assert r["new_layers"] == ["Venue DWG"] and r["new_classes"] == ["A-STEEL"] and r["new_objects"] == 2
    with pytest.raises(ToolError, match="No file"):
        call(server, "import_dwg", path=str(tmp_path / "missing.dwg"))
    sv = call(server, "survey_drawing")
    assert any("DWG" in s for s in sv["situation"])


def test_wrong_scale_is_found_and_fixed(server, tmp_path):
    dwg = tmp_path / "venue.dwg"
    dwg.write_bytes(b"AC1032")
    call(server, "import_dwg", path=str(dwg))
    steel = [o for o in call(server, "list_objects", layer="Venue DWG")["objects"]]
    # the two DWG beams should be 20' apart, but the DWG was in mm: they're 6000 "inches" apart
    chk = call(server, "check_scale", a=steel[0]["id"], b=steel[1]["id"], should_be="20'")
    assert not chk["ok"] and chk["hint"] == "Looks like inches vs mm"
    call(server, "scale_objects", ids=[o["id"] for o in steel], factor=chk["factor"])
    assert call(server, "check_scale", a=steel[0]["id"], b=steel[1]["id"], should_be="20'")["ok"]


def test_department_visibility_in_vectorworks(server, fake_show):
    call(server, "show_departments", visibility={"venue": "gray", "scenic": "hidden"})
    layers = {l.name: l.visibility for l in fake_show.DOC.layers}
    assert layers["Venue Steel"] == 2 and layers["Scenic"] == -1 and layers["Lighting"] == 0


def test_bridle_tools(server):
    b = call(server, "design_bridle", span="20'", to_apex_from_a="8'", beam_a_height="100'", beam_b_height="100'", apex_height="90'", load=2000)
    assert b["left"]["tension"] == pytest.approx(1537, abs=1) and b["left"]["length_text"] == "12'-9 11/16\""  # 12.806 ft to the 1/16"
    assert sum(b["left"]["steel_suggestion_ft"]) <= 12.806
    flat = call(server, "design_bridle", span="30'", to_apex_from_a="15'", beam_a_height="100'", beam_b_height="100'", apex_height="95'", load=2000)
    assert any("over 120" in c for c in flat["checks"])
    a = call(server, "bridle_from_legs", leg_a="15'", leg_b="17'-6\"", span="20'")
    assert a["reaches"] and a["from_a_text"] == "7'-11 5/8\""


def test_truss_loads_tool(server):
    r = call(server, "truss_loads", pick_points=["0'", "20'", "40'"], weight_per_length=25 / 12)
    assert r["estimate"] and r["reactions"][1] == pytest.approx(625, abs=1) and "estimate" in r["warning"]


def test_flat_bridle_is_flagged_in_the_report(rigged):
    # Steel only 2' above the hooks on LX2: a 20' spread with a 2' drop is a ~157 degree bridle.
    call(rigged, "set_limits", values={"high_steel": "52'"})
    rep = call(rigged, "rigging_report", save_csv=False)
    p = rows_by_point(rep)
    assert p["4"]["steel"]["bridle"]["angle"] == pytest.approx(157.4, abs=0.1)
    assert any(c["severity"] == "danger" and "included angle 157" in c["text"] and p["4"]["id"] in c["ids"] for c in rep["checks"])
