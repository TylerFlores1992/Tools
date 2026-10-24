"""Rigging maths and conventions, independent of Vectorworks (pure functions, tested).

- solve_bridle: two-leg bridle statics, ported line for line from the site's bridle
  calculator (src/tools/bridle/math.ts) and tested against the same worked examples.
- stage_position: a drawing point said the way riggers say it ("12'-0" SL of CL, 30'-0" US of PL").
- classify_department: which department a layer or class belongs to, from its name.
"""

from __future__ import annotations

import math
import re
from dataclasses import asdict, dataclass

# ---------------------------------------------------------------------------------------
# bridles
# ---------------------------------------------------------------------------------------


@dataclass
class Leg:
    length: float
    horizontal: float
    vertical: float
    angle: float  # above horizontal, degrees
    tension: float  # NaN when invalid
    vertical_force: float


@dataclass
class Bridle:
    valid: bool
    problem: str
    left: Leg
    right: Leg
    included_angle: float
    horizontal_force: float

    def as_dict(self) -> dict:
        d = asdict(self)
        for k in ("included_angle", "horizontal_force"):
            if isinstance(d[k], float) and math.isnan(d[k]):
                d[k] = None
        for side in ("left", "right"):
            for k, v in d[side].items():
                if isinstance(v, float) and math.isnan(v):
                    d[side][k] = None
        return d


def solve_bridle(span: float, load: float, x: float, drop: float, rise: float = 0.0) -> Bridle:
    """Left beam point A at (0, 0); right beam point B at (span, rise), rise > 0 when B is higher;
    apex P at (x, -drop): x from A, drop below A. Load W hangs from P. Any consistent units."""
    h_l, v_l = x, drop
    h_r, v_r = span - x, rise + drop
    len_l, len_r = math.hypot(h_l, v_l), math.hypot(h_r, v_r)
    a_l, a_r = math.degrees(math.atan2(v_l, h_l)), math.degrees(math.atan2(v_r, h_r))

    problem = ""
    if not span > 0:
        problem = "The span between the beams must be more than zero."
    elif not (0 < x < span):
        problem = "Keep the bridle point between the two beams."
    elif not (drop > 0 and v_r > 0):
        problem = "The bridle point has to hang below both beams."
    elif not load >= 0:
        problem = "The load can't be negative."
    valid = problem == ""

    t_l = t_r = float("nan")
    if valid:
        u_lx, u_ly, u_rx, u_ry = -h_l / len_l, v_l / len_l, h_r / len_r, v_r / len_r
        det = u_lx * u_ry - u_rx * u_ly
        t_l = (-u_rx * load) / det
        t_r = (u_lx * load) / det
    return Bridle(
        valid=valid,
        problem=problem,
        left=Leg(len_l, h_l, v_l, a_l, t_l, (t_l * v_l) / len_l if valid else float("nan")),
        right=Leg(len_r, h_r, v_r, a_r, t_r, (t_r * v_r) / len_r if valid else float("nan")),
        included_angle=180 - a_l - a_r,
        horizontal_force=(t_l * h_l) / len_l if valid else float("nan"),
    )


def level_beam_tension(load: float, leg_length: float, other_horizontal: float, span: float, drop: float) -> float:
    """The ETCP hand formula for level beams: T = W·L·(other side's H) / (span·drop)."""
    return (load * leg_length * other_horizontal) / (span * drop)


# ---------------------------------------------------------------------------------------
# saying where something is
# ---------------------------------------------------------------------------------------


def format_ft_in(inches: float) -> str:
    """Inches as a rigger writes them, to the nearest 1/16": 12'-6 1/2", 6 1/4", 1/2"."""
    sixteenths = round(abs(inches) * 16)
    feet, rest = divmod(sixteenths, 12 * 16)
    whole, frac16 = divmod(rest, 16)
    frac = ""
    if frac16:
        g = math.gcd(frac16, 16)
        frac = "%d/%d" % (frac16 // g, 16 // g)
    sign = "-" if inches < 0 and sixteenths else ""
    if feet:
        return "%s%d'-%d%s\"" % (sign, feet, whole, " " + frac if frac else "")
    if whole and frac:
        return '%s%d %s"' % (sign, whole, frac)
    return '%s%s"' % (sign, frac or str(whole))


def format_length(value: float, upi: float, metric: bool) -> str:
    inches = value / upi
    if metric:
        mm = inches * 25.4
        return "%s mm" % format(round(mm), ",") if abs(mm) < 10000 else "%s m" % ("%.3f" % (mm / 1000)).rstrip("0").rstrip(".")
    return format_ft_in(inches)


@dataclass
class Datum:
    """Where measurements start and which way the stage faces.

    origin: the reference point (CL on the plaster line / DS edge / center of floor), drawing units.
    upstage: unit vector pointing upstage in the drawing (default +Y: audience at the bottom).
    The rigger's stage left is upstage rotated 90 degrees clockwise (+X when upstage is +Y),
    because an actor facing the audience has their left on the page's right.
    cl_name / pl_name: what the two axes are called on this show (CL and PL, or CL and DSE...).
    """

    origin: tuple = (0.0, 0.0)
    upstage: tuple = (0.0, 1.0)
    cl_name: str = "CL"
    pl_name: str = "PL"

    def axes(self):
        ux, uy = self.upstage
        n = math.hypot(ux, uy) or 1.0
        ux, uy = ux / n, uy / n
        return (ux, uy), (uy, -ux)  # upstage, stage-left


def stage_offsets(p, datum: Datum) -> tuple:
    """(stage-left distance, upstage distance) of point p from the datum, drawing units."""
    (ux, uy), (lx, ly) = datum.axes()
    dx, dy = p[0] - datum.origin[0], p[1] - datum.origin[1]
    return dx * lx + dy * ly, dx * ux + dy * uy


def stage_position(p, datum: Datum, upi: float, metric: bool = False) -> dict:
    """{"sl": 144.0, "us": 360.0, "text": "12'-0\" SL of CL, 30'-0\" US of PL"}: the way a
    rigger reads a position off a plot. On a datum line it says "on CL" / "on PL"."""
    sl, us = stage_offsets(p, datum)
    tol = 1e-6 * max(1.0, upi)
    if abs(sl) < tol:
        across = "on %s" % datum.cl_name
    else:
        across = "%s %s of %s" % (format_length(abs(sl), upi, metric), "SL" if sl > 0 else "SR", datum.cl_name)
    if abs(us) < tol:
        updown = "on %s" % datum.pl_name
    else:
        updown = "%s %s of %s" % (format_length(abs(us), upi, metric), "US" if us > 0 else "DS", datum.pl_name)
    return {"sl": sl, "us": us, "text": "%s, %s" % (across, updown)}


# ---------------------------------------------------------------------------------------
# departments
# ---------------------------------------------------------------------------------------

DEPARTMENTS = ("venue", "rigging", "lighting", "audio", "video", "scenic", "staging", "other")

# Order matters: the first match wins. Patterns are matched against layer and class names,
# lowercased, with separators (- _ . / and spaces) normalised to spaces.
_RULES = [
    ("rigging", r"\b(rig|rigging|hoist|motor|chain ?motor|bridle|point|points|steel ?point|truss|ground ?support|braceworks|load)s?\b"),
    ("lighting", r"\b(lx|lighting|light|lights|fixture|fixtures|electric|electrics|spotlight|dmx|follow ?spot|position)s?\b"),
    ("audio", r"\b(audio|sound|snd|pa|speaker|speakers|line ?array|array|sub|subs|monitor|monitors|foh mix)\b"),
    ("video", r"\b(video|vid|led|led wall|screen|screens|projection|projector|projectors|camera|cameras|ivm|imag)\b"),
    ("scenic", r"\b(scenic|scenery|set|sets|art|art dept|art department|props|soft goods|softgoods|drape|drapes|backdrop|header|legs|borders|flats?)\b"),
    ("staging", r"\b(stage|staging|deck|decks|riser|risers|platform|platforms|barricade|thrust|runway|catwalk)\b"),
    ("venue", r"\b(venue|house|building|arch|architecture|architectural|base|existing|walls?|steel|beams?|grid|roof|structure|structural|seating|seats|xref|dwg|a ?\d{2,3}|catwalks?|fly ?system|linesets?)\b"),
]


def _norm(name: str) -> str:
    return re.sub(r"[-_./\\]+", " ", name.lower()).strip()


def classify_department(*names: str) -> str:
    """The department for an object or layer, from its layer and class names (layer first).
    Anything unrecognised is "other"; a person can override per layer or class."""
    for name in names:
        if not name:
            continue
        n = _norm(name)
        for dept, pat in _RULES:
            if re.search(pat, n):
                return dept
    return "other"
