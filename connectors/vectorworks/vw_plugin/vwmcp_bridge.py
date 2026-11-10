"""Runs INSIDE Vectorworks. Executes queued jobs with the `vs` API and writes results.

Rules this file lives by (each learned the hard way, see README "Why it's built this way"):
  - Vectorworks 2026 embeds Python 3.9: no `match`, no runtime `X | Y` types.
  - Every `vs` call here matches its documented Python signature in the official reference
    (github.com/Vectorworks/developer-scripting). A wrong call doesn't raise: it queues a modal
    "Script Errors" dialog that blocks Vectorworks until someone clicks OK.
  - Handles only live for one run, so objects are addressed by UUID (GetObjectUuid).
  - A nil handle is `None` or prints as "0".
  - Never create, delete or move objects inside a ForEachObject callback: collect first.
  - ResetObject regenerates at the END of the run, so a plug-in object read straight after a
    change can be stale. Moves report the exact new geometry by translating what was read.
  - Consecutive scripted runs merge into ONE Vectorworks undo step, so this keeps its own
    journal (journal.jsonl) and `undo_last` reverses Claude's edits one at a time.
"""

from __future__ import annotations

import contextlib
import json
import math
import os
import re
import time
import traceback
from pathlib import Path

import vs  # provided by Vectorworks (or by dev/fake_vs.py in tests)

BRIDGE_VERSION = "0.7.2"
HOME = Path(os.environ.get("VWMCP_HOME", str(Path.home() / ".vwmcp")))
JOBS = HOME / "jobs"
RESULTS = HOME / "results"
JOURNAL = HOME / "journal.jsonl"
STOP = HOME / "stop"
ALLOW_EXEC_FLAG = HOME / "allow_exec"  # create this file to permit run_python

# GetTypeN numbers (Appendix D) and the names criteria strings use for them.
TYPE_NAMES = {
    2: "line", 3: "rectangle", 4: "oval", 5: "polygon", 6: "arc", 8: "freehand", 10: "text",
    11: "group", 13: "rounded_rectangle", 15: "symbol", 16: "symbol_definition", 17: "locus",
    21: "polyline", 31: "layer", 63: "dimension", 68: "wall", 86: "plugin", 92: "symbol_folder",
}
TYPE_BY_NAME = {v: k for k, v in TYPE_NAMES.items()}
CRITERIA_TYPE = {
    "line": "LINE", "rectangle": "RECT", "oval": "OVAL", "polygon": "POLY", "arc": "ARC",
    "text": "TEXT", "group": "GROUP", "symbol": "SYMBOL", "polyline": "POLYLINE",
    "dimension": "DIMENSION", "wall": "WALL", "plugin": "PLUGINOBJECT", "locus": "LOCUS",
}
LD = "Lighting Device"


class OpError(Exception):
    """An error meant for Claude (or the panel) to read: bad id, missing symbol, bad length."""


# ---------------------------------------------------------------------------------------
# handles, ids, names
# ---------------------------------------------------------------------------------------


def _nil(h) -> bool:
    return h is None or str(h) == "0"


def _s(v) -> str:
    return "" if v is None else str(v)


def _uuid(h) -> str:
    return _s(vs.GetObjectUuid(h))


def _resolve(ref):
    ref = _s(ref)
    h = vs.GetObjectByUuid(ref)
    if _nil(h):
        raise OpError("No object with id %r. It may have been deleted; list objects again." % ref)
    return h


def _obj_name(h) -> str:
    # GetName gives "none" for unnamed objects; only trust it if GetObject finds this object.
    nm = _s(vs.GetName(h))
    if nm.lower() == "none" and str(vs.GetObject(nm)) != str(h):
        return ""
    return nm


# ---------------------------------------------------------------------------------------
# units and lengths
# ---------------------------------------------------------------------------------------


def _units() -> dict:
    fraction, display, fmt, upi, name, sq = vs.GetUnits()
    return {"unit_name": _s(name).strip() or _s(name), "square_unit_name": _s(sq).strip(),
            "units_per_inch": float(upi), "format": int(fmt)}


_SUFFIX_IN = {'"': 1.0, "in": 1.0, "inch": 1.0, "inches": 1.0, "'": 12.0, "ft": 12.0, "foot": 12.0,
              "feet": 12.0, "mm": 1 / 25.4, "cm": 10 / 25.4, "m": 1000 / 25.4}
_NUM = r"\d+(?:\.\d+)?|\.\d+"


def _inches_part(s: str):
    m = re.match(r"^(?:(%s)(?:\s+(\d+)\s*/\s*(\d+))?|(\d+)\s*/\s*(\d+))$" % _NUM, s.strip())
    if not m:
        return None
    if m.group(1) is not None:
        whole = float(m.group(1))
        return whole + float(m.group(2)) / float(m.group(3)) if m.group(2) else whole
    den = float(m.group(5))
    return None if den == 0 else float(m.group(4)) / den


def parse_length(raw, upi: float):
    """A length as a number (drawing units) or a string like 12'-6 1/2", 450mm, 3.5 ft.
    Returns drawing units, or None if it can't be read. Same rules as the panel's units.ts
    (both test against length-cases.json)."""
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        return float(raw)
    s = _s(raw).strip().lower().replace("′", "'").replace("’", "'").replace("″", '"').replace("”", '"')
    if not s:
        return None
    neg = s.startswith("-")
    body = s[1:].strip() if neg else s
    inches = None
    fi = re.match(r"^(\d+(?:\.\d+)?)\s*'\s*-?\s*(.*?)\s*\"?$", body)
    if fi and "'" in body:
        rest = fi.group(2).strip()
        ins = 0.0 if rest == "" else _inches_part(rest)
        if ins is None:
            return None
        inches = float(fi.group(1)) * 12 + ins
    else:
        m = re.match(r"^(%s)\s*([a-z\"']+)$" % _NUM, body)
        frac = re.match(r'^(.*?)\s*"$', body)
        if m and m.group(2) in _SUFFIX_IN:
            inches = float(m.group(1)) * _SUFFIX_IN[m.group(2)]
        elif frac:
            inches = _inches_part(frac.group(1))
        elif re.match(r"^(?:%s)$" % _NUM, body):
            v = float(body)
            return -v if neg else v
    if inches is None or not math.isfinite(inches):
        return None
    v = inches * upi
    return -v if neg else v


def _len(raw, what="length") -> float:
    v = parse_length(raw, _units()["units_per_inch"])
    if v is None:
        raise OpError("Can't read %s %r. Write it like 6'-3\", 4\", 450mm or a plain number." % (what, raw))
    return v


def _pt(p, what="point"):
    if not isinstance(p, (list, tuple)) or len(p) < 2:
        raise OpError("Expected a %s as [x, y], got %r" % (what, p))
    return (_len(p[0], what + " x"), _len(p[1], what + " y"))


def _xy(p) -> list:
    return [round(float(p[0]), 6), round(float(p[1]), 6)]


# ---------------------------------------------------------------------------------------
# layers, classes, finding objects
# ---------------------------------------------------------------------------------------


def _layers() -> list:
    out = []
    h = vs.FLayer()
    while not _nil(h):
        kind = vs.GetObjectVariableInt(h, 154)  # 1 design, 2 sheet (Appendix G / CreateLayer)
        out.append({"name": _s(vs.GetLName(h)), "type": "sheet" if kind == 2 else "design"})
        h = vs.NextLayer(h)
    return out


def _classes() -> list:
    return [_s(vs.ClassList(i)) for i in range(1, vs.ClassNum() + 1)]


def _active_layer() -> str:
    return _s(vs.GetLName(vs.ActLayer()))


def _ensure_layer(name: str):
    h = vs.GetLayerByName(name)
    if _nil(h):
        h = vs.CreateLayer(name, 1)
    if _nil(h):
        raise OpError("Couldn't create layer %r." % name)
    return h


def _ensure_class(name: str) -> None:
    if name not in _classes():
        current = vs.ActiveClass()
        vs.NameClass(name)  # creates and activates
        vs.NameClass(current)


def _safe_name(v) -> bool:
    # Criteria strings can't carry an apostrophe reliably; those names are matched in Python.
    return "'" not in _s(v)


def _find(layer=None, cls=None, selected_only=False, object_type=None, plugin=None, limit=1000) -> list:
    parts, post = [], []
    if layer:
        if _safe_name(layer):
            parts.append("(L='%s')" % layer)
        else:
            post.append(lambda h: _s(vs.GetLName(vs.GetLayer(h))) == layer)
    if cls:
        if _safe_name(cls):
            parts.append("(C='%s')" % cls)
        else:
            post.append(lambda h: _s(vs.GetClass(h)) == cls)
    if selected_only:
        parts.append("(SEL=TRUE)")
    if object_type:
        t = CRITERIA_TYPE.get(object_type.lower())
        if t is None:
            raise OpError("Unknown object_type %r. Use one of: %s" % (object_type, ", ".join(sorted(CRITERIA_TYPE))))
        parts.append("(T=%s)" % t)
    if plugin:
        parts.append("(PON='%s')" % plugin)
    criteria = " & ".join(parts) if parts else "(ALL)"
    found = []
    vs.ForEachObject(found.append, criteria)  # collect only; act afterwards
    found = [h for h in found if all(f(h) for f in post) and vs.GetTypeN(h) not in (31, 16, 92, 122)
             and not _inside_group(h)]  # a group is described with its members as parts
    _note_native(criteria)
    return found[: int(limit) + 1]


# Where objects come from. Criteria searches descend into design layer viewports unless told
# not to (NOTINDLVP, NOTINREFDLVP), so the same search run three ways tells native objects,
# objects shown through a viewport of this file, and objects from a referenced file apart.
_NATIVE = set()
_LOCAL_VP = set()


def _note_native(criteria: str) -> None:
    native, local = [], []
    vs.ForEachObject(native.append, "NOTINREFDLVP & NOTINDLVP & " + criteria)
    vs.ForEachObject(local.append, "NOTINREFDLVP & " + criteria)
    _NATIVE.update(str(h) for h in native)
    _LOCAL_VP.update(str(h) for h in local)


def _parent_chain(h, depth: int = 12):
    out = []
    p = vs.GetParent(h)
    while not _nil(p) and depth > 0 and vs.GetTypeN(p) != 31:
        out.append(p)
        p = vs.GetParent(p)
        depth -= 1
    return out


def _inside_group(h) -> bool:
    return any(vs.GetTypeN(p) == 11 for p in _parent_chain(h, 3))


def _source(h) -> str:
    """native | viewport (this file, through a design layer viewport) | referenced (another file)."""
    key = str(h)
    in_vp = any(vs.GetTypeN(p) == 122 for p in _parent_chain(h))
    if key in _NATIVE and not in_vp:
        return "native"
    if key in _LOCAL_VP:
        return "viewport"
    if in_vp or (_NATIVE and key not in _NATIVE):
        return "referenced" if key not in _LOCAL_VP else "viewport"
    return "native"


def _require_editable(h) -> None:
    if not _NATIVE:
        _note_native("(ALL)")
    src = _source(h)
    if src != "native":
        where = "a referenced file" if src == "referenced" else "a design layer viewport"
        raise OpError("That object is shown through %s, so it's read-only here. Change it in its own file or layer." % where)


# ---------------------------------------------------------------------------------------
# describing objects
# ---------------------------------------------------------------------------------------


def _unit_arc_bbox(start: float, sweep: float):
    a0 = math.radians(start)
    a1 = math.radians(start + sweep)
    angles = [a0, a1]
    lo, hi = min(a0, a1), max(a0, a1)
    k = math.ceil(lo / (math.pi / 2))
    while k * math.pi / 2 <= hi:
        angles.append(k * math.pi / 2)
        k += 1
    xs = [math.cos(a) for a in angles]
    ys = [math.sin(a) for a in angles]
    return min(xs), min(ys), max(xs), max(ys)


def _ring_len(pts, closed: bool) -> float:
    n = len(pts) if closed else len(pts) - 1
    return sum(math.hypot(pts[(i + 1) % len(pts)][0] - pts[i][0], pts[(i + 1) % len(pts)][1] - pts[i][1]) for i in range(max(n, 0)))


def _shoelace(pts) -> float:
    return abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))) / 2


def _plugin_name(h) -> str:
    rec = vs.GetParametricRecord(h)
    return "" if _nil(rec) else _s(vs.GetName(rec))


def _record_fields(h, record_name: str) -> dict:
    rec = vs.GetParametricRecord(h) if _plugin_name(h) == record_name else None
    if _nil(rec):
        for i in range(1, vs.NumRecords(h) + 1):
            r = vs.GetRecord(h, i)
            if _s(vs.GetName(r)) == record_name:
                rec = r
                break
    if _nil(rec):
        return {}
    out = {}
    for i in range(1, vs.NumFields(rec) + 1):
        fname = _s(vs.GetFldName(rec, i))
        out[fname] = _s(vs.GetRField(h, record_name, fname))
    return out


def _describe(h, include_records: bool = False, depth: int = 0) -> dict:
    t = vs.GetTypeN(h)
    p1, p2 = vs.GetBBox(h)  # top-left, bottom-right
    x0, x1 = sorted((float(p1[0]), float(p2[0])))
    y0, y1 = sorted((float(p1[1]), float(p2[1])))
    info = {
        "id": _uuid(h), "type": TYPE_NAMES.get(t, "type_%d" % t), "name": _obj_name(h),
        "layer": _s(vs.GetLName(vs.GetLayer(h))), "cls": _s(vs.GetClass(h)),
        "bbox": [[x0, y0], [x1, y1]], "width": round(x1 - x0, 6), "height": round(y1 - y0, 6),
    }
    g = {"kind": "bbox"}
    if t == 2:
        a, b = _xy(vs.GetSegPt1(h)), _xy(vs.GetSegPt2(h))
        g = {"kind": "line", "start": a, "end": b}
        info["length"] = math.hypot(b[0] - a[0], b[1] - a[1])
    elif t in (3, 13):
        g = {"kind": "polygon", "closed": True, "points": [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]}
        info["area"] = (x1 - x0) * (y1 - y0)
        info["perimeter"] = 2 * ((x1 - x0) + (y1 - y0))
    elif t == 4:
        rx, ry = (x1 - x0) / 2, (y1 - y0) / 2
        g = {"kind": "oval", "center": [(x0 + x1) / 2, (y0 + y1) / 2], "rx": rx, "ry": ry}
        info["area"] = math.pi * rx * ry
        info["perimeter"] = math.pi * (3 * (rx + ry) - math.sqrt((3 * rx + ry) * (rx + 3 * ry)))
    elif t in (5, 21):
        n = vs.GetVertNum(h)
        if t == 5:
            pts = [_xy(vs.GetPolyPt(h, i)) for i in range(1, n + 1)]
        else:
            pts = [_xy(vs.GetPolylineVertex(h, i)[0]) for i in range(1, n + 1)]
            curved = any(vs.GetPolylineVertex(h, i)[1] != 0 for i in range(1, n + 1))
            if curved:
                info["approximate"] = True  # curved vertices drawn as corners in the preview
        closed = bool(vs.IsPolyClosed(h))
        g = {"kind": "polygon", "closed": closed, "points": pts}
        info["length"] = vs.HPerim(h) if info.get("approximate") else _ring_len(pts, closed)
        if closed:
            info["perimeter"] = info["length"]
            info["area"] = _shoelace(pts)
    elif t == 6:
        start, sweep = vs.GetArc(h)
        c = _xy(vs.HCenter(h))  # for arcs HCenter is the arc's center
        ux0, uy0, ux1, uy1 = _unit_arc_bbox(float(start), float(sweep))
        spans = [(x1 - x0, ux1 - ux0), (y1 - y0, uy1 - uy0)]
        w, u = max(spans, key=lambda s: s[1])
        r = w / u if u > 1e-9 else 0.0
        g = {"kind": "arc", "center": c, "radius": r, "start_angle": float(start), "sweep_angle": float(sweep)}
        info["length"] = abs(math.radians(float(sweep))) * r
    elif t == 10:
        g = {"kind": "text", "position": [x0, y0], "text": _s(vs.GetText(h))}
    elif t == 68:
        a, b = _xy(vs.GetSegPt1(h)), _xy(vs.GetSegPt2(h))
        ok, thick = vs.GetWallThickness(h)
        s_top, s_bot, e_top, e_bot = vs.GetWallCornerHeights(h)
        g = {"kind": "wall", "start": a, "end": b, "thickness": float(thick) if ok else None}
        info["length"] = math.hypot(b[0] - a[0], b[1] - a[1])
        info["z_min"] = float(min(s_bot, e_bot))
        info["z_max"] = float(max(s_top, e_top))
    elif t == 11 and depth < 3:
        parts = []
        m = vs.FInGroup(h)
        while not _nil(m) and len(parts) < 300:
            part = _describe(m, depth=depth + 1)["geometry"]
            if part.get("kind") == "group":
                parts.extend(part["parts"][: 300 - len(parts)])
            elif part.get("kind") != "bbox":
                parts.append(part)
            m = vs.NextObj(m)
        g = {"kind": "group", "parts": parts}
    elif t == 15:
        info["symbol"] = _s(vs.GetSymName(h))
        info["location"] = _xy(vs.GetSymLoc(h))
        info["z"] = float(vs.GetSymLoc3D(h)[2])
    elif t == 86:
        info["plugin"] = _plugin_name(h)
        info["location"] = _xy(vs.GetSymLoc(h))
        info["z"] = float(vs.GetSymLoc3D(h)[2])
        if info["plugin"] == LD:
            info["channel"] = _s(vs.GetRField(h, LD, "Channel"))
        if include_records and info["plugin"]:
            info["fields"] = _record_fields(h, info["plugin"])
    if t not in (15, 86, 68, 11) and vs.GetObjectVariableBoolean(h, 650):  # "object is 3D"
        dy, dx, dz = vs.Get3DInfo(h)  # documented order is height, width, depth = dY, dX, dZ
        _p, zc = vs.Get3DCntr(h)
        info["z_min"] = float(zc) - float(dz) / 2
        info["z_max"] = float(zc) + float(dz) / 2
    if depth == 0:
        info["source"] = _source(h)
    info["geometry"] = g
    return info


def _translated(d: dict, dx: float, dy: float) -> dict:
    """The description of an object after HMove(dx, dy), exactly, without re-reading it."""
    m = lambda p: [p[0] + dx, p[1] + dy]  # noqa: E731
    d = dict(d)
    d["bbox"] = [m(d["bbox"][0]), m(d["bbox"][1])]
    if "location" in d:
        d["location"] = m(d["location"])
    g = dict(d["geometry"])
    for k in ("start", "end", "center", "position"):
        if k in g:
            g[k] = m(g[k])
    if "points" in g:
        g["points"] = [m(p) for p in g["points"]]
    d["geometry"] = g
    return d


def _center(ref):
    if isinstance(ref, str):
        d = _describe(_resolve(ref))
        (x0, y0), (x1, y1) = d["bbox"]
        c = d.get("location") or [(x0 + x1) / 2, (y0 + y1) / 2]
        return (c[0], c[1]), (x0, y0, x1, y1)
    x, y = _pt(ref)
    return (x, y), (x, y, x, y)


# ---------------------------------------------------------------------------------------
# the undo journal
# ---------------------------------------------------------------------------------------

_pending_undo = []  # undo steps gathered while the current job runs
_barrier = [None]  # why the current job can't be undone from here, if it can't


def _record(op_name: str, **args) -> None:
    _pending_undo.append({"op": op_name, "args": args})


def _no_undo(reason: str) -> None:
    _barrier[0] = reason


def _flush_journal(label: str) -> None:
    if not _pending_undo and not _barrier[0]:
        return
    entry = {"label": label, "at": time.time()}
    if _barrier[0]:
        entry["barrier"] = _barrier[0]
    else:
        entry["undo"] = list(reversed(_pending_undo))
    HOME.mkdir(parents=True, exist_ok=True)
    with open(str(JOURNAL), "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


# ---------------------------------------------------------------------------------------
# ops
# ---------------------------------------------------------------------------------------

OPS = {}


def op(fn):
    OPS[fn.__name__] = fn
    return fn


def _place(h, layer=None, cls=None, name=None, created=True) -> dict:
    if _nil(h):
        raise OpError("Vectorworks didn't create the object.")
    if layer and _s(vs.GetName(vs.GetLayer(h))) != layer:
        # SetParent onto the layer it's already on returns false in Vectorworks (seen 2026-11-07
        # placing on the active layer), so only move it when it's somewhere else.
        if not vs.SetParent(h, _ensure_layer(layer)):
            vs.DelObject(h)
            raise OpError("Couldn't move the new object to layer %r." % layer)
    if cls:
        _ensure_class(cls)
        vs.SetClass(h, cls)
    if name:
        if not _nil(vs.GetObject(name)):
            raise OpError("Something in the drawing is already named %r." % name)
        vs.SetName(h, name)
    d = _describe(h)
    if created:
        _record("delete_objects", ids=[d["id"]])
    return d


def _version() -> str:
    v = vs.GetVersionEx()  # (major, minor, maintenance, platform, build); major 31 = 2026
    return "%d (%d.%d.%d, build %s)" % (int(v[0]) + 1995, int(v[0]), int(v[1]), int(v[2]), v[4])


@op
def ping():
    v = vs.GetVersionEx()
    return {
        "document": _s(vs.GetFName()),
        "version": _version(),
        "platform": {1: "Mac", 2: "Windows"}.get(int(v[3]), str(v[3])),
        "units": _units(),
        "selected": vs.NumSelectedObjects(),
        "bridge": BRIDGE_VERSION,
    }


@op
def get_document_info():
    return {
        "document": _s(vs.GetFName()), "path": _s(vs.GetFPathName()), "version": _version(), "units": _units(), "layers": _layers(), "classes": _classes(),
        "active_layer": _active_layer(), "active_class": _s(vs.ActiveClass()),
        "selected": vs.NumSelectedObjects(),
    }


@op
def create_layer(name, activate=True):
    current = _active_layer()
    existed = not _nil(vs.GetLayerByName(name))
    _ensure_layer(name)
    vs.Layer(name if activate else current)
    if not existed:
        _no_undo("creating a layer")
    return {"layer": name, "created": not existed, "active_layer": _active_layer()}


@op
def create_class(name, activate=False):
    existed = name in _classes()
    _ensure_class(name)
    if activate:
        vs.NameClass(name)
    if not existed:
        _no_undo("creating a class")
    return {"class": name, "created": not existed, "active_class": _s(vs.ActiveClass())}


@op
def draw_line(start, end, layer=None, cls=None, name=None):
    vs.MoveTo(_pt(start, "start"))
    vs.LineTo(_pt(end, "end"))
    return _place(vs.LNewObj(), layer, cls, name)


@op
def draw_rectangle(corner1, corner2, layer=None, cls=None, name=None):
    (ax, ay), (bx, by) = _pt(corner1, "corner1"), _pt(corner2, "corner2")
    if ax == bx or ay == by:
        raise OpError("A rectangle needs width and depth.")
    vs.Rect((min(ax, bx), max(ay, by)), (max(ax, bx), min(ay, by)))  # top-left, bottom-right
    return _place(vs.LNewObj(), layer, cls, name)


@op
def draw_circle(center, radius, layer=None, cls=None, name=None):
    cx, cy = _pt(center, "center")
    r = _len(radius, "radius")
    if r <= 0:
        raise OpError("radius must be more than 0")
    vs.Oval((cx - r, cy + r), (cx + r, cy - r))
    return _place(vs.LNewObj(), layer, cls, name)


@op
def draw_arc(center, radius, start_angle, sweep_angle, layer=None, cls=None, name=None):
    cx, cy = _pt(center, "center")
    r = _len(radius, "radius")
    if r <= 0:
        raise OpError("radius must be more than 0")
    vs.ArcByCenter(cx, cy, r, float(start_angle), float(sweep_angle))
    return _place(vs.LNewObj(), layer, cls, name)


@op
def draw_polygon(points, closed=True, layer=None, cls=None, name=None):
    pts = [_pt(p) for p in points]
    if len(pts) < 2:
        raise OpError("A polygon needs at least 2 points")
    if closed:
        vs.ClosePoly()
    else:
        vs.OpenPoly()
    vs.BeginPoly()
    for p in pts:
        vs.AddPoint(p)
    vs.EndPoly()
    return _place(vs.LNewObj(), layer, cls, name)


@op
def add_text(position, text, size_pt=None, layer=None, cls=None):
    vs.TextSize(float(size_pt) if size_pt else 10.0)  # set first, or CreateText can misfire
    vs.TextOrigin(_pt(position, "position"))
    vs.CreateText(_s(text))
    return _place(vs.LNewObj(), layer, cls)


DIM_TYPES = {"horizontal": 0, "vertical": 1, "aligned": 4}


@op
def add_dimension(start, end, offset=0, direction="aligned", layer=None, cls=None):
    if direction not in DIM_TYPES:
        raise OpError("direction must be horizontal, vertical or aligned")
    # arrow 1 / textFlag 1: let Vectorworks place the arrows and text (Appendix E bits).
    vs.LinearDim(_pt(start, "start"), _pt(end, "end"), _len(offset, "offset"), DIM_TYPES[direction], 1, 1, 0)
    return _place(vs.LNewObj(), layer, cls)


@op
def draw_wall(start, end, thickness=None, height=None, layer=None, cls=None):
    vs.Wall(_pt(start, "start"), _pt(end, "end"))
    h = vs.LNewObj()
    if _nil(h):
        raise OpError("Vectorworks didn't create the wall.")
    # SetWallThickness / SetWallHeights silently do nothing on scripted walls (found on VW 2026).
    if thickness is not None:
        vs.SetComponentWidth(h, 1, _len(thickness, "thickness"))
    if height is not None:
        ht = _len(height, "height")
        vs.SetWallCornerHeights(h, ht, 0, ht, 0)
    return _place(h, layer, cls)


@op
def list_symbols(contains=None, limit=500):
    out = []

    def walk(h, path):
        while not _nil(h) and len(out) < limit:
            t = vs.GetTypeN(h)
            nm = _s(vs.GetName(h))
            if t == 92:
                walk(vs.FInFolder(h), path + [nm])
            elif t == 16 and (not contains or contains.lower() in nm.lower()):
                out.append({"name": nm, "folder": "/".join(path)})
            h = vs.NextSymDef(h)

    walk(vs.FSymDef(), [])
    return {"count": len(out), "symbols": out}


# ---- importing symbols from Vectorworks' libraries -------------------------------------

LIBRARY_INDEX = HOME / "library_index.json"
SYMBOL_TYPE = 16
# Words in a library file's path that make it worth opening first.
LIBRARY_HINTS = ("stage", "deck", "truss", "rigging", "spotlight", "entertainment", "pipe", "clamp", "scaffold", "shackle", "sling")


def _library_roots():
    """Folders holding Vectorworks' library files. VWMCP_LIBRARY_ROOTS (separated like PATH)
    overrides; otherwise the application's Libraries folder and the user's downloaded ones."""
    env = os.environ.get("VWMCP_LIBRARY_ROOTS")
    if env:
        cands = [p for p in env.split(os.pathsep) if p]
    else:
        import sys

        year = _version().split(" ")[0]
        cands = []
        exe = getattr(sys, "executable", "") or ""
        if exe.lower().endswith(".exe"):
            cands.append(os.path.join(os.path.dirname(exe), "Libraries"))
        cands.append(os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "Vectorworks %s" % year, "Libraries"))
        if os.environ.get("APPDATA"):
            cands.append(os.path.join(os.environ["APPDATA"], "Nemetschek", "Vectorworks", year, "Libraries"))
    out, seen = [], set()
    for r in cands:
        key = os.path.normcase(os.path.abspath(r))
        if key not in seen and os.path.isdir(r):
            seen.add(key)
            out.append(r)
    return out


def _load_library_index():
    try:
        with open(str(LIBRARY_INDEX), encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_library_index(index):
    HOME.mkdir(parents=True, exist_ok=True)
    tmp = str(LIBRARY_INDEX) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(index, f)
    os.replace(tmp, str(LIBRARY_INDEX))


def _symbols_in_file(path):
    """(listID, [symbol names]) for one library file; listID is 0 when it couldn't be read."""
    try:
        lid, n = vs.BuildResourceListN(SYMBOL_TYPE, path)
    except Exception:
        return 0, []
    if not lid:
        return 0, []
    return lid, [_s(vs.GetActualNameFromResourceList(lid, i)) for i in range(1, int(n) + 1)]


def _has_symbol(name):
    d = vs.GetObject(name)
    return not _nil(d) and vs.GetTypeN(d) == 16


@op
def import_symbols(names, budget_s=20.0):
    """Import symbols by exact name from Vectorworks' library files into this file.

    Opens the library files whose paths look likeliest first (words from the names, then rigging
    and staging folders), remembers what each file holds in ~/.vwmcp/library_index.json so the
    next search is instant, and stops after `budget_s` seconds: call again while `scan_left` > 0
    and something is still `not_found`."""
    names = [str(n) for n in dict.fromkeys(names or [])]
    already = [n for n in names if _has_symbol(n)]
    remaining = [n for n in names if n not in already]
    roots = _library_roots()
    index = _load_library_index()
    files = []
    for r in roots:
        for dirpath, _dirs, fnames in os.walk(r):
            files.extend(os.path.join(dirpath, f) for f in fnames if f.lower().endswith(".vwx"))
    tokens = {t for n in remaining for t in re.findall(r"[a-z]+", n.lower()) if len(t) > 2}

    def rank(path):
        low = path.lower()
        return (-(2 * sum(t in low for t in tokens) + sum(h in low for h in LIBRARY_HINTS)), low)

    def mtime(path):
        try:
            return os.path.getmtime(path)
        except OSError:
            return None

    def fresh(path):
        e = index.get(path)
        return isinstance(e, dict) and e.get("mtime") == mtime(path)

    files.sort(key=rank)
    imported, sources = [], {}

    def take(path, lid, held):
        for i, nm in enumerate(held, 1):
            if nm in remaining:
                vs.ImportResourceToCurrentFile(lid, i)
                if _has_symbol(nm):
                    remaining.remove(nm)
                    imported.append(nm)
                    sources[nm] = path

    # Files already indexed: open only those known to hold something wanted.
    for path in files:
        if not remaining:
            break
        if fresh(path) and any(n in index[path]["names"] for n in remaining):
            lid, held = _symbols_in_file(path)
            if lid:
                take(path, lid, held)
    deadline = time.time() + float(budget_s)
    for path in files:
        if not remaining or time.time() > deadline:
            break
        if fresh(path):
            continue
        lid, held = _symbols_in_file(path)
        index[path] = {"mtime": mtime(path), "names": held}
        if lid:
            take(path, lid, held)
    with contextlib.suppress(OSError):
        _save_library_index(index)
    return {
        "imported": imported, "from": sources, "already_here": already, "not_found": remaining,
        "scan_left": sum(1 for p in files if not fresh(p)), "library_files": len(files), "roots": roots,
    }


def _require_symbol(name):
    d = vs.GetObject(name)
    if _nil(d) or vs.GetTypeN(d) != 16:
        raise OpError("No symbol named %r in this file's resources. list_symbols shows what's there." % name)


@op
def place_symbol(symbol, position, rotation=0, layer=None, cls=None):
    _require_symbol(symbol)
    vs.Symbol(symbol, _pt(position, "position"), float(rotation))
    return _place(vs.LNewObj(), layer, cls)


@op
def place_lighting_device(position, symbol, rotation=0, fields=None, layer=None, cls=None):
    # Refuse unknown symbols: a device pointing at a missing symbol can damage the file.
    _require_symbol(symbol)
    h = vs.CreateCustomObjectN(LD, _pt(position, "position"), float(rotation), False)
    if _nil(h):
        raise OpError("Vectorworks didn't create the lighting device. Is Spotlight installed?")
    vs.SetRField(h, LD, "Symbol Name", symbol)
    for k, v in _ld_values(h, dict(fields or {})).items():
        vs.SetRField(h, LD, k, _s(v))
    vs.ResetObject(h)
    return _place(h, layer, cls)


@op
def list_objects(layer=None, cls=None, selected_only=False, object_type=None, limit=200, include_geometry=True):
    limit = int(limit)
    handles = _find(layer, cls, selected_only, object_type, limit=limit)
    objects = [_describe(h) for h in handles[:limit]]
    if not include_geometry:
        for o in objects:
            o.pop("geometry", None)
    return {"count": len(objects), "truncated": len(handles) > limit, "units": _units(), "objects": objects}


@op
def get_object(id):
    return _describe(_resolve(id), include_records=True)


@op
def measure_distance(a, b):
    (ax, ay), ba = _center(a)
    (bx, by), bb = _center(b)
    gx = max(0.0, max(ba[0], bb[0]) - min(ba[2], bb[2]))
    gy = max(0.0, max(ba[1], bb[1]) - min(ba[3], bb[3]))
    return {"center_distance": math.hypot(bx - ax, by - ay), "dx": bx - ax, "dy": by - ay,
            "angle_deg": math.degrees(math.atan2(by - ay, bx - ax)), "bbox_gap": math.hypot(gx, gy),
            "units": _units()["unit_name"]}


@op
def move_objects(ids, dx, dy):
    dx, dy = _len(dx, "dx"), _len(dy, "dy")
    hs = [_resolve(i) for i in ids]  # all or nothing: fail before touching anything
    for h in hs:
        _require_editable(h)
    before = [_describe(h) for h in hs]
    for h in hs:
        vs.HMove(h, dx, dy)
        if vs.GetTypeN(h) == 86:
            vs.ResetObject(h)
    _record("move_objects", ids=[d["id"] for d in before], dx=-dx, dy=-dy)
    return {"objects": [_translated(d, dx, dy) for d in before]}


@op
def move_object(id, dx, dy):
    return move_objects([id], dx, dy)["objects"][0]


@op
def rotate_object(id, angle, center=None):
    h = _resolve(id)
    _require_editable(h)
    c = _pt(center, "center") if center else _center(id)[0]
    vs.HRotate(h, c, float(angle))
    if vs.GetTypeN(h) == 86:
        vs.ResetObject(h)
    _record("rotate_object", id=_uuid(h), angle=-float(angle), center=list(c))
    return _describe(h)


@op
def duplicate_objects(ids, dx=0, dy=0):
    dx, dy = _len(dx, "dx"), _len(dy, "dy")
    hs = [_resolve(i) for i in ids]
    out = []
    for h in hs:
        copy = vs.HDuplicate(h, dx, dy)
        if _nil(copy):
            raise OpError("Vectorworks couldn't duplicate one of those.")
        out.append(_describe(copy))
    _record("delete_objects", ids=[d["id"] for d in out])
    return {"objects": out}


@op
def delete_objects(ids, _undoing=False):
    hs = [_resolve(i) for i in ids]
    for h in hs:
        _require_editable(h)
    gone = [_uuid(h) for h in hs]
    for h in hs:
        vs.DelObject(h)
    if not _undoing:
        _no_undo("deleting objects (use Ctrl+Z in Vectorworks to bring them back)")
    return {"deleted": gone}


@op
def delete_object(id):
    return delete_objects([id])


@op
def set_object_properties(id, name=None, cls=None, layer=None):
    h = _resolve(id)
    _require_editable(h)
    before = _describe(h)
    if name is not None and name != before["name"]:
        other = vs.GetObject(name)
        if name and not _nil(other) and str(other) != str(h):
            raise OpError("Something in the drawing is already named %r." % name)
        vs.SetName(h, name)
    if cls:
        _ensure_class(cls)
        vs.SetClass(h, cls)
    if layer:
        if not vs.SetParent(h, _ensure_layer(layer)):
            raise OpError("Couldn't move it to layer %r." % layer)
    _record("set_object_properties", id=before["id"], name=before["name"], cls=before["cls"], layer=before["layer"])
    return _describe(h)


def _hex_to_rgb16(c):
    m = re.match(r"^#?([0-9a-fA-F]{6})$", _s(c).strip())
    if not m:
        raise OpError("Colors are written like #ff8800, got %r" % c)
    n = int(m.group(1), 16)
    return ((n >> 16 & 255) * 257, (n >> 8 & 255) * 257, (n & 255) * 257)  # 0-65535 per channel


FILLS = {"none": 0, "background": 1, "solid": 2}


@op
def set_attributes(ids, pen_color=None, fill_color=None, line_weight_mils=None, fill=None):
    hs = [_resolve(i) for i in ids]
    for h in hs:
        # Setting a pen colour clears the fill's by-class flag and vice versa (documented quirk);
        # that's acceptable for objects Claude styles explicitly.
        if pen_color:
            vs.SetPenFore(h, _hex_to_rgb16(pen_color))
        if fill_color:
            vs.SetFillBack(h, _hex_to_rgb16(fill_color))
        if line_weight_mils is not None:
            vs.SetLW(h, int(line_weight_mils))
        if fill:
            if fill not in FILLS:
                raise OpError("fill must be none, background or solid")
            vs.SetFPat(h, FILLS[fill])
    _no_undo("changing colors or line weights")
    return {"updated": [_uuid(h) for h in hs]}


@op
def group_objects(ids, name=None):
    hs = [_resolve(i) for i in ids]
    vs.DSelectAll()
    for h in hs:
        vs.SetSelect(h)
    vs.Group()
    g = vs.LNewObj()
    if _nil(g) or vs.GetTypeN(g) != 11:
        raise OpError("Vectorworks didn't make a group (are they on the same layer?).")
    if name:
        vs.SetName(g, name)
    _no_undo("grouping")
    return _describe(g)


@op
def select_objects(ids, replace=True, zoom=False):
    hs = [_resolve(i) for i in ids]
    if replace:
        vs.DSelectAll()
    for h in hs:
        vs.SetSelect(h)
    if zoom and hs:
        vs.DoMenuTextByName("Fit To Objects", 0)
    return {"selected": vs.NumSelectedObjects()}


@op
def clear_selection():
    vs.DSelectAll()
    return {"selected": 0}


@op
def zoom_to(ids=None):
    if ids:
        select_objects(ids, replace=True)
    vs.DoMenuTextByName("Fit To Objects", 0)
    return {"zoomed": True}


@op
def get_lighting_devices(layer=None, limit=2000):
    handles = _find(layer=layer, plugin=LD, limit=int(limit))
    devices = []
    for h in handles[: int(limit)]:
        d = _describe(h, include_records=True)
        d.pop("geometry", None)
        devices.append(d)
    return {"count": len(devices), "units": _units(), "devices": devices}


def _ld_values(h, values: dict) -> dict:
    # Universe or DMX Address written alone get overwritten on reset; UniverseAddress
    # ("2/101") is what Spotlight keeps (found on VW 2026).
    if ("Universe" in values or "DMX Address" in values) and "UniverseAddress" not in values:
        uni = _s(values.pop("Universe", vs.GetRField(h, LD, "Universe")))
        addr = _s(values.pop("DMX Address", vs.GetRField(h, LD, "DMX Address")))
        values["UniverseAddress"] = "%s/%s" % (uni, addr)
    return values


@op
def set_record_fields(id, record, values):
    h = _resolve(id)
    _require_editable(h)
    values = dict(values)
    if record == LD:
        values = _ld_values(h, values)
    before = _record_fields(h, record)
    if not before:
        raise OpError("This object has no %r record." % record)
    unknown = [k for k in values if k not in before]
    if unknown:
        raise OpError("No field %s on %s. Fields include: %s" % (", ".join(repr(u) for u in unknown), record, ", ".join(list(before)[:30])))
    for k, v in values.items():
        vs.SetRField(h, record, k, _s(v))
    if vs.GetTypeN(h) == 86:
        vs.ResetObject(h)
    _record("set_record_fields", id=_uuid(h), record=record, values={k: before[k] for k in values})
    after = dict(before)
    after.update({k: _s(v) for k, v in values.items()})
    return {"id": _uuid(h), "record": record, "fields": after,
            "note": "Spotlight applies some fields when the script ends; read again to confirm."}


@op
def set_record_field(id, record, field, value):
    r = set_record_fields(id, record, {field: value})
    return {"id": r["id"], "record": record, "field": field, "value": r["fields"].get(field)}


@op
def batch(steps):
    """Run several ops in one Vectorworks round trip. Stops at the first failure and says
    which step; earlier steps stay done (undo_last reverses the whole batch)."""
    out = []
    for i, s in enumerate(steps):
        name = s.get("op")
        if name in ("batch", "run_python", "undo_last", "import_dwg") or name not in OPS:
            raise OpError("Step %d: %r can't run in a batch." % (i + 1, name))
        try:
            out.append(OPS[name](**s.get("args", {})))
        except OpError as e:
            raise OpError("Step %d (%s) failed: %s. Steps before it were done." % (i + 1, name, e))
    return {"results": out}


@op
def undo_last():
    if not JOURNAL.exists():
        raise OpError("Nothing of Claude's to undo yet.")
    lines = [ln for ln in JOURNAL.read_text(encoding="utf-8").splitlines() if ln.strip()]
    if not lines:
        raise OpError("Nothing of Claude's to undo yet.")
    entry = json.loads(lines[-1])
    if entry.get("barrier"):
        raise OpError("The last change (%s) can't be undone from here: %s." % (entry["label"], entry["barrier"]))
    for step in entry["undo"]:
        args = dict(step["args"])
        if step["op"] == "delete_objects":
            args["_undoing"] = True
            args["ids"] = [i for i in args["ids"] if not _nil(vs.GetObjectByUuid(i))]
            if not args["ids"]:
                continue
        OPS[step["op"]](**args)
    _pending_undo[:] = []  # undoing isn't itself journaled
    JOURNAL.write_text("".join(ln + "\n" for ln in lines[:-1]), encoding="utf-8")
    return {"undone": "Undid: %s." % entry["label"].replace("_", " ")}


@op
def vs_lookup(query, limit=20):
    """Search the live `vs` module: names and their documented signatures. Read-only."""
    q = _s(query).lower()
    out = []
    for n in dir(vs):
        if q in n.lower():
            doc = _s(getattr(getattr(vs, n), "__doc__", "")).strip()
            out.append({"name": n, "doc": doc[:400]})
            if len(out) >= int(limit):
                break
    return {"count": len(out), "functions": out}


@op
def run_python(code):
    if not ALLOW_EXEC_FLAG.exists():
        raise OpError("run_python is disabled. Create %s to allow it." % ALLOW_EXEC_FLAG)
    _no_undo("raw Python")
    scope = {"vs": vs, "result": None, "__name__": "__vwmcp__"}
    exec(code, scope)
    result = scope.get("result")
    json.dumps(result, default=str)
    return {"result": result}


# ---------------------------------------------------------------------------------------
# 3D placement: truss, pipes, clamps (Rig Planner, docs/RIG.md)
#
# Positions here arrive in INCHES (the build list's unit) and are converted to drawing units.
# Rotations are applied one world axis at a time (X, then Y, then Z) with Set3DRot, so the
# result is Rz . Ry . Rx whatever order Set3DRot combines three angles in. A rotation's centre
# and the user origin don't matter: the insertion point is read back afterwards (GetSymLoc3D)
# and the object moved onto its target with Move3DObj. That also undoes Flip3DObj's habit of
# flipping about the bounding-box centre rather than the insertion point.
# ---------------------------------------------------------------------------------------

STRAIGHT_TRUSS = "Straight Truss"


def _in(v, what="length") -> float:
    try:
        return float(v) * _units()["units_per_inch"]
    except (TypeError, ValueError):
        raise OpError("%s must be a number of inches, got %r" % (what, v))


def _p3(p, what="point"):
    if not isinstance(p, (list, tuple)) or len(p) != 3:
        raise OpError("Expected %s as [x, y, z] in inches, got %r" % (what, p))
    return tuple(_in(c, what) for c in p)


def _require_3d_placeable(h) -> None:
    if vs.GetTypeN(h) not in (15, 86):
        raise OpError("Only symbols and plug-in objects have a 3D insertion point to set.")


def _loc3(h):
    p = vs.GetSymLoc3D(h)
    return (float(p[0]), float(p[1]), float(p[2]))


def _move_insertion_to(h, target) -> None:
    cur = _loc3(h)
    d = (target[0] - cur[0], target[1] - cur[1], target[2] - cur[2])
    if any(abs(c) > 1e-9 for c in d):
        vs.Move3DObj(h, d[0], d[1], d[2])


def _on_layer(layer):
    return _find(layer=layer, limit=10 ** 6)


def _field_home(h, field):
    """Which record (the plug-in's own, or one attached) has this field."""
    plugin = _plugin_name(h)
    if plugin and field in _record_fields(h, plugin):
        return plugin
    for i in range(1, vs.NumRecords(h) + 1):
        rn = _s(vs.GetName(vs.GetRecord(h, i)))
        if field in _record_fields(h, rn):
            return rn
    return None


@contextlib.contextmanager
def _on_active_layer(layer):
    prev = _active_layer()
    if layer:
        _ensure_layer(layer)
        vs.Layer(layer)
    try:
        yield
    finally:
        if layer and prev != layer:
            vs.Layer(prev)


@op
def set_z(ids, z):
    """Set the height of symbols and plug-in objects' insertion points (all or nothing)."""
    zz = _len(z, "z")
    hs = [_resolve(i) for i in ids]
    for h in hs:
        _require_editable(h)
        _require_3d_placeable(h)
    out = []
    for h in hs:
        old = _loc3(h)
        vs.Move3DObj(h, 0, 0, zz - old[2])
        if vs.GetTypeN(h) == 86:
            vs.ResetObject(h)
        _record("set_z", ids=[_uuid(h)], z=old[2])
        d = _describe(h)
        d["z"] = zz
        out.append(d)
    return {"objects": out}


def _place_truss(symbol, insertion, rotation, length, hanging_angle=0):
    """A truss symbol -> group -> ungroup -> the Straight Truss plug-in, MagnetObjects deleted,
    length and Hanging Angle set, insertion moved to `insertion` (inches)."""
    _require_symbol(symbol)
    target = _p3(insertion, "insertion")
    layer = _active_layer()
    before = set(_uuid(h) for h in _on_layer(layer))
    vs.Symbol(symbol, (target[0], target[1]), float(rotation))
    sym = vs.LNewObj()
    if _nil(sym) or vs.GetTypeN(sym) != 15:
        raise OpError("Vectorworks didn't place the symbol %r." % symbol)
    vs.SymbolToGroup(sym, 0)  # keep the plug-in inside as a plug-in; LNewObj is NIL after this

    def fresh():
        return [h for h in _on_layer(layer) if _uuid(h) not in before]

    groups = [h for h in fresh() if vs.GetTypeN(h) == 11]
    if len(groups) != 1:
        raise OpError("Converting %r to a group gave %d groups, expected 1." % (symbol, len(groups)))
    vs.HUngroup(groups[0])
    new = fresh()
    truss = [h for h in new if vs.GetTypeN(h) == 86 and _plugin_name(h) == STRAIGHT_TRUSS]
    magnets = [h for h in new if vs.GetTypeN(h) == 86 and "magnet" in _plugin_name(h).lower()]
    if len(truss) != 1:
        for h in new:
            vs.DelObject(h)
        raise OpError("Expected one %r inside symbol %r, found %d. Is it a Spotlight truss symbol?" % (STRAIGHT_TRUSS, symbol, len(truss)))
    t = truss[0]
    for m in magnets:
        vs.DelObject(m)
    upi = _units()["units_per_inch"]
    length_field = next((f for f in ("LineLength", "Length") if _field_home(t, f) == STRAIGHT_TRUSS), None)
    if length_field is None:
        raise OpError("The Straight Truss has no LineLength or Length field. Fields: %s" % ", ".join(list(_record_fields(t, STRAIGHT_TRUSS))[:30]))
    vs.SetRField(t, STRAIGHT_TRUSS, length_field, _s(round(float(length) * upi, 6)))
    if float(hanging_angle):
        rec = _field_home(t, "Hanging Angle")
        if rec is None:
            raise OpError("No 'Hanging Angle' field on the Straight Truss or its records, so it can't stand vertical.")
        vs.SetRField(t, rec, "Hanging Angle", _s(float(hanging_angle)))
    vs.ResetObject(t)
    _move_insertion_to(t, target)
    tid = _uuid(t)
    leftovers = [_uuid(h) for h in new if _uuid(h) != tid and not any(_uuid(h) == _uuid(m) for m in magnets)]
    _record("delete_objects", ids=[tid] + leftovers)
    return {"id": tid, "symbol": symbol, "insertion": list(insertion), "rotation": float(rotation), "length": float(length),
            "hanging_angle": float(hanging_angle), "magnets_deleted": len(magnets), "other_objects": len(leftovers)}


def _place_symbol_plan(symbol, at, rotation=0.0):
    """A symbol turned about Z only (decks, legs: hybrid symbols can't turn in 3D), its insertion
    at `at` (inches), Z included."""
    _require_symbol(symbol)
    target = _p3(at, "at")
    vs.Symbol(symbol, (target[0], target[1]), float(rotation))
    h = vs.LNewObj()
    if _nil(h):
        raise OpError("Vectorworks didn't place the symbol %r." % symbol)
    _move_insertion_to(h, target)
    uid = _uuid(h)
    _record("delete_objects", ids=[uid])
    return {"id": uid, "symbol": symbol, "at": list(at), "rotation": float(rotation)}


def _place_symbol_3d(symbol, at, rot_xyz, mirror=False):
    """A 3D-only symbol with its insertion at `at` (inches), mirrored in its local Y first if
    asked, then rotated about world X, Y, Z by rot_xyz (degrees)."""
    _require_symbol(symbol)
    target = _p3(at, "at")
    if not isinstance(rot_xyz, (list, tuple)) or len(rot_xyz) != 3:
        raise OpError("rot_xyz must be [x, y, z] degrees")
    vs.Symbol(symbol, (target[0], target[1]), 0.0)
    h = vs.LNewObj()
    if _nil(h):
        raise OpError("Vectorworks didn't place the symbol %r." % symbol)
    if mirror:
        vs.Flip3DObj(h, False)  # Flip Vertical: local Y -> -Y (about the bbox centre; fixed below)
    centre = _loc3(h)
    for axis, ang in enumerate(rot_xyz):
        if abs(float(ang)) > 1e-9:
            a = [0.0, 0.0, 0.0]
            a[axis] = float(ang)
            vs.Set3DRot(h, a[0], a[1], a[2], centre[0], centre[1], centre[2])
    _move_insertion_to(h, target)
    ok, rx, ry, rz, flipped = vs.Get3DOrientation(h)
    uid = _uuid(h)
    _record("delete_objects", ids=[uid])
    return {"id": uid, "symbol": symbol, "at": list(at), "rot_xyz": [float(r) for r in rot_xyz], "mirror": bool(mirror),
            "readback": {"rot_xyz": [float(rx), float(ry), float(rz)], "mirrored": bool(flipped)} if ok else None}


@op
def place_truss_section(symbol, insertion, rotation=0, length=96, hanging_angle=0, layer=None):
    with _on_active_layer(layer):
        return _place_truss(symbol, insertion, rotation, length, hanging_angle)


@op
def place_symbol_3d(symbol, at, rot_xyz, mirror=False, layer=None):
    with _on_active_layer(layer):
        return _place_symbol_3d(symbol, at, rot_xyz, mirror)


@op
def build_rig_parts(steps, layer="Rig", replace=False):
    """Place every step of a planned rig on `layer`. Each part reports on its own: one that fails
    doesn't stop the rest. undo_last removes everything placed (an empty new layer stays)."""
    existing = [] if _nil(vs.GetLayerByName(layer)) else _on_layer(layer)
    if existing and not replace:
        raise OpError("Layer %r already has %d objects. Build on another layer, or pass replace=true to clear it first." % (layer, len(existing)))
    for h in existing:
        _require_editable(h)
    if existing:
        for h in existing:
            vs.DelObject(h)
        _no_undo("clearing layer %r before building (use Ctrl+Z in Vectorworks)" % layer)
    results = []
    with _on_active_layer(layer):
        for s in steps:
            try:
                if s.get("type") == "truss":
                    r = _place_truss(s["symbol"], s["insertion"], s.get("rotation", 0), s["length"], s.get("hanging_angle", 0))
                elif s.get("type") == "symbol_3d":
                    r = _place_symbol_3d(s["symbol"], s["at"], s["rot_xyz"], s.get("mirror", False))
                elif s.get("type") == "symbol":
                    r = _place_symbol_plan(s["symbol"], s["at"], s.get("rotation", 0))
                else:
                    raise OpError("unknown step type %r" % s.get("type"))
                r.update({"part": s.get("id"), "kind": s.get("kind"), "ok": True})
            except (OpError, KeyError) as e:
                r = {"part": s.get("id"), "kind": s.get("kind"), "ok": False, "error": str(e)}
            results.append(r)
    ok = sum(1 for r in results if r["ok"])
    return {"layer": layer, "cleared": len(existing), "placed": ok, "failed": len(results) - ok, "results": results}


# ---------------------------------------------------------------------------------------
# what's in this drawing (any situation: one file, referenced files, DWG, traced PDF)
# ---------------------------------------------------------------------------------------

RIGGING_KINDS = [
    ("hoist", r"hoist|motor|chain ?hoist"),
    ("house_point", r"house rigging point|rigging point|house point"),
    ("bridle", r"bridle"),
    ("truss", r"truss"),
    ("load", r"\bload\b"),
    ("position", r"hanging position|light position|lighting pipe|pipe ladder"),
    ("fixture", r"lighting device"),
]


def _r(v, k=1.0):
    """A coordinate in inches, rounded to a hundredth."""
    return round(float(v) * k, 2)


def _ro_local_shape(h, t, max_points):
    """An object's outline in its own coordinates: (points, closed), or (None, None)."""
    p1, p2 = vs.GetBBox(h)
    x0, x1 = sorted((float(p1[0]), float(p2[0])))
    y0, y1 = sorted((float(p1[1]), float(p2[1])))
    if t == 2:
        return [_xy(vs.GetSegPt1(h)), _xy(vs.GetSegPt2(h))], False
    if t in (3, 13):
        return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], True
    if t == 4:
        cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
        return [[cx + rx * math.cos(2 * math.pi * i / 24), cy + ry * math.sin(2 * math.pi * i / 24)] for i in range(24)], True
    if t in (5, 21):
        n = vs.GetVertNum(h)
        if t == 5:
            pts = [_xy(vs.GetPolyPt(h, i)) for i in range(1, n + 1)]
        else:
            pts = [_xy(vs.GetPolylineVertex(h, i)[0]) for i in range(1, n + 1)]
        step = max(1, int(math.ceil(len(pts) / float(max_points))))
        return pts[::step], bool(vs.IsPolyClosed(h))
    if t == 6:
        start, sweep = vs.GetArc(h)
        c = _xy(vs.HCenter(h))
        ux0, uy0, ux1, uy1 = _unit_arc_bbox(float(start), float(sweep))
        spans = [(x1 - x0, ux1 - ux0), (y1 - y0, uy1 - uy0)]
        w, u = max(spans, key=lambda q: q[1])
        r = w / u if u > 1e-9 else 0.0
        n = max(4, int(abs(float(sweep)) / 15))
        a0 = math.radians(float(start))
        sw = math.radians(float(sweep))
        return [[c[0] + r * math.cos(a0 + sw * i / n), c[1] + r * math.sin(a0 + sw * i / n)] for i in range(n + 1)], False
    if t == 68:
        a, b = _xy(vs.GetSegPt1(h)), _xy(vs.GetSegPt2(h))
        ok, thick = vs.GetWallThickness(h)
        th = float(thick) if ok else 0.0
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / L * th / 2, dx / L * th / 2
        return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], True
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], True  # anything else: its footprint


def _ro_z(h, t):
    """[bottom, top] of a 3D object (or a wall), else None."""
    if t == 68:
        s_top, s_bot, e_top, e_bot = vs.GetWallCornerHeights(h)
        return [float(min(s_bot, e_bot)), float(max(s_top, e_top))]
    if t in (11, 15, 86) or not vs.GetObjectVariableBoolean(h, 650):
        return None
    dy, dx, dz = vs.Get3DInfo(h)
    _p, zc = vs.Get3DCntr(h)
    return [float(zc) - float(dz) / 2, float(zc) + float(dz) / 2]


def _ro_fill(h):
    try:
        if vs.GetFPat(h) == 0:
            return None
        r, g, b = vs.GetFillBack(h)
        return "#%02x%02x%02x" % (int(r) // 257, int(g) // 257, int(b) // 257)
    except Exception:
        return None


FACE_CAP = 3000  # an object with more faces than this keeps its plain block (a scanned prop, a dense mesh)


def _pt3(p):
    """GetPolyPt3D's answer as [x, y, z], whichever shape this Vectorworks gives it in."""
    flat = []
    stack = [p]
    while stack:
        q = stack.pop(0)
        if isinstance(q, (list, tuple)):
            stack = list(q) + stack
        else:
            flat.append(float(q))
    return flat[:3] if len(flat) >= 3 else None


def _ro_faces(h, cap=FACE_CAP):
    """An object's real surfaces, in its own coordinates, as 3D polygons ([[x, y, z], ...] each).
    ConvertTo3DPolys REPLACES the object it's given (measured on Vectorworks 2026, 2026-11-10: a
    read-out that converted the drawing's own objects deleted them), so it only ever gets a
    duplicate made here; the converted duplicate is read and deleted. The drawing's object is never
    passed to it. None when it can't, or there are more than `cap` faces."""
    try:
        dup = vs.HDuplicate(h, 0, 0)
    except Exception:
        return None
    if _nil(dup):
        return None
    try:
        g = vs.ConvertTo3DPolys(dup)
    except Exception:
        g = None
    if _nil(g):
        try:
            vs.DelObject(dup)  # not converted: the duplicate is still there
        except Exception:
            pass
        return None
    faces, over = [], False
    try:
        stack = [g]
        while stack:
            c = stack.pop()
            ct = vs.GetTypeN(c)
            if ct == 11:
                stack.extend(_children(vs.FInGroup(c)))
                continue
            try:
                n = int(vs.GetVertNum(c))
            except Exception:
                continue
            if n < 3:
                continue
            pts = []
            for i in range(n):  # GetPolyPt3D counts from 0 (measured on Vectorworks 2026)
                q = _pt3(vs.GetPolyPt3D(c, i))
                if q is not None:
                    pts.append(q)
            if len(pts) >= 3:
                faces.append(pts)
            if len(faces) > cap:
                over = True
                break
    finally:
        vs.DelObject(g)
    return None if over else faces


def _children(first):
    out, m = [], first
    while not _nil(m) and len(out) < 100000:
        out.append(m)
        m = vs.NextObj(m)
    return out


DETAIL_CAP = 2500  # a symbol drawn with more parts than this comes as one block (was 150: cameras and people became boxes)
FACE_BUDGET = 400000  # faces in one read-out; past it, 3D objects fall back to plain blocks


@op
def read_out(max_objects=40000, max_points=200, detail_cap=DETAIL_CAP):
    """The whole drawing as data, in inches, for working on it away from Vectorworks: document,
    layers (with elevations and whether they're shown), classes, every plug-in object with all
    its fields (lighting devices, truss, hoists, decks...), every symbol, and the shapes it's drawn
    with: inside groups, and inside every symbol (placed where the symbol sits, turned with it).
    3D objects come with their bottom and top and a solid fill colour, so Rig Studio can show them
    as blocks. In a symbol that has a 3D part, its 2D plan lines are left out (the 3D part draws
    it). A symbol drawn with more than `detail_cap` parts (people, cameras, detailed props) comes
    as one block its size, so the set itself isn't crowded out. Text and dimensions are left out."""
    u = _units()
    k = 1.0 / (u["units_per_inch"] or 1.0)
    objects, skipped = [], {}
    state = {"truncated": False}
    defs3d = {}
    parts = {}

    def part_count(defh, depth=0):
        """Leaf objects a symbol definition draws, nested groups and symbols included (cached)."""
        key = str(defh)
        if key in parts:
            return parts[key]
        parts[key] = 0  # guards a symbol that (somehow) contains itself
        n, stack = 0, _children(vs.FInSymDef(defh))
        while stack and n <= detail_cap * 4:
            c = stack.pop()
            ct = vs.GetTypeN(c)
            if ct == 11:
                stack.extend(_children(vs.FInGroup(c)))
            elif ct == 15 and depth < 6:
                inner = vs.GetObject(_s(vs.GetSymName(c)))
                n += part_count(inner, depth + 1) if not _nil(inner) else 1
            elif ct not in (10, 63):
                n += 1
        parts[key] = n
        return n

    def has3d(defh):
        key = str(defh)
        if key not in defs3d:
            defs3d[key] = any(vs.GetTypeN(c) not in (11, 15, 86) and vs.GetObjectVariableBoolean(c, 650)
                              for c in _children(vs.FInSymDef(defh)))
        return defs3d[key]

    # Inside a symbol definition Vectorworks measures x, y from the internal origin, so every point
    # read there is off by the user origin (measured on CFF-26: 327 of 356 symbols' parts sat exactly
    # one user origin away, turned with the symbol). Points read inside a definition get it added back
    # before they're placed (`pre` in the transform); points on a layer are already right.
    try:
        uo = tuple(float(c) for c in vs.GetOriginInDocUnits())
    except Exception:
        uo = (0.0, 0.0)

    def place(pt, xf):
        ox, oy, oz, rot, sx, sy, sz = xf[:7]
        px, py = xf[7] if len(xf) > 7 else (0.0, 0.0)
        x, y = (pt[0] + px) * sx, (pt[1] + py) * sy
        c, s_ = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        return [_r(ox + x * c - y * s_, k), _r(oy + x * s_ + y * c, k)]

    def scale_of(h):
        """A symbol's own scale (2019+: none, symmetric or asymmetric; DWG blocks often use it)."""
        try:
            kind = vs.GetObjectVariableInt(h, 101)
            if kind == 2:
                f = float(vs.GetObjectVariableReal(h, 102))
                return f, f, f
            if kind == 3:
                return (float(vs.GetObjectVariableReal(h, 102)), float(vs.GetObjectVariableReal(h, 103)),
                        float(vs.GetObjectVariableReal(h, 104)))
        except Exception:
            pass
        return 1.0, 1.0, 1.0

    state["faces"] = 0
    import time as _time
    t_start = _time.time()

    def mesh(h, xf):
        """The object's real faces placed in the drawing, as {"q": step, "v": [x, y, z, ...] in
        quarter inches, "f": [n, i1..in, n, ...]} (shared corners stored once), or None."""
        if state["faces"] >= FACE_BUDGET:
            return None
        faces = _ro_faces(h)
        if not faces:
            return None
        state["faces"] += len(faces)
        ox, oy, oz, rot, sx, sy, sz = xf[:7]
        seen, v, f = {}, [], []
        for face in faces:
            f.append(len(face))
            for x, y, z in face:
                X, Y = place([x, y], xf)
                key = (int(round(X * 4)), int(round(Y * 4)), int(round(_r(z * sz + oz, k) * 4)))
                i = seen.get(key)
                if i is None:
                    i = seen[key] = len(seen)
                    v.extend(key)
                f.append(i)
        return {"q": 0.25, "v": v, "f": f}

    def add(o):
        if len(objects) >= int(max_objects):
            state["truncated"] = True
            return False
        objects.append(o)
        return True

    def walk(h, layer, xf, depth, in_sym, skip2d, clip=None):
        t = vs.GetTypeN(h)
        if t in (10, 63):
            skipped["text and dimensions"] = skipped.get("text and dimensions", 0) + 1
            return
        if t in (31, 16, 92, 122, 17):
            return
        cls = _s(vs.GetClass(h))
        if t == 11:
            for c in _children(vs.FInGroup(h)):
                walk(c, layer, xf, depth + 1, in_sym, skip2d, clip)
            return
        p1, p2 = vs.GetBBox(h)
        corners = [place(q, xf) for q in ([p1[0], p1[1]], [p2[0], p1[1]], [p2[0], p2[1]], [p1[0], p2[1]])]
        xs, ys = [q[0] for q in corners], [q[1] for q in corners]
        o = {"t": TYPE_NAMES.get(t, "type_%d" % t), "layer": layer, "cls": cls, "bbox": [min(xs), min(ys), max(xs), max(ys)]}
        if in_sym:
            o["in"] = in_sym
        name = _obj_name(h)
        if name:
            o["name"] = name
        if t in (15, 86):
            # GetSymLoc3D measures x and y from the internal origin, everything else here from the
            # user origin (measured on CFF-26: off by exactly the user origin), so x, y come from
            # GetSymLoc and only z from GetSymLoc3D.
            xy = _xy(vs.GetSymLoc(h))
            loc = (xy[0], xy[1], float(vs.GetSymLoc3D(h)[2]))
            at = place([loc[0], loc[1]], xf)
            o["at"] = [at[0], at[1], _r(float(loc[2]) * xf[6] + xf[2], k)]
            o["rot"] = round(float(vs.GetSymRot(h)) + xf[3], 3)
            if t == 86:
                o["plugin"] = _plugin_name(h)
                if o["plugin"]:
                    o["fields"] = _record_fields(h, o["plugin"])
                if vs.GetObjectVariableBoolean(h, 650):  # a 3D plug-in (a door, a deck): its block too
                    dy, dx, dz = vs.Get3DInfo(h)
                    _c, zc = vs.Get3DCntr(h)
                    o["pts"] = corners
                    o["closed"] = True
                    o["z"] = [_r((float(zc) - float(dz) / 2) * xf[6] + xf[2], k), _r((float(zc) + float(dz) / 2) * xf[6] + xf[2], k)]
                    m3 = mesh(h, xf)
                    if m3:
                        o["mesh"] = m3
                add(o)
                return
            sym = _s(vs.GetSymName(h))
            o["symbol"] = sym
            if not add(o):
                return
            defh = vs.GetObject(sym)
            if not _nil(defh) and part_count(defh) > int(detail_cap):
                # Too detailed to draw part by part: one block its size (and height, if it's 3D).
                b = {"t": "block", "layer": layer, "cls": cls, "bbox": o["bbox"], "in": sym, "pts": corners, "closed": True, "simplified": True}
                try:
                    dy, dx, dz = vs.Get3DInfo(h)
                    _c, zc = vs.Get3DCntr(h)
                    if float(dz) > 0:
                        b["z"] = [_r((float(zc) - float(dz) / 2) * xf[6] + xf[2], k), _r((float(zc) + float(dz) / 2) * xf[6] + xf[2], k)]
                except Exception:
                    pass
                add(b)
                return
            if depth < 6 and not _nil(defh):
                sx, sy, sz = scale_of(h)
                inner = (o["at"][0] / k, o["at"][1] / k, float(loc[2]) * xf[6] + xf[2], o["rot"], xf[4] * sx, xf[5] * sy, xf[6] * sz, uo)
                bx0, by0, bx1, by1 = o["bbox"]
                # Generous: a symbol's 3D parts can reach past its plan outline (measured on CFF-26: a
                # tight margin dropped half the set). This only catches parts placed absurdly far off.
                m = 10 * max(bx1 - bx0, by1 - by0) + 1200.0 / k
                clip = (bx0 - m, by0 - m, bx1 + m, by1 + m)
                for c in _children(vs.FInSymDef(defh)):
                    walk(c, layer, inner, depth + 1, sym, has3d(defh), clip)
            return
        z = _ro_z(h, t)
        if skip2d and z is None and t in (2, 3, 4, 5, 6, 13, 21):
            return  # a hybrid symbol's 2D plan graphics: its 3D part is drawn instead
        pts, closed = _ro_local_shape(h, t, max_points)
        if pts is None:
            return
        if clip is not None and (o["bbox"][2] < clip[0] or o["bbox"][0] > clip[2] or o["bbox"][3] < clip[1] or o["bbox"][1] > clip[3]):
            skipped["parts far outside their symbol"] = skipped.get("parts far outside their symbol", 0) + 1
            return  # something this transform can't place (a mirrored or 3D-rotated symbol): better left out
        o["pts"] = [place(q, xf) for q in pts]
        o["closed"] = bool(closed)
        if z is not None:
            o["z"] = [_r(z[0] * xf[6] + xf[2], k), _r(z[1] * xf[6] + xf[2], k)]
            m3 = mesh(h, xf)
            if m3:
                o["mesh"] = m3
        fill = _ro_fill(h) if (closed or z is not None) else None
        if fill:
            o["fill"] = fill
        add(o)

    design, lh = [], vs.FLayer()
    while not _nil(lh):
        if vs.GetObjectVariableInt(lh, 154) != 2:  # design layers only
            design.append(lh)
        lh = vs.NextLayer(lh)
    # Shown layers first, so a cut-off (max_objects) falls on hidden ones.
    for lh in sorted(design, key=lambda h: vs.GetLVis(h) != 0):
        name = _s(vs.GetLName(lh))
        for h in _children(vs.FInLayer(lh)):
            if state["truncated"]:
                break
            walk(h, name, (0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0), 0, None, False)
    _note_native("(ALL)")
    truncated = state["truncated"]
    layers = []
    for info in _layers():
        lh = vs.GetLayerByName(info["name"])
        entry = dict(info)
        if hasattr(vs, "GetLayerElevationN"):
            base, thick = vs.GetLayerElevationN(lh)
            entry["elevation"] = _r(base, k)
        entry["visible"] = vs.GetLVis(lh) == 0  # 0 shown, -1 hidden, 2 grayed
        layers.append(entry)
    return {
        "readout": 1,
        "document": _s(vs.GetFName()),
        "path": _s(vs.GetFPathName()),
        "version": _version(),
        "units": "in",
        "document_units": u,
        "layers": layers,
        "classes": _classes(),
        "objects": objects,
        "skipped": skipped,
        "truncated": truncated,
        "faces": state["faces"],
        "seconds": round(_time.time() - t_start, 1),
    }


def _rigging_kind(plugin: str) -> str:
    n = plugin.lower()
    for kind, pat in RIGGING_KINDS:
        if re.search(pat, n):
            return kind
    return ""


@op
def survey_drawing():
    """Everything a rigger needs to know about a file they were just sent."""
    everything = []
    vs.ForEachObject(everything.append, "(ALL)")
    _note_native("(ALL)")
    counts = {"native": 0, "viewport": 0, "referenced": 0}
    per_layer, per_class, plugins, viewports = {}, {}, {}, {}
    xs, ys = [], []
    for h in everything:
        t = vs.GetTypeN(h)
        if t in (31, 16, 92) or _inside_group(h):
            continue
        src = _source(h)
        if t == 122:
            viewports[str(h)] = {"name": _obj_name(h), "layer": _s(vs.GetLName(vs.GetLayer(h))), "objects": 0, "referenced": False}
            continue
        counts[src] += 1
        if src != "native":
            for anc in _parent_chain(h):
                if vs.GetTypeN(anc) == 122 and str(anc) in viewports:
                    viewports[str(anc)]["objects"] += 1
                    viewports[str(anc)]["referenced"] = viewports[str(anc)]["referenced"] or src == "referenced"
        layer = _s(vs.GetLName(vs.GetLayer(h)))
        cls = _s(vs.GetClass(h))
        per_layer[layer] = per_layer.get(layer, 0) + 1
        per_class[cls] = per_class.get(cls, 0) + 1
        if t == 86:
            name = _plugin_name(h)
            if name not in plugins:
                plugins[name] = {"count": 0, "kind": _rigging_kind(name), "fields": list(_record_fields(h, name))[:80]}
            plugins[name]["count"] += 1
        p1, p2 = vs.GetBBox(h)
        xs += [float(p1[0]), float(p2[0])]
        ys += [float(p1[1]), float(p2[1])]
    layers = []
    for info in _layers():
        h = vs.GetLayerByName(info["name"])
        ref, path = vs.IsLayerReferenced(h)
        elev = None
        if hasattr(vs, "GetLayerElevationN"):  # document units, VW 2025+
            base, thick = vs.GetLayerElevationN(h)
            elev = {"base": float(base), "thickness": float(thick)}
        layers.append(dict(info, objects=per_layer.get(info["name"], 0), visibility={-1: "hidden", 0: "visible", 2: "gray"}.get(vs.GetObjectVariableInt(h, 153), "visible"),
                           elevation=elev, scale=float(vs.GetLScale(h)), referenced_file=_s(path) if ref else None))
    ox, oy = vs.GetOriginInDocUnits()
    extent = [[min(xs), min(ys)], [max(xs), max(ys)]] if xs else None
    return {
        "document": _s(vs.GetFName()), "path": _s(vs.GetFPathName()), "version": _version(), "units": _units(),
        "user_origin": [float(ox), float(oy)], "extent": extent, "counts": counts,
        "layers": layers, "classes": [{"name": c, "objects": per_class.get(c, 0)} for c in _classes()],
        "viewports": list(viewports.values()), "plugins": [dict(v, name=k) for k, v in sorted(plugins.items())],
    }


@op
def get_rigging(include_fixtures=False, limit=3000):
    """Hoists, house points, bridles, truss, loads and hanging positions, with every field and Z.
    Plug-in names vary by version, so objects are recognised by their plug-in name's words."""
    found = []
    vs.ForEachObject(found.append, "(T=PLUGINOBJECT)")
    _note_native("(T=PLUGINOBJECT)")
    out = []
    for h in found:
        if len(out) >= int(limit) or _inside_group(h):
            continue
        name = _plugin_name(h)
        kind = _rigging_kind(name)
        if not kind or (kind == "fixture" and not include_fixtures):
            continue
        d = _describe(h, include_records=True)
        d.pop("geometry", None)
        d["kind"] = kind
        out.append(d)
    return {"count": len(out), "units": _units(), "objects": out}


VIS = {"visible": 0, "hidden": -1, "gray": 2}


@op
def set_visibility(layers=None, classes=None):
    """Show, hide or gray layers and classes in Vectorworks: {"Venue Steel": "gray"}."""
    for name, v in (layers or {}).items():
        if v not in VIS:
            raise OpError("Visibility is visible, hidden or gray, not %r" % v)
        h = vs.GetLayerByName(name)
        if _nil(h):
            raise OpError("No layer named %r." % name)
        vs.SetObjectVariableInt(h, 153, VIS[v])
    for name, v in (classes or {}).items():
        if v not in VIS:
            raise OpError("Visibility is visible, hidden or gray, not %r" % v)
        {"visible": vs.ShowClass, "hidden": vs.HideClass, "gray": vs.GrayClass}[v](name)
    _no_undo("changing what's visible (use the Navigation palette to change it back)")
    return {"layers": layers or {}, "classes": classes or {}}


@op
def find_reference_lines():
    """Lines, loci and text that look like the show's datum: CL / centerline, PL / plaster line,
    DSE / downstage edge, setting line, 0,0. Proposals only; a person confirms the datum."""
    pat = re.compile(r"\b(cl|c/l|centre ?line|center ?line|pl|p/l|plaster ?line|setting ?line|curtain ?line|dse|d/s edge|downstage edge|datum|0,0|zero ?point|center ?point)\b", re.I)
    found = []
    vs.ForEachObject(found.append, "(ALL)")
    out = []
    for h in found:
        t = vs.GetTypeN(h)
        if t not in (2, 5, 21, 10, 17):
            continue
        label = " ".join([_obj_name(h), _s(vs.GetClass(h)), _s(vs.GetText(h)) if t == 10 else ""])
        m = pat.search(label)
        if m:
            d = _describe(h)
            d["matched"] = m.group(0)
            out.append(d)
        if len(out) >= 50:
            break
    return {"count": len(out), "candidates": out}


@op
def import_dwg(path):
    """Import a DWG/DXF without the dialog (Vectorworks uses the last import settings) and report
    what arrived: new layers and classes, how many objects, and how big it is, to catch unit mix-ups."""
    if not os.path.isfile(_s(path)):
        raise OpError("No file at %r." % path)
    before_layers = set(l["name"] for l in _layers())
    before_classes = set(_classes())
    before = []
    vs.ForEachObject(before.append, "(ALL)")
    before_ids = set(_uuid(h) for h in before)
    code = vs.ImportDXFDWGFile(_s(path), True)
    after = []
    vs.ForEachObject(after.append, "(ALL)")
    new = [h for h in after if _uuid(h) not in before_ids and vs.GetTypeN(h) not in (31, 16, 92)]
    xs, ys = [], []
    for h in new:
        p1, p2 = vs.GetBBox(h)
        xs += [float(p1[0]), float(p2[0])]
        ys += [float(p1[1]), float(p2[1])]
    _no_undo("importing a DWG (use Ctrl+Z in Vectorworks)")
    return {
        "result_code": code, "new_objects": len(new),
        "new_layers": sorted(set(l["name"] for l in _layers()) - before_layers),
        "new_classes": sorted(set(_classes()) - before_classes),
        "extent": [[min(xs), min(ys)], [max(xs), max(ys)]] if xs else None,
        "units": _units(),
    }


@op
def scale_objects(ids, factor, center=None):
    """Scale 2D objects by `factor` about `center` (default: their combined middle). For a PDF or
    DWG that came in at the wrong scale: measure a known dimension first (check_scale)."""
    f = float(factor)
    if not f > 0:
        raise OpError("factor must be more than 0")
    hs = [_resolve(i) for i in ids]
    for h in hs:
        _require_editable(h)
    if center is None:
        bbs = [vs.GetBBox(h) for h in hs]
        cx = (min(float(b[0][0]) for b in bbs) + max(float(b[1][0]) for b in bbs)) / 2
        cy = (min(float(b[1][1]) for b in bbs) + max(float(b[0][1]) for b in bbs)) / 2
    else:
        cx, cy = _pt(center, "center")
    for h in hs:
        vs.HScale2D(h, cx, cy, f, f, True)
    _record("scale_objects", ids=[_uuid(h) for h in hs], factor=1.0 / f, center=[cx, cy])
    return {"objects": [_describe(h) for h in hs]}


# ---------------------------------------------------------------------------------------
# queue processing
# ---------------------------------------------------------------------------------------


def _write_result(job_id: str, payload: dict) -> None:
    RESULTS.mkdir(parents=True, exist_ok=True)
    tmp = RESULTS / ("%s.json.tmp" % job_id)
    tmp.write_text(json.dumps(payload, default=str), encoding="utf-8")
    os.replace(str(tmp), str(RESULTS / ("%s.json" % job_id)))


def _cleanup_stale(max_age_s: float = 3600) -> None:
    now = time.time()
    for p in list(RESULTS.glob("*.json")) + list(RESULTS.glob("*.tmp")):
        try:
            if now - p.stat().st_mtime > max_age_s:
                p.unlink()
        except OSError:
            pass


def run_pending(max_jobs: int = 50) -> int:
    """Run queued jobs, oldest first. Returns how many ran."""
    JOBS.mkdir(parents=True, exist_ok=True)
    RESULTS.mkdir(parents=True, exist_ok=True)
    pending = sorted(JOBS.glob("*.json"), key=lambda p: p.stat().st_mtime)[:max_jobs]
    ran = 0
    for job_path in pending:
        running = job_path.with_suffix(".running")
        try:
            os.replace(str(job_path), str(running))  # claim it; the server stops re-triggering
        except OSError:
            continue  # the server gave up on it, or another run claimed it
        job_id = job_path.stem
        del _pending_undo[:]
        _barrier[0] = None
        _NATIVE.clear()  # handles only mean something within one run
        _LOCAL_VP.clear()
        job = {}
        try:
            job = json.loads(running.read_text(encoding="utf-8"))
            if time.time() - float(job.get("created", 0)) > float(job.get("ttl", 120)):
                raise OpError("This request waited too long and was dropped, so it didn't run late.")
            fn = OPS.get(job["op"])
            if fn is None:
                raise OpError("Unknown op %r. The bridge (v%s) and server versions may not match; run vwmcp-install-plugin." % (job["op"], BRIDGE_VERSION))
            result = fn(**job.get("args", {}))
            _flush_journal(job["op"])
            _write_result(job_id, {"id": job_id, "ok": True, "result": result})
        except OpError as e:
            if _pending_undo or _barrier[0]:
                _flush_journal(job.get("op", "?"))  # a batch that failed partway keeps its undo
            _write_result(job_id, {"id": job_id, "ok": False, "error": str(e)})
        except Exception as e:
            if _pending_undo or _barrier[0]:
                _flush_journal(job.get("op", "?"))
            _write_result(job_id, {"id": job_id, "ok": False, "error": "%s: %s" % (type(e).__name__, e),
                                   "traceback": traceback.format_exc()})
        finally:
            try:
                running.unlink()
            except OSError:
                pass
            ran += 1
    if ran:
        vs.ReDrawAll()
        _cleanup_stale()
    return ran


def session(poll_ms: int = 250) -> None:
    """'MCP Session': a small dialog that answers Claude every poll_ms until you press Stop
    (or the server writes the stop file). Uses Vectorworks' dialog timer, the only timer a
    script gets, so Vectorworks stays responsive to its own redraws while it's open."""
    try:
        STOP.unlink()
    except OSError:
        pass
    state = {"jobs": 0, "since": time.time()}
    if not hasattr(vs, "DialogTimerEventMessageC"):
        vs.AlrtDialog("Session mode needs dialog timer events, which this Vectorworks doesn't offer. Use the MCP Run Job shortcut instead.")
        return
    timer_event = vs.DialogTimerEventMessageC()
    dialog = vs.CreateLayout("Claude is connected", False, "Stop", "Cancel")
    vs.CreateStaticText(dialog, 4, "Claude can draw and measure in this file.", 46)
    vs.CreateStaticText(dialog, 5, "Requests handled: 0", 46)
    vs.SetFirstLayoutItem(dialog, 4)
    vs.SetBelowItem(dialog, 4, 5, 0, 0)

    def handler(item, data):
        if item == 12255:  # SetupDialogC
            vs.RegisterDialogForTimerEvents(dialog, int(poll_ms))
        elif item == timer_event:
            n = run_pending()
            if n:
                state["jobs"] += n
                vs.SetControlText(dialog, 5, "Requests handled: %d" % state["jobs"])
            if STOP.exists():
                # Closing a dialog from its handler isn't documented, so say so and let them press Stop.
                vs.DeregisterDialogFromTimerEvents(dialog)
                vs.SetControlText(dialog, 4, "Claude ended the session. Press Stop.")
        elif item in (1, 2):
            vs.DeregisterDialogFromTimerEvents(dialog)
        return item

    vs.RunLayoutDialog(dialog, handler)
    try:
        STOP.unlink()
    except OSError:
        pass
