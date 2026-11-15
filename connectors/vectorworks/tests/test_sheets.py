"""Sheets: a sheet layer, a viewport showing only some layers, a PDF of it, the drawing saved as new."""

import pytest
from mcp.server.mcpserver.exceptions import ToolError

from vwmcp import config
from vwmcp.server import build_server

from test_roundtrip import call


def call_error(server, tool, /, **args) -> str:
    with pytest.raises(ToolError) as e:
        call(server, tool, **args)
    return str(e.value)


@pytest.fixture
def server(fake_vw):
    return build_server(config.load())


def _layer(vs, name):
    return next(l for l in vs.DOC.layers if l.name == name)


def test_a_sheet_layer_with_its_page_size(server, fake_vw):
    r = call(server, "create_sheet_layer", name="Deck Layout", width=36, height=24)
    assert r["created"] and r["page"] == [[-18, -12], [18, 12]] and r["page_size"] == [36, 24] and r["page_center"] == [0, 0]
    assert _layer(fake_vw, "Deck Layout").layer_type == 2
    assert r["active_layer"] != "Deck Layout", "it stays on the layer you were on unless asked"
    again = call(server, "create_sheet_layer", name="Deck Layout")
    assert not again["created"]


def test_a_design_layer_is_never_taken_for_a_sheet(server, fake_vw):
    call(server, "create_layer", name="FOH DECK")
    assert "design layer" in call_error(server, "create_sheet_layer", name="FOH DECK")


def test_a_viewport_shows_only_the_layers_asked_for_at_its_scale_where_asked(server, fake_vw):
    for n in ("CFF SET-26", "FOH DECK", "JIB DECK", "Audience", "Camera"):
        call(server, "create_layer", name=n)
    call(server, "create_class", name="STAIRS")
    call(server, "create_sheet_layer", name="Deck Layout", width=36, height=24)
    before = list(fake_vw.DOC.objects)
    r = call(server, "create_viewport", sheet="Deck Layout", layers=["CFF SET-26", "FOH DECK", "JIB DECK"], scale=48,
             hidden_classes=["STAIRS", "Not a class"], crop=[["-40'", "-50'"], ["40'", "80'"]], at=[2, 1])
    vp = next(o for o in fake_vw.DOC.objects if o.type == 122)
    assert vp.layer.name == "Deck Layout"
    assert vp.layer_vis["CFF SET-26"] == 0 and vp.layer_vis["JIB DECK"] == 0
    assert vp.layer_vis["Audience"] == -1 and vp.layer_vis["Camera"] == -1, "every other design layer is off"
    assert vp.class_vis["STAIRS"] == -1 and r["missing_classes"] == ["Not a class"]
    assert {c: v for c, v in vp.class_vis.items() if c != "STAIRS"} == {c: 0 for c in fake_vw.DOC.classes if c != "STAIRS"}, \
        "every other class is turned on: a new viewport starts with them all off"
    assert r["scale"] == 48
    (x0, y0), (x1, y1) = r["on_sheet"]
    assert (round(x1 - x0, 3), round(y1 - y0, 3)) == (20, 32.5), "80' x 130' at 1/4\" = 1'-0\""
    assert (round((x0 + x1) / 2, 3), round((y0 + y1) / 2, 3)) == (2, 1), "centered where asked"
    assert [o for o in fake_vw.DOC.objects if o not in before] == [vp], "the crop rectangle isn't left in the drawing"


def test_a_viewport_needs_real_design_layers_and_a_sheet(server, fake_vw):
    call(server, "create_sheet_layer", name="Deck Layout")
    assert "no layer named" in call_error(server, "create_viewport", sheet="Deck Layout", layers=["Nope"]).lower()
    call(server, "create_layer", name="FOH DECK")
    assert "not a sheet layer" in call_error(server, "create_viewport", sheet="FOH DECK", layers=["FOH DECK"])
    assert not [o for o in fake_vw.DOC.objects if o.type == 122]


class _ExportingTrigger:
    """Stands in for Windows: pressing File > Export > Export PDF... opens two boxes; answering
    the save box with a path writes the PDF of the active sheet layer there."""

    def __init__(self, vs, fail=False):
        self.vs, self.fail, self.pressed, self.boxes = vs, fail, [], []

    def fire(self, job_created=None):
        pass

    def press_menu_path(self, path):
        if self.fail:
            from vwmcp.trigger import TriggerError
            raise TriggerError("Couldn't find 'Export PDF...' in Vectorworks' menus")
        self.pressed.append(path)
        self.boxes = ["settings", "save"]

    def fill_export_dialogs(self, path):
        done = []
        while self.boxes:
            box = self.boxes.pop(0)
            if box == "settings":
                done.append("PDF settings")
            else:
                with open(path, "wb") as f:
                    f.write(b"%PDF-1.4 fake " + self.vs.DOC.active_layer.name.encode())
                done.append("saved as " + path)
        return done


def _with_trigger(monkeypatch, trig):
    import vwmcp.server as srv

    monkeypatch.setattr(srv, "make_trigger", lambda settings: trig)
    return build_server(config.load())


def test_the_sheet_goes_to_a_pdf_through_export_pdf_and_the_drawing_is_saved_as_new(fake_vw, monkeypatch, tmp_path):
    trig = _ExportingTrigger(fake_vw)
    server = _with_trigger(monkeypatch, trig)
    call(server, "create_layer", name="FOH DECK")
    call(server, "create_sheet_layer", name="Deck Layout", width=17, height=11)
    pdf = tmp_path / "CFF Deck Layout.pdf"
    r = call(server, "export_pdf", sheet="Deck Layout", path=str(pdf))
    assert trig.pressed == [["File", "Export", "Export PDF..."]]
    assert r["pdf"] == str(pdf) and r["bytes"] > 0 and pdf.read_bytes().endswith(b"Deck Layout"), "the sheet layer was the one exported"
    assert r["answered"] == ["PDF settings", "saved as " + str(pdf)]
    assert fake_vw.DOC.active_layer.name == "FOH DECK", "back on the layer it was on"
    new = tmp_path / "CFF deck layout.vwx"
    s = call(server, "save_as", path=str(new))
    assert s["saved"] == str(new)
    assert "end in .pdf" in call_error(server, "export_pdf", sheet="Deck Layout", path=str(tmp_path / "x.png"))
    assert "end in .vwx" in call_error(server, "save_as", path=str(tmp_path / "x.pdf"))


def test_an_export_that_never_writes_a_pdf_says_why(fake_vw, monkeypatch, tmp_path):
    server = _with_trigger(monkeypatch, _ExportingTrigger(fake_vw, fail=True))
    call(server, "create_layer", name="FOH DECK")
    call(server, "create_sheet_layer", name="Deck Layout")
    err = call_error(server, "export_pdf", sheet="Deck Layout", path=str(tmp_path / "a.pdf"), timeout=3)
    assert "No PDF appeared" in err and "Export PDF..." in err
    assert fake_vw.DOC.active_layer.name == "FOH DECK"


def test_ping_names_tools_the_claude_app_hasnt_loaded(fake_vw, monkeypatch):
    monkeypatch.setenv("VWMCP_TOOLS_SEEN", "ping,read_out,create_layer")
    server = build_server(config.load())
    missing = call(server, "ping")["new_tools_need_claude_restart"]
    assert "export_pdf" in missing and "create_sheet_layer" in missing and "ping" not in missing
    monkeypatch.delenv("VWMCP_TOOLS_SEEN")
    assert "new_tools_need_claude_restart" not in call(build_server(config.load()), "ping")


def test_the_box_can_open_well_after_the_menu_press(fake_vw, monkeypatch, tmp_path):
    """Measured 2026-11-15: the menu press (a posted click) returns before Vectorworks opens its
    box; the export waited only a moment after the press, answered the boxes and gave up before
    the PDF was written."""
    class Late(_ExportingTrigger):
        def press_menu_path(self, path):
            super().press_menu_path(path)
            self.at = time.monotonic()

        def fill_export_dialogs(self, path):
            return super().fill_export_dialogs(path) if time.monotonic() - self.at > 6 else []

    import time

    trig = Late(fake_vw)
    server = _with_trigger(monkeypatch, trig)
    call(server, "create_layer", name="FOH DECK")
    call(server, "create_sheet_layer", name="Deck Layout")
    pdf = tmp_path / "late.pdf"
    r = call(server, "export_pdf", sheet="Deck Layout", path=str(pdf))
    assert r["pdf"] == str(pdf) and pdf.exists()


def test_a_slow_export_answers_before_the_link_gives_up_and_is_picked_up_again(fake_vw, monkeypatch, tmp_path):
    """The link to the PC drops a call after 80 s, so a slow export says it's still running, and
    the next call with the same path waits for that same export instead of starting another."""
    import threading

    gate = threading.Event()

    class Slow(_ExportingTrigger):
        def fill_export_dialogs(self, path):
            return super().fill_export_dialogs(path) if gate.is_set() else []

    trig = Slow(fake_vw)
    server = _with_trigger(monkeypatch, trig)
    call(server, "create_layer", name="FOH DECK")
    call(server, "create_sheet_layer", name="Deck Layout")
    pdf = str(tmp_path / "slow.pdf")
    import asyncio

    async def go():
        first = (await server.call_tool("export_pdf", {"sheet": "Deck Layout", "path": pdf, "wait": 1.5}))
        gate.set()
        second = (await server.call_tool("export_pdf", {"sheet": "Deck Layout", "path": pdf, "wait": 20}))
        return first, second

    import json

    first, second = (json.loads(r.content[0].text) for r in asyncio.run(go()))
    assert first["running"] is True
    assert second["pdf"] == pdf
    assert trig.pressed == [["File", "Export", "Export PDF..."]], "one export, not two"


def test_an_export_box_left_open_is_finished_first(fake_vw, monkeypatch, tmp_path):
    """Measured 2026-11-15: a save box left open by a run that gave up made every later job fail
    with "a dialog is open"."""
    trig = _ExportingTrigger(fake_vw)
    trig.boxes = ["save"]  # left over
    server = _with_trigger(monkeypatch, trig)
    pdf = tmp_path / "left.pdf"
    r = call(server, "export_pdf", sheet="Deck Layout", path=str(pdf))
    assert r["pdf"] == str(pdf) and "already open" in r["note"] and trig.pressed == []


def test_the_sheets_viewports_are_updated_before_the_pdf(fake_vw, monkeypatch, tmp_path):
    """Measured 2026-11-15: notes drawn after the viewport was made didn't show until its Update
    button was pressed."""
    trig = _ExportingTrigger(fake_vw)
    server = _with_trigger(monkeypatch, trig)
    call(server, "create_layer", name="FOH DECK")
    call(server, "create_sheet_layer", name="Deck Layout")
    call(server, "create_viewport", sheet="Deck Layout", layers=["FOH DECK"])
    vp = next(o for o in fake_vw.DOC.objects if o.type == 122)
    vp.updated = False
    call(server, "export_pdf", sheet="Deck Layout", path=str(tmp_path / "u.pdf"))
    assert vp.updated


def test_a_layer_made_after_the_viewport_can_be_shown_in_it(fake_vw, monkeypatch, tmp_path):
    """Measured 2026-11-15: the CFF deck layout's notes layer, made after its viewport, never
    showed in it (Update doesn't change which layers a viewport shows)."""
    server = build_server(config.load())
    call(server, "create_layer", name="FOH DECK")
    call(server, "create_sheet_layer", name="Deck Layout")
    call(server, "create_viewport", sheet="Deck Layout", layers=["FOH DECK"])
    call(server, "create_layer", name="Deck Layout - Notes")
    vp = next(o for o in fake_vw.DOC.objects if o.type == 122)
    assert vp.layer_vis.get("Deck Layout - Notes", -1) != 0
    r = call(server, "viewport_visibility", sheet="Deck Layout", show_layers=["Deck Layout - Notes"], hide_classes=["Nope"])
    assert vp.layer_vis["Deck Layout - Notes"] == 0 and r["viewports"] == 1 and r["missing_classes"] == ["Nope"]
    b = call(server, "batch", steps=[{"op": "viewport_visibility", "args": {"sheet": "Deck Layout", "hide_layers": ["FOH DECK"]}}])
    assert vp.layer_vis["FOH DECK"] == -1 and b["results"][0]["viewports"] == 1
    assert "no layer named" in call_error(server, "viewport_visibility", sheet="Deck Layout", show_layers=["Nope"]).lower()


def test_a_notes_layer_takes_the_drawings_scale(fake_vw):
    """Vectorworks draws each layer at its own scale: a notes layer at a different one doesn't line
    up with the drawing in a viewport (measured 2026-11-15)."""
    server = build_server(config.load())
    call(server, "create_layer", name="FOH DECK")
    call(server, "create_layer", name="Notes")
    _layer(fake_vw, "FOH DECK").scale = 48.0
    _layer(fake_vw, "Notes").scale = 1.0
    call(server, "add_text", position=[0, 0], text="Y axis (X=0)", layer="Notes")
    obj = next(o for o in fake_vw.DOC.objects if getattr(o, "type", None) == 10)
    obj.pt = 480.0
    r = call(server, "batch", steps=[{"op": "layer_scale", "args": {"names": ["Notes"], "like": "FOH DECK"}}])
    assert r["results"][0]["scales"] == {"Notes": 48.0} and _layer(fake_vw, "Notes").scale == 48.0
    assert r["results"][0]["texts_resized"] == 1
    assert obj.pt == 10.0, "the same size in the drawing as before: 480 pt at 1:1 is 10 pt at 1:48"
    assert "no layer named" in call_error(server, "batch", steps=[{"op": "layer_scale", "args": {"names": ["Nope"], "scale": 48}}]).lower()


def test_notes_go_into_the_viewports_annotations_offset_by_its_move(fake_vw, monkeypatch):
    """A viewport moved on its sheet takes new annotations off by the move x its scale (measured
    2026-11-15): create_viewport says how far, annotate_viewport puts the copies back."""
    monkeypatch.setattr(fake_vw.DOC, "origin", (-573.26, 909.77))  # CFF-26's user origin
    server = build_server(config.load())
    call(server, "create_layer", name="FOH DECK")
    call(server, "create_layer", name="Notes")
    call(server, "create_sheet_layer", name="Deck Layout", width=36, height=24)
    r = call(server, "create_viewport", sheet="Deck Layout", layers=["FOH DECK"], scale=96,
             crop=[[-480, -480], [480, 480]], at=[-6, 1])
    (x0, y0), (x1, y1) = r["on_sheet"]
    assert (round((x0 + x1) / 2, 6), round((y0 + y1) / 2, 6)) == (-6, 1), "where asked, with a user origin"
    assert r["annotation_offset"] == [round(-576.0 + 573.26, 6), round(96.0 - 909.77, 6)], "the move x the scale"
    call(server, "draw_line", start=[0, 0], end=[100, 0], layer="Notes")
    a = call(server, "batch", steps=[{"op": "annotate_viewport", "args": {"sheet": "Deck Layout", "layer": "Notes", "offset": r["annotation_offset"]}}])
    assert a["results"][0]["annotations_added"] == 1
    vp = next(o for o in fake_vw.DOC.objects if o.type == 122)
    (line,) = vp.annotations
    dx, dy = r["annotation_offset"]
    assert line.pts[0] == (dx, dy) and line.pts[1] == (100 + dx, dy)
    assert vp.layer_vis["Notes"] == -1, "the layer itself is turned off in the viewport: no double"
    s = call(server, "batch", steps=[{"op": "sheet_viewports", "args": {"sheet": "Deck Layout"}}])
    assert s["results"][0]["viewports"][0]["layers"] == ["FOH DECK"]


def test_only_an_empty_layer_can_be_deleted(fake_vw):
    server = build_server(config.load())
    call(server, "create_layer", name="Keep", activate=False)
    call(server, "draw_line", start=[0, 0], end=[1, 0], layer="Keep")
    call(server, "create_layer", name="Scratch", activate=False)
    assert "has objects" in call_error(server, "batch", steps=[{"op": "delete_empty_layer", "args": {"name": "Keep"}}])
    call(server, "batch", steps=[{"op": "delete_empty_layer", "args": {"name": "Scratch"}}])
    assert not any(l.name == "Scratch" for l in fake_vw.DOC.layers) and any(l.name == "Keep" for l in fake_vw.DOC.layers)


def test_annotation_text_prints_at_the_size_asked(fake_vw):
    """Annotation text is sized like text at 1:1 and shrinks with the viewport (measured
    2026-11-15: 140 pt in a 1/8" viewport printed at 140/96 pt)."""
    server = build_server(config.load())
    call(server, "create_layer", name="FOH DECK")
    call(server, "create_layer", name="Notes", activate=False)
    call(server, "create_sheet_layer", name="Deck Layout", width=36, height=24)
    call(server, "create_viewport", sheet="Deck Layout", layers=["FOH DECK"], scale=96, crop=[[-480, -480], [480, 480]])
    call(server, "add_text", position=[0, 0], text="Y axis (X=0)", layer="Notes")
    call(server, "add_text", position=[0, 50], text="32'-0\"", layer="Notes")
    texts = [o for o in fake_vw.DOC.objects if o.type == 10]
    texts[0].pt, texts[1].pt = 10.0, 5.0
    _layer(fake_vw, "Notes").scale = 2.0
    call(server, "batch", steps=[{"op": "annotate_viewport", "args": {"sheet": "Deck Layout", "layer": "Notes"}}])
    vp = next(o for o in fake_vw.DOC.objects if o.type == 122)
    assert sorted(t.pt for t in vp.annotations) == [10.0, 20.0], "x the layer's scale: looks as it did on the layer"
    r = call(server, "batch", steps=[{"op": "annotation_text", "args": {"sheet": "Deck Layout", "target_pt": 6}}])["results"][0]
    assert r["printed_pt"] == [round(10 / 96, 2), round(20 / 96, 2)]
    assert r["printed_pt_now"] == [6.0, 12.0] and sorted(t.pt for t in vp.annotations) == [576.0, 1152.0]
