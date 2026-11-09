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
