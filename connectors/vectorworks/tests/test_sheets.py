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
