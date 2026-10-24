"""A stand-in for Vectorworks' `vs` module with an in-memory drawing.

Strict on purpose. Every function is checked, at call time, against the official signature
table (vw_plugin/vs_signatures.json): a wrong argument count, or two numbers where the
reference takes one POINT, raises ScriptErrors, which is what would put a blocking "Script
Errors" dialog in front of you in real Vectorworks.

Behaviour follows what the reference documents and what the tested macOS project found on
Vectorworks 2026: GetName gives "none" for unnamed objects, nil handles print as "0",
GetVersionEx major 31 = 2026, ResetObject applies at the end of a run.
"""

from __future__ import annotations

import functools
import json
import math
import re
import uuid
from pathlib import Path

SIGS = json.loads((Path(__file__).resolve().parent.parent / "vw_plugin" / "vs_signatures.json").read_text())["signatures"]
POINT_PARAMS = {"p", "p1", "p2", "center", "startPt", "endPt"}


class ScriptErrors(Exception):
    """Real Vectorworks would show its modal Script Errors dialog here."""


class _Nil:
    def __str__(self):
        return "0"

    __repr__ = __str__


NIL = _Nil()


class _Obj:
    def __init__(self, typ: int, **data):
        self.type = typ
        self.uuid = "{" + str(uuid.uuid4()).upper() + "}"
        self.name = ""
        self.cls = "None"
        self.layer = None
        self.selected = False
        self.records: dict[str, dict[str, str]] = {}
        self.parametric: str | None = None
        self.attrs: dict = {}
        self.__dict__.update(data)

    def __str__(self):
        return str(id(self))


class Doc:
    def __init__(self, units: str = "in"):
        self.fname = "Untitled Plot.vwx"
        self.layers: list[_Obj] = []
        self.objects: list[_Obj] = []
        self.classes = ["None", "Dimension"]
        self.active_class = "None"
        self.resources: dict[str, _Obj] = {}  # symbol definitions, record formats, folders
        self.last = None
        self.pen = (0.0, 0.0)
        self.text_origin = (0.0, 0.0)
        self.text_size = 10.0
        self.poly: list | None = None
        self.poly_closed = True
        self.redraws = 0
        self.menu_calls: list[str] = []
        self.units = units
        self.origin = (0.0, 0.0)
        self.path = r"C:\Shows\Untitled Plot.vwx"
        self.class_vis: dict = {}
        self.imported = 0
        self.active_layer = self._new_layer("Design Layer-1", 1)

    def _new_layer(self, name, kind=1):
        layer = _Obj(31, name=name, layer_type=kind, visibility=0, elevation=(0.0, 0.0), scale=48.0, referenced_file=None)
        self.layers.append(layer)
        return layer

    def add(self, obj):
        obj.layer = self.active_layer
        obj.cls = self.active_class
        self.objects.append(obj)
        self.last = obj
        return obj


DOC = Doc()


def reset(units: str = "in"):
    global DOC
    DOC = Doc(units)
    return DOC


def _pt(p):
    return (float(p[0]), float(p[1]))


# ---- document / layers / classes ---------------------------------------------------------


def GetFName():
    return DOC.fname


def GetVersionEx():
    return (31, 3, 0, 2, 846827)  # Vectorworks 2026 Update 3, Windows


def GetUnits():
    if DOC.units == "mm":
        return (0, 2, 0, 25.4, "mm", "sq m")
    return (25, 3, 3, 1.0, '"', " sq ft")  # feet-and-inches plot


def FLayer():
    return DOC.layers[0] if DOC.layers else NIL


def NextLayer(h):
    i = DOC.layers.index(h)
    return DOC.layers[i + 1] if i + 1 < len(DOC.layers) else NIL


def GetObjectVariableInt(h, index):
    if index == 154:
        return h.layer_type
    if index == 153:
        return h.visibility
    raise ScriptErrors(f"selector {index} not faked")


def SetObjectVariableInt(h, index, value):
    if index != 153:
        raise ScriptErrors(f"selector {index} not faked")
    h.visibility = value


def GetObjectVariableBoolean(h, index):
    if index == 650:  # object is 3D
        return getattr(h, "is3d", False)
    raise ScriptErrors(f"boolean selector {index} not faked")


def GetLName(h):
    return h.name


def ActLayer():
    return DOC.active_layer


def GetLayerByName(layerName):
    return next((l for l in DOC.layers if l.name == layerName), NIL)


def Layer(name):
    layer = GetLayerByName(name)
    if layer is NIL:
        layer = DOC._new_layer(name)
    DOC.active_layer = layer


def CreateLayer(layerName, layerType):
    layer = GetLayerByName(layerName)
    return layer if layer is not NIL else DOC._new_layer(layerName, layerType)


def GetLayer(h):
    return _layer_of(h)


def ClassNum():
    return len(DOC.classes)


def ClassList(index):
    return DOC.classes[index - 1]


def ActiveClass():
    return DOC.active_class


def NameClass(clasName):
    if clasName not in DOC.classes:
        DOC.classes.append(clasName)
    DOC.active_class = clasName


def GetClass(h):
    return h.cls


def SetClass(h, clas):
    if clas not in DOC.classes:
        DOC.classes.append(clas)
    h.cls = clas


def SetParent(obj, container):
    if getattr(container, "type", None) != 31:
        return False
    obj.layer = container
    return True


# ---- naming / lookup --------------------------------------------------------------------


def GetName(h):
    if getattr(h, "type", None) in (16, 47, 92):
        return h.name
    return h.name or "none"  # what Vectorworks 2026 gives for an unnamed object


def SetName(h, name):
    if name and any(o is not h and o.name == name for o in DOC.objects):
        raise ScriptErrors(f"name {name!r} already used")
    h.name = name


def GetObjectUuid(h):
    return h.uuid


def GetObjectByUuid(UUID):
    return next((o for o in _walk_all() if o.uuid == UUID), NIL)


def GetObject(name):
    if name in DOC.resources:
        return DOC.resources[name]
    return next((o for o in DOC.objects if o.name == name), NIL)


def GetTypeN(h):
    return h.type


def LNewObj():
    return DOC.last if DOC.last in DOC.objects else NIL


def NumSelectedObjects():
    return sum(o.selected for o in DOC.objects)


# ---- creation ---------------------------------------------------------------------------


def MoveTo(p):
    DOC.pen = _pt(p)


def LineTo(p):
    DOC.add(_Obj(2, pts=[DOC.pen, _pt(p)]))
    DOC.pen = _pt(p)


def Rect(p1, p2):
    (x1, y1), (x2, y2) = _pt(p1), _pt(p2)
    if y1 < y2 or x1 > x2:
        raise ScriptErrors("Rect expects top-left then bottom-right")
    DOC.add(_Obj(3, pts=[(x1, y1), (x2, y1), (x2, y2), (x1, y2)]))


def Oval(p1, p2):
    (x1, y1), (x2, y2) = _pt(p1), _pt(p2)
    DOC.add(_Obj(4, cx=(x1 + x2) / 2, cy=(y1 + y2) / 2, rx=abs(x2 - x1) / 2, ry=abs(y1 - y2) / 2))


def ArcByCenter(x, y, radius, startAngl, sweepAngle):
    DOC.add(_Obj(6, cx=float(x), cy=float(y), r=float(radius), start=float(startAngl), sweep=float(sweepAngle)))


def ClosePoly():
    DOC.poly_closed = True


def OpenPoly():
    DOC.poly_closed = False


def BeginPoly():
    DOC.poly = []


def AddPoint(p):
    DOC.poly.append(_pt(p))


def EndPoly():
    DOC.add(_Obj(5, pts=DOC.poly, closed=DOC.poly_closed))
    DOC.poly = None


def TextSize(size):
    DOC.text_size = float(size)


def TextOrigin(p):
    DOC.text_origin = _pt(p)


def CreateText(theText):
    x, y = DOC.text_origin
    DOC.add(_Obj(10, text=theText, size=DOC.text_size, pts=[(x, y)]))


def Symbol(symbolName, p, rotationAngle):
    d = DOC.resources[symbolName]
    DOC.add(_Obj(15, symbol=symbolName, loc=_pt(p), w=d.w, h=d.h, rot=rotationAngle))


def CreateCustomObjectN(objectName, p, rotationAngle, showPref):
    if objectName not in DOC.resources:
        return NIL
    o = DOC.add(_Obj(86, loc=_pt(p), w=10.0, h=14.0, parametric=objectName))
    o.records[objectName] = {f: "" for f in DOC.resources[objectName].fields}
    return o


def LinearDim(startPt, endPt, offsetDistance, dimType, arrow, textFlag, textOffset):
    DOC.add(_Obj(63, pts=[_pt(startPt), _pt(endPt)]))


def Wall(p1, p2):
    DOC.add(_Obj(68, pts=[_pt(p1), _pt(p2)], thickness=4.0, height=96.0))


def SetComponentWidth(object, componentIndex, width):
    object.thickness = width
    return True


def SetWallCornerHeights(theWall, startHeightTop, startHeightBottom, endHeightTop, endHeightBottom):
    theWall.height = startHeightTop
    return True


def HDuplicate(objectHandle, x, y):
    import copy

    o = copy.copy(objectHandle)
    o.uuid = "{" + str(uuid.uuid4()).upper() + "}"
    o.name = ""
    o.records = {k: dict(v) for k, v in objectHandle.records.items()}
    DOC.objects.append(o)
    DOC.last = o
    HMove(o, x, y)
    return o


# ---- geometry queries -------------------------------------------------------------------


def _points(h):
    if h.type in (2, 3, 5, 10, 63, 68):
        return list(h.pts)
    if h.type == 4:
        return [(h.cx - h.rx, h.cy - h.ry), (h.cx + h.rx, h.cy + h.ry)]
    if h.type == 6:  # the arc itself, not its full circle
        a0, sweep = math.radians(h.start), math.radians(h.sweep)
        n = 64
        return [(h.cx + h.r * math.cos(a0 + sweep * i / n), h.cy + h.r * math.sin(a0 + sweep * i / n)) for i in range(n + 1)]
    if h.type in (15, 86):
        x, y = h.loc
        return [(x - h.w / 2, y - h.h / 2), (x + h.w / 2, y + h.h / 2)]
    if h.type in (11, 122):
        return [p for m in h.members for p in _points(m)]
    raise ScriptErrors(f"GetBBox of type {h.type} not faked")


def GetBBox(h):
    pts = _points(h)
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    if h.type == 10:  # pretend text is 1" tall, 0.6" per character
        return (xs[0], ys[0] + 1.0), (xs[0] + 0.6 * len(h.text), ys[0])
    return (min(xs), max(ys)), (max(xs), min(ys))


def HCenter(h):
    if h.type in (4, 6):
        return (h.cx, h.cy)
    (x0, y1), (x1, y0) = GetBBox(h)
    return ((x0 + x1) / 2, (y0 + y1) / 2)


def GetSegPt1(h):
    return h.pts[0]


def GetSegPt2(h):
    return h.pts[1]


def GetVertNum(PolyHd):
    return len(PolyHd.pts)


def GetPolyPt(objectHd, index):
    return objectHd.pts[index - 1]


def GetPolylineVertex(obj, vertexNum):
    return (obj.pts[vertexNum - 1], 0, 0.0)


def IsPolyClosed(polyHandle):
    return getattr(polyHandle, "closed", True)


def GetArc(h):
    return (h.start, h.sweep)


def GetText(objectHd):
    return objectHd.text


def GetSymName(symHd):
    return symHd.symbol


def GetSymLoc(symHd):
    return symHd.loc


def HPerim(h):
    pts = h.pts
    return sum(math.dist(a, b) for a, b in zip(pts, pts[1:] + pts[:1]))


# ---- editing ----------------------------------------------------------------------------


def HMove(h, xOffset, yOffset):
    dx, dy = float(xOffset), float(yOffset)
    if hasattr(h, "pts"):
        h.pts = [(x + dx, y + dy) for x, y in h.pts]
    if hasattr(h, "cx"):
        h.cx += dx
        h.cy += dy
    if hasattr(h, "loc"):
        h.loc = (h.loc[0] + dx, h.loc[1] + dy)
    for m in getattr(h, "members", []):
        HMove(m, dx, dy)


def HRotate(h, center, rotationAngle):
    c = _pt(center)
    a = math.radians(rotationAngle)
    cos, sin = math.cos(a), math.sin(a)

    def rot(p):
        x, y = p[0] - c[0], p[1] - c[1]
        return (c[0] + x * cos - y * sin, c[1] + x * sin + y * cos)

    if hasattr(h, "pts"):
        h.pts = [rot(p) for p in h.pts]
        if h.type == 3:  # a rotated rectangle stops being axis-aligned; keep it simple: polygon
            h.type, h.closed = 5, True
    if hasattr(h, "cx"):
        h.cx, h.cy = rot((h.cx, h.cy))
        if h.type == 6:
            h.start += rotationAngle
    if hasattr(h, "loc"):
        h.loc = rot(h.loc)


def ResetObject(objectHandle):
    pass


def DelObject(h):
    DOC.objects.remove(h)


def ReDrawAll():
    DOC.redraws += 1


def DSelectAll():
    for o in DOC.objects:
        o.selected = False


def SetSelect(h):
    h.selected = True


def Group():
    members = [o for o in DOC.objects if o.selected]
    for m in members:
        DOC.objects.remove(m)
    g = DOC.add(_Obj(11, members=members))
    g.layer = members[0].layer if members else DOC.active_layer


def DoMenuTextByName(subMenu, index):
    DOC.menu_calls.append(subMenu)


def SetPenFore(h, color):
    assert isinstance(color, tuple) and len(color) == 3 and all(0 <= c <= 65535 for c in color)
    h.attrs["pen"] = color


def SetFillBack(h, color):
    assert isinstance(color, tuple) and len(color) == 3
    h.attrs["fill"] = color


def SetLW(h, lw):
    h.attrs["lw"] = lw


def SetFPat(h, fillPattern):
    h.attrs["fpat"] = fillPattern


# ---- records ----------------------------------------------------------------------------


def GetParametricRecord(h):
    return DOC.resources[h.parametric] if getattr(h, "parametric", None) else NIL


def NumRecords(h):
    return len(h.records)


def GetRecord(h, cnt):
    names = list(h.records)
    return DOC.resources[names[cnt - 1]] if cnt <= len(names) else NIL


def NumFields(h):
    return len(h.fields)


def GetFldName(h, index):
    return h.fields[index - 1]


def GetRField(h, record, field):
    return h.records.get(record, {}).get(field, "")


def SetRField(h, record, field, value):
    h.records.setdefault(record, {})[field] = str(value)


# ---- symbols ----------------------------------------------------------------------------


def FSymDef():
    defs = [r for r in DOC.resources.values() if r.type in (16, 92) and not getattr(r, "parent", None)]
    return defs[0] if defs else NIL


def NextSymDef(symHd):
    siblings = [r for r in DOC.resources.values() if r.type in (16, 92) and getattr(r, "parent", None) == getattr(symHd, "parent", None)]
    i = siblings.index(symHd)
    return siblings[i + 1] if i + 1 < len(siblings) else NIL


def FInFolder(sfHd):
    kids = [r for r in DOC.resources.values() if getattr(r, "parent", None) is sfHd]
    return kids[0] if kids else NIL


# ---- search -----------------------------------------------------------------------------

_T = {"LINE": 2, "RECT": 3, "OVAL": 4, "POLY": 5, "ARC": 6, "TEXT": 10, "GROUP": 11, "SYMBOL": 15,
      "POLYLINE": 21, "DIMENSION": 63, "WALL": 68, "PLUGINOBJECT": 86, "LOCUS": 17, "VIEWPORT": 122}


def _walk_all():
    """Everything a criteria search sees: objects, group members, and what viewports show."""
    for o in list(DOC.objects):
        yield o
        stack = list(getattr(o, "members", []))
        while stack:
            m = stack.pop(0)
            yield m
            stack.extend(getattr(m, "members", []))


def ForEachObject(callback, c):
    modifiers = set(re.findall(r"\b(NOTINREFDLVP|NOTINDLVP|INSYMBOL|INOBJECT|INVIEWPORT)\b", c))
    terms = re.findall(r"\(([A-Z]+)=?'?([^')]*)'?\)", c)
    if not terms:
        raise ScriptErrors(f"criteria {c!r}")
    for o in _walk_all():
        vp = _viewport_of(o)
        if vp is not None and vp.referenced and "NOTINREFDLVP" in modifiers:
            continue
        if vp is not None and not vp.referenced and "NOTINDLVP" in modifiers:
            continue
        ok = True
        for key, val in terms:
            if key == "ALL":
                continue
            if key == "L":
                ok &= _layer_of(o).name == val
            elif key == "C":
                ok &= o.cls == val
            elif key == "SEL":
                ok &= o.selected == (val == "TRUE")
            elif key == "PON":
                ok &= getattr(o, "parametric", None) == val
            elif key == "T":
                ok &= o.type == (_T[val] if not val.isdigit() else int(val))
            else:
                raise ScriptErrors(f"criteria key {key} not faked")
        if ok:
            callback(o)


def _viewport_of(o):
    p = getattr(o, "parent_obj", None)
    while p is not None:
        if p.type == 122:
            return p
        p = getattr(p, "parent_obj", None)
    return None


def _layer_of(o):
    while getattr(o, "layer", None) is None and getattr(o, "parent_obj", None) is not None:
        o = o.parent_obj
    return o.layer


# ---- dialogs (session mode) -------------------------------------------------------------


def AlrtDialog(message):
    DOC.menu_calls.append(f"alert: {message}")



# ---- containers, heights, walls, layers, origin (survey / rigging) ---------------------


def GetParent(h):
    return getattr(h, "parent_obj", None) or getattr(h, "layer", None) or NIL


def FInGroup(ObjectHd):
    m = getattr(ObjectHd, "members", [])
    return m[0] if m else NIL


def NextObj(h):
    sib = getattr(getattr(h, "parent_obj", None), "members", None)
    if sib is None:
        return NIL
    i = sib.index(h)
    return sib[i + 1] if i + 1 < len(sib) else NIL


def GetSymLoc3D(objectHandle):
    x, y = objectHandle.loc
    return (x, y, getattr(objectHandle, "z", 0.0))


def Get3DInfo(h):
    (x0, y1), (x1, y0) = GetBBox(h)
    return (y1 - y0, x1 - x0, h.dz)  # height (dY), width (dX), depth (dZ), as documented


def Get3DCntr(h):
    (x0, y1), (x1, y0) = GetBBox(h)
    return (((x0 + x1) / 2, (y0 + y1) / 2), h.zc)


def GetWallThickness(h):
    return (True, h.thickness)


def GetWallCornerHeights(theWall):
    return (theWall.height, 0.0, theWall.height, 0.0)


def GetLayerElevationN(h):
    return h.elevation


def IsLayerReferenced(layer):
    return (layer.referenced_file is not None, layer.referenced_file or "")


def GetLScale(h):
    return h.scale


def GetOriginInDocUnits():
    return DOC.origin


def GetFPathName():
    return DOC.path


def ShowClass(clasName):
    DOC.class_vis[clasName] = 0


def HideClass(clasName):
    DOC.class_vis[clasName] = -1


def GrayClass(clasName):
    DOC.class_vis[clasName] = 2


def ImportDXFDWGFile(fileName, isBatch):
    """Pretend DWG: an architect's venue in millimetres, as a layer of lines (DWG layers -> classes)."""
    if not isBatch:
        raise ScriptErrors("a dialog would open")
    layer = DOC._new_layer("Venue DWG", 1)
    prev = DOC.active_layer
    DOC.active_layer = layer
    for i, (a, b) in enumerate([((-20000.0, 15000.0), (20000.0, 15000.0)), ((-20000.0, 21000.0), (20000.0, 21000.0))]):
        o = DOC.add(_Obj(2, pts=[a, b]))
        o.cls = "A-STEEL"
        if "A-STEEL" not in DOC.classes:
            DOC.classes.append("A-STEEL")
    DOC.active_layer = prev
    DOC.imported += 1
    return 0


def HScale2D(h, centerX, centerY, scaleX, scaleY, scaleText):
    def sc(p):
        return (centerX + (p[0] - centerX) * scaleX, centerY + (p[1] - centerY) * scaleY)

    if hasattr(h, "pts"):
        h.pts = [sc(p) for p in h.pts]
    if hasattr(h, "cx"):
        h.cx, h.cy = sc((h.cx, h.cy))
        if hasattr(h, "rx"):
            h.rx *= scaleX
            h.ry *= scaleY
        if hasattr(h, "r"):
            h.r *= scaleX
    if hasattr(h, "loc"):
        h.loc = sc(h.loc)

# ---- strict signatures ------------------------------------------------------------------


def _strict(name, fn):
    params = SIGS.get(name)

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if kwargs:
            raise ScriptErrors(f"vs.{name} called with keywords")
        if params is not None and len(args) != len(params):
            raise ScriptErrors(f"vs.{name} takes {len(params)} arguments ({', '.join(params)}), got {len(args)}")
        for p, a in zip(params or [], args):
            if p in POINT_PARAMS and not (isinstance(a, (tuple, list)) and len(a) == 2):
                raise ScriptErrors(f"vs.{name}: {p} must be one (x, y) point, got {a!r}")
        return fn(*args)

    return wrapper


for _name, _fn in list(globals().items()):  # noqa: E305
    if _name[:1].isupper() and callable(_fn) and _name not in {"Doc", "ScriptErrors"} and not isinstance(_fn, type):
        globals()[_name] = _strict(_name, _fn)


# ---- seeding a demo plot ----------------------------------------------------------------


LD_FIELDS = ["Inst Type", "Channel", "Unit Number", "Position", "Purpose", "Color", "Wattage", "Weight",
             "Universe", "DMX Address", "UniverseAddress", "Symbol Name", "Dimmer", "Circuit Number"]


def seed_demo():
    """A small plot: a stage deck, a 20' truss on its own layer with four lighting devices."""
    folder = _Obj(92, name="Rigging")
    DOC.resources["Rigging"] = folder
    DOC.resources["Truss 20ft"] = _Obj(16, name="Truss 20ft", w=240.0, h=12.0, parent=folder)
    DOC.resources["Source Four 26"] = _Obj(16, name="Source Four 26", w=10.0, h=14.0)
    DOC.resources["Lighting Device"] = _Obj(47, name="Lighting Device", fields=LD_FIELDS)
    Rect((-180.0, 60.0), (180.0, -60.0))
    DOC.last.name = "Deck"
    Layer("Lighting")
    Symbol("Truss 20ft", (0.0, 120.0), 0.0)
    DOC.last.name = "Electric 1"
    for i, x in enumerate([-90, -30, 30, 90], start=1):
        dev = CreateCustomObjectN("Lighting Device", (float(x), 120.0), 0.0, False)
        dev.records["Lighting Device"].update(dict(zip(LD_FIELDS, [
            "Source Four 26deg", str(100 + i), str(i), "Electric 1", "Front", "R60", "575W", "17 lb",
            "1", str(i), f"1/{i}", "Source Four 26", "", "",
        ])))
    Layer("Design Layer-1")



# ---- a whole show: every situation a head rigger meets ------------------------------------

HOIST_FIELDS = ["Hoist ID", "Hoist Name", "Capacity", "Position", "Hoist Weight", "Chain Length", "Trim Height", "ReactionForce"]
TRUSS_FIELDS = ["Name", "Truss Type", "Length"]
LOAD_FIELDS = ["Load ID", "Load Name", "Load Category", "Total Weight", "Position"]


def _pio(plugin, fields, loc, w, h, values, z=0.0, layer=None, name=""):
    if plugin not in DOC.resources:
        DOC.resources[plugin] = _Obj(47, name=plugin, fields=fields)
    o = DOC.add(_Obj(86, loc=loc, w=w, h=h, parametric=plugin, z=z, name=name))
    o.records[plugin] = {f: "" for f in fields}
    o.records[plugin].update(values)
    if layer is not None:
        o.layer = layer
    return o


def seed_show():
    """A theatre-style plot in inches, CL x PL at 0,0, audience at the bottom of the page.

    Venue steel (two beams + a scoreboard obstruction), a wall, CL and PL lines; LX1 truss under
    Beam A on three hoists (dead hangs, a continuous span), LX2 between the beams on two hoists
    (bridles); twelve fixtures with weights; a scenic header built from a group and a 3D flat;
    audio arriving through a REFERENCED viewport, video through a local one."""
    DOC.fname = "Spring Tour - Rigging.vwx"
    DOC.path = r"C:\Shows\Spring Tour\Spring Tour - Rigging.vwx"
    seed_demo_resources()
    venue = DOC._new_layer("Venue Steel")
    venue.elevation = (0.0, 0.0)
    for name, y in (("Beam A", 240.0), ("Beam B", 480.0)):
        DOC.active_layer = venue
        MoveTo((-600.0, y))
        LineTo((600.0, y))
        DOC.last.name, DOC.last.cls = name, "House-Steel"
    Rect((-60.0, 420.0), (60.0, 300.0))
    DOC.last.name, DOC.last.cls = "Scoreboard", "House-Obstruction"
    Wall((-600.0, -200.0), (600.0, -200.0))
    DOC.last.name = "Back of house wall"
    for name, a, b in (("CL", (0.0, -120.0), (0.0, 600.0)), ("PL", (-600.0, 0.0), (600.0, 0.0))):
        MoveTo(a)
        LineTo(b)
        DOC.last.name, DOC.last.cls = name, "Reference Lines"

    rig = DOC._new_layer("Rigging")
    DOC.active_layer = rig
    _pio("Truss", TRUSS_FIELDS, (0.0, 240.0), 480.0, 20.5, {"Name": "LX1", "Truss Type": "20.5in box", "Length": "40'"}, z=480.0, name="LX1")
    _pio("Truss", TRUSS_FIELDS, (0.0, 360.0), 360.0, 20.5, {"Name": "LX2", "Truss Type": "20.5in box", "Length": "30'"}, z=480.0, name="LX2")
    for hid, x, y, pos in (("1", -200.0, 240.0, "LX1"), ("2", 0.0, 240.0, "LX1"), ("3", 200.0, 240.0, "LX1"),
                           ("4", -150.0, 360.0, "LX2"), ("5", 150.0, 360.0, "LX2")):
        _pio("Hoist", HOIST_FIELDS, (x, y), 12.0, 12.0, {"Hoist ID": hid, "Hoist Name": "CM Lodestar 1 ton", "Capacity": "2000 lb",
             "Position": pos, "Hoist Weight": "116 lb", "Chain Length": "60'", "Trim Height": "40'"}, z=600.0)

    lx = DOC._new_layer("Lighting")
    DOC.active_layer = lx
    fields = ["Inst Type", "Channel", "Unit Number", "Position", "Purpose", "Color", "Wattage", "Weight", "Universe", "DMX Address", "UniverseAddress", "Symbol Name"]
    if "Lighting Device" not in DOC.resources:
        DOC.resources["Lighting Device"] = _Obj(47, name="Lighting Device", fields=fields)
    ch = 101
    for pos, y, xs in (("LX1", 240.0, [-210, -150, -90, -30, 30, 90, 150, 210]), ("LX2", 360.0, [-165, -55, 55, 165])):
        for i, x in enumerate(xs, start=1):
            d = _pio("Lighting Device", fields, (float(x), y), 10.0, 14.0, {"Inst Type": "Spot 400", "Channel": str(ch), "Unit Number": str(i),
                     "Position": pos, "Purpose": "Wash", "Weight": "55 lb", "Symbol Name": "Source Four 26"}, z=470.0)
            d.cls = "Lighting-Fixtures"
            ch += 1

    scenic = DOC._new_layer("Scenic")
    DOC.active_layer = scenic
    header = DOC.add(_Obj(11, members=[], name="Header"))
    for a, b in (((-300.0, 120.0), (300.0, 120.0)), ((-300.0, 132.0), (300.0, 132.0)), ((-300.0, 120.0), (-300.0, 132.0))):
        m = _Obj(2, pts=[a, b], parent_obj=header, layer=None)
        m.cls = "Scenic"
        header.members.append(m)
    flat = DOC.add(_Obj(5, pts=[(-120.0, 150.0), (120.0, 150.0), (120.0, 156.0), (-120.0, 156.0)], closed=True, is3d=True, zc=144.0, dz=288.0, name="Flat 1"))
    flat.cls = "Scenic"

    deck = DOC._new_layer("Stage Deck")
    DOC.active_layer = deck
    Rect((-360.0, 240.0), (360.0, -60.0))
    DOC.last.name = "Deck"

    audio = DOC._new_layer("Audio (referenced)")
    audio.referenced_file = None  # DLVP referencing: the layer itself isn't a referenced layer
    vp = DOC.add(_Obj(122, members=[], name="Audio from Spring Tour - Audio.vwx", referenced=True))
    vp.layer = audio
    for name, x in (("PA-L", -420.0), ("PA-R", 420.0)):
        o = _Obj(86, loc=(x, 60.0), w=40.0, h=40.0, parametric="Point Load", z=540.0, name=name, parent_obj=vp, layer=None)
        if "Point Load" not in DOC.resources:
            DOC.resources["Point Load"] = _Obj(47, name="Point Load", fields=LOAD_FIELDS)
        o.records["Point Load"] = {"Load ID": name, "Load Name": "K2 x 12", "Load Category": "Audio", "Total Weight": "1850 lb", "Position": name}
        vp.members.append(o)

    video = DOC._new_layer("Video")
    vvp = DOC.add(_Obj(122, members=[], name="Video layout", referenced=False))
    vvp.layer = video
    led = _Obj(3, pts=[(-240.0, 420.0), (240.0, 420.0), (240.0, 408.0), (-240.0, 408.0)], parent_obj=vvp, layer=None, name="LED Wall")
    led.cls = "Video-LED"
    vvp.members.append(led)
    DOC.active_layer = DOC.layers[0]


def seed_demo_resources():
    DOC.resources.setdefault("Source Four 26", _Obj(16, name="Source Four 26", w=10.0, h=14.0))
