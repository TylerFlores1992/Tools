// Builds one campground's site map from free public data into a small JSON the lab draws as SVG.
//
//   node studio/campground-maps/build.mjs <ridb-dir> [facility-id]
//
// <ridb-dir> holds the unzipped RIDB full export (Campsites_API_v1.csv,
// CampsiteAttributes_API_v1.csv), downloaded with no key from
// https://ridb.recreation.gov/downloads/RIDBFullExport_V1_CSV.zip (248 MB; not committed).
// Everything else is fetched live from federal map services. Sources and licences: README.md.
//
// The output is in metres on a local flat projection (north up), rounded to 0.1 m, because a
// campground is under a kilometre across and an SVG wants plain x/y. Nothing here is traced from
// anyone's map picture: site points are Recreation.gov's published coordinates, the roads,
// restrooms and parking are the Park Service's own GIS, and the river is USGS hydrography.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [ridbDir, facilityId = "232447"] = process.argv.slice(2);
if (!ridbDir) { console.error("usage: build.mjs <ridb-dir> [facility-id]"); process.exit(1); }
const OUT = join(import.meta.dirname, "../../src/lab/camphawk/round2/maps");

/** RFC 4180 CSV (quoted fields, doubled quotes, newlines inside quotes), streamed by row. */
function* csvRows(path) {
  const s = readFileSync(path, "utf8").replace(/^﻿/, "");
  let row = [], field = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = ""; yield row; row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); yield row; }
}
function* csvObjects(path) {
  let head;
  for (const r of csvRows(path)) {
    if (!head) { head = r; continue; }
    if (r.length === 1 && r[0] === "") continue;
    yield Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""]));
  }
}

// --- Campsites (RIDB) ---
const sites = [];
for (const r of csvObjects(join(ridbDir, "Campsites_API_v1.csv"))) {
  if (r.FacilityID !== facilityId) continue;
  sites.push({ ridbId: r.CampsiteID, name: r.CampsiteName, type: r.CampsiteType, loop: r.Loop, accessible: r.CampsiteAccessible === "true", lat: Number(r.CampsiteLatitude) || 0, lon: Number(r.CampsiteLongitude) || 0 });
}
if (!sites.length) { console.error(`no campsites for facility ${facilityId}`); process.exit(1); }
const byRidb = new Map(sites.map((s) => [s.ridbId, s]));
const attrs = new Map();
for (const r of csvObjects(join(ridbDir, "CampsiteAttributes_API_v1.csv"))) {
  if (!byRidb.has(r.EntityID)) continue;
  (attrs.get(r.EntityID) ?? attrs.set(r.EntityID, {}).get(r.EntityID))[r.AttributeName] = r.AttributeValue;
}

const placed = sites.filter((s) => s.lat && s.lon);
const lat0 = (Math.min(...placed.map((s) => s.lat)) + Math.max(...placed.map((s) => s.lat))) / 2;
const lon0 = (Math.min(...placed.map((s) => s.lon)) + Math.max(...placed.map((s) => s.lon))) / 2;
// Metres per degree at this latitude (WGS84, good to well under a metre across a campground).
const rad = (lat0 * Math.PI) / 180;
const mLat = 111132.92 - 559.82 * Math.cos(2 * rad) + 1.175 * Math.cos(4 * rad);
const mLon = 111412.84 * Math.cos(rad) - 93.5 * Math.cos(3 * rad);
const r1 = (v) => Math.round(v * 10) / 10;
const xy = ([lon, lat]) => [r1((lon - lon0) * mLon), r1(-(lat - lat0) * mLat)];

const PAD = 55; // metres of context around the outermost sites
const xs = placed.map((s) => xy([s.lon, s.lat])[0]), ys = placed.map((s) => xy([s.lon, s.lat])[1]);
const frame = { x: r1(Math.min(...xs) - PAD), y: r1(Math.min(...ys) - PAD), w: r1(Math.max(...xs) - Math.min(...xs) + 2 * PAD), h: r1(Math.max(...ys) - Math.min(...ys) + 2 * PAD) };
// The frame back in degrees, to ask the map services for what's inside it.
const deg = (x, y) => [lon0 + x / mLon, lat0 - y / mLat];
const [w, s_] = deg(frame.x, frame.y + frame.h), [e, n] = deg(frame.x + frame.w, frame.y);
const bbox = [w, s_, e, n].map((v) => v.toFixed(6)).join(",");

async function arcgis(url, fields) {
  const q = new URLSearchParams({ geometry: bbox, geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: fields, f: "geojson" });
  const res = await fetch(`${url}/query?${q}`);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`${url}: ${JSON.stringify(j.error)}`);
  return j.features;
}
const NPS = "https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets";
const [roads, pois, buildings, lots, trails, water, flowlines] = await Promise.all([
  arcgis(`${NPS}/NPS_Public_Roads_Geographic/FeatureServer/0`, "RDNAME,RDCLASS,RDONEWAY,RDSTATUS,PUBLICDISPLAY"),
  arcgis(`${NPS}/NPS_Public_POIs_Geographic/FeatureServer/0`, "POINAME,POITYPE,PUBLICDISPLAY"),
  arcgis(`${NPS}/NPS_Public_Buildings_Geographic/FeatureServer/0`, "BLDGNAME,BLDGTYPE,PUBLICDISPLAY"),
  arcgis(`${NPS}/NPS_Public_ParkingLots_Geographic/FeatureServer/0`, "LOTNAME,PUBLICDISPLAY"),
  arcgis(`${NPS}/NPS_Public_Trails_Geographic/FeatureServer/0`, "TRLNAME,TRLCLASS,TRLUSE,PUBLICDISPLAY"),
  arcgis("https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/9", "FTYPE,FCODE"),
  arcgis("https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/6", "gnis_name,fcode"),
]);

const lines = (g) => g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
const rings = (g) => g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : [];
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

// Which way a site's number goes: straight away from the nearest campground road, so it sits on
// the outside of the loop beside its own dot instead of on the road or under the next site.
const roadSegs = roads.flatMap((f) => lines(f.geometry).flatMap((p) => { const m = p.map(xy); return m.slice(1).map((b, i) => [m[i], b]); }));
function awayFromRoad([x, y]) {
  let best = null;
  for (const [[ax, ay], [bx, by]] of roadSegs) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
    const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
    if (!best || d < best.d) best = { d, px, py };
  }
  if (!best || best.d < 0.5) return [0, 1];
  return [Math.round(((x - best.px) / best.d) * 100) / 100, Math.round(((y - best.py) / best.d) * 100) / 100];
}

const kept = (arr) => arr.filter((f) => f.d);

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
const named = (fs, key) => [...new Set(fs.map((f) => f.properties[key]).filter(Boolean))];
const labels = [
  ...named(roads.filter((f) => f.properties.RDCLASS !== "Service"), "RDNAME").map((n) => labelFor(n, "road", roads.filter((f) => f.properties.RDNAME === n))),
  ...named(trails, "TRLNAME").filter((n) => !named(roads, "RDNAME").includes(n)).sort((a, b) => Number(/bike path/i.test(a)) - Number(/bike path/i.test(b))).map((n) => labelFor(n, "trail", trails.filter((f) => f.properties.TRLNAME === n))),
  ...named(flowlines, "gnis_name").map((n) => labelFor(n, "water", flowlines.filter((f) => f.properties.gnis_name === n))),
].filter(Boolean)
  // One name per stretch of map: a second label within 80 m of one already placed is dropped
  // (the Valley Loop Trail and the bike path run side by side here).
  .filter((l, i, all) => all.slice(0, i).every((o) => Math.hypot(o.at[0] - l.at[0], o.at[1] - l.at[1]) > 80));
const out = {
  facilityId,
  source: { ridbExport: "RIDB full export (CSV), Recreation.gov, CC BY 4.0", built: new Date().toISOString().slice(0, 10) },
  frame,
  labels,
  roads: kept(roads.map((f) => ({ name: f.properties.RDNAME ?? "", cls: f.properties.RDCLASS ?? "", oneWay: f.properties.RDONEWAY ?? "", d: pathOf(lines(f.geometry), false) }))),
  trails: kept(trails.map((f) => ({ name: f.properties.TRLNAME ?? "", d: pathOf(lines(f.geometry), false) }))),
  lots: kept(lots.map((f) => ({ d: pathOf(rings(f.geometry), true) }))),
  water: kept(water.map((f) => ({ fcode: f.properties.FCODE ?? f.properties.fcode, d: pathOf(rings(f.geometry), true) }))),
  buildings: kept(buildings.map((f) => ({ name: f.properties.BLDGNAME ?? "", type: f.properties.BLDGTYPE ?? "", d: pathOf(rings(f.geometry), true) }))),
  pois: pois.filter((f) => f.geometry?.type === "Point").map((f) => ({ f, at: xy(f.geometry.coordinates) })).filter(({ at: [x, y] }) => x >= frame.x && x <= frame.x + frame.w && y >= frame.y && y <= frame.y + frame.h).map(({ f, at }) => ({ name: f.properties.POINAME ?? "", type: f.properties.POITYPE ?? "", at })),
  sites: sites
    .filter((s) => s.type !== "MANAGEMENT") // staff sites, never bookable
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
    .map((s) => {
      const a = attrs.get(s.ridbId) ?? {};
      const num = (k) => (Number(a[k]) > 0 ? Number(a[k]) : undefined); // RIDB writes 0 for "not recorded"
      return {
        name: s.name,
        type: s.type,
        at: s.lat && s.lon ? xy([s.lon, s.lat]) : null,
        out: s.lat && s.lon ? awayFromRoad(xy([s.lon, s.lat])) : undefined,
        accessible: s.accessible || a.Accessibility === "Y",
        maxVehicleFt: num("Max Vehicle Length"),
        maxPeople: num("Max Num of People"),
        backIn: /back-?in/i.test(a["Driveway Entry"] ?? "") || undefined,
        shade: a.Shade === "Yes" || undefined,
      };
    }),
};
mkdirSync(OUT, { recursive: true });
const file = join(OUT, `ridb-${facilityId}.json`);
writeFileSync(file, JSON.stringify(out) + "\n");
const unplaced = out.sites.filter((s) => !s.at).map((s) => s.name);
console.log(`${file}\n  ${out.sites.length} bookable sites (${unplaced.length} without a point${unplaced.length ? ": " + unplaced.join(", ") : ""})`);
console.log(`  ${out.roads.length} road parts, ${out.trails.length} trails, ${out.lots.length} lots, ${out.water.length} water, ${out.buildings.length} buildings, ${out.pois.length} points`);
console.log(`  frame ${frame.w} x ${frame.h} m`);
