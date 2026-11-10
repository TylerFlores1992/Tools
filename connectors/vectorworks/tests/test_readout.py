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
    for i in range(2600):  # a figure drawn with 2,600 little lines (past DETAIL_CAP)
        person.members.append(vs._Obj(2, pts=[(0.0, i * 0.1), (1.0, i * 0.1)], parent_obj=person, layer=None))
    d.resources["Person"] = person
    vs.Symbol("Person", (50.0, 50.0), 0.0)
    d.path = str(tmp_path / "Crowd.vwx")
    r = call(server, "read_out", max_objects=4000)
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
    # Points inside a definition read back from the internal origin (real Vectorworks, measured).
    sym.members.append(vs._Obj(3, pts=[(-5.0 + 573.0, -5.0 - 910.0), (5.0 + 573.0, 5.0 - 910.0)], parent_obj=sym, layer=None))
    d.resources["Box"] = sym
    vs.Symbol("Box", (100.0, 50.0), 0.0)
    d.path = str(tmp_path / "Origin.vwx")
    objs = json.loads(Path(call(server, "read_out")["saved"]).read_text())["objects"]
    inst = next(o for o in objs if o.get("symbol") == "Box")
    part = next(o for o in objs if o.get("in") == "Box")
    assert inst["at"][:2] == [100, 50] and [95, 45] in part["pts"] and [105, 55] in part["pts"]


def test_a_converted_copy_is_told_apart_from_the_file():
    p = Path("C:/Dropbox/Rig Studio/CFF/CFF-26_041426_v2025.vwx")
    assert readout.is_converted_copy("CFF-26_041426_v2025_v2026.vwx", p)
    assert readout.is_converted_copy("CFF-26_041426_v2025 v2026.vwx", p)
    assert not readout.is_converted_copy("CFF-26_041426_v2025.vwx", p)  # the file itself
    assert not readout.is_converted_copy("Claude connector.vwx", p)


def test_after_reading_a_converted_file_its_copy_is_closed(fake_vw, tmp_path, monkeypatch):
    from vwmcp import server as server_mod

    closed = []

    class Trig:
        def fire(self, job_created=None):
            pass

        def close_copy(self, name):
            closed.append(name)
            return True

    vwx = tmp_path / "CFF_v2025.vwx"
    vwx.write_bytes(b"x")

    def opens_as_copy(p):
        fake_vw.DOC.path = ""
        fake_vw.DOC.fname = p.stem + "_v2026.vwx"

    monkeypatch.setattr(readout, "open_in_vectorworks", opens_as_copy)
    monkeypatch.setattr(server_mod, "make_trigger", lambda s: Trig())
    real_sleep = server_mod.asyncio.sleep
    monkeypatch.setattr(server_mod.asyncio, "sleep", lambda s: real_sleep(0))
    srv = build_server(config.load())
    r = call(srv, "read_out", path=str(vwx))
    assert r["saved"] == str(tmp_path / "CFF_v2025.rigread.json")
    assert closed == ["CFF_v2025_v2026.vwx"] and r["closed_copy"] is True


def test_a_file_already_open_is_never_closed(fake_vw, tmp_path, monkeypatch):
    from vwmcp import server as server_mod

    closed = []

    class Trig:
        def fire(self, job_created=None):
            pass

        def close_copy(self, name):
            closed.append(name)
            return True

    vwx = tmp_path / "CFF_v2025.vwx"
    vwx.write_bytes(b"x")
    fake_vw.DOC.fname = "CFF_v2025_v2026.vwx"  # the user opened it themselves
    monkeypatch.setattr(server_mod, "make_trigger", lambda s: Trig())
    srv = build_server(config.load())
    call(srv, "read_out", path=str(vwx))
    assert closed == []


# ---- read-out requests from Rig Studio (through Dropbox) ----


def test_a_request_names_its_drawing_and_job(tmp_path):
    (tmp_path / "CFF_v2025.vwx").write_bytes(b"x")
    (tmp_path / "CFF.vwx").write_bytes(b"x")  # a shorter name that also matches: the longest wins
    (tmp_path / "CFF_v2025.job42.rigrequest.json").write_text("{}")
    (tmp_path / "Ghost.job7.rigrequest.json").write_text("{}")
    got = {r.name: (v.name if v else None, j) for r, v, j in readout.requests([tmp_path])}
    assert got["CFF_v2025.job42.rigrequest.json"] == ("CFF_v2025.vwx", "job42")
    assert got["Ghost.job7.rigrequest.json"] == (None, "")
    # "Show.a.vwx" sorts before "Show.vwx": the longer name must still win, not the last one seen.
    (tmp_path / "Show.a.vwx").write_bytes(b"x")
    (tmp_path / "Show.vwx").write_bytes(b"x")
    (tmp_path / "Show.a.j9.rigrequest.json").write_text("{}")
    got = {r.name: (v.name if v else None, j) for r, v, j in readout.requests([tmp_path])}
    assert got["Show.a.j9.rigrequest.json"] == ("Show.a.vwx", "j9")


def test_dropbox_rig_studio_folder_is_found_from_dropbox_info(tmp_path, monkeypatch):
    box = tmp_path / "Dropbox"
    (box / "Rig Studio").mkdir(parents=True)
    info = tmp_path / "local" / "Dropbox"
    info.mkdir(parents=True)
    (info / "info.json").write_text(json.dumps({"personal": {"path": str(box)}}))
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))
    monkeypatch.delenv("APPDATA", raising=False)
    monkeypatch.delenv("VWMCP_REQUESTS", raising=False)
    monkeypatch.delenv("VWMCP_WATCH", raising=False)
    assert readout.request_folders() == [box / "Rig Studio"]


def _request_server(fake_vw, monkeypatch, tmp_path):
    monkeypatch.setenv("VWMCP_REQUESTS", str(tmp_path))
    monkeypatch.setattr(readout, "open_in_vectorworks", lambda p: setattr(fake_vw.DOC, "path", str(p)) or setattr(fake_vw.DOC, "fname", p.name))
    return build_server(config.load())


def test_a_request_is_read_out_and_answered_with_a_status_file(fake_vw, tmp_path, monkeypatch):
    import asyncio

    vwx = tmp_path / "Show.vwx"
    vwx.write_bytes(b"x")
    req = tmp_path / "Show.abc123.rigrequest.json"
    req.write_text("{}")
    srv = _request_server(fake_vw, monkeypatch, tmp_path)
    done = asyncio.run(srv.requests_once())
    assert done and done[0]["saved"] == str(tmp_path / "Show.rigread.json")
    status = json.loads((tmp_path / "Show.rigstatus.json").read_text())
    assert status["job"] == "abc123" and status["state"] == "done" and "objects" in status["message"]
    assert not req.exists()  # taken, so it never runs twice
    assert asyncio.run(srv.requests_once()) == []


def test_a_request_that_fails_says_why_in_the_status(fake_vw, tmp_path, monkeypatch):
    import asyncio

    vwx = tmp_path / "Show.vwx"
    vwx.write_bytes(b"x")
    (tmp_path / "Show.j1.rigrequest.json").write_text("{}")
    monkeypatch.setattr(readout, "open_in_vectorworks", lambda p: (_ for _ in ()).throw(RuntimeError("Vectorworks isn't running")))
    monkeypatch.setenv("VWMCP_REQUESTS", str(tmp_path))
    srv = build_server(config.load())
    asyncio.run(srv.requests_once())
    status = json.loads((tmp_path / "Show.rigstatus.json").read_text())
    assert status["state"] == "failed" and "Vectorworks isn't running" in status["message"]


# ---- real faces (ConvertTo3DPolys) ----


def _faces(mesh):
    """[[ (x, y, z) inches, ...], ...] from a read-out mesh."""
    v, f, q = mesh["v"], mesh["f"], mesh["q"]
    out, i = [], 0
    while i < len(f):
        n = f[i]
        out.append([(v[3 * j] * q, v[3 * j + 1] * q, v[3 * j + 2] * q) for j in f[i + 1 : i + 1 + n]])
        i += n + 1
    return out


def test_a_3d_object_comes_with_its_real_faces_placed_where_it_sits(server, fake_vw, tmp_path):
    vs = fake_vw
    d = vs.DOC
    sym = vs._Obj(16, name="Riser", w=10.0, h=4.0, members=[])
    box = vs._Obj(5, pts=[(0.0, 0.0), (10.0, 0.0), (10.0, 4.0), (0.0, 4.0)], closed=True, is3d=True, zc=18.0, dz=36.0, parent_obj=sym, layer=None)
    sym.members += [box]
    d.resources["Riser"] = sym
    vs.Symbol("Riser", (100.0, 0.0), 90.0)
    before = len(d.objects)
    d.path = str(tmp_path / "Set.vwx")
    r = call(server, "read_out")
    data = json.loads(Path(r["saved"]).read_text())
    part = next(o for o in data["objects"] if o.get("in") == "Riser")
    faces = _faces(part["mesh"])
    assert len(faces) == 6  # bottom, top and four sides
    corners = {p for f in faces for p in f}
    # turned 90 degrees and moved to (100, 0): (10, 4) at the top lands on (96, 10, 36)
    assert (96.0, 10.0, 36.0) in corners and (100.0, 0.0, 0.0) in corners
    assert len(part["mesh"]["v"]) == 8 * 3  # shared corners stored once
    assert len(d.objects) == before and d.converted >= 1  # each converted copy was deleted again
    assert data["faces"] >= 6


def test_a_small_read_out_stays_one_file():
    body, parts, trimmed = readout.split({"readout": 1, "objects": [{"t": "x", "mesh": {"q": 0.25, "v": [0, 0, 0], "f": []}}]}, "Show")
    assert parts == [] and trimmed == 0 and b'"mesh"' in body


def test_a_big_read_out_moves_its_faces_into_parts_that_each_fit():
    objs = [{"t": "extrude", "layer": "Set", "bbox": [0, 0, 1, 1], "mesh": {"q": 0.25, "v": list(range(3000)), "f": [3, 0, 1, 2] * 200}} for _ in range(40)]
    body, parts, trimmed = readout.split({"readout": 1, "objects": objs}, "Show", limit=60_000)
    main = json.loads(body)
    assert len(parts) >= 2 and all(len(p) <= 60_000 for p in parts) and len(body) <= 60_000
    assert main["mesh_parts"] == ["Show.rigmesh%d.json" % (i + 1) for i in range(len(parts))]
    got = {}
    for p in parts:
        got.update(json.loads(p)["meshes"])
    assert all("mesh" not in o for o in main["objects"])
    assert sorted(got) == sorted(str(o["mid"]) for o in main["objects"])  # every object finds its faces
    assert trimmed == 0


def test_parts_are_written_beside_the_read_out_and_old_extra_parts_removed(fake_vw, tmp_path, monkeypatch):
    stale = tmp_path / "Set.rigmesh9.json"
    (tmp_path / "Set.rigmesh1.json").write_text("old")
    stale.write_text("old")
    monkeypatch.setattr(readout, "LIMIT", 10**9)
    srv = build_server(config.load())
    fake_vw.DOC.path = str(tmp_path / "Set.vwx")
    r = call(srv, "read_out")
    assert r["mesh_parts"] == 0
    assert not (tmp_path / "Set.rigmesh1.json").exists()  # a small read-out leaves no parts behind
    assert stale.exists()  # not part of an unbroken run from 1: never touched


def test_a_camera_sized_symbol_is_drawn_part_by_part(server, fake_vw, tmp_path):
    """Symbols of a few hundred parts (cameras, peds, podiums) used to come as one box."""
    vs = fake_vw
    d = vs.DOC
    cam = vs._Obj(16, name="PED w OPERATOR", w=20.0, h=10.0, members=[])
    for i in range(300):
        cam.members.append(vs._Obj(2, pts=[(0.0, i * 0.1), (1.0, i * 0.1)], parent_obj=cam, layer=None))
    d.resources["PED w OPERATOR"] = cam
    vs.Symbol("PED w OPERATOR", (0.0, 0.0), 0.0)
    d.path = str(tmp_path / "Cams.vwx")
    data = json.loads(Path(call(server, "read_out")["saved"]).read_text())
    parts = [o for o in data["objects"] if o.get("in") == "PED w OPERATOR"]
    assert len(parts) == 300 and not any(o.get("simplified") for o in parts)


def test_parts_inside_a_symbol_get_the_user_origin_added_back(server, fake_vw, tmp_path):
    """Vectorworks measures points inside a symbol definition from the internal origin (measured on
    CFF-26: 327 of 356 symbols' parts sat one user origin away). The fake stores them that way here:
    a box drawn 0..10 x 0..4 about the symbol's origin reads back shifted by minus the user origin."""
    vs = fake_vw
    d = vs.DOC
    d.origin = (-573.26, 909.77)
    ox, oy = d.origin
    sym = vs._Obj(16, name="Riser", w=10.0, h=4.0, members=[])
    measured = [(0.0 - ox, 0.0 - oy), (10.0 - ox, 0.0 - oy), (10.0 - ox, 4.0 - oy), (0.0 - ox, 4.0 - oy)]
    box = vs._Obj(5, pts=measured, closed=True, is3d=True, zc=18.0, dz=36.0, parent_obj=sym, layer=None)
    sym.members += [box]
    d.resources["Riser"] = sym
    vs.Symbol("Riser", (100.0, 0.0), 90.0)
    d.path = str(tmp_path / "Set.vwx")
    data = json.loads(Path(call(server, "read_out")["saved"]).read_text())
    part = next(o for o in data["objects"] if o.get("in") == "Riser")
    assert [96, 10] in part["pts"] and [100, 0] in part["pts"], part["pts"]  # where it really sits
    corners = {p for f in _faces(part["mesh"]) for p in f}
    assert (96.0, 10.0, 36.0) in corners and (100.0, 0.0, 0.0) in corners  # the faces too
