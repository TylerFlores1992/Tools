// OpenStreetMap for a campground's frame: roads, paths, restrooms, water taps, parking, the
// campground's own outline and its numbered pitches. ODbL: every map that uses it credits
// "© OpenStreetMap contributors" (README.md).
//
// One call to the OSM API's /map for a small box (a campground frame is well under its 0.25
// square-degree limit). Fine for building a handful of maps; a rollout reads a Geofabrik extract
// instead (docs/design/campground-maps.md), because the API is for editing, not bulk reads.
import { getText } from "./geo.mjs";

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

/** Fetch and parse OSM for a [w, s, e, n] box (cached by getText). */
export async function fetchOsm(bboxArr) {
  const xml = await getText(`https://api.openstreetmap.org/api/0.6/map?bbox=${bboxArr.map((v) => v.toFixed(6)).join(",")}`, UA);
  return parseOsm(xml);
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
export async function fetchWaterRelation(id) {
  const full = parseOsm(await getText(`https://api.openstreetmap.org/api/0.6/relation/${id}/full`, UA));
  const rel = full.relations.find((r) => r.id === id);
  if (!rel) return [];
  const members = rel.members.filter((m) => m.type === "way").map((m) => full.ways.get(m.ref)).filter((w) => w && w.complete);
  return assembleRings(members);
}
