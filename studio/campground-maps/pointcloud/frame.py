"""Pure helpers for ground.py: the map frame's projection, the output grid, the EPT octree's node
boxes, which lidar survey to read, and the disk rule. No network and no third-party packages, so
test_frame.py runs them with a bare `python3 -I`.

A built map's local metres (x east, y south) are LINEAR in longitude and latitude across its bbox
(aerial-grid.mjs and trace-from-grid.mjs use the same interpolation), so a point converts by
interpolation, never by a projection of its own.
"""
import math
import re

MIN_FREE_BYTES = 3 * 1000**3  # refuse to start a map (or a download) that would leave less than 3 GB free
MERC_R = 6378137.0  # EPSG:3857's sphere, which the EPT bucket's points are in


def to_map(lon, lat, bbox, frame):
    """Degrees to the map's metres. Works on floats and on numpy arrays alike."""
    w, s, e, n = bbox
    return (frame["x"] + (lon - w) / (e - w) * frame["w"], frame["y"] + (n - lat) / (n - s) * frame["h"])


def to_degrees(x, y, bbox, frame):
    """The map's metres to degrees (the inverse of to_map)."""
    w, s, e, n = bbox
    return (w + (x - frame["x"]) / frame["w"] * (e - w), n - (y - frame["y"]) / frame["h"] * (n - s))


def frame_box_degrees(bbox, frame, margin):
    """[w, s, e, n] of the frame grown by `margin` metres on every side."""
    w, n = to_degrees(frame["x"] - margin, frame["y"] - margin, bbox, frame)
    e, s = to_degrees(frame["x"] + frame["w"] + margin, frame["y"] + frame["h"] + margin, bbox, frame)
    return [w, s, e, n]


def merc(lon, lat):
    """Degrees to EPSG:3857 metres (floats)."""
    return lon * math.pi / 180 * MERC_R, math.log(math.tan(math.pi / 4 + lat * math.pi / 360)) * MERC_R


def merc_inv(x, y, np=None):
    """EPSG:3857 metres to degrees: floats, or arrays when numpy is passed as `np`."""
    lat = (2 * (np.arctan(np.exp(y / MERC_R))) if np else 2 * math.atan(math.exp(y / MERC_R))) - math.pi / 2
    return x / MERC_R * 180 / math.pi, lat * 180 / math.pi


def grid(frame, res, margin):
    """The output grid: W x H cells covering EXACTLY the frame (so the cell is f.w/W by f.h/H, within a
    hair of `res`), plus `mx`/`my` whole cells of margin on each side for the smoothing and the TIN to
    run past the edge. Returns dict(W, H, rx, ry, mx, my, x0, y0, GW, GH): x0/y0 are the margin
    grid's top-left in map metres, GW/GH its size; the frame is cells [mx, mx+W) x [my, my+H)."""
    W = max(1, math.ceil(frame["w"] / res - 1e-9))
    H = max(1, math.ceil(frame["h"] / res - 1e-9))
    rx, ry = frame["w"] / W, frame["h"] / H
    mx, my = math.ceil(margin / rx), math.ceil(margin / ry)
    return {"W": W, "H": H, "rx": rx, "ry": ry, "mx": mx, "my": my,
            "x0": frame["x"] - mx * rx, "y0": frame["y"] - my * ry, "GW": W + 2 * mx, "GH": H + 2 * my}


def pick_res(frame, margin, base=0.5, max_cells=9_000_000):
    """0.5 m, coarser only when the frame plus margin would pass `max_cells` (memory and the TIN)."""
    area = (frame["w"] + 2 * margin) * (frame["h"] + 2 * margin)
    return max(base, math.sqrt(area / max_cells))


def node_box(root, key):
    """An EPT node's [xmin, ymin, zmin, xmax, ymax, zmax] from the root cube and its "D-X-Y-Z" key."""
    d, x, y, z = (int(v) for v in key.split("-"))
    size = [(root[i + 3] - root[i]) / 2**d for i in range(3)]
    lo = [root[0] + x * size[0], root[1] + y * size[1], root[2] + z * size[2]]
    return lo + [lo[0] + size[0], lo[1] + size[1], lo[2] + size[2]]


def overlaps_xy(a, box):
    """Does a node box (EPT order) overlap `box` = [xmin, ymin, xmax, ymax] in plan?"""
    return a[0] < box[2] and a[3] > box[0] and a[1] < box[3] and a[4] > box[1]


def covers_xy(bounds, box):
    """Do EPT bounds (EPT order) contain `box` = [xmin, ymin, xmax, ymax] in plan?"""
    return bounds[0] <= box[0] and bounds[1] <= box[1] and bounds[3] >= box[2] and bounds[4] >= box[3]


def _norm(name):
    n = name.lower()
    n = re.sub(r"^usgs_lpc_", "", n)
    n = re.sub(r"_las_\d{4}$", "", n)
    return n


def ept_name(workunit, names):
    """The EPT bucket's dataset for a 3DEP work unit, or None. The bucket names datasets by work unit,
    sometimes in another case and sometimes as USGS_LPC_<unit>_LAS_<year>."""
    want = _norm(workunit)
    for n in sorted(names):
        if _norm(n) == want:
            return n
    return None


QL_DENSITY = {"QL 0": 8.0, "QL 1": 8.0, "QL 2": 2.0, "QL 3": 0.5}  # nominal pulses per m² (USGS Lidar Base Specification)
GOOD_DENSITY = 2.0      # a survey this dense or denser (nominal, all returns) usually gives ~1.5 ground points per m²
FULL_COVER = 0.98       # a survey "covers" the map when its tiles reach this share of the bbox


def nominal_density(unit):
    """Points per m² a work unit should have: its quality level when it has one, else what its tiles'
    bytes per m² suggest (LAZ runs ~8 bytes a point), else None."""
    if unit.get("ql") in QL_DENSITY:
        return QL_DENSITY[unit["ql"]]
    if unit.get("bytesPerM2"):
        return unit["bytesPerM2"] / 8.0
    return None


def rank_units(units):
    """Work units in the order to try them: the ones covering the whole map first; among those the
    NEWEST survey with good density; surveys of unknown or poor density after every good one (densest
    first). Each unit: {name, end (ISO date or ''), ql, bytesPerM2, cover (0..1)}."""
    def key(u):
        dens = nominal_density(u)
        good = dens is not None and dens >= GOOD_DENSITY
        return (u.get("cover", 0) < FULL_COVER, not good, _neg(u.get("end")) if good else "", -(dens or 0), _neg(u.get("end")))
    return sorted(units, key=key)


def _neg(iso):
    # Sort ISO dates newest first inside an ascending sort: map each digit d to 9-d. No date sorts last.
    if not iso:
        return "~"
    return "".join(chr(ord("9") - ord(c) + ord("0")) if c.isdigit() else c for c in iso)


def disk_ok(free_bytes, need_bytes=0):
    """May a map (or a download of `need_bytes`) start with `free_bytes` free on the disk?"""
    return free_bytes - need_bytes >= MIN_FREE_BYTES


def cover_share(tile_boxes, bbox, n=24):
    """The share of `bbox` ([w, s, e, n] degrees) inside the union of `tile_boxes` (same order), by an
    n x n sample: a work unit with tiles over the map's edge only must not count as covering it."""
    w, s, e, nn = bbox
    hit = 0
    for i in range(n):
        lon = w + (i + 0.5) / n * (e - w)
        for j in range(n):
            lat = s + (j + 0.5) / n * (nn - s)
            if any(b[0] <= lon <= b[2] and b[1] <= lat <= b[3] for b in tile_boxes):
                hit += 1
    return hit / (n * n)
