import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Shared geometry for the campground-map builders (build.mjs = Recreation.gov, build-csp.mjs =
// California State Parks). Everything is in metres on a local flat projection, north up, rounded
// to 0.1 m: a campground is under a kilometre across and an SVG wants plain x/y.

export const r1 = (v) => Math.round(v * 10) / 10;
export const lines = (g) => g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
export const rings = (g) => g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : [];

/**
 * A projection and frame fitted to a campground's site points ([lon, lat] pairs), with `pad`
 * metres of context around the outermost sites, plus every helper that depends on the frame.
 */
export function makeGeo(points, pad = 55) {
  const lats = points.map((p) => p[1]), lons = points.map((p) => p[0]);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lon0 = (Math.min(...lons) + Math.max(...lons)) / 2;
  // Metres per degree at this latitude (WGS84, good to well under a metre across a campground).
  const rad = (lat0 * Math.PI) / 180;
  const mLat = 111132.92 - 559.82 * Math.cos(2 * rad) + 1.175 * Math.cos(4 * rad);
  const mLon = 111412.84 * Math.cos(rad) - 93.5 * Math.cos(3 * rad);
  const xy = ([lon, lat]) => [r1((lon - lon0) * mLon), r1(-(lat - lat0) * mLat)];

  const xs = points.map((p) => xy(p)[0]), ys = points.map((p) => xy(p)[1]);
  const frame = { x: r1(Math.min(...xs) - pad), y: r1(Math.min(...ys) - pad), w: r1(Math.max(...xs) - Math.min(...xs) + 2 * pad), h: r1(Math.max(...ys) - Math.min(...ys) + 2 * pad) };
  // The frame back in degrees, to ask map services for what's inside it.
  const deg = (x, y) => [lon0 + x / mLon, lat0 - y / mLat];
  const [w, s] = deg(frame.x, frame.y + frame.h), [e, n] = deg(frame.x + frame.w, frame.y);
  const bboxArr = [w, s, e, n];
  const bbox = bboxArr.map((v) => v.toFixed(6)).join(",");
  const inFrame = ([x, y]) => x >= frame.x && x <= frame.x + frame.w && y >= frame.y && y <= frame.y + frame.h;

  // Clip to the frame plus a margin, so strokes still run off the edge but a river 50 km long
  // doesn't ship. Lines: Liang-Barsky per segment. Rings: Sutherland-Hodgman against the box.
  const M = 30;
  const box = { x0: frame.x - M, y0: frame.y - M, x1: frame.x + frame.w + M, y1: frame.y + frame.h + M };
  function clipLine(pts) {
    const out = []; let cur = null;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const dx = bx - ax, dy = by - ay;
      let t0 = 0, t1 = 1, ok = true;
      for (const [p, q] of [[-dx, ax - box.x0], [dx, box.x1 - ax], [-dy, ay - box.y0], [dy, box.y1 - ay]]) {
        if (p === 0) { if (q < 0) { ok = false; break; } continue; }
        const t = q / p;
        if (p < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; }
        else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; }
      }
      if (!ok) { cur = null; continue; }
      const a = [ax + t0 * dx, ay + t0 * dy], b = [ax + t1 * dx, ay + t1 * dy];
      if (!cur || t0 > 0) { cur = [a]; out.push(cur); }
      cur.push(b);
      if (t1 < 1) cur = null;
    }
    return out;
  }
  function clipRing(pts) {
    const edges = [[(p) => p[0] >= box.x0, (a, b) => [box.x0, a[1] + ((b[1] - a[1]) * (box.x0 - a[0])) / (b[0] - a[0])]],
      [(p) => p[0] <= box.x1, (a, b) => [box.x1, a[1] + ((b[1] - a[1]) * (box.x1 - a[0])) / (b[0] - a[0])]],
      [(p) => p[1] >= box.y0, (a, b) => [a[0] + ((b[0] - a[0]) * (box.y0 - a[1])) / (b[1] - a[1]), box.y0]],
      [(p) => p[1] <= box.y1, (a, b) => [a[0] + ((b[0] - a[0]) * (box.y1 - a[1])) / (b[1] - a[1]), box.y1]]];
    let poly = pts;
    for (const [inside, cross] of edges) {
      const next = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[(i + poly.length - 1) % poly.length], b = poly[i];
        if (inside(b)) { if (!inside(a)) next.push(cross(a, b)); next.push(b); }
        else if (inside(a)) next.push(cross(a, b));
      }
      poly = next;
      if (!poly.length) break;
    }
    return poly;
  }
  const fmt = (p) => p.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L");
  /** SVG path data in frame metres, clipped. Closed rings end in Z. Empty when nothing is inside. */
  const pathOf = (parts, close) => parts
    .flatMap((p) => { const m = p.map(xy); return close ? [clipRing(m)] : clipLine(m); })
    .filter((p) => p.length > (close ? 2 : 1))
    .map((p) => "M" + fmt(p) + (close ? "Z" : "")).join("");

  /** Which way a site's number goes: straight away from the nearest road (GeoJSON line features),
      so it sits on the outside of the loop beside its own dot, not on the road. */
  function awayFromRoad(roadFeatures) {
    const segs = roadFeatures.flatMap((f) => lines(f.geometry).flatMap((p) => { const m = p.map(xy); return m.slice(1).map((b, i) => [m[i], b]); }));
    return ([x, y]) => {
      let best = null;
      for (const [[ax, ay], [bx, by]] of segs) {
        const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
        const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
        const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
        if (!best || d < best.d) best = { d, px, py };
      }
      if (!best || best.d < 0.5) return [0, 1];
      return [Math.round(((x - best.px) / best.d) * 100) / 100, Math.round(((y - best.py) / best.d) * 100) / 100];
    };
  }

  /** Where a name goes: the middle of its longest straight-ish run inside the frame, along it.
      Angles stay within ±90° so text never reads upside down. */
  function labelFor(text, kind, features) {
    let best = null;
    for (const f of features) for (const part of lines(f.geometry)) for (const run of clipLine(part.map(xy))) {
      for (let i = 1; i < run.length; i++) {
        const [ax, ay] = run[i - 1], [bx, by] = run[i];
        const len = Math.hypot(bx - ax, by - ay);
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const inset = mx > frame.x + 40 && mx < frame.x + frame.w - 40 && my > frame.y + 25 && my < frame.y + frame.h - 25;
        if (inset && (!best || len > best.len)) best = { len, at: [r1(mx), r1(my)], angle: Math.atan2(by - ay, bx - ax) * 180 / Math.PI };
      }
    }
    if (!best) return null;
    let a = best.angle; if (a > 90) a -= 180; if (a < -90) a += 180;
    return { text, kind, at: best.at, angle: Math.round(a) };
  }
  /** One name per stretch of map: a label within 80 m of one already placed is dropped. */
  const spaced = (labels) => labels.filter(Boolean).filter((l, i, all) => all.slice(0, i).filter(Boolean).every((o) => Math.hypot(o.at[0] - l.at[0], o.at[1] - l.at[1]) > 80));

  return { xy, frame, bbox, bboxArr, inFrame, clipLine, pathOf, awayFromRoad, labelFor, spaced };
}

/**
 * GET a URL as text, or stop the build. Every source must answer 2xx: a map silently missing its
 * roads or river is worse than a build that stops (OpenStreetMap's 429 once produced a map with
 * no roads). 5xx and 429 are retried with back-off. Answers are cached in .cache/ (git-ignored)
 * so a rebuild doesn't ask these free services again.
 */
const CACHE = new URL("./.cache/", import.meta.url);
export async function getText(url, headers = {}, body = undefined, attempts = 4) {
  const key = createHash("sha1").update(url + (body ?? "")).digest("hex");
  const file = new URL(key + ".txt", CACHE);
  if (existsSync(file)) return readFileSync(file, "utf8");
  for (let attempt = 1; ; attempt++) {
    // A hung server is retried like a 5xx (USGS's hydrography layers hung for minutes on 2026-10-07).
    const res = await fetch(url, { signal: AbortSignal.timeout(45000), ...(body === undefined ? { headers } : { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body }) })
      .catch((e) => ({ ok: false, status: e.name === "TimeoutError" ? 504 : 599 }));
    if (res.ok) {
      const text = await res.text();
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(file, text);
      return text;
    }
    const retry = res.status >= 500 || res.status === 429;
    if (!retry || attempt >= attempts) throw new Error(`${url.slice(0, 120)}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, (res.status === 429 ? 30000 : 2000) * attempt));
  }
}

export async function arcgis(url, bbox, fields, where = "1=1", extra = {}, attempts = 4) {
  const q = new URLSearchParams({ where, geometry: bbox, geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: fields, f: "geojson", ...extra });
  const j = JSON.parse(await getText(`${url}/query?${q}`, {}, undefined, attempts));
  if (j.error || !Array.isArray(j.features)) throw new Error(`${url}: ${JSON.stringify(j.error ?? "no features array")}`);
  // A service caps how many features one query returns. A capped answer is a layer with holes in
  // it, which is worse than a build that stops.
  if (j.exceededTransferLimit || j.properties?.exceededTransferLimit) throw new Error(`${url}: more features than one query returns`);
  return j.features;
}

export const NHD = "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer";
export const kept = (arr) => arr.filter((f) => f.d);
export const named = (fs, key) => [...new Set(fs.map((f) => f.properties[key]).filter(Boolean))];
