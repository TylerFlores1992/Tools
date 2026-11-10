"""Reading a drawing out to JSON beside it, for working on it with Vectorworks closed."""

import json
from pathlib import Path

import pytest

from vwmcp import config, readout
from vwmcp.server import build_server

from test_roundtrip import call


@pytest.fixture
def server(fake_vw):
    return build_server(config.load())


def test_read_out_writes_every_plugin_object_symbol_and_shape_in_inches(server, fake_vw, tmp_path):
    call(server, "place_lighting_device", position=["10'", "20'"], symbol="Source Four 26", fields={"Channel": "101"})
    call(server, "draw_rectangle", corner1=[0, 0], corner2=["40'", "30'"], name="Stage")
    call(server, "add_text", position=[0, 0], text="DSL")
    fake_vw.DOC.path = str(tmp_path / "Show.vwx")
    r = call(server, "read_out")
    assert r["saved"] == str(tmp_path / "Show.rigread.json")
    data = json.loads(Path(r["saved"]).read_text())
    assert data["readout"] == 1 and data["units"] == "in"
    lds = [o for o in data["objects"] if o.get("plugin") == "Lighting Device"]
    ld = next(o for o in lds if o["at"][:2] == [120, 240])
    assert ld["fields"]["Channel"] == "101" and "rot" in ld
    stage = next(o for o in data["objects"] if o.get("name") == "Stage")
    assert stage["closed"] and [480, 360] in stage["pts"]
    assert not any(o["t"] == "text" for o in data["objects"]) and data["skipped"]["text and dimensions"] >= 1
    assert r["lighting_devices"] >= 1 and r["bytes"] == len(Path(r["saved"]).read_bytes())


def test_without_a_saved_path_it_goes_to_the_readouts_folder(server, fake_vw, tmp_path):
    fake_vw.DOC.path = ""
    r = call(server, "read_out")
    assert r["saved"].startswith(str(config.load().home / "readouts"))


def test_a_path_that_is_not_there_is_refused(server):
    from test_roundtrip import ToolError

    with pytest.raises(ToolError, match="No file at"):
        call(server, "read_out", path="C:/nope/Show.vwx")


def test_fit_keeps_plugin_objects_and_drops_the_biggest_shapes_first():
    objs = [{"plugin": "Lighting Device", "at": [0, 0, 0]} for _ in range(5)]
    objs += [{"t": "polygon", "pts": [[i, i]] * n} for i, n in enumerate([2, 400, 3, 2000])]
    full = {"readout": 1, "objects": objs}
    body, trimmed = readout.fit(full, limit=len(json.dumps(full, separators=(",", ":"))) - 100)
    out = json.loads(body)
    assert trimmed == 1 and out["trimmed"] == 1
    assert sum("plugin" in o for o in out["objects"]) == 5
    assert max(len(o.get("pts", [])) for o in out["objects"]) == 400
    body, trimmed = readout.fit(full)
    assert trimmed == 0 and "trimmed" not in json.loads(body)


def test_matching_the_open_document_and_finding_files(tmp_path):
    assert readout.same_document("CFF-26_041426_v2025.vwx", Path("C:/x/CFF-26_041426_v2025.vwx"))
    assert readout.same_document("Air Pro - Self Climber (09.07.22) v2026.vwx", Path("Air Pro - Self Climber (09.07.22).vwx"))
    assert not readout.same_document("Other.vwx", Path("Show.vwx"))
    (tmp_path / "VW Backup").mkdir()
    (tmp_path / "Show.vwx").write_text("x")
    (tmp_path / "VW Backup" / "Show-Backup-2022.vwx").write_text("x")
    (tmp_path / "Old-Backup-20220830.vwx").write_text("x")
    assert [p.name for p in readout.vwx_files(tmp_path)] == ["Show.vwx"]
    assert readout.needs_read(tmp_path / "Show.vwx")
    readout.target_for(tmp_path / "Show.vwx").write_text("{}")
    assert not readout.needs_read(tmp_path / "Show.vwx")


def test_watch_folders_keeps_only_real_folders(tmp_path):
    (tmp_path / "a").mkdir()
    got = readout.watch_folders(f'{tmp_path / "a"}; "{tmp_path / "missing"}";;')
    assert got == [tmp_path / "a"]


def test_quiet_needs_both_an_idle_pc_and_no_recent_claude():
    assert readout.quiet(900, 900)
    assert not readout.quiet(30, 900)  # someone is at the keyboard
    assert not readout.quiet(900, 30)  # Claude just used Vectorworks
    assert not readout.quiet(None, 900)  # can't tell: count it as busy


def test_watcher_reads_out_new_files_only_when_quiet(fake_vw, tmp_path, monkeypatch):
    import asyncio

    vwx = tmp_path / "Show.vwx"
    vwx.write_bytes(b"x")
    monkeypatch.setenv("VWMCP_WATCH", str(tmp_path))
    monkeypatch.setattr(readout, "open_in_vectorworks", lambda p: setattr(fake_vw.DOC, "path", str(p)) or setattr(fake_vw.DOC, "fname", p.name))
    srv = build_server(config.load())
    monkeypatch.setattr(readout, "idle_seconds", lambda: 30.0)  # someone is working
    assert asyncio.run(srv.watch_once(now=10_000.0)) == []
    assert readout.pending([tmp_path]) == [vwx]
    monkeypatch.setattr(readout, "idle_seconds", lambda: 3600.0)
    done = asyncio.run(srv.watch_once(now=10_000.0))
    assert done and done[0].get("saved") == str(tmp_path / "Show.rigread.json"), done
    assert readout.pending([tmp_path]) == []


def test_a_converted_older_file_counts_as_the_same_document():
    from pathlib import Path

    p = Path("C:/Dropbox/Rig Studio/CFF/CFF-26_041426_v2025.vwx")
    assert readout.same_document("CFF-26_041426_v2025_v2026.vwx", p)
    assert readout.same_document("CFF-26_041426_v2025.vwx", p)
    assert not readout.same_document("Claude connector.vwx", p)
    assert not readout.same_document("CFF-26_041426_v2025_backup.vwx", p)


def test_read_out_draws_what_is_inside_groups_and_symbols(server, fake_vw, tmp_path):
    """Symbols are drawn from their definition, moved and turned to where they sit; a symbol with a
    3D part gives its 3D part (a block with bottom, top and fill), not its 2D plan lines; groups
    give their members; hidden layers say so."""
    vs = fake_vw
    d = vs.DOC
    # A symbol: a 2D plan rectangle plus a 3D box 10" x 4" from 0 to 36" high, drawn about its origin.
    sym = vs._Obj(16, name="Podium", w=10.0, h=4.0, members=[])
    plan = vs._Obj(3, pts=[(-5.0, -2.0), (5.0, 2.0)], parent_obj=sym, layer=None)
    box = vs._Obj(5, pts=[(0.0, 0.0), (10.0, 0.0), (10.0, 4.0), (0.0, 4.0)], closed=True, is3d=True, zc=18.0, dz=36.0, parent_obj=sym, layer=None)
    box.attrs["fill_rgb"] = (65535, 0, 0)
    sym.members += [plan, box]
    d.resources["Podium"] = sym
    vs.Symbol("Podium", (100.0, 0.0), 90.0)
    # A group of two lines.
    vs.MoveTo((0.0, 50.0)); vs.LineTo((20.0, 50.0)); vs.SetSelect(d.last)
    vs.MoveTo((0.0, 60.0)); vs.LineTo((20.0, 60.0)); vs.SetSelect(d.last)
    vs.Group()
    d.layers[0].visibility = -1
    d.path = str(tmp_path / "Set.vwx")
    r = call(server, "read_out")
    data = json.loads(Path(r["saved"]).read_text())
    objs = data["objects"]
    inside = [o for o in objs if o.get("in") == "Podium"]
    assert len(inside) == 1, inside  # the 3D box only; its 2D plan rectangle is left out
    blk = inside[0]
    assert blk["z"] == [0, 36] and blk["fill"] == "#ff0000" and blk["closed"]
    # turned 90 degrees about the insertion point and moved to (100, 0): (10, 4) lands on (96, 10)
    assert [96, 10] in blk["pts"] and [100, 0] in blk["pts"]
    assert any(o.get("symbol") == "Podium" and o["at"][:2] == [100, 0] for o in objs)
    lines = [o for o in objs if o["t"] == "line"]
    assert {tuple(map(tuple, o["pts"])) for o in lines} >= {((0, 50), (20, 50)), ((0, 60), (20, 60))}
    assert data["layers"][0]["visible"] is False


def test_a_very_detailed_symbol_comes_as_one_block(server, fake_vw, tmp_path):
    vs = fake_vw
    d = vs.DOC
    person = vs._Obj(16, name="Person", w=20.0, h=10.0, members=[])
    for i in range(200):  # a figure drawn with 200 little lines
        person.members.append(vs._Obj(2, pts=[(0.0, i * 0.1), (1.0, i * 0.1)], parent_obj=person, layer=None))
    d.resources["Person"] = person
    vs.Symbol("Person", (50.0, 50.0), 0.0)
    d.path = str(tmp_path / "Crowd.vwx")
    r = call(server, "read_out", max_objects=1000)
    data = json.loads(Path(r["saved"]).read_text())
    from_person = [o for o in data["objects"] if o.get("in") == "Person"]
    assert len(from_person) == 1 and from_person[0]["simplified"] and from_person[0]["closed"]


def test_a_scaled_symbol_is_drawn_at_its_scale(server, fake_vw, tmp_path):
    """DWG blocks come in as scaled symbols (seen on CFF-26: parts landed 15 miles away unscaled)."""
    vs = fake_vw
    d = vs.DOC
    sym = vs._Obj(16, name="Sign", w=1000.0, h=1000.0, members=[])
    sym.members.append(vs._Obj(3, pts=[(0.0, 0.0), (1000.0, 500.0)], parent_obj=sym, layer=None))
    d.resources["Sign"] = sym
    vs.Symbol("Sign", (10.0, 10.0), 0.0)
    d.last.scale_type, d.last.sx, d.last.sy, d.last.w, d.last.h = 2, 0.01, 0.01, 10.0, 10.0
    d.path = str(tmp_path / "Plan.vwx")
    r = call(server, "read_out")
    rect = next(o for o in json.loads(Path(r["saved"]).read_text())["objects"] if o.get("in") == "Sign")
    assert [20, 15] in rect["pts"] and [10, 10] in rect["pts"]


def test_symbol_positions_use_the_same_origin_as_the_shapes(server, fake_vw, tmp_path):
    """A drawing with a user origin: symbols and their parts land with the shapes, not off by it."""
    vs = fake_vw
    d = vs.DOC
    d.origin = (-573.0, 910.0)
    sym = vs._Obj(16, name="Box", w=10.0, h=10.0, members=[])
    sym.members.append(vs._Obj(3, pts=[(-5.0, -5.0), (5.0, 5.0)], parent_obj=sym, layer=None))
    d.resources["Box"] = sym
    vs.Symbol("Box", (100.0, 50.0), 0.0)
    d.path = str(tmp_path / "Origin.vwx")
    objs = json.loads(Path(call(server, "read_out")["saved"]).read_text())["objects"]
    inst = next(o for o in objs if o.get("symbol") == "Box")
    part = next(o for o in objs if o.get("in") == "Box")
    assert inst["at"][:2] == [100, 50] and [95, 45] in part["pts"] and [105, 55] in part["pts"]
