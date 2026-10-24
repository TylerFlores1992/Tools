"""From a drawing to a head rigger's paperwork: the point list, loads per point, beam and roof
totals, bridles, checks, mark-out order, a CSV, and what changed since last time.

Input is what the bridge reads (get_rigging, venue steel, obstructions) plus the show's settings.
Everything here is pure Python, so it is tested without Vectorworks.

Where loads come from, in order of trust:
  1. Braceworks: a hoist's ReactionForce field, written when Braceworks has calculated.
  2. Statics: two pick points on a straight truss (exact for the model).
  3. Estimate: three or more pick points (continuous beam) - flagged for Braceworks, load cells
     or an engineer, because real reactions depend on how level the hoists are.
"""

from __future__ import annotations

import csv
import io
import math
import re

from .rigging import (
    Datum,
    format_length,
    format_weight,
    lb_to,
    parse_length,
    parse_weight,
    solve_bridle,
    stage_offsets,
    stage_position,
    truss_reactions,
)
from .show import ShowSetup

OBSTRUCTION = re.compile(r"obstruct|scoreboard|catwalk|hvac|duct|sprinkler|cable ?tray|speaker ?cluster|no ?rig", re.I)
STEEL = re.compile(r"\b(beam|steel|girder|truss line|joist|i ?beam|w\d+|panel point)\b|^[a-z]?-?steel|house-steel|s-beam", re.I)

ID_FIELDS = ("Hoist ID", "HoistID", "Point ID", "ID", "Load ID", "Name")
CAPACITY_FIELDS = ("Capacity", "WLL", "MaximumLoad", "Max Load", "Rated Load")
REACTION_FIELDS = ("ReactionForce", "Reaction Force", "Calculated Load")
WEIGHT_FIELDS = ("Weight", "Total Weight", "Hoist Weight", "Load Weight")
POSITION_FIELDS = ("Position", "Hanging Position", "Truss", "Position Name")


def _field(fields: dict, names) -> str:
    low = {k.lower(): v for k, v in (fields or {}).items()}
    for n in names:
        v = low.get(n.lower())
        if v not in (None, ""):
            return str(v)
    return ""


def _center(o):
    if o.get("location"):
        return tuple(o["location"])
    (x0, y0), (x1, y1) = o["bbox"]
    return ((x0 + x1) / 2, (y0 + y1) / 2)


def _segments(o):
    g = o.get("geometry") or {}
    if g.get("kind") in ("line", "wall"):
        return [(tuple(g["start"]), tuple(g["end"]))]
    if g.get("kind") == "polygon":
        pts = [tuple(p) for p in g["points"]]
        n = len(pts) if g.get("closed") else len(pts) - 1
        return [(pts[i], pts[(i + 1) % len(pts)]) for i in range(max(n, 0))]
    if g.get("kind") == "group":
        out = []
        for part in g["parts"]:
            out += _segments({"geometry": part})
        return out
    return []


def _dist_to_seg(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
    q = (a[0] + t * dx, a[1] + t * dy)
    return math.hypot(p[0] - q[0], p[1] - q[1]), q


def _truss_axis(t):
    """A straight truss's centerline from its bounding box: the long direction."""
    (x0, y0), (x1, y1) = t["bbox"]
    if (x1 - x0) >= (y1 - y0):
        y = (y0 + y1) / 2
        return (x0, y), (x1, y)
    x = (x0 + x1) / 2
    return (x, y0), (x, y1)


def _along(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1.0
    return ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L, abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L


def build_report(rigging: list, fixtures: list, venue: list, setup: ShowSetup, upi: float) -> dict:
    """rigging: get_rigging objects (kind hoist/house_point/bridle/truss/load/position);
    fixtures: lighting devices with fields; venue: venue-department objects (steel, obstructions)."""
    lim = setup.limits
    unit = lim.weight_unit
    datum: Datum = setup.datum()
    metric = setup.metric
    L = lambda v: format_length(v, upi, metric)  # noqa: E731
    W = lambda v: format_weight(v, unit)  # noqa: E731
    per_ft = upi * (12 if unit == "lb" else 1000 / 25.4)  # drawing units per ft (lb) or per m (kg)
    tol = lim.steel_tolerance if lim.steel_tolerance is not None else 6 * upi
    limit_lb = lambda v: None if v is None else parse_weight(v, unit)  # noqa: E731

    checks = []

    def flag(severity, text, ids=()):
        checks.append({"severity": severity, "text": text, "ids": list(ids)})

    hoists = [o for o in rigging if o.get("kind") in ("hoist", "house_point")]
    trusses = [o for o in rigging if o.get("kind") == "truss"]
    loads = [o for o in rigging if o.get("kind") == "load"]
    beams = [o for o in venue if STEEL.search(" ".join([o.get("name", ""), o.get("cls", "")])) and _segments(o)]
    obstructions = [o for o in venue if OBSTRUCTION.search(" ".join([o.get("name", ""), o.get("cls", "")]))]

    # ---- loads on each truss --------------------------------------------------------------
    hoist_load: dict = {}  # hoist id -> (lb, source)
    truss_rows = []
    for t in trusses:
        tname = _field(t.get("fields"), ("Name",)) or t.get("name") or "Truss"
        a, b = _truss_axis(t)
        span_len = math.hypot(b[0] - a[0], b[1] - a[1])
        on = [h for h in hoists if _field(h.get("fields"), POSITION_FIELDS) == tname]
        if not on:
            on = [h for h in hoists if _along(_center(h), a, b)[1] <= max(tol, 12 * upi)]
        items = [f for f in fixtures if _field(f.get("fields"), POSITION_FIELDS) == tname]
        items += [ld for ld in loads if _field(ld.get("fields"), POSITION_FIELDS) == tname]
        point_loads, missing = [], []
        for it in items:
            w = parse_weight(_field(it.get("fields"), WEIGHT_FIELDS), unit)
            if w is None:
                missing.append(it["id"])
                continue
            point_loads.append((_along(_center(it), a, b)[0], w))
        if missing:
            flag("warning", "%d item(s) on %s have no weight and count as 0. Add weights for a real load." % (len(missing), tname), missing)
        udl_lb_per_unit = (lim.truss_weight_per_ft + lim.cable_allowance_per_ft) / per_ft
        udl_lb_per_unit = parse_weight(udl_lb_per_unit, unit) if udl_lb_per_unit else 0.0
        row = {"truss": tname, "id": t["id"], "length": span_len, "length_text": L(span_len), "hoists": [], "items": len(items),
               "items_weight": sum(w for _, w in point_loads), "method": None}
        if len(on) < 2:
            flag("warning", "%s has %s pick point%s, so its load can't be worked out. Check the hoists' Position field." % (tname, len(on) or "no", "" if len(on) == 1 else "s"), [t["id"]])
        else:
            pos = [(_along(_center(h), a, b)[0], h) for h in on]
            pos.sort(key=lambda p: p[0])
            r = truss_reactions([p for p, _ in pos], point_loads, udl_lb_per_unit, 0.0, span_len)
            row["method"] = r["method"]
            for (p, h), react in zip(pos, r["reactions"]):
                hoist_load[h["id"]] = (react, "estimate" if r["estimate"] else "statics")
                row["hoists"].append(h["id"])
                if react < 0:
                    flag("danger", "%s pulls UP at hoist %s (%s): the truss tips. Move the picks." % (tname, _field(h.get("fields"), ID_FIELDS) or "?", W(-react)), [h["id"]])
            if r["estimate"]:
                flag("info", "%s hangs on %d points: loads per point are a continuous-beam estimate. Run Braceworks or use load cells before relying on them." % (tname, len(on)), [t["id"]])
        truss_rows.append(row)

    # ---- one row per point ------------------------------------------------------------------
    rows = []
    seen_ids: dict = {}
    for h in hoists + [ld for ld in loads if not _field(ld.get("fields"), POSITION_FIELDS) or ld.get("source") == "referenced"]:
        f = h.get("fields") or {}
        pid = _field(f, ID_FIELDS) or h.get("name") or ""
        is_load = h.get("kind") == "load"
        c = _center(h)
        sl, us = stage_offsets(c, datum)
        where = stage_position(c, datum, upi, metric)
        capacity = parse_weight(_field(f, CAPACITY_FIELDS), unit) if not is_load else None
        if capacity is None and not is_load and lim.default_hoist_wll:
            capacity = limit_lb(lim.default_hoist_wll)
        reaction_text = _field(f, REACTION_FIELDS)
        if reaction_text and parse_weight(reaction_text, unit) is not None:
            load, source = parse_weight(reaction_text, unit), "Braceworks"
        elif is_load:
            load, source = parse_weight(_field(f, WEIGHT_FIELDS), unit), "load object"
        elif h["id"] in hoist_load:
            load, source = hoist_load[h["id"]]
        else:
            load, source = None, "unknown"
        body = parse_weight(_field(f, ("Hoist Weight",)), unit) or 0.0
        chain_ft = (parse_length(_field(f, ("Chain Length",)), 1.0) or 0.0) / 12
        chain = chain_ft * (lim.chain_weight_per_ft if unit == "lb" else lim.chain_weight_per_ft * 0.3048)
        chain = parse_weight(chain, unit) if chain else 0.0
        point = None if load is None else load + body + chain
        dyn = None if point is None else point * lim.dynamic_factor

        # steel: dead hang under a beam, or a bridle between the two nearest beams
        steel = {"type": "unknown", "beams": []}
        if beams:
            feet = []  # (distance, foot point on the beam, beam)
            for bm in beams:
                d, q = min((_dist_to_seg(c, s0, s1) for s0, s1 in _segments(bm)), key=lambda t: t[0])
                feet.append((d, q, bm))
            feet.sort(key=lambda t: t[0])
            d_a, q_a, a_bm = feet[0]
            if d_a <= tol:
                steel = {"type": "dead hang", "beams": [a_bm.get("name") or "beam"]}
            else:
                # a bridle needs steel on the OTHER side of the point too
                va = (q_a[0] - c[0], q_a[1] - c[1])
                other = [(d, q, bm) for d, q, bm in feet[1:] if (q[0] - c[0]) * va[0] + (q[1] - c[1]) * va[1] < 0]
                if not other:
                    steel = {"type": "no steel", "beams": [a_bm.get("name") or "beam"]}
                    flag("warning", "Point %s has steel on one side only (nearest %s, %s away): it needs another beam, a spreader or a mother grid." % (pid or "?", a_bm.get("name") or "a beam", L(d_a)), [h["id"]])
                else:
                    d_b, q_b, b_bm = other[0]
                    spread = math.hypot(q_b[0] - q_a[0], q_b[1] - q_a[1])
                    steel = {"type": "bridle", "beams": [a_bm.get("name") or "beam A", b_bm.get("name") or "beam B"], "spread": spread, "to_first": d_a}
                    spec_a = setup.limits.beams.get(a_bm.get("name", ""), {})
                    spec_b = setup.limits.beams.get(b_bm.get("name", ""), {})
                    ha = spec_a.get("height", lim.high_steel)
                    hb = spec_b.get("height", lim.high_steel)
                    apex = h.get("z")
                    if ha is not None and hb is not None and apex is not None and point is not None and apex < min(ha, hb):
                        br = solve_bridle(spread, point, d_a, ha - apex, hb - ha)
                        steel["bridle"] = {
                            "leg_a": br.left.length, "leg_b": br.right.length, "leg_a_text": L(br.left.length), "leg_b_text": L(br.right.length),
                            "tension_a": br.left.tension, "tension_b": br.right.tension, "angle": br.included_angle,
                            "horizontal": br.horizontal_force, "vertical_a": br.left.vertical_force, "vertical_b": br.right.vertical_force,
                        }
                        if br.included_angle > lim.max_bridle_angle:
                            flag("danger", "Point %s: bridle included angle %.0f° is over %.0f°." % (pid or "?", br.included_angle, lim.max_bridle_angle), [h["id"]])
                    elif apex is None or ha is None or hb is None:
                        flag("info", "Point %s needs a bridle (%s to %s). Set the steel height to size it." % (pid or "?", steel["beams"][0], steel["beams"][1]), [h["id"]])
                    else:
                        flag("danger", "Point %s: the hook is above the steel it bridles from." % (pid or "?"), [h["id"]])

        status, notes = "ok", []
        if point is None:
            status = "unknown"
            notes.append("load unknown")
        if capacity and dyn is not None:
            if dyn > capacity:
                status = "over"
                flag("danger", "Point %s: %s with dynamic factor %.2f is over the %s hoist rating." % (pid or "?", W(dyn), lim.dynamic_factor, W(capacity)), [h["id"]])
            elif dyn > capacity * lim.hoist_warn_fraction:
                status = "high" if status == "ok" else status
                flag("warning", "Point %s: %s is over %d%% of its %s hoist." % (pid or "?", W(dyn), int(lim.hoist_warn_fraction * 100), W(capacity)), [h["id"]])
        plim = limit_lb(lim.point_limit)
        if plim and point is not None and point > plim:
            status = "over"
            flag("danger", "Point %s: %s is over the venue's %s per point." % (pid or "?", W(point), W(plim)), [h["id"]])
        for ob in obstructions:
            (x0, y0), (x1, y1) = ob["bbox"]
            if x0 <= c[0] <= x1 and y0 <= c[1] <= y1:
                flag("warning", "Point %s lands inside %s." % (pid or "?", ob.get("name") or "an obstruction"), [h["id"], ob["id"]])
        if h.get("source") == "referenced":
            notes.append("from a referenced file")
        if pid:
            seen_ids.setdefault(pid, []).append(h["id"])
        else:
            flag("warning", "A %s at %s has no ID." % ("load" if is_load else "point", where["text"]), [h["id"]])
        sx = sl if setup.x_positive == "SL" else -sl
        rows.append({
            "id": h["id"], "point": pid, "kind": h.get("kind"), "position": _field(f, POSITION_FIELDS),
            "x": sx, "y": us, "x_text": L(abs(sl)) + (" SL" if sl > 0 else " SR" if sl < 0 else " on CL"), "y_text": where["text"].split(", ")[1],
            "where": where["text"], "z": h.get("z"), "z_text": L(h["z"]) if h.get("z") is not None else "–",
            "hoist": _field(f, ("Hoist Name", "Hoist Type")), "capacity": capacity, "capacity_text": W(capacity) if capacity else "–",
            "trim": _field(f, ("Trim Height", "Load Trim", "Trim at Bottom of Truss", "Trim")),
            "load": load, "load_text": W(load) if load is not None else "–", "load_source": source,
            "point_load": point, "point_load_text": W(point) if point is not None else "–",
            "dynamic": dyn, "dynamic_text": W(dyn) if dyn is not None else "–",
            "utilization": (dyn / capacity) if (capacity and dyn is not None) else None,
            "steel": steel, "status": status, "notes": notes, "source": h.get("source", "native"),
        })

    for pid, ids in seen_ids.items():
        if len(ids) > 1:
            flag("warning", "Point ID %s is used %d times." % (pid, len(ids)), ids)

    # spacing between points (venue minimum)
    if lim.min_point_spacing:
        for i, r1 in enumerate(rows):
            for r2 in rows[i + 1:]:
                d = math.hypot(r1["x"] - r2["x"], r1["y"] - r2["y"])
                if d < lim.min_point_spacing:
                    flag("warning", "Points %s and %s are %s apart; the venue asks for %s." % (r1["point"] or "?", r2["point"] or "?", L(d), L(lim.min_point_spacing)), [r1["id"], r2["id"]])

    # ---- beam and roof totals -------------------------------------------------------------
    beam_totals: dict = {}
    for r in rows:
        if r["point_load"] is None:
            continue
        s = r["steel"]
        if s["type"] == "dead hang":
            beam_totals[s["beams"][0]] = beam_totals.get(s["beams"][0], 0.0) + r["point_load"]
        elif s["type"] == "bridle" and "bridle" in s:
            beam_totals[s["beams"][0]] = beam_totals.get(s["beams"][0], 0.0) + s["bridle"]["vertical_a"]
            beam_totals[s["beams"][1]] = beam_totals.get(s["beams"][1], 0.0) + s["bridle"]["vertical_b"]
    for name, total in beam_totals.items():
        blim = limit_lb(setup.limits.beams.get(name, {}).get("limit", lim.beam_limit))
        if blim and total > blim:
            flag("danger", "%s carries %s, over its %s limit." % (name, W(total), W(blim)))
    known = [r["point_load"] for r in rows if r["point_load"] is not None]
    total = sum(known)
    tlim = limit_lb(lim.total_limit)
    if tlim and total > tlim:
        flag("danger", "The roof carries %s, over the venue's %s total." % (W(total), W(tlim)))
    unknown = [r for r in rows if r["point_load"] is None]
    if unknown:
        flag("warning", "%d point(s) have no load yet, so totals are low." % len(unknown), [r["id"] for r in unknown])
    if not setup.datum_set:
        flag("info", "No datum set: positions are from the drawing's origin. Set CL and PL (or DSE) first.")
    if not beams:
        flag("info", "No venue steel found (lines named or classed beam/steel), so dead hangs and bridles aren't worked out.")

    order = {"danger": 0, "warning": 1, "info": 2}
    checks.sort(key=lambda c: order[c["severity"]])
    return {
        "unit": unit, "points": rows, "trusses": truss_rows,
        "beams": [{"beam": k, "total": v, "total_text": W(v), "limit_text": W(limit_lb(setup.limits.beams.get(k, {}).get("limit", lim.beam_limit))) if (setup.limits.beams.get(k, {}).get("limit", lim.beam_limit)) else "–"} for k, v in sorted(beam_totals.items())],
        "total": total, "total_text": W(total), "total_limit_text": W(tlim) if tlim else "–",
        "checks": checks,
        "summary": {"points": len(rows), "danger": sum(c["severity"] == "danger" for c in checks), "warning": sum(c["severity"] == "warning" for c in checks)},
    }


def markout(rows: list, upi: float, metric: bool = False, round_to: float = None) -> list:
    """Points in walking order for chalking the floor: downstage to upstage in rows, alternating
    direction (no doubling back), distances rounded to round_to (default 1/2" or 10 mm)."""
    step = round_to if round_to else (0.5 * upi if not metric else 10 * upi / 25.4)
    rnd = lambda v: round(v / step) * step  # noqa: E731
    pts = sorted(rows, key=lambda r: (rnd(r["y"]), r["x"]))
    out, row_y, flip = [], None, False
    bucket = []
    for r in pts + [None]:
        y = None if r is None else rnd(r["y"])
        if r is None or (row_y is not None and abs(y - row_y) > 24 * upi):
            out += reversed(bucket) if flip else bucket
            flip = not flip
            bucket = []
        if r is not None:
            if not bucket:
                row_y = y
            bucket.append(r)
    lines = []
    for i, r in enumerate(out, start=1):
        x = rnd(r["x"])
        y = rnd(r["y"])
        lines.append({
            "n": i, "point": r["point"], "id": r["id"],
            "across": "on CL" if abs(x) < 1e-9 else "%s %s" % (format_length(abs(x), upi, metric), "SL" if x > 0 else "SR"),
            "updown": "on datum" if abs(y) < 1e-9 else "%s %s" % (format_length(abs(y), upi, metric), "US" if y > 0 else "DS"),
            "steel": r["steel"]["type"],
        })
    return lines


CSV_COLUMNS = [
    ("Point", "point"), ("Kind", "kind"), ("Position", "position"), ("X", "x_text"), ("Y", "y_text"), ("Hook Z", "z_text"),
    ("Hoist", "hoist"), ("Capacity", "capacity_text"), ("Trim", "trim"), ("Load", "load_text"), ("Load from", "load_source"),
    ("Point load (incl. hoist + chain)", "point_load_text"), ("With dynamic factor", "dynamic_text"), ("Steel", None), ("Status", "status"),
]


def to_csv(report: dict) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([c for c, _ in CSV_COLUMNS])
    for r in report["points"]:
        steel = r["steel"]["type"] + (" (" + " / ".join(r["steel"]["beams"]) + ")" if r["steel"]["beams"] else "")
        w.writerow([steel if key is None else ("" if r.get(key) is None else r.get(key)) for _, key in CSV_COLUMNS])
    w.writerow([])
    w.writerow(["Total", "", "", "", "", "", "", "", "", "", "", report["total_text"], "", "", "limit " + report["total_limit_text"]])
    return buf.getvalue()


def diff(before: list, after: list, upi: float, moved_tolerance: float = None) -> dict:
    """What changed between two point lists (by point ID): added, removed, moved, load changed."""
    tol = moved_tolerance if moved_tolerance is not None else 1 * upi
    a = {r["point"]: r for r in before if r.get("point")}
    b = {r["point"]: r for r in after if r.get("point")}
    moved, load = [], []
    for pid in sorted(set(a) & set(b)):
        d = math.hypot(a[pid]["x"] - b[pid]["x"], a[pid]["y"] - b[pid]["y"])
        if d > tol:
            moved.append({"point": pid, "by": d})
        la, lb = a[pid].get("point_load"), b[pid].get("point_load")
        if la is not None and lb is not None and abs(la - lb) > 1:
            load.append({"point": pid, "from": la, "to": lb})
    return {"added": sorted(set(b) - set(a)), "removed": sorted(set(a) - set(b)), "moved": moved, "load_changed": load}


def weight_in(unit: str, value_lb):
    return None if value_lb is None else lb_to(value_lb, unit)
