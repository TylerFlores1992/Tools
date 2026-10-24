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


# ---------------------------------------------------------------------------------------
# reading field values (Spotlight shows them as display strings: "116 lb", "60'", "500 kg")
# ---------------------------------------------------------------------------------------

LB_PER_KG = 1 / 0.45359237
_WEIGHT_UNITS = {"lb": 1.0, "lbs": 1.0, "#": 1.0, "kg": LB_PER_KG, "t": 1000 * LB_PER_KG, "ton": 2000.0, "tons": 2000.0,
                 "us ton": 2000.0, "short ton": 2000.0, "tonne": 1000 * LB_PER_KG, "kn": 224.80894}


def parse_weight(text, default_unit: str = "lb"):
    """A weight as typed or shown ("1,850 lb", "500kg", "1 ton", "2 t") -> pounds, or None.
    A bare number is in default_unit. "t" is a metric tonne; "ton" is a US ton (2,000 lb)."""
    if text is None:
        return None
    if isinstance(text, (int, float)) and not isinstance(text, bool):
        return float(text) * _WEIGHT_UNITS[default_unit]
    s = str(text).strip().lower().replace(",", "")
    m = re.match(r"^(-?\d+(?:\.\d+)?)\s*(lbs?|#|kg|t|tons?|us ton|short ton|tonne|kn)?\.?$", s)
    if not m:
        return None
    unit = m.group(2) or default_unit
    return float(m.group(1)) * _WEIGHT_UNITS[unit]


def lb_to(value_lb: float, unit: str) -> float:
    return value_lb / _WEIGHT_UNITS[unit]


def format_weight(value_lb, unit: str = "lb") -> str:
    """Rounded UP to the next 5 lb or 1 kg: a load is never shown lighter than it is."""
    if value_lb is None or (isinstance(value_lb, float) and math.isnan(value_lb)):
        return "–"
    if unit == "kg":
        return "{:,} kg".format(int(math.ceil(lb_to(value_lb, "kg") - 1e-9)))
    return "{:,} lb".format(int(math.ceil(value_lb / 5 - 1e-9) * 5))


# A copy of the bridge's length reader (vw_plugin/vwmcp_bridge.py, parse_length), for field
# values the bridge hands over as text. Both are tested against src/tools/vectorworks/length-cases.json.
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
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        return float(raw)
    s = str(raw).strip().lower().replace("′", "'").replace("’", "'").replace("″", '"').replace("”", '"').replace(",", "")
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


# ---------------------------------------------------------------------------------------
# bridles built from real steel
# ---------------------------------------------------------------------------------------


def apex_from_legs(leg_a: float, leg_b: float, span: float, rise: float = 0.0):
    """Where the apex lands for legs of fixed length (pin to pin): beam A at (0,0), beam B at
    (span, rise). Returns (x from A, drop below A) or None when the legs can't reach."""
    d = math.hypot(span, rise)
    if d <= 0 or leg_a + leg_b < d or abs(leg_a - leg_b) > d:
        return None
    a = (leg_a ** 2 - leg_b ** 2 + d ** 2) / (2 * d)
    h = math.sqrt(max(leg_a ** 2 - a ** 2, 0.0))
    ux, uy = span / d, rise / d
    mx, my = a * ux, a * uy
    # two intersections; the apex is the lower one
    p1 = (mx + h * uy, my - h * ux)
    p2 = (mx - h * uy, my + h * ux)
    x, y = min((p1, p2), key=lambda p: p[1])
    return x, -y


def leg_parts(length: float, steel: tuple = (50.0, 30.0, 20.0, 10.0, 5.0, 2.5), hardware: float = 0.0):
    """A leg length (feet, pin to pin) made from standard steel, longest first, never longer than
    asked. Returns (pieces, steel total, shortfall left to make up in deck chain or shackles).
    Suggested parts only: check against what's actually on the truck."""
    need = length - hardware
    pieces = []
    for piece in sorted(steel, reverse=True):
        while need - piece >= -1e-9:
            pieces.append(piece)
            need -= piece
    return pieces, sum(pieces), max(need, 0.0)


# ---------------------------------------------------------------------------------------
# truss reactions
# ---------------------------------------------------------------------------------------


def _solve(a, b):
    """Gaussian elimination with partial pivoting (small systems; no numpy needed)."""
    n = len(b)
    m = [list(row) + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(m[r][c]))
        if abs(m[piv][c]) < 1e-12:
            raise ValueError("singular")
        m[c], m[piv] = m[piv], m[c]
        for r in range(n):
            if r != c:
                f = m[r][c] / m[c][c]
                m[r] = [m[r][k] - f * m[c][k] for k in range(n + 1)]
    return [m[i][n] / m[i][i] for i in range(n)]


def _simple_defl(x, a, L):
    """Deflection at x of a simple span 0..L under a unit point load at a (EI = 1, downward +)."""
    b = L - a
    if x <= a:
        return b * x * (L * L - b * b - x * x) / (6 * L)
    return a * (L - x) * (L * L - a * a - (L - x) ** 2) / (6 * L)


def truss_reactions(supports, point_loads=(), udl: float = 0.0, start: float = None, end: float = None):
    """Reactions at each support of a straight truss.

    supports: positions along the truss (any length unit). point_loads: [(position, weight)].
    udl: weight per unit length over start..end (default: the truss runs support to support).
    Two supports: exact statics, overhangs included (a negative reaction means uplift).
    Three or more: a continuous beam (equal stiffness, rigid level supports, solved by
    compatibility). Real reactions depend on how level the hoists are, so those are estimates:
    use Braceworks, load cells or an engineer before relying on them.
    """
    xs = sorted(float(s) for s in supports)
    if len(xs) < 2:
        raise ValueError("A truss needs at least two pick points.")
    lo, hi = xs[0], xs[-1]
    start = lo if start is None else float(start)
    end = hi if end is None else float(end)
    # Lump the UDL into many small point loads: exact enough (0.1% of span) and keeps one method.
    loads = [(float(p), float(w)) for p, w in point_loads]
    if udl and end > start:
        n = 400
        step = (end - start) / n
        loads += [(start + (i + 0.5) * step, udl * step) for i in range(n)]
    total = sum(w for _, w in loads)
    L = hi - lo

    def two_support(ls):
        mb = sum(w * (p - lo) for p, w in ls) / L
        return [sum(w for _, w in ls) - mb, mb]

    if len(xs) == 2:
        r = two_support(loads)
        return {"reactions": r, "total": total, "method": "statics", "estimate": False}

    # Interior supports are redundants: the beam between the end supports may not move there.
    interior = xs[1:-1]
    rel = [x - lo for x in interior]

    def defl_from_loads(x):
        out = 0.0
        for p, w in loads:
            a = p - lo
            if 0 <= a <= L:
                out += w * _simple_defl(x, a, L)
            else:
                # overhang load: acts as an end moment on the span (hogging lifts the span)
                arm = -a if a < 0 else a - L
                m = w * arm
                xr = x if a < 0 else L - x
                out -= m * xr * (L - xr) * (2 * L - xr) / (6 * L)
        return out

    A = [[_simple_defl(xi, xj, L) for xj in rel] for xi in rel]
    b = [defl_from_loads(xi) for xi in rel]
    r_int = _solve(A, b)
    rest = loads + [(x, -r) for x, r in zip(interior, r_int)]
    r_end = two_support(rest)
    return {"reactions": [r_end[0]] + r_int + [r_end[1]], "total": total, "method": "continuous beam", "estimate": True}
