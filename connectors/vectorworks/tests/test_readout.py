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
