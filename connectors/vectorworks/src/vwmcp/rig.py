"""Rig Planner build lists (docs/RIG.md, v1) turned into Vectorworks placements. Pure math, no `vs`.

Everything here is in INCHES and the build list's axes (X right, Y away from the front, Z up).
The bridge converts to drawing units when it places things.

What Vectorworks needs, measured by hand on 2026-11-07 (docs/RIG.md):
  - A Straight Truss's insertion is its START, centered on the width, Z = bottom face.
  - Stood vertical with "Hanging Angle" 90, it pivots so the leg lands half the width toward -X:
    put the insertion half the width toward +X to cancel it.
  - Pipes and clamps are 3D-only symbols: they rotate freely in 3D. Pipe: insertion at one end,
    length along local +X. Swivel clamp: local Z = swivel axis pointing from the chord to the
    pipe; the pipe's bore is local X through the origin; the chord's bore is (1, -1, 0)/sqrt 2 at
    local z = -offset (the 45 degree clamp).
"""

from __future__ import annotations

import json
import math
import re
import urllib.error
import urllib.request
from dataclasses import dataclass, field

Vec = tuple  # (x, y, z)
EPS = 1e-6


class RigError(ValueError):
    """A build list or a part that can't be built (said in words a rigger can act on)."""


# ---------------------------------------------------------------------------------------
# vectors and frames
# ---------------------------------------------------------------------------------------


def v3(p, what: str = "vector") -> Vec:
    if not isinstance(p, (list, tuple)) or len(p) != 3:
        raise RigError("%s must be [x, y, z], got %r" % (what, p))
    try:
        out = tuple(float(c) for c in p)
    except (TypeError, ValueError):
        raise RigError("%s must be three numbers, got %r" % (what, p)) from None
    if not all(math.isfinite(c) for c in out):
        raise RigError("%s must be finite, got %r" % (what, p))
    return out


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def mul(a, k):
    return (a[0] * k, a[1] * k, a[2] * k)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def norm(a):
    return math.sqrt(dot(a, a))


def unit(a, what: str = "direction"):
    n = norm(a)
    if n < EPS:
        raise RigError("%s has no length" % what)
    return mul(a, 1.0 / n)


def det3(x, y, z):
    """Determinant of the matrix whose COLUMNS are x, y, z."""
    return dot(x, cross(y, z))


@dataclass(frozen=True)
class Frame:
    """A placement orientation. `rot` is the proper rotation (columns = where local X, Y, Z go);
    `mirrored` means the symbol is reflected in its local Y first (Flip Vertical in plan), so the
    final orientation is rot * diag(1, -1, 1) and its local Y lands on -rot's Y column."""

    x: Vec
    y: Vec
    z: Vec
    mirrored: bool

    def matrix(self):
        """Rows of the 3x3 proper rotation (columns x, y, z)."""
        return [[self.x[i], self.y[i], self.z[i]] for i in range(3)]

    def local_to_world(self, p):
        """Where a point given in the symbol's own coordinates ends up (relative to insertion)."""
        py = -p[1] if self.mirrored else p[1]
        return add(add(mul(self.x, p[0]), mul(self.y, py)), mul(self.z, p[2]))


def frame_from_axes(x_axis, z_axis, y_axis=None, mirror: bool = False) -> Frame:
    """Orientation from where local X and local Z should point. Z is squared up to X.
    If a y_axis is given and [x, y, z] is left-handed, or mirror=True, the frame is mirrored."""
    x = unit(v3(x_axis, "x_axis"), "x_axis")
    z0 = v3(z_axis, "z_axis")
    z = sub(z0, mul(x, dot(z0, x)))
    if norm(z) < 1e-4:
        raise RigError("x_axis and z_axis are parallel; they must be at an angle")
    z = unit(z)
    y = cross(z, x)  # right-handed
    mirrored = bool(mirror)
    if y_axis is not None:
        yy = v3(y_axis, "y_axis")
        if norm(yy) < EPS:
            raise RigError("y_axis has no length")
        if dot(yy, y) < 0:
            mirrored = not mirrored
    return Frame(x, y, z, mirrored)


def euler_xyz(rows) -> tuple:
    """Angles (degrees) a, b, c with R = Rz(c) . Ry(b) . Rx(a): rotate about world X by a, then
    world Y by b, then world Z by c. Right-hand rule (counter-clockwise looking down the axis)."""
    r20 = max(-1.0, min(1.0, rows[2][0]))
    b = math.asin(-r20)
    if abs(math.cos(b)) > 1e-9:
        a = math.atan2(rows[2][1], rows[2][2])
        c = math.atan2(rows[1][0], rows[0][0])
    else:  # gimbal lock: X and Z rotations coincide; put it all in Z
        a = 0.0
        c = math.atan2(-rows[0][1], rows[1][1])
    return tuple(_clean(math.degrees(t)) for t in (a, b, c))


def _clean(deg: float) -> float:
    d = round(deg, 9)
    return 0.0 if d == 0 else d


def rot_xyz(a: float, b: float, c: float):
    """Rows of Rz(c) . Ry(b) . Rx(a) (degrees). The inverse of euler_xyz."""
    a, b, c = (math.radians(t) for t in (a, b, c))
    ca, sa, cb, sb, cc, sc = math.cos(a), math.sin(a), math.cos(b), math.sin(b), math.cos(c), math.sin(c)
    return [
        [cc * cb, cc * sb * sa - sc * ca, cc * sb * ca + sc * sa],
        [sc * cb, sc * sb * sa + cc * ca, sc * sb * ca - cc * sa],
        [-sb, cb * sa, cb * ca],
    ]


# ---------------------------------------------------------------------------------------
# library symbols (names as they are in Tyler's file, 2026-11-07)
# ---------------------------------------------------------------------------------------

SERIES_SYMBOL_PREFIX = {"box12": "Truss Box 12in x 12in", "box24": "Truss Box 24in x 24in"}
TRUSS_SYMBOL_LENGTHS_FT = (10, 8, 6)  # any works as a starting point: the length is set after
CLAMP_SYMBOLS = {
    0: "Aluminium Scaffold Clamp- 0 Deg",
    15: "Aluminium Scaffold Clamp-15 Deg",
    30: "Aluminium Scaffold Clamp-30 Deg",
    45: "Aluminium Scaffold Clamp-45 Deg",
    60: "Aluminium Scaffold Clamp-60 Deg",
    75: "Aluminium Scaffold Clamp-75 Deg",
    90: "Aluminium Scaffold Clamp-90deg",
}
CLAMP_OFFSET = 3.0  # inches between the two bores of the library swivel
PIPE_RE = re.compile(r"^Pipe 1\.5in-(\d+)ft(?:-(\d+)in)? Length$")
PIPE_OD = 1.9  # 1-1/2" schedule 40

# Stage decks: Vectorworks' own library (Libraries > Defaults > Stage Deck), measured 2026-11-07.
# A bare deck symbol ("Stage Deck 4ft x 8ft") has its insertion at its plan center with the long
# side along X; its frame's underside is the insertion Z. Legs ("Stage Deck Leg 24in") stand on the
# floor at their insertion. The bare decks aren't listed on their own in the Resource Manager:
# by hand, importing an assembled deck ("Stage Deck 4ft x 8ft x 2ft") brings one in. The
# connector's import_symbols reads the library files directly, so it imports the bare deck.
DECK_LEG_HEIGHTS = tuple(range(8, 61, 4))
NOT_IN_LIBRARY = {
    "skirt": "the library has no stage skirting; it's on the rental list",
    "rail": "the library has no stage guardrail; it's on the rental list",
    "stairs": "the library has no stage stair unit; it's on the rental list",
}


def _ft(inches: float) -> str:
    return "%gft" % (float(inches) / 12.0)


def deck_symbol(width: float, length: float) -> str:
    return "Stage Deck %s x %s" % (_ft(width), _ft(length))


def deck_import_name(width: float, length: float) -> str:
    return deck_symbol(width, length) + " x 2ft"


def leg_symbol(height: float) -> str:
    h = float(height)
    if not any(abs(h - x) < 0.01 for x in DECK_LEG_HEIGHTS):
        raise RigError("no %g\" deck leg in the library: legs come in 4\" steps from 8\" to 60\"" % h)
    return "Stage Deck Leg %gin" % h


# 20.5" box isn't in Vectorworks' library. These are the Total Structures (SLV) symbols in the Air
# Pro self-climber drawing (Aspect Lighting, 2022), used when the open file has them.
FILE_ONLY_SERIES = {"box20": ["Truss 20.5\" Box 10' (SLV)", "Truss 20.5\" Box 5' (SLV)", "Truss 20.5\" Box 4' (SLV)"]}


def truss_symbol_candidates(series_id: str) -> list:
    if series_id in FILE_ONLY_SERIES:
        return list(FILE_ONLY_SERIES[series_id])
    prefix = SERIES_SYMBOL_PREFIX.get(series_id)
    if prefix is None:
        raise RigError("No truss symbol for series %r. Known: %s." % (series_id, ", ".join(sorted([*SERIES_SYMBOL_PREFIX, *FILE_ONLY_SERIES]))))
    return ["%s x %dft" % (prefix, ft) for ft in TRUSS_SYMBOL_LENGTHS_FT]


def pipe_lengths(available) -> dict:
    """{length in inches: symbol name} for every 1.5" pipe symbol in the file."""
    out = {}
    for name in available:
        m = PIPE_RE.match(name)
        if m:
            out[int(m.group(1)) * 12 + int(m.group(2) or 0)] = name
    return out


def choose_pipe(length: float, available) -> dict:
    """The pipe symbol for a length: exact if the file has it, else the nearest (ties: longer)."""
    lengths = pipe_lengths(available)
    if not lengths:
        raise RigError("no 'Pipe 1.5in-<n>ft Length' symbols in the file")
    best = min(lengths, key=lambda L: (abs(L - length), -L))
    return {"symbol": lengths[best], "length": float(best), "exact": abs(best - length) < 0.05,
            "difference": round(best - length, 3)}


def axis_angle_mod180(a, b, about) -> float:
    """Angle (degrees, 0 <= t < 180) from line a to line b turning about `about`. Lines, not
    arrows: flipping either one's sign gives the same answer."""
    ax = unit(sub(a, mul(about, dot(a, about))), "pipe axis (square to the clamp's swivel)")
    bx = unit(sub(b, mul(about, dot(b, about))), "chord axis (square to the clamp's swivel)")
    t = math.degrees(math.atan2(dot(cross(ax, bx), about), dot(ax, bx))) % 180.0
    return 0.0 if t > 180.0 - 1e-7 else t


def choose_clamp(pipe_dir, chord_dir, normal, available=None) -> dict:
    """Which swivel-clamp symbol, and how to orient it.

    Frame: local Z = -normal (from the chord toward the pipe), local X = the pipe. The library's
    a-degree clamp has its chord bore at -a about local Z, i.e. it fits as-is when the angle from
    the pipe to the chord (mod 180) is 180 - a, and needs the mirrored copy when it is a."""
    n = unit(v3(normal, "normal"), "normal")
    z = mul(n, -1.0)
    pipe = unit(v3(pipe_dir, "pipeDir"), "pipeDir")
    chord = unit(v3(chord_dir, "chordDir"), "chordDir")
    if abs(dot(pipe, n)) > 0.02 or abs(dot(chord, n)) > 0.02:
        raise RigError("pipeDir and chordDir must both be square to normal")
    theta = axis_angle_mod180(pipe, chord, z)
    included = min(theta, 180.0 - theta)  # 0..90, the angle between the tubes
    choices = sorted(CLAMP_SYMBOLS)
    if available is not None:
        have = set(available)
        choices = [a for a in choices if CLAMP_SYMBOLS[a] in have]
        if not choices:
            raise RigError("no 'Aluminium Scaffold Clamp' symbols in the file")
    used = min(choices, key=lambda a: (abs(a - included), a))
    # Fits directly when theta is near 180 - used; mirrored when theta is near used.
    mirrored = used not in (0, 90) and abs(theta - used) < abs(theta - (180.0 - used))
    x_axis = sub(pipe, mul(z, dot(pipe, z)))
    return {"symbol": CLAMP_SYMBOLS[used], "angle_needed": round(included, 3), "angle_used": used,
            "exact": abs(used - included) < 0.5, "mirrored": mirrored,
            "frame": frame_from_axes(x_axis, z, mirror=mirrored)}


# ---------------------------------------------------------------------------------------
# truss sections
# ---------------------------------------------------------------------------------------


def truss_placement(start, end, width: float, height: float, roll: float = 0.0) -> dict:
    """Where to put a Straight Truss so its CENTERLINE runs start -> end.

    Returns insertion [x, y, z], plan rotation (degrees about Z), Hanging Angle, and length.
    Horizontal along X or Y, or vertical. Sloped or rolled (other than by 90s) is refused in v1."""
    s, e = v3(start, "start"), v3(end, "end")
    d = sub(e, s)
    length = norm(d)
    if length < 0.01:
        raise RigError("start and end are the same point")
    r = float(roll or 0.0) % 90.0
    if min(r, 90.0 - r) > 0.01:
        raise RigError("roll %s: only square sections (roll a multiple of 90) can be built in v1" % roll)
    u = mul(d, 1.0 / length)
    tol = 1e-3
    if abs(u[2]) > 1 - tol:  # vertical
        lo = s if s[2] <= e[2] else e
        # Hanging Angle 90 pivots the leg half the width toward -X; start half a width toward +X.
        ins = (lo[0] + width / 2.0, lo[1], lo[2])
        return {"insertion": list(ins), "rotation": 0.0, "hanging_angle": 90.0, "length": length, "orientation": "vertical"}
    if abs(u[2]) > tol:
        raise RigError("sloped truss (from %s to %s) isn't supported in v1: only level or plumb" % (list(s), list(e)))
    if abs(u[1]) < tol:  # along X
        lo = s if s[0] <= e[0] else e
        rotation, orientation = 0.0, "x"
    elif abs(u[0]) < tol:  # along Y
        lo = s if s[1] <= e[1] else e
        rotation, orientation = 90.0, "y"
    else:
        raise RigError("truss at an angle in plan isn't supported in v1: run it along X or Y")
    ins = (lo[0], lo[1], lo[2] - height / 2.0)
    return {"insertion": list(ins), "rotation": rotation, "hanging_angle": 0.0, "length": length, "orientation": orientation}


def corner_placement(center, size: float, width: float, height: float) -> dict:
    """A corner block, built as a Straight Truss `size` long along X, centered on `center`."""
    c = v3(center, "center")
    half = float(size) / 2.0
    return truss_placement((c[0] - half, c[1], c[2]), (c[0] + half, c[1], c[2]), width, height)


# ---------------------------------------------------------------------------------------
# build lists
# ---------------------------------------------------------------------------------------

KINDS = ("truss", "corner", "pipe", "clamp", "deck", "leg")


def validate_build_list(bl) -> list:
    """Problems with a v1 build list, in words. Unknown part kinds are NOT problems (skipped)."""
    errs = []
    if not isinstance(bl, dict):
        return ["the build list must be a JSON object"]
    if bl.get("version") != 1:
        errs.append("version must be 1 (got %r)" % bl.get("version"))
    if bl.get("units", "in") != "in":
        errs.append("units must be \"in\" (got %r)" % bl.get("units"))
    series = bl.get("series")
    if not isinstance(series, dict) or not series.get("id"):
        errs.append("series with an id is required")
    else:
        for k in ("width", "height"):
            if not isinstance(series.get(k), (int, float)) or series.get(k) <= 0:
                errs.append("series.%s must be a positive number" % k)
    parts = bl.get("parts")
    if not isinstance(parts, list) or not parts:
        errs.append("parts must be a non-empty list")
        return errs
    seen = set()
    need = {"truss": ("start", "end"), "corner": ("center",), "pipe": ("start", "end"),
            "clamp": ("at", "pipeDir", "chordDir", "normal"), "deck": ("at",), "leg": ("at",)}
    for i, p in enumerate(parts):
        if not isinstance(p, dict):
            errs.append("part %d is not an object" % (i + 1))
            continue
        pid = p.get("id")
        if not pid:
            errs.append("part %d has no id" % (i + 1))
        elif pid in seen:
            errs.append("part id %r is used twice" % pid)
        seen.add(pid)
        kind = p.get("kind")
        for k in need.get(kind, ()):
            try:
                v3(p.get(k), "%s.%s" % (pid, k))
            except RigError as e:
                errs.append(str(e))
        if kind == "corner" and not (isinstance(p.get("size"), (int, float)) and p["size"] > 0):
            errs.append("%s.size must be a positive number" % pid)
        for k in {"deck": ("width", "length", "height"), "leg": ("height",)}.get(kind, ()):
            if not (isinstance(p.get(k), (int, float)) and p[k] > 0):
                errs.append("%s.%s must be a positive number" % (pid, k))
        if kind == "deck" and p.get("rotation", 0) not in (0, 90):
            errs.append("%s.rotation must be 0 or 90" % pid)
    return errs


@dataclass
class Plan:
    steps: list = field(default_factory=list)  # what the bridge places, in order
    skipped: list = field(default_factory=list)  # parts not built, with why
    substituted: list = field(default_factory=list)  # nearest library part used instead
    missing_symbols: list = field(default_factory=list)  # resources to import first
    warnings: list = field(default_factory=list)

    def as_dict(self):
        return {"steps": self.steps, "skipped": self.skipped, "substituted": self.substituted,
                "missing_symbols": self.missing_symbols, "warnings": self.warnings}


def _frame_args(f: Frame) -> dict:
    a, b, c = euler_xyz(f.matrix())
    return {"rot_xyz": [a, b, c], "mirror": f.mirrored}


def symbol_3d_step(symbol: str, at, frame: Frame, part_id=None, kind="symbol") -> dict:
    step = {"kind": kind, "type": "symbol_3d", "symbol": symbol, "at": list(v3(at, "at"))}
    step.update(_frame_args(frame))
    if part_id is not None:
        step["id"] = part_id
    return step


def truss_step(symbol: str, placement: dict, part_id=None, kind="truss") -> dict:
    step = {"kind": kind, "type": "truss", "symbol": symbol, "insertion": placement["insertion"], "rotation": placement["rotation"],
            "length": round(placement["length"], 6), "hanging_angle": placement["hanging_angle"]}
    if part_id is not None:
        step["id"] = part_id
    return step


def symbol_step(symbol: str, at, rotation: float, part_id=None, kind="symbol") -> dict:
    """A symbol placed in plan (turned about Z only), its insertion raised to at's Z."""
    step = {"kind": kind, "type": "symbol", "symbol": symbol, "at": list(v3(at, "at")), "rotation": float(rotation)}
    if part_id is not None:
        step["id"] = part_id
    return step


def pipe_frame(start, end) -> tuple:
    """Pipe placement: x along the pipe; z as close to up as the pipe allows (a pipe is round)."""
    s, e = v3(start, "start"), v3(end, "end")
    x = unit(sub(e, s), "pipe")
    up = (0.0, 0.0, 1.0) if abs(x[2]) < 0.99 else (0.0, 1.0, 0.0)
    return frame_from_axes(x, up), s, e, norm(sub(e, s))


def plan_build(bl: dict, available) -> Plan:
    """Every placement for a validated build list, given the symbol names in the file."""
    have = set(available)
    plan = Plan()
    series = bl["series"]
    w, h = float(series["width"]), float(series["height"])
    missing = []

    def note_missing(name):
        if name not in missing:
            missing.append(name)

    truss_symbol = None
    needs_truss = any(p.get("kind") in ("truss", "corner") for p in bl["parts"])
    if needs_truss:
        try:
            cands = truss_symbol_candidates(series["id"])
        except RigError as e:
            raise RigError(str(e)) from None
        truss_symbol = next((c for c in cands if c in have), None)
        if truss_symbol is None:
            if series["id"] in FILE_ONLY_SERIES:
                raise RigError(
                    "20.5\" box truss isn't in Vectorworks' library: open a file that has the Total Structures symbols "
                    "(%s), like the Air Pro self-climber drawing, or import them into this one." % cands[0])
            note_missing(cands[1])  # the 8 ft section is what the library usually has

    pipe_names = pipe_lengths(have)
    clamp_names = [n for n in CLAMP_SYMBOLS.values() if n in have]
    for p in bl["parts"]:
        kind, pid = p.get("kind"), p.get("id")
        try:
            if kind == "truss":
                pl = truss_placement(p["start"], p["end"], w, h, p.get("roll", 0))
                if "length" in p and abs(float(p["length"]) - pl["length"]) > 0.05:
                    plan.warnings.append("%s: length %s doesn't match start-end %.3f; built start-end" % (pid, p["length"], pl["length"]))
                if truss_symbol:
                    plan.steps.append(truss_step(truss_symbol, pl, pid))
            elif kind == "corner" and p.get("role") == "head":
                plan.skipped.append({"id": pid, "kind": kind, "reason": "no tower head block symbol yet; it's on the rental list"})
            elif kind == "corner":
                # A self-climber sleeve block is drawn as a stub of truss its own size, like a corner.
                pl = corner_placement(p["center"], p["size"], w, h)
                if truss_symbol:
                    plan.steps.append(truss_step(truss_symbol, pl, pid, kind="corner"))
            elif kind == "pipe":
                if not pipe_names:
                    note_missing("Pipe 1.5in-4ft Length")
                    continue
                f, s, e, length = pipe_frame(p["start"], p["end"])
                ch = choose_pipe(length, have)
                od = p.get("od")
                if isinstance(od, (int, float)) and abs(od - PIPE_OD) > 0.1:
                    plan.warnings.append("%s: od %s but the library pipe is 1.5\" (1.9\" OD)" % (pid, od))
                # A different length is centered on the same span, so both ends overhang (or fall
                # short) equally at the clamps.
                mid = mul(add(s, e), 0.5)
                at = sub(mid, mul(f.x, ch["length"] / 2.0))
                plan.steps.append(symbol_3d_step(ch["symbol"], at, f, pid, kind="pipe"))
                if not ch["exact"]:
                    plan.substituted.append({"id": pid, "wanted": "%.2f in pipe" % length, "used": ch["symbol"],
                                             "difference_in": ch["difference"]})
            elif kind == "clamp":
                if not clamp_names:
                    note_missing(CLAMP_SYMBOLS[45])
                    continue
                if p.get("type", "swivel") != "swivel":
                    plan.skipped.append({"id": pid, "kind": kind, "reason": "only swivel clamps are in the library"})
                    continue
                ch = choose_clamp(p["pipeDir"], p["chordDir"], p["normal"], have)
                off = p.get("offset", CLAMP_OFFSET)
                if isinstance(off, (int, float)) and abs(off - CLAMP_OFFSET) > 0.05:
                    plan.warnings.append("%s: offset %s but the library swivel is %s\"" % (pid, off, CLAMP_OFFSET))
                step = symbol_3d_step(ch["symbol"], p["at"], ch["frame"], pid, kind="clamp")
                plan.steps.append(step)
                if not ch["exact"]:
                    plan.substituted.append({"id": pid, "wanted": "%.1f° clamp" % ch["angle_needed"], "used": ch["symbol"]})
            elif kind == "deck":
                name = deck_symbol(p["width"], p["length"])
                if name not in have:
                    note_missing(name)
                    continue
                plan.steps.append(symbol_step(name, p["at"], p.get("rotation", 0), pid, kind="deck"))
            elif kind == "leg":
                name = leg_symbol(p["height"])
                if name not in have:
                    note_missing(name)
                    continue
                plan.steps.append(symbol_step(name, p["at"], 0, pid, kind="leg"))
            elif kind in NOT_IN_LIBRARY:
                plan.skipped.append({"id": pid, "kind": kind, "reason": NOT_IN_LIBRARY[kind]})
            elif kind == "baseplate":
                plan.skipped.append({"id": pid, "kind": kind, "reason": "no base plate symbol yet"})
            else:
                plan.skipped.append({"id": pid, "kind": kind, "reason": "part kind %r isn't built by this connector yet" % kind})
        except RigError as e:
            plan.skipped.append({"id": pid, "kind": kind, "reason": str(e)})
    plan.missing_symbols = missing
    return plan


# ---------------------------------------------------------------------------------------
# the site (tylerflores.dev/private/rig)
# ---------------------------------------------------------------------------------------


def design_url(base: str, design_id: str) -> str:
    if not re.match(r"^[A-Za-z0-9_-]{1,100}$", design_id or ""):
        raise RigError("design id %r doesn't look right (letters, digits, - and _)" % design_id)
    return "%s/api/rig/designs/%s" % (base.rstrip("/"), design_id)


def _request(url: str, token: str, method: str = "GET", timeout: float = 20.0, body: dict | None = None):
    req = urllib.request.Request(url, method=method, headers={"Authorization": "Bearer %s" % token, "Accept": "application/json"})
    if method == "POST":
        req.data = json.dumps(body or {}).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        hint = " (check VWMCP_RIG_TOKEN)" if e.code in (401, 403) else " (no such design?)" if e.code == 404 else ""
        raise RigError("%s %s answered %d%s" % (method, url, e.code, hint)) from None
    except (urllib.error.URLError, OSError) as e:
        raise RigError("couldn't reach %s: %s" % (url, getattr(e, "reason", e))) from None
    return json.loads(body) if body.strip() else {}


def fetch_design(base: str, token: str, design_id: str) -> dict:
    if not token:
        raise RigError("set VWMCP_RIG_TOKEN (in your Windows user environment or the MCP config) to fetch designs from the site")
    data = _request(design_url(base, design_id), token)
    if not isinstance(data, dict) or not isinstance(data.get("buildList"), dict):
        raise RigError("the site's answer for design %r has no buildList" % design_id)
    return data


def mark_built(base: str, token: str, design_id: str, approved_at: str | None = None) -> None:
    """Tell the site this approval is built. `approved_at` (from the GET) makes sure a design
    re-approved while Vectorworks was building isn't marked built by mistake."""
    _request(design_url(base, design_id) + "/built", token, method="POST", body={"approvedAt": approved_at} if approved_at else None)
