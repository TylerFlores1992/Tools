"""The ground under the trees, from USGS 3DEP lidar point clouds: for each built map, two greyscale
PNGs covering exactly its frame, for tracing campground lanes that canopy hides on the aerial photo.

    python3 -I studio/campground-maps/pointcloud/ground.py public/private/camphawk/maps/ridb-<id>.json [...] [--force]

Writes studio/campground-maps/.cache/pointcloud/ridb-<id>/ (git-ignored):
  intensity.png  how brightly the GROUND returned the laser, stretched per map: asphalt dark, gravel
                 and bare soil light, so a paved or gravelled lane shows plainly under full canopy;
  relief.png     the bare earth at 0.5 m from the ground-classified points (local relief plus a
                 hillshade): crowned lanes, pads and ditches;
  meta.json      the survey (work unit, collection dates, quality level), ground points per m², where
                 the points came from (ept or rockyweb), seconds and MB.
aerial-grid.mjs and aerial-check.mjs draw them with GROUND=intensity or GROUND=relief.

Where the points come from (USGS 3D Elevation Program, public domain):
  - The surveys over the map: USGS's lidar index (3DEPElevationIndex, layer 8, "WESM": work unit,
    collection dates, quality level, CRS) and the tiles: TNM Access's product search.
  - The NEWEST survey covering the whole map with good density (QL0-QL2, about 2+ points per m²)
    is read; an older or sparser one only when nothing better covers it.
  - When that work unit is in the Entwine Point Tiles bucket (s3://usgs-lidar-public, fast and
    spatially indexed) only the octree nodes over the frame are read. Otherwise its LAZ tiles come
    from rockyweb.usgs.gov (slow: ~0.25 MB/s a connection, so 16 byte ranges at once), each cropped
    and deleted as soon as it is read.
  - If the chosen survey turns out to hold under 1.5 ground points per m² (where lanes stop showing),
    the next good survey covering the map is tried once.

Disk: refuses to start a map, or a tile download, that would leave under 3 GB free; keeps no point
arrays once the PNGs are written. Install the packages first (requirements.txt):
    python3 -m pip install --target studio/campground-maps/.cache/py -r studio/campground-maps/pointcloud/requirements.txt
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STUDIO = os.path.dirname(HERE)
CACHE = os.path.join(STUDIO, ".cache")
sys.path.insert(0, os.path.join(CACHE, "py"))
sys.path.insert(0, HERE)

import io
import json
import shutil
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed

import frame as FR

OUT = os.path.join(CACHE, "pointcloud")
TMP = os.path.join(OUT, "tmp")
TNM = "https://tnmaccess.nationalmap.gov/api/v1/products"
WESM = "https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer/8/query"
EPT = "https://s3-us-west-2.amazonaws.com/usgs-lidar-public/"
# The same bucket by its other endpoints. S3 answered 404 for EPT hierarchy pages that exist, for
# minutes at a time, on one endpoint while another served them (2026-10-09), so a 404 tries the next.
EPT_HOSTS = (EPT, "https://s3.us-west-2.amazonaws.com/usgs-lidar-public/", "https://usgs-lidar-public.s3.us-west-2.amazonaws.com/")
CREDIT = "USGS 3D Elevation Program lidar point cloud (public domain)"
MARGIN = 40.0          # metres read past the frame, so the smoothing and the TIN reach the edge
MIN_GROUND = 1.5       # ground points per m² below which lanes stop showing
UA = {"User-Agent": "CampHawk-studio/1 (campground site maps; ground.py)"}


def log(*a):
    print(*a, flush=True)


def get(url, timeout=120, tries=5, headers=None):
    err = None
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={**UA, **(headers or {})}), timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            err = e
        except Exception as e:  # network blips: retry with back-off
            err = e
        time.sleep(2 + 4 * k)
    raise RuntimeError(f"{url}: {err}")


def ept_get(path, **kw):
    """A file of the EPT bucket, trying each endpoint (twice round) on a 404."""
    err = None
    for k in range(2 * len(EPT_HOSTS)):
        try:
            return get(EPT_HOSTS[k % len(EPT_HOSTS)] + path, **kw)
        except urllib.error.HTTPError as e:
            err = e
            time.sleep(1 + k)
    raise RuntimeError(f"EPT {path}: {err}")


def get_json(url, **kw):
    return json.loads(get(url, **kw))


def free_bytes():
    os.makedirs(OUT, exist_ok=True)
    return shutil.disk_usage(OUT).free


# --- Which surveys cover the map ---------------------------------------------------------------

def wesm_units(bbox):
    """3DEP work units over the bbox from USGS's lidar index: name, dates, QL, CRS, rockyweb link."""
    q = urllib.parse.urlencode({"geometry": ",".join(map(str, bbox)), "geometryType": "esriGeometryEnvelope", "inSR": 4326,
                                "spatialRel": "esriSpatialRelIntersects", "returnGeometry": "false", "f": "json",
                                "outFields": "workunit,collect_start,collect_end,ql,horiz_crs,vert_crs,lpc_link"})
    try:
        feats = get_json(f"{WESM}?{q}").get("features", [])
    except Exception as e:
        log(f"  (USGS's lidar index didn't answer: {e}; going by the tiles alone)")
        return []
    iso = lambda ms: time.strftime("%Y-%m-%d", time.gmtime(ms / 1000)) if ms else ""
    return [{"name": a["workunit"], "start": iso(a.get("collect_start")), "end": iso(a.get("collect_end")), "ql": a.get("ql"),
             "horizCrs": a.get("horiz_crs"), "vertCrs": a.get("vert_crs"), "link": (a.get("lpc_link") or "").rstrip("/")}
            for a in (f["attributes"] for f in feats)]


def tnm_tiles(bbox):
    """Every LPC tile TNM Access lists over the bbox."""
    items, off = [], 0
    while True:
        q = urllib.parse.urlencode({"datasets": "Lidar Point Cloud (LPC)", "bbox": ",".join(map(str, bbox)), "max": 200, "offset": off, "outputFormat": "JSON"})
        d = get_json(f"{TNM}?{q}", timeout=180)
        got = d.get("items", [])
        items += got
        off += len(got)
        if not got or off >= d.get("total", 0):
            break
    out = []
    for x in items:
        url = x.get("downloadLazURL") or x.get("downloadURL") or ""
        b = x.get("boundingBox") or {}
        if url.lower().endswith(".laz") and b:
            out.append({"url": url, "size": x.get("sizeInBytes") or 0, "published": x.get("publicationDate") or "",
                        "box": [b["minX"], b["minY"], b["maxX"], b["maxY"]]})
    return out


def unit_dir(url):
    """The work unit's folder in a rockyweb tile URL (everything before /LAZ/)."""
    i = url.lower().rfind("/laz/")
    return url[:i] if i >= 0 else url.rsplit("/", 1)[0]


def surveys(bbox):
    """The work units with tiles over the map, each with its tiles, coverage and density estimate."""
    tiles = tnm_tiles(bbox)
    if not tiles:
        return []
    wesm = wesm_units(bbox)
    units = {}
    for t in tiles:
        d = unit_dir(t["url"])
        u = next((w for w in wesm if w["link"] and d.lower().startswith(w["link"].lower())), None)
        key = u["name"] if u else d.rsplit("/", 1)[-1]
        if key not in units:
            units[key] = {**(u or {"name": key, "start": "", "end": "", "ql": None, "horizCrs": None, "vertCrs": None}), "tiles": [], "inIndex": bool(u)}
        if t["url"] not in {x["url"] for x in units[key]["tiles"]}:
            units[key]["tiles"].append(t)
    for u in units.values():
        u["cover"] = FR.cover_share([t["box"] for t in u["tiles"]], bbox)
        area = sum(_box_m2(t["box"]) for t in u["tiles"])
        u["bytesPerM2"] = sum(t["size"] for t in u["tiles"]) / area if area else None
        if not u["end"]:  # not in USGS's index yet: its publication date stands in, and meta.json says so
            u["published"] = max(t["published"] for t in u["tiles"])
            u["end"] = u["published"]
    return FR.rank_units(list(units.values()))


def _box_m2(b):
    import math
    return (b[2] - b[0]) * 111320 * math.cos(math.radians((b[1] + b[3]) / 2)) * (b[3] - b[1]) * 110540


# --- Reading points ------------------------------------------------------------------------------

class Points:
    """Cropped points in the map's metres, collected chunk by chunk."""
    COLS = ("x", "y", "z", "i", "c", "rn", "nr")

    def __init__(self, bbox, frame):
        self.bbox, self.frame = bbox, frame
        self.cols = {k: [] for k in self.COLS}
        self.bytes = 0

    def add(self, np, lon, lat, z, i, c, rn, nr):
        X, Y = FR.to_map(lon, lat, self.bbox, self.frame)
        f = self.frame
        k = (X > f["x"] - MARGIN) & (X < f["x"] + f["w"] + MARGIN) & (Y > f["y"] - MARGIN) & (Y < f["y"] + f["h"] + MARGIN)
        k &= (c != 7) & (c != 18)  # low and high noise
        if not k.any():
            return
        for name, arr, dt in (("x", X, np.float32), ("y", Y, np.float32), ("z", z, np.float32), ("i", i, np.uint16),
                              ("c", c, np.uint8), ("rn", rn, np.uint8), ("nr", nr, np.uint8)):
            self.cols[name].append(np.asarray(arr)[k].astype(dt))

    def done(self, np):
        out = {k: (np.concatenate(v) if v else np.zeros(0)) for k, v in self.cols.items()}
        self.cols = None
        return out


def ept_names():
    """The EPT bucket's datasets (one per work unit), listed live and cached for a week."""
    path = os.path.join(OUT, "ept-datasets.json")
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < 7 * 86400:
        return json.load(open(path))
    names, token = [], None
    ns = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}
    while True:
        q = {"list-type": "2", "delimiter": "/", "max-keys": "1000", **({"continuation-token": token} if token else {})}
        root = ET.fromstring(get(f"{EPT}?{urllib.parse.urlencode(q)}"))
        names += [p.text.rstrip("/") for p in root.findall("s3:CommonPrefixes/s3:Prefix", ns)]
        t = root.find("s3:NextContinuationToken", ns)
        if t is None:
            break
        token = t.text
    json.dump(names, open(path, "w"))
    return names


def read_ept(name, bbox, frame, np, laspy):
    """Only the octree nodes over the frame (plus margin), from the EPT bucket. EPSG:3857, z in metres."""
    base = f"{name}/"
    info = json.loads(ept_get(base + "ept.json"))
    if str((info.get("srs") or {}).get("horizontal")) != "3857":
        raise RuntimeError(f"{name}: EPT not in EPSG:3857")
    w, s, e, n = FR.frame_box_degrees(bbox, frame, MARGIN)
    x0, y0 = FR.merc(w, s)
    x1, y1 = FR.merc(e, n)
    box = [x0, y0, x1, y1]
    if not FR.covers_xy(info.get("boundsConforming") or info["bounds"], box):
        raise RuntimeError(f"{name}: the EPT dataset doesn't cover the frame")
    root = info["bounds"]
    nodes, todo, mb = [], ["0-0-0-0"], 0
    while todo:  # walk the hierarchy, only into nodes over the box
        page = todo.pop()
        raw = ept_get(f"{base}ept-hierarchy/{page}.json")
        mb += len(raw)
        for key, cnt in json.loads(raw).items():
            if not FR.overlaps_xy(FR.node_box(root, key), box):
                continue
            if cnt == -1:
                todo.append(key)
            elif cnt > 0:
                nodes.append(key)
    pts = Points(bbox, frame)

    def fetch(key):
        return ept_get(f"{base}ept-data/{key}.laz", timeout=180)

    with ThreadPoolExecutor(16) as ex:
        futs = [ex.submit(fetch, k) for k in nodes]
        for fu in as_completed(futs):
            data = fu.result()
            mb += len(data)
            las = laspy.read(io.BytesIO(data))
            x, y = np.asarray(las.x), np.asarray(las.y)
            k = (x > x0) & (x < x1) & (y > y0) & (y < y1)
            if k.any():
                lon, lat = FR.merc_inv(x[k], y[k], np)
                pts.add(np, lon, lat, np.asarray(las.z)[k], np.asarray(las.intensity)[k], np.asarray(las.classification)[k],
                        np.asarray(las.return_number)[k], np.asarray(las.number_of_returns)[k])
            del las, data
    pts.bytes = mb
    log(f"  EPT {name}: {len(nodes)} nodes, {mb / 1e6:.0f} MB")
    return pts


def download(url, path, size, conns=16):
    """A rockyweb tile in `conns` parallel byte ranges (each resumes on a dropped connection)."""
    step = -(-size // conns)
    ranges = [(k * step, min(size - 1, k * step + step - 1)) for k in range(conns) if k * step < size]
    with open(path, "wb") as f:
        f.truncate(size)

    def part(r):
        a, b = r
        at = a
        for k in range(12):
            try:
                req = urllib.request.Request(url, headers={**UA, "Range": f"bytes={at}-{b}"})
                with urllib.request.urlopen(req, timeout=300) as res, open(path, "r+b") as f:
                    if res.status != 206:
                        raise RuntimeError(f"no byte ranges ({res.status})")
                    f.seek(at)
                    while True:
                        buf = res.read(1 << 20)
                        if not buf:
                            break
                        f.write(buf)
                        at += len(buf)
                if at > b:
                    return
            except Exception:
                pass
            time.sleep(3 + 3 * k)
        raise RuntimeError(f"download stalled: {url} ({at - a} of {b - a + 1} bytes of one range)")

    with ThreadPoolExecutor(conns) as ex:
        list(ex.map(part, ranges))


def head_size(url):
    for k in range(8):
        try:
            req = urllib.request.Request(url, method="HEAD", headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                n = int(r.headers.get("Content-Length") or 0)
                if n > 1000:
                    return n
        except Exception:
            pass
        time.sleep(5 + 5 * k)
    raise RuntimeError(f"no size for {url}")


def tile_crs(fh, unit, tile, CRS, Transformer, np):
    """(horizontal CRS, z to metres) for a tile. Some legacy tiles carry no CRS record: then USGS's
    index's CRS for the work unit, checked against the tile's own footprint, else the projected CRS
    (of those whose area covers it) that puts the tile's corners where TNM says it is."""
    crs = None
    try:
        crs = fh.header.parse_crs()
    except Exception:
        crs = None
    zunit = None
    if crs is not None and crs.is_compound:
        try:
            zunit = crs.sub_crs_list[1].axis_info[0].unit_conversion_factor
        except Exception:
            pass
        crs = crs.sub_crs_list[0]
    h = fh.header
    corners = np.array([[h.mins[0], h.mins[1]], [h.maxs[0], h.mins[1]], [h.mins[0], h.maxs[1]], [h.maxs[0], h.maxs[1]]])
    lon_c, lat_c = (tile["box"][0] + tile["box"][2]) / 2, (tile["box"][1] + tile["box"][3]) / 2

    def miss(c):  # metres between the tile's corners in this CRS and TNM's footprint
        try:
            lo, la = Transformer.from_crs(c, "EPSG:4326", always_xy=True).transform(corners[:, 0], corners[:, 1])
        except Exception:
            return float("inf")
        b = tile["box"]
        if not np.all(np.isfinite(lo)):
            return float("inf")
        d = [abs(lo.min() - b[0]), abs(la.min() - b[1]), abs(lo.max() - b[2]), abs(la.max() - b[3])]
        return max(d[0] * 111320 * np.cos(np.radians(lat_c)), d[1] * 110540, d[2] * 111320 * np.cos(np.radians(lat_c)), d[3] * 110540)

    how = "the tile's own record"
    if crs is None and unit.get("horizCrs") and str(unit["horizCrs"]).isdigit():
        c = CRS.from_epsg(int(unit["horizCrs"]))
        if miss(c) < 300:
            crs, how = c, f"USGS's index (EPSG:{unit['horizCrs']})"
    if crs is None:
        from pyproj.database import query_crs_info, PJType
        from pyproj.aoi import AreaOfInterest
        best = (float("inf"), None)
        for info in query_crs_info(auth_name="EPSG", pj_types=[PJType.PROJECTED_CRS], area_of_interest=AreaOfInterest(lon_c, lat_c, lon_c, lat_c)):
            try:
                c = CRS.from_epsg(int(info.code))
            except Exception:
                continue
            m = miss(c)
            if m < best[0]:
                best = (m, c)
        if best[0] > 300:
            raise RuntimeError(f"tile has no CRS record and none fits its footprint: {tile['url']}")
        crs, how = best[1], f"the CRS that fits its footprint ({best[1].to_string()}, {best[0]:.0f} m)"
    if zunit is None and unit.get("vertCrs") and str(unit["vertCrs"]).isdigit():
        try:
            zunit = CRS.from_epsg(int(unit["vertCrs"])).axis_info[0].unit_conversion_factor
        except Exception:
            pass
    if zunit is None:
        zunit = crs.axis_info[0].unit_conversion_factor
    return crs, zunit, how


def read_rockyweb(unit, bbox, frame, np, laspy, CRS, Transformer):
    """The work unit's LAZ tiles over the frame, one at a time: download, crop, delete."""
    os.makedirs(TMP, exist_ok=True)
    w, s, e, n = FR.frame_box_degrees(bbox, frame, MARGIN)
    tiles = [t for t in unit["tiles"] if t["box"][0] < e and t["box"][2] > w and t["box"][1] < n and t["box"][3] > s]
    pts = Points(bbox, frame)
    for t in tiles:
        size = head_size(t["url"])
        if not FR.disk_ok(free_bytes(), size):
            raise RuntimeError(f"a {size / 1e6:.0f} MB tile would leave under 3 GB free; stopped")
        path = os.path.join(TMP, t["url"].rsplit("/", 1)[-1])
        t0 = time.time()
        try:
            download(t["url"], path, size)
            with laspy.open(path) as fh:
                crs, zunit, how = tile_crs(fh, unit, t, CRS, Transformer, np)
                to_ll = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
                # The frame (plus margin) in the tile's CRS, padded, to drop most points before projecting them.
                fx, fy = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform([w, e, w, e], [s, s, n, n])
                pad = 0.1 * max(max(fx) - min(fx), max(fy) - min(fy))
                nb = (min(fx) - pad, min(fy) - pad, max(fx) + pad, max(fy) + pad)
                for ch in fh.chunk_iterator(2_000_000):
                    x, y = np.asarray(ch.x), np.asarray(ch.y)
                    k = (x > nb[0]) & (x < nb[2]) & (y > nb[1]) & (y < nb[3])
                    if not k.any():
                        continue
                    lon, lat = to_ll.transform(x[k], y[k])
                    pts.add(np, lon, lat, np.asarray(ch.z)[k] * zunit, np.asarray(ch.intensity)[k], np.asarray(ch.classification)[k],
                            np.asarray(ch.return_number)[k], np.asarray(ch.number_of_returns)[k])
        finally:
            if os.path.exists(path):
                os.remove(path)
        pts.bytes += size
        log(f"  tile {t['url'].rsplit('/', 1)[-1]}: {size / 1e6:.0f} MB in {time.time() - t0:.0f} s (CRS from {how}; z x{zunit:.4g} to metres)")
    return pts


# --- Rendering -----------------------------------------------------------------------------------

def render(p, frame, np, ndimage, Delaunay, LinearNDInterpolator):
    """intensity and relief (uint8 arrays exactly over the frame) and the stats."""
    res = FR.pick_res(frame, MARGIN)
    G = FR.grid(frame, res, MARGIN)
    GW, GH, rx, ry, x0, y0 = G["GW"], G["GH"], G["rx"], G["ry"], G["x0"], G["y0"]
    n = GW * GH
    x, y, z, I, c, rn, nr = (p[k] for k in ("x", "y", "z", "i", "c", "rn", "nr"))
    g = c == 2
    cx = ((x - x0) / rx).astype(np.int64)
    cy = ((y - y0) / ry).astype(np.int64)
    ok = (cx >= 0) & (cx < GW) & (cy >= 0) & (cy < GH)
    idx = cy * GW + cx

    def mean(sel):
        i = idx[ok & sel]
        cnt = np.bincount(i, minlength=n).astype(np.float64)
        s = np.bincount(i, weights=I[ok & sel].astype(np.float64), minlength=n)
        out = np.full(n, np.nan)
        out[cnt > 0] = s[cnt > 0] / cnt[cnt > 0]
        return out.reshape(GH, GW)

    def fill(a):
        bad = np.isnan(a)
        if not bad.any():
            return a
        _, (iy, ix) = ndimage.distance_transform_edt(bad, return_indices=True)
        return a[iy, ix]

    # Where the ground was seen: ground returns within ~1.5 m (water and gaps in coverage are not).
    gcount = np.bincount(idx[ok & g], minlength=n).reshape(GH, GW).astype(float)
    seen = ndimage.gaussian_filter(gcount, 1.5 / res) > 0.15 * rx * ry

    def stretch(a, lo=2, hi=98):
        v = a[np.isfinite(a) & seen]
        if v.size == 0:
            return np.full(a.shape, 128, np.uint8)
        p0, p1 = np.percentile(v, [lo, hi])
        b = np.clip((np.nan_to_num(a, nan=p0) - p0) / max(1e-9, p1 - p0), 0, 1)
        out = (b * 255).astype(np.uint8)
        out[~seen] = 128  # not seen: flat mid grey, never a texture
        return out

    # Intensity of ground-classified single returns (the pulse's whole energy reached the ground), 1 m
    # smoothing; where too few single returns reach the ground (dense canopy), ground last returns.
    single = mean(g & (nr == 1))
    has = ndimage.gaussian_filter(np.isfinite(single).astype(float), 1.5 / res) > 0.05
    if (has & seen).sum() >= 0.6 * max(1, seen.sum()):
        gi, of = single, "ground single returns"
    else:
        gi, of = mean(g & (rn == nr)), "ground last returns"
    intensity = stretch(ndimage.gaussian_filter(fill(gi), 0.6 / res))

    # The bare earth: a TIN of the ground points (thinned to the lowest per half cell) sampled at cell
    # centres, then local relief (4 m window, +-0.15 m) over a four-way hillshade.
    gx, gy, gz = x[g].astype(np.float64), y[g].astype(np.float64), z[g].astype(np.float64)
    q = res / 2
    while True:
        cols = int(GW * rx / q) + 2
        key = ((gy - y0) / q).astype(np.int64) * cols + ((gx - x0) / q).astype(np.int64)
        o = np.lexsort((gz, key))
        first = np.r_[True, key[o][1:] != key[o][:-1]]
        sel = o[first]
        if sel.size <= 4_000_000:
            break
        q *= 1.4
    interp = LinearNDInterpolator(Delaunay(np.c_[gx[sel], gy[sel]]), gz[sel])
    XX, YY = np.meshgrid(x0 + (np.arange(GW) + 0.5) * rx, y0 + (np.arange(GH) + 0.5) * ry)
    dem = fill(interp(XX, YY))
    del XX, YY, interp
    win = max(3, int(4 / res) | 1)
    sm = ndimage.uniform_filter(ndimage.uniform_filter(dem, size=win), size=win)
    loc = (np.clip(dem - sm, -0.15, 0.15) + 0.15) / 0.3
    gyd, gxd = np.gradient(dem, ry, rx)
    gxd, gyd = gxd * 3, gyd * 3
    slope = np.arctan(np.hypot(gxd, gyd))
    aspect = np.arctan2(-gxd, gyd)
    alt = np.radians(35)
    hs = sum(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(np.radians(d) - aspect) for d in (315, 45, 135, 225)) / 4
    relief = ((0.55 * loc + 0.45 * np.clip(hs, 0, 1)) * 255).astype(np.uint8)
    relief[~seen] = 128

    crop = (slice(G["my"], G["my"] + G["H"]), slice(G["mx"], G["mx"] + G["W"]))
    inframe = (x >= frame["x"]) & (x < frame["x"] + frame["w"]) & (y >= frame["y"]) & (y < frame["y"] + frame["h"])
    area = frame["w"] * frame["h"]
    stats = {"res": round(res, 3), "width": G["W"], "height": G["H"], "intensityOf": of,
             "pointsPerM2": round(int(inframe.sum()) / area, 2), "groundPerM2": round(int((inframe & g).sum()) / area, 2),
             "groundSeen": round(float(seen[crop].mean()), 3)}
    return intensity[crop], relief[crop], stats


# --- One map -------------------------------------------------------------------------------------

def run(path, force=False):
    m = json.load(open(path))
    fid = str(m.get("facilityId") or os.path.basename(path).removeprefix("ridb-").removesuffix(".json"))
    od = os.path.join(OUT, f"ridb-{fid}")
    pngs = [os.path.join(od, f"{k}.png") for k in ("intensity", "relief")]
    if not m.get("bbox") or not m.get("frame"):
        log(f"ridb-{fid}: no bbox (rebuild the map)")
        return False
    if all(os.path.exists(p) for p in pngs) and not force:
        log(f"ridb-{fid}: already made ({od}); --force to make it again")
        return True
    free = free_bytes()
    if not FR.disk_ok(free):
        log(f"ridb-{fid}: NOT STARTED: {free / 1e9:.1f} GB free, under the 3 GB this needs left over")
        return False
    import numpy as np
    import laspy
    from pyproj import CRS, Transformer
    from scipy import ndimage
    from scipy.interpolate import LinearNDInterpolator
    from scipy.spatial import Delaunay
    from PIL import Image

    t0 = time.time()
    bbox, frame = m["bbox"], m["frame"]
    log(f"ridb-{fid} {m.get('name', '')}: finding USGS point clouds")
    units = surveys(FR.frame_box_degrees(bbox, frame, 0))
    if not units:
        log(f"ridb-{fid}: no USGS point cloud here")
        return True
    for u in units:
        log(f"  {u['name']}: {u['ql'] or 'QL ?'}, {u['start'] or '?'}..{u['end'] or '?'}{' (published)' if u.get('published') else ''}, "
            f"covers {u['cover']:.0%}, {len(u['tiles'])} tiles")
    names = None
    tried, best = [], None
    good = [u for u in units if u["cover"] >= FR.FULL_COVER and (FR.nominal_density(u) or 0) >= FR.GOOD_DENSITY]
    order = units[:1] + [u for u in good if u is not units[0]][:1]  # the pick, then one fallback
    for unit in order:
        if tried:
            log(f"  under {MIN_GROUND} ground points per m²: trying {unit['name']}")
        src = None
        try:
            names = names if names is not None else ept_names()
        except Exception as e:
            log(f"  (the EPT bucket didn't list: {e})")
            names = []
        en = FR.ept_name(unit["name"], names)
        pts = None
        if en:
            try:
                pts, src = read_ept(en, bbox, frame, np, laspy), "ept"
            except Exception as e:
                log(f"  EPT {en} didn't serve it ({e}); reading the tiles from rockyweb")
        if pts is None:
            pts, src = read_rockyweb(unit, bbox, frame, np, laspy, CRS, Transformer), "rockyweb"
        mb = pts.bytes / 1e6
        p = pts.done(np)
        del pts
        g = int((p["c"] == 2).sum())
        if g < 100:
            log(f"  {unit['name']}: no ground-classified points over the frame")
            tried.append({"workunit": unit["name"], "source": src, "MB": round(mb), "groundPerM2": 0})
            continue
        intensity, relief, stats = render(p, frame, np, ndimage, Delaunay, LinearNDInterpolator)
        del p
        tried.append({"workunit": unit["name"], "source": src, "MB": round(mb), "groundPerM2": stats["groundPerM2"]})
        if best is None or stats["groundPerM2"] > best[3]["groundPerM2"]:
            best = (unit, src, en, stats, intensity, relief)
        if stats["groundPerM2"] >= MIN_GROUND:
            break
    if best is None:
        log(f"ridb-{fid}: no survey here had ground points over the frame")
        return True
    unit, src, en, stats, intensity, relief = best
    os.makedirs(od, exist_ok=True)
    Image.fromarray(intensity).save(pngs[0])
    Image.fromarray(relief).save(pngs[1])
    meta = {"map": f"ridb-{fid}", "name": m.get("name"), "bbox": bbox, "frame": frame,
            "workunit": unit["name"], "ept": en if src == "ept" else None, "source": src,
            "survey": {"start": unit["start"] or None, "end": unit["end"] if not unit.get("published") else None,
                       **({"published": unit["published"]} if unit.get("published") else {})},
            "ql": unit["ql"], "cover": round(unit["cover"], 3), **stats,
            "seconds": round(time.time() - t0), "MB": round(sum(t["MB"] for t in tried)),
            "tried": tried if len(tried) > 1 else None, "credit": CREDIT, "made": time.strftime("%Y-%m-%d")}
    json.dump(meta, open(os.path.join(od, "meta.json"), "w"), indent=1)
    log(f"ridb-{fid}: {unit['name']} via {src}, {stats['groundPerM2']} ground pts/m², {meta['MB']} MB, {meta['seconds']} s -> {od}")
    if stats["groundPerM2"] < MIN_GROUND:
        log(f"  LANES MAY NOT SHOW: {stats['groundPerM2']} ground points per m² (under {MIN_GROUND})")
    return True


def main(argv):
    force = "--force" in argv
    files = [a for a in argv if not a.startswith("--")]
    if not files:
        print(__doc__.split("\n\n")[1])
        return 1
    ok = True
    for f in files:
        try:
            ok = run(f, force) and ok
        except Exception as e:
            log(f"{f}: FAILED: {e}")
            ok = False
        finally:
            if os.path.isdir(TMP):  # never leave a tile behind
                for x in os.listdir(TMP):
                    os.remove(os.path.join(TMP, x))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
