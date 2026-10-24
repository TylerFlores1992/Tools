"""End-to-end: MCP tool -> job file -> bridge (strict fake vs) -> result file -> tool result."""

import asyncio
import json
import math

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
def server(fake_vw):
    return build_server(config.load())


def by_name(server, name):
    return next(o for o in call(server, "list_objects", limit=500)["objects"] if o["name"] == name)


def test_tools_are_listed(server):
    names = {t.name for t in asyncio.run(server.list_tools())}
    for n in ("ping", "batch", "undo_last", "draw_line", "measure_distance", "move_objects", "get_lighting_devices",
              "place_lighting_device", "set_record_fields", "snapshot", "screenshot", "vs_lookup", "add_dimension"):
        assert n in names, n
    assert "run_python" not in names  # off unless VWMCP_ALLOW_EXEC=1
    assert "end_session" not in names  # only in session mode


def test_ping_reports_version_units_and_platform(server):
    r = call(server, "ping")
    assert r["document"] == "Untitled Plot.vwx"
    assert r["version"].startswith("2026")
    assert r["platform"] == "Windows"
    assert r["units"]["unit_name"] == '"' and r["units"]["units_per_inch"] == 1.0


def test_lengths_can_be_written_like_a_rigger(server):
    r = call(server, "draw_line", start=["0", "0"], end=["12'-6\"", 0], name="pipe")
    assert r["length"] == pytest.approx(150)
    c = call(server, "draw_circle", center=[0, "10 ft"], radius="6\"")
    assert c["width"] == pytest.approx(12) and c["geometry"]["center"] == [0, 120]
    with pytest.raises(ToolError, match="Can't read radius"):
        call(server, "draw_circle", center=[0, 0], radius="six inches")


def test_unnamed_objects_have_empty_names_not_none(server):
    r = call(server, "draw_line", start=[0, 0], end=[1, 0])
    assert r["name"] == ""  # Vectorworks says "none"; the bridge mustn't pass that on


def test_shapes_and_measurements(server):
    rect = call(server, "draw_rectangle", corner1=[10, 0], corner2=[0, 5], cls="Stage")
    assert rect["bbox"] == [[0, 0], [10, 5]] and rect["area"] == pytest.approx(50) and rect["perimeter"] == pytest.approx(30)
    assert "Stage" in call(server, "get_document_info")["classes"]
    oval = call(server, "draw_circle", center=[0, 0], radius=2)
    assert oval["area"] == pytest.approx(math.pi * 4) and oval["perimeter"] == pytest.approx(4 * math.pi, rel=1e-6)
    tri = call(server, "draw_polygon", points=[[0, 0], [4, 0], [4, 3]], closed=True)
    assert tri["area"] == pytest.approx(6) and tri["length"] == pytest.approx(12)
    open_poly = call(server, "draw_polygon", points=[[0, 0], [4, 0], [4, 3]], closed=False)
    assert open_poly["length"] == pytest.approx(7) and "area" not in open_poly
    text = call(server, "add_text", position=[1, 1], text="DS edge", size_pt=14)
    assert text["geometry"]["text"] == "DS edge"


@pytest.mark.parametrize("start,sweep", [(0, 90), (180, 180), (30, 40), (100, 300), (-45, -60)])
def test_arcs_read_back_center_radius_and_length(server, start, sweep):
    a = call(server, "draw_arc", center=[5, -3], radius=10, start_angle=start, sweep_angle=sweep)
    g = a["geometry"]
    assert g["center"] == pytest.approx([5, -3])
    assert g["radius"] == pytest.approx(10, rel=1e-3)
    assert a["length"] == pytest.approx(math.radians(abs(sweep)) * 10, rel=1e-3)


def test_layers_dimensions_walls(server):
    call(server, "draw_line", start=[0, 0], end=[1, 0], layer="Deck")
    info = call(server, "get_document_info")
    assert any(l["name"] == "Deck" for l in info["layers"])
    assert info["active_layer"] == "Design Layer-1"  # drawing on a layer doesn't steal focus
    assert call(server, "list_objects", layer="Deck")["count"] == 1
    d = call(server, "add_dimension", start=[0, 0], end=["10'", 0], offset="1'", direction="horizontal")
    assert d["type"] == "dimension"
    w = call(server, "draw_wall", start=[0, 0], end=["20'", 0], thickness="6\"", height="10'")
    assert w["type"] == "wall"


def test_measure_distance(server):
    a = call(server, "draw_rectangle", corner1=[0, 0], corner2=[2, 2])
    b = call(server, "draw_rectangle", corner1=[10, 0], corner2=[12, 2])
    d = call(server, "measure_distance", a=a["id"], b=b["id"])
    assert d["center_distance"] == pytest.approx(10) and d["bbox_gap"] == pytest.approx(8)
    assert call(server, "measure_distance", a=[0, 0], b=["3\"", "4\""])["center_distance"] == pytest.approx(5)


def test_move_rotate_duplicate_delete(server):
    r = call(server, "draw_line", start=[0, 0], end=[10, 0])
    m = call(server, "move_objects", ids=[r["id"]], dx="5\"", dy=5)["objects"][0]
    assert m["geometry"]["start"] == [5, 5]
    rot = call(server, "rotate_object", id=r["id"], angle=90, center=[5, 5])
    assert rot["geometry"]["end"] == pytest.approx([5, 15], abs=1e-6)
    dup = call(server, "duplicate_objects", ids=[r["id"]], dx="1'", dy=0)["objects"][0]
    assert dup["id"] != r["id"] and dup["geometry"]["start"] == pytest.approx([17, 5])
    call(server, "delete_objects", ids=[r["id"], dup["id"]])
    with pytest.raises(ToolError, match="No object"):
        call(server, "get_object", id=r["id"])


def test_move_is_all_or_nothing(server):
    r = call(server, "draw_line", start=[0, 0], end=[1, 0])
    with pytest.raises(ToolError, match="No object"):
        call(server, "move_objects", ids=[r["id"], "{NOPE}"], dx=5, dy=0)
    assert call(server, "get_object", id=r["id"])["geometry"]["start"] == [0, 0]


def test_names_must_be_unique(server):
    call(server, "draw_line", start=[0, 0], end=[1, 0], name="pipe")
    with pytest.raises(ToolError, match="already named"):
        call(server, "draw_line", start=[0, 0], end=[1, 0], name="pipe")


def test_selection_both_ways(server, fake_vw):
    r = call(server, "draw_line", start=[0, 0], end=[1, 1])
    assert call(server, "get_selection")["count"] == 0
    fake_vw.GetObjectByUuid(r["id"]).selected = True
    assert call(server, "get_selection")["objects"][0]["id"] == r["id"]
    deck = by_name(server, "Deck")
    assert call(server, "select_objects", ids=[deck["id"]], zoom=True)["selected"] == 1
    assert "Fit To Objects" in fake_vw.DOC.menu_calls


def test_attributes_and_groups(server, fake_vw):
    a = call(server, "draw_rectangle", corner1=[0, 0], corner2=[1, 1])
    b = call(server, "draw_rectangle", corner1=[2, 0], corner2=[3, 1])
    call(server, "set_attributes", ids=[a["id"]], pen_color="#ff8000", line_weight_mils=14, fill="none")
    h = fake_vw.GetObjectByUuid(a["id"])
    assert h.attrs == {"pen": (65535, 32896, 0), "lw": 14, "fpat": 0}
    with pytest.raises(ToolError, match="#ff8800"):
        call(server, "set_attributes", ids=[a["id"]], pen_color="orange")
    g = call(server, "group_objects", ids=[a["id"], b["id"]], name="Steps")
    assert g["type"] == "group" and g["name"] == "Steps" and g["width"] == pytest.approx(3)


def test_symbols(server):
    syms = call(server, "list_symbols")
    assert {"name": "Truss 20ft", "folder": "Rigging"} in syms["symbols"]
    s = call(server, "place_symbol", symbol="Truss 20ft", position=[0, "20'"])
    assert s["symbol"] == "Truss 20ft" and s["width"] == pytest.approx(240) and s["location"] == [0, 240]
    with pytest.raises(ToolError, match="No symbol named"):
        call(server, "place_symbol", symbol="Nope", position=[0, 0])


def test_spotlight_devices(server):
    r = call(server, "get_lighting_devices")
    assert r["count"] == 4
    assert sorted(d["fields"]["Channel"] for d in r["devices"]) == ["101", "102", "103", "104"]
    dev = r["devices"][0]
    out = call(server, "set_record_fields", id=dev["id"], record="Lighting Device", values={"Channel": "201", "Color": "L201"})
    assert out["fields"]["Channel"] == "201"
    assert call(server, "get_object", id=dev["id"])["fields"]["Color"] == "L201"
    with pytest.raises(ToolError, match="No field 'Chanel'"):
        call(server, "set_record_fields", id=dev["id"], record="Lighting Device", values={"Chanel": "1"})
    d = call(server, "measure_distance", a=r["devices"][0]["id"], b=r["devices"][1]["id"])
    assert d["center_distance"] == pytest.approx(60)  # 5' spacing on the pipe


def test_universe_and_address_are_written_together(server):
    dev = call(server, "get_lighting_devices")["devices"][0]
    out = call(server, "set_record_fields", id=dev["id"], record="Lighting Device", values={"Universe": "2", "DMX Address": "101"})
    assert out["fields"]["UniverseAddress"] == "2/101"


def test_place_lighting_device(server):
    d = call(server, "place_lighting_device", position=["0", "10'"], symbol="Source Four 26", fields={"Channel": "150"})
    assert d["plugin"] == "Lighting Device" and d["channel"] == "150" and d["location"] == [0, 120]
    with pytest.raises(ToolError, match="list_symbols"):
        call(server, "place_lighting_device", position=[0, 0], symbol="Made Up Fixture")


def test_batch_is_one_round_trip_and_one_undo(server, fake_vw):
    before = len(fake_vw.DOC.objects)
    r = call(server, "batch", steps=[
        {"op": "draw_rectangle", "args": {"corner1": [0, 0], "corner2": ["30'", "20'"], "name": "Big deck"}},
        {"op": "add_text", "args": {"position": ["14'", "10'"], "text": "STAGE"}},
        {"op": "add_dimension", "args": {"start": [0, 0], "end": ["30'", 0], "offset": "-2'"}},
    ])
    assert len(r["results"]) == 3 and len(fake_vw.DOC.objects) == before + 3
    assert call(server, "undo_last")["undone"].startswith("Undid: batch")
    assert len(fake_vw.DOC.objects) == before


def test_batch_failure_says_which_step(server, fake_vw):
    with pytest.raises(ToolError, match="Step 2 \\(place_symbol\\) failed"):
        call(server, "batch", steps=[
            {"op": "draw_line", "args": {"start": [0, 0], "end": [1, 0]}},
            {"op": "place_symbol", "args": {"symbol": "Nope", "position": [0, 0]}},
        ])
    with pytest.raises(ToolError, match="can't run in a batch"):
        call(server, "batch", steps=[{"op": "run_python", "args": {"code": "1"}}])


def test_undo_last_reverses_moves_rotations_fields_and_creations(server):
    line = call(server, "draw_line", start=[0, 0], end=[10, 0])
    call(server, "move_objects", ids=[line["id"]], dx=3, dy=4)
    call(server, "rotate_object", id=line["id"], angle=45)
    dev = call(server, "get_lighting_devices")["devices"][0]
    call(server, "set_record_fields", id=dev["id"], record="Lighting Device", values={"Channel": "999"})

    call(server, "undo_last")  # the field edit
    assert call(server, "get_object", id=dev["id"])["fields"]["Channel"] == dev["fields"]["Channel"]
    call(server, "undo_last")  # the rotation
    call(server, "undo_last")  # the move
    back = call(server, "get_object", id=line["id"])["geometry"]
    assert back["start"] == pytest.approx([0, 0], abs=1e-9) and back["end"] == pytest.approx([10, 0], abs=1e-9)
    call(server, "undo_last")  # the creation
    with pytest.raises(ToolError, match="No object"):
        call(server, "get_object", id=line["id"])
    with pytest.raises(ToolError, match="Nothing of Claude's to undo"):
        call(server, "undo_last")


def test_undo_stops_at_things_it_cant_undo(server):
    r = call(server, "draw_line", start=[0, 0], end=[1, 0])
    call(server, "delete_objects", ids=[r["id"]])
    with pytest.raises(ToolError, match="Ctrl\\+Z"):
        call(server, "undo_last")


def test_vs_lookup(server):
    r = call(server, "vs_lookup", query="hmove")
    assert r["functions"][0]["name"] == "HMove"


def test_snapshot_svg(server):
    call(server, "add_text", position=[10, 10], text="Stage")
    snap = call(server, "snapshot")
    assert snap["svg"].startswith("<svg") and "Stage" in snap["svg"] and "ch 101" in snap["svg"]


def test_screenshot_explains_itself_without_windows(server):
    with pytest.raises(ToolError, match="snapshot instead"):
        asyncio.run(server.call_tool("screenshot", {}))


def test_stale_jobs_are_dropped_not_run_late(server, home, fake_vw):
    import vwmcp_bridge as bridge
    from vwmcp.jobs import write_json_atomic

    (home / "jobs").mkdir(exist_ok=True)
    write_json_atomic(home / "jobs" / "old.json", {"id": "old", "op": "draw_line", "args": {"start": [0, 0], "end": [1, 0]}, "created": 0, "ttl": 35})
    before = len(fake_vw.DOC.objects)
    bridge.run_pending()
    res = json.loads((home / "results" / "old.json").read_text())
    assert res["ok"] is False and "waited too long" in res["error"] and len(fake_vw.DOC.objects) == before


def test_timeout_when_vectorworks_is_absent(monkeypatch, home):
    monkeypatch.setenv("VWMCP_TIMEOUT", "0.5")
    server = build_server(config.load())
    with pytest.raises(ToolError, match="never picked up"):
        call(server, "ping")
    assert not list((home / "jobs").glob("*.json"))


def test_run_python_needs_both_switches(monkeypatch, home, fake_vw):
    monkeypatch.setenv("VWMCP_ALLOW_EXEC", "1")
    server = build_server(config.load())
    with pytest.raises(ToolError, match="disabled"):
        call(server, "run_python", code="result = vs.GetFName()")
    (home / "allow_exec").write_text("yes")
    assert call(server, "run_python", code="result = vs.GetFName()")["result"] == "Untitled Plot.vwx"


def test_strict_fake_catches_signature_mistakes(fake_vw):
    with pytest.raises(fake_vw.ScriptErrors, match="takes 1 arguments"):
        fake_vw.MoveTo(1.0, 2.0)  # two numbers where the reference takes one point
    with pytest.raises(fake_vw.ScriptErrors, match="one \\(x, y\\) point"):
        fake_vw.MoveTo(5.0)
    with pytest.raises(fake_vw.ScriptErrors, match="takes 3 arguments"):
        fake_vw.HMove(None, 1)


def test_undo_reverses_a_batch_in_reverse_order(server, fake_vw):
    # Create, move, then rotate inside one batch: undoing must rotate back, move back, then
    # delete. In any other order a step targets something already gone or misplaced.
    before = len(fake_vw.DOC.objects)
    r = call(server, "batch", steps=[{"op": "draw_line", "args": {"start": [0, 0], "end": [10, 0], "name": "temp"}}])
    lid = r["results"][0]["id"]
    call(server, "batch", steps=[
        {"op": "move_objects", "args": {"ids": [lid], "dx": 5, "dy": 0}},
        {"op": "rotate_object", "args": {"id": lid, "angle": 90, "center": [5, 0]}},
    ])
    call(server, "undo_last")
    g = call(server, "get_object", id=lid)["geometry"]
    assert g["start"] == pytest.approx([0, 0], abs=1e-9) and g["end"] == pytest.approx([10, 0], abs=1e-9)
    call(server, "undo_last")
    assert len(fake_vw.DOC.objects) == before


def test_readme_states_the_real_tool_count(monkeypatch):
    # Counts come from data: the README's number is checked against the server itself.
    from pathlib import Path

    readme = (Path(__file__).resolve().parent.parent / "README.md").read_text(encoding="utf-8")
    base = len(asyncio.run(build_server(config.load()).list_tools()))
    monkeypatch.setenv("VWMCP_TRIGGER", "session")
    monkeypatch.setenv("VWMCP_ALLOW_EXEC", "1")
    full = len(asyncio.run(build_server(config.load()).list_tools()))
    assert f"{base} tools ({full} with the optional ones)" in readme
