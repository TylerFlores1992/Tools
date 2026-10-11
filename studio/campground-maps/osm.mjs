// OpenStreetMap for a campground's frame: roads, paths, restrooms, water taps, parking, the
// campground's own outline and its numbered pitches. ODbL: every map that uses it credits
// "© OpenStreetMap contributors" (README.md).
//
// Two ways to read it, the same data either way:
// - From a regional extract (osm-extract.mjs trims one per region into .cache/osm/). A rollout
//   reads this way: OSM's API is for editing, and 2,196 maps is bulk use. `osmium extract` cuts
//   the campground's box out of every trimmed file whose data box overlaps it (two near a region
//   border), and the answers are merged.
// - From the OSM API's /map for the box, when no extract covers it. Fine for a single rebuild.
// osmSource() picks; the build records which (`sources.osmFrom`).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getText } from "./geo.mjs";

const OSM_DIR = join(import.meta.dirname, ".cache", "osm");
const CUT_DIR = join(import.meta.dirname, ".cache", "osm-cut");

const UA = { "User-Agent": "CampHawk-lab-map-builder/1.0 (+https://tylerflores.dev)" };
const tagsOf = (s) => Object.fromEntries([...(s ?? "").matchAll(/<tag k="([^"]*)" v="([^"]*)"/g)].map((t) => [unxml(t[1]), unxml(t[2])]));
const unxml = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Parsed OSM XML: nodes (with tags), ways (coordinates resolved) and relations. */
export function parseOsm(xml) {
  if (!xml.includes("<osm")) throw new Error("OpenStreetMap answered without map data");
  const nodes = new Map(), ways = new Map(), relations = [];
  for (const m of xml.matchAll(/<node id="(\d+)"[^>]*?lat="([-0-9.]+)" lon="([-0-9.]+)"[^>]*?(\/>|>([\s\S]*?)<\/node>)/g)) {
    nodes.set(m[1], { id: m[1], at: [Number(m[3]), Number(m[2])], tags: tagsOf(m[5]) });
  }
  for (const m of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
    const refs = [...m[2].matchAll(/<nd ref="(\d+)"/g)].map((r) => r[1]);
    const coords = refs.filter((r) => nodes.has(r)).map((r) => nodes.get(r).at);
    ways.set(m[1], { id: m[1], coords, complete: coords.length === refs.length, closed: refs.length > 3 && refs[0] === refs.at(-1), tags: tagsOf(m[2]) });
  }
  for (const m of xml.matchAll(/<relation id="(\d+)"[^>]*>([\s\S]*?)<\/relation>/g)) {
    const members = [...m[2].matchAll(/<member type="(\w+)" ref="(\d+)" role="([^"]*)"\/>/g)].map((x) => ({ type: x[1], ref: x[2], role: x[3] }));
    relations.push({ id: m[1], members, tags: tagsOf(m[2]) });
  }
  return { nodes, ways, relations };
}

export const ROAD_CLASSES = new Set(["service", "residential", "unclassified", "tertiary", "secondary", "primary", "trunk", "track", "living_street"]);
const POI = { toilets: "Restroom", drinking_water: "Water", water_point: "Water", sanitary_dump_station: "Dump Station", shower: "Showers" };
const centroid = (cs) => [cs.reduce((a, c) => a + c[0], 0) / cs.length, cs.reduce((a, c) => a + c[1], 0) / cs.length];
const line = (w) => ({ type: "Feature", properties: w.tags, geometry: { type: "LineString", coordinates: w.coords } });

/**
 * The layers a campground map uses, as GeoJSON-ish features in lon/lat.
 * - `roads`: drivable ways (no private driveways). A road is "campground" (drawn thin, and what
 *   site numbers turn away from) when OSM calls it service or track; the rest are through roads.
 * - `outlines`: tourism=camp_site areas (closed ways, or multipolygons whose outer rings are
 *   closed ways), used by QA to ask whether the sites sit inside the campground OSM knows.
 * - `pitches`: tourism=camp_pitch nodes with a ref, an independent record of where a numbered
 *   site is, used by QA to check RIDB's points.
 */
export function osmLayers({ nodes, ways, relations }) {
  const all = [...ways.values()].filter((w) => w.coords.length > 1);
  const roads = all.filter((w) => ROAD_CLASSES.has(w.tags.highway) && w.tags.service !== "driveway" && w.tags.access !== "private").map(line);
  const trails = all.filter((w) => ["footway", "path", "cycleway", "bridleway"].includes(w.tags.highway)).map(line);
  const pois = [
    ...[...nodes.values()].filter((n) => POI[n.tags.amenity]).map((n) => ({ type: POI[n.tags.amenity], name: n.tags.name ?? "", at: n.at })),
    ...all.filter((w) => POI[w.tags.amenity]).map((w) => ({ type: POI[w.tags.amenity], name: w.tags.name ?? "", at: centroid(w.closed ? w.coords.slice(1) : w.coords) })),
  ];
  const lots = all.filter((w) => w.tags.amenity === "parking" && w.closed).map((w) => w.coords);
  const buildings = all.filter((w) => w.tags.building && w.closed).map((w) => ({ name: w.tags.name ?? "", type: w.tags.amenity === "toilets" ? "Restroom" : (w.tags.building ?? ""), ring: w.coords }));
  const isWater = (t) => t.natural === "water" || t.waterway === "riverbank" || t.landuse === "reservoir";
  const water = all.filter((w) => w.closed && isWater(w.tags)).map((w) => w.coords);
  // Lakes big enough to be multipolygons: their member ways mostly lie outside the frame, so
  // the relation is fetched whole (waterRelations) and its rings assembled there.
  const waterRelations = relations.filter((r) => r.tags.type === "multipolygon" && isWater(r.tags)).map((r) => r.id);
  const waterways = all.filter((w) => ["river", "stream", "canal"].includes(w.tags.waterway)).map(line);
  const outlines = [
    ...all.filter((w) => w.tags.tourism === "camp_site" && w.closed).map((w) => ({ name: w.tags.name ?? "", rings: [w.coords] })),
    ...relations.filter((r) => r.tags.tourism === "camp_site" && r.tags.type === "multipolygon").map((r) => ({
      name: r.tags.name ?? "",
      rings: r.members.filter((m) => m.type === "way" && m.role === "outer").map((m) => ways.get(m.ref)).filter((w) => w?.closed && w.complete).map((w) => w.coords),
    })).filter((o) => o.rings.length),
  ];
  const pitches = [...nodes.values()].filter((n) => n.tags.tourism === "camp_pitch" && n.tags.ref).map((n) => ({ ref: n.tags.ref, at: n.at }));
  return { roads, trails, pois, lots, buildings, water, waterRelations, waterways, outlines, pitches };
}

/** The trimmed extracts on disk: { file, region, osmTimestamp, box: [w, s, e, n], rings? }.
    `rings` is the extract's published boundary (its .poly), when it was downloaded. */
export function extracts(dir = OSM_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    .filter((x) => x.box && x.file && existsSync(join(dir, x.file)))
    .map((x) => ({ ...x, file: join(dir, x.file), ...(x.poly && existsSync(join(dir, x.poly)) ? { rings: parsePoly(readFileSync(join(dir, x.poly), "utf8")) } : {}) }));
}

/**
 * An Osmosis .poly boundary: { outer: [ring…], holes: [ring…] }, rings of [lon, lat]. Sections
 * whose name starts with "!" are holes.
 */
export function parsePoly(text) {
  const out = { outer: [], holes: [] };
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let cur = null, hole = false;
  for (const l of lines.slice(1)) {
    if (!l) continue;
    if (l === "END") { if (cur) { (hole ? out.holes : out.outer).push(cur); cur = null; } continue; }
    const nums = l.split(/\s+/).map(Number);
    if (nums.length === 2 && nums.every(Number.isFinite) && cur) { cur.push(nums); continue; }
    cur = []; hole = l.startsWith("!");
  }
  return out;
}

const inRing = ([x, y], ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inPoly = (p, poly) => poly.outer.some((r) => inRing(p, r)) && !poly.holes.some((r) => inRing(p, r));
const boxesOverlap = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/**
 * Does an extract cover any of a [w, s, e, n] box? By its boundary when known (a corner or the
 * middle of the box inside it, or a boundary corner inside the box), else by its data box. A
 * campground box is a few km across, so this finds both extracts at a region border.
 */
export function covers(x, b) {
  if (!x.rings) return boxesOverlap(x.box, b);
  const pts = [[b[0], b[1]], [b[0], b[3]], [b[2], b[1]], [b[2], b[3]], [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]];
  if (pts.some((p) => inPoly(p, x.rings))) return true;
  return x.rings.outer.some((r) => r.some(([lon, lat]) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]));
}

/**
 * Where to read OSM for a [w, s, e, n] box: every extract whose data box overlaps it, or the API
 * when none does. `mode` "extract" refuses the API (a wave is read one way), "api" forces the API.
 */
export function osmSource(bboxArr, mode = "auto", list = extracts()) {
  if (mode === "api") return { from: "api" };
  const files = list.filter((x) => covers(x, bboxArr));
  if (files.length) return { from: "extract", files, regions: files.map((f) => f.region), asOf: files.map((f) => f.osmTimestamp).sort()[0] ?? null };
  if (mode === "extract") throw new Error(`no OSM extract covers ${bboxArr.map((v) => v.toFixed(3)).join(",")} (run osm-extract.mjs for its region)`);
  return { from: "api" };
}

/** Parsed OSM documents merged into one (two extracts overlap near a region border). A way
    complete in either copy is kept complete; a relation is kept once. */
export function mergeOsm(docs) {
  const nodes = new Map(), ways = new Map(), rel = new Map();
  for (const d of docs) {
    for (const [k, v] of d.nodes) nodes.set(k, v);
    for (const [k, v] of d.ways) { const had = ways.get(k); if (!had || (!had.complete && v.complete)) ways.set(k, v); }
    for (const r of d.relations) if (!rel.has(r.id)) rel.set(r.id, r);
  }
  return { nodes, ways, relations: [...rel.values()] };
}

const cutFile = (key) => join(CUT_DIR, createHash("sha1").update(key).digest("hex") + ".osm");
/** A cut counts as cached only when it has content: an osmium run killed mid-cut leaves an empty file. */
export const cachedCut = (file) => existsSync(file) && statSync(file).size > 0;
const cutKey = (x, box) => `${x.file}|${x.osmTimestamp}|${box}`;
const boxKey = (bboxArr) => bboxArr.map((v) => v.toFixed(6)).join(",");

/**
 * Cuts many boxes in one pass over each extract (`osmium extract -c`), into the same cache
 * fetchOsm() reads. One cut reads the whole extract (about 70 s for the 3 GB us-west), so a wave
 * cuts all its campgrounds at once: one pass per extract instead of one per campground.
 * Returns { cut, uncovered }: boxes cut now (cached ones are skipped), and boxes no extract
 * covers (left for the build, which fails them in "extract" mode or reads the API in "auto").
 */
export function prefetchOsm(boxes, mode = "auto", list = extracts(), batch = 100) {
  const todo = new Map();
  let uncovered = 0;
  for (const bboxArr of boxes) {
    const src = osmSource(bboxArr, mode === "api" ? "api" : "auto", list);
    if (src.from !== "extract") { if (mode !== "api") uncovered++; continue; }
    for (const x of src.files) {
      const key = cutKey(x, boxKey(bboxArr));
      if (cachedCut(cutFile(key))) continue;
      (todo.get(x.file) ?? todo.set(x.file, { x, boxes: [] }).get(x.file)).boxes.push(bboxArr);
    }
  }
  let n = 0;
  mkdirSync(CUT_DIR, { recursive: true });
  for (const { x, boxes: bs } of todo.values()) {
    for (let i = 0; i < bs.length; i += batch) {
      const part = bs.slice(i, i + batch);
      const config = { directory: CUT_DIR, extracts: part.map((b) => ({ output: cutFile(cutKey(x, boxKey(b))).split("/").pop(), output_format: "osm", bbox: b })) };
      const cfg = join(CUT_DIR, `batch-${process.pid}.json`);
      writeFileSync(cfg, JSON.stringify(config));
      execFileSync("osmium", ["extract", "-c", cfg, "-s", "complete_ways", "--overwrite", x.file], { stdio: ["ignore", "ignore", "inherit"] });
      n += part.length;
    }
  }
  return { cut: n, uncovered };
}

function osmiumXml(args, key) {
  const file = cutFile(key);
  if (cachedCut(file)) return readFileSync(file, "utf8");
  // A wave cuts every box first (prefetchOsm); a cut here reads a whole extract, so say so.
  if (args[0] === "extract") console.warn(`  OSM: cutting ${args[2]} alone (not prefetched; about a minute)`);
  const xml = execFileSync("osmium", [...args, "-f", "osm", "-o", "-"], { maxBuffer: 1 << 30 }).toString();
  mkdirSync(CUT_DIR, { recursive: true });
  // Written aside, then renamed, so a build stopped mid-write never leaves a half cut behind.
  writeFileSync(`${file}.${process.pid}.tmp`, xml);
  renameSync(`${file}.${process.pid}.tmp`, file);
  return xml;
}

/** OSM for a [w, s, e, n] box, from the source osmSource() picked (cached either way). */
export async function fetchOsm(bboxArr, source = { from: "api" }) {
  const box = boxKey(bboxArr);
  if (source.from === "extract") {
    // complete_ways: a road that leaves the box keeps all its nodes, as the API's /map answers.
    return mergeOsm(source.files.map((x) => parseOsm(osmiumXml(["extract", "-b", box, "-s", "complete_ways", x.file], cutKey(x, box)))));
  }
  return parseOsm(await getText(`https://api.openstreetmap.org/api/0.6/map?bbox=${box}`, UA));
}

/**
 * Join ways into closed rings by their shared end nodes (a lake's outline is often dozens of
 * ways). A chain that never closes is dropped: filling an open line would flood the wrong side.
 */
export function assembleRings(ways) {
  const open = ways.filter((w) => w.coords.length > 1).map((w) => [...w.coords]);
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  const rings = [];
  while (open.length) {
    let ring = open.shift();
    let grew = true;
    while (!same(ring[0], ring.at(-1)) && grew) {
      grew = false;
      for (let i = 0; i < open.length; i++) {
        const w = open[i];
        if (same(ring.at(-1), w[0])) ring = [...ring, ...w.slice(1)];
        else if (same(ring.at(-1), w.at(-1))) ring = [...ring, ...[...w].reverse().slice(1)];
        else if (same(ring[0], w.at(-1))) ring = [...w.slice(0, -1), ...ring];
        else if (same(ring[0], w[0])) ring = [...[...w].reverse().slice(0, -1), ...ring];
        else continue;
        open.splice(i, 1); grew = true; break;
      }
    }
    if (ring.length > 3 && same(ring[0], ring.at(-1))) rings.push(ring);
  }
  return rings;
}

/** A water multipolygon's rings, outer and inner (islands), fetched whole. */
export async function fetchWaterRelation(id, source = { from: "api" }) {
  const full = source.from === "extract"
    ? mergeOsm(source.files.map((x) => parseOsm(osmiumXml(["getid", "-r", x.file, `r${id}`], `${x.file}|${x.osmTimestamp}|r${id}`))))
    : parseOsm(await getText(`https://api.openstreetmap.org/api/0.6/relation/${id}/full`, UA));
  const rel = full.relations.find((r) => r.id === id);
  if (!rel) return [];
  const members = rel.members.filter((m) => m.type === "way").map((m) => full.ways.get(m.ref)).filter((w) => w && w.complete);
  return assembleRings(members);
}
