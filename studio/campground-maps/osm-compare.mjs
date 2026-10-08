// Checks that a campground's OpenStreetMap layers read from a regional extract match the OSM API's
// for the same box: the test the playbook asks for before a rollout switches to extracts (§4.1).
//
//   node studio/campground-maps/osm-compare.mjs public/private/camphawk/maps/ridb-<id>.json …
//
// The API answer comes from the build's cache (.cache/) when the map was built from the API, so a
// comparison costs OSM nothing; it is fetched (once, cached) otherwise. For each layer it prints
// how many features each read found and which OSM ways or nodes only one of them has. Some
// difference is expected where OSM was edited between the two dates (the extract's date and the
// API read's date are printed); anything else is a fault in the extract path.
import { readFileSync } from "node:fs";
import { fetchOsm, osmLayers, osmSource } from "./osm.mjs";

/** Per layer, the ids each read found (a way's or node's id; a point's position for pois). */
export function layerIds(doc) {
  const L = osmLayers(doc);
  const wayIds = (type) => new Set([...doc.ways.values()].filter(type).map((w) => w.id));
  return {
    roads: new Set(L.roads.map((f) => JSON.stringify(f.geometry.coordinates[0]) + JSON.stringify(f.geometry.coordinates.at(-1)))),
    trails: new Set(L.trails.map((f) => JSON.stringify(f.geometry.coordinates[0]) + JSON.stringify(f.geometry.coordinates.at(-1)))),
    pois: new Set(L.pois.map((p) => `${p.type}@${p.at.map((v) => v.toFixed(6))}`)),
    lots: new Set(L.lots.map((r) => JSON.stringify(r[0]))),
    buildings: new Set(L.buildings.map((b) => JSON.stringify(b.ring[0]))),
    water: new Set(L.water.map((r) => JSON.stringify(r[0]))),
    waterRelations: new Set(L.waterRelations),
    waterways: new Set(L.waterways.map((f) => JSON.stringify(f.geometry.coordinates[0]))),
    outlines: new Set(L.outlines.map((o) => JSON.stringify(o.rings[0][0]))),
    pitches: new Set(L.pitches.map((p) => `${p.ref}@${p.at.map((v) => v.toFixed(6))}`)),
    _wayCount: wayIds(() => true).size,
  };
}

/**
 * { layer: { api, extract, onlyApi, onlyExtract } } for two layerIds() results.
 * @returns {Record<string, { api: number, extract: number, onlyApi: number, onlyExtract: number }>}
 */
export function compareLayers(a, b) {
  /** @type {Record<string, { api: number, extract: number, onlyApi: number, onlyExtract: number }>} */
  const out = {};
  for (const k of Object.keys(a)) {
    if (k.startsWith("_")) continue;
    const onlyA = [...a[k]].filter((x) => !b[k].has(x)), onlyB = [...b[k]].filter((x) => !a[k].has(x));
    out[k] = { api: a[k].size, extract: b[k].size, onlyApi: onlyA.length, onlyExtract: onlyB.length };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("usage: osm-compare.mjs <map.json>…"); process.exit(1); }
  let worst = 0;
  for (const f of files) {
    const map = JSON.parse(readFileSync(f, "utf8"));
    const box = map.bbox;
    const src = osmSource(box, "extract");
    const [api, ext] = [await fetchOsm(box, { from: "api" }), await fetchOsm(box, src)];
    const cmp = compareLayers(layerIds(api), layerIds(ext));
    const diffs = Object.entries(cmp).filter(([, v]) => v.onlyApi || v.onlyExtract);
    const total = Object.values(cmp).reduce((n, v) => n + v.api, 0), off = Object.values(cmp).reduce((n, v) => n + v.onlyApi + v.onlyExtract, 0);
    worst = Math.max(worst, total ? off / total : 0);
    console.log(`${map.facilityId} ${map.name}: extract ${src.regions.join("+")} (OSM ${src.asOf}), ${total} API features, ${off} differ`);
    for (const [k, v] of diffs) console.log(`  ${k}: API ${v.api}, extract ${v.extract}; only API ${v.onlyApi}, only extract ${v.onlyExtract}`);
  }
  console.log(`worst share differing: ${(worst * 100).toFixed(1)}%`);
}
